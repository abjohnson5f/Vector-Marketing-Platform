import { pgTable, text, timestamp, integer, numeric, bigint, uuid, varchar, date, jsonb, index, unique, real } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Integrations table - stores OAuth connections (matches existing schema)
export const integrations = pgTable('integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  platform: varchar('platform', { length: 50 }).notNull(),
  accountName: varchar('account_name', { length: 255 }).notNull(),
  accountId: varchar('account_id', { length: 255 }).notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  status: varchar('status', { length: 50 }).default('disconnected'),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  lastError: text('last_error'),
  config: jsonb('config'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Campaigns table - normalized campaign data (matches existing schema)
export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  platform: varchar('platform', { length: 50 }).notNull(),
  externalId: varchar('external_id', { length: 255 }).notNull(),
  name: varchar('name', { length: 500 }).notNull(),
  status: varchar('status', { length: 50 }).default('active'),
  objective: varchar('objective', { length: 100 }),
  spend: numeric('spend', { precision: 15, scale: 2 }).default('0'),
  revenue: numeric('revenue', { precision: 15, scale: 2 }).default('0'),
  roas: numeric('roas', { precision: 10, scale: 4 }),
  conversions: integer('conversions').default(0),
  impressions: bigint('impressions', { mode: 'number' }).default(0),
  clicks: integer('clicks').default(0),
  ctr: numeric('ctr', { precision: 10, scale: 4 }),
  integrationId: uuid('integration_id').references(() => integrations.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('campaigns_integration_external_idx').on(table.integrationId, table.externalId),
]);

// Daily stats table - aggregated metrics per campaign per day (matches existing schema)
export const dailyStats = pgTable('daily_stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  statDate: date('stat_date').notNull(),
  sourceType: varchar('source_type', { length: 50 }),
  campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'cascade' }),
  spend: numeric('spend', { precision: 15, scale: 2 }).default('0'),
  revenue: numeric('revenue', { precision: 15, scale: 2 }).default('0'),
  conversions: integer('conversions').default(0),
  impressions: bigint('impressions', { mode: 'number' }).default(0),
  clicks: integer('clicks').default(0),
  ctr: numeric('ctr', { precision: 10, scale: 4 }),
  cpc: numeric('cpc', { precision: 10, scale: 4 }),
  cpa: numeric('cpa', { precision: 10, scale: 4 }),
  roas: numeric('roas', { precision: 10, scale: 4 }),
  sessions: integer('sessions').default(0),
  users: integer('users').default(0),
  newUsers: integer('new_users').default(0),
  bounceRate: numeric('bounce_rate', { precision: 10, scale: 4 }),
  avgSessionDuration: numeric('avg_session_duration', { precision: 15, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('daily_stats_date_idx').on(table.statDate),
  unique('daily_stats_campaign_date_idx').on(table.campaignId, table.statDate),
]);

// Sync jobs table - tracks data synchronization jobs
export const syncJobs = pgTable('sync_jobs', {
  id: text('id').primaryKey(),
  integrationId: text('integration_id').notNull(),
  jobType: varchar('job_type', { length: 50 }).default('full'), // full, delta, backfill
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  campaignsProcessed: integer('campaigns_processed').default(0),
  statsProcessed: integer('stats_processed').default(0),
  errorMessage: text('error_message'),
  metadata: jsonb('metadata'), // Additional job info like date range
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('sync_jobs_integration_idx').on(table.integrationId),
  index('sync_jobs_status_idx').on(table.status),
]);

// SEO Stats table - Search Console data (clicks, impressions, CTR, position)
export const seoStats = pgTable('seo_stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  statDate: date('stat_date').notNull(),
  siteUrl: varchar('site_url', { length: 500 }).notNull(),
  query: varchar('query', { length: 1000 }),
  page: varchar('page', { length: 2000 }),
  country: varchar('country', { length: 10 }),
  device: varchar('device', { length: 20 }),
  clicks: integer('clicks').default(0),
  impressions: integer('impressions').default(0),
  ctr: real('ctr'), // 0.0 - 1.0
  position: real('position'), // Average position
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('seo_stats_date_idx').on(table.statDate),
  index('seo_stats_site_idx').on(table.siteUrl),
]);

