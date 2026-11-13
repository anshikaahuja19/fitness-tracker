import { api } from './api';

// All exercise API calls live here. The auth token is attached automatically by services/api.js.

export async function fetchExercises({ search, muscle, mine, page = 1, limit = 50 } = {}) {
  const res = await api.get('/exercises', {
    params: { search: search || undefined, muscle: muscle || undefined, mine: mine ? 'true' : undefined, page, limit },
  });
  return { items: res.data || [], pagination: res.pagination };
}

export async function fetchExerciseOptions() {
  const res = await api.get('/exercises/options');
  return res.data;
}

export async function createExercise(exercise) {
  const res = await api.post('/exercises', exercise);
  return res.data;
}

export async function deleteExercise(id) {
  await api.delete(`/exercises/${id}`);
}

// What the user logged last time for each exercise (latest completed workout).
// Returns { [exerciseId]: { sessionId, sessionName, performedAt, sets: [{ setNumber, weight, reps }] } }
export async function fetchPreviousSets(exerciseIds, { excludeSessionId } = {}) {
  if (!exerciseIds || exerciseIds.length === 0) return {};
  const res = await api.get('/exercises/previous-sets', {
    params: { ids: exerciseIds.join(','), excludeSessionId: excludeSessionId || undefined },
  });
  return res.data || {};
}
