import { useState, useRef, useEffect } from 'react';

export default function Scanner() {
  const [lastResult, setLastResult] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [error, setError] = useState(null);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userUSN, setUserUSN] = useState(null);
  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  
  const scannerRef = useRef(null);
  const html5QrcodeScannerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const role = urlParams.get('role');
    
    const detectedRole = role === 'volunteer' ? 'volunteer' : 'participant';
    setUserRole(detectedRole);
    console.log('✅ User role detected:', detectedRole);

    fetchUserData();

    return () => {
      cleanupScanner();
    };
  }, []);

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

  const fetchUserData = async () => {
    setIsLoadingUser(true);
    try {
      const response = await fetch('http://localhost:3000/api/me', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUserUSN(data.userUSN);
        console.log('✅ User USN loaded:', data.userUSN);
        setIsLoadingUser(false);
        
        // Load QR library after user is authenticated
        loadQRLibrary();
      } else {
        setError('User not authenticated. Please sign in first.');
        setIsLoadingUser(false);
      }
    } catch (err) {
      console.error('Error fetching user info:', err);
      setError('Failed to load user information. Please try again.');
      setIsLoadingUser(false);
    }
  };

  const loadQRLibrary = () => {
    if (window.Html5QrcodeScanner) {
      console.log('✅ QR library already loaded');
      setLibraryLoaded(true);
      setTimeout(() => initScanner(), 300);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';
    script.onload = () => {
      console.log('✅ QR library loaded');
      setLibraryLoaded(true);
      setTimeout(() => initScanner(), 300);
    };
    script.onerror = () => {
      setError('Failed to load QR scanner library. Please refresh the page.');
    };
    document.head.appendChild(script);
  };

  const initScanner = () => {
    if (!window.Html5QrcodeScanner || !scannerRef.current) {
      console.log('⚠️ Scanner not ready, retrying...');
      setTimeout(() => initScanner(), 500);
      return;
    }

    cleanupScanner();

    console.log('🎥 Initializing scanner');

    try {
      html5QrcodeScannerRef.current = new window.Html5QrcodeScanner(
        'reader',
        {
          qrbox: { width: 250, height: 250 },
          fps: 10,
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
          rememberLastUsedCamera: true,
          videoConstraints: {
            facingMode: { ideal: "environment" }
          },
          supportedScanTypes: [0, 1],
          formatsToSupport: [0, 1]
        },
        false
      );

      html5QrcodeScannerRef.current.render(onScanSuccess, onScanError);
      setIsScanning(true);
      console.log('✅ Scanner rendered');
    } catch (err) {
      console.error('Scanner initialization error:', err);
      setError('Failed to initialize scanner. Please check camera permissions and try again.');
    }
  };

  const onScanSuccess = async (decodedText) => {
    console.log(`✅ QR Code detected: ${decodedText}`);
    console.log(`📋 Current role: ${userRole}, USN: ${userUSN}`);
    
    setLastResult(decodedText);
    setIsScanning(false);
    
    cleanupScanner();

    if (decodedText.startsWith('eventId:')) {
      const eventId = decodedText.split(':')[1];
      await markAttendance(eventId);
    } else {
      setError('Invalid QR code format. Please scan the event QR code.');
      setShowResult(true);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    console.log('📁 File selected:', file.name);

    if (!window.Html5Qrcode) {
      setError('QR scanner library not loaded. Please refresh and try again.');
      return;
    }

    try {
      const html5QrCode = new window.Html5Qrcode("reader");
      const decodedText = await html5QrCode.scanFile(file, true);
      console.log('✅ QR decoded from file:', decodedText);
      
      await onScanSuccess(decodedText);
      
      html5QrCode.clear();
    } catch (err) {
      console.error('File scan error:', err);
      setError('Could not read QR code from image. Please try another image or use camera.');
    }
  };

  const markAttendance = async (eventId) => {
    if (!userUSN) {
      setError('User not authenticated. Please sign in again.');
      setShowResult(true);
      return;
    }

    if (!userRole) {
      setError('User role not determined. Please try again.');
      setShowResult(true);
      return;
    }

    console.log(`🎯 Marking attendance - Role: ${userRole}, USN: ${userUSN}, Event: ${eventId}`);

    try {
      const endpoint = userRole === 'volunteer' 
        ? `http://localhost:3000/api/mark-volunteer-attendance`
        : `http://localhost:3000/api/mark-participant-attendance`;

      console.log(`📡 Calling endpoint: ${endpoint}`);

      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          eventId: eventId,
          usn: userUSN
        })
      });

      const data = await response.json();
      console.log('📥 Response:', data);

      if (response.ok && data.success) {
        setAttendanceMarked(true);
        setShowResult(true);
        setError(null);
        console.log(`✅ ${userRole} attendance marked successfully`);
      } else {
        setError(data.error || 'Failed to mark attendance');
        setShowResult(true);
      }
    } catch (err) {
      console.error('Error marking attendance:', err);
      setError('Network error. Please try again.');
      setShowResult(true);
    }
  };

  const onScanError = (errorMessage) => {
    // Ignore common "not found" errors during scanning
    if (errorMessage.includes('NotFoundException') || 
        errorMessage.includes('No MultiFormat Readers')) {
      return;
    }
    console.log(`Scan error: ${errorMessage}`);
  };

  const scanAgain = () => {
    console.log('🔄 Restarting scanner');
    setShowResult(false);
    setLastResult('');
    setError(null);
    setAttendanceMarked(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    setTimeout(() => {
      if (libraryLoaded) {
        initScanner();
      } else {
        loadQRLibrary();
      }
    }, 200);
  };

  const restartScanner = () => {
    setError(null);
    setShowResult(false);
    setAttendanceMarked(false);
    setIsLoadingUser(true);
    cleanupScanner();
    fetchUserData();
  };

  const goBack = () => {
    window.history.back();
  };

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
      background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '24px',
        padding: '32px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px',
            background: 'linear-gradient(45deg, #667eea, #764ba2)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>📱</div>
          <h1 style={{
            color: '#2c3e50',
            fontSize: '28px',
            fontWeight: '700',
            margin: '0 0 8px 0'
          }}>Mark Attendance</h1>
          <p style={{
            color: '#7f8c8d',
            fontSize: '16px',
            margin: '0'
          }}>
            {userRole === 'volunteer' ? '🤝 Volunteer' : '🎫 Participant'} - Scan event QR code
          </p>
          {userUSN && (
            <p style={{
              color: '#5a6c7d',
              fontSize: '14px',
              marginTop: '8px',
              fontWeight: '600'
            }}>
              USN: {userUSN}
            </p>
          )}
        </div>

        {isLoadingUser && (
          <div style={{
            background: 'rgba(102, 126, 234, 0.1)',
            border: '2px solid rgba(102, 126, 234, 0.3)',
            borderRadius: '12px',
            padding: '20px',
            margin: '24px 0'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
            <p style={{ margin: 0, color: '#667eea', fontWeight: '600' }}>Loading user data...</p>
          </div>
        )}

        {error && !isLoadingUser && (
          <div style={{
            background: 'rgba(255, 107, 107, 0.1)',
            border: '2px solid rgba(255, 107, 107, 0.3)',
            borderRadius: '12px',
            padding: '20px',
            margin: '24px 0',
            color: '#d32f2f'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
            <p style={{ margin: '0 0 12px 0', fontSize: '14px' }}>{error}</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                onClick={restartScanner}
                style={{
                  background: '#d32f2f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                Try Again
              </button>
              <button 
                onClick={goBack}
                style={{
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                Go Back
              </button>
            </div>
          </div>
        )}

        {!isLoadingUser && !error && !showResult && (
          <>
            <div style={{
              position: 'relative',
              margin: '24px 0',
              borderRadius: '16px',
              overflow: 'hidden',
              background: '#000',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
            }}>
              <div id="reader" ref={scannerRef} style={{
                width: '100%',
                minHeight: '300px',
                borderRadius: '16px'
              }}></div>
              
              {isScanning && (
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'rgba(76, 175, 80, 0.9)',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '600',
                  animation: 'pulse 2s infinite',
                  zIndex: 1000
                }}>
                  🔍 Scanning...
                </div>
              )}
            </div>

            <div style={{
              margin: '24px 0',
              padding: '16px',
              background: 'rgba(102, 126, 234, 0.05)',
              borderRadius: '12px',
              border: '2px dashed rgba(102, 126, 234, 0.3)'
            }}>
              <p style={{
                margin: '0 0 12px 0',
                color: '#667eea',
                fontWeight: '600',
                fontSize: '14px'
              }}>Or upload QR code image</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                id="qr-file-input"
              />
              <label
                htmlFor="qr-file-input"
                style={{
                  display: 'inline-block',
                  background: 'linear-gradient(45deg, #667eea, #764ba2)',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'transform 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                📁 Choose Image File
              </label>
            </div>

            <div style={{
              background: 'rgba(108, 117, 125, 0.1)',
              borderRadius: '12px',
              padding: '16px',
              color: '#6c757d',
              fontSize: '14px',
              lineHeight: '1.7',
              textAlign: 'left'
            }}>
              <div style={{
                fontWeight: '600',
                marginBottom: '8px',
                color: '#495057'
              }}>📋 Instructions:</div>
              • Scan the <strong>organizer's QR code</strong> using camera<br />
              • Or upload a screenshot/photo of the QR code<br />
              • Your attendance will be automatically marked<br />
              • Make sure you are registered for the event
            </div>
          </>
        )}

        {showResult && attendanceMarked && (
          <div style={{
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            borderRadius: '16px',
            padding: '24px',
            marginTop: '24px',
            animation: 'slideIn 0.4s ease'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <div style={{
              color: 'white',
              fontSize: '20px',
              fontWeight: '700',
              marginBottom: '8px'
            }}>
              {userRole === 'volunteer' ? 'Volunteer' : 'Participant'} Attendance Marked!
            </div>
            <div style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '14px',
              marginBottom: '16px'
            }}>
              Your attendance has been successfully recorded as a {userRole}
            </div>
            <div style={{
              marginTop: '16px',
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button 
                style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  color: '#667eea',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '12px',
                  padding: '10px 20px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  fontSize: '14px'
                }}
                onClick={goBack}
              >
                ← Back to Event
              </button>
              <button 
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '12px',
                  padding: '10px 20px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  fontSize: '14px'
                }}
                onClick={scanAgain}
              >
                🔄 Scan Another Event
              </button>
            </div>
          </div>
        )}

        {showResult && error && !attendanceMarked && (
          <div style={{ marginTop: '24px' }}>
            <button 
              style={{
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '10px 20px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '14px',
                marginRight: '8px'
              }}
              onClick={goBack}
            >
              ← Go Back
            </button>
            <button 
              style={{
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '10px 20px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '14px'
              }}
              onClick={scanAgain}
            >
              🔄 Try Again
            </button>
          </div>
        )}

        <style>{`
          #reader video {
            border-radius: 16px !important;
            width: 100% !important;
            max-width: 100% !important;
          }

          #reader__dashboard_section {
            background: rgba(255, 255, 255, 0.95) !important;
            backdrop-filter: blur(10px) !important;
            borderRadius: 0 0 16px 16px !important;
            padding: 16px !important;
          }

          #reader__dashboard_section button {
            background: linear-gradient(45deg, #667eea, #764ba2) !important;
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

          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.05);
            }
          }
        `}</style>
      </div>
    </div>
  );
}