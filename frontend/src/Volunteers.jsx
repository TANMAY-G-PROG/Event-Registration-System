import React, { useEffect, useState } from 'react';
import './volunteers.css';
import { useNavigate } from 'react-router-dom';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// ⛔️ REMOVED: const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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

  useEffect(() => {
    fetchUserInfo();
    fetchVolunteerEvents();
  }, []);

  const fetchUserInfo = async () => {
    try {
      // ✅ CHANGED
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

    // First, remove duplicates based on eid
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
      // ✅ CHANGED
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

  const generateCertificate = async (event) => {
    try {
      // Check if volunteer actually volunteered for the event (status must be true)
      if (!event.VolnStatus) {
        alert('Certificate is only available for confirmed volunteer participation.');
        return;
      }

      // --- CACHE-BUSTING CHANGE ---
      // Add a unique timestamp to force the browser to re-download the files
      const t = new Date().getTime();
      // --- END OF CHANGE ---

      // Fetch the PDF template
      // --- CACHE-BUSTING CHANGE ---
      const templateUrl = `/certificate-template.pdf?v=${t}`;
      // --- END OF CHANGE ---
      const existingPdfBytes = await fetch(templateUrl).then(res => {
        if (!res.ok) {
          throw new Error('Certificate template not found. Please ensure certificate-template.pdf is in the public folder.');
        }
        return res.arrayBuffer();
      });

      // Load the PDF template
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      
      // Register fontkit to enable custom fonts
      pdfDoc.registerFontkit(fontkit);
      
      // Get the first page
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();

      // Try to embed Allura-Regular font for volunteer name
      let nameFont;
      try {
        // --- CACHE-BUSTING CHANGE ---
        const fontUrl = `/Allura-Regular.ttf?v=${t}`; // CHANGED
        // --- END OF CHANGE ---
        const fontBytes = await fetch(fontUrl).then(res => {
          if (!res.ok) {
            throw new Error('Allura-Regular.ttf font file not found.'); // CHANGED
          }
          return res.arrayBuffer();
        });
        nameFont = await pdfDoc.embedFont(fontBytes);
      } catch (fontError) {
        console.warn('Could not load custom font, using TimesRomanBold as fallback:', fontError);
        nameFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
      }
      
      // Regular font for other text
      const font = await pdfDoc.embedFont(StandardFonts.Courier);
      const boldFont = await pdfDoc.embedFont(StandardFonts.CourierBold);

      // Load Playfair Display font for description
      let descFont;
      try {
        // --- CACHE-BUSTING CHANGE ---
        const descFontUrl = `/PlayfairDisplay-MediumItalic.ttf?v=${t}`;
        // --- END OF CHANGE ---
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

      // Colors for text
      const nameColor = rgb(0xF7 / 255, 0xD9 / 255, 0x91 / 255); // #F7D991
      const whiteColor = rgb(1, 1, 1);

      // Add volunteer name (centered) with Allura-Regular font
      const nameText = userInfo.userName;
      const nameSize = 38;
      const nameWidth = nameFont.widthOfTextAtSize(nameText, nameSize);
      firstPage.drawText(nameText, {
        x: (width - nameWidth) / 2, // Center horizontally
        y: 250, // Adjust based on your template (from bottom)
        size: nameSize,
        font: nameFont,
        color: nameColor,
      });

      // Add USN
      const usnSize = 19;
      firstPage.drawText(userInfo.userUSN, {
        x: 170, // Adjust X position based on your template
        y: 160, // Adjust Y position based on your template
        size: usnSize,
        font: font,
        color: whiteColor,
      });

      // Add Event Date
      const formattedDate = formatDate(event.eventDate);
      const dateSize = 16;
      const dateWidth = boldFont.widthOfTextAtSize(formattedDate, dateSize);
      firstPage.drawText(formattedDate, {
        x: 510, // Center the date horizontally
        y: 160, // Position below USN (adjust as needed)
        size: dateSize,
        font: boldFont,
        color: whiteColor,
      });

      // Add Event Description (with word wrapping)
      const eventDesc = event.eventdesc || event.ename;
      const descSize = 10;
      const maxWidth = 450; // Maximum width for text
      
      // Simple word wrapping
      const words = eventDesc.split(' ');
      let line = '';
      let yPosition = 225; // Starting Y position
      
      words.forEach((word, index) => {
        const testLine = line + word + ' ';
        const testWidth = descFont.widthOfTextAtSize(testLine, descSize);
        
        if (testWidth > maxWidth && line !== '') {
          firstPage.drawText(line.trim(), {
            x: 190, // Adjust X position
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
      
      // Draw remaining text
      if (line !== '') {
        firstPage.drawText(line.trim(), {
          x: 190, // Adjust X position
          y: yPosition,
          size: descSize,
          font: descFont,
          color: whiteColor,
        });
      }

      // Serialize the PDF to bytes
      const pdfBytes = await pdfDoc.save();

      // Create a blob and download
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Volunteer_Certificate_${event.ename.replace(/\s+/g, '_')}_${userInfo.userUSN}_${formattedDate.replace(/ /g, '_')}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error generating certificate:', error);
      alert(`Error generating certificate: ${error.message}`);
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
      // Generate and download certificate for completed events
      generateCertificate(event);
    } else {
      // Navigate to ticket page for other events
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
          <p>Status: {getVolunteerStatus(event.VolStatus)}</p>
        </div>
        <div className="event-actions">
          <button
            className="event-btn"
            onClick={() => handleEventButtonClick(event, eventType)}
          >
            {getButtonText(eventType)}
          </button>
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
