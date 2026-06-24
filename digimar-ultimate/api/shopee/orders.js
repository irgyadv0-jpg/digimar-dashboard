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
      r.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({ error: 'parse_error', raw }); } });
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

async function getOrderList(shopId, accessToken, timeFrom, timeTo, cursor = '') {
  const timestamp = Math.floor(Date.now() / 1000);
  const path      = '/api/v2/order/get_order_list';
  const sign      = makeSign(path, timestamp, accessToken, shopId);

  let url = `${BASE_URL}${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}` +
            `&access_token=${accessToken}&shop_id=${shopId}` +
            `&time_range_field=create_time&time_from=${timeFrom}&time_to=${timeTo}` +
            `&page_size=50&response_optional_fields=order_status,total_amount,pay_time,item_list`;

  if (cursor) url += `&cursor=${cursor}`;
  return await httpsGet(url);
}

async function getOrderDetails(shopId, accessToken, orderSns) {
  const timestamp = Math.floor(Date.now() / 1000);
  const path      = '/api/v2/order/get_order_detail';
  const sign      = makeSign(path, timestamp, accessToken, shopId);
  const sns       = orderSns.join(',');

  const url = `${BASE_URL}${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}` +
              `&access_token=${accessToken}&shop_id=${shopId}&order_sn_list=${sns}` +
              `&response_optional_fields=item_list,total_amount,buyer_user_id,pay_time,order_status`;

  return await httpsGet(url);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const token = parseToken(req);
  if (!token?.access_token) {
    return res.status(401).json({ error: 'not_connected', message: 'Shopee belum terhubung' });
  }

  // Cek token expired
  if (Date.now() > token.expires_at) {
    return res.status(401).json({ error: 'token_expired', message: 'Token expired, refresh dulu via /api/shopee/refresh' });
  }

  // Parse date range dari query param
  const { date_from, date_to } = req.query;
  const now       = Math.floor(Date.now() / 1000);
  const timeFrom  = date_from ? Math.floor(new Date(date_from).getTime() / 1000) : now - 86400;
  const timeTo    = date_to   ? Math.floor(new Date(date_to + 'T23:59:59').getTime() / 1000) : now;

  // Validasi max range 15 hari (Shopee limit)
  if (timeTo - timeFrom > 15 * 86400) {
    return res.status(400).json({ error: 'range_too_large', message: 'Shopee API maksimal 15 hari per request. Gunakan range lebih kecil.' });
  }

  try {
    const { shop_id, access_token } = token;

    // Ambil semua order (pagination otomatis)
    let allOrders = [], cursor = '', hasMore = true;
    while (hasMore) {
      const result = await getOrderList(shop_id, access_token, timeFrom, timeTo, cursor);

      if (result.error && result.error !== '' && result.error !== '0') {
        return res.status(400).json({ error: result.error, message: result.message || 'Shopee API error' });
      }

      const orderList = result.response?.order_list || [];
      allOrders = allOrders.concat(orderList.map(o => o.order_sn));
      cursor  = result.response?.next_cursor || '';
      hasMore = result.response?.more || false;

      if (allOrders.length >= 200) break; // safety cap
    }

    if (allOrders.length === 0) {
      return res.status(200).json({
        ok: true, source: 'shopee_api',
        date_from: new Date(timeFrom * 1000).toISOString().slice(0,10),
        date_to:   new Date(timeTo   * 1000).toISOString().slice(0,10),
        summary: { total_orders: 0, total_gmv: 0, paid_orders: 0, paid_gmv: 0 },
        orders: [],
      });
    }

    // Ambil detail order (batch 50)
    let detailedOrders = [];
    for (let i = 0; i < allOrders.length; i += 50) {
      const batch  = allOrders.slice(i, i + 50);
      const detail = await getOrderDetails(shop_id, access_token, batch);
      if (detail.response?.order_list) {
        detailedOrders = detailedOrders.concat(detail.response.order_list);
      }
    }

    // Hitung summary
    let totalGmv = 0, paidGmv = 0, paidOrders = 0;
    detailedOrders.forEach(o => {
      const amount = parseFloat(o.total_amount || 0);
      totalGmv += amount;
      if (['PAID','SHIPPED','COMPLETED','IN_CANCEL','CANCELLED_BY_BUYER_BEFORE_ACCEPTANCE'].includes(o.order_status)) {
        // Hanya hitung yang sudah dibayar
        if (o.order_status !== 'CANCELLED_BY_BUYER_BEFORE_ACCEPTANCE') {
          paidGmv += amount;
          paidOrders++;
        }
      }
    });

    return res.status(200).json({
      ok: true,
      source: 'shopee_api',
      shop_id,
      date_from: new Date(timeFrom * 1000).toISOString().slice(0,10),
      date_to:   new Date(timeTo   * 1000).toISOString().slice(0,10),
      summary: {
        total_orders: detailedOrders.length,
        total_gmv:    Math.round(totalGmv),
        paid_orders:  paidOrders,
        paid_gmv:     Math.round(paidGmv),
      },
      orders: detailedOrders.map(o => ({
        order_sn:     o.order_sn,
        status:       o.order_status,
        amount:       parseFloat(o.total_amount || 0),
        pay_time:     o.pay_time,
        create_time:  o.create_time,
        item_count:   o.item_list?.length || 0,
      })),
    });

  } catch (err) {
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
};
