// Staff sign-in for the MOEST Media Command Center (Netlify Identity).
// Visitors without an editor account get a read-only view. Signed-in editors get
// every control. The server checks the editor role again on every change.
import {
  getUser, login, logout, handleAuthCallback, acceptInvite, recoverPassword, requestPasswordRecovery,
} from 'https://esm.sh/@netlify/identity@2.0.1';

const EDITOR_ROLES = ['editor', 'admin'];
const { esc, toast } = window.MOEST;

const isEditor = (user) => !!user && (user.roles || []).some((r) => EDITOR_ROLES.includes(r));

// ---------- Sign-in dialog ----------
const MODES = {
  login: { title: 'Staff Sign In', button: 'Sign In', password: 'Password' },
  forgot: { title: 'Reset Your Password', button: 'Send Reset Link', password: null },
  invite: { title: 'Accept Your Invitation', button: 'Create Account', password: 'Choose a password' },
  recovery: { title: 'Choose a New Password', button: 'Save Password', password: 'New password' },
};
let dialog;

function buildDialog() {
  const wrap = document.createElement('div');
  wrap.className = 'fixed inset-0 z-[75] bg-black/60 hidden items-center justify-center p-4';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-labelledby', 'authTitle');
  const field = 'w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-bahama-aqua';
  wrap.innerHTML = `
    <form class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-sm p-6 space-y-4" novalidate>
      <div class="flex items-center justify-between">
        <h3 id="authTitle" class="text-sm font-bold text-slate-900 dark:text-white"></h3>
        <button type="button" data-close class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <p data-intro class="text-xs text-slate-500 dark:text-slate-400"></p>
      <label data-email class="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Email
        <input name="email" type="email" autocomplete="username" class="${field}"></label>
      <label data-password class="block text-[11px] font-semibold text-slate-600 dark:text-slate-300"><span></span>
        <input name="password" type="password" minlength="8" class="${field}"></label>
      <p data-error class="hidden text-xs text-rose-500" role="alert"></p>
      <button type="submit" class="w-full py-2 bg-bahama-aqua text-white rounded-lg text-xs font-bold hover:bg-bahama-aqualight transition"></button>
      <div class="flex justify-between text-[11px]">
        <button type="button" data-goto="forgot" class="text-slate-500 hover:text-bahama-aqua">Forgot password?</button>
        <button type="button" data-goto="login" class="text-slate-500 hover:text-bahama-aqua">Back to sign in</button>
      </div>
    </form>`;
  document.body.appendChild(wrap);
  const form = wrap.querySelector('form');
  const close = () => { wrap.classList.add('hidden'); wrap.classList.remove('flex'); };
  wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  wrap.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => open(b.dataset.goto)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !wrap.classList.contains('hidden')) close(); });
  dialog = { wrap, form, close, mode: 'login', token: null };
  form.addEventListener('submit', submit);
}

function open(mode, token) {
  if (!dialog) buildDialog();
  const m = MODES[mode];
  const { wrap, form } = dialog;
  dialog.mode = mode;
  if (token) dialog.token = token;
  wrap.querySelector('#authTitle').innerHTML = `<i class="fa-solid fa-user-shield text-bahama-aqua me-2"></i>${m.title}`;
  wrap.querySelector('[data-intro]').textContent = {
    login: 'Ministry staff with editor access can sign in to add, edit, archive and remove stories.',
    forgot: "Enter your email and we'll send you a link to reset your password.",
    invite: 'Choose a password (at least 8 characters) to finish setting up your staff account.',
    recovery: 'Choose a new password (at least 8 characters).',
  }[mode];
  wrap.querySelector('[data-email]').classList.toggle('hidden', mode === 'invite' || mode === 'recovery');
  const pw = wrap.querySelector('[data-password]');
  pw.classList.toggle('hidden', !m.password);
  pw.querySelector('span').textContent = m.password || '';
  form.password.value = '';
  form.password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  form.querySelector('[type=submit]').textContent = m.button;
  wrap.querySelector('[data-goto="forgot"]').classList.toggle('invisible', mode !== 'login');
  wrap.querySelector('[data-goto="login"]').classList.toggle('invisible', mode !== 'forgot');
  showError('');
  wrap.classList.remove('hidden'); wrap.classList.add('flex');
  (m.password && (mode !== 'login' || form.email.value) ? form.password : form.email).focus();
}

