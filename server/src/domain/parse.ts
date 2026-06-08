// Phase 1 ingest: turn a raw carrier CSV export into normalized statement line items.
// Pure, dependency-free, and unit-tested so it can later be lifted into a queue worker.

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * RFC-4180-ish CSV parser. Handles quoted fields, embedded commas/newlines,
 * and "" escaped quotes. Tolerates \r\n and a trailing newline.
 */
export function parseCsv(text: string): ParsedCsv {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  let started = false; // have we begun the current record?

  const pushField = () => { record.push(field); field = ''; };
  const pushRecord = () => { pushField(); records.push(record); record = []; started = false; };

  // Strip a UTF-8 BOM if present.
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    started = true;
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { pushField(); continue; }
    if (ch === '\r') { continue; }
    if (ch === '\n') { pushRecord(); continue; }
    field += ch;
  }
  // Flush trailing record if the file does not end with a newline.
  if (started || field !== '' || record.length) pushRecord();

  if (records.length === 0) return { headers: [], rows: [] };
  const headers = records[0]!.map((h) => h.trim());
  const rows = records.slice(1)
    // Drop fully-empty lines (common at end of carrier exports).
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
      return obj;
    });
  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Mapping: source column header -> normalized field
// ---------------------------------------------------------------------------
export interface FieldMap {
  policyNumber?: string;
  premiumAmount?: string;
  commissionAmount?: string;
  commissionPct?: string;
  /** Column whose value indicates whether the row is a renewal. */
  isRenewal?: string;
  /** Substring (case-insensitive) within the isRenewal column meaning "renewal". */
  renewalValue?: string;
}

const MATCHERS: { field: keyof FieldMap; test: RegExp }[] = [
  // Order matters: rate/percent must win over the bare "commission" amount match.
  { field: 'commissionPct', test: /(comm.*(rate|%|pct|percent))|^rate$|\brate\b|percent|\bpct\b|%/i },
  { field: 'commissionAmount', test: /commission|payout|comm\b|amount\s*paid|paid\s*amount/i },
  { field: 'premiumAmount', test: /premium|\bprem\b|written\s*premium/i },
  { field: 'policyNumber', test: /policy|contract|\bpol\b/i },
  { field: 'isRenewal', test: /renewal|transaction\s*type|\btype\b|new\/?renew/i },
];

/** Best-effort auto-mapping of CSV headers to normalized fields. */
export function suggestMapping(headers: string[]): FieldMap {
  const map: FieldMap = {};
  for (const header of headers) {
    for (const m of MATCHERS) {
      if (map[m.field]) continue;
      if (m.test.test(header)) { map[m.field] = header; break; }
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Value coercion
// ---------------------------------------------------------------------------
/** Parse a money cell: handles "$1,234.50", "(123.45)" negatives, blank → null. */
export function parseMoney(raw: string | undefined): number | null {
  if (raw == null) return null;
  let s = raw.trim();
  if (s === '') return null;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) { sign = -1; s = s.slice(1, -1); }
  s = s.replace(/[$,\s]/g, '');
  if (s.startsWith('-')) { sign = -1; s = s.slice(1); }
  const n = Number(s);
  return Number.isFinite(n) ? sign * n : null;
}

/**
 * Parse a commission rate into a 0–1 fraction.
 * "15%" → 0.15, "15" → 0.15, "0.15" → 0.15, "" → null.
 */
export function parsePct(raw: string | undefined): number | null {
  if (raw == null) return null;
  let s = raw.trim();
  if (s === '') return null;
  const hadPercent = s.includes('%');
  s = s.replace(/[%\s]/g, '');
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  // A bare number > 1 is assumed to be percentage points (e.g. "15" → 15%).
  return hadPercent || n > 1 ? n / 100 : n;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------
export interface NormalizedLine {
  policyNumberRaw: string | null;
  premiumAmount: number | null;
  commissionAmount: number | null;
  commissionPct: number | null;
  isRenewal: boolean | null;
  raw: Record<string, string>;
  flagged: boolean;
  flagReason: string | null;
}

export interface NormalizeResult {
  items: NormalizedLine[];
  total: number;
  valid: number;
  flagged: number;
  /** valid / total, 0–1; used as the import batch confidence score. */
  confidence: number;
}

const truthyRenewal = /renew|ren\b|^r$|rwl/i;

export function normalizeRows(rows: Record<string, string>[], map: FieldMap): NormalizeResult {
  const items: NormalizedLine[] = rows.map((raw) => {
    const policyNumberRaw = map.policyNumber ? (raw[map.policyNumber]?.trim() || null) : null;
    const premiumAmount = map.premiumAmount ? parseMoney(raw[map.premiumAmount]) : null;
    const commissionAmount = map.commissionAmount ? parseMoney(raw[map.commissionAmount]) : null;
    const commissionPct = map.commissionPct ? parsePct(raw[map.commissionPct]) : null;

    let isRenewal: boolean | null = null;
    if (map.isRenewal) {
      const cell = raw[map.isRenewal] ?? '';
      isRenewal = map.renewalValue
        ? cell.toLowerCase().includes(map.renewalValue.toLowerCase())
        : truthyRenewal.test(cell);
    }

    let flagReason: string | null = null;
    if (commissionAmount == null) flagReason = 'missing or unparseable commission amount';
    else if (!policyNumberRaw) flagReason = 'missing policy number';

    return {
      policyNumberRaw, premiumAmount, commissionAmount, commissionPct, isRenewal, raw,
      flagged: flagReason != null, flagReason,
    };
  });

  const total = items.length;
  const flagged = items.filter((i) => i.flagged).length;
  const valid = total - flagged;
  return { items, total, valid, flagged, confidence: total === 0 ? 0 : valid / total };
}
