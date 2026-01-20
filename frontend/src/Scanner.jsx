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
      setErrorMsg('Failed to load user information.');
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
      const timer = setTimeout(() => initScanner(), 300); // Increased delay for iOS
      return () => clearTimeout(timer);
    }
    return () => cleanupScanner();
  }, [pageState]);

  const cleanupScanner = () => {
    if (html5QrcodeScannerRef.current) {
      try {
        html5QrcodeScannerRef.current.clear().catch(err => console.warn(err));
        html5QrcodeScannerRef.current = null;
      } catch (err) {
        console.warn('Cleanup warning:', err);
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
      setErrorMsg('Failed to load scanner library.');
      setPageState('error');
    };
    document.head.appendChild(script);
  };

  const initScanner = () => {
    if (!window.Html5QrcodeScanner || !scannerRef.current || html5QrcodeScannerRef.current) {
      return;
    }

    try {
      // FIX FOR IOS: Simplified config
      const config = {
        fps: 10,
        // Removed fixed aspectRatio - let the camera decide
        videoConstraints: {
          facingMode: { ideal: "environment" }
        },
        rememberLastUsedCamera: true,
        supportedScanTypes: [0, 1] 
      };

      const scanner = new window.Html5QrcodeScanner(
        'reader', 
        config, 
        /* verbose= */ false
      );
      
      scanner.render(onScanSuccess, onScanError);
      html5QrcodeScannerRef.current = scanner;
      setIsScanning(true);
    } catch (err) {
      console.error('Init error:', err);
      setErrorMsg('Camera access denied or not supported.');
      setPageState('error');
    }
  };

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
      setErrorMsg('Invalid QR Code. Please scan an Event QR.');
      setPageState('error');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!window.Html5Qrcode) return;

    try {
      if (!fileScannerRef.current) {
        fileScannerRef.current = new window.Html5Qrcode('file-reader');
      }
      const decodedText = await fileScannerRef.current.scanFile(file, true);
      onScanSuccess(decodedText);
    } catch (err) {
      setErrorMsg('Could not find QR code in image.');
      setPageState('error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const markAttendance = async (eventId) => {
    try {
      const endpoint = userRole === 'volunteer' ? '/api/mark-volunteer-attendance' : '/api/mark-participant-attendance';
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, usn: userUSN }),
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
      setErrorMsg('Network error. Try again.');
      setPageState('error');
    }
  };

  const onScanError = (errorMessage) => {
    // Ignore common scanning errors to prevent console spam
  };

  const scanAgain = () => {
    setLastResult('');
    setErrorMsg(null);
    setPageState('scanning');
  };

  const restartScanner = () => {
    setErrorMsg(null);
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
            {userRole === 'volunteer' ? 'Volunteer' : 'Participant'} Mode
          </p>
          {userUSN && <p className="scanner-usn">{userUSN}</p>}
        </div>

        {pageState === 'loading' && (
          <div className="status-box loading-box fade-in">
            <div className="status-icon">⏳</div>
            <p>Initializing...</p>
          </div>
        )}

        {pageState === 'error' && (
          <div className="status-box error-box fade-in">
            <div className="status-icon">⚠️</div>
            <p className="error-message">{errorMsg}</p>
            <div className="button-group">
              <button onClick={restartScanner} className="btn btn-danger">Try Again</button>
              <button onClick={goBack} className="btn btn-secondary">Go Back</button>
            </div>
          </div>
        )}

        {pageState === 'scanning' && (
          <div className="scanner-main fade-in">
            <div className="scanner-video-container">
              {/* This ID is strictly required by the library */}
              <div id="reader" ref={scannerRef}></div>
            </div>
            
            <div className="file-upload-box">
              <p>Or upload QR image</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                id="qr-file-input"
              />
              <label htmlFor="qr-file-input" className="btn btn-primary">
                📁 Upload Image
              </label>
            </div>
          </div>
        )}

        {pageState === 'success' && (
          <div className="status-box success-box fade-in">
            <div className="status-icon">✅</div>
            <h2 className="success-title">Attendance Marked!</h2>
            <div className="button-group">
              <button onClick={goBack} className="btn btn-success-light">Back</button>
              <button onClick={scanAgain} className="btn btn-success-dark">Scan Another</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
