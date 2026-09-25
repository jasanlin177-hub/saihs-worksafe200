/* 工安 × 工作倫理 固定題庫速成站
   資料由 build/assemble.py 注入 QUESTIONS / META */
(function () {
  "use strict";

  var LS = { star: "wsafe.star.v2", done: "wsafe.done.v2", hist: "wsafe.hist.v2", theme: "wsafe.theme.v2", nick: "wsafe.nick.v1", sound: "wsafe.sound.v1", prof: "wsafe.profile.v1", devid: "wsafe.devid.v1", cls: "wsafe.class.v1" };

  function lsGet(k, d) {
    try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 私密視窗：降級為不記憶 */ }
  }

  var starSet = new Set(Array.isArray(lsGet(LS.star, [])) ? lsGet(LS.star, []) : []);
  var KEYS = ["①", "②", "③", "④"];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- 網頁內建確認視窗（取代 window.confirm——某些瀏覽器/預覽環境會
     靜默封鎖原生 confirm()，導致按鈕「看起來沒反應」。這裡自繪彈窗，回傳 Promise） ---------- */
  var modalEl = document.getElementById("modal");
  var modalMsg = document.getElementById("modal-msg");
  var modalYes = document.getElementById("modal-yes");
  var modalNo = document.getElementById("modal-no");
  function askConfirm(msg) {
    return new Promise(function (resolve) {
      modalMsg.textContent = msg;
      modalEl.hidden = false;
      function cleanup(v) {
        modalEl.hidden = true;
        modalYes.removeEventListener("click", onYes);
        modalNo.removeEventListener("click", onNo);
        document.removeEventListener("keydown", onKey);
        resolve(v);
      }
      function onYes() { cleanup(true); }
      function onNo() { cleanup(false); }
      function onKey(e) { if (e.key === "Escape") cleanup(false); if (e.key === "Enter") cleanup(true); }
      modalYes.addEventListener("click", onYes);
      modalNo.addEventListener("click", onNo);
      document.addEventListener("keydown", onKey);
      modalYes.focus();
    });
  }

  /* ---------- 音效（Web Audio 合成，不外連音檔，維持單一 HTML 檔） ----------
     瀏覽器規定必須使用者互動過才能發聲，所以第一次點擊時才建立 AudioContext。 */
  var actx = null, soundOn = lsGet(LS.sound, true) !== false;
  function audio() {
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { actx = new AC(); } catch (e) { return null; }
    }
    if (actx.state === "suspended") actx.resume().catch(function () { });
    return actx;
  }
  // freq: 頻率(Hz)；dur: 長度(秒)；type: 波形；vol: 音量；delay: 延遲(秒)；slideTo: 滑音終點
  function tone(freq, dur, type, vol, delay, slideTo) {
    if (!soundOn) return;
    var a = audio();
    if (!a) return;
    var t0 = a.currentTime + (delay || 0);
    var osc = a.createOscillator(), g = a.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.16, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(a.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }
  var SFX = {
    click: function () { tone(520, 0.05, "square", 0.07); },
    correct: function (combo) {
      var base = 523.25 * Math.pow(1.0595, Math.min(12, (combo || 1) - 1)); // 連擊越高音越亮
      tone(base, 0.09, "square", 0.15, 0);
      tone(base * 1.26, 0.09, "square", 0.15, 0.08);
      tone(base * 1.5, 0.16, "square", 0.15, 0.16);
    },
    wrong: function () {
      tone(190, 0.18, "sawtooth", 0.14, 0, 90);
      tone(140, 0.24, "square", 0.10, 0.06, 70);
    },
    tickLow: function () { tone(880, 0.05, "square", 0.08); },
    tickHigh: function () { tone(1180, 0.06, "square", 0.11); },
    win: function () {
      [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.16, "square", 0.16, i * 0.11); });
      tone(1568, 0.34, "square", 0.14, 0.46);
    },
    lose: function () {
      [392, 330, 262, 196].forEach(function (f, i) { tone(f, 0.2, "sawtooth", 0.13, i * 0.13); });
    },
    start: function () { tone(392, 0.09, "square", 0.13); tone(587, 0.14, "square", 0.13, 0.09); },
    coin: function () { tone(1318, 0.06, "square", 0.13); tone(1760, 0.12, "square", 0.12, 0.05); }
  };
  function toggleSound(on) { soundOn = on; lsSet(LS.sound, on); if (on) SFX.click(); }

  /* ---------- 得分從選項飛向計分板 ----------
     只顯示總分大字，分數在「飛抵計分板」的瞬間才入帳並跳動，做出進帳感。
     fromEl：被點的選項；toEl：計分板數字。 */
  function flyScore(fromEl, toEl, total, mult, onArrive) {
    if (!fromEl || !toEl) { if (onArrive) onArrive(); return; }
    var a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    var el = document.createElement("div");
    el.className = "fly-score" + (total >= 300 ? " big" : "");
    el.innerHTML = "+" + total + (mult > 1 ? '<span class="mx">×' + mult + "</span>" : "");
    el.style.left = (a.left + a.width / 2) + "px";
    el.style.top = (a.top + a.height / 2) + "px";
    document.body.appendChild(el);

    var dx = (b.left + b.width / 2) - (a.left + a.width / 2);
    var dy = (b.top + b.height / 2) - (a.top + a.height / 2);

    // 分三段：① 彈出站住讓人看清楚 ② 再飛向計分板 ③ 抵達入帳
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.add("pop"); });
    });
    setTimeout(function () {
      el.classList.add("go");
      el.style.transform = "translate(calc(-50% + " + dx + "px), calc(-50% + " + dy + "px)) scale(.5)";
      el.style.opacity = "0.1";
    }, 620);                               // 停 0.62 秒再起飛
    setTimeout(function () {
      el.remove();
      if (onArrive) onArrive();            // 飛抵才更新分數
      toEl.classList.remove("bump");
      void toEl.offsetWidth;               // 重置動畫
      toEl.classList.add("bump");
      SFX.coin();
    }, 1720);                              // 0.62 停留 + 1.1 飛行
  }

  function flyMiss(fromEl) {
    if (!fromEl) return;
    var a = fromEl.getBoundingClientRect();
    var el = document.createElement("div");
    el.className = "fly-miss pix";
    el.textContent = "MISS  -1 ❤";
    el.style.left = (a.left + a.width / 2) + "px";
    el.style.top = (a.top + a.height / 2) + "px";
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 1050);
  }

  /* 連擊倍率（參考知識王：連 2 題 ×1.25、連 4 題 ×1.75） */
  function comboMult(c) {
    if (c >= 5) return 2;
    if (c >= 4) return 1.75;
    if (c >= 3) return 1.5;
    if (c >= 2) return 1.25;
    return 1;
  }

  /* ---------- 過關彩帶特效 ---------- */
  function confetti() {
    var host = document.getElementById("fx");
    var colors = ["#00f0ff", "#ff2e97", "#b6ff3b", "#ffd23f", "#9d6bff"];
    for (var i = 0; i < 60; i++) {
      var el = document.createElement("i");
      el.style.left = Math.random() * 100 + "%";
      el.style.background = colors[i % colors.length];
      el.style.animationDuration = (1.6 + Math.random() * 1.2) + "s";
      el.style.animationDelay = (Math.random() * 0.4) + "s";
      el.style.opacity = String(0.7 + Math.random() * 0.3);
      host.appendChild(el);
      (function (node) { setTimeout(function () { node.remove(); }, 3200); })(el);
    }
  }

  /* ---------- COMBO 提示（自我測驗用） ---------- */
  var comboCount = 0;
  var comboTimer = null;
  function showCombo(ok, silent) {
    if (!silent) { if (ok) SFX.correct(comboCount + 1); else SFX.wrong(); }
    var el = document.getElementById("combo");
    if (ok) {
      comboCount++;
      el.textContent = comboCount >= 2 ? "COMBO x" + comboCount + " 🔥" : "答對！";
      el.classList.remove("miss");
    } else {
      comboCount = 0;
      el.textContent = "MISS…";
      el.classList.add("miss");
    }
    el.classList.add("show");
    clearTimeout(comboTimer);
    comboTimer = setTimeout(function () { el.classList.remove("show"); }, 1100);
  }

  /* ================= 進度系統（金幣／經驗值／等級／段位／徽章） =================
     全部存在本機瀏覽器。資料結構刻意設計成可直接上傳雲端排行榜，之後接 API 不用改。 */
  var RANKS = [
    { min: 1, name: "見習生", icon: "🔰", color: "#9fb3c4" },
    { min: 5, name: "青銅", icon: "🥉", color: "#c97b3c" },
    { min: 10, name: "白銀", icon: "🥈", color: "#b8c4d4" },
    { min: 16, name: "黃金", icon: "🥇", color: "#ffd23f" },
    { min: 23, name: "白金", icon: "💎", color: "#7fe7ff" },
    { min: 31, name: "鑽石", icon: "👑", color: "#b6ff3b" },
    { min: 40, name: "工安大師", icon: "🏆", color: "#ff2e97" }
  ];
  // 升到下一級所需 XP：等級越高要越多（100、160、220…）
  function xpForLevel(lv) { return 100 + (lv - 1) * 60; }
  function rankOf(level) {
    var r = RANKS[0];
    for (var i = 0; i < RANKS.length; i++) if (level >= RANKS[i].min) r = RANKS[i];
    return r;
  }

  var BADGES = {
    first_win: { icon: "🎉", name: "初勝", desc: "第一次在 PK 中獲勝" },
    beat_boss: { icon: "🎖️", name: "挑戰教官", desc: "擊敗王教官" },
    streak5: { icon: "🔥", name: "五連勝", desc: "PK 連續獲勝 5 場" },
    combo10: { icon: "⚡", name: "十連擊", desc: "單局連續答對 10 題" },
    perfect_pk: { icon: "💯", name: "完美對戰", desc: "PK 一題都沒答錯" },
    safety_full: { icon: "🦺", name: "職安全破", desc: "職安全範圍拿到滿分" },
    ethics_full: { icon: "🤝", name: "倫理全破", desc: "倫理全範圍拿到滿分" },
    rank_s: { icon: "🌟", name: "S 級評價", desc: "闖關測驗拿到 S 評級" },
    answer100: { icon: "📚", name: "百題達成", desc: "累積答對 100 題" },
    answer500: { icon: "🧠", name: "五百題達成", desc: "累積答對 500 題" },
    day3: { icon: "📅", name: "三日不斷", desc: "連續 3 天有練習" },
    day7: { icon: "🗓️", name: "七日不斷", desc: "連續 7 天有練習" }
  };

  function blankProfile() {
    return {
      nick: "", xp: 0, coins: 0, level: 1,
      totalRight: 0, totalAnswered: 0,
      pkWin: 0, pkLose: 0, pkStreak: 0, pkBestStreak: 0,
      bestExam: 0, maxCombo: 0,
      badges: {}, lastDay: null, dayStreak: 0, days: 0,
      updated: 0
    };
  }
  var profile = (function () {
    var p = lsGet(LS.prof, null);
    if (!p || typeof p !== "object") p = blankProfile();
    var base = blankProfile();
    for (var k in base) if (!(k in p)) p[k] = base[k];   // 舊資料補上新欄位
    return p;
  })();
  function saveProfile() { profile.updated = Date.now(); lsSet(LS.prof, profile); }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  // 每天第一次練習時打卡，計算連續天數
  function checkIn() {
    var t = todayStr();
    if (profile.lastDay === t) return;
    var y = new Date(); y.setDate(y.getDate() - 1);
    var yStr = y.getFullYear() + "-" + String(y.getMonth() + 1).padStart(2, "0") + "-" + String(y.getDate()).padStart(2, "0");
    profile.dayStreak = (profile.lastDay === yStr) ? profile.dayStreak + 1 : 1;
    profile.lastDay = t;
    profile.days++;
    if (profile.dayStreak >= 3) grantBadge("day3");
    if (profile.dayStreak >= 7) grantBadge("day7");
    saveProfile();
  }

  var pendingToasts = [];
  function grantBadge(id) {
    if (profile.badges[id]) return false;
    profile.badges[id] = Date.now();
    pendingToasts.push({ type: "badge", id: id });
    saveProfile();
    return true;
  }
  // 加經驗與金幣，處理升級
  function addXp(xp, coins) {
    profile.xp += xp;
    profile.coins += coins || 0;
    var up = 0;
    while (profile.xp >= xpForLevel(profile.level)) {
      profile.xp -= xpForLevel(profile.level);
      profile.level++;
      up++;
    }
    if (up) pendingToasts.push({ type: "levelup", level: profile.level });
    saveProfile();
    return up;
  }
  function recordAnswers(right, total) {
    profile.totalRight += right;
    profile.totalAnswered += total;
    if (profile.totalRight >= 100) grantBadge("answer100");
    if (profile.totalRight >= 500) grantBadge("answer500");
    saveProfile();
  }

  /* 獎勵提示（升級／徽章）：逐一彈出 */
  function flushToasts() {
    if (!pendingToasts.length) return;
    var t = pendingToasts.shift();
    var el = document.createElement("div");
    el.className = "toast";
    if (t.type === "levelup") {
      var r = rankOf(profile.level);
      el.innerHTML = '<div class="toast-head pix">LEVEL UP!</div>' +
        '<div class="toast-body"><span class="toast-ico">' + r.icon + "</span>" +
        "<div><b>Lv." + profile.level + "　" + esc(r.name) + "</b>" +
        "<small>繼續練習可以解鎖更高段位</small></div></div>";
      SFX.win();
    } else {
      var b = BADGES[t.id];
      el.innerHTML = '<div class="toast-head pix">BADGE GET!</div>' +
        '<div class="toast-body"><span class="toast-ico">' + b.icon + "</span>" +
        "<div><b>" + esc(b.name) + "</b><small>" + esc(b.desc) + "</small></div></div>";
      SFX.correct(4);
    }
    document.body.appendChild(el);
    setTimeout(function () { el.classList.add("out"); }, 2400);
    setTimeout(function () { el.remove(); flushToasts(); }, 2900);
  }

  /* ================= 雲端班級排行榜 =================
     後端是 Netlify Function（/api/leaderboard）+ Netlify Blobs。
     離線、或部署環境沒有 Function 時，整個功能會自動隱藏，不影響其他頁面。
     注意：分數在前端算完才上傳，技術上可被偽造，屬榮譽制。 */
  var LB_API = "/api/leaderboard";

  function deviceId() {
    var id = lsGet(LS.devid, "");
    if (!id) {
      id = "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      lsSet(LS.devid, id);
    }
    return id;
  }
  function getClassName() { return lsGet(LS.cls, "") || ""; }
  function setClassName(v) { lsSet(LS.cls, cleanClass(v)); }
  function cleanClass(v) { return String(v || "").replace(/[<>\s]/g, "").slice(0, 20); }

  function lbPayload() {
    return {
      "class": getClassName(),
      id: deviceId(),
      nick: getNick() || "無名氏",
      level: profile.level, xp: profile.xp, coins: profile.coins,
      totalRight: profile.totalRight, totalAnswered: profile.totalAnswered,
      pkWin: profile.pkWin, pkLose: profile.pkLose,
      pkBestStreak: profile.pkBestStreak, maxCombo: profile.maxCombo,
      bestExam: profile.bestExam, badges: Object.keys(profile.badges).length
    };
  }
  function lbFetch(cls) {
    return fetch(LB_API + "?class=" + encodeURIComponent(cls), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }
  function lbUpload() {
    return fetch(LB_API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(lbPayload())
    }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }

  function renderLeaderboard() {
    var host = document.getElementById("lb-box");
    if (!host) return;
    var cls = getClassName();

    host.innerHTML = '<div class="card"><h3 class="sub" style="margin-top:0">🏫 班級排行榜</h3>' +
      '<p style="color:var(--sub);font-size:14px;margin:0 0 12px">' +
      "輸入<b>同一個班級代號</b>的人會出現在同一張榜上（例如 <code>機一仁</code>）。" +
      "上傳的只有暱稱與成績數字，不含任何個人資料。</p>" +
      '<div class="nick-row"><input id="cls-in" maxlength="20" placeholder="班級代號，例如 機一仁" value="' + esc(cls) + '">' +
      '<button class="btn sm" id="lb-join">' + (cls ? "更新並重新整理" : "加入排行榜") + "</button>" +
      (cls ? '<button class="btn gray sm" id="lb-leave">退出</button>' : "") +
      '<span id="lb-msg" style="font-size:13px"></span></div>' +
      '<div id="lb-list"></div></div>';

    document.getElementById("lb-join").addEventListener("click", function () {
      var v = cleanClass(document.getElementById("cls-in").value);
      if (!v) { document.getElementById("lb-msg").innerHTML = '<span style="color:var(--red)">請先輸入班級代號</span>'; return; }
      setClassName(v);
      syncLeaderboard(true);
    });
    var lv = document.getElementById("lb-leave");
    if (lv) lv.addEventListener("click", function () {
      setClassName("");
      renderLeaderboard();
    });

    if (cls) syncLeaderboard(false);
  }

  function syncLeaderboard(upload) {
    var cls = getClassName();
    var msg = document.getElementById("lb-msg");
    var list = document.getElementById("lb-list");
    if (!cls || !list) return;
    if (msg) msg.innerHTML = '<span style="color:var(--mut)">連線中…</span>';

    var job = upload ? lbUpload() : lbFetch(cls);
    job.then(function (data) {
      if (msg) msg.innerHTML = '<span style="color:var(--lime)">已同步 ✓</span>';
      paintLbRows(list, data.rows || [], data.myRank);
    }).catch(function (err) {
      if (msg) msg.innerHTML = '<span style="color:var(--amber)">目前連不上排行榜</span>';
      list.innerHTML = '<div class="empty" style="padding:22px 10px">' +
        "排行榜需要網路，而且要部署在有開啟 Netlify Functions 的網站上才能用。<br>" +
        '<span style="font-size:12.5px;color:var(--mut)">（' + esc(String(err.message || err)) +
        "）本機開檔或離線時，你的等級與徽章仍會正常累積在這台裝置。</span></div>";
    });
  }

  function paintLbRows(host, rows, myRank) {
    if (!rows.length) {
      host.innerHTML = '<div class="empty" style="padding:22px 10px">這個班級還沒有人上傳成績，你會是第一個。</div>';
      return;
    }
    var me = deviceId();
    var html = '<div class="lb-table">';
    rows.forEach(function (r, i) {
      var rk = rankOf(r.level);
      var mine = r.id === me;
      var medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (i + 1);
      html += '<div class="lb-row' + (mine ? " me" : "") + '">' +
        '<div class="lb-pos">' + medal + "</div>" +
        '<div class="lb-who"><b>' + esc(r.nick) + (mine ? " （你）" : "") + "</b>" +
        '<small>' + rk.icon + " " + esc(rk.name) + "　答對 " + r.totalRight + " 題　PK " + r.pkWin + "勝</small></div>" +
        '<div class="lb-lv"><b>Lv.' + r.level + "</b><small>" + r.badges + " 徽章</small></div></div>";
    });
    html += "</div>";
    if (myRank) html += '<p style="margin:10px 0 0;color:var(--sub);font-size:14px">你目前排第 <b style="color:var(--amber)">' + myRank + "</b> 名</p>";
    host.innerHTML = html;
  }

  /* ================= 來訪人次計數器 =================
     後端同樣是 Netlify Function（/api/counter）。連不上時整個計數器會自動隱藏，
     不會在畫面上留下壞掉的區塊。同一個分頁只計一次，避免切頁面就灌水。 */
  var CNT_API = "/api/counter";
  var counted = { home: false, pk: false };

  function bumpCounter(key, elId) {
    var el = document.getElementById(elId);
    if (!el) return;
    var already = counted[key];
    counted[key] = true;

    var req = already
      ? fetch(CNT_API + "?k=" + key, { cache: "no-store" })
      : fetch(CNT_API, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ k: key })
        });

    req.then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) {
        // 拆成一格一格的數字，做出老式計數器的樣子
        el.innerHTML = String(d.n).padStart(6, "0").split("").map(function (c) {
          return "<b>" + c + "</b>";
        }).join("");
        el.parentElement.classList.remove("hide");
      })
      .catch(function () {
        // 連不上（本機開檔、離線、或沒部署 Function）就整個藏起來
        if (el.parentElement) el.parentElement.classList.add("hide");
      });
  }

  /* ================= 匿名使用統計 =================
     只上報隨機裝置代號與行為次數，不含姓名、班級以外的個資。
     連不上或離線都不影響使用（靜默失敗）。 */
  var ST_API = "/api/stats";
  var answerBuf = [];      // 答題結果暫存，批次送出以免每題都發請求

  function statReport(extra) {
    var body = { id: deviceId() };
    for (var k in extra) body[k] = extra[k];
    body.level = profile.level;
    body.answered = profile.totalAnswered;
    body.right = profile.totalRight;
    if (answerBuf.length) { body.answers = answerBuf.slice(0, 120); answerBuf = []; }
    try {
      fetch(ST_API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true
      }).catch(function () { });
    } catch (e) { /* 忽略 */ }
  }
  function logAnswer(qid, right) {
    answerBuf.push({ qid: qid, right: !!right });
    if (answerBuf.length >= 20) statReport({});
  }
  // 離開頁面前把剩下的答題紀錄送出
  window.addEventListener("pagehide", function () { if (answerBuf.length) statReport({}); });

  /* ---------- 管理報表（網址加 ?admin=通關碼 才會出現） ---------- */
  function maybeShowAdmin() {
    var m = /[?&]admin=([^&#]+)/.exec(location.search);
    if (!m) return;
    var key = decodeURIComponent(m[1]);
    var host = document.createElement("section");
    host.className = "page on";
    host.id = "page-admin";
    host.innerHTML = '<div class="wrap"><h1 class="ph">使用統計報表</h1>' +
      '<p class="lead">匿名統計，僅供改版參考。此頁只有帶通關碼的網址看得到。</p>' +
      '<div id="admin-box"><div class="empty">讀取中…</div></div></div>';
    document.body.insertBefore(host, document.querySelector(".foot"));
    ["home", "bank", "exam", "pk", "hist"].forEach(function (p) {
      var el = document.getElementById("page-" + p);
      if (el) el.classList.remove("on");
    });

    fetch(ST_API + "?key=" + encodeURIComponent(key), { cache: "no-store" })
      .then(function (r) {
        if (r.status === 401) throw new Error("通關碼不正確");
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) { paintAdmin(d); })
      .catch(function (e) {
        document.getElementById("admin-box").innerHTML =
          '<div class="empty" style="color:var(--red)">讀取失敗：' + esc(e.message) + "</div>";
      });
  }

  function paintAdmin(d) {
    var FEAT = { home: "速成讀本", bank: "題庫", exam: "闖關測驗", pk: "PK 對戰", hist: "我的戰績" };
    var html = '<div class="rescards">' +
      '<div class="rescard"><b style="color:var(--cyan)">' + d.users + "</b><span>累計使用人數</span></div>" +
      '<div class="rescard"><b style="color:var(--lime)">' + d.returning + "</b><span>回訪人數</span></div>" +
      '<div class="rescard"><b style="color:var(--amber)">' + d.todayActive + "</b><span>今日使用人數</span></div>" +
      '<div class="rescard"><b style="color:var(--pink)">' + d.avgLevel + "</b><span>平均等級</span></div></div>";

    html += '<div class="rescards">' +
      '<div class="rescard"><b>' + d.avgAnswered + "</b><span>人均答題數</span></div>" +
      '<div class="rescard"><b>' + d.avgAccuracy + "%</b><span>平均正確率</span></div>" +
      '<div class="rescard"><b>' + (d.users ? Math.round(d.returning / d.users * 100) : 0) + "%</b><span>回訪率</span></div></div>";

    // 功能使用次數
    var fk = Object.keys(d.features || {});
    if (fk.length) {
      var fmax = Math.max.apply(null, fk.map(function (k) { return d.features[k]; }));
      html += '<h2 class="sec">各功能使用次數</h2><div class="card">';
      fk.sort(function (a, b) { return d.features[b] - d.features[a]; }).forEach(function (k) {
        html += '<div class="bar"><div class="lab"><b>' + esc(FEAT[k] || k) + "</b><span>" + d.features[k] + " 次</span></div>" +
          '<div class="track"><div class="fill" style="width:' + (d.features[k] / fmax * 100) + '%"></div></div></div>';
      });
      html += "</div>";
    }

    // 每日活躍
    if ((d.daily || []).length) {
      var dmax = Math.max.apply(null, d.daily.map(function (x) { return x.n; }));
      html += '<h2 class="sec">每日使用人數（近 30 天）</h2><div class="card">';
      d.daily.slice().reverse().forEach(function (x) {
        html += '<div class="bar"><div class="lab"><b>' + esc(x.d) + "</b><span>" + x.n + " 人</span></div>" +
          '<div class="track"><div class="fill" style="width:' + (x.n / dmax * 100) + '%"></div></div></div>';
      });
      html += "</div>";
    }

    // 最常答錯題目
    html += '<h2 class="sec">最常答錯的題目 Top 20</h2>';
    if (!(d.topWrong || []).length) {
      html += '<div class="empty">資料還不夠（每題至少要被作答 3 次才會列入）。</div>';
    } else {
      html += '<p class="lead">這是全班的弱點清單，可以拿來決定上課要加強哪裡。</p><div class="card">';
      d.topWrong.forEach(function (w, i) {
        var q = BY_ID_ALL[w.qid];
        html += '<div class="wrongrow"><div class="wr-no">' + (i + 1) + "</div>" +
          '<div class="wr-main"><b>' + (q ? esc(q.short + " 第 " + q.num + " 題") : esc(w.qid)) + "</b>" +
          "<small>" + (q ? esc(q.stem.slice(0, 56)) + (q.stem.length > 56 ? "…" : "") : "") + "</small></div>" +
          '<div class="wr-rate"><b>' + Math.round(w.rate * 100) + "%</b><small>" + w.wrong + "/" + w.shown + " 錯</small></div></div>";
      });
      html += "</div>";
    }
    document.getElementById("admin-box").innerHTML = html;
  }

  var BY_ID_ALL = {};
  QUESTIONS.forEach(function (q) { BY_ID_ALL[q.id] = q; });

  /* ---------- 音效開關 ---------- */
  (function () {
    var btn = document.getElementById("sound");
    function paint() {
      btn.textContent = soundOn ? "🔊" : "🔇";
      btn.title = soundOn ? "音效：開（點一下靜音）" : "音效：靜音（點一下開啟）";
      btn.style.opacity = soundOn ? "1" : ".55";
    }
    paint();
    btn.addEventListener("click", function () { toggleSound(!soundOn); paint(); });
  })();

  /* ---------- 主題 ---------- */
  var savedTheme = lsGet(LS.theme, null);
  if (savedTheme === "light" || savedTheme === "dark") document.documentElement.setAttribute("data-theme", savedTheme);
  document.getElementById("theme").addEventListener("click", function () {
    var cur = document.documentElement.getAttribute("data-theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    var next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    lsSet(LS.theme, next);
  });

  /* ---------- 分頁 ---------- */
  var PAGES = ["home", "bank", "exam", "pk", "hist"];
  var navBtns = [].slice.call(document.querySelectorAll("#nav button"));
  function showPage(name) {
    navBtns.forEach(function (b) { b.classList.toggle("on", b.dataset.p === name); });
    PAGES.forEach(function (p) { document.getElementById("page-" + p).classList.toggle("on", p === name); });
    // 離開 PK 頁就停掉計時器，避免在背景繼續倒數扣血
    if (name !== "pk" && pkState.running) {
      clearInterval(pkState.timer);
      clearTimeout(pkState.cpuTimer);
      pkState.running = false;
    }
    statReport({ page: name });
    if (name === "hist") renderHistory();
    if (name === "exam" && !examState.running) renderExamHome();
    if (name === "pk" && !pkState.running) renderPkHome();
    window.scrollTo(0, 0);
    // 網址帶著戰帖（#vs=…）時不要覆寫 hash，否則同學一重新整理戰帖就不見了
    if (/(^|[#&])vs=/.test(location.hash)) return;
    if (location.hash.slice(1) !== name) history.replaceState(null, "", "#" + name);
  }
  navBtns.forEach(function (b) { b.addEventListener("click", function () { showPage(b.dataset.p); }); });
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-jump]");
    if (t) { showPage(t.dataset.jump); }
  });

  /* ================= 題庫 ================= */
  var SUBJECTS = [], TOPICS_BY_SUBJECT = {};
  QUESTIONS.forEach(function (q) {
    if (SUBJECTS.indexOf(q.subject) < 0) { SUBJECTS.push(q.subject); TOPICS_BY_SUBJECT[q.subject] = []; }
    if (TOPICS_BY_SUBJECT[q.subject].indexOf(q.topic) < 0) TOPICS_BY_SUBJECT[q.subject].push(q.topic);
  });

  var filter = { subject: null, topic: null, search: "", star: false, self: false };

  function buildChips(host, items, key, labelFn, onPick) {
    var glab = host.querySelector(".glab");
    host.innerHTML = "";
    if (glab) host.appendChild(glab);
    function mk(label, val) {
      var b = document.createElement("button");
      b.className = "fchip";
      b.textContent = label;
      b.addEventListener("click", function () {
        filter[key] = val;
        [].forEach.call(host.querySelectorAll(".fchip"), function (c) { c.classList.remove("on"); });
        b.classList.add("on");
        if (onPick) onPick();
        bankShown = BANK_PAGE;
        renderBank();
      });
      return b;
    }
    var all = mk("全部", null);
    all.classList.add("on");
    host.appendChild(all);
    items.forEach(function (it) { host.appendChild(mk(labelFn ? labelFn(it) : it, it)); });
  }

  function refreshTopicChips() {
    var topics = [];
    if (filter.subject) topics = TOPICS_BY_SUBJECT[filter.subject].slice();
    else SUBJECTS.forEach(function (s) {
      TOPICS_BY_SUBJECT[s].forEach(function (t) { if (topics.indexOf(t) < 0) topics.push(t); });
    });
    filter.topic = null;
    buildChips(document.getElementById("f-topic"), topics, "topic");
  }

  buildChips(document.getElementById("f-subject"), SUBJECTS, "subject",
    function (s) { return s === "職業安全衛生" ? "90006 職業安全衛生" : "90007 工作倫理與職業道德"; },
    refreshTopicChips);
  refreshTopicChips();

  document.getElementById("q-search").addEventListener("input", function (e) {
    filter.search = e.target.value.trim(); bankShown = BANK_PAGE; renderBank();
  });
  document.getElementById("q-clear").addEventListener("click", function () {
    document.getElementById("q-search").value = ""; filter.search = ""; bankShown = BANK_PAGE; renderBank();
  });
  ["star", "self"].forEach(function (k) {
    document.getElementById("t-" + k).addEventListener("change", function (e) {
      filter[k] = e.target.checked; bankShown = BANK_PAGE; renderBank();
    });
  });

  function matchFilter(q) {
    if (filter.subject && q.subject !== filter.subject) return false;
    if (filter.topic && q.topic !== filter.topic) return false;
    if (filter.star && !starSet.has(q.id)) return false;
    if (filter.search) {
      var hay = q.stem + " " + q.options.join(" ") + " " + q.num;
      if (hay.indexOf(filter.search) < 0) return false;
    }
    return true;
  }

  function questionCard(q, opt) {
    opt = opt || {};
    var el = document.createElement("div");
    el.className = "q";

    var meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = '<span class="qid">' + esc(q.short) + " 第 " + q.num + " 題</span>" +
      '<span class="pill acc">' + esc(q.short) + "</span>" +
      '<span class="pill">' + esc(q.topic) + "</span>";

    var star = document.createElement("button");
    star.className = "star" + (starSet.has(q.id) ? " on" : "");
    star.textContent = starSet.has(q.id) ? "★" : "☆";
    star.title = "標記這題";
    star.addEventListener("click", function () {
      if (starSet.has(q.id)) starSet.delete(q.id); else starSet.add(q.id);
      star.classList.toggle("on", starSet.has(q.id));
      star.textContent = starSet.has(q.id) ? "★" : "☆";
      lsSet(LS.star, Array.from(starSet));
      if (filter.star) renderBank();
    });
    meta.appendChild(star);
    el.appendChild(meta);

    var stem = document.createElement("div");
    stem.className = "stem";
    stem.textContent = q.stem;
    el.appendChild(stem);

    var box = document.createElement("div");
    box.className = "opts";
    var ansEl = document.createElement("div");
    ansEl.className = "ans" + (opt.self ? "" : " show");
    ansEl.innerHTML = "正確答案：<b>" + KEYS[q.answer - 1] + " " + esc(q.options[q.answer - 1]) + "</b>";

    var answered = false;
    q.options.forEach(function (text, i) {
      var o = document.createElement("div");
      o.className = "opt";
      o.innerHTML = '<span class="k">' + KEYS[i] + "</span><span>" + esc(text) + "</span>";
      if (!opt.self && i + 1 === q.answer) o.classList.add("reveal-c");
      if (opt.self) {
        o.addEventListener("click", function () {
          if (answered) return;
          answered = true;
          var ok = i + 1 === q.answer;
          o.classList.add(ok ? "correct" : "wrong");
          if (!ok) box.children[q.answer - 1].classList.add("correct");
          ansEl.classList.add("show");
          showCombo(ok);
          // 自我測驗也累積進度（少量），鼓勵平常刷題
          checkIn();
          recordAnswers(ok ? 1 : 0, 1);
          addXp(ok ? 3 : 1, ok ? 1 : 0);
          if (comboCount >= 10) grantBadge("combo10");
          logAnswer(q.id, ok);
          if (profile.maxCombo < comboCount) { profile.maxCombo = comboCount; saveProfile(); }
          flushToasts();
          if (!ok && el._openEx) el._openEx();   // 答錯自動展開解析
        });
      }
      box.appendChild(o);
    });
    el.appendChild(box);
    el.appendChild(ansEl);

    if (q.ex) {
      var toggle = document.createElement("button");
      toggle.className = "exbtn";
      toggle.innerHTML = '<span class="cv">▸</span> 看解析';
      var panel = document.createElement("div");
      panel.className = "expanel";
      panel.innerHTML =
        (q.ex.law ? '<div class="exlaw">法源：' + esc(q.ex.law) + "</div>" : "") +
        (q.ex.key ? '<div class="exkey">' + esc(q.ex.key) + "</div>" : "") +
        '<div class="extext">' + esc(q.ex.text).replace(/\n/g, "<br>") + "</div>";
      toggle.addEventListener("click", function () {
        var open = panel.classList.toggle("open");
        toggle.innerHTML = (open ? '<span class="cv">▾</span> 收起解析' : '<span class="cv">▸</span> 看解析');
      });
      el.appendChild(toggle);
      el.appendChild(panel);
      // 自我測驗答錯時自動展開
      el._openEx = function () {
        if (!panel.classList.contains("open")) toggle.click();
      };
    }
    return el;
  }

  var BANK_PAGE = 30, bankShown = BANK_PAGE;

  function renderBank() {
    var list = QUESTIONS.filter(matchFilter);
    var host = document.getElementById("bank-list");
    host.innerHTML = "";
    document.getElementById("bank-count").textContent =
      "符合條件 " + list.length + " 題" + (list.length > bankShown ? "（顯示前 " + bankShown + " 題）" : "");
    if (!list.length) {
      host.innerHTML = '<div class="empty">沒有符合條件的題目。</div>';
      return;
    }
    list.slice(0, bankShown).forEach(function (q) { host.appendChild(questionCard(q, { self: filter.self })); });
    if (list.length > bankShown) {
      var more = document.createElement("button");
      more.className = "btn ghost";
      more.style.cssText = "width:100%;margin-top:12px";
      more.textContent = "載入更多（剩餘 " + (list.length - bankShown) + " 題）";
      more.addEventListener("click", function () { bankShown += BANK_PAGE; renderBank(); });
      host.appendChild(more);
    }
  }
  renderBank();

  (function bankLead() {
    var p = META.papers.map(function (x) { return x.subject + " " + x.count + " 題"; }).join("　");
    document.getElementById("bank-lead").innerHTML =
      "官方公開固定題庫全部 <b>" + META.total + "</b> 題（" + esc(p) + "），" +
      "題號與文字皆與官方 PDF 一致。考題一字不漏從這裡抽，練完就是全範圍。<br>" +
      "答案預設顯示（綠框為正解）；勾選「自我測驗」可隱藏答案、點選項作答。標記的題目存在這台裝置的瀏覽器裡。";
  })();

  /* ================= 測驗 ================= */
  var MODES = {
    s_all: { name: "職安全範圍", n: 100, min: 60, code: "90006", desc: "90006 職業安全衛生官方 100 題全考一輪，每題 1 分。固定題庫就這些，練完等於全範圍。" },
    e_all: { name: "倫理全範圍", n: 100, min: 60, code: "90007", desc: "90007 工作倫理與職業道德官方 100 題全考一輪，每題 1 分。" },
    mix80: { name: "混合模擬", n: 80, min: 100, desc: "比照技檢學科規格：兩科混合隨機抽 80 題，每題 1.25 分、答錯不倒扣。" },
    quick: { name: "快速 40 題", n: 40, min: 25, desc: "兩科混合抽 40 題，每題 2.5 分，適合零碎時間練手感。" },
    star: { name: "標記複習", n: 0, min: 0, desc: "只考你標記過的題目，用來清弱點。" }
  };
  var PASS = 60;

  var examState = { running: false, mode: null, qs: [], ans: [], marks: [], idx: 0, endAt: 0, timer: null };

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pickQuestions(mode) {
    var m = MODES[mode];
    if (mode === "star") return shuffle(QUESTIONS.filter(function (q) { return starSet.has(q.id); }));
    if (m.code) return shuffle(QUESTIONS.filter(function (q) { return q.code === m.code; }));
    var s1 = QUESTIONS.filter(function (q) { return q.code === "90006"; });
    var s2 = QUESTIONS.filter(function (q) { return q.code === "90007"; });
    var half = Math.round(m.n / 2);
    return shuffle(shuffle(s1).slice(0, half).concat(shuffle(s2).slice(0, m.n - half)));
  }

  var MODE_ICON = { s_all: "🦺", e_all: "🤝", mix80: "🎯", quick: "⚡" };

  function renderExamHome() {
    var root = document.getElementById("exam-root");
    var sc = starSet.size;
    var html = '<h1 class="ph">選擇關卡</h1>' +
      '<p class="lead">官方公開固定題庫共 ' + META.total + ' 題，考題一字不漏從中抽出。全部模式皆單選、答錯不倒扣、' + PASS + ' 分過關。</p>' +
      '<div class="modes">';
    ["s_all", "e_all", "mix80", "quick"].forEach(function (k) {
      var m = MODES[k];
      html += '<div class="mode"><span class="lvtag pix">STAGE</span><div class="ico">' + MODE_ICON[k] + '</div><h3>' + m.name + "</h3><p>" + m.desc + "</p>" +
        '<div class="mstat"><div><b>' + m.n + "</b><span>題</span></div>" +
        "<div><b>" + m.min + "</b><span>分鐘</span></div>" +
        "<div><b>" + PASS + "</b><span>分過關</span></div></div>" +
        '<button class="btn" data-start="' + k + '">▶ 開始' + m.name + "</button></div>";
    });
    html += "</div>";
    html += '<div class="card" style="margin-top:18px"><h3 class="sub" style="margin-top:0">⭐ 標記複習關</h3>' +
      '<p style="color:var(--sub);font-size:14.5px;margin:0 0 12px">' +
      (sc ? "你標記了 <b style='color:var(--amber)'>" + sc + "</b> 題，可以只打這些王。"
        : "還沒標記任何題目。到「題庫」頁點題目右上角的 ☆ 即可標記，闖關答錯的題目也能一鍵加入。") + "</p>" +
      (sc ? '<button class="btn pink" data-start="star">▶ 開始標記複習（' + sc + " 題）</button>" : "") + "</div>";
    root.innerHTML = html;
    [].forEach.call(root.querySelectorAll("[data-start]"), function (b) {
      b.addEventListener("click", function () { startExam(b.dataset.start); });
    });
  }

  function startExam(mode) {
    var qs = pickQuestions(mode);
    if (!qs.length) { alert("沒有可用的題目。"); return; }
    var mins = MODES[mode].min || Math.max(10, Math.ceil(qs.length * 0.75));
    examState = {
      running: true, mode: mode, qs: qs,
      ans: new Array(qs.length).fill(0),
      marks: new Array(qs.length).fill(false),
      idx: 0, endAt: Date.now() + mins * 60000, timer: null
    };
    renderExamRun();
    examState.timer = setInterval(tick, 1000);
  }

  function tick() {
    var el = document.getElementById("timer");
    if (!el) return;
    var left = examState.endAt - Date.now();
    if (left <= 0) { clearInterval(examState.timer); finishExam(true); return; }
    var m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    el.textContent = (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
    el.classList.toggle("warn", left < 5 * 60000);
  }

  function renderExamRun() {
    var st = examState;
    document.getElementById("exam-root").innerHTML =
      '<div class="exam-hd"><div class="row">' +
      '<span class="stage pix">STAGE</span>' +
      '<span class="timer" id="timer">--:--</span>' +
      '<div class="prog"><div class="track"><div class="fill" id="pfill"></div></div></div>' +
      '<span class="exam-meta" id="pmeta"></span>' +
      '<div class="hud-btns"><button class="btn gray sm" id="btn-abort">放棄</button>' +
      '<button class="btn pink sm" id="btn-submit">交卷</button></div></div></div>' +
      '<div id="exam-body"></div>' +
      '<div class="exam-foot"><button class="btn gray" id="btn-prev">← 上一題</button>' +
      '<button class="btn gray" id="btn-mark">⚑ 標註</button>' +
      '<button class="btn" id="btn-next">下一題 →</button></div>' +
      '<h3 class="sub">答題狀況</h3><div class="nav-grid" id="navgrid"></div>';

    document.getElementById("btn-prev").addEventListener("click", function () { gotoQ(st.idx - 1); });
    document.getElementById("btn-next").addEventListener("click", function () { gotoQ(st.idx + 1); });
    document.getElementById("btn-mark").addEventListener("click", function () {
      st.marks[st.idx] = !st.marks[st.idx]; renderQ(); renderNavGrid();
    });
    document.getElementById("btn-submit").addEventListener("click", function () {
      var un = st.ans.filter(function (a) { return !a; }).length;
      if (un) {
        askConfirm("還有 " + un + " 題未作答，\n確定交卷嗎？").then(function (yes) {
          if (yes) finishExam(false);
        });
      } else {
        finishExam(false);
      }
    });
    document.getElementById("btn-abort").addEventListener("click", function () {
      askConfirm("放棄本次挑戰？\n作答不會存成績。").then(function (yes) {
        if (!yes) return;
        clearInterval(st.timer); st.running = false; renderExamHome();
      });
    });
    renderQ(); renderNavGrid(); tick();
  }

  function renderQ() {
    var st = examState, q = st.qs[st.idx];
    var body = document.getElementById("exam-body");
    body.innerHTML = "";
    var card = document.createElement("div");
    card.className = "q";
    card.innerHTML = '<div class="meta"><span class="qid">第 ' + (st.idx + 1) + " / " + st.qs.length + " 題</span>" +
      '<span class="pill acc">' + esc(q.short) + "</span>" +
      '<span class="pill">' + esc(q.topic) + "</span></div>" +
      '<div class="stem">' + esc(q.stem) + "</div>";
    var box = document.createElement("div");
    box.className = "opts";
    q.options.forEach(function (text, i) {
      var o = document.createElement("div");
      o.className = "opt" + (st.ans[st.idx] === i + 1 ? " picked" : "");
      o.innerHTML = '<span class="k">' + KEYS[i] + "</span><span>" + esc(text) + "</span>";
      o.addEventListener("click", function () {
        st.ans[st.idx] = i + 1;
        renderQ(); renderNavGrid();
        if (st.idx < st.qs.length - 1) setTimeout(function () { gotoQ(st.idx + 1); }, 160);
      });
      box.appendChild(o);
    });
    card.appendChild(box);
    body.appendChild(card);

    var done = st.ans.filter(Boolean).length;
    document.getElementById("pfill").style.width = (done / st.qs.length * 100) + "%";
    document.getElementById("pmeta").textContent = "已答 " + done + "/" + st.qs.length;
    document.getElementById("btn-mark").textContent = st.marks[st.idx] ? "⚑ 已標註" : "⚑ 標註";
  }

  function gotoQ(i) {
    if (i < 0 || i >= examState.qs.length) return;
    examState.idx = i; renderQ(); renderNavGrid();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderNavGrid() {
    var st = examState, g = document.getElementById("navgrid");
    if (!g) return;
    g.innerHTML = "";
    st.qs.forEach(function (_, i) {
      var b = document.createElement("button");
      b.textContent = i + 1;
      if (st.ans[i]) b.classList.add("done");
      if (i === st.idx) b.classList.add("cur");
      if (st.marks[i]) b.classList.add("mk");
      b.addEventListener("click", function () { gotoQ(i); });
      g.appendChild(b);
    });
  }

  function finishExam(timeUp) {
    var st = examState;
    clearInterval(st.timer);
    st.running = false;
    var per = 100 / st.qs.length, right = 0, wrong = [], tw = {};
    st.qs.forEach(function (q, i) {
      if (st.ans[i] === q.answer) right++;
      else { wrong.push({ q: q, picked: st.ans[i] }); tw[q.topic] = (tw[q.topic] || 0) + 1; }
    });
    var score = Math.round(right * per * 10) / 10;
    var pass = score >= PASS;
    var weak = Object.keys(tw).sort(function (a, b) { return tw[b] - tw[a]; }).slice(0, 3)
      .map(function (k) { return { t: k, n: tw[k] }; });
    var rank = score >= 95 ? "S" : score >= 85 ? "A" : score >= PASS ? "B" : score >= 40 ? "C" : "F";

    /* ---- 進度結算 ---- */
    checkIn();
    var exXp = Math.round(right * 6 + (pass ? 60 : 0) + (rank === "S" ? 80 : 0));
    var exCoin = Math.round(right * 2 + (pass ? 30 : 0));
    recordAnswers(right, st.qs.length);
    st.qs.forEach(function (q, i) { logAnswer(q.id, st.ans[i] === q.answer); });
    if (rank === "S") grantBadge("rank_s");
    if (st.mode === "s_all" && right === st.qs.length) grantBadge("safety_full");
    if (st.mode === "e_all" && right === st.qs.length) grantBadge("ethics_full");
    profile.bestExam = Math.max(profile.bestExam, score);
    addXp(exXp, exCoin);

    var hist = lsGet(LS.hist, []);
    if (!Array.isArray(hist)) hist = [];
    hist.unshift({
      at: Date.now(), mode: st.mode, modeName: MODES[st.mode].name, n: st.qs.length,
      right: right, score: score, pass: pass, timeUp: !!timeUp, weak: weak, rank: rank
    });
    lsSet(LS.hist, hist.slice(0, 60));

    var root = document.getElementById("exam-root");
    root.innerHTML = '<h1 class="ph">' + MODES[st.mode].name + " 結算</h1>" +
      (timeUp ? '<p class="lead" style="color:var(--bad)">⏰ 時間到，系統自動交卷。</p>' : '<p class="lead">已交卷。</p>') +
      '<div class="score-big"><div class="rank ' + rank + ' pix">' + rank + "</div>" +
      '<div class="n ' + (pass ? "pass" : "fail") + '">' + score + "</div>" +
      '<div class="verdict" style="color:' + (pass ? "var(--lime)" : "var(--red)") + '">' + (pass ? "🎉 過關成功" : "💀 挑戰失敗") + "</div>" +
      '<div class="sub">答對 ' + right + " / " + st.qs.length + " 題　每題 " + (Math.round(per * 100) / 100) + " 分　" + PASS + " 分過關</div>" +
      (pass ? '<div class="lvup">LEVEL CLEAR!</div>' : "") + "</div>" +
      '<div class="rescards">' +
      '<div class="rescard"><b style="color:var(--good)">' + right + "</b><span>答對</span></div>" +
      '<div class="rescard"><b style="color:var(--bad)">' + (st.qs.length - right) + "</b><span>答錯／未答</span></div>" +
      '<div class="rescard"><b style="color:var(--acc)">' + Math.round(right / st.qs.length * 100) + "%</b><span>正確率</span></div></div>" +
      '<div class="card" style="border-color:var(--amber)"><h3 class="sub" style="margin-top:0;color:var(--amber)">本次獎勵</h3>' +
      '<div class="prof-coins"><span>⭐ 經驗值 <b class="v">+' + exXp + '</b></span><span>🪙 金幣 <b class="v">+' + exCoin + "</b></span></div>" +
      '<div class="prof-xp"><div class="lab"><span>' + rankOf(profile.level).icon + " Lv." + profile.level +
      " " + esc(rankOf(profile.level).name) + "</span><span>" + profile.xp + " / " + xpForLevel(profile.level) + " XP</span></div>" +
      '<div class="xpbar"><i style="width:' + Math.min(100, profile.xp / xpForLevel(profile.level) * 100) + '%"></i></div></div></div>' +
      (weak.length ? '<div class="card"><h3 class="sub" style="margin-top:0">最需補強的考點</h3>' +
        weak.map(function (w) { return '<span class="pill bad">' + esc(w.t) + " 錯 " + w.n + " 題</span>"; }).join("") + "</div>" : "") +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:16px 0">' +
      '<button class="btn" id="again">再考一次</button>' +
      '<button class="btn ghost" id="backhome">回測驗首頁</button>' +
      (wrong.length ? '<button class="btn gray" id="starwrong">錯題全部加入標記</button>' : "") + "</div>" +
      '<h2 class="sec">題目檢討</h2>' +
      '<div class="rev-bar"><span>答錯 <b style="color:var(--red)">' + wrong.length + '</b> 題／本次共 ' +
      st.qs.length + " 題</span>" +
      '<label><input type="checkbox" id="rev-all2"> 顯示全部題目（含答對的）</label></div>' +
      '<div id="rev-list2"></div>';

    function paintExamReview() {
      var showAll = document.getElementById("rev-all2").checked;
      var host = document.getElementById("rev-list2");
      host.innerHTML = "";
      var list = showAll
        ? st.qs.map(function (q, i) { return { q: q, picked: st.ans[i], right: st.ans[i] === q.answer }; })
        : wrong.map(function (w) { return { q: w.q, picked: w.picked, right: false }; });
      if (!list.length) {
        host.innerHTML = '<div class="empty">🎉 全部答對，沒有錯題！勾上面的選項可以看全部題目。</div>';
        return;
      }
      list.forEach(function (r) {
        var el = questionCard(r.q, { self: false });
        var note = document.createElement("div");
        note.className = r.right ? "good-note" : "trap";
        note.innerHTML = r.right ? "<b>答對</b>"
          : (r.picked ? "<b>你選了</b> " + KEYS[r.picked - 1] + " " + esc(r.q.options[r.picked - 1]) : "<b>未作答</b>");
        el.insertBefore(note, el.querySelector(".exbtn") || null);
        if (!r.right && el._openEx) el._openEx();
        host.appendChild(el);
      });
    }
    document.getElementById("rev-all2").addEventListener("change", paintExamReview);
    paintExamReview();
    setTimeout(flushToasts, 700);
    autoSyncLb();
    if (pass) confetti();

    document.getElementById("again").addEventListener("click", function () { startExam(st.mode); });
    document.getElementById("backhome").addEventListener("click", renderExamHome);
    var sw = document.getElementById("starwrong");
    if (sw) sw.addEventListener("click", function () {
      wrong.forEach(function (w) { starSet.add(w.q.id); });
      lsSet(LS.star, Array.from(starSet));
      sw.textContent = "已加入 " + wrong.length + " 題 ✓";
      sw.disabled = true;
    });
    window.scrollTo(0, 0);
  }

  /* ================= PK 對戰 =================
     設計：回合制搶答。每題 15 秒，雙方同時作答；電腦有模擬思考時間，
     你若比電腦先答對可拿搶答獎勵。答錯扣 1 條命，3 條命用完直接淘汰。
     全部在前端跑，不需要伺服器。 */
  var PK_Q = 10, PK_LIVES = 5;
  var PK_TMIN = 20, PK_TMAX = 70, PK_CPS = 4;   // 每題秒數 = 字數/4，夾在 20～70 秒之間

  // 這兩科題幹與選項都是長串中文（中位 79 字、最長 273 字），固定秒數對長題不公平，
  // 因此依實際字數換算作答時間。實測後由 5 字/秒放寬為 4 字/秒（含思考時間才不會有壓迫感），
  // 上限一併拉到 70 秒，否則最長的題目（273 字）會被上限截斷、等於沒放寬。
  function pkTimeFor(q) {
    var chars = q.stem.length + q.options.reduce(function (a, o) { return a + o.length; }, 0);
    return Math.max(PK_TMIN, Math.min(PK_TMAX, Math.round(chars / PK_CPS)));
  }
  var CPUS = {
    easy: { name: "菜鳥小明", face: "🐣", lv: "LV.1", acc: 0.55, tMin: 5, tMax: 11, desc: "剛學會戴安全帽，常常選到陷阱選項。" },
    mid: { name: "老手阿華", face: "😎", lv: "LV.2", acc: 0.78, tMin: 3, tMax: 8, desc: "做了三年，法規大致熟，偶爾會失手。" },
    hard: { name: "王教官", face: "🎖️", lv: "LV.3", acc: 0.93, tMin: 2, tMax: 5, desc: "題庫背到滾瓜爛熟，想贏他要夠快。" }
  };

  var pkState = { running: false };

  function getNick() {
    var n = lsGet(LS.nick, "");
    return (typeof n === "string" && n.trim()) ? n.trim().slice(0, 12) : "";
  }
  function setNick(v) { lsSet(LS.nick, String(v || "").trim().slice(0, 12)); }

  /* ---- 挑戰連結編碼：把題目在 QUESTIONS 中的索引壓成 base64 ---- */
  function encodeChallenge(qs, score, name) {
    var bytes = new Uint8Array(qs.length);
    for (var i = 0; i < qs.length; i++) bytes[i] = QUESTIONS.indexOf(qs[i]);
    var bin = "";
    for (var j = 0; j < bytes.length; j++) bin += String.fromCharCode(bytes[j]);
    var b64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return location.origin + location.pathname + "#vs=" + b64 + "&s=" + Math.round(score) +
      (name ? "&n=" + encodeURIComponent(name) : "");
  }
  function decodeChallenge(hash) {
    try {
      var m = /vs=([A-Za-z0-9\-_]+)/.exec(hash);
      if (!m) return null;
      var b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      var bin = atob(b64), qs = [];
      for (var i = 0; i < bin.length; i++) {
        var q = QUESTIONS[bin.charCodeAt(i)];
        if (!q) return null;
        qs.push(q);
      }
      if (!qs.length) return null;
      var sm = /[?&#]s=(\d+)/.exec(hash), nm = /[?&#]n=([^&]*)/.exec(hash);
      return {
        qs: qs,
        score: sm ? parseInt(sm[1], 10) : 0,
        name: nm ? decodeURIComponent(nm[1]).slice(0, 12) : "同學"
      };
    } catch (e) { return null; }
  }

  function renderPkHome(challenge) {
    pkState = { running: false };
    var root = document.getElementById("pk-root");
    var nick = getNick();
    var html = "";

    if (challenge) {
      html += '<div class="challenge-banner"><div class="t">CHALLENGE!</div>' +
        '<div class="who">⚔️ <b>' + esc(challenge.name) + '</b> 向你下戰帖</div>' +
        '<div>對方成績　<span class="sc">' + challenge.score + '</span> 分　（' + challenge.qs.length + ' 題）</div>' +
        '<p style="margin:10px 0 0;color:var(--sub);font-size:14px">你會拿到<b>一模一樣的題目</b>，答完直接比分數。</p>' +
        '<button class="btn pink" style="margin-top:12px" id="accept-ch">▶ 接受挑戰</button></div>';
    }

    html += '<h1 class="ph">PK 對戰</h1>' +
      '<p class="lead">' + PK_Q + " 題搶答、雙方各 " + PK_LIVES + " 條命 ❤️。" +
      "每題時間<b>依題目長短自動調整（" + PK_TMIN + "～" + PK_TMAX + " 秒）</b>，長題不會逼你硬讀。<br>" +
      "答對拿分，越快答完速度加成越高，比電腦先答對再加 50 分；答錯扣一條命，扣光直接淘汰。</p>";

    html += '<div class="card"><h3 class="sub" style="margin-top:0">你的暱稱</h3>' +
      '<div class="nick-row"><input id="nick-in" maxlength="12" placeholder="輸入暱稱（最多12字）" value="' + esc(nick) + '">' +
      '<button class="btn gray sm" id="nick-save">儲存</button>' +
      '<span id="nick-msg" style="color:var(--lime);font-size:13px"></span></div>' +
      '<p style="margin:0;color:var(--mut);font-size:13px">暱稱會顯示在對戰畫面，也會出現在你丟給同學的挑戰連結裡。</p></div>';

    html += '<h2 class="sec">選擇對手</h2><div class="cpu-pick">';
    ["easy", "mid", "hard"].forEach(function (k) {
      var c = CPUS[k];
      html += '<div class="cpu-card" data-cpu="' + k + '"><div class="face">' + c.face + "</div>" +
        '<div class="lv">' + c.lv + "</div><h4>" + c.name + "</h4>" +
        "<p>" + c.desc + '</p><div style="margin-top:12px;font-size:12.5px;color:var(--mut)">正確率約 ' +
        Math.round(c.acc * 100) + "%</div></div>";
    });
    html += "</div>";

    html += '<div class="counter hide"><span class="lbl">⚔️ 累計對戰場次</span>' +
      '<span class="digits" id="cnt-pk"></span></div>';

    html += '<div class="card"><h3 class="sub" style="margin-top:0">📨 丟戰帖給同學</h3>' +
      '<p style="color:var(--sub);font-size:14.5px;margin:0 0 12px">先自己打一場，結束後就能產生挑戰連結。' +
      '同學點開會拿到一模一樣的題目，直接比分數——不需要註冊或連線。</p>' +
      '<button class="btn ghost" id="solo-run">▶ 自己跑一輪（產生戰帖）</button></div>';

    root.innerHTML = html;
    bumpCounter("pk", "cnt-pk");      // 只讀取，不加一（加一在開戰時）

    var acc = document.getElementById("accept-ch");
    if (acc) acc.addEventListener("click", function () {
      startPk(null, challenge.qs, challenge);
    });
    document.getElementById("nick-save").addEventListener("click", function () {
      setNick(document.getElementById("nick-in").value);
      document.getElementById("nick-msg").textContent = "已儲存 ✓";
      setTimeout(function () { document.getElementById("nick-msg").textContent = ""; }, 1500);
    });
    [].forEach.call(root.querySelectorAll("[data-cpu]"), function (el) {
      el.addEventListener("click", function () { startPk(el.dataset.cpu, null, null); });
    });
    document.getElementById("solo-run").addEventListener("click", function () {
      startPk(null, null, null);
    });
  }

  function startPk(cpuKey, fixedQs, challenge) {
    // 先清掉上一局殘留的計時器，否則舊的 interval 會變成殭屍持續倒數、
    // 多個計時器疊在一起會讓時間狂跳並自動扣血
    clearInterval(pkState.timer);
    clearTimeout(pkState.cpuTimer);
    SFX.start();
    counted.pk = false;               // 每開一場就讓對戰場次 +1
    bumpCounter("pk", "cnt-pk");
    var qs = fixedQs || shuffle(QUESTIONS.slice()).slice(0, PK_Q);
    pkState = {
      running: true, idx: 0, qs: qs,
      cpu: cpuKey ? CPUS[cpuKey] : null,
      challenge: challenge || null,
      myScore: 0, cpuScore: 0,
      myLives: PK_LIVES, cpuLives: PK_LIVES,
      myRight: 0, cpuRight: 0, combo: 0, maxCombo: 0, log: [],
      locked: false, timer: null, cpuTimer: null, left: 0, total: 0, cpuAnswered: false, cpuCorrect: false
    };
    renderPkRound();
  }

  function pkHearts(n) {
    var s = "";
    for (var i = 0; i < PK_LIVES; i++) s += '<span class="' + (i < n ? "" : "heart-dead") + '">❤️</span>';
    return s;
  }

  function renderPkRound() {
    var st = pkState, q = st.qs[st.idx];
    var oppName = st.cpu ? st.cpu.name : (st.challenge ? st.challenge.name + "（紀錄）" : "無對手");
    var oppFace = st.cpu ? st.cpu.face : (st.challenge ? "🏳️" : "🎯");
    var me = getNick() || "你";

    var html =
      '<div class="vs-bar">' +
      '<div class="vs-side me"><div class="vs-name">🧑 ' + esc(me) + "</div>" +
      '<div class="vs-score" id="my-score">' + st.myScore + "</div>" +
      '<div class="hearts" id="my-hearts">' + pkHearts(st.myLives) + "</div></div>" +
      '<div class="vs-mid">VS</div>' +
      '<div class="vs-side cpu right"><div class="vs-name">' + oppFace + " " + esc(oppName) + "</div>" +
      '<div class="vs-score" id="cpu-score">' + (st.cpu ? st.cpuScore : (st.challenge ? st.challenge.score : "—")) + "</div>" +
      '<div class="hearts" id="cpu-hearts">' + (st.cpu ? pkHearts(st.cpuLives) : "") + "</div></div></div>" +

      '<div class="pk-timer" id="pk-timer">' + pkTimeFor(q) + "</div>" +
      '<div class="pk-tbar"><i id="pk-tbar" style="width:100%"></i></div>' +
      '<div id="pk-body"></div>';

    document.getElementById("pk-root").innerHTML = html;

    var body = document.getElementById("pk-body");
    var card = document.createElement("div");
    card.className = "q";
    card.innerHTML = '<div class="meta"><span class="qid">第 ' + (st.idx + 1) + " / " + st.qs.length + " 題</span>" +
      '<span class="pill acc">' + esc(q.short) + "</span>" +
      '<span class="pill">' + esc(q.topic) + "</span>" +
      (st.combo >= 2 ? '<span class="pill warn">COMBO x' + st.combo + "</span>" : "") + "</div>" +
      '<div class="stem">' + esc(q.stem) + "</div>";
    var box = document.createElement("div");
    box.className = "opts";
    q.options.forEach(function (text, i) {
      var o = document.createElement("div");
      o.className = "opt";
      o.innerHTML = '<span class="k">' + KEYS[i] + "</span><span>" + esc(text) + "</span>";
      o.addEventListener("click", function () { pkAnswer(i + 1, o, box); });
      box.appendChild(o);
    });
    card.appendChild(box);
    if (st.cpu) {
      var th = document.createElement("div");
      th.className = "cpu-think";
      th.id = "cpu-think";
      th.innerHTML = '<span class="dots"><i></i><i></i><i></i></span> ' + esc(st.cpu.name) + " 思考中…";
      card.appendChild(th);
    }
    body.appendChild(card);

    // 計時（每題秒數依題目長度而定）
    st.total = pkTimeFor(q);
    st.left = st.total;
    st.locked = false;
    st.cpuAnswered = false;
    st.myPick = 0;
    clearInterval(st.timer);
    st.timer = setInterval(function () {
      st.left--;
      var t = document.getElementById("pk-timer");
      var bar = document.getElementById("pk-tbar");
      if (!t) { clearInterval(st.timer); return; }
      t.textContent = st.left;
      var hurry = st.left <= 5;
      t.classList.toggle("hurry", hurry);
      if (bar) bar.style.width = (st.left / st.total * 100) + "%";
      if (st.left > 0 && st.left <= 5) SFX.tickHigh();
      else if (st.left > 5 && st.left <= 10) SFX.tickLow();
      if (st.left <= 0) { clearInterval(st.timer); if (!st.locked) pkAnswer(0, null, box); }
    }, 1000);

    // 電腦作答
    if (st.cpu) {
      clearTimeout(st.cpuTimer);
      var think = (st.cpu.tMin + Math.random() * (st.cpu.tMax - st.cpu.tMin)) * 1000;
      st.cpuTimer = setTimeout(function () {
        if (st.locked) return;
        st.cpuAnswered = true;
        st.cpuCorrect = Math.random() < st.cpu.acc;
        var el = document.getElementById("cpu-think");
        if (el) {
          el.innerHTML = "✅ " + esc(st.cpu.name) + " <span class='cpu-done'>已作答</span>";
        }
      }, think);
    }
  }

  function pkAnswer(pick, optEl, box) {
    var st = pkState;
    if (st.locked) return;
    st.locked = true;
    clearInterval(st.timer);
    clearTimeout(st.cpuTimer);
    var q = st.qs[st.idx];
    var right = pick === q.answer;
    var speedLeft = Math.max(0, st.left);

    // 我方結算（計分參考知識王：基礎分＋速度分，再乘上連擊倍率，最後一題加倍）。
    // 速度分用「剩餘比例」而非剩餘秒數，否則長題（70 秒）會比短題（20 秒）容易刷高分。
    var isLast = st.idx === st.qs.length - 1;
    var gain = 0, shownMult = 1;
    if (right) {
      st.myRight++;
      st.combo++;
      st.maxCombo = Math.max(st.maxCombo, st.combo);
      var pct = Math.round(speedLeft / (st.total || PK_TMIN) * 100);
      var snatch = (st.cpu && !st.cpuAnswered) ? 50 : 0;
      shownMult = comboMult(st.combo) * (isLast ? 2 : 1);
      gain = Math.round((100 + pct + snatch) * shownMult);
      SFX.correct(st.combo);
    } else {
      st.combo = 0;
      st.myLives--;
      SFX.wrong();
    }

    // 記下本題作答結果，供結束後的複習區使用
    st.log.push({ q: q, pick: pick, right: right, gain: gain });
    logAnswer(q.id, right);

    // 電腦結算：若玩家搶先答完、電腦還在思考，電腦仍依自己的正確率決定對錯
    // （只是拿不到速度分）。不能因為玩家快就判電腦失敗，否則玩家一快電腦就被秒殺。
    if (st.cpu) {
      var cpuOk;
      if (st.cpuAnswered) {
        cpuOk = st.cpuCorrect;
        if (cpuOk) st.cpuScore += 100 + Math.floor(Math.random() * 60);
      } else if (speedLeft > 0) {
        cpuOk = Math.random() < st.cpu.acc;          // 被搶答：照實力判定，無速度加成
        if (cpuOk) st.cpuScore += 100;
      } else {
        cpuOk = false;                                // 時間到雙方都沒答出來
      }
      if (cpuOk) st.cpuRight++;
      else st.cpuLives--;
    }

    // 標示選項
    if (box) {
      [].forEach.call(box.children, function (c, i) {
        if (i + 1 === q.answer) c.classList.add("correct");
        else if (i + 1 === pick) c.classList.add("wrong");
      });
    }
    var ms = document.getElementById("my-score"), mh = document.getElementById("my-hearts");

    if (right) {
      // 分數不立刻加，等飛抵計分板才入帳（進帳感）
      st.myScore += gain;
      var landed = st.myScore;
      flyScore(optEl || box, ms, gain, shownMult, function () {
        if (ms) ms.textContent = landed;
      });
    } else {
      if (mh) {
        mh.innerHTML = pkHearts(st.myLives);
        mh.classList.remove("hit"); void mh.offsetWidth; mh.classList.add("hit");
      }
      flyMiss(optEl || box);
    }

    // 對手分數照舊即時更新
    if (st.cpu) {
      var cs = document.getElementById("cpu-score"), ch = document.getElementById("cpu-hearts");
      if (cs && cs.textContent !== String(st.cpuScore)) {
        cs.textContent = st.cpuScore;
        cs.classList.remove("bump"); void cs.offsetWidth; cs.classList.add("bump");
      }
      if (ch) ch.innerHTML = pkHearts(st.cpuLives);
    }

    // 停 2 秒再切下一題，讓人看得完得分與正解
    setTimeout(function () {
      st.idx++;
      var over = st.myLives <= 0 || (st.cpu && st.cpuLives <= 0) || st.idx >= st.qs.length;
      if (over) finishPk();
      else renderPkRound();
    }, 2600);   // 得分動畫約 1.7 秒，留 0.9 秒看正解
  }

  function finishPk() {
    var st = pkState;
    st.running = false;
    clearInterval(st.timer);
    clearTimeout(st.cpuTimer);

    var me = getNick() || "你";
    var result, cls, sub;
    if (st.cpu) {
      if (st.myLives <= 0 && st.cpuLives > 0) { result = "YOU LOSE"; cls = "lose"; sub = "生命值歸零，被淘汰了。"; }
      else if (st.cpuLives <= 0 && st.myLives > 0) { result = "YOU WIN!"; cls = "win"; sub = "對手生命值歸零，你贏了！"; }
      else if (st.myScore > st.cpuScore) { result = "YOU WIN!"; cls = "win"; sub = "分數領先，擊敗 " + st.cpu.name + "！"; }
      else if (st.myScore < st.cpuScore) { result = "YOU LOSE"; cls = "lose"; sub = "分數落後，再來一場吧。"; }
      else { result = "DRAW"; cls = "tie"; sub = "平手，難分高下。"; }
    } else if (st.challenge) {
      if (st.myScore > st.challenge.score) { result = "YOU WIN!"; cls = "win"; sub = "你贏過 " + st.challenge.name + " 了！"; }
      else if (st.myScore < st.challenge.score) { result = "YOU LOSE"; cls = "lose"; sub = st.challenge.name + " 分數比較高。"; }
      else { result = "DRAW"; cls = "tie"; sub = "分數完全一樣，太巧了。"; }
    } else {
      result = "FINISH"; cls = "tie"; sub = "自我挑戰完成，可以丟戰帖給同學了。";
    }

    /* ---- 進度結算：經驗值、金幣、連勝、徽章。
           必須在組 HTML 之前算完，否則畫面會印出 undefined ---- */
    checkIn();
    var won = cls === "win";
    var xpGain = won ? 120 : (cls === "tie" ? 70 : 40);
    var coinGain = won ? 60 : (cls === "tie" ? 30 : 15);
    xpGain += st.myRight * 8;                       // 每答對一題再加
    coinGain += st.myRight * 3;
    if (st.cpu) {
      if (won) {
        profile.pkWin++;
        profile.pkStreak++;
        profile.pkBestStreak = Math.max(profile.pkBestStreak, profile.pkStreak);
        if (profile.pkStreak >= 5) grantBadge("streak5");
        grantBadge("first_win");
        if (st.cpu.name === CPUS.hard.name) grantBadge("beat_boss");
        var winBonus = Math.round(profile.pkStreak * 10);   // 連勝加成
        xpGain += winBonus; coinGain += Math.round(winBonus / 2);
      } else if (cls === "lose") {
        profile.pkLose++;
        profile.pkStreak = 0;
      }
    }
    profile.maxCombo = Math.max(profile.maxCombo, st.maxCombo);
    if (st.maxCombo >= 10) grantBadge("combo10");
    if (st.log.length >= PK_Q && st.myRight === st.log.length) grantBadge("perfect_pk");
    recordAnswers(st.myRight, st.log.length);
    addXp(xpGain, coinGain);

    var oppScore = st.cpu ? st.cpuScore : (st.challenge ? st.challenge.score : null);
    var html = '<div class="pk-flash ' + cls + ' pix">' + result + "<small>" + esc(sub) + "</small></div>";

    var rk = rankOf(profile.level);
    html += '<div class="card" style="border-color:var(--amber)"><h3 class="sub" style="margin-top:0;color:var(--amber)">本場獎勵</h3>' +
      '<div class="prof-coins"><span>⭐ 經驗值 <b class="v">+' + xpGain + "</b></span>" +
      '<span>🪙 金幣 <b class="v">+' + coinGain + "</b></span>" +
      (st.cpu && won && profile.pkStreak >= 2 ? '<span>🔥 連勝 <b class="v">' + profile.pkStreak + " 場</b></span>" : "") +
      "</div>" +
      '<div class="prof-xp"><div class="lab"><span>' + rk.icon + " Lv." + profile.level + " " + esc(rk.name) +
      "</span><span>" + profile.xp + " / " + xpForLevel(profile.level) + " XP</span></div>" +
      '<div class="xpbar"><i style="width:' + Math.min(100, profile.xp / xpForLevel(profile.level) * 100) + '%"></i></div></div></div>';

    html += '<div class="rescards">' +
      '<div class="rescard"><b style="color:var(--cyan)">' + st.myScore + "</b><span>你的分數</span></div>" +
      (oppScore !== null ? '<div class="rescard"><b style="color:var(--pink)">' + oppScore + "</b><span>對手分數</span></div>" : "") +
      '<div class="rescard"><b style="color:var(--lime)">' + st.myRight + "/" + st.qs.length + "</b><span>答對題數</span></div>" +
      '<div class="rescard"><b style="color:var(--amber)">x' + st.maxCombo + "</b><span>最高連擊</span></div></div>";

    // 挑戰連結
    var link = encodeChallenge(st.qs, st.myScore, me);
    html += '<div class="card"><h3 class="sub" style="margin-top:0">📨 把這場丟給同學挑戰</h3>' +
      '<p style="color:var(--sub);font-size:14px;margin:0">同學點這個連結，會拿到<b>一模一樣的 ' + st.qs.length +
      ' 題</b>，看誰分數高。</p>' +
      '<div class="share-box"><input id="ch-link" readonly value="' + esc(link) + '">' +
      '<button class="btn sm" id="ch-copy">複製連結</button></div></div>';

    html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:16px 0">' +
      '<button class="btn" id="pk-again">再來一場</button>' +
      '<button class="btn ghost" id="pk-home">回對戰首頁</button></div>';

    var wrongN = st.log.filter(function (r) { return !r.right; }).length;
    html += '<h2 class="sec">本局題目複習</h2>' +
      '<div class="rev-bar"><span>答錯 <b style="color:var(--red)">' + wrongN + '</b> 題／本局共 ' +
      st.log.length + " 題</span>" +
      '<label><input type="checkbox" id="rev-all"> 顯示全部題目（含答對的）</label></div>' +
      '<div id="rev-list"></div>';

    var root = document.getElementById("pk-root");
    root.innerHTML = html;

    function paintReview() {
      var showAll = document.getElementById("rev-all").checked;
      var list = st.log.filter(function (r) { return showAll || !r.right; });
      var host = document.getElementById("rev-list");
      host.innerHTML = "";
      if (!list.length) {
        host.innerHTML = '<div class="empty">🎉 本局全部答對，沒有錯題！勾上面的選項可以看全部題目。</div>';
        return;
      }
      list.forEach(function (r) {
        var el = questionCard(r.q, { self: false });
        var note = document.createElement("div");
        note.className = r.right ? "good-note" : "trap";
        note.innerHTML = r.right
          ? "<b>答對</b>　+" + r.gain + " 分"
          : (r.pick ? "<b>你選了</b> " + KEYS[r.pick - 1] + " " + esc(r.q.options[r.pick - 1]) : "<b>時間到未作答</b>");
        el.insertBefore(note, el.querySelector(".exbtn") || null);
        if (!r.right && el._openEx) el._openEx();   // 答錯的自動展開解析
        host.appendChild(el);
      });
    }
    document.getElementById("rev-all").addEventListener("change", paintReview);
    paintReview();

    if (cls === "win") { confetti(); SFX.win(); }
    else if (cls === "lose") SFX.lose();

    document.getElementById("ch-copy").addEventListener("click", function () {
      var inp = document.getElementById("ch-link");
      inp.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      if (navigator.clipboard) navigator.clipboard.writeText(inp.value).catch(function () { });
      this.textContent = ok || navigator.clipboard ? "已複製 ✓" : "請手動複製";
    });
    document.getElementById("pk-again").addEventListener("click", function () {
      if (st.cpu) {
        var key = Object.keys(CPUS).filter(function (k) { return CPUS[k].name === st.cpu.name; })[0];
        startPk(key, null, null);
      } else { startPk(null, null, null); }
    });
    document.getElementById("pk-home").addEventListener("click", function () { renderPkHome(null); });
    window.scrollTo(0, 0);
    setTimeout(flushToasts, 700);   // 等結算畫面出來再彈升級／徽章
    autoSyncLb();
  }

  /* ================= 成績 ================= */
  function renderHistory() {
    var hist = lsGet(LS.hist, []);
    if (!Array.isArray(hist)) hist = [];
    var sum = document.getElementById("hist-summary"), list = document.getElementById("hist-list");

    /* ---- 進度總覽：段位、等級、經驗值、金幣、徽章 ---- */
    var rk = rankOf(profile.level);
    var nextRank = null;
    for (var i = 0; i < RANKS.length; i++) if (RANKS[i].min > profile.level) { nextRank = RANKS[i]; break; }
    var acc = profile.totalAnswered ? Math.round(profile.totalRight / profile.totalAnswered * 100) : 0;

    var hero = '<div class="prof-hero">' +
      '<div class="prof-rank"><div class="ico">' + rk.icon + '</div><div class="nm" style="color:' + rk.color + '">' + esc(rk.name) + "</div></div>" +
      '<div class="prof-main">' +
      '<div class="prof-lv"><b>Lv.' + profile.level + "</b><span>" + esc(getNick() || "未命名玩家") + "</span></div>" +
      '<div class="prof-xp"><div class="lab"><span>' + profile.xp + " / " + xpForLevel(profile.level) + " XP</span>" +
      "<span>" + (nextRank ? "距離 " + nextRank.icon + nextRank.name + " 還有 " + (nextRank.min - profile.level) + " 級" : "已達最高段位") + "</span></div>" +
      '<div class="xpbar"><i style="width:' + Math.min(100, profile.xp / xpForLevel(profile.level) * 100) + '%"></i></div></div>' +
      '<div class="prof-coins"><span>🪙 金幣 <b class="v">' + profile.coins + "</b></span>" +
      '<span>🔥 連續練習 <b class="v">' + profile.dayStreak + "</b> 天</span>" +
      '<span>⚔️ PK <b class="v">' + profile.pkWin + "勝" + profile.pkLose + "敗</b></span>" +
      "</div></div></div>";

    var stats = '<div class="rescards">' +
      '<div class="rescard"><b style="color:var(--lime)">' + profile.totalRight + "</b><span>累積答對題數</span></div>" +
      '<div class="rescard"><b style="color:var(--cyan)">' + acc + "%</b><span>總正確率</span></div>" +
      '<div class="rescard"><b style="color:var(--amber)">x' + profile.maxCombo + "</b><span>史上最高連擊</span></div>" +
      '<div class="rescard"><b style="color:var(--pink)">' + profile.pkBestStreak + "</b><span>最長連勝</span></div></div>";

    var gotN = Object.keys(profile.badges).length, allN = Object.keys(BADGES).length;
    var badges = '<h2 class="sec">成就徽章（' + gotN + " / " + allN + "）</h2><div class=\"badge-grid\">";
    Object.keys(BADGES).forEach(function (id) {
      var b = BADGES[id], got = !!profile.badges[id];
      badges += '<div class="badge ' + (got ? "got" : "locked") + '"><div class="bi">' + b.icon + "</div>" +
        '<div class="bn">' + esc(b.name) + '</div><div class="bd">' + esc(got ? b.desc : "尚未解鎖") + "</div></div>";
    });
    badges += "</div>";

    if (!hist.length) {
      sum.innerHTML = hero + stats + '<div id="lb-box"></div>' + badges;
      list.innerHTML = '<div class="empty">還沒有測驗紀錄。完成一次闖關或 PK 後，這裡會顯示歷次成績。</div>';
      renderLeaderboard();
      return;
    }
    var best = hist.reduce(function (a, b) { return b.score > a.score ? b : a; });
    var avg = Math.round(hist.reduce(function (a, b) { return a + b.score; }, 0) / hist.length * 10) / 10;
    var passN = hist.filter(function (h) { return h.pass; }).length;
    var agg = {};
    hist.forEach(function (h) { (h.weak || []).forEach(function (w) { agg[w.t] = (agg[w.t] || 0) + w.n; }); });
    var top = Object.keys(agg).sort(function (a, b) { return agg[b] - agg[a]; }).slice(0, 6);

    sum.innerHTML = hero + stats + '<div id="lb-box"></div>' + badges +
      '<h2 class="sec">測驗統計</h2>' +
      '<div class="rescards">' +
      '<div class="rescard"><b style="color:var(--acc)">' + hist.length + "</b><span>測驗次數</span></div>" +
      '<div class="rescard"><b style="color:var(--good)">' + best.score + "</b><span>最佳分數</span></div>" +
      '<div class="rescard"><b>' + avg + "</b><span>平均分數</span></div></div>" +
      '<div class="card"><h3 class="sub" style="margin-top:0">及格率</h3>' +
      "<p style='margin:0;color:var(--sub);font-size:14.5px'>" + passN + " / " + hist.length + " 次及格（" +
      Math.round(passN / hist.length * 100) + "%）</p>" +
      (top.length ? "<h3 class='sub'>累計弱項考點</h3>" +
        top.map(function (t) { return '<span class="pill bad">' + esc(t) + " 錯 " + agg[t] + " 題</span>"; }).join("") : "") +
      "</div>";

    list.innerHTML = "";
    hist.forEach(function (h) {
      var d = new Date(h.at);
      var row = document.createElement("div");
      row.className = "hist-row";
      row.innerHTML = '<div class="hr pix" style="color:' + (h.pass ? "var(--lime)" : "var(--red)") + '">' + (h.rank || (h.pass ? "B" : "F")) + "</div>" +
        '<div class="hs ' + (h.pass ? "pass" : "fail") + '">' + h.score + "</div>" +
        '<div class="hinfo"><div class="ht">' + esc(h.modeName) + "　答對 " + h.right + "/" + h.n + " 題" +
        (h.timeUp ? "　<span style='color:var(--warn)'>逾時自動交卷</span>" : "") + "</div>" +
        '<div class="hd">' + d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate() + " " +
        String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") +
        ((h.weak || []).length ? "　弱項：" + h.weak.map(function (w) { return w.t; }).join("、") : "") + "</div></div>";
      list.appendChild(row);
    });
    renderLeaderboard();
  }

  // 比完賽自動把成績同步到班級排行榜（有設班級代號才送）
  function autoSyncLb() {
    if (!getClassName()) return;
    lbUpload().catch(function () { /* 離線就算了，下次進戰績頁再同步 */ });
  }

  document.getElementById("hist-clear").addEventListener("click", function () {
    askConfirm("確定清除所有戰績紀錄？\n此動作無法復原。").then(function (yes) {
      if (!yes) return;
      lsSet(LS.hist, []);
      renderHistory();
    });
  });

  /* ---------- 啟動 ---------- */
  bumpCounter("home", "cnt-home");    // 來訪人次 +1
  statReport({ newVisit: true, page: "home" });
  maybeShowAdmin();
  var ch = decodeChallenge(location.hash);
  if (ch) {
    // 有人丟戰帖過來：直接跳到 PK 頁並顯示戰帖
    showPage("pk");
    renderPkHome(ch);
  } else {
    var initial = location.hash.slice(1);
    if (PAGES.indexOf(initial) >= 0) showPage(initial);
  }
})();
