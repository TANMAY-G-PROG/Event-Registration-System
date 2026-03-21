import { supabase } from './supabaseClient';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Auth endpoints that don't need a bearer token
const AUTH_ENDPOINTS = [
    '/api/signin',
    '/api/signup',
    '/api/signout',
    '/api/forgot-password',
    '/api/reset-password',
    '/api/complete-google-signup'
];

export const apiFetch = async (endpoint, options = {}) => {
    let token = null;

    // Only fetch/refresh the Supabase session for protected endpoints
    if (!AUTH_ENDPOINTS.includes(endpoint)) {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) {
                console.warn('[apiFetch] getSession error:', error.message);
            }

            token = session?.access_token || localStorage.getItem('token');

            if (session?.access_token) {
                // Keep localStorage in sync with refreshed token
                localStorage.setItem('token', session.access_token);
            }
        } catch (err) {
            console.error('[apiFetch] Failed to get session:', err);
            // Fall back to stored token
            token = localStorage.getItem('token');
        }
    }

    const headers = {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    console.log(`[apiFetch] ${options.method || 'GET'} ${endpoint}`);

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    // If unauthorized on a protected endpoint, clear token
    if (response.status === 401 && !AUTH_ENDPOINTS.includes(endpoint)) {
        console.warn('[apiFetch] 401 received — clearing stored token');
        localStorage.removeItem('token');
    }

    // Log non-OK responses for easier debugging
    if (!response.ok) {
        console.warn(`[apiFetch] ${endpoint} responded with ${response.status}`);
    }

    return response;
};