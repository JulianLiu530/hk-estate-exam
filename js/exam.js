// exam.js — 模擬考試頁面邏輯（獨立頁面版）

// ── 頁面初始化 ───────────────────────────────────────────────────────────
async function initExamPage() {
  Storage.touchStreak();
  await loadData();
  updateHeaderStats();
  requireAuth(() => renderExamStart());
}

// ── 考試起始畫面 ─────────────────────────────────────────────────────────
function renderExamStart() {
  const history  = Storage.getExamHistory();
  const lastExam = history[0];
  const historyHtml = lastExam ? `
    <div class="card" style="margin-top:14px">
      <div class="section-label" style="margin-top:0">上次考試</div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:1.1rem;font-weight:800;color:var(--primary)">${lastExam.score}/${lastExam.total}</div>
          <div style="font-size:0.78rem;color:var(--text-muted)">${new Date(lastExam.date).toLocaleDateString('zh-HK')}</div>
        </div>
        <div class="tag ${lastExam.passed ? 'green' : 'red'}">${lastExam.passed ? '合格' : '不合格'}</div>
      </div>
    </div>
  ` : '';

  const examItems = App.examsData ? App.examsData.map(e => `
    <div class="chapter-item exam-select-item" data-exam-id="${e.exam_id}" style="cursor:pointer">
      <div class="chapter-num" style="background:var(--primary);color:#fff;font-size:0.7rem;padding:4px 6px;border-radius:6px;min-width:36px;text-align:center">📝</div>
      <div class="chapter-info">
        <div class="chapter-title">${e.title}</div>
        <div class="chapter-meta">第一部分 30題 · 第二部分 20題 · 共50題</div>
      </div>
      <div class="card-arrow">›</div>
    </div>
  `).join('') : '';

  document.getElementById('main-content').innerHTML = `
    <div class="card">
      <div style="text-align:center;padding:16px 0 10px">
        <div style="font-size:2.5rem;margin-bottom:10px">📝</div>
        <div style="font-size:1.1rem;font-weight:700;color:var(--primary);margin-bottom:6px">E牌模擬考試</div>
        <div style="font-size:0.85rem;color:var(--text-muted);line-height:1.7">
          第一部分：30題單選題，答對18題或以上合格<br>
          第二部分：2個案例，共20題，答對12題或以上合格<br>
          兩部分須同時合格（各60%）<br>
          考試時間：90分鐘
        </div>
      </div>
      <div class="divider"></div>
      <button class="btn btn-secondary" style="width:100%;margin-bottom:8px" id="start-random-exam-btn">🔀 隨機模擬考試</button>
    </div>

    <div class="section-label" style="margin-top:18px">選擇真題套卷</div>
    ${examItems}
    ${historyHtml}
  `;

  // 隨機考試
  document.getElementById('start-random-exam-btn')?.addEventListener('click', () => {
    const questions = buildExamQuestions();
    startExamSession(questions);
  });

  // 選擇套卷
  document.querySelectorAll('.exam-select-item[data-exam-id]').forEach(el => {
    el.addEventListener('click', () => {
      const questions = buildExamQuestions(el.dataset.examId);
      startExamSession(questions);
    });
  });
}

// ── 構建考題 ─────────────────────────────────────────────────────────────
function buildExamQuestions(examId) {
  if (examId && App.examsData) {
    const exam = App.examsData.find(e => e.exam_id === examId);
    if (exam) return { regular: exam.regular, cases: exam.cases, title: exam.title };
  }
  if (App.examsData && App.examsData.length > 0) {
    const allRegular  = App.examsData.flatMap(e => e.regular);
    const shuffled    = allRegular.sort(() => Math.random() - 0.5).slice(0, 30);
    const randomExam  = App.examsData[Math.floor(Math.random() * App.examsData.length)];
    return { regular: shuffled, cases: randomExam.cases, title: '隨機模擬考試' };
  }
  const allQ = [];
  App.questionsData.chapters.forEach(ch => {
    ch.questions.forEach(q => allQ.push({ ...q, chapterId: ch.id, chapterTitle: ch.title }));
  });
  const shuffled = allQ.sort(() => Math.random() - 0.5).slice(0, 30);
  const cases    = App.casesData.cases.map(c => ({ ...c, isCase: true }));
  return { regular: shuffled, cases };
}

