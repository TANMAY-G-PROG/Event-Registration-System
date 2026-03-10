import { useState, useRef, useEffect } from 'react';
import './Scanner.css';

export default function Scanner() {
  const [pageState, setPageState] = useState('loading');
  const [errorMsg, setErrorMsg] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userUSN, setUserUSN] = useState(null);

  // References
  const scannerInstanceRef = useRef(null); // Stores the scanner instance
  const isMountedRef = useRef(true);       // Tracks if component is active

  useEffect(() => {
    isMountedRef.current = true;
    const urlParams = new URLSearchParams(window.location.search);
    const role = urlParams.get('role');
    setUserRole(role === 'volunteer' ? 'volunteer' : 'participant');

    fetchUserData();

    // Load library dynamically
    if (!window.Html5Qrcode) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';
      script.onload = () => console.log('✅ QR Lib Loaded');
      document.head.appendChild(script);
    }

    return () => {
      isMountedRef.current = false;
      stopScanner(); // Cleanup on unmount
    };
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/me');
      if (response.ok) {
        const data = await response.json();
        setUserUSN(data.userUSN);
        setPageState('scanning'); // Go straight to scanning if user exists
      } else {
        setErrorMsg('Please sign in first.');
        setPageState('error');
      }
    } catch {
      setErrorMsg('Failed to load user.');
      setPageState('error');
    }
  };

  // --- CORE SCANNER LOGIC (iOS FIXED) ---
  const startScanner = async () => {
    // 1. Safety Checks
    if (!window.Html5Qrcode) {
      setTimeout(startScanner, 100); // Retry if lib not ready
      return;
    }
    if (scannerInstanceRef.current) return; // Already running

    try {
      // 2. Initialize the Core Class (Not the Scanner Widget)
      const html5QrCode = new window.Html5Qrcode("reader");
      scannerInstanceRef.current = html5QrCode;

      // 3. iOS-Specific Config
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false, // Helps with some front/back camera bugs
      };

      // 4. Start Camera (Requesting "environment" explicitly)
      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        (errorMessage) => {
          // Ignore frame read errors (common while moving camera)
        }
      );

      if (isMountedRef.current) setIsScanning(true);

    } catch (err) {
      console.error("Camera Start Error:", err);
      // Fallback: If "environment" fails, try generic back camera
      try {
        if (scannerInstanceRef.current) {
          await scannerInstanceRef.current.start(
            { facingMode: { exact: "environment" } },
            config,
            onScanSuccess
          );
        }
      } catch (retryErr) {
        setErrorMsg("Camera error. Please ensure you are on HTTPS and allowed camera permissions.");
        setPageState('error');
      }
    }
  };

  const stopScanner = async () => {
    if (scannerInstanceRef.current) {
      try {
        await scannerInstanceRef.current.stop();
        scannerInstanceRef.current.clear();
      } catch (err) {
        console.warn("Failed to stop scanner", err);
      }
      scannerInstanceRef.current = null;
      if (isMountedRef.current) setIsScanning(false);
    }
  };

  // Trigger start when entering scanning state
  useEffect(() => {
    if (pageState === 'scanning') {
      // Small delay to ensure DOM #reader is ready
      const t = setTimeout(startScanner, 100);
      return () => clearTimeout(t);
    }
  }, [pageState]);

  // Replace these two functions inside Scanner.jsx

  const onScanSuccess = async (decodedText) => {
    if (!isMountedRef.current) return;
    await stopScanner();
    setPageState('processing');

    // New format: "eventId:EID:TOKEN:TIMESTAMP"
    if (decodedText.startsWith('eventId:')) {
      const parts = decodedText.split(':');
      // parts = ['eventId', EID, TOKEN, TIMESTAMP]
      if (parts.length === 4) {
        await markAttendance(parts[1], parts[2], parts[3]);
      } else {
        setErrorMsg('QR code is outdated. Please ask the organizer to refresh.');
        setPageState('error');
      }
    } else {
      setErrorMsg('Invalid QR. Please scan an Event QR.');
      setPageState('error');
    }
  };

  const markAttendance = async (eventId, token, timestamp) => {
    try {
      const endpoint = userRole === 'volunteer'
        ? '/api/mark-volunteer-attendance'
        : '/api/mark-participant-attendance';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, usn: userUSN, token, timestamp }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setPageState('success');
      } else {
        setErrorMsg(data.error || 'Attendance failed');
        setPageState('error');
      }
    } catch {
      setErrorMsg('Network error.');
      setPageState('error');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !window.Html5Qrcode) return;

    try {
      const html5QrCode = new window.Html5Qrcode("reader"); // Re-use the ID
      const result = await html5QrCode.scanFile(file, true);
      onScanSuccess(result);
    } catch (err) {
      setErrorMsg("Could not read QR from image.");
      setPageState('error');
    }
  };

  const reset = () => {
    setErrorMsg(null);
    setPageState('scanning');
  };

  const goBack = () => window.history.back();

  return (
    <div className="scanner-container">
      <div className="scanner-card">

        {/* Header */}
        <div className="scanner-header">
          <div className="scanner-icon">📱</div>
          <h1 className="scanner-title">Mark Attendance</h1>
          <p className="scanner-subtitle">
            {userRole === 'volunteer' ? 'Volunteer' : 'Participant'} Mode
          </p>
          {userUSN && <p className="scanner-usn">{userUSN}</p>}
        </div>

        {/* Loading State */}
        {pageState === 'loading' && (
          <div className="status-box loading-box fade-in">
            <div className="status-icon">⏳</div>
            <p>Loading...</p>
          </div>
        )}

        {/* Error State */}
        {pageState === 'error' && (
          <div className="status-box error-box fade-in">
            <div className="status-icon">⚠️</div>
            <p className="error-message">{errorMsg}</p>
            <div className="button-group">
              <button onClick={reset} className="btn btn-danger">Try Again</button>
              <button onClick={goBack} className="btn btn-secondary">Go Back</button>
            </div>
          </div>
        )}

        {/* Scanning State */}
        {pageState === 'scanning' && (
          <div className="scanner-main fade-in">
            <div className="scanner-video-container">
              {/* Core API requires an empty div with an ID */}
              <div id="reader" style={{ width: "100%", height: "100%" }}></div>

              {!isScanning && (
                <div className="scanner-loading-overlay">
                  <div className="org-spinner-dots"></div>
                  <span style={{ marginTop: '10px', fontSize: '12px' }}>Starting Camera...</span>
                </div>
              )}
            </div>

            <div className="file-upload-box">
              <p>Or upload QR image</p>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                id="qr-file-input"
              />
              <label htmlFor="qr-file-input" className="btn btn-primary">
                📁 Choose Image
              </label>
            </div>
          </div>
        )}

        {/* Processing State */}
        {pageState === 'processing' && (
          <div className="status-box loading-box fade-in">
            <div className="org-spinner-dots"></div>
            <p>Marking Attendance...</p>
          </div>
        )}

        {/* Success State */}
        {pageState === 'success' && (
          <div className="status-box success-box fade-in">
            <div className="status-icon">✅</div>
            <h2 className="success-title">Done!</h2>
            <p>Attendance Marked Successfully</p>
            <div className="button-group">
              <button onClick={goBack} className="btn btn-success-light">Back</button>
              <button onClick={reset} className="btn btn-success-dark">Scan Next</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
