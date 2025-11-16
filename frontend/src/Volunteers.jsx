import React, { useEffect, useState } from 'react';
import './volunteers.css';
import { useNavigate } from 'react-router-dom';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const Volunteers = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState({
    ongoing: [],
    completed: [],
    upcoming: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userInfo, setUserInfo] = useState({ userName: '', userUSN: '' });

  // ✅ ADDED: Same state management as participants.jsx
  const [generatingIds, setGeneratingIds] = useState(new Set());
  const [downloadLinks, setDownloadLinks] = useState({});

  useEffect(() => {
    fetchUserInfo();
    fetchVolunteerEvents();
  }, []);

  // ✅ ADDED: Cleanup object URLs on unmount
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
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUserInfo({
          userName: data.userName,
          userUSN: data.userUSN
        });
      }
    } catch (err) {
      console.error('Error fetching user info:', err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    const timeParts = timeString.split(':');
    let hours = parseInt(timeParts[0]);
    const minutes = timeParts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  const categorizeEvents = (events) => {
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    const uniqueEvents = events.reduce((acc, current) => {
      const exists = acc.find(event => event.eid === current.eid);
      if (!exists) {
        acc.push(current);
      }
      return acc;
    }, []);

    const categorized = {
      ongoing: [],
      completed: [],
      upcoming: []
    };

    uniqueEvents.forEach(event => {
      const eventDate = new Date(event.eventDate);
      eventDate.setHours(0, 0, 0, 0);

      const diffTime = eventDate.getTime() - currentDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        categorized.ongoing.push(event);
      } else if (diffDays < 0) {
        categorized.completed.push(event);
      } else {
        categorized.upcoming.push(event);
      }
    });

    return categorized;
  };

  const fetchVolunteerEvents = async () => {
    try {
      const response = await fetch('/api/my-volunteer-events', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const volunteerEvents = data.volunteerEvents || [];
      const categorizedEvents = categorizeEvents(volunteerEvents);
      setEvents(categorizedEvents);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching volunteer events:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  // ✅ UPDATED: Now uses state management instead of direct download
  const generateCertificate = async (event) => {
    // Cleanup & set loading state
    if (downloadLinks[event.eid] && downloadLinks[event.eid].url) {
      window.URL.revokeObjectURL(downloadLinks[event.eid].url);
    }
    setGeneratingIds(prev => new Set(prev).add(event.eid));
    setDownloadLinks(prev => ({ ...prev, [event.eid]: null }));

    try {
      if (!event.VolnStatus) {
        alert('Certificate is only available for confirmed volunteer participation.');
        setGeneratingIds(prev => {
          const next = new Set(prev);
          next.delete(event.eid);
          return next;
        });
        return;
      }

      const t = new Date().getTime();
      const templateUrl = `/certificate-template.pdf?v=${t}`;
      const existingPdfBytes = await fetch(templateUrl).then(res => {
        if (!res.ok) {
          throw new Error('Certificate template not found. Please ensure certificate-template.pdf is in the public folder.');
        }
        return res.arrayBuffer();
      });

      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      pdfDoc.registerFontkit(fontkit);
      
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();

      let nameFont;
      try {
        const fontUrl = `/Allura-Regular.ttf?v=${t}`;
        const fontBytes = await fetch(fontUrl).then(res => {
          if (!res.ok) {
            throw new Error('Allura-Regular.ttf font file not found.');
          }
          return res.arrayBuffer();
        });
        nameFont = await pdfDoc.embedFont(fontBytes);
      } catch (fontError) {
        console.warn('Could not load custom font, using TimesRomanBold as fallback:', fontError);
        nameFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
      }
      
      const font = await pdfDoc.embedFont(StandardFonts.Courier);
      const boldFont = await pdfDoc.embedFont(StandardFonts.CourierBold);

      let descFont;
      try {
        const descFontUrl = `/PlayfairDisplay-MediumItalic.ttf?v=${t}`;
        const descFontBytes = await fetch(descFontUrl).then(res => {
          if (!res.ok) {
            throw new Error('PlayfairDisplay-MediumItalic.ttf font file not found.');
          }
          return res.arrayBuffer();
        });
        descFont = await pdfDoc.embedFont(descFontBytes);
      } catch (fontError) {
        console.warn('Could not load custom description font, using Courier as fallback:', fontError);
        descFont = font;
      }

      const nameColor = rgb(0xF7 / 255, 0xD9 / 255, 0x91 / 255);
      const whiteColor = rgb(1, 1, 1);

      const nameText = userInfo.userName;
      const nameSize = 38;
      const nameWidth = nameFont.widthOfTextAtSize(nameText, nameSize);
      firstPage.drawText(nameText, {
        x: (width - nameWidth) / 2,
        y: 250,
        size: nameSize,
        font: nameFont,
        color: nameColor,
      });

      const usnSize = 19;
      firstPage.drawText(userInfo.userUSN, {
        x: 170,
        y: 160,
        size: usnSize,
        font: font,
        color: whiteColor,
      });

      const formattedDate = formatDate(event.eventDate);
      const dateSize = 16;
      firstPage.drawText(formattedDate, {
        x: 510,
        y: 160,
        size: dateSize,
        font: boldFont,
        color: whiteColor,
      });

      const eventDesc = event.eventdesc || event.ename;
      const descSize = 10;
      const maxWidth = 450;
      
      const words = eventDesc.split(' ');
      let line = '';
      let yPosition = 225;
      
      words.forEach((word, index) => {
        const testLine = line + word + ' ';
        const testWidth = descFont.widthOfTextAtSize(testLine, descSize);
        
        if (testWidth > maxWidth && line !== '') {
          firstPage.drawText(line.trim(), {
            x: 190,
            y: yPosition,
            size: descSize,
            font: descFont,
            color: whiteColor,
          });
          line = word + ' ';
          yPosition -= 15;
        } else {
          line = testLine;
        }
      });
      
      if (line !== '') {
        firstPage.drawText(line.trim(), {
          x: 190,
          y: yPosition,
          size: descSize,
          font: descFont,
          color: whiteColor,
        });
      }

      // ✅ CHANGED: Store blob URL instead of immediate download
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const filename = `Volunteer_Certificate_${event.ename.replace(/\s+/g, '_')}_${userInfo.userUSN}_${formattedDate.replace(/ /g, '_')}.pdf`;

      setDownloadLinks(prev => ({
        ...prev,
        [event.eid]: { url, filename }
      }));

    } catch (error) {
      console.error('Error generating certificate:', error);
      alert(`Error generating certificate: ${error.message}`);
    } finally {
      setGeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(event.eid);
        return next;
      });
    }
  };

  const getVolunteerStatus = (status) => {
    switch (status) {
      case 0:
      case false:
        return 'Registered';
      case 1:
      case true:
        return 'Confirmed';
      default:
        return 'Unknown';
    }
  };

  const getButtonText = (eventType) => {
    switch (eventType) {
      case 'completed':
        return 'View Certificate';
      case 'ongoing':
      case 'upcoming':
      default:
        return 'View Details';
    }
  };

  const handleEventButtonClick = (event, eventType) => {
    if (eventType === 'completed') {
      generateCertificate(event);
    } else {
      navigate(`/volunteer-ticket?eventId=${event.eid}`);
    }
  };

  const handleVolunteerClick = () => {
    navigate('/volunteer-event');
  };

  const handleBack = () => {
    navigate('/events');
  };

  const renderEventsList = (eventsList, eventType) => {
    if (loading) {
      return (
        <div className="event-item">
          <p><strong>Loading...</strong></p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="event-item">
          <p><strong>Error:</strong> Could not load events. {error}</p>
        </div>
      );
    }

    if (!eventsList || eventsList.length === 0) {
      return (
        <div className="event-item">
          <p><strong>No events available</strong></p>
        </div>
      );
    }

    return eventsList.map(event => (
      <div className="event-item" key={event.eid}>
        <div className="event-info">
          <p><strong>{event.ename || 'N/A'}</strong></p>
          <p>Date: {formatDate(event.eventDate)}</p>
          <p>Time: {formatTime(event.eventTime)}</p>
          <p>Location: {event.eventLoc || 'N/A'}</p>
          <p>Status: {getVolunteerStatus(event.VolnStatus)}</p>
        </div>
        <div className="event-actions">
          {/* ✅ UPDATED: Same three-state logic as participants.jsx */}
          {eventType === 'completed' ? (
            generatingIds.has(event.eid) ? (
              <button className="event-btn" disabled>
                Generating...
              </button>
            ) : downloadLinks[event.eid] ? (
              <a
                href={downloadLinks[event.eid].url}
                download={downloadLinks[event.eid].filename}
                className="event-btn"
              >
                Download Now
              </a>
            ) : (
              <button
                className="event-btn"
                onClick={() => handleEventButtonClick(event, eventType)}
              >
                {getButtonText(eventType)}
              </button>
            )
          ) : (
            <button
              className="event-btn"
              onClick={() => handleEventButtonClick(event, eventType)}
            >
              {getButtonText(eventType)}
            </button>
          )}
        </div>
      </div>
    ));
  };

  return (
    <div className="volunteers-page">
      <div className="logout-container">
        <button id="backBtn" className="logout-btn" onClick={handleBack}>
          <i className="fas fa-arrow-left"></i>
          Back
        </button>
      </div>

      <section className="hero-section">
        <div className="container">
          <div className="card-grid">
            <div className="card" id="completed-card">
              <div className="card__background"></div>
              <div className="card__content">
                <h3 className="card__heading">Completed Events</h3>
                <div className="card__details">
                  {renderEventsList(events.completed, 'completed')}
                </div>
              </div>
            </div>

            <div className="card" id="ongoing-card">
              <div className="card__background"></div>
              <div className="card__content">
                <h3 className="card__heading">Ongoing Events</h3>
                <div className="card__details">
                  {renderEventsList(events.ongoing, 'ongoing')}
                </div>
              </div>
            </div>

            <div className="card" id="upcoming-card">
              <div className="card__background"></div>
              <div className="card__content">
                <h3 className="card__heading">Upcoming Events</h3>
                <div className="card__details">
                  {renderEventsList(events.upcoming, 'upcoming')}
                </div>
              </div>
            </div>
          </div>

          <div className="button-container">
            <button id="volunteerOtherEvent" onClick={handleVolunteerClick}>
              Volunteer in Other Event
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Volunteers;
