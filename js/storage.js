// ===== storage.js — localStorage 持久化 =====

const KEYS = {
  WRONG: 'hke_wrong',
  PROGRESS: 'hke_progress',
  STREAK: 'hke_streak',
  TOTAL: 'hke_total',
  EXAM_HISTORY: 'hke_exam_history',
};

// ── Wrong Answer Book ──────────────────────────────────────────────────────

function getWrongBook() {
  try { return JSON.parse(localStorage.getItem(KEYS.WRONG) || '{}'); }
  catch { return {}; }
}

function saveWrongBook(book) {
  localStorage.setItem(KEYS.WRONG, JSON.stringify(book));
}

/**
 * Add a wrong answer entry.
 * @param {string} qid - question id
 * @param {object} q - question object
 * @param {string} chapterId
 * @param {string} chapterTitle
 * @param {string} userAnswer - what user picked
 */
function addWrong(qid, q, chapterId, chapterTitle, userAnswer) {
  const book = getWrongBook();
  if (book[qid] && book[qid].mastered) return; // already mastered, skip
  book[qid] = {
    qid,
    question: q.question,
    type: q.type,
    options: q.options || null,
    answer: q.answer,
    explanation: q.explanation,
    chapterId,
    chapterTitle,
    userAnswer,
    mastered: false,
    addedAt: Date.now(),
    wrongCount: (book[qid] ? book[qid].wrongCount : 0) + 1,
  };
  saveWrongBook(book);
}

function removeWrong(qid) {
  const book = getWrongBook();
  delete book[qid];
  saveWrongBook(book);
}

function markMastered(qid) {
  const book = getWrongBook();
  if (book[qid]) { book[qid].mastered = true; saveWrongBook(book); }
}

function getWrongList(includeMastered = false) {
  const book = getWrongBook();
  return Object.values(book)
    .filter(w => includeMastered || !w.mastered)
    .sort((a, b) => b.addedAt - a.addedAt);
}

function getWrongCount() {
  return getWrongList(false).length;
}

// ── Chapter Progress ───────────────────────────────────────────────────────

function getProgress() {
  try { return JSON.parse(localStorage.getItem(KEYS.PROGRESS) || '{}'); }
  catch { return {}; }
}

function saveProgress(prog) {
  localStorage.setItem(KEYS.PROGRESS, JSON.stringify(prog));
}

/**
 * Record a question attempt for a chapter.
 * @param {string} chapterId
 * @param {string} qid
 * @param {boolean} correct
 */
function recordAttempt(chapterId, qid, correct) {
  const prog = getProgress();
  if (!prog[chapterId]) prog[chapterId] = { attempted: {}, correct: 0, total: 0 };
  const ch = prog[chapterId];
  const wasCorrect = ch.attempted[qid];
  ch.attempted[qid] = correct;
  // Recalculate correct count
  ch.correct = Object.values(ch.attempted).filter(Boolean).length;
  ch.total = Object.keys(ch.attempted).length;
  saveProgress(prog);
  updateTotalStats(correct, wasCorrect === undefined);
}

function getChapterProgress(chapterId) {
  const prog = getProgress();
  return prog[chapterId] || { attempted: {}, correct: 0, total: 0 };
}

// ── Total Stats ────────────────────────────────────────────────────────────

function getTotalStats() {
  try { return JSON.parse(localStorage.getItem(KEYS.TOTAL) || '{"answered":0,"correct":0}'); }
  catch { return { answered: 0, correct: 0 }; }
}

function updateTotalStats(correct, isNew) {
  const stats = getTotalStats();
  if (isNew) stats.answered++;
  if (correct) stats.correct++;
  localStorage.setItem(KEYS.TOTAL, JSON.stringify(stats));
}

// ── Streak ─────────────────────────────────────────────────────────────────

function getStreak() {
  try { return JSON.parse(localStorage.getItem(KEYS.STREAK) || '{"days":0,"lastDate":""}'); }
  catch { return { days: 0, lastDate: '' }; }
}

function touchStreak() {
  const today = new Date().toISOString().slice(0, 10);
  const streak = getStreak();
  if (streak.lastDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  streak.days = streak.lastDate === yesterday ? streak.days + 1 : 1;
  streak.lastDate = today;
  localStorage.setItem(KEYS.STREAK, JSON.stringify(streak));
}

// ── Exam History ───────────────────────────────────────────────────────────

function saveExamResult(result) {
  try {
    const history = JSON.parse(localStorage.getItem(KEYS.EXAM_HISTORY) || '[]');
    history.unshift({ ...result, date: Date.now() });
    if (history.length > 20) history.length = 20;
    localStorage.setItem(KEYS.EXAM_HISTORY, JSON.stringify(history));
  } catch {}
}

function getExamHistory() {
  try { return JSON.parse(localStorage.getItem(KEYS.EXAM_HISTORY) || '[]'); }
  catch { return []; }
}

// ── Clear All ──────────────────────────────────────────────────────────────

function clearAll() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}

// Export
window.Storage = {
  addWrong, removeWrong, markMastered, getWrongList, getWrongCount,
  recordAttempt, getChapterProgress, getProgress,
  getTotalStats, getStreak, touchStreak,
  saveExamResult, getExamHistory,
  clearAll,
};
