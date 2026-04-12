/**
 * Direct Google Sheets REST API wrapper for native (iOS) mode.
 * Bypasses wsProxy.ts entirely by calling the Sheets API with a
 * JWT-obtained access token.
 *
 * On iOS native, all requests go through nativeFetch (URLSession) to avoid
 * CapacitorHttp's broken JSON/form body handling.
 */

import { getAccessToken } from './auth';
import { GSHEETS_CONFIG } from './config';
import { nativeFetch } from '../nativeHttp';

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

async function sheetsRequest(method: string, path: string, body?: unknown) {
  const token = await getAccessToken();
  const url = `${SHEETS_BASE}/${GSHEETS_CONFIG.spreadsheetId}${path}`;

  console.log(`[Sheets API] ${method} ${path}`);

  const res = await nativeFetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    console.error(`[Sheets API] ${method} ${path} -> ${res.status}:`, res.data);
    throw new Error(`Sheets API ${res.status}: ${res.data}`);
  }

  console.log(`[Sheets API] ${method} ${path} -> ${res.status} OK`);
  return JSON.parse(res.data);
}

export async function createSheet(title: string): Promise<void> {
  await sheetsRequest('POST', ':batchUpdate', {
    requests: [{ addSheet: { properties: { title } } }],
  });
}

export async function writeValues(
  range: string,
  values: (string | number)[][],
  inputOption: 'RAW' | 'USER_ENTERED' = 'RAW',
): Promise<void> {
  await sheetsRequest(
    'PUT',
    `/values/${encodeURIComponent(range)}?valueInputOption=${inputOption}`,
    { values },
  );
}

export async function readValues(range: string): Promise<(string | number)[][]> {
  const data = await sheetsRequest(
    'GET',
    `/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`,
  );
  return data.values ?? [];
}
