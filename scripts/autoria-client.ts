/**
 * AUTO.RIA Developers API client (server-side ETL only).
 *
 * Auth: query param `api_key` on every request.
 * @see https://developers.ria.com/
 * @see https://api-docs-v2.readthedocs.io/ru/latest/auto_ria/
 */
import axios from 'axios';
import {
  autoriaCacheEnabled,
  isAutoriaDictionaryPath,
  readAutoriaCache,
  writeAutoriaCache,
} from './autoria-cache';
import {
  assertHourlyQuotaAvailable,
  AutoriaHourlyLimitError,
  ensureHourlyQuotaOrThrow,
  getHourlyMax,
  markHourlyBlockedFromApi,
  recordCacheHit,
  recordLiveRequest,
} from './autoria-quota';

const AUTORIA_BASE =
  process.env.AUTORIA_BASE_URL?.replace(/\/$/, '') || 'https://developers.ria.com';

/** Passenger cars (легкові) — default for PL/UA encyclopedia spine. */
export const AUTORIA_CATEGORY_CARS = Number(process.env.AUTORIA_CATEGORY_ID || '1');

export type AutoriaNameValue = {
  name: string;
  value: number;
  eng?: string;
  marka_id?: number;
  model_id?: number;
  category_id?: number | string;
  count?: number;
  slang?: string | null;
  parent_id?: number;
};

export type AutoriaMark = AutoriaNameValue & {
  marka_id: number;
  country_id?: number;
  cnt?: number;
};

export type AutoriaGeneration = {
  generation_id: number;
  marka_id: number;
  model_id: number;
  name: string;
  eng: string;
  year_from: number;
  year_to: number;
};

export type AutoriaNewGeneration = AutoriaGeneration;

export type AutoriaModelGenerations = {
  id?: number;
  name?: string;
  generations?: Array<{
    id?: number;
    generationId?: number;
    name: string;
    yearFrom?: number;
    yearTo?: number;
    year_from?: number;
    year_to?: number;
    eng?: string;
  }>;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function autoriaId(raw: number | string): string {
  return `autoria-${raw}`;
}

export function requireAutoriaApiKey(): string {
  const key =
    process.env.AUTO_RIA_API_KEY?.trim() || process.env.AUTORIA_API_KEY?.trim();
  if (!key) {
    throw new Error(
      'AUTO_RIA_API_KEY is missing. Add it to services/car/.env (never commit).',
    );
  }
  return key;
}

export async function autoriaGet<T>(
  path: string,
  query: Record<string, string | number | undefined> = {},
): Promise<T> {
  const basePath = path.startsWith('/') ? path : `/${path}`;

  if (isAutoriaDictionaryPath(basePath)) {
    const cached = readAutoriaCache<T>(basePath, query);
    if (cached != null) {
      recordCacheHit();
      return cached;
    }
  }

  // Soft hourly cap — abort before HTTP so we don't burn RIA after HourOverlimit.
  ensureHourlyQuotaOrThrow();

  const apiKey = requireAutoriaApiKey();
  const url = path.startsWith('http') ? path : `${AUTORIA_BASE}${basePath}`;

  const params = new URLSearchParams({ api_key: apiKey });
  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith('__')) continue;
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }

  const fullUrl = `${url}?${params}`;

  const res = await axios.get<T>(fullUrl, {
    timeout: 60_000,
    validateStatus: () => true,
    headers: { Accept: 'application/json' },
  });

  if (res.status === 429) {
    const bodyText =
      typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    const errorType =
      typeof res.data === 'object' &&
      res.data != null &&
      'error_type' in res.data &&
      typeof (res.data as { error_type?: string }).error_type === 'string'
        ? (res.data as { error_type: string }).error_type
        : '';

    if (
      errorType === 'HourOverlimit' ||
      bodyText.includes('HourOverlimit') ||
      bodyText.includes('Погодинного') ||
      bodyText.includes('погодинного')
    ) {
      markHourlyBlockedFromApi();
      throw new AutoriaHourlyLimitError(getHourlyMax() ?? 30);
    }

    const attempt = (query.__retryAttempt as number | undefined) ?? 0;
    const maxRetries = Number(process.env.AUTORIA_RATE_LIMIT_MAX_RETRIES || '0');
    if (maxRetries <= 0 || attempt >= maxRetries) {
      throw new Error(
        `AUTO.RIA rate limit (429) on GET ${basePath}. ${bodyText.slice(0, 200)}`,
      );
    }
    const retryAfterHeader = res.headers['retry-after'];
    const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : NaN;
    const baseMs = Number(process.env.AUTORIA_RATE_LIMIT_MS || '5000');
    const retryMs = Number.isFinite(retryAfterSec)
      ? Math.max(retryAfterSec * 1000, baseMs)
      : baseMs * Math.min(2 ** attempt, 8);
    console.warn(
      `AUTO.RIA rate limit (429) on ${basePath} — waiting ${Math.round(retryMs / 1000)}s (retry ${attempt + 1}/${maxRetries})…`,
    );
    await sleep(retryMs);
    return autoriaGet<T>(path, { ...query, __retryAttempt: attempt + 1 });
  }

  if (res.status < 200 || res.status >= 300) {
    const body =
      typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    throw new Error(
      `AUTO.RIA GET ${basePath} → HTTP ${res.status}: ${body.slice(0, 400)}`,
    );
  }

  if (isAutoriaDictionaryPath(basePath)) {
    writeAutoriaCache(basePath, query, res.data);
  }

  recordLiveRequest(basePath);
  return res.data;
}

