#!/usr/bin/env node
/**
 * FitTrack API Automated Smoke Testing Suite
 * Verifies all core endpoints: Auth, Exercises, Routines, Sessions, PRs, Analytics
 * Usage: node scripts/verify-api.js [BASE_URL]
 */

const BASE_URL = process.argv[2] || process.env.API_URL || 'https://fittrack-backend-ny70.onrender.com';

async function testEndpoint(name, url, options = {}) {
  const start = Date.now();
  try {
    const res = await fetch(url, options);
    const duration = Date.now() - start;
    const ok = res.status >= 200 && res.status < 400;
    const icon = ok ? '✅' : '❌';
    console.log(`${icon} [${res.status}] ${name} (${duration}ms)`);
    return { ok, status: res.status, data: await res.json().catch(() => null) };
  } catch (err) {
    console.log(`❌ [ERR] ${name}: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

async function runSmokeTests() {
  console.log(`\n🏋️‍♂️ Running FitTrack Backend Smoke Tests on: ${BASE_URL}\n${'='.repeat(60)}`);

  // 1. Health Checks
  await testEndpoint('Health Check (Bare)', `${BASE_URL}/health`);
  await testEndpoint('Health Check (/api)', `${BASE_URL}/api/health`);

  // 2. Exercises
  await testEndpoint('Get Exercise Catalog', `${BASE_URL}/api/exercises`);
  await testEndpoint('Exercise Muscle Filter (Chest)', `${BASE_URL}/api/exercises?muscle=Chest`);

  // 3. Auth
  const loginRes = await testEndpoint('Demo User Login', `${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'demo@fittrack.com',
      password: 'Password123!',
    }),
  });

  const token = loginRes.data?.token || loginRes.data?.data?.token;

  if (token) {
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // 4. Protected Endpoints
    await testEndpoint('Get User Profile', `${BASE_URL}/api/users/profile`, { headers: authHeaders });
    await testEndpoint('Get Workout Routines', `${BASE_URL}/api/routines`, { headers: authHeaders });
    await testEndpoint('Get Workout Sessions', `${BASE_URL}/api/sessions`, { headers: authHeaders });
    await testEndpoint('Get Personal Records', `${BASE_URL}/api/prs`, { headers: authHeaders });
    await testEndpoint('Get Analytics Summary', `${BASE_URL}/api/analytics/summary`, { headers: authHeaders });
    await testEndpoint('Get Analytics Charts', `${BASE_URL}/api/analytics/charts`, { headers: authHeaders });
    await testEndpoint('Get Weekly Frequency Chart', `${BASE_URL}/api/analytics/charts/weekly-frequency`, { headers: authHeaders });
  } else {
    console.log('⚠️ Skipping authenticated tests (demo login failed or seeded differently).');
  }

  console.log(`\n${'='.repeat(60)}\n🏁 Smoke tests completed!\n`);
}

runSmokeTests();
