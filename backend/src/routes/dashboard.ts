import { Hono } from 'hono';
import { z } from 'zod';
import { sql, desc, and, gte, lte, eq } from 'drizzle-orm';
import { db, integrations, campaigns, dailyStats } from '../db/index.js';
import { ValidationError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

const dashboard = new Hono();

// Debug endpoint to test DB connection
dashboard.get('/test-db', async (c) => {
  try {
    const result = await db.select({ count: sql<number>`count(*)` }).from(campaigns);
    return c.json({ 
      ok: true, 
      campaignCount: result[0]?.count || 0,
      message: 'Database connection successful'
    });
  } catch (error: any) {
    return c.json({ 
      ok: false, 
      error: error.message,
      stack: error.stack 
    }, 500);
  }
});

// Query params schema
const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  days: z.coerce.number().min(1).max(365).optional().default(30),
});

/**
 * GET /api/v1/dashboard-data
 * Returns aggregated metrics for the dashboard
 */
dashboard.get('/dashboard-data', async (c) => {
  try {
  const query = dateRangeSchema.parse(c.req.query());
  
  const endDate = query.endDate ? new Date(query.endDate) : new Date();
  const startDate = query.startDate 
    ? new Date(query.startDate) 
    : new Date(endDate.getTime() - query.days * 24 * 60 * 60 * 1000);
  
  logger.info({ startDate, endDate }, 'Fetching dashboard data');
  
  // Get aggregated metrics
  const metricsResult = await db.select({
    totalRevenue: sql<number>`COALESCE(SUM(${dailyStats.revenue}::numeric), 0)`,
    totalSpend: sql<number>`COALESCE(SUM(${dailyStats.spend}::numeric), 0)`,
    totalImpressions: sql<number>`COALESCE(SUM(${dailyStats.impressions}), 0)`,
    totalClicks: sql<number>`COALESCE(SUM(${dailyStats.clicks}), 0)`,
    totalConversions: sql<number>`COALESCE(SUM(${dailyStats.conversions}), 0)`,
  }).from(dailyStats)
    .where(and(
      gte(dailyStats.statDate, startDate.toISOString().split('T')[0]),
      lte(dailyStats.statDate, endDate.toISOString().split('T')[0])
    ));
  
  const metrics = metricsResult[0];
  const roas = metrics.totalSpend > 0 ? metrics.totalRevenue / metrics.totalSpend : 0;
  const ctr = metrics.totalImpressions > 0 ? (metrics.totalClicks / metrics.totalImpressions) * 100 : 0;
  const cac = metrics.totalConversions > 0 ? metrics.totalSpend / metrics.totalConversions : 0;
  
  // Get previous period for comparison
  const prevEndDate = startDate;
  const prevStartDate = new Date(prevEndDate.getTime() - (endDate.getTime() - startDate.getTime()));
  
  const prevMetricsResult = await db.select({
    totalRevenue: sql<number>`COALESCE(SUM(${dailyStats.revenue}::numeric), 0)`,
    totalSpend: sql<number>`COALESCE(SUM(${dailyStats.spend}::numeric), 0)`,
    totalConversions: sql<number>`COALESCE(SUM(${dailyStats.conversions}), 0)`,
  }).from(dailyStats)
    .where(and(
      gte(dailyStats.statDate, prevStartDate.toISOString().split('T')[0]),
      lte(dailyStats.statDate, prevEndDate.toISOString().split('T')[0])
    ));
  
  const prevMetrics = prevMetricsResult[0];
  
  // Calculate changes
  const revenueChange = prevMetrics.totalRevenue > 0 
    ? ((metrics.totalRevenue - prevMetrics.totalRevenue) / prevMetrics.totalRevenue) * 100 
    : 0;
  const spendChange = prevMetrics.totalSpend > 0 
    ? ((metrics.totalSpend - prevMetrics.totalSpend) / prevMetrics.totalSpend) * 100 
    : 0;
  const prevRoas = prevMetrics.totalSpend > 0 ? prevMetrics.totalRevenue / prevMetrics.totalSpend : 0;
  const roasChange = prevRoas > 0 ? ((roas - prevRoas) / prevRoas) * 100 : 0;
  const prevCac = prevMetrics.totalConversions > 0 ? prevMetrics.totalSpend / prevMetrics.totalConversions : 0;
  const cacChange = prevCac > 0 ? ((cac - prevCac) / prevCac) * 100 : 0;
  
  // Get top campaigns
  const topCampaigns = await db.select({
    id: campaigns.id,
    name: campaigns.name,
    platform: campaigns.platform,
    status: campaigns.status,
    spend: sql<number>`COALESCE(SUM(${dailyStats.spend}::numeric), 0)`,
    revenue: sql<number>`COALESCE(SUM(${dailyStats.revenue}::numeric), 0)`,
    conversions: sql<number>`COALESCE(SUM(${dailyStats.conversions}), 0)`,
  })
    .from(campaigns)
    .leftJoin(dailyStats, and(
      eq(campaigns.id, dailyStats.campaignId),
      gte(dailyStats.statDate, startDate.toISOString().split('T')[0]),
      lte(dailyStats.statDate, endDate.toISOString().split('T')[0])
    ))
    .groupBy(campaigns.id, campaigns.name, campaigns.platform, campaigns.status)
    .orderBy(desc(sql`SUM(${dailyStats.revenue}::numeric)`))
    .limit(10);
  
  // Get daily chart data
  const chartData = await db.select({
    date: dailyStats.statDate,
    revenue: sql<number>`SUM(${dailyStats.revenue}::numeric)`,
    spend: sql<number>`SUM(${dailyStats.spend}::numeric)`,
  })
    .from(dailyStats)
    .where(and(
      gte(dailyStats.statDate, startDate.toISOString().split('T')[0]),
      lte(dailyStats.statDate, endDate.toISOString().split('T')[0])
    ))
    .groupBy(dailyStats.statDate)
    .orderBy(dailyStats.statDate);
  
  return c.json({
    metrics: [
      {
        label: 'Attributed Revenue',
        value: `$${metrics.totalRevenue.toLocaleString()}`,
        change: Number(revenueChange.toFixed(1)),
        trend: revenueChange >= 0 ? 'up' : 'down',
        format: 'currency',
      },
      {
        label: 'Total Ad Spend',
        value: `$${metrics.totalSpend.toLocaleString()}`,
        change: Number(spendChange.toFixed(1)),
        trend: spendChange >= 0 ? 'up' : 'down',
        format: 'currency',
      },
      {
        label: 'Average CAC',
        value: `$${cac.toFixed(2)}`,
        change: Number(cacChange.toFixed(1)),
        trend: cacChange <= 0 ? 'up' : 'down', // Lower CAC is better
        format: 'currency',
      },
      {
        label: 'Overall ROAS',
        value: `${roas.toFixed(2)}x`,
        change: Number(roasChange.toFixed(1)),
        trend: roasChange >= 0 ? 'up' : 'down',
        format: 'number',
      },
    ],
    campaigns: topCampaigns.map(c => ({
      id: c.id,
      name: c.name,
      platform: c.platform === 'google_ads' ? 'google' : c.platform === 'meta_ads' ? 'meta' : c.platform,
      status: c.status,
      spend: c.spend,
      revenue: c.revenue,
      conversions: c.conversions,
      roas: c.spend > 0 ? Number((c.revenue / c.spend).toFixed(2)) : 0,
    })),
    chart: chartData.map(d => ({
      date: String(d.date),
      value: d.revenue,
      spend: d.spend,
    })),
    dateRange: {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    },
  });
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, 'Dashboard data error');
    return c.json({ ok: false, error: error.message, stack: error.stack }, 500);
  }
});

