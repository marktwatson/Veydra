import { createClient } from "@supabase/supabase-js";

// Env vars win (Cloudflare / local .env), otherwise fall back to the current
// working values so the in-editor preview keeps running with no setup.
export const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://oosmhtzqdmntlzhheofw.supabase.co";
export const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vc21odHpxZG1udGx6aGhlb2Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDQ3ODQsImV4cCI6MjA5MjM4MDc4NH0.slGFmtfr_cPC8EgKmQzf9ObOa7Sm5QwebqngQO0LAKc";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing Supabase config: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
