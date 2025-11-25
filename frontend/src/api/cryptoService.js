import api from './client.js';

export const getPublicKey = () => api.get('/crypto/public-key').then((res) => res.data);

export const simulateSecureMessage = (payload) =>
  api.post('/crypto/simulate', payload).then((res) => res.data);
