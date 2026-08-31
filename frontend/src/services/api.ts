import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Access Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Auto-refresh Access Token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const res = await axios.post(`${API_URL}/api/token/refresh/`, {
            refresh: refreshToken,
          });
          if (res.status === 200) {
            const newAccess = res.data.access;
            localStorage.setItem('access_token', newAccess);
            api.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`;
            originalRequest.headers['Authorization'] = `Bearer ${newAccess}`;
            return api(originalRequest);
          }
        }
      } catch (refreshError) {
        // Clear auth and force reload to login view if refresh fails
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_profile');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export { API_URL };
export default api;
