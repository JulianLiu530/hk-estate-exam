// ===== app.js — 主應用邏輯、路由、狀態管理 =====

// ── State ──────────────────────────────────────────────────────────────────
const App = {
  currentPage: 'home',
  questionsData: null,
  casesData: null,
  examsData: null,
  loaded: false,
};

// ── Data Loading ───────────────────────────────────────────────────────────

async function loadData() {
  if (App.loaded) return;
  try {
    const [qRes, cRes, eRes] = await Promise.all([
      fetch('data/questions.json'),
      fetch('data/cases.json'),
      fetch('data/exams.json'),
    ]);
    App.questionsData = await qRes.json();
    App.casesData = await cRes.json();
    App.examsData = await eRes.json();
    App.loaded = true;
  } catch (e) {
    console.error('Failed to load data:', e);
    showToast('題庫載入失敗，請重新整理頁面');
  }
}

// ── Router ─────────────────────────────────────────────────────────────────

function navigate(page, params = {}) {
  App.currentPage = page;
  App.params = params;
  renderPage(page, params);
  window.scrollTo(0, 0);
  updateBottomNav(page);
}

function updateBottomNav(page) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
}

// ── Page Renderer ──────────────────────────────────────────────────────────

function renderPage(page, params = {}) {
  const main = document.getElementById('main-content');
  main.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'page';

  switch (page) {
    case 'home':     div.innerHTML = renderHome(); break;
    case 'practice': div.innerHTML = renderPracticeList(); break;
    case 'exam':     div.innerHTML = renderExamStart(); break;
    case 'wrong':    div.innerHTML = renderWrongBook(); break;
    case 'stats':    div.innerHTML = renderStats(); break;
    case 'chapter-practice': div.innerHTML = renderChapterPractice(params); break;
    case 'exam-session':     div.innerHTML = renderExamSession(params); break;
    case 'exam-result':      div.innerHTML = renderExamResult(params); break;
    case 'exam-select':      div.innerHTML = renderExamSelect(); break;
    default: div.innerHTML = renderHome();
  }

  main.appendChild(div);
  bindPageEvents(page, params);
}

// ── Home Page ──────────────────────────────────────────────────────────────

function renderHome() {
  const stats = Storage.getTotalStats();
  const streak = Storage.getStreak();
  const wrongCount = Storage.getWrongCount();
  const pct = stats.answered > 0 ? Math.round(stats.correct / stats.answered * 100) : 0;
  const totalQ = getTotalQuestionCount();

  return `
    <div class="home-banner">
      <h2>🏠 香港地產代理 E牌</h2>
      <p>模擬考試系統 · 共 ${totalQ} 題</p>
      <div class="banner-progress">
        <div class="banner-progress-bar" style="width:${Math.min(100, Math.round(stats.answered / totalQ * 100))}%"></div>
      </div>
      <div class="banner-progress-label">已練習 ${stats.answered} 題 · 正確率 ${pct}%</div>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-num">${stats.answered}</div>
        <div class="stat-label">已答題數</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${pct}%</div>
        <div class="stat-label">正確率</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${streak.days || 0}</div>
        <div class="stat-label">連續天數</div>
      </div>
    </div>

    <div class="section-label">快速開始</div>

    <div class="card action-card" data-nav="exam">
      <div class="card-row">
        <div class="card-icon blue">📝</div>
        <div class="card-body">
          <div class="card-title">模擬考試</div>
          <div class="card-desc">E牌全真模擬 · 50題 · 90分鐘</div>
        </div>
        <div class="card-arrow">›</div>
      </div>
    </div>

    <div class="card action-card" data-nav="practice">
      <div class="card-row">
        <div class="card-icon green">📚</div>
        <div class="card-body">
          <div class="card-title">章節練習</div>
          <div class="card-desc">按章節刷題 · 即時解析</div>
        </div>
        <div class="card-arrow">›</div>
      </div>
    </div>

    <div class="card action-card" data-nav="wrong">
      <div class="card-row">
        <div class="card-icon red">❌</div>
        <div class="card-body">
          <div class="card-title">錯題本</div>
          <div class="card-desc">${wrongCount} 題待複習</div>
        </div>
        <div class="card-arrow">›</div>
      </div>
    </div>

    <div class="card action-card" data-nav="stats">
      <div class="card-row">
        <div class="card-icon orange">📊</div>
        <div class="card-body">
          <div class="card-title">學習統計</div>
          <div class="card-desc">各章節正確率分析</div>
        </div>
        <div class="card-arrow">›</div>
      </div>
    </div>
  `;
}

// ── Practice List ──────────────────────────────────────────────────────────

