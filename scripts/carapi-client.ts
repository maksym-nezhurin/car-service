/**
 * CarAPI.app HTTP client for catalog ETL (server-side only — no CORS in browser).
 *
 * Free tier (no credentials): demo dataset ~2015–2020, 48 makes.
 * Premium: set CARAPI_API_TOKEN + CARAPI_API_SECRET → JWT for 1900–today.
 *
 * @see https://carapi.app/docs
 */
import axios from 'axios';

const CARAPI_BASE =
  process.env.CARAPI_BASE_URL?.replace(/\/$/, '') || 'https://carapi.app';

export type CarApiCollection = {
  url: string;
  count: number;
  pages: number;
  total: number;
  next: string;
  prev: string;
  first: string;
  last: string;
};

export type CarApiListResponse<T> = {
  data: T[];
  collection: CarApiCollection;
};

export type CarApiMake = {
  id: number;
  name: string;
};

export type CarApiModel = {
  id: number;
  make_id: number;
  name: string;
  make?: string;
};

export type CarApiTrimListItem = {
  id: number;
  make_id: number;
  model_id: number;
  year: number;
  make: string;
  model: string;
  submodel?: string | null;
  trim?: string | null;
  description: string;
};

export type CarApiEngine = {
  engine_type?: string | null;
  fuel_type?: string | null;
  cylinders?: string | null;
  size?: string | null;
  horsepower_hp?: number | null;
};

export type CarApiTrimDetail = CarApiTrimListItem & {
  engines?: CarApiEngine[];
  transmissions?: Array<{ description?: string | null }>;
};

let cachedJwt: { token: string; expMs: number } | null = null;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function decodeJwtExpMs(token: string): number {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    ) as { exp?: number };
    return typeof payload.exp === 'number'
      ? payload.exp * 1000
      : Date.now() + 3_600_000;
  } catch {
    return Date.now() + 3_600_000;
  }
}

export function carapiId(raw: number | string): string {
  return `carapi-${raw}`;
}

export function buildTrimsJsonFilter(
  yearFrom: number,
  modelId: number,
): string {
  return JSON.stringify([
    { field: 'year', op: '>=', val: yearFrom },
    { field: 'model_id', op: '=', val: modelId },
  ]);
}

export function hasCarApiCredentials(): boolean {
  return Boolean(
    process.env.CARAPI_API_TOKEN?.trim() &&
      process.env.CARAPI_API_SECRET?.trim(),
  );
}

async function getBearerToken(): Promise<string | null> {
  const apiToken = process.env.CARAPI_API_TOKEN?.trim();
  const apiSecret = process.env.CARAPI_API_SECRET?.trim();
  if (!apiToken || !apiSecret) {
    return null;
  }

  if (cachedJwt && cachedJwt.expMs > Date.now() + 60_000) {
    return cachedJwt.token;
  }

  const res = await axios.post(
    `${CARAPI_BASE}/api/auth/login`,
    { api_token: apiToken, api_secret: apiSecret },
    {
      timeout: 30_000,
      validateStatus: () => true,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    },
  );

  if (res.status !== 200) {
    const body =
      typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    throw new Error(
      `CarAPI auth failed (${res.status}): ${body.slice(0, 240)}`,
    );
  }

  const data = res.data as
    | string
    | { token?: string; jwt?: string; access_token?: string };

  const token =
    typeof data === 'string'
      ? data
      : (data.token ?? data.jwt ?? data.access_token);

  if (!token) {
    throw new Error('CarAPI auth: response did not include a JWT token');
  }

  cachedJwt = { token, expMs: decodeJwtExpMs(token) };
  return token;
}

async function carapiRequest<T>(
  path: string,
  query: Record<string, string | number | undefined> = {},
): Promise<T> {
  const bearer = await getBearerToken();
  const basePath = path.startsWith('/') ? path : `/${path}`;
  const url = path.startsWith('http') ? path : `${CARAPI_BASE}${basePath}`;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }
  const fullUrl = params.toString() ? `${url}?${params}` : url;

  const res = await axios.get<T>(fullUrl, {
    timeout: 60_000,
    validateStatus: () => true,
    headers: {
      Accept: 'application/json',
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
  });

  if (res.status === 429) {
    const retryMs = Number(process.env.CARAPI_RATE_LIMIT_MS || '5000');
    console.warn(`CarAPI rate limit — waiting ${retryMs}ms…`);
    await sleep(retryMs);
    return carapiRequest<T>(path, query);
  }

  if (res.status < 200 || res.status >= 300) {
    const body =
      typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    throw new Error(
      `CarAPI GET ${fullUrl} → HTTP ${res.status}: ${body.slice(0, 300)}`,
    );
  }

  return res.data;
}

export async function carapiGetPage<T>(
  path: string,
  query: Record<string, string | number | undefined> = {},
): Promise<CarApiListResponse<T>> {
  return carapiRequest<CarApiListResponse<T>>(path, query);
}

export async function carapiGetOne<T>(path: string): Promise<T> {
  return carapiRequest<T>(path);
}

export async function carapiFetchAllPages<T>(
  path: string,
  query: Record<string, string | number | undefined> = {},
): Promise<T[]> {
  const limit = Number(process.env.CARAPI_PAGE_LIMIT || '100');
  const delayMs = Number(process.env.SYNC_DELAY_MS || '0');
  const items: T[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const res = await carapiGetPage<T>(path, { ...query, page, limit });
    items.push(...(res.data ?? []));
    totalPages = res.collection?.pages ?? 1;
    page += 1;
    if (page <= totalPages && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return items;
}
