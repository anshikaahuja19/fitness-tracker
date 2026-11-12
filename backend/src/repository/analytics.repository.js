/* global require, module */
const prisma = require('../prisma');
const AppError = require('../utils/error');

/**
 * Returns the Date object representing the start of the current week (Monday at 00:00:00.000).
 *
 * @returns {Date}
 */
const getStartOfWeek = () => {
  const now = new Date();
  const day = now.getDay();
  // In JS getDay(): 0 is Sunday, 1 is Monday ... 6 is Saturday
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const startOfWeek = new Date(now.setDate(diff));
  startOfWeek.setHours(0, 0, 0, 0);
  return startOfWeek;
};

/**
 * Computes analytics summary for a user:
 * - Total workouts (all time & this week)
 * - Total volume lifted (all time & this week)
 * - Total personal records achieved
 * - Active workout streak
 * - Recent workout sessions
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
const getAnalyticsSummary = async (userId) => {
  const startOfWeek = getStartOfWeek();

  // 1. Total completed workouts all-time
  const totalWorkoutsAllTime = await prisma.workoutSession.count({
    where: {
      userId,
      status: 'COMPLETED',
    },
  });

  // 2. Completed workouts this week
  const totalWorkoutsThisWeek = await prisma.workoutSession.count({
    where: {
      userId,
      status: 'COMPLETED',
      startTime: {
        gte: startOfWeek,
      },
    },
  });

  // 3. Volume aggregations
  const volumeAllTimeAgg = await prisma.workoutSession.aggregate({
    where: {
      userId,
      status: 'COMPLETED',
    },
    _sum: {
      totalVolumeKg: true,
    },
  });

  const volumeThisWeekAgg = await prisma.workoutSession.aggregate({
    where: {
      userId,
      status: 'COMPLETED',
      startTime: {
        gte: startOfWeek,
      },
    },
    _sum: {
      totalVolumeKg: true,
    },
  });

  // 4. Personal records count
  const totalPRs = await prisma.personalRecord.count({
    where: {
      userId,
    },
  });

  // 5. Recent 5 workouts
  const recentWorkouts = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: 'COMPLETED',
    },
    orderBy: {
      startTime: 'desc',
    },
    take: 5,
    select: {
      id: true,
      name: true,
      startTime: true,
      endTime: true,
      totalVolumeKg: true,
      routine: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          setLogs: true,
        },
      },
    },
  });

  // 6. Calculate workout streak (consecutive days with completed workouts)
  const pastSessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: 'COMPLETED',
    },
    select: {
      startTime: true,
    },
    orderBy: {
      startTime: 'desc',
    },
    take: 60,
  });

  let currentStreakDays = 0;
  if (pastSessions.length > 0) {
    const workoutDaysSet = new Set(
      pastSessions.map((s) => new Date(s.startTime).toISOString().slice(0, 10))
    );

    const checkDate = new Date();
    // Check if user worked out today or yesterday (to keep streak alive)
    const todayStr = checkDate.toISOString().slice(0, 10);
    checkDate.setDate(checkDate.getDate() - 1);
    const yesterdayStr = checkDate.toISOString().slice(0, 10);

    let streakDate = new Date();
    if (workoutDaysSet.has(todayStr)) {
      streakDate = new Date();
    } else if (workoutDaysSet.has(yesterdayStr)) {
      streakDate.setDate(streakDate.getDate() - 1);
    } else {
      streakDate = null;
    }

    if (streakDate) {
      while (workoutDaysSet.has(streakDate.toISOString().slice(0, 10))) {
        currentStreakDays++;
        streakDate.setDate(streakDate.getDate() - 1);
      }
    }
  }

  const totalVolumeThisWeek = Math.round((volumeThisWeekAgg._sum.totalVolumeKg || 0) * 100) / 100;
  const totalVolumeAllTime = Math.round((volumeAllTimeAgg._sum.totalVolumeKg || 0) * 100) / 100;

  return {
    totalWorkouts: totalWorkoutsAllTime,
    workoutsThisWeek: totalWorkoutsThisWeek,
    totalVolumeKg: totalVolumeAllTime,
    volumeThisWeekKg: totalVolumeThisWeek,
    totalPRs,
    currentStreakDays,
    weekStartDate: startOfWeek.toISOString(),
    recentWorkouts,
  };
};

/**
 * Computes weekly workout frequency and volume over the last N weeks.
 *
 * @param {string} userId
 * @param {number} [weeksCount=8]
 * @returns {Promise<Array<object>>}
 */
