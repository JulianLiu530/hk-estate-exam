// exam.js — 模擬考試邏輯（計時、判分、案例題）

// ── Exam Session ───────────────────────────────────────────────────────────

function renderExamSession(params) {
  const { questions } = params;
  const { regular, cases } = questions;

  // Build flat question list: 30 regular + case questions
  const allCaseQ = [];
  cases.forEach(c => {
    c.questions.forEach(q => allCaseQ.push({ ...q, caseId: c.id, caseTitle: c.title, casePassage: c.passage, isCase: true }));
  });
  const allQ = [...regular, ...allCaseQ];
  const total = allQ.length;
  const PASS_SCORE = Math.ceil(total * 0.7);
  const DURATION = 90 * 60; // 90 minutes in seconds

  let idx = 0;
  let answers = {}; // qid -> userAnswer
  let timerInterval = null;
  let timeLeft = DURATION;
  let submitted = false;

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }

  function buildExamHTML() {
    const q = allQ[idx];
    const isTF = q.type === 'truefalse';
    const isCase = q.isCase;
    const userAns = answers[q.id];

    const passageHTML = isCase ? `
      <div class="case-passage">
        <div class="case-title">📋 ${q.caseTitle}</div>
        ${q.casePassage}
      </div>` : '';

    const optionsHTML = isTF
      ? `<div class="tf-row">
           <button class="tf-btn ${userAns === 'true' ? 'selected' : ''}" data-val="true">✓ 正確</button>
           <button class="tf-btn ${userAns === 'false' ? 'selected' : ''}" data-val="false">✗ 錯誤</button>
         </div>`
      : `<div class="options-list">
           ${q.options.map((opt, i) => {
             const val = 'ABCD'[i];
             return `<button class="option-btn ${userAns === val ? 'selected' : ''}" data-val="${val}">${opt}</button>`;
           }).join('')}
         </div>`;

    const timerClass = timeLeft < 300 ? 'danger' : timeLeft < 900 ? 'warning' : '';

    // Build question number dots
    const numDots = allQ.map((qq, i) => {
      const answered = answers[qq.id];
      const isCur = i === idx;
      const bg = isCur ? '#1a3a5c' : (answered ? '#4a7fc1' : '#fff');
      const color = (isCur || answered) ? '#fff' : '#888';
      const border = isCur ? '2px solid #1a3a5c' : (answered ? '2px solid #4a7fc1' : '2px solid #ddd');
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

  function startTimer(container) {
    timerInterval = setInterval(() => {
      if (submitted) { clearInterval(timerInterval); return; }
      timeLeft--;
      const el = container.querySelector('#timer-display');
      if (el) {
        el.textContent = `⏱ ${formatTime(timeLeft)}`;
        el.className = 'exam-timer ' + (timeLeft < 300 ? 'danger' : timeLeft < 900 ? 'warning' : '');
      }
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        submitExam(container);
      }
    }, 1000);
  }

  function submitExam(container) {
    if (submitted) return;
    submitted = true;
    clearInterval(timerInterval);

    let correct = 0;
    const wrongItems = [];
    allQ.forEach(q => {
      const userAns = answers[q.id];
      const isCorrect = userAns && String(userAns).toLowerCase() === String(q.answer).toLowerCase();
      if (isCorrect) correct++;
      else {
        wrongItems.push({ q, userAns });
        if (userAns) {
          Storage.addWrong(q.id, q, q.chapterId || 'exam', q.chapterTitle || '模擬考試', userAns);
        }
      }
    });

    const score = Math.round(correct / total * 100);
    const passed = correct >= PASS_SCORE;
    Storage.saveExamResult({ score: correct, total, passed, pct: score });
    Storage.touchStreak();
    updateHeaderStats();

    navigate('exam-result', { correct, total, score, passed, wrongItems, allQ, answers });
  }

  function renderExam(container) {
    container.innerHTML = buildExamHTML();

    // Scroll current qnum dot into view
    const currentDot = container.querySelector(`#qnum-bar button[data-jump="${idx}"]`);
    if (currentDot) currentDot.scrollIntoView({ block: 'nearest', inline: 'center' });

    // Question number jump
    container.querySelectorAll('#qnum-bar button[data-jump]').forEach(btn => {
      btn.addEventListener('click', () => {
        idx = parseInt(btn.dataset.jump);
        renderExam(container);
      });
    });

    // Answer buttons
    container.querySelectorAll('.option-btn, .tf-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = allQ[idx];
        answers[q.id] = btn.dataset.val;
        container.querySelectorAll('.option-btn, .tf-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        // Update qnum bar dot live
        const dot = container.querySelector(`#qnum-bar button[data-jump="${idx}"]`);
        if (dot) {
          dot.style.background = '#4a7fc1';
          dot.style.borderColor = '#4a7fc1';
          dot.style.color = '#fff';
        }
      });
    });

    container.querySelector('#prev-btn')?.addEventListener('click', () => { idx--; renderExam(container); });
    container.querySelector('#next-btn')?.addEventListener('click', () => {
      if (idx < total - 1) { idx++; renderExam(container); }
      else showAnswerSheet(container);
    });
    container.querySelector('#submit-btn')?.addEventListener('click', () => {
      if (confirm('確定要交卷嗎？')) submitExam(container);
    });
  }

  function showAnswerSheet(container) {
    clearInterval(timerInterval);
    const answeredCount = Object.keys(answers).length;
    const dots = allQ.map((q, i) => {
      const ans = answers[q.id];
      const isCurrent = i === idx;
      const bg = ans ? 'var(--success)' : 'var(--border)';
      const border = isCurrent ? '2px solid var(--primary)' : '2px solid transparent';
      return `<div class="answer-dot" style="width:34px;height:34px;border-radius:50%;background:${bg};
        border:${border};display:flex;align-items:center;justify-content:center;font-size:0.75rem;
        font-weight:700;color:${ans?'#fff':'var(--text-muted)'};cursor:pointer;box-sizing:border-box"
        data-idx="${i}" title="第${i+1}題${ans?'（已答）':'（未答）'}">${i+1}</div>`;
    }).join('');

    const unanswered = total - answeredCount;

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-size:0.85rem;font-weight:700;color:var(--primary)">答題情況</div>
        <div class="exam-timer ${timeLeft < 300 ? 'danger' : timeLeft < 900 ? 'warning' : ''}" id="timer-display" style="margin:0">⏱ ${formatTime(timeLeft)}</div>
      </div>
      <div class="card">
        <div style="display:flex;gap:16px;margin-bottom:14px;font-size:0.8rem">
          <span>✅ 已答 <b>${answeredCount}</b></span>
          <span style="color:var(--text-muted)">⬜ 未答 <b>${unanswered}</b></span>
          <span>共 <b>${total}</b> 題</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px">${dots}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:14px">點擊題號可跳轉到對應題目</div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-secondary" id="back-exam-btn" style="flex:1">繼續作答</button>
          <button class="btn btn-danger" id="confirm-submit-btn" style="flex:1">確認交卷</button>
        </div>
      </div>`;

    // Restart timer display
    startTimer(container);

    container.querySelectorAll('.answer-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        idx = parseInt(dot.dataset.idx);
        renderExam(container);
      });
    });
    container.querySelector('#back-exam-btn').addEventListener('click', () => renderExam(container));
    container.querySelector('#confirm-submit-btn').addEventListener('click', () => submitExam(container));
  }

  window._examRenderer = (container) => {
    renderExam(container);
    startTimer(container);
  };
  return `<div id="exam-container"></div>`;
}

// ── Exam Result ────────────────────────────────────────────────────────────

function renderExamResult(params) {
  const { correct, total, score, passed, wrongItems, allQ, answers } = params;

  const wrongHTML = wrongItems.slice(0, 10).map(({ q, userAns }) => `
    <div style="padding:12px 0;border-bottom:1px solid var(--border)">
      <div style="font-size:0.85rem;font-weight:600;margin-bottom:4px">${q.question}</div>
      <div style="font-size:0.78rem;color:var(--error)">你的答案：${userAns ? formatExamAnswer(userAns, q.type) : '未作答'}</div>
      <div style="font-size:0.78rem;color:var(--success)">正確答案：${formatExamAnswer(q.answer, q.type)}</div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;line-height:1.5">${q.explanation}</div>
    </div>`).join('');

  return `
    <div class="card">
      <div style="text-align:center;padding:20px 0 16px">
        <div style="font-size:2.5rem;margin-bottom:8px">${passed ? '🎉' : '📖'}</div>
        <div style="font-size:2.5rem;font-weight:900;color:${passed?'var(--success)':'var(--error)'};line-height:1">${correct}</div>
        <div style="font-size:1rem;color:var(--text-muted);margin-bottom:4px">/ ${total} 題正確</div>
        <div style="font-size:1.3rem;font-weight:700;color:${passed?'var(--success)':'var(--error)'};margin-bottom:6px">${score}%</div>
        <div class="tag ${passed?'green':'red'}" style="font-size:0.9rem;padding:4px 16px">${passed ? '✓ 合格' : '✗ 不合格'}</div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-top:8px">及格線：70%（${Math.ceil(total*0.7)} 題）</div>
      </div>
      <div class="result-breakdown">
        <div class="breakdown-item">
          <div class="breakdown-num">${correct}</div>
          <div class="breakdown-label">答對</div>
        </div>
        <div class="breakdown-item">
          <div class="breakdown-num">${total - correct}</div>
          <div class="breakdown-label">答錯</div>
        </div>
        <div class="breakdown-item">
          <div class="breakdown-num">${Object.keys(answers).length}</div>
          <div class="breakdown-label">已作答</div>
        </div>
        <div class="breakdown-item">
          <div class="breakdown-num">${total - Object.keys(answers).length}</div>
          <div class="breakdown-label">未作答</div>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:4px">
        <button class="btn btn-secondary" id="home-btn" style="flex:1">返回首頁</button>
        <button class="btn btn-primary" id="retry-exam-btn" style="flex:1">再考一次</button>
      </div>
    </div>
    ${wrongItems.length > 0 ? `
      <div class="section-label" style="margin-top:18px">錯題解析（前10題）</div>
      <div class="card">${wrongHTML}</div>
    ` : ''}
  `;
}

function formatExamAnswer(ans, type) {
  if (type === 'truefalse') return ans === 'true' ? '✓ 正確' : '✗ 錯誤';
  return ans;
}

// ── Bind page-specific events after render ─────────────────────────────────

function bindExamPageEvents(page, params, container) {
  if (page === 'chapter-practice' && window._practiceRenderer) {
    const pc = container.querySelector('#practice-container');
    if (pc) window._practiceRenderer(pc);
    window._practiceRenderer = null;
  }
  if (page === 'exam-session' && window._examRenderer) {
    const ec = container.querySelector('#exam-container');
    if (ec) window._examRenderer(ec);
    window._examRenderer = null;
  }
  if (page === 'exam-result') {
    container.querySelector('#home-btn')?.addEventListener('click', () => navigate('home'));
    container.querySelector('#retry-exam-btn')?.addEventListener('click', () => navigate('exam'));
  }
}

function updateHeaderStats() {
  const stats = Storage.getTotalStats();
  const streak = Storage.getStreak();
  const el = document.getElementById('header-stats');
  if (!el) return;
  const pct = stats.answered > 0 ? Math.round(stats.correct / stats.answered * 100) : 0;
  el.innerHTML = `
    <span>📝 ${stats.answered}</span>
    <span>✅ ${pct}%</span>
    <span>🔥 ${streak.days || 0}</span>
  `;
}

// Expose to app.js
window.ExamModule = {
  renderChapterPractice,
  renderExamSession,
  renderExamResult,
  bindExamPageEvents,
  updateHeaderStats,
};
