// ===== supabase.js — Supabase 客户端 + Auth + 数据同步 =====

const SUPABASE_URL = 'https://fiyjzlqklqtpujeexqzp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpeWp6bHFrbHF0cHVqZWV4cXpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NjgyMjksImV4cCI6MjA5MjA0NDIyOX0.RZ9DswvnHSmAekS5lLWmPBOAV4HcmfQYSI3aixg82Ro';

// Supabase client (使用 CDN 的 supabase-js)
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Auth ───────────────────────────────────────────────────────────────────

const INVITE_CODE = '187003';

/**
 * 注册（email + password + inviteCode）
 * 返回 { ok, msg }
 */
async function sbRegister(email, password, inviteCode) {
  if (inviteCode !== INVITE_CODE) return { ok: false, msg: '邀請碼不正確' };
  if (!email || !email.includes('@')) return { ok: false, msg: '請輸入有效的電郵地址' };
  if (password.length < 6) return { ok: false, msg: '密碼至少6位' };

  const { data, error } = await _supabase.auth.signUp({ email, password });
  if (error) {
    if (error.message.includes('already registered')) return { ok: false, msg: '此電郵已被注冊' };
    return { ok: false, msg: error.message };
  }
  // 自动登入（Supabase signUp 成功后会返回 session）
  return { ok: true, user: data.user };
}

/**
 * 登录
 * 返回 { ok, msg, user }
 */
async function sbLogin(email, password) {
  const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.message.includes('Invalid login')) return { ok: false, msg: '電郵或密碼錯誤' };
    return { ok: false, msg: error.message };
  }
  return { ok: true, user: data.user };
}

/**
 * 登出
 */
async function sbLogout() {
  // 先把本地数据同步到云端
  await sbSyncUp();
  await _supabase.auth.signOut();
}

/**
 * 获取当前 session（同步）
 */
function sbGetSession() {
  // 从 Supabase 存储的 session（supabase-js 会自动管理 localStorage 里的 session）
  const raw = localStorage.getItem('sb-fiyjzlqklqtpujeexqzp-auth-token');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.user || null;
  } catch { return null; }
}

function sbIsLoggedIn() {
  return !!sbGetSession();
}

// ── 数据同步：本地 ↔ 云端 ─────────────────────────────────────────────────

/**
 * 把本地 localStorage 数据上传到 Supabase
 */
async function sbSyncUp() {
  const user = sbGetSession();
  if (!user) return;

  const progress = JSON.parse(localStorage.getItem('hke_progress') || '{}');
  const wrongBook = JSON.parse(localStorage.getItem('hke_wrong') || '{}');
  const streak = JSON.parse(localStorage.getItem('hke_streak') || '{"days":0,"lastDate":""}');
  const examHistory = JSON.parse(localStorage.getItem('hke_exam_history') || '[]');

  await _supabase.from('user_data').upsert({
    id: user.id,
    progress,
    wrong_book: wrongBook,
    streak,
    exam_history: examHistory,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
}

/**
 * 从 Supabase 拉取数据，覆盖本地 localStorage
 */
async function sbSyncDown() {
  const user = sbGetSession();
  if (!user) return;

  const { data, error } = await _supabase
    .from('user_data')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !data) {
    // 用户首次登录，没有云端数据，把本地数据上传
    await sbSyncUp();
    return;
  }

  // 覆盖本地数据
  if (data.progress) localStorage.setItem('hke_progress', JSON.stringify(data.progress));
  if (data.wrong_book) localStorage.setItem('hke_wrong', JSON.stringify(data.wrong_book));
  if (data.streak) localStorage.setItem('hke_streak', JSON.stringify(data.streak));
  if (data.exam_history) localStorage.setItem('hke_exam_history', JSON.stringify(data.exam_history));
}

// 每次关键操作（答题、考试结束）后调用同步
// 防抖：500ms 内多次调用只执行一次
let _syncTimer = null;
function sbScheduleSync() {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    sbSyncUp().catch(console.error);
    _syncTimer = null;
  }, 500);
}

// ── 暴露接口 ──────────────────────────────────────────────────────────────

window.SupabaseAuth = {
  register: sbRegister,
  login: sbLogin,
  logout: sbLogout,
  getSession: sbGetSession,
  isLoggedIn: sbIsLoggedIn,
  syncUp: sbSyncUp,
  syncDown: sbSyncDown,
  scheduleSync: sbScheduleSync,
};
