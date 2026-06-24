const crypto = require('crypto');
const https  = require('https');

const PARTNER_ID  = parseInt(process.env.SHOPEE_PARTNER_ID);
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY;
const BASE_URL    = 'https://partner.shopeemobile.com';

function makeSign(path, timestamp, accessToken, shopId) {
  const base = `${PARTNER_ID}${path}${timestamp}${accessToken}${shopId}`;
  return crypto.createHmac('sha256', PARTNER_KEY).update(base).digest('hex');
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, r => {
      let raw = '';
      r.on('data', c => raw += c);
      r.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({ error: 'parse_error' }); } });
    });
    req.on('error', reject);
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
  if (!token?.access_token) {
    return res.status(401).json({ error: 'not_connected' });
  }
  if (Date.now() > token.expires_at) {
    return res.status(401).json({ error: 'token_expired' });
  }

  const { date_from, date_to } = req.query;
  const nowTs    = Math.floor(Date.now() / 1000);
  const timeFrom = date_from ? Math.floor(new Date(date_from).getTime() / 1000) : nowTs - 86400;
  const timeTo   = date_to   ? Math.floor(new Date(date_to + 'T23:59:59').getTime() / 1000) : nowTs;

  const { shop_id, access_token } = token;
  const timestamp = Math.floor(Date.now() / 1000);

  // Shopee Ads Report API
  const path = '/api/v2/ads/get_shop_performance';
  const sign = makeSign(path, timestamp, access_token, shop_id);

  const url = `${BASE_URL}${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}` +
              `&access_token=${access_token}&shop_id=${shop_id}` +
              `&start_time=${timeFrom}&end_time=${timeTo}&granularity=daily`;

  try {
    const result = await httpsGet(url);

    if (result.error && result.error !== '' && result.error !== '0') {
      // Ads API mungkin tidak tersedia untuk semua seller — kembalikan 0 dengan info
      return res.status(200).json({
        ok: true,
        warning: 'Shopee Ads API tidak tersedia atau tidak ada data iklan untuk periode ini.',
        summary: { total_spend: 0, total_impressions: 0, total_clicks: 0, total_orders_from_ads: 0 },
        daily: [],
      });
    }

    const data    = result.response?.data || [];
    let totalSpend = 0, totalImpressions = 0, totalClicks = 0, totalAdsOrders = 0;

    data.forEach(d => {
      totalSpend       += parseFloat(d.cost || 0);
      totalImpressions += parseInt(d.impression || 0);
      totalClicks      += parseInt(d.click || 0);
      totalAdsOrders   += parseInt(d.order || 0);
    });

    return res.status(200).json({
      ok: true,
      source: 'shopee_ads_api',
      summary: {
        total_spend:           Math.round(totalSpend),
        total_impressions:     totalImpressions,
        total_clicks:          totalClicks,
        total_orders_from_ads: totalAdsOrders,
        ctr: totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : 0,
        cpo: totalAdsOrders  > 0 ? Math.round(totalSpend / totalAdsOrders) : 0,
      },
      daily: data.map(d => ({
        date:        d.date,
        spend:       parseFloat(d.cost || 0),
        impressions: parseInt(d.impression || 0),
        clicks:      parseInt(d.click || 0),
        orders:      parseInt(d.order || 0),
      })),
    });

  } catch (err) {
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
};
