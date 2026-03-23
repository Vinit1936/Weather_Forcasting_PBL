(function () {
  'use strict';

  const BASE_URL = 'http://localhost:5000';

  window.SkyPulseConfig = {
    BASE_URL,
    API: {
      auth: `${BASE_URL}/api/auth`,
      weather: `${BASE_URL}/api/weather`,
      travel: `${BASE_URL}/api/travel`,
    },
    getToken() {
      return localStorage.getItem('token') || localStorage.getItem('sp_token') || '';
    },
    setToken(token) {
      if (!token) return;
      localStorage.setItem('token', token);
      localStorage.setItem('sp_token', token);
    },
    clearToken() {
      localStorage.removeItem('token');
      localStorage.removeItem('sp_token');
    },
    authHeaders() {
      const token = this.getToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
  };
})();
