// ─────────────────────────────────────────────────────────────
//  forgot-password.js
//  Handles: POST /api/auth/forgot-password
//
//  In development the server returns _dev_reset_link in the JSON
//  response body so you can test without an email server.
//  In production the link is emailed and that field is omitted.
// ─────────────────────────────────────────────────────────────

(function () {

  const API = (typeof ENV !== 'undefined' && ENV.API_BASE_URL)
    ? ENV.API_BASE_URL.replace(/\/$/, '')
    : '';    // empty = same origin (works if frontend is served by the backend)

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

  // ── Slug / brand ─────────────────────────────────────────────
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
    successAlert._t = setTimeout(() => successAlert.classList.remove('show'), 6000);
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorAlert.classList.add('show');
    clearTimeout(errorAlert._t);
    errorAlert._t = setTimeout(() => errorAlert.classList.remove('show'), 6000);
  }

  // ── Button loading state ─────────────────────────────────────
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

  function validateEmail(v) {
    return /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/.test(v);
  }

  function validate() {
    const v = emailInput.value.trim();
    if (!v)              { setFieldError('Email address is required.'); return false; }
    if (!validateEmail(v)) { setFieldError('Enter a valid email address.'); return false; }
    clearFieldError();
    return true;
  }

  // ── Submit ───────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    hideAlerts();
    clearFieldError();
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
        throw new Error(json.message || 'Request failed.');
      }

      showSuccess(json.message || 'If that email is registered you will receive a reset link shortly.');
      form.reset();

      // ── Dev mode helper ──────────────────────────────────────
      // The server returns _dev_reset_link when NODE_ENV !== 'production'.
      // We show it in the UI so you can click it during development.
      if (json._dev_reset_link) {
        const devBox = document.getElementById('dev-reset-box');
        const devLink = document.getElementById('dev-reset-link');
        if (devBox && devLink) {
          devLink.href        = json._dev_reset_link;
          devLink.textContent = json._dev_reset_link;
          devBox.style.display = '';
        }
      }

    } catch (err) {
      showError(err.message || 'Unable to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Events ───────────────────────────────────────────────────
  form.addEventListener('submit', handleSubmit);
  emailInput.addEventListener('input', () => { clearFieldError(); hideAlerts(); });
  emailInput.addEventListener('focus', hideAlerts);

})();