const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Coordinates = { latitude: number; longitude: number };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function valid(latitude: number, longitude: number): Coordinates | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function extract(value: string): Coordinates | null {
  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll|center)=(-?\d+(?:\.\d+)?)[,%20]+(-?\d+(?:\.\d+)?)/i,
    /\/search\/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  ];
  for (const pattern of patterns) {
    const m = value.match(pattern);
    if (m) {
      const result = valid(Number(m[1]), Number(m[2]));
      if (result) return result;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({})) as { map_url?: unknown };
    const mapUrl = typeof body.map_url === 'string' ? body.map_url.trim() : '';
    if (!mapUrl) return json({ error: 'map_url is required' }, 400);
    if (!/^https?:\/\//i.test(mapUrl)) return json({ error: 'A valid http(s) map URL is required' }, 400);

    const direct = extract(mapUrl);
    if (direct) return json(direct);

    const response = await fetch(mapUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 HighParkConsult/MapResolver' },
    });
    const finalUrl = response.url || mapUrl;
    const fromUrl = extract(finalUrl);
    if (fromUrl) return json({ ...fromUrl, resolved_url: finalUrl });

    const html = await response.text();
    const fromHtml = extract(html);
    if (fromHtml) return json({ ...fromHtml, resolved_url: finalUrl });

    return json({ error: 'The supplied map link could not be resolved to exact coordinates.', resolved_url: finalUrl }, 422);
  } catch (error) {
    console.error('resolve-map-url error:', error);
    return json({ error: error instanceof Error ? error.message : 'Map URL resolution failed' }, 500);
  }
});
