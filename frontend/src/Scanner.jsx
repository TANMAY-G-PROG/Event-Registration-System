import { useState, useRef, useEffect } from 'react';
import './Scanner.css';

export default function Scanner() {
  // --- LOGIC STARTS HERE (UNTOUCHED) ---
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
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserUSN(data.userUSN);
        console.log('User USN loaded:', data.userUSN);
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
      console.log('Prerequisites met. Switching to scanning state.');
      setPageState('scanning');
    }
  }, [pageState, userUSN, libraryLoaded]);

  useEffect(() => {
    if (pageState === 'scanning') {
      const timer = setTimeout(() => initScanner(), 100);
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
        console.log('Scanner cleaned up');
      } catch (err) {
        console.error('Cleanup error:', err);
      }
    }
  };

  const loadQRLibrary = () => {
    if (window.Html5QrcodeScanner) {
      console.log('QR library already loaded');
      setLibraryLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src =
      'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';
    script.onload = () => {
      console.log('QR library loaded');
      setLibraryLoaded(true);
    };
    script.onerror = () => {
      setErrorMsg('Failed to load QR scanner library. Please refresh the page.');
      setPageState('error');
    };
    document.head.appendChild(script);
  };

  const initScanner = () => {
    if (!window.Html5QrcodeScanner || !scannerRef.current || html5QrcodeScannerRef.current) {
      console.log('Scanner not ready or already initialized');
      return;
    }

    console.log('Initializing scanner');
    try {
      const scanner = new window.Html5QrcodeScanner(
        'reader',
        {
          qrbox: { width: 250, height: 250 },
          fps: 10,
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
          rememberLastUsedCamera: true,
          videoConstraints: {
            facingMode: { ideal: 'environment' },
          },
          supportedScanTypes: [0, 1],
          formatsToSupport: [0, 1],
        },
        false
      );

      scanner.render(onScanSuccess, onScanError);
      html5QrcodeScannerRef.current = scanner;
      setIsScanning(true);
      console.log('Scanner rendered');
    } catch (err) {
      console.error('Scanner initialization error:', err);
      setErrorMsg('Failed to initialize scanner. Check camera permissions and try again.');
      setPageState('error');
    }
  };

  const onScanSuccess = async (decodedText) => {
    if (pageState !== 'scanning') return;

    console.log(`QR Code detected: ${decodedText}`);
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

    console.log('File selected:', file.name);

    if (!window.Html5Qrcode) {
      setErrorMsg('QR scanner library not loaded. Please refresh and try again.');
      setPageState('error');
      return;
    }

    try {
      if (!fileScannerRef.current) {
        fileScannerRef.current = new window.Html5Qrcode('file-reader');
      }

      const decodedText = await fileScannerRef.current.scanFile(file, true);
      console.log('QR decoded from file:', decodedText);
      await onScanSuccess(decodedText);
    } catch (err) {
      console.error('File scan error:', err);
      setErrorMsg('Could not read QR code from image. Please try another image.');
      setPageState('error');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const markAttendance = async (eventId) => {
    if (!userUSN || !userRole) {
      setErrorMsg('User session error. Please sign in again.');
      setPageState('error');
      return;
    }

    console.log(`Marking attendance - Role: ${userRole}, USN: ${userUSN}, Event: ${eventId}`);

    try {
      const endpoint =
        userRole === 'volunteer'
          ? '/api/mark-volunteer-attendance'
          : '/api/mark-participant-attendance';

      console.log(`Calling endpoint: ${endpoint}`);

      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: eventId,
          usn: userUSN,
        }),
      });

      const data = await response.json();
      console.log('Response:', data);

      if (response.ok && data.success) {
        setPageState('success');
        setErrorMsg(null);
        console.log(`${userRole} attendance marked successfully`);
      } else {
        setErrorMsg(data.error || 'Failed to mark attendance');
        setPageState('error');
      }
    } catch (err) {
      console.error('Error marking attendance:', err);
      setErrorMsg('Network error. Please try again.');
      setPageState('error');
    }
  };

  const onScanError = (errorMessage) => {
    if (errorMessage.includes('NotFoundException') || errorMessage.includes('No MultiFormat Readers')) {
      return;
    }
    console.log(`Scan error: ${errorMessage}`);
  };

  const scanAgain = () => {
    console.log('Restarting scanner');
    setLastResult('');
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
  // --- LOGIC ENDS HERE ---

  // --- NEW MINIMALIST UI ---
  return (
    <div className="minimal-layout">
      {/* Hidden file reader element */}
      <div id="file-reader" style={{ display: 'none' }} />

      <main className="card-interface">
        <header className="interface-header">
          <div className="role-badge">
            <span className="dot"></span>
            {userRole === 'volunteer' ? 'Volunteer' : 'Participant'} Mode
          </div>
          <h1 className="title">Scan Attendance</h1>
          <p className="subtitle">
            {userUSN ? `Logged in as ${userUSN}` : 'Authenticating...'}
          </p>
        </header>

        <div className="interface-body">
          {pageState === 'loading' && (
            <div className="status-container">
              <div className="spinner-minimal"></div>
            </div>
          )}

          {pageState === 'error' && (
            <div className="status-container fade-in">
              <div className="error-icon">!</div>
              <p className="message-text">{errorMsg}</p>
              <div className="button-row">
                <button onClick={restartScanner} className="btn-primary">Retry</button>
                <button onClick={goBack} className="btn-text">Cancel</button>
              </div>
            </div>
          )}

          {pageState === 'scanning' && (
            <div className="scanner-active-wrapper fade-in">
              <div className="scanner-frame">
                <div id="reader" ref={scannerRef}></div>
                {/* Minimal corner markers */}
                <div className="frame-marker tl"></div>
                <div className="frame-marker tr"></div>
                <div className="frame-marker bl"></div>
                <div className="frame-marker br"></div>
              </div>

              <div className="controls">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  id="qr-file-input"
                />
                <label htmlFor="qr-file-input" className="btn-secondary">
                  Upload Image
                </label>
              </div>
            </div>
          )}

          {pageState === 'processing' && (
            <div className="status-container fade-in">
              <div className="spinner-minimal"></div>
              <p className="message-text">Verifying...</p>
            </div>
          )}

          {pageState === 'success' && (
            <div className="status-container fade-in">
              <div className="success-check">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <h2 className="success-title">Confirmed</h2>
              <p className="message-text">Attendance marked successfully.</p>
              <div className="button-row">
                <button onClick={scanAgain} className="btn-primary">Scan Next</button>
                <button onClick={goBack} className="btn-text">Done</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
