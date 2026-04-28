// practice.js — 章節練習頁面邏輯（獨立頁面版）

// ── 頁面初始化 ───────────────────────────────────────────────────────────
async function initPracticePage() {
  Storage.touchStreak();
  await loadData();
  updateHeaderStats();

  // 檢查是否從錯題本跳來的「只練錯題」模式
  const isWrongPractice = sessionStorage.getItem('wrongPractice') === '1';
  if (isWrongPractice) {
    sessionStorage.removeItem('wrongPractice');
    const list = Storage.getWrongList(false);
    if (list.length === 0) {
      showToast('沒有錯題');
      renderChapterList();
    } else {
      startPractice({ questions: list, title: '錯題練習', isWrongPractice: true });
    }
    return;
  }

  renderChapterList();
}

// ── 章節列表 ─────────────────────────────────────────────────────────────
function renderChapterList() {
  if (!App.questionsData) {
    document.getElementById('main-content').innerHTML =
      '<div class="empty-state"><div class="empty-icon">⏳</div><p>載入中…</p></div>';
    return;
  }
  const chapters = App.questionsData.chapters;
  const items = chapters.map((ch, i) => {
    const prog  = Storage.getChapterProgress(ch.id);
    const total = ch.questions.length;
    const done  = prog.total || 0;
    const pct   = total > 0 ? Math.min(100, Math.round(done / total * 100)) : 0;
    return `
      <div class="chapter-item" data-chapter="${ch.id}">
        <div class="chapter-num">${i + 1}</div>
        <div class="chapter-info">
          <div class="chapter-title">${ch.title.replace(/^第.+?：/, '')}</div>
          <div class="chapter-meta">${total} 題 · 已答 ${done} 題</div>
          <div class="chapter-progress-bar">
            <div class="chapter-progress-fill" style="width:${pct}%"></div>
          </div>
        </div>
        <div style="font-size:0.8rem;color:var(--text-muted);min-width:36px;text-align:right">${pct}%</div>
      </div>
    `;
  }).join('');

  document.getElementById('main-content').innerHTML = `
    <div class="section-label">選擇章節</div>
    ${items}
  `;

  document.querySelectorAll('.chapter-item[data-chapter]').forEach(el => {
    el.addEventListener('click', () => {
      const ch = App.questionsData.chapters.find(c => c.id === el.dataset.chapter);
      if (ch) startPractice({ chapter: ch });
    });
  });
}

// ── 開始練習 ─────────────────────────────────────────────────────────────
function startPractice(params) {
  const { chapter, questions: wrongQuestions, title, isWrongPractice } = params;

  let questions, chapterId, chapterTitle;
  if (isWrongPractice) {
    questions    = wrongQuestions;
    chapterId    = 'wrong';
    chapterTitle = title || '錯題練習';
  } else {
    questions    = chapter.questions.map(q => ({ ...q, chapterId: chapter.id, chapterTitle: chapter.title }));
    chapterId    = chapter.id;
    chapterTitle = chapter.title;
  }

  if (!questions || questions.length === 0) {
    showToast('沒有題目');
    renderChapterList();
    return;
  }

  const prevMode = App.practiceState ? App.practiceState.mode : 'test';
  App.practiceState = {
    questions,
    chapterId,
    chapterTitle,
    current: 0,
    answered: {},
    isWrongPractice,
    mode: prevMode,
  };

  renderQuestion();
}

// ── 渲染題目 ─────────────────────────────────────────────────────────────
function renderQuestion() {
  const ps = App.practiceState;
  const { questions, current, answered, mode } = ps;
  const q = questions[current];
  const total = questions.length;
  const progressPct = Math.round((current / total) * 100);

  const isStudy    = mode === 'study';
  const isAnswered = answered[current] !== undefined;
  const userAns    = answered[current];
  const showAnswer = isStudy || isAnswered;

  const questionHtml = q.type === 'truefalse'
    ? renderTFQuestion(q, showAnswer, userAns, isStudy)
    : renderSingleQuestion(q, showAnswer, userAns, isStudy);

  const explanationHtml = showAnswer ? `
    <div class="explanation-box ${isStudy ? 'study-exp' : (userAns === q.answer ? 'correct-exp' : 'wrong-exp')}">
      ${!isStudy ? `<div class="exp-label">${userAns === q.answer ? '✓ 答對了！' : '✗ 答錯了'}</div>` : ''}
      ${q.explanation}
    </div>
  ` : '';

  const canGoNext = isStudy || isAnswered;
  const navHtml = `
    <div class="question-nav">
      <button class="btn btn-secondary" id="prev-btn" ${current === 0 ? 'disabled' : ''}>上一題</button>
      <button class="btn btn-primary" id="next-btn" ${!canGoNext ? 'disabled' : ''}>
        ${current === total - 1 ? '完成練習' : '下一題'}
      </button>
    </div>
  `;

  const modeToggle = `
    <div class="mode-toggle">
      <button class="mode-btn ${!isStudy ? 'active' : ''}" data-mode="test">📝 測試</button>
      <button class="mode-btn ${isStudy ? 'active' : ''}" data-mode="study">📖 背題</button>
    </div>
  `;

  document.getElementById('main-content').innerHTML = `
    <div class="page">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <button class="btn btn-secondary btn-sm" id="back-to-list">← 返回</button>
        <div style="font-size:0.78rem;color:var(--text-muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ps.chapterTitle.replace(/^第.+?：/, '')}</div>
      </div>
      ${modeToggle}
      <div class="exam-progress" style="margin-bottom:8px">
        <div class="exam-progress-fill" style="width:${progressPct}%"></div>
      </div>
      <div class="card" id="question-card">
        <div class="question-header">
          <div class="question-counter">第 ${current + 1} / ${total} 題</div>
          <div class="question-type-badge ${q.type === 'truefalse' ? 'tf' : ''}">
            ${q.type === 'truefalse' ? '判斷題' : '單選題'}
          </div>
        </div>
        <div class="question-text">${q.question}</div>
        ${questionHtml}
        ${explanationHtml}
      </div>
      ${navHtml}
    </div>
  `;

  bindPracticeEvents();
}

