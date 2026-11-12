const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/error');

const validateCreateRoutine = asyncHandler(async (req, _res, next) => {
    const { userId, name, description, isPublic, exercises } = req.body;

    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
        throw new AppError('userId is required', 400);
    }

    if (!name || typeof name !== 'string' || name.trim() === '') {
        throw new AppError('Routine name is required and must be a string', 400);
    }

    if (name.trim().length > 100) {
        throw new AppError('Routine name must not exceed 100 characters', 400);
    }

    if (description !== undefined && typeof description !== 'string') {
        throw new AppError('Description must be a string', 400);
    }

    if (isPublic !== undefined && typeof isPublic !== 'boolean') {
        throw new AppError('isPublic must be a boolean', 400);
    }

    if (exercises !== undefined) {
        if (!Array.isArray(exercises)) {
            throw new AppError('Exercises must be an array of exercise objects', 400);
        }

        for (let i = 0; i < exercises.length; i++) {
            const item = exercises[i];
            if (!item.exerciseId || typeof item.exerciseId !== 'string') {
                throw new AppError(`Exercise at index ${i} must contain a valid exerciseId`, 400);
            }
            if (item.targetSets !== undefined && (typeof item.targetSets !== 'number' || item.targetSets <= 0)) {
                throw new AppError(`targetSets at index ${i} must be a positive integer`, 400);
            }
            if (item.restSeconds !== undefined && (typeof item.restSeconds !== 'number' || item.restSeconds < 0)) {
                throw new AppError(`restSeconds at index ${i} must be a non-negative integer`, 400);
            }
        }
    }

    req.body = {
        userId: userId.trim(),
        name: name.trim(),
        description: description?.trim() || null,
        isPublic: Boolean(isPublic),
        exercises: exercises || [],
    };

    return next();
});

const validateUpdateRoutine = asyncHandler(async (req, _res, next) => {
    const { name, description, isPublic } = req.body;

    if (name !== undefined) {
        if (typeof name !== 'string' || name.trim() === '') {
            throw new AppError('Routine name must be a non-empty string', 400);
        }
        if (name.trim().length > 100) {
            throw new AppError('Routine name must not exceed 100 characters', 400);
        }
        req.body.name = name.trim();
    }

    if (description !== undefined) {
        req.body.description = typeof description === 'string' ? description.trim() : null;
    }

    if (isPublic !== undefined) {
        if (typeof isPublic !== 'boolean') {
            throw new AppError('isPublic must be a boolean', 400);
        }
    }

    return next();
});

const validateAddExercise = asyncHandler(async (req, _res, next) => {
    const { exerciseId, orderIndex, targetSets, targetReps, restSeconds, notes } = req.body;

    if (!exerciseId || typeof exerciseId !== 'string' || exerciseId.trim() === '') {
        throw new AppError('exerciseId is required and must be a valid string', 400);
    }

    if (orderIndex !== undefined && (typeof orderIndex !== 'number' || orderIndex < 0)) {
        throw new AppError('orderIndex must be a non-negative integer', 400);
    }

    if (targetSets !== undefined && (typeof targetSets !== 'number' || targetSets <= 0)) {
        throw new AppError('targetSets must be a positive integer', 400);
    }

    if (targetReps !== undefined && typeof targetReps !== 'string') {
        throw new AppError("targetReps must be a string (e.g. '8-12')", 400);
    }

    if (restSeconds !== undefined && (typeof restSeconds !== 'number' || restSeconds < 0)) {
        throw new AppError('restSeconds must be a non-negative integer', 400);
    }

    if (notes !== undefined && typeof notes !== 'string') {
        throw new AppError('notes must be a string', 400);
    }

    req.body = {
        exerciseId: exerciseId.trim(),
        orderIndex: orderIndex !== undefined ? Math.floor(orderIndex) : undefined,
        targetSets: targetSets !== undefined ? Math.floor(targetSets) : 3,
        targetReps: targetReps ? targetReps.trim() : '8-12',
        restSeconds: restSeconds !== undefined ? Math.floor(restSeconds) : 90,
        notes: notes ? notes.trim() : null,
    };

    return next();
});

