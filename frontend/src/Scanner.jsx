import { useState, useRef, useEffect } from 'react';
import './Scanner.css';

export default function Scanner() {
  const [pageState, setPageState] = useState('loading');
  const [errorMsg, setErrorMsg] = useState(null);
  const [lastResult, setLastResult] = useState('');
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userUSN, setUserUSN] = useState(null);

  const scannerRef = useRef(null);
  const html5QrcodeScannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const fileScannerRef = useRef(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const role = urlParams.get('role');
    const detectedRole = role === 'volunteer' ? 'volunteer' : 'participant';
    setUserRole(detectedRole);
    console.log('User role detected:', detectedRole);

    fetchUserData();
    loadQRLibrary();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/me', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setUserUSN(data.userUSN);
      } else {
        setErrorMsg('User not authenticated. Please sign in first.');
        setPageState('error');
      }
    } catch (err) {
      console.error('Error fetching user info:', err);
      setErrorMsg('Failed to load user information. Please try again.');
      setPageState('error');
    }
  };

  useEffect(() => {
    if (pageState === 'loading' && userUSN && libraryLoaded) {
      setPageState('scanning');
    }
  }, [pageState, userUSN, libraryLoaded]);

  useEffect(() => {
    if (pageState === 'scanning') {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => initScanner(), 200);
      return () => clearTimeout(timer);
    }
    if (pageState !== 'scanning') {
      cleanupScanner();
    }
    return () => cleanupScanner();
  }, [pageState]);

  const cleanupScanner = () => {
    if (html5QrcodeScannerRef.current) {
      try {
        html5QrcodeScannerRef.current.clear();
        html5QrcodeScannerRef.current = null;
      } catch (err) {
        console.error('Cleanup error:', err);
      }
    }
  };

  const loadQRLibrary = () => {
    if (window.Html5QrcodeScanner) {
      setLibraryLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';
    script.onload = () => setLibraryLoaded(true);
    script.onerror = () => {
      setErrorMsg('Failed to load QR scanner library. Please refresh.');
      setPageState('error');
    };
    document.head.appendChild(script);
  };

  // --- CHANGED SECTION START ---
  const initScanner = () => {
    if (!window.Html5QrcodeScanner || !scannerRef.current || html5QrcodeScannerRef.current) {
      return;
    }

    try {
      const scanner = new window.Html5QrcodeScanner(
        'reader',
        {
          fps: 10,
          // REMOVED aspectRatio: 1.0 - This breaks mobile cameras!
          qrbox: { width: 250, height: 250 },
          showTorchButtonIfSupported: true,
          videoConstraints: {
            facingMode: { ideal: 'environment' } // Prefer back camera
          },
        },
        false
      );

      scanner.render(onScanSuccess, onScanError);
      html5QrcodeScannerRef.current = scanner;
      setIsScanning(true);
    } catch (err) {
      console.error('Scanner init error:', err);
      setErrorMsg('Camera error. Please ensure permissions are granted.');
      setPageState('error');
    }
  };
  // --- CHANGED SECTION END ---

  const onScanSuccess = async (decodedText) => {
    if (pageState !== 'scanning') return;
    setIsScanning(false);
    setPageState('processing');
    setLastResult(decodedText);
    cleanupScanner();

    if (decodedText.startsWith('eventId:')) {
      const eventId = decodedText.split(':')[1];
      await markAttendance(eventId);
    } else {
      setErrorMsg('Invalid QR code format. Please scan the event QR code.');
      setPageState('error');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!window.Html5Qrcode) {
      setErrorMsg('QR scanner library not loaded. Refresh page.');
      setPageState('error');
      return;
    }

    try {
      if (!fileScannerRef.current) {
        fileScannerRef.current = new window.Html5Qrcode('file-reader');
      }
      const decodedText = await fileScannerRef.current.scanFile(file, true);
      await onScanSuccess(decodedText);
    } catch (err) {
      setErrorMsg('Could not read QR code from image.');
      setPageState('error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const markAttendance = async (eventId) => {
    if (!userUSN || !userRole) {
      setErrorMsg('Session expired. Please sign in again.');
      setPageState('error');
      return;
    }

    try {
      const endpoint = userRole === 'volunteer'
          ? '/api/mark-volunteer-attendance'
          : '/api/mark-participant-attendance';

      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: eventId, usn: userUSN }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setPageState('success');
        setErrorMsg(null);
      } else {
        setErrorMsg(data.error || 'Failed to mark attendance');
        setPageState('error');
      }
    } catch (err) {
      setErrorMsg('Network error. Please try again.');
      setPageState('error');
    }
  };

  const onScanError = (errorMessage) => {
    // console.log(errorMessage); // Reduced log spam
  };

  const scanAgain = () => {
    setLastResult('');
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setPageState('scanning');
  };

  const restartScanner = () => {
    setErrorMsg(null);
    setUserUSN(null);
    setPageState('loading');
    fetchUserData();
  };

  const goBack = () => {
    window.history.back();
  };

  return (
    <div className="scanner-scoped-page">
      <div id="file-reader" style={{ display: 'none' }} />

      <main className="scanner-card">
        <header className="scanner-header">
          <div className="scanner-role-badge">
            <span className="scanner-dot"></span>
            {userRole === 'volunteer' ? 'Volunteer' : 'Participant'} Mode
          </div>
          <h1 className="scanner-title">Scan Attendance</h1>
          <p className="scanner-subtitle">
            {userUSN ? `Logged in as ${userUSN}` : 'Authenticating...'}
          </p>
        </header>

        <div className="scanner-body">
          {pageState === 'loading' && (
            <div className="scanner-status-container">
              <div className="scanner-spinner"></div>
            </div>
          )}

          {pageState === 'error' && (
            <div className="scanner-status-container scanner-fade-in">
              <div className="scanner-error-icon">!</div>
              <p className="scanner-message">{errorMsg}</p>
              <div className="scanner-btn-row">
                <button onClick={restartScanner} className="scanner-btn-primary">Retry</button>
                <button onClick={goBack} className="scanner-btn-text">Cancel</button>
              </div>
            </div>
          )}

          {pageState === 'scanning' && (
            <div className="scanner-active-wrapper scanner-fade-in">
              <div className="scanner-frame">
                {/* ID must match initScanner */}
                <div id="reader" ref={scannerRef}></div>
                
                {/* Decorative Markers */}
                <div className="scanner-marker tl"></div>
                <div className="scanner-marker tr"></div>
                <div className="scanner-marker bl"></div>
                <div className="scanner-marker br"></div>
              </div>

              <div className="scanner-controls">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  id="qr-file-input"
                />
                <label htmlFor="qr-file-input" className="scanner-btn-secondary">
                  Upload Image
                </label>
              </div>
            </div>
          )}

          {pageState === 'processing' && (
            <div className="scanner-status-container scanner-fade-in">
              <div className="scanner-spinner"></div>
              <p className="scanner-message">Verifying...</p>
            </div>
          )}

          {pageState === 'success' && (
            <div className="scanner-status-container scanner-fade-in">
              <div className="scanner-success-check">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <h2 className="scanner-success-title">Confirmed</h2>
              <p className="scanner-message">Attendance marked successfully.</p>
              <div className="scanner-btn-row">
                <button onClick={scanAgain} className="scanner-btn-primary">Scan Next</button>
                <button onClick={goBack} className="scanner-btn-text">Done</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
