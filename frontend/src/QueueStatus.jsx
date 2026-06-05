// QueueStatus.jsx
// Drop this file in frontend/src/
// Used by Registerevent.jsx when event is full or seat is held

import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from './api.js';

export default function QueueStatus({ eventId, eventName, onSeatAvailable, onExpired }) {
  const [data, setData] = useState(null);
  const [tick, setTick] = useState(0);
  const intervalRef = useRef(null);
  const pollRef = useRef(null);

  const poll = async () => {
    try {
      const res = await apiFetch(`/api/events/${eventId}/queue-position`);
      if (!res.ok) return;
      const d = await res.json();
      setData(d);

      if (d.status === 'expired') { onExpired?.(); return; }
      if (d.promoted && d.status === 'holding') { onSeatAvailable?.(d); }
    } catch (_) {}
  };

  useEffect(() => {
    poll();
    // Poll every 20 seconds
    pollRef.current = setInterval(poll, 20000);
    // Tick every second for the countdown display
    intervalRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => {
      clearInterval(pollRef.current);
      clearInterval(intervalRef.current);
    };
  }, [eventId]);

  // Decrement local timer each tick
  useEffect(() => {
    if (data && data.expiresIn > 0) {
      setData(prev => prev ? { ...prev, expiresIn: Math.max(0, prev.expiresIn - 1) } : prev);
    }
  }, [tick]);

  if (!data) return null;

  const mins = Math.floor((data.expiresIn || 0) / 60);
  const secs = (data.expiresIn || 0) % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  if (data.status === 'holding' && !data.promoted) {
    return (
      <div className="queue-status holding">
        <div className="queue-status-icon">⏳</div>
        <div className="queue-status-body">
          <div className="queue-status-title">SEAT HELD</div>
          <div className="queue-status-sub">Complete payment within <strong>{timeStr}</strong></div>
        </div>
      </div>
    );
  }

  if (data.status === 'holding' && data.promoted) {
    return (
      <div className="queue-status promoted">
        <div className="queue-status-icon">🎉</div>
        <div className="queue-status-body">
          <div className="queue-status-title">SEAT AVAILABLE!</div>
          <div className="queue-status-sub">You moved up from the queue. Complete payment within <strong>{timeStr}</strong></div>
        </div>
      </div>
    );
  }

  if (data.status === 'queued') {
    return (
      <div className="queue-status queued">
        <div className="queue-status-icon">🔢</div>
        <div className="queue-status-body">
          <div className="queue-status-title">YOU ARE #{data.queuePosition} IN QUEUE</div>
          <div className="queue-status-sub">
            The event is full right now. If a seat opens you will be notified here automatically.
            Queue expires in <strong>{timeStr}</strong>.
          </div>
        </div>
      </div>
    );
  }

  return null;
}
