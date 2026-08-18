/**
 * CarQuery HTTP client for ETL scripts (sync / export).
 * www.carqueryapi.com often serves a mismatched TLS cert — use CARQUERY_TLS_INSECURE=1.
 */
import axios from 'axios';
import * as https from 'https';

function tlsInsecureEnabled(): boolean {
  const v = process.env.CARQUERY_TLS_INSECURE?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function unauthorizedMessage(body: string): string | null {
  const text = body.trim();
  if (!text) return null;
  if (/not authorized|unauthorized|access denied/i.test(text)) {
    return (
      'CarQuery API rejected the request (service may be deprecated or require a new endpoint). ' +
      'Use `npx ts-node scripts/seed-catalog-smoke.ts` for local dev, or plan migration to another vehicle data source (see docs/CATALOG_MIRROR.md § CarQuery status).'
    );
  }
  return null;
}

function buildClient() {
  const insecure = tlsInsecureEnabled();
  return axios.create({
    timeout: 60_000,
    validateStatus: () => true,
    ...(insecure
      ? {
          httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        }
      : {}),
  });
}

export async function carqueryFetchText(url: string): Promise<string> {
  const insecure = tlsInsecureEnabled();
  const client = buildClient();

  try {
    const res = await client.get<string>(url, { responseType: 'text' });
    const body = typeof res.data === 'string' ? res.data : String(res.data ?? '');

    if (res.status < 200 || res.status >= 300) {
      const auth = unauthorizedMessage(body);
      throw new Error(auth ?? `HTTP ${res.status} ${url}\n${body.slice(0, 200)}`);
    }

    const auth = unauthorizedMessage(body);
    if (auth) {
      throw new Error(auth);
    }

    return body;
  } catch (err) {
    if (!insecure && axios.isAxiosError(err)) {
      const code = (err.cause as { code?: string } | undefined)?.code ?? err.code;
      if (code === 'ERR_TLS_CERT_ALTNAME_INVALID' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        throw new Error(
          `CarQuery TLS error for ${url}. Certificate does not match www.carqueryapi.com. ` +
            'Retry with: CARQUERY_TLS_INSECURE=1 pnpm catalog:sync',
          { cause: err },
        );
      }
    }
    throw err;
  }
}

export async function carqueryFetchJson(url: string): Promise<Record<string, unknown>> {
  const body = await carqueryFetchText(url);
  try {
    const data = JSON.parse(body) as unknown;
    return typeof data === 'object' && data !== null
      ? (data as Record<string, unknown>)
      : {};
  } catch {
    throw new Error(`CarQuery returned non-JSON from ${url}: ${body.slice(0, 120)}`);
  }
}
