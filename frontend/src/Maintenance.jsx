import { useEffect, useState } from 'react';

export default function Maintenance() {
  const [tick, setTick] = useState(0);
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    const t1 = setInterval(() => setTick(n => n + 1), 1200);
    const t2 = setInterval(() => setBlink(b => !b), 530);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  const dots = ['.', '..', '...'];
  const currentDot = dots[tick % 3];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Space+Grotesk:wght@400;500;700;900&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .maint-root {
          min-height: 100vh;
          background: #f5f0e8;
          background-image:
            radial-gradient(circle, #0a0a0a 1px, transparent 1px);
          background-size: 22px 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Space Grotesk', sans-serif;
          padding: 24px;
          position: relative;
          overflow: hidden;
        }

        /* floating corner tags */
        .corner-tag {
          position: fixed;
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #0a0a0a;
          opacity: 0.35;
          pointer-events: none;
        }
        .corner-tag--tl { top: 18px; left: 18px; }
        .corner-tag--tr { top: 18px; right: 18px; }
        .corner-tag--bl { bottom: 18px; left: 18px; }
        .corner-tag--br { bottom: 18px; right: 18px; }

        /* main card */
        .maint-card {
          background: #f5f0e8;
          border: 3px solid #0a0a0a;
          box-shadow: 8px 8px 0px #0a0a0a;
          max-width: 640px;
          width: 100%;
          position: relative;
        }

        /* top bar stripe */
        .maint-topbar {
          background: #FFE500;
          border-bottom: 3px solid #0a0a0a;
          padding: 10px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .maint-topbar-logo {
          font-family: 'Space Mono', monospace;
          font-size: 15px;
          font-weight: 700;
          color: #0a0a0a;
          letter-spacing: -0.02em;
        }
        .maint-topbar-status {
          display: flex;
          align-items: center;
          gap: 7px;
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #0a0a0a;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #0a0a0a;
          border: 2px solid #0a0a0a;
          flex-shrink: 0;
          transition: opacity 0.1s;
        }

        /* body */
        .maint-body {
          padding: 40px 36px 36px;
        }

        /* big label */
        .maint-label {
          display: inline-block;
          background: #0a0a0a;
          color: #FFE500;
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          padding: 5px 10px;
          margin-bottom: 20px;
        }

        /* heading */
        .maint-heading {
          font-family: 'Space Mono', monospace;
          font-size: clamp(32px, 7vw, 52px);
          font-weight: 700;
          line-height: 1.05;
          color: #0a0a0a;
          letter-spacing: -0.03em;
          margin-bottom: 6px;
        }
        .maint-heading span {
          color: #0047FF;
        }

        .maint-sub {
          font-size: 14px;
          color: #0a0a0a;
          opacity: 0.55;
          font-family: 'Space Mono', monospace;
          letter-spacing: 0.05em;
          margin-bottom: 32px;
        }

        /* progress bar */
        .maint-progress-wrap {
          border: 2.5px solid #0a0a0a;
          height: 28px;
          background: #fff;
          margin-bottom: 10px;
          position: relative;
          overflow: hidden;
        }
        .maint-progress-fill {
          height: 100%;
          background: repeating-linear-gradient(
            -45deg,
            #FFE500,
            #FFE500 10px,
            #0a0a0a 10px,
            #0a0a0a 20px
          );
          width: 68%;
          position: relative;
          animation: progress-pulse 2s ease-in-out infinite alternate;
        }
        @keyframes progress-pulse {
          from { width: 65%; }
          to   { width: 72%; }
        }
        .maint-progress-label {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          font-family: 'Space Mono', monospace;
          font-size: 11px;
          font-weight: 700;
          color: #0a0a0a;
        }

        .maint-progress-caption {
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #0a0a0a;
          opacity: 0.45;
          margin-bottom: 32px;
        }

        /* divider */
        .maint-divider {
          border: none;
          border-top: 2px solid #0a0a0a;
          margin-bottom: 28px;
          opacity: 0.15;
        }

        /* info grid */
        .maint-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 28px;
        }
        @media (max-width: 480px) {
          .maint-grid { grid-template-columns: 1fr; }
          .maint-body { padding: 28px 20px 24px; }
        }

        .maint-info-box {
          border: 2.5px solid #0a0a0a;
          padding: 14px 16px;
          background: #fff;
          box-shadow: 3px 3px 0 #0a0a0a;
        }
        .maint-info-box-label {
          font-family: 'Space Mono', monospace;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #0a0a0a;
          opacity: 0.5;
          margin-bottom: 5px;
        }
        .maint-info-box-val {
          font-family: 'Space Mono', monospace;
          font-size: 13px;
          font-weight: 700;
          color: #0a0a0a;
        }
        .maint-info-box--yellow {
          background: #FFE500;
        }

        /* footer row */
        .maint-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }

        .maint-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #0a0a0a;
          color: #FFE500;
          border: 2.5px solid #0a0a0a;
          box-shadow: 4px 4px 0 #555;
          font-family: 'Space Mono', monospace;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 10px 20px;
          cursor: pointer;
          text-decoration: none;
          transition: transform 0.08s, box-shadow 0.08s;
          user-select: none;
        }
        .maint-back-btn:hover {
          transform: translate(2px, 2px);
          box-shadow: 2px 2px 0 #555;
        }
        .maint-back-btn:active {
          transform: translate(4px, 4px);
          box-shadow: 0 0 0 #555;
        }

        .maint-footnote {
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          color: #0a0a0a;
          opacity: 0.4;
          letter-spacing: 0.05em;
        }

        /* wrench icon animation */
        .maint-icon-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }
        .maint-icon {
          font-size: 36px;
          display: inline-block;
          animation: wrench-rock 1.8s ease-in-out infinite;
          transform-origin: bottom left;
        }
        @keyframes wrench-rock {
          0%, 100% { transform: rotate(-12deg); }
          50%       { transform: rotate(12deg); }
        }
      `}</style>

      {/* corner watermarks */}
      <span className="corner-tag corner-tag--tl">FLO / SYS</span>
      <span className="corner-tag corner-tag--tr">STATUS: 503</span>
      <span className="corner-tag corner-tag--bl">© 2025 FLO</span>
      <span className="corner-tag corner-tag--br">DO NOT PANIC</span>

      <div className="maint-root">
        <div className="maint-card">

          {/* top yellow bar */}
          <div className="maint-topbar">
            <span className="maint-topbar-logo">FLO●</span>
            <span className="maint-topbar-status">
              <span
                className="status-dot"
                style={{ opacity: blink ? 1 : 0.2 }}
              />
              MAINTENANCE MODE
            </span>
          </div>

          <div className="maint-body">
            <div className="maint-icon-wrap">
              <span className="maint-icon">🔧</span>
            </div>

            <div className="maint-label">System Notice</div>

            <h1 className="maint-heading">
              Under<br />
              <span>Maintenance</span>
            </h1>

            <p className="maint-sub">
              System update in progress{currentDot}
            </p>

            {/* progress bar */}
            <div className="maint-progress-wrap">
              <div className="maint-progress-fill" />
              <span className="maint-progress-label">68%</span>
            </div>
            <p className="maint-progress-caption">Deployment pipeline running</p>

            <hr className="maint-divider" />

            <div className="maint-grid">
              <div className="maint-info-box maint-info-box--yellow">
                <div className="maint-info-box-label">Estimated time</div>
                <div className="maint-info-box-val">~3 hours</div>
              </div>
              
            </div>

            <div className="maint-footer">
              <span className="maint-footnote">
                Thanks for your patience
              </span>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}