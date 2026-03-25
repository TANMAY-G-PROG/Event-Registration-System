const API_BASE = import.meta.env.VITE_API_URL || '';

// Auth endpoints that don't need a bearer token
const AUTH_ENDPOINTS = [
    '/api/signin',
    '/api/signup',
    '/api/signout',
    '/api/forgot-password',
    '/api/reset-password',
];

export const apiFetch = async (endpoint, options = {}) => {
    let token = null;

    if (!AUTH_ENDPOINTS.includes(endpoint)) {
        token = localStorage.getItem('token');
    }

    const headers = {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    });

    // If unauthorized, clear token so user gets redirected to login
    if (response.status === 401 && !AUTH_ENDPOINTS.includes(endpoint)) {
        console.warn('[apiFetch] 401 received — clearing stored token');
        localStorage.removeItem('token');
    }

    if (!response.ok) {
        console.warn(`[apiFetch] ${endpoint} responded with ${response.status}`);
    }

    return response;
};