/**
 * GET /api/v1/campaigns
 * Returns list of all campaigns
 */
dashboard.get('/campaigns', async (c) => {
  const allCampaigns = await db.query.campaigns.findMany({
    orderBy: desc(campaigns.updatedAt),
    with: {
      integration: {
        columns: {
          accountName: true,
        },
      },
    },
  });
  
  return c.json({
    campaigns: allCampaigns.map(c => ({
      id: c.id,
      name: c.name,
      platform: c.platform,
      status: c.status,
      objective: c.objective,
      accountName: c.integration?.accountName,
      updatedAt: c.updatedAt,
    })),
  });
});

/**
 * GET /api/v1/campaigns/:id
 * Returns detailed campaign data with daily stats
 */
dashboard.get('/campaigns/:id', async (c) => {
  const campaignId = c.req.param('id');
  
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
    with: {
      integration: {
        columns: {
          accountName: true,
        },
      },
    },
  });
  
  if (!campaign) {
    throw new ValidationError('Campaign not found');
  }
  
  // Get last 30 days of stats
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const stats = await db.select()
    .from(dailyStats)
    .where(and(
      eq(dailyStats.campaignId, campaignId),
      gte(dailyStats.statDate, thirtyDaysAgo.toISOString().split('T')[0])
    ))
    .orderBy(dailyStats.statDate);
  
  // Aggregate totals
  const totals = stats.reduce((acc, s) => ({
    impressions: acc.impressions + s.impressions,
    clicks: acc.clicks + s.clicks,
    spend: acc.spend + Number(s.spend),
    conversions: acc.conversions + s.conversions,
    revenue: acc.revenue + Number(s.revenue),
  }), { impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 });
  
  return c.json({
    id: campaign.id,
    name: campaign.name,
    platform: campaign.platform,
    status: campaign.status,
    objective: campaign.objective,
    accountName: campaign.integration?.accountName,
    totals: {
      ...totals,
      roas: totals.spend > 0 ? Number((totals.revenue / totals.spend).toFixed(2)) : 0,
      ctr: totals.impressions > 0 ? Number(((totals.clicks / totals.impressions) * 100).toFixed(2)) : 0,
      cpc: totals.clicks > 0 ? Number((totals.spend / totals.clicks).toFixed(2)) : 0,
      cpa: totals.conversions > 0 ? Number((totals.spend / totals.conversions).toFixed(2)) : 0,
    },
    dailyTrend: stats.map(s => ({
      date: s.statDate ? new Date(s.statDate).toISOString().split('T')[0] : '',
      impressions: s.impressions,
      clicks: s.clicks,
      spend: Number(s.spend),
      conversions: s.conversions,
      revenue: Number(s.revenue),
    })),
  });
});

export default dashboard;

