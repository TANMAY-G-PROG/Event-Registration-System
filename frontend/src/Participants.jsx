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
      const descSize = 14;
      const descWidth = descFont.widthOfTextAtSize(eventDesc, descSize);
      firstPage.drawText(eventDesc, {
        x: (width - descWidth) / 2,
        y: 120,
        size: descSize,
        font: descFont,
        color: whiteColor,
      });

      const pdfBytes = await pdfDoc.save();

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${userInfo.userName}-certificate.pdf`;
      link.click();
    } catch (err) {
      console.error('Error generating certificate:', err);
      alert(`Error generating certificate: ${err.message}`);
    }
  };

  // Component JSX (table, button, etc.) goes here

  return (
    <div className="participants-page">
      {/* Render tables, events, and certificate buttons */}
      {/* Wire the certificate button to generateCertificate(event) */}
    </div>
  );
};

export default Participants;
