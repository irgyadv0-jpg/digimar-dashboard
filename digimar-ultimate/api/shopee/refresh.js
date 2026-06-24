const crypto = require('crypto');
const https  = require('https');

const PARTNER_ID  = parseInt(process.env.SHOPEE_PARTNER_ID);
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY;
const BASE_URL    = 'https://partner.shopeemobile.com';

function makeSign(path, timestamp) {
  const base = `${PARTNER_ID}${path}${timestamp}`;
  return crypto.createHmac('sha256', PARTNER_KEY).update(base).digest('hex');
}

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = https.request(opts, r => {
      let raw = '';
      r.on('data', c => raw += c);
      r.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({ error: 'parse_error' }); } });
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

function parseToken(req) {
  const cookie = req.headers.cookie || '';
  const match  = cookie.match(/shopee_token=([^;]+)/);
  if (!match) return null;
  try { return JSON.parse(Buffer.from(match[1], 'base64').toString()); }
  catch { return null; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const token = parseToken(req);
  if (!token?.refresh_token) {
    return res.status(401).json({ error: 'not_connected', message: 'Shopee belum terhubung. Hubungkan dulu via /api/shopee/auth' });
  }

  // Kalau token masih valid (lebih dari 30 menit sisa), tidak perlu refresh
  if (token.expires_at - Date.now() > 30 * 60 * 1000) {
    return res.status(200).json({ ok: true, message: 'Token masih valid', expires_at: token.expires_at });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const path      = '/api/v2/auth/access_token/get';
  const sign      = makeSign(path, timestamp);
  const url       = `${BASE_URL}${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`;

  try {
    const result = await httpsPost(url, {
      refresh_token: token.refresh_token,
      shop_id:       token.shop_id,
      partner_id:    PARTNER_ID,
    });

    if (result.error && result.error !== '') {
      return res.status(400).json({ error: result.error, message: result.message });
    }

    const newToken = {
      ...token,
      access_token: result.access_token,
      refresh_token: result.refresh_token || token.refresh_token,
      expires_at: Date.now() + (result.expire_in || 14400) * 1000,
    };

    const encoded = Buffer.from(JSON.stringify(newToken)).toString('base64');
    res.setHeader('Set-Cookie', `shopee_token=${encoded}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);

    return res.status(200).json({ ok: true, expires_at: newToken.expires_at });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
};
