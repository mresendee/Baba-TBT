// Ponte entre o app e o banco de dados (Upstash Redis, via Vercel Marketplace).
// Cada pelada tem seu próprio "código" — os dados de cada uma ficam isolados
// por um prefixo nas chaves do Redis, então várias peladas podem usar o
// mesmo app/banco sem uma ver os dados da outra.
//
// GET  /api/data?code=XXXXX           -> devolve { players, session, settings, despesas }
// POST /api/data { code, key, value } -> salva uma das chaves: players_pro, session_pro, settings_pro, despesas_pro

const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const ALLOWED_KEYS = ['players_pro', 'session_pro', 'settings_pro', 'despesas_pro'];

// Código especial que mantém compatibilidade com os dados que já existiam
// antes desse sistema de múltiplas peladas (não leva prefixo nenhum).
const LEGACY_CODE = 'BABATBT';

function cleanCode(raw){
  return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}
function keyFor(code, base){
  return code === LEGACY_CODE ? base : `${code}:${base}`;
}

module.exports = async function handler(req, res) {
  try {
    const rawCode = req.method === 'GET' ? (req.query && req.query.code) : (req.body && req.body.code);
    const code = cleanCode(rawCode);
    if (!code) {
      res.status(400).json({ error: 'Código da pelada não informado' });
      return;
    }

    if (req.method === 'GET') {
      const [players, session, settings, despesas] = await Promise.all([
        redis.get(keyFor(code, 'players_pro')),
        redis.get(keyFor(code, 'session_pro')),
        redis.get(keyFor(code, 'settings_pro')),
        redis.get(keyFor(code, 'despesas_pro')),
      ]);
      res.status(200).json({
        players: players || [],
        session: session || null,
        settings: settings || { groupName: 'Minha Pelada' },
        despesas: despesas || [],
      });
      return;
    }

    if (req.method === 'POST') {
      const { key, value } = req.body || {};
      if (!ALLOWED_KEYS.includes(key)) {
        res.status(400).json({ error: 'Chave inválida' });
        return;
      }
      await redis.set(keyFor(code, key), value);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Método não permitido' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro no servidor' });
  }
};
