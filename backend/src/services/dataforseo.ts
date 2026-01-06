import { logger } from '../lib/logger.js';
import { env, hasDataForSEO } from '../config/env.js';

/**
 * DataForSEO API Service
 * Provides keyword data, SERP analysis, and competitor insights
 */

const DATAFORSEO_API_BASE = 'https://api.dataforseo.com/v3';

interface DataForSEOResponse<T> {
  version: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  tasks_count: number;
  tasks_error: number;
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
    time: string;
    cost: number;
    result_count: number;
    path: string[];
    data: Record<string, unknown>;
    result: T[];
  }>;
}

export interface KeywordData {
  keyword: string;
  searchVolume: number;
  cpc: number | null;
  competition: number | null;
  competitionLevel: string | null;
  monthlySearches: Array<{ year: number; month: number; volume: number }> | null;
}

export interface SerpItem {
  type: string;
  rankGroup: number;
  rankAbsolute: number;
  position: string;
  title: string;
  description: string;
  url: string;
  domain: string;
}

export interface RankedKeyword {
  keyword: string;
  position: number;
  url: string;
  searchVolume: number;
  traffic: number;
  trafficCost: number;
}

export interface TopPage {
  url: string;
  organicTraffic: number;
  keywordsCount: number;
  topKeywords: Array<{ keyword: string; position: number; searchVolume: number }>;
}

/**
 * Get authorization header for DataForSEO
 */
function getAuthHeader(): string {
  if (!hasDataForSEO()) {
    throw new Error('DataForSEO not configured');
  }
  const credentials = Buffer.from(`${env.DATAFORSEO_LOGIN}:${env.DATAFORSEO_PASSWORD}`).toString('base64');
  return `Basic ${credentials}`;
}

/**
 * Make a request to DataForSEO API
 */
