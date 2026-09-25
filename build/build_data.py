# -*- coding: utf-8 -*-
"""解析官方題庫 PDF，輸出前端用資料。

資料來源（勞動部勞動力發展署技能檢定中心公告，https://owinform.wdasec.gov.tw/）：
  900060A10.pdf  職業安全衛生      V115092210  公告 115.09.22  自 116.01.01 起適用
  900070A19.pdf  工作倫理與職業道德  V115092219  公告 115.09.22  自 116.01.01 起適用

官方為「公開固定題庫、一字不漏抽考」，每科固定 100 題。
因此本腳本對題數採硬性檢查：任一科不等於 100 題即中止建置，
避免解析漏題導致考生練到殘缺題庫（曾發生第 29 題因「29 . (1)」
題號與句點間有空格而被漏掉）。

輸出：build/questions.json、build/meta.json
"""
import json
import os
import re
import sys

import pypdf

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PAPERS = [
    {"file": "900060A10.pdf", "code": "90006", "subject": "職業安全衛生", "short": "職安"},
    {"file": "900070A19.pdf", "code": "90007", "subject": "工作倫理與職業道德", "short": "倫理"},
]

EXPECTED = 100
CIRCLED = "①②③④"

# 題號格式允許「1.」「29 .」「100 .」等空白變體
QUESTION_RE = re.compile(r"(\d{1,3})\s*\.\s*\(\s*([1-4])\s*\)")


TOPICS = {
    "90006": [
        ("勞基法與勞工權益", ["勞動基準法", "工資", "工時", "例假", "休息日", "特別休假", "資遣", "退休金", "職業災害補償", "職災補償", "童工", "女工", "延長工時", "基本工資", "勞工請假", "產假", "陪產", "工讀生", "法定之勞工", "勞動契約", "預告", "勞工代表", "吹哨者", "勞工行政主管機關", "平均工資", "工作規則", "受領補償", "職業災害保險", "勞工保險", "申訴"]),
        ("職安法與管理", ["職業安全衛生法", "安全衛生管理", "職業安全衛生管理", "承攬", "自動檢查", "教育訓練", "工作守則", "安全衛生人員", "職業安全衛生委員會", "母性健康", "勞動檢查", "作業主管", "移動或破壞現場", "工作場所", "勞動場所", "安全衛生之敘述", "型式驗證", "危險性機械", "危險性設備", "職業災害"]),
        ("危害物質與通識", ["危害通識", "安全資料表", "SDS", "GHS", "危害物", "化學品", "有機溶劑", "特定化學", "缺氧", "粉塵", "石綿", "鉛", "毒性物質", "有害物", "毒物", "化學性有害物", "食入", "中毒", "一氧化碳", "危險物", "可燃性氣體", "防爆"]),
        ("物理性危害", ["噪音", "聽力", "振動", "輻射", "採光", "照明", "高溫", "熱危害", "中暑", "通風", "溫度", "氣溫", "分貝"]),
        ("職業病與過勞健康", ["職業病", "健康檢查", "健康管理", "肌肉骨骼", "人因", "過勞", "職業促發", "作業環境監測", "健康服務", "腦心血管", "心肌梗塞", "輪班", "夜間", "疲勞", "工作負荷", "壓力", "睡眠", "憂鬱", "職場暴力", "腕道", "扭腰", "職業上危害因子"]),
        ("防護具與作業安全", ["防護具", "護具", "手套", "安全帶", "安全帽", "耳塞", "耳罩", "口罩", "呼吸防護", "護目鏡", "墜落", "感電", "漏電", "電氣", "電動", "活線", "機械", "衝剪", "護欄", "護蓋", "施工架", "局限空間", "動火", "堆高機", "起重", "吊掛", "吊舉", "合梯", "梯", "搬運", "屋頂", "破布", "油污", "清理機臺", "臨時用電", "鑽孔機", "捲夾", "物體飛落", "崩塌", "被撞"]),
        ("急救與火災逃生", ["急救", "CPR", "心肺復甦", "AED", "灼傷", "燙傷", "燒傷", "止血", "骨折", "脊柱", "頸部", "滅火", "火災", "爆炸", "消防", "逃生", "安全門", "緊急出口", "電梯", "搶救", "嚴禁煙火"]),
    ],
    "90007": [
        ("個人資料保護", ["個人資料", "個資", "隱私"]),
        ("智財與營業秘密", ["智慧財產", "著作權", "專利", "商標", "營業秘密", "著作", "抄襲", "盜版", "還原工程", "重製", "合理使用", "營業機密", "光碟"]),
        ("誠信廉政與反貪", ["貪污", "貪腐", "賄賂", "回扣", "圖利", "採購", "利益衝突", "餽贈", "收受", "廉政", "公務員", "公務機關", "關說", "證人", "反貪", "職務利害關係", "招標", "標案", "背信", "侵占", "公器私用"]),
        ("性別平等與CEDAW", ["性別", "性騷擾", "性別工作平等", "性平", "CEDAW", "婦女", "歧視"]),
        ("菸害與健康法規", ["菸害", "菸品", "吸菸", "電子煙", "戒菸", "禁菸"]),
        ("企業社會責任與永續", ["企業社會責任", "永續", "公司治理", "社會公益", "環境保護", "誠信經營", "利害關係人", "節能", "減碳"]),
        ("職場倫理與敬業", ["職業道德", "職業素養", "敬業", "工作態度", "專業", "服務", "團隊", "責任", "禮節", "禮儀", "情緒", "同事", "上司", "主管", "健保", "勞保", "毀謗", "態度", "職場", "公司的車", "上班期間", "同仁"]),
        ("勞資關係與保密", ["保密", "洩漏", "競業", "離職", "忠誠", "勞資", "契約", "受僱", "併購", "內線"]),
    ],
}


