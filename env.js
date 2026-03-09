// ============================================================
// RentTrack Frontend — Environment Configuration
// Edit this file to point to your backend instance.
// This file is loaded by all pages via <script src="env.js">
// ============================================================

window.__ENV__ = {
  // Your backend API base URL (no trailing slash)
  API_BASE_URL: "http://localhost:3000",

  // Your company slug — sent as X-Company-Slug header
  // Matches the `slug` column in the companies table
  COMPANY_SLUG: "greenestate",

  // App display name (overrides the default "RentTrack")
  APP_NAME: "RentTrack",
};
