// ───────────────────────────────────────────────────────────────────────────
// APP CONFIG — edit this file in AI Studio to repoint the app at a different
// Supabase project or area. On Cloudflare, VITE_* env vars (see .env.example)
// take precedence over the values here.
//
// 👉 To point at a different Supabase / area, edit THIS file:
//    src/config.ts
// ───────────────────────────────────────────────────────────────────────────

export const APP_CONFIG = {
  // Supabase project URL (Dashboard → Project Settings → API → Project URL)
  supabaseUrl: "https://oosmhtzqdmntlzhheofw.supabase.co",

  // Supabase anon/public key (Dashboard → Project Settings → API → Project API
  // keys → "anon public"). NEVER put the service-role key here.
  supabaseAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vc21odHpxZG1udGx6aGhlb2Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDQ3ODQsImV4cCI6MjA5MjM4MDc4NH0.slGFmtfr_cPC8EgKmQzf9ObOa7Sm5QwebqngQO0LAKc",

  // This area/territory's Supabase project ref (also used as the territory
  // project_ref in the Fleet Manager / royalty module).
  areaId: "oosmhtzqdmntlzhheofw",

  // This area's slug (e.g. "nashville"). Leave "" if not used yet.
  areaSlug: "",

  // Public app URL for this area (used for shareable links / portal URLs).
  appUrl: "https://veydra.honeysucklehaus.com",
};
