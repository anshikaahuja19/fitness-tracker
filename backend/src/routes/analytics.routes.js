/* global require, module */
const express = require('express');
const {
  getSummary,
  getCharts,
  getWeeklyFrequencyChart,
  getStrengthProgressionChart,
} = require('../controllers/analytics.controller');

const analyticsRouter = express.Router();

// Summary endpoint
analyticsRouter.get('/summary', getSummary);

// Specific chart endpoints
analyticsRouter.get('/charts/weekly-frequency', getWeeklyFrequencyChart);
analyticsRouter.get('/charts/strength-progression', getStrengthProgressionChart);
analyticsRouter.get('/charts/strength-progression/:exerciseId', getStrengthProgressionChart);

// Composite charts endpoint
analyticsRouter.get('/charts', getCharts);

module.exports = analyticsRouter;
