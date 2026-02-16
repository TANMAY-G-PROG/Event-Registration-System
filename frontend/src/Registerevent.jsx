"use client"
import { useEffect, useMemo, useState, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import QRCode from "qrcode"
import "./registerevent.css"
import TicketAnimation from './TicketAnimation';

// ============================================================================
// CONSTANTS
// ============================================================================

const FALLBACK_BANNER = "https://ik.imagekit.io/flopass/Aura.png";

const SLIDER_CONSTANTS = {
  DRAG_RESISTANCE: 0.4,
  SWIPE_THRESHOLD_PERCENT: 0.08,
  VELOCITY_THRESHOLD: 0.3,
  WHEEL_RESISTANCE: 0.3,
  WHEEL_SCROLL_THRESHOLD: 120,
  WHEEL_RESET_DELAY: 150,
  MOMENTUM_EASING: 0.1,
  ANIMATION_TIMEOUT: 800,
};

const DEFAULT_COLORS = ["#1a1a2e", "#16213e", "#0f3460"];

// Card dimensions — these MUST match the CSS values exactly.
// Width: .re-gallery-image-container width. Gap: .re-gallery-track gap (3rem = 48px).
// On mobile (<768px): width=320, gap=48. Desktop: width=480, gap=48.
// We also measure from the DOM at runtime to be safe — see useSnapPoints().
const CARD_WIDTH_DESKTOP = 480;
const CARD_WIDTH_MOBILE = 320;
const CARD_GAP_DESKTOP = 48;
const CARD_GAP_MOBILE = 48; // 3rem matches CSS — was wrongly 24 before

// Smart dots: max visible dots at a time
const MAX_VISIBLE_DOTS = 7;

// ============================================================================
// HELPERS
// ============================================================================

function formatTime12h(timeString) {
  if (!timeString) return "Time TBA"
  const [hours, minutes] = String(timeString).split(":")
  const hour24 = Number.parseInt(hours, 10)
  if (Number.isNaN(hour24)) return "Time TBA"
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24
  const ampm = hour24 >= 12 ? "PM" : "AM"
  return `${hour12}:${minutes} ${ampm}`
}

function resolveBanner(event) {
  return event?.bannerUrl || FALLBACK_BANNER;
}

// ============================================================================
// COLOR EXTRACTION
// ============================================================================

async function extractColors(imageUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(DEFAULT_COLORS); return; }

      const sampleSize = 50;
      canvas.width = sampleSize;
      canvas.height = sampleSize;
      ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

      try {
        const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
        const pixels = imageData.data;
        const colorMap = new Map();

        for (let i = 0; i < pixels.length; i += 4) {
          const r = Math.min(255, Math.round(pixels[i] / 32) * 32);
          const g = Math.min(255, Math.round(pixels[i + 1] / 32) * 32);
          const b = Math.min(255, Math.round(pixels[i + 2] / 32) * 32);
          const brightness = (r + g + b) / 3;
          if (brightness < 20 || brightness > 240) continue;
          const key = `${r},${g},${b}`;
          const existing = colorMap.get(key);
          if (existing) { existing.count++; } else { colorMap.set(key, { count: 1, r, g, b }); }
        }

        const sortedColors = Array.from(colorMap.values()).sort((a, b) => b.count - a.count).slice(0, 10);
        const distinctColors = [];

        for (const color of sortedColors) {
          const hex = rgbToHex(color.r, color.g, color.b);
          const isDistinct = distinctColors.every((existing) => {
            const existingRgb = hexToRgb(existing);
            if (!existingRgb) return true;
            const distance = Math.sqrt(
              Math.pow(color.r - existingRgb.r, 2) +
              Math.pow(color.g - existingRgb.g, 2) +
              Math.pow(color.b - existingRgb.b, 2)
            );
            return distance > 40;
          });
          if (isDistinct && distinctColors.length < 3) { distinctColors.push(hex); }
        }

        if (distinctColors.length === 0 && sortedColors.length > 0) {
          const topColor = sortedColors[0];
          distinctColors.push(rgbToHex(Math.max(0, topColor.r - 60), Math.max(0, topColor.g - 60), Math.max(0, topColor.b - 60)));
        }

        while (distinctColors.length < 3) {
          const baseColor = hexToRgb(distinctColors[0] || "#1a1a2e");
          if (baseColor) {
            const shift = distinctColors.length === 1 ? -40 : 40;
            distinctColors.push(rgbToHex(
              Math.min(255, Math.max(0, baseColor.r + shift)),
              Math.min(255, Math.max(0, baseColor.g + shift)),
              Math.min(255, Math.max(0, baseColor.b + shift))
            ));
          } else { distinctColors.push("#1a1a2e"); }
        }

        resolve(distinctColors);
      } catch (e) { resolve(DEFAULT_COLORS); }
    };

    img.onerror = () => { resolve(DEFAULT_COLORS); };
    img.src = imageUrl;
  });
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(x => { const hex = x.toString(16); return hex.length === 1 ? "0" + hex : hex; }).join("");
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

// ============================================================================
// HOOKS
// ============================================================================

