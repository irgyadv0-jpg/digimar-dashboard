const crypto = require('crypto');

const PARTNER_ID  = parseInt(process.env.SHOPEE_PARTNER_ID);
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY;
const REDIRECT    = process.env.SHOPEE_REDIRECT_URL;
const BASE_URL    = 'https://partner.shopeemobile.com';

function makeSign(path, timestamp) {
  const raw = `${PARTNER_ID}${path}${timestamp}`;
  return crypto.createHmac('sha256', PARTNER_KEY).update(raw).digest('hex');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!PARTNER_ID || !PARTNER_KEY) {
    return res.status(500).json({ error: 'SHOPEE_PARTNER_ID atau SHOPEE_PARTNER_KEY belum diset di environment variables.' });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const path      = '/api/v2/shop/auth_partner';
  const sign      = makeSign(path, timestamp);

  const authUrl = `${BASE_URL}${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(REDIRECT)}`;

  return res.status(200).json({ authUrl });
};
