// POST /api/save
// Body: { roomId?: string, data: object }
// Returns: { roomId: string }
//
// Stores dashboard tab data in Vercel KV (Upstash Redis REST API).
// Requires KV_REST_API_URL and KV_REST_API_TOKEN environment variables,
// which Vercel sets automatically when a KV store is linked to the project.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) {
    return res.status(503).json({ error: 'Live sharing is not configured on this deployment.' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { roomId, data } = body || {};
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Missing or invalid data field' });
  }

  // Reuse provided roomId (update) or generate a new 8-char ID (create).
  const ROOM_ID_RE = /^[a-z0-9]{6,12}$/;
  const id = roomId && ROOM_ID_RE.test(roomId)
    ? roomId
    : Math.random().toString(36).slice(2, 10);

  const key = 'room:' + id;
  const value = JSON.stringify(data);
  const ttl = 60 * 60 * 24 * 365; // 1 year in seconds

  try {
    const resp = await fetch(`${kvUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kvToken}`,
        'Content-Type': 'application/json',
      },
      // SET key value EX ttl
      body: JSON.stringify([['SET', key, value, 'EX', ttl]]),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`KV error ${resp.status}: ${text}`);
    }

    return res.status(200).json({ roomId: id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
