"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import QRCode from "qrcode"
import "./registerevent.css"

// Get the base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function formatTime12h(timeString) {
  if (!timeString) return "Time TBA"
  const [hours, minutes] = String(timeString).split(":")
  const hour24 = Number.parseInt(hours, 10)
  if (Number.isNaN(hour24)) return "Time TBA"
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24
  const ampm = hour24 >= 12 ? "PM" : "AM"
  return `${hour12}:${minutes} ${ampm}`
}

export default function Registerevent() {
  const navigate = useNavigate()
  const [eventsData, setEventsData] = useState({ upcoming: [], ongoing: [], completed: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState("all")
  const [flash, setFlash] = useState({ type: "", message: "" })
  const [modalFlash, setModalFlash] = useState({ type: "", message: "" })
  const [teamStates, setTeamStates] = useState({})
  const [showTeamModal, setShowTeamModal] = useState(null)
  const [teamFormData, setTeamFormData] = useState({
    teamName: '',
    memberUSNs: ['']
  })
  const [teamInvites, setTeamInvites] = useState([])
  const [registeredEvents, setRegisteredEvents] = useState(new Set())
  const timerRef = useRef(null)
  const modalTimerRef = useRef(null)

  const [showUpiModal, setShowUpiModal] = useState(null)
  const [transactionId, setTransactionId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("")

  // Debug log for API URL
  useEffect(() => {
    console.log('🔍 API_BASE_URL:', API_BASE_URL);
    if (!API_BASE_URL) {
      console.warn('⚠️ VITE_API_BASE_URL is not defined in environment variables');
    }
  }, [])

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

  // Generate UPI payment URL
  function generateUpiUrl(upiId, eventName, amount, eventId) {
    const params = new URLSearchParams({
      pa: upiId,
      pn: eventName,
      am: amount.toString(),
      cu: "INR",
      tn: `Event Registration - ${eventId}`
    })
    return `upi://pay?${params.toString()}`
  }

  // Generate QR Code from UPI URL
  async function generateQRCode(upiUrl) {
    try {
      const qrDataUrl = await QRCode.toDataURL(upiUrl, {
        width: 280,
        margin: 2,
        color: {
          dark: '#0b0e14',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      })
      setQrCodeDataUrl(qrDataUrl)
    } catch (err) {
      console.error('Error generating QR code:', err)
      showModalFlash('error', 'Failed to generate QR code')
    }
  }

  // Generate QR when UPI modal opens
  useEffect(() => {
    if (showUpiModal) {
      const { event } = showUpiModal
      const upiUrl = generateUpiUrl(
        event.upiId,
        event.ename,
        event.regFee,
        event.eid
      )
      generateQRCode(upiUrl)
    } else {
      setQrCodeDataUrl("")
    }
  }, [showUpiModal])

  async function loadEvents() {
    try {
      setLoading(true)
      setError("")
      
      const url = `${API_BASE_URL}/api/events`
      console.log('🌐 Fetching events from:', url)
      
      const response = await fetch(url, { 
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        }
      })
      
      console.log('📡 Response status:', response.status)
      
      if (response.status === 401) {
        navigate('/')
        return
      }
      
      if (!response.ok) {
        const text = await response.text()
        console.error('❌ Response error:', text)
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('✅ Events loaded successfully:', data)
      
      setEventsData({
        upcoming: data?.events?.upcoming || [],
        ongoing: data?.events?.ongoing || [],
        completed: data?.events?.completed || [],
      })
    } catch (err) {
      console.error("Error loading events:", err)
      setError(err?.message || "Failed to load events")
    } finally {
      setLoading(false)
    }
  }

  async function loadTeamStatus(eventId) {
    try {
      const url = `${API_BASE_URL}/api/events/${eventId}/team-status`
      console.log('🔍 Loading team status from:', url)
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        console.error('Failed to load team status for event', eventId)
        return
      }

      const data = await response.json()
      console.log('Team status for event', eventId, ':', data)
      setTeamStates(prev => ({
        ...prev,
        [eventId]: data
      }))
    } catch (err) {
      console.error('Error loading team status:', err)
    }
  }

  async function fetchMyRegistrations() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/my-participant-events`, { 
        credentials: 'include' 
      })
      if (!res.ok) return
      const data = await res.json()
      const eventIds = new Set(data.participantEvents.map(ev => ev.eid))
      setRegisteredEvents(eventIds)
      console.log('My registrations loaded:', eventIds)
    } catch (err) {
      console.error('Error loading registrations:', err)
    }
  }

  useEffect(() => {
    loadEvents()
    fetchMyRegistrations()
    
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (modalTimerRef.current) clearTimeout(modalTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const upcomingEvents = eventsData.upcoming || []
    console.log('Loading team status for upcoming events:', upcomingEvents.length)
    upcomingEvents.forEach(event => {
      loadTeamStatus(event.eid)
    })
  }, [eventsData.upcoming])

  const allEvents = useMemo(() => {
    return [
      ...(eventsData.upcoming || []).map((e) => ({ ...e, status: "upcoming", upiId: e.upiId })), 
      ...(eventsData.ongoing || []).map((e) => ({ ...e, status: "ongoing" })),
      ...(eventsData.completed || []).map((e) => ({ ...e, status: "completed" })),
    ]
  }, [eventsData])

  const filteredEvents = useMemo(() => {
    if (filter === "all") {
      return allEvents
    }
    return allEvents.filter((e) => e.status === filter)
  }, [allEvents, filter])

  async function handleRegister(event) {
    const hasFee = (event.regFee || 0) > 0
    const eventId = event.eid

    if (hasFee) {
      if (!event.upiId) {
        showFlash("error", "Organizer has not set up payments for this event.")
        return
      }
      console.log('Showing UPI modal for event:', event)
      setTransactionId("")
      setModalFlash({ type: "", message: "" })
      setShowUpiModal({ event, isTeam: false })
      return
    }

    // Logic for FREE events
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/join`, {
        method: "POST",
        credentials: "include",
        headers: { 
          "Content-Type": "application/json" 
        }
      })
      
      const data = await response.json().catch(() => ({}))
      
      if (!response.ok) {
        if (response.status === 401) {
          showFlash("error", "Please sign in to register for events")
          setTimeout(() => navigate('/'), 2000)
          return
        }
        showFlash("error", data?.error || data?.message || "Registration failed")
        return
      }
      
      showFlash("success", data?.message || "Successfully registered for the event!")
      setRegisteredEvents(prev => new Set(prev).add(eventId))
      await loadEvents()
    } catch (err) {
      console.error("Registration error:", err)
      showFlash("error", "Registration failed. Please try again.")
    }
  }

  async function handleCreateTeam(eventId) {
    try {
      const { teamName, memberUSNs } = teamFormData
      
      if (!teamName.trim()) {
        showModalFlash('error', 'Please enter a team name')
        return
      }

      const validUSNs = memberUSNs.filter(usn => usn.trim() !== '')

      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/create-team`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: teamName.trim(),
          memberUSNs: validUSNs
        })
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const errorMsg = data?.error || 'Failed to create team'
        showModalFlash('error', errorMsg)
        return
      }

      const successMsg = data?.message || 'Team created successfully!'
      showModalFlash('success', successMsg)
      
      setTimeout(() => {
        setShowTeamModal(null)
        setTeamFormData({ teamName: '', memberUSNs: [''] })
        loadTeamStatus(eventId)
      }, 1500)
    } catch (err) {
      console.error('Error creating team:', err)
      const errorMsg = 'Error creating team'
      showModalFlash('error', errorMsg)
    }
  }

  async function handleViewInvites(eventId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/my-invites`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const errorMsg = data?.error || 'Failed to load invites'
        showFlash('error', errorMsg)
        return
      }

      if (!data.invites || data.invites.length === 0) {
        showFlash('info', 'You have no team invites for this event')
        setTeamInvites([])
      } else {
        setTeamInvites(data.invites)
      }
      
      setShowTeamModal({ eventId, mode: 'invites' })
    } catch (err) {
      console.error('Error loading invites:', err)
      showFlash('error', 'Error loading invites')
    }
  }

  async function handleConfirmJoin(teamId, eventId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/teams/${teamId}/confirm-join`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const errorMsg = data?.error || 'Failed to join team'
        showModalFlash('error', errorMsg)
        return
      }

      const successMsg = data?.message || 'Successfully joined team!'
      showModalFlash('success', successMsg)
      
      setTimeout(() => {
        setShowTeamModal(null)
        setTeamInvites([])
        loadTeamStatus(eventId)
      }, 1500)
    } catch (err) {
      console.error('Error confirming join:', err)
      const errorMsg = 'Error confirming join'
      showModalFlash('error', errorMsg)
    }
  }  

  async function handleRegisterTeam(event, teamState) {
    const eventId = event.eid
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/register-team`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        showFlash('error', data?.error || 'Failed to register team')
        return
      }

      if (data.requiresPayment) {
        if (!event.upiId) {
          showFlash("error", "Organizer has not set up payments for this event.")
          return
        }
        console.log('Showing UPI modal for TEAM event:', event)
        setTransactionId("")
        setModalFlash({ type: "", message: "" })
        setShowUpiModal({ event, isTeam: true, teamId: teamState.teamId })
        return
      }

      showFlash('success', data?.message || 'Team registered successfully!')
      await loadTeamStatus(eventId)
      await loadEvents()
      await fetchMyRegistrations()
    } catch (err) {
      console.error('Error registering team:', err)
      showFlash('error', 'Error registering team')
    }
  }

  function addMemberField() {
    setTeamFormData(prev => ({
      ...prev,
      memberUSNs: [...prev.memberUSNs, '']
    }))
  }

  function removeMemberField(index) {
    setTeamFormData(prev => ({
      ...prev,
      memberUSNs: prev.memberUSNs.filter((_, i) => i !== index)
    }))
  }

  function updateMemberUSN(index, value) {
    setTeamFormData(prev => ({
      ...prev,
      memberUSNs: prev.memberUSNs.map((usn, i) => i === index ? value : usn)
    }))
  }

  async function handleSubmitUpiPayment() {
    if (!transactionId.trim()) {
      showModalFlash('error', 'Please enter a valid Transaction ID')
      return
    }

    if (isSubmitting) return
    setIsSubmitting(true)

    const { event, isTeam } = showUpiModal
    const eventId = event.eid

    const url = isTeam
      ? `${API_BASE_URL}/api/events/${eventId}/register-team-upi`
      : `${API_BASE_URL}/api/events/${eventId}/register-upi`
    
    const body = JSON.stringify({
      transaction_id: transactionId.trim()
    })

    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: body
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const errorMsg = data?.error || 'Failed to submit payment'
        showModalFlash('error', errorMsg)
        return
      }

      const successMsg = data?.message || 'Registration submitted for verification!'
      showModalFlash('success', successMsg)

      setTimeout(async () => {
        setShowUpiModal(null)
        setTransactionId("")
        showFlash('success', successMsg)
        await loadEvents()
        await loadTeamStatus(eventId)
        await fetchMyRegistrations()
      }, 1500)

    } catch (err) {
      console.error('Error submitting UPI payment:', err)
      showModalFlash('error', 'An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleGoBack() {
    navigate('/events')
  }

  function renderTeamControls(event) {
    const teamState = teamStates[event.eid]
    
    if (!teamState) {
      return (
        <div className="registerevent-team-loading">
          Loading...
        </div>
      )
    }

    if (!teamState.isTeamEvent) {
      if (registeredEvents.has(event.eid)) {
        return (
          <div className="registerevent-team-badge registerevent-badge-success">
            ✓ Registered
          </div>
        )
      }

      return (
        <button
          type="button"
          className="registerevent-register-btn"
          onClick={() => handleRegister(event)}
        >
          <span className="registerevent-btn-border" />
          <span className="registerevent-btn-fill" />
          <span className="registerevent-btn-label">
            { (event.regFee || 0) > 0 ? `Pay & Register (₹${event.regFee})` : "Register (Free)" }
          </span>
        </button>
      )
    }

    if (teamState.registrationComplete) {
      return (
        <div className="registerevent-team-badge registerevent-badge-success">
          ✓ Team Registered
        </div>
      )
    }

    if (teamState.hasJoinedTeam) {
      if (teamState.isLeader) {
        return (
          <div className="registerevent-team-controls">
            <div className="registerevent-team-info">
              <div className="registerevent-team-name">Team: {teamState.teamName}</div>
              <div className="registerevent-team-status">
                {teamState.joinedCount} / {teamState.minSize} members joined
                {teamState.maxSize && ` (Max: ${teamState.maxSize})`}
              </div>
              {event.maxPart && (
                <div className="registerevent-team-status" style={{fontSize: '12px', color: 'var(--re-muted)', marginTop: '4px'}}>
                  Event Limit: {event.maxPart} teams
                </div>
              )}
            </div>
            
            {teamState.canRegister ? (
              <button
                type="button"
                className="registerevent-register-btn"
                onClick={() => handleRegisterTeam(event, teamState)}
              >
                <span className="registerevent-btn-border" />
                <span className="registerevent-btn-fill" />
                <span className="registerevent-btn-label">
                  { (teamState.regFee || 0) > 0 ? `Pay & Register Team (₹${teamState.regFee})` : "Register Team (Free)" }
                </span>
              </button>
            ) : (
              <div className="registerevent-team-waiting">
                Waiting for {teamState.minSize - teamState.joinedCount} more member(s)
              </div>
            )}
            
            {teamState.members && teamState.members.length > 0 && (
              <div className="registerevent-team-members-list">
                <div className="registerevent-team-members-title">Team Members:</div>
                {teamState.members.map((member, idx) => (
                  <div key={idx} className="registerevent-team-member-item">
                    <span>{member.student?.sname || member.student_usn}</span>
                    <span className={member.join_status ? "registerevent-status-joined" : "registerevent-status-pending"}>
                      {member.join_status ? "✓ Joined" : "⏳ Pending"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      } else {
        return (
          <div className="registerevent-team-controls">
            <div className="registerevent-team-info">
              <div className="registerevent-team-name">Team: {teamState.teamName}</div>
              <div className="registerevent-team-status">
                Leader: {teamState.leaderName || teamState.leaderUSN}
              </div>
              <div className="registerevent-team-status">
                {teamState.joinedCount} / {teamState.minSize} members joined
              </div>
            </div>
            
            {teamState.members && teamState.members.length > 0 && (
              <div className="registerevent-team-members-list">
                <div className="registerevent-team-members-title">Team Members:</div>
                {teamState.members.map((member, idx) => (
                  <div key={idx} className="registerevent-team-member-item">
                    <span>{member.student?.sname || member.student_usn}</span>
                    <span className={member.join_status ? "registerevent-status-joined" : "registerevent-status-pending"}>
                      {member.join_status ? "✓ Joined" : "⏳ Pending"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      }
    }

    return (
      <div className="registerevent-team-actions">
        <button
          type="button"
          className="registerevent-team-action-btn"
          onClick={() => {
            setModalFlash({ type: "", message: "" })
            setTeamFormData({ teamName: '', memberUSNs: [''] })
            setShowTeamModal({ eventId: event.eid, mode: 'create' })
          }}
        >
          <span className="registerevent-btn-border" />
          <span className="registerevent-btn-fill" />
          <span className="registerevent-btn-label">Create Team</span>
        </button>
        <button
          type="button"
          className="registerevent-team-action-btn"
          onClick={() => {
            setModalFlash({ type: "", message: "" })
            handleViewInvites(event.eid)
          }}
        >
          <span className="registerevent-btn-border" />
          <span className="registerevent-btn-fill" />
          <span className="registerevent-btn-label">View Invites</span>
        </button>
      </div>
    )
  }

  return (
    <main className="registerevent-page">
      <div className="registerevent-hero-bg" aria-hidden="true" />

      <div className="registerevent-container">
        <div className="registerevent-surface">
          {flash.message && (
            <div
              className={`registerevent-flash ${
                flash.type === "success" ? "registerevent-flash-success" : (flash.type === "info" ? "registerevent-flash-info" : "registerevent-flash-error")
              }`}
              role={flash.type === "error" ? "alert" : "status"}
              aria-live={flash.type === "error" ? "assertive" : "polite"}
            >
              {flash.message}
            </div>
          )}

          <div className="registerevent-header">
            <div className="registerevent-header-text">
              <h1 className="registerevent-title">All Events</h1>
              <p className="registerevent-subtitle">Discover and join events happening around you</p>
            </div>

            <div className="registerevent-filters" role="tablist" aria-label="Event filters">
              {["all", "upcoming", "ongoing", "completed"].map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={filter === key}
                  className={`registerevent-filter-btn${filter === key ? " registerevent-filter-active" : ""}`}
                  onClick={() => setFilter(key)}
                >
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div className="registerevent-state">
              <div className="registerevent-spinner" />
              <p className="registerevent-muted">Loading events...</p>
            </div>
          )}

          {!loading && error && (
            <div className="registerevent-state">
              <p className="registerevent-error">Failed to load events</p>
              <button type="button" className="registerevent-retry-btn" onClick={loadEvents}>
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && filteredEvents.length === 0 && (
            <div className="registerevent-state">
              <p className="registerevent-muted">No events found for "{filter}"</p>
            </div>
          )}

          {!loading && !error && filteredEvents.length > 0 && (
            <div className="registerevent-list">
              {filteredEvents.map((event) => {
                const dateStr = event?.eventDate ? new Date(event.eventDate) : null
                const formattedDate = dateStr
                  ? dateStr.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                  : "Date TBA"
                const fee = event?.regFee || 0
                const feeText = fee > 0 ? `₹${fee}` : "Free"

                return (
                  <article 
                    key={event.eid} 
                    className="registerevent-card" 
                    aria-labelledby={`event-${event.eid}-title`}
                  >
                    <div className="registerevent-card-top">
                      <div className="registerevent-card-title-wrap">
                        <h2 id={`event-${event.eid}-title`} className="registerevent-card-title">
                          {event.ename}
                        </h2>
                        <span className={`registerevent-badge registerevent-badge-${event.status}`}>
                          {event.status}
                        </span>
                        {event.is_team && (
                          <span className="registerevent-badge registerevent-badge-team">
                            Team Event
                          </span>
                        )}
                      </div>

                      {event.status === "upcoming" && renderTeamControls(event)}
                    </div>

                    {event.eventdesc && (
                      <p className="registerevent-card-desc">{event.eventdesc}</p>
                    )}

                    <h3 className="registerevent-section-title">Event Details</h3>
                    <div className="registerevent-details">
                      <div className="registerevent-detail-row">
                        <p className="registerevent-detail-label">Date & Time</p>
                        <p className="registerevent-detail-value">
                          {formattedDate}, {formatTime12h(event.eventTime)}
                        </p>
                      </div>
                      
                      <div className="registerevent-detail-row">
                        <p className="registerevent-detail-label">Location</p>
                        <p className="registerevent-detail-value">{event.eventLoc || "Location TBA"}</p>
                      </div>
                      
                      <div className="registerevent-detail-row">
                        <p className="registerevent-detail-label">Organizer</p>
                        <p className="registerevent-detail-value">
                          {event.organizerName || event.clubName || "Event Organizer"}
                        </p>
                      </div>
                      
                      <div className="registerevent-detail-row">
                        <p className="registerevent-detail-label">Registration Fee</p>
                        <p className="registerevent-detail-value">{feeText}</p>
                      </div>

                      {event.is_team && (
                        <>
                          <div className="registerevent-detail-row">
                            <p className="registerevent-detail-label">Team Size</p>
                            <p className="registerevent-detail-value">
                              {event.min_team_size} - {event.max_team_size} members
                            </p>
                          </div>
                        </>
                      )}
                      
                      {!event.is_team && event.maxPart && (
                        <div className="registerevent-detail-row">
                          <p className="registerevent-detail-label">Max Participants</p>
                          <p className="registerevent-detail-value">{event.maxPart}</p>
                        </div>
                      )}
                      
                      {event.maxVoln && (
                        <div className="registerevent-detail-row">
                          <p className="registerevent-detail-label">Max Volunteers</p>
                          <p className="registerevent-detail-value">{event.maxVoln}</p>
                        </div>
                      )}
                    </div>

                    <h3 className="registerevent-section-title">About the Event</h3>
                    <div className="registerevent-about">
                      {event.eventdesc ||
                        "Join us for this exciting event! More details will be available soon. Don't miss this opportunity to be part of something special."}
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          <div className="registerevent-back">
            <button
              type="button"
              className="registerevent-back-btn"
              onClick={handleGoBack}
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      {showTeamModal && (
        <div className="registerevent-modal-overlay" onClick={() => setShowTeamModal(null)}>
          <div className="registerevent-modal" onClick={(e) => e.stopPropagation()}>
            <div className="registerevent-modal-header">
              <h2 className="registerevent-modal-title">
                {showTeamModal.mode === 'create' ? 'Create Team' : 'Team Invites'}
              </h2>
              <button 
                className="registerevent-modal-close"
                onClick={() => setShowTeamModal(null)}
              >
                ×
              </button>
            </div>

            <div className="registerevent-modal-body">
              {modalFlash.message && (
                <div
                  className={`registerevent-flash ${
                    modalFlash.type === "success" ? "registerevent-flash-success" : "registerevent-flash-error"
                  }`}
                  role={modalFlash.type === "error" ? "alert" : "status"}
                  aria-live={modalFlash.type === "error" ? "assertive" : "polite"}
                  style={{ marginBottom: '16px' }}
                >
                  {modalFlash.message}
                </div>
              )}

              {showTeamModal.mode === 'create' ? (
                <div className="registerevent-team-form">
                  <div className="registerevent-form-group">
                    <label className="registerevent-form-label">Team Name</label>
                    <input
                      type="text"
                      className="registerevent-form-input"
                      value={teamFormData.teamName}
                      onChange={(e) => setTeamFormData(prev => ({ ...prev, teamName: e.target.value }))}
                      placeholder="Enter team name"
                    />
                  </div>

                  <div className="registerevent-form-group">
                    <label className="registerevent-form-label">Team Members (USNs)</label>
                    <p className="registerevent-form-hint">Add your team members' USNs. You are automatically the team leader.</p>
                    {teamFormData.memberUSNs.map((usn, index) => (
                      <div key={index} className="registerevent-member-input-row">
                        <input
                          type="text"
                          className="registerevent-form-input"
                          value={usn}
                          onChange={(e) => updateMemberUSN(index, e.target.value)}
                          placeholder="Enter USN"
                        />
                        {teamFormData.memberUSNs.length > 0 && index > 0 && (
                          <button
                            type="button"
                            className="registerevent-remove-btn"
                            onClick={() => removeMemberField(index)}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="registerevent-add-member-btn"
                      onClick={addMemberField}
                    >
                      + Add Member
                    </button>
                  </div>

                  <button
                    type="button"
                    className="registerevent-modal-submit-btn"
                    onClick={() => handleCreateTeam(showTeamModal.eventId)}
                  >
                    Create Team
                  </button>
                </div>
              ) : (
                <div className="registerevent-invites-list">
                  {teamInvites.length === 0 ? (
                    <div className="registerevent-no-invites">
                      <p>You have no pending team invites for this event.</p>
                    </div>
                  ) : (
                    <>
                      <p className="registerevent-invites-description">
                        You have been invited to join the following teams. Click "Confirm Join" to accept an invite.
                      </p>
                      {teamInvites.map((invite, index) => (
                        <div key={index} className="registerevent-invite-card">
                          <div className="registerevent-invite-info">
                            <div className="registerevent-invite-team-name">
                              {invite.teamName}
                            </div>
                            <div className="registerevent-invite-leader">
                              Leader: {invite.leaderName} ({invite.leaderUSN})
                            </div>
                            {invite.registrationComplete && (
                              <div className="registerevent-invite-status-badge">
                                Already Registered
                              </div>
                            )}
                          </div>
                          {!invite.registrationComplete && !invite.joinStatus && (
                            <button
                              type="button"
                              className="registerevent-invite-confirm-btn"
                              onClick={() => handleConfirmJoin(invite.teamId, showTeamModal.eventId)}
                            >
                              Confirm Join
                            </button>
                          )}
                          {invite.joinStatus && (
                            <div className="registerevent-invite-joined-badge">
                              ✓ Joined
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showUpiModal && (
        <div className="registerevent-modal-overlay" onClick={() => !isSubmitting && setShowUpiModal(null)}>
          <div className="registerevent-modal registerevent-upi-modal" onClick={(e) => e.stopPropagation()}>
            <div className="registerevent-modal-header">
              <h2 className="registerevent-modal-title">
                Complete Payment
              </h2>
              <button 
                className="registerevent-modal-close"
                onClick={() => !isSubmitting && setShowUpiModal(null)}
                disabled={isSubmitting}
              >
                ×
              </button>
            </div>

            <div className="registerevent-modal-body">
              {modalFlash.message && (
                <div
                  className={`registerevent-flash ${
                    modalFlash.type === "success" ? "registerevent-flash-success" : "registerevent-flash-error"
                  }`}
                  role={modalFlash.type === "error" ? "alert" : "status"}
                  aria-live={modalFlash.type === "error" ? "assertive" : "polite"}
                  style={{ marginBottom: '16px' }}
                >
                  {modalFlash.message}
                </div>
              )}

              <div className="registerevent-upi-container">
                {/* QR Code Section */}
                <div className="registerevent-qr-section">
                  <h3 className="registerevent-qr-title">Scan to Pay</h3>
                  {qrCodeDataUrl ? (
                    <div className="registerevent-qr-wrapper">
                      <img 
                        src={qrCodeDataUrl} 
                        alt="UPI Payment QR Code" 
                        className="registerevent-qr-image"
                      />
                    </div>
                  ) : (
                    <div className="registerevent-qr-loading">
                      <div className="registerevent-spinner" />
                      <p>Generating QR Code...</p>
                    </div>
                  )}
                  <p className="registerevent-qr-hint">
                    Scan this QR code with any UPI app
                  </p>
                </div>

                {/* OR Divider */}
                <div className="registerevent-divider">
                  <span>OR</span>
                </div>

                {/* Click to Pay Section */}
                <div className="registerevent-pay-section">
                  <h3 className="registerevent-pay-title">Pay via UPI App</h3>
                  <div className="registerevent-payment-details">
                    <div className="registerevent-payment-row">
                      <span className="registerevent-payment-label">Event:</span>
                      <span className="registerevent-payment-value">{showUpiModal.event.ename}</span>
                    </div>
                    <div className="registerevent-payment-row">
                      <span className="registerevent-payment-label">Amount:</span>
                      <span className="registerevent-payment-value registerevent-payment-amount">
                        ₹{showUpiModal.event.regFee}
                      </span>
                    </div>
                    <div className="registerevent-payment-row">
                      <span className="registerevent-payment-label">UPI ID:</span>
                      <span className="registerevent-payment-value registerevent-upi-id">
                        {showUpiModal.event.upiId}
                      </span>
                    </div>
                  </div>

                  <a
                    href={generateUpiUrl(
                      showUpiModal.event.upiId,
                      showUpiModal.event.ename,
                      showUpiModal.event.regFee,
                      showUpiModal.event.eid
                    )}
                    className="registerevent-upi-pay-btn"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                      <line x1="12" y1="18" x2="12.01" y2="18"></line>
                    </svg>
                    Open UPI App & Pay ₹{showUpiModal.event.regFee}
                  </a>
                </div>
              </div>

              {/* Transaction ID Section */}
              <div className="registerevent-transaction-section">
                <h3 className="registerevent-transaction-title">After Payment</h3>
                <p className="registerevent-transaction-hint">
                  Once payment is complete, enter your <strong>Transaction ID</strong> (e.g., T123456789) from your UPI app below:
                </p>
                
                <div className="registerevent-form-group" style={{marginTop: '16px'}}>
                  <label className="registerevent-form-label">Transaction ID *</label>
                  <input
                    type="text"
                    className="registerevent-form-input"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder="Enter Transaction ID"
                    disabled={isSubmitting}
                  />
                </div>

                <button
                  type="button"
                  className="registerevent-modal-submit-btn"
                  onClick={handleSubmitUpiPayment}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="registerevent-btn-spinner" />
                      Submitting...
                    </>
                  ) : (
                    "Submit & Complete Registration"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}
