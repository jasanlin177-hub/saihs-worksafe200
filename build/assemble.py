# -*- coding: utf-8 -*-
"""組裝單一 HTML 檔。

把 questions.json / meta.json / app.js 注入 template.html，輸出專案根目錄的 index.html。
讀本中所有統計數字皆由資料即時計算，不手寫，避免數字與題庫脫節。
"""
import html
import json
import os
import re
from collections import defaultdict

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(BASE, "build")


def load(name):
    with open(os.path.join(B, name), encoding="utf-8") as f:
        return json.load(f)


def data_uri(relpath, mime):
    """把小圖檔轉成 data URI 內嵌，維持單一 HTML 檔可離線使用。"""
    import base64
    with open(os.path.join(B, relpath), "rb") as f:
        return "data:%s;base64,%s" % (mime, base64.b64encode(f.read()).decode("ascii"))


# 均一官方 LOGO（白色版，取自其官方媒體素材頁提供之檔案，原樣使用未變形改色）
LOGO_JUNYI = data_uri(os.path.join("assets", "junyi-logo-white.png"), "image/png")


def esc(s):
    return html.escape(str(s), quote=False)


def bars(pairs, total):
    """考點分布長條圖。pairs: [(名稱, 題數)]，已排序。"""
    out = []
    mx = max(n for _, n in pairs) if pairs else 1
    for name, n in pairs:
        pct = n / total * 100
        out.append(
            f'<div class="bar"><div class="lab"><b>{esc(name)}</b>'
            f'<span>{n} 題 · {pct:.0f}%</span></div>'
            f'<div class="track"><div class="fill" style="width:{n/mx*100:.1f}%"></div></div></div>'
        )
    return "".join(out)


def find_q(questions, code, num):
    for q in questions:
        if q["code"] == code and q["num"] == num:
            return q
    return None


def numeric_table(questions, code):
    """自動抽出數字/門檻題，生成速記表。內容全部來自題目正解。"""
    pat = re.compile(r"(幾年|幾小時|幾日|幾人|幾個|多少|幾分|幾歲|幾次|分貝|罰鍰|多少元)")
    rows = []
    for q in questions:
        if q["code"] != code or not pat.search(q["stem"]):
            continue
        stem = re.sub(r"^依據?", "", q["stem"])
        stem = re.sub(r"[，,].*?規定[，,]?", "", stem, count=1) if "規定" in stem[:30] else stem
        ans = q["options"][q["answer"] - 1]
        rows.append((q["num"], stem.strip(), ans))
    if not rows:
        return ""
    body = "".join(
        f'<tr><td style="color:var(--mut);white-space:nowrap">第 {n} 題</td>'
        f"<td>{esc(s)}</td><td class=\"num\">{esc(a)}</td></tr>"
        for n, s, a in rows
    )
    return (
        '<table><thead><tr><th>官方題號</th><th>題目</th><th>答案</th></tr></thead>'
        f"<tbody>{body}</tbody></table>"
    )


def negative_stats(questions, code):
    """統計否定型問法（何者錯誤／何者非／有誤）的比例。"""
    pat = re.compile(r"(錯誤|何者非|有誤|不是|不正確|不屬|非屬|不宜|不應|不включ)")
    n = sum(1 for q in questions if q["code"] == code and pat.search(q["stem"]))
    return n


