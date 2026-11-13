const prisma = require('../prisma');
const AppError = require('../utils/error');

const SESSION_DETAILS_INCLUDE = {
    routine: {
        include: {
            routineExercises: {
                orderBy: { orderIndex: 'asc' },
                include: {
                    exercise: true,
                },
            },
        },
    },
    setLogs: {
        orderBy: [{ createdAt: 'asc' }, { setNumber: 'asc' }],
        include: {
            exercise: true,
        },
    },
};

const SET_LOG_INCLUDE = {
    exercise: true,
};

const findRoutineWithExercisesById = async (routineId) => {
    return await prisma.workoutRoutine.findUnique({
        where: { id: routineId },
        include: {
            routineExercises: {
                orderBy: { orderIndex: 'asc' },
                include: {
                    exercise: true,
                },
            },
        },
    });
};

const createWorkoutSession = async ({ userId, routineId, name, notes }) => {
    return await prisma.workoutSession.create({
        data: {
            userId,
            routineId: routineId || null,
            name,
            status: 'IN_PROGRESS',
            notes: notes || null,
        },
        include: SESSION_DETAILS_INCLUDE,
    });
};

const getSessionsByUserId = async (userId, { status, limit } = {}) => {
    return await prisma.workoutSession.findMany({
        where: {
            userId,
            ...(status && { status }),
        },
        include: {
            routine: {
                select: {
                    id: true,
                    name: true,
                },
            },
            setLogs: {
                orderBy: [{ createdAt: 'asc' }, { setNumber: 'asc' }],
                include: {
                    exercise: {
                        select: {
                            id: true,
                            name: true,
                            primaryMuscle: true,
                            equipment: true,
                        },
                    },
                },
            },
            _count: {
                select: {
                    setLogs: true,
                },
            },
        },
        orderBy: {
            startTime: 'desc',
        },
        ...(limit && { take: limit }),
    });
};

const getSessionById = async (id) => {
    return await prisma.workoutSession.findUnique({
        where: { id },
        include: SESSION_DETAILS_INCLUDE,
    });
};

const updateWorkoutSession = async (id, data) => {
    const shouldAutoSetEndTime =
        (data.status === 'COMPLETED' || data.status === 'CANCELLED') &&
        data.endTime === undefined;

    return await prisma.workoutSession.update({
        where: { id },
        data: {
            ...(data.name !== undefined && { name: data.name }),
            ...(data.status !== undefined && { status: data.status }),
            ...(data.totalVolumeKg !== undefined && { totalVolumeKg: data.totalVolumeKg }),
            ...(data.notes !== undefined && { notes: data.notes }),
            ...(data.endTime !== undefined
                ? { endTime: data.endTime ? new Date(data.endTime) : null }
                : shouldAutoSetEndTime
                    ? { endTime: new Date() }
                    : {}),
        },
        include: SESSION_DETAILS_INCLUDE,
    });
};

const findExistingExerciseIds = async (exerciseIds) => {
    const uniqueIds = [...new Set(exerciseIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
        return [];
    }

    const exercises = await prisma.exercise.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true },
    });

    return exercises.map((item) => item.id);
};

const getSetLogsBySessionId = async (workoutSessionId) => {
    return await prisma.setLog.findMany({
        where: { workoutSessionId },
        orderBy: [{ createdAt: 'asc' }, { setNumber: 'asc' }],
        include: SET_LOG_INCLUDE,
    });
};

const recalculateSessionVolume = async (tx, workoutSessionId) => {
    const completedSets = await tx.setLog.findMany({
        where: {
            workoutSessionId,
            isCompleted: true,
        },
        select: {
            weight: true,
            reps: true,
        },
    });

    const rawTotal = completedSets.reduce((sum, item) => sum + item.weight * item.reps, 0);
    const totalVolumeKg = Math.round(rawTotal * 100) / 100;

    await tx.workoutSession.update({
        where: { id: workoutSessionId },
        data: { totalVolumeKg },
    });

    return totalVolumeKg;
};

