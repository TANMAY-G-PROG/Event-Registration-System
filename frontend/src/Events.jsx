import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './events.css';
import { apiFetch } from './api.js';
import { supabase } from './supabaseClient';

export default function Events() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/'); return; }
    try {
      const res = await apiFetch('/api/me', { method: 'GET', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) { localStorage.removeItem('token'); navigate('/'); return; }
      const data = await res.json();
      setUserName(data.userName || '');
    } catch { navigate('/'); }
  };

  const firstName = userName ? userName.split(' ')[0] : '';

  return (
    <div className="events-wrapper">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" />

      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" />

      <div style={{ paddingBottom: 60 }} /> {/* Spacer for Nav */}

      {/* GREETING */}
      <div className="ev-hero">
        <p className="ev-hero-label">Welcome back</p>
        <h1 className="ev-hero-name">
          {firstName ? `Hey, ${firstName} 👋` : 'Your Events'}
        </h1>
      </div>

      {/* CARDS */}
      <section className="cards">
        <article className="card card--1" onClick={() => navigate('/participants')}>
          <span className="card__num">01</span>
          <div className="card__img">
            <img src="https://ik.imagekit.io/flopass/volunteers.png?tr=w-800,h-600,fo-auto,dpr-auto,q-100" alt="Participants" loading="lazy" />
          </div>
          <div className="card__info">
            <h3 className="card__title">Events Participated</h3>
            <div className="card__arrow"><i className="fas fa-arrow-right"></i></div>
          </div>
        </article>

        <article className="card card--2" onClick={() => navigate('/organisers')}>
          <span className="card__num">02</span>
          <div className="card__img">
            <img src="https://ik.imagekit.io/flopass/organisers.png?tr=w-800,h-600,fo-auto,dpr-auto,q-100" alt="Organisers" loading="lazy" />
          </div>
          <div className="card__info">
            <h3 className="card__title">Events Organised</h3>
            <div className="card__arrow"><i className="fas fa-arrow-right"></i></div>
          </div>
        </article>

        <article className="card card--3" onClick={() => navigate('/volunteers')}>
          <span className="card__num">03</span>
          <div className="card__img">
            <img src="https://ik.imagekit.io/flopass/participants.png?tr=w-800,h-600,fo-auto,dpr-auto,q-100" alt="Volunteers" loading="lazy" />
          </div>
          <div className="card__info">
            <h3 className="card__title">Events Volunteered</h3>
            <div className="card__arrow"><i className="fas fa-arrow-right"></i></div>
          </div>
        </article>
      </section>
    </div>
  );
}