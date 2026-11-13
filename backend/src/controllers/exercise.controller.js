const { ExerciseCategory, MuscleGroup, Equipment, Difficulty } = require('@prisma/client');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/error');
const {
    listExercises,
    findVisibleExercise,
    findPreviousSets,
    createCustomExercise,
    updateExercise,
    deleteExercise,
} = require('../repository/exercise.repository');

// Translate known Prisma errors into friendly API errors.
const mapPrismaError = (err) => {
    if (err.code === 'P2002') {
        return new AppError('You already have an exercise with this name', 409);
    }
    if (err.code === 'P2003') {
        return new AppError('This exercise is used in a routine or workout and cannot be deleted', 409);
    }
    return err;
};

// Only the owner can edit/delete, and only custom exercises.
const getOwnedCustomExercise = async (id, userId) => {
    const exercise = await findVisibleExercise(id, userId);
    if (!exercise) {
        throw new AppError('Exercise not found', 404);
    }
    if (!exercise.isCustom || exercise.createdById !== userId) {
        throw new AppError('Only your own custom exercises can be modified', 403);
    }
    return exercise;
};

const getExercises = asyncHandler(async (req, res) => {
    const { items, total } = await listExercises(req.user.id, req.filters);
    const { page, limit } = req.filters;

    return res.status(200).json({
        success: true,
        message: 'Exercises fetched successfully',
        data: items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
});

// Enum values so the app can render filter chips / pickers without hardcoding them.
const getExerciseOptions = asyncHandler(async (_req, res) =>
    res.status(200).json({
        success: true,
        message: 'Exercise options fetched successfully',
        data: {
            categories: Object.values(ExerciseCategory),
            muscleGroups: Object.values(MuscleGroup),
            equipment: Object.values(Equipment),
            difficulties: Object.values(Difficulty),
        },
    })
);

const getExerciseById = asyncHandler(async (req, res) => {
    const exercise = await findVisibleExercise(req.params.id, req.user.id);
    if (!exercise) {
        throw new AppError('Exercise not found', 404);
    }

    return res.status(200).json({
        success: true,
        message: 'Exercise fetched successfully',
        data: exercise,
    });
});

// "Previous" column in the workout logger: what the user did last time for each exercise.
const getPreviousSets = asyncHandler(async (req, res) => {
    const { ids, excludeSessionId } = req.previousSetsQuery;
    const data = await findPreviousSets(req.user.id, ids, { excludeSessionId });

    return res.status(200).json({
        success: true,
        message: 'Previous sets fetched successfully',
        data,
    });
});

const createExercise = asyncHandler(async (req, res) => {
    let exercise;
    try {
        exercise = await createCustomExercise(req.user.id, req.body);
    } catch (err) {
        throw mapPrismaError(err);
    }

    return res.status(201).json({
        success: true,
        message: 'Custom exercise created successfully',
        data: exercise,
    });
});

const editExercise = asyncHandler(async (req, res) => {
    await getOwnedCustomExercise(req.params.id, req.user.id);

    let exercise;
    try {
        exercise = await updateExercise(req.params.id, req.body);
    } catch (err) {
        throw mapPrismaError(err);
    }

    return res.status(200).json({
        success: true,
        message: 'Exercise updated successfully',
        data: exercise,
    });
});

const removeExercise = asyncHandler(async (req, res) => {
    await getOwnedCustomExercise(req.params.id, req.user.id);

    try {
        await deleteExercise(req.params.id);
    } catch (err) {
        throw mapPrismaError(err);
    }

    return res.status(200).json({
        success: true,
        message: 'Exercise deleted successfully',
    });
});

module.exports = {
    getExercises,
    getExerciseOptions,
    getExerciseById,
    getPreviousSets,
    createExercise,
    editExercise,
    removeExercise,
};
