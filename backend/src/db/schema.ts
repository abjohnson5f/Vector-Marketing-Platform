import { pgTable, text, timestamp, integer, numeric, bigint, uuid, varchar, date, jsonb, index, unique } from 'drizzle-orm/pg-core';
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
});

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
  cpa: numeric('cpa', { precision: 10, scale: 4 }),
  roas: numeric('roas', { precision: 10, scale: 4 }),
  sessions: integer('sessions').default(0),
  users: integer('users').default(0),
  newUsers: integer('new_users').default(0),
  bounceRate: numeric('bounce_rate', { precision: 10, scale: 4 }),
  avgSessionDuration: numeric('avg_session_duration', { precision: 15, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Sync jobs table - tracks data synchronization jobs
export const syncJobs = pgTable('sync_jobs', {
  id: text('id').primaryKey(),
  integrationId: text('integration_id').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  campaignsProcessed: integer('campaigns_processed').default(0),
  statsProcessed: integer('stats_processed').default(0),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('sync_jobs_integration_idx').on(table.integrationId),
  index('sync_jobs_status_idx').on(table.status),
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
