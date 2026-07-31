import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export class AutoriaBudgetExhaustedError extends Error {
  constructor(
    public readonly used: number,
    public readonly budget: number,
  ) {
    super(
      `AUTO.RIA monthly budget exhausted (${used}/${budget} live calls this run). ` +
        'Resume later — cached responses cost 0.',
    );
    this.name = 'AutoriaBudgetExhaustedError';
  }
}

/** RIA returns error_type HourOverlimit — key blocked until next clock hour. */
export class AutoriaHourlyLimitError extends Error {
  constructor(public readonly usedThisHour: number) {
    super(
      `AUTO.RIA hourly limit (~30 req/h). Used ${usedThisHour} live calls this hour. ` +
        'Wait until the next hour, then re-run the same command (resume skips completed models).',
    );
    this.name = 'AutoriaHourlyLimitError';
  }
}

const QUOTA_FILE = resolve(
  process.cwd(),
  process.env.AUTORIA_QUOTA_FILE || 'scripts/.cache/autoria/hourly-quota.json',
);

type HourlyState = {
  hourKey: string;
  liveCount: number;
  updatedAt: string;
};

let liveRequests = 0;
let cacheHits = 0;

function currentHourKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}`;
}

function readHourlyState(): HourlyState {
  if (!existsSync(QUOTA_FILE)) {
    return { hourKey: currentHourKey(), liveCount: 0, updatedAt: new Date().toISOString() };
  }
  try {
    const parsed = JSON.parse(readFileSync(QUOTA_FILE, 'utf8')) as HourlyState;
    if (parsed.hourKey !== currentHourKey()) {
      return { hourKey: currentHourKey(), liveCount: 0, updatedAt: new Date().toISOString() };
    }
    return parsed;
  } catch {
    return { hourKey: currentHourKey(), liveCount: 0, updatedAt: new Date().toISOString() };
  }
}

function writeHourlyState(state: HourlyState): void {
  mkdirSync(join(QUOTA_FILE, '..'), { recursive: true });
  writeFileSync(QUOTA_FILE, JSON.stringify(state, null, 2), 'utf8');
}

/** Max live API calls per clock hour (RIA free ≈ 30). Default 25 when SYNC_PLAN=pl. */
export function getHourlyMax(): number | null {
  const raw = process.env.SYNC_HOURLY_MAX?.trim();
  if (raw === '0' || raw === 'off') return null;
  if (raw) {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (process.env.SYNC_PLAN === 'pl') {
    return 25;
  }
  return null;
}

export function getRequestBudget(): number | null {
  const raw = process.env.SYNC_REQUEST_BUDGET?.trim();
  if (!raw) return null;
  const total = Number(raw);
  if (!Number.isFinite(total) || total <= 0) return null;
  const reserve = Number(process.env.SYNC_REQUEST_RESERVE || '20');
  return Math.max(1, total - reserve);
}

/** Call at sync start — abort early if this hour's quota already spent. */
export function assertHourlyQuotaAvailable(): void {
  const max = getHourlyMax();
  if (max == null) return;
  const state = readHourlyState();
  if (state.liveCount >= max) {
    throw new AutoriaHourlyLimitError(state.liveCount);
  }
  const remaining = max - state.liveCount;
  console.log(
    `Hourly cap: ${max} live req/h (RIA limit ≈30). Already used this hour: ${state.liveCount}, remaining: ${remaining}.`,
  );
}

/** Silent check before each live HTTP — no console spam. */
export function ensureHourlyQuotaOrThrow(): void {
  const max = getHourlyMax();
  if (max == null) return;
  const state = readHourlyState();
  if (state.liveCount >= max) {
    throw new AutoriaHourlyLimitError(state.liveCount);
  }
}

export function recordCacheHit(): void {
  cacheHits += 1;
}

export function recordLiveRequest(path: string): void {
  liveRequests += 1;

  const hourlyMax = getHourlyMax();
  const state = readHourlyState();
  const newState: HourlyState = {
    hourKey: currentHourKey(),
    liveCount: state.hourKey === currentHourKey() ? state.liveCount + 1 : 1,
    updatedAt: new Date().toISOString(),
  };
  writeHourlyState(newState);

  const budget = getRequestBudget();
  const hourlyRemaining = hourlyMax != null ? hourlyMax - newState.liveCount : null;

  if (
    liveRequests === 1 ||
    liveRequests % 10 === 0 ||
    (budget != null && budget - liveRequests <= 5) ||
    (hourlyRemaining != null && hourlyRemaining <= 3)
  ) {
    const parts = [`live run ${liveRequests}`];
    if (budget != null) parts.push(`month ${liveRequests}/${budget}`);
    if (hourlyMax != null) parts.push(`hour ${newState.liveCount}/${hourlyMax}`);
    parts.push(`cache ${cacheHits}`);
    console.log(`  [quota] ${parts.join(', ')} — ${path}`);
  }

  if (hourlyMax != null && newState.liveCount >= hourlyMax) {
    throw new AutoriaHourlyLimitError(newState.liveCount);
  }

  if (budget != null && liveRequests > budget) {
    throw new AutoriaBudgetExhaustedError(liveRequests - 1, budget);
  }
}

export function getQuotaStats() {
  const budget = getRequestBudget();
  const hourlyMax = getHourlyMax();
  const state = readHourlyState();
  return {
    liveRequests,
    cacheHits,
    budget,
    remaining: budget != null ? Math.max(0, budget - liveRequests) : null,
    hourlyMax,
    hourlyUsed: state.liveCount,
    hourlyRemaining:
      hourlyMax != null ? Math.max(0, hourlyMax - state.liveCount) : null,
  };
}

export function markHourlyBlockedFromApi(): void {
  const max = getHourlyMax() ?? 30;
  writeHourlyState({
    hourKey: currentHourKey(),
    liveCount: max,
    updatedAt: new Date().toISOString(),
  });
}
