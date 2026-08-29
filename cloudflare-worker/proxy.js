// 73 配置追蹤器 — 自架 CORS 代理
//
// 用途：瀏覽器端不能直接呼叫 Yahoo Finance / TWSE 的股價 API（沒有回傳
// CORS 標頭），這支 Worker 幫忙轉發請求並補上 Access-Control-Allow-Origin，
// 取代原本容易失效／收費的公開代理（corsproxy.io 等）。
//
// 部署方式：Cloudflare Dashboard → Workers & Pages → Create Worker，
// 把這份檔案整份貼進去取代預設內容，按 Deploy。
//
// 用法：GET https://<你的-worker>.workers.dev/?url=<被轉發的網址（需 URL encode）>
// 只允許轉發到下面 ALLOWED_HOSTS 白名單內的網域，避免被當成開放代理濫用。

const ALLOWED_HOSTS = [
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'mis.twse.com.tw',
  'openapi.twse.com.tw',
  'www.twse.com.tw',
];

export default {
  async fetch(request) {
    const reqUrl = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const target = reqUrl.searchParams.get('url');
    if (!target) {
      return json({ error: 'missing url param' }, 400);
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return json({ error: 'invalid url param' }, 400);
    }

    if (!ALLOWED_HOSTS.includes(targetUrl.hostname)) {
      return json({ error: 'host not allowed: ' + targetUrl.hostname }, 403);
    }

    const upstream = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json,text/plain,*/*',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
      },
    });

    const body = await upstream.arrayBuffer();
    const headers = corsHeaders();
    headers.set(
      'Content-Type',
      upstream.headers.get('Content-Type') || 'application/json'
    );

    return new Response(body, { status: upstream.status, headers });
  },
};

function corsHeaders() {
  return new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Cache-Control': 'no-store',
  });
}

function json(obj, status) {
  const headers = corsHeaders();
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(obj), { status, headers });
}