// ── 案例文本格式化 ────────────────────────────────────────────────────────
function formatCasePassage(passage, caseId) {
  if (/物\s*業\s*資\s*料/.test(passage)) {
    if (caseId) {
      const imgPath = `data/images/${caseId}_landsearch.png`;
      const uid = 'ls_' + caseId.replace(/[^a-z0-9]/gi, '_');
      return `
        <div id="${uid}_wrap" data-landsearch-wrap="1" style="position:relative;width:100%;height:340px;overflow:hidden;border:1.5px solid var(--border);border-radius:8px;background:#f8f8f8;cursor:grab;user-select:none;touch-action:none" title="可拖動 · 滾輪縮放">
          <img id="${uid}_img" src="${imgPath}" alt="土地查冊" style="position:absolute;top:0;left:0;transform-origin:top left;display:block;pointer-events:none">
          <div style="position:absolute;bottom:6px;right:8px;font-size:0.7rem;color:#888;background:rgba(255,255,255,0.8);padding:2px 7px;border-radius:8px;pointer-events:none">滾輪縮放 · 拖動查看</div>
        </div>`;
    }
    return formatLandSearch(passage);
  }
  return formatCaseAnalysis(passage);
}

function initLandSearchViewers() {
  document.querySelectorAll('[data-landsearch-wrap]').forEach(wrap => {
    if (wrap._lsInit) return;
    wrap._lsInit = true;
    const img = wrap.querySelector('img');
    if (!img) return;
    let scale = 1, tx = 0, ty = 0;
    let dragging = false, startX, startY, startTx, startTy;

    function clamp() {
      const iw = (img.naturalWidth || wrap.clientWidth) * scale;
      const ih = (img.naturalHeight || 1000) * scale;
      const ww = wrap.clientWidth, wh = wrap.clientHeight;
      tx = Math.min(0, Math.max(ww - iw, tx));
      ty = Math.min(0, Math.max(wh - ih, ty));
    }
    function apply() {
      img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
    }
    function fitWidth() {
      if (img.naturalWidth) {
        scale = wrap.clientWidth / img.naturalWidth;
        tx = 0; ty = 0; apply();
      }
    }

    img.addEventListener('load', fitWidth);
    if (img.complete && img.naturalWidth) fitWidth();

    wrap.addEventListener('wheel', function(e) {
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const ox = e.clientX - rect.left, oy = e.clientY - rect.top;
      const delta = e.deltaY < 0 ? 1.12 : 0.89;
      const ns = Math.min(5, Math.max(0.2, scale * delta));
      tx = ox - (ox - tx) * (ns / scale);
      ty = oy - (oy - ty) * (ns / scale);
      scale = ns; clamp(); apply();
    }, { passive: false });

    wrap.addEventListener('mousedown', function(e) {
      dragging = true; startX = e.clientX; startY = e.clientY; startTx = tx; startTy = ty;
      wrap.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', function(e) {
      if (!dragging) return;
      tx = startTx + (e.clientX - startX);
      ty = startTy + (e.clientY - startY);
      clamp(); apply();
    });
    window.addEventListener('mouseup', function() { dragging = false; wrap.style.cursor = 'grab'; });

    let lastDist = null;
    wrap.addEventListener('touchstart', function(e) {
      if (e.touches.length === 1) {
        dragging = true; startX = e.touches[0].clientX; startY = e.touches[0].clientY; startTx = tx; startTy = ty;
      } else if (e.touches.length === 2) {
        dragging = false;
        lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }
      e.preventDefault();
    }, { passive: false });
    wrap.addEventListener('touchmove', function(e) {
      if (e.touches.length === 1 && dragging) {
        tx = startTx + (e.touches[0].clientX - startX);
        ty = startTy + (e.touches[0].clientY - startY);
        clamp(); apply();
      } else if (e.touches.length === 2 && lastDist) {
        const rect = wrap.getBoundingClientRect();
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        const mid = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top };
        const ns = Math.min(5, Math.max(0.2, scale * d / lastDist));
        tx = mid.x - (mid.x - tx) * (ns / scale);
        ty = mid.y - (mid.y - ty) * (ns / scale);
        scale = ns; lastDist = d; clamp(); apply();
      }
      e.preventDefault();
    }, { passive: false });
    wrap.addEventListener('touchend', function() { dragging = false; lastDist = null; });
  });
}