const validateUpdateRoutineExercise = asyncHandler(async (req, _res, next) => {
    const { orderIndex, targetSets, targetReps, restSeconds, notes } = req.body;

    if (orderIndex !== undefined && (typeof orderIndex !== 'number' || orderIndex < 0)) {
        throw new AppError('orderIndex must be a non-negative integer', 400);
    }

    if (targetSets !== undefined && (typeof targetSets !== 'number' || targetSets <= 0)) {
        throw new AppError('targetSets must be a positive integer', 400);
    }

    if (targetReps !== undefined && typeof targetReps !== 'string') {
        throw new AppError('targetReps must be a string', 400);
    }

    if (restSeconds !== undefined && (typeof restSeconds !== 'number' || restSeconds < 0)) {
        throw new AppError('restSeconds must be a non-negative integer', 400);
    }

    if (notes !== undefined && typeof notes !== 'string') {
        throw new AppError('notes must be a string', 400);
    }

    return next();
});

const validateReplaceRoutineExercises = asyncHandler(async (req, _res, next) => {
    const { exercises } = req.body;

    if (!Array.isArray(exercises)) {
        throw new AppError('exercises must be an array', 400);
    }

    req.body.exercises = exercises.map((item, i) => {
        if (!item || typeof item.exerciseId !== 'string' || item.exerciseId.trim() === '') {
            throw new AppError(`Exercise at index ${i} must contain a valid exerciseId`, 400);
        }
        if (item.targetSets !== undefined && (!Number.isInteger(item.targetSets) || item.targetSets <= 0)) {
            throw new AppError(`targetSets at index ${i} must be a positive integer`, 400);
        }
        if (item.targetReps !== undefined && typeof item.targetReps !== 'string') {
            throw new AppError(`targetReps at index ${i} must be a string`, 400);
        }
        if (item.restSeconds !== undefined && (!Number.isInteger(item.restSeconds) || item.restSeconds < 0)) {
            throw new AppError(`restSeconds at index ${i} must be a non-negative integer`, 400);
        }
        return {
            exerciseId: item.exerciseId.trim(),
            targetSets: item.targetSets,
            targetReps: item.targetReps?.trim() || undefined,
            restSeconds: item.restSeconds,
            notes: typeof item.notes === 'string' ? item.notes.trim() : null,
        };
    });

    return next();
});

const validateStartSession = asyncHandler(async (req, _res, next) => {
    const rawUserId = req.body.userId || req.headers['x-user-id'];
    const { routineId, name, notes } = req.body;

    if (!rawUserId || typeof rawUserId !== 'string' || rawUserId.trim() === '') {
        throw new AppError('userId is required', 400);
    }

    if (routineId !== undefined && routineId !== null) {
        if (typeof routineId !== 'string' || routineId.trim() === '') {
            throw new AppError('routineId must be a valid string', 400);
        }
    }

    if (name !== undefined && name !== null) {
        if (typeof name !== 'string' || name.trim() === '') {
            throw new AppError('Session name must be a non-empty string', 400);
        }
        if (name.trim().length > 100) {
            throw new AppError('Session name must not exceed 100 characters', 400);
        }
    }

    if (notes !== undefined && notes !== null && typeof notes !== 'string') {
        throw new AppError('notes must be a string', 400);
    }

    req.body = {
        userId: rawUserId.trim(),
        routineId: routineId ? routineId.trim() : null,
        name: name ? name.trim() : undefined,
        notes: notes ? notes.trim() : null,
    };

    return next();
});

const validateUpdateSession = asyncHandler(async (req, _res, next) => {
    const { name, status, totalVolumeKg, notes, endTime } = req.body;
    const allowedStatuses = ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

    if (name !== undefined) {
        if (typeof name !== 'string' || name.trim() === '') {
            throw new AppError('Session name must be a non-empty string', 400);
        }
        if (name.trim().length > 100) {
            throw new AppError('Session name must not exceed 100 characters', 400);
        }
        req.body.name = name.trim();
    }

    if (status !== undefined && !allowedStatuses.includes(status)) {
        throw new AppError('status must be one of IN_PROGRESS, COMPLETED, or CANCELLED', 400);
    }

    if (totalVolumeKg !== undefined && (typeof totalVolumeKg !== 'number' || totalVolumeKg < 0)) {
        throw new AppError('totalVolumeKg must be a non-negative number', 400);
    }

    if (notes !== undefined && notes !== null && typeof notes !== 'string') {
        throw new AppError('notes must be a string', 400);
    }

    if (endTime !== undefined && endTime !== null && Number.isNaN(Date.parse(endTime))) {
        throw new AppError('endTime must be a valid ISO date string', 400);
    }

    return next();
});

