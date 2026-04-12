/**
 * Direct TOS (Volcengine Object Storage) upload.
 *
 * On iOS native: uses the NativeHttpUpload Capacitor plugin to send binary
 * data through URLSession, completely bypassing CapacitorHttp's fetch patch
 * which cannot handle ArrayBuffer bodies.
 *
 * On web: uses plain fetch (no CapacitorHttp interference).
 *
 * Signing uses TOS V4 (HMAC-SHA256) via Web Crypto API.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

const TOS_AK = import.meta.env.VITE_TOS_ACCESS_KEY_ID ?? '';
const TOS_SK = import.meta.env.VITE_TOS_SECRET_ACCESS_KEY ?? '';
const TOS_REGION = import.meta.env.VITE_TOS_REGION ?? 'cn-beijing';
const TOS_BUCKET = import.meta.env.VITE_TOS_BUCKET ?? '';
const TOS_ENDPOINT = import.meta.env.VITE_TOS_ENDPOINT ?? `tos-${TOS_REGION}.volces.com`;

// ---------------------------------------------------------------------------
// Native upload plugin (bypasses CapacitorHttp for binary bodies)
// ---------------------------------------------------------------------------

interface NativeHttpUploadPlugin {
  upload(options: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: string; // base64
  }): Promise<{ status: number; data: string }>;
}

const NativeUpload = registerPlugin<NativeHttpUploadPlugin>('NativeHttpUpload');

export function isTOSAvailable(): boolean {
  return !!(TOS_AK && TOS_SK && TOS_BUCKET);
}

// ---------------------------------------------------------------------------
// Crypto helpers (Web Crypto API — works in WKWebView)
// ---------------------------------------------------------------------------

function hexEncode(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSHA256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const buf =
    typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return hexEncode(await crypto.subtle.digest('SHA-256', buf));
}

// ---------------------------------------------------------------------------
// TOS V4 Signature (compatible with AWS Signature V4 style)
// ---------------------------------------------------------------------------

function isoDate(): { dateStamp: string; amzDate: string } {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const dateStamp = amzDate.slice(0, 8);
  return { dateStamp, amzDate };
}

async function deriveSigningKey(
  secretKey: string,
  dateStamp: string,
  region: string,
): Promise<ArrayBuffer> {
  let key: ArrayBuffer = await hmacSHA256(
    new TextEncoder().encode(secretKey),
    dateStamp,
  );
  key = await hmacSHA256(key, region);
  key = await hmacSHA256(key, 'tos');
  key = await hmacSHA256(key, 'request');
  return key;
}

async function signTOSRequest(
  method: string,
  host: string,
  path: string,
  contentType: string,
  payloadHash: string,
): Promise<{ url: string; headers: Record<string, string> }> {
  const { dateStamp, amzDate } = isoDate();
  const credentialScope = `${dateStamp}/${TOS_REGION}/tos/request`;
  const credential = `${TOS_AK}/${credentialScope}`;

  const signedHeaderKeys = ['content-type', 'host', 'x-tos-acl', 'x-tos-content-sha256', 'x-tos-date'];
  const signedHeadersStr = signedHeaderKeys.join(';');

  const headers: Record<string, string> = {
    'content-type': contentType,
    host,
    'x-tos-acl': 'public-read',
    'x-tos-content-sha256': payloadHash,
    'x-tos-date': amzDate,
  };

  const canonicalHeaders = signedHeaderKeys
    .map((k) => `${k}:${headers[k]}`)
    .join('\n');

  const encodedPath = '/' + path.split('/').map(encodeURIComponent).join('/');

  const canonicalRequest = [
    method,
    encodedPath,
    '',
    canonicalHeaders,
    '',
    signedHeadersStr,
    payloadHash,
  ].join('\n');

  const canonicalRequestHash = await sha256Hex(canonicalRequest);

  const stringToSign = [
    'TOS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join('\n');

  const signingKey = await deriveSigningKey(TOS_SK, dateStamp, TOS_REGION);
  const signature = hexEncode(await hmacSHA256(signingKey, stringToSign));

  const authorization =
    `TOS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`;

  return {
    url: `https://${host}${encodedPath}`,
    headers: {
      Authorization: authorization,
      'Content-Type': contentType,
      'x-tos-acl': 'public-read',
      'x-tos-content-sha256': payloadHash,
      'x-tos-date': amzDate,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function uploadToTOS(wavBlob: Blob): Promise<string> {
  if (!TOS_AK || !TOS_SK || !TOS_BUCKET) {
    throw new Error('TOS 未配置。请设置 VITE_TOS_ACCESS_KEY_ID / SECRET / BUCKET 环境变量。');
  }

  const key = `recordings/recording-${crypto.randomUUID()}.wav`;
  const host = `${TOS_BUCKET}.${TOS_ENDPOINT}`;
  const contentType = 'audio/wav';

  const arrayBuf = await wavBlob.arrayBuffer();
  const payloadHash = await sha256Hex(arrayBuf);

  console.log(`[TOS] Uploading ${(arrayBuf.byteLength / 1024).toFixed(1)} KB to ${key}`);

  const { url, headers } = await signTOSRequest('PUT', host, key, contentType, payloadHash);

  if (Capacitor.isNativePlatform()) {
    // Use native plugin to bypass CapacitorHttp's broken ArrayBuffer handling
    const base64Body = arrayBufferToBase64(arrayBuf);
    console.log('[TOS] Using native upload plugin');

    const result = await NativeUpload.upload({
      url,
      method: 'PUT',
      headers,
      body: base64Body,
    });

    if (result.status < 200 || result.status >= 300) {
      console.error('[TOS] Native upload failed:', result.status, result.data);
      throw new Error(`TOS upload failed (${result.status}): ${result.data.slice(0, 200)}`);
    }
  } else {
    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: arrayBuf,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[TOS] Upload failed:', res.status, errText);
      throw new Error(`TOS upload failed (${res.status}): ${errText.slice(0, 200)}`);
    }
  }

  const publicUrl = `https://${TOS_BUCKET}.${TOS_ENDPOINT}/${key}`;
  console.log('[TOS] Upload success:', publicUrl);
  return publicUrl;
}
