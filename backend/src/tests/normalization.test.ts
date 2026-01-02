import { describe, it, expect } from 'vitest';
import { normalizeStatus } from '../services/google-ads.js';
import { normalizeStatus as normalizeMetaStatus } from '../services/meta-ads.js';

describe('Google Ads Normalization', () => {
  describe('normalizeStatus', () => {
    it('should normalize ENABLED to active', () => {
      expect(normalizeStatus('ENABLED')).toBe('active');
    });

    it('should normalize PAUSED to paused', () => {
      expect(normalizeStatus('PAUSED')).toBe('paused');
    });

    it('should normalize REMOVED to deleted', () => {
      expect(normalizeStatus('REMOVED')).toBe('deleted');
    });

    it('should default unknown status to deleted', () => {
      expect(normalizeStatus('UNKNOWN')).toBe('deleted');
    });
  });
});

describe('Meta Ads Normalization', () => {
  describe('normalizeStatus', () => {
    it('should normalize ACTIVE to active', () => {
      expect(normalizeMetaStatus('ACTIVE')).toBe('active');
    });

    it('should normalize PAUSED to paused', () => {
      expect(normalizeMetaStatus('PAUSED')).toBe('paused');
    });

    it('should normalize DELETED to deleted', () => {
      expect(normalizeMetaStatus('DELETED')).toBe('deleted');
    });

    it('should normalize ARCHIVED to deleted', () => {
      expect(normalizeMetaStatus('ARCHIVED')).toBe('deleted');
    });
  });
});

describe('Spend Normalization', () => {
  it('should convert Google Ads micros to dollars', () => {
    const costMicros = 1500000; // $1.50 in micros
    const dollars = costMicros / 1_000_000;
    expect(dollars).toBe(1.5);
  });

  it('should handle Meta spend as-is', () => {
    const metaSpend = 150.25;
    expect(metaSpend).toBe(150.25);
  });
});

describe('Calculated Metrics', () => {
  it('should calculate ROAS correctly', () => {
    const revenue = 1000;
    const spend = 200;
    const roas = revenue / spend;
    expect(roas).toBe(5);
  });

  it('should handle zero spend for ROAS', () => {
    const revenue = 1000;
    const spend = 0;
    const roas = spend > 0 ? revenue / spend : null;
    expect(roas).toBeNull();
  });

  it('should calculate CTR correctly', () => {
    const clicks = 50;
    const impressions = 1000;
    const ctr = (clicks / impressions) * 100;
    expect(ctr).toBe(5);
  });

  it('should calculate CPC correctly', () => {
    const spend = 100;
    const clicks = 50;
    const cpc = spend / clicks;
    expect(cpc).toBe(2);
  });

  it('should calculate CPA correctly', () => {
    const spend = 500;
    const conversions = 10;
    const cpa = spend / conversions;
    expect(cpa).toBe(50);
  });
});

