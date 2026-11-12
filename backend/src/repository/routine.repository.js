const prisma = require('../prisma');

// Pull the exercise name/muscle along with each routine row so clients can render it directly.
const routineExerciseInclude = {
    orderBy: { orderIndex: 'asc' },
    include: {
        exercise: {
            select: { id: true, name: true, primaryMuscle: true, equipment: true },
        },
    },
};

const createRoutine = async (params) => {
    const { userId, name, description, isPublic, exercises } = params;

    return await prisma.$transaction(async (tx) => {
        const routine = await tx.workoutRoutine.create({
            data: {
                userId,
                name,
                description: description || null,
                isPublic: isPublic ?? false,
            },
        });

        if (exercises && exercises.length > 0) {
            const exerciseData = exercises.map((ex, index) => ({
                routineId: routine.id,
                exerciseId: ex.exerciseId,
                orderIndex: ex.orderIndex ?? index,
                targetSets: ex.targetSets ?? 3,
                targetReps: ex.targetReps ?? '8-12',
                restSeconds: ex.restSeconds ?? 90,
                notes: ex.notes || null,
            }));

            await tx.routineExercise.createMany({
                data: exerciseData,
            });
        }

        return await tx.workoutRoutine.findUnique({
            where: { id: routine.id },
            include: {
                routineExercises: routineExerciseInclude,
            },
        });
    });
};

const getRoutinesByUserId = async (userId, includePublic = true) => {
    return await prisma.workoutRoutine.findMany({
        where: includePublic
            ? {
                  OR: [{ userId }, { isPublic: true }],
              }
            : {
                  userId,
              },
        include: {
            routineExercises: routineExerciseInclude,
            _count: {
                select: {
                    routineExercises: true,
                    workoutSessions: true,
                },
            },
        },
        orderBy: {
            updatedAt: 'desc',
        },
    });
};

const getRoutineById = async (id) => {
    return await prisma.workoutRoutine.findUnique({
        where: { id },
        include: {
            routineExercises: routineExerciseInclude,
            _count: {
                select: {
                    routineExercises: true,
                    workoutSessions: true,
                },
            },
        },
    });
};

const updateRoutine = async (id, data) => {
    return await prisma.workoutRoutine.update({
        where: { id },
        data: {
            ...(data.name !== undefined && { name: data.name }),
            ...(data.description !== undefined && { description: data.description }),
            ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
        },
        include: {
            routineExercises: routineExerciseInclude,
        },
    });
};

const deleteRoutine = async (id) => {
    return await prisma.workoutRoutine.delete({
        where: { id },
    });
};

const addExerciseToRoutine = async (params) => {
    const { routineId, exerciseId, targetSets, targetReps, restSeconds, notes } = params;

    let orderIndex = params.orderIndex;

    if (orderIndex === undefined) {
        const lastExercise = await prisma.routineExercise.findFirst({
            where: { routineId },
            orderBy: { orderIndex: 'desc' },
            select: { orderIndex: true },
        });
        orderIndex = lastExercise ? lastExercise.orderIndex + 1 : 0;
    }

    return await prisma.routineExercise.create({
        data: {
            routineId,
            exerciseId,
            orderIndex,
            targetSets: targetSets ?? 3,
            targetReps: targetReps ?? '8-12',
            restSeconds: restSeconds ?? 90,
            notes: notes ?? null,
        },
    });
};

const getRoutineExercise = async (routineId, exerciseId) => {
    return await prisma.routineExercise.findFirst({
        where: {
            routineId,
            exerciseId,
        },
    });
};

const removeExerciseFromRoutine = async (routineId, exerciseId) => {
    return await prisma.routineExercise.deleteMany({
        where: {
            routineId,
            exerciseId,
        },
    });
};

const updateRoutineExercise = async (id, data) => {
    return await prisma.routineExercise.update({
        where: { id },
        data: {
            ...(data.orderIndex !== undefined && { orderIndex: data.orderIndex }),
            ...(data.targetSets !== undefined && { targetSets: data.targetSets }),
            ...(data.targetReps !== undefined && { targetReps: data.targetReps }),
            ...(data.restSeconds !== undefined && { restSeconds: data.restSeconds }),
            ...(data.notes !== undefined && { notes: data.notes }),
        },
    });
};

// Replace the whole ordered exercise list in one transaction (used by the Routine Builder).
// Deleting first avoids clashing with the @@unique([routineId, orderIndex]) constraint on reorder.
const replaceRoutineExercises = async (routineId, exercises) => {
    return await prisma.$transaction(async (tx) => {
        await tx.routineExercise.deleteMany({ where: { routineId } });

        if (exercises.length > 0) {
            await tx.routineExercise.createMany({
                data: exercises.map((ex, index) => ({
                    routineId,
                    exerciseId: ex.exerciseId,
                    orderIndex: index,
                    targetSets: ex.targetSets ?? 3,
                    targetReps: ex.targetReps ?? '8-12',
                    restSeconds: ex.restSeconds ?? 90,
                    notes: ex.notes || null,
                })),
            });
        }

        await tx.workoutRoutine.update({ where: { id: routineId }, data: { updatedAt: new Date() } });

        return await tx.workoutRoutine.findUnique({
            where: { id: routineId },
            include: { routineExercises: routineExerciseInclude },
        });
    });
};

module.exports = {
    replaceRoutineExercises,
    createRoutine,
    getRoutinesByUserId,
    getRoutineById,
    updateRoutine,
    deleteRoutine,
    addExerciseToRoutine,
    getRoutineExercise,
    removeExerciseFromRoutine,
    updateRoutineExercise,
};
