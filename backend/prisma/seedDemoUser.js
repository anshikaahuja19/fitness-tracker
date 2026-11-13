/* global require, process */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/prisma');
const { detectAndSavePRs } = require('../src/services/prDetection.service');

/**
 * Generates 30 days of realistic, progressive workout history for a demo user.
 * Populates:
 * - Demo User & Profile (email: demo@fittrack.com / password: Password123!)
 * - 3 Structured Routines (Push, Pull, Legs & Core)
 * - 18 Completed Workout Sessions across the past 30 days
 * - Over 200+ individual SetLogs with progressive weights and reps
 * - Real Personal Records (PRs) detected and attributed with milestones
 */
async function seedDemoUser() {
  console.log('🚀 Starting Demo User & 30-Day Workout History Seed...');

  const demoEmail = 'demo@fittrack.com';
  const plainPassword = 'Password123!';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(plainPassword, salt);

  // 1. Create or update Demo User
  let user = await prisma.user.findUnique({
    where: { email: demoEmail },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: 'Alex Hunter',
        email: demoEmail,
        passwordHash,
        role: 'USER',
      },
    });
    console.log(`✅ Created demo user: ${user.name} (${user.email})`);
  } else {
    // Clean up previous demo data for clean re-seeding
    console.log('🔄 Cleaning previous demo user data for fresh 30-day history...');
    await prisma.personalRecord.deleteMany({ where: { userId: user.id } });
    await prisma.workoutSession.deleteMany({ where: { userId: user.id } });
    await prisma.workoutRoutine.deleteMany({ where: { userId: user.id } });
    console.log(`✅ Cleaned previous data for ${user.email}`);
  }

  // 2. Upsert User Profile
  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {
      gender: 'MALE',
      heightCm: 180.0,
      weightKg: 82.5,
      targetWeightKg: 85.0,
      goal: 'BUILD_MUSCLE',
      activityLevel: 'VERY_ACTIVE',
    },
    create: {
      userId: user.id,
      gender: 'MALE',
      heightCm: 180.0,
      weightKg: 82.5,
      targetWeightKg: 85.0,
      goal: 'BUILD_MUSCLE',
      activityLevel: 'VERY_ACTIVE',
    },
  });
  console.log('✅ Demo profile configured (82.5kg, 180cm, Goal: BUILD_MUSCLE)');

  // 3. Find catalog exercises
  const exerciseNames = [
    'Barbell Bench Press',
    'Incline Dumbbell Press',
    'Triceps Rope Pushdown',
    'Overhead Barbell Press',
    'Barbell Deadlift',
    'Pull-Up',
    'Barbell Curl',
    'Barbell Squat',
    'Romanian Deadlift',
    'Standing Calf Raise',
    'Hanging Leg Raise',
    'Lat Pulldown',
  ];

  const catalogExercises = await prisma.exercise.findMany({
    where: {
      name: { in: exerciseNames },
      createdById: null,
    },
  });

  const exMap = new Map();
  catalogExercises.forEach((ex) => exMap.set(ex.name, ex));

  // Fallback in case any exercise name slightly differs
  const getExercise = (name) => {
    if (exMap.has(name)) return exMap.get(name);
    // Find partial match
    for (const [key, val] of exMap.entries()) {
      if (key.toLowerCase().includes(name.toLowerCase())) return val;
    }
    return catalogExercises[0];
  };

  const benchPress = getExercise('Barbell Bench Press');
  const inclinePress = getExercise('Incline Dumbbell Press');
  const tricepsPushdown = getExercise('Triceps Rope Pushdown');
  const overheadPress = getExercise('Overhead Barbell Press');
  const deadlift = getExercise('Barbell Deadlift');
  const pullUp = getExercise('Pull-Up');
  const barbellCurl = getExercise('Barbell Curl');
  const squat = getExercise('Barbell Squat');
  const rdl = getExercise('Romanian Deadlift');
  const calfRaise = getExercise('Standing Calf Raise');
  const legRaise = getExercise('Hanging Leg Raise');
  const latPulldown = getExercise('Lat Pulldown');

  // 4. Create 3 Structured Workout Routines
  const pushRoutine = await prisma.workoutRoutine.create({
    data: {
      userId: user.id,
      name: 'Push Day (Chest, Shoulders & Triceps)',
      description: 'High intensity push workout focusing on chest hypertrophy and shoulder stability.',
      isPublic: true,
      routineExercises: {
        create: [
          { exerciseId: benchPress.id, orderIndex: 0, targetSets: 4, targetReps: '8-10', restSeconds: 120 },
          { exerciseId: inclinePress.id, orderIndex: 1, targetSets: 3, targetReps: '10-12', restSeconds: 90 },
          { exerciseId: overheadPress.id, orderIndex: 2, targetSets: 3, targetReps: '8-10', restSeconds: 90 },
          { exerciseId: tricepsPushdown.id, orderIndex: 3, targetSets: 3, targetReps: '12-15', restSeconds: 60 },
        ],
      },
    },
  });

  const pullRoutine = await prisma.workoutRoutine.create({
    data: {
      userId: user.id,
      name: 'Pull Day (Back, Traps & Biceps)',
      description: 'Back thickness and bicep volume workout.',
      isPublic: true,
      routineExercises: {
        create: [
          { exerciseId: deadlift.id, orderIndex: 0, targetSets: 4, targetReps: '5-6', restSeconds: 180 },
          { exerciseId: pullUp.id, orderIndex: 1, targetSets: 3, targetReps: '8-10', restSeconds: 90 },
          { exerciseId: latPulldown.id, orderIndex: 2, targetSets: 3, targetReps: '10-12', restSeconds: 90 },
          { exerciseId: barbellCurl.id, orderIndex: 3, targetSets: 3, targetReps: '10-12', restSeconds: 60 },
        ],
      },
    },
  });

  const legRoutine = await prisma.workoutRoutine.create({
    data: {
      userId: user.id,
      name: 'Legs & Core Power',
      description: 'Quad strength, hamstring posterior chain and abdominal development.',
      isPublic: true,
      routineExercises: {
        create: [
          { exerciseId: squat.id, orderIndex: 0, targetSets: 4, targetReps: '6-8', restSeconds: 150 },
          { exerciseId: rdl.id, orderIndex: 1, targetSets: 3, targetReps: '8-10', restSeconds: 90 },
          { exerciseId: calfRaise.id, orderIndex: 2, targetSets: 4, targetReps: '15-20', restSeconds: 60 },
          { exerciseId: legRaise.id, orderIndex: 3, targetSets: 3, targetReps: '12-15', restSeconds: 60 },
        ],
      },
    },
  });

  console.log('✅ Created 3 user routines with ordered exercises');

  // 5. Generate 30 days of realistic workout history with progressive overload
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  // Plan 18 workout days over the last 30 days
  // Days ago from today:
  const workoutSchedule = [
    { daysAgo: 29, type: 'PUSH', routine: pushRoutine },
    { daysAgo: 28, type: 'PULL', routine: pullRoutine },
    { daysAgo: 26, type: 'LEGS', routine: legRoutine },
    { daysAgo: 24, type: 'PUSH', routine: pushRoutine },
    { daysAgo: 23, type: 'PULL', routine: pullRoutine },
    { daysAgo: 21, type: 'LEGS', routine: legRoutine },
    { daysAgo: 19, type: 'PUSH', routine: pushRoutine },
    { daysAgo: 18, type: 'PULL', routine: pullRoutine },
    { daysAgo: 16, type: 'LEGS', routine: legRoutine },
    { daysAgo: 14, type: 'PUSH', routine: pushRoutine },
    { daysAgo: 12, type: 'PULL', routine: pullRoutine },
    { daysAgo: 10, type: 'LEGS', routine: legRoutine },
    { daysAgo: 8, type: 'PUSH', routine: pushRoutine },
    { daysAgo: 7, type: 'PULL', routine: pullRoutine },
    { daysAgo: 5, type: 'LEGS', routine: legRoutine },
    { daysAgo: 3, type: 'PUSH', routine: pushRoutine },
    { daysAgo: 2, type: 'PULL', routine: pullRoutine },
    { daysAgo: 0, type: 'LEGS', routine: legRoutine }, // Today! (keeps streak active)
  ];

  let totalSessionsCreated = 0;
  let totalSetsCreated = 0;
  let totalPRsCreated = 0;

  // Progressive base weights (will increase each week)
  const progressionRates = {
    bench: 72.5,
    incline: 24.0,
    overhead: 45.0,
    triceps: 27.5,
    deadlift: 115.0,
    pullupReps: 8,
    latPull: 55.0,
    curl: 30.0,
    squat: 95.0,
    rdl: 75.0,
    calf: 60.0,
    legRaiseReps: 12,
  };

  for (let i = 0; i < workoutSchedule.length; i++) {
    const item = workoutSchedule[i];
    const sessionDate = new Date(now.getTime() - item.daysAgo * dayMs);
    sessionDate.setHours(17, 30, 0, 0);

    const endTime = new Date(sessionDate.getTime() + 65 * 60 * 1000); // 65 min workout

    // Weekly progression multiplier (week 1 to week 4)
    const weekIndex = Math.floor((30 - item.daysAgo) / 7);
    const overloadFactor = 1 + weekIndex * 0.035; // +3.5% strength progression each week

    const session = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        routineId: item.routine.id,
        name: `${item.routine.name} (Session ${i + 1})`,
        startTime: sessionDate,
        endTime,
        status: 'COMPLETED',
        totalVolumeKg: 0,
        notes: `Felt strong! Week ${weekIndex + 1} progressive overload hit.`,
      },
    });

    const sessionSets = [];

    if (item.type === 'PUSH') {
      const benchWeight = Math.round((progressionRates.bench * overloadFactor) / 2.5) * 2.5;
      const incWeight = Math.round((progressionRates.incline * overloadFactor) / 2) * 2;
      const ohpWeight = Math.round((progressionRates.overhead * overloadFactor) / 2.5) * 2.5;
      const triWeight = Math.round((progressionRates.triceps * overloadFactor) / 2.5) * 2.5;

      // Bench Press sets
      sessionSets.push(
        { exerciseId: benchPress.id, setNumber: 1, weight: benchWeight - 5, reps: 10, rpe: 7.5 },
        { exerciseId: benchPress.id, setNumber: 2, weight: benchWeight, reps: 8, rpe: 8.5 },
        { exerciseId: benchPress.id, setNumber: 3, weight: benchWeight, reps: 8, rpe: 9.0 },
        { exerciseId: benchPress.id, setNumber: 4, weight: benchWeight + 2.5, reps: 6, rpe: 9.5 }
      );

      // Incline Dumbbell Press sets
      sessionSets.push(
        { exerciseId: inclinePress.id, setNumber: 1, weight: incWeight, reps: 10, rpe: 8.0 },
        { exerciseId: inclinePress.id, setNumber: 2, weight: incWeight, reps: 10, rpe: 8.5 },
        { exerciseId: inclinePress.id, setNumber: 3, weight: incWeight + 2, reps: 8, rpe: 9.0 }
      );

      // Overhead Press sets
      sessionSets.push(
        { exerciseId: overheadPress.id, setNumber: 1, weight: ohpWeight, reps: 8, rpe: 8.0 },
        { exerciseId: overheadPress.id, setNumber: 2, weight: ohpWeight, reps: 8, rpe: 8.5 },
        { exerciseId: overheadPress.id, setNumber: 3, weight: ohpWeight + 2.5, reps: 6, rpe: 9.5 }
      );

      // Triceps Pushdown sets
      sessionSets.push(
        { exerciseId: tricepsPushdown.id, setNumber: 1, weight: triWeight, reps: 12, rpe: 7.5 },
        { exerciseId: tricepsPushdown.id, setNumber: 2, weight: triWeight, reps: 12, rpe: 8.0 },
        { exerciseId: tricepsPushdown.id, setNumber: 3, weight: triWeight + 2.5, reps: 10, rpe: 9.0 }
      );
    } else if (item.type === 'PULL') {
      const dlWeight = Math.round((progressionRates.deadlift * overloadFactor) / 5) * 5;
      const latWeight = Math.round((progressionRates.latPull * overloadFactor) / 2.5) * 2.5;
      const curlWeight = Math.round((progressionRates.curl * overloadFactor) / 2.5) * 2.5;
      const puReps = progressionRates.pullupReps + weekIndex;

      // Deadlift sets
      sessionSets.push(
        { exerciseId: deadlift.id, setNumber: 1, weight: dlWeight - 10, reps: 6, rpe: 7.0 },
        { exerciseId: deadlift.id, setNumber: 2, weight: dlWeight, reps: 5, rpe: 8.0 },
        { exerciseId: deadlift.id, setNumber: 3, weight: dlWeight, reps: 5, rpe: 8.5 },
        { exerciseId: deadlift.id, setNumber: 4, weight: dlWeight + 5, reps: 4, rpe: 9.5 }
      );

      // Pull-Up sets (bodyweight)
      sessionSets.push(
        { exerciseId: pullUp.id, setNumber: 1, weight: 82.5, reps: puReps, rpe: 7.5 },
        { exerciseId: pullUp.id, setNumber: 2, weight: 82.5, reps: puReps, rpe: 8.5 },
        { exerciseId: pullUp.id, setNumber: 3, weight: 82.5, reps: Math.max(puReps - 1, 6), rpe: 9.0 }
      );

      // Lat Pulldown sets
      sessionSets.push(
        { exerciseId: latPulldown.id, setNumber: 1, weight: latWeight, reps: 10, rpe: 7.5 },
        { exerciseId: latPulldown.id, setNumber: 2, weight: latWeight, reps: 10, rpe: 8.0 },
        { exerciseId: latPulldown.id, setNumber: 3, weight: latWeight + 2.5, reps: 8, rpe: 9.0 }
      );

      // Barbell Curl sets
      sessionSets.push(
        { exerciseId: barbellCurl.id, setNumber: 1, weight: curlWeight, reps: 12, rpe: 8.0 },
        { exerciseId: barbellCurl.id, setNumber: 2, weight: curlWeight, reps: 10, rpe: 8.5 },
        { exerciseId: barbellCurl.id, setNumber: 3, weight: curlWeight + 2.5, reps: 8, rpe: 9.5 }
      );
    } else if (item.type === 'LEGS') {
      const sqWeight = Math.round((progressionRates.squat * overloadFactor) / 5) * 5;
      const rdlWeight = Math.round((progressionRates.rdl * overloadFactor) / 2.5) * 2.5;
      const calfWeight = Math.round((progressionRates.calf * overloadFactor) / 5) * 5;
      const lrReps = progressionRates.legRaiseReps + weekIndex;

      // Squat sets
      sessionSets.push(
        { exerciseId: squat.id, setNumber: 1, weight: sqWeight - 10, reps: 8, rpe: 7.0 },
        { exerciseId: squat.id, setNumber: 2, weight: sqWeight, reps: 6, rpe: 8.0 },
        { exerciseId: squat.id, setNumber: 3, weight: sqWeight, reps: 6, rpe: 8.5 },
        { exerciseId: squat.id, setNumber: 4, weight: sqWeight + 5, reps: 5, rpe: 9.5 }
      );

      // RDL sets
      sessionSets.push(
        { exerciseId: rdl.id, setNumber: 1, weight: rdlWeight, reps: 10, rpe: 7.5 },
        { exerciseId: rdl.id, setNumber: 2, weight: rdlWeight, reps: 10, rpe: 8.0 },
        { exerciseId: rdl.id, setNumber: 3, weight: rdlWeight + 5, reps: 8, rpe: 9.0 }
      );

      // Standing Calf Raise sets
      sessionSets.push(
        { exerciseId: calfRaise.id, setNumber: 1, weight: calfWeight, reps: 15, rpe: 8.0 },
        { exerciseId: calfRaise.id, setNumber: 2, weight: calfWeight, reps: 15, rpe: 8.5 },
        { exerciseId: calfRaise.id, setNumber: 3, weight: calfWeight + 5, reps: 12, rpe: 9.0 }
      );

      // Hanging Leg Raise sets
      sessionSets.push(
        { exerciseId: legRaise.id, setNumber: 1, weight: 0, reps: lrReps, rpe: 7.5 },
        { exerciseId: legRaise.id, setNumber: 2, weight: 0, reps: lrReps, rpe: 8.0 },
        { exerciseId: legRaise.id, setNumber: 3, weight: 0, reps: lrReps, rpe: 9.0 }
      );
    }

    let sessionTotalVolume = 0;

    // Create SetLogs and detect PRs for this session
    for (const set of sessionSets) {
      const createdSet = await prisma.setLog.create({
        data: {
          workoutSessionId: session.id,
          exerciseId: set.exerciseId,
          setNumber: set.setNumber,
          weight: set.weight,
          reps: set.reps,
          rpe: set.rpe,
          isCompleted: true,
          createdAt: new Date(sessionDate.getTime() + set.setNumber * 3 * 60 * 1000),
        },
      });

      sessionTotalVolume += set.weight * set.reps;
      totalSetsCreated++;

      // Trigger PR detection with historical timestamp
      const prs = await detectAndSavePRs({
        userId: user.id,
        exerciseId: set.exerciseId,
        setLogId: createdSet.id,
        weight: set.weight,
        reps: set.reps,
      });

      // Update achievedAt to the session date so history timeline matches perfectly
      for (const pr of prs) {
        await prisma.personalRecord.update({
          where: { id: pr.id },
          data: { achievedAt: sessionDate },
        });
        totalPRsCreated++;
      }
    }

    // Update workout session total volume
    await prisma.workoutSession.update({
      where: { id: session.id },
      data: { totalVolumeKg: Math.round(sessionTotalVolume * 100) / 100 },
    });

    totalSessionsCreated++;
  }

  // Count final PRs
  const finalPRCount = await prisma.personalRecord.count({ where: { userId: user.id } });

  console.log('\n======================================================');
  console.log('🎉 30-DAY DEMO USER SEED COMPLETED SUCCESSFULLY!');
  console.log('======================================================');
  console.log(`👤 User:               Alex Hunter`);
  console.log(`📧 Email:              ${demoEmail}`);
  console.log(`🔑 Password:           ${plainPassword}`);
  console.log(`📋 Routines:           3 structured routines`);
  console.log(`🏋️ Completed Workouts:  ${totalSessionsCreated} sessions across 30 days`);
  console.log(`📊 Total Sets Logged:  ${totalSetsCreated} sets`);
  console.log(`📈 Historic PR Events: ${totalPRsCreated} improvements`);
  console.log(`🏆 Active PRs:         ${finalPRCount} personal records`);
  console.log('======================================================\n');
}

seedDemoUser()
  .catch((err) => {
    console.error('❌ Error during demo user seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
