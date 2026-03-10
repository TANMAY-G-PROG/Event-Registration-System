import { useState, useEffect, useRef, useCallback } from 'react';
import './QrCode.css';

const TOKEN_LIFETIME = 15;
const PREFETCH_AT = 3;

export default function QrCode() {
  const [error, setError] = useState(false);
  const [countdown, setCountdown] = useState(TOKEN_LIFETIME);
  const [isWarning, setIsWarning] = useState(false);
  const [libLoaded, setLibLoaded] = useState(false);

  const qrBoxRef        = useRef(null);
  const qrInstanceRef   = useRef(null);
  const intervalRef     = useRef(null);
  const pendingToken    = useRef(null);
  const eventIdRef      = useRef(null);
  const countRef        = useRef(TOKEN_LIFETIME);
  const swappingRef     = useRef(false);
  const prefetchingRef  = useRef(false); // guard: only one prefetch in-flight

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const eid = new URLSearchParams(window.location.search).get('eventId');
    if (!eid) { setError(true); return; }
    eventIdRef.current = eid;

    if (window.QRCode) { setLibLoaded(true); return; }

    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.async = true;
    s.onload  = () => setLibLoaded(true);
    s.onerror = () => setError(true);
    document.body.appendChild(s);

    return () => clearInterval(intervalRef.current);
  }, []);

  // ── Fetch a fresh token from server ───────────────────────────────────────
  const fetchToken = useCallback(async () => {
    const eid = eventIdRef.current;
    if (!eid) return null;
    try {
      const res = await fetch(`/api/events/${eid}/qr-token`, { credentials: 'include' });
      if (!res.ok) throw new Error('Token fetch failed');
      const { token, timestamp } = await res.json();
      return { token, timestamp: parseInt(timestamp, 10) };
    } catch {
      return null;
    }
  }, []);

  // ── Render QR — destroy + recreate to avoid double-QR bug ─────────────────
  const renderQR = useCallback((tokenData) => {
    const box = qrBoxRef.current;
    if (!box || !window.QRCode || !tokenData) return;

    if (qrInstanceRef.current) {
      try { qrInstanceRef.current.clear(); } catch (_) {}
      qrInstanceRef.current = null;
    }
    box.innerHTML = '';

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

  // ── Start the 1-second tick cycle ─────────────────────────────────────────
  // Strategy: server stamps the token at issue time.
  // We display it and run a simple 15→0 countdown.
  // At 0 we swap to the pre-fetched token (already waiting).
  // We pre-fetch ONLY when count hits PREFETCH_AT, not before.
  const startCycle = useCallback(async () => {
    clearInterval(intervalRef.current);
    swappingRef.current  = false;
    prefetchingRef.current = false;
    pendingToken.current = null;

    // 1. Fetch & show the first QR
    const first = await fetchToken();
    if (!first) { setError(true); return; }
    renderQR(first);

    countRef.current = TOKEN_LIFETIME;
    setCountdown(TOKEN_LIFETIME);
    setIsWarning(false);

    // 2. Tick every second
    intervalRef.current = setInterval(async () => {
      countRef.current -= 1;
      const c = countRef.current;
      setCountdown(c);
      setIsWarning(c <= 4);

      // 3. Pre-fetch next token when PREFETCH_AT seconds remain
      //    Only one pre-fetch allowed at a time
      if (c === PREFETCH_AT && !pendingToken.current && !prefetchingRef.current) {
        prefetchingRef.current = true;
        fetchToken().then(t => {
          pendingToken.current   = t;   // store for swap
          prefetchingRef.current = false;
        });
      }

      // 4. Swap at 0
      if (c <= 0 && !swappingRef.current) {
        swappingRef.current = true;

        const next = pendingToken.current;
        pendingToken.current   = null;
        prefetchingRef.current = false;

        // Reset countdown immediately so UI updates without flicker
        countRef.current = TOKEN_LIFETIME;
        setCountdown(TOKEN_LIFETIME);
        setIsWarning(false);

        if (next) {
          // Happy path — pre-fetched token is ready
          renderQR(next);
        } else {
          // Fallback — fetch synchronously (rare: slow network)
          const fresh = await fetchToken();
          if (fresh) renderQR(fresh);
        }

        swappingRef.current = false;
      }
    }, 1000);
  }, [fetchToken, renderQR]);

  // ── Kick off once lib is ready ─────────────────────────────────────────────
  useEffect(() => {
    if (libLoaded && eventIdRef.current) startCycle();
    return () => clearInterval(intervalRef.current);
  }, [libLoaded, startCycle]);

  // ── SVG ring (kept for CSS compatibility) ─────────────────────────────────
  const R            = 20;
  const circumference = 2 * Math.PI * R;
  const dashOffset   = circumference - (countdown / TOKEN_LIFETIME) * circumference;

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
              <p className="card-subtitle">
                Refreshes every {TOKEN_LIFETIME} seconds · Do not screenshot
              </p>
            </div>

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
