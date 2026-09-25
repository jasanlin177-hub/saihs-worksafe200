// 使用統計 API（Netlify Function + Netlify Blobs）
//
// POST /api/stats            前端上報（匿名，只記裝置代號與行為次數）
//      body: { id, page?, answers?: [{qid, right}], level?, answered?, right? }
// GET  /api/stats?key=XXXX   讀取彙整報表（需要通關碼，碼寫在這支後端檔案，前端看不到）
//
// 隱私：只存隨機產生的裝置代號，不存姓名、IP、班級以外的任何個人資料。

import { getStore } from "@netlify/blobs";

// 通關碼放在 Netlify 的環境變數 STATS_ADMIN_KEY，不寫在程式碼裡，
// 否則推上公開的 GitHub repo 就等於把密碼公布出去。
// 設定位置：Netlify 後台 → Site configuration → Environment variables
// 若未設定，預設值只供本機測試用，正式站請務必在後台設定。
const ADMIN_KEY = process.env.STATS_ADMIN_KEY || "";

const MAX_USERS = 5000;

function today() {
  return new Date().toISOString().slice(0, 10);
}
function clean(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max);
}

export default async (req) => {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  };

  let store;
  try {
    store = getStore({ name: "stats", consistency: "strong" });
  } catch (e) {
    return new Response(JSON.stringify({ error: "storage_unavailable" }), { status: 503, headers });
  }

  // ---------------- 上報 ----------------
  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch (e) {
      return new Response(JSON.stringify({ error: "bad_json" }), { status: 400, headers });
    }
    const id = clean(body.id, 40);
    if (!id) return new Response(JSON.stringify({ error: "missing_id" }), { status: 400, headers });

    const users = (await store.get("users", { type: "json" })) || {};
    const feats = (await store.get("features", { type: "json" })) || {};
    const wrong = (await store.get("wrong", { type: "json" })) || {};
    const days = (await store.get("days", { type: "json" })) || {};

    const d = today();

    // 使用者（去重）
    const u = users[id] || { first: d, visits: 0, answered: 0, right: 0, level: 1 };
    u.last = d;
    if (body.newVisit) u.visits = (u.visits || 0) + 1;
    if (typeof body.answered === "number") u.answered = Math.max(u.answered || 0, body.answered);
    if (typeof body.right === "number") u.right = Math.max(u.right || 0, body.right);
    if (typeof body.level === "number") u.level = Math.max(u.level || 1, body.level);
    if (Object.keys(users).length < MAX_USERS || users[id]) users[id] = u;

    // 每日活躍人數
    days[d] = days[d] || {};
    days[d][id] = 1;

    // 功能使用次數
    const page = clean(body.page, 12);
    if (page) feats[page] = (feats[page] || 0) + 1;

    // 答題統計：記每題出現與答錯次數
    if (Array.isArray(body.answers)) {
      body.answers.slice(0, 120).forEach((a) => {
        const qid = clean(a && a.qid, 8);
        if (!/^[SE]\d{3}$/.test(qid)) return;
        const w = wrong[qid] || { shown: 0, wrong: 0 };
        w.shown++;
        if (!a.right) w.wrong++;
        wrong[qid] = w;
      });
    }

    await Promise.all([
      store.setJSON("users", users),
      store.setJSON("features", feats),
      store.setJSON("wrong", wrong),
      store.setJSON("days", days)
    ]);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }

  // ---------------- 讀取報表 ----------------
  if (req.method === "GET") {
    const url = new URL(req.url);
    // 沒設定環境變數時一律拒絕，避免通關碼為空字串就被通過
    if (!ADMIN_KEY || url.searchParams.get("key") !== ADMIN_KEY) {
      return new Response(JSON.stringify({
        error: "unauthorized",
        hint: ADMIN_KEY ? undefined : "尚未於 Netlify 後台設定環境變數 STATS_ADMIN_KEY"
      }), { status: 401, headers });
    }

    const users = (await store.get("users", { type: "json" })) || {};
    const feats = (await store.get("features", { type: "json" })) || {};
    const wrong = (await store.get("wrong", { type: "json" })) || {};
    const days = (await store.get("days", { type: "json" })) || {};

    const list = Object.values(users);
    const total = list.length;
    const returning = list.filter((u) => u.first !== u.last).length;
    const answeredSum = list.reduce((a, u) => a + (u.answered || 0), 0);
    const rightSum = list.reduce((a, u) => a + (u.right || 0), 0);
    const levelSum = list.reduce((a, u) => a + (u.level || 1), 0);

    // 每日活躍人數（近 30 天）
    const daily = Object.keys(days).sort().slice(-30).map((k) => ({
      d: k, n: Object.keys(days[k]).length
    }));

    // 最常答錯題目（至少出現 3 次才排，避免樣本太小）
    const topWrong = Object.keys(wrong)
      .map((qid) => {
        const w = wrong[qid];
        return { qid, shown: w.shown, wrong: w.wrong, rate: w.shown ? w.wrong / w.shown : 0 };
      })
      .filter((x) => x.shown >= 3)
      .sort((a, b) => (b.rate - a.rate) || (b.wrong - a.wrong))
      .slice(0, 20);

    return new Response(JSON.stringify({
      users: total,
      returning,
      todayActive: days[today()] ? Object.keys(days[today()]).length : 0,
      avgAnswered: total ? Math.round(answeredSum / total) : 0,
      avgAccuracy: answeredSum ? Math.round(rightSum / answeredSum * 100) : 0,
      avgLevel: total ? Math.round(levelSum / total * 10) / 10 : 0,
      features: feats,
      daily,
      topWrong
    }), { status: 200, headers });
  }

  return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers });
};
