"use client"
import { useEffect, useMemo, useState, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import QRCode from "qrcode"
import "./registerevent.css"
import TicketAnimation from './TicketAnimation'

// ============================================================================
// CONSTANTS
// ============================================================================

const FALLBACK_BANNER = "https://ik.imagekit.io/flopass/Aura.png"
const DEFAULT_COLORS  = ["#1a1a2e", "#16213e", "#0f3460"]

// ============================================================================
// HELPERS
// ============================================================================

function fmt12h(t) {
  if (!t) return "TBA"
  const [h, m] = String(t).split(":")
  const h24 = parseInt(h, 10)
  if (isNaN(h24)) return "TBA"
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24
  return `${h12}:${m} ${h24 >= 12 ? "PM" : "AM"}`
}

function fmtDate(d) {
  if (!d) return "TBA"
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

function fmtDateLong(d) {
  if (!d) return "TBA"
  return new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long" })
}

const banner = e => e?.bannerUrl || FALLBACK_BANNER

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("")
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null
}

// ============================================================================
// COLOR EXTRACTION
// ============================================================================

async function extractColors(url) {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onerror = () => resolve(DEFAULT_COLORS)
    img.onload = () => {
      const c = document.createElement("canvas")
      const ctx = c.getContext("2d")
      if (!ctx) return resolve(DEFAULT_COLORS)
      c.width = c.height = 50
      ctx.drawImage(img, 0, 0, 50, 50)
      try {
        const px = ctx.getImageData(0, 0, 50, 50).data
        const map = new Map()
        for (let i = 0; i < px.length; i += 4) {
          const r = Math.min(255, Math.round(px[i]   / 32) * 32)
          const g = Math.min(255, Math.round(px[i+1] / 32) * 32)
          const b = Math.min(255, Math.round(px[i+2] / 32) * 32)
          const br = (r+g+b)/3
          if (br < 20 || br > 240) continue
          const k = `${r},${g},${b}`
          const ex = map.get(k)
          if (ex) ex.count++; else map.set(k, { count:1, r, g, b })
        }
        const sorted = [...map.values()].sort((a,b) => b.count - a.count).slice(0, 10)
        const out = []
        for (const col of sorted) {
          const hex = rgbToHex(col.r, col.g, col.b)
          const ok = out.every(ex => {
            const rgb = hexToRgb(ex)
            return !rgb || Math.sqrt((col.r-rgb.r)**2+(col.g-rgb.g)**2+(col.b-rgb.b)**2) > 40
          })
          if (ok && out.length < 3) out.push(hex)
        }
        while (out.length < 3) {
          const base = hexToRgb(out[0] || "#1a1a2e")
          const s = out.length === 1 ? -40 : 40
          out.push(base
            ? rgbToHex(Math.min(255,Math.max(0,base.r+s)), Math.min(255,Math.max(0,base.g+s)), Math.min(255,Math.max(0,base.b+s)))
            : "#1a1a2e")
        }
        resolve(out)
      } catch { resolve(DEFAULT_COLORS) }
    }
    img.src = url
  })
}

function useColorExtraction(events) {
  const [colors, setColors] = useState({})
  useEffect(() => {
    events.forEach(ev => {
      extractColors(banner(ev)).then(cols => setColors(p => ({ ...p, [ev.eid]: cols })))
    })
  }, [events])
  return colors
}

// ============================================================================
// SKELETON CARD
// ============================================================================

function SkeletonCard() {
  return (
    <div className="sk-card">
      <div className="sk-img" />
      <div className="sk-body">
        <div className="sk-line sk-line--sm" />
        <div className="sk-line sk-line--lg" />
        <div className="sk-line sk-line--md" />
        <div className="sk-cta" />
      </div>
    </div>
  )
}

// ============================================================================
// CARD RAIL  — horizontal scroll with peek + dots
// ============================================================================