function renderPracticeList() {
  if (!App.questionsData) return '<div class="empty-state"><div class="empty-icon">⏳</div><p>載入中…</p></div>';
  const chapters = App.questionsData.chapters;

  const items = chapters.map((ch, i) => {
    const prog = Storage.getChapterProgress(ch.id);
    const total = ch.questions.length;
    const done = prog.total || 0;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    return `
      <div class="chapter-item" data-chapter="${ch.id}">
        <div class="chapter-num">${i + 1}</div>
        <div class="chapter-info">
          <div class="chapter-title">${ch.title.replace(/^第.章：/, '')}</div>
          <div class="chapter-meta">${total} 題 · 已答 ${done} 題</div>
          <div class="chapter-progress-bar">
            <div class="chapter-progress-fill" style="width:${pct}%"></div>
          </div>
        </div>
        <div style="font-size:0.8rem;color:var(--text-muted);min-width:36px;text-align:right">${pct}%</div>
      </div>
    `;
  }).join('');

  return `
    <div class="section-label">選擇章節</div>
    ${items}
  `;
}

// ── Exam Start ─────────────────────────────────────────────────────────────

function renderExamStart() {
  const history = Storage.getExamHistory();
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

  return `
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
}

// ── Wrong Book ─────────────────────────────────────────────────────────────

function renderWrongBook() {
  const list = Storage.getWrongList(false);
  if (list.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-icon">🎉</div>
        <p>錯題本是空的，繼續加油！</p>
      </div>
    `;
  }

  const items = list.map(w => `
    <div class="wrong-list-item" data-qid="${w.qid}">
      <div class="wrong-item-q">${w.question}</div>
      <div class="wrong-item-meta">
        <span>📂 ${w.chapterTitle.replace(/^第.章：/, '')}</span>
        <span>❌ 錯誤 ${w.wrongCount || 1} 次</span>
      </div>
      <div style="font-size:0.8rem;margin:6px 0;color:var(--error)">
        你的答案：${formatAnswer(w.userAnswer, w.type)}
      </div>
      <div style="font-size:0.8rem;color:var(--success);margin-bottom:8px">
        正確答案：${formatAnswer(w.answer, w.type)}
      </div>
      <div style="font-size:0.78rem;color:var(--text-muted);line-height:1.6;margin-bottom:10px">${w.explanation}</div>
      <div class="wrong-item-actions">
        <button class="btn btn-sm btn-success mastered-btn" data-qid="${w.qid}" style="background:var(--success);color:#fff">✓ 已掌握</button>
        <button class="btn btn-sm btn-secondary remove-btn" data-qid="${w.qid}" style="background:var(--border);color:var(--text)">刪除</button>
      </div>
    </div>
  `).join('');

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div class="section-label" style="margin:0">錯題本（${list.length} 題）</div>
      <button class="btn btn-sm btn-secondary" id="practice-wrong-btn">只練錯題</button>
    </div>
    ${items}
  `;
}

// ── Stats Page ─────────────────────────────────────────────────────────────

function renderStats() {
  if (!App.questionsData) return '<div class="empty-state"><div class="empty-icon">⏳</div><p>載入中…</p></div>';
  const stats = Storage.getTotalStats();
  const streak = Storage.getStreak();
  const history = Storage.getExamHistory();
  const pct = stats.answered > 0 ? Math.round(stats.correct / stats.answered * 100) : 0;

  const chapterRows = App.questionsData.chapters.map(ch => {
    const prog = Storage.getChapterProgress(ch.id);
    const total = ch.questions.length;
    const cpct = prog.total > 0 ? Math.round(prog.correct / prog.total * 100) : 0;
    return `
      <div class="stats-chapter-row">
        <div class="stats-chapter-name">${ch.title.replace(/^第.章：/, '').substring(0, 14)}…</div>
        <div class="stats-chapter-bar">
          <div class="stats-bar-bg">
            <div class="stats-bar-fill" style="width:${cpct}%"></div>
          </div>
        </div>
        <div class="stats-pct">${cpct}%</div>
      </div>
    `;
  }).join('');

  const examRows = history.slice(0, 5).map(h => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="font-size:0.82rem;color:var(--text-muted)">${new Date(h.date).toLocaleDateString('zh-HK')}</div>
      <div style="font-size:0.9rem;font-weight:700;color:var(--primary)">${h.score}/${h.total}</div>
      <div class="tag ${h.passed ? 'green' : 'red'}">${h.passed ? '合格' : '不合格'}</div>
    </div>
  `).join('');

  return `
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-num">${stats.answered}</div>
        <div class="stat-label">總答題數</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${pct}%</div>
        <div class="stat-label">總正確率</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${streak.days || 0}</div>
        <div class="stat-label">連續天數</div>
      </div>
    </div>

    <div class="section-label">各章節正確率</div>
    ${chapterRows}

    ${history.length > 0 ? `
      <div class="section-label" style="margin-top:18px">考試記錄</div>
      <div class="card">${examRows}</div>
    ` : ''}
  `;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getTotalQuestionCount() {
  if (!App.questionsData) return 0;
  return App.questionsData.chapters.reduce((sum, ch) => sum + ch.questions.length, 0);
}

