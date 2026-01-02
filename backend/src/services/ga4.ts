import { Integration } from '../db/schema.js';
import { decryptToken } from '../lib/crypto.js';
import { IntegrationError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

interface GA4PropertyResponse {
  properties: Array<{
    name: string;
    displayName: string;
    propertyType: string;
  }>;
}

interface GA4ReportResponse {
  dimensionHeaders: Array<{ name: string }>;
  metricHeaders: Array<{ name: string }>;
  rows: Array<{
    dimensionValues: Array<{ value: string }>;
    metricValues: Array<{ value: string }>;
  }>;
}

export interface GA4Metrics {
  date: Date;
  sessions: number;
  users: number;
  newUsers: number;
  transactions: number;
  revenue: number;
  pageviews: number;
}

/**
 * Refreshes Google OAuth access token if expired
 */
async function refreshAccessToken(integration: Integration): Promise<string> {
  if (!integration.refreshToken) {
    throw new IntegrationError('No refresh token available', 'ga4');
  }
  
  const refreshToken = decryptToken(integration.refreshToken);
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  
  if (!response.ok) {
    throw new IntegrationError('Failed to refresh Google token', 'ga4');
  }
  
  const tokens = await response.json() as { access_token: string };
  return tokens.access_token;
}

/**
 * Gets valid access token, refreshing if necessary
 */
async function getAccessToken(integration: Integration): Promise<string> {
  if (!integration.accessToken) {
    throw new IntegrationError('No access token available', 'ga4');
  }
  
  // Check if token is expired
  if (integration.tokenExpiresAt && integration.tokenExpiresAt < new Date()) {
    logger.info({ integrationId: integration.id }, 'Refreshing expired GA4 token');
    return refreshAccessToken(integration);
  }
  
  return decryptToken(integration.accessToken);
}

/**
 * Fetches available GA4 properties for the authenticated user
 */
export async function fetchGA4Properties(integration: Integration): Promise<string[]> {
  const accessToken = await getAccessToken(integration);
  
  try {
    const response = await fetch(
      'https://analyticsadmin.googleapis.com/v1beta/properties',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    
    if (!response.ok) {
      throw new IntegrationError('Failed to fetch GA4 properties', 'ga4');
    }
    
    const data = await response.json() as GA4PropertyResponse;
    return data.properties.map(p => p.name);
  } catch (err) {
    logger.error({ error: err, integrationId: integration.id }, 'Failed to fetch GA4 properties');
    throw new IntegrationError('Failed to fetch properties from GA4', 'ga4');
  }
}

/**
 * Fetches daily analytics data from GA4 Data API
 */
export async function fetchGA4Metrics(
  integration: Integration,
  propertyId: string,
  startDate: Date,
  endDate: Date
): Promise<GA4Metrics[]> {
  const accessToken = await getAccessToken(integration);
  
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  
  try {
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate: formatDate(startDate),
              endDate: formatDate(endDate),
            },
          ],
          dimensions: [
            { name: 'date' },
          ],
          metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' },
            { name: 'newUsers' },
            { name: 'transactions' },
            { name: 'purchaseRevenue' },
            { name: 'screenPageViews' },
          ],
        }),
      }
    );
    
    if (!response.ok) {
      const errorData = await response.text();
      logger.error({ error: errorData }, 'GA4 API error');
      throw new IntegrationError('Failed to fetch GA4 metrics', 'ga4');
    }
    
    const data = await response.json() as GA4ReportResponse;
    
    if (!data.rows) {
      return [];
    }
    
    const metrics: GA4Metrics[] = data.rows.map(row => {
      // Parse date from YYYYMMDD format
      const dateStr = row.dimensionValues[0].value;
      const date = new Date(
        parseInt(dateStr.slice(0, 4)),
        parseInt(dateStr.slice(4, 6)) - 1,
        parseInt(dateStr.slice(6, 8))
      );
      
      return {
        date,
        sessions: parseInt(row.metricValues[0].value, 10) || 0,
        users: parseInt(row.metricValues[1].value, 10) || 0,
        newUsers: parseInt(row.metricValues[2].value, 10) || 0,
        transactions: parseInt(row.metricValues[3].value, 10) || 0,
        revenue: parseFloat(row.metricValues[4].value) || 0,
        pageviews: parseInt(row.metricValues[5].value, 10) || 0,
      };
    });
    
    logger.info({
      integrationId: integration.id,
      propertyId,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      rowCount: metrics.length,
    }, 'Fetched GA4 metrics');
    
    return metrics;
  } catch (err) {
    logger.error({ error: err, integrationId: integration.id }, 'Failed to fetch GA4 metrics');
    if (err instanceof IntegrationError) throw err;
    throw new IntegrationError('Failed to fetch metrics from GA4', 'ga4');
  }
}

/**
 * Fetches conversion events from GA4
 */
export async function fetchGA4Conversions(
  integration: Integration,
  propertyId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ date: Date; eventName: string; count: number; value: number }>> {
  const accessToken = await getAccessToken(integration);
  
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  
  try {
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate: formatDate(startDate),
              endDate: formatDate(endDate),
            },
          ],
          dimensions: [
            { name: 'date' },
            { name: 'eventName' },
          ],
          metrics: [
            { name: 'eventCount' },
            { name: 'eventValue' },
          ],
          dimensionFilter: {
            filter: {
              fieldName: 'eventName',
              inListFilter: {
                values: ['purchase', 'generate_lead', 'sign_up', 'conversion'],
              },
            },
          },
        }),
      }
    );
    
    if (!response.ok) {
      throw new IntegrationError('Failed to fetch GA4 conversions', 'ga4');
    }
    
    const data = await response.json() as GA4ReportResponse;
    
    if (!data.rows) {
      return [];
    }
    
    return data.rows.map(row => {
      const dateStr = row.dimensionValues[0].value;
      const date = new Date(
        parseInt(dateStr.slice(0, 4)),
        parseInt(dateStr.slice(4, 6)) - 1,
        parseInt(dateStr.slice(6, 8))
      );
      
      return {
        date,
        eventName: row.dimensionValues[1].value,
        count: parseInt(row.metricValues[0].value, 10) || 0,
        value: parseFloat(row.metricValues[1].value) || 0,
      };
    });
  } catch (err) {
    logger.error({ error: err, integrationId: integration.id }, 'Failed to fetch GA4 conversions');
    if (err instanceof IntegrationError) throw err;
    throw new IntegrationError('Failed to fetch conversions from GA4', 'ga4');
  }
}

