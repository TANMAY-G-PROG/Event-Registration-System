import React, { useEffect, useState, useRef } from 'react';
import './participants.css';
import { useNavigate } from 'react-router-dom';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import DOMPurify from 'dompurify';

import { apiFetch } from './api.js';

// Cache fonts outside component to prevent re-fetching on every click
let cachedFontBytes = null;
let cachedTemplateBytes = null;

const Participants = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState({
    ongoing: [],
    completed: [],
    upcoming: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userInfo, setUserInfo] = useState({ userName: '', userUSN: '' });

  const [generatingIds, setGeneratingIds] = useState(new Set());
  const [downloadLinks, setDownloadLinks] = useState({});

  // Scroll Assistant Refs & States
  const completedRef = useRef(null);
  const ongoingRef = useRef(null);
  const upcomingRef = useRef(null);
  const [scrollPositions, setScrollPositions] = useState({
    completed: 'down',
    ongoing: 'down',
    upcoming: 'down'
  });

  // FAB Visibility Logic
  const [showFab, setShowFab] = useState(true);
  const buttonRef = useRef(null);

  // --- iOS Detection ---
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const wrapper = document.querySelector('.participants-page');
    if (isIOS && wrapper) {
      wrapper.classList.add('is-ios');
    }
  }, []);

  useEffect(() => {
    fetchUserInfo();
    fetchParticipantEvents();
  }, []);

  // --- Observer Fix ---
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowFab(!entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0.1,
      }
    );

    if (buttonRef.current) {
      observer.observe(buttonRef.current);
    }

    return () => {
      if (buttonRef.current) {
        observer.unobserve(buttonRef.current);
      }
    };
  }, [loading]);

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      Object.values(downloadLinks).forEach(link => {
        if (link && link.url) window.URL.revokeObjectURL(link.url);
      });
    };
  }, [downloadLinks]);

  const fetchUserInfo = async () => {
    try {
      const response = await apiFetch('/api/me', {
        method: 'GET'
      });
      if (response.ok) {
        const data = await response.json();
        setUserInfo({ userName: data.userName, userUSN: data.userUSN });
      }
    } catch (err) {
      console.error('Error fetching user info:', err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    const [h, m] = timeString.split(':');
    let hours = parseInt(h);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${m} ${ampm}`;
  };

  const categorizeEvents = (eventsList) => {
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    const categorized = { ongoing: [], completed: [], upcoming: [] };

    eventsList.forEach(event => {
      const eventDate = new Date(event.eventDate);
      eventDate.setHours(0, 0, 0, 0);
      const diffTime = eventDate.getTime() - currentDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) categorized.ongoing.push(event);
      else if (diffDays < 0) categorized.completed.push(event);
      else categorized.upcoming.push(event);
    });

    categorized.upcoming.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
    categorized.completed.sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate));

    return categorized;
  };

  const fetchParticipantEvents = async () => {
    try {
      const response = await apiFetch('/api/my-participant-events', {
        method: 'GET'
      });
      if (!response.ok) {
        if (response.status === 401) { navigate('/'); return; }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setEvents(categorizeEvents(data.participantEvents || []));
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // generateCertificate
  // Shows THIS event's activity points on the certificate ONLY if attended
  // ─────────────────────────────────────────────────────────────────────────
  const generateCertificate = async (event) => {
    if (downloadLinks[event.eid]?.url) window.URL.revokeObjectURL(downloadLinks[event.eid].url);
    setGeneratingIds(prev => new Set(prev).add(event.eid));

    try {
      if (!event.PartStatus) {
        alert('Certificate is only available for attended events.');
        setGeneratingIds(prev => { const next = new Set(prev); next.delete(event.eid); return next; });
        return;
      }

      const t = new Date().getTime();

      if (!cachedTemplateBytes) {
        const res = await fetch(`/certificate-template.pdf?v=${t}`);
        if (!res.ok) throw new Error('Template not found');
        cachedTemplateBytes = await res.arrayBuffer();
      }

      const pdfDoc = await PDFDocument.load(cachedTemplateBytes);
      pdfDoc.registerFontkit(fontkit);
      const page = pdfDoc.getPages()[0];
      const { width } = page.getSize();

      let nameFont;
      try {
        if (!cachedFontBytes) {
          const fontRes = await fetch(`/Allura-Regular.ttf?v=${t}`);
          if (fontRes.ok) cachedFontBytes = await fontRes.arrayBuffer();
          else throw new Error("Font missing");
        }
        nameFont = await pdfDoc.embedFont(cachedFontBytes);
      } catch {
        nameFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
      }

      const font = await pdfDoc.embedFont(StandardFonts.Courier);
      const boldFont = await pdfDoc.embedFont(StandardFonts.CourierBold);

      // Draw Name
      const nameText = userInfo.userName || "Participant";
      const nameWidth = nameFont.widthOfTextAtSize(nameText, 38);
      page.drawText(nameText, { x: (width - nameWidth) / 2, y: 250, size: 38, font: nameFont, color: rgb(0.97, 0.85, 0.57) });

      // Draw USN & Date
      page.drawText(userInfo.userUSN || "", { x: 170, y: 160, size: 19, font, color: rgb(1, 1, 1) });
      page.drawText(formatDate(event.eventDate), { x: 510, y: 160, size: 16, font: boldFont, color: rgb(1, 1, 1) });

      // Draw Description with wrapping
      const descFont = font;
      const contentText = event.certificate_info || event.eventdesc || event.ename;
      const words = contentText.split(' ');

      let line = '', yPos = 225;
      words.forEach(word => {
        const testLine = line + word + ' ';
        if (descFont.widthOfTextAtSize(testLine, 10) > 450 && line !== '') {
          page.drawText(line.trim(), { x: 190, y: yPos, size: 10, font: descFont, color: rgb(1, 1, 1) });
          line = word + ' '; yPos -= 15;
        } else { line = testLine; }
      });
      if (line) page.drawText(line.trim(), { x: 190, y: yPos, size: 10, font: descFont, color: rgb(1, 1, 1) });

      // ── Activity points: only printed if attended AND this event has points > 0 ──
      if (event.PartStatus && (event.earnedActivityPts || 0) > 0) {
        const pointsText = `Activity Points Earned: ${event.earnedActivityPts}`;
        const ptSize = 10;
        const ptWidth = boldFont.widthOfTextAtSize(pointsText, ptSize);
        const ptY = yPos - 30;
        page.drawText(pointsText, {
          x: (width - ptWidth) / 2,
          y: ptY,
          size: ptSize,
          font: boldFont,
          color: rgb(0.97, 0.85, 0.57) // gold — matches the name colour
        });
      }

      const pdfBytes = await pdfDoc.save();
      const url = window.URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));
      setDownloadLinks(prev => ({ ...prev, [event.eid]: { url, filename: `Certificate_${event.eid}.pdf` } }));

    } catch (err) {
      console.error(err);
      alert(`Error generating certificate: ${err.message}`);
    } finally {
      setGeneratingIds(prev => { const next = new Set(prev); next.delete(event.eid); return next; });
    }
  };

  const handleEventButtonClick = (event, type) => {
    if (type === 'completed') generateCertificate(event);
    else navigate(`/participant-ticket?eventId=${event.eid}`);
  };

  const handleCardScroll = (e, key) => {
    const el = e.target;
    const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 10;
    const newState = isAtBottom ? 'up' : 'down';
    if (scrollPositions[key] !== newState) {
      setScrollPositions(prev => ({ ...prev, [key]: newState }));
    }
  };

  const executeCardScroll = (key) => {
    const refs = { completed: completedRef, ongoing: ongoingRef, upcoming: upcomingRef };
    const el = refs[key].current;
    if (!el) return;

    if (scrollPositions[key] === 'up') {
      el.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const items = el.querySelectorAll('.part-event-item-glass');
      let target = null;
      for (let item of items) {
        if (item.offsetTop > el.scrollTop + 20) {
          target = item;
          break;
        }
      }
      if (target) {
        el.scrollTo({ top: target.offsetTop - 16, behavior: 'smooth' });
      } else {
        el.scrollBy({ top: 150, behavior: 'smooth' });
      }
    }
  };

  const ScrollAssistant = ({ type }) => {
    const icon = scrollPositions[type] === 'up' ? 'fa-chevron-up' : 'fa-chevron-down';
    return (
      <button 
        className={`card-scroll-assistant ${scrollPositions[type]}`}
        onClick={() => executeCardScroll(type)}
        title={scrollPositions[type] === 'up' ? 'Scroll to Top' : 'Scroll Down'}
      >
        <i className={`fas ${icon}`}></i>
      </button>
    );
  };

  const handleParticipateClick = () => navigate('/register-event');
  const handleBack = () => navigate('/events');

  const renderEventsList = (eventsList, eventType) => {
    if (loading) return <div className="event-item"><p>Loading...</p></div>;
    if (error) return <div className="event-item"><p>Error: {error}</p></div>;
    if (!eventsList || eventsList.length === 0) return <div className="event-item"><p>No events available</p></div>;

    return eventsList.map(event => (
      <div className="part-event-item-glass" key={event.eid}>
        <div className="part-event-info">
          <h4>{DOMPurify.sanitize(event.ename || 'N/A')}</h4>

          <div className="part-meta-info">
            <span><i className="fas fa-calendar-alt"></i> {formatDate(event.eventDate)}</span>
            <span><i className="fas fa-clock"></i> {formatTime(event.eventTime)}</span>
            <span><i className="fas fa-map-marker-alt"></i> {DOMPurify.sanitize(event.eventLoc || 'N/A')}</span>
          </div>

          <div className="part-status">
            Status: {event.PartStatus
              ? <span className="status-attended">Attended</span>
              : <span className="status-reg">Registered</span>}
          </div>

          {/* Activity points badge — shown on card whenever event has earned points > 0 */}
          {(event.earnedActivityPts || 0) > 0 && (
            <div className="part-activity-points">
              <i className="fas fa-star"></i> {event.earnedActivityPts} Claimable Activity Point{event.earnedActivityPts !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        <div className="part-event-actions">
          {eventType === 'completed' ? (
            !event.PartStatus ? (
              <div className="part-not-participated">
                You did not participate in the event
              </div>
            ) : generatingIds.has(event.eid) ? (
              <button className="part-glass-btn" disabled>Generating...</button>
            ) : downloadLinks[event.eid] ? (
              <a href={downloadLinks[event.eid].url} download={downloadLinks[event.eid].filename} className="part-glass-btn success">
                <i className="fas fa-download"></i> Download
              </a>
            ) : (
              <button className="part-glass-btn primary" onClick={() => handleEventButtonClick(event, eventType)}>
                View Certificate
              </button>
            )
          ) : (
            <button className="part-glass-btn secondary" onClick={() => handleEventButtonClick(event, eventType)}>
              View Ticket
            </button>
          )}
        </div>
      </div>
    ));
  };

  return (
    <div className="participants-page">
      <div className="part-bg-layer"></div>

      <div className="logout-container">
        <button id="backBtn" className="logout-btn" onClick={handleBack}>
          <i className="fas fa-arrow-left"></i> Back
        </button>
      </div>

      <section className="hero-section">
        <div className="container">

          <div className="card-grid">
            <div className="card" id="completed-card">
              <div className="card__background"></div>
              <div className="card__content">
                <h3 className="card__heading">Completed Events</h3>
                <div 
                  className="card__details"
                  ref={completedRef}
                  onScroll={(e) => handleCardScroll(e, 'completed')}
                >
                  {renderEventsList(events.completed, 'completed')}
                </div>
                {events.completed?.length > 1 && <ScrollAssistant type="completed" />}
              </div>
            </div>

            <div className="card" id="ongoing-card">
              <div className="card__background"></div>
              <div className="card__content">
                <h3 className="card__heading">Ongoing Events</h3>
                <div 
                  className="card__details"
                  ref={ongoingRef}
                  onScroll={(e) => handleCardScroll(e, 'ongoing')}
                >
                  {renderEventsList(events.ongoing, 'ongoing')}
                </div>
                {events.ongoing?.length > 1 && <ScrollAssistant type="ongoing" />}
              </div>
            </div>

            <div className="card" id="upcoming-card">
              <div className="card__background"></div>
              <div className="card__content">
                <h3 className="card__heading">Upcoming Events</h3>
                <div 
                  className="card__details"
                  ref={upcomingRef}
                  onScroll={(e) => handleCardScroll(e, 'upcoming')}
                >
                  {renderEventsList(events.upcoming, 'upcoming')}
                </div>
                {events.upcoming?.length > 1 && <ScrollAssistant type="upcoming" />}
              </div>
            </div>
          </div>

          {/* STATIC BUTTON */}
          <div className="button-container static-action-btn" ref={buttonRef}>
            <button onClick={handleParticipateClick}>
              Participate in other Event
            </button>
          </div>

          {/* MOBILE FAB */}
          <button
            className={`mobile-fab ${!showFab ? 'hidden' : ''}`}
            onClick={handleParticipateClick}
          >
            <i className="fas fa-plus"></i>
            <span>Participate</span>
          </button>

        </div>
      </section>
    </div>
  );
};

export default Participants;
