/**
 * Native HTTP helper — bypasses CapacitorHttp's patched fetch on iOS.
 *
 * Uses the NativeHttpUpload Capacitor plugin (URLSession) for all requests
 * on native platforms. Falls back to standard fetch on web.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeHttpPlugin {
  upload(options: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
  }): Promise<{ status: number; data: string }>;
}

const NativeHttp = registerPlugin<NativeHttpPlugin>('NativeHttpUpload');

export interface NativeFetchResponse {
  status: number;
  data: string;
  ok: boolean;
}

function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Perform an HTTP request via the native iOS plugin when running on-device,
 * falling back to standard `fetch` on web.
 *
 * @param body  Pass a **string** body (JSON / form-urlencoded). For binary
 *              uploads use the NativeHttpUpload plugin directly via tosUpload.ts.
 */
export async function nativeFetch(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
): Promise<NativeFetchResponse> {
  const method = options.method ?? 'GET';
  const headers = options.headers ?? {};

  if (Capacitor.isNativePlatform()) {
    const pluginArgs: {
      url: string;
      method: string;
      headers: Record<string, string>;
      body?: string;
    } = { url, method, headers };

    if (options.body) {
      pluginArgs.body = textToBase64(options.body);
    }

    console.log(`[NativeHttp] ${method} ${url} bodyLen=${pluginArgs.body?.length ?? 0}`);
    let result: { status: number; data: string };
    try {
      result = await NativeHttp.upload(pluginArgs);
    } catch (pluginErr) {
      console.error(`[NativeHttp] plugin call threw:`, pluginErr);
      throw new Error(`NativeHttp plugin error: ${pluginErr}`);
    }
    console.log(`[NativeHttp] ${method} ${url} -> ${result.status} dataLen=${result.data?.length ?? 0}`);

    return {
      status: result.status,
      data: result.data,
      ok: result.status >= 200 && result.status < 300,
    };
  }

  const res = await fetch(url, {
    method,
    headers,
    body: options.body,
  });

  return {
    status: res.status,
    data: await res.text(),
    ok: res.ok,
  };
}
