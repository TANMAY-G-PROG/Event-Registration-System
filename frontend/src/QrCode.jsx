import { useState, useEffect, useRef, useCallback } from 'react';
import './QrCode.css';

const TOKEN_LIFETIME = 15;
const PREFETCH_AT = 2;
const QR_TOKEN_VALIDITY_MS = 15000; // must match server

export default function QrCode() {
  const [error, setError] = useState(false);
  const [countdown, setCountdown] = useState(TOKEN_LIFETIME);
  const [isWarning, setIsWarning] = useState(false);
  const [libLoaded, setLibLoaded] = useState(false);

  const qrBoxRef = useRef(null);
  const qrInstanceRef = useRef(null);
  const intervalRef = useRef(null);
  const pendingToken = useRef(null);
  const eventIdRef = useRef(null);
  const countRef = useRef(TOKEN_LIFETIME);
  const swappingRef = useRef(false);

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const eid = new URLSearchParams(window.location.search).get('eventId');
    if (!eid) { setError(true); return; }
    eventIdRef.current = eid;

    if (window.QRCode) { setLibLoaded(true); return; }

    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.async = true;
    s.onload = () => setLibLoaded(true);
    s.onerror = () => setError(true);
    document.body.appendChild(s);

    return () => clearInterval(intervalRef.current);
  }, []);

  // ── Fetch token from server ────────────────────────────────────────────────
  const fetchToken = useCallback(async () => {
    const eid = eventIdRef.current;
    if (!eid) return null;
    try {
      const res = await fetch(`/api/events/${eid}/qr-token`, { credentials: 'include' });
      if (!res.ok) throw new Error('Token fetch failed');
      const { token, timestamp } = await res.json();
      return { token, timestamp };
    } catch {
      return null;
    }
  }, []);

  // ── Compute actual remaining seconds using server timestamp ────────────────
  const getRemainingSeconds = useCallback((tokenData) => {
    const elapsed = Date.now() - parseInt(tokenData.timestamp, 10);
    const remaining = Math.floor((QR_TOKEN_VALIDITY_MS - elapsed) / 1000);
    return Math.max(1, Math.min(remaining, TOKEN_LIFETIME));
  }, []);

  // ── Render QR ──────────────────────────────────────────────────────────────
  const renderQR = useCallback((tokenData) => {
    const box = qrBoxRef.current;
    if (!box || !window.QRCode || !tokenData) return;

    if (qrInstanceRef.current) {
      try { qrInstanceRef.current.clear(); } catch (_) { }
      qrInstanceRef.current = null;
    }
    box.innerHTML = '';

    const qrText = `eventId:${eventIdRef.current}:${tokenData.token}:${tokenData.timestamp}`;

    qrInstanceRef.current = new window.QRCode(box, {
      text: qrText,
      width: 220,
      height: 220,
      colorDark: '#0f172a',
      colorLight: '#ffffff',
      correctLevel: window.QRCode.CorrectLevel.H,
    });
  }, []);

  // ── Main cycle ─────────────────────────────────────────────────────────────
  const startCycle = useCallback(async () => {
    clearInterval(intervalRef.current);

    // Fetch and render first token
    const first = await fetchToken();
    if (!first) { setError(true); return; }
    renderQR(first);

    // Pre-fetch next token immediately
    fetchToken().then(t => { pendingToken.current = t; });

    // ✅ Use server timestamp to compute accurate countdown
    const initialCount = getRemainingSeconds(first);
    countRef.current = initialCount;
    setCountdown(initialCount);
    setIsWarning(initialCount <= 4);
    swappingRef.current = false;

    intervalRef.current = setInterval(() => {
      countRef.current -= 1;
      const c = countRef.current;
      setCountdown(c);
      setIsWarning(c <= 4);

      // Background fetch when close to expiry
      if (c === PREFETCH_AT && !pendingToken.current) {
        fetchToken().then(t => { pendingToken.current = t; });
      }

      // Swap QR at 0
      if (c <= 0 && !swappingRef.current) {
        swappingRef.current = true;

        const next = pendingToken.current;
        pendingToken.current = null;

        if (next) {
          renderQR(next);
          // ✅ Sync countdown to actual server-issued timestamp
          const nextCount = getRemainingSeconds(next);
          countRef.current = nextCount;
          setCountdown(nextCount);
        } else {
          // Rare fallback: fetch fresh token
          fetchToken().then(t => {
            if (t) {
              renderQR(t);
              const nextCount = getRemainingSeconds(t);
              countRef.current = nextCount;
              setCountdown(nextCount);
            }
          });
          countRef.current = TOKEN_LIFETIME;
          setCountdown(TOKEN_LIFETIME);
        }

        setIsWarning(false);

        // Pre-fetch the one after that
        fetchToken().then(t => { pendingToken.current = t; });

        swappingRef.current = false;
      }
    }, 1000);
  }, [fetchToken, renderQR, getRemainingSeconds]);

  // ── Kick off once lib is ready ─────────────────────────────────────────────
  useEffect(() => {
    if (libLoaded && eventIdRef.current) startCycle();
    return () => clearInterval(intervalRef.current);
  }, [libLoaded, startCycle]);

  // ── SVG ring values ────────────────────────────────────────────────────────
  const R = 20;
  const circumference = 2 * Math.PI * R;
  const dashOffset = circumference - (countdown / TOKEN_LIFETIME) * circumference;

  return (
    <div className="qr-code-page">
      <div className="qr-container">

        <div className="qr-header">
          <h1>Event Check-in</h1>
          <p className="subtitle">Display this for participants &amp; volunteers to scan</p>
        </div>

        {error ? (
          <div className="qr-error-box">
            <span>⚠️</span>
            <p>Unable to generate QR code. Please go back and try again.</p>
          </div>
        ) : (
          <div className="card">

            <div className="card-header">
              <h2>Live Attendance QR</h2>
              <p className="card-subtitle">Refreshes every {TOKEN_LIFETIME} seconds · Do not screenshot</p>
            </div>

            {/* QR box — swaps in place without disappearing */}
            <div className="qr-code" ref={qrBoxRef} />

            <div className="countdown-strip">
              <div className="c-text">
                <span className="c-label">
                  {isWarning ? '⚡ Refreshing soon' : '🔄 Auto-refreshing'}
                </span>
                <span className="c-sub">Next code in {countdown}s</span>
              </div>
            </div>

          </div>
        )}

        <button className="back-btn" onClick={() => window.history.back()}>
          ← Back to Event
        </button>

      </div>
    </div>
  );
}
