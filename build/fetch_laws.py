# -*- coding: utf-8 -*-
"""從全國法規資料庫抓取法規條文，快取到 build/laws/。

目的：撰寫題目解析時，條號與條文內容一律以官方現行條文為準，不憑印象。
抓過的法規會存成 JSON，重跑時直接使用快取，不重複抓取。

用法：
    python build/fetch_laws.py            # 抓取清單中尚未快取的法規
    python build/fetch_laws.py --force    # 全部重抓
"""
import json
import os
import re
import sys
import time
import urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(BASE, "build", "laws")

URL = "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode={}"

# 兩科題目實際會引用到的法規。pcode 取自全國法規資料庫網址。
LAWS = [
    # --- 90006 職業安全衛生 ---
    ("N0060001", "職業安全衛生法"),
    ("N0060002", "職業安全衛生法施行細則"),
    ("N0060009", "職業安全衛生設施規則"),
    ("N0060014", "職業安全衛生教育訓練規則"),
    ("N0060025", "職業安全衛生管理辦法"),
    ("N0030001", "勞動基準法"),
    ("N0030002", "勞動基準法施行細則"),
    ("N0040001", "勞動檢查法"),
    ("N0050022", "勞工職業災害保險及保護法"),
    # --- 90007 工作倫理與職業道德 ---
    ("I0050021", "個人資料保護法"),
    ("J0070017", "著作權法"),
    ("J0070001", "商標法"),
    ("J0070007", "專利法"),
    ("J0080028", "營業秘密法"),
    ("C0000001", "中華民國刑法"),
    ("C0000007", "貪污治罪條例"),
    ("I0070007", "公職人員利益衝突迴避法"),
    ("N0030014", "性別平等工作法"),
    ("D0050074", "性騷擾防治法"),
    ("L0070021", "菸害防制法"),
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Accept-Language": "zh-TW,zh;q=0.9",
}


def fetch(pcode):
    req = urllib.request.Request(URL.format(pcode), headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


def strip_tags(s):
    s = re.sub(r"<script.*?</script>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<style.*?</style>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"</(p|div|li|tr)>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = (s.replace("&nbsp;", " ").replace("&amp;", "&")
          .replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"'))
    s = re.sub(r"[ \t　]+", " ", s)
    s = re.sub(r"\n{2,}", "\n", s)
    return s.strip()


def parse_law(html_text):
    """抽出法規名稱、修正日期與各條條文。"""
    name = ""
    m = re.search(r'<title>(.*?)</title>', html_text, re.S)
    if m:
        name = strip_tags(m.group(1)).replace("-全國法規資料庫", "").strip()

    amended = ""
    m = re.search(r"(中華民國\d+年\d+月\d+日|民國\s*\d+\s*年\s*\d+\s*月\s*\d+\s*日)", html_text)
    if m:
        amended = re.sub(r"\s+", "", m.group(1))

    text = strip_tags(html_text)

    # 以「第 N 條」切分條文
    articles = {}
    parts = re.split(r"\n\s*第\s*([0-9]+(?:-[0-9]+)?)\s*條\s*\n", "\n" + text)
    if len(parts) >= 3:
        for i in range(1, len(parts) - 1, 2):
            num = parts[i]
            body = parts[i + 1].strip()
            body = re.split(r"\n\s*(?:第\s*[一二三四五六七八九十百]+\s*章|附件|編章節)", body)[0]
            body = "\n".join(ln.strip() for ln in body.split("\n") if ln.strip())
            if body and num not in articles:
                articles[num] = body[:2000]
    return {"name": name, "amended": amended, "articles": articles}


def main():
    force = "--force" in sys.argv
    os.makedirs(CACHE, exist_ok=True)
    ok, skip, fail = 0, 0, []
    for pcode, label in LAWS:
        dst = os.path.join(CACHE, f"{pcode}.json")
        if os.path.exists(dst) and not force:
            print(f"  [快取] {label}")
            skip += 1
            continue
        try:
            data = parse_law(fetch(pcode))
            data["pcode"] = pcode
            # label 一律以網站回傳的法規名稱為準，不用清單裡人工寫的名稱，
            # 避免 pcode 猜錯時把條文掛到錯誤的法規名下（曾發生 5 個 pcode 對應到別部法規）
            data["label"] = data["name"] or label
            data["expected"] = label
            n = len(data["articles"])
            if n == 0:
                fail.append((label, pcode, "沒抓到任何條文"))
                print(f"  [失敗] {label}：沒抓到條文")
                continue
            if label not in data["name"] and data["name"] not in label:
                print(f"  [警告] {pcode} 預期「{label}」，實際是「{data['name']}」——pcode 有誤，勿引用")
            with open(dst, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=1)
            print(f"  [成功] {label}　{n} 條　{data['amended']}　→ 標題「{data['name']}」")
            ok += 1
            time.sleep(1.2)  # 對政府網站禮貌一點
        except Exception as e:
            fail.append((label, pcode, str(e)))
            print(f"  [失敗] {label}（{pcode}）：{e}")

    print(f"\n新抓 {ok} 部，使用快取 {skip} 部，失敗 {len(fail)} 部")
    if fail:
        print("失敗清單（pcode 可能有誤，需人工確認）：")
        for label, pcode, err in fail:
            print(f"   {label}  {pcode}  {err}")


if __name__ == "__main__":
    main()
