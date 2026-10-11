import { useEffect, useState } from "react";

const LOGIN_GIF =
  "https://assets.cdn.filesafe.space/76EKIVBXrGYIny0RbqcE/media/6abaa38a7ef452865a26c67d.gif";

export function AuthLoadingScreen({
  caption = "Loading your dashboard",
  lines,
  showReset = true,
}: {
  caption?: string;
  lines?: string[];
  showReset?: boolean;
}) {
  const [step, setStep] = useState(0);
  const script = lines && lines.length > 0 ? lines : [caption];

  useEffect(() => {
    if (script.length < 2) return;
    const timer = setInterval(() => {
      setStep((current) => (current + 1) % script.length);
    }, 1000);
    return () => clearInterval(timer);
  }, [script.length]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-muted/30 px-6">
      <style>{`
        @keyframes veydra-load-bar {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(360%); }
        }
      `}</style>
      <img src={LOGIN_GIF} alt="" className="h-auto w-40 object-contain" />
      <div className="mt-8 h-1 w-52 overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full w-1/3 rounded-full bg-foreground/70"
          style={{ animation: "veydra-load-bar 1.1s ease-in-out infinite" }}
        />
      </div>
      <p className="mt-4 h-5 text-sm text-muted-foreground">{script[step]}</p>
      {showReset && (
        <button
          type="button"
          onClick={() => {
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload();
          }}
          className="mt-10 text-xs text-muted-foreground underline underline-offset-2"
        >
          Clear cache and reload
        </button>
      )}
    </div>
  );
}
