/**
 * Local session persistence using localStorage.
 * Stores completed recording sessions so the history page
 * can display real data and navigate back to analysis.
 */

import type { AnnotatedRecord } from '../utils/transformAnnotatedToStorm';
import { getSettings } from './settingsStore';

export interface SavedSpeaker {
  id: string;
  name: string;
  color: string;
  speechCount: number;
  gender?: string;
}

export interface SavedTranscript {
  id: number;
  speaker: string;
  text: string;
  timestamp: string;
  startTimeMs?: number;
  endTimeMs?: number;
  durationSec?: number;
  emotion?: string;
  gender?: string;
  speechRate?: number;
  volume?: number;
}

export interface SavedSession {
  id: string;
  sceneName: string;
  mode: 'manual' | 'nfc';
  recordingTime: number;
  createdAt: string;
  speakers: SavedSpeaker[];
  transcripts: SavedTranscript[];
  annotatedData?: AnnotatedRecord[];
  sheetName?: string;
  hasVisualization?: boolean;
}

const STORAGE_KEY = 'xianying_sessions';

function readAll(): SavedSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(sessions: SavedSession[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function saveSession(session: SavedSession): void {
  const sessions = readAll();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.unshift(session);
  }
  writeAll(sessions);
}

function applyRetention(sessions: SavedSession[]): SavedSession[] {
  const { dataRetentionDays } = getSettings();
  if (!dataRetentionDays || dataRetentionDays <= 0) return sessions;
  const cutoff = Date.now() - dataRetentionDays * 86_400_000;
  const kept: SavedSession[] = [];
  const expired: string[] = [];
  for (const s of sessions) {
    if (new Date(s.createdAt).getTime() >= cutoff) kept.push(s);
    else expired.push(s.id);
  }
  if (expired.length > 0) {
    writeAll(kept);
  }
  return kept;
}

export function listSessions(): SavedSession[] {
  return applyRetention(readAll());
}

export function getSession(id: string): SavedSession | undefined {
  return readAll().find((s) => s.id === id);
}

export function deleteSession(id: string): void {
  writeAll(readAll().filter((s) => s.id !== id));
}

export function markVisualization(id: string): void {
  const sessions = readAll();
  const s = sessions.find((x) => x.id === id);
  if (s) {
    s.hasVisualization = true;
    writeAll(sessions);
  }
}

export function updateSessionTitle(id: string, title: string): void {
  const sessions = readAll();
  const s = sessions.find((x) => x.id === id);
  if (s && s.sceneName === '未命名标题') {
    s.sceneName = title;
    writeAll(sessions);
  }
}

export function listGalleryItems(): SavedSession[] {
  return applyRetention(readAll()).filter((s) => s.hasVisualization);
}
