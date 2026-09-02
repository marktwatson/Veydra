import { DEFAULT_LOGO_URL } from "@/lib/utils";

export function AuthLoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <div className="relative flex items-center justify-center mb-6">
        <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping"></div>
        <img
          src={DEFAULT_LOGO_URL}
          alt="Loading..."
          className="w-32 h-auto object-contain animate-pulse relative z-10"
          onError={(e) => {
            (e.target as HTMLImageElement).src = DEFAULT_LOGO_URL;
          }}
        />
      </div>
      <p className="mt-4 text-muted-foreground font-medium">
        Loading session...
      </p>
      <button
        onClick={() => {
          localStorage.clear();
          sessionStorage.clear();
          window.location.reload();
        }}
        className="mt-8 px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
      >
        Clear Cache &amp; Reload (Click if stuck)
      </button>
    </div>
  );
}
