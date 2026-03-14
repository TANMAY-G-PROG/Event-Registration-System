const API_BASE = import.meta.env.VITE_API_URL || "";

export const apiFetch = (endpoint, options = {}) => {
  return fetch(`${API_BASE}${endpoint}`, {
    credentials: "include",
    ...options
  });
};