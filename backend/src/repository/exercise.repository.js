const prisma = require('../prisma');

// A user can see the global library (createdById = null) plus their own custom exercises.
const visibleTo = (userId) => ({
    OR: [{ createdById: null }, { createdById: userId }],
});

const buildListWhere = (userId, { search, muscle, category, equipment, mine }) => {
    const and = [mine ? { createdById: userId } : visibleTo(userId)];

    if (search) and.push({ name: { contains: search, mode: 'insensitive' } });
    if (muscle) {
        and.push({ OR: [{ primaryMuscle: muscle }, { secondaryMuscles: { has: muscle } }] });
    }
    if (category) and.push({ category });
    if (equipment) and.push({ equipment });

    return { AND: and };
};

const listExercises = async (userId, filters) => {
    const where = buildListWhere(userId, filters);
    const [items, total] = await prisma.$transaction([
        prisma.exercise.findMany({
            where,
            orderBy: { name: 'asc' },
            skip: (filters.page - 1) * filters.limit,
            take: filters.limit,
        }),
        prisma.exercise.count({ where }),
    ]);
    return { items, total };
};

const findVisibleExercise = (id, userId) =>
    prisma.exercise.findFirst({ where: { id, ...visibleTo(userId) } });

const createCustomExercise = (userId, data) =>
    prisma.exercise.create({
        data: { ...data, isCustom: true, createdById: userId },
    });

const updateExercise = (id, data) => prisma.exercise.update({ where: { id }, data });

const deleteExercise = (id) => prisma.exercise.delete({ where: { id } });

// Latest completed workout (per exercise) in which the user logged sets for each exercise.
// Returns { [exerciseId]: { sessionId, sessionName, performedAt, sets: [{ setNumber, weight, reps }] } }
const findPreviousSets = async (userId, exerciseIds, { excludeSessionId } = {}) => {
    const logs = await prisma.setLog.findMany({
        where: {
            exerciseId: { in: exerciseIds },
            isCompleted: true,
            workoutSession: {
                userId,
                status: 'COMPLETED',
                ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
            },
        },
        orderBy: [{ workoutSession: { startTime: 'desc' } }, { setNumber: 'asc' }],
        select: {
            exerciseId: true,
            setNumber: true,
            weight: true,
            reps: true,
            workoutSession: { select: { id: true, name: true, startTime: true } },
        },
        take: 1000,
    });

    const result = {};
    for (const log of logs) {
        const current = result[log.exerciseId];
        if (!current) {
            result[log.exerciseId] = {
                sessionId: log.workoutSession.id,
                sessionName: log.workoutSession.name,
                performedAt: log.workoutSession.startTime,
                sets: [{ setNumber: log.setNumber, weight: log.weight, reps: log.reps }],
            };
        } else if (current.sessionId === log.workoutSession.id) {
            current.sets.push({ setNumber: log.setNumber, weight: log.weight, reps: log.reps });
        }
    }
    return result;
};

module.exports = {
    findPreviousSets,
    listExercises,
    findVisibleExercise,
    createCustomExercise,
    updateExercise,
    deleteExercise,
};
