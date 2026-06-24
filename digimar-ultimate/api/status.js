function parseToken(req) {
  const cookie = req.headers.cookie || '';
  const match  = cookie.match(/shopee_token=([^;]+)/);
  if (!match) return null;
  try { return JSON.parse(Buffer.from(match[1], 'base64').toString()); }
  catch { return null; }
}

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const shopeeToken = parseToken(req);
  const shopeeConnected = !!(shopeeToken?.access_token && Date.now() < shopeeToken.expires_at + 30 * 24 * 60 * 60 * 1000);

  return res.status(200).json({
    shopee: {
      connected:    shopeeConnected,
      shop_id:      shopeeToken?.shop_id || null,
      expires_at:   shopeeToken?.expires_at || null,
      token_valid:  shopeeConnected && Date.now() < shopeeToken?.expires_at,
      connected_at: shopeeToken?.connected_at || null,
    },
    meta: {
      connected: !!(process.env.META_ACCESS_TOKEN),
    },
    tiktok: {
      connected: !!(process.env.TIKTOK_APP_ID),
    },
  });
};