const getWeeklyFrequency = async (userId, weeksCount = 8) => {
  const safeWeeks = Math.min(Math.max(parseInt(weeksCount, 10) || 8, 1), 52);

  const currentWeekStart = getStartOfWeek();
  const startDate = new Date(currentWeekStart);
  startDate.setDate(startDate.getDate() - (safeWeeks - 1) * 7);

  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: 'COMPLETED',
      startTime: {
        gte: startDate,
      },
    },
    select: {
      id: true,
      name: true,
      startTime: true,
      endTime: true,
      totalVolumeKg: true,
    },
    orderBy: {
      startTime: 'asc',
    },
  });

  const weeksMap = new Map();
  for (let i = 0; i < safeWeeks; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i * 7);
    const dateStr = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    weeksMap.set(dateStr, {
      weekStartDate: dateStr,
      label,
      workoutCount: 0,
      totalVolumeKg: 0,
      totalDurationMinutes: 0,
      workouts: [],
    });
  }

  for (const session of sessions) {
    const sessionTime = new Date(session.startTime);
    const day = sessionTime.getDay();
    const diff = sessionTime.getDate() - day + (day === 0 ? -6 : 1);
    const sessionWeekStart = new Date(sessionTime.setDate(diff));
    sessionWeekStart.setHours(0, 0, 0, 0);
    const weekKey = sessionWeekStart.toISOString().slice(0, 10);

    let bucket = weeksMap.get(weekKey);
    if (!bucket) {
      const label = sessionWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      bucket = {
        weekStartDate: weekKey,
        label,
        workoutCount: 0,
        totalVolumeKg: 0,
        totalDurationMinutes: 0,
        workouts: [],
      };
      weeksMap.set(weekKey, bucket);
    }

    bucket.workoutCount += 1;
    bucket.totalVolumeKg += session.totalVolumeKg || 0;

    let durationMins = 0;
    if (session.endTime && session.startTime) {
      const diffMs = new Date(session.endTime) - new Date(session.startTime);
      durationMins = Math.max(0, Math.round(diffMs / 60000));
      bucket.totalDurationMinutes += durationMins;
    }

    bucket.workouts.push({
      id: session.id,
      name: session.name,
      date: session.startTime,
      volumeKg: session.totalVolumeKg,
      durationMinutes: durationMins,
    });
  }

  const result = Array.from(weeksMap.values()).map((w) => ({
    ...w,
    totalVolumeKg: Math.round(w.totalVolumeKg * 100) / 100,
  }));

  result.sort((a, b) => new Date(a.weekStartDate) - new Date(b.weekStartDate));
  return result;
};

/**
 * Returns strength progression time-series for a given exercise and user.
 *
 * @param {string} userId
 * @param {string} exerciseId
 * @param {string} [timeRange='all'] - '30d' | '90d' | '1y' | 'all'
 * @returns {Promise<object>}
 */
