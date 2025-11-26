import api from './client.js';

export const getFlowerRecommendations = () =>
  api.get('/greenhouse/recommendations').then((res) => res.data);

export const listGreenhouses = () =>
  api.get('/greenhouse').then((res) => res.data);

export const createGreenhouse = (payload) =>
  api.post('/greenhouse', payload).then((res) => res.data);

export const getGreenhouse = (greenhouseId) =>
  api.get(`/greenhouse/${greenhouseId}`).then((res) => res.data);

export const updateGreenhouse = (greenhouseId, payload) =>
  api.put(`/greenhouse/${greenhouseId}`, payload).then((res) => res.data);

export const updateGreenhouseAlerts = (greenhouseId, payload) =>
  api.patch(`/greenhouse/${greenhouseId}/alerts`, payload).then((res) => res.data);

export const evaluateGreenhouseMetrics = (greenhouseId, payload) =>
  api.post(`/greenhouse/${greenhouseId}/evaluate`, payload).then((res) => res.data);

export const deleteGreenhouse = (greenhouseId) =>
  api.delete(`/greenhouse/${greenhouseId}`).then((res) => res.data);
