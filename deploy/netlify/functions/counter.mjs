// 來訪人次計數器（Netlify Function + Netlify Blobs）
//
// GET  /api/counter?k=home        只讀取目前數字，不加一
// POST /api/counter   {k:"home"}  加一並回傳新數字
//
// k 只接受白名單內的鍵，避免被亂塞一堆鍵把儲存空間灌爆。

import { getStore } from "@netlify/blobs";

const KEYS = ["home", "pk"];          // home = 網站瀏覽人次，pk = 對戰場次

export default async (req) => {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  };
  const url = new URL(req.url);

  let key = "home";
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body && typeof body.k === "string") key = body.k;
    } catch (e) { /* 沒帶 body 就用預設 */ }
  } else {
    key = url.searchParams.get("k") || "home";
  }
  if (!KEYS.includes(key)) {
    return new Response(JSON.stringify({ error: "bad_key" }), { status: 400, headers });
  }

  let store;
  try {
    store = getStore({ name: "counters", consistency: "strong" });
  } catch (e) {
    return new Response(JSON.stringify({ error: "storage_unavailable" }), { status: 503, headers });
  }

  const current = Number((await store.get(key, { type: "json" }))?.n) || 0;

  if (req.method === "POST") {
    const next = current + 1;
    await store.setJSON(key, { n: next, updated: Date.now() });
    return new Response(JSON.stringify({ k: key, n: next }), { status: 200, headers });
  }

  return new Response(JSON.stringify({ k: key, n: current }), { status: 200, headers });
};