// SEO Keywords table - DataForSEO keyword data
export const seoKeywords = pgTable('seo_keywords', {
  id: uuid('id').primaryKey().defaultRandom(),
  keyword: varchar('keyword', { length: 500 }).notNull(),
  searchVolume: integer('search_volume').default(0),
  difficulty: integer('difficulty'), // 0-100
  cpc: real('cpc'),
  competition: real('competition'), // 0.0 - 1.0
  intent: varchar('intent', { length: 50 }), // informational, navigational, transactional, commercial
  rankPosition: integer('rank_position'),
  rankUrl: varchar('rank_url', { length: 2000 }),
  serpFeatures: jsonb('serp_features'), // featured_snippet, local_pack, etc.
  lastUpdated: timestamp('last_updated', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('seo_keywords_keyword_idx').on(table.keyword),
  unique('seo_keywords_keyword_unique').on(table.keyword),
]);

// SEO Pages table - DataForSEO page data
export const seoPages = pgTable('seo_pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: varchar('url', { length: 2000 }).notNull(),
  title: varchar('title', { length: 500 }),
  organicTraffic: integer('organic_traffic').default(0),
  keywordsCount: integer('keywords_count').default(0),
  backlinksCount: integer('backlinks_count').default(0),
  referringDomains: integer('referring_domains').default(0),
  topKeywords: jsonb('top_keywords'), // Array of {keyword, position, volume}
  lastUpdated: timestamp('last_updated', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('seo_pages_url_idx').on(table.url),
]);

// Web Vitals table - PageSpeed Insights / Core Web Vitals data
export const webVitals = pgTable('web_vitals', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: varchar('url', { length: 2000 }).notNull(),
  strategy: varchar('strategy', { length: 20 }).notNull().default('mobile'), // mobile, desktop
  
  // Core Web Vitals
  lcp: real('lcp'), // Largest Contentful Paint (ms)
  lcpScore: varchar('lcp_score', { length: 20 }), // GOOD, NEEDS_IMPROVEMENT, POOR
  fid: real('fid'), // First Input Delay (ms) - deprecated for INP
  inp: real('inp'), // Interaction to Next Paint (ms)
  inpScore: varchar('inp_score', { length: 20 }),
  cls: real('cls'), // Cumulative Layout Shift
  clsScore: varchar('cls_score', { length: 20 }),
  
  // Additional metrics
  fcp: real('fcp'), // First Contentful Paint (ms)
  ttfb: real('ttfb'), // Time to First Byte (ms)
  speedIndex: real('speed_index'),
  totalBlockingTime: real('total_blocking_time'),
  
  // Overall scores
  performanceScore: integer('performance_score'), // 0-100
  accessibilityScore: integer('accessibility_score'),
  bestPracticesScore: integer('best_practices_score'),
  seoScore: integer('seo_score'),
  
  // Raw data for debugging
  rawData: jsonb('raw_data'),
  
  measuredAt: timestamp('measured_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('web_vitals_url_idx').on(table.url),
  index('web_vitals_measured_at_idx').on(table.measuredAt),
]);

// Lead Origins table - for geographic lead mapping (future)
export const leadOrigins = pgTable('lead_origins', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadDate: date('lead_date').notNull(),
  latitude: real('latitude'),
  longitude: real('longitude'),
  city: varchar('city', { length: 255 }),
  region: varchar('region', { length: 255 }),
  country: varchar('country', { length: 100 }),
  source: varchar('source', { length: 100 }), // google_ads, meta_ads, organic, etc.
  medium: varchar('medium', { length: 100 }),
  campaign: varchar('campaign', { length: 500 }),
  leadCount: integer('lead_count').default(1),
  leadValue: numeric('lead_value', { precision: 15, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('lead_origins_date_idx').on(table.leadDate),
  index('lead_origins_geo_idx').on(table.country, table.region),
]);

// Relations
export const integrationsRelations = relations(integrations, ({ many }) => ({
  campaigns: many(campaigns),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  integration: one(integrations, {
    fields: [campaigns.integrationId],
    references: [integrations.id],
  }),
  dailyStats: many(dailyStats),
}));

export const dailyStatsRelations = relations(dailyStats, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [dailyStats.campaignId],
    references: [campaigns.id],
  }),
}));

// Types
export type Integration = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type DailyStat = typeof dailyStats.$inferSelect;
export type NewDailyStat = typeof dailyStats.$inferInsert;
export type SyncJob = typeof syncJobs.$inferSelect;
export type NewSyncJob = typeof syncJobs.$inferInsert;
export type SeoStat = typeof seoStats.$inferSelect;
export type NewSeoStat = typeof seoStats.$inferInsert;
export type SeoKeyword = typeof seoKeywords.$inferSelect;
export type NewSeoKeyword = typeof seoKeywords.$inferInsert;
export type SeoPage = typeof seoPages.$inferSelect;
export type NewSeoPage = typeof seoPages.$inferInsert;
export type WebVital = typeof webVitals.$inferSelect;
export type NewWebVital = typeof webVitals.$inferInsert;
export type LeadOrigin = typeof leadOrigins.$inferSelect;
export type NewLeadOrigin = typeof leadOrigins.$inferInsert;
