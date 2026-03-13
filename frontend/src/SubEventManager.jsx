import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './subeventmanager.css';

const SubEventManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('eventId');

  const [eventData, setEventData] = useState(null);
  const [subEvents, setSubEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userUSN, setUserUSN] = useState(null);

  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });

  const [showAddForm, setShowAddForm] = useState(false);
  const [newSubEvent, setNewSubEvent] = useState({
    se_name: '',
    activity_pts: 0,
    se_details: ''
  });

  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({
    se_name: '',
    activity_pts: 0,
    se_details: ''
  });

  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [password, setPassword] = useState('');
  const [deleteModal, setDeleteModal] = useState({ show: false, seid: null, name: '' });
  const [updateModal, setUpdateModal] = useState({ show: false, seid: null, name: '' });

  const showToast = (message, type = 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'error' }), 4000);
  };

  // ── FAST: fetch user, event, and sub-events all in parallel ──────────────
  const fetchAllData = async () => {
    try {
      const [userRes, eventRes, subRes] = await Promise.all([
        fetch('/api/me', { method: 'GET', credentials: 'include', headers: { 'Content-Type': 'application/json' } }),
        fetch(`/api/events/${eventId}`, { method: 'GET', credentials: 'include', headers: { 'Content-Type': 'application/json' } }),
        fetch(`/api/events/${eventId}/sub-events`, { method: 'GET', credentials: 'include', headers: { 'Content-Type': 'application/json' } }),
      ]);

      if (!userRes.ok) throw new Error('Failed to fetch user data');
      if (!eventRes.ok) throw new Error('Failed to fetch event data');

      const [userData, eventData, subData] = await Promise.all([
        userRes.json(),
        eventRes.json(),
        subRes.ok ? subRes.json() : Promise.resolve({ subEvents: [] }),
      ]);

      const currentUserUSN = userData.userUSN;
      setUserUSN(currentUserUSN);
      setEventData(eventData);

      if (eventData.OrgUsn !== currentUserUSN) {
        setError('You are not authorized to manage sub-events for this event');
        setLoading(false);
        return;
      }

      setSubEvents(subData.subEvents || []);
      setLoading(false);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  const fetchSubEvents = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/sub-events`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Failed to fetch sub-events');

      const data = await response.json();
      setSubEvents(data.subEvents || []);
    } catch (err) {
      console.error('Error fetching sub-events:', err);
      showToast('Failed to refresh sub-events');
    }
  };

  useEffect(() => {
    if (!eventId) {
      setError('No event ID provided');
      setLoading(false);
      return;
    }
    fetchAllData();
  }, [eventId]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newSubEvent.se_name.trim()) {
      showToast('Sub-event name is required');
      return;
    }

    setSavingId('adding');

    try {
      const response = await fetch(`/api/events/${eventId}/sub-events`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSubEvent)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create sub-event');
      }

      setNewSubEvent({ se_name: '', activity_pts: 0, se_details: '' });
      setShowAddForm(false);
      showToast('Sub-event created successfully!', 'success');
      fetchSubEvents();
    } catch (err) {
      console.error('Error creating sub-event:', err);
      showToast(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleEditClick = (subEvent) => {
    setEditingId(subEvent.seid);
    setEditData({
      se_name: subEvent.se_name,
      activity_pts: subEvent.activity_pts,
      se_details: subEvent.se_details || ''
    });
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditData({ se_name: '', activity_pts: 0, se_details: '' });
  };

  const handleEditSubmit = (seid) => {
    const subEvent = subEvents.find(se => se.seid === seid);
    setUpdateModal({ show: true, seid, name: subEvent ? subEvent.se_name : '' });
    setPassword('');
  };

  const confirmEdit = async () => {
    const seid = updateModal.seid;
    if (!password) {
      showToast('Password is required to confirm changes');
      return;
    }

    setUpdateModal({ ...updateModal, show: false });
    setSavingId(seid);

    try {
      const response = await fetch(`/api/sub-events/${seid}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editData, password })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update sub-event');
      }

      setEditingId(null);
      setEditData({ se_name: '', activity_pts: 0, se_details: '' });
      showToast('Sub-event updated successfully!', 'success');
      fetchSubEvents();
    } catch (err) {
      console.error('Error updating sub-event:', err);
      showToast(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = (seid, name) => {
    setDeleteModal({ show: true, seid, name });
    setPassword('');
  };

  const confirmDelete = async () => {
    const seid = deleteModal.seid;
    if (!password) {
      showToast('Password is required to delete the sub-event');
      return;
    }

    setDeleteModal({ show: false, seid: null, name: '' });
    setDeletingId(seid);

    try {
      const response = await fetch(`/api/sub-events/${seid}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete sub-event');
      }

      showToast('Sub-event deleted successfully!', 'success');
      fetchSubEvents();
    } catch (err) {
      console.error('Error deleting sub-event:', err);
      showToast(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const cancelDelete = () => {
    setDeleteModal({ show: false, seid: null, name: '' });
    setPassword('');
  };

  const cancelUpdate = () => {
    setUpdateModal({ show: false, seid: null, name: '' });
    setPassword('');
  };

  const handleShowQR = (seid) => {
    navigate(`/qr?seid=${seid}`);
  };

  const handleBack = () => {
    navigate('/organisers');
  };

  const renderModals = () => (
    <>
      {deleteModal.show && (
        <div className="subevent-modal-overlay" onClick={cancelDelete}>
          <div className="subevent-modal" onClick={(e) => e.stopPropagation()}>
            <div className="subevent-modal-icon">
              <i className="fas fa-exclamation-triangle"></i>
            </div>
            <h3 className="subevent-modal-title">Delete Sub-event?</h3>
            <p className="subevent-modal-message">
              Are you sure you want to delete "<strong>{deleteModal.name}</strong>"?
              This will also delete all attendance records for this sub-event.
            </p>
            <div className="subevent-modal-input-wrapper">
              <label>Confirm with Password</label>
              <input
                type="password"
                className="subevent-modal-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && confirmDelete()}
              />
            </div>
            <div className="subevent-modal-buttons">
              <button className="subevent-modal-btn cancel" onClick={cancelDelete}>
                Cancel
              </button>
              <button
                className="subevent-modal-btn delete"
                onClick={confirmDelete}
                disabled={deletingId !== null || !password}
              >
                {deletingId ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {updateModal.show && (
        <div className="subevent-modal-overlay" onClick={cancelUpdate}>
          <div className="subevent-modal warning" onClick={(e) => e.stopPropagation()}>
            <div className="subevent-modal-icon">
              <i className="fas fa-exclamation-circle"></i>
            </div>
            <h3 className="subevent-modal-title">Confirm Changes?</h3>
            <p className="subevent-modal-message">
              Please enter your password to save changes to "<strong>{updateModal.name}</strong>".
            </p>
            <div className="subevent-modal-input-wrapper">
              <label>Verification Password</label>
              <input
                type="password"
                className="subevent-modal-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && confirmEdit()}
              />
            </div>
            <div className="subevent-modal-buttons">
              <button className="subevent-modal-btn cancel" onClick={cancelUpdate}>
                Cancel
              </button>
              <button
                className="subevent-modal-btn confirm"
                onClick={confirmEdit}
                disabled={savingId !== null || !password}
              >
                {savingId === updateModal.seid ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (loading) {
    return (
      <>
        {toast.show && (
          <div className="subevent-toast-wrapper">
            <div className={`subevent-toast ${toast.type}`}>{toast.message}</div>
          </div>
        )}
        {renderModals()}
        <div className="subevent-page">
          <div className="subevent-loading">
            <div className="subevent-spinner"></div>
            <p>Loading...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        {toast.show && (
          <div className="subevent-toast-wrapper">
            <div className={`subevent-toast ${toast.type}`}>{toast.message}</div>
          </div>
        )}
        {renderModals()}
        <div className="subevent-page">
          <div className="subevent-error">
            <p>{error}</p>
            <button onClick={handleBack} className="subevent-back-btn">Back to Organizers</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {toast.show && (
        <div className="subevent-toast-wrapper">
          <div className={`subevent-toast ${toast.type}`}>{toast.message}</div>
        </div>
      )}

      {renderModals()}

      <div className="subevent-page">
        <div className="subevent-container">
          <div className="subevent-header">
            <button onClick={handleBack} className="subevent-back-btn">
              <i className="fas fa-arrow-left"></i> Back
            </button>
            <div className="subevent-header-text">
              <h1>Manage Sub-events</h1>
              <p className="subevent-event-name">{eventData?.ename}</p>
            </div>
          </div>

          <div className="subevent-info-card">
            <div className="subevent-info-grid">
              <div className="subevent-info-item">
                <span className="subevent-info-label">Max Participant Activity Points</span>
                <span className="subevent-info-value">{eventData?.maxActivityPts || 0}</span>
              </div>
              <div className="subevent-info-item">
                <span className="subevent-info-label">Volunteer Activity Points</span>
                <span className="subevent-info-value">{eventData?.volActivityPts || 0}</span>
              </div>
              <div className="subevent-info-item">
                <span className="subevent-info-label">Min. Part. Scans</span>
                <span className="subevent-info-value">{eventData?.minPartScans || 1}</span>
              </div>
              <div className="subevent-info-item">
                <span className="subevent-info-label">Min. Vol. Scans</span>
                <span className="subevent-info-value">{eventData?.minVolnScans || 1}</span>
              </div>
            </div>
          </div>

          <div className="subevent-list">
            <h2>Sub-events ({subEvents.length})</h2>

            {subEvents.length === 0 ? (
              <p className="subevent-empty">No sub-events found.</p>
            ) : (
              subEvents.map((se) => (
                <div key={se.seid} className="subevent-item">
                  {editingId === se.seid ? (
                    <div className="subevent-edit-form">
                      <div className="subevent-edit-grid">
                        <div className="subevent-input-group">
                          <label>Sub-event Name</label>
                          <input
                            type="text"
                            value={editData.se_name}
                            onChange={(e) => setEditData({ ...editData, se_name: e.target.value })}
                            placeholder="Enter sub-event name"
                            className="subevent-input"
                          />
                        </div>
                        <div className="subevent-input-group">
                          <label>Activity Points</label>
                          <input
                            type="number"
                            value={editData.activity_pts}
                            onChange={(e) => setEditData({ ...editData, activity_pts: parseInt(e.target.value) || 0 })}
                            placeholder="Points"
                            className="subevent-input"
                            min="0"
                          />
                        </div>
                        <div className="subevent-input-group" style={{ gridColumn: '1 / -1' }}>
                          <label>Details</label>
                          <textarea
                            value={editData.se_details}
                            onChange={(e) => setEditData({ ...editData, se_details: e.target.value })}
                            placeholder="Enter sub-event details (optional)"
                            className="subevent-input"
                            rows={2}
                            style={{ resize: 'vertical', minHeight: '60px' }}
                          />
                        </div>
                      </div>
                      <div className="subevent-edit-actions">
                        <button
                          onClick={() => handleEditSubmit(se.seid)}
                          className="subevent-save-btn"
                          disabled={savingId === se.seid || !editData.se_name.trim()}
                        >
                          {savingId === se.seid ? 'Saving...' : 'Save'}
                        </button>
                        <button onClick={handleEditCancel} className="subevent-cancel-btn">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="subevent-details">
                        <div className="subevent-name">{se.se_name}</div>
                        <div className="subevent-meta">
                          <span>Points: {se.activity_pts}</span>
                          {se.se_details && <span>Details: {se.se_details}</span>}
                          <span className="subevent-attendance-count">
                            <i className="fas fa-users"></i> {se.attendanceCount || 0} scanned
                          </span>
                        </div>
                      </div>
                      <div className="subevent-actions">
                        <button
                          onClick={() => handleShowQR(se.seid)}
                          className="subevent-qr-btn"
                          title="Show QR Code"
                        >
                          <i className="fas fa-qrcode"></i> QR
                        </button>
                        <button
                          onClick={() => handleEditClick(se)}
                          className="subevent-edit-btn"
                          title="Edit"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(se.seid, se.se_name)}
                          className={`subevent-delete-btn ${subEvents.length <= 1 ? 'disabled' : ''}`}
                          disabled={subEvents.length <= 1 || deletingId === se.seid}
                          title={subEvents.length <= 1 ? 'Cannot delete the last sub-event' : 'Delete'}
                        >
                          {deletingId === se.seid ? (
                            <span className="subevent-spinner-sm"></span>
                          ) : (
                            <i className="fas fa-trash"></i>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="subevent-add-btn"
            >
              <i className={`fas ${showAddForm ? 'fa-times' : 'fa-plus'}`}></i>{' '}
              {showAddForm ? 'Cancel' : 'Add Sub-event'}
            </button>

            {showAddForm && (
              <form onSubmit={handleAddSubmit} className="subevent-add-form">
                <div className="subevent-form-grid">
                  <div className="subevent-input-group">
                    <label>Sub-event Name *</label>
                    <input
                      type="text"
                      value={newSubEvent.se_name}
                      onChange={(e) => setNewSubEvent({ ...newSubEvent, se_name: e.target.value })}
                      placeholder="Enter sub-event name"
                      className="subevent-input"
                      required
                    />
                  </div>
                  <div className="subevent-input-group">
                    <label>Activity Points</label>
                    <input
                      type="number"
                      value={newSubEvent.activity_pts}
                      onChange={(e) => setNewSubEvent({ ...newSubEvent, activity_pts: parseInt(e.target.value) || 0 })}
                      placeholder="Points for this sub-event"
                      className="subevent-input"
                      min="0"
                    />
                  </div>
                  <div className="subevent-input-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Details (Optional)</label>
                    <textarea
                      value={newSubEvent.se_details}
                      onChange={(e) => setNewSubEvent({ ...newSubEvent, se_details: e.target.value })}
                      placeholder="Enter sub-event details like timing, venue, or any special instructions"
                      className="subevent-input"
                      rows={2}
                      style={{ resize: 'vertical', minHeight: '60px' }}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="subevent-submit-btn"
                  disabled={savingId === 'adding' || !newSubEvent.se_name.trim()}
                >
                  {savingId === 'adding' ? (
                    <><span className="subevent-spinner-sm"></span> Creating...</>
                  ) : (
                    <><i className="fas fa-plus"></i> Create Sub-event</>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default SubEventManager;
