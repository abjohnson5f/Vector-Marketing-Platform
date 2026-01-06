import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { env } from '../config/env.js';
import { db, integrations } from '../db/index.js';
import { encryptToken } from '../lib/crypto.js';
import { ValidationError, IntegrationError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { eq } from 'drizzle-orm';

const auth = new Hono();

// Google OAuth scopes
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/adwords',
  'https://www.googleapis.com/auth/analytics.readonly',
  'openid',
  'email',
  'profile',
].join(' ');

// Google Search Console + Indexing API scopes (for SEO features)
const GOOGLE_SEARCH_CONSOLE_SCOPES = [
  'https://www.googleapis.com/auth/indexing',           // Submit URLs for indexing
  'https://www.googleapis.com/auth/webmasters',         // Search Console full access
  'https://www.googleapis.com/auth/webmasters.readonly', // Search Console read
  'openid',
  'email',
  'profile',
].join(' ');

// Meta OAuth scopes
const META_SCOPES = [
  'ads_read',
  'ads_management',
  'business_management',
].join(',');

// ============== Google OAuth ==============

auth.get('/google', async (c) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI) {
    throw new ValidationError('Google OAuth is not configured');
  }
  
  const state = nanoid();
  // In production, store state in session/cookie for CSRF protection
  
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', env.GOOGLE_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', GOOGLE_SCOPES);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);
  
  return c.redirect(authUrl.toString());
});

