# Origin Growth Center: Technical Handoff Documentation

## 1. Project Overview
The Origin Growth Center is a world-class omnichannel marketing dashboard. It aggregates data from **Google Ads**, **Meta Ads**, and **Google Analytics 4 (GA4)** to provide a "Single Source of Truth" for marketing performance, LTV analysis, and predictive forecasting.

---

## 2. Technical Stack

### Frontend
- **Framework**: React 19 (ES6 Modules)
- **Build Tool**: Vite
- **Styling**: Tailwind CSS (Dark Mode focused)
- **Icons**: Lucide-React
- **Charts**: Recharts (Customized with glow effects and tooltips)
- **API Layer**: Centralized in `services/api.ts`

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Hono (lightweight, fast web framework)
- **Language**: TypeScript (strict mode)
- **Database**: Neon Postgres with Drizzle ORM
- **Queue**: Redis + BullMQ for background sync jobs
- **AI**: Google Gemini API (server-side proxy)
- **Logging**: Pino (structured JSON logs)
- **Testing**: Vitest
- **Linting**: ESLint with TypeScript support

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                        │
│  App.tsx → useApi hook → services/api.ts → Backend API         │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTP
┌───────────────────────────────▼─────────────────────────────────┐
│                      Backend (Hono + TS)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ /api/auth/* │  │ /api/dash/* │  │ /api/integrations/*    │  │
│  │ OAuth flows │  │ Dashboard   │  │ Manage connections     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│  ┌─────────────┐  ┌─────────────────────────────────────────┐   │
│  │ /api/ai/*   │  │ BullMQ Worker (sync-worker.ts)          │   │
│  │ Gemini proxy│  │ Scheduled data sync every 6 hours       │   │
│  └─────────────┘  └─────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                    Neon Postgres (Drizzle)                      │
│  Tables: integrations, campaigns, daily_stats, sync_jobs       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema

Defined in `backend/src/db/schema.ts` using Drizzle ORM:

| Table          | Purpose                                           |
|----------------|---------------------------------------------------|
| `integrations` | OAuth tokens for Google/Meta/GA4 (AES-256 encrypted) |
| `campaigns`    | Campaign metadata normalized across platforms     |
| `daily_stats`  | Daily performance metrics (spend, impressions, etc.) |
| `sync_jobs`    | Background job tracking for data sync operations |

### Key Fields in `daily_stats`:
- `spend`, `impressions`, `clicks`, `conversions`, `revenue`
- All monetary values stored as integers (cents/micros)

---

## 5. API Endpoints

### Authentication (`/api/auth`)
| Endpoint               | Method | Description                    |
|------------------------|--------|--------------------------------|
| `/api/auth/google`     | GET    | Initiate Google OAuth flow     |
| `/api/auth/google/callback` | GET | Handle Google OAuth callback |
| `/api/auth/meta`       | GET    | Initiate Meta OAuth flow       |
| `/api/auth/meta/callback` | GET | Handle Meta OAuth callback    |

### Dashboard (`/api/dashboard`)
| Endpoint                      | Method | Description                    |
|-------------------------------|--------|--------------------------------|
| `/api/dashboard/overview`     | GET    | Aggregated metrics for dashboard |
| `/api/dashboard/campaigns`    | GET    | List all campaigns             |
| `/api/dashboard/campaigns/:id`| GET    | Campaign detail with daily stats |
| `/api/dashboard/time-series`  | GET    | Time-series data for charts    |

### Integrations (`/api/integrations`)
| Endpoint                    | Method | Description                      |
|-----------------------------|--------|----------------------------------|
| `/api/integrations`         | GET    | List all connected integrations  |
| `/api/integrations/:id`     | DELETE | Disconnect an integration        |
| `/api/integrations/:id/sync`| POST   | Trigger manual sync              |

### AI (`/api/ai`)
| Endpoint            | Method | Description                        |
|---------------------|--------|------------------------------------|
| `/api/ai/insights`  | POST   | Generate AI insights from metrics  |
| `/api/ai/chat`      | POST   | Strategy chat with Gemini Pro      |

---

## 6. Key Metrics Calculated

1. **ROAS (Return on Ad Spend)**: `Total Revenue / Total Ad Spend`
2. **CAC (Customer Acquisition Cost)**: `Total Ad Spend / New Conversions`
3. **LTV:CAC Ratio**: Lifetime Value of a cohort divided by its acquisition cost
4. **Payback Period**: Time (months) for cumulative revenue to exceed acquisition spend
5. **Forecast**: Predictive revenue model based on trend analysis

---

## 7. Security Features

- **Token Encryption**: OAuth tokens encrypted with AES-256-GCM before storage
- **Environment Variables**: Sensitive config via `.env` (see `backend/env.example`)
- **Request IDs**: Every request tagged for tracing (`X-Request-Id` header)
- **Error Handling**: Standardized error envelope, no stack traces in production
- **CORS**: Configured for frontend origin

---

## 8. Running Locally

### Prerequisites
- Node.js 18+
- Redis (for BullMQ)
- Neon Postgres database

### Backend Setup
```bash
cd backend
cp env.example .env
# Fill in your credentials in .env
npm install
npm run db:push    # Push schema to database
npm run dev        # Start dev server on :3001
```

### Frontend Setup
```bash
npm install
npm run dev        # Start Vite on :5173
```

### Running Tests
```bash
cd backend
npm test           # Run Vitest
npm run lint       # Run ESLint
```

---

## 9. Environment Variables

Required variables (see `backend/env.example`):

| Variable             | Description                          |
|----------------------|--------------------------------------|
| `DATABASE_URL`       | Neon Postgres connection string      |
| `REDIS_URL`          | Redis connection string              |
| `ENCRYPTION_KEY`     | 32-byte hex key for token encryption |
| `GOOGLE_CLIENT_ID`   | Google OAuth client ID               |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret         |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL                  |
| `META_APP_ID`        | Meta (Facebook) App ID               |
| `META_APP_SECRET`    | Meta App secret                      |
| `META_REDIRECT_URI`  | Meta OAuth callback URL              |
| `GEMINI_API_KEY`     | Google Gemini API key                |

---

## 10. Data Sync Architecture

The `sync-worker.ts` BullMQ worker handles:

1. **Scheduled Sync**: Every 6 hours, pulls fresh data from connected platforms
2. **Manual Sync**: Triggered via `/api/integrations/:id/sync`
3. **Normalization**: Maps platform-specific fields to unified schema:
   - Google: `metrics.cost_micros` → `spend` (converted from micros)
   - Meta: `spend` → `spend` (direct mapping)
   - GA4: Session/conversion data normalized

---

## 11. Frontend Integration Points

### API Service (`services/api.ts`)
Centralized API client with:
- Base URL configuration via `VITE_API_URL`
- Typed request/response handling
- Error propagation

### useApi Hook (`hooks/useApi.ts`)
Generic data fetching hook with:
- Loading states
- Error handling
- Automatic refetch capability

### Components
- `LoadingSpinner.tsx`: Consistent loading UI
- `ErrorToast.tsx`: Error notification display

---

## 12. AI Capabilities

### Insight Engine (Gemini Flash)
- Generates 4 structured insights for sidebar
- Input: 30-day performance snapshot + active campaigns
- Output: Category, Priority, Description

### Strategy Chat (Gemini Pro)
- Interactive marketing consultant
- Server-side proxied through `/api/ai/chat`
- Supports context-aware responses

---

## 13. Future Enhancements

- [ ] JWT authentication for multi-user support
- [ ] Rate limiting on API endpoints
- [ ] Webhook support for real-time sync triggers
- [ ] Export functionality (CSV/PDF reports)
- [ ] A/B test tracking integration

---

**End of Handoff Document**
