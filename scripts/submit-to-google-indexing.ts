#!/usr/bin/env npx tsx
/**
 * Google Indexing API Submission Script
 * 
 * This script uses OAuth to authenticate and submit URLs to Google's Indexing API.
 * More secure than service account keys - uses your Google account credentials.
 * 
 * Usage: npx tsx scripts/submit-to-google-indexing.ts
 */

import http from 'http';
import open from 'open';
import { URL } from 'url';

// Configuration - from your .env
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_PORT = 3456;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

// Scopes needed for Indexing API
const SCOPES = [
  'https://www.googleapis.com/auth/indexing',
  'https://www.googleapis.com/auth/webmasters',
].join(' ');

// URLs to submit for indexing
const URLS_TO_INDEX = [
  'https://stiltnerlandscapes.com/',
  'https://stiltnerlandscapes.com/services',
  'https://stiltnerlandscapes.com/contact',
  'https://stiltnerlandscapes.com/free-quote',
  'https://stiltnerlandscapes.com/services/landscape-design',
  'https://stiltnerlandscapes.com/services/hardscaping',
  'https://stiltnerlandscapes.com/services/lawn-care',
  'https://stiltnerlandscapes.com/services/irrigation',
  'https://stiltnerlandscapes.com/services/outdoor-lighting',
  'https://stiltnerlandscapes.com/services/tree-services',
  'https://stiltnerlandscapes.com/about',
  'https://stiltnerlandscapes.com/portfolio',
  'https://stiltnerlandscapes.com/gallery',
  'https://stiltnerlandscapes.com/blog',
  'https://stiltnerlandscapes.com/reviews',
  'https://stiltnerlandscapes.com/service-areas',
  'https://stiltnerlandscapes.com/faq',
  'https://stiltnerlandscapes.com/estimate',
];

async function getAuthCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url!, `http://localhost:${REDIRECT_PORT}`);
      
      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        
        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>❌ Authentication Failed</h1><p>Please try again.</p>');
          server.close();
          reject(new Error(error));
          return;
        }
        
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #34d399 0%, #059669 100%);">
                <div style="background: white; padding: 3rem; border-radius: 1rem; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
                  <h1 style="font-size: 3rem; margin: 0;">✅</h1>
                  <h2>Authentication Successful!</h2>
                  <p>You can close this window. URLs are being submitted...</p>
                </div>
              </body>
            </html>
          `);
          server.close();
          resolve(code);
        }
      }
    });
    
    server.listen(REDIRECT_PORT, () => {
      console.log(`\n🔐 Opening browser for authentication...\n`);
      
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', SCOPES);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      
      open(authUrl.toString());
    });
    
    // Timeout after 2 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authentication timed out'));
    }, 120000);
  });
}

async function exchangeCodeForTokens(code: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }
  
  const tokens = await response.json() as { access_token: string };
  return tokens.access_token;
}

async function submitUrlForIndexing(url: string, accessToken: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        type: 'URL_UPDATED',
      }),
    });
    
    if (!response.ok) {
      const error = await response.json() as { error?: { message?: string } };
      return { success: false, error: error.error?.message || `HTTP ${response.status}` };
    }
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       Google Indexing API - URL Submission Tool            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  // Check configuration
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error('❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
    console.error('   Please set these in your environment or .env file');
    process.exit(1);
  }
  
  console.log(`📋 ${URLS_TO_INDEX.length} URLs queued for submission\n`);
  
  try {
    // Step 1: Get authorization code via browser
    const code = await getAuthCode();
    console.log('✅ Authorization received\n');
    
    // Step 2: Exchange for access token
    console.log('🔄 Exchanging for access token...');
    const accessToken = await exchangeCodeForTokens(code);
    console.log('✅ Access token obtained\n');
    
    // Step 3: Submit URLs
    console.log('📤 Submitting URLs to Google Indexing API...\n');
    
    let successful = 0;
    let failed = 0;
    
    for (const url of URLS_TO_INDEX) {
      const result = await submitUrlForIndexing(url, accessToken);
      
      if (result.success) {
        console.log(`  ✅ ${url}`);
        successful++;
      } else {
        console.log(`  ❌ ${url} - ${result.error}`);
        failed++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log(`║  RESULTS: ${successful} successful, ${failed} failed`.padEnd(61) + '║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    if (successful > 0) {
      console.log('🎉 URLs submitted! Google will typically index them within hours.');
      console.log('   Check Google Search Console for indexing status.');
    }
    
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();

