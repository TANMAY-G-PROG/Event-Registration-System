import { useState, useRef, useEffect } from 'react';

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
      <style>{`
        :root {
          --background-gradient: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
          --card-background: rgba(255, 255, 255, 0.95);
          --card-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          --primary-gradient: linear-gradient(45deg, #667eea, #764ba2);
          --primary-color: #667eea;
          --primary-color-dark: #5a6acf;
          --success-gradient: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          --success-color-dark: #00b8d4;
          --danger-color: #d32f2f;
          --danger-background: rgba(255, 107, 107, 0.1);
          --danger-border: rgba(255, 107, 107, 0.3);
          --secondary-color: #6c757d;
          --secondary-background: rgba(108, 117, 125, 0.1);
          --text-primary: #2c3e50;
          --text-secondary: #7f8c8d;
          --text-light: #5a6c7d;
          --text-instructions: #495057;
          --border-radius-lg: 24px;
          --border-radius-md: 16px;
          --border-radius-sm: 12px;
        }
        .scanner-container {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          background: var(--background-gradient);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          box-sizing: border-box;
        }
        .scanner-card {
          background: var(--card-background);
          backdrop-filter: blur(10px);
          border-radius: var(--border-radius-lg);
          padding: 32px;
          box-shadow: var(--card-shadow);
          max-width: 500px;
          width: 100%;
          text-align: center;
          box-sizing: border-box;
        }
        .scanner-header {
          margin-bottom: 32px;
        }
        .scanner-icon {
          font-size: 48px;
          margin-bottom: 16px;
          background: var(--primary-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .scanner-title {
          color: var(--text-primary);
          font-size: 28px;
          font-weight: 700;
          margin: 0 0 8px 0;
        }
        .scanner-subtitle {
          color: var(--text-secondary);
          font-size: 16px;
          margin: 0;
        }
        .scanner-usn {
          color: var(--text-light);
          font-size: 14px;
          margin-top: 8px;
          font-weight: 600;
        }
        .fade-in {
          animation: fadeIn 0.5s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .status-box {
          border-radius: var(--border-radius-sm);
          padding: 24px;
          margin: 24px 0;
        }
        .status-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        .loading-box {
          background: rgba(102, 126, 234, 0.1);
          border: 2px solid rgba(102, 126, 234, 0.3);
          color: var(--primary-color);
          font-weight: 600;
        }
        .error-box {
          background: var(--danger-background);
          border: 2px solid var(--danger-border);
          color: var(--danger-color);
        }
        .error-message {
          margin: 0 0 16px 0;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.5;
        }
        .success-box {
          background: var(--success-gradient);
          color: white;
          padding: 32px 24px;
          border-radius: var(--border-radius-md);
        }
        .success-title {
          font-size: 22px;
          font-weight: 700;
          margin: 0 0 8px 0;
        }
        .success-message {
          font-size: 14px;
          margin: 0 0 24px 0;
          opacity: 0.9;
        }
        .button-group {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
          margin-top: 16px;
        }
        .btn {
          border: none;
          border-radius: 12px;
          padding: 10px 20px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          font-size: 14px;
          text-decoration: none;
          display: inline-block;
        }
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
        }
        .btn-primary {
          background: var(--primary-gradient);
          color: white;
        }
        .btn-danger {
          background: var(--danger-color);
          color: white;
        }
        .btn-danger:hover {
          box-shadow: 0 8px 20px rgba(211, 47, 47, 0.3);
        }
        .btn-secondary {
          background: var(--secondary-color);
          color: white;
        }
        .btn-secondary:hover {
          box-shadow: 0 8px 20px rgba(108, 117, 125, 0.3);
        }
        .btn-success-light {
          background: rgba(255, 255, 255, 0.9);
          color: var(--primary-color);
          border: 2px solid rgba(255, 255, 255, 0.3);
        }
        .btn-success-light:hover {
          background: white;
          box-shadow: 0 8px 20px rgba(255, 255, 255, 0.2);
        }
        .btn-success-dark {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 2px solid rgba(255, 255, 255, 0.3);
        }
        .btn-success-dark:hover {
          background: rgba(255, 255, 255, 0.3);
          box-shadow: 0 8px 20px rgba(255, 255, 255, 0.2);
        }
        .scanner-main {
          margin-top: 24px;
        }
        .scanner-video-container {
          position: relative;
          border-radius: var(--border-radius-md);
          overflow: hidden;
          background: #000;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }
        #reader {
          width: 100%;
          min-height: 300px;
          border-radius: var(--border-radius-md);
        }
        .scanner-status-badge {
          position: absolute;
          top: 16px;
          right: 16px;
          background: rgba(76, 175, 80, 0.9);
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          animation: pulse 2s infinite;
          z-index: 1000;
        }
        .file-upload-box {
          margin: 24px 0;
          padding: 16px;
          background: rgba(102, 126, 234, 0.05);
          border-radius: var(--border-radius-sm);
          border: 2px dashed rgba(102, 126, 234, 0.3);
        }
        .file-upload-box p {
          margin: 0 0 12px 0;
          color: var(--primary-color);
          font-weight: 600;
          font-size: 14px;
        }
        .file-upload-box label {
          word-wrap: break-word;
          white-space: normal;
          max-width: 100%;
          display: inline-block;
        }
        .instructions-box {
          background: var(--secondary-background);
          border-radius: var(--border-radius-sm);
          padding: 16px;
          color: var(--text-secondary);
          font-size: 14px;
          line-height: 1.7;
          text-align: left;
        }
        .instructions-title {
          font-weight: 600;
          margin-bottom: 8px;
          color: var(--text-instructions);
        }
        .instructions-box ul {
          margin: 0;
          padding-left: 20px;
        }
        #reader video {
          border-radius: 16px !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        #reader__dashboard_section {
          background: rgba(255, 255, 255, 0.95) !important;
          backdrop-filter: blur(10px) !important;
          border-radius: 0 0 16px 16px !important;
          padding: 16px !important;
        }
        #reader__dashboard_section button {
          background: var(--primary-gradient) !important;
          border: none !important;
          border-radius: 12px !important;
          color: white !important;
          font-weight: 600 !important;
          padding: 12px 24px !important;
          margin: 4px !important;
          transition: all 0.3s ease !important;
          cursor: pointer !important;
        }
        #reader__dashboard_section button:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4) !important;
        }
        #reader__dashboard_section select {
          border: 2px solid #e9ecef !important;
          border-radius: 8px !important;
          padding: 8px 12px !important;
          font-size: 14px !important;
          background: white !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        #reader__scan_region {
          border-radius: 16px !important;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @media (max-width: 600px) {
          .scanner-card {
            padding: 24px 16px;
          }
          .scanner-title {
            font-size: 24px;
          }
          .scanner-icon {
            font-size: 40px;
          }
          .btn {
            font-size: 13px;
            padding: 10px 16px;
          }
          .file-upload-box {
            padding: 12px;
          }
          .button-group {
            flex-direction: column;
            width: 100%;
          }
          .button-group .btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
