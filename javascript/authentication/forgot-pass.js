// ─────────────────────────────────────────────────────────────
//  forgot-password.js
//  Reads config from window.__ENV__ (set in env.js)
// ─────────────────────────────────────────────────────────────

(function () {

  // ── Read from window.__ENV__ ─────────────────────────────────
  const __ENV__ = window.__ENV__ || {};

  if (!__ENV__.API_BASE_URL) {
    console.error(
      '[forgot-password] window.__ENV__.API_BASE_URL is not set.\n' +
      'Check that env.js is loaded BEFORE this script in your HTML.'
    );
  }

  const API = __ENV__.API_BASE_URL
    ? __ENV__.API_BASE_URL.replace(/\/$/, '')
    : null;

  // ── DOM ──────────────────────────────────────────────────────
  const form           = document.getElementById('forgot-form');
  const emailInput     = document.getElementById('email');
  const emailError     = document.getElementById('email-error');
  const resetBtn       = document.getElementById('reset-btn');
  const successAlert   = document.getElementById('success-alert');
  const errorAlert     = document.getElementById('error-alert');
  const successMessage = document.getElementById('success-message');
  const errorMessage   = document.getElementById('error-message');
  const slugSpan       = document.getElementById('slug-text');

  // ── Brand ────────────────────────────────────────────────────
  if (slugSpan) {
    slugSpan.textContent = __ENV__.COMPANY_SLUG || __ENV__.APP_NAME || 'RentTrack';
  }

  // ── Alerts ───────────────────────────────────────────────────
  function hideAlerts() {
    successAlert.classList.remove('show');
    errorAlert.classList.remove('show');
  }

  function showSuccess(msg) {
    successMessage.textContent = msg;
    successAlert.classList.add('show');
    clearTimeout(successAlert._t);
    successAlert._t = setTimeout(() => successAlert.classList.remove('show'), 7000);
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorAlert.classList.add('show');
    clearTimeout(errorAlert._t);
    errorAlert._t = setTimeout(() => errorAlert.classList.remove('show'), 7000);
  }

  // ── Button loading ───────────────────────────────────────────
  function setLoading(on) {
    if (on) {
      resetBtn.disabled         = true;
      resetBtn.dataset.original = resetBtn.innerHTML;
      resetBtn.innerHTML        = '<span class="spinner"></span><span>Sending…</span>';
    } else {
      resetBtn.disabled  = false;
      resetBtn.innerHTML = resetBtn.dataset.original || 'Send reset link';
    }
  }

  // ── Field validation ─────────────────────────────────────────
  function clearFieldError() {
    emailInput.classList.remove('error');
    emailError.classList.remove('show');
    emailError.textContent = '';
  }

  function setFieldError(msg) {
    emailError.textContent = msg;
    emailError.classList.add('show');
    emailInput.classList.add('error');
  }

  function isValidEmail(v) {
    return /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/.test(v);
  }

  function validate() {
    const v = emailInput.value.trim();
    if (!v)               { setFieldError('Email address is required.');   return false; }
    if (!isValidEmail(v)) { setFieldError('Enter a valid email address.'); return false; }
    clearFieldError();
    return true;
  }

  // ── Submit ───────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    hideAlerts();
    clearFieldError();

    if (!API) {
      showError('API URL is not configured. Check env.js and ensure API_BASE_URL is set.');
      return;
    }

    if (!validate()) return;

    const email = emailInput.value.trim().toLowerCase();
    setLoading(true);

    try {
      const res  = await fetch(`${API}/api/auth/forgot-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json.message || `Server error (${res.status})`);

      showSuccess(
        json.message || 'If that email is registered you will receive a reset link shortly.'
      );
      form.reset();

      // Dev mode: backend returns _dev_reset_link when NODE_ENV !== 'production'
      if (json._dev_reset_link) {
        const devBox  = document.getElementById('dev-reset-box');
        const devLink = document.getElementById('dev-reset-link');
        if (devBox && devLink) {
          devLink.href        = json._dev_reset_link;
          devLink.textContent = json._dev_reset_link;
          devBox.style.display = '';
        }
        console.info('%c[DEV] Reset link:', 'color:orange;font-weight:bold', json._dev_reset_link);
      }

    } catch (err) {
      if (err instanceof TypeError) {
        showError('Could not reach the server. Check your backend is running and CORS is enabled.');
      } else {
        showError(err.message || 'Unable to send reset link. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Events ───────────────────────────────────────────────────
  form.addEventListener('submit', handleSubmit);
  emailInput.addEventListener('input', () => { clearFieldError(); hideAlerts(); });
  emailInput.addEventListener('focus', hideAlerts);

})();