function formatLandSearch(text) {
  const sections = [
    { re: /物\s*業\s*資\s*料\s*PROPERTY PARTICULARS/, label: '物業資料 Property Particulars', type: 'kv' },
    { re: /業\s*主\s*資\s*料\s*OWNER PARTICULARS?/, label: '業主資料 Owner Particulars', type: 'owner' },
    { re: /物\s*業\s*涉\s*及\s*的\s*轇\s*輵\s*INCUMBRANCES?/, label: '物業涉及的轇輵 Incumbrances', type: 'table' },
    { re: /等\s*待\s*註\s*冊\s*的\s*契\s*約\s*DEEDS?\s*PENDING\s*REGI/, label: '等待註冊的契約 Deeds Pending Registration', type: 'table' },
  ];
  const splits = [];
  for (const s of sections) {
    const m = s.re.exec(text);
    if (m) splits.push({ idx: m.index, label: s.label, type: s.type, end: m.index + m[0].length });
  }
  splits.sort((a, b) => a.idx - b.idx);
  if (splits.length === 0) return `<p style="white-space:pre-line">${text}</p>`;

  function stripBoilerplate(s) {
    return s
      .replace(/VIEW\s+(?:PROPERTY PARTICULARS|OWNER PARTICULARS|INCUMBRANCES|DEEDS PENDING REGISTRATION)[\s\S]*$/i, '')
      .replace(/土\s*地\s*註\s*冊\s*處[\s\S]*$/u, '')
      .replace(/\*{5}[\s\S]*$/, '')
      .trim();
  }

  const sectionLabel = (label) =>
    `<div style="font-size:0.72rem;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;padding-bottom:3px;border-bottom:1px solid var(--border)">${label}</div>`;

  function formatPropertyParticulars(raw) {
    const labelTokens = [
      /物業參考編號\s*PROPERTY REFERENCE NUMBER\s*\(PRN\)\s*:/,
      /地段編號\s*LOT NO\s*:/,
      /批約\s*HELD UNDER\s*:/,
      /年期\s*LEASE TERM\s*:/,
      /開始日期\s*COMMENCEMENT OF LEASE TERM\s*:/,
      /每年地稅\s*RENT PER ANNUM\s*:/,
      /所佔地段份數\s*SHARE OF THE LOT\s*:/,
      /ADDRESS\s*:/,
      /地址\s*:/,
      /備註\s*REMARKS\s*:/,
    ];
    const labelNames = ['物業參考編號', '地段編號', '批約', '年期', '開始日期', '每年地稅', '所佔地段份數', 'ADDRESS', '地址', '備註 REMARKS'];
    const found = [];
    for (let i = 0; i < labelTokens.length; i++) {
      const m = labelTokens[i].exec(raw);
      if (m) found.push({ pos: m.index, end: m.index + m[0].length, name: labelNames[i] });
    }
    found.sort((a, b) => a.pos - b.pos);
    if (found.length === 0) return `<div style="font-size:0.82rem;white-space:pre-line">${raw}</div>`;
    const kvRows = found.map((f, i) => {
      const val = raw.slice(f.end, found[i + 1] ? found[i + 1].pos : undefined).trim();
      return `<tr>
        <td style="font-size:0.75rem;color:var(--text-muted);white-space:nowrap;padding:3px 10px 3px 0;vertical-align:top;font-weight:600">${f.name}</td>
        <td style="font-size:0.78rem;padding:3px 0;vertical-align:top">${val}</td>
      </tr>`;
    }).join('');
    return `<table style="border-collapse:collapse;width:100%">${kvRows}</table>`;
  }

  function formatTableSection(raw, type) {
    const headerTokens = type === 'owner'
      ? /業主姓名\s*NAME OF OWNER[\s\S]*?代價\s*CONSIDERATION/
      : /註冊摘要編號\s*MEMORIAL NO\.[\s\S]*?代價\s*CONSIDERATION/;
    const headerMatch = headerTokens.exec(raw);
    const dataText    = headerMatch ? raw.slice(headerMatch.index + headerMatch[0].length).trim() : raw;
    if (!dataText || /^\*+無\s*NIL/.test(dataText)) {
      return `<div style="font-size:0.78rem;color:var(--text-muted);padding:6px 0">無 NIL</div>`;
    }
    const memNoRe  = /(?:^|\s)([A-Z]{0,3}\d{6,})\s/g;
    const rowStarts = [];
    let m;
    while ((m = memNoRe.exec(dataText)) !== null) {
      rowStarts.push({ pos: m.index + (m[0].startsWith(' ') ? 1 : 0), memNo: m[1] });
    }
    if (type === 'owner' && rowStarts.length === 0) {
      return `<div style="font-size:0.78rem;line-height:1.8">${dataText.replace(/備註\s*REMARKS\s*:/g, '<br><span style="font-weight:700;color:var(--text-muted)">備註:</span> ')}</div>`;
    }
    if (rowStarts.length === 0) {
      return `<div style="font-size:0.78rem;line-height:1.8">${dataText}</div>`;
    }
    const thStyle = 'font-size:0.65rem;font-weight:700;color:var(--text-muted);padding:4px 6px 4px 0;border-bottom:1.5px solid var(--border);white-space:nowrap;text-align:left';
    const tdStyle = 'font-size:0.72rem;padding:4px 6px 4px 0;vertical-align:top;border-bottom:1px solid #f0f0f0';
    const shortCols = type === 'owner'
      ? ['業主姓名', '身分', '摘要編號', '文書日期', '註冊日期', '代價']
      : ['摘要編號', '文書日期', '註冊日期', '文書性質', '受惠各方', '代價'];
    const thead = `<thead><tr>${shortCols.map(c => `<th style="${thStyle}">${c}</th>`).join('')}</tr></thead>`;
    const tableRows = [];
    for (let i = 0; i < rowStarts.length; i++) {
      const rowText     = dataText.slice(rowStarts[i].pos, rowStarts[i + 1] ? rowStarts[i + 1].pos : undefined).trim();
      const remarksSplit = rowText.split(/備註\s*REMARKS\s*:/i);
      const mainPart    = remarksSplit[0].trim();
      const remarksPart = remarksSplit.slice(1).join(' ').trim();
      let cells;
      if (type !== 'owner') {
        const dateRe   = /^\d{2}[\/\\]\d{2}[\/\\]\d{4}$/;
        const memNo    = rowStarts[i].memNo;
        const allTokens = mainPart.split(/\s+/);
        const dateIdxs  = [];
        for (let j = 0; j < allTokens.length; j++) {
          if (dateRe.test(allTokens[j])) dateIdxs.push(j);
          if (dateIdxs.length === 2) break;
        }
        if (dateIdxs.length >= 2) {
          const d1 = allTokens[dateIdxs[0]];
          const d2 = allTokens[dateIdxs[1]];
          const afterDates = allTokens.slice(dateIdxs[1] + 1).join(' ');
          const moneyRe    = /(?:\$[\d,]+(?:\.\d+)?(?:\s*\(P\.T\.\))?|ALL MONIES?|ALL MONEYS?|-)\s*$/i;
          const moneyMatch = moneyRe.exec(afterDates);
          let nature = afterDates, inFavour = '-', consideration = '-';
          if (moneyMatch) {
            consideration    = moneyMatch[0].trim();
            const beforeMoney = afterDates.slice(0, moneyMatch.index).trim();
            const parts       = beforeMoney.split(/\s{2,}/);
            if (parts.length >= 2) {
              nature   = parts[0];
              inFavour = parts.slice(1).join(' ');
            } else {
              const nameRe = /\s([A-Z][A-Z\s]+(?:BANK|COMPANY|LIMITED|CORPORATION|AUTHORITY|GOVERNMENT|REGISTRAR|SECRETARY|DIRECTOR|OFFICER|OWNER|TENANT|MORTGAGEE)?)\s*$/;
              const nm = nameRe.exec(beforeMoney);
              if (nm) { nature = beforeMoney.slice(0, nm.index).trim(); inFavour = nm[1].trim(); }
              else { nature = beforeMoney; }
            }
          } else {
            nature = afterDates;
          }
          cells = [memNo, d1, d2, nature, inFavour, consideration];
        } else {
          cells = [memNo, '-', '-', mainPart, '-', '-'];
        }
      } else {
        cells = mainPart.split(/\s+/).slice(0, 6);
        while (cells.length < 6) cells.push('-');
      }
      const remarkHtml = remarksPart ? `<br><span style="font-size:0.65rem;color:var(--text-muted)">備註: ${remarksPart}</span>` : '';
      const tds = cells.map((c, ci) => {
        const extra = ci === (type === 'owner' ? 0 : 3) ? remarkHtml : '';
        return `<td style="${tdStyle}">${c || '-'}${extra}</td>`;
      }).join('');
      tableRows.push(`<tr>${tds}</tr>`);
    }
    let prefixHtml = '';
    if (rowStarts.length > 0 && rowStarts[0].pos > 0) {
      const prefix = dataText.slice(0, rowStarts[0].pos).trim();
      if (prefix) prefixHtml = `<tr><td colspan="6" style="${tdStyle};color:var(--text-muted)">${prefix}</td></tr>`;
    }
    return `<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;min-width:400px">
      ${thead}<tbody>${prefixHtml}${tableRows.join('')}</tbody>
    </table></div>`;
  }

  let html = '';
  const preamble = text.slice(0, splits[0].idx).trim();
  if (preamble) {
    const dateM    = /查冊日期及時間[^\d]*(\d{2}\/\d{2}\/\d{4})/.exec(preamble);
    const searcherM = /查冊者姓名[^A-Z]*([A-Z][A-Z\s]+(?:AGENCY|COMPANY|LIMITED)?)/.exec(preamble);
    if (dateM || searcherM) {
      html += `<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:8px">`;
      if (dateM) html += `查冊日期: ${dateM[1]}　`;
      if (searcherM) html += `查冊者: ${searcherM[1].trim()}`;
      html += `</div>`;
    }
  }
  for (let i = 0; i < splits.length; i++) {
    const rawContent = text.slice(splits[i].end, splits[i + 1] ? splits[i + 1].idx : undefined);
    const content    = stripBoilerplate(rawContent);
    const { type, label } = splits[i];
    let body;
    if (type === 'kv')    body = formatPropertyParticulars(content);
    else if (type === 'owner') body = formatTableSection(content, 'owner');
    else                   body = formatTableSection(content, 'table');
    html += `<div style="margin-bottom:12px">${sectionLabel(label)}${body}</div>`;
  }
  return html;
}

