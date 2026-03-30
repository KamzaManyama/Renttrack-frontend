// ── Profile ───────────────────────────────────────────────────
// All operations use the shared GET / POST / PUT helpers from app.js.
// Endpoints used:
//   GET  /api/auth/me                — load current user
//   PUT  /api/auth/profile           — update name / email / phone / photo
//   POST /api/auth/change-password   — change password

// ── Navigation — called by sidebar avatar & showProfile() ────
// Switches to the profile page using whatever nav pattern the app uses.
// Covers: showPage(), navigateTo(), direct section toggle, and hash routing.
function showProfile() {
  // Pattern 1: app uses a global showPage(pageId) function
  if (typeof showPage === 'function') {
    showPage('profile');
    loadProfile();
    return;
  }
  // Pattern 2: app uses navigateTo()
  if (typeof navigateTo === 'function') {
    navigateTo('profile');
    loadProfile();
    return;
  }
  // Pattern 3: manual section toggle — find section#page-profile and make it active
  const all = document.querySelectorAll('section.page');
  const target = document.getElementById('page-profile');
  if (target && all.length) {
    all.forEach(s => s.classList.remove('active'));
    target.classList.add('active');
    // Also update sidebar nav active state if it exists
    document.querySelectorAll('.nav-item, .sidebar-nav-item, [data-page]').forEach(el => {
      el.classList.remove('active');
      if (el.dataset.page === 'profile' || el.getAttribute('onclick')?.includes('profile')) {
        el.classList.add('active');
      }
    });
    loadProfile();
    return;
  }
  // Pattern 4: hash routing
  window.location.hash = 'profile';
  loadProfile();
}

// ── Load profile on page show ─────────────────────────────────
async function loadProfile() {
  try {
    const json = await GET('/api/auth/me');
    const u    = json.data;

    // Sidebar display
    profileSetText('profile-name-display',  u.name  || '—');
    profileSetText('profile-email-display', u.email || '—');
    profileSetText('profile-user-id',       u.id    || '—');
    profileSetText('profile-member-since',
      u.created_at ? fmtDate(u.created_at) : '—');
    profileSetText('profile-last-login',
      u.last_login ? timeAgo(u.last_login) : 'Never');

    // Keep sidebar in sync on load too
    updateSidebarUser(u.name, u.profile_photo);

    // Avatar initials
    const avatar = document.getElementById('profile-avatar');
    if (avatar) {
      if (u.profile_photo) {
        avatar.style.backgroundImage = `url(${u.profile_photo})`;
        avatar.style.backgroundSize  = 'cover';
        avatar.textContent           = '';
      } else {
        avatar.textContent = (u.name || 'S')[0].toUpperCase();
      }
    }

    // Form fields
    profileSetVal('profile-name',     u.name  || '');
    profileSetVal('profile-email',    u.email || '');
    profileSetVal('profile-phone',    u.phone || '');

    // Store original values for cancel/reset
    window._profileOriginal = { name: u.name, email: u.email, phone: u.phone };

  } catch (e) {
    toast(e.message, 'error');
  }
}

