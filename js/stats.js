// stats.js — 學習統計頁面邏輯

async function initStatsPage() {
  Storage.touchStreak();
  await loadData();
  updateHeaderStats();
  renderStatsPage();
}

function renderStatsPage() {
  const main = document.getElementById('main-content');
  if (!App.questionsData) {
    main.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>載入中…</p></div>';
    return;
  }

  const stats   = Storage.getTotalStats();
  const streak  = Storage.getStreak();
  const history = Storage.getExamHistory();
  const pct     = stats.answered > 0 ? Math.min(100, Math.round(stats.correct / stats.answered * 100)) : 0;

  const chapterRows = App.questionsData.chapters.map(ch => {
    const prog  = Storage.getChapterProgress(ch.id);
    const cpct  = prog.total > 0 ? Math.min(100, Math.round(prog.correct / prog.total * 100)) : 0;
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

  main.innerHTML = `
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

document.addEventListener('DOMContentLoaded', () => {
  initBottomNav();
  initStatsPage();
});
