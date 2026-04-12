/**
 * Google Service Account JWT authentication using Web Crypto API.
 * Works in browser / WKWebView without Node.js dependencies.
 *
 * On iOS native, token exchange uses nativeFetch (URLSession) to bypass
 * CapacitorHttp's broken form-urlencoded body handling.
 */

import { nativeFetch } from '../nativeHttp';

const CLIENT_EMAIL = import.meta.env.VITE_GSHEETS_CLIENT_EMAIL ?? '';
const PRIVATE_KEY_PEM = (import.meta.env.VITE_GSHEETS_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TOKEN_LIFETIME_SEC = 3600;
const REFRESH_MARGIN_SEC = 120;

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

function base64UrlEncode(data: ArrayBuffer | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function createSignedJWT(): Promise<string> {
  if (!CLIENT_EMAIL || !PRIVATE_KEY_PEM) {
    throw new Error('Missing VITE_GSHEETS_CLIENT_EMAIL or VITE_GSHEETS_PRIVATE_KEY');
  }

  console.log('[GSheets Auth] Creating JWT for', CLIENT_EMAIL);

  const keyBuf = pemToArrayBuffer(PRIVATE_KEY_PEM);
  console.log('[GSheets Auth] PEM decoded, byte length:', keyBuf.byteLength);

  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyBuf,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: CLIENT_EMAIL,
      scope: SCOPES,
      aud: TOKEN_URL,
      iat: now,
      exp: now + TOKEN_LIFETIME_SEC,
    }),
  );

  const signInput = new TextEncoder().encode(`${header}.${payload}`);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, signInput);

  console.log('[GSheets Auth] JWT signed successfully');
  return `${header}.${payload}.${base64UrlEncode(signature)}`;
}

export async function getAccessToken(): Promise<string> {
  const now = Date.now() / 1000;
  if (cachedToken && now < tokenExpiresAt - REFRESH_MARGIN_SEC) {
    console.log('[GSheets Auth] Using cached token');
    return cachedToken;
  }

  console.log('[GSheets Auth] Requesting new access token...');
  const jwt = await createSignedJWT();

  const body = `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${encodeURIComponent(jwt)}`;

  const res = await nativeFetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    console.error('[GSheets Auth] Token exchange failed:', res.status, res.data);
    throw new Error(`Google token exchange failed (${res.status}): ${res.data}`);
  }

  const data = JSON.parse(res.data) as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || TOKEN_LIFETIME_SEC);

  console.log('[GSheets Auth] Token obtained, expires in', data.expires_in, 's');
  return cachedToken;
}

export function isDirectSheetsAvailable(): boolean {
  const available = !!CLIENT_EMAIL && !!PRIVATE_KEY_PEM;
  console.log('[GSheets Auth] isDirectSheetsAvailable:', available,
    '| email:', CLIENT_EMAIL ? 'set' : 'MISSING',
    '| key:', PRIVATE_KEY_PEM ? `${PRIVATE_KEY_PEM.length} chars` : 'MISSING');
  return available;
}
