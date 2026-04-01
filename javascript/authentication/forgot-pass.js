// ─────────────────────────────────────────────────────────────
//  forgot-password.js
//
//  FIX: was hitting https://kamzamanyama.github.io/api/...
//  because ENV.API_BASE_URL was empty/missing, causing the fetch
//  to use the same origin (GitHub Pages) instead of the backend.
//
//  ENV.API_BASE_URL must be set in env.js to your backend address,
//  e.g. 'http://localhost:3000' or 'https://api.yoursite.com'
// ─────────────────────────────────────────────────────────────

(function () {

  // ── Resolve API base ────────────────────────────────────────
  // Guard: if ENV is missing or API_BASE_URL is empty we throw
  // immediately with a clear message instead of silently hitting
  // the wrong origin.
  if (typeof ENV === 'undefined' || !ENV.API_BASE_URL) {
    console.error(
      '[forgot-password] ENV.API_BASE_URL is not set.\n' +
      'Open env.js and set API_BASE_URL to your backend address,\n' +
      'e.g. "http://localhost:3000" or "https://api.yoursite.com".\n' +
      'GitHub Pages cannot handle API requests.'
    );
  }

  const API = (typeof ENV !== 'undefined' && ENV.API_BASE_URL)
    ? ENV.API_BASE_URL.replace(/\/$/, '')
    : null;   // null = we'll block the submit below

  // ── DOM ─────────────────────────────────────────────────────
  const form           = document.getElementById('forgot-form');
  const emailInput     = document.getElementById('email');
  const emailError     = document.getElementById('email-error');
  const resetBtn       = document.getElementById('reset-btn');
  const successAlert   = document.getElementById('success-alert');
  const errorAlert     = document.getElementById('error-alert');
  const successMessage = document.getElementById('success-message');
  const errorMessage   = document.getElementById('error-message');
  const slugSpan       = document.getElementById('slug-text');

  // ── Brand slug ───────────────────────────────────────────────
  if (slugSpan) {
    slugSpan.textContent =
      (typeof ENV !== 'undefined' && ENV.SLUG) ? ENV.SLUG : 'RentTrack';
  }

  // ── Alert helpers ────────────────────────────────────────────
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
    if (!v)               { setFieldError('Email address is required.');      return false; }
    if (!isValidEmail(v)) { setFieldError('Enter a valid email address.');    return false; }
    clearFieldError();
    return true;
  }

  // ── Submit ───────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    hideAlerts();
    clearFieldError();

    // Block if API URL is not configured
    if (!API) {
      showError(
        'API URL is not configured. ' +
        'Open env.js and set API_BASE_URL to your backend server address.'
      );
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

      if (!res.ok) {
        throw new Error(json.message || `Server error (${res.status})`);
      }

      showSuccess(
        json.message ||
        'If that email is registered you will receive a reset link shortly.'
      );
      form.reset();

      // ── Dev mode: server returns _dev_reset_link ─────────────
      // When NODE_ENV !== 'production' the backend includes the raw
      // reset link so you can test without configuring SMTP.
      // We render it as a clickable link on the page.
      if (json._dev_reset_link) {
        const devBox  = document.getElementById('dev-reset-box');
        const devLink = document.getElementById('dev-reset-link');
        if (devBox && devLink) {
          devLink.href        = json._dev_reset_link;
          devLink.textContent = json._dev_reset_link;
          devBox.style.display = '';
        } else {
          // Fallback: log to console if the HTML elements aren't present
          console.info(
            '%c[DEV] Password reset link:', 'color:orange;font-weight:bold',
            json._dev_reset_link
          );
        }
      }

    } catch (err) {
      // Network errors (CORS, no server, wrong URL) produce TypeError
      if (err instanceof TypeError) {
        showError(
          'Could not reach the server. ' +
          'Check that your backend is running and that API_BASE_URL in env.js is correct.'
        );
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