async function dataForSEORequest<T>(
  endpoint: string,
  body: unknown[]
): Promise<T[]> {
  if (!hasDataForSEO()) {
    logger.warn('DataForSEO not configured, returning empty results');
    return [];
  }

  try {
    const response = await fetch(`${DATAFORSEO_API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ status: response.status, error, endpoint }, 'DataForSEO API error');
      throw new Error(`DataForSEO API error: ${response.status}`);
    }

    const data = await response.json() as DataForSEOResponse<T>;

    if (data.status_code !== 20000) {
      logger.error({ statusCode: data.status_code, message: data.status_message }, 'DataForSEO request failed');
      throw new Error(`DataForSEO error: ${data.status_message}`);
    }

    // Flatten all task results
    const results: T[] = [];
    for (const task of data.tasks) {
      if (task.result) {
        results.push(...task.result);
      }
    }

    return results;
  } catch (err) {
    logger.error({ error: err, endpoint }, 'DataForSEO request failed');
    throw err;
  }
}

/**
 * Get keyword search volume and metrics
 */
export async function getKeywordsData(
  keywords: string[],
  location: string = 'United States',
  language: string = 'en'
): Promise<KeywordData[]> {
  const results = await dataForSEORequest<{
    keyword: string;
    search_volume: number;
    cpc: number | null;
    competition: number | null;
    competition_level: string | null;
    monthly_searches: Array<{ year: number; month: number; search_volume: number }> | null;
  }>('/keywords_data/google_ads/search_volume/live', [
    {
      keywords,
      location_name: location,
      language_name: language,
    },
  ]);

  return results.map(r => ({
    keyword: r.keyword,
    searchVolume: r.search_volume || 0,
    cpc: r.cpc,
    competition: r.competition,
    competitionLevel: r.competition_level,
    monthlySearches: r.monthly_searches?.map(m => ({
      year: m.year,
      month: m.month,
      volume: m.search_volume,
    })) || null,
  }));
}

/**
 * Get SERP results for a keyword
 */
export async function getSerpResults(
  keyword: string,
  location: string = 'United States',
  language: string = 'en',
  depth: number = 10
): Promise<SerpItem[]> {
  const results = await dataForSEORequest<{
    items: Array<{
      type: string;
      rank_group: number;
      rank_absolute: number;
      position: string;
      title: string;
      description: string;
      url: string;
      domain: string;
    }>;
  }>('/serp/google/organic/live/regular', [
    {
      keyword,
      location_name: location,
      language_name: language,
      depth,
    },
  ]);

  if (!results.length || !results[0].items) {
    return [];
  }

  return results[0].items.map(item => ({
    type: item.type,
    rankGroup: item.rank_group,
    rankAbsolute: item.rank_absolute,
    position: item.position,
    title: item.title || '',
    description: item.description || '',
    url: item.url || '',
    domain: item.domain || '',
  }));
}

/**
 * Get ranked keywords for a domain
 */
export async function getDomainRankedKeywords(
  domain: string,
  location: string = 'United States',
  language: string = 'en',
  limit: number = 100
): Promise<RankedKeyword[]> {
  const results = await dataForSEORequest<{
    items: Array<{
      keyword_data: {
        keyword: string;
        search_volume: number;
      };
      ranked_serp_element: {
        serp_item: {
          rank_absolute: number;
          url: string;
        };
        etv: number;
        estimated_paid_traffic_cost: number;
      };
    }>;
  }>('/dataforseo_labs/google/ranked_keywords/live', [
    {
      target: domain,
      location_name: location,
      language_name: language,
      limit,
      order_by: ['ranked_serp_element.serp_item.rank_absolute,asc'],
    },
  ]);

  if (!results.length || !results[0].items) {
    return [];
  }

  return results[0].items.map(item => ({
    keyword: item.keyword_data.keyword,
    position: item.ranked_serp_element.serp_item.rank_absolute,
    url: item.ranked_serp_element.serp_item.url,
    searchVolume: item.keyword_data.search_volume,
    traffic: item.ranked_serp_element.etv,
    trafficCost: item.ranked_serp_element.estimated_paid_traffic_cost,
  }));
}

/**
 * Get top pages for a domain
 */
export async function getDomainTopPages(
  domain: string,
  location: string = 'United States',
  language: string = 'en',
  limit: number = 50
): Promise<TopPage[]> {
  const results = await dataForSEORequest<{
    items: Array<{
      page: string;
      metrics: {
        organic: {
          etv: number;
          count: number;
        };
      };
    }>;
  }>('/dataforseo_labs/google/relevant_pages/live', [
    {
      target: domain,
      location_name: location,
      language_name: language,
      limit,
      order_by: ['metrics.organic.etv,desc'],
    },
  ]);

  if (!results.length || !results[0].items) {
    return [];
  }

  return results[0].items.map(item => ({
    url: item.page,
    organicTraffic: item.metrics?.organic?.etv || 0,
    keywordsCount: item.metrics?.organic?.count || 0,
    topKeywords: [], // Would need additional API call
  }));
}

/**
 * Get competitor domains
 */
export async function getCompetitorDomains(
  domain: string,
  location: string = 'United States',
  language: string = 'en',
  limit: number = 10
): Promise<Array<{ domain: string; commonKeywords: number; etv: number }>> {
  const results = await dataForSEORequest<{
    items: Array<{
      domain: string;
      avg_position: number;
      sum_position: number;
      intersections: number;
      metrics: {
        organic: {
          etv: number;
        };
      };
    }>;
  }>('/dataforseo_labs/google/competitors_domain/live', [
    {
      target: domain,
      location_name: location,
      language_name: language,
      limit,
      exclude_top_domains: true,
    },
  ]);

  if (!results.length || !results[0].items) {
    return [];
  }

  return results[0].items.map(item => ({
    domain: item.domain,
    commonKeywords: item.intersections,
    etv: item.metrics?.organic?.etv || 0,
  }));
}

/**
 * Get keyword suggestions
 */
export async function getKeywordSuggestions(
  seedKeyword: string,
  location: string = 'United States',
  language: string = 'en',
  limit: number = 50
): Promise<KeywordData[]> {
  const results = await dataForSEORequest<{
    items: Array<{
      keyword: string;
      keyword_info: {
        search_volume: number;
        cpc: number | null;
        competition: number | null;
        competition_level: string | null;
      };
    }>;
  }>('/dataforseo_labs/google/keyword_suggestions/live', [
    {
      keyword: seedKeyword,
      location_name: location,
      language_name: language,
      limit,
    },
  ]);

  if (!results.length || !results[0].items) {
    return [];
  }

  return results[0].items.map(item => ({
    keyword: item.keyword,
    searchVolume: item.keyword_info?.search_volume || 0,
    cpc: item.keyword_info?.cpc || null,
    competition: item.keyword_info?.competition || null,
    competitionLevel: item.keyword_info?.competition_level || null,
    monthlySearches: null,
  }));
}