/** Used cars taxonomy — marks for category (e.g. 1 = passenger). */
export async function autoriaListMarks(categoryId = AUTORIA_CATEGORY_CARS) {
  return autoriaGet<AutoriaMark[]>(`/auto/categories/${categoryId}/marks`);
}

/** Used cars — models for mark. */
export async function autoriaListModels(
  markId: number,
  categoryId = AUTORIA_CATEGORY_CARS,
) {
  return autoriaGet<AutoriaNameValue[]>(
    `/auto/categories/${categoryId}/marks/${markId}/models`,
  );
}

/** Used cars — generations (host-root path, not under /auto). */
export async function autoriaListGenerationsByModel(modelId: number) {
  return autoriaGet<AutoriaModelGenerations[]>(
    `/generations/by/models/${modelId}/generations`,
  );
}

/** Used cars — engine modifications for generation. */
export async function autoriaListModifications(generationId: number) {
  return autoriaGet<AutoriaNameValue[]>(
    `/modifications/by/generation/${generationId}/modifications`,
  );
}

/** New cars catalog — marks. */
export async function autoriaListNewMarks(categoryId = AUTORIA_CATEGORY_CARS) {
  return autoriaGet<AutoriaMark[]>('/auto/new/marks', { category_id: categoryId });
}

/** New cars catalog — models. */
export async function autoriaListNewModels(markId: number, categoryId = AUTORIA_CATEGORY_CARS) {
  return autoriaGet<AutoriaNameValue[]>('/auto/new/models', {
    marka_id: markId,
    category_id: categoryId,
  });
}

/** New cars catalog — generations with year_from/year_to. */
export async function autoriaListNewGenerations(modelId: number) {
  return autoriaGet<AutoriaNewGeneration[]>('/auto/new/generations', {
    model_id: modelId,
  });
}

export function normalizeAutoriaEng(value: string | undefined | null): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function dedupeMarksByEng<T extends { eng?: string; name: string; value: number }>(
  rows: T[],
): T[] {
  const byEng = new Map<string, T>();
  for (const row of rows) {
    const key = normalizeAutoriaEng(row.eng) || normalizeAutoriaEng(row.name);
    const prev = byEng.get(key);
    if (!prev || (row.value ?? 0) > (prev.value ?? 0)) {
      byEng.set(key, row);
    }
  }
  return [...byEng.values()].sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}

export function findByEngOrName<T extends { eng?: string; name: string }>(
  rows: T[],
  needle: string,
): T | undefined {
  const n = normalizeAutoriaEng(needle);
  return rows.find(
    (r) => normalizeAutoriaEng(r.eng) === n || normalizeAutoriaEng(r.name) === n,
  );
}

export type FlatAutoriaGeneration = {
  generationId: number;
  name: string;
  eng: string;
  yearFrom: number | null;
  yearTo: number | null;
};

export function flattenAutoriaGenerations(
  payload: AutoriaModelGenerations[],
): FlatAutoriaGeneration[] {
  const out: FlatAutoriaGeneration[] = [];
  for (const wrapper of payload) {
    for (const gen of wrapper.generations ?? []) {
      const generationId = gen.generationId ?? gen.id;
      if (!generationId) continue;
      const rawYearTo = gen.yearTo ?? gen.year_to ?? null;
      out.push({
        generationId,
        name: gen.name,
        eng: gen.eng ?? normalizeAutoriaEng(gen.name),
        yearFrom: gen.yearFrom ?? gen.year_from ?? null,
        yearTo: rawYearTo === 0 ? null : rawYearTo,
      });
    }
  }
  return out;
}
