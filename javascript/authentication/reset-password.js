// ─────────────────────────────────────────────────────────────
//  reset-password.js
//
//  Reads ?token= from the URL, submits to:
//    POST /api/auth/reset-password  { token, new_password }
//
//  ENV.API_BASE_URL must point to your backend, not GitHub Pages.
// ─────────────────────────────────────────────────────────────

(function () {

  // ── Resolve API base ─────────────────────────────────────────
  if (typeof ENV === 'undefined' || !ENV.API_BASE_URL) {
    console.error(
      '[reset-password] ENV.API_BASE_URL is not set.\n' +
      'Open env.js and set it to your backend address.'
    );
  }

  const API = (typeof ENV !== 'undefined' && ENV.API_BASE_URL)
    ? ENV.API_BASE_URL.replace(/\/$/, '')
    : null;

  // ── Pull token from URL ───────────────────────────────────────
  const token = new URLSearchParams(location.search).get('token');

  // ── DOM ──────────────────────────────────────────────────────
  const form           = document.getElementById('reset-form');
  const pwInput        = document.getElementById('new-password');
  const pw2Input       = document.getElementById('confirm-password');
  const pwError        = document.getElementById('pw-error');
  const pw2Error       = document.getElementById('pw2-error');
  const submitBtn      = document.getElementById('reset-btn');
  const successAlert   = document.getElementById('success-alert');
  const errorAlert     = document.getElementById('error-alert');
  const successMessage = document.getElementById('success-message');
  const errorMessage   = document.getElementById('error-message');
  const tokenError     = document.getElementById('token-error');
  const slugSpan       = document.getElementById('slug-text');

  // ── Brand slug ───────────────────────────────────────────────
  if (slugSpan) {
    slugSpan.textContent =
      (typeof ENV !== 'undefined' && ENV.SLUG) ? ENV.SLUG : 'RentTrack';
  }

  // ── No token → show error block, hide form ────────────────────
  if (!token) {
    if (tokenError) tokenError.style.display = '';
    if (form)       form.style.display = 'none';
  }

  // ── Alert helpers ────────────────────────────────────────────
  function hideAlerts() {
    successAlert && successAlert.classList.remove('show');
    errorAlert   && errorAlert.classList.remove('show');
  }

  function showSuccess(msg) {
    if (!successMessage || !successAlert) return;
    successMessage.textContent = msg;
    successAlert.classList.add('show');
  }

  function showError(msg) {
    if (!errorMessage || !errorAlert) return;
    errorMessage.textContent = msg;
    errorAlert.classList.add('show');
    clearTimeout(errorAlert._t);
    errorAlert._t = setTimeout(() => errorAlert.classList.remove('show'), 7000);
  }

  // ── Button loading ───────────────────────────────────────────
  function setLoading(on) {
    if (!submitBtn) return;
    if (on) {
      submitBtn.disabled         = true;
      submitBtn.dataset.original = submitBtn.innerHTML;
      submitBtn.innerHTML        = '<span class="spinner"></span><span>Resetting…</span>';
    } else {
      submitBtn.disabled  = false;
      submitBtn.innerHTML = submitBtn.dataset.original || 'Reset password';
    }
  }

  // ── Field helpers ─────────────────────────────────────────────
  function clearErr(input, errEl) {
    if (!input || !errEl) return;
    input.classList.remove('error');
    errEl.classList.remove('show');
    errEl.textContent = '';
  }

  function setErr(input, errEl, msg) {
    if (!input || !errEl) return;
    errEl.textContent = msg;
    errEl.classList.add('show');
    input.classList.add('error');
  }

  // ── Validation ───────────────────────────────────────────────
  function validate() {
    let ok = true;
    clearErr(pwInput, pwError);
    clearErr(pw2Input, pw2Error);

    const pw  = pwInput  ? pwInput.value  : '';
    const pw2 = pw2Input ? pw2Input.value : '';

    if (!pw || pw.length < 8) {
      setErr(pwInput, pwError, 'Password must be at least 8 characters.'); ok = false;
    }
    if (!pw2) {
      setErr(pw2Input, pw2Error, 'Please confirm your new password.'); ok = false;
    } else if (pw !== pw2) {
      setErr(pw2Input, pw2Error, 'Passwords do not match.'); ok = false;
    }

    return ok;
  }

  // ── Password visibility toggle ────────────────────────────────
  function togglePw(inputId) {
    const el = document.getElementById(inputId);
    if (el) el.type = el.type === 'password' ? 'text' : 'password';
  }
  window.togglePw = togglePw;   // expose for inline onclick

  // ── Submit ───────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    hideAlerts();

    if (!API) {
      showError(
        'API URL is not configured. ' +
        'Open env.js and set API_BASE_URL to your backend server address.'
      );
      return;
    }

    if (!token) {
      showError('No reset token found. Please use the link from your email.');
      return;
    }

    if (!validate()) return;

    setLoading(true);

    try {
      const res  = await fetch(`${API}/api/auth/reset-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, new_password: pwInput.value }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message || 'Reset failed. Please request a new reset link.'
        );
      }

      // ── Success ───────────────────────────────────────────────
      if (form) form.style.display = 'none';
      showSuccess(
        (json.message || 'Password reset successfully!') +
        ' Redirecting to sign in…'
      );

      setTimeout(() => {
        window.location.href = '/login.html';
      }, 3000);

    } catch (err) {
      if (err instanceof TypeError) {
        showError(
          'Could not reach the server. ' +
          'Check that your backend is running and that API_BASE_URL in env.js is correct.'
        );
      } else {
        showError(err.message || 'Something went wrong. Please try again.');
      }
      setLoading(false);
    }
  }

  // ── Events ───────────────────────────────────────────────────
  if (form) form.addEventListener('submit', handleSubmit);
  pwInput  && pwInput.addEventListener('input',  () => clearErr(pwInput,  pwError));
  pw2Input && pw2Input.addEventListener('input', () => clearErr(pw2Input, pw2Error));

})();