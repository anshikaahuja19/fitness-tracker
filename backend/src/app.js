const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRouter = require('./routes/auth.routes');
const userRouter = require('./routes/user.routes');
const exerciseRouter = require('./routes/exercise.routes');
const routineRouter = require('./routes/routine.routes');
const sessionRouter = require('./routes/session.routes');
const prRouter = require('./routes/pr.routes');
const analyticsRouter = require('./routes/analytics.routes');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

const app = express();

// Security headers
app.use(helmet());

// CORS configuration — whitelist production and local origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:19006'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'FitTrack API is running' });
});

app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/exercises', exerciseRouter);

app.use('/api/v1/routines', routineRouter);
app.use('/api/routines', routineRouter);
app.use('/routines', routineRouter);

app.use('/api/v1/sessions', sessionRouter);
app.use('/api/sessions', sessionRouter);
app.use('/sessions', sessionRouter);

app.use('/api/v1/prs', prRouter);
app.use('/api/prs', prRouter);
app.use('/prs', prRouter);

app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/analytics', analyticsRouter);

// 404 & Global Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
