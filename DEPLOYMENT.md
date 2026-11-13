# FitTrack Backend — Cloud Deployment Guide

## Prerequisites

- Node.js 20+
- PostgreSQL 15+ database
- Git repository connected to deployment platform

## Environment Variables

Set these on your deployment platform:

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/fittrack` |
| `JWT_SECRET` | Secret key for JWT signing | `your-secure-secret-key-min-32-chars` |
| `PORT` | Server port (auto-set by most platforms) | `5000` |
| `NODE_ENV` | Environment mode | `production` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | `https://myapp.com,https://expo.dev` |

---

## Option 1: Deploy to Render (Recommended)

### Using the Blueprint (One-Click)

1. Fork or connect this repo to your Render account
2. Go to **Render Dashboard** → **New** → **Blueprint**
3. Select this repository — Render reads `render.yaml` automatically
4. Set environment variables (`JWT_SECRET`, `ALLOWED_ORIGINS`)
5. Click **Apply** — Render creates the web service + PostgreSQL database

### Manual Setup

1. **Create PostgreSQL Database**
   - Render Dashboard → New → PostgreSQL
   - Choose Free tier, copy the **Internal Database URL**

2. **Create Web Service**
   - Render Dashboard → New → Web Service
   - Connect GitHub repo, set:
     - **Root Directory**: `backend`
     - **Build Command**: `npm ci`
     - **Start Command**: `npm start`
   - Add environment variables (see table above)
   - Set **Health Check Path**: `/api/health`

3. **Run Initial Setup**
   - Open Render Shell or SSH:
   ```bash
   cd /opt/render/project/src/backend
   bash scripts/deploy.sh
   ```

---

## Option 2: Deploy to Railway

1. Go to [railway.app](https://railway.app) → New Project
2. **Add PostgreSQL** plugin from the marketplace
3. **Deploy from GitHub** — select this repository
4. Set **Root Directory** to `backend`
5. Add environment variables:
   - `DATABASE_URL` — copy from Railway's PostgreSQL plugin
   - `JWT_SECRET` — your secret key
   - `ALLOWED_ORIGINS` — your frontend URL
6. Railway auto-detects `npm start` and deploys
7. Run deploy script via Railway CLI:
   ```bash
   railway run bash scripts/deploy.sh
   ```

---

## Option 3: Deploy to Supabase + Any Host

### Database (Supabase)

1. Create project at [supabase.com](https://supabase.com)
2. Go to **Settings** → **Database** → Copy **Connection String (URI)**
3. Use this as your `DATABASE_URL`

### Server (Fly.io / DigitalOcean / AWS)

Use the provided `Dockerfile` for containerized deployment:

```bash
# Build
docker build -t fittrack-backend ./backend

# Run
docker run -p 5000:5000 \
  -e DATABASE_URL="your-supabase-url" \
  -e JWT_SECRET="your-secret" \
  -e NODE_ENV="production" \
  fittrack-backend
```

---

## Post-Deployment Verification

Run the health check script:

```bash
bash scripts/healthcheck.sh https://your-app-url.onrender.com
```

Or manually test:

```bash
# Health check
curl https://your-app-url.onrender.com/api/health

# Test demo login
curl -X POST https://your-app-url.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@fittrack.com","password":"Password123!"}'
```

---

## Demo Account

After running `bash scripts/deploy.sh`, a demo account is available:

- **Email**: `demo@fittrack.com`
- **Password**: `Password123!`
- **Data**: 30 days of workout history, 29 PRs, 18 sessions
