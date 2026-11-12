/* global require, module */
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/error');
const {
  getAnalyticsSummary,
  getWeeklyFrequency,
  getStrengthProgression,
  getTopExercises,
} = require('../repository/analytics.repository');

const getUserId = (req) => {
  const userId = req.user?.id || req.headers['x-user-id'] || req.query.userId;
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    throw new AppError('User authentication required or x-user-id header missing', 401);
  }
  return userId.trim();
};

const getSummary = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const summary = await getAnalyticsSummary(userId);

  return res.status(200).json({
    success: true,
    message: 'Analytics summary fetched successfully',
    data: summary,
  });
});

/**
 * GET /api/analytics/charts/weekly-frequency
 * Returns weekly workout frequency and volume stats.
 */
const getWeeklyFrequencyChart = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const weeks = req.query.weeks ? parseInt(req.query.weeks, 10) : 8;
  const frequency = await getWeeklyFrequency(userId, weeks);

  return res.status(200).json({
    success: true,
    message: 'Weekly workout frequency fetched successfully',
    data: frequency,
  });
});

/**
 * GET /api/analytics/charts/strength-progression
 * Returns strength progression time-series for a specific exercise.
 */
const getStrengthProgressionChart = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const exerciseId = req.query.exerciseId || req.params.exerciseId;
  const timeRange = req.query.range || 'all';

  if (!exerciseId) {
    throw new AppError('exerciseId query or path parameter is required', 400);
  }

  const progression = await getStrengthProgression(userId, exerciseId, timeRange);

  return res.status(200).json({
    success: true,
    message: 'Strength progression fetched successfully',
    data: progression,
  });
});

/**
 * GET /api/analytics/charts
 * Composite endpoint returning weekly frequency, top exercises, and strength progression.
 */
const getCharts = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const weeks = req.query.weeks ? parseInt(req.query.weeks, 10) : 8;
  const timeRange = req.query.range || 'all';

  const [weeklyFrequency, topExercises] = await Promise.all([
    getWeeklyFrequency(userId, weeks),
    getTopExercises(userId, 5),
  ]);

  const targetExerciseId = req.query.exerciseId || (topExercises[0] ? topExercises[0].id : null);
  let strengthProgression = null;

  if (targetExerciseId) {
    try {
      strengthProgression = await getStrengthProgression(userId, targetExerciseId, timeRange);
    } catch {
      strengthProgression = null;
    }
  }

  return res.status(200).json({
    success: true,
    message: 'Analytics charts data fetched successfully',
    data: {
      weeklyFrequency,
      topExercises,
      strengthProgression,
    },
  });
});

module.exports = {
  getSummary,
  getCharts,
  getWeeklyFrequencyChart,
  getStrengthProgressionChart,
};
