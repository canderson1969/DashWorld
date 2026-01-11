# DashWorld Scaling & Deployment Plan

## Current State Assessment

**Production Readiness: 6/10** *(Updated after Phase 1)*
- Suitable for MVP deployment (up to ~1000 concurrent users, ~10,000 videos)
- SQLite database provides reliable single-server performance
- Secrets properly managed via environment variables
- CORS restricted to specific origins
- Ready for staging deployment

---

## Phase 1: Critical Fixes (Before Any Deployment)

### 1.1 Environment Variables for Secrets ✅
- [x] Move JWT secret to environment variable
- [x] Move CORS origin to environment variable
- [x] Create `.env.example` template
- [x] Add `.env` to `.gitignore`

### 1.2 Database Migration: JSON → SQLite ✅
- [x] Install `better-sqlite3` package
- [x] Create database schema with proper indexes
- [x] Migrate data access layer
- [x] Add automatic JSON → SQLite migration on startup

### 1.3 API Pagination ✅
- [x] Add pagination to `GET /api/footage` endpoint
- [ ] Add pagination to `GET /api/conversations` endpoint (optional)
- [ ] Update frontend to handle paginated responses (optional)

### 1.4 CORS Restriction ✅
- [x] Configure allowed origins per environment
- [x] Remove wildcard `*` CORS policy

---

## Phase 2: Stability Improvements (Before Scaling)

### 2.1 Rate Limiting
- [ ] Add `express-rate-limit` middleware
- [ ] Configure limits for auth endpoints (stricter)
- [ ] Configure limits for general API endpoints

### 2.2 File Storage Organization ✅
- [x] Implement date-based sharding: `uploads/YYYY/MM/DD/`
- [x] Update upload and retrieval logic
- [x] Backward compatibility for existing files

### 2.3 Encoding Progress Persistence ✅
- [x] Move encoding progress from in-memory Map to SQLite
- [x] Handle server restarts gracefully

### 2.4 Job Queue for Video Processing
- [ ] Install Bull + Redis
- [ ] Move FFmpeg transcoding to background workers
- [ ] Add job status tracking

---

## Phase 3: Production Scale (When Needed)

### 3.1 Database Upgrade
- [ ] Migrate SQLite → PostgreSQL
- [ ] Set up connection pooling
- [ ] Add read replicas if needed

### 3.2 Cloud Storage
- [ ] Migrate video storage to S3 or CloudFlare R2
- [ ] Implement signed URLs for secure access
- [ ] Add CDN for video delivery

### 3.3 Monitoring & Observability
- [ ] Add health check endpoints
- [ ] Implement logging aggregation
- [ ] Set up error tracking (Sentry)
- [ ] Add performance metrics

---

## Deployment Workflow

### Branch Strategy
```
main (production)  ←  PR required, deploys to dashworld.com
     ↑
staging            ←  PR from feature branches, auto-deploys to staging.dashworld.com
     ↑
feature/*          ←  Local development
```

### Environment Files
```
.env.development   → localhost:5000, SQLite, local uploads
.env.staging       → staging server config
.env.production    → production server config
```

### CI/CD Pipeline
1. Push to `feature/*` → Run tests only
2. PR to `staging` → Run tests, deploy to staging
3. PR to `main` → Run tests, require approval, deploy to production

---

## Estimated Effort

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1 | Critical fixes | 4-6 hours |
| Phase 2 | Stability | 8-12 hours |
| Phase 3 | Production scale | 20+ hours |

---

## Current Session Progress

- [x] Architecture assessment completed
- [x] Phase 1.1: Environment variables
- [x] Phase 1.2: SQLite migration
- [x] Phase 1.3: Pagination
- [x] Phase 1.4: CORS restriction
- [x] Phase 2.2: File storage organization (date-based sharding)
- [x] Phase 2.3: Encoding progress persistence

**Phase 1 Complete!** The backend is now ready for deployment with:
- Secrets managed via environment variables
- SQLite database with proper schema and indexes
- Automatic JSON → SQLite migration on first run
- Pagination support for footage endpoint
- CORS restricted to specific allowed origins

**Phase 2 Progress:**
- Date-based file organization: `uploads/YYYY/MM/DD/` structure
- Encoding progress persisted to SQLite (survives server restarts)
- Backward compatible with existing files

**Next Step:** Phase 2.1 Rate Limiting or Phase 2.4 Job Queue
