# Vector Marketing Platform - Operator Runbook

## Table of Contents
1. [System Overview](#system-overview)
2. [Prerequisites](#prerequisites)
3. [Initial Setup](#initial-setup)
4. [Running the System](#running-the-system)
5. [Data Sync Operations](#data-sync-operations)
6. [Monitoring & Health Checks](#monitoring--health-checks)
7. [Troubleshooting](#troubleshooting)
8. [GTM/GA4 Configuration](#gtmga4-configuration)

---

## System Overview

The Vector Marketing Platform consists of:
- **API Server**: Hono-based REST API (port 3001)
- **Sync Worker**: BullMQ worker for background data sync jobs
- **Database**: Neon PostgreSQL (cloud-hosted)
- **Cache/Queue**: Redis for BullMQ job queue

### Data Flow
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│  API Server │────▶│  PostgreSQL │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐     ┌─────────────┐
                    │    Redis    │◀────│ Sync Worker │
                    └─────────────┘     └─────────────┘
                                              │
                    ┌─────────────────────────┼────────────────┐
                    ▼                         ▼                ▼
             ┌────────────┐           ┌────────────┐    ┌────────────┐
             │ Google Ads │           │    GSC     │    │ DataForSEO │
             └────────────┘           └────────────┘    └────────────┘
```

---

## Prerequisites

### Required Services
- Node.js 20+ 
- Redis 7+
- PostgreSQL (Neon recommended)

### API Credentials Required
| Service | Required | Purpose |
|---------|----------|---------|
| Google OAuth | Yes | GA4, Search Console auth |
| Google Ads API | Optional | Ads data sync |
| DataForSEO | Optional | Keyword/SERP data |
| PageSpeed API | Optional | Core Web Vitals |
| GTM Container | Optional | Frontend tracking |
| Gemini API | Optional | AI insights |

---

## Initial Setup

### 1. Clone and Install
```bash
cd backend
npm install
```

### 2. Configure Environment
```bash
cp env.example .env
# Edit .env with your credentials
```

### 3. Database Migration
```bash
npm run db:migrate
```

### 4. Verify Database Schema
```bash
npm run db:check
```

---

## Running the System

### Development Mode
```bash
# Terminal 1: API Server
npm run dev

# Terminal 2: Sync Worker
npm run worker:dev
```

### Production Mode (PM2)
```bash
# Build TypeScript
npm run build

# Start all processes
pm2 start deploy/ecosystem.config.cjs

# View logs
pm2 logs

# Restart all
pm2 restart all

# Stop all
pm2 stop all
```

### PM2 Process Status
```bash
pm2 status
# Should show:
# ┌─────────────────────────┬────┬─────────┬─────────┐
# │ name                    │ id │ mode    │ status  │
# ├─────────────────────────┼────┼─────────┼─────────┤
# │ vector-marketing-api    │ 0  │ cluster │ online  │
# │ vector-marketing-worker │ 1  │ fork    │ online  │
# └─────────────────────────┴────┴─────────┴─────────┘
```

---

## Data Sync Operations

### Trigger Manual Sync
```bash
# Via API
curl -X POST http://localhost:3001/api/v1/sync/{integration_id} \
  -H "Content-Type: application/json" \
  -d '{"fullBackfill": false}'

# Full backfill (90 days)
curl -X POST http://localhost:3001/api/v1/sync/{integration_id} \
  -H "Content-Type: application/json" \
  -d '{"fullBackfill": true}'
```

### Check Sync Status
```bash
curl http://localhost:3001/api/v1/sync/status/{job_id}
```

### Sync Schedule (Cron Jobs)
Add to crontab for automated syncs:
```cron
# Hourly delta sync (all connected integrations)
0 * * * * curl -X POST http://localhost:3001/api/v1/sync/all

# Daily full sync at 2 AM
0 2 * * * curl -X POST http://localhost:3001/api/v1/sync/all?fullBackfill=true
```

### View Pending/Failed Jobs
```bash
# Connect to Redis CLI
redis-cli

# List pending jobs
LRANGE bull:dataSyncQueue:waiting 0 -1

# List failed jobs
LRANGE bull:dataSyncQueue:failed 0 -1

# Clear failed jobs
DEL bull:dataSyncQueue:failed
```

---

## Monitoring & Health Checks

### API Health Check
```bash
curl http://localhost:3001/api/health
# Response:
# {
#   "status": "ok",
#   "services": { "redis": "connected", "database": "connected" }
# }
```

### Key Metrics to Monitor
- API response times (p99 < 200ms)
- Sync job success rate (> 99%)
- Redis memory usage
- PostgreSQL connection pool
- Worker job queue length

### Log Locations
```
# PM2 logs
~/.pm2/logs/vector-marketing-api-out.log
~/.pm2/logs/vector-marketing-api-error.log
~/.pm2/logs/vector-marketing-worker-out.log
~/.pm2/logs/vector-marketing-worker-error.log
```

---

## Troubleshooting

### API Not Starting
1. Check environment variables: `node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL)"`
2. Verify database connection: `npm run db:check`
3. Check port availability: `lsof -i :3001`

### Worker Not Processing Jobs
1. Check Redis connection: `redis-cli ping`
2. View worker logs: `pm2 logs vector-marketing-worker`
3. Restart worker: `pm2 restart vector-marketing-worker`

### Sync Failures
1. Check integration status in database
2. Verify OAuth tokens are valid (not expired)
3. Check rate limits on external APIs
4. Review sync job error in `sync_jobs` table

### OAuth Token Refresh Failures
```sql
-- Check token expiry
SELECT id, platform, status, 
       access_token_expires_at,
       last_error
FROM integrations
WHERE status = 'error';
```

Solution: User needs to re-authenticate via the Connectors UI.

### Database Connection Issues
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check connection count
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity"
```

---

## GTM/GA4 Configuration

### GTM Container Setup
1. Create GTM Web container at https://tagmanager.google.com
2. Add container ID to `GTM_CONTAINER_ID` in .env
3. Replace `__GTM_CONTAINER_ID__` placeholder in `index.html`

### Required GTM Tags

#### 1. GA4 Configuration Tag
- Tag Type: Google Analytics: GA4 Configuration
- Measurement ID: Your GA4 ID (G-XXXXXXXXXX)
- Trigger: Consent Initialization - All Pages

#### 2. GA4 Event Tag (Lead Submit)
- Tag Type: Google Analytics: GA4 Event
- Event Name: `lead_submit`
- Parameters:
  - lead_type: `{{DLV - lead_type}}`
  - source: `{{DLV - source}}`
  - value: `{{DLV - value}}`
- Trigger: Custom Event - lead_submit

#### 3. Google Ads Conversion Tag
- Tag Type: Google Ads Conversion Tracking
- Conversion ID: `{{GOOGLE_ADS_CONVERSION_ID}}`
- Conversion Label: `{{GOOGLE_ADS_CONVERSION_LABEL}}`
- Trigger: Custom Event - lead_submit

### Data Layer Variables
Create these variables in GTM:
- `DLV - lead_type`: Data Layer Variable, name: `lead_type`
- `DLV - source`: Data Layer Variable, name: `source`
- `DLV - value`: Data Layer Variable, name: `value`
- `DLV - email`: Data Layer Variable, name: `email`
- `DLV - phone`: Data Layer Variable, name: `phone`

### Enhanced Conversions Setup
1. Enable Enhanced Conversions in GA4 Admin
2. Enable in Google Ads Conversion settings
3. Map user data in GTM Ads Conversion tag:
   - Email: `{{DLV - user_email_sha256}}`
   - Phone: `{{DLV - user_phone_sha256}}`

### Server-side GTM (Optional)
1. Create sGTM container in GTM
2. Deploy to Cloud Run or App Engine
3. Set `SGTM_ENDPOINT` to your deployment URL
4. Configure client and tags in sGTM container

---

## Database Maintenance

### Regular Vacuum (Weekly)
```sql
VACUUM ANALYZE daily_stats;
VACUUM ANALYZE seo_stats;
VACUUM ANALYZE web_vitals;
```

### Data Retention (Quarterly)
```sql
-- Remove stats older than 1 year
DELETE FROM daily_stats WHERE stat_date < NOW() - INTERVAL '1 year';
DELETE FROM seo_stats WHERE stat_date < NOW() - INTERVAL '1 year';

-- Remove old sync job records
DELETE FROM sync_jobs WHERE completed_at < NOW() - INTERVAL '90 days';
```

---

## Contact & Escalation

- **Platform Issues**: Check PM2 logs and this runbook
- **API Credential Issues**: Contact platform owner for new credentials
- **Data Discrepancies**: Compare with source platforms (Google Ads, GSC)

---

*Last updated: January 2026*




