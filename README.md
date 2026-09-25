# 松山工農 工場安全衛生 × 工作倫理 速成闖關

> 線上版：https://saihs-worksafe200.netlify.app

勞動部技術士技能檢定共同科目**公開固定題庫**的複習與測驗網站，做成電玩闖關風格，讓高職生比較願意練。

## 題庫來源

官方題庫採「公開固定題庫、一字不漏抽考」，每科固定 100 題：

| 科目 | 官方檔名 | 版次 | 適用 | 題數 |
|---|---|---|---|---|
| 90006 職業安全衛生 | `900060A10.pdf` | V115092210 | 116.01.01 起 | 100 |
| 90007 工作倫理與職業道德 | `900070A19.pdf` | V115092219 | 116.01.01 起 | 100 |

題目與答案由官方 PDF 原文解析，**未經改寫**。200 題全部附解析，法條一律先於
[全國法規資料庫](https://law.moj.gov.tw/)查證現行條文後才撰寫，查不到的只寫解題邏輯、不掛條號。

## 功能

- **速成讀本** — 考點分布、答案分布、數字速記表（皆由題庫即時統計，非手寫）
- **題庫檢索** — 搜尋、科目/考點篩選、自我測驗模式、標記
- **闖關測驗** — 分科全範圍／混合 80 題／快速 40 題，S/A/B/C/F 評級
- **PK 對戰** — 三種電腦對手、血量、搶答加成、連擊倍率（參考知識王機制）
- **挑戰連結** — 產生網址丟給同學，考一模一樣的題目比分數（題號編碼進 URL，不需後端）
- **進度系統** — 金幣、經驗值、7 段位、12 種成就徽章、連續練習天數
- **班級排行榜** — 輸入班級代號跨裝置比較
- **使用統計** — 管理者專用報表，含「最常答錯題目 Top 20」
- **PWA** — 可加到手機主畫面、全螢幕、**離線也能刷題**（題庫全數內嵌於 HTML）

## 專案結構

```
.
├── 900060A10.pdf / 900070A19.pdf   官方題庫原始檔（資料來源）
├── netlify.toml                    根目錄設定；自動部署預設跳過（見「部署」）
├── build/                          建置腳本與原始碼
│   ├── build_data.py               PDF → questions.json（含 100 題硬性檢查）
│   ├── assemble.py                 組裝成單一 index.html
│   ├── template.html               HTML/CSS 模板
│   ├── app.js                      前端程式
│   ├── ex/*.json                   200 題解析（分批檔案）
│   ├── laws/*.json                 法規條文快取（查證用）
│   ├── assets/                     均一 LOGO、App 圖示原始檔（icon.svg）
│   └── fetch_laws.py               從全國法規資料庫抓條文
├── deploy/                         Netlify 部署包
│   ├── public/
│   │   ├── index.html              建置產物
│   │   ├── manifest.webmanifest    PWA 設定
│   │   ├── sw.js                   Service Worker（離線快取）
│   │   └── icon-192/512.png        App 圖示
│   ├── netlify/functions/          排行榜、計數器、統計 API
│   └── netlify.toml                publish／functions 路徑、MIME 與快取標頭
└── index.html                      建置產物（與 deploy/public 相同）
```

## 重新建置

```bash
python build/build_data.py     # 解析 PDF（任一科不是 100 題會中止）
python build/assemble.py       # 產生 index.html
cp index.html deploy/public/   # 同步到部署包
```

### ⚠️ 改動題庫或程式後，記得更新 Service Worker 版本

`deploy/public/sw.js` 開頭有：

```js
const VERSION = "v1";
```

HTML 雖然採「網路優先」策略、通常能自動拿到新版，但**改版時仍應把版本號加一**
（`v1` → `v2`），確保所有裝置的舊快取被清除。忘記更新可能導致部分使用者
（特別是已安裝成 App、長時間離線的人）繼續看到舊題庫。

## 部署

**自動部署已在 Netlify 後台關閉**（Build status = Stopped builds），
GitHub push 僅作版控用途，不會觸發部署也不會消耗額度。
要上線一律使用 CLI：

```bash
cd deploy
netlify deploy            # 預覽（0 credits），會給一組臨時網址
netlify deploy --prod     # 正式（15 credits／次）
```

建議流程：本機驗證 → `netlify deploy` 預覽確認 → 才 `--prod` 正式上線。

> 根目錄的 `netlify.toml` 設有 `ignore = "exit 0"`，即使日後重新開啟自動部署，
> 預設也會跳過建置。曾發生後台 publish 路徑被寫成 Windows 絕對路徑而導致
> 自動部署失敗，該欄位現已清空。

### 正式部署後的檢查清單

- `/manifest.webmanifest` 回傳 `application/manifest+json`（不是 octet-stream）
- `/sw.js` 回傳 javascript 且 `Cache-Control: max-age=0`
- `/api/counter`、`/api/leaderboard`、`/api/stats` 皆回 200
- 手機開啟後可「加到主畫面」，安裝後為全螢幕

## 環境變數

在 Netlify 後台 `Site configuration → Environment variables` 設定：

| 變數 | 用途 |
|---|---|
| `STATS_ADMIN_KEY` | 使用統計報表的通關碼。未設定時統計 API 一律拒絕存取。 |

設定時務必勾選 **Contains secret values**，否則該值會顯示在 Netlify 的 UI、API 與
build log 裡。設定後以 `https://<站台網址>/?admin=<通關碼>` 查看報表。

### 忘記通關碼怎麼辦

勾了 secret 之後連自己也看不到值，但**不需要舊密碼就能重設**：

1. Netlify 後台 → `Site configuration → Environment variables`
2. `STATS_ADMIN_KEY` 右側 `Options → Edit`，直接填入新值
3. 重新部署一次才會生效（每次 production deploy 耗 15 credits）

建議平常就把帶通關碼的完整網址存成瀏覽器書籤，避免為了重設密碼而多花一次部署額度。

## Netlify 免費方案額度

| 項目 | 消耗 |
|---|---|
| Production deploy | **15 credits／次**（每月 300 credits，約 20 次） |
| Deploy Preview（`netlify deploy` 不加 `--prod`） | 0 credits |
| Bandwidth | 20 credits／GB |
| Web requests | 2 credits／1 萬次 |

額度用盡會導致**整個站台暫停**，因此請累積多項修改後再一次部署，
並善用免費的 Deploy Preview 驗證。一個班級的日常使用量（約 40 人）
每月僅消耗數個 credits，主要開銷來自部署次數。

## 隱私

- 學習進度、標記、成績存在使用者自己的瀏覽器
- 排行榜只上傳暱稱與成績數字
- 使用統計只記錄隨機產生的裝置代號，不含姓名或 IP