function showError(msg) {
  const el = dialog.wrap.querySelector('[data-error]');
  el.textContent = msg;
  el.classList.toggle('hidden', !msg);
}

async function submit(e) {
  e.preventDefault();
  const { form, mode, token } = dialog;
  const email = form.email.value.trim();
  const password = form.password.value;
  if (mode !== 'invite' && mode !== 'recovery' && !email) return showError('Please enter your email.');
  if (MODES[mode].password && password.length < (mode === 'login' ? 1 : 8)) {
    return showError(mode === 'login' ? 'Please enter your password.' : 'Passwords must be at least 8 characters.');
  }
  const btn = form.querySelector('[type=submit]');
  btn.disabled = true;
  try {
    if (mode === 'login') await login(email, password);
    else if (mode === 'invite') await acceptInvite(token, password);
    else if (mode === 'recovery') await recoverPassword(token, password);
    else {
      await requestPasswordRecovery(email);
      dialog.close();
      toast('If that email has an account, a reset link is on its way');
      return;
    }
    // Reload so every page loads the full, staff-only view.
    location.reload();
  } catch (err) {
    showError(mode === 'login' ? 'Sign-in failed. Check your email and password.' : err.message || 'Something went wrong.');
  } finally {
    btn.disabled = false;
  }
}

// ---------- Header status ----------
function renderStatus(user) {
  const anchor = document.querySelector('[onclick="toggleTheme()"]');
  if (!anchor) return;
  let box = document.getElementById('authStatus');
  if (!box) {
    box = document.createElement('div');
    box.id = 'authStatus';
    box.className = 'flex items-center gap-2';
    anchor.before(box);
  }
  const btn = 'px-3 py-1.5 rounded-lg text-xs font-semibold border transition whitespace-nowrap';
  if (!user) {
    box.innerHTML = `<button type="button" data-signin class="${btn} border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"><i class="fa-solid fa-right-to-bracket me-1"></i>Staff sign in</button>`;
    box.querySelector('[data-signin]').addEventListener('click', () => open('login'));
    return;
  }
  const editor = isEditor(user);
  box.innerHTML = `
    <span class="hidden lg:inline text-[11px] text-slate-500 dark:text-slate-400 max-w-[12rem] truncate" title="${esc(user.email || '')}">
      <i class="fa-solid ${editor ? 'fa-user-pen text-emerald-500' : 'fa-eye'} me-1"></i>${esc(user.email || 'Signed in')}${editor ? '' : ' · view only'}</span>
    <button type="button" data-signout class="${btn} border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"><i class="fa-solid fa-right-from-bracket me-1"></i>Sign out</button>`;
  box.querySelector('[data-signout]').addEventListener('click', async () => {
    try { await logout(); } catch { /* cookie is cleared either way */ }
    location.reload();
  });
}

// ---------- Start-up ----------
async function start() {
  let user = null;
  try {
    // Password-reset links: handled here so staff can choose a new password.
    const hash = new URLSearchParams(location.hash.slice(1));
    const recoveryToken = hash.get('recovery_token');
    if (recoveryToken) {
      history.replaceState(null, '', location.pathname + location.search);
      open('recovery', recoveryToken);
    } else {
      // Invites, email confirmations and other links sent by Netlify Identity.
      const result = await handleAuthCallback();
      if (result?.type === 'invite' && result.token) open('invite', result.token);
      else if (result?.type === 'confirmation') toast('Email confirmed. You are signed in.');
    }
    user = await getUser();
  } catch (err) {
    console.warn('Staff sign-in unavailable', err);
  }
  const editor = isEditor(user);
  document.documentElement.classList.toggle('can-edit', editor);
  window.MOEST.auth = { user, isEditor: editor, signIn: () => open('login') };
  renderStatus(user);
  window.__moestResolveAuth({ user, isEditor: editor });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
