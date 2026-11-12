import { api } from './api';

export const getUserRoutines = async (userId) => {
    const response = await api.get('/routines', {
        params: { userId },
    });
    return response.data || [];
};

export const getRecentSessions = async (userId, limit = 5) => {
    const response = await api.get('/sessions', {
        params: { userId, limit },
    });
    return response.data || [];
};

export const getWorkoutHistory = async (userId, { status = 'COMPLETED', limit = 50 } = {}) => {
    const response = await api.get('/sessions', {
        params: { userId, status, limit },
    });
    return response.data || [];
};

export const startWorkoutSession = async ({ userId, routineId, name, notes }) => {
    const response = await api.post('/sessions', {
        userId,
        ...(routineId ? { routineId } : {}),
        ...(name ? { name } : {}),
        ...(notes ? { notes } : {}),
    });
    return response.data;
};

export const getSessionDetails = async (sessionId) => {
    const response = await api.get(`/sessions/${sessionId}`);
    return response.data;
};

export const getSessionSets = async (sessionId) => {
    const response = await api.get(`/sessions/${sessionId}/sets`);
    return response.data;
};

export const saveSessionSets = async (sessionId, sets, replace = false) => {
    const response = await api.put(`/sessions/${sessionId}/sets`, {
        sets,
        replace,
    });
    return response.data;
};

export const updateSingleSessionSet = async (sessionId, setId, updates) => {
    const response = await api.patch(`/sessions/${sessionId}/sets/${setId}`, updates);
    return response.data;
};

export const deleteSingleSessionSet = async (sessionId, setId) => {
    const response = await api.delete(`/sessions/${sessionId}/sets/${setId}`);
    return response.data;
};

export const updateWorkoutSession = async (sessionId, updates) => {
    const response = await api.patch(`/sessions/${sessionId}`, updates);
    return response.data;
};

