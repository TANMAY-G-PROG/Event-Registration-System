import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './volunteer_events.css';

// Get the base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function VolunteerEvents() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [message, setMessage] = useState({ text: '', isError: false });
  const [isLoading, setIsLoading] = useState(true);

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Format time helper
  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    const timeParts = timeString.split(':');
    let hours = parseInt(timeParts[0]);
    const minutes = timeParts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  // Show message
  const showMessage = (text, isError = false) => {
    setMessage({ text, isError });
    setTimeout(() => setMessage({ text: '', isError: false }), 5000);
  };

  // Fetch events
  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      // EDITED: Using API_BASE_URL
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        if (response.status === 401) {
          showMessage('Please sign in to view events.', true);
          setTimeout(() => navigate('/'), 2000);
          return;
        }
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      const allEvents = [
        ...data.events.ongoing,
        ...data.events.upcoming
      ];

      // Remove duplicates based on eid
      const uniqueEvents = allEvents.reduce((acc, current) => {
        const exists = acc.find(event => event.eid === current.eid);
        if (!exists) {
          acc.push(current);
        }
        return acc;
      }, []);

      // Set events immediately with volunteerCount as null (loading state)
      const eventsWithLoadingCounts = uniqueEvents.map(event => ({
        ...event,
        volunteerCount: null
      }));
      setEvents(eventsWithLoadingCounts);
      setIsLoading(false);

      // Fetch volunteer counts in parallel and update as they come in
      uniqueEvents.forEach(async (event, index) => {
        try {
          // EDITED: Using API_BASE_URL
          const countResponse = await fetch(`${API_BASE_URL}/api/events/${event.eid}/volunteer-count`, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
          });
          const countData = await countResponse.json();
          
          // Update the specific event's count
          setEvents(prevEvents => 
            prevEvents.map(e => 
              e.eid === event.eid 
                ? { ...e, volunteerCount: countData.count }
                : e
            )
          );
        } catch (error) {
          console.error(`Error fetching count for event ${event.eid}:`, error);
          // Set count to 0 on error
          setEvents(prevEvents => 
            prevEvents.map(e => 
              e.eid === event.eid 
                ? { ...e, volunteerCount: 0 }
                : e
            )
          );
        }
      });

    } catch (error) {
      console.error('Error fetching events:', error);
      showMessage('Could not load events.', true);
      setIsLoading(false);
    }
  };

  // Handle volunteer action with ripple
  const handleVolunteer = async (eventId, e) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    const ripple = document.createElement('span');
    ripple.classList.add('ripple');
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    btn.appendChild(ripple);

    setTimeout(() => ripple.remove(), 600);

    try {
      // EDITED: Using API_BASE_URL
      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/volunteer`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (response.ok) {
        showMessage('Successfully volunteered for the event!');
        fetchEvents();
      } else {
        if (response.status === 401) {
          showMessage('Please sign in to volunteer.', true);
          setTimeout(() => navigate('/'), 2000);
        } else {
          showMessage(`Failed to volunteer: ${data.error}`, true);
        }
      }
    } catch (error) {
      console.error('Error volunteering:', error);
      showMessage('Error volunteering for the event.', true);
    }
  };

  // Handle back navigation
  const handleBack = () => {
    navigate('/volunteers');
  };

  // Load events on mount
  useEffect(() => {
    fetchEvents();
  }, []);

  return (
    <div className="volunteer-events-wrapper">
      {/* Animated Texture Background */}
      <div className="ve-texture"></div>

      {/* Message notification */}
      {message.text && (
        <div className={`ve-message ${message.isError ? 'error' : 'success'}`}>
          {message.text}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="ve-nav-container">
        <button onClick={handleBack} className="ve-back-btn">
          <i className="fas fa-arrow-left"></i>
          Back
        </button>
      </div>

      {/* Main container with golden side stripes */}
      <div className="ve-container">
        <div className="ve-content-box">
          <h2 className="ve-header">Volunteer for Events</h2>

          {/* Events list */}
          <div className="ve-events-list">
            {isLoading ? (
              <div className="ve-event-item">
                <div className="ve-event-info">
                  <p><strong>Loading events...</strong></p>
                </div>
              </div>
            ) : events.length === 0 ? (
              <div className="ve-event-item">
                <div className="ve-event-info">
                  <p><strong>No events available for volunteering</strong></p>
                </div>
              </div>
            ) : (
              events.map((event) => {
                const volunteerCount = event.volunteerCount ?? 0;
                const remainingVolunteers = event.maxVoln - volunteerCount;
                const isCountLoading = event.volunteerCount === null;
                
                return (
                  <div key={event.eid} className="ve-event-item">
                    <div className="ve-event-info">
                      <p className="ve-event-name">{event.ename || 'N/A'}</p>
                      <p><strong>Date:</strong> {formatDate(event.eventDate)}</p>
                      <p><strong>Time:</strong> {formatTime(event.eventTime)}</p>
                      <p><strong>Location:</strong> {event.eventLoc || 'N/A'}</p>
                      <p>
                        <strong>Volunteers Needed:</strong>{' '}
                        {isCountLoading ? (
                          'Loading...'
                        ) : (
                          `${remainingVolunteers > 0 ? remainingVolunteers : 0}/${event.maxVoln || 'N/A'}`
                        )}
                      </p>
                    </div>

                    <div className="ve-event-actions">
                      {isCountLoading ? (
                        <button className="ve-button ve-volunteer-btn" disabled>
                          Loading...
                        </button>
                      ) : remainingVolunteers > 0 ? (
                        <button
                          onClick={(e) => handleVolunteer(event.eid, e)}
                          className="ve-button ve-volunteer-btn"
                        >
                          Volunteer
                        </button>
                      ) : (
                        <p className="ve-no-volunteers">No more volunteers needed</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
