import api from './client.js';

export const register = (payload) => api.post('/auth/register', payload).then((res) => res.data);

export const confirmRegistration = (payload) =>
  api.post('/auth/register/confirm', payload).then((res) => res.data);

export const finalizeRegistration = (payload) =>
  api.post('/auth/register/otp', payload).then((res) => res.data);

export const login = (payload) => api.post('/auth/login', payload).then((res) => res.data);

export const initiateMfa = (payload) => api.post('/auth/mfa/initiate', payload).then((res) => res.data);

export const verifyMfa = (payload) => api.post('/auth/mfa/verify', payload).then((res) => res.data);

export const refresh = (payload) => api.post('/auth/refresh', payload).then((res) => res.data);

export const logout = (payload) => api.post('/auth/logout', payload).then((res) => res.status);

export const requestPasswordReset = (payload) =>
  api.post('/auth/password-reset/request', payload).then((res) => res.data);

export const confirmPasswordReset = (payload) =>
  api.post('/auth/password-reset/confirm', payload).then((res) => res.data);
