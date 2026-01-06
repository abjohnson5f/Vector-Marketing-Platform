#!/usr/bin/env npx tsx
/**
 * Batch URL Submission Script
 * 
 * This script submits all URLs from the sitemap to Google's Indexing API
 * for immediate crawling. Run this after deploying new pages.
 * 
 * Usage:
 *   npx tsx scripts/submit-for-indexing.ts
 * 
 * Prerequisites:
 *   - GOOGLE_SERVICE_ACCOUNT_KEY env var must be set
 *   - Service account must have Indexing API access
 *   - Service account email must be added as owner in Search Console
 */

import 'dotenv/config';
import { google } from 'googleapis';

const SITE_URL = 'https://stiltnerlandscapes.com';

// All URLs to submit for indexing
const URLS_TO_INDEX = [
  // High Priority - Core Pages
  `${SITE_URL}/`,
  `${SITE_URL}/services`,
  `${SITE_URL}/contact`,
  `${SITE_URL}/free-quote`,
  
  // Service Pages
  `${SITE_URL}/services/landscape-design`,
  `${SITE_URL}/services/hardscaping`,
  `${SITE_URL}/services/lawn-care`,
  `${SITE_URL}/services/irrigation`,
  `${SITE_URL}/services/outdoor-lighting`,
  `${SITE_URL}/services/tree-services`,
  
  // Content Pages
  `${SITE_URL}/about`,
  `${SITE_URL}/portfolio`,
  `${SITE_URL}/gallery`,
  `${SITE_URL}/blog`,
  `${SITE_URL}/reviews`,
  `${SITE_URL}/service-areas`,
  `${SITE_URL}/faq`,
  `${SITE_URL}/estimate`,
  
  // Legal (lower priority but still submit)
  `${SITE_URL}/privacy-policy`,
  `${SITE_URL}/terms`,
];

async function main() {
  console.log('🚀 Starting batch URL submission to Google Indexing API\n');

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.error('❌ GOOGLE_SERVICE_ACCOUNT_KEY environment variable not set');
    console.log('\nTo set up:');
    console.log('1. Go to Google Cloud Console > APIs & Services > Credentials');
    console.log('2. Create a Service Account');
    console.log('3. Enable the Indexing API');
    console.log('4. Download the JSON key and set as GOOGLE_SERVICE_ACCOUNT_KEY env var');
    console.log('5. Add the service account email as Owner in Search Console');
    process.exit(1);
  }

  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  
  console.log(`📧 Using service account: ${credentials.client_email}\n`);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/indexing'],
  });

  const indexing = google.indexing({ version: 'v3', auth });

  console.log(`📋 Submitting ${URLS_TO_INDEX.length} URLs for indexing...\n`);

  let successful = 0;
  let failed = 0;

  for (const url of URLS_TO_INDEX) {
    try {
      const response = await indexing.urlNotifications.publish({
        requestBody: {
          url,
          type: 'URL_UPDATED',
        },
      });

      const notifyTime = response.data.urlNotificationMetadata?.latestUpdate?.notifyTime;
      console.log(`✅ ${url}`);
      console.log(`   Notify time: ${notifyTime}`);
      successful++;

      // Rate limit: Google allows 200 requests per day, ~180/minute
      // Adding small delay to be safe
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error: any) {
      console.log(`❌ ${url}`);
      console.log(`   Error: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Results: ${successful} successful, ${failed} failed`);
  console.log('='.repeat(50));

  // Also submit the sitemap
  console.log('\n📄 Submitting sitemap to Search Console...');
  
  try {
    const searchconsoleAuth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/webmasters'],
    });

    const searchconsole = google.searchconsole({ version: 'v1', auth: searchconsoleAuth });
    
    await searchconsole.sitemaps.submit({
      siteUrl: SITE_URL,
      feedpath: `${SITE_URL}/sitemap.xml`,
    });
    
    console.log('✅ Sitemap submitted successfully');
  } catch (error: any) {
    console.log(`⚠️  Sitemap submission failed: ${error.message}`);
    console.log('   You may need to submit it manually in Search Console');
  }

  console.log('\n🎉 Done! URLs should start appearing in Google within hours.');
  console.log('\nNext steps:');
  console.log('1. Check Search Console in 1-2 hours for indexing status');
  console.log('2. Use "URL Inspection" tool in Search Console to verify');
  console.log('3. Request indexing manually for any failed URLs');
}

main().catch(console.error);

