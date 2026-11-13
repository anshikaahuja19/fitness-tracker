/* global require, process */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/prisma');

/**
 * Demo User & Profile Seeding Module.
 * Initializes demo account (Alex Hunter) with full fitness profile and bcrypt authentication.
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
}

seedDemoUser()
  .catch((err) => {
    console.error('❌ Error during demo user seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