// ── Save profile changes ──────────────────────────────────────
async function saveProfileChanges() {
  const name  = document.getElementById('profile-name')?.value.trim();
  const email = document.getElementById('profile-email')?.value.trim();
  const phone = document.getElementById('profile-phone')?.value.trim();

  if (!name)  { toast('Name is required',  'error'); document.getElementById('profile-name').focus();  return; }
  if (!email) { toast('Email is required', 'error'); document.getElementById('profile-email').focus(); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    toast('Enter a valid email address', 'error');
    document.getElementById('profile-email').focus();
    return;
  }

  // Handle password change if fields are filled
  const currentPw  = document.getElementById('current-password')?.value;
  const newPw      = document.getElementById('new-password')?.value;
  const confirmPw  = document.getElementById('confirm-password')?.value;
  const changingPw = currentPw || newPw || confirmPw;

  if (changingPw) {
    if (!currentPw) { toast('Enter your current password', 'error'); return; }
    if (!newPw)     { toast('Enter a new password',        'error'); return; }
    if (newPw.length < 8) { toast('New password must be at least 8 characters', 'error'); return; }
    if (newPw !== confirmPw) { toast('Passwords do not match', 'error'); return; }
  }

  const btn = document.querySelector('[onclick="saveProfileChanges()"]');
  const orig = btn?.innerHTML;
  if (btn) { btn.innerHTML = '<span class="spinner"></span> Saving…'; btn.disabled = true; }

  try {
    // Update profile info
    const json = await PUT('/api/auth/profile', { name, email, phone: phone || null });
    const u    = json.data;

    // Update sidebar & session storage
    profileSetText('profile-name-display',  u.name);
    profileSetText('profile-email-display', u.email);
    const avatar = document.getElementById('profile-avatar');
    if (avatar && !u.profile_photo) avatar.textContent = (u.name || 'S')[0].toUpperCase();

    // Update Auth.user in session
    const current = Auth.user;
    if (current) Auth.set(Auth.token, { ...current, name: u.name, email: u.email, phone: u.phone });

    // Keep sidebar avatar + name in sync
    updateSidebarUser(u.name, u.profile_photo);

    window._profileOriginal = { name: u.name, email: u.email, phone: u.phone };

    // Change password if requested
    if (changingPw) {
      await POST('/api/auth/change-password', {
        current_password: currentPw,
        new_password:     newPw,
      });
      // Clear password fields
      ['current-password', 'new-password', 'confirm-password'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      resetPasswordStrength();
      toast('Profile and password updated successfully', 'success');
    } else {
      toast('Profile updated successfully', 'success');
    }

  } catch (e) {
    toast(e.message, 'error');
  } finally {
    if (btn) { btn.innerHTML = orig; btn.disabled = false; }
  }
}

// ── Cancel / reset form ───────────────────────────────────────
function resetProfileChanges() {
  const orig = window._profileOriginal || {};
  profileSetVal('profile-name',  orig.name  || '');
  profileSetVal('profile-email', orig.email || '');
  profileSetVal('profile-phone', orig.phone || '');
  ['current-password', 'new-password', 'confirm-password'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  resetPasswordStrength();
  toast('Changes discarded', 'success');
}

// ── Profile photo upload ──────────────────────────────────────
async function handleProfilePhoto(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) { toast('Please select an image file', 'error'); return; }
  if (file.size > 2 * 1024 * 1024)    { toast('Image must be under 2MB', 'error'); return; }

  // Preview immediately
  const reader = new FileReader();
  reader.onload = e => {
    const avatar = document.getElementById('profile-avatar');
    if (avatar) {
      avatar.style.backgroundImage = `url(${e.target.result})`;
      avatar.style.backgroundSize  = 'cover';
      avatar.textContent           = '';
    }
  };
  reader.readAsDataURL(file);

  // Upload as base64 — in a real app you'd POST to a file upload endpoint.
  // We save the data URL directly as profile_photo for now.
  try {
    const dataUrl = await new Promise(res => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(file);
    });
    await PUT('/api/auth/profile', { profile_photo: dataUrl });
    toast('Profile photo updated', 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ── Password visibility toggle ────────────────────────────────
function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

// ── Password strength indicator ───────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  const newPwInput = document.getElementById('new-password');
  if (newPwInput) {
    newPwInput.addEventListener('input', function () {
      const strengthEl = document.getElementById('password-strength');
      if (strengthEl) strengthEl.style.display = this.value ? 'block' : 'none';
      updatePasswordStrength(this.value);
    });
  }

  // Load profile data
  loadProfile();
});

function updatePasswordStrength(pw) {
  let score = 0;
  if (pw.length >= 8)               score++;
  if (/[A-Z]/.test(pw))             score++;
  if (/[0-9]/.test(pw))             score++;
  if (/[^A-Za-z0-9]/.test(pw))      score++;

  const bars   = document.querySelectorAll('.strength-bar');
  const label  = document.getElementById('strength-text');
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];

  bars.forEach((bar, i) => {
    bar.style.background = i < score ? colors[score - 1] : '#e2e8f0';
  });
  if (label) {
    label.textContent = pw ? labels[score - 1] || 'Weak' : 'Enter a password';
    label.style.color = pw ? colors[score - 1] : 'var(--muted)';
  }
}

function resetPasswordStrength() {
  const strengthEl = document.getElementById('password-strength');
  if (strengthEl) strengthEl.style.display = 'none';
  document.querySelectorAll('.strength-bar').forEach(b => b.style.background = '#e2e8f0');
  const label = document.getElementById('strength-text');
  if (label) { label.textContent = 'Enter a password'; label.style.color = 'var(--muted)'; }
}

// ── 2FA (placeholder — no backend yet) ───────────────────────
function setup2FA() {
  toast('2FA setup is not yet available', 'error');
}

// ── Session management (placeholder) ─────────────────────────
function logoutAllSessions() {
  if (!confirm('This will log you out of all devices. Continue?')) return;
  // In a real app: POST /api/auth/logout-all
  // For now, clear local session and redirect
  Auth.clear();
  window.location.href = 'login.html';
}

function terminateSession(sessionId) {
  // Placeholder — requires a sessions table on the backend
  toast('Session terminated', 'success');
  const btn = event.target;
  btn.closest('.session-item')?.remove();
}

// ── Sidebar sync ─────────────────────────────────────────────
function updateSidebarUser(name, photoUrl) {
  // Avatar in sidebar footer
  const sbAvatar = document.getElementById('sb-avatar');
  if (sbAvatar) {
    if (photoUrl) {
      sbAvatar.style.backgroundImage = `url(${photoUrl})`;
      sbAvatar.style.backgroundSize  = 'cover';
      sbAvatar.textContent           = '';
    } else {
      sbAvatar.style.backgroundImage = '';
      sbAvatar.textContent           = (name || 'S')[0].toUpperCase();
    }
  }
  // Name in sidebar footer
  const sbName = document.getElementById('sb-name');
  if (sbName) sbName.textContent = name || 'Super Admin';
}

// ── Helpers ───────────────────────────────────────────────────
function profileSetText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
function profileSetVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}