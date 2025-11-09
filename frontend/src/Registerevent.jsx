"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
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

  useEffect(() => {
    loadEvents()
    
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

  useEffect(() => {
    async function loadMyRegistrations() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/my-participant-events`, { 
          credentials: 'include' 
        })
        if (!res.ok) return
        const data = await res.json()
        const eventIds = new Set(data.participantEvents.map(ev => ev.eid))
        setRegisteredEvents(eventIds)
      } catch (err) {
        console.error('Error loading registrations:', err)
      }
    }
    loadMyRegistrations()
  }, [])

  const allEvents = useMemo(() => {
    return [
      ...(eventsData.upcoming || []).map((e) => ({ ...e, status: "upcoming" })),
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

  async function handleRegister(eventId, hasFee) {
    if (hasFee) {
      await initiatePayment(eventId)
      return
    }

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
        showFlash('error', 'Please enter a team name')
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
        showFlash('error', errorMsg)
        return
      }

      const successMsg = data?.message || 'Team created successfully!'
      showModalFlash('success', successMsg)
      showFlash('success', successMsg)
      
      setTimeout(() => {
        setShowTeamModal(null)
        setTeamFormData({ teamName: '', memberUSNs: [''] })
        loadTeamStatus(eventId)
      }, 1500)
    } catch (err) {
      console.error('Error creating team:', err)
      const errorMsg = 'Error creating team'
      showModalFlash('error', errorMsg)
      showFlash('error', errorMsg)
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
        showFlash('error', 'You have no team invites for this event')
        return
      }

      setTeamInvites(data.invites)
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
        showFlash('error', errorMsg)
        return
      }

      const successMsg = data?.message || 'Successfully joined team!'
      showModalFlash('success', successMsg)
      showFlash('success', successMsg)
      
      setTimeout(() => {
        setShowTeamModal(null)
        setTeamInvites([])
        loadTeamStatus(eventId)
      }, 1500)
    } catch (err) {
      console.error('Error confirming join:', err)
      const errorMsg = 'Error confirming join'
      showModalFlash('error', errorMsg)
      showFlash('error', errorMsg)
    }
  }  

  async function handleRegisterTeam(eventId, hasFee) {
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
        showFlash('success', 'Opening payment...')
        await initiatePayment(eventId)
        return
      }

      showFlash('success', data?.message || 'Team registered successfully!')
      await loadTeamStatus(eventId)
      await loadEvents()
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

  function loadRazorpayScript() {
    return new Promise((resolve, reject) => {
      if (window.Razorpay) return resolve(true)
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      script.onerror = () => reject(new Error('Failed to load Razorpay script'))
      document.body.appendChild(script)
    })
  }

  async function initiatePayment(eventId) {
    try {
      showFlash('success', 'Preparing payment...')

      const resp = await fetch(`${API_BASE_URL}/api/create-order`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId })
      })

      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        if (resp.status === 401) {
          showFlash('error', 'Please sign in to continue')
          setTimeout(() => navigate('/'), 2000)
          return
        }
        showFlash('error', data?.error || data?.message || 'Could not create payment order')
        return
      }

      await loadRazorpayScript()

      const { order, key_id } = data
      if (!order || !order.id) {
        showFlash('error', 'Invalid order returned from server')
        return
      }

      const options = {
        key: key_id,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'E-Pass Events',
        description: `Registration for event ${eventId}`,
        order_id: order.id,
        handler: async function (response) {
          try {
            const verifyResp = await fetch(`${API_BASE_URL}/api/verify-payment`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                eventId
              })
            })

            const verifyData = await verifyResp.json().catch(() => ({}))
            if (!verifyResp.ok) {
              showFlash('error', verifyData?.error || 'Payment verification failed')
              return
            }

            showFlash('success', verifyData?.message || 'Payment successful and registered!')
            setRegisteredEvents(prev => new Set(prev).add(eventId))
            await loadEvents()
            await loadTeamStatus(eventId)
          } catch (err) {
            console.error('Verification error:', err)
            showFlash('error', 'Payment verification failed. Contact support.')
          }
        },
        modal: {
          ondismiss: function () {
            showFlash('error', 'Payment cancelled')
          }
        }
      }

      const rzp = new window.Razorpay(options)
      rzp.open()

    } catch (err) {
      console.error('initiatePayment error:', err)
      showFlash('error', 'Failed to start payment flow')
    }
  }

  function handleGoBack() {
    navigate('/events')
  }

  function renderTeamControls(event) {
    const teamState = teamStates[event.eid]
    
    console.log(`Rendering controls for event ${event.eid}:`, {
      hasTeamState: !!teamState,
      isTeamEvent: teamState?.isTeamEvent,
      hasJoinedTeam: teamState?.hasJoinedTeam,
      isLeader: teamState?.isLeader
    })
    
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
          onClick={() => handleRegister(event.eid, (event.regFee || 0) > 0)}
        >
          <span className="registerevent-btn-border" />
          <span className="registerevent-btn-fill" />
          <span className="registerevent-btn-label">Register</span>
        </button>
      )
    }

    if (teamState.registrationComplete) {
      return (
        <div className="registerevent-team-badge registerevent-badge-success">
          ✓ Registered
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
                onClick={() => handleRegisterTeam(event.eid, teamState.regFee > 0)}
              >
                <span className="registerevent-btn-border" />
                <span className="registerevent-btn-fill" />
                <span className="registerevent-btn-label">Register Team</span>
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
          onClick={() => setShowTeamModal({ eventId: event.eid, mode: 'create' })}
        >
          <span className="registerevent-btn-border" />
          <span className="registerevent-btn-fill" />
          <span className="registerevent-btn-label">Create Team</span>
        </button>
        <button
          type="button"
          className="registerevent-team-action-btn"
          onClick={() => handleViewInvites(event.eid)}
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
                flash.type === "success" ? "registerevent-flash-success" : "registerevent-flash-error"
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
              <p className="registerevent-muted">No events found</p>
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
                        {teamFormData.memberUSNs.length > 1 && (
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
                      <p>You have no team invites for this event.</p>
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
    </main>
  )
}
