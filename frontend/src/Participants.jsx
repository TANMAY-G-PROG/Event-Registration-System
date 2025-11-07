import React, { useEffect, useState } from 'react';
import './participants.css';
import { useNavigate } from 'react-router-dom';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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

  useEffect(() => {
    fetchUserInfo();
    fetchParticipantEvents();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/me`, {
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

    const categorized = {
      ongoing: [],
      completed: [],
      upcoming: []
    };

    events.forEach(event => {
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

  const fetchParticipantEvents = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/my-participant-events`, {
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
      const participantEvents = data.participantEvents || [];
      const categorizedEvents = categorizeEvents(participantEvents);
      setEvents(categorizedEvents);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching participant events:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const generateCertificate = async (event) => {
    try {
      if (!event.PartStatus) {
        alert('Certificate is only available for attended events.');
        return;
      }

      const baseUrl = import.meta.env.BASE_URL;

      const buildPublicPath = (fileName) => {
        const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const cleanFile = fileName.startsWith('/') ? fileName.slice(1) : fileName;
        return `${cleanBase}/${cleanFile}`;
      };

      const templateUrl = buildPublicPath('certificate-template.pdf');

      const existingPdfBytes = await fetch(templateUrl).then(res => {
        if (!res.ok) {
          throw new Error(`Failed to fetch template at ${templateUrl}. Status: ${res.status}`);
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
        const fontUrl = buildPublicPath('Allura-Regular.ttf');
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
        const descFontUrl = buildPublicPath('PlayfairDisplay-MediumItalic.ttf');
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
      const dateWidth = boldFont.widthOfTextAtSize(formattedDate, dateSize);
      firstPage.drawText(formattedDate, {
        x: 510,
        y: 160,
        size: dateSize,
        font: boldFont,
        color: whiteColor,
      });

      const eventDesc = event.eventdesc || event.ename;
      const descSize = 22;
      const maxDescWidth = 500;
      const descWidth = descFont.widthOfTextAtSize(eventDesc, descSize);
      
      let finalDescText = eventDesc;
      let finalDescSize = descSize;
      
      if (descWidth > maxDescWidth) {
        finalDescSize = (maxDescWidth / descWidth) * descSize;
      }
      
      const finalDescWidth = descFont.widthOfTextAtSize(finalDescText, finalDescSize);
      firstPage.drawText(finalDescText, {
        x: (width - finalDescWidth) / 2,
        y: 205,
        size: finalDescSize,
        font: descFont,
        color: whiteColor,
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${event.ename}_Certificate.pdf`;
      link.click();
      
      URL.revokeObjectURL(url);
      
      alert('Certificate generated successfully!');
    } catch (err) {
      console.error('Error generating certificate:', err);
      alert('Failed to generate certificate. Please try again.');
    }
  };

  if (loading) {
    return <div className="loading">Loading your events...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  const renderEventCard = (event, category) => (
    <div key={event.eid} className="event-card">
      <h3>{event.ename}</h3>
      <p><strong>Date:</strong> {formatDate(event.eventDate)}</p>
      <p><strong>Time:</strong> {formatTime(event.eventStartTime)}</p>
      <p><strong>Venue:</strong> {event.venue}</p>
      {event.eventdesc && <p><strong>Description:</strong> {event.eventdesc}</p>}
      
      {category === 'completed' && event.PartStatus && (
        <button 
          className="certificate-btn"
          onClick={() => generateCertificate(event)}
        >
          Download Certificate
        </button>
      )}
      
      {category === 'completed' && !event.PartStatus && (
        <p className="attendance-note">No certificate available (not attended)</p>
      )}
    </div>
  );

  return (
    <div className="participants-container">
      <h1>My Events</h1>
      
      {events.ongoing.length > 0 && (
        <div className="event-section">
          <h2>Ongoing Events</h2>
          <div className="events-grid">
            {events.ongoing.map(event => renderEventCard(event, 'ongoing'))}
          </div>
        </div>
      )}
      
      {events.upcoming.length > 0 && (
        <div className="event-section">
          <h2>Upcoming Events</h2>
          <div className="events-grid">
            {events.upcoming.map(event => renderEventCard(event, 'upcoming'))}
          </div>
        </div>
      )}
      
      {events.completed.length > 0 && (
        <div className="event-section">
          <h2>Completed Events</h2>
          <div className="events-grid">
            {events.completed.map(event => renderEventCard(event, 'completed'))}
          </div>
        </div>
      )}
      
      {events.ongoing.length === 0 && events.upcoming.length === 0 && events.completed.length === 0 && (
        <div className="no-events">
          <p>You haven't registered for any events yet.</p>
        </div>
      )}
    </div>
  );
};

export default Participants;
