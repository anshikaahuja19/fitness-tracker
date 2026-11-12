const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/error');
const {
    createRoutine,
    getRoutinesByUserId,
    getRoutineById,
    updateRoutine,
    deleteRoutine,
    addExerciseToRoutine,
    getRoutineExercise,
    removeExerciseFromRoutine,
    updateRoutineExercise,
    replaceRoutineExercises,
} = require('../repository/routine.repository');

const createNewRoutine = asyncHandler(async (req, res) => {
    const { userId, name, description, isPublic, exercises } = req.body;

    const routine = await createRoutine({
        userId,
        name,
        description,
        isPublic,
        exercises,
    });

    return res.status(201).json({
        success: true,
        message: 'Workout routine created successfully',
        data: routine,
    });
});

const getMyRoutines = asyncHandler(async (req, res) => {
    const userId = req.query.userId || req.headers['x-user-id'];

    if (!userId) {
        throw new AppError('userId query parameter or x-user-id header is required', 400);
    }

    const includePublic = req.query.includePublic !== 'false';
    const routines = await getRoutinesByUserId(userId, includePublic);

    return res.status(200).json({
        success: true,
        message: 'Workout routines fetched successfully',
        data: routines,
    });
});

const getRoutine = asyncHandler(async (req, res) => {
    const routineId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!routineId) {
        throw new AppError('Routine ID is required', 400);
    }

    const routine = await getRoutineById(routineId);
    if (!routine) {
        throw new AppError('Workout routine not found', 404);
    }

    return res.status(200).json({
        success: true,
        message: 'Workout routine fetched successfully',
        data: routine,
    });
});

const updateRoutineDetails = asyncHandler(async (req, res) => {
    const routineId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!routineId) {
        throw new AppError('Routine ID is required', 400);
    }

    const existingRoutine = await getRoutineById(routineId);
    if (!existingRoutine) {
        throw new AppError('Workout routine not found', 404);
    }

    const updatedRoutine = await updateRoutine(routineId, req.body);

    return res.status(200).json({
        success: true,
        message: 'Workout routine updated successfully',
        data: updatedRoutine,
    });
});

const deleteRoutineById = asyncHandler(async (req, res) => {
    const routineId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!routineId) {
        throw new AppError('Routine ID is required', 400);
    }

    const existingRoutine = await getRoutineById(routineId);
    if (!existingRoutine) {
        throw new AppError('Workout routine not found', 404);
    }

    await deleteRoutine(routineId);

    return res.status(200).json({
        success: true,
        message: 'Workout routine deleted successfully',
        data: { id: routineId },
    });
});

const addExercise = asyncHandler(async (req, res) => {
    const routineId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!routineId) {
        throw new AppError('Routine ID is required', 400);
    }

    const routine = await getRoutineById(routineId);
    if (!routine) {
        throw new AppError('Workout routine not found', 404);
    }

    const { exerciseId, orderIndex, targetSets, targetReps, restSeconds, notes } = req.body;

    const newRoutineExercise = await addExerciseToRoutine({
        routineId,
        exerciseId,
        orderIndex,
        targetSets,
        targetReps,
        restSeconds,
        notes,
    });

    return res.status(201).json({
        success: true,
        message: 'Exercise added to routine successfully',
        data: newRoutineExercise,
    });
});

const removeExercise = asyncHandler(async (req, res) => {
    const routineId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const exerciseId = Array.isArray(req.params.exerciseId) ? req.params.exerciseId[0] : req.params.exerciseId;

    if (!routineId || !exerciseId) {
        throw new AppError('Both routineId and exerciseId are required', 400);
    }

    const routine = await getRoutineById(routineId);
    if (!routine) {
        throw new AppError('Workout routine not found', 404);
    }

    const existingExercise = await getRoutineExercise(routineId, exerciseId);
    if (!existingExercise) {
        throw new AppError('Exercise not found in this routine', 404);
    }

    await removeExerciseFromRoutine(routineId, exerciseId);

    return res.status(200).json({
        success: true,
        message: 'Exercise removed from routine successfully',
        data: { routineId, exerciseId },
    });
});

const updateExerciseInRoutine = asyncHandler(async (req, res) => {
    const routineId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const exerciseId = Array.isArray(req.params.exerciseId) ? req.params.exerciseId[0] : req.params.exerciseId;

    if (!routineId || !exerciseId) {
        throw new AppError('Both routineId and exerciseId are required', 400);
    }

    const routine = await getRoutineById(routineId);
    if (!routine) {
        throw new AppError('Workout routine not found', 404);
    }

    const existingExercise = await getRoutineExercise(routineId, exerciseId);
    if (!existingExercise) {
        throw new AppError('Exercise not found in this routine', 404);
    }

    const updated = await updateRoutineExercise(existingExercise.id, req.body);

    return res.status(200).json({
        success: true,
        message: 'Routine exercise updated successfully',
        data: updated,
    });
});

const replaceExercises = asyncHandler(async (req, res) => {
    const routineId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const routine = await getRoutineById(routineId);
    if (!routine) {
        throw new AppError('Workout routine not found', 404);
    }

    const updated = await replaceRoutineExercises(routineId, req.body.exercises);

    return res.status(200).json({
        success: true,
        message: 'Routine exercises saved successfully',
        data: updated,
    });
});

module.exports = {
    replaceExercises,
    createNewRoutine,
    getMyRoutines,
    getRoutine,
    updateRoutineDetails,
    deleteRoutineById,
    addExercise,
    removeExercise,
    updateExerciseInRoutine,
};
