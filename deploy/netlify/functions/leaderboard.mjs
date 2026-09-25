// 班級排行榜 API（Netlify Function + Netlify Blobs）
//
// GET  /api/leaderboard?class=機一仁        取回該班排行榜
// POST /api/leaderboard                     上傳／更新自己的成績
//      body: { class, id, nick, level, xp, coins, totalRight, totalAnswered,
//               pkWin, pkLose, pkBestStreak, maxCombo, bestExam, badges }
//
// 注意：分數是在學生瀏覽器算出來後送上來的，技術上可被偽造，
// 這是純前端計分的先天限制，本排行榜以「榮譽制」使用。
// 伺服器這邊只做基本合理性檢查，擋掉明顯灌水的數值。

import { getStore } from "@netlify/blobs";

const MAX_CLASS_LEN = 20;
const MAX_NICK_LEN = 12;
const MAX_ENTRIES = 300;          // 單一班級最多保留幾筆
const TOTAL_QUESTIONS = 200;

function clampInt(v, lo, hi) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function cleanText(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max);
}

// 擋掉明顯不合理的數值（例如等級 9999、答對題數比作答數還多）
function sanitize(body) {
  const totalAnswered = clampInt(body.totalAnswered, 0, 200000);
  const totalRight = Math.min(totalAnswered, clampInt(body.totalRight, 0, 200000));
  const pkWin = clampInt(body.pkWin, 0, 100000);
  const pkLose = clampInt(body.pkLose, 0, 100000);
  return {
    id: cleanText(body.id, 40),
    nick: cleanText(body.nick, MAX_NICK_LEN) || "無名氏",
    level: clampInt(body.level, 1, 200),
    xp: clampInt(body.xp, 0, 100000),
    coins: clampInt(body.coins, 0, 10000000),
    totalRight,
    totalAnswered,
    pkWin,
    pkLose,
    pkBestStreak: Math.min(pkWin, clampInt(body.pkBestStreak, 0, 100000)),
    maxCombo: clampInt(body.maxCombo, 0, TOTAL_QUESTIONS),
    bestExam: clampInt(body.bestExam, 0, 100),
    badges: clampInt(body.badges, 0, 100),
    updated: Date.now()
  };
}

export default async (req) => {
  const url = new URL(req.url);
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  };

  let store;
  try {
    store = getStore({ name: "leaderboard", consistency: "strong" });
  } catch (e) {
    return new Response(JSON.stringify({ error: "storage_unavailable", detail: String(e && e.message) }),
      { status: 503, headers });
  }

  // ---------- 讀取排行榜 ----------
  if (req.method === "GET") {
    const cls = cleanText(url.searchParams.get("class"), MAX_CLASS_LEN) || "default";
    const rows = (await store.get(cls, { type: "json" })) || [];
    rows.sort((a, b) => (b.level - a.level) || (b.xp - a.xp) || (b.totalRight - a.totalRight));
    return new Response(JSON.stringify({ class: cls, count: rows.length, rows: rows.slice(0, 100) }),
      { status: 200, headers });
  }

  // ---------- 上傳成績 ----------
  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "bad_json" }), { status: 400, headers });
    }

    const cls = cleanText(body.class, MAX_CLASS_LEN) || "default";
    const entry = sanitize(body);
    if (!entry.id) {
      return new Response(JSON.stringify({ error: "missing_id" }), { status: 400, headers });
    }

    const rows = (await store.get(cls, { type: "json" })) || [];
    const i = rows.findIndex((r) => r.id === entry.id);
    if (i >= 0) rows[i] = entry; else rows.push(entry);

    // 超量時，砍掉最久沒更新的
    rows.sort((a, b) => b.updated - a.updated);
    const kept = rows.slice(0, MAX_ENTRIES);

    await store.setJSON(cls, kept);

    kept.sort((a, b) => (b.level - a.level) || (b.xp - a.xp) || (b.totalRight - a.totalRight));
    const myRank = kept.findIndex((r) => r.id === entry.id) + 1;
    return new Response(JSON.stringify({ ok: true, class: cls, myRank, count: kept.length, rows: kept.slice(0, 100) }),
      { status: 200, headers });
  }

  return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers });
};

