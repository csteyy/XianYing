export const GSHEETS_CONFIG = {
  spreadsheetId: import.meta.env.VITE_GOOGLE_SPREADSHEET_ID ?? '',
  proxyWritePath: '/gsheets/write',
  proxyReadPath: '/gsheets/read',
  proxyAnnotatePath: '/gsheets/annotate',
} as const;

export function isGSheetsAvailable(): boolean {
  return !!GSHEETS_CONFIG.spreadsheetId;
}
