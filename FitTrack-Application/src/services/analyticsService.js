import api from './api';

/**
 * Fetches high-level analytics summary (total workouts, total volume, PR count, streaks).
 */
export const getAnalyticsSummary = async (userId) => {
    const response = await api.get('/analytics/summary', {
        params: userId ? { userId } : undefined,
    });
    return response.data || null;
};

/**
 * Fetches weekly workout frequency and volume breakdown over the last N weeks.
 */
export const getWeeklyFrequency = async (userId, weeks = 8) => {
    const response = await api.get('/analytics/charts/weekly-frequency', {
        params: { userId, weeks },
    });
    return response.data || [];
};

/**
 * Fetches strength progression time-series for a specific exercise.
 */
export const getStrengthProgression = async (userId, exerciseId, range = 'all') => {
    if (!exerciseId) return null;
    const response = await api.get('/analytics/charts/strength-progression', {
        params: { userId, exerciseId, range },
    });
    return response.data || null;
};

/**
 * Fetches composite chart data (weekly frequency, top exercises, and initial strength progression).
 */
export const getAnalyticsCharts = async (userId, { weeks = 8, range = 'all', exerciseId } = {}) => {
    const response = await api.get('/analytics/charts', {
        params: {
            userId,
            weeks,
            range,
            exerciseId: exerciseId || undefined,
        },
    });
    return response.data || {
        weeklyFrequency: [],
        topExercises: [],
        strengthProgression: null,
    };
};
