import { useState, useRef, useEffect } from 'react';
import { Scan, Upload, ArrowLeft, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import './Scanner.css';

export default function Scanner() {
  // ---------------------------------------------------------------------------
  // STATE & REFS
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // INITIALIZATION
  // ---------------------------------------------------------------------------
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
        headers: { 'Content-Type': 'application/json' },
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
      setErrorMsg('Failed to load user information.');
      setPageState('error');
    }
  };

  // ---------------------------------------------------------------------------
  // STATE MANAGEMENT
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (pageState === 'loading' && userUSN && libraryLoaded) {
      console.log('🚀 Prerequisites met. Switching to scanning state.');
      setPageState('scanning');
    }
  }, [pageState, userUSN, libraryLoaded]);

  useEffect(() => {
    let timer;
    if (pageState === 'scanning') {
      console.log('⏳ Waiting for DOM to mount...');
      timer = setTimeout(() => initScanner(), 800);
    }
    if (pageState !== 'scanning') {
      cleanupScanner();
    }
    return () => clearTimeout(timer);
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
      setErrorMsg('Failed to load QR scanner library.');
      setPageState('error');
    };
    document.head.appendChild(script);
  };

  const initScanner = () => {
    if (!window.Html5QrcodeScanner) {
      console.log('❌ Library not found');
      return;
    }
    if (html5QrcodeScannerRef.current) {
      console.log('⚠️ Scanner already running');
      return;
    }
    
    const element = document.getElementById('reader');
    if (!element) {
      console.log('⚠️ DOM element #reader not found yet. Retrying in 200ms...');
      setTimeout(initScanner, 200);
      return;
    }

    console.log('🎥 Initializing scanner on element:', element);
    
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
        },
        false
      );
      scanner.render(onScanSuccess, onScanError);
      html5QrcodeScannerRef.current = scanner;
      setIsScanning(true);
      console.log('✅ Scanner started successfully');
    } catch (err) {
      console.error('Scanner initialization error:', err);
      setErrorMsg('Camera failed. You can still upload an image.');
    }
  };

  const onScanSuccess = async (decodedText) => {
    if (pageState !== 'scanning') return;
    
    console.log(`✅ QR Code detected: ${decodedText}`);
    setIsScanning(false);
    setPageState('processing'); 
    setLastResult(decodedText);
    
    cleanupScanner();
    
    if (decodedText.startsWith('eventId:')) {
      const eventId = decodedText.split(':')[1];
      await markAttendance(eventId);
    } else {
      setErrorMsg('Invalid QR code format.');
      setPageState('error');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    console.log('📁 File selected:', file.name);
    
    if (!window.Html5Qrcode) {
      setErrorMsg('Library not ready.');
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
      setErrorMsg('Could not read QR code from image.');
      setPageState('error');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const markAttendance = async (eventId) => {
    if (!userUSN || !userRole) {
      setErrorMsg('User session error. Sign in again.');
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
      console.error('Attendance marking error:', err);
      setErrorMsg('Network error. Please try again.');
      setPageState('error');
    }
  };

  const onScanError = (errorMessage) => {
    if (errorMessage.includes('NotFoundException') || 
        errorMessage.includes('No MultiFormat Readers')) return;
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

  // ---------------------------------------------------------------------------
  // UI RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="scanner-page">
      <div className="ambient-orb orb-1" />
      <div className="ambient-orb orb-2" />
      <div id="file-reader" style={{ display: 'none' }} />

      <div className="scanner-container">
        <div className="glass-card">
          
          <div className="scanner-header">
            <div className="scanner-icon-box">
              <Scan className="icon-main" />
            </div>
            <h1 className="scanner-title">Mark Attendance</h1>
            <div className="user-info-pill">
              <span className={`role-badge ${userRole === 'volunteer' ? 'role-vol' : 'role-part'}`}>
                {userRole === 'volunteer' ? 'Volunteer' : 'Participant'}
              </span>
              {userUSN && <span className="usn-text">{userUSN}</span>}
            </div>
          </div>

          <div className="scanner-content">
            
            {/* LOADING */}
            {pageState === 'loading' && (
              <div className="state-box">
                <div className="loader-container">
                  <Loader2 className="spinner-icon" />
                </div>
                <p className="status-text pulse">Authenticating...</p>
              </div>
            )}

            {/* SCANNING */}
            {(pageState === 'scanning' || pageState === 'processing') && (
              <div className="scan-wrapper">
                <div className="camera-frame">
                  <div id="reader" className="camera-view" />
                  
                  {isScanning && (
                    <div className="scan-overlay">
                      <div className="corner tl" />
                      <div className="corner tr" />
                      <div className="corner bl" />
                      <div className="corner br" />
                      <div className="scan-line" />
                    </div>
                  )}

                  {pageState === 'processing' && (
                    <div className="processing-overlay">
                      <Loader2 className="spinner-icon small" />
                      <span>Verifying...</span>
                    </div>
                  )}
                </div>

                <p className="instruction-text">Align QR code within the frame</p>

                <div className="action-grid">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    id="qr-file-input"
                  />
                  <label htmlFor="qr-file-input" className="btn-secondary">
                    <Upload className="btn-icon" /> Upload Image
                  </label>
                  <button onClick={goBack} className="btn-secondary">
                    <ArrowLeft className="btn-icon" /> Cancel
                  </button>
                </div>
              </div>
            )}

            {/* SUCCESS */}
            {pageState === 'success' && (
              <div className="state-box success-state">
                <div className="success-icon-circle">
                  <CheckCircle2 className="success-icon" />
                </div>
                
                <h2>Verified</h2>
                <p className="result-text">
                  Attendance recorded for<br/>
                  <span className="highlight">Event ID: {lastResult.replace('eventId:', '')}</span>
                </p>

                <div className="btn-stack">
                  <button onClick={scanAgain} className="btn-primary">
                    <Scan className="btn-icon" /> Scan Another
                  </button>
                  <button onClick={goBack} className="btn-ghost">
                    Back to Dashboard
                  </button>
                </div>
              </div>
            )}

            {/* ERROR */}
            {pageState === 'error' && (
              <div className="state-box error-state">
                <div className="error-icon-circle">
                  <AlertCircle className="error-icon" />
                </div>
                
                <h2>Scan Failed</h2>
                <p className="error-msg">{errorMsg}</p>

                <div className="action-grid">
                  <button onClick={goBack} className="btn-secondary">
                    Exit
                  </button>
                  <button onClick={restartScanner} className="btn-danger">
                    <RefreshCw className="btn-icon" /> Retry
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
        <p className="footer-text">Secured Attendance System</p>
      </div>
    </div>
  );
}