function renderSingleQuestion(q, showAnswer, userAns, isStudy) {
  return `
    <div class="options-list">
      ${q.options.map(opt => {
        const letter = opt[0];
        let cls = '';
        if (showAnswer) {
          if (letter === q.answer) cls = 'correct';
          else if (!isStudy && letter === userAns) cls = 'wrong';
        }
        return `<button class="option-btn ${cls}" data-ans="${letter}" ${showAnswer ? 'disabled' : ''}>${opt}</button>`;
      }).join('')}
    </div>
  `;
}

function renderTFQuestion(q, showAnswer, userAns, isStudy) {
  const trueClass  = showAnswer ? (q.answer === 'true'  ? 'correct' : (!isStudy && userAns === 'true'  ? 'wrong' : '')) : '';
  const falseClass = showAnswer ? (q.answer === 'false' ? 'correct' : (!isStudy && userAns === 'false' ? 'wrong' : '')) : '';
  return `
    <div class="tf-row">
      <button class="tf-btn ${trueClass}"  data-ans="true"  ${showAnswer ? 'disabled' : ''}>✓ 正確</button>
      <button class="tf-btn ${falseClass}" data-ans="false" ${showAnswer ? 'disabled' : ''}>✗ 錯誤</button>
    </div>
  `;
}

// ── 綁定事件 ─────────────────────────────────────────────────────────────
function bindPracticeEvents() {
  const ps = App.practiceState;
  if (!ps) return;

  document.getElementById('back-to-list')?.addEventListener('click', () => {
    App.practiceState = null;
    if (ps.isWrongPractice) {
      window.location.href = 'wrong.html';
    } else {
      renderChapterList();
    }
  });

  // 模式切換
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      ps.mode = btn.dataset.mode;
      renderQuestion();
    });
  });

  // 答題按鈕（測試模式）
  if (ps.mode === 'test') {
    document.querySelectorAll('.option-btn, .tf-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (ps.answered[ps.current] !== undefined) return;
        const ans = btn.dataset.ans;
        const q   = ps.questions[ps.current];
        const correct = ans === q.answer;
        ps.answered[ps.current] = ans;

        if (!ps.isWrongPractice) {
          Storage.recordAttempt(ps.chapterId, q.id || q.qid, correct);
        }
        if (!correct) {
          Storage.addWrong(q.id || q.qid, q, q.chapterId || ps.chapterId, q.chapterTitle || ps.chapterTitle, ans);
        }
        Storage.touchStreak();
        renderQuestion();
      });
    });
  }

  // 上一題 / 下一題
  document.getElementById('prev-btn')?.addEventListener('click', () => {
    if (ps.current > 0) { ps.current--; renderQuestion(); }
  });

  document.getElementById('next-btn')?.addEventListener('click', () => {
    if (ps.current < ps.questions.length - 1) {
      ps.current++;
      renderQuestion();
    } else {
      if (ps.mode === 'study') {
        App.practiceState = null;
        if (ps.isWrongPractice) window.location.href = 'wrong.html';
        else renderChapterList();
      } else {
        showPracticeComplete();
      }
    }
  });
}

// ── 練習完成 ─────────────────────────────────────────────────────────────
function showPracticeComplete() {
  const ps      = App.practiceState;
  const total   = ps.questions.length;
  const correct = Object.entries(ps.answered).filter(([i, ans]) => ans === ps.questions[+i].answer).length;
  const pct     = Math.round(correct / total * 100);

  document.getElementById('main-content').innerHTML = `
    <div class="card" style="text-align:center;padding:32px 20px">
      <div style="font-size:2.5rem;margin-bottom:12px">${pct >= 70 ? '🎉' : '📖'}</div>
      <div style="font-size:1.1rem;font-weight:700;color:var(--primary);margin-bottom:6px">練習完成！</div>
      <div style="font-size:2rem;font-weight:900;color:var(--primary);margin:12px 0">${correct} / ${total}</div>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:20px">正確率 ${pct}%</div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-secondary" style="flex:1" id="retry-btn">重新練習</button>
        <button class="btn btn-primary" style="flex:1" id="back-list-btn">返回章節</button>
      </div>
    </div>
  `;

  document.getElementById('retry-btn').addEventListener('click', () => {
    ps.current  = 0;
    ps.answered = {};
    renderQuestion();
  });
  document.getElementById('back-list-btn').addEventListener('click', () => {
    App.practiceState = null;
    renderChapterList();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initBottomNav();
  initPracticePage();
});
