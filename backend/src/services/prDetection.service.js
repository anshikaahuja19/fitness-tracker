/* global require, module */
const prisma = require('../prisma');
/**
 * @param {number} weight
 * @param {number} reps
 * @returns {number}
 */
const calculate1RM = (weight, reps) => {
  const w = Number(weight) || 0;
  const r = Number(reps) || 0;
  if (w <= 0 || r <= 0) return 0;
  if (r === 1) return w;
  const estimated = w * (1 + r / 30);
  return Math.round(estimated * 100) / 100;
};

/**
 *
 * @param {object} params
 * @param {string} params.userId 
 * @param {string} params.exerciseId 
 * @param {string} [params.setLogId] 
 * @param {number|string} params.weight
 * @param {number|string} params.reps 
 * @param {object} [params.tx] 
 * @returns {Promise<Array<object>>} 
 */
const detectAndSavePRs = async ({ userId, exerciseId, setLogId, weight, reps, tx }) => {
  const db = tx || prisma;

  if (!userId || !exerciseId) return [];

  const numWeight = Number(weight) || 0;
  const numReps = Number(reps) || 0;

  if (numWeight <= 0 && numReps <= 0) return [];

  const validSetLogId = setLogId && typeof setLogId === 'string' && setLogId.trim() !== '' ? setLogId.trim() : null;

  // Metrics for this set
  const candidates = [
    {
      recordType: 'MAX_WEIGHT',
      value: numWeight,
      weight: numWeight,
      reps: numReps,
    },
    {
      recordType: 'MAX_VOLUME',
      value: Math.round(numWeight * numReps * 100) / 100,
      weight: numWeight,
      reps: numReps,
    },
    {
      recordType: 'MAX_REPS',
      value: numReps,
      weight: numWeight,
      reps: numReps,
    },
    {
      recordType: 'ESTIMATED_1RM',
      value: calculate1RM(numWeight, numReps),
      weight: numWeight,
      reps: numReps,
    },
  ];

  const existingPRs = await db.personalRecord.findMany({
    where: {
      userId,
      exerciseId,
    },
  });

  const existingMap = new Map();
  for (const pr of existingPRs) {
    existingMap.set(pr.recordType, pr);
  }

  const newPRsAchieved = [];

  for (const candidate of candidates) {
    if (candidate.value <= 0) continue;

    const existing = existingMap.get(candidate.recordType);
    const isNewRecord = !existing || candidate.value > existing.value;

    if (isNewRecord) {
      const oldValue = existing ? existing.value : null;
      let savedRecord;
      if (existing) {
        savedRecord = await db.personalRecord.update({
          where: { id: existing.id },
          data: {
            value: candidate.value,
            weight: candidate.weight,
            reps: candidate.reps,
            setLogId: validSetLogId,
            achievedAt: new Date(),
          },
          include: {
            exercise: {
              select: { id: true, name: true, primaryMuscle: true },
            },
          },
        });
      } else {
        // Create new record
        savedRecord = await db.personalRecord.create({
          data: {
            userId,
            exerciseId,
            setLogId: validSetLogId,
            recordType: candidate.recordType,
            value: candidate.value,
            weight: candidate.weight,
            reps: candidate.reps,
            achievedAt: new Date(),
          },
          include: {
            exercise: {
              select: { id: true, name: true, primaryMuscle: true },
            },
          },
        });
      }

      newPRsAchieved.push({
        id: savedRecord.id,
        recordType: candidate.recordType,
        value: candidate.value,
        weight: candidate.weight,
        reps: candidate.reps,
        previousValue: oldValue,
        improvement: oldValue ? Math.round((candidate.value - oldValue) * 100) / 100 : candidate.value,
        exerciseId,
        exerciseName: savedRecord.exercise?.name,
        setLogId: validSetLogId,
        achievedAt: savedRecord.achievedAt,
      });
    }
  }

  return newPRsAchieved;
};

/**
 * @param {object} params
 * @param {string} params.userId 
 * @param {Array<object>} params.sets 
 * @param {object} [params.tx] 
 * @returns {Promise<Array<object>>}
 */
const processSessionPRs = async ({ userId, sets, tx }) => {
  if (!userId || !Array.isArray(sets) || sets.length === 0) {
    return [];
  }

  const allDetectedPRs = [];

  for (const set of sets) {
    
    if (set.isCompleted === false) continue;

    const prs = await detectAndSavePRs({
      userId,
      exerciseId: set.exerciseId,
      setLogId: set.id || set.setLogId,
      weight: Number(set.weight) || 0,
      reps: Number(set.reps) || 0,
      tx,
    });

    if (prs.length > 0) {
      allDetectedPRs.push(...prs);
    }
  }

  return allDetectedPRs;
};

module.exports = {
  calculate1RM,
  detectAndSavePRs,
  processSessionPRs,
};
