// GET /api/load?room=<roomId>
// Returns: { data: object }
//
// Fetches dashboard tab data from Vercel KV (Upstash Redis REST API).
// Requires KV_REST_API_URL and KV_REST_API_TOKEN environment variables,
// which Vercel sets automatically when a KV store is linked to the project.

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) {
    return res.status(503).json({ error: 'Live sharing is not configured on this deployment.' });
  }

  const ROOM_ID_RE = /^[a-z0-9]{6,12}$/;
  const { room } = req.query;
  if (!room || !ROOM_ID_RE.test(room)) {
    return res.status(400).json({ error: 'Missing or invalid room parameter' });
  }

  const key = 'room:' + room;

  try {
    const resp = await fetch(`${kvUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kvToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([['GET', key]]),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`KV error ${resp.status}: ${text}`);
    }

    const result = await resp.json();
    const raw = result?.[0]?.result;

    if (!raw) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const data = JSON.parse(raw);
    return res.status(200).json({ data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
