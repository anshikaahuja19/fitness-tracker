#!/bin/bash
# deploy.sh — Production deployment script for FitTrack Backend
# Usage: bash scripts/deploy.sh
# Runs database migrations, seeds exercises, and optionally seeds demo user

set -e

echo "========================================="
echo "  FitTrack Backend — Production Deploy"
echo "========================================="

# Verify required environment variables
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL is not set"
  exit 1
fi

if [ -z "$JWT_SECRET" ]; then
  echo "❌ ERROR: JWT_SECRET is not set"
  exit 1
fi

echo ""
echo "📦 Step 1: Installing dependencies..."
npm ci --omit=dev
echo "✅ Dependencies installed"

echo ""
echo "🔄 Step 2: Generating Prisma Client..."
npx prisma generate
echo "✅ Prisma Client generated"

echo ""
echo "🗄️  Step 3: Pushing database schema..."
npx prisma db push --skip-generate
echo "✅ Database schema synced"

echo ""
echo "🌱 Step 4: Seeding exercises (52 exercises)..."
npm run seed
echo "✅ Exercises seeded"

echo ""
echo "👤 Step 5: Seeding demo user (30-day workout history)..."
npm run seed:demo
echo "✅ Demo user seeded"

echo ""
echo "========================================="
echo "  ✅ Deployment Complete!"
echo "  Demo login: demo@fittrack.com / Password123!"
echo "========================================="
