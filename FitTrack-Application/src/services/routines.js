import { api } from './api';

// Routine Builder API calls. Token + x-user-id are attached by services/api.js.

export async function fetchRoutine(id) {
  const res = await api.get(`/routines/${id}`);
  return res.data;
}

export async function createRoutine({ userId, name, description, exercises }) {
  const res = await api.post('/routines', { userId, name, description, exercises });
  return res.data;
}

export async function updateRoutine(id, { name, description }) {
  const res = await api.put(`/routines/${id}`, { name, description });
  return res.data;
}

// Replaces the routine's whole ordered exercise list.
export async function saveRoutineExercises(id, exercises) {
  const res = await api.put(`/routines/${id}/exercises`, { exercises });
  return res.data;
}

export async function deleteRoutine(id) {
  await api.delete(`/routines/${id}`);
}
