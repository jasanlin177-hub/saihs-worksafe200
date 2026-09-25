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

## 專案結構

```
.
├── 900060A10.pdf / 900070A19.pdf   官方題庫原始檔（資料來源）
├── build/                          建置腳本與原始碼
│   ├── build_data.py               PDF → questions.json（含 100 題硬性檢查）
│   ├── assemble.py                 組裝成單一 index.html
│   ├── template.html               HTML/CSS 模板
│   ├── app.js                      前端程式
│   ├── ex/*.json                   200 題解析（分批檔案）
│   ├── laws/*.json                 法規條文快取（查證用）
│   └── fetch_laws.py               從全國法規資料庫抓條文
├── deploy/                         Netlify 部署包
│   ├── public/index.html           建置產物
│   ├── netlify/functions/          排行榜、計數器、統計 API
│   └── netlify.toml
└── index.html                      建置產物（與 deploy/public 相同）
```

## 重新建置

```bash
python build/build_data.py     # 解析 PDF（任一科不是 100 題會中止）
python build/assemble.py       # 產生 index.html
cp index.html deploy/public/   # 同步到部署包
```

## 部署

```bash
cd deploy
netlify deploy            # 預覽（0 credits）
netlify deploy --prod     # 正式（15 credits／次，免費方案每月上限 20 次）
```

## 環境變數

在 Netlify 後台 `Site configuration → Environment variables` 設定：

| 變數 | 用途 |
|---|---|
| `STATS_ADMIN_KEY` | 使用統計報表的通關碼。未設定時統計 API 一律拒絕存取。 |

設定後以 `https://<站台網址>/?admin=<通關碼>` 查看報表。

## 隱私

- 學習進度、標記、成績存在使用者自己的瀏覽器
- 排行榜只上傳暱稱與成績數字
- 使用統計只記錄隨機產生的裝置代號，不含姓名或 IP
