const crypto = require('crypto');
const https  = require('https');

const PARTNER_ID  = parseInt(process.env.SHOPEE_PARTNER_ID);
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY;
const BASE_URL    = 'https://partner.shopeemobile.com';

function makeSign(path, timestamp, accessToken = '', shopId = '') {
  const base = `${PARTNER_ID}${path}${timestamp}${accessToken}${shopId}`;
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
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(opts, r => {
      let raw = '';
      r.on('data', c => raw += c);
      r.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { resolve({ error: 'parse_error', raw }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = async (req, res) => {
  const { code, shop_id } = req.query;

  if (!code || !shop_id) {
    return res.status(400).send(`
      <html><body style="font-family:sans-serif;padding:40px;max-width:500px">
        <h2 style="color:#dc2626">❌ Callback Error</h2>
        <p>Parameter <code>code</code> atau <code>shop_id</code> tidak ditemukan.</p>
        <p>Pastikan Redirect URL di Shopee Open Platform sudah benar.</p>
        <a href="/">← Kembali ke Dashboard</a>
      </body></html>
    `);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const path      = '/api/v2/auth/token/get';
  const sign      = makeSign(path, timestamp);

  const url = `${BASE_URL}${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`;

  try {
    const result = await httpsPost(url, {
      code,
      shop_id:    parseInt(shop_id),
      partner_id: PARTNER_ID,
    });

    if (result.error && result.error !== '') {
      return res.status(400).send(`
        <html><body style="font-family:sans-serif;padding:40px;max-width:500px">
          <h2 style="color:#dc2626">❌ Token Error</h2>
          <p>Shopee mengembalikan error: <code>${result.error}</code></p>
          <p>${result.message || ''}</p>
          <a href="/">← Kembali ke Dashboard</a>
        </body></html>
      `);
    }

    const tokenData = {
      access_token:  result.access_token,
      refresh_token: result.refresh_token,
      shop_id:       parseInt(shop_id),
      expires_at:    Date.now() + (result.expire_in || 14400) * 1000,
      connected_at:  Date.now(),
    };

    const encoded = Buffer.from(JSON.stringify(tokenData)).toString('base64');

    res.setHeader('Set-Cookie', `shopee_token=${encoded}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);

    return res.redirect(302, '/?shopee=connected');
  } catch (err) {
    return res.status(500).send(`
      <html><body style="font-family:sans-serif;padding:40px;max-width:500px">
        <h2 style="color:#dc2626">❌ Server Error</h2>
        <p>${err.message}</p>
        <a href="/">← Kembali ke Dashboard</a>
      </body></html>
    `);
  }
};
