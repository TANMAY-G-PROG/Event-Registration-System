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
const DEFAULT_COLORS = ["#1a1a2e", "#16213e", "#0f3460"];

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

function formatDate(dateStr) {
  if (!dateStr) return "Date TBA"
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
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
      canvas.width = sampleSize; canvas.height = sampleSize;
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
            const distance = Math.sqrt(Math.pow(color.r - existingRgb.r, 2) + Math.pow(color.g - existingRgb.g, 2) + Math.pow(color.b - existingRgb.b, 2));
            return distance > 40;
          });
          if (isDistinct && distinctColors.length < 3) { distinctColors.push(hex); }
        }
        while (distinctColors.length < 3) {
          const baseColor = hexToRgb(distinctColors[0] || "#1a1a2e");
          if (baseColor) {
            const shift = distinctColors.length === 1 ? -40 : 40;
            distinctColors.push(rgbToHex(Math.min(255, Math.max(0, baseColor.r + shift)), Math.min(255, Math.max(0, baseColor.g + shift)), Math.min(255, Math.max(0, baseColor.b + shift))));
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

// ============================================================================
// CARD RAIL — horizontal scroll, shows partial next card as "peek"
// ============================================================================

function CardRail({ events, onOpen, renderControls, registeredEvents, teamStates }) {
  const railRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const colorMap = useColorExtraction(events);

  // Snap on scroll
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const handleScroll = () => {
      const cardW = rail.querySelector('.rc-card')?.offsetWidth || 300;
      const gap = 16;
      const idx = Math.round(rail.scrollLeft / (cardW + gap));
      setActiveIdx(Math.max(0, Math.min(idx, events.length - 1)));
    };
    rail.addEventListener('scroll', handleScroll, { passive: true });
    return () => rail.removeEventListener('scroll', handleScroll);
  }, [events.length]);

  const scrollTo = (idx) => {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelectorAll('.rc-card')[idx];
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    setActiveIdx(idx);
  };

  if (events.length === 0) return (
    <div className="rc-empty">
      <div className="rc-empty-icon">✦</div>
      <p>No events here yet</p>
    </div>
  );

  return (
    <div className="rc-rail-wrap">
      {/* Horizontal scroll rail */}
      <div className="rc-rail" ref={railRef}>
        {events.map((event, idx) => {
          const cols = colorMap[event.eid] || DEFAULT_COLORS;
          const isActive = idx === activeIdx;
          const teamState = teamStates[event.eid];
          const isRegistered = registeredEvents.has(event.eid);

          return (
            <div
              key={event.eid}
              className={`rc-card ${isActive ? 'rc-card--active' : ''}`}
              style={{ '--c0': cols[0], '--c1': cols[1], '--c2': cols[2] }}
            >
              {/* Background image */}
              <div className="rc-card-img" onClick={() => onOpen(event)}>
                <img src={resolveBanner(event)} alt={event.ename} loading="lazy" draggable={false} />
                <div className="rc-card-scrim" />
              </div>

              {/* Top badges */}
              <div className="rc-card-top">
                <span className={`rc-badge rc-badge--${event.status}`}>{event.status}</span>
                {event.is_team && <span className="rc-badge rc-badge--team">👥 Team</span>}
                <span className="rc-badge rc-badge--fee" style={{ marginLeft: 'auto' }}>
                  {event.regFee > 0 ? `₹${event.regFee}` : 'Free'}
                </span>
              </div>

              {/* Info */}
              <div className="rc-card-body" onClick={() => onOpen(event)}>
                <p className="rc-card-date">{formatDate(event.eventDate)} · {formatTime12h(event.eventTime)}</p>
                <h3 className="rc-card-name">{event.ename}</h3>
                <p className="rc-card-loc">📍 {event.eventLoc}</p>
              </div>

              {/* CTA */}
              <div className="rc-card-cta" onClick={e => e.stopPropagation()}>
                {renderControls(event, false)}
                <button className="rc-details-btn" onClick={() => onOpen(event)}>Details ↗</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dot indicators — only if ≥2 events */}
      {events.length > 1 && (
        <div className="rc-dots">
          {events.map((_, i) => (
            <button
              key={i}
              className={`rc-dot ${i === activeIdx ? 'rc-dot--active' : ''}`}
              onClick={() => scrollTo(i)}
              aria-label={`Event ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// GRID CARD
// ============================================================================

function GridCard({ event, onOpen, renderControls }) {
  return (
    <div className="rg-card" onClick={() => onOpen(event)}>
      <div className="rg-card-img">
        <img src={resolveBanner(event)} alt={event.ename} loading="lazy" />
        <span className={`rg-badge rg-badge--${event.status}`}>{event.status}</span>
        {event.is_team && <span className="rg-badge rg-badge--team" style={{ left: 'auto', right: '10px' }}>👥</span>}
      </div>
      <div className="rg-card-body">
        <p className="rg-card-date">{formatDate(event.eventDate)} · {formatTime12h(event.eventTime)}</p>
        <h3 className="rg-card-name">{event.ename}</h3>
        <p className="rg-card-loc">📍 {event.eventLoc}</p>
        <div className="rg-card-footer">
          <span className="rg-card-fee">{event.regFee > 0 ? `₹${event.regFee}` : 'Free'}</span>
          <div className="rg-card-actions" onClick={e => e.stopPropagation()}>
            {renderControls(event, false)}
            <button className="rg-details-btn" onClick={(e) => { e.stopPropagation(); onOpen(event); }}>↗</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SEARCH
// ============================================================================

function SearchBar({ events, onSelect }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

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
      .slice(0, 5);
  }, [query, events]);

  return (
    <div className="rs-wrap">
      <div className={`rs-input-wrap ${open ? 'rs-open' : ''}`}>
        <svg className="rs-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          className="rs-input"
          placeholder="Search events…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => { setOpen(false); setQuery(""); }, 160)}
          onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setQuery(""); inputRef.current?.blur(); } e.stopPropagation(); }}
          autoComplete="off"
        />
        {query && <button className="rs-clear" onMouseDown={e => { e.preventDefault(); setQuery(""); }}>×</button>}
      </div>

      {open && query && (
        <div className="rs-dropdown">
          {results.length === 0 ? (
            <div className="rs-no-result">No matches for "{query}"</div>
          ) : results.map(({ event, index }) => (
            <button
              key={event.eid}
              className="rs-result"
              onMouseDown={e => { e.preventDefault(); onSelect(index); setOpen(false); setQuery(""); }}
            >
              <img src={resolveBanner(event)} alt="" className="rs-result-img" />
              <div className="rs-result-info">
                <span className="rs-result-name">{event.ename}</span>
                <span className="rs-result-loc">{event.eventLoc}</span>
              </div>
              <span className={`rs-result-status rs-result-status--${event.status}`}>{event.status}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Registerevent() {
  const navigate = useNavigate()

  const [eventsData, setEventsData] = useState({ upcoming: [], ongoing: [], completed: [] })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")
  const [viewMode, setViewMode] = useState("rail") // "rail" | "grid"
  const [teamStates, setTeamStates] = useState({})
  const [registeredEvents, setRegisteredEvents] = useState(new Set())

  const [flash, setFlash] = useState({ type: "", message: "" })
  const [modalFlash, setModalFlash] = useState({ type: "", message: "" })
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [ticketInfo, setTicketInfo] = useState(null);

  const [showTeamModal, setShowTeamModal] = useState(null)
  const [teamFormData, setTeamFormData] = useState({ teamName: '', memberUSNs: [''] })
  const [teamInvites, setTeamInvites] = useState([])
  const [showUpiModal, setShowUpiModal] = useState(null)
  const [transactionId, setTransactionId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("")

  const timerRef = useRef(null)
  const modalTimerRef = useRef(null)

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
        setTeamStates(prev => ({ ...prev, [eventId]: data }))
      } else {
        setTeamStates(prev => ({ ...prev, [eventId]: null }))
      }
    } catch (err) { console.error(err) }
  }, []);

  useEffect(() => { loadEvents(); fetchMyRegistrations(); }, [loadEvents, fetchMyRegistrations])

  useEffect(() => {
    const activeEvents = [...(eventsData.upcoming || []), ...(eventsData.ongoing || [])];
    if (activeEvents.length > 0) activeEvents.forEach(event => { loadTeamStatus(event.eid) })
  }, [eventsData, loadTeamStatus])

  useEffect(() => {
    const shouldLock = selectedEvent || showTeamModal || showUpiModal;
    document.body.style.overflow = shouldLock ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedEvent, showTeamModal, showUpiModal]);

  const allEvents = useMemo(() => [
    ...(eventsData.upcoming || []).map(e => ({ ...e, status: "upcoming" })),
    ...(eventsData.ongoing || []).map(e => ({ ...e, status: "ongoing" })),
    ...(eventsData.completed || []).map(e => ({ ...e, status: "completed" })),
  ], [eventsData]);

  const statusCounts = useMemo(() => ({
    all: allEvents.length,
    upcoming: allEvents.filter(e => e.status === "upcoming").length,
    ongoing: allEvents.filter(e => e.status === "ongoing").length,
    completed: allEvents.filter(e => e.status === "completed").length,
  }), [allEvents]);

  const filteredEvents = useMemo(() => {
    const base = filter === "all" ? allEvents : allEvents.filter(e => e.status === filter)
    return base.filter(e => {
      if (e.status === 'completed') return true
      if (teamStates[e.eid] === null) return false
      return true
    })
  }, [allEvents, filter, teamStates])

  // Group events by status for the sectioned rail view
  const eventsByStatus = useMemo(() => {
    const sections = [];
    const ongoing = filteredEvents.filter(e => e.status === 'ongoing');
    const upcoming = filteredEvents.filter(e => e.status === 'upcoming');
    const completed = filteredEvents.filter(e => e.status === 'completed');
    if (ongoing.length) sections.push({ label: 'Happening Now', emoji: '🔴', events: ongoing });
    if (upcoming.length) sections.push({ label: 'Coming Up', emoji: '📅', events: upcoming });
    if (completed.length) sections.push({ label: 'Past Events', emoji: '✓', events: completed });
    return sections;
  }, [filteredEvents]);

  useEffect(() => {
    if (showUpiModal) {
      const { event } = showUpiModal
      const upiUrl = generateUpiUrl(event.upiId, event.ename, event.regFee, event.eid)
      QRCode.toDataURL(upiUrl, { width: 280, margin: 2, color: { dark: '#000000', light: '#ffffff' } }).then(setQrCodeDataUrl)
    } else { setQrCodeDataUrl("") }
  }, [showUpiModal])

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

    const posterBtn = (event.posterUrl && isOverlay) ? (
      <button className="re-btn re-btn--ghost" onClick={(e) => handleOpenPoster(e, event.posterUrl)}>
        View Poster ↗
      </button>
    ) : null;

    if (!teamState && (event.status !== 'completed')) return <button className="re-btn re-btn--muted">Loading…</button>
    if (event.status === 'completed') return <button className="re-btn re-btn--muted" disabled>Completed</button>

    if (!teamState?.isTeamEvent) {
      if (registeredEvents.has(event.eid)) {
        return <div className="re-btn-row">
          <button className="re-btn re-btn--success" disabled>✓ Registered</button>
          {posterBtn}
        </div>
      }
      return <div className="re-btn-row">
        <button className="re-btn re-btn--primary" onClick={(e) => { e.stopPropagation(); handleRegister(event); }}>
          {(event.regFee || 0) > 0 ? `Pay ₹${event.regFee}` : "Register Free"}
        </button>
        {posterBtn}
      </div>
    }

    if (teamState.registrationComplete) return (
      <div className="re-btn-row">
        <button className="re-btn re-btn--success" disabled>✓ Team Registered</button>
        {posterBtn}
      </div>
    )

    if (teamState.hasJoinedTeam) {
      const isLeader = teamState.isLeader
      return (
        <div className="re-team-block">
          {isOverlay && (
            <div className="re-team-hud">
              <div className="re-team-hud-header">
                <span className="re-team-hud-name">{teamState.teamName}</span>
                <span className={`re-team-hud-count ${teamState.canRegister ? 'ready' : ''}`}>
                  {teamState.joinedCount}/{teamState.minSize} members
                </span>
              </div>
              <div className="re-member-list">
                {teamState.members?.map((member, idx) => (
                  <div key={idx} className="re-member-row">
                    <span>{member.student?.sname || member.student_usn}</span>
                    <span className={`re-member-status ${member.join_status ? "joined" : "pending"}`}>
                      {member.join_status ? "✓ Joined" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="re-btn-row" style={{ marginTop: isOverlay ? '16px' : '0' }}>
            {isLeader ? (
              <button
                className={`re-btn ${teamState.canRegister ? "re-btn--primary" : "re-btn--muted"}`}
                onClick={(e) => { e.stopPropagation(); teamState.canRegister && handleRegisterTeam(event, teamState); }}
                disabled={!teamState.canRegister}
                title={!teamState.canRegister ? `Need ${teamState.minSize} members` : ''}
              >
                {(teamState.regFee || 0) > 0 ? `Pay ₹${teamState.regFee}` : "Finalize Team"}
              </button>
            ) : (
              <button className="re-btn re-btn--muted" disabled>Waiting for leader</button>
            )}
            {posterBtn}
          </div>
        </div>
      )
    }

    return (
      <div className="re-btn-row">
        <button className="re-btn re-btn--secondary" onClick={(e) => { e.stopPropagation(); setShowTeamModal({ eventId: event.eid, mode: 'create' }) }}>
          Create Team
        </button>
        <button className="re-btn re-btn--secondary" onClick={(e) => { e.stopPropagation(); handleViewInvites(event.eid) }}>
          Invites
        </button>
        {posterBtn}
      </div>
    )
  }

  // ==================== RENDER ====================

  return (
    <main className="re-page">
      {ticketInfo && <TicketAnimation onClose={() => setTicketInfo(null)} {...ticketInfo} />}

      {/* Flash toast */}
      {flash.message && (
        <div className={`re-toast ${flash.type === 'success' ? 're-toast--success' : 're-toast--error'}`}>
          {flash.type === 'success' ? '✓' : '!'} {flash.message}
        </div>
      )}

      {/* ── HEADER ── */}
      <header className="re-header">
        <div className="re-header-left">
          <button className="re-back-btn" onClick={() => navigate('/events')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Dashboard
          </button>
          <div className="re-header-title">
            <h1>Events</h1>
            {!loading && <span className="re-event-count">{filteredEvents.length} events</span>}
          </div>
        </div>

        <div className="re-header-right">
          {/* Search */}
          {!loading && allEvents.length > 0 && (
            <SearchBar
              events={filteredEvents}
              onSelect={(i) => { setViewMode("grid"); }}
            />
          )}

          {/* View toggle */}
          <div className="re-view-toggle">
            <button
              className={`re-view-btn ${viewMode === 'rail' ? 'active' : ''}`}
              onClick={() => setViewMode('rail')}
              title="Card rail"
            >
              <svg viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="11">
                <rect x="1" y="1" width="8" height="12" rx="2"/>
                <rect x="11" y="1" width="8" height="12" rx="2" opacity="0.4"/>
              </svg>
            </button>
            <button
              className={`re-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                <rect x="0" y="0" width="7" height="7" rx="1.5"/>
                <rect x="9" y="0" width="7" height="7" rx="1.5" opacity="0.5"/>
                <rect x="0" y="9" width="7" height="7" rx="1.5" opacity="0.5"/>
                <rect x="9" y="9" width="7" height="7" rx="1.5" opacity="0.5"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ── FILTER TABS ── */}
      <div className="re-filter-bar">
        {["all", "ongoing", "upcoming", "completed"].map(k => (
          <button
            key={k}
            className={`re-filter-tab ${filter === k ? 'active' : ''}`}
            onClick={() => setFilter(k)}
          >
            {k === 'ongoing' && <span className="re-live-dot" />}
            {k.charAt(0).toUpperCase() + k.slice(1)}
            <span className="re-filter-count">{statusCounts[k]}</span>
          </button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div className="re-content">
        {loading ? (
          <div className="re-loading">
            <div className="re-spinner" />
            <p>Loading events…</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="re-empty">
            <div className="re-empty-icon">✦</div>
            <h3>No events found</h3>
            <p>Try a different filter</p>
            {filter !== 'all' && (
              <button className="re-btn re-btn--secondary" onClick={() => setFilter('all')}>
                Show all events
              </button>
            )}
          </div>
        ) : viewMode === 'rail' ? (
          /* ── SECTIONED RAIL ── */
          <div className="re-sections">
            {eventsByStatus.map(section => (
              <section key={section.label} className="re-section">
                <div className="re-section-header">
                  <span className="re-section-emoji">{section.emoji}</span>
                  <h2 className="re-section-title">{section.label}</h2>
                  <span className="re-section-count">{section.events.length}</span>
                </div>
                <CardRail
                  events={section.events}
                  onOpen={setSelectedEvent}
                  renderControls={renderControls}
                  registeredEvents={registeredEvents}
                  teamStates={teamStates}
                />
              </section>
            ))}
          </div>
        ) : (
          /* ── GRID VIEW ── */
          <div className="re-grid">
            {filteredEvents.map(event => (
              <GridCard
                key={event.eid}
                event={event}
                onOpen={setSelectedEvent}
                renderControls={renderControls}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── DETAIL SHEET ── */}
      {selectedEvent && (
        <>
          <div className="re-sheet-backdrop" onClick={() => setSelectedEvent(null)} />
          <div className="re-sheet">
            {/* Sheet handle */}
            <div className="re-sheet-handle" />

            {/* Hero image */}
            <div className="re-sheet-hero">
              <img src={resolveBanner(selectedEvent)} alt={selectedEvent.ename} />
              <div className="re-sheet-hero-scrim" />
              <button className="re-sheet-close" onClick={() => setSelectedEvent(null)}>×</button>

              {/* Floating badges on hero */}
              <div className="re-sheet-hero-badges">
                <span className={`re-badge-pill re-badge-pill--${selectedEvent.status}`}>{selectedEvent.status}</span>
                {selectedEvent.is_team && <span className="re-badge-pill re-badge-pill--team">👥 Team Event</span>}
                <span className="re-badge-pill re-badge-pill--fee" style={{ marginLeft: 'auto' }}>
                  {selectedEvent.regFee > 0 ? `₹${selectedEvent.regFee}` : 'Free'}
                </span>
              </div>
            </div>

            {/* Sheet body */}
            <div className="re-sheet-body">
              <h2 className="re-sheet-title">{selectedEvent.ename}</h2>

              {/* Meta row */}
              <div className="re-sheet-meta">
                <div className="re-sheet-meta-item">
                  <span className="re-sheet-meta-icon">📅</span>
                  <div>
                    <span className="re-sheet-meta-label">Date & Time</span>
                    <span className="re-sheet-meta-value">
                      {new Date(selectedEvent.eventDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long' })}
                      {' · '}{formatTime12h(selectedEvent.eventTime)}
                    </span>
                  </div>
                </div>
                <div className="re-sheet-meta-item">
                  <span className="re-sheet-meta-icon">📍</span>
                  <div>
                    <span className="re-sheet-meta-label">Venue</span>
                    <span className="re-sheet-meta-value">{selectedEvent.eventLoc}</span>
                  </div>
                </div>
                <div className="re-sheet-meta-item">
                  <span className="re-sheet-meta-icon">🏛️</span>
                  <div>
                    <span className="re-sheet-meta-label">Organizer</span>
                    <span className="re-sheet-meta-value">{selectedEvent.organizerName || "Club"}</span>
                  </div>
                </div>
                {selectedEvent.is_team && (
                  <div className="re-sheet-meta-item">
                    <span className="re-sheet-meta-icon">👥</span>
                    <div>
                      <span className="re-sheet-meta-label">Team Size</span>
                      <span className="re-sheet-meta-value">{selectedEvent.min_team_size}–{selectedEvent.max_team_size} members</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              {selectedEvent.eventdesc && (
                <div className="re-sheet-desc">
                  <h3>About</h3>
                  <p>{selectedEvent.eventdesc}</p>
                </div>
              )}

              {/* Spacer for sticky CTA */}
              <div style={{ height: '100px' }} />
            </div>

            {/* Sticky CTA */}
            <div className="re-sheet-cta">
              {renderControls(selectedEvent, true)}
            </div>
          </div>
        </>
      )}

      {/* ── TEAM MODAL ── */}
      {showTeamModal && (
        <div className="re-modal-overlay" onClick={() => setShowTeamModal(null)}>
          <div className="re-modal" onClick={e => e.stopPropagation()}>
            <div className="re-modal-header">
              <h2>{showTeamModal.mode === 'create' ? 'Create Team' : 'Pending Invites'}</h2>
              <button className="re-modal-close" onClick={() => setShowTeamModal(null)}>×</button>
            </div>
            {modalFlash.message && (
              <div className={`re-modal-flash ${modalFlash.type}`}>{modalFlash.message}</div>
            )}
            <div className="re-modal-body">
              {showTeamModal.mode === 'create' ? (
                <div>
                  <label className="re-label">Team Name</label>
                  <input className="re-input" placeholder="Enter team name" value={teamFormData.teamName} onChange={e => setTeamFormData({ ...teamFormData, teamName: e.target.value })} />

                  <label className="re-label" style={{ marginTop: '16px' }}>Member USNs</label>
                  {teamFormData.memberUSNs.map((usn, i) => (
                    <div key={i} className="re-usn-row">
                      <input className="re-input" placeholder="Member USN" value={usn} onChange={e => {
                        const newUsns = [...teamFormData.memberUSNs]; newUsns[i] = e.target.value; setTeamFormData({ ...teamFormData, memberUSNs: newUsns })
                      }} />
                      {i > 0 && <button className="re-usn-remove" onClick={() => {
                        const newUsns = teamFormData.memberUSNs.filter((_, idx) => idx !== i);
                        setTeamFormData({ ...teamFormData, memberUSNs: newUsns });
                      }}>×</button>}
                    </div>
                  ))}
                  <button className="re-add-member-btn" onClick={() => setTeamFormData(prev => ({ ...prev, memberUSNs: [...prev.memberUSNs, ''] }))}>
                    + Add Member
                  </button>
                  <button className="re-btn re-btn--primary" style={{ width: '100%', marginTop: '24px' }} onClick={() => handleCreateTeam(showTeamModal.eventId)}>
                    Create Team
                  </button>
                </div>
              ) : (
                <div>
                  {!teamInvites.length ? (
                    <p className="re-modal-empty">No pending invites.</p>
                  ) : teamInvites.map((inv, i) => (
                    <div key={i} className="re-invite-card">
                      <div>
                        <div className="re-invite-team">{inv.teamName}</div>
                        <div className="re-invite-leader">Leader: {inv.leaderName}</div>
                      </div>
                      {!inv.registrationComplete && !inv.joinStatus && (
                        <button className="re-btn re-btn--primary" style={{ width: 'auto', padding: '8px 20px' }} onClick={() => handleConfirmJoin(inv.teamId, showTeamModal.eventId)}>
                          Join
                        </button>
                      )}
                      {inv.joinStatus && <span className="re-invite-joined">✓ Joined</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── UPI PAYMENT MODAL ── */}
      {showUpiModal && (
        <div className="re-modal-overlay" onClick={() => !isSubmitting && setShowUpiModal(null)}>
          <div className="re-modal" onClick={e => e.stopPropagation()}>
            <div className="re-modal-header">
              <h2>Complete Payment</h2>
              <button className="re-modal-close" disabled={isSubmitting} onClick={() => setShowUpiModal(null)}>×</button>
            </div>
            {modalFlash.message && (
              <div className={`re-modal-flash ${modalFlash.type}`}>{modalFlash.message}</div>
            )}
            <div className="re-modal-body re-upi-body">
              <div className="re-upi-amount">₹{showUpiModal.event.regFee}</div>
              <p className="re-upi-event">{showUpiModal.event.ename}</p>

              <div className="re-qr-box">
                {qrCodeDataUrl
                  ? <img src={qrCodeDataUrl} alt="QR Code" />
                  : <div className="re-spinner" style={{ margin: '32px auto' }} />
                }
              </div>

              <div className="re-upi-id-row">
                <span className="re-upi-id-label">UPI ID</span>
                <span className="re-upi-id-value">{showUpiModal.event.upiId}</span>
              </div>

              <input
                className="re-input"
                placeholder="Transaction ID / UTR Number"
                value={transactionId}
                onChange={e => setTransactionId(e.target.value)}
                disabled={isSubmitting}
                style={{ marginTop: '16px' }}
              />
              <button
                className="re-btn re-btn--primary"
                style={{ width: '100%', marginTop: '12px' }}
                onClick={handleSubmitUpiPayment}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Verifying…" : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