const batchSaveSetLogs = async (workoutSessionId, sets, { replace = false } = {}) => {
    return await prisma.$transaction(async (tx) => {
        const incomingIds = sets.map((item) => item.id).filter(Boolean);

        if (replace) {
            await tx.setLog.deleteMany({
                where: {
                    workoutSessionId,
                    ...(incomingIds.length > 0 ? { id: { notIn: incomingIds } } : {}),
                },
            });
        }

        // Optimized: Batch fetch existing set IDs in a single query to eliminate N+1 queries
        const existingSetIdSet = new Set();
        if (incomingIds.length > 0) {
            const existingSets = await tx.setLog.findMany({
                where: {
                    id: { in: incomingIds },
                    workoutSessionId,
                },
                select: { id: true },
            });
            existingSets.forEach((item) => existingSetIdSet.add(item.id));
        }

        for (const item of sets) {
            if (item.id) {
                if (!existingSetIdSet.has(item.id)) {
                    throw new AppError(`SetLog ${item.id} not found in this workout session`, 404);
                }

                await tx.setLog.update({
                    where: { id: item.id },
                    data: {
                        ...(item.exerciseId !== undefined && { exerciseId: item.exerciseId }),
                        ...(item.setNumber !== undefined && { setNumber: item.setNumber }),
                        ...(item.weight !== undefined && { weight: item.weight }),
                        ...(item.reps !== undefined && { reps: item.reps }),
                        ...(item.rpe !== undefined && { rpe: item.rpe }),
                        ...(item.isCompleted !== undefined && { isCompleted: item.isCompleted }),
                    },
                });
            } else {
                await tx.setLog.create({
                    data: {
                        workoutSessionId,
                        exerciseId: item.exerciseId,
                        setNumber: item.setNumber,
                        weight: item.weight ?? 0,
                        reps: item.reps ?? 0,
                        rpe: item.rpe ?? null,
                        isCompleted: item.isCompleted ?? true,
                    },
                });
            }
        }

        const totalVolumeKg = await recalculateSessionVolume(tx, workoutSessionId);
        const setLogs = await tx.setLog.findMany({
            where: { workoutSessionId },
            orderBy: [{ createdAt: 'asc' }, { setNumber: 'asc' }],
            include: SET_LOG_INCLUDE,
        });

        return {
            sessionId: workoutSessionId,
            totalVolumeKg,
            setLogs,
        };
    });
};

const findSetLogInSession = async (workoutSessionId, setId) => {
    return await prisma.setLog.findFirst({
        where: {
            id: setId,
            workoutSessionId,
        },
        include: SET_LOG_INCLUDE,
    });
};

const updateSingleSetLog = async (workoutSessionId, setId, data) => {
    return await prisma.$transaction(async (tx) => {
        const updatedSet = await tx.setLog.update({
            where: { id: setId },
            data: {
                ...(data.setNumber !== undefined && { setNumber: data.setNumber }),
                ...(data.weight !== undefined && { weight: data.weight }),
                ...(data.reps !== undefined && { reps: data.reps }),
                ...(data.rpe !== undefined && { rpe: data.rpe }),
                ...(data.isCompleted !== undefined && { isCompleted: data.isCompleted }),
            },
            include: SET_LOG_INCLUDE,
        });

        const totalVolumeKg = await recalculateSessionVolume(tx, workoutSessionId);

        return {
            sessionId: workoutSessionId,
            totalVolumeKg,
            setLog: updatedSet,
        };
    });
};

const deleteSingleSetLog = async (workoutSessionId, setId) => {
    return await prisma.$transaction(async (tx) => {
        await tx.setLog.delete({
            where: { id: setId },
        });

        const totalVolumeKg = await recalculateSessionVolume(tx, workoutSessionId);

        return {
            sessionId: workoutSessionId,
            deletedSetId: setId,
            totalVolumeKg,
        };
    });
};

module.exports = {
    findRoutineWithExercisesById,
    createWorkoutSession,
    getSessionsByUserId,
    getSessionById,
    updateWorkoutSession,
    findExistingExerciseIds,
    getSetLogsBySessionId,
    batchSaveSetLogs,
    findSetLogInSession,
    updateSingleSetLog,
    deleteSingleSetLog,
};