function formatAnswer(ans, type) {
  if (type === 'truefalse') return ans === 'true' ? '✓ 正確' : '✗ 錯誤';
  return ans;
}

function showToast(msg, duration = 2200) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ── Event Binding ──────────────────────────────────────────────────────────

function bindPageEvents(page, params) {
  // Home action cards
  document.querySelectorAll('.action-card[data-nav]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.nav));
  });

  // Practice chapter items
  document.querySelectorAll('.chapter-item[data-chapter]').forEach(el => {
    el.addEventListener('click', () => {
      const ch = App.questionsData.chapters.find(c => c.id === el.dataset.chapter);
      if (ch) navigate('chapter-practice', { chapter: ch });
    });
  });

  // Exam start - random
  const startRandomBtn = document.getElementById('start-random-exam-btn');
  if (startRandomBtn) startRandomBtn.addEventListener('click', () => {
    const questions = buildExamQuestions();
    navigate('exam-session', { questions, startTime: Date.now() });
  });

  // Exam select - specific paper
  document.querySelectorAll('.exam-select-item[data-exam-id]').forEach(el => {
    el.addEventListener('click', () => {
      const questions = buildExamQuestions(el.dataset.examId);
      navigate('exam-session', { questions, startTime: Date.now() });
    });
  });

  // Wrong book actions
  document.querySelectorAll('.mastered-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      Storage.markMastered(btn.dataset.qid);
      showToast('已標記為掌握 ✓');
      navigate('wrong');
    });
  });
  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      Storage.removeWrong(btn.dataset.qid);
      showToast('已刪除');
      navigate('wrong');
    });
  });

  // Practice wrong only
  const pwBtn = document.getElementById('practice-wrong-btn');
  if (pwBtn) pwBtn.addEventListener('click', () => {
    const list = Storage.getWrongList(false);
    if (list.length === 0) { showToast('沒有錯題'); return; }
    navigate('chapter-practice', { questions: list, title: '錯題練習', isWrongPractice: true });
  });

  // Chapter practice events
  if (page === 'chapter-practice') {
    bindPracticeEvents();
  }

  // Exam session renderer
  if (page === 'exam-session' && window._examRenderer) {
    const ec = document.querySelector('#exam-container');
    if (ec) window._examRenderer(ec);
    window._examRenderer = null;
  }

  // Exam result buttons
  if (page === 'exam-result') {
    document.querySelector('#home-btn')?.addEventListener('click', () => navigate('home'));
    document.querySelector('#retry-exam-btn')?.addEventListener('click', () => navigate('exam'));
  }

  updateHeaderStats();
}

// ── Build Exam Questions ───────────────────────────────────────────────────

function buildExamQuestions(examId) {
  // Use a specific exam set if examId provided
  if (examId && App.examsData) {
    const exam = App.examsData.find(e => e.exam_id === examId);
    if (exam) {
      return { regular: exam.regular, cases: exam.cases, title: exam.title };
    }
  }
  // Random: pick from all exams data if available
  if (App.examsData && App.examsData.length > 0) {
    const allRegular = App.examsData.flatMap(e => e.regular);
    const shuffled = allRegular.sort(() => Math.random() - 0.5).slice(0, 30);
    // Pick a random exam's cases
    const randomExam = App.examsData[Math.floor(Math.random() * App.examsData.length)];
    return { regular: shuffled, cases: randomExam.cases, title: '隨機模擬考試' };
  }
  // Fallback to old questions.json + cases.json
  const allQ = [];
  App.questionsData.chapters.forEach(ch => {
    ch.questions.forEach(q => allQ.push({ ...q, chapterId: ch.id, chapterTitle: ch.title }));
  });
  const shuffled = allQ.sort(() => Math.random() - 0.5).slice(0, 30);
  const cases = App.casesData.cases.map(c => ({ ...c, isCase: true }));
  return { regular: shuffled, cases };
}

// ── Init ───────────────────────────────────────────────────────────────────

async function init() {
  Storage.touchStreak();
  await loadData();
  navigate('home');

  // Bottom nav
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.page));
  });
}

document.addEventListener('DOMContentLoaded', init);
