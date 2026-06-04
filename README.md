# Car Service

NestJS backend for **Autivo** vehicle data: owner garage (VIN, maintenance, listings), catalog for community/onboarding, and legacy brand/model helpers. Traffic from browsers goes through the **gateway** (`/v1/garage`, `/v1/cars`) or the Next.js BFF (`/api/garage`); do not call this service directly from the client in production.

| | |
|---|---|
| **Stack** | NestJS 11, Prisma, PostgreSQL, Cloudinary |
| **Default port** | `3002` |
| **Prod (Render)** | https://car-service-jiwj.onrender.com |
| **Deploy branch** | `master` |
| **Health** | `GET /health` → `{ status, version, buildAt }` |

---

## What this service owns

### Garage (main product surface)

Per-user vehicles, service history, odometer, photos, sale listings, insights/reports stubs.

- **Gateway:** `GET/POST/PATCH/DELETE /v1/garage/*` → `/api/garage/*`
- **Auth:** Gateway validates JWT and sets `x-user-id` on the proxied request. Browsers must not send `x-user-id`; use the client BFF with httpOnly cookies.
- **Public (no JWT):** `GET /v1/garage/public-listings`, `GET /v1/garage/public-listings/:id`

Representative routes (all under `/api/garage` on this service):

```http
GET    /vehicles
POST   /vehicles
GET    /vehicles/:vehicleId
PATCH  /vehicles/:vehicleId
PATCH  /vehicles/:vehicleId/primary
POST   /vehicles/:vehicleId/photos
POST   /vehicles/:vehicleId/maintenance
POST   /vehicles/:vehicleId/odometer
GET    /vehicles/:vehicleId/recommendations
GET    /vehicles/:vehicleId/insights
GET    /vehicles/:vehicleId/sale-listings
GET    /public-listings
```

Swagger (local): http://localhost:3002/api/docs

### Catalog (DB mirror + community seed)

Generations/trims stored in Postgres (synced from CarQuery via script). Used by admin “add car” flows and **user-service** `community:seed`.

```http
GET /api/cars/catalog/makes
GET /api/cars/catalog/generations
GET /api/cars/catalog/generations/:id
GET /api/cars/catalog/export/community-seed
```

**Gateway:** `/v1/cars/catalog/*` → `/api/cars/catalog/*`

### Legacy reference data

Older brand/model/variant endpoints (CarQuery-backed helpers):

```http
GET /api/brands
GET /api/brands/by-year/:year
GET /api/models/...
GET /api/variants/...
```

### Marketplace primitives (schema)

Prisma models for `Ad`, `Category`, attributes — used for future listing flows; not the current garage UX focus.

---

## Repository layout

```
src/
  health/           # GET /health (excluded from global /api prefix)
  modules/
    garage/         # Owner vehicles & listings
    catalog/        # Makes, generations, community export
    brands|models|variants|cars/
    cloudinary/     # Photo uploads
  prisma/           # schema + migrations + seed
scripts/
  sync-carquery-catalog.ts
```

Prisma client is generated to `generated/client` (isolated from other monorepo services).

---

## Local development

From `services/car`:

```bash
# Create .env with at least DATABASE_URL (see table below)
npm install
npm run dev            # prisma generate + nest --watch
```

Migrations:

```bash
export DATABASE_URL="postgresql://..."
npx prisma migrate deploy --schema=src/prisma/schema.prisma
npx prisma generate --schema=src/prisma/schema.prisma
# optional seed
npx prisma db seed
```

Catalog sync (imports/updates mirror tables):

```bash
npm run catalog:sync
```

With the monorepo gateway running locally:

```bash
# Gateway env
CAR_SERVICE_URL=http://localhost:3002
```

```bash
curl -s http://localhost:3002/health
curl -s -H "Authorization: Bearer <access_token>" \
  http://localhost:3002/api/garage/vehicles
# Prefer via gateway:
curl -s -H "Authorization: Bearer <token>" \
  http://localhost:3000/v1/garage/vehicles
```

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `PORT` | no | Listen port (default `3002`) |
| `NODE_ENV` | prod | `production` on Render |
| `BUILD_AT` | no | ISO timestamp in `/health` (set in CI/deploy) |
| `CLOUDINARY_CLOUD_NAME` | for photos | Cloudinary upload |
| `CLOUDINARY_API_KEY` | for photos | |
| `CLOUDINARY_API_SECRET` | for photos | |

Gateway (separate repo) must set `CAR_SERVICE_URL` to this service’s public URL.

---

## Production (Render)

- **Config:** `Render.yaml` — Docker build, `healthCheckPath: /health`
- **Branch:** deploy from **`master`** (auto-deploy on push)
- **Migrations:** run `prisma migrate deploy` against prod DB before or right after deploy (see monorepo `docs/DEPLOY_COMMUNITY_V1_2.md`)

```bash
curl -s https://car-service-jiwj.onrender.com/health
```

Gateway aggregated checks use `GET /health` on the car service (see `services/gateway` `monitoredServices.ts`).

**Note:** Render free tier may return **429** under cold start or burst traffic; garage routes are heavier than public catalog reads. Wake the service or retry after deploy.

---

## Docker

```bash
docker build -t car-service .
docker run --rm -p 3002:3002 \
  -e DATABASE_URL="postgresql://..." \
  -e PORT=3002 \
  car-service
```

Production image uses a multi-stage build; `node_modules` are copied from the builder stage so `prisma generate` is not re-run via a broken prod-only `npm install`.

---

## Scripts

| npm script | Purpose |
|------------|---------|
| `dev` | Prisma generate + watch mode |
| `build` | Prisma generate + `nest build` |
| `start:prod` | `node dist/main.js` |
| `catalog:sync` | Sync CarQuery data into catalog tables |
| `test` / `test:e2e` | Jest |

---

## Monorepo

This folder is a **separate git repository** (ignored at monorepo root). Push changes from `services/car` to [car-service](https://github.com/maksym-nezhurin/car-service) on `master`.

Related docs in the parent monorepo:

- `docs/F0_LAUNCH_RUNBOOK.md` — garage auth, smoke tests
- `docs/DEPLOY_COMMUNITY_V1_2.md` — prod deploy checklist
- `PROJECT_CONTEXT_AND_PLAN.md` — full garage API list

---

## API prefix reference

| Caller sees | Car service path |
|-------------|------------------|
| `GET /health` | `GET /health` |
| `GET /v1/garage/vehicles` (gateway) | `GET /api/garage/vehicles` |
| `GET /v1/cars/catalog/makes` (gateway) | `GET /api/cars/catalog/makes` |
| Direct (dev only) | All business routes under `/api/...` except `/health` |
