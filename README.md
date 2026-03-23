# SkyPulse Weather Forecasting Backend

Node.js + Express backend with authentication, weather integration, and travel planner APIs.

## Prerequisites

- Node.js 18+
- MySQL 8+

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

- Copy `.env.example` to `.env`
- Update DB and API key values

3. Initialize database schema:

```bash
npm run init-db
```

4. Start the server:

```bash
npm start
```

For auto-reload in development:

```bash
npm run dev
```

## Database Initialization

The script `scripts/initDB.js`:

- Creates the DB from `DB_NAME` if it does not exist
- Loads and executes `backend/models/schema.sql`
- Is idempotent because schema uses `CREATE TABLE IF NOT EXISTS`

Run directly:

```bash
node scripts/initDB.js
```

## Environment Variables

See `.env.example` for all required values.

## API Endpoints

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/profile` (protected)
- `PUT /api/auth/profile` (protected)

### Weather

- `GET /api/weather/current?city=...`
- `GET /api/weather/forecast?city=...&days=...`
- `GET /api/weather/current/coords?lat=...&lon=...`
- `GET /api/weather/forecast/coords?lat=...&lon=...&days=...`
- `POST /api/weather/locations` (protected)
- `GET /api/weather/locations` (protected)
- `DELETE /api/weather/locations/:id` (protected)
- `GET /api/weather/locations/all` (protected)

### Travel Planner (all protected)

- `POST /api/travel/trips`
- `GET /api/travel/trips`
- `GET /api/travel/trips/:id`
- `PUT /api/travel/trips/:id`
- `DELETE /api/travel/trips/:id`

- `POST /api/travel/trips/:id/destinations`
- `PUT /api/travel/destinations/:id`
- `DELETE /api/travel/destinations/:id`
- `PUT /api/travel/trips/:id/reorder`

- `POST /api/travel/trips/:id/packing`
- `PUT /api/travel/packing/:id/toggle`
- `DELETE /api/travel/packing/:id`
- `POST /api/travel/trips/:id/packing/suggest`

- `POST /api/travel/alerts/check`
- `GET /api/travel/alerts`
- `PUT /api/travel/alerts/:id/read`

## Full Flow Checklist

- Register
- Login
- Save location
- Create trip
- Add destination
- Get trip details and weather snapshots
- Auto-suggest packing items
- Check weather alerts

## Deploy on Render

This repository includes a Render Blueprint file: `render.yaml`.

### Option A: Deploy with Blueprint (recommended)

1. Push this repo to GitHub.
2. In Render dashboard: New -> Blueprint.
3. Select this repository.
4. Render will detect `render.yaml` and create the `skypulse-app` service.
5. Set the required secret env vars when prompted:

- `DB_HOST`
- `DB_PORT` (usually `3306`)
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`
- `WEATHER_API_KEY`

### Option B: Manual Web Service setup

If you do not use Blueprint, create a Web Service with:

- Environment: Node
- Build Command: `npm ci`
- Start Command: `npm start`

Then add the same environment variables listed above.

### Database schema on Render

After env vars are set and service is up, run schema initialization once:

```bash
npm run init-db
```

You can run this from Render Shell or locally against the production DB credentials.

### Notes

- App serves both frontend and backend from the same Express service.
- Ensure your MySQL instance allows inbound connections from Render.
- If the service fails on startup, verify DB credentials first because startup checks DB connectivity.