def classify(code, stem):
    for name, kws in TOPICS[code]:
        for kw in kws:
            if kw in stem:
                return name
    return "其他"


def read_text(path):
    reader = pypdf.PdfReader(path)
    return "\n".join((p.extract_text() or "") for p in reader.pages)


def read_header(text):
    """抓出官方版次資訊，作為資料來源標註。"""
    def grab(pattern):
        m = re.search(pattern, text)
        return re.sub(r"\s+", "", m.group(1)) if m else ""
    return {
        "fileName": grab(r"檔案名稱\s*[:：]\s*(\S+)"),
        "version": grab(r"版次編號\s*[:：]\s*(\S+)"),
        "announced": grab(r"公告日期\s*[:：]\s*([\d\s年月日]+)"),
        "effective": grab(r"自\s*([\d\s年月日]+)起報檢者適用"),
    }


def normalize(s):
    s = s.replace("­", "")
    s = re.sub(r"Page\s*\d+\s*of\s*\d+", " ", s)
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"(?<=[一-鿿])\s+(?=[一-鿿])", "", s)
    s = re.sub(r"\s+(?=[，。、；：？！）」])", "", s)
    s = re.sub(r"(?<=[（「])\s+", "", s)
    return s.strip()


def parse(paper):
    path = os.path.join(BASE, paper["file"])
    raw = read_text(path)
    header = read_header(raw)

    marks = list(QUESTION_RE.finditer(raw))
    # 只保留題號嚴格遞增 1..100 的序列，避免內文數字誤判
    kept, expect = [], 1
    for m in marks:
        if int(m.group(1)) == expect:
            kept.append(m)
            expect += 1

    if len(kept) != EXPECTED:
        got = set(int(m.group(1)) for m in kept)
        missing = [i for i in range(1, EXPECTED + 1) if i not in got]
        sys.exit(
            f"建置中止：{paper['file']} 應為 {EXPECTED} 題，實得 {len(kept)} 題，"
            f"缺少題號 {missing}。請檢查 PDF 解析規則。"
        )

    out = []
    prefix = "S" if paper["code"] == "90006" else "E"
    for i, m in enumerate(kept):
        end = kept[i + 1].start() if i + 1 < len(kept) else len(raw)
        body = normalize(raw[m.end():end])

        pos = [body.find(c) for c in CIRCLED]
        if any(p < 0 for p in pos) or pos != sorted(pos):
            sys.exit(f"建置中止：{paper['file']} 第 {m.group(1)} 題選項解析失敗：{body[:120]}")

        stem = body[:pos[0]].strip()
        opts = []
        for j in range(4):
            seg_end = pos[j + 1] if j < 3 else len(body)
            opts.append(re.sub(r"[。\s]+$", "", body[pos[j] + 1:seg_end].strip()))

        if not stem or any(not o for o in opts):
            sys.exit(f"建置中止：{paper['file']} 第 {m.group(1)} 題內容為空")

        num = int(m.group(1))
        out.append({
            "id": f"{prefix}{num:03d}",
            "code": paper["code"],
            "subject": paper["subject"],
            "short": paper["short"],
            "num": num,
            "topic": classify(paper["code"], stem),
            "stem": stem,
            "options": opts,
            "answer": int(m.group(2)),
        })
    return out, header


def main():
    questions = []
    papers_meta = []
    for p in PAPERS:
        qs, header = parse(p)
        print(f"{p['file']}  {p['subject']}  {len(qs)} 題  版次 {header['version']}  {header['effective']}起適用")
        questions.extend(qs)
        papers_meta.append(dict(p, **header, count=len(qs)))

    from collections import defaultdict
    stat_topic = defaultdict(int)
    stat_answer = defaultdict(int)
    for q in questions:
        stat_topic[(q["subject"], q["topic"])] += 1
        stat_answer[q["answer"]] += 1

    print(f"\n合計 {len(questions)} 題")
    print("答案分布：", {k: stat_answer[k] for k in sorted(stat_answer)})
    print("考點分布：")
    for (s, t), n in sorted(stat_topic.items(), key=lambda x: (x[0][0], -x[1])):
        print(f"   [{s}] {t}: {n}")

    meta = {
        "total": len(questions),
        "papers": papers_meta,
        "byTopic": {f"{s}|{t}": n for (s, t), n in stat_topic.items()},
        "answerDist": {str(k): v for k, v in stat_answer.items()},
        "builtFrom": "勞動部勞動力發展署技能檢定中心公告題庫",
    }

    out = os.path.join(BASE, "build")
    with open(os.path.join(out, "questions.json"), "w", encoding="utf-8") as f:
        json.dump(questions, f, ensure_ascii=False, indent=0)
    with open(os.path.join(out, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    print(f"\n輸出 → {out}\\questions.json / meta.json")


if __name__ == "__main__":
    main()