const validateSetEntry = (item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new AppError(`sets[${index}] must be an object`, 400);
    }

    const { id, exerciseId, setNumber, weight, reps, rpe, isCompleted } = item;

    if (id !== undefined && id !== null && (typeof id !== 'string' || id.trim() === '')) {
        throw new AppError(`sets[${index}].id must be a non-empty string`, 400);
    }

    if (!id && (!exerciseId || typeof exerciseId !== 'string' || exerciseId.trim() === '')) {
        throw new AppError(`sets[${index}].exerciseId is required when creating a set`, 400);
    }

    if (exerciseId !== undefined && (typeof exerciseId !== 'string' || exerciseId.trim() === '')) {
        throw new AppError(`sets[${index}].exerciseId must be a non-empty string`, 400);
    }

    if (!id && setNumber === undefined) {
        throw new AppError(`sets[${index}].setNumber is required when creating a set`, 400);
    }

    if (setNumber !== undefined && (!Number.isInteger(setNumber) || setNumber < 1)) {
        throw new AppError(`sets[${index}].setNumber must be an integer >= 1`, 400);
    }

    if (weight !== undefined && (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0)) {
        throw new AppError(`sets[${index}].weight must be a non-negative number`, 400);
    }

    if (reps !== undefined && (!Number.isInteger(reps) || reps < 0)) {
        throw new AppError(`sets[${index}].reps must be an integer >= 0`, 400);
    }

    if (rpe !== undefined && rpe !== null && (typeof rpe !== 'number' || !Number.isFinite(rpe) || rpe < 0 || rpe > 10)) {
        throw new AppError(`sets[${index}].rpe must be between 0 and 10`, 400);
    }

    if (isCompleted !== undefined && typeof isCompleted !== 'boolean') {
        throw new AppError(`sets[${index}].isCompleted must be a boolean`, 400);
    }

    return {
        ...(id ? { id: id.trim() } : {}),
        ...(exerciseId !== undefined ? { exerciseId: exerciseId.trim() } : {}),
        ...(setNumber !== undefined ? { setNumber } : {}),
        ...(weight !== undefined ? { weight } : id ? {} : { weight: 0 }),
        ...(reps !== undefined ? { reps } : id ? {} : { reps: 0 }),
        ...(rpe !== undefined ? { rpe } : {}),
        ...(isCompleted !== undefined ? { isCompleted } : id ? {} : { isCompleted: true }),
    };
};

const validateBatchSets = asyncHandler(async (req, _res, next) => {
    const { sets, replace } = req.body || {};

    if (!Array.isArray(sets) || sets.length === 0) {
        throw new AppError('sets must be a non-empty array', 400);
    }

    if (replace !== undefined && typeof replace !== 'boolean') {
        throw new AppError('replace must be a boolean', 400);
    }

    const normalizedSets = sets.map((item, index) => validateSetEntry(item, index));

    req.body = {
        sets: normalizedSets,
        replace: Boolean(replace),
    };

    return next();
});

const validateUpdateSet = asyncHandler(async (req, _res, next) => {
    const { setNumber, weight, reps, rpe, isCompleted } = req.body || {};

    if (
        setNumber === undefined &&
        weight === undefined &&
        reps === undefined &&
        rpe === undefined &&
        isCompleted === undefined
    ) {
        throw new AppError('At least one field (setNumber, weight, reps, rpe, isCompleted) is required', 400);
    }

    if (setNumber !== undefined && (!Number.isInteger(setNumber) || setNumber < 1)) {
        throw new AppError('setNumber must be an integer >= 1', 400);
    }

    if (weight !== undefined && (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0)) {
        throw new AppError('weight must be a non-negative number', 400);
    }

    if (reps !== undefined && (!Number.isInteger(reps) || reps < 0)) {
        throw new AppError('reps must be an integer >= 0', 400);
    }

    if (rpe !== undefined && rpe !== null && (typeof rpe !== 'number' || !Number.isFinite(rpe) || rpe < 0 || rpe > 10)) {
        throw new AppError('rpe must be between 0 and 10', 400);
    }

    if (isCompleted !== undefined && typeof isCompleted !== 'boolean') {
        throw new AppError('isCompleted must be a boolean', 400);
    }

    req.body = {
        ...(setNumber !== undefined && { setNumber }),
        ...(weight !== undefined && { weight }),
        ...(reps !== undefined && { reps }),
        ...(rpe !== undefined && { rpe }),
        ...(isCompleted !== undefined && { isCompleted }),
    };

    return next();
});

module.exports = {
    validateCreateRoutine,
    validateUpdateRoutine,
    validateAddExercise,
    validateUpdateRoutineExercise,
    validateReplaceRoutineExercises,
    validateStartSession,
    validateUpdateSession,
    validateBatchSets,
    validateUpdateSet,
};

