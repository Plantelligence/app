import api from './client.js';

export const getUsers = () => api.get('/admin/users').then((res) => res.data);

export const updateUserRole = ({ userId, role }) =>
  api.put(`/admin/users/${userId}/role`, { role }).then((res) => res.data);

export const getUserGreenhouseConfig = (userId) =>
  api.get(`/admin/greenhouse/${userId}`).then((res) => res.data);

export const updateGreenhouseTeam = ({ userId, watcherIds }) =>
  api.put(`/admin/greenhouse/${userId}/team`, { watcherIds }).then((res) => res.data);
