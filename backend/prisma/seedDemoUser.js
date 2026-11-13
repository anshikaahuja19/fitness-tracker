/* global require, process */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/prisma');

/**
 * Demo User & Routines Seeding Module.
 * Initializes demo account (Alex Hunter) with full fitness profile and 3 structured routines.
 */
async function seedDemoUser() {
  console.log('🚀 Starting Demo User & Fitness Profile Seed...');

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
    console.log(`🔄 User ${demoEmail} already exists, refreshing profile data...`);
    await prisma.workoutRoutine.deleteMany({ where: { userId: user.id } });
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

  const getExercise = (name) => {
    if (exMap.has(name)) return exMap.get(name);
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
  await prisma.workoutRoutine.create({
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

  await prisma.workoutRoutine.create({
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

  await prisma.workoutRoutine.create({
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
}

seedDemoUser()
  .catch((err) => {
    console.error('❌ Error during demo user seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
