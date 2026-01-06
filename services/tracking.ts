/**
 * Tracking Service - GTM/GA4/Google Ads Integration
 * 
 * This service provides a type-safe interface for pushing events to the dataLayer.
 * All tracking events are sent to GTM, which forwards them to GA4 and Google Ads.
 * 
 * GTM Configuration Required:
 * 1. GA4 Config tag with your GA4 Measurement ID
 * 2. GA4 Event tag for 'lead_submit' event
 * 3. Ads Conversion tag for lead form (Conversion ID/Label)
 * 4. Consent Mode v2 enabled
 * 5. Enhanced Conversions mapping (email, phone when available)
 * 
 * Server-side GTM (optional):
 * Set GTM transport URL to your sGTM endpoint (e.g., https://sgtm.yourdomain.com)
 */

// Extend Window interface for dataLayer
declare global {
  interface Window {
    dataLayer: DataLayerObject[];
    gtag: (...args: unknown[]) => void;
  }
}

// DataLayer object types
interface DataLayerObject {
  event?: string;
  [key: string]: unknown;
}

// Tracking event types
export interface LeadSubmitEvent {
  lead_type: 'form' | 'phone' | 'chat' | 'callback';
  email?: string;
  phone?: string;
  name?: string;
  source?: string;
  campaign?: string;
  value?: number;
}

export interface PageViewEvent {
  page_title: string;
  page_location: string;
  page_path: string;
}

export interface ConversionEvent {
  conversion_type: string;
  value?: number;
  currency?: string;
  transaction_id?: string;
}

export interface UserInteractionEvent {
  action: string;
  category: string;
  label?: string;
  value?: number;
}

/**
 * Initialize the dataLayer if not already present
 */
function ensureDataLayer(): void {
  window.dataLayer = window.dataLayer || [];
}

/**
 * Push an event to the dataLayer
 */
function pushToDataLayer(data: DataLayerObject): void {
  ensureDataLayer();
  window.dataLayer.push(data);
}

/**
 * Hash a value using SHA-256 (for Enhanced Conversions)
 * Note: In production, this should be done server-side
 */
async function hashValue(value: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(value.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Track a lead submission event
 * This should be called after a successful form submission
 */
export async function trackLeadSubmit(event: LeadSubmitEvent): Promise<void> {
  const enhancedData: Record<string, unknown> = {
    event: 'lead_submit',
    lead_type: event.lead_type,
    source: event.source,
    campaign: event.campaign,
    value: event.value,
  };

  // Add hashed PII for Enhanced Conversions (if available)
  if (event.email) {
    enhancedData.user_email_sha256 = await hashValue(event.email);
    // Also include plain email for GTM to hash (as fallback)
    enhancedData.email = event.email;
  }
  
  if (event.phone) {
    // Normalize phone: remove spaces, dashes, add country code if missing
    const normalizedPhone = event.phone.replace(/[\s\-\(\)]/g, '');
    enhancedData.user_phone_sha256 = await hashValue(normalizedPhone);
    enhancedData.phone = event.phone;
  }
  
  if (event.name) {
    enhancedData.name = event.name;
  }

  pushToDataLayer(enhancedData);
  
  console.debug('[Tracking] lead_submit event pushed:', enhancedData);
}

/**
 * Track a page view
 * Note: GA4 typically handles this automatically, but use for SPAs
 */
export function trackPageView(event: PageViewEvent): void {
  pushToDataLayer({
    event: 'page_view',
    page_title: event.page_title,
    page_location: event.page_location,
    page_path: event.page_path,
  });
  
  console.debug('[Tracking] page_view event pushed:', event);
}

/**
 * Track a custom conversion event
 */
export function trackConversion(event: ConversionEvent): void {
  pushToDataLayer({
    event: 'conversion',
    conversion_type: event.conversion_type,
    value: event.value,
    currency: event.currency || 'USD',
    transaction_id: event.transaction_id,
  });
  
  console.debug('[Tracking] conversion event pushed:', event);
}

/**
 * Track user interactions (clicks, engagements, etc.)
 */
export function trackInteraction(event: UserInteractionEvent): void {
  pushToDataLayer({
    event: 'user_interaction',
    action: event.action,
    category: event.category,
    label: event.label,
    value: event.value,
  });
  
  console.debug('[Tracking] user_interaction event pushed:', event);
}

/**
 * Track dashboard view changes
 */
export function trackViewChange(viewName: string, previousView?: string): void {
  pushToDataLayer({
    event: 'view_change',
    view_name: viewName,
    previous_view: previousView,
  });
}

/**
 * Track campaign detail view
 */
export function trackCampaignView(campaignId: string, campaignName: string, platform: string): void {
  pushToDataLayer({
    event: 'campaign_view',
    campaign_id: campaignId,
    campaign_name: campaignName,
    platform: platform,
  });
}

/**
 * Track AI interaction
 */
export function trackAIInteraction(query: string, responseLength: number): void {
  pushToDataLayer({
    event: 'ai_interaction',
    query_length: query.length,
    response_length: responseLength,
  });
}

/**
 * Update consent state
 * Call this when user accepts/denies cookies
 */
export function updateConsent(
  analyticsConsent: boolean,
  adsConsent: boolean
): void {
  if (typeof window.gtag === 'function') {
    window.gtag('consent', 'update', {
      'ad_storage': adsConsent ? 'granted' : 'denied',
      'ad_user_data': adsConsent ? 'granted' : 'denied',
      'ad_personalization': adsConsent ? 'granted' : 'denied',
      'analytics_storage': analyticsConsent ? 'granted' : 'denied',
    });
  }
  
  pushToDataLayer({
    event: 'consent_update',
    analytics_consent: analyticsConsent,
    ads_consent: adsConsent,
  });
  
  console.debug('[Tracking] consent updated:', { analyticsConsent, adsConsent });
}

/**
 * Set user properties for GA4
 */
export function setUserProperties(properties: Record<string, string | number | boolean>): void {
  pushToDataLayer({
    event: 'user_properties_set',
    user_properties: properties,
  });
}

/**
 * Track errors
 */
export function trackError(errorType: string, errorMessage: string, errorStack?: string): void {
  pushToDataLayer({
    event: 'error',
    error_type: errorType,
    error_message: errorMessage,
    error_stack: errorStack,
  });
}

// Export utility for checking if tracking is enabled
export function isTrackingEnabled(): boolean {
  return typeof window !== 'undefined' && Array.isArray(window.dataLayer);
}




