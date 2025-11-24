import React, { useEffect, useState } from 'react';
import './participants.css';
import { useNavigate } from 'react-router-dom';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

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

  useEffect(() => {
    fetchUserInfo();
    fetchParticipantEvents();
  }, []);

  useEffect(() => {
    return () => {
      Object.values(downloadLinks).forEach(link => {
        if (link && link.url) {
          window.URL.revokeObjectURL(link.url);
        }
      });
    };
  }, [downloadLinks]);

  const fetchUserInfo = async () => {
    try {
      const response = await fetch('/api/me', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
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
      const diffDays = Math.ceil((eventDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) categorized.ongoing.push(event);
      else if (diffDays < 0) categorized.completed.push(event);
      else categorized.upcoming.push(event);
    });
    return categorized;
  };

  const fetchParticipantEvents = async () => {
    try {
      const response = await fetch('/api/my-participant-events', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        if (response.status === 401) { navigate('/'); return; }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setEvents(categorizeEvents(data.participantEvents || []));
      setLoading(false);
    } catch (err) {
      console.error('Error fetching participant events:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const generateCertificate = async (event) => {
    if (downloadLinks[event.eid]?.url) window.URL.revokeObjectURL(downloadLinks[event.eid].url);
    setGeneratingIds(prev => new Set(prev).add(event.eid));
    setDownloadLinks(prev => ({ ...prev, [event.eid]: null }));

    try {
      if (!event.PartStatus) {
        alert('Certificate is only available for attended events.');
        setGeneratingIds(prev => { const next = new Set(prev); next.delete(event.eid); return next; });
        return;
      }
      
      const t = new Date().getTime();
      const existingPdfBytes = await fetch(`/certificate-template.pdf?v=${t}`).then(res => {
        if (!res.ok) throw new Error('Template not found');
        return res.arrayBuffer();
      });

      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      pdfDoc.registerFontkit(fontkit);
      const page = pdfDoc.getPages()[0];
      const { width } = page.getSize();

      // Font Loading Logic (Simplified for brevity, exact logic maintained)
      let nameFont;
      try {
        const fontBytes = await fetch(`/Allura-Regular.ttf?v=${t}`).then(r => r.ok ? r.arrayBuffer() : Promise.reject());
        nameFont = await pdfDoc.embedFont(fontBytes);
      } catch { nameFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold); }

      const font = await pdfDoc.embedFont(StandardFonts.Courier);
      const boldFont = await pdfDoc.embedFont(StandardFonts.CourierBold);
      
      // Draw Text
      const nameText = userInfo.userName;
      const nameWidth = nameFont.widthOfTextAtSize(nameText, 38);
      page.drawText(nameText, { x: (width - nameWidth) / 2, y: 250, size: 38, font: nameFont, color: rgb(0.97, 0.85, 0.57) });
      page.drawText(userInfo.userUSN, { x: 170, y: 160, size: 19, font, color: rgb(1,1,1) });
      page.drawText(formatDate(event.eventDate), { x: 510, y: 160, size: 16, font: boldFont, color: rgb(1,1,1) });

      // Description Drawing Logic
      const descFont = font; 
      const words = (event.eventdesc || event.ename).split(' ');
      let line = '', yPos = 225;
      words.forEach(word => {
        const testLine = line + word + ' ';
        if (descFont.widthOfTextAtSize(testLine, 10) > 450 && line !== '') {
          page.drawText(line.trim(), { x: 190, y: yPos, size: 10, font: descFont, color: rgb(1,1,1) });
          line = word + ' '; yPos -= 15;
        } else { line = testLine; }
      });
      if (line) page.drawText(line.trim(), { x: 190, y: yPos, size: 10, font: descFont, color: rgb(1,1,1) });

      const pdfBytes = await pdfDoc.save();
      const url = window.URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));
      setDownloadLinks(prev => ({ ...prev, [event.eid]: { url, filename: `Certificate_${event.eid}.pdf` } }));

    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setGeneratingIds(prev => { const next = new Set(prev); next.delete(event.eid); return next; });
    }
  };

  const handleEventButtonClick = (event, type) => {
    if (type === 'completed') generateCertificate(event);
    else navigate(`/participant-ticket?eventId=${event.eid}`);
  };

  const handleParticipateClick = () => navigate('/register-event');
  const handleBack = () => navigate('/events');

  const renderEvents = (list, type) => {
    if (loading) return <div className="cyber-loader">Loading data...</div>;
    if (error) return <div className="cyber-error">{error}</div>;
    if (!list.length) return <div className="cyber-empty">No events found</div>;

    return list.map(ev => (
      <div className="cyber-event-row" key={ev.eid}>
        <div className="cyber-event-details">
          <h4>{DOMPurify.sanitize(ev.ename)}</h4>
          <div className="cyber-meta">
            <span><i className="fas fa-calendar-alt"></i> {formatDate(ev.eventDate)}</span>
            <span><i className="fas fa-clock"></i> {formatTime(ev.eventTime)}</span>
            <span><i className="fas fa-map-marker-alt"></i> {ev.eventLoc}</span>
          </div>
          <div className={`cyber-status status-${ev.PartStatus ? 'attended' : 'registered'}`}>
            {ev.PartStatus ? 'Attended' : 'Registered'}
          </div>
        </div>
        
        <div className="cyber-actions">
          {type === 'completed' ? (
            generatingIds.has(ev.eid) ? (
              <button className="cyber-btn disabled" disabled>
                <span className="cyber-spinner"></span> Generating...
              </button>
            ) : downloadLinks[ev.eid] ? (
              <a href={downloadLinks[ev.eid].url} download={downloadLinks[ev.eid].filename} className="cyber-btn success">
                <i className="fas fa-download"></i> Download
              </a>
            ) : (
              <button className="cyber-btn glow" onClick={() => handleEventButtonClick(ev, type)}>
                <i className="fas fa-certificate"></i> Certificate
              </button>
            )
          ) : (
            <button className="cyber-btn primary" onClick={() => handleEventButtonClick(ev, type)}>
              View Ticket
            </button>
          )}
        </div>
      </div>
    ));
  };

  return (
    <div className="participants-page">
      {/* Preserved Back Button */}
      <div className="logout-container">
        <button id="backBtn" className="logout-btn" onClick={handleBack}>
          <i className="fas fa-arrow-left"></i> Back
        </button>
      </div>

      <section className="hero-section">
        <div className="container">
          <h1 className="cyber-title">My <span className="highlight">Participation</span></h1>
          
          <div className="cyber-grid">
            {/* Completed Events Panel */}
            <div className="cyber-panel completed-panel">
              <div className="panel-header">
                <h3><i className="fas fa-check-circle"></i> Completed</h3>
                <span className="badge">{events.completed.length}</span>
              </div>
              <div className="panel-body">
                {renderEvents(events.completed, 'completed')}
              </div>
            </div>

            {/* Active Events Panel (Ongoing + Upcoming) */}
            <div className="cyber-panel active-panel">
              <div className="panel-header">
                <h3><i className="fas fa-bolt"></i> Active</h3>
                <span className="badge">{events.ongoing.length + events.upcoming.length}</span>
              </div>
              <div className="panel-body">
                {events.ongoing.length > 0 && (
                  <div className="sub-section">
                    <h5>Ongoing Now</h5>
                    {renderEvents(events.ongoing, 'ongoing')}
                  </div>
                )}
                <div className="sub-section">
                  <h5>Upcoming</h5>
                  {renderEvents(events.upcoming, 'upcoming')}
                </div>
              </div>
            </div>
          </div>

          {/* Preserved Participate Button */}
          <div className="button-container">
            <button onClick={handleParticipateClick}>
              Participate in other Event
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Participants;
