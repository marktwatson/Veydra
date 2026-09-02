import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PaymentDueAlert } from "@/components/PaymentDueAlert";
import App from "@/App";
import "@/index.css";

// Register the push service worker on the published origin. We only register
// on the real app domain (not the AI Studio preview iframe, which is a
// different origin where a SW would be useless for push and could conflict).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const isAppOrigin =
      window.location.hostname.includes("honeysucklehaus.com") ||
      window.location.hostname.includes("vibepreview.com") === false;
    if (isAppOrigin) {
      // Register (or update) the push SW. update() + skipWaiting in the SW
      // ensures the newest version takes over immediately on every load,
      // so a stale caching SW from an older deploy can never strand a user
      // with "Failed to fetch" on auth/API calls.
      navigator.serviceWorker
        .register("/sw-push.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => {
          reg.update().catch(() => {});
          // If a new SW is waiting to activate, force it now.
          if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
        })
        .catch((err) => console.warn("[SW] registration failed:", err));

      // When the controller changes (new SW activated), reload once so the
      // page is served by the fresh SW. This clears stale cached state.
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    } else {
      // On the AI Studio preview, unregister any stale SWs to avoid confusion.
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister().catch(console.error);
        }
      });
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
    <PaymentDueAlert />
  </ErrorBoundary>,
);
