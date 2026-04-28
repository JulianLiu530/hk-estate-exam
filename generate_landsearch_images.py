#!/usr/bin/env python3
"""Generate PNG images of land search (土地查冊) data for HK estate exam app."""

import json, re, os
from PIL import Image, ImageDraw, ImageFont

IMG_WIDTH = 1100
PAD = 32
CANVAS_H = 12000  # large enough, will crop

def load_font(size):
    for path in [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
        "/Library/Fonts/Arial Unicode MS.ttf",
    ]:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()

F14 = load_font(14)
F16 = load_font(16)
F18 = load_font(18)
F20 = load_font(20)

def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

C_BG       = rgb('#ffffff')
C_HDR      = rgb('#1a3a6b')
C_HDR_TXT  = rgb('#ffffff')
C_SEC_BG   = rgb('#dce8f8')
C_SEC_TXT  = rgb('#1a3a6b')
C_ALT      = rgb('#f5f7fa')
C_BORDER   = rgb('#c8d4e8')
C_TEXT     = rgb('#2c3e50')
C_MUTED    = rgb('#6b7c93')
C_REM_BG   = rgb('#fffbf0')
C_REM_TXT  = rgb('#7a5c00')

# ── Text helpers ─────────────────────────────────────────────────────────────

def text_w(font, s):
    bb = font.getbbox(str(s))
    return bb[2] - bb[0]

def text_h(font):
    bb = font.getbbox('Ag中')
    return bb[3] - bb[1]

def wrap(font, s, max_w):
    """Return list of lines."""
    s = str(s)
    words = s.split()
    if not words:
        return ['']
    lines, cur = [], words[0]
    for w in words[1:]:
        test = cur + ' ' + w
        if text_w(font, test) <= max_w:
            cur = test
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines

def draw_wrap(draw, s, x, y, max_w, font, color):
    lh = text_h(font) + 4
    for line in wrap(font, s, max_w):
        draw.text((x, y), line, font=font, fill=color)
        y += lh
    return y

def wrap_height(font, s, max_w):
    lh = text_h(font) + 4
    return len(wrap(font, s, max_w)) * lh

# ── Parsing ──────────────────────────────────────────────────────────────────

BOILERPLATE = [
    r'VIEW PROPERTY PARTICULARS.*?VIEW DEEDS PENDING REGISTRATION',
    r'備存土地紀錄.*?PERSONAL DATA \(PRIVACY\) ORDINANCE\.',
    r'THE LAND RECORDS ARE KEPT.*?PERSONAL DATA \(PRIVACY\) ORDINANCE\.',
    r'《政府租契續期條例》.*?SHOULD PREVAIL\.',
    r'THE EXTENSION OF GOVERNMENT LEASES.*?SHOULD PREVAIL\.',
    r'進行任何交易前.*?LAND REGISTRY\.',
    r'BEFORE ANY DEALINGS.*?LAND REGISTRY\.',
    r'土\s*地\s*註\s*冊\s*處\s*THE LAND REGISTRY\s*土\s*地\s*登\s*記\s*冊.*?SEARCH TYPE:.*?(?:HISTORICAL AND CURRENT|CURRENT)',
    r'第[一二三四五六七八九十]+部份.*?題\)',
    r'^土地查冊\s*',
]

def clean(text):
    for p in BOILERPLATE:
        text = re.sub(p, ' ', text, flags=re.DOTALL | re.MULTILINE)
    return re.sub(r' {2,}', ' ', text).strip()

SECTIONS = [
    (r'物\s*業\s*資\s*料\s*PROPERTY PARTICULARS', '物業資料  Property Particulars', 'kv'),
    (r'業\s*主\s*資\s*料\s*OWNER PARTICULARS?',   '業主資料  Owner Particulars',     'owner'),
    (r'物\s*業\s*涉\s*及\s*的\s*轇\s*輵\s*INCUMBRANCES?', '物業涉及的轇輵  Incumbrances', 'table'),
    (r'等\s*待\s*註\s*冊\s*的\s*契\s*約\s*DEEDS?\s*PENDING\s*REGI\w*', '等待註冊的契約  Deeds Pending Registration', 'table'),
]

def split_sections(text):
    text = clean(text)
    hits = []
    for pat, label, stype in SECTIONS:
        m = re.search(pat, text)
        if m:
            hits.append((m.start(), m.end(), label, stype))
    hits.sort()
    result = []
    for i, (s, e, label, stype) in enumerate(hits):
        nxt = hits[i+1][0] if i+1 < len(hits) else len(text)
        result.append({'label': label, 'type': stype, 'content': text[e:nxt].strip()})
    return result

