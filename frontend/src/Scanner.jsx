import { useState, useRef, useEffect } from 'react';
import './scanner.css'; // This connects the design we created

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
    console.log('✅ User role detected:', detectedRole);
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
        console.log('✅ User USN loaded:', data.userUSN);
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
      console.log('🚀 Prerequisites met. Switching to scanning state.');
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
        console.log('🧹 Scanner cleaned up');
      } catch (err) {
        console.error('Cleanup error:', err);
      }
    }
  };

  const loadQRLibrary = () => {
    if (window.Html5QrcodeScanner) {
      console.log('✅ QR library already loaded');
      setLibraryLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';
    script.onload = () => {
      console.log('✅ QR library loaded');
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
      console.log('⚠️ Scanner not ready or already initialized');
      return;
    }
    console.log('🎥 Initializing scanner');
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
      console.log('✅ Scanner rendered');
    } catch (err) {
      console.error('Scanner initialization error:', err);
      setErrorMsg('Failed to initialize scanner. Check camera permissions and try again.');
      setPageState('error');
    }
  };

  const onScanSuccess = async (decodedText) => {
    // Prevent multiple scans while processing
    if (pageState !== 'scanning') return;
    
    console.log(`✅ QR Code detected: ${decodedText}`);
    setIsScanning(false);
    setPageState('processing'); // Temporary state to prevent duplicate scans
    setLastResult(decodedText);
    
    // Stop scanner immediately
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
    console.log('📁 File selected:', file.name);
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
      console.log('✅ QR decoded from file:', decodedText);
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
    console.log(`🎯 Marking attendance - Role: ${userRole}, USN: ${userUSN}, Event: ${eventId}`);
    try {
      const endpoint = userRole === 'volunteer' ? '/api/mark-volunteer-attendance' : '/api/mark-participant-attendance';
      console.log(`📡 Calling endpoint: ${endpoint}`);
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
      console.log('📥 Response:', data);
      if (response.ok && data.success) {
        setPageState('success');
        setErrorMsg(null);
        console.log(`✅ ${userRole} attendance marked successfully`);
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
    console.log('🔄 Restarting scanner');
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

  return (
    <div className="scanner-container">
      <div id="file-reader" style={{ display: 'none' }} />
      <div className="scanner-card">
        <div className="scanner-header">
          <div className="scanner-icon">📱</div>
          <h1 className="scanner-title">Mark Attendance</h1>
          <p className="scanner-subtitle">
            {userRole === 'volunteer' ? '🤝 Volunteer' : '🎫 Participant'} - Scan event QR code
          </p>
          {userUSN && (
            <p className="scanner-usn">
              USN: {userUSN}
            </p>
          )}
        </div>
        {pageState === 'loading' && (
          <div className="status-box loading-box fade-in">
            <div className="status-icon">⏳</div>
            <p>Loading user data...</p>
          </div>
        )}
        {pageState === 'error' && (
          <div className="status-box error-box fade-in">
            <div className="status-icon">⚠️</div>
            <p className="error-message">{errorMsg}</p>
            <div className="button-group">
              <button onClick={restartScanner} className="btn btn-danger">
                Try Again
              </button>
              <button onClick={goBack} className="btn btn-secondary">
                Go Back
              </button>
            </div>
          </div>
        )}
        {pageState === 'scanning' && (
          <div className="scanner-main fade-in">
            <div className="scanner-video-container">
              <div id="reader" ref={scannerRef}></div>
              {isScanning && (
                <div className="scanner-status-badge">
                  🔍 Scanning...
                </div>
              )}
            </div>
            <div className="file-upload-box">
              <p>Or upload QR code image</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                id="qr-file-input"
              />
              <label htmlFor="qr-file-input" className="btn btn-primary">
                📁 Choose Image File
              </label>
            </div>
            <div className="instructions-box">
              <div className="instructions-title">📋 Instructions:</div>
              <ul>
                <li>Scan the <strong>organizer's QR code</strong> using camera</li>
                <li>Or upload a screenshot/photo of the QR code</li>
                <li>Your attendance will be automatically marked</li>
                <li>Make sure you are registered for the event</li>
              </ul>
            </div>
          </div>
        )}
        {pageState === 'success' && (
          <div className="status-box success-box fade-in">
            <div className="status-icon">✅</div>
            <h2 className="success-title">
              {userRole === 'volunteer' ? 'Volunteer' : 'Participant'} Attendance Marked!
            </h2>
            <p className="success-message">
              Your attendance has been successfully recorded as a {userRole}.
            </p>
            <div className="button-group">
              <button onClick={goBack} className="btn btn-success-light">
                ← Back to Event
              </button>
              <button onClick={scanAgain} className="btn btn-success-dark">
                🔄 Scan Another Event
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
