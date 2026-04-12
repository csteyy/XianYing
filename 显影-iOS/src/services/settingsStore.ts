export interface AppSettings {
  defaultParticleSize: number;
  defaultAnimationSpeed: number;
  saveTranscripts: boolean;
  dataRetentionDays: number; // 7, 30, 90, 0 = forever
}

const STORAGE_KEY = 'xianying_settings';

const DEFAULTS: AppSettings = {
  defaultParticleSize: 1.0,
  defaultAnimationSpeed: 1.0,
  saveTranscripts: true,
  dataRetentionDays: 0,
};

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const next = { ...current, ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function getStorageStats(): { sessions: number; settings: number; other: number; total: number } {
  let sessions = 0;
  let settings = 0;
  let other = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const size = (localStorage.getItem(key) ?? '').length * 2;
    if (key === 'xianying_sessions') sessions = size;
    else if (key === STORAGE_KEY) settings = size;
    else other += size;
  }

  return { sessions, settings, other, total: sessions + settings + other };
}

export function clearCache(): void {
  const keep = new Set(['xianying_sessions', STORAGE_KEY, 'hasSeenGuide']);
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && !keep.has(key)) toRemove.push(key);
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
}

export function clearAllData(): void {
  localStorage.removeItem('xianying_sessions');
}
