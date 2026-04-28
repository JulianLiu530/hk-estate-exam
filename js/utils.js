// utils.js — 各頁面共享工具函數

// ── 全局數據狀態 ──────────────────────────────────────────────────────────
const App = {
  questionsData: null,
  casesData: null,
  examsData: null,
  loaded: false,
  practiceState: null,
};

// ── 數據加載 ──────────────────────────────────────────────────────────────
async function loadData() {
  if (App.loaded) return;
  try {
    const [qRes, cRes, eRes] = await Promise.all([
      fetch('data/questions.json'),
      fetch('data/cases.json'),
      fetch('data/exams.json'),
    ]);
    App.questionsData = await qRes.json();
    App.casesData    = await cRes.json();
    App.examsData    = await eRes.json();
    App.loaded = true;
  } catch (e) {
    console.error('Failed to load data:', e);
    showToast('題庫載入失敗，請重新整理頁面');
  }
}

// ── Toast 提示 ────────────────────────────────────────────────────────────
function showToast(msg, duration = 2200) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ── 答案格式化 ────────────────────────────────────────────────────────────
function formatAnswer(ans, type) {
  if (type === 'truefalse') return ans === 'true' ? '✓ 正確' : '✗ 錯誤';
  return ans;
}

// ── 頭部統計 ──────────────────────────────────────────────────────────────
function updateHeaderStats() {
  const stats  = Storage.getTotalStats();
  const streak = Storage.getStreak();
  const el     = document.getElementById('header-stats');
  if (!el) return;
  const pct = stats.answered > 0 ? Math.min(100, Math.round(stats.correct / stats.answered * 100)) : 0;
  el.innerHTML = `
    <span>📝 ${stats.answered}</span>
    <span>✅ ${pct}%</span>
    <span>🔥 ${streak.days || 0}</span>
  `;
}

// ── 底部導航 ──────────────────────────────────────────────────────────────
function initBottomNav() {
  const currentFile = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item[data-href]').forEach(el => {
    const href = el.dataset.href;
    if (href === currentFile || (currentFile === '' && href === 'index.html')) {
      el.classList.add('active');
    }
    el.addEventListener('click', () => { window.location.href = href; });
  });
}

// ── 題目總數 ──────────────────────────────────────────────────────────────
function getTotalQuestionCount() {
  if (!App.questionsData) return 0;
  return App.questionsData.chapters.reduce((sum, ch) => sum + ch.questions.length, 0);
}
