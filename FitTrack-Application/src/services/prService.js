import api from './api';

/**
 * Fetches all personal records for the user, grouped by exercise.
 */
export const getPersonalRecords = async (userId) => {
    const response = await api.get('/prs', {
        params: userId ? { userId } : undefined,
    });
    return response.data || { total: 0, records: [], grouped: [] };
};

/**
 * Fetches all personal records for a specific exercise.
 */
export const getExercisePRs = async (userId, exerciseId) => {
    if (!exerciseId) return { total: 0, records: [] };
    const response = await api.get(`/prs/exercise/${exerciseId}`, {
        params: userId ? { userId } : undefined,
    });
    return response.data || { total: 0, records: [] };
};
