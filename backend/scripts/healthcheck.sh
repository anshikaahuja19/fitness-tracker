#!/bin/bash
# healthcheck.sh — Verify production API is responding
# Usage: bash scripts/healthcheck.sh [BASE_URL]
# Default URL: http://localhost:5000

set -e

BASE_URL="${1:-http://localhost:5000}"

echo "🏥 Checking FitTrack API health at $BASE_URL..."

# Health endpoint
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ API is healthy (HTTP $HTTP_CODE)"
  curl -s "$BASE_URL/api/health" | head -1
  echo ""
else
  echo "❌ API is not responding (HTTP $HTTP_CODE)"
  exit 1
fi

# Auth endpoint (should return 401 without token)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/users/profile" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  echo "✅ Auth middleware is working (HTTP $HTTP_CODE)"
else
  echo "⚠️  Auth middleware returned unexpected code (HTTP $HTTP_CODE)"
fi

echo ""
echo "🎉 Health check passed!"