def build_home(questions, meta):
    total = len(questions)
    safety = [q for q in questions if q["code"] == "90006"]
    ethics = [q for q in questions if q["code"] == "90007"]

    papers = {p["code"]: p for p in meta["papers"]}
    ps, pe = papers["90006"], papers["90007"]

    # 考點分布
    def topic_pairs(qs):
        d = defaultdict(int)
        for q in qs:
            d[q["topic"]] += 1
        return sorted(d.items(), key=lambda x: -x[1])

    # 答案分布
    adist = defaultdict(int)
    for q in questions:
        adist[q["answer"]] += 1
    circled = ["①", "②", "③", "④"]
    amax = max(adist.values())
    amin = min(adist.values())
    amax_k = [k for k in sorted(adist) if adist[k] == amax][0]
    amin_k = [k for k in sorted(adist) if adist[k] == amin][0]
    arow = "".join(
        f'<tr><td class="num">{circled[k-1]}</td><td>{adist[k]} 題</td>'
        f'<td>{adist[k]/total*100:.1f}%</td></tr>' for k in sorted(adist)
    )

    neg_s, neg_e = negative_stats(questions, "90006"), negative_stats(questions, "90007")
    neg_all = neg_s + neg_e

    h = []
    h.append('<h1 class="ph">先看這裡：三分鐘搞懂怎麼準備</h1>')
    h.append(
        '<p class="lead">這不是一般考試。勞動部技能檢定的共同科目採<b>公開固定題庫</b>，'
        f'考題<b>一字不漏</b>從這 {total} 題裡抽，不會出現題庫以外的題目。'
        '所以最有效率的作法是<b>直接把題目和答案練熟</b>，不需要去啃法規條文。</p>'
    )

    h.append('<div class="card"><h3 class="sub" style="margin-top:0">本站使用的官方題庫版本</h3>'
             '<table><thead><tr><th>科目</th><th>官方檔名</th><th>版次</th><th>公告日期</th><th>適用</th><th>題數</th></tr></thead><tbody>'
             f'<tr><td>90006 職業安全衛生</td><td>{esc(ps["fileName"])}</td><td>{esc(ps["version"])}</td>'
             f'<td>{esc(ps["announced"])}</td><td>{esc(ps["effective"])}起</td><td class="num">{ps["count"]} 題</td></tr>'
             f'<tr><td>90007 工作倫理與職業道德</td><td>{esc(pe["fileName"])}</td><td>{esc(pe["version"])}</td>'
             f'<td>{esc(pe["announced"])}</td><td>{esc(pe["effective"])}起</td><td class="num">{pe["count"]} 題</td></tr>'
             '</tbody></table>'
             '<p style="color:var(--mut);font-size:13px;margin:8px 0 0">'
             '資料來源：勞動部勞動力發展署技能檢定中心公告之學科測試參考資料。'
             '本站題目與答案均由官方 PDF 原文解析，未經改寫。</p></div>')

    h.append('<h2 class="sec">三步驟讀法</h2>')
    h.append(
        '<div class="card">'
        '<h3 class="sub" style="margin-top:0">第 1 步　用「題庫」頁把 200 題看過一遍</h3>'
        '<p style="color:var(--sub);margin:0 0 14px;font-size:14.5px">'
        '答案預設直接顯示（綠框那個就是正解），先不要自我測驗，純粹快速瀏覽混個眼熟。'
        '一天看一科，每科 100 題大約 30 分鐘。看到覺得會忘的就點右上角 ☆ 標記起來。</p>'
        '<h3 class="sub">第 2 步　打開「自我測驗」再過一遍</h3>'
        '<p style="color:var(--sub);margin:0 0 14px;font-size:14.5px">'
        '在題庫頁勾選「自我測驗」，答案會藏起來，點選項作答、立刻看到對錯。'
        '這一輪的目的是找出你「以為會、其實不會」的題目。答錯的記得標記。</p>'
        '<h3 class="sub">第 3 步　到「模擬測驗」計時實戰</h3>'
        '<p style="color:var(--sub);margin:0;font-size:14.5px">'
        '先各科全範圍考一輪（100 題），確認每一題都會；再用混合模擬抓考場手感。'
        '考完可以一鍵把錯題加入標記，之後用「標記複習」專練弱點。</p>'
        '<div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">'
        '<button class="btn" data-jump="bank">前往題庫</button>'
        '<button class="btn ghost" data-jump="exam">直接去考試</button></div>'
        '</div>'
    )

    h.append('<h2 class="sec">考點分布</h2>')
    h.append(f'<p class="lead" style="margin-bottom:10px">依題幹關鍵字歸類這 {total} 題的實際統計，'
             '數字會隨題庫重新建置自動更新。時間不夠時，優先讀佔比高的類別。</p>')
    h.append('<div class="grid2">')
    h.append(f'<div class="card"><h3 class="sub" style="margin-top:0">90006 職業安全衛生（{len(safety)} 題）</h3>'
             + bars(topic_pairs(safety), len(safety)) + "</div>")
    h.append(f'<div class="card"><h3 class="sub" style="margin-top:0">90007 工作倫理與職業道德（{len(ethics)} 題）</h3>'
             + bars(topic_pairs(ethics), len(ethics)) + "</div>")
    h.append("</div>")

    h.append('<h2 class="sec">答案分布與猜題策略</h2>')
    h.append('<div class="grid2">')
    h.append('<div class="card"><h3 class="sub" style="margin-top:0">實際答案分布</h3>'
             '<table><thead><tr><th>選項</th><th>題數</th><th>佔比</th></tr></thead>'
             f'<tbody>{arow}</tbody></table></div>')
    h.append(
        '<div class="card"><h3 class="sub" style="margin-top:0">怎麼用這張表</h3>'
        f'<div class="good-note"><b>真的不會就選 {circled[amax_k-1]}。</b>'
        f'它出現 {adist[amax_k]} 次（{adist[amax_k]/total*100:.0f}%），是最常見的答案；'
        f'而 {circled[amin_k-1]} 只有 {adist[amin_k]} 次（{adist[amin_k]/total*100:.0f}%），'
        '空白時別選它。</div>'
        '<div class="trap"><b>這只是最後手段。</b>固定題庫的正確解法是把答案背起來，'
        '猜題的期望值永遠比背題低。這張表只在你考場上真的卡住時派得上用場。</div>'
        "</div>"
    )
    h.append("</div>")

    h.append('<h2 class="sec">題型規律：看到這些就有方向</h2>')
    h.append(
        '<div class="card">'
        f'<h3 class="sub" style="margin-top:0">一、否定題佔了 {neg_all} 題（{neg_all/total*100:.0f}%）</h3>'
        f'<p style="color:var(--sub);font-size:14.5px;margin:0 0 10px">'
        f'職安 {neg_s} 題、倫理 {neg_e} 題的問法是「下列何者<b>錯誤</b>／何者<b>非</b>／何者<b>有誤</b>／'
        f'何者<b>不是</b>」。這是最大宗的題型。</p>'
        '<div class="trap"><b>作答習慣：</b>讀題時先把「錯誤、非、有誤、不」圈出來再看選項，'
        '否則很容易看完四個選項選了「最正確」的那個，剛好答錯。</div>'
        '<h3 class="sub">二、常識題直接用「最安全／最負責」原則秒殺</h3>'
        '<p style="color:var(--sub);font-size:14.5px;margin:0 0 10px">'
        '這兩科有相當比例的題目不需要記憶，選<b>最保守、最安全、最符合職業道德</b>的那個就對了。</p>'
        '<ul class="tight" style="color:var(--sub);font-size:14.5px">'
        '<li>職安題：選「有做防護措施」「先斷電」「通報主管」「不便宜行事」的那個</li>'
        '<li>倫理題：選「拒絕」「主動迴避」「依規定辦理」「誠實告知」的那個</li>'
        '<li>反過來說，只要選項寫著「為了節省時間」「反正沒人看到」「偶爾一次沒關係」，一定是錯的</li>'
        "</ul>"
        '<h3 class="sub">三、絕對用語通常是錯的</h3>'
        '<p style="color:var(--sub);font-size:14.5px;margin:0">'
        '選項出現「一律」「完全不受限制」「均不需」「無須」「不受……規範」這類把話說死的寫法，'
        '在否定題裡多半就是要你挑出來的那個錯誤選項。</p>'
        "</div>"
    )

    h.append('<h2 class="sec">數字速記表</h2>')
    h.append('<p class="lead" style="margin-bottom:10px">'
             '數字題是最容易失分、也最容易補回來的一塊——因為答案就是一個數字，背了就一定拿分。'
             '下表由程式自動從題庫抽出，每一列都對應一題實際題目。</p>')
    h.append(f'<div class="card"><h3 class="sub" style="margin-top:0">90006 職業安全衛生</h3>'
             + numeric_table(questions, "90006") + "</div>")
    h.append(f'<div class="card"><h3 class="sub" style="margin-top:0">90007 工作倫理與職業道德</h3>'
             + numeric_table(questions, "90007") + "</div>")

    # 公益推廣：均一教育平台（資訊於 2026-09-25 查證自 junyiacademy.org 官網）
    h.append('<div class="counter hide"><span class="lbl">🔢 累計來訪</span>'
             '<span class="digits" id="cnt-home"></span></div>')

    h.append('<h2 class="sec">公益推廣</h2>')
    h.append(
        '<div class="ad-tag-row">公益廣告</div>'
        '<a class="junyi" href="https://official.junyiacademy.org/#how-to-support" '
        'target="_blank" rel="noopener noreferrer">'
        # 黑板示意插圖（純 CSS／SVG 繪製，非真人照片）
        '<div class="jy-scene" aria-hidden="true">'
        '<div class="jy-board">'
        '<div class="jy-chalk">'
        '<span class="jy-abc">A B C</span>'
        '<span class="jy-eq">1 + 1 = 2</span>'
        '<span class="jy-heart">♥</span>'
        "</div>"
        '<div class="jy-tray"><i class="jy-chalk1"></i><i class="jy-chalk2"></i><i class="jy-eraser"></i></div>'
        "</div>"
        '<div class="jy-books"><i class="b1"></i><i class="b2"></i><i class="b3"></i></div>'
        '<div class="jy-pencil"></div>'
        "</div>"
        f'<img class="jy-logo" src="{LOGO_JUNYI}" alt="均一平台教育基金會" width="210" height="45">'
        '<h3>你的加入，將能協助更多孩子用教育點亮自己</h3>'
        '<p>均一相信，每個孩子都值得擁有均等且獨一無二的機會，用自己的步調學習並累積學習自信，'
        '進而有勇氣走入真實世界面對挑戰，成就自己也成就他人。而這個理想還需要更多人一起投入，'
        '如果你願意，邀請你加入均一團隊，或是用每月小額捐款支持我們。</p>'
        '<span class="junyi-btn">加入 / 支持均一</span>'
        '<small class="junyi-note">均一平台教育基金會 · 公益勸募許可字號：衛部救字第 1141365149 號<br>'
        '標誌為均一平台教育基金會所有，取自其官方媒體素材，依原樣使用未經變形改色。本站與均一無隸屬關係。</small>'
        "</a>"
    )

    h.append('<h2 class="sec">最後提醒</h2>')
    h.append(
        '<div class="card">'
        '<div class="good-note"><b>把 200 題練到看題目就知道答案，這科就滿分。</b>'
        '固定題庫的意義就在這裡——投入是有上限的，練完就結束了，不會有意外。</div>'
        '<div class="trap"><b>注意題庫版本。</b>本站用的是 '
        f'{esc(ps["effective"])} 起適用的版本（{esc(ps["version"])} / {esc(pe["version"])}）。'
        '官方每年可能改版，考前建議到勞動力發展署網站確認版次是否相同；'
        '若有新版，把新的 PDF 放進專案資料夾重新建置即可。</div>'
        "</div>"
    )
    return "\n".join(h)


