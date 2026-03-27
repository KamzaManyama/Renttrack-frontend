(function () {
  /* ── App name / slug ──────────────────────────────────────── */
  const appName = (typeof ENV !== 'undefined' && ENV.APP_NAME) || 'RentTrack';
  document.getElementById('app-name').textContent = appName;
  document.title = `Sign In | ${appName}`;
  document.getElementById('slug-text').textContent =
    (typeof window.SLUG !== 'undefined' && window.SLUG) ||
    (typeof ENV !== 'undefined' && ENV.SLUG) || 'renttrack';

  /* ── Storage helpers — write to ALL common key patterns ───────
     app.js Auth implementations vary. We write under every common
     key name so whichever one app.js checks, it will find a valid
     session. On clear we remove all of them.
  ──────────────────────────────────────────────────────────── */
  const TOKEN_KEYS = ['rt_token',  'auth_token',  'token',  '_token'];
  const USER_KEYS  = ['rt_user',   'auth_user',   'user',   '_user'];

  function saveSession(token, user) {
    const userStr = JSON.stringify(user);
    TOKEN_KEYS.forEach(k => { try { localStorage.setItem(k, token); } catch(e){} });
    USER_KEYS.forEach(k  => { try { localStorage.setItem(k, userStr); } catch(e){} });
  }

  function clearSession() {
    TOKEN_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch(e){} });
    USER_KEYS.forEach(k  => { try { localStorage.removeItem(k); } catch(e){} });
  }

  function readSession() {
    /* Try each key pair until we find a valid one */
    for (let i = 0; i < TOKEN_KEYS.length; i++) {
      try {
        const t = localStorage.getItem(TOKEN_KEYS[i]);
        const u = localStorage.getItem(USER_KEYS[i]);
        if (t && u) return { token: t, user: JSON.parse(u) };
      } catch(e) {}
    }
    return null;
  }

  /* ── Patch / create the Auth object ──────────────────────────
     If app.js already created an Auth object that has a working
     isLoggedIn(), leave its internal state alone but make sure
     its set/clear methods also hit all key names.
     If no Auth exists at all, create a full one.
  ──────────────────────────────────────────────────────────── */
  if (!window.Auth) {
    window.Auth = {
      _token: null,
      _user:  null,

      set: function (token, user) {
        this._token = token;
        this._user  = user;
        saveSession(token, user);
      },

      isLoggedIn: function () {
        if (this._token && this._user) return true;
        const s = readSession();
        if (s) { this._token = s.token; this._user = s.user; return true; }
        return false;
      },

      get user() { return this._user; },
      get token() { return this._token; },

      clear: function () {
        this._token = null;
        this._user  = null;
        clearSession();
      }
    };
    Auth.isLoggedIn(); /* restore from storage if available */
  } else {
    /* app.js Auth exists — patch its set/clear to also cover all keys */
    const _origSet   = Auth.set?.bind(Auth);
    const _origClear = Auth.clear?.bind(Auth);

    Auth.set = function(token, user) {
      if (_origSet) _origSet(token, user);
      saveSession(token, user);
    };
    Auth.clear = function() {
      if (_origClear) _origClear();
      clearSession();
    };

    /* Make sure in-memory state is populated if storage has data */
    if (!Auth.isLoggedIn || !Auth.isLoggedIn()) {
      const s = readSession();
      if (s) {
        /* Attempt to restore via whatever mechanism app.js exposes */
        if (typeof Auth.set === 'function') Auth.set(s.token, s.user);
      }
    }
  }

  /* ── Ensure POST exists (fallback for login endpoint) ────── */
  if (!window.POST) {
    window.POST = async function (url, data) {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'Login failed');
      return json;
    };
  }

  /* ── REDIRECT GUARD ───────────────────────────────────────────
     Only auto-redirect if we have a session AND we did not just
     log out (flag set by logout() in all portal pages).
  ──────────────────────────────────────────────────────────── */
  const justLoggedOut = sessionStorage.getItem('rt_logged_out');
  if (!justLoggedOut && Auth.isLoggedIn()) {
    const role = Auth.user?.role || 'tenant';
    const dest = roleToPage(role);
    window.location.replace(dest);
    return; /* stop rest of script — no event listeners needed */
  }
  sessionStorage.removeItem('rt_logged_out');

  /* ── Role → page mapping ─────────────────────────────────── */
  function roleToPage(role) {
    switch (role) {
      case 'super_admin':                          return 'superadmin.html';
      case 'manager':                              return 'manager.html';
      case 'maintenance_admin':                    return 'caretaker.html';
      case 'technician':                           return 'technician.html';
      case 'staff':
      default:                                     return 'tenant.html';
    }
  }

