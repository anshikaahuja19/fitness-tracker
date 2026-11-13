const { ExerciseCategory, MuscleGroup, Equipment, Difficulty } = require('@prisma/client');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/error');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isOneOf = (enumObj, value) => Object.values(enumObj).includes(value);
const enumError = (field, enumObj) =>
    new AppError(`${field} must be one of: ${Object.values(enumObj).join(', ')}`, 400);

const optionalText = (body, field, maxLength, out) => {
    if (body[field] === undefined) return;
    if (body[field] === null) {
        out[field] = null;
        return;
    }
    if (typeof body[field] !== 'string' || body[field].trim().length > maxLength) {
        throw new AppError(`${field} must be a string of at most ${maxLength} characters`, 400);
    }
    out[field] = body[field].trim() || null;
};

/**
 * Shared body checks for create (all required fields) and update (partial).
 */
const buildExerciseData = (body, { partial }) => {
    const data = {};

    if (body.name !== undefined || !partial) {
        if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
            throw new AppError('Exercise name is required', 400);
        }
        if (body.name.trim().length > 80) {
            throw new AppError('Exercise name must not exceed 80 characters', 400);
        }
        data.name = body.name.trim();
    }

    if (body.category !== undefined || !partial) {
        if (!isOneOf(ExerciseCategory, body.category)) throw enumError('category', ExerciseCategory);
        data.category = body.category;
    }

    if (body.primaryMuscle !== undefined || !partial) {
        if (!isOneOf(MuscleGroup, body.primaryMuscle)) throw enumError('primaryMuscle', MuscleGroup);
        data.primaryMuscle = body.primaryMuscle;
    }

    if (body.secondaryMuscles !== undefined) {
        if (!Array.isArray(body.secondaryMuscles) || !body.secondaryMuscles.every((m) => isOneOf(MuscleGroup, m))) {
            throw new AppError('secondaryMuscles must be an array of muscle groups', 400);
        }
        data.secondaryMuscles = [...new Set(body.secondaryMuscles)];
    }

    if (body.equipment !== undefined) {
        if (!isOneOf(Equipment, body.equipment)) throw enumError('equipment', Equipment);
        data.equipment = body.equipment;
    }

    if (body.difficulty !== undefined) {
        if (!isOneOf(Difficulty, body.difficulty)) throw enumError('difficulty', Difficulty);
        data.difficulty = body.difficulty;
    }

    optionalText(body, 'description', 500, data);
    optionalText(body, 'instructions', 2000, data);

    if (Object.keys(data).length === 0) {
        throw new AppError('No valid exercise fields provided', 400);
    }

    return data;
};

const validateCreateExercise = asyncHandler(async (req, _res, next) => {
    req.body = buildExerciseData(req.body || {}, { partial: false });
    return next();
});

const validateUpdateExercise = asyncHandler(async (req, _res, next) => {
    req.body = buildExerciseData(req.body || {}, { partial: true });
    return next();
});

const validateExerciseId = asyncHandler(async (req, _res, next) => {
    if (!UUID_REGEX.test(req.params.id)) {
        throw new AppError('Invalid exercise id', 400);
    }
    return next();
});

/**
 * GET /exercises query: ?search=&muscle=&category=&equipment=&mine=true&page=&limit=
 * Normalised filters are stored on req.filters.
 */
const validateListQuery = asyncHandler(async (req, _res, next) => {
    const { search, muscle, category, equipment, mine, page, limit } = req.query;
    const filters = { mine: mine === 'true' };

    if (search !== undefined) {
        if (typeof search !== 'string' || search.length > 80) {
            throw new AppError('search must be at most 80 characters', 400);
        }
        if (search.trim()) filters.search = search.trim();
    }
    if (muscle !== undefined) {
        if (!isOneOf(MuscleGroup, muscle)) throw enumError('muscle', MuscleGroup);
        filters.muscle = muscle;
    }
    if (category !== undefined) {
        if (!isOneOf(ExerciseCategory, category)) throw enumError('category', ExerciseCategory);
        filters.category = category;
    }
    if (equipment !== undefined) {
        if (!isOneOf(Equipment, equipment)) throw enumError('equipment', Equipment);
        filters.equipment = equipment;
    }

    const pageNum = page === undefined ? 1 : Number(page);
    const limitNum = limit === undefined ? 50 : Number(limit);
    if (!Number.isInteger(pageNum) || pageNum < 1) {
        throw new AppError('page must be a positive integer', 400);
    }
    if (!Number.isInteger(limitNum) || limitNum < 1 || limitNum > 100) {
        throw new AppError('limit must be an integer between 1 and 100', 400);
    }
    filters.page = pageNum;
    filters.limit = limitNum;

    req.filters = filters;
    return next();
});

// GET /exercises/previous-sets?ids=a,b,c&excludeSessionId=x
const validatePreviousSetsQuery = (req, _res, next) => {
    const raw = typeof req.query.ids === 'string' ? req.query.ids : '';
    const ids = [...new Set(raw.split(',').map((id) => id.trim()).filter(Boolean))];

    if (ids.length === 0) {
        return next(new AppError('ids query parameter is required (comma-separated exercise IDs)', 400));
    }
    if (ids.length > 50) {
        return next(new AppError('A maximum of 50 exercise IDs can be requested at once', 400));
    }
    if (!ids.every((id) => UUID_REGEX.test(id))) {
        return next(new AppError('ids must be valid exercise IDs', 400));
    }

    const { excludeSessionId } = req.query;
    if (excludeSessionId !== undefined && (typeof excludeSessionId !== 'string' || !UUID_REGEX.test(excludeSessionId))) {
        return next(new AppError('excludeSessionId must be a valid session ID', 400));
    }

    req.previousSetsQuery = { ids, excludeSessionId };
    return next();
};

module.exports = {
    validatePreviousSetsQuery,
    validateCreateExercise,
    validateUpdateExercise,
    validateExerciseId,
    validateListQuery,
};
