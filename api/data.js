// Ponte entre o app e o banco de dados (Upstash Redis, via Vercel Marketplace).
// GET  /api/data                -> devolve { players, session, settings }
// POST /api/data { key, value } -> salva uma das chaves: players_pro, session_pro, settings_pro

const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const ALLOWED_KEYS = ['players_pro', 'session_pro', 'settings_pro'];

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const [players, session, settings] = await Promise.all([
        redis.get('players_pro'),
        redis.get('session_pro'),
        redis.get('settings_pro'),
      ]);
      res.status(200).json({
        players: players || [],
        session: session || null,
        settings: settings || { groupName: 'Baba TBT' },
      });
      return;
    }

    if (req.method === 'POST') {
      const { key, value } = req.body || {};
      if (!ALLOWED_KEYS.includes(key)) {
        res.status(400).json({ error: 'Chave inválida' });
        return;
      }
      await redis.set(key, value);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Método não permitido' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro no servidor' });
  }
};