//   case 'manager':             return 'manager.html';
// case 'maintenance_admin':   return 'caretaker.html';
// case 'caretaker':           return 'caretaker.html';

  /* ── Password toggle ─────────────────────────────────────── */
  document.getElementById('pw-toggle').addEventListener('click', function () {
    const inp  = document.getElementById('password');
    const icon = document.getElementById('eye-icon');
    const show = inp.type === 'password';
    inp.type   = show ? 'text' : 'password';
    icon.innerHTML = show
      ? `<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`
      : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
  });

  /* ── Validation helpers ──────────────────────────────────── */
  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  function clearErrors() {
    ['email', 'password'].forEach(f => {
      document.getElementById(f).classList.remove('error');
      document.getElementById(`${f}-error`).classList.remove('show');
    });
    document.getElementById('api-error').classList.remove('show');
  }

  function fieldErr(field, msg) {
    const inp = document.getElementById(field);
    const err = document.getElementById(`${field}-error`);
    inp.classList.add('error');
    if (msg) err.textContent = msg;
    err.classList.add('show');
  }

  function apiErr(msg) {
    document.getElementById('api-error-text').textContent = msg;
    document.getElementById('api-error').classList.add('show');
  }

  /* ── Submit handler ──────────────────────────────────────── */
  document.getElementById('login-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    clearErrors();

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    let bad = false;

    if (!email || !isEmail(email)) { fieldErr('email');    bad = true; }
    if (!password)                  { fieldErr('password'); bad = true; }
    if (bad) return;

    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Signing in…';

    try {
      const resp = await POST('/api/auth/login', { email, password });

      /* Support { data:{token,user} } and flat { token, user } shapes */
      const token = resp?.data?.token || resp?.token;
      const user  = resp?.data?.user  || resp?.user;

      if (!token || !user) throw new Error('Unexpected response from server.');

      /* Persist session under ALL key names before navigating */
      Auth.set(token, user);

      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg> Success!`;

      setTimeout(() => {
        window.location.replace(roleToPage(user.role || 'tenant'));
      }, 400);

    } catch (err) {
      apiErr(err.message || 'Invalid email or password. Please try again.');
      btn.disabled = false;
      btn.innerHTML = 'Sign In';
    }
  });

  /* ── Clear error styling on input ───────────────────────── */
  ['email', 'password'].forEach(f => {
    document.getElementById(f).addEventListener('input', function () {
      this.classList.remove('error');
      document.getElementById(`${f}-error`).classList.remove('show');
      document.getElementById('api-error').classList.remove('show');
    });
  });

})();

  // Simple password visibility toggle (preserves existing login.js functionality)
  (function() {
    const toggleBtn = document.getElementById('pw-toggle');
    const passwordInput = document.getElementById('password');
    const eyeIcon = document.getElementById('eye-icon');
    
    if (toggleBtn && passwordInput) {
      toggleBtn.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        
        // Update icon
        if (type === 'text') {
          eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
        } else {
          eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
        }
      });
    }
    
    // Load slug from env.js
    const slugSpan = document.getElementById('slug-text');
    if (slugSpan) {
      if (typeof window.ENV !== 'undefined' && window.ENV.SLUG) {
        slugSpan.innerText = window.ENV.SLUG;
      } else if (typeof window.__ENV !== 'undefined' && window.__ENV.SLUG) {
        slugSpan.innerText = window.__ENV.SLUG;
      } else {
        slugSpan.innerText = 'RentTrack';
      }
    }
  })();