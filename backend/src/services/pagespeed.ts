import { logger } from '../lib/logger.js';
import { env, hasPageSpeed } from '../config/env.js';

/**
 * PageSpeed Insights API Service
 * Provides Core Web Vitals and performance metrics
 */

const PAGESPEED_API_BASE = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

interface PageSpeedResponse {
  captchaResult: string;
  kind: string;
  id: string;
  loadingExperience: {
    id: string;
    metrics: {
      CUMULATIVE_LAYOUT_SHIFT_SCORE?: MetricValue;
      EXPERIMENTAL_TIME_TO_FIRST_BYTE?: MetricValue;
      FIRST_CONTENTFUL_PAINT_MS?: MetricValue;
      FIRST_INPUT_DELAY_MS?: MetricValue;
      INTERACTION_TO_NEXT_PAINT?: MetricValue;
      LARGEST_CONTENTFUL_PAINT_MS?: MetricValue;
    };
    overall_category: string;
  };
  originLoadingExperience?: {
    metrics: Record<string, MetricValue>;
    overall_category: string;
  };
  lighthouseResult: {
    requestedUrl: string;
    finalUrl: string;
    lighthouseVersion: string;
    fetchTime: string;
    categories: {
      performance?: { score: number };
      accessibility?: { score: number };
      'best-practices'?: { score: number };
      seo?: { score: number };
    };
    audits: {
      'largest-contentful-paint'?: AuditResult;
      'first-contentful-paint'?: AuditResult;
      'speed-index'?: AuditResult;
      'total-blocking-time'?: AuditResult;
      'cumulative-layout-shift'?: AuditResult;
      'server-response-time'?: AuditResult;
      'interactive'?: AuditResult;
    };
  };
}

interface MetricValue {
  percentile: number;
  distributions: Array<{ min: number; max: number; proportion: number }>;
  category: 'FAST' | 'AVERAGE' | 'SLOW';
}

interface AuditResult {
  id: string;
  title: string;
  description: string;
  score: number | null;
  scoreDisplayMode: string;
  numericValue?: number;
  numericUnit?: string;
  displayValue?: string;
}

export interface WebVitalsResult {
  url: string;
  strategy: 'mobile' | 'desktop';
  fetchTime: string;
  
  // Core Web Vitals
  lcp: number | null;
  lcpScore: 'GOOD' | 'NEEDS_IMPROVEMENT' | 'POOR' | null;
  inp: number | null;
  inpScore: 'GOOD' | 'NEEDS_IMPROVEMENT' | 'POOR' | null;
  cls: number | null;
  clsScore: 'GOOD' | 'NEEDS_IMPROVEMENT' | 'POOR' | null;
  
  // Additional metrics
  fcp: number | null;
  ttfb: number | null;
  speedIndex: number | null;
  totalBlockingTime: number | null;
  
  // Scores (0-100)
  performanceScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  seoScore: number | null;
  
  // Raw response for debugging
  rawData?: PageSpeedResponse;
}

/**
 * Map API category to our score format
 */
function mapCategory(category?: string): 'GOOD' | 'NEEDS_IMPROVEMENT' | 'POOR' | null {
  if (!category) return null;
  switch (category) {
    case 'FAST':
      return 'GOOD';
    case 'AVERAGE':
      return 'NEEDS_IMPROVEMENT';
    case 'SLOW':
      return 'POOR';
    default:
      return null;
  }
}

/**
 * Fetch PageSpeed Insights for a URL
 */