auth.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const error = c.req.query('error');
  const state = c.req.query('state') || '';
  
  // Check if this is a Search Console OAuth flow
  const isSearchConsole = state.startsWith('sc_');
  
  if (error) {
    logger.error({ error, isSearchConsole }, 'Google OAuth error');
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Failed</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #ff6b6b 0%, #c44569 100%); }
            .card { background: white; padding: 3rem; border-radius: 1rem; box-shadow: 0 20px 40px rgba(0,0,0,0.2); text-align: center; max-width: 400px; }
            .icon { font-size: 4rem; margin-bottom: 1rem; }
            h1 { color: #1a1a2e; margin: 0 0 0.5rem; }
            p { color: #666; margin: 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">❌</div>
            <h1>Connection Failed</h1>
            <p>${isSearchConsole ? 'Search Console' : 'Google'} authentication was cancelled or failed. Please try again.</p>
          </div>
        </body>
      </html>
    `, 400);
  }
  
  if (!code) {
    throw new ValidationError('Missing authorization code');
  }
  
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    throw new ValidationError('Google OAuth is not configured');
  }
  
  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      logger.error({ error: errorData }, 'Google token exchange failed');
      throw new IntegrationError('Failed to exchange authorization code', 'google');
    }
    
    const tokens = await tokenResponse.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
    };
    
    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    
    const userInfo = await userResponse.json() as { email: string; name?: string };
    
    // Store integration
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const platform = isSearchConsole ? 'search_console' : 'google_ads';
    
    await db.insert(integrations).values({
      platform,
      accountId: userInfo.email,
      accountName: userInfo.name || userInfo.email,
      status: 'connected',
      accessToken: encryptToken(tokens.access_token),
      refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      accessTokenExpiresAt: expiresAt,
    }).onConflictDoUpdate({
      target: [integrations.platform, integrations.accountId],
      set: {
        status: 'connected',
        accessToken: encryptToken(tokens.access_token),
        refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : undefined,
        accessTokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      },
    });
    
    logger.info({ email: userInfo.email, platform }, 'Google OAuth connected');
    
    // Return success page based on flow type
    if (isSearchConsole) {
      return c.html(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Search Console Connected</title>
            <style>
              body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #34d399 0%, #059669 100%); }
              .card { background: white; padding: 3rem; border-radius: 1rem; box-shadow: 0 20px 40px rgba(0,0,0,0.2); text-align: center; max-width: 400px; }
              .icon { font-size: 4rem; margin-bottom: 1rem; }
              h1 { color: #1a1a2e; margin: 0 0 0.5rem; }
              p { color: #666; margin: 0; }
              .account { background: #f0f4f8; padding: 0.75rem 1rem; border-radius: 0.5rem; margin-top: 1.5rem; font-size: 0.9rem; color: #333; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon">✅</div>
              <h1>Search Console Connected!</h1>
              <p>You can now submit URLs for instant Google indexing.</p>
              <div class="account">${userInfo.email}</div>
              <p style="margin-top: 1rem; font-size: 0.9rem; color: #666;">You can close this window.</p>
            </div>
          </body>
        </html>
      `);
    }
    
    // Return success page for Google Ads
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Google Connected</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
            .card { background: white; padding: 3rem; border-radius: 1rem; box-shadow: 0 20px 40px rgba(0,0,0,0.2); text-align: center; max-width: 400px; }
            .icon { font-size: 4rem; margin-bottom: 1rem; }
            h1 { color: #1a1a2e; margin: 0 0 0.5rem; }
            p { color: #666; margin: 0; }
            .account { background: #f0f4f8; padding: 0.75rem 1rem; border-radius: 0.5rem; margin-top: 1.5rem; font-size: 0.9rem; color: #333; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">✅</div>
            <h1>Google Connected!</h1>
            <p>Your Google Ads account has been linked successfully.</p>
            <div class="account">${userInfo.name || userInfo.email}</div>
          </div>
        </body>
      </html>
    `);
    
  } catch (err) {
    logger.error({ error: err }, 'Google OAuth callback failed');
    if (err instanceof IntegrationError) throw err;
    throw new IntegrationError('Google authentication failed', 'google');
  }
});

// ============== Google Search Console OAuth (for Indexing API) ==============

auth.get('/google/search-console', async (c) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI) {
    throw new ValidationError('Google OAuth is not configured');
  }
  
  // Use same callback URI but with special state to identify this flow
  const state = 'sc_' + nanoid();
  
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', env.GOOGLE_REDIRECT_URI); // Same redirect URI
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', GOOGLE_SEARCH_CONSOLE_SCOPES);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);
  
  return c.redirect(authUrl.toString());
});

// ============== Meta OAuth ==============

auth.get('/meta', async (c) => {
  if (!env.META_APP_ID || !env.META_REDIRECT_URI) {
    throw new ValidationError('Meta OAuth is not configured');
  }
  
  const state = nanoid();
  
  const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
  authUrl.searchParams.set('client_id', env.META_APP_ID);
  authUrl.searchParams.set('redirect_uri', env.META_REDIRECT_URI);
  authUrl.searchParams.set('scope', META_SCOPES);
  authUrl.searchParams.set('state', state);
  
  return c.redirect(authUrl.toString());
});

auth.get('/meta/callback', async (c) => {
  const code = c.req.query('code');
  const error = c.req.query('error');
  
  if (error) {
    logger.error({ error }, 'Meta OAuth error');
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Failed</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #ff6b6b 0%, #c44569 100%); }
            .card { background: white; padding: 3rem; border-radius: 1rem; box-shadow: 0 20px 40px rgba(0,0,0,0.2); text-align: center; max-width: 400px; }
            .icon { font-size: 4rem; margin-bottom: 1rem; }
            h1 { color: #1a1a2e; margin: 0 0 0.5rem; }
            p { color: #666; margin: 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">❌</div>
            <h1>Connection Failed</h1>
            <p>Meta authentication was cancelled or failed. Please try again.</p>
          </div>
        </body>
      </html>
    `, 400);
  }
  
  if (!code) {
    throw new ValidationError('Missing authorization code');
  }
  
  if (!env.META_APP_ID || !env.META_APP_SECRET || !env.META_REDIRECT_URI) {
    throw new ValidationError('Meta OAuth is not configured');
  }
  
  try {
    // Exchange code for access token
    const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', env.META_APP_ID);
    tokenUrl.searchParams.set('client_secret', env.META_APP_SECRET);
    tokenUrl.searchParams.set('redirect_uri', env.META_REDIRECT_URI);
    tokenUrl.searchParams.set('code', code);
    
    const tokenResponse = await fetch(tokenUrl.toString());
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      logger.error({ error: errorData }, 'Meta token exchange failed');
      throw new IntegrationError('Failed to exchange authorization code', 'meta');
    }
    
    const tokens = await tokenResponse.json() as {
      access_token: string;
      token_type: string;
      expires_in?: number;
    };
    
    // Exchange for long-lived token
    const longLivedUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longLivedUrl.searchParams.set('client_id', env.META_APP_ID);
    longLivedUrl.searchParams.set('client_secret', env.META_APP_SECRET);
    longLivedUrl.searchParams.set('fb_exchange_token', tokens.access_token);
    
    const longLivedResponse = await fetch(longLivedUrl.toString());
    const longLivedTokens = await longLivedResponse.json() as {
      access_token: string;
      expires_in?: number;
    };
    
    // Get user info
    const userResponse = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${longLivedTokens.access_token}`
    );
    const userInfo = await userResponse.json() as { id: string; name: string };
    
    // Store integration
    const expiresAt = longLivedTokens.expires_in 
      ? new Date(Date.now() + longLivedTokens.expires_in * 1000)
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days default
    
    await db.insert(integrations).values({
      platform: 'meta_ads',
      accountId: userInfo.id,
      accountName: userInfo.name,
      status: 'connected',
      accessToken: encryptToken(longLivedTokens.access_token),
      refreshToken: null,
      accessTokenExpiresAt: expiresAt,
    }).onConflictDoUpdate({
      target: [integrations.platform, integrations.accountId],
      set: {
        status: 'connected',
        accessToken: encryptToken(longLivedTokens.access_token),
        accessTokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      },
    });
    
    logger.info({ userId: userInfo.id, name: userInfo.name }, 'Meta OAuth connected');
    
    // Return success page (no frontend deployed yet)
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Meta Connected</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
            .card { background: white; padding: 3rem; border-radius: 1rem; box-shadow: 0 20px 40px rgba(0,0,0,0.2); text-align: center; max-width: 400px; }
            .icon { font-size: 4rem; margin-bottom: 1rem; }
            h1 { color: #1a1a2e; margin: 0 0 0.5rem; }
            p { color: #666; margin: 0; }
            .account { background: #f0f4f8; padding: 0.75rem 1rem; border-radius: 0.5rem; margin-top: 1.5rem; font-size: 0.9rem; color: #333; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">✅</div>
            <h1>Meta Connected!</h1>
            <p>Your Meta Ads account has been linked successfully.</p>
            <div class="account">${userInfo.name}</div>
          </div>
        </body>
      </html>
    `);
    
  } catch (err) {
    logger.error({ error: err }, 'Meta OAuth callback failed');
    if (err instanceof IntegrationError) throw err;
    throw new IntegrationError('Meta authentication failed', 'meta');
  }
});

// ============== Disconnect ==============

auth.delete('/:platform', async (c) => {
  const platform = c.req.param('platform');
  
  if (!['google', 'meta', 'ga4', 'search_console'].includes(platform)) {
    throw new ValidationError('Invalid platform');
  }
  
  const platformMap: Record<string, string> = {
    google: 'google_ads',
    meta: 'meta_ads',
    ga4: 'ga4',
    search_console: 'search_console',
  };
  
  await db.update(integrations)
    .set({ 
      status: 'disconnected',
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(integrations.platform, platformMap[platform]));
  
  logger.info({ platform }, 'Integration disconnected');
  
  return c.json({ success: true });
});

export default auth;

