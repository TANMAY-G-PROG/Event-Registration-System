import { useState, useEffect, useRef } from 'react';
import './QrCode.css';

export default function QrCode() {
  const [error, setError] = useState(false);
  const [eventId, setEventId] = useState(null);
  const qrCodeRef = useRef(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const eid = urlParams.get('eventId');

    if (!eid) {
      setError(true);
      return;
    }

    setEventId(eid);

    // Load QRCode library dynamically
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    script.async = true;
    script.onload = () => {
      generateQRCode(eid);
    };
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const generateQRCode = (eventId) => {
    if (qrCodeRef.current && window.QRCode) {
      qrCodeRef.current.innerHTML = '';
      
      // QR code contains ONLY the event ID
      // Format: eventId:EID (e.g., "eventId:123")
      const qrText = `eventId:${eventId}`;
      
      new window.QRCode(qrCodeRef.current, {
        text: qrText,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.H
      });
    }
  };

  const handleBack = () => {
    window.history.back();
  };

  return (
    <div className="qr-code-page">
      <div className="qr-container">
        <div className="qr-header">
          <h1>Event Check-in QR Code</h1>
          <p className="subtitle">Display this code for participants and volunteers to scan</p>
          {eventId && <p className="event-id-display">Event ID: {eventId}</p>}
        </div>
        
        {error ? (
          <div className="error-message">
            <h3>Error</h3>
            <p>Unable to generate QR code. Please try again.</p>
          </div>
        ) : (
          <div className="card">
            <div className="card-header">
              <h2>Attendance QR Code</h2>
              <p className="card-subtitle">For organizer display only</p>
            </div>
            <div ref={qrCodeRef} className="qr-code"></div>
            <div className="qr-instructions">
              <p>📱 Participants and volunteers should scan this code</p>
              <p>✅ Scanning will automatically mark their attendance</p>
            </div>
          </div>
        )}
        
        <button onClick={handleBack} className="back-btn">
          Back to Event
        </button>
      </div>
    </div>
  );
}