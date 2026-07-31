import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CACHE_DIR = resolve(
  process.cwd(),
  process.env.AUTORIA_CACHE_DIR || 'scripts/.cache/autoria',
);

type CacheEntry = {
  fetchedAt: string;
  data: unknown;
};

export function autoriaCacheEnabled(): boolean {
  return process.env.AUTORIA_CACHE !== '0';
}

function cacheTtlMs(): number {
  const days = Number(process.env.AUTORIA_CACHE_TTL_DAYS || '14');
  return days * 24 * 60 * 60 * 1000;
}

function cacheKey(path: string, query: Record<string, string | number | undefined>): string {
  const stable = JSON.stringify({ path, query: Object.fromEntries(
    Object.entries(query).filter(([k]) => !k.startsWith('__')),
  ) });
  return createHash('sha256').update(stable).digest('hex');
}

export function readAutoriaCache<T>(
  path: string,
  query: Record<string, string | number | undefined> = {},
): T | null {
  if (!autoriaCacheEnabled()) return null;
  const file = join(CACHE_DIR, `${cacheKey(path, query)}.json`);
  if (!existsSync(file)) return null;
  try {
    const entry = JSON.parse(readFileSync(file, 'utf8')) as CacheEntry;
    const age = Date.now() - new Date(entry.fetchedAt).getTime();
    if (age > cacheTtlMs()) return null;
    return entry.data as T;
  } catch {
    return null;
  }
}

export function writeAutoriaCache(
  path: string,
  query: Record<string, string | number | undefined>,
  data: unknown,
): void {
  if (!autoriaCacheEnabled()) return;
  mkdirSync(CACHE_DIR, { recursive: true });
  const file = join(CACHE_DIR, `${cacheKey(path, query)}.json`);
  const entry: CacheEntry = { fetchedAt: new Date().toISOString(), data };
  writeFileSync(file, JSON.stringify(entry), 'utf8');
}

/** Dictionary endpoints — safe to cache 7–30 days (AUTO.RIA docs). */
export function isAutoriaDictionaryPath(path: string): boolean {
  return (
    path.includes('/auto/categories/') ||
    path.startsWith('/generations/') ||
    path.startsWith('/modifications/')
  );
}
