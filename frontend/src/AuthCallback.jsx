import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import './style.css';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [session, setSession] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: '', isError: false, show: false });
  const [googleName, setGoogleName] = useState('');

  const [formData, setFormData] = useState({
    usn: '', sem: '', mobno: '',
  });

  const showMessage = (text, isError = false) => {
    setMessage({ text, isError, show: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => setMessage(prev => ({ ...prev, show: false })), 5000);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { navigate('/login'); return; }
      setSession(session);
      localStorage.setItem('token', session.access_token);
      localStorage.setItem('refresh_token', session.refresh_token);
      const fullName = session.user?.user_metadata?.full_name
        || session.user?.user_metadata?.name
        || session.user?.email?.split('@')[0] || '';
      setGoogleName(fullName);
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('userUSN', data.userUSN);
        localStorage.setItem('userName', data.userName);
        navigate('/events');
      } else {
        setNeedsOnboarding(true);
        setLoading(false);
      }
    });
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'usn' ? value.toUpperCase() : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { usn, sem, mobno } = formData;
    if (!usn || !sem || !mobno) return showMessage('Please fill in all fields', true);
    if (!/^\d{10}$/.test(mobno)) return showMessage('Mobile number must be 10 digits', true);
    const semNum = parseInt(sem, 10);
    if (semNum < 1 || semNum > 8) return showMessage('Semester must be between 1 and 8', true);

    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/complete-google-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ usn, sem: semNum, mobno })
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage(data.error || 'Something went wrong', true);
        setSubmitting(false);
        return;
      }
      localStorage.setItem('userUSN', usn);
      localStorage.setItem('userName', data.userName || googleName);
      navigate('/events');
    } catch {
      showMessage('Network error. Please try again.', true);
      setSubmitting(false);
    }
  };

  if (loading && !needsOnboarding) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--nb-bg, #f5f0e8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--nb-font-display, monospace)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: 24 }}>
            FLO<span style={{
              display: 'inline-block', width: 10, height: 10,
              background: 'var(--nb-yellow, #FFE500)', border: '3px solid var(--nb-black, #0a0a0a)',
              borderRadius: '50%', marginLeft: 4, verticalAlign: 'middle'
            }} />
          </div>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6 }}>
            Signing you in...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="forgot-password-page">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />

      {message.show && (
        <div className={`flo-toast ${message.isError ? 'flo-toast--error' : 'flo-toast--success'}`}>
          <span className="flo-toast-icon">{message.isError ? '✕' : '✓'}</span>
          {message.text}
        </div>
      )}

      <div className="forgot-card" style={{ maxWidth: 500 }}>
        <h1>
          <i className="fa-brands fa-google" style={{ marginRight: 10 }} />
          Complete Your Profile
        </h1>
        <div className="divider" />

        {googleName && (
          <div style={{
            background: 'var(--sand-deep, #f0ece0)', border: '1.5px solid var(--sand-border, #ddd)',
            padding: '10px 14px', marginBottom: 20, fontFamily: 'DM Sans, sans-serif', fontSize: 13,
          }}>
            <span style={{ opacity: 0.6, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'DM Mono, monospace', display: 'block', marginBottom: 2 }}>
              Signed in as
            </span>
            <strong>{googleName}</strong>
          </div>
        )}

        <p>Just a few more details to finish setting up your FLO account.</p>
        <p style={{ fontSize: 12.5, opacity: 0.65, margin: '4px 0 16px' }}>
          You can set your Organizer PIN later from your profile.
        </p>

        <form className="forgot-form" onSubmit={handleSubmit}>

          <div>
            <label style={{ display: 'block', fontFamily: 'DM Mono, monospace', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, opacity: 0.7 }}>
              University Serial No. (USN)
            </label>
            <input
              type="text" name="usn" placeholder="1AB22CS001"
              value={formData.usn} onChange={handleChange}
              disabled={submitting} autoComplete="off" spellCheck="false"
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontFamily: 'DM Mono, monospace', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, opacity: 0.7 }}>
                Semester
              </label>
              <input type="number" name="sem" placeholder="1–8" min="1" max="8"
                value={formData.sem} onChange={handleChange} disabled={submitting} />
            </div>
            <div style={{ flex: 2 }}>
              <label style={{ display: 'block', fontFamily: 'DM Mono, monospace', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, opacity: 0.7 }}>
                Mobile Number
              </label>
              <input type="tel" name="mobno" placeholder="9876543210"
                value={formData.mobno} onChange={handleChange} disabled={submitting} />
            </div>
          </div>

          <button type="submit" disabled={submitting}>
            {submitting ? 'Setting up...' : 'Complete Setup →'}
          </button>

        </form>
      </div>
    </div>
  );
}