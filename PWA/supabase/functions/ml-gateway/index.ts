// ML gateway for the external Render forecasting service.
// Auth: X-API-Token header (or Authorization: Bearer <token>) matching X_API_TOKEN.
//
// Routes (relative to the function base URL):
//   GET  /api/devices
//   GET  /api/daily-usage/:deviceId
//   POST /api/predictions
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { ...corsHeaders, 'Access-Control-Allow-Headers': 'authorization, x-api-token, content-type, apikey' },
    });
  }

  const expected = Deno.env.get('X_API_TOKEN');
  if (!expected) return json({ error: 'X_API_TOKEN not configured' }, 500);

  const provided =
    req.headers.get('x-api-token') ??
    (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (provided !== expected) return json({ error: 'Unauthorized' }, 401);

  const url = new URL(req.url);
  // Strip the function mount prefix so /functions/v1/ml-gateway/api/... works.
  const path = url.pathname.replace(/^.*\/ml-gateway/, '') || '/';

  try {
    // A) GET /api/devices  ->  { devices: ["uuid", ...] }
    if (req.method === 'GET' && /^\/api\/devices\/?$/.test(path)) {
      const { data, error } = await admin
        .from('devices')
        .select('id')
        .not('user_id', 'is', null);
      if (error) throw error;
      return json({ devices: (data ?? []).map((d: { id: string }) => d.id) });
    }

    // B) GET /api/daily-usage/:deviceId  ->  { device_id, data: [{usage_date, liters_used}] }
    const usageMatch = path.match(/^\/api\/daily-usage\/([^/]+)\/?$/);
    if (req.method === 'GET' && usageMatch) {
      const deviceId = usageMatch[1];
      if (!UUID_RE.test(deviceId)) return json({ error: 'Invalid device_id' }, 400);

      const days = Math.min(Math.max(Number(url.searchParams.get('days') ?? 90) || 90, 1), 365);
      const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

      const { data, error } = await admin
        .from('daily_usage')
        .select('usage_date, liters_used, percent_used, readings_count, capacity_liters_snapshot')
        .eq('device_id', deviceId)
        .gte('usage_date', since)
        .order('usage_date', { ascending: true })
        .limit(365);
      if (error) throw error;

      return json({ device_id: deviceId, data: data ?? [] });
    }

    // C) POST /api/predictions
    //   Weekly (default): [{ device_id, target_date (week start), predicted_value (L/week), week_end?, model_version? }]
    //   Daily (legacy):   rows with prediction_type: 'daily_consumption'
    if (req.method === 'POST' && /^\/api\/predictions\/?$/.test(path)) {
      const body = await req.json().catch(() => null);
      const items: any[] = Array.isArray(body) ? body : Array.isArray(body?.predictions) ? body.predictions : body && typeof body === 'object' && body.device_id ? [body] : [];
      if (items.length === 0 || items.length > 62) {
        return json({ error: 'Body must be an array of 1-62 prediction rows' }, 400);
      }

      const predictionDate = new Date().toISOString().slice(0, 10);
      const rows: any[] = [];

      for (const p of items) {
        const deviceId = String(p?.device_id ?? '');
        const targetDate = String(p?.target_date ?? '');
        const value = Number(p?.predicted_value);
        const type = p?.prediction_type === 'daily_consumption' ? 'daily_consumption' : 'weekly_consumption';
        if (!UUID_RE.test(deviceId) || !DATE_RE.test(targetDate) || !Number.isFinite(value)) {
          return json({ error: `Bad row: ${JSON.stringify(p)}` }, 400);
        }
        const conf = Number(p?.confidence);
        const weekly = type === 'weekly_consumption';
        const weekEnd = DATE_RE.test(String(p?.metadata?.week_end ?? p?.week_end ?? ''))
          ? String(p?.metadata?.week_end ?? p?.week_end)
          : new Date(Date.parse(`${targetDate}T00:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10);
        rows.push({
          device_id: deviceId,
          prediction_type: type,
          model_version: String(p?.model_version ?? (weekly ? 'prophet-v1' : 'xgb-v1')).slice(0, 40),
          prediction_date: predictionDate,
          target_date: targetDate,
          target_time: `${targetDate}T00:00:00Z`,
          predicted_value: value,
          confidence: Number.isFinite(conf) ? Math.min(Math.max(conf, 0), 1) : 0.9,
          metadata: weekly
            ? { ...(p?.metadata ?? {}), unit: 'liters_per_week', week_start: targetDate, week_end: weekEnd }
            : { unit: 'liters_per_day', ...(p?.metadata ?? {}) },
        });
      }

      // One row per device per target week/day: delete existing, then insert.
      for (const r of rows) {
        const { error: delError } = await admin
          .from('ml_predictions')
          .delete()
          .eq('device_id', r.device_id)
          .eq('prediction_type', r.prediction_type)
          .eq('target_date', r.target_date);
        if (delError) throw delError;
      }

      const { error: insError } = await admin.from('ml_predictions').insert(rows);
      if (insError) throw insError;

      return json({ ok: true, devices: new Set(rows.map(r => r.device_id)).size, written: rows.length });
    }

    return json({ error: `Unknown route: ${req.method} ${path}` }, 404);
  } catch (e) {
    console.error('ml-gateway error', e);
    return json({ error: (e as Error).message }, 500);
  }
});
