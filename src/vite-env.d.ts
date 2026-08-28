/// <reference types="vite/client" />

declare module "*?raw" {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_AREA_ID?: string;
  readonly VITE_AREA_SLUG?: string;
  readonly VITE_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
