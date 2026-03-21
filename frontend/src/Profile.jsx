import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './profile.css';
import './style.css';
import { apiFetch } from './api.js';
import { supabase } from './supabaseClient';

export default function Profile() {
    const navigate = useNavigate();

    const [userInfo, setUserInfo] = useState({
        userName: '', userUSN: '', email: '',
        semester: '', mobile: '',
        hasPinSet: false, hasGoogleIdentity: false, hasPasswordIdentity: true
    });
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ text: '', isError: false, show: false });

    const [editMode, setEditMode] = useState(false);
    const [editData, setEditData] = useState({ sname: '', sem: '', mobno: '' });
    const [savingProfile, setSavingProfile] = useState(false);

    const [pwSection, setPwSection] = useState(false);
    const [pwData, setPwData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });
    const [savingPw, setSavingPw] = useState(false);

    // PIN states
    const [pinSection, setPinSection] = useState(false);
    const [pinStep, setPinStep] = useState('send_otp'); // 'send_otp' | 'verify_otp' | 'new_pin'
    const [otpValue, setOtpValue] = useState('');
    const [otpSending, setOtpSending] = useState(false);
    const [otpVerifying, setOtpVerifying] = useState(false);
    const [pinData, setPinData] = useState({ newPin: '', confirmPin: '' });
    const [showPin, setShowPin] = useState({ new: false, confirm: false });
    const [savingPin, setSavingPin] = useState(false);
    const [pinErrors, setPinErrors] = useState({ newPin: '', confirmPin: '' });
    const [firstPinData, setFirstPinData] = useState({ newPin: '', confirmPin: '' });
    const [showFirstPin, setShowFirstPin] = useState({ new: false, confirm: false });
    const [firstPinErrors, setFirstPinErrors] = useState({ newPin: '', confirmPin: '' });
    const [savingFirstPin, setSavingFirstPin] = useState(false);

    useEffect(() => { fetchUser(); }, []);

    useEffect(() => {
        if (message.show) {
            const t = setTimeout(() => setMessage(p => ({ ...p, show: false })), 5000);
            return () => clearTimeout(t);
        }
    }, [message.show]);

    const showMessage = (text, isError = false) => {
        setMessage({ text, isError, show: true });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const fetchUser = async () => {
        try {
            const res = await apiFetch('/api/me', { method: 'GET' });
            if (!res.ok) { navigate('/'); return; }
            const data = await res.json();
            setUserInfo({
                userName: data.userName || '',
                userUSN: data.userUSN || '',
                email: data.email || '',
                semester: data.semester || '',
                mobile: data.mobile || '',
                hasPinSet: data.hasPinSet || false,
                hasGoogleIdentity: data.hasGoogleIdentity || false,
                hasPasswordIdentity: data.hasPasswordIdentity !== false,
            });
            setEditData({ sname: data.userName || '', sem: data.semester || '', mobno: data.mobile || '' });
        } catch { navigate('/'); }
        finally { setLoading(false); }
    };

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
            await apiFetch('/api/signout', { method: 'POST' });
        } catch { }
        finally {
            localStorage.removeItem('token');
            localStorage.removeItem('refresh_token');
            navigate('/');
        }
    };

    const handleSaveProfile = async () => {
        if (!editData.sname.trim()) return showMessage('Name cannot be empty', true);
        if (!/^\d{10}$/.test(editData.mobno)) return showMessage('Mobile must be 10 digits', true);
        const semNum = parseInt(editData.sem, 10);
        if (semNum < 1 || semNum > 8) return showMessage('Semester must be 1–8', true);
        setSavingProfile(true);
        try {
            const res = await apiFetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editData) });
            const data = await res.json();
            if (res.ok && data.success) { showMessage('Profile updated successfully'); setEditMode(false); fetchUser(); }
            else showMessage(data.error || 'Failed to update profile', true);
        } catch { showMessage('Network error.', true); }
        finally { setSavingProfile(false); }
    };

    const handleChangePassword = async () => {
        const { currentPassword, newPassword, confirmPassword } = pwData;
        if (!currentPassword || !newPassword || !confirmPassword) return showMessage('Fill all fields.', true);
        if (newPassword.length < 6) return showMessage('Min 6 characters.', true);
        if (newPassword !== confirmPassword) return showMessage('Password Mismatch', true);
        if (currentPassword === newPassword) return showMessage('Use different password.', true);
        setSavingPw(true);
        try {
            const res = await apiFetch('/api/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) });
            const data = await res.json();
            if (res.ok && data.success) {
                if (data.token) { localStorage.setItem('token', data.token); localStorage.setItem('refresh_token', data.refresh_token); }
                showMessage('Password changed successfully');
                setPwSection(false);
                setPwData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            } else showMessage(data.error || 'Failed to change password', true);
        } catch { showMessage('Network error.', true); }
        finally { setSavingPw(false); }
    };

    // PIN validation
    const validatePin = (pin) => {
        if (!pin) return 'PIN is required';
        if (!/^\d+$/.test(pin)) return 'PIN must contain only digits';
        if (pin.length < 4) return 'PIN must be at least 4 digits';
        if (pin.length > 6) return 'PIN must be at most 6 digits';
        if (/^(\d)\1+$/.test(pin)) return 'PIN cannot be all the same digit';
        const weak = ['123456', '654321', '111111', '000000', '1234', '0000', '1111', '9999', '123123', '112233'];
        if (weak.includes(pin)) return 'This PIN is too common. Choose a stronger one.';
        const d = pin.split('').map(Number);
        let asc = true, desc = true;
        for (let i = 1; i < d.length; i++) { if (d[i] !== d[i - 1] + 1) asc = false; if (d[i] !== d[i - 1] - 1) desc = false; }
        if (asc || desc) return 'PIN cannot be sequential (e.g. 1234 or 9876)';
        return '';
    };

    const handleFirstPinChange = (field, value) => {
        const v = value.replace(/\D/g, '').slice(0, 6);
        setFirstPinData(p => ({ ...p, [field]: v }));
        if (field === 'newPin') setFirstPinErrors(p => ({ ...p, newPin: validatePin(v) }));
        if (field === 'confirmPin') setFirstPinErrors(p => ({ ...p, confirmPin: v !== firstPinData.newPin ? 'PINs do not match' : '' }));
    };

    const handleSetPin = async () => {
        const e1 = validatePin(firstPinData.newPin);
        const e2 = firstPinData.newPin !== firstPinData.confirmPin ? 'PINs do not match' : '';
        setFirstPinErrors({ newPin: e1, confirmPin: e2 });
        if (e1 || e2) return;
        setSavingFirstPin(true);
        try {
            const res = await apiFetch('/api/set-organizer-pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPin: firstPinData.newPin, confirmPin: firstPinData.confirmPin }) });
            const data = await res.json();
            if (res.ok && data.success) {
                showMessage('Organizer PIN set successfully');
                setPinSection(false); setFirstPinData({ newPin: '', confirmPin: '' }); setFirstPinErrors({ newPin: '', confirmPin: '' });
                setUserInfo(p => ({ ...p, hasPinSet: true }));
            } else showMessage(data.error || 'Failed to set PIN', true);
        } catch { showMessage('Network error.', true); }
        finally { setSavingFirstPin(false); }
    };

    const handleSendOtp = async () => {
        setOtpSending(true);
        try {
            const res = await apiFetch('/api/request-pin-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            const data = await res.json();
            if (res.ok && data.success) { showMessage(`OTP sent to email.`); setPinStep('verify_otp'); setOtpValue(''); }
            else showMessage(data.error || 'Failed to send OTP', true);
        } catch { showMessage('Network error.', true); }
        finally { setOtpSending(false); }
    };

    const handleVerifyOtp = async () => {
        if (!otpValue || !/^\d{6}$/.test(otpValue)) return showMessage('Please enter the 6-digit OTP', true);
        setOtpVerifying(true);
        try {
            const res = await apiFetch('/api/verify-pin-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ otp: otpValue }) });
            const data = await res.json();
            if (res.ok && data.success) { showMessage('OTP Verified.'); setPinStep('new_pin'); setPinData({ newPin: '', confirmPin: '' }); setPinErrors({ newPin: '', confirmPin: '' }); }
            else showMessage(data.error || 'Invalid OTP', true);
        } catch { showMessage('Network error.', true); }
        finally { setOtpVerifying(false); }
    };

    const handleNewPinChange = (field, value) => {
        const v = value.replace(/\D/g, '').slice(0, 6);
        setPinData(p => ({ ...p, [field]: v }));
        if (field === 'newPin') setPinErrors(p => ({ ...p, newPin: validatePin(v) }));
        if (field === 'confirmPin') setPinErrors(p => ({ ...p, confirmPin: v !== pinData.newPin ? 'PINs do not match' : '' }));
    };

    const handleChangePin = async () => {
        const e1 = validatePin(pinData.newPin);
        const e2 = pinData.newPin !== pinData.confirmPin ? 'PINs do not match' : '';
        setPinErrors({ newPin: e1, confirmPin: e2 });
        if (e1 || e2) return;
        setSavingPin(true);
        try {
            const res = await apiFetch('/api/reset-organizer-pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPin: pinData.newPin, confirmPin: pinData.confirmPin }) });
            const data = await res.json();
            if (res.ok && data.success) {
                showMessage('Organizer PIN changed successfully');
                setPinSection(false); setPinStep('send_otp'); setPinData({ newPin: '', confirmPin: '' }); setPinErrors({ newPin: '', confirmPin: '' }); setOtpValue('');
            } else showMessage(data.error || 'Failed to change PIN', true);
        } catch { showMessage('Network error.', true); }
        finally { setSavingPin(false); }
    };

    const handleClosePinSection = () => {
        setPinSection(false); setPinStep('send_otp'); setOtpValue('');
        setPinData({ newPin: '', confirmPin: '' }); setPinErrors({ newPin: '', confirmPin: '' });
        setFirstPinData({ newPin: '', confirmPin: '' }); setFirstPinErrors({ newPin: '', confirmPin: '' });
    };

    const initials = userInfo.userName ? userInfo.userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';

    return (
        <div className="profile-page">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" />

            <nav className="prof-nav">
                <button className="prof-back-btn" onClick={() => navigate('/events')}><i className="fas fa-arrow-left" /> <span>Back</span></button>
                <span className="prof-nav-title">My Profile</span>
                <div style={{ width: 80 }} />
            </nav>

            {message.show && (
                <div className={`flo-toast ${message.isError ? "flo-toast--error" : "flo-toast--success"}`}>
                    <span className="flo-toast-icon">{message.isError ? "✕" : "✓"}</span>
                    {message.text}
                </div>
            )}

            <div className="prof-content">
                {loading ? (
                    <div className="prof-loading"><div className="prof-spinner" /><p>Loading...</p></div>
                ) : (
                    <>
                        {/* AVATAR */}
                        <div className="prof-avatar-card">
                            <div className="prof-avatar">{initials}</div>
                            <div className="prof-avatar-info">
                                <h1 className="prof-name">{userInfo.userName || 'User'}</h1>
                                <span className="prof-usn-badge">{userInfo.userUSN}</span>
                                {userInfo.hasGoogleIdentity && (
                                    <span style={{ display: 'inline-block', marginLeft: 8, padding: '3px 10px', fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--blue)', color: '#fff', border: '2px solid var(--black)' }}>Google</span>
                                )}
                            </div>
                        </div>

                        {/* ACCOUNT DETAILS */}
                        <div className="prof-info-card">
                            <div className="prof-info-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className="prof-info-header-label">Account Details</span>
                                {!editMode ? (
                                    <button onClick={() => setEditMode(true)} className="prof-action-btn prof-action-btn--primary">Edit</button>
                                ) : (
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={() => { setEditMode(false); setEditData({ sname: userInfo.userName, sem: userInfo.semester, mobno: userInfo.mobile }); }} className="prof-action-btn">Cancel</button>
                                        <button onClick={handleSaveProfile} disabled={savingProfile} className="prof-action-btn prof-action-btn--mint">{savingProfile ? 'Saving...' : 'Save'}</button>
                                    </div>
                                )}
                            </div>
                            {[
                                { icon: 'fa-user', label: 'Full Name', key: 'sname', value: userInfo.userName, field: 'sname', type: 'text', placeholder: 'Your full name' },
                                { icon: 'fa-id-card', label: 'University Serial No.', value: userInfo.userUSN, readOnly: true, mono: true },
                                { icon: 'fa-envelope', label: 'Email Address', value: userInfo.email, readOnly: true },
                                { icon: 'fa-graduation-cap', label: 'Semester', key: 'sem', value: userInfo.semester, field: 'sem', type: 'number', placeholder: '1–8', width: 80 },
                                { icon: 'fa-phone', label: 'Mobile Number', key: 'mobno', value: userInfo.mobile, field: 'mobno', type: 'tel', placeholder: '10 digit number' },
                            ].map((item, i) => (
                                <div key={i} className="prof-info-row">
                                    <div className="prof-info-icon"><i className={`fas ${item.icon}`} /></div>
                                    <div className="prof-info-body">
                                        <span className="prof-info-label">{item.label}</span>
                                        {editMode && !item.readOnly ? (
                                            <input className="prof-edit-input" type={item.type || 'text'} min={item.type === 'number' ? 1 : undefined} max={item.type === 'number' ? 8 : undefined}
                                                value={editData[item.field]} onChange={e => setEditData(p => ({ ...p, [item.field]: e.target.value }))}
                                                placeholder={item.placeholder} style={item.width ? { width: item.width } : {}} />
                                        ) : (
                                            <span className={`prof-info-value${item.mono ? ' mono' : ''}`}>{item.value || '—'}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* SECURITY */}
                        <div className="prof-info-card">
                            <div className="prof-info-header"><span className="prof-info-header-label">Security</span></div>
                            <div className="prof-info-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div className="prof-info-icon"><i className="fas fa-lock" /></div>
                                    <div className="prof-info-body">
                                        <span className="prof-info-label">Password</span>
                                        <span className="prof-info-value" style={{ fontSize: 13 }}>{userInfo.hasPasswordIdentity ? 'Change your login password' : 'No password set — you sign in with Google'}</span>
                                    </div>
                                    <button onClick={() => { setPwSection(p => !p); setPwData({ currentPassword: '', newPassword: '', confirmPassword: '' }); }} className="prof-action-btn">
                                        {pwSection ? 'Cancel' : (userInfo.hasPasswordIdentity ? 'Change' : 'Set Password')}
                                    </button>
                                </div>
                                {pwSection && (
                                    <div className="prof-sub-form">
                                        {userInfo.hasPasswordIdentity && (
                                            <div className="prof-sub-field">
                                                <label className="prof-sub-label">Current Password</label>
                                                <div className="prof-pw-row">
                                                    <input className="prof-sub-input" type={showPw.current ? 'text' : 'password'} value={pwData.currentPassword} onChange={e => setPwData(p => ({ ...p, currentPassword: e.target.value }))} placeholder="Enter current password" />
                                                    <button type="button" className="prof-pw-toggle" onClick={() => setShowPw(p => ({ ...p, current: !p.current }))}><i className={`fas ${showPw.current ? 'fa-eye-slash' : 'fa-eye'}`} /></button>
                                                </div>
                                            </div>
                                        )}
                                        <div className="prof-sub-field">
                                            <label className="prof-sub-label">New Password</label>
                                            <div className="prof-pw-row">
                                                <input className="prof-sub-input" type={showPw.new ? 'text' : 'password'} value={pwData.newPassword} onChange={e => setPwData(p => ({ ...p, newPassword: e.target.value }))} placeholder="Min 6 characters" />
                                                <button type="button" className="prof-pw-toggle" onClick={() => setShowPw(p => ({ ...p, new: !p.new }))}><i className={`fas ${showPw.new ? 'fa-eye-slash' : 'fa-eye'}`} /></button>
                                            </div>
                                        </div>
                                        <div className="prof-sub-field">
                                            <label className="prof-sub-label">Confirm New Password</label>
                                            <div className="prof-pw-row">
                                                <input className="prof-sub-input" type={showPw.confirm ? 'text' : 'password'} value={pwData.confirmPassword} onChange={e => setPwData(p => ({ ...p, confirmPassword: e.target.value }))} placeholder="Re-enter new password" />
                                                <button type="button" className="prof-pw-toggle" onClick={() => setShowPw(p => ({ ...p, confirm: !p.confirm }))}><i className={`fas ${showPw.confirm ? 'fa-eye-slash' : 'fa-eye'}`} /></button>
                                            </div>
                                        </div>
                                        <button onClick={handleChangePassword} disabled={savingPw} className="prof-save-btn">{savingPw ? 'Saving...' : 'Update Password →'}</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ORGANIZER PIN */}
                        <div className="prof-info-card">
                            <div className="prof-info-header"><span className="prof-info-header-label">Organizer PIN</span></div>
                            <div className="prof-info-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div className="prof-info-icon" style={{ background: userInfo.hasPinSet ? 'var(--mint)' : 'var(--cream)' }}><i className="fas fa-shield-alt" /></div>
                                    <div className="prof-info-body">
                                        <span className="prof-info-label">Organizer PIN</span>
                                        <span className="prof-info-value" style={{ fontSize: 13 }}>{userInfo.hasPinSet ? 'PIN is set — protects sub-event management' : 'No PIN set — required to manage sub-events'}</span>
                                    </div>
                                    <button 
                                        onClick={() => pinSection ? handleClosePinSection() : setPinSection(true)} 
                                        className={`prof-action-btn ${!userInfo.hasPinSet ? 'prof-action-btn--primary' : ''}`}
                                    >
                                        {pinSection ? 'Cancel' : (userInfo.hasPinSet ? 'Change' : 'Set PIN')}
                                    </button>
                                </div>

                                {pinSection && (
                                    <div className="prof-sub-form">

                                        {/* FIRST TIME SETUP */}
                                        {!userInfo.hasPinSet && (
                                            <>
                                                <p style={{ fontFamily: 'var(--mono)', fontSize: 11, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    This PIN protects edit/delete actions on sub-events when your device is handed to a volunteer.
                                                </p>
                                                <div className="prof-sub-field">
                                                    <label className="prof-sub-label">New PIN (4–6 digits)</label>
                                                    <div className="prof-pw-row">
                                                        <input className="prof-sub-input" type={showFirstPin.new ? 'text' : 'password'} value={firstPinData.newPin} onChange={e => handleFirstPinChange('newPin', e.target.value)} placeholder="e.g. 4821" inputMode="numeric" maxLength={6} />
                                                        <button type="button" className="prof-pw-toggle" onClick={() => setShowFirstPin(p => ({ ...p, new: !p.new }))}><i className={`fas ${showFirstPin.new ? 'fa-eye-slash' : 'fa-eye'}`} /></button>
                                                    </div>
                                                    {firstPinErrors.newPin && <span style={{ color: 'var(--coral)', fontSize: 11, fontFamily: 'var(--mono)' }}>✕ {firstPinErrors.newPin}</span>}
                                                </div>
                                                <div className="prof-sub-field">
                                                    <label className="prof-sub-label">Confirm PIN</label>
                                                    <div className="prof-pw-row">
                                                        <input className="prof-sub-input" type={showFirstPin.confirm ? 'text' : 'password'} value={firstPinData.confirmPin} onChange={e => handleFirstPinChange('confirmPin', e.target.value)} placeholder="Re-enter PIN" inputMode="numeric" maxLength={6} />
                                                        <button type="button" className="prof-pw-toggle" onClick={() => setShowFirstPin(p => ({ ...p, confirm: !p.confirm }))}><i className={`fas ${showFirstPin.confirm ? 'fa-eye-slash' : 'fa-eye'}`} /></button>
                                                    </div>
                                                    {firstPinErrors.confirmPin && <span style={{ color: 'var(--coral)', fontSize: 11, fontFamily: 'var(--mono)' }}>✕ {firstPinErrors.confirmPin}</span>}
                                                </div>
                                                <button onClick={handleSetPin} disabled={savingFirstPin} className="prof-save-btn">{savingFirstPin ? 'Setting PIN...' : 'Set Organizer PIN →'}</button>
                                            </>
                                        )}

                                        {/* OTP STEP 1: SEND OTP */}
                                        {userInfo.hasPinSet && pinStep === 'send_otp' && (
                                            <>
                                                <p style={{ fontFamily: 'var(--mono)', fontSize: 11, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.7 }}>
                                                    To change your PIN, a 6-digit OTP will be sent to:
                                                </p>
                                                <div style={{ background: 'var(--white)', border: '2px solid var(--black)', padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.05em' }}>
                                                    {userInfo.email}
                                                </div>
                                                <p style={{ fontFamily: 'var(--mono)', fontSize: 10, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    OTP is valid for 5 minutes only.
                                                </p>
                                                <button onClick={handleSendOtp} disabled={otpSending} className="prof-save-btn">{otpSending ? 'Sending OTP...' : 'Send OTP →'}</button>
                                            </>
                                        )}

                                        {/* OTP STEP 2: VERIFY OTP */}
                                        {userInfo.hasPinSet && pinStep === 'verify_otp' && (
                                            <>
                                                <p style={{ fontFamily: 'var(--mono)', fontSize: 11, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.7 }}>
                                                    Enter the 6-digit OTP sent to {userInfo.email}
                                                </p>
                                                <div className="prof-sub-field">
                                                    <label className="prof-sub-label">6-Digit OTP</label>
                                                    <div className="otp-boxes">
                                                        {[0, 1, 2, 3, 4, 5].map(i => (
                                                            <input
                                                                key={i}
                                                                id={`otp-box-${i}`}
                                                                className="otp-box"
                                                                type="text"
                                                                inputMode="numeric"
                                                                maxLength={1}
                                                                value={otpValue[i] || ''}
                                                                onChange={e => {
                                                                    const val = e.target.value.replace(/\D/g, '');
                                                                    if (!val) { setOtpValue(p => p.slice(0, i) + '' + p.slice(i + 1)); return; }
                                                                    const newOtp = otpValue.slice(0, i) + val[0] + otpValue.slice(i + 1);
                                                                    setOtpValue(newOtp);
                                                                    if (i < 5) document.getElementById(`otp-box-${i + 1}`)?.focus();
                                                                }}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Backspace' && !otpValue[i] && i > 0) {
                                                                        document.getElementById(`otp-box-${i - 1}`)?.focus();
                                                                    }
                                                                }}
                                                                onPaste={e => {
                                                                    e.preventDefault();
                                                                    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                                                                    setOtpValue(pasted.padEnd(6, '').slice(0, 6));
                                                                    document.getElementById(`otp-box-${Math.min(pasted.length, 5)}`)?.focus();
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                                    <button onClick={handleVerifyOtp} disabled={otpVerifying} className="prof-save-btn">{otpVerifying ? 'Verifying...' : 'Verify OTP →'}</button>
                                                    <button onClick={() => { setPinStep('send_otp'); setOtpValue(''); }} style={{ padding: '12px 20px', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: 'transparent', color: 'var(--black)', border: '2px solid var(--black)', cursor: 'pointer', opacity: 0.6 }}>
                                                        Resend OTP
                                                    </button>
                                                </div>
                                            </>
                                        )}

                                        {/* OTP STEP 3: NEW PIN */}
                                        {userInfo.hasPinSet && pinStep === 'new_pin' && (
                                            <>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--mint)', padding: '8px 14px', border: '2px solid var(--black)' }}>
                                                    <i className="fas fa-check-circle" />
                                                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>OTP Verified — Set Your New PIN</span>
                                                </div>
                                                <div className="prof-sub-field">
                                                    <label className="prof-sub-label">New PIN (4–6 digits)</label>
                                                    <div className="prof-pw-row">
                                                        <input className="prof-sub-input" type={showPin.new ? 'text' : 'password'} value={pinData.newPin} onChange={e => handleNewPinChange('newPin', e.target.value)} placeholder="e.g. 4821" inputMode="numeric" maxLength={6} />
                                                        <button type="button" className="prof-pw-toggle" onClick={() => setShowPin(p => ({ ...p, new: !p.new }))}><i className={`fas ${showPin.new ? 'fa-eye-slash' : 'fa-eye'}`} /></button>
                                                    </div>
                                                    {pinErrors.newPin && <span style={{ color: 'var(--coral)', fontSize: 11, fontFamily: 'var(--mono)' }}>✕ {pinErrors.newPin}</span>}
                                                </div>
                                                <div className="prof-sub-field">
                                                    <label className="prof-sub-label">Confirm New PIN</label>
                                                    <div className="prof-pw-row">
                                                        <input className="prof-sub-input" type={showPin.confirm ? 'text' : 'password'} value={pinData.confirmPin} onChange={e => handleNewPinChange('confirmPin', e.target.value)} placeholder="Re-enter PIN" inputMode="numeric" maxLength={6} />
                                                        <button type="button" className="prof-pw-toggle" onClick={() => setShowPin(p => ({ ...p, confirm: !p.confirm }))}><i className={`fas ${showPin.confirm ? 'fa-eye-slash' : 'fa-eye'}`} /></button>
                                                    </div>
                                                    {pinErrors.confirmPin && <span style={{ color: 'var(--coral)', fontSize: 11, fontFamily: 'var(--mono)' }}>✕ {pinErrors.confirmPin}</span>}
                                                </div>
                                                <button onClick={handleChangePin} disabled={savingPin} className="prof-save-btn">{savingPin ? 'Changing PIN...' : 'Change PIN →'}</button>
                                            </>
                                        )}

                                    </div>
                                )}
                            </div>
                        </div>

                        <button className="back-btn" onClick={() => window.history.back()}>
                            <span>← Back to Event</span>
                        </button>

                        {/* SIGN OUT */}
                        <button className="prof-logout-btn" onClick={handleLogout}>
                            <i className="fas fa-sign-out-alt" /> Sign Out
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}