function CardRail({ events, onOpen, renderControls }) {
  const railRef   = useRef(null)
  const [idx, setIdx] = useState(0)
  const colorMap  = useColorExtraction(events)

  // Track active card on scroll
  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const onScroll = () => {
      const cardW = rail.querySelector(".rc-card")?.offsetWidth || 300
      const i = Math.round(rail.scrollLeft / (cardW + 14))
      setIdx(Math.max(0, Math.min(i, events.length - 1)))
    }
    rail.addEventListener("scroll", onScroll, { passive: true })
    return () => rail.removeEventListener("scroll", onScroll)
  }, [events.length])

  const scrollTo = i => {
    const rail = railRef.current
    if (!rail) return
    const card = rail.querySelectorAll(".rc-card")[i]
    card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
    setIdx(i)
  }

  if (!events.length) return (
    <div className="rc-empty">
      <span className="rc-empty-glyph">✦</span>
      <p>No events here yet</p>
    </div>
  )

  return (
    <div className="rc-wrap">
      <div className="rc-rail" ref={railRef}>
        {events.map((ev, i) => {
          const cols = colorMap[ev.eid] || DEFAULT_COLORS
          return (
            <article
              key={ev.eid}
              className={`rc-card ${i === idx ? "rc-card--active" : ""}`}
              style={{ "--c0": cols[0], "--c1": cols[1], "--c2": cols[2] }}
            >
              {/* ── Glow halo from extracted colors ── */}
              <div className="rc-card-glow" />

              {/* ── Image ── */}
              <div className="rc-card-img" onClick={() => onOpen(ev)}>
                <img src={banner(ev)} alt={ev.ename} loading="lazy" draggable={false} />
                <div className="rc-card-scrim" />

                {/* Chips on image */}
                <div className="rc-card-chips">
                  <span className={`rc-chip rc-chip--${ev.status}`}>
                    {ev.status === "ongoing" && <span className="rc-chip-dot" />}
                    {ev.status}
                  </span>
                  {ev.is_team && <span className="rc-chip rc-chip--team">Team</span>}
                  <span className="rc-chip rc-chip--fee" style={{ marginLeft: "auto" }}>
                    {ev.regFee > 0 ? `₹${ev.regFee}` : "Free"}
                  </span>
                </div>
              </div>

              {/* ── Body ── */}
              <div className="rc-card-body" onClick={() => onOpen(ev)}>
                <time className="rc-card-date">{fmtDate(ev.eventDate)} · {fmt12h(ev.eventTime)}</time>
                <h3 className="rc-card-title">{ev.ename}</h3>
                <p className="rc-card-loc">
                  <svg width="9" height="11" viewBox="0 0 10 13" fill="currentColor" style={{flexShrink:0}}>
                    <path d="M5 0C2.24 0 0 2.24 0 5c0 3.75 5 8 5 8s5-4.25 5-8c0-2.76-2.24-5-5-5zm0 6.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
                  </svg>
                  {ev.eventLoc}
                </p>
              </div>

              {/* ── CTA ── */}
              <div className="rc-card-cta" onClick={e => e.stopPropagation()}>
                {renderControls(ev, false)}
                <button className="rc-details-btn" onClick={() => onOpen(ev)}>
                  Details
                  <svg width="9" height="9" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M1 10L10 1M10 1H4M10 1v6"/>
                  </svg>
                </button>
              </div>
            </article>
          )
        })}
        <div className="rc-rail-spacer" aria-hidden="true" />
      </div>

      {/* Dot indicators */}
      {events.length > 1 && (
        <div className="rc-dots" role="tablist">
          {events.map((_, i) => (
            <button
              key={i}
              className={`rc-dot ${i === idx ? "rc-dot--active" : ""}`}
              onClick={() => scrollTo(i)}
              aria-label={`Event ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// GRID CARD
// ============================================================================

function GridCard({ event, onOpen, renderControls }) {
  return (
    <article className="rg-card">
      <div className="rg-card-img" onClick={() => onOpen(event)}>
        <img src={banner(event)} alt={event.ename} loading="lazy" draggable={false} />
        <div className="rg-card-scrim" />
        <div className="rg-card-chips">
          <span className={`rc-chip rc-chip--${event.status}`}>
            {event.status === "ongoing" && <span className="rc-chip-dot" />}
            {event.status}
          </span>
          {event.is_team && <span className="rc-chip rc-chip--team">Team</span>}
        </div>
      </div>
      <div className="rg-card-body">
        <time className="rg-card-date">{fmtDate(event.eventDate)} · {fmt12h(event.eventTime)}</time>
        <h3 className="rg-card-title" onClick={() => onOpen(event)}>{event.ename}</h3>
        <p className="rg-card-loc">{event.eventLoc}</p>
        <div className="rg-card-footer">
          <span className="rg-card-fee">{event.regFee > 0 ? `₹${event.regFee}` : "Free"}</span>
          <div className="rg-card-actions" onClick={e => e.stopPropagation()}>
            {renderControls(event, false)}
            <button className="rg-icon-btn" onClick={() => onOpen(event)} title="Details">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M1 10L10 1M10 1H4M10 1v6"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

// ============================================================================
// SEARCH
// ============================================================================

function SearchBar({ events, onSelect }) {
  const [q, setQ]       = useState("")
  const [open, setOpen] = useState(false)
  const ref             = useRef(null)

  const results = useMemo(() => {
    if (!q.trim()) return []
    const lq = q.toLowerCase()
    return events
      .map((e, i) => ({ e, i }))
      .filter(({ e }) =>
        e.ename?.toLowerCase().includes(lq) ||
        e.eventLoc?.toLowerCase().includes(lq) ||
        e.organizerName?.toLowerCase().includes(lq)
      )
      .slice(0, 5)
  }, [q, events])

  return (
    <div className="sb-wrap">
      <div className={`sb-pill ${open ? "sb-pill--open" : ""}`}>
        <svg className="sb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          ref={ref}
          className="sb-input"
          placeholder="Search events…"
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => { setOpen(false); setQ("") }, 160)}
          onKeyDown={e => { if (e.key === "Escape") { setOpen(false); setQ(""); ref.current?.blur() } e.stopPropagation() }}
          autoComplete="off"
        />
        {q && <button className="sb-clear" onMouseDown={e => { e.preventDefault(); setQ("") }}>×</button>}
      </div>

      {open && q && (
        <div className="sb-dropdown">
          {results.length === 0
            ? <p className="sb-empty">No results for "{q}"</p>
            : results.map(({ e, i }) => (
              <button key={e.eid} className="sb-result"
                onMouseDown={ev => { ev.preventDefault(); onSelect(i); setOpen(false); setQ("") }}>
                <img src={banner(e)} alt="" className="sb-result-img" />
                <div className="sb-result-info">
                  <span className="sb-result-name">{e.ename}</span>
                  <span className="sb-result-loc">{e.eventLoc}</span>
                </div>
                <span className={`rc-chip rc-chip--${e.status} rc-chip--xs`}>{e.status}</span>
              </button>
            ))
          }
        </div>
      )}
    </div>
  )
}

// ============================================================================
// DETAIL SHEET
// ============================================================================

function DetailSheet({ event, onClose, renderControls }) {
  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [onClose])

  return (
    <>
      <div className="ds-backdrop" onClick={onClose} />
      <aside className="ds-sheet" role="dialog" aria-modal="true" aria-label={event.ename}>
        <div className="ds-handle" />

        {/* Hero */}
        <div className="ds-hero">
          <img src={banner(event)} alt={event.ename} />
          <div className="ds-hero-scrim" />
          <button className="ds-close" onClick={onClose} aria-label="Close">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M1 1l11 11M12 1L1 12"/>
            </svg>
          </button>
          <div className="ds-hero-chips">
            <span className={`rc-chip rc-chip--${event.status}`}>
              {event.status === "ongoing" && <span className="rc-chip-dot" />}
              {event.status}
            </span>
            {event.is_team && <span className="rc-chip rc-chip--team">Team Event</span>}
            <span className="rc-chip rc-chip--fee" style={{ marginLeft: "auto" }}>
              {event.regFee > 0 ? `₹${event.regFee}` : "Free"}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="ds-body">
          <h2 className="ds-title">{event.ename}</h2>

          <div className="ds-meta">
            <div className="ds-meta-row">
              <span className="ds-meta-icon">📅</span>
              <div>
                <span className="ds-meta-label">Date & Time</span>
                <span className="ds-meta-val">{fmtDateLong(event.eventDate)} · {fmt12h(event.eventTime)}</span>
              </div>
            </div>
            <div className="ds-meta-row">
              <span className="ds-meta-icon">📍</span>
              <div>
                <span className="ds-meta-label">Venue</span>
                <span className="ds-meta-val">{event.eventLoc}</span>
              </div>
            </div>
            <div className="ds-meta-row">
              <span className="ds-meta-icon">🏛️</span>
              <div>
                <span className="ds-meta-label">Organizer</span>
                <span className="ds-meta-val">{event.organizerName || "Club"}</span>
              </div>
            </div>
            {event.is_team && (
              <div className="ds-meta-row">
                <span className="ds-meta-icon">👥</span>
                <div>
                  <span className="ds-meta-label">Team Size</span>
                  <span className="ds-meta-val">{event.min_team_size}–{event.max_team_size} members</span>
                </div>
              </div>
            )}
          </div>

          {event.eventdesc && (
            <div className="ds-about">
              <span className="ds-about-label">About</span>
              <p>{event.eventdesc}</p>
            </div>
          )}

          <div style={{ height: 100 }} />
        </div>

        {/* Sticky CTA */}
        <div className="ds-cta">
          {renderControls(event, true)}
        </div>
      </aside>
    </>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Registerevent() {
  const navigate = useNavigate()

  // ── data ──
  const [eventsData, setEventsData]             = useState({ upcoming: [], ongoing: [], completed: [] })
  const [loading, setLoading]                   = useState(true)
  const [filter, setFilter]                     = useState("all")
  const [viewMode, setViewMode]                 = useState("rail")
  const [teamStates, setTeamStates]             = useState({})
  const [registeredEvents, setRegisteredEvents] = useState(new Set())

  // ── ui ──
  const [flash, setFlash]               = useState({ type: "", message: "" })
  const [modalFlash, setModalFlash]     = useState({ type: "", message: "" })
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [ticketInfo, setTicketInfo]     = useState(null)

  // ── modals ──
  const [showTeamModal, setShowTeamModal]   = useState(null)
  const [teamFormData, setTeamFormData]     = useState({ teamName: "", memberUSNs: [""] })
  const [teamInvites, setTeamInvites]       = useState([])
  const [showUpiModal, setShowUpiModal]     = useState(null)
  const [transactionId, setTransactionId]  = useState("")
  const [isSubmitting, setIsSubmitting]    = useState(false)
  const [qrCodeDataUrl, setQrCodeDataUrl]  = useState("")

  // ── ambient bg ──
  const [hoveredEventId, setHoveredEventId] = useState(null)

  const timerRef      = useRef(null)
  const modalTimerRef = useRef(null)

  // ── flash helpers ──
  const showFlash = useCallback((type, message) => {
    clearTimeout(timerRef.current)
    setFlash({ type, message })
    timerRef.current = setTimeout(() => setFlash({ type: "", message: "" }), 4000)
  }, [])

  const showModalFlash = useCallback((type, message) => {
    clearTimeout(modalTimerRef.current)
    setModalFlash({ type, message })
    modalTimerRef.current = setTimeout(() => setModalFlash({ type: "", message: "" }), 4000)
  }, [])

  // ── loaders ──
  const loadEvents = useCallback(async () => {
    try {
      setLoading(true)
      const r = await fetch("/api/events", { credentials: "include" })
      if (r.status === 401) { navigate("/"); return }
      if (!r.ok) throw new Error()
      const d = await r.json()
      setEventsData({
        upcoming:  d?.events?.upcoming  || [],
        ongoing:   d?.events?.ongoing   || [],
        completed: d?.events?.completed || [],
      })
    } catch { showFlash("error", "Failed to load events") }
    finally { setLoading(false) }
  }, [navigate, showFlash])

  const fetchMyRegistrations = useCallback(async () => {
    try {
      const r = await fetch("/api/my-participant-events", { credentials: "include" })
      if (r.ok) {
        const d = await r.json()
        setRegisteredEvents(new Set(d.participantEvents.map(ev => ev.eid)))
      }
    } catch (e) { console.error(e) }
  }, [])

  const loadTeamStatus = useCallback(async (eventId) => {
    try {
      const r = await fetch(`/api/events/${eventId}/team-status`, { credentials: "include" })
      setTeamStates(p => ({ ...p, [eventId]: r.ok ? null : null }))
      if (r.ok) {
        const d = await r.json()
        setTeamStates(p => ({ ...p, [eventId]: d }))
      } else {
        setTeamStates(p => ({ ...p, [eventId]: null }))
      }
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { loadEvents(); fetchMyRegistrations() }, [loadEvents, fetchMyRegistrations])

  useEffect(() => {
    const active = [...(eventsData.upcoming || []), ...(eventsData.ongoing || [])]
    active.forEach(ev => loadTeamStatus(ev.eid))
  }, [eventsData, loadTeamStatus])

  useEffect(() => {
    document.body.style.overflow = (selectedEvent || showTeamModal || showUpiModal) ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [selectedEvent, showTeamModal, showUpiModal])

  // ── derived ──
  const allEvents = useMemo(() => [
    ...(eventsData.upcoming  || []).map(e => ({ ...e, status: "upcoming"  })),
    ...(eventsData.ongoing   || []).map(e => ({ ...e, status: "ongoing"   })),
    ...(eventsData.completed || []).map(e => ({ ...e, status: "completed" })),
  ], [eventsData])

  // Global ambient bg — color from hovered event or first event
  const globalColorMap = useColorExtraction(allEvents)
  const ambientColors  = globalColorMap[hoveredEventId] || globalColorMap[allEvents[0]?.eid] || DEFAULT_COLORS

  const statusCounts = useMemo(() => ({
    all:       allEvents.length,
    upcoming:  allEvents.filter(e => e.status === "upcoming").length,
    ongoing:   allEvents.filter(e => e.status === "ongoing").length,
    completed: allEvents.filter(e => e.status === "completed").length,
  }), [allEvents])

  const filteredEvents = useMemo(() => {
    const base = filter === "all" ? allEvents : allEvents.filter(e => e.status === filter)
    return base.filter(e => {
      if (e.status === "completed") return true
      if (teamStates[e.eid] === null) return false
      return true
    })
  }, [allEvents, filter, teamStates])

  const sections = useMemo(() => {
    const s = []
    const ongoing   = filteredEvents.filter(e => e.status === "ongoing")
    const upcoming  = filteredEvents.filter(e => e.status === "upcoming")
    const completed = filteredEvents.filter(e => e.status === "completed")
    if (ongoing.length)   s.push({ key: "ongoing",   label: "Happening Now", emoji: "🔴", events: ongoing   })
    if (upcoming.length)  s.push({ key: "upcoming",  label: "Coming Up",     emoji: "📅", events: upcoming  })
    if (completed.length) s.push({ key: "completed", label: "Past Events",   emoji: "✓",  events: completed })
    return s
  }, [filteredEvents])

  // QR generation
  useEffect(() => {
    if (showUpiModal) {
      const { event } = showUpiModal
      const p = new URLSearchParams({ pa: event.upiId, pn: event.ename, am: String(event.regFee), cu: "INR", tn: `Event Registration - ${event.eid}` })
      QRCode.toDataURL(`upi://pay?${p}`, { width: 280, margin: 2, color: { dark: "#000", light: "#fff" } }).then(setQrCodeDataUrl)
    } else setQrCodeDataUrl("")
  }, [showUpiModal])

  // ============================================================
  // ACTION HANDLERS
  // ============================================================

  async function handleRegister(event) {
    const hasFee = (event.regFee || 0) > 0
    if (hasFee) {
      if (!event.upiId) { showFlash("error", "Payment not configured"); return }
      setTransactionId(""); setModalFlash({ type: "", message: "" }); setShowUpiModal({ event, isTeam: false }); return
    }
    try {
      const r = await fetch(`/api/events/${event.eid}/join`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } })
      const d = await r.json()
      if (!r.ok) { showFlash("error", d.error || "Failed"); return }
      showFlash("success", "Registered!")
      setRegisteredEvents(p => new Set(p).add(event.eid))
      setTicketInfo({ eventName: event.ename, eventDate: event.eventDate, userUSN: d.userUSN || "AUTHORIZED" })
      await loadEvents()
    } catch { showFlash("error", "Network error") }
  }

  async function handleCreateTeam(eventId) {
    if (!teamFormData.teamName.trim()) { showModalFlash("error", "Team name required"); return }
    try {
      const r = await fetch(`/api/events/${eventId}/create-team`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName: teamFormData.teamName.trim(), memberUSNs: teamFormData.memberUSNs.filter(u => u.trim()) })
      })
      const d = await r.json()
      if (!r.ok) { showModalFlash("error", d.error); return }
      showModalFlash("success", "Team created!")
      setTimeout(() => { setShowTeamModal(null); setTeamFormData({ teamName: "", memberUSNs: [""] }); loadTeamStatus(eventId) }, 1500)
    } catch { showModalFlash("error", "Error creating team") }
  }

  async function handleViewInvites(eventId) {
    try {
      const r = await fetch(`/api/events/${eventId}/my-invites`, { credentials: "include" })
      const d = await r.json()
      if (!r.ok) { showFlash("error", d.error); return }
      if (!d.invites?.length) { showFlash("error", "No pending invites"); return }
      setTeamInvites(d.invites); setShowTeamModal({ eventId, mode: "invites" })
    } catch { showFlash("error", "Error loading invites") }
  }

  async function handleConfirmJoin(teamId, eventId) {
    try {
      const r = await fetch(`/api/teams/${teamId}/confirm-join`, { method: "POST", credentials: "include" })
      if (!r.ok) { showModalFlash("error", "Failed to join"); return }
      showModalFlash("success", "Joined team!")
      setTimeout(() => { setShowTeamModal(null); setTeamInvites([]); loadTeamStatus(eventId) }, 1500)
    } catch { showModalFlash("error", "Error") }
  }

  async function handleRegisterTeam(event, ts) {
    try {
      const r = await fetch(`/api/events/${event.eid}/register-team`, { method: "POST", credentials: "include" })
      const d = await r.json()
      if (!r.ok) { showFlash("error", d.error); return }
      if (d.requiresPayment) {
        if (!event.upiId) { showFlash("error", "Payment not configured"); return }
        setTransactionId(""); setShowUpiModal({ event, isTeam: true, teamId: ts.teamId }); return
      }
      showFlash("success", "Team registered!")
      setTicketInfo({ eventName: event.ename, eventDate: event.eventDate, userUSN: d.userUSN })
      await loadTeamStatus(event.eid); await loadEvents(); await fetchMyRegistrations()
    } catch { showFlash("error", "Error registering team") }
  }

  async function handleSubmitUpiPayment() {
    if (!transactionId.trim()) { showModalFlash("error", "Enter Transaction ID"); return }
    if (isSubmitting) return
    setIsSubmitting(true)
    const { event, isTeam } = showUpiModal
    const url = isTeam ? `/api/events/${event.eid}/register-team-upi` : `/api/events/${event.eid}/register-upi`
    try {
      const r = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transaction_id: transactionId.trim() }) })
      const d = await r.json()
      if (!r.ok) { showModalFlash("error", d.error); return }
      showModalFlash("success", "Submitted for verification!")
      setTimeout(async () => {
        setShowUpiModal(null); setTransactionId(""); showFlash("success", "Payment submitted!")
        setTicketInfo({ eventName: event.ename, eventDate: event.eventDate, userUSN: d.userUSN || "PENDING" })
        await loadEvents(); await loadTeamStatus(event.eid); await fetchMyRegistrations()
      }, 1500)
    } catch { showModalFlash("error", "Error submitting") }
    finally { setIsSubmitting(false) }
  }

  // ============================================================
  // RENDER CONTROLS
  // ============================================================

  function renderControls(event, isOverlay = false) {
    const ts = teamStates[event.eid]

    const posterBtn = event.posterUrl && isOverlay && (
      <button className="re-btn re-btn--ghost" onClick={e => { e.stopPropagation(); window.open(event.posterUrl, "_blank", "noopener") }}>
        View Poster ↗
      </button>
    )

    if (event.status === "completed")
      return <button className="re-btn re-btn--muted" disabled>Event Completed</button>

    if (!ts)
      return <button className="re-btn re-btn--muted" disabled>
        <span className="re-spinner-sm" />Loading…
      </button>

    // Solo event
    if (!ts.isTeamEvent) {
      if (registeredEvents.has(event.eid))
        return <div className="re-btn-row">
          <button className="re-btn re-btn--success" disabled>
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 5l3.5 3.5L11 1"/></svg>
            Registered
          </button>
          {posterBtn}
        </div>
      return <div className="re-btn-row">
        <button className="re-btn re-btn--primary" onClick={e => { e.stopPropagation(); handleRegister(event) }}>
          {event.regFee > 0 ? `Pay ₹${event.regFee}` : "Register — Free"}
        </button>
        {posterBtn}
      </div>
    }

    // Team event — done
    if (ts.registrationComplete)
      return <div className="re-btn-row">
        <button className="re-btn re-btn--success" disabled>
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 5l3.5 3.5L11 1"/></svg>
          Team Registered
        </button>
        {posterBtn}
      </div>

    // Team event — in a team
    if (ts.hasJoinedTeam) {
      return (
        <div className="re-team-block">
          {isOverlay && (
            <div className="re-team-hud">
              <div className="re-team-hud-hd">
                <span className="re-team-hud-name">{ts.teamName}</span>
                <span className={`re-team-hud-count ${ts.canRegister ? "ready" : ""}`}>
                  {ts.joinedCount}/{ts.minSize}
                </span>
              </div>
              <div className="re-member-list">
                {ts.members?.map((m, i) => (
                  <div key={i} className="re-member-row">
                    <span>{m.student?.sname || m.student_usn}</span>
                    <span className={`re-member-status ${m.join_status ? "joined" : "pending"}`}>
                      {m.join_status ? "✓ Joined" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="re-btn-row" style={{ marginTop: isOverlay ? 14 : 0 }}>
            {ts.isLeader
              ? <button
                  className={`re-btn ${ts.canRegister ? "re-btn--primary" : "re-btn--muted"}`}
                  disabled={!ts.canRegister}
                  onClick={e => { e.stopPropagation(); ts.canRegister && handleRegisterTeam(event, ts) }}
                  title={!ts.canRegister ? `Need ${ts.minSize} members` : ""}
                >
                  {ts.regFee > 0 ? `Pay ₹${ts.regFee}` : "Finalize Team"}
                </button>
              : <button className="re-btn re-btn--muted" disabled>Waiting for leader</button>
            }
            {posterBtn}
          </div>
        </div>
      )
    }

    // Team event — not in a team
    return (
      <div className="re-btn-row">
        <button className="re-btn re-btn--secondary" onClick={e => { e.stopPropagation(); setShowTeamModal({ eventId: event.eid, mode: "create" }) }}>
          Create Team
        </button>
        <button className="re-btn re-btn--secondary" onClick={e => { e.stopPropagation(); handleViewInvites(event.eid) }}>
          Invites
        </button>
        {posterBtn}
      </div>
    )
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <main className="re-page">
      {ticketInfo && <TicketAnimation onClose={() => setTicketInfo(null)} {...ticketInfo} />}

      {/* ── DYNAMIC AMBIENT BACKGROUND ── */}
      <div
        className="re-ambient"
        style={{
          background: `
            radial-gradient(ellipse 80% 55% at 15% 8%,  ${ambientColors[0]}48 0%, transparent 55%),
            radial-gradient(ellipse 65% 50% at 85% 85%, ${ambientColors[1]}3a 0%, transparent 55%),
            radial-gradient(ellipse 50% 45% at 55% 50%, ${ambientColors[2]}22 0%, transparent 60%),
            #09090c
          `,
          transition: "background 0.85s cubic-bezier(0.4,0,0.2,1)",
        }}
        aria-hidden="true"
      />
      <div className="re-grain" aria-hidden="true" />

      {/* ── TOAST ── */}
      {flash.message && (
        <div className={`re-toast re-toast--${flash.type}`} role="alert">
          {flash.type === "success"
            ? <svg width="12" height="10" viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 5l3.5 3.5L11 1"/></svg>
            : <span aria-hidden="true">!</span>}
          {flash.message}
        </div>
      )}

      {/* ── HEADER ── */}
      <header className="re-header">
        <div className="re-header-left">
          <button className="re-back-btn" onClick={() => navigate("/events")}>
            <svg width="14" height="12" viewBox="0 0 14 12" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M13 6H1M6 1L1 6l5 5"/>
            </svg>
            <span>Dashboard</span>
          </button>
          <div className="re-header-title">
            <h1>Events</h1>
            {!loading && <span className="re-event-count">{filteredEvents.length}</span>}
          </div>
        </div>

        <div className="re-header-right">
          {!loading && allEvents.length > 0 && (
            <SearchBar events={filteredEvents} onSelect={() => setViewMode("grid")} />
          )}
          <div className="re-view-toggle" role="group" aria-label="View mode">
            <button className={`re-view-btn ${viewMode === "rail" ? "active" : ""}`}
              onClick={() => setViewMode("rail")} title="Card view">
              <svg viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="11">
                <rect x="1" y="1" width="8" height="12" rx="2"/>
                <rect x="11" y="1" width="8" height="12" rx="2" opacity="0.35"/>
              </svg>
            </button>
            <button className={`re-view-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")} title="Grid view">
              <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13">
                <rect x="0" y="0" width="7" height="7" rx="1.5"/>
                <rect x="9" y="0" width="7" height="7" rx="1.5" opacity="0.35"/>
                <rect x="0" y="9" width="7" height="7" rx="1.5" opacity="0.35"/>
                <rect x="9" y="9" width="7" height="7" rx="1.5" opacity="0.35"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ── FILTER BAR ── */}
      <nav className="re-filter-bar" aria-label="Filter events">
        {["all", "ongoing", "upcoming", "completed"].map(k => (
          <button key={k}
            className={`re-filter-tab ${filter === k ? "active" : ""}`}
            onClick={() => setFilter(k)}>
            {k === "ongoing" && <span className="re-live-dot" aria-hidden="true" />}
            {k === "all" ? "All Events" : k.charAt(0).toUpperCase() + k.slice(1)}
            <span className="re-filter-count">{statusCounts[k]}</span>
          </button>
        ))}
      </nav>

      {/* ── CONTENT ── */}
      <div className="re-content">
        {loading ? (
          /* Skeleton loading */
          <div className="re-sections">
            <section className="re-section">
              <div className="re-section-header">
                <div className="sk-heading" />
              </div>
              <div className="sk-rail">
                {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
              </div>
            </section>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="re-empty">
            <div className="re-empty-icon">✦</div>
            <h3>No events found</h3>
            <p>Try a different filter or check back later.</p>
            {filter !== "all" && (
              <button className="re-btn re-btn--secondary" style={{ marginTop: 16 }} onClick={() => setFilter("all")}>
                Show all events
              </button>
            )}
          </div>
        ) : viewMode === "rail" ? (
          /* ── SECTIONED RAILS ── */
          <div className="re-sections">
            {sections.map(sec => (
              <section key={sec.key} className="re-section">
                <div className="re-section-header">
                  <span className={`re-section-pip re-section-pip--${sec.key}`} aria-hidden="true" />
                  <h2 className="re-section-title">{sec.label}</h2>
                  <span className="re-section-count">{sec.events.length}</span>
                </div>
                {/* Wrap each card so we can track hover for ambient bg */}
                <div className="rc-rail-hover-wrap">
                  {sec.events.map(ev => (
                    <div key={ev.eid} style={{ display: "contents" }}
                      onMouseEnter={() => setHoveredEventId(ev.eid)}
                      onMouseLeave={() => setHoveredEventId(null)}>
                    </div>
                  ))}
                </div>
                <CardRail
                  events={sec.events}
                  onOpen={setSelectedEvent}
                  renderControls={renderControls}
                />
              </section>
            ))}
          </div>
        ) : (
          /* ── GRID VIEW ── */
          <div className="re-grid">
            {filteredEvents.map((ev, i) => (
              <div key={ev.eid}
                style={{ animationDelay: `${Math.min(i * 0.04, 0.4)}s` }}
                onMouseEnter={() => setHoveredEventId(ev.eid)}
                onMouseLeave={() => setHoveredEventId(null)}>
                <GridCard event={ev} onOpen={setSelectedEvent} renderControls={renderControls} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── DETAIL SHEET ── */}
      {selectedEvent && (
        <DetailSheet
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          renderControls={renderControls}
        />
      )}

      {/* ── TEAM MODAL ── */}
      {showTeamModal && (
        <div className="re-modal-overlay" onClick={() => setShowTeamModal(null)}>
          <div className="re-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="re-modal-header">
              <h2>{showTeamModal.mode === "create" ? "Create Team" : "Pending Invites"}</h2>
              <button className="re-modal-close" onClick={() => setShowTeamModal(null)}>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 1l9 9M10 1L1 10"/></svg>
              </button>
            </div>
            {modalFlash.message && (
              <div className={`re-modal-flash re-modal-flash--${modalFlash.type}`}>{modalFlash.message}</div>
            )}
            <div className="re-modal-body">
              {showTeamModal.mode === "create" ? (
                <>
                  <label className="re-label">Team Name</label>
                  <input className="re-input" placeholder="e.g. Code Ninjas"
                    value={teamFormData.teamName}
                    onChange={e => setTeamFormData(p => ({ ...p, teamName: e.target.value }))} />

                  <label className="re-label" style={{ marginTop: 20 }}>Member USNs</label>
                  {teamFormData.memberUSNs.map((usn, i) => (
                    <div key={i} className="re-usn-row">
                      <input className="re-input" placeholder={`Member ${i + 1} USN`} value={usn}
                        onChange={e => { const a = [...teamFormData.memberUSNs]; a[i] = e.target.value; setTeamFormData(p => ({ ...p, memberUSNs: a })) }} />
                      {i > 0 && (
                        <button className="re-usn-remove"
                          onClick={() => setTeamFormData(p => ({ ...p, memberUSNs: p.memberUSNs.filter((_, j) => j !== i) }))}>×</button>
                      )}
                    </div>
                  ))}
                  <button className="re-add-member-btn"
                    onClick={() => setTeamFormData(p => ({ ...p, memberUSNs: [...p.memberUSNs, ""] }))}>
                    + Add Member
                  </button>
                  <button className="re-btn re-btn--primary" style={{ width: "100%", marginTop: 24 }}
                    onClick={() => handleCreateTeam(showTeamModal.eventId)}>
                    Create Team
                  </button>
                </>
              ) : (
                <>
                  {!teamInvites.length
                    ? <p className="re-modal-empty">No pending invites.</p>
                    : teamInvites.map((inv, i) => (
                      <div key={i} className="re-invite-card">
                        <div>
                          <div className="re-invite-team">{inv.teamName}</div>
                          <div className="re-invite-leader">Leader: {inv.leaderName}</div>
                        </div>
                        {!inv.registrationComplete && !inv.joinStatus
                          ? <button className="re-btn re-btn--primary" style={{ width: "auto", padding: "8px 20px" }}
                              onClick={() => handleConfirmJoin(inv.teamId, showTeamModal.eventId)}>Join</button>
                          : <span className="re-invite-joined">✓ Joined</span>
                        }
                      </div>
                    ))
                  }
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── UPI MODAL ── */}
      {showUpiModal && (
        <div className="re-modal-overlay" onClick={() => !isSubmitting && setShowUpiModal(null)}>
          <div className="re-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="re-modal-header">
              <h2>Complete Payment</h2>
              <button className="re-modal-close" disabled={isSubmitting} onClick={() => setShowUpiModal(null)}>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 1l9 9M10 1L1 10"/></svg>
              </button>
            </div>
            {modalFlash.message && (
              <div className={`re-modal-flash re-modal-flash--${modalFlash.type}`}>{modalFlash.message}</div>
            )}
            <div className="re-modal-body re-upi-body">
              <p className="re-upi-event">{showUpiModal.event.ename}</p>
              <div className="re-upi-amount">₹{showUpiModal.event.regFee}</div>
              <div className="re-qr-box">
                {qrCodeDataUrl
                  ? <img src={qrCodeDataUrl} alt="UPI QR Code" width={220} height={220} />
                  : <div className="re-qr-loader"><div className="re-spinner" /></div>
                }
              </div>
              <div className="re-upi-id-row">
                <span className="re-upi-id-label">UPI ID</span>
                <span className="re-upi-id-value">{showUpiModal.event.upiId}</span>
              </div>
              <label className="re-label" style={{ marginTop: 20, display: "block", textAlign: "left" }}>Transaction ID (UTR)</label>
              <input className="re-input" placeholder="e.g. 401234567890" value={transactionId}
                onChange={e => setTransactionId(e.target.value)} disabled={isSubmitting} />
              <button className="re-btn re-btn--primary" style={{ width: "100%", marginTop: 12 }}
                onClick={handleSubmitUpiPayment} disabled={isSubmitting}>
                {isSubmitting ? <><span className="re-spinner-sm" />Verifying…</> : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
