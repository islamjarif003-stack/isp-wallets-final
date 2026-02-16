type ProbeResult = {
  at: string;
  baseUrl: string;
  method: string;
  path: string;
  status: number;
  ok: boolean;
  request: {
    authMode: string;
    payloadLabel?: string;
  };
  response: {
    headers: Record<string, string>;
    body: unknown;
  };
  error?: {
    message: string;
  };
};

function nowIso(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function toHeadersRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

async function readBody(res: Response): Promise<unknown> {
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');
  if (isJson) {
    try {
      return await res.json();
    } catch {
      return await res.text();
    }
  }
  return await res.text();
}

function normalizeBaseUrl(raw: string): string {
  const withProto = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
  return withProto.replace(/\/+$/, '');
}

function shouldPrint(mode: 'all' | 'interesting', r: ProbeResult): boolean {
  if (mode === 'all') return true;
  const bodyStr = typeof r.response.body === 'string' ? r.response.body : JSON.stringify(r.response.body);
  const b = bodyStr.toLowerCase();
  return (
    r.status === 401 ||
    r.status === 403 ||
    r.status === 404 ||
    r.status >= 500 ||
    b.includes('required') ||
    b.includes('invalid') ||
    b.includes('unauthorized') ||
    b.includes('api key') ||
    b.includes('insufficient') ||
    b.includes('balance') ||
    b.includes('forbidden')
  );
}

function buildAuthHeaders(authMode: string, apiKey: string | undefined): Record<string, string> {
  const h: Record<string, string> = {};
  if (!apiKey) return h;

  if (authMode === 'x-api-key') h['x-api-key'] = apiKey;
  if (authMode === 'authorization-bearer') h['authorization'] = `Bearer ${apiKey}`;
  if (authMode === 'authorization-raw') h['authorization'] = apiKey;
  if (authMode === 'api-key') h['api-key'] = apiKey;
  if (authMode === 'token') h['token'] = apiKey;
  return h;
}

async function requestOnce(input: {
  baseUrl: string;
  path: string;
  method: 'GET' | 'POST';
  authMode: string;
  apiKey?: string;
  payload?: unknown;
  payloadLabel?: string;
  timeoutMs: number;
}): Promise<ProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  const url = `${input.baseUrl}${input.path}`;
  const headers: Record<string, string> = {
    accept: 'application/json, text/plain, */*',
    ...buildAuthHeaders(input.authMode, input.apiKey),
  };

  let body: string | undefined;
  if (input.method === 'POST') {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(input.payload ?? {});
  }

  try {
    const res = await fetch(url, {
      method: input.method,
      headers,
      body,
      signal: controller.signal,
    });

    const responseBody = await readBody(res);

    return {
      at: nowIso(),
      baseUrl: input.baseUrl,
      method: input.method,
      path: input.path,
      status: res.status,
      ok: res.ok,
      request: {
        authMode: input.authMode,
        payloadLabel: input.payloadLabel,
      },
      response: {
        headers: toHeadersRecord(res.headers),
        body: responseBody,
      },
    };
  } catch (e) {
    return {
      at: nowIso(),
      baseUrl: input.baseUrl,
      method: input.method,
      path: input.path,
      status: 0,
      ok: false,
      request: {
        authMode: input.authMode,
        payloadLabel: input.payloadLabel,
      },
      response: {
        headers: {},
        body: null,
      },
      error: { message: e instanceof Error ? e.message : String(e) },
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function main(): Promise<void> {
  const baseUrl = normalizeBaseUrl(process.env.PROVIDER_API_URL || 'https://digitaltopuppro.com');
  const apiKey = process.env.PROVIDER_API_KEY;
  const probeFast = (process.env.PROBE_FAST || '').trim() === '1';
  const logMode = ((process.env.PROBE_LOG || 'all').trim().toLowerCase() === 'interesting'
    ? 'interesting'
    : 'all') as 'all' | 'interesting';
  const probeLimit = Number.isFinite(Number(process.env.PROBE_LIMIT))
    ? Math.max(1, Number(process.env.PROBE_LIMIT))
    : Infinity;

  const baseUrlVariants = Array.from(
    new Set([
      baseUrl,
      baseUrl.replace('https://', 'http://'),
      baseUrl.replace('http://', 'https://'),
      baseUrl.includes('://www.') ? baseUrl.replace('://www.', '://') : baseUrl.replace('://', '://www.'),
    ])
  );

  const authModes = (probeFast
    ? (['x-api-key', 'authorization-bearer'] as const)
    : (['none', 'x-api-key', 'authorization-bearer', 'authorization-raw', 'api-key', 'token'] as const));

  const getPaths = [
    '/',
    '/api',
    '/api/v1',
    '/v1',
    '/rest',
    '/health',
    '/ping',
    '/status',
    '/balance',
    '/api/balance',
    '/api/v1/balance',
    '/api/user/balance',
    '/api/v1/user/balance',
  ];

  const postPaths = [
    '/api/recharge',
    '/api/topup',
    '/api/v1/recharge',
    '/api/v1/topup',
    '/recharge',
    '/topup',
    '/api/mobile-recharge',
    '/api/v1/mobile-recharge',
    '/api/transaction',
    '/api/v1/transaction',
    '/api/purchase',
    '/api/v1/purchase',
    '/recharge/api',
    '/recharge/balance',
    '/recharge/status',
    '/api.php',
    '/index.php/api',
    '/index.php/recharge/api',
    '/index.php/recharge/balance',
  ];

  const payloads: Array<{ label: string; body: unknown }> = [
    { label: 'empty', body: {} },
    { label: 'mobile_only', body: { mobile: '00000000000' } },
    { label: 'number_only', body: { number: '00000000000' } },
    { label: 'msisdn_only', body: { msisdn: '00000000000' } },
    { label: 'msisdn_amount0', body: { msisdn: '00000000000', amount: 0 } },
    { label: 'mobile_amount0', body: { mobile: '00000000000', amount: 0 } },
    { label: 'number_amount0', body: { number: '00000000000', amount: 0 } },
    { label: 'common_fields_amount0', body: { mobile: '00000000000', operator: 'GP', amount: 0, type: 'PREPAID' } },
  ];

  const timeoutMs = probeFast ? 10_000 : 12_000;
  const delayMs = probeFast ? 250 : 350;

  const results: ProbeResult[] = [];
  let sent = 0;

  const basesToTest = probeFast ? [baseUrl] : baseUrlVariants;

  for (const b of basesToTest) {
    for (const authMode of authModes) {
      const keyToUse = apiKey;

      for (const path of getPaths) {
        if (sent >= probeLimit) break;
        const r = await requestOnce({
          baseUrl: b,
          path,
          method: 'GET',
          authMode,
          apiKey: keyToUse,
          timeoutMs,
        });
        sent += 1;
        results.push(r);
        if (shouldPrint(logMode, r)) process.stdout.write(JSON.stringify(r) + '\n');
        await sleep(delayMs);
      }

      for (const path of postPaths) {
        for (const p of payloads) {
          if (sent >= probeLimit) break;
          const r = await requestOnce({
            baseUrl: b,
            path,
            method: 'POST',
            authMode,
            apiKey: keyToUse,
            payload: p.body,
            payloadLabel: p.label,
            timeoutMs,
          });
          sent += 1;
          results.push(r);
          if (shouldPrint(logMode, r)) process.stdout.write(JSON.stringify(r) + '\n');
          await sleep(delayMs);
        }
      }
    }
  }

  const failures = results.filter((r) => r.status === 401 || r.status === 403 || r.status === 404 || r.status >= 500);
  const interesting = results.filter((r) => {
    const bodyStr = typeof r.response.body === 'string' ? r.response.body : JSON.stringify(r.response.body);
    const b = bodyStr.toLowerCase();
    return (
      b.includes('required') ||
      b.includes('invalid') ||
      b.includes('unauthorized') ||
      b.includes('api key') ||
      b.includes('insufficient') ||
      b.includes('balance') ||
      b.includes('forbidden')
    );
  });

  process.stdout.write(
    JSON.stringify(
      {
        summaryAt: nowIso(),
        baseUrlVariantsTested: baseUrlVariants,
        apiKeyProvided: Boolean(apiKey),
        counts: {
          total: results.length,
          interesting: interesting.length,
          failures: failures.length,
        },
      },
      null,
      2
    ) + '\n'
  );
}

main().catch((e) => {
  process.stderr.write(String(e instanceof Error ? e.stack || e.message : e) + '\n');
  process.exitCode = 1;
});