def main():
    questions = load("questions.json")
    meta = load("meta.json")

    # 掛上逐題解析：合併 build/ex/ 下所有分批檔案（沒有解析的題目前端不顯示按鈕）
    ex = {}
    exdir = os.path.join(B, "ex")
    if os.path.isdir(exdir):
        for fn in sorted(os.listdir(exdir)):
            if not fn.endswith(".json"):
                continue
            with open(os.path.join(exdir, fn), encoding="utf-8") as f:
                part = json.load(f)
            for k, v in part.items():
                if k.startswith("_"):
                    continue
                if k in ex:
                    raise SystemExit(f"建置中止：解析 {k} 在多個檔案重複定義（{fn}）")
                ex[k] = v
    n_ex = 0
    for q in questions:
        e = ex.get(q["id"])
        if e:
            q["ex"] = {"law": e.get("law", ""), "key": e.get("key", ""), "text": e.get("text", "")}
            n_ex += 1
    meta["explained"] = n_ex
    missing = [q["id"] for q in questions if "ex" not in q]
    print(f"已掛上解析：{n_ex} / {len(questions)} 題" +
          (f"（尚缺 {len(missing)} 題，例如 {', '.join(missing[:5])}）" if missing else "　全部完成"))
    with open(os.path.join(B, "template.html"), encoding="utf-8") as f:
        tpl = f.read()
    with open(os.path.join(B, "app.js"), encoding="utf-8") as f:
        app = f.read()

    papers = {p["code"]: p for p in meta["papers"]}
    foot = (
        "資料來源：勞動部勞動力發展署技能檢定中心公告「90006 職業安全衛生」"
        f"（{papers['90006']['fileName']}，{papers['90006']['version']}）、"
        "「90007 工作倫理與職業道德」"
        f"（{papers['90007']['fileName']}，{papers['90007']['version']}），"
        f"{papers['90006']['effective']}起報檢者適用。<br>"
        "題目與答案由官方 PDF 原文解析，未經改寫。本站僅供自學複習，實際命題與配分以主管機關公告為準。"
    )

    out = tpl
    out = out.replace("/*__DATA__*/[]/*__END__*/", json.dumps(questions, ensure_ascii=False, separators=(",", ":")))
    out = out.replace("/*__META__*/{}/*__ENDMETA__*/", json.dumps(meta, ensure_ascii=False, separators=(",", ":")))
    out = out.replace("/*__APP__*/", app)
    out = out.replace("<!--HOME-->", build_home(questions, meta))
    out = out.replace('<div class="foot wrap" id="foot"></div>', f'<div class="foot wrap">{foot}</div>')

    for marker in ["__DATA__", "__META__", "__APP__", "<!--HOME-->"]:
        if marker in out:
            raise SystemExit(f"建置中止：佔位符 {marker} 未被取代")

    dst = os.path.join(BASE, "index.html")
    with open(dst, "w", encoding="utf-8") as f:
        f.write(out)
    size = os.path.getsize(dst)
    print(f"輸出 → {dst}")
    print(f"檔案大小：{size/1024:.0f} KB　題數：{len(questions)}")


if __name__ == "__main__":
    main()
