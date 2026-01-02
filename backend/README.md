# Vector Marketing Platform - Backend

Production backend API for the Vector Marketing Platform, providing:
- OAuth integrations with Google Ads, Meta Ads, and GA4
- Data synchronization and normalization
- Dashboard API endpoints
- AI-powered insights via Gemini

## Prerequisites

- Node.js 20+
- PostgreSQL (Neon recommended)
- Redis (optional, for BullMQ job queue)

## Quick Start

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp env.example .env
   # Edit .env with your credentials
   ```

3. **Set up database:**
   ```bash
   npm run db:push
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

The server will start at `http://localhost:3001`.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Neon PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | No |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | For Google integration |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | For Google integration |
| `GOOGLE_OAUTH_REDIRECT` | Google OAuth redirect URI | For Google integration |
| `META_APP_ID` | Meta/Facebook App ID | For Meta integration |
| `META_APP_SECRET` | Meta/Facebook App Secret | For Meta integration |
| `META_OAUTH_REDIRECT` | Meta OAuth redirect URI | For Meta integration |
| `GEMINI_API_KEY` | Google Gemini API key | For AI features |
| `ENCRYPTION_KEY` | 32-byte base64 key for token encryption | For production |
| `PORT` | Server port (default: 3001) | No |
| `NODE_ENV` | Environment (development/production) | No |

### Generating Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## API Endpoints

### Health Check
- `GET /api/health` - Server health status

### Authentication
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/meta` - Initiate Meta OAuth
- `GET /api/auth/meta/callback` - Meta OAuth callback
- `DELETE /api/auth/:platform` - Disconnect integration

### Dashboard
- `GET /api/v1/dashboard-data` - Aggregated dashboard metrics
- `GET /api/v1/campaigns` - List all campaigns
- `GET /api/v1/campaigns/:id` - Campaign details with daily stats

### Integrations
- `GET /api/v1/integrations` - List all integrations
- `GET /api/v1/integrations/:id` - Integration details
- `POST /api/v1/integrations/:id/sync` - Trigger data sync
- `GET /api/v1/integrations/sync/:jobId` - Sync job status

### AI
- `POST /api/v1/ai/insights` - Generate marketing insights
- `POST /api/v1/ai/chat` - Conversational AI with search grounding

## Database Schema

The database includes the following tables:

- `integrations` - OAuth connections to ad platforms
- `campaigns` - Normalized campaign data from all platforms
- `daily_stats` - Daily performance metrics per campaign
- `sync_jobs` - Data synchronization job tracking

### Running Migrations

```bash
# Generate migration from schema changes
npm run db:generate

# Push schema to database
npm run db:push

# Open Drizzle Studio
npm run db:studio
```

## Development

```bash
# Run with hot reload
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Run tests
npm test
```

## Architecture

```
backend/
├── src/
│   ├── config/       # Environment configuration
│   ├── db/           # Database schema and connection
│   ├── jobs/         # Background job workers
│   ├── lib/          # Shared utilities (logger, errors, crypto)
│   ├── middleware/   # Hono middleware
│   ├── routes/       # API route handlers
│   ├── services/     # Platform API integrations
│   └── index.ts      # Server entry point
├── drizzle/          # Database migrations
└── package.json
```

## Security

- OAuth tokens are encrypted at rest using AES-256-GCM
- API rate limiting on AI endpoints (20 requests/minute)
- PII stripping from AI prompts
- Request tracing with unique IDs
- CORS configured for frontend origins

## Deployment

For production deployment:

1. Set `NODE_ENV=production`
2. Configure all required environment variables
3. Use a proper Redis instance for job queue
4. Set up Neon connection pooling
5. Configure CORS origins for your domain

```bash
npm run build
npm start
```

