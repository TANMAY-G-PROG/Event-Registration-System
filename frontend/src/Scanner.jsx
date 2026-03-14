import { useState, useRef, useEffect } from 'react';
import './Scanner.css';

import { apiFetch } from "./api.js";

export default function Scanner() {
  const [pageState, setPageState] = useState('loading');
  const [errorMsg, setErrorMsg]   = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [userRole, setUserRole]   = useState(null);
  const [userUSN, setUserUSN]     = useState(null);

  // Keep userRole accessible inside callbacks without stale closure
  const userRoleRef = useRef(null);
  const userUSNRef  = useRef(null);

  const scannerInstanceRef = useRef(null);
  const isMountedRef       = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const urlParams = new URLSearchParams(window.location.search);
    const role = urlParams.get('role') === 'volunteer' ? 'volunteer' : 'participant';
    setUserRole(role);
    userRoleRef.current = role;

    fetchUserData();

    if (!window.Html5Qrcode) {
      const script   = document.createElement('script');
      script.src     = 'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';
      script.onload  = () => console.log('✅ QR Lib Loaded');
      document.head.appendChild(script);
    }

    return () => {
      isMountedRef.current = false;
      stopScanner();
    };
  }, []);

  // ── Fetch current user ─────────────────────────────────────────────────────
  const fetchUserData = async () => {
    try {
      const response = await apiFetch('/api/me');
      if (response.ok) {
        const data = await response.json();
        setUserUSN(data.userUSN);
        userUSNRef.current = data.userUSN;
        setPageState('scanning');
      } else {
        setErrorMsg('Please sign in first.');
        setPageState('error');
      }
    } catch {
      setErrorMsg('Failed to load user.');
      setPageState('error');
    }
  };

  // ── Scanner start ──────────────────────────────────────────────────────────
  const startScanner = async () => {
    if (!window.Html5Qrcode) {
      setTimeout(startScanner, 100);
      return;
    }
    if (scannerInstanceRef.current) return;

    const config = {
      fps:         10,
      qrbox:       { width: 250, height: 250 },
      aspectRatio: 1.0,
      disableFlip: false,
    };

    try {
      const html5QrCode = new window.Html5Qrcode('reader');
      scannerInstanceRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        onScanSuccess,
        () => {} // ignore per-frame errors
      );

      if (isMountedRef.current) setIsScanning(true);

    } catch (err) {
      console.error('Camera Start Error:', err);
      try {
        if (scannerInstanceRef.current) {
          await scannerInstanceRef.current.start(
            { facingMode: { exact: 'environment' } },
            config,
            onScanSuccess,
            () => {}
          );
          if (isMountedRef.current) setIsScanning(true);
        }
      } catch {
        setErrorMsg('Camera error. Please ensure you are on HTTPS and allowed camera permissions.');
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
        console.warn('Failed to stop scanner', err);
      }
      scannerInstanceRef.current = null;
      if (isMountedRef.current) setIsScanning(false);
    }
  };

  useEffect(() => {
    if (pageState === 'scanning') {
      const t = setTimeout(startScanner, 100);
      return () => clearTimeout(t);
    }
  }, [pageState]);

  // ── QR decode handler ──────────────────────────────────────────────────────
  // Expected QR format: "seid:SEID:TOKEN:TIMESTAMP"
  // This is exactly what QrCode.jsx encodes.
  const onScanSuccess = async (decodedText) => {
    if (!isMountedRef.current) return;
    await stopScanner();
    setPageState('processing');

    if (!decodedText.startsWith('seid:')) {
      setErrorMsg('Invalid QR. Please scan a valid Event QR code.');
      setPageState('error');
      return;
    }

    // Split on ':' — gives ['seid', SEID, TOKEN, TIMESTAMP]
    // TOKEN is a 16-char hex string (no colons), so splitting on ':' is safe.
    const parts = decodedText.split(':');

    if (parts.length !== 4) {
      setErrorMsg('QR code format is outdated. Please ask the organizer to show a fresh code.');
      setPageState('error');
      return;
    }

    const [, seid, token, timestamp] = parts;
    await markAttendance(seid, token, timestamp);
  };

  // ── Mark attendance ────────────────────────────────────────────────────────
  const markAttendance = async (seid, token, timestamp) => {
    try {
      const role     = userRoleRef.current;
      const usn      = userUSNRef.current;
      const endpoint = role === 'volunteer'
        ? '/api/mark-volunteer-attendance'
        : '/api/mark-participant-attendance';

      const res = await apiFetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          seid,
          usn,
          token,
          timestamp
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setPageState('success');
      } else {
        if (data.error === 'Attendance already marked for this sub-event') {
          setErrorMsg('Attendance already marked for this sub-event');
        } else {
          setErrorMsg(data.error || 'Attendance marking failed.');
        }
        setPageState('error');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setPageState('error');
    }
  };

  // ── File upload fallback ───────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !window.Html5Qrcode) return;

    try {
      const scanner = new window.Html5Qrcode('reader');
      const result  = await scanner.scanFile(file, true);
      onScanSuccess(result);
    } catch {
      setErrorMsg('Could not read QR from image. Please try again.');
      setPageState('error');
    }
  };

  const reset  = () => { setErrorMsg(null); setPageState('scanning'); };
  const goBack = () => window.history.back();

  // ── Render ─────────────────────────────────────────────────────────────────
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

        {/* Loading */}
        {pageState === 'loading' && (
          <div className="status-box loading-box fade-in">
            <div className="status-icon">⏳</div>
            <p>Loading...</p>
          </div>
        )}

        {/* Error */}
        {pageState === 'error' && (
          <div className="status-box error-box fade-in">
            <div className="status-icon">⚠️</div>
            <p className="error-message">{errorMsg}</p>
            <div className="button-group">
              <button onClick={reset}  className="btn btn-danger">Try Again</button>
              <button onClick={goBack} className="btn btn-secondary">Go Back</button>
            </div>
          </div>
        )}

        {/* Scanning */}
        {pageState === 'scanning' && (
          <div className="scanner-main fade-in">
            <div className="scanner-video-container">
              <div id="reader" style={{ width: '100%', height: '100%' }} />
              {!isScanning && (
                <div className="scanner-loading-overlay">
                  <div className="org-spinner-dots" />
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

        {/* Processing */}
        {pageState === 'processing' && (
          <div className="status-box loading-box fade-in">
            <div className="org-spinner-dots" />
            <p>Marking Attendance...</p>
          </div>
        )}

        {/* Success */}
        {pageState === 'success' && (
          <div className="status-box success-box fade-in">
            <div className="status-icon">✅</div>
            <h2 className="success-title">Done!</h2>
            <p>Attendance Marked Successfully</p>
            <div className="button-group">
              <button onClick={goBack} className="btn btn-success-light">Back</button>
              <button onClick={reset}  className="btn btn-success-dark">Scan Next</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