KV_LABELS = [
    ('物業參考編號', r'PROPERTY REFERENCE NUMBER[^:]*:'),
    ('地段編號',     r'LOT NO\s*:'),
    ('批約',         r'HELD UNDER\s*:'),
    ('年期',         r'LEASE TERM\s*:'),
    ('開始日期',     r'COMMENCEMENT OF LEASE TERM\s*:'),
    ('每年地稅',     r'RENT PER ANNUM\s*:'),
    ('所佔份數',     r'SHARE OF THE LOT\s*:'),
    ('地址',         r'ADDRESS\s*:'),
    ('中文地址',     r'地址\s*:'),
    ('備註',         r'REMARKS\s*:'),
]

def parse_kv(content):
    hits = []
    for zh, pat in KV_LABELS:
        m = re.search(pat, content, re.IGNORECASE)
        if m:
            hits.append((m.start(), m.end(), zh))
    hits.sort()
    rows = []
    for i, (s, e, zh) in enumerate(hits):
        nxt = hits[i+1][0] if i+1 < len(hits) else len(content)
        val = re.sub(r'\s+', ' ', content[e:nxt]).strip(' :-')
        if val:
            rows.append((zh, val))
    return rows

MEM_RE = re.compile(r'(?<!\w)([A-Z]{0,3}\d{6,})(?!\d)')

def parse_rows(content, stype):
    mems = list(MEM_RE.finditer(content))
    if not mems:
        return []
    rows = []
    for i, m in enumerate(mems):
        end = mems[i+1].start() if i+1 < len(mems) else len(content)
        chunk = content[m.start():end]
        mem = m.group(1)
        dates = re.findall(r'\d{2}/+\d{2}/\d{4}', chunk)
        money = re.search(r'\$[\d,]+(?:\.\d{2})?', chunk)
        rem_m = re.search(r'備註\s*REMARKS\s*:?\s*(.*?)(?=(?:[A-Z]{0,3}\d{6,})|$)', chunk, re.DOTALL)
        remarks = re.sub(r'\s+', ' ', rem_m.group(1)).strip() if rem_m else ''

        row = {
            'mem': mem,
            'date_i': dates[0] if dates else '-',
            'date_r': dates[1] if len(dates) > 1 else '-',
            'money': money.group(0) if money else '-',
            'remarks': remarks,
        }
        if stype == 'owner':
            cap_m = re.search(r'(JOINT TENANT|TENANT IN COMMON[\s\d/]*|SOLE OWNER|ADMINISTRATRIX|EXECUTOR|ADMINISTRATOR)', chunk, re.I)
            row['capacity'] = cap_m.group(0).strip() if cap_m else '-'
            # Name: text before memorial number in chunk (first token block)
            pre = chunk[:chunk.index(mem)].strip()
            pre = re.sub(r'(業主姓名|NAME OF OWNER|身分|CAPACITY|MEMORIAL|文書日期|DATE OF|註冊日期|代價|CONSIDERATION|REMARKS|備註)', '', pre)
            row['name'] = re.sub(r'\s+', ' ', pre).strip(' :-') or '-'
        else:
            # Nature: remove known tokens
            nature = re.sub(r'[A-Z]{0,3}\d{6,}|\d{2}/+\d{2}/\d{4}|\$[\d,]+(?:\.\d{2})?|備註|REMARKS:?|IN FAVOUR OF|受惠各方|代價|CONSIDERATION|文書性質|NATURE|註冊摘要編號|MEMORIAL NO\.?|文書日期|DATE OF INSTRUMENT|註冊日期|DATE OF REGISTRATION', '', chunk)
            nature = re.sub(r'\s+', ' ', nature).strip(' :-')
            row['nature'] = nature[:120]
        rows.append(row)
    return rows

# ── Rendering ────────────────────────────────────────────────────────────────