function formatCaseAnalysis(text) {
  const paras = text
    .split(/(?<=[。！？」])\s{1,4}(?=[^\s「])/u)
    .map(p => p.trim())
    .filter(Boolean);
  if (paras.length <= 1) {
    return text.split(/\s{2,}/).map(p => `<p style="margin-bottom:8px">${p.trim()}</p>`).join('');
  }
  return paras.map(p => `<p style="margin-bottom:8px">${p}</p>`).join('');
}

// ── 考試場次 ─────────────────────────────────────────────────────────────
function startExamSession(questions) {
  const { regular, cases } = questions;
  const allCaseQ = [];
  cases.forEach(c => {
    c.questions.forEach(q => allCaseQ.push({ ...q, caseId: c.id, caseTitle: c.title, casePassage: c.passage, isCase: true }));
  });
  const allQ       = [...regular, ...allCaseQ];
  const total      = allQ.length;
  const PART1_COUNT = regular.length;
  const DURATION   = 90 * 60;

  let idx       = 0;
  let answers   = {};
  let timerInterval = null;
  let timeLeft  = DURATION;
  let submitted = false;
  let beforeUnloadHandler = null;

  function formatTime(s) {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }

  const container = document.getElementById('main-content');

  function buildExamHTML() {
    const q       = allQ[idx];
    const isTF    = q.type === 'truefalse';
    const isCase  = q.isCase;
    const userAns = answers[q.id];
    const passageHTML = isCase ? `
      <div class="case-passage">
        <div class="case-title">📋 ${q.caseTitle}</div>
        ${formatCasePassage(q.casePassage, q.caseId)}
      </div>` : '';
    const optionsHTML = isTF
      ? `<div class="tf-row">
           <button class="tf-btn ${userAns === 'true' ? 'selected' : ''}" data-val="true">✓ 正確</button>
           <button class="tf-btn ${userAns === 'false' ? 'selected' : ''}" data-val="false">✗ 錯誤</button>
         </div>`
      : `<div class="options-list">
           ${q.options.map(opt => {
             const val = opt[0];
             return `<button class="option-btn ${userAns === val ? 'selected' : ''}" data-val="${val}">${opt}</button>`;
           }).join('')}
         </div>`;
    const timerClass = timeLeft < 300 ? 'danger' : timeLeft < 900 ? 'warning' : '';
    const numDots = allQ.map((qq, i) => {
      const answered = answers[qq.id];
      const isCur    = i === idx;
      const bg       = isCur ? '#1a3a5c' : (answered ? '#4a7fc1' : '#fff');
      const color    = (isCur || answered) ? '#fff' : '#888';
      const border   = isCur ? '2px solid #1a3a5c' : (answered ? '2px solid #4a7fc1' : '2px solid #ddd');
      return `<button data-jump="${i}" style="width:32px;height:32px;border-radius:6px;border:${border};background:${bg};color:${color};font-size:0.75rem;font-weight:600;cursor:pointer;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;padding:0">${i + 1}</button>`;
    }).join('');

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:0.85rem;font-weight:700;color:var(--primary)">模擬考試</div>
        <div class="exam-timer ${timerClass}" id="timer-display">⏱ ${formatTime(timeLeft)}</div>
        <button class="btn btn-danger" id="submit-btn" style="padding:7px 14px;font-size:0.8rem">交卷</button>
      </div>
      <div class="exam-progress" style="margin-bottom:6px">
        <div class="exam-progress-fill" style="width:${((idx+1)/total)*100}%"></div>
      </div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;text-align:center">
        第 ${idx+1} / ${total} 題 · 已答 ${Object.keys(answers).length} 題
        ${isCase ? ' · <span class="tag orange">案例題</span>' : ''}
      </div>
      <div id="qnum-bar" style="display:flex;flex-wrap:wrap;gap:5px;background:#fff;border-radius:10px;padding:10px 12px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,0.08)">${numDots}</div>
      <div class="card">
        ${passageHTML}
        <div class="question-header">
          <span class="question-counter">第 ${idx+1} 題</span>
          <span class="question-type-badge ${isTF ? 'tf' : ''}">${isTF ? '判斷題' : '單選題'}</span>
        </div>
        <div class="question-text">${q.question}</div>
        ${optionsHTML}
      </div>
      <div style="display:flex;gap:10px;margin-top:12px">
        <button class="btn btn-secondary" id="prev-btn" ${idx === 0 ? 'disabled' : ''} style="flex:1">‹ 上一題</button>
        <button class="btn btn-primary" id="next-btn" style="flex:1">${idx < total-1 ? '下一題 ›' : '查看答題情況'}</button>
      </div>
    `;
  }

  function startTimer() {
    timerInterval = setInterval(() => {
      if (submitted) { clearInterval(timerInterval); return; }
      timeLeft--;
      const el = container.querySelector('#timer-display');
      if (el) {
        el.textContent = `⏱ ${formatTime(timeLeft)}`;
        el.className   = 'exam-timer ' + (timeLeft < 300 ? 'danger' : timeLeft < 900 ? 'warning' : '');
      }
      if (timeLeft <= 0) { clearInterval(timerInterval); submitExam(); }
    }, 1000);
  }

  function submitExam() {
    if (submitted) return;
    submitted = true;
    clearInterval(timerInterval);
    if (beforeUnloadHandler) window.removeEventListener('beforeunload', beforeUnloadHandler);
    let part1Correct = 0, part2Correct = 0;
    const wrongItems = [];
    allQ.forEach((q, i) => {
      const userAns  = answers[q.id];
      const isCorrect = userAns && String(userAns).toLowerCase() === String(q.answer).toLowerCase();
      if (isCorrect) {
        if (i < PART1_COUNT) part1Correct++; else part2Correct++;
      } else {
        wrongItems.push({ q, userAns });
        if (userAns) Storage.addWrong(q.id, q, q.chapterId || 'exam', q.chapterTitle || '模擬考試', userAns);
      }
    });
    const correct = part1Correct + part2Correct;
    const passed  = part1Correct >= 18 && part2Correct >= 12;
    Storage.saveExamResult({ score: correct, total, passed, pct: Math.round(correct / total * 100) });
    Storage.touchStreak();
    updateHeaderStats();
    renderExamResult({ correct, total, passed, wrongItems, allQ, answers, part1Correct, part2Correct, part1Total: PART1_COUNT, part2Total: total - PART1_COUNT });
  }

  function renderExamUI() {
    container.innerHTML = buildExamHTML();
    initLandSearchViewers();
    const currentDot = container.querySelector(`#qnum-bar button[data-jump="${idx}"]`);
    if (currentDot) currentDot.scrollIntoView({ block: 'nearest', inline: 'center' });
    container.querySelectorAll('#qnum-bar button[data-jump]').forEach(btn => {
      btn.addEventListener('click', () => { idx = parseInt(btn.dataset.jump); renderExamUI(); });
    });
    container.querySelectorAll('.option-btn, .tf-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = allQ[idx];
        answers[q.id] = btn.dataset.val;
        container.querySelectorAll('.option-btn, .tf-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const dot = container.querySelector(`#qnum-bar button[data-jump="${idx}"]`);
        if (dot) { dot.style.background = '#4a7fc1'; dot.style.borderColor = '#4a7fc1'; dot.style.color = '#fff'; }
      });
    });
    container.querySelector('#prev-btn')?.addEventListener('click', () => { idx--; renderExamUI(); });
    container.querySelector('#next-btn')?.addEventListener('click', () => {
      if (idx < total - 1) { idx++; renderExamUI(); }
      else showAnswerSheet();
    });
    container.querySelector('#submit-btn')?.addEventListener('click', () => {
      if (confirm('確定要交卷嗎？')) submitExam();
    });
  }

  function showAnswerSheet() {
    clearInterval(timerInterval);
    const answeredCount = Object.keys(answers).length;
    const dots = allQ.map((q, i) => {
      const ans = answers[q.id];
      const bg  = ans ? 'var(--success)' : 'var(--border)';
      return `<div class="answer-dot" style="width:34px;height:34px;border-radius:50%;background:${bg};border:2px solid transparent;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:${ans?'#fff':'var(--text-muted)'};cursor:pointer" data-idx="${i}" title="第${i+1}題${ans?'（已答）':'（未答）'}">${i+1}</div>`;
    }).join('');
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-size:0.85rem;font-weight:700;color:var(--primary)">答題情況</div>
        <div class="exam-timer ${timeLeft < 300 ? 'danger' : timeLeft < 900 ? 'warning' : ''}" id="timer-display" style="margin:0">⏱ ${formatTime(timeLeft)}</div>
      </div>
      <div class="card">
        <div style="display:flex;gap:16px;margin-bottom:14px;font-size:0.8rem">
          <span>✅ 已答 <b>${answeredCount}</b></span>
          <span style="color:var(--text-muted)">⬜ 未答 <b>${total - answeredCount}</b></span>
          <span>共 <b>${total}</b> 題</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px">${dots}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:14px">點擊題號可跳轉到對應題目</div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-secondary" id="back-exam-btn" style="flex:1">繼續作答</button>
          <button class="btn btn-danger" id="confirm-submit-btn" style="flex:1">確認交卷</button>
        </div>
      </div>`;
    startTimer();
    container.querySelectorAll('.answer-dot').forEach(dot => {
      dot.addEventListener('click', () => { idx = parseInt(dot.dataset.idx); clearInterval(timerInterval); renderExamUI(); startTimer(); });
    });
    container.querySelector('#back-exam-btn').addEventListener('click', () => { clearInterval(timerInterval); renderExamUI(); startTimer(); });
    container.querySelector('#confirm-submit-btn').addEventListener('click', () => submitExam());
  }

  // Warn user before navigating away mid-exam
  beforeUnloadHandler = function(e) {
    if (!submitted) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', beforeUnloadHandler);

  // Block bottom nav clicks during exam
  document.querySelectorAll('.nav-item[data-href]').forEach(el => {
    el.addEventListener('click', e => {
      if (!submitted) {
        e.stopImmediatePropagation();
        if (confirm('離開頁面將會放棄本次考試，確定離開？')) {
          clearInterval(timerInterval);
          window.removeEventListener('beforeunload', beforeUnloadHandler);
          window.location.href = el.dataset.href;
        }
      }
    }, true);
  });

  renderExamUI();
  startTimer();
}

// ── 考試結果 ─────────────────────────────────────────────────────────────
function renderExamResult(params) {
  const { correct, total, passed, wrongItems, allQ, answers, part1Correct = 0, part2Correct = 0, part1Total = 30, part2Total = 20 } = params;
  const part1Pass = part1Correct >= 18;
  const part2Pass = part2Correct >= 12;

  document.getElementById('main-content').innerHTML = `
    <div class="card">
      <div style="text-align:center;padding:20px 0 16px">
        <div style="font-size:2.5rem;margin-bottom:8px">${passed ? '🎉' : '📖'}</div>
        <div style="font-size:2.5rem;font-weight:900;color:${passed?'var(--success)':'var(--error)'};line-height:1">${correct}</div>
        <div style="font-size:1rem;color:var(--text-muted);margin-bottom:4px">/ ${total} 題正確</div>
        <div class="tag ${passed?'green':'red'}" style="font-size:0.9rem;padding:4px 16px;margin-bottom:8px;display:inline-block">${passed ? '✓ 合格' : '✗ 不合格'}</div>
      </div>
      <div style="display:flex;gap:10px;margin-bottom:14px">
        <div style="flex:1;background:${part1Pass?'#e8f8ef':'#fdecea'};border-radius:8px;padding:12px;text-align:center;border:1.5px solid ${part1Pass?'var(--success)':'var(--error)'}">
          <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">第一部分（單選題）</div>
          <div style="font-size:1.4rem;font-weight:800;color:${part1Pass?'var(--success)':'var(--error)'}">${part1Correct}/${part1Total}</div>
          <div style="font-size:0.72rem;margin-top:4px;color:${part1Pass?'var(--success)':'var(--error)'}">${part1Pass?'✓ 合格':'✗ 不合格'}（需≥18）</div>
        </div>
        <div style="flex:1;background:${part2Pass?'#e8f8ef':'#fdecea'};border-radius:8px;padding:12px;text-align:center;border:1.5px solid ${part2Pass?'var(--success)':'var(--error)'}">
          <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">第二部分（案例題）</div>
          <div style="font-size:1.4rem;font-weight:800;color:${part2Pass?'var(--success)':'var(--error)'}">${part2Correct}/${part2Total}</div>
          <div style="font-size:0.72rem;margin-top:4px;color:${part2Pass?'var(--success)':'var(--error)'}">${part2Pass?'✓ 合格':'✗ 不合格'}（需≥12）</div>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:4px">
        <button class="btn btn-secondary" id="home-btn" style="flex:1">返回首頁</button>
        <button class="btn btn-accent" id="review-btn" style="flex:1">逐題回顧</button>
        <button class="btn btn-primary" id="retry-exam-btn" style="flex:1">再考一次</button>
      </div>
    </div>
  `;

  document.querySelector('#home-btn')?.addEventListener('click', () => { window.location.href = 'index.html'; });
  document.querySelector('#retry-exam-btn')?.addEventListener('click', () => renderExamStart());
  document.querySelector('#review-btn')?.addEventListener('click', () => renderReviewMode(allQ, answers, params));
}

// ── 逐題回顧模式 ──────────────────────────────────────────────────────────
function renderReviewMode(allQ, answers, resultParams) {
  let idx = 0;
  const total = allQ.length;
  const container = document.getElementById('main-content');

  function buildReviewHTML() {
    const q = allQ[idx];
    const userAns = answers[q.id];
    const isCorrect = userAns && String(userAns).toLowerCase() === String(q.answer).toLowerCase();
    const isCase = q.isCase;

    const passageHTML = isCase ? `
      <div class="case-passage">
        <div class="case-title">📋 ${q.caseTitle}</div>
        ${formatCasePassage(q.casePassage, q.caseId)}
      </div>` : '';

    let optionsHTML;
    if (q.type === 'truefalse') {
      const vals = ['true', 'false'];
      const labels = ['✓ 正確', '✗ 錯誤'];
      optionsHTML = `<div class="tf-row">${vals.map((v, i) => {
        let cls = '';
        if (v === q.answer) cls = 'correct';
        else if (v === userAns) cls = 'wrong';
        return `<button class="tf-btn ${cls}" disabled>${labels[i]}</button>`;
      }).join('')}</div>`;
    } else {
      optionsHTML = `<div class="options-list">${q.options.map(opt => {
        const letter = opt[0];
        let cls = '';
        if (letter === q.answer) cls = 'correct';
        else if (letter === userAns) cls = 'wrong';
        return `<button class="option-btn ${cls}" disabled>${opt}</button>`;
      }).join('')}</div>`;
    }

    const statusLabel = !userAns
      ? `<span style="color:var(--text-muted);font-size:0.78rem">⬜ 未作答（正確：${q.answer}）</span>`
      : isCorrect
        ? `<span style="color:var(--success);font-size:0.78rem;font-weight:700">✓ 答對了</span>`
        : `<span style="color:var(--error);font-size:0.78rem;font-weight:700">✗ 答錯了（你選：${userAns}，正確：${q.answer}）</span>`;

    const explanationHTML = q.explanation ? `
      <div class="explanation-box ${isCorrect ? 'correct-exp' : (userAns ? 'wrong-exp' : 'study-exp')}" style="margin-top:12px">
        <div class="exp-label">解析</div>
        ${q.explanation}
      </div>` : '';

    const numDots = allQ.map((qq, i) => {
      const ans = answers[qq.id];
      const correct = ans && String(ans).toLowerCase() === String(qq.answer).toLowerCase();
      const isCur = i === idx;
      let bg, border, color;
      if (isCur) { bg = 'var(--primary)'; border = 'var(--primary)'; color = '#fff'; }
      else if (!ans) { bg = '#fff'; border = '#ddd'; color = '#aaa'; }
      else if (correct) { bg = '#e8f8ef'; border = 'var(--success)'; color = 'var(--success)'; }
      else { bg = '#fdecea'; border = 'var(--error)'; color = 'var(--error)'; }
      return `<button data-jump="${i}" style="width:32px;height:32px;border-radius:6px;border:2px solid ${border};background:${bg};color:${color};font-size:0.75rem;font-weight:700;cursor:pointer;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;padding:0">${i+1}</button>`;
    }).join('');

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <button class="btn btn-secondary btn-sm" id="back-result-btn">← 返回結果</button>
        <div style="font-size:0.78rem;color:var(--text-muted)">回顧模式</div>
      </div>
      <div id="qnum-bar" style="display:flex;flex-wrap:wrap;gap:5px;background:#fff;border-radius:10px;padding:10px 12px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,0.08)">${numDots}</div>
      <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:8px;text-align:center">
        第 ${idx+1} / ${total} 題${isCase ? ' · <span class="tag orange">案例題</span>' : ''}
      </div>
      <div class="card">
        ${passageHTML}
        <div class="question-header">
          <span class="question-counter">第 ${idx+1} 題</span>
          ${statusLabel}
        </div>
        <div class="question-text">${q.question}</div>
        ${optionsHTML}
        ${explanationHTML}
      </div>
      <div style="display:flex;gap:10px;margin-top:12px">
        <button class="btn btn-secondary" id="prev-btn" ${idx===0?'disabled':''} style="flex:1">‹ 上一題</button>
        <button class="btn btn-primary" id="next-btn" ${idx===total-1?'disabled':''} style="flex:1">下一題 ›</button>
      </div>
    `;
  }

  function render() {
    container.innerHTML = buildReviewHTML();
    initLandSearchViewers();
    const cur = container.querySelector(`#qnum-bar button[data-jump="${idx}"]`);
    if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
    container.querySelectorAll('#qnum-bar button[data-jump]').forEach(btn => {
      btn.addEventListener('click', () => { idx = parseInt(btn.dataset.jump); render(); });
    });
    container.querySelector('#prev-btn')?.addEventListener('click', () => { idx--; render(); });
    container.querySelector('#next-btn')?.addEventListener('click', () => { idx++; render(); });
    container.querySelector('#back-result-btn')?.addEventListener('click', () => renderExamResult(resultParams));
  }

  render();
}

document.addEventListener('DOMContentLoaded', () => {
  initBottomNav();
  initExamPage();
});