export async function getPageSpeedInsights(
  url: string,
  strategy: 'mobile' | 'desktop' = 'mobile',
  includeRawData: boolean = false
): Promise<WebVitalsResult> {
  if (!hasPageSpeed()) {
    logger.warn('PageSpeed API not configured');
    return createEmptyResult(url, strategy);
  }

  const params = new URLSearchParams({
    url,
    strategy,
    category: 'performance',
    key: env.PAGESPEED_API_KEY!,
  });

  // Add additional categories
  params.append('category', 'accessibility');
  params.append('category', 'best-practices');
  params.append('category', 'seo');

  try {
    logger.info({ url, strategy }, 'Fetching PageSpeed Insights');
    
    const response = await fetch(`${PAGESPEED_API_BASE}?${params.toString()}`);

    if (!response.ok) {
      const error = await response.text();
      logger.error({ status: response.status, error, url }, 'PageSpeed API error');
      throw new Error(`PageSpeed API error: ${response.status}`);
    }

    const data = await response.json() as PageSpeedResponse;

    // Extract field data (real user metrics) if available
    const fieldMetrics = data.loadingExperience?.metrics || {};
    
    // Extract lab data from Lighthouse
    const audits = data.lighthouseResult?.audits || {};
    const categories = data.lighthouseResult?.categories || {};

    const result: WebVitalsResult = {
      url: data.lighthouseResult?.finalUrl || url,
      strategy,
      fetchTime: data.lighthouseResult?.fetchTime || new Date().toISOString(),
      
      // Core Web Vitals from field data
      lcp: fieldMetrics.LARGEST_CONTENTFUL_PAINT_MS?.percentile || 
           audits['largest-contentful-paint']?.numericValue || null,
      lcpScore: mapCategory(fieldMetrics.LARGEST_CONTENTFUL_PAINT_MS?.category),
      
      inp: fieldMetrics.INTERACTION_TO_NEXT_PAINT?.percentile || null,
      inpScore: mapCategory(fieldMetrics.INTERACTION_TO_NEXT_PAINT?.category),
      
      cls: fieldMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile 
           ? fieldMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100 
           : audits['cumulative-layout-shift']?.numericValue || null,
      clsScore: mapCategory(fieldMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE?.category),
      
      // Additional metrics from lab data
      fcp: fieldMetrics.FIRST_CONTENTFUL_PAINT_MS?.percentile ||
           audits['first-contentful-paint']?.numericValue || null,
      ttfb: fieldMetrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE?.percentile ||
            audits['server-response-time']?.numericValue || null,
      speedIndex: audits['speed-index']?.numericValue || null,
      totalBlockingTime: audits['total-blocking-time']?.numericValue || null,
      
      // Lighthouse scores (0-1 -> 0-100)
      performanceScore: categories.performance?.score != null 
        ? Math.round(categories.performance.score * 100) 
        : null,
      accessibilityScore: categories.accessibility?.score != null
        ? Math.round(categories.accessibility.score * 100)
        : null,
      bestPracticesScore: categories['best-practices']?.score != null
        ? Math.round(categories['best-practices'].score * 100)
        : null,
      seoScore: categories.seo?.score != null
        ? Math.round(categories.seo.score * 100)
        : null,
    };

    if (includeRawData) {
      result.rawData = data;
    }

    logger.info({
      url,
      strategy,
      performanceScore: result.performanceScore,
      lcp: result.lcp,
      cls: result.cls,
    }, 'PageSpeed Insights fetched');

    return result;
  } catch (err) {
    logger.error({ error: err, url, strategy }, 'Failed to fetch PageSpeed Insights');
    throw err;
  }
}

/**
 * Fetch PageSpeed for both mobile and desktop
 */
export async function getPageSpeedBoth(
  url: string,
  includeRawData: boolean = false
): Promise<{ mobile: WebVitalsResult; desktop: WebVitalsResult }> {
  const [mobile, desktop] = await Promise.all([
    getPageSpeedInsights(url, 'mobile', includeRawData),
    getPageSpeedInsights(url, 'desktop', includeRawData),
  ]);

  return { mobile, desktop };
}

/**
 * Batch fetch PageSpeed for multiple URLs
 */
export async function getPageSpeedBatch(
  urls: string[],
  strategy: 'mobile' | 'desktop' = 'mobile',
  concurrency: number = 3
): Promise<Map<string, WebVitalsResult>> {
  const results = new Map<string, WebVitalsResult>();
  
  // Process in batches to avoid rate limiting
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(url => getPageSpeedInsights(url, strategy))
    );
    
    batchResults.forEach((result, idx) => {
      const url = batch[idx];
      if (result.status === 'fulfilled') {
        results.set(url, result.value);
      } else {
        logger.error({ url, error: result.reason }, 'Failed to fetch PageSpeed for URL');
        results.set(url, createEmptyResult(url, strategy));
      }
    });
    
    // Small delay between batches to respect rate limits
    if (i + concurrency < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

/**
 * Get a summary of web vitals status
 */
export function getVitalsSummary(result: WebVitalsResult): {
  overall: 'GOOD' | 'NEEDS_IMPROVEMENT' | 'POOR';
  passedVitals: number;
  totalVitals: number;
} {
  const scores = [result.lcpScore, result.inpScore, result.clsScore].filter(Boolean);
  const goodCount = scores.filter(s => s === 'GOOD').length;
  const poorCount = scores.filter(s => s === 'POOR').length;
  
  let overall: 'GOOD' | 'NEEDS_IMPROVEMENT' | 'POOR';
  if (poorCount > 0) {
    overall = 'POOR';
  } else if (goodCount === scores.length && scores.length > 0) {
    overall = 'GOOD';
  } else {
    overall = 'NEEDS_IMPROVEMENT';
  }
  
  return {
    overall,
    passedVitals: goodCount,
    totalVitals: scores.length,
  };
}

/**
 * Create empty result for error cases
 */
function createEmptyResult(url: string, strategy: 'mobile' | 'desktop'): WebVitalsResult {
  return {
    url,
    strategy,
    fetchTime: new Date().toISOString(),
    lcp: null,
    lcpScore: null,
    inp: null,
    inpScore: null,
    cls: null,
    clsScore: null,
    fcp: null,
    ttfb: null,
    speedIndex: null,
    totalBlockingTime: null,
    performanceScore: null,
    accessibilityScore: null,
    bestPracticesScore: null,
    seoScore: null,
  };
}




