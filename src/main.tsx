import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import App from "@/App";
import "@/index.css";
import { hasSupabaseConfig } from "@/lib/supabase";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (let registration of registrations) {
        registration.unregister().catch(console.error);
      }
    });
  });
}

// Guard: if neither env vars nor src/config.ts provide a Supabase URL + anon
// key, render a clear "Missing Supabase config" screen instead of booting the
// app into a broken state. Edit src/config.ts to fix this.
if (!hasSupabaseConfig) {
  createRoot(document.getElementById("root")!).render(
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        padding: "2rem",
        textAlign: "center",
        background: "#0a0a0a",
        color: "#fafafa",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        Missing Supabase config
      </h1>
      <p style={{ maxWidth: "32rem", lineHeight: 1.6, opacity: 0.8 }}>
        This app isn't connected to a Supabase project yet. Edit{" "}
        <code
          style={{
            background: "#1a1a1a",
            padding: "0.1rem 0.4rem",
            borderRadius: "0.25rem",
          }}
        >
          src/config.ts
        </code>{" "}
        and set <code>supabaseUrl</code> and <code>supabaseAnonKey</code> (and
        optionally <code>areaId</code> / <code>appUrl</code>), or set the{" "}
        <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>{" "}
        environment variables.
      </p>
    </div>,
  );
} else {
  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}
