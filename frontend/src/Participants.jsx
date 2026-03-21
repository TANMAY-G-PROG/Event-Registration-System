import React, { useEffect, useState, useRef, useMemo } from 'react';
import './participants.css';
import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { apiFetch } from './api.js';

// --- PDF Generation Imports ---
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// Cache fonts outside component to prevent re-fetching on every click
let cachedFontBytes = null;
let cachedTemplateBytes = null;

const Participants = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState({ ongoing: [], completed: [], upcoming: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userInfo, setUserInfo] = useState({ userName: '', userUSN: '' });
  const [activeFilter, setActiveFilter] = useState('all');
  const [showFab, setShowFab] = useState(true);
  const ctaRef = useRef(null);

  // Certificate Generation States
  const [generatingIds, setGeneratingIds] = useState(new Set());
  const [downloadLinks, setDownloadLinks] = useState({});

  useEffect(() => { fetchUserInfo(); fetchParticipantEvents(); }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => setShowFab(!e.isIntersecting), { threshold: 0.1 });
    if (ctaRef.current) observer.observe(ctaRef.current);
    return () => { if (ctaRef.current) observer.unobserve(ctaRef.current); };
  }, [loading]);

  // Cleanup object URLs for memory management
  useEffect(() => {
    return () => {
      Object.values(downloadLinks).forEach(link => {
        if (link && link.url) window.URL.revokeObjectURL(link.url);
      });
    };
  }, [downloadLinks]);

  const fetchUserInfo = async () => {
    try {
      const res = await apiFetch('/api/me', { method: 'GET' });
      if (res.ok) { const d = await res.json(); setUserInfo({ userName: d.userName, userUSN: d.userUSN }); }
    } catch { }
  };

  const fmt = (ds) => {
    if (!ds) return 'N/A';
    return new Date(ds).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };
  const fmtTime = (ts) => {
    if (!ts) return 'N/A';
    const [h, m] = ts.split(':'); let hr = parseInt(h);
    const ap = hr >= 12 ? 'PM' : 'AM'; hr = hr % 12 || 12;
    return `${hr}:${m} ${ap}`;
  };

  const categorize = (list) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const c = { ongoing: [], completed: [], upcoming: [] };
    list.forEach(ev => {
      const d = new Date(ev.eventDate); d.setHours(0, 0, 0, 0);
      const diff = Math.ceil((d - today) / 86400000);
      if (diff === 0) c.ongoing.push(ev);
      else if (diff < 0) c.completed.push(ev);
      else c.upcoming.push(ev);
    });
    c.upcoming.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
    c.completed.sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate));
    return c;
  };

  const fetchParticipantEvents = async () => {
    try {
      const res = await apiFetch('/api/my-participant-events', { method: 'GET' });
      if (!res.ok) { if (res.status === 401) { navigate('/'); return; } throw new Error(`HTTP ${res.status}`); }
      const data = await res.json();
      setEvents(categorize(data.participantEvents || []));
      setLoading(false);
    } catch (err) { setError(err.message); setLoading(false); }
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
      page.drawText(fmt(event.eventDate), { x: 510, y: 160, size: 16, font: boldFont, color: rgb(1, 1, 1) });

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

      // Activity points
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
          color: rgb(0.97, 0.85, 0.57)
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

  const counts = useMemo(() => ({
    all: events.ongoing.length + events.completed.length + events.upcoming.length,
    upcoming: events.upcoming.length,
    ongoing: events.ongoing.length,
    completed: events.completed.length,
  }), [events]);

  const attendedCount = useMemo(() => events.completed.filter(e => e.PartStatus).length, [events]);

  const renderCard = (event, type) => {
    const isPast = type === 'completed';

    return (
      <div key={event.eid} className={`part-event-card ${type}`}>
        <div className="part-card-header">
          <h3 className="part-card-title">{DOMPurify.sanitize(event.ename || 'N/A')}</h3>
          <span className={`part-status-chip ${type}`}>
            {type === 'ongoing' ? '🟢 Live' : type === 'upcoming' ? 'Upcoming' : 'Done'}
          </span>
        </div>

        <div className="part-card-meta">
          <span className="part-card-meta-item date"><i className="fas fa-calendar-alt"></i>{fmt(event.eventDate)}</span>
          <span className="part-card-meta-item time"><i className="fas fa-clock"></i>{fmtTime(event.eventTime)}</span>
          <span className="part-card-meta-item place"><i className="fas fa-map-marker-alt"></i>{DOMPurify.sanitize(event.eventLoc || 'TBD')}</span>
        </div>

        {/* ── FOOTER: Badges & Static Buttons Inline ── */}
        <div className="part-card-footer">
          <div className="part-card-badges">
            {isPast && !event.PartStatus ? (
              <span className="part-no-attend">Did not attend</span>
            ) : (
              <>
                {event.PartStatus
                  ? <span className="part-attend-chip attended"><i className="fas fa-check"></i> Attended</span>
                  : <span className="part-attend-chip registered"><i className="fas fa-bookmark"></i> Registered</span>
                }
                {(event.earnedActivityPts || 0) > 0 && (
                  <span className="part-points-chip"><i className="fas fa-star"></i>{event.earnedActivityPts} pts</span>
                )}
              </>
            )}

            {/* NEW BUTTONS - Rendered alongside the tags, perfectly still */}
            {(type === 'upcoming' || type === 'ongoing') && (
              <button
                className="part-action-chip ticket-btn"
                onClick={() => navigate(`/participant-ticket?eventId=${event.eid}`)}
              >
                <i className="fas fa-ticket-alt"></i> View Ticket
              </button>
            )}

            {/* Certificate Generation Logic */}
            {(type === 'completed' && event.PartStatus) && (
              generatingIds.has(event.eid) ? (
                <button className="part-action-chip cert-btn" disabled>
                  <i className="fas fa-spinner fa-spin"></i> Generating...
                </button>
              ) : downloadLinks[event.eid] ? (
                <a
                  href={downloadLinks[event.eid].url}
                  download={downloadLinks[event.eid].filename}
                  className="part-action-chip cert-btn"
                  style={{ textDecoration: 'none' }}
                >
                  <i className="fas fa-download"></i> Download
                </a>
              ) : (
                <button
                  className="part-action-chip cert-btn"
                  onClick={() => generateCertificate(event)}
                >
                  <i className="fas fa-certificate"></i> View Cert
                </button>
              )
            )}
          </div>
        </div>
      </div>
    );
  };

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'ongoing', label: 'Live Now' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'completed', label: 'Completed' },
  ];

  return (
    <div className="participants-page">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" />

      <div style={{ paddingBottom: 60 }} /> {/* Top Spacer for Nav */}

      <section className="hero-section">
        <div className="container">

          {/* HERO BAND */}
          <div className="part-hero-band">
            <div className="memphis-circle"></div>
            <div className="memphis-dots"></div>

            <p className="part-hero-greeting">Participant Dashboard</p>
            <h1 className="part-hero-name">
              {userInfo.userName ? `Hey, ${userInfo.userName.split(' ')[0]} 👋` : 'Your Events'}
            </h1>
            <div className="part-stats-row">
              <div className="part-stat-pill">
                <span className="part-stat-num y">{counts.all}</span>
                <span className="part-stat-label">Total<br />Events</span>
              </div>
              <div className="part-stat-pill">
                <span className="part-stat-num g">{attendedCount}</span>
                <span className="part-stat-label">Attended</span>
              </div>
              <div className="part-stat-pill">
                <span className="part-stat-num p">{counts.upcoming}</span>
                <span className="part-stat-label">Upcoming</span>
              </div>
            </div>
          </div>

          {/* FILTER TABS */}
          <div className="part-filter-bar">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                className="part-filter-tab"
                data-active={activeFilter === key ? key : undefined}
                onClick={() => setActiveFilter(key)}
              >
                {label}
                <span className="part-filter-count">{counts[key]}</span>
              </button>
            ))}
          </div>

          {/* CONTENT */}
          {loading ? (
            <div className="part-feed" style={{ marginTop: '20px' }}>
              <div style={{ color: 'var(--yellow)', textAlign: 'center', padding: '40px', fontFamily: 'var(--mono)' }}>LOADING YOUR PASSES...</div>
            </div>
          ) : error ? (
            <div className="part-empty"><div className="part-empty-icon">⚠</div><p className="part-empty-txt">{error}</p></div>
          ) : (
            <>
              {activeFilter === 'all' ? (
                <>
                  {events.ongoing.length > 0 && (
                    <>
                      <div className="part-section-label">
                        <span className="part-section-label-text g">🟢 Live Now</span>
                        <div className="part-section-label-line"></div>
                      </div>
                      <div className="part-feed">{events.ongoing.map(e => renderCard(e, 'ongoing'))}</div>
                    </>
                  )}
                  {events.upcoming.length > 0 && (
                    <>
                      <div className="part-section-label">
                        <span className="part-section-label-text p">Upcoming</span>
                        <div className="part-section-label-line"></div>
                      </div>
                      <div className="part-feed">{events.upcoming.map(e => renderCard(e, 'upcoming'))}</div>
                    </>
                  )}
                  {events.completed.length > 0 && (
                    <>
                      <div className="part-section-label">
                        <span className="part-section-label-text b">Completed</span>
                        <div className="part-section-label-line"></div>
                      </div>
                      <div className="part-feed">{events.completed.map(e => renderCard(e, 'completed'))}</div>
                    </>
                  )}
                  {counts.all === 0 && (
                    <div className="part-empty">
                      <div className="part-empty-icon">🎟</div>
                      <p className="part-empty-txt">No events yet — go join something!</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {(activeFilter === 'ongoing' ? events.ongoing :
                    activeFilter === 'upcoming' ? events.upcoming :
                      events.completed).length === 0 ? (
                    <div className="part-empty">
                      <div className="part-empty-icon">🎟</div>
                      <p className="part-empty-txt">No {activeFilter} events</p>
                    </div>
                  ) : (
                    <div className="part-feed" style={{ marginTop: '20px' }}>
                      {(activeFilter === 'ongoing' ? events.ongoing :
                        activeFilter === 'upcoming' ? events.upcoming :
                          events.completed).map(e => renderCard(e, activeFilter))}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* CTA */}
          <div className="part-cta-strip" ref={ctaRef}>
            <button className="part-cta-btn" onClick={() => navigate('/register-event')}>
              <i className="fas fa-plus"></i>
              Discover &amp; Join Events
            </button>
          </div>

        </div>
      </section>

      <button
        className={`mobile-fab ${!showFab ? 'hidden' : ''}`}
        onClick={() => navigate('/register-event')}
      >
        <i className="fas fa-plus"></i>
        <span>Join Event</span>
      </button>
    </div>
  );
};

export default Participants;