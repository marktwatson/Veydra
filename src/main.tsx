import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
      navigator.serviceWorker
        .register("/sw-push.js", { scope: "/" })
        .catch((err) => console.warn("[SW] registration failed:", err));
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
  </ErrorBoundary>,
);