function useSliderNavigation({ totalSlides, enableKeyboard = true }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToNext = useCallback(() => { setCurrentIndex(prev => Math.min(prev + 1, totalSlides - 1)); }, [totalSlides]);
  const goToPrev = useCallback(() => { setCurrentIndex(prev => Math.max(prev - 1, 0)); }, []);
  const goToSlide = useCallback((index) => { setCurrentIndex(Math.max(0, Math.min(index, totalSlides - 1))); }, [totalSlides]);

  useEffect(() => {
    if (!enableKeyboard || totalSlides === 0) return;
    const handleKeyDown = (e) => {
      switch (e.key) {
        case "ArrowRight": case "d": case "D": goToNext(); break;
        case "ArrowLeft": case "a": case "A": goToPrev(); break;
        case "Home": setCurrentIndex(0); break;
        case "End": setCurrentIndex(totalSlides - 1); break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableKeyboard, goToNext, goToPrev, totalSlides]);

  return { currentIndex, setCurrentIndex, goToNext, goToPrev, goToSlide };
}

// ============================================================================
// PERFORMANT DRAG HOOK
// All drag tracking is done via refs — zero React re-renders during drag.
// The track DOM element is updated directly via requestAnimationFrame.
// ============================================================================

function useSliderDrag({ trackRef, currentIndex, snapPoints, cardWidth, cardGap, onSwipeLeft, onSwipeRight }) {
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const dragXRef = useRef(0);
  const velocityRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const directionLockedRef = useRef(null); // 'x' | 'y' | null
  const rafRef = useRef(null);
  // Expose dragging state for cursor CSS only (not for re-rendering transforms)
  const [isDragging, setIsDragging] = useState(false);

  const applyTransform = useCallback((dragOffset, animated) => {
    const el = trackRef.current;
    if (!el) return;
    // Use the pre-measured snap point for this index — pixel-perfect, no accumulation error
    const base = snapPoints[currentIndex] ?? 0;
    el.style.transition = animated
      ? 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      : 'none';
    // Include translateZ(0) to keep the track on the GPU compositor layer on iOS Safari
    el.style.transform = `translateX(${base + dragOffset}px) translateZ(0)`;
  }, [trackRef, currentIndex, snapPoints]);

  const handleDragStart = useCallback((e) => {
    if (e.touches && e.touches.length > 1) return; // ignore pinch
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startXRef.current = clientX;
    startYRef.current = clientY;
    dragXRef.current = 0;
    lastXRef.current = clientX;
    lastTimeRef.current = Date.now();
    velocityRef.current = 0;
    directionLockedRef.current = null;
    isDraggingRef.current = true;
    setIsDragging(true);
    // Kill any ongoing transition immediately
    applyTransform(0, false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, [applyTransform]);

  const handleDragMove = useCallback((e) => {
    if (!isDraggingRef.current) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    // Determine axis lock on first 8px of movement
    if (directionLockedRef.current === null) {
      const dx = Math.abs(clientX - startXRef.current);
      const dy = Math.abs(clientY - startYRef.current);
      if (dx > 8 || dy > 8) {
        directionLockedRef.current = dx > dy ? 'x' : 'y';
      }
      return; // wait until locked before moving anything
    }

    // Vertical gesture — let browser handle it, cancel our drag
    if (directionLockedRef.current === 'y') {
      isDraggingRef.current = false;
      setIsDragging(false);
      applyTransform(0, true);
      return;
    }

    // Horizontal drag — update via rAF (not setState)
    const now = Date.now();
    const dt = now - lastTimeRef.current;
    const rawDelta = clientX - startXRef.current;
    // Apply rubber-band resistance beyond ±150px
    const maxPull = 150;
    const sign = rawDelta > 0 ? 1 : -1;
    const abs = Math.abs(rawDelta);
    const resisted = abs > maxPull
      ? maxPull + (abs - maxPull) * 0.15
      : abs;
    const resistedDragX = sign * resisted;

    if (dt > 0) velocityRef.current = (clientX - lastXRef.current) / dt;
    lastXRef.current = clientX;
    lastTimeRef.current = now;
    dragXRef.current = resistedDragX;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      applyTransform(dragXRef.current, false);
    });
  }, [applyTransform]);

  const handleDragEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const dragX = dragXRef.current;
    const velocity = velocityRef.current;
    const threshold = window.innerWidth * SLIDER_CONSTANTS.SWIPE_THRESHOLD_PERCENT;

    dragXRef.current = 0;

    const didSwipe =
      dragX < -threshold || velocity < -SLIDER_CONSTANTS.VELOCITY_THRESHOLD ||
      dragX > threshold  || velocity > SLIDER_CONSTANTS.VELOCITY_THRESHOLD;

    if (dragX < -threshold || velocity < -SLIDER_CONSTANTS.VELOCITY_THRESHOLD) onSwipeLeft();
    else if (dragX > threshold || velocity > SLIDER_CONSTANTS.VELOCITY_THRESHOLD) onSwipeRight();

    // If we swiped, the useEffect in the parent will reposition the track to the
    // new currentIndex — don't call applyTransform here or we get a double-snap.
    // If we did NOT swipe, snap back to current position ourselves.
    if (!didSwipe) {
      applyTransform(0, true);
    }
  }, [onSwipeLeft, onSwipeRight, applyTransform]);

  return { isDragging, handleDragStart, handleDragMove, handleDragEnd };
}

function useSliderWheel({ sliderRef, onScrollLeft, onScrollRight, enabled }) {
  const wheelAccumulatorRef = useRef(0);
  const wheelTimeoutRef = useRef();

  useEffect(() => {
    if (!enabled) return;
    const slider = sliderRef.current;
    if (!slider) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const resistedDelta = delta * SLIDER_CONSTANTS.WHEEL_RESISTANCE;
      wheelAccumulatorRef.current += resistedDelta;
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
      if (Math.abs(wheelAccumulatorRef.current) >= SLIDER_CONSTANTS.WHEEL_SCROLL_THRESHOLD) {
        if (wheelAccumulatorRef.current > 0) onScrollLeft();
        else onScrollRight();
        wheelAccumulatorRef.current = 0;
      }
      wheelTimeoutRef.current = setTimeout(() => { wheelAccumulatorRef.current = 0; }, SLIDER_CONSTANTS.WHEEL_RESET_DELAY);
    };

    slider.addEventListener("wheel", handleWheel, { passive: false });
    return () => { slider.removeEventListener("wheel", handleWheel); if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current); };
  }, [sliderRef, onScrollLeft, onScrollRight, enabled]);
}

function useColorExtraction(events) {
  const [colors, setColors] = useState({});
  useEffect(() => {
    events.forEach(event => {
      const banner = resolveBanner(event);
      extractColors(banner).then(extractedColors => {
        setColors(prev => ({ ...prev, [event.eid]: extractedColors }));
      });
    });
  }, [events]);
  return colors;
}

