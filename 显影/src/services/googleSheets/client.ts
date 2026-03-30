import { GSHEETS_CONFIG } from './config';

export interface TranscriptForSheet {
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

export interface AnnotatedRecord {
  record_id: string;
  index: number;
  text: string;
  speaker: string;
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
  gender: string;
  asrEmotion: string;
  speechRate: number;
  volume: number;
  targetSpeaker: string;
  emotion: string;
  interactionType: string;
  detailedInteraction: string;
  topic: string;
  isTurningPoint: boolean;
}

interface WriteResponse {
  sheetName: string;
  rowCount: number;
}

interface ReadResponse {
  status: 'done' | 'pending';
  records: AnnotatedRecord[];
}

export async function writeTranscriptsToSheet(
  transcripts: TranscriptForSheet[],
  sessionId?: string,
): Promise<WriteResponse> {
  const res = await fetch(GSHEETS_CONFIG.proxyWritePath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcripts, sessionId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Write failed: ${res.status}`);
  }
  return res.json();
}

export async function readAnnotationsFromSheet(
  sheetName: string,
): Promise<ReadResponse> {
  const res = await fetch(GSHEETS_CONFIG.proxyReadPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheetName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Read failed: ${res.status}`);
  }
  return res.json();
}

export async function triggerAnnotation(
  sheetName: string,
): Promise<{ status: string; annotated: number }> {
  const res = await fetch(GSHEETS_CONFIG.proxyAnnotatePath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheetName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Annotate failed: ${res.status}`);
  }
  return res.json();
}

export async function pollForAnnotations(
  sheetName: string,
  intervalMs = 5000,
  timeoutMs = 180_000,
): Promise<{ status: 'done' | 'timeout'; records: AnnotatedRecord[] }> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await readAnnotationsFromSheet(sheetName);
    if (result.status === 'done') return { status: 'done', records: result.records };
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  const final = await readAnnotationsFromSheet(sheetName);
  return {
    status: final.status === 'done' ? 'done' : 'timeout',
    records: final.records,
  };
}
