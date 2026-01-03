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
  
  if (error) {
    logger.error({ error }, 'Google OAuth error');
    return c.redirect('/?error=google_auth_failed');
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
    
    await db.insert(integrations).values({
      platform: 'google_ads',
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
    
    logger.info({ email: userInfo.email }, 'Google OAuth connected');
    
    // Redirect to frontend with success
    return c.redirect('/?connected=google');
    
  } catch (err) {
    logger.error({ error: err }, 'Google OAuth callback failed');
    if (err instanceof IntegrationError) throw err;
    throw new IntegrationError('Google authentication failed', 'google');
  }
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
    return c.redirect('/?error=meta_auth_failed');
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
    
    return c.redirect('/?connected=meta');
    
  } catch (err) {
    logger.error({ error: err }, 'Meta OAuth callback failed');
    if (err instanceof IntegrationError) throw err;
    throw new IntegrationError('Meta authentication failed', 'meta');
  }
});

// ============== Disconnect ==============

auth.delete('/:platform', async (c) => {
  const platform = c.req.param('platform');
  
  if (!['google', 'meta', 'ga4'].includes(platform)) {
    throw new ValidationError('Invalid platform');
  }
  
  const platformMap: Record<string, 'google_ads' | 'meta_ads' | 'ga4'> = {
    google: 'google_ads',
    meta: 'meta_ads',
    ga4: 'ga4',
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

