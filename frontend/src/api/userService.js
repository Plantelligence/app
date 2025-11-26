import api from './client.js';

export const getProfile = () => api.get('/users/me').then((res) => res.data);

export const updateProfile = (payload) => api.put('/users/me', payload).then((res) => res.data);

export const changePassword = (payload) =>
  api.post('/users/change-password', payload).then((res) => res.data);

export const requestPasswordChangeChallenge = () =>
  api.post('/users/change-password/challenge').then((res) => res.data);

export const requestDeletion = (payload) =>
  api.post('/users/deletion-request', payload).then((res) => res.data);

export const getSecurityLogs = () => api.get('/users/logs').then((res) => res.data);

export const startOtpEnrollment = () =>
  api.post('/users/me/mfa/otp/start').then((res) => res.data);

export const confirmOtpEnrollment = (payload) =>
  api.post('/users/me/mfa/otp/confirm', payload).then((res) => res.data);
