import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ---- Web Push helpers (VAPID + encryption) using Web Crypto ----

function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function createVapidJwt(
  audience: string,
  subject: string,
  publicKeyB64: string,
  privateKeyB64: string,
): Promise<{ authorization: string; cryptoKey: string }> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 12 * 3600, sub: subject };

  const encodeJson = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const unsignedToken = `${encodeJson(header)}.${encodeJson(payload)}`;
  const tokenBytes = new TextEncoder().encode(unsignedToken);

  // Import the private key
  const privateKeyBytes = base64urlToUint8Array(privateKeyB64);
  const publicKeyBytes = base64urlToUint8Array(publicKeyB64);

  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: uint8ArrayToBase64url(publicKeyBytes.slice(1, 33)),
    y: uint8ArrayToBase64url(publicKeyBytes.slice(33, 65)),
    d: uint8ArrayToBase64url(privateKeyBytes),
  };

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    tokenBytes,
  ));

  // Convert DER signature to raw r||s format if needed (Web Crypto returns raw r||s for ECDSA)
  const jwt = `${unsignedToken}.${uint8ArrayToBase64url(signature)}`;

  return {
    authorization: `vapid t=${jwt}, k=${publicKeyB64}`,
    cryptoKey: `p256ecdsa=${publicKeyB64}`,
  };
}

async function encryptPayload(
  p256dhKey: string,
  authSecret: string,
  payload: string,
): Promise<{ encrypted: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const userPublicKeyBytes = base64urlToUint8Array(p256dhKey);
  const userAuthBytes = base64urlToUint8Array(authSecret);
  const payloadBytes = new TextEncoder().encode(payload);

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  );

  const localPublicKey = new Uint8Array(
    await crypto.subtle.exportKey('raw', localKeyPair.publicKey),
  );

  // Import user's public key
  const userPublicKey = await crypto.subtle.importKey(
    'raw',
    userPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: userPublicKey },
      localKeyPair.privateKey,
      256,
    ),
  );

  // Generate 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF: PRK = HMAC-SHA256(auth, sharedSecret)
  const authKey = await crypto.subtle.importKey('raw', userAuthBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', authKey, sharedSecret));

  // Info for content encryption key
  const keyInfo = new Uint8Array([
    ...new TextEncoder().encode('Content-Encoding: aes128gcm\0'),
  ]);

  // Info for nonce
  const nonceInfo = new Uint8Array([
    ...new TextEncoder().encode('Content-Encoding: nonce\0'),
  ]);

  // HKDF expand for IKM
  const authInfo = new Uint8Array([
    ...new TextEncoder().encode('WebPush: info\0'),
    ...userPublicKeyBytes,
    ...localPublicKey,
  ]);

  const prkKey = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const ikm = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, new Uint8Array([...authInfo, 1])));

  // HKDF for CEK
  const saltKey = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const prkForCek = new Uint8Array(await crypto.subtle.sign('HMAC', saltKey, ikm));
  const prkCekKey = await crypto.subtle.importKey('raw', prkForCek, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

  const cekFull = new Uint8Array(await crypto.subtle.sign('HMAC', prkCekKey, new Uint8Array([...keyInfo, 1])));
  const cek = cekFull.slice(0, 16);

  const nonceFull = new Uint8Array(await crypto.subtle.sign('HMAC', prkCekKey, new Uint8Array([...nonceInfo, 1])));
  const nonce = nonceFull.slice(0, 12);

  // Pad payload (add delimiter byte 0x02)
  const paddedPayload = new Uint8Array([...payloadBytes, 2]);

  // AES-128-GCM encrypt
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, paddedPayload),
  );

  // aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, paddedPayload.length + 16 + 1); // record size

  const encrypted = new Uint8Array([
    ...salt,
    ...rs,
    localPublicKey.length,
    ...localPublicKey,
    ...ciphertext,
  ]);

  return { encrypted, salt, localPublicKey };
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
): Promise<{ ok: boolean; gone: boolean }> {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const vapid = await createVapidJwt(
    audience,
    'mailto:alerts@waterangel.app',
    vapidPublicKey,
    vapidPrivateKey,
  );

  const { encrypted } = await encryptPayload(
    subscription.p256dh,
    subscription.auth,
    payload,
  );

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': vapid.authorization,
      'Crypto-Key': vapid.cryptoKey,
      'TTL': '86400',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
    },
    body: encrypted,
  });

  const ok = response.ok || response.status === 201;
  const gone = response.status === 404 || response.status === 410;
  if (!ok) {
    const text = await response.text().catch(() => '');
    console.error(`Push failed ${response.status} for ${subscription.endpoint.substring(0, 60)}: ${text}`);
  } else {
    await response.text().catch(() => '');
  }
  return { ok, gone };
}

// ---- Main handler ----

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
    const INTERNAL_SECRET = 'wa_push_3f9a8c2e1b7d4f6a9c5e8b2d7f1a4c6e';

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { user_id, title, body, url, internal_secret } = await req.json();

    // AUTHORIZATION: accept either the DB trigger's internal secret,
    // or an authenticated user requesting a push for themselves.
    let authorized = false;
    if (internal_secret && internal_secret === INTERNAL_SECRET) {
      authorized = true;
    } else {
      const token = req.headers.get('Authorization')?.replace('Bearer ', '');
      if (token) {
        const userClient = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
          { global: { headers: { Authorization: `Bearer ${token}` } } },
        );
        const { data: { user } } = await userClient.auth.getUser();
        if (user && user.id === user_id) authorized = true;
      }
    }
    if (!authorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Get all push subscriptions for this user
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user_id);

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const payload = JSON.stringify({
      title: title || 'Water Angel',
      body: body || '',
      url: url || '/',
    });

    let sent = 0;
    let failedCount = 0;
    const goneIds: string[] = [];

    for (const sub of subscriptions) {
      try {
        const { ok, gone } = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          VAPID_PUBLIC_KEY,
          VAPID_PRIVATE_KEY,
        );
        if (ok) sent++;
        else {
          failedCount++;
          if (gone) goneIds.push(sub.id);
        }
      } catch (err) {
        console.error(`Failed to send to ${sub.endpoint}:`, err);
        failedCount++;
      }
    }

    // Only delete subscriptions the push service says are gone (404/410)
    if (goneIds.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', goneIds);
    }

    return new Response(
      JSON.stringify({ sent, failed: failedCount, removed: goneIds.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('send-push error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
