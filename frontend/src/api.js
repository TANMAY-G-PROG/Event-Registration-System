const API_BASE = import.meta.env.VITE_API_URL || "";

export const apiFetch = (endpoint, options = {}) => {
    const token = localStorage.getItem('token');

    const headers = {
        ...options.headers,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    return fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });
};
