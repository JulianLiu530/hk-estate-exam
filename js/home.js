// home.js — 首頁邏輯

async function initHome() {
  Storage.touchStreak();
  await loadData();
  updateHeaderStats();

  const stats     = Storage.getTotalStats();
  const streak    = Storage.getStreak();
  const wrongCount= Storage.getWrongCount();
  const pct       = stats.answered > 0 ? Math.min(100, Math.round(stats.correct / stats.answered * 100)) : 0;
  const totalQ    = getTotalQuestionCount();

  document.getElementById('main-content').innerHTML = `
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

    <a href="exam.html" class="card action-card" style="display:block;text-decoration:none">
      <div class="card-row">
        <div class="card-icon blue">📝</div>
        <div class="card-body">
          <div class="card-title">模擬考試</div>
          <div class="card-desc">E牌全真模擬 · 50題 · 90分鐘</div>
        </div>
        <div class="card-arrow">›</div>
      </div>
    </a>

    <a href="practice.html" class="card action-card" style="display:block;text-decoration:none">
      <div class="card-row">
        <div class="card-icon green">📚</div>
        <div class="card-body">
          <div class="card-title">章節練習</div>
          <div class="card-desc">按章節刷題 · 即時解析</div>
        </div>
        <div class="card-arrow">›</div>
      </div>
    </a>

    <a href="wrong.html" class="card action-card" style="display:block;text-decoration:none">
      <div class="card-row">
        <div class="card-icon red">❌</div>
        <div class="card-body">
          <div class="card-title">錯題本</div>
          <div class="card-desc">${wrongCount} 題待複習</div>
        </div>
        <div class="card-arrow">›</div>
      </div>
    </a>

    <a href="stats.html" class="card action-card" style="display:block;text-decoration:none">
      <div class="card-row">
        <div class="card-icon orange">📊</div>
        <div class="card-body">
          <div class="card-title">學習統計</div>
          <div class="card-desc">各章節正確率分析</div>
        </div>
        <div class="card-arrow">›</div>
      </div>
    </a>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  initBottomNav();
  initHome();
});