const getStrengthProgression = async (userId, exerciseId, timeRange = 'all') => {
  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    select: { id: true, name: true, category: true, primaryMuscle: true },
  });

  if (!exercise) {
    throw new AppError('Exercise not found', 404);
  }

  let dateFilter;
  const now = new Date();
  if (timeRange === '30d') {
    dateFilter = new Date(now.setDate(now.getDate() - 30));
  } else if (timeRange === '90d') {
    dateFilter = new Date(now.setDate(now.getDate() - 90));
  } else if (timeRange === '1y') {
    dateFilter = new Date(now.setFullYear(now.getFullYear() - 1));
  }

  const setLogs = await prisma.setLog.findMany({
    where: {
      exerciseId,
      isCompleted: true,
      workoutSession: {
        userId,
        status: 'COMPLETED',
        ...(dateFilter ? { startTime: { gte: dateFilter } } : {}),
      },
    },
    include: {
      workoutSession: {
        select: {
          id: true,
          name: true,
          startTime: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  const sessionMap = new Map();
  for (const set of setLogs) {
    const sessionId = set.workoutSessionId;
    if (!sessionMap.has(sessionId)) {
      sessionMap.set(sessionId, {
        sessionId,
        sessionName: set.workoutSession?.name || 'Workout',
        date: set.workoutSession?.startTime || set.createdAt,
        sets: [],
      });
    }
    sessionMap.get(sessionId).sets.push(set);
  }

  const progression = [];
  for (const entry of sessionMap.values()) {
    let maxWeight = 0;
    let repsAtMaxWeight = 0;
    let maxVolume = 0;
    let best1RM = 0;
    let totalExerciseVolume = 0;

    for (const set of entry.sets) {
      const weight = set.weight || 0;
      const reps = set.reps || 0;
      const volume = weight * reps;
      totalExerciseVolume += volume;

      if (weight > maxWeight) {
        maxWeight = weight;
        repsAtMaxWeight = reps;
      }
      if (volume > maxVolume) {
        maxVolume = volume;
      }
      const estimated1RM = reps > 1 ? weight * (1 + reps / 30) : weight;
      if (estimated1RM > best1RM) {
        best1RM = estimated1RM;
      }
    }

    progression.push({
      sessionId: entry.sessionId,
      sessionName: entry.sessionName,
      date: entry.date,
      maxWeightKg: Math.round(maxWeight * 100) / 100,
      repsAtMaxWeight,
      maxSetVolumeKg: Math.round(maxVolume * 100) / 100,
      estimated1RMKg: Math.round(best1RM * 100) / 100,
      totalVolumeKg: Math.round(totalExerciseVolume * 100) / 100,
      completedSets: entry.sets.length,
    });
  }

  progression.sort((a, b) => new Date(a.date) - new Date(b.date));

  const personalRecords = await prisma.personalRecord.findMany({
    where: {
      userId,
      exerciseId,
    },
    orderBy: {
      achievedAt: 'asc',
    },
    select: {
      id: true,
      recordType: true,
      value: true,
      weight: true,
      reps: true,
      achievedAt: true,
    },
  });

  return {
    exercise,
    progression,
    personalRecords,
  };
};

/**
 * Returns top exercises performed by user, useful for chart dropdowns.
 *
 * @param {string} userId
 * @param {number} [limit=5]
 * @returns {Promise<Array<object>>}
 */
const getTopExercises = async (userId, limit = 5) => {
  const setLogs = await prisma.setLog.findMany({
    where: {
      isCompleted: true,
      workoutSession: {
        userId,
        status: 'COMPLETED',
      },
    },
    select: {
      exerciseId: true,
      exercise: {
        select: {
          id: true,
          name: true,
          primaryMuscle: true,
          category: true,
        },
      },
    },
  });

  const countMap = new Map();
  for (const log of setLogs) {
    if (!countMap.has(log.exerciseId)) {
      countMap.set(log.exerciseId, {
        exercise: log.exercise,
        count: 0,
      });
    }
    countMap.get(log.exerciseId).count += 1;
  }

  return Array.from(countMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((item) => ({
      ...item.exercise,
      totalSetsLogged: item.count,
    }));
};

module.exports = {
  getStartOfWeek,
  getAnalyticsSummary,
  getWeeklyFrequency,
  getStrengthProgression,
  getTopExercises,
};
