// wrong.js — 錯題本頁面邏輯

async function initWrongPage() {
  Storage.touchStreak();
  updateHeaderStats();
  renderWrongPage();
}

function renderWrongPage() {
  const list = Storage.getWrongList(false);
  const main = document.getElementById('main-content');

  if (list.length === 0) {
    main.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎉</div>
        <p>錯題本是空的，繼續加油！</p>
      </div>
    `;
    return;
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

  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div class="section-label" style="margin:0">錯題本（${list.length} 題）</div>
      <button class="btn btn-sm btn-secondary" id="practice-wrong-btn">只練錯題</button>
    </div>
    ${items}
  `;

  // 已掌握
  document.querySelectorAll('.mastered-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      Storage.markMastered(btn.dataset.qid);
      showToast('已標記為掌握 ✓');
      renderWrongPage();
    });
  });
  // 刪除
  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      Storage.removeWrong(btn.dataset.qid);
      showToast('已刪除');
      renderWrongPage();
    });
  });
  // 只練錯題 — 跳到練習頁，帶 wrongPractice 參數
  document.getElementById('practice-wrong-btn')?.addEventListener('click', () => {
    sessionStorage.setItem('wrongPractice', '1');
    window.location.href = 'practice.html';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initBottomNav();
  initWrongPage();
});
