import { useState, useEffect, useRef, useCallback } from 'react';
import './QrCode.css';

const TOKEN_LIFETIME = 15;
const PREFETCH_AT = 2; // start fetching next token when 2s remain

export default function QrCode() {
  const [error, setError]       = useState(false);
  const [countdown, setCountdown] = useState(TOKEN_LIFETIME);
  const [isWarning, setIsWarning] = useState(false);
  const [libLoaded, setLibLoaded] = useState(false);

  const qrBoxRef      = useRef(null);  // the white box DOM node
  const qrInstanceRef = useRef(null);
  const intervalRef   = useRef(null);
  const pendingToken  = useRef(null);  // { token, timestamp }
  const eventIdRef    = useRef(null);
  const countRef      = useRef(TOKEN_LIFETIME);
  const swappingRef   = useRef(false); // guard against double-swap

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const eid = new URLSearchParams(window.location.search).get('eventId');
    if (!eid) { setError(true); return; }
    eventIdRef.current = eid;

    if (window.QRCode) { setLibLoaded(true); return; }

    const s    = document.createElement('script');
    s.src      = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.async    = true;
    s.onload   = () => setLibLoaded(true);
    s.onerror  = () => setError(true);
    document.body.appendChild(s);

    return () => clearInterval(intervalRef.current);
  }, []);

  // ── Fetch token — returns { token, timestamp } ─────────────────────────────
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

  // ── Render QR — always destroy + recreate to avoid double-QR bug ──────────
  const renderQR = useCallback((tokenData) => {
    const box = qrBoxRef.current;
    if (!box || !window.QRCode || !tokenData) return;

    // Destroy previous instance completely
    if (qrInstanceRef.current) {
      try { qrInstanceRef.current.clear(); } catch (_) {}
      qrInstanceRef.current = null;
    }
    box.innerHTML = '';

    // QR text format MUST match what Scanner.jsx parses:
    // "eventId:EID:TOKEN:TIMESTAMP"
    const qrText = `eventId:${eventIdRef.current}:${tokenData.token}:${tokenData.timestamp}`;

    qrInstanceRef.current = new window.QRCode(box, {
      text:         qrText,
      width:        220,
      height:       220,
      colorDark:    '#0f172a',
      colorLight:   '#ffffff',
      correctLevel: window.QRCode.CorrectLevel.H,
    });
  }, []);

  // ── Main cycle ─────────────────────────────────────────────────────────────
  const startCycle = useCallback(async () => {
    clearInterval(intervalRef.current);

    // Render first QR immediately
    const first = await fetchToken();
    if (!first) { setError(true); return; }
    renderQR(first);

    // Pre-fetch the NEXT token right away so it's always ready
    fetchToken().then(t => { pendingToken.current = t; });

    countRef.current = TOKEN_LIFETIME;
    setCountdown(TOKEN_LIFETIME);
    setIsWarning(false);
    swappingRef.current = false;

    intervalRef.current = setInterval(() => {
      countRef.current -= 1;
      const c = countRef.current;
      setCountdown(c);
      setIsWarning(c <= 4);

      // Background fetch when PREFETCH_AT seconds remain
      if (c === PREFETCH_AT && !pendingToken.current) {
        fetchToken().then(t => { pendingToken.current = t; });
      }

      // Swap at 0 — reset counter first so UI + QR change together
      if (c <= 0 && !swappingRef.current) {
        swappingRef.current = true;

        const next = pendingToken.current;
        pendingToken.current = null;

        countRef.current = TOKEN_LIFETIME;
        setCountdown(TOKEN_LIFETIME);
        setIsWarning(false);

        if (next) {
          renderQR(next);
        } else {
          // rare fallback
          fetchToken().then(t => renderQR(t));
        }

        // Pre-fetch the one after that
        fetchToken().then(t => { pendingToken.current = t; });

        swappingRef.current = false;
      }
    }, 1000);
  }, [fetchToken, renderQR]);

  // ── Kick off once lib is ready ─────────────────────────────────────────────
  useEffect(() => {
    if (libLoaded && eventIdRef.current) startCycle();
    return () => clearInterval(intervalRef.current);
  }, [libLoaded, startCycle]);

  // ── SVG ring values ────────────────────────────────────────────────────────
  const R            = 20;
  const circumference = 2 * Math.PI * R;
  const dashOffset   = circumference - (countdown / TOKEN_LIFETIME) * circumference;

  return (
    <div className="qr-code-page">
      <div className="qr-container">

        {/* Page header — NO event ID shown */}
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

            {/* Card title */}
            <div className="card-header">
              <h2>Live Attendance QR</h2>
              <p className="card-subtitle">Refreshes every {TOKEN_LIFETIME} seconds · Do not screenshot</p>
            </div>

            {/* QR white box — content swaps inside without disappearing */}
            <div className="qr-code" ref={qrBoxRef} />

            {/* Countdown strip */}
            <div className="countdown-strip">
              <div className={`c-ring-wrap ${isWarning ? 'is-warning' : ''}`}>
                <svg width="56" height="56" viewBox="0 0 56 56">
                  {/* Track */}
                  <circle
                    cx="28" cy="28" r={R}
                    fill="none"
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth="3.5"
                  />
                  {/* Progress arc */}
                  <circle
                    cx="28" cy="28" r={R}
                    fill="none"
                    stroke={isWarning ? '#f87171' : '#4ade80'}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    transform="rotate(-90 28 28)"
                    style={{ transition: 'stroke-dashoffset 0.98s linear, stroke 0.3s ease' }}
                  />
                </svg>
                {/* Number centred inside ring via absolute positioning */}
                <span className="c-number">{countdown}</span>
              </div>

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
