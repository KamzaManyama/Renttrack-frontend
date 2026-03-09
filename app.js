// ============================================================
// RentTrack — Shared API Client & Utilities
// All pages include this after env.js
// ============================================================

const ENV = window.__ENV__ || {};
const API  = ENV.API_BASE_URL || "http://localhost:3000";
const SLUG = ENV.COMPANY_SLUG || "";

// ── Token store (sessionStorage so tab-close = logout) ──────
const Auth = {
  get token()   { return sessionStorage.getItem("rt_token"); },
  get user()    { const u = sessionStorage.getItem("rt_user"); return u ? JSON.parse(u) : null; },
  set(token, user) {
    sessionStorage.setItem("rt_token", token);
    sessionStorage.setItem("rt_user", JSON.stringify(user));
  },
  clear() {
    sessionStorage.removeItem("rt_token");
    sessionStorage.removeItem("rt_user");
  },
  isLoggedIn() { return !!this.token; },
};

// ── HTTP helper ──────────────────────────────────────────────
async function api(method, path, body, signal) {
  const headers = {
    "Content-Type": "application/json",
    "X-Company-Slug": SLUG,
  };
  if (Auth.token) headers["Authorization"] = `Bearer ${Auth.token}`;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  const data = await res.json().catch(() => ({ success: false, message: "Invalid server response" }));

  if (res.status === 401) {
    Auth.clear();
    window.location.href = "login.html";
    throw new Error("Session expired");
  }

  if (!res.ok || !data.success) {
    const msg = data.message || data.errors?.[0]?.msg || `Error ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

const GET    = (path, signal)       => api("GET",    path, null, signal);
const POST   = (path, body)         => api("POST",   path, body);
const PATCH  = (path, body)         => api("PATCH",  path, body);
const DELETE = (path)               => api("DELETE", path);

// ── Toast ────────────────────────────────────────────────────
function toast(msg, type = "success") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.className = `toast toast--${type} toast--show`;
  el.querySelector(".toast__msg").textContent = msg;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("toast--show"), 4500);
}

// ── Date helpers ─────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}
function timeAgo(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Status badge ─────────────────────────────────────────────
const STATUS_COLORS = {
  open:        { bg: "#dbeafe", fg: "#1d4ed8" },
  assigned:    { bg: "#e0e7ff", fg: "#4338ca" },
  in_progress: { bg: "#fef3c7", fg: "#b45309" },
  on_hold:     { bg: "#fee2e2", fg: "#b91c1c" },
  completed:   { bg: "#dcfce7", fg: "#166534" },
  closed:      { bg: "#f1f5f9", fg: "#475569" },
  cancelled:   { bg: "#f1f5f9", fg: "#94a3b8" },
};
const PRIORITY_COLORS = {
  low:    { bg: "#f0fdf4", fg: "#15803d" },
  medium: { bg: "#fefce8", fg: "#a16207" },
  high:   { bg: "#fff7ed", fg: "#c2410c" },
  urgent: { bg: "#fef2f2", fg: "#b91c1c" },
};

function badge(label, colorMap) {
  const c = colorMap?.[label] || { bg: "#f1f5f9", fg: "#475569" };
  return `<span class="badge" style="background:${c.bg};color:${c.fg}">${label.replace("_"," ")}</span>`;
}