def render(passage, exam_id):
    sections = split_sections(passage)
    img = Image.new('RGB', (IMG_WIDTH, CANVAS_H), C_BG)
    d = ImageDraw.Draw(img)
    W = IMG_WIDTH
    CW = W - PAD * 2  # content width
    y = 0

    # Title bar
    d.rectangle([0, 0, W, 48], fill=C_HDR)
    d.text((PAD, 12), f"土地查冊  Land Register  ·  {exam_id}", font=F20, fill=C_HDR_TXT)
    y = 48 + 20

    for sec in sections:
        # Section header
        d.rectangle([PAD, y, PAD + CW, y + 32], fill=C_SEC_BG)
        d.text((PAD + 10, y + 7), sec['label'], font=F16, fill=C_SEC_TXT)
        y += 32

        if sec['type'] == 'kv':
            rows = parse_kv(sec['content'])
            K_W = 160
            V_W = CW - K_W - 1
            for ri, (k, v) in enumerate(rows):
                vh = wrap_height(F14, v, V_W - 12)
                rh = max(28, vh + 10)
                bg = C_ALT if ri % 2 == 0 else C_BG
                d.rectangle([PAD, y, PAD + CW, y + rh], fill=bg)
                d.line([(PAD, y + rh), (PAD + CW, y + rh)], fill=C_BORDER)
                d.line([(PAD + K_W, y), (PAD + K_W, y + rh)], fill=C_BORDER)
                d.text((PAD + 8, y + 7), k, font=F14, fill=C_MUTED)
                draw_wrap(d, v, PAD + K_W + 8, y + 7, V_W - 12, F14, C_TEXT)
                y += rh

        elif sec['type'] == 'owner':
            # cols: name, capacity, memorial, date_i, date_r, money
            cols = [('業主姓名', 200), ('身分', 140), ('摘要編號', 110), ('文書日期', 95), ('註冊日期', 95), ('代價', CW - 640 - 5)]
            # header
            d.rectangle([PAD, y, PAD + CW, y + 26], fill=C_HDR)
            cx = PAD
            for lbl, cw in cols:
                d.text((cx + 6, y + 5), lbl, font=F14, fill=C_HDR_TXT)
                cx += cw
            y += 26
            rows = parse_rows(sec['content'], 'owner')
            for ri, row in enumerate(rows):
                cells = [row['name'], row['capacity'], row['mem'], row['date_i'], row['date_r'], row['money']]
                rh = max(28, max(wrap_height(F14, c, cw - 12) for c, (_, cw) in zip(cells, cols)) + 10)
                bg = C_ALT if ri % 2 == 0 else C_BG
                d.rectangle([PAD, y, PAD + CW, y + rh], fill=bg)
                d.line([(PAD, y + rh), (PAD + CW, y + rh)], fill=C_BORDER)
                cx = PAD
                for cell, (_, cw) in zip(cells, cols):
                    draw_wrap(d, cell, cx + 6, y + 7, cw - 12, F14, C_TEXT)
                    d.line([(cx + cw, y), (cx + cw, y + rh)], fill=C_BORDER)
                    cx += cw
                y += rh
                if row['remarks']:
                    rh2 = wrap_height(F14, '備註: ' + row['remarks'], CW - 20) + 8
                    d.rectangle([PAD, y, PAD + CW, y + rh2], fill=C_REM_BG)
                    d.line([(PAD, y + rh2), (PAD + CW, y + rh2)], fill=C_BORDER)
                    draw_wrap(d, '備註: ' + row['remarks'], PAD + 14, y + 4, CW - 20, F14, C_REM_TXT)
                    y += rh2

        elif sec['type'] == 'table':
            cols = [('摘要編號', 110), ('文書日期', 95), ('註冊日期', 95), ('文書性質', CW - 300 - 5)]
            d.rectangle([PAD, y, PAD + CW, y + 26], fill=C_HDR)
            cx = PAD
            for lbl, cw in cols:
                d.text((cx + 6, y + 5), lbl, font=F14, fill=C_HDR_TXT)
                cx += cw
            y += 26
            rows = parse_rows(sec['content'], 'table')
            for ri, row in enumerate(rows):
                cells = [row['mem'], row['date_i'], row['date_r'], row['nature']]
                rh = max(28, max(wrap_height(F14, c, cw - 12) for c, (_, cw) in zip(cells, cols)) + 10)
                bg = C_ALT if ri % 2 == 0 else C_BG
                d.rectangle([PAD, y, PAD + CW, y + rh], fill=bg)
                d.line([(PAD, y + rh), (PAD + CW, y + rh)], fill=C_BORDER)
                cx = PAD
                for cell, (_, cw) in zip(cells, cols):
                    draw_wrap(d, cell, cx + 6, y + 7, cw - 12, F14, C_TEXT)
                    d.line([(cx + cw, y), (cx + cw, y + rh)], fill=C_BORDER)
                    cx += cw
                y += rh
                if row['remarks']:
                    rh2 = wrap_height(F14, '備註: ' + row['remarks'], CW - 20) + 8
                    d.rectangle([PAD, y, PAD + CW, y + rh2], fill=C_REM_BG)
                    d.line([(PAD, y + rh2), (PAD + CW, y + rh2)], fill=C_BORDER)
                    draw_wrap(d, '備註: ' + row['remarks'], PAD + 14, y + 4, CW - 20, F14, C_REM_TXT)
                    y += rh2

        # outer border for section
        d.rectangle([PAD, y - (y - 32), PAD + CW, y], outline=C_BORDER)
        y += 16

    y += PAD
    return img.crop((0, 0, W, min(y, CANVAS_H)))


def main():
    os.makedirs('data/images', exist_ok=True)
    with open('data/exams.json') as f:
        exams = json.load(f)
    for exam in exams:
        eid = exam['exam_id']
        for ci, case in enumerate(exam['cases']):
            p = case.get('passage', '')
            if 'PROPERTY PARTICULARS' in p or '物業資料' in p:
                img = render(p, eid)
                out = f"data/images/{eid}_case{ci+1}_landsearch.png"
                img.save(out, 'PNG', optimize=True)
                print(f"Saved {out}  {img.size}")

if __name__ == '__main__':
    main()