// Computes the exact translateX needed to centre each card in the viewport.
// Works by reading each card's actual DOM position — no accumulated math, no padding offsets.
function useSnapPoints(trackRef, cardCount) {
  const [snapPoints, setSnapPoints] = useState([]);
  // Also expose cardWidth/cardGap for the drag threshold calculation
  const [cardWidth, setCardWidth] = useState(CARD_WIDTH_MOBILE);
  const [cardGap, setCardGap] = useState(CARD_GAP_MOBILE);

  useEffect(() => {
    function measure() {
      const track = trackRef.current;
      if (!track) return;
      const cards = Array.from(track.querySelectorAll('.re-gallery-card'));
      if (cards.length === 0) return;

      // Reset transform so we measure natural positions
      const prevTransition = track.style.transition;
      const prevTransform = track.style.transform;
      track.style.transition = 'none';
      track.style.transform = 'none';

      // Force reflow so the DOM positions are updated
      track.getBoundingClientRect();

      const viewportCentreX = window.innerWidth / 2;
      const points = cards.map(card => {
        const rect = card.getBoundingClientRect();
        const cardCentreX = rect.left + rect.width / 2;
        // translateX needed to move this card's centre to viewport centre
        return viewportCentreX - cardCentreX;
      });

      setSnapPoints(points);

      // Also capture card metrics for drag threshold
      if (cards.length >= 1) setCardWidth(cards[0].getBoundingClientRect().width);
      if (cards.length >= 2) {
        const r0 = cards[0].getBoundingClientRect();
        const r1 = cards[1].getBoundingClientRect();
        setCardGap(r1.left - r0.right);
      }

      // Restore transform
      track.style.transition = prevTransition;
      track.style.transform = prevTransform;
    }

    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  // Re-measure whenever card count changes (filter change etc.)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackRef, cardCount]);

  return { snapPoints, cardWidth, cardGap };
}

// ============================================================================
// GALLERY COMPONENTS
// ============================================================================

// --- Smart Navigation Dots (shows max 7 at a time, slides as you navigate) ---
function NavigationDots({ total, current, onSelect, colors }) {
  if (total <= 1) return null;

  // For small counts, show all. For large, show a sliding window
  const showAll = total <= MAX_VISIBLE_DOTS;

  let visibleDots = [];
  if (showAll) {
    visibleDots = Array.from({ length: total }, (_, i) => i);
  } else {
    // sliding window: keep current near center
    const half = Math.floor(MAX_VISIBLE_DOTS / 2);
    let start = Math.max(0, current - half);
    let end = start + MAX_VISIBLE_DOTS - 1;
    if (end >= total) {
      end = total - 1;
      start = Math.max(0, end - MAX_VISIBLE_DOTS + 1);
    }
    visibleDots = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  const showLeftEllipsis = !showAll && visibleDots[0] > 0;
  const showRightEllipsis = !showAll && visibleDots[visibleDots.length - 1] < total - 1;

  return (
    <div className="re-gallery-dots">
      {showLeftEllipsis && (
        <button className="re-gallery-dot re-gallery-dot-ellipsis" onClick={() => onSelect(0)} title="Go to first" />
      )}
      {visibleDots.map((index) => (
        <button
          key={index}
          onClick={() => onSelect(index)}
          className={`re-gallery-dot ${index === current ? 'active' : ''}`}
          style={{
            backgroundColor: index === current ? (colors[0] || '#ffffff') : 'rgba(255,255,255,0.25)',
            width: index === current ? '28px' : '8px'
          }}
          aria-label={`Go to event ${index + 1}`}
        />
      ))}
      {showRightEllipsis && (
        <button className="re-gallery-dot re-gallery-dot-ellipsis" onClick={() => onSelect(total - 1)} title="Go to last" />
      )}
    </div>
  );
}

// --- Jump-to Counter (replaces static counter, lets user type a number to jump) ---
function JumpCounter({ current, total, onJump }) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef(null);

  const handleActivate = () => {
    setEditing(true);
    setInputVal("");
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleCommit = () => {
    const num = parseInt(inputVal, 10);
    if (!isNaN(num) && num >= 1 && num <= total) {
      onJump(num - 1);
    }
    setEditing(false);
    setInputVal("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleCommit();
    if (e.key === "Escape") { setEditing(false); setInputVal(""); }
    e.stopPropagation(); // don't let slider steal arrow keys
  };

  return (
    <div
      className={`re-gallery-counter ${editing ? 'editing' : ''}`}
      onClick={!editing ? handleActivate : undefined}
      title={editing ? "" : "Click to jump to event"}
    >
      {editing ? (
        <>
          <input
            ref={inputRef}
            className="re-counter-input"
            type="number"
            min={1}
            max={total}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={handleKeyDown}
            placeholder={String(current + 1)}
            autoFocus
          />
          <span className="divider">/</span>
          <span>{String(total).padStart(2, "0")}</span>
        </>
      ) : (
        <>
          <span>{String(current + 1).padStart(2, "0")}</span>
          <span className="divider">/</span>
          <span>{String(total).padStart(2, "0")}</span>
        </>
      )}
    </div>
  );
}

// --- Search Bar (compact, inline in filter strip) ---
function SearchBar({ events, onSelect, currentIndex }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return events
      .map((e, i) => ({ event: e, index: i }))
      .filter(({ event }) =>
        event.ename?.toLowerCase().includes(q) ||
        event.eventLoc?.toLowerCase().includes(q) ||
        event.organizerName?.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [query, events]);

  const handleSelect = (index) => {
    onSelect(index);
    setQuery("");
    setFocused(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") { setQuery(""); setFocused(false); inputRef.current?.blur(); }
    e.stopPropagation();
  };

  return (
    <div ref={containerRef} className={`re-search-wrap ${focused ? 'expanded' : ''}`}>
      <button
        className="re-search-icon-btn"
        onClick={() => { setFocused(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        tabIndex={focused ? -1 : 0}
        aria-label="Search events"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
      </button>
      <input
        ref={inputRef}
        className="re-search-inline-input"
        placeholder="Search…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => { setFocused(false); setQuery(""); }, 160)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        tabIndex={focused ? 0 : -1}
      />
      {query && focused && (
        <button className="re-search-clear-inline" onMouseDown={e => { e.preventDefault(); setQuery(""); }}>×</button>
      )}

      {/* Dropdown */}
      {focused && results.length > 0 && (
        <div className="re-search-dropdown">
          {results.map(({ event, index }) => (
            <button
              key={event.eid}
              className={`re-search-result ${index === currentIndex ? 'current' : ''}`}
              onMouseDown={e => { e.preventDefault(); handleSelect(index); }}
            >
              <div className="re-search-result-img">
                <img src={resolveBanner(event)} alt={event.ename} />
              </div>
              <div className="re-search-result-info">
                <span className="re-search-result-name">{event.ename}</span>
                <span className="re-search-result-meta">
                  {event.eventLoc} · <span className={`re-search-badge ${event.status}`}>{event.status}</span>
                </span>
              </div>
              <span className="re-search-result-num">#{index + 1}</span>
            </button>
          ))}
        </div>
      )}

      {focused && query && results.length === 0 && (
        <div className="re-search-dropdown">
          <div className="re-search-no-result">No matches for "{query}"</div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// BENTO GRID
// ============================================================================

function BentoGridCard({ event, onOpen, renderControls }) {
  return (
    <div
      className="re-bento-card"
      onClick={() => onOpen(event)}
    >
      {/* Background image */}
      <div className="re-bento-img">
        <img src={resolveBanner(event)} alt={event.ename} loading="lazy" />
      </div>

      {/* Always-on dark scrim */}
      <div className="re-bento-scrim" />

      {/* Badges top row */}
      <div className="re-bento-top">
        <span className={`re-bento-status ${event.status}`}>{event.status}</span>
        {event.is_team && <span className="re-bento-team-badge">Team</span>}
        {event.regFee > 0
          ? <span className="re-bento-fee">₹{event.regFee}</span>
          : <span className="re-bento-free">Free</span>
        }
      </div>

      {/* Info bottom */}
      <div className="re-bento-bottom">
        <p className="re-bento-date">
          {new Date(event.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          {' · '}{formatTime12h(event.eventTime)}
        </p>
        <h3 className="re-bento-name">{event.ename}</h3>
        <p className="re-bento-loc">📍 {event.eventLoc}</p>

        {/* Action buttons — always visible */}
        <div className="re-bento-actions" onClick={e => e.stopPropagation()}>
          {renderControls(event, false)}
          <button className="re-bento-detail-btn" onClick={(e) => { e.stopPropagation(); onOpen(event); }}>
            Details ↗
          </button>
        </div>
      </div>
    </div>
  );
}

function BentoGrid({ events, onOpen, renderControls }) {
  return (
    <div className="re-bento-grid-container">
      <div className="re-bento-grid">
        {events.map(event => (
          <BentoGridCard
            key={event.eid}
            event={event}
            onOpen={onOpen}
            renderControls={renderControls}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// EVENT GALLERY CARD
// ============================================================================

function EventGalleryCard({ event, isActive, index, currentIndex, onOpen, renderControls }) {
  const distance = index - currentIndex;
  const scale = isActive ? 1 : 0.84;
  const opacity = isActive ? 1 : Math.max(0.3, 1 - Math.abs(distance) * 0.25);

  return (
    <div
      className={`re-gallery-card ${isActive ? 'active' : ''}`}
      style={{
        // translateZ(0) keeps each card on the compositor — critical for iOS Safari smooth scale
        transform: `scale(${scale}) translateZ(0)`,
        opacity,
        WebkitTransform: `scale(${scale}) translateZ(0)`,
      }}
    >
      <div className="re-gallery-card-frame">
        <div className="re-gallery-image-container">
          <img
            src={resolveBanner(event)}
            alt={event.ename}
            style={{ transform: 'scale(1)' }}
            crossOrigin="anonymous"
            draggable={false}
            loading="lazy"
          />

          {/* Status badge */}
          <div className={`re-gallery-status-badge ${event.status}`}>{event.status}</div>
          {event.is_team && <div className="re-gallery-team-badge">Team</div>}

          {/* Gradient overlay */}
          <div className="re-gallery-gradient" style={{
            opacity: isActive ? 1 : 0.4,
            height: isActive ? '75%' : '40%'
          }} />

          {/* Info overlay — always visible on active card */}
          {isActive && (
            <div className="re-gallery-info">
              <p className="re-gallery-year">
                {new Date(event.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                {' · '}{formatTime12h(event.eventTime)}
              </p>
              <h2 className="re-gallery-title">
                {event.ename}
              </h2>
              <p className="re-gallery-artist">
                📍 {event.eventLoc}
                {event.regFee > 0 ? <span className="re-gallery-fee"> · ₹{event.regFee}</span> : <span className="re-gallery-free"> · Free</span>}
              </p>

              {/* Action buttons — always visible */}
              <div className="re-gallery-card-actions">
                {renderControls(event, false)}
                <button className="re-gallery-details-btn" onClick={(e) => { e.stopPropagation(); onOpen(event); }}>
                  Details ↗
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click to open on non-active */}
      {!isActive && (
        <div className="re-gallery-click-hint" onClick={() => onOpen(event)}>
          <span>{event.ename}</span>
        </div>
      )}

      <div className="re-gallery-reflection" style={{ opacity: isActive ? 0.12 : 0.04 }} />
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Registerevent() {
  const navigate = useNavigate()

  // Data States
  const [eventsData, setEventsData] = useState({ upcoming: [], ongoing: [], completed: [] })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")
  const [viewMode, setViewMode] = useState("gallery") // "gallery" | "grid"
  const [teamStates, setTeamStates] = useState({})
  const [registeredEvents, setRegisteredEvents] = useState(new Set())

  // UI States
  const [flash, setFlash] = useState({ type: "", message: "" })
  const [modalFlash, setModalFlash] = useState({ type: "", message: "" })
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [ticketInfo, setTicketInfo] = useState(null);

  // Modals
  const [showTeamModal, setShowTeamModal] = useState(null)
  const [teamFormData, setTeamFormData] = useState({ teamName: '', memberUSNs: [''] })
  const [teamInvites, setTeamInvites] = useState([])
  const [showUpiModal, setShowUpiModal] = useState(null)
  const [transactionId, setTransactionId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("")

  const timerRef = useRef(null)
  const modalTimerRef = useRef(null)
  const sliderRef = useRef(null)

  // --- Helpers ---
  function showFlash(type, message) {
    if (timerRef.current) clearTimeout(timerRef.current)
    setFlash({ type, message })
    timerRef.current = setTimeout(() => setFlash({ type: "", message: "" }), 4000)
  }

  function showModalFlash(type, message) {
    if (modalTimerRef.current) clearTimeout(modalTimerRef.current)
    setModalFlash({ type, message })
    modalTimerRef.current = setTimeout(() => setModalFlash({ type: "", message: "" }), 4000)
  }

  function generateUpiUrl(upiId, eventName, amount, eventId) {
    const params = new URLSearchParams({ pa: upiId, pn: eventName, am: amount.toString(), cu: "INR", tn: `Event Registration - ${eventId}` })
    return `upi://pay?${params.toString()}`
  }

  // --- Loaders ---
  const loadEvents = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/events', { method: "GET", credentials: "include" })
      if (response.status === 401) { navigate('/'); return }
      if (!response.ok) throw new Error("Failed")
      const data = await response.json()
      setEventsData({ upcoming: data?.events?.upcoming || [], ongoing: data?.events?.ongoing || [], completed: data?.events?.completed || [] })
    } catch (err) { showFlash("error", "Failed to load events") }
    finally { setLoading(false) }
  }, [navigate]);

  const fetchMyRegistrations = useCallback(async () => {
    try {
      const res = await fetch('/api/my-participant-events', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setRegisteredEvents(new Set(data.participantEvents.map(ev => ev.eid)))
      }
    } catch (err) { console.error(err) }
  }, []);

  const loadTeamStatus = useCallback(async (eventId) => {
    try {
      const response = await fetch(`/api/events/${eventId}/team-status`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        // Store the real data object (truthy = event exists and is valid)
        setTeamStates(prev => ({ ...prev, [eventId]: data }))
      } else {
        // Non-OK (404, etc.) = event deleted from DB. Store null as sentinel:
        // null means "fetch done, event not found". undefined means "not fetched yet".
        setTeamStates(prev => ({ ...prev, [eventId]: null }))
      }
    } catch (err) {
      console.error(err)
      // On network error, don't hide the event — leave as undefined so it stays visible
    }
  }, []);

  useEffect(() => { loadEvents(); fetchMyRegistrations(); }, [loadEvents, fetchMyRegistrations])

  useEffect(() => {
    const activeEvents = [...(eventsData.upcoming || []), ...(eventsData.ongoing || [])];
    if (activeEvents.length > 0) activeEvents.forEach(event => { loadTeamStatus(event.eid) })
  }, [eventsData, loadTeamStatus])

  useEffect(() => {
    const shouldLock = selectedEvent || showTeamModal || showUpiModal;
    const wrapper = document.querySelector('.registerevent-page');
    if (wrapper) wrapper.style.overflowY = shouldLock ? 'hidden' : 'auto';
  }, [selectedEvent, showTeamModal, showUpiModal]);

  // All events flat (for counts)
  const allEvents = useMemo(() => [
    ...(eventsData.upcoming || []).map(e => ({ ...e, status: "upcoming" })),
    ...(eventsData.ongoing || []).map(e => ({ ...e, status: "ongoing" })),
    ...(eventsData.completed || []).map(e => ({ ...e, status: "completed" })),
  ], [eventsData]);

  // Counts per status
  const statusCounts = useMemo(() => ({
    all: allEvents.length,
    upcoming: allEvents.filter(e => e.status === "upcoming").length,
    ongoing: allEvents.filter(e => e.status === "ongoing").length,
    completed: allEvents.filter(e => e.status === "completed").length,
  }), [allEvents]);

  const filteredEvents = useMemo(() => {
    const base = filter === "all" ? allEvents : allEvents.filter(e => e.status === filter)
    return base.filter(e => {
      // Completed events don't go through team-status — always show them
      if (e.status === 'completed') return true
      // null = fetch completed but event not found in DB (was deleted) → hide it
      // undefined = fetch not yet started/completed → still show (Loading... state)
      // object = fetch completed and event exists → show it
      if (teamStates[e.eid] === null) return false
      return true
    })
  }, [allEvents, filter, teamStates])

  useEffect(() => {
    if (showUpiModal) {
      const { event } = showUpiModal
      const upiUrl = generateUpiUrl(event.upiId, event.ename, event.regFee, event.eid)
      QRCode.toDataURL(upiUrl, { width: 280, margin: 2, color: { dark: '#000000', light: '#ffffff' } }).then(setQrCodeDataUrl)
    } else { setQrCodeDataUrl("") }
  }, [showUpiModal])

  // ==================== GALLERY SLIDER ====================
  const { currentIndex, goToNext, goToPrev, goToSlide } = useSliderNavigation({
    totalSlides: filteredEvents.length,
    enableKeyboard: !selectedEvent && !showTeamModal && !showUpiModal && viewMode === "gallery",
  });

  const trackRef = useRef(null);
  // Measure exact snap position for each card directly from the DOM
  const { snapPoints, cardWidth, cardGap } = useSnapPoints(trackRef, filteredEvents.length);

  const { isDragging, handleDragStart, handleDragMove, handleDragEnd } = useSliderDrag({
    trackRef,
    currentIndex,
    snapPoints,
    cardWidth,
    cardGap,
    onSwipeLeft: goToNext,
    onSwipeRight: goToPrev,
  });

  // Snap to current card whenever index or snap points change
  useEffect(() => {
    const el = trackRef.current;
    if (!el || snapPoints.length === 0) return;
    const base = snapPoints[currentIndex] ?? 0;
    el.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    el.style.transform = `translateX(${base}px) translateZ(0)`;
  }, [currentIndex, snapPoints]);

  useSliderWheel({
    sliderRef,
    onScrollLeft: goToNext,
    onScrollRight: goToPrev,
    enabled: !selectedEvent && !showTeamModal && !showUpiModal && viewMode === "gallery",
  });

  const colorMap = useColorExtraction(filteredEvents);
  const currentColors = colorMap[filteredEvents[currentIndex]?.eid] || DEFAULT_COLORS;

  // ==================== ACTION HANDLERS ====================

  async function handleRegister(event) {
    const hasFee = (event.regFee || 0) > 0; const eventId = event.eid
    if (hasFee) {
      if (!event.upiId) { showFlash("error", "Payment not setup."); return }
      setTransactionId(""); setModalFlash({ type: "", message: "" }); setShowUpiModal({ event, isTeam: false }); return
    }
    try {
      const response = await fetch(`/api/events/${eventId}/join`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } })
      const data = await response.json()
      if (!response.ok) { showFlash("error", data.error || "Failed"); return }
      showFlash("success", "Registered successfully!")
      setRegisteredEvents(prev => new Set(prev).add(eventId))
      setTicketInfo({ eventName: event.ename, eventDate: event.eventDate, userUSN: data.userUSN || "AUTHORIZED" })
      await loadEvents()
    } catch (err) { showFlash("error", "Network error") }
  }

  async function handleCreateTeam(eventId) {
    try {
      const { teamName, memberUSNs } = teamFormData
      if (!teamName.trim()) { showModalFlash('error', 'Team name required'); return }
      const validUSNs = memberUSNs.filter(usn => usn.trim() !== '')
      const response = await fetch(`/api/events/${eventId}/create-team`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName: teamName.trim(), memberUSNs: validUSNs })
      })
      const data = await response.json()
      if (!response.ok) { showModalFlash('error', data.error); return }
      showModalFlash('success', 'Team created!'); showFlash('success', 'Team created!')
      setTimeout(() => { setShowTeamModal(null); setTeamFormData({ teamName: '', memberUSNs: [''] }); loadTeamStatus(eventId) }, 1500)
    } catch (err) { showModalFlash('error', 'Error creating team') }
  }

  async function handleViewInvites(eventId) {
    try {
      const response = await fetch(`/api/events/${eventId}/my-invites`, { credentials: 'include' })
      const data = await response.json()
      if (!response.ok) { showFlash('error', data.error); return }
      if (!data.invites?.length) { showFlash('error', 'No pending invites'); setTeamInvites([]) }
      else { setTeamInvites(data.invites); setShowTeamModal({ eventId, mode: 'invites' }) }
    } catch (err) { showFlash('error', 'Error loading invites') }
  }

  async function handleConfirmJoin(teamId, eventId) {
    try {
      const response = await fetch(`/api/teams/${teamId}/confirm-join`, { method: 'POST', credentials: 'include' })
      if (!response.ok) { showModalFlash('error', 'Failed to join'); return }
      showModalFlash('success', 'Joined team!');
      setTimeout(() => { setShowTeamModal(null); setTeamInvites([]); loadTeamStatus(eventId) }, 1500)
    } catch (err) { showModalFlash('error', 'Error') }
  }

  async function handleRegisterTeam(event, teamState) {
    const eventId = event.eid
    try {
      const response = await fetch(`/api/events/${eventId}/register-team`, { method: 'POST', credentials: 'include' })
      const data = await response.json()
      if (!response.ok) { showFlash('error', data.error); return }
      if (data.requiresPayment) {
        if (!event.upiId) { showFlash("error", "Payment not setup"); return }
        setTransactionId(""); setShowUpiModal({ event, isTeam: true, teamId: teamState.teamId }); return
      }
      showFlash('success', 'Team registered!');
      setTicketInfo({ eventName: event.ename, eventDate: event.eventDate, userUSN: data.userUSN });
      await loadTeamStatus(eventId); await loadEvents(); await fetchMyRegistrations()
    } catch (err) { showFlash('error', 'Error registering team') }
  }

  async function handleSubmitUpiPayment() {
    if (!transactionId.trim()) { showModalFlash('error', 'Enter Transaction ID'); return }
    if (isSubmitting) return; setIsSubmitting(true)
    const { event, isTeam } = showUpiModal; const eventId = event.eid;
    const url = isTeam ? `/api/events/${eventId}/register-team-upi` : `/api/events/${eventId}/register-upi`
    try {
      const response = await fetch(url, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: transactionId.trim() })
      })
      const data = await response.json()
      if (!response.ok) { showModalFlash('error', data.error); return }
      showModalFlash('success', 'Submitted for verification!');
      setTimeout(async () => {
        setShowUpiModal(null); setTransactionId(""); showFlash('success', 'Submitted!');
        setTicketInfo({ eventName: event.ename, eventDate: event.eventDate, userUSN: data.userUSN || "PENDING" });
        await loadEvents(); await loadTeamStatus(eventId); await fetchMyRegistrations()
      }, 1500)
    } catch (err) { showModalFlash('error', 'Error submitting') } finally { setIsSubmitting(false) }
  }

  const handleOpenPoster = (e, url) => {
    e.stopPropagation();
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  function renderControls(event, isOverlay = false) {
    const teamState = teamStates[event.eid]

    const aboutBtn = (event.posterUrl && isOverlay) ? (
      <button className="registerevent-btn about" onClick={(e) => handleOpenPoster(e, event.posterUrl)}>
        View Poster ↗
      </button>
    ) : null;

    if (!teamState && (event.status !== 'completed')) return <button className="registerevent-btn disabled">Loading...</button>
    if (event.status === 'completed') return <button className="registerevent-btn disabled">Event Completed</button>

    if (!teamState?.isTeamEvent) {
      if (registeredEvents.has(event.eid)) {
        return (
          <div className="registerevent-btn-group">
            <button className="registerevent-btn success" disabled>✓ Registered</button>
            {aboutBtn}
          </div>
        )
      }
      return (
        <div className="registerevent-btn-group">
          <button className="registerevent-btn primary" onClick={(e) => { e.stopPropagation(); handleRegister(event); }}>
            {(event.regFee || 0) > 0 ? `Pay ₹${event.regFee}` : "Register"}
          </button>
          {aboutBtn}
        </div>
      )
    }

    if (teamState.registrationComplete) return (
      <div className="registerevent-btn-group">
        <button className="registerevent-btn success" disabled>✓ Team Registered</button>
        {aboutBtn}
      </div>
    )

    if (teamState.hasJoinedTeam) {
      const isLeader = teamState.isLeader
      return (
        <div className="registerevent-team-controls-group" style={{ width: '100%' }}>
          {isOverlay && (
            <div className="registerevent-hud-panel">
              <div className="registerevent-hud-header">
                <span className="registerevent-hud-label">Team: {teamState.teamName}</span>
                <span className="registerevent-hud-value" style={{ color: teamState.canRegister ? '#00ff9d' : '#ffbd00' }}>
                  {teamState.joinedCount}/{teamState.minSize} Members
                </span>
              </div>
              <div className="registerevent-member-stack">
                <span className="registerevent-hud-label">Member Status:</span>
                {teamState.members?.map((member, idx) => (
                  <div key={idx} className="registerevent-member-row">
                    <span>{member.student?.sname || member.student_usn}</span>
                    <span className={`registerevent-status-indicator ${member.join_status ? "joined" : "pending"}`}>
                      {member.join_status ? "Accepted" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="registerevent-btn-group" style={{ marginTop: isOverlay ? '16px' : '0' }}>
            {isLeader ? (
              <button
                className={`registerevent-btn ${teamState.canRegister ? "primary" : "disabled"}`}
                onClick={(e) => { e.stopPropagation(); teamState.canRegister && handleRegisterTeam(event, teamState); }}
                disabled={!teamState.canRegister}
              >
                {(teamState.regFee || 0) > 0 ? `Pay ₹${teamState.regFee}` : "Finalize Registration"}
              </button>
            ) : (
              <button className="registerevent-btn disabled">Waiting for Leader</button>
            )}
            {aboutBtn}
          </div>
        </div>
      )
    }

    return (
      <div className="registerevent-btn-group">
        <button className="registerevent-btn secondary" onClick={(e) => { e.stopPropagation(); setShowTeamModal({ eventId: event.eid, mode: 'create' }) }}>Create Team</button>
        <button className="registerevent-btn secondary" onClick={(e) => { e.stopPropagation(); handleViewInvites(event.eid) }}>View Invites</button>
        {aboutBtn}
      </div>
    )
  }

  // ==================== RENDER ====================

  return (
    <main className="registerevent-page">
      {ticketInfo && <TicketAnimation onClose={() => setTicketInfo(null)} {...ticketInfo} />}
      {flash.message && <div className={`registerevent-flash ${flash.type === 'success' ? 'registerevent-flash-success' : 'registerevent-flash-error'}`}>{flash.message}</div>}

      {/* === DYNAMIC GALLERY BACKGROUND === */}
      <div
        className="re-gallery-bg"
        style={{
          background: `
            radial-gradient(ellipse at 25% 20%, ${currentColors[0]}55 0%, transparent 50%),
            radial-gradient(ellipse at 75% 80%, ${currentColors[1]}55 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, ${currentColors[2]}33 0%, transparent 65%),
            linear-gradient(180deg, #080808 0%, #0d0d0d 100%)
          `,
        }}
      />
      <div className="re-gallery-blur-bg" />

      {/* === HEADER === */}
      <header className="re-gallery-header">
        <div className="re-gallery-header-left">
          <h1 className="re-gallery-headline">Events</h1>
          <p className="re-gallery-subline">Discover & join events happening around you.</p>
        </div>
        <div className="re-gallery-header-right">
          {/* REMOVED: Desktop toggle from header right */}

          {filteredEvents.length > 0 && viewMode === "gallery" && (
            <JumpCounter
              current={currentIndex}
              total={filteredEvents.length}
              onJump={goToSlide}
            />
          )}
          {filteredEvents.length > 0 && viewMode === "grid" && (
            <div className="re-gallery-counter" style={{ cursor: 'default' }}>
              <span>{filteredEvents.length}</span>
              <span style={{ color: 'rgba(255,255,255,0.25)', margin: '0 3px' }}>·</span>
              <span>events</span>
            </div>
          )}
          <button className="re-gallery-back-btn" onClick={() => navigate('/events')}>← Dashboard</button>
        </div>
      </header>

      {/* === DESKTOP VIEW TOGGLE (Centered above filters) === */}
      <div className="re-view-toggle-desktop-centered">
        <button
          className={`re-view-tab ${viewMode === "gallery" ? "active" : ""}`}
          onClick={() => setViewMode("gallery")}
        >
          <svg viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.6" width="14" height="11">
            <rect x="0.8" y="0.8" width="16.4" height="12.4" rx="2"/>
            <line x1="0.8" y1="4" x2="17.2" y2="4"/>
            <line x1="0.8" y1="10" x2="17.2" y2="10"/>
          </svg>
          <span>Gallery</span>
        </button>
        <button
          className={`re-view-tab ${viewMode === "grid" ? "active" : ""}`}
          onClick={() => setViewMode("grid")}
        >
          <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13">
            <rect x="0" y="0" width="6" height="6" rx="1.2"/>
            <rect x="8" y="0" width="6" height="6" rx="1.2" opacity="0.6"/>
            <rect x="0" y="8" width="6" height="6" rx="1.2" opacity="0.6"/>
            <rect x="8" y="8" width="6" height="6" rx="1.2" opacity="0.6"/>
          </svg>
          <span>Grid</span>
        </button>
      </div>

      {/* === FILTER STRIP (search left + filters) === */}
      <div className="re-gallery-filter-strip">
        {!loading && filteredEvents.length > 0 && (
          <SearchBar
            events={filteredEvents}
            onSelect={(i) => { setViewMode("gallery"); goToSlide(i); }}
            currentIndex={currentIndex}
          />
        )}
        <div className="re-filter-divider" />
        {["all", "upcoming", "ongoing", "completed"].map(k => (
          <button
            key={k}
            className={`re-gallery-filter-btn ${filter === k ? 'active' : ''}`}
            onClick={() => { setFilter(k); goToSlide(0); }}
          >
            {k.charAt(0).toUpperCase() + k.slice(1)}
            {statusCounts[k] > 0 && (
              <span className={`re-filter-count ${filter === k ? 'active' : ''}`}>{statusCounts[k]}</span>
            )}
          </button>
        ))}
      </div>

      {/* === MOBILE VIEW TOGGLE (Moved ABOVE dots) === */}
      <div className="re-mobile-view-toggle">
        <button
          className={`re-mobile-view-btn ${viewMode === "gallery" ? "active" : ""}`}
          onClick={() => setViewMode("gallery")}
        >
          <svg viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="11">
            <rect x="0.8" y="0.8" width="16.4" height="12.4" rx="2"/>
            <line x1="0.8" y1="4" x2="17.2" y2="4"/>
            <line x1="0.8" y1="10" x2="17.2" y2="10"/>
          </svg>
          Gallery
        </button>
        <button
          className={`re-mobile-view-btn ${viewMode === "grid" ? "active" : ""}`}
          onClick={() => setViewMode("grid")}
        >
          <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13">
            <rect x="0" y="0" width="6.5" height="6.5" rx="1.2"/>
            <rect x="9.5" y="0" width="6.5" height="6.5" rx="1.2"/>
            <rect x="0" y="9.5" width="6.5" height="6.5" rx="1.2"/>
            <rect x="9.5" y="9.5" width="6.5" height="6.5" rx="1.2"/>
          </svg>
          Grid
        </button>
      </div>

      {/* === MAIN CONTENT: GALLERY or GRID === */}
      {loading ? (
        <div className="re-gallery-loading">
          <div className="re-gallery-spinner"></div>
          <p>Loading events...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="re-gallery-empty">
          <span>No events found</span>
        </div>
      ) : viewMode === "gallery" ? (
        /* ---- GALLERY SLIDER ---- */
        <div
          ref={sliderRef}
          className={`re-gallery-slider ${isDragging ? 'dragging' : ''}`}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          <div
            ref={trackRef}
            className="re-gallery-track"
          >
            {filteredEvents.map((event, index) => (
              <EventGalleryCard
                key={event.eid}
                event={event}
                isActive={index === currentIndex}
                index={index}
                currentIndex={currentIndex}
                onOpen={setSelectedEvent}
                renderControls={renderControls}
              />
            ))}
          </div>
        </div>
      ) : (
        /* ---- BENTO GRID ---- */
        <BentoGrid
          events={filteredEvents}
          onOpen={setSelectedEvent}
          renderControls={renderControls}
        />
      )}

      {/* === SMART NAV DOTS (gallery only) === */}
      {!loading && filteredEvents.length > 1 && viewMode === "gallery" && (
        <NavigationDots
          total={filteredEvents.length}
          current={currentIndex}
          onSelect={goToSlide}
          colors={currentColors}
        />
      )}

      {/* === KEYBOARD HINT (gallery only) === */}
      {viewMode === "gallery" && (
        <div className="re-gallery-keyboard-hint">
          <kbd>←</kbd>
          <kbd>→</kbd>
          <span>navigate</span>
        </div>
      )}

      {/* ===== DETAIL OVERLAY ===== */}
      {selectedEvent && (
        <div className="registerevent-overlay-container">
          <div className="registerevent-overlay-split">
            <div className="registerevent-split-top">
              <button className="registerevent-close-btn" onClick={() => setSelectedEvent(null)}>×</button>
              <div className="registerevent-image-wrapper">
                <img src={resolveBanner(selectedEvent)} alt={selectedEvent.ename} />
                <div className="registerevent-image-gradient"></div>
              </div>
            </div>

            <div className="registerevent-split-bottom">
              <div className="registerevent-detail-content">
                <div className="registerevent-detail-header-flex">
                  <h2 className="registerevent-card-title" style={{ fontSize: '2rem', marginBottom: '8px' }}>{selectedEvent.ename}</h2>
                  <div className="registerevent-badges" style={{ marginTop: '8px' }}>
                    <span className="registerevent-badge registerevent-badge-upcoming">{new Date(selectedEvent.eventDate).toDateString()}</span>
                    <span className="registerevent-badge registerevent-badge-upcoming">{formatTime12h(selectedEvent.eventTime)}</span>
                    {selectedEvent.regFee > 0 ?
                      <span className="registerevent-badge registerevent-badge-upcoming" style={{ color: 'var(--re-accent-cyan)', borderColor: 'var(--re-accent-cyan)' }}>₹{selectedEvent.regFee}</span> :
                      <span className="registerevent-badge registerevent-badge-ongoing" style={{ borderColor: 'var(--re-accent-success)' }}>Free</span>
                    }
                  </div>
                </div>

                <div className="registerevent-description-box">
                  <h4>About Event</h4>
                  <p>{selectedEvent.eventdesc}</p>
                </div>

                <div className="registerevent-bento-grid">
                  <div className="registerevent-bento-item">
                    <span className="bento-label">Venue</span>
                    <span className="bento-value">{selectedEvent.eventLoc}</span>
                  </div>
                  <div className="registerevent-bento-item">
                    <span className="bento-label">Organizer</span>
                    <span className="bento-value">{selectedEvent.organizerName || "Club"}</span>
                  </div>
                  {selectedEvent.is_team && (
                    <div className="registerevent-bento-item">
                      <span className="bento-label">Team Size</span>
                      <span className="bento-value">{selectedEvent.min_team_size} - {selectedEvent.max_team_size} Members</span>
                    </div>
                  )}
                </div>
                <div style={{ height: '140px' }}></div>
              </div>

              <div className="registerevent-action-bar">
                {renderControls(selectedEvent, true)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODALS ===== */}
      {showTeamModal && (
        <div className="registerevent-modal-overlay" onClick={() => setShowTeamModal(null)}>
          <div className="registerevent-modal" onClick={e => e.stopPropagation()}>
            <div className="registerevent-modal-header">
              <h2 className="registerevent-modal-title">{showTeamModal.mode === 'create' ? 'Create Team' : 'Invites'}</h2>
              <button className="registerevent-modal-close" onClick={() => setShowTeamModal(null)}>×</button>
            </div>
            <div className="registerevent-modal-body">
              {modalFlash.message && <div className={`registerevent-flash ${modalFlash.type === 'success' ? 'registerevent-flash-success' : 'registerevent-flash-error'}`} style={{ position: 'relative', top: 0, left: 0, transform: 'none', width: 'auto', marginBottom: '16px' }}>{modalFlash.message}</div>}
              {showTeamModal.mode === 'create' ? (
                <div className="registerevent-team-form">
                  <div className="registerevent-form-group">
                    <label className="registerevent-form-label">Team Name</label>
                    <input className="registerevent-form-input" placeholder="Enter Team Name" value={teamFormData.teamName} onChange={e => setTeamFormData({ ...teamFormData, teamName: e.target.value })} />
                  </div>
                  <div className="registerevent-form-group">
                    <label className="registerevent-form-label">Members (USNs)</label>
                    {teamFormData.memberUSNs.map((usn, i) => (
                      <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input className="registerevent-form-input" placeholder="Member USN" value={usn} onChange={e => {
                          const newUsns = [...teamFormData.memberUSNs]; newUsns[i] = e.target.value; setTeamFormData({ ...teamFormData, memberUSNs: newUsns })
                        }} />
                        {i > 0 && <button className="registerevent-team-action-btn" style={{ width: 'auto', background: 'rgba(255,0,0,0.2)', borderColor: 'transparent' }} onClick={() => {
                          const newUsns = teamFormData.memberUSNs.filter((_, idx) => idx !== i);
                          setTeamFormData({ ...teamFormData, memberUSNs: newUsns });
                        }}>×</button>}
                      </div>
                    ))}
                    <button className="registerevent-team-action-btn" style={{ marginTop: '8px', fontSize: '0.85rem' }} onClick={() => setTeamFormData(prev => ({ ...prev, memberUSNs: [...prev.memberUSNs, ''] }))}>+ Add Member</button>
                  </div>
                  <button className="registerevent-modal-submit-btn" onClick={() => handleCreateTeam(showTeamModal.eventId)}>Create Team</button>
                </div>
              ) : (
                <div className="registerevent-invites-list">
                  {!teamInvites.length ? <p style={{ color: '#888', textAlign: 'center' }}>No pending invites.</p> : teamInvites.map((inv, i) => (
                    <div key={i} className="registerevent-hud-panel" style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ color: 'white', fontWeight: 'bold' }}>{inv.teamName}</div>
                        <div style={{ fontSize: '0.8rem', color: '#888' }}>Leader: {inv.leaderName}</div>
                      </div>
                      {!inv.registrationComplete && !inv.joinStatus && <button className="registerevent-invite-confirm-btn" style={{ width: 'auto', padding: '8px 16px' }} onClick={() => handleConfirmJoin(inv.teamId, showTeamModal.eventId)}>Join</button>}
                      {inv.joinStatus && <span style={{ color: 'var(--re-accent-success)', fontSize: '0.8rem' }}>Joined</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showUpiModal && (
        <div className="registerevent-modal-overlay" onClick={() => !isSubmitting && setShowUpiModal(null)}>
          <div className="registerevent-modal" onClick={e => e.stopPropagation()}>
            <div className="registerevent-modal-header">
              <h2 className="registerevent-modal-title">Pay & Register</h2>
              <button className="registerevent-modal-close" disabled={isSubmitting} onClick={() => setShowUpiModal(null)}>×</button>
            </div>
            <div className="registerevent-modal-body" style={{ textAlign: 'center' }}>
              <div className="registerevent-qr-wrapper">{qrCodeDataUrl ? <img src={qrCodeDataUrl} alt="QR" style={{ display: 'block', maxWidth: '100%' }} /> : <div className="registerevent-spinner" style={{ margin: '40px auto' }}></div>}</div>
              <p style={{ color: '#ccc', marginBottom: '20px' }}>Pay <strong>₹{showUpiModal.event.regFee}</strong></p>
              <div className="registerevent-payment-details"><div className="registerevent-payment-row"><span style={{ color: '#888' }}>UPI ID</span><span className="registerevent-payment-value">{showUpiModal.event.upiId}</span></div></div>
              <input className="registerevent-form-input" placeholder="Transaction ID (UTR)" value={transactionId} onChange={e => setTransactionId(e.target.value)} disabled={isSubmitting} />
              <button className="registerevent-modal-submit-btn" style={{ marginTop: '16px' }} onClick={handleSubmitUpiPayment} disabled={isSubmitting}>{isSubmitting ? "Verifying..." : "Submit Payment"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
