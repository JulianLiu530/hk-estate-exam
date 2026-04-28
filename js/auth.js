// auth.js — 登录/注册界面（Supabase email 版本）

function renderAuthPage(onSuccess) {
  const container = document.getElementById('main-content');
  let mode = 'login'; // 'login' | 'register'

  function render() {
    if (mode === 'login') {
      container.innerHTML = `
        <div class="card" style="margin-top:24px">
          <div style="text-align:center;padding:16px 0 10px">
            <div style="font-size:2rem;margin-bottom:8px">🔐</div>
            <div style="font-size:1.1rem;font-weight:700;color:var(--primary);margin-bottom:4px">登入</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">登入後方可使用模擬考試</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px;margin-top:16px">
            <input id="auth-email" type="email" placeholder="電郵地址" autocomplete="email"
              style="padding:11px 14px;border-radius:8px;border:1.5px solid var(--border);font-size:0.95rem;font-family:var(--font);outline:none;width:100%;box-sizing:border-box">
            <input id="auth-password" type="password" placeholder="密碼" autocomplete="current-password"
              style="padding:11px 14px;border-radius:8px;border:1.5px solid var(--border);font-size:0.95rem;font-family:var(--font);outline:none;width:100%;box-sizing:border-box">
            <div id="auth-error" style="color:var(--error);font-size:0.8rem;min-height:18px;text-align:center"></div>
            <button class="btn btn-primary" id="auth-submit-btn" style="width:100%">登入</button>
          </div>
          <div style="text-align:center;margin-top:16px;font-size:0.82rem;color:var(--text-muted)">
            還沒有帳號？<button id="switch-mode-btn" style="background:none;border:none;color:var(--accent);font-weight:700;cursor:pointer;font-size:0.82rem;padding:0">立即注冊</button>
          </div>
        </div>
      `;
      document.getElementById('auth-submit-btn').addEventListener('click', async () => {
        const btn = document.getElementById('auth-submit-btn');
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const errEl = document.getElementById('auth-error');
        btn.disabled = true;
        btn.textContent = '登入中…';
        errEl.textContent = '';
        const result = await SupabaseAuth.login(email, password);
        if (result.ok) {
          // 登入成功，拉取云端数据
          await SupabaseAuth.syncDown();
          const displayName = email.split('@')[0];
          onSuccess(displayName);
        } else {
          errEl.textContent = result.msg;
          btn.disabled = false;
          btn.textContent = '登入';
        }
      });
      ['auth-email', 'auth-password'].forEach(id => {
        document.getElementById(id).addEventListener('keydown', e => {
          if (e.key === 'Enter') document.getElementById('auth-submit-btn').click();
        });
      });
    } else {
      container.innerHTML = `
        <div class="card" style="margin-top:24px">
          <div style="text-align:center;padding:16px 0 10px">
            <div style="font-size:2rem;margin-bottom:8px">📝</div>
            <div style="font-size:1.1rem;font-weight:700;color:var(--primary);margin-bottom:4px">注冊</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">需要邀請碼才能注冊</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px;margin-top:16px">
            <input id="auth-email" type="email" placeholder="電郵地址" autocomplete="email"
              style="padding:11px 14px;border-radius:8px;border:1.5px solid var(--border);font-size:0.95rem;font-family:var(--font);outline:none;width:100%;box-sizing:border-box">
            <input id="auth-password" type="password" placeholder="密碼（6位或以上）" autocomplete="new-password"
              style="padding:11px 14px;border-radius:8px;border:1.5px solid var(--border);font-size:0.95rem;font-family:var(--font);outline:none;width:100%;box-sizing:border-box">
            <input id="auth-invite" type="text" placeholder="邀請碼"
              style="padding:11px 14px;border-radius:8px;border:1.5px solid var(--border);font-size:0.95rem;font-family:var(--font);outline:none;width:100%;box-sizing:border-box">
            <div id="auth-error" style="color:var(--error);font-size:0.8rem;min-height:18px;text-align:center"></div>
            <button class="btn btn-primary" id="auth-submit-btn" style="width:100%">注冊</button>
          </div>
          <div style="text-align:center;margin-top:16px;font-size:0.82rem;color:var(--text-muted)">
            已有帳號？<button id="switch-mode-btn" style="background:none;border:none;color:var(--accent);font-weight:700;cursor:pointer;font-size:0.82rem;padding:0">立即登入</button>
          </div>
        </div>
      `;
      document.getElementById('auth-submit-btn').addEventListener('click', async () => {
        const btn = document.getElementById('auth-submit-btn');
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const invite = document.getElementById('auth-invite').value.trim();
        const errEl = document.getElementById('auth-error');
        btn.disabled = true;
        btn.textContent = '注冊中…';
        errEl.textContent = '';
        const result = await SupabaseAuth.register(email, password, invite);
        if (result.ok) {
          // 注册成功提示（Supabase 默认需要邮件确认，可关闭）
          errEl.style.color = 'var(--success)';
          errEl.textContent = '注冊成功！請檢查電郵確認後登入，或直接登入。';
          btn.disabled = false;
          btn.textContent = '注冊';
          // 2秒后切换到登录
          setTimeout(() => { mode = 'login'; render(); }, 2000);
        } else {
          errEl.style.color = 'var(--error)';
          errEl.textContent = result.msg;
          btn.disabled = false;
          btn.textContent = '注冊';
        }
      });
    }

    document.getElementById('switch-mode-btn').addEventListener('click', () => {
      mode = mode === 'login' ? 'register' : 'login';
      render();
    });
  }

  render();
}

// 考试页面守卫
function requireAuth(onAuthed) {
  if (SupabaseAuth.isLoggedIn()) {
    const user = SupabaseAuth.getSession();
    const displayName = user.email ? user.email.split('@')[0] : user.email;
    showLoggedInHeader(displayName);
    onAuthed();
    return;
  }
  renderAuthPage((displayName) => {
    showLoggedInHeader(displayName);
    onAuthed();
  });
}

function showLoggedInHeader(username) {
  const statsEl = document.getElementById('header-stats');
  if (!statsEl) return;
  const existing = statsEl.innerHTML;
  statsEl.innerHTML = `
    <span style="color:rgba(255,255,255,0.9);font-size:0.78rem">👤 ${username}</span>
    <button id="logout-btn" style="background:rgba(255,255,255,0.15);border:none;color:#fff;font-size:0.72rem;padding:3px 8px;border-radius:12px;cursor:pointer;font-family:var(--font)">登出</button>
  ` + existing;
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await SupabaseAuth.logout();
    window.location.reload();
  });
}
