import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

// --- simple in-memory rate limit: min interval per device key ---
const MIN_INTERVAL_MS = 2000;
const lastSeen = new Map<string, number>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const systemKey = typeof body.system_key === "string" ? body.system_key.trim() : "";
  if (!systemKey || systemKey.length > 128) return json({ error: "invalid_key" }, 400);

  // rate limit per key
  const now = Date.now();
  const prev = lastSeen.get(systemKey) ?? 0;
  if (now - prev < MIN_INTERVAL_MS) return json({ error: "rate_limited" }, 429);
  lastSeen.set(systemKey, now);
  if (lastSeen.size > 5000) lastSeen.clear();

  // resolve device (service role — bypasses RLS by design)
  const { data: device, error: devErr } = await admin
    .from("devices")
    .select("id, tank_height, tank_height_unit, calibration_mode, pending_command")
    .eq("system_key", systemKey)
    .maybeSingle();

  if (devErr) return json({ error: "lookup_failed" }, 500);
  if (!device) return json({ error: "unknown_device" }, 403);

  // --- optional telemetry insert ---
  const waterLevel = num(body.water_level);
  const tds = num(body.tds_value);
  let inserted = false;

  if (waterLevel !== null && tds !== null) {
    // sanity checks — reject physically impossible payloads
    if (waterLevel < 0 || waterLevel > 100) return json({ error: "bad_water_level" }, 400);
    if (tds < 0 || tds > 5000) return json({ error: "bad_tds" }, 400);
    const runtime = num(body.pump_runtime) ?? 0;
    if (runtime < 0 || runtime > 1440) return json({ error: "bad_runtime" }, 400);

    const pumpStatus = body.pump_status === "ON" ? "ON" : "OFF";
    const pumpMode = body.pump_mode === "MANUAL" ? "MANUAL" : "AUTO";

    const { error: insErr } = await admin.from("sensor_data").insert({
      device_id: device.id,
      water_level: waterLevel,
      tds_value: tds,
      pump_status: pumpStatus,
      pump_mode: pumpMode,
      pump_runtime: runtime,
    });
    if (insErr) return json({ error: "insert_failed" }, 500);
    inserted = true;
  }

  // --- optional pending-command acknowledgement ---
  if (body.ack_command === true && device.pending_command) {
    await admin.from("devices").update({ pending_command: null }).eq("id", device.id);
    device.pending_command = null;
  }

  // --- pump settings for this device ---
  const { data: settings } = await admin
    .from("pump_settings")
    .select("pump_mode, pump_status, upper_threshold, lower_threshold, critical_threshold")
    .eq("device_id", device.id)
    .maybeSingle();

  return json({
    ok: true,
    inserted,
    device: {
      id: device.id,
      tank_height: device.tank_height,
      tank_height_unit: device.tank_height_unit,
      calibration_mode: device.calibration_mode,
      pending_command: device.pending_command,
    },
    settings: settings ?? {
      pump_mode: "AUTO",
      pump_status: "OFF",
      upper_threshold: 90,
      lower_threshold: 35,
      critical_threshold: 25,
    },
  });
});
