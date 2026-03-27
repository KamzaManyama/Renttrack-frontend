// ============================================================
// manager-profile.js — Profile Management
// ============================================================

async function loadProfile() {
  try {
    const resp = await GET(`/api/users/${user.id}`);
    const u = resp.data || {};
    document.getElementById('profile-name').value  = u.name  || '';
    document.getElementById('profile-email').value = u.email || '';
    document.getElementById('profile-phone').value = u.phone || '';
    document.getElementById('profile-name-display').textContent  = u.name  || '—';
    document.getElementById('profile-email-display').textContent = u.email || '—';
    document.getElementById('profile-role-display').textContent  = (u.role || '').replace('_', ' ');
    document.getElementById('profile-last-login').textContent    = u.last_login ? timeAgo(u.last_login) : 'No recent login';
    document.getElementById('profile-avatar').textContent = (u.name || 'M')[0].toUpperCase();
    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value     = '';
    document.getElementById('confirm-password').value = '';
  } catch (e) { toast(e.message, 'error'); }
}

async function saveProfileChanges() {
  const name     = document.getElementById('profile-name').value.trim();
  const email    = document.getElementById('profile-email').value.trim();
  const phone    = document.getElementById('profile-phone').value.trim();
  const currPw   = document.getElementById('current-password').value;
  const newPw    = document.getElementById('new-password').value;
  const confirmPw = document.getElementById('confirm-password').value;

  if (!name)  { toast('Name is required', 'error'); return; }
  if (!email) { toast('Email is required', 'error'); return; }

  const profilePayload = { name, email, phone: phone || undefined };

  if (currPw || newPw || confirmPw) {
    if (!currPw)             { toast('Enter your current password', 'error'); return; }
    if (!newPw || newPw.length < 8) { toast('New password must be at least 8 characters', 'error'); return; }
    if (newPw !== confirmPw) { toast('New passwords do not match', 'error'); return; }
    profilePayload.current_password = currPw;
    profilePayload.password = newPw;
  }

  try {
    await PUT(`/api/users/${user.id}`, profilePayload);
    toast('Profile updated successfully');
    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value     = '';
    document.getElementById('confirm-password').value = '';
    document.getElementById('profile-name-display').textContent = name;
    document.getElementById('profile-email-display').textContent = email;
    document.getElementById('sb-name').textContent = name;
    document.getElementById('sb-avatar').textContent = name[0].toUpperCase();
    document.getElementById('profile-avatar').textContent = name[0].toUpperCase();
  } catch (e) { toast(e.message, 'error'); }
}

function handleProfilePhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB', 'error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.createElement('img');
    img.src = e.target.result;
    img.style = 'width:100%;height:100%;object-fit:cover;border-radius:50%';
    const avatar = document.getElementById('profile-avatar');
    avatar.innerHTML = '';
    avatar.appendChild(img);
    toast('Profile photo updated (preview only — save to persist)');
  };
  reader.readAsDataURL(file);
}