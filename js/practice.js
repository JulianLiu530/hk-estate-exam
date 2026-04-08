// ===== practice.js — 章節練習邏輯 =====

// ── Chapter Practice Entry ──────────────────────────────────────────────────

function renderChapterPractice(params) {
  const { chapter, questions: wrongQuestions, title, isWrongPractice } = params;

  let questions, chapterId, chapterTitle;

  if (isWrongPractice) {
    questions = wrongQuestions;
    chapterId = 'wrong';
    chapterTitle = title || '錯題練習';
  } else {
    questions = chapter.questions.map(q => ({ ...q, chapterId: chapter.id, chapterTitle: chapter.title }));
    chapterId = chapter.id;
    chapterTitle = chapter.title;
  }

  if (!questions || questions.length === 0) {
    return `<div class="empty-state"><div class="empty-icon">📭</div><p>沒有題目</p></div>`;
  }

  // Preserve mode if already set, default to 'test'
  const prevMode = App.practiceState ? App.practiceState.mode : 'test';

  App.practiceState = {
    questions,
    chapterId,
    chapterTitle,
    current: 0,
    answered: {},
    isWrongPractice,
    mode: prevMode, // 'test' | 'study'
  };

  return renderPracticeQuestion();
}

// ── Render Question ─────────────────────────────────────────────────────────

function renderPracticeQuestion() {
  const ps = App.practiceState;
  const { questions, current, answered, mode } = ps;
  const q = questions[current];
  const total = questions.length;
  const progressPct = Math.round((current / total) * 100);

  const isStudy = mode === 'study';
  const isAnswered = answered[current] !== undefined;
  const userAns = answered[current];

  // In study mode, always show answer; in test mode, show after answering
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

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <button class="btn btn-secondary btn-sm" id="back-to-list">← 返回</button>
      <div style="font-size:0.78rem;color:var(--text-muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ps.chapterTitle.replace(/^第.章：/, '')}</div>
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
  `;
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
        return `<button class="option-btn ${cls}" data-ans="${letter}" ${showAnswer && !isStudy ? 'disabled' : ''}>${opt}</button>`;
      }).join('')}
    </div>
  `;
}

function renderTFQuestion(q, showAnswer, userAns, isStudy) {
  const trueClass = showAnswer ? (q.answer === 'true' ? 'correct' : (!isStudy && userAns === 'true' ? 'wrong' : '')) : '';
  const falseClass = showAnswer ? (q.answer === 'false' ? 'correct' : (!isStudy && userAns === 'false' ? 'wrong' : '')) : '';
  return `
    <div class="tf-row">
      <button class="tf-btn ${trueClass}" data-ans="true" ${showAnswer && !isStudy ? 'disabled' : ''}>✓ 正確</button>
      <button class="tf-btn ${falseClass}" data-ans="false" ${showAnswer && !isStudy ? 'disabled' : ''}>✗ 錯誤</button>
    </div>
  `;
}

// ── Bind Events ─────────────────────────────────────────────────────────────

function bindPracticeEvents() {
  const ps = App.practiceState;
  if (!ps) return;

  document.getElementById('back-to-list')?.addEventListener('click', () =>
    navigate(ps.isWrongPractice ? 'wrong' : 'practice'));

  // Mode toggle
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      ps.mode = btn.dataset.mode;
      refreshPractice();
    });
  });

  // Answer buttons (test mode only)
  if (ps.mode === 'test') {
    document.querySelectorAll('.option-btn, .tf-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (ps.answered[ps.current] !== undefined) return;
        const ans = btn.dataset.ans;
        const q = ps.questions[ps.current];
        const correct = ans === q.answer;
        ps.answered[ps.current] = ans;

        if (!ps.isWrongPractice) {
          Storage.recordAttempt(ps.chapterId, q.id || q.qid, correct);
        }
        if (!correct) {
          Storage.addWrong(q.id || q.qid, q, q.chapterId || ps.chapterId, q.chapterTitle || ps.chapterTitle, ans);
        }
        Storage.touchStreak();

        refreshPractice();
      });
    });
  }

  // Prev / Next
  document.getElementById('prev-btn')?.addEventListener('click', () => {
    if (ps.current > 0) { ps.current--; refreshPractice(); }
  });

  document.getElementById('next-btn')?.addEventListener('click', () => {
    if (ps.current < ps.questions.length - 1) {
      ps.current++;
      refreshPractice();
    } else {
      if (ps.mode === 'study') {
        navigate(ps.isWrongPractice ? 'wrong' : 'practice');
      } else {
        showPracticeComplete();
      }
    }
  });
}

function refreshPractice() {
  const main = document.getElementById('main-content');
  const div = main.querySelector('.page');
  div.innerHTML = renderPracticeQuestion();
  bindPracticeEvents();
  window.scrollTo(0, 0);
}

// ── Practice Complete ───────────────────────────────────────────────────────

function showPracticeComplete() {
  const ps = App.practiceState;
  const total = ps.questions.length;
  const correct = Object.entries(ps.answered).filter(([i, ans]) => ans === ps.questions[+i].answer).length;
  const pct = Math.round(correct / total * 100);

  const main = document.getElementById('main-content');
  const div = main.querySelector('.page');
  div.innerHTML = `
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
    ps.current = 0;
    ps.answered = {};
    refreshPractice();
  });
  document.getElementById('back-list-btn').addEventListener('click', () => navigate('practice'));
}
