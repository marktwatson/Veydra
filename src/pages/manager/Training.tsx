import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GraduationCap, Maximize2, ExternalLink, Play, X } from "lucide-react";

export const VEYDRA_TRAINING_VIDEOS = [
  {
    id: "01",
    title: "How to process a wedding post production",
    description:
      "Move a finished wedding through post: delivery status, editor handoff, and what to mark complete so the file doesn't sit in limbo.",
    url: "https://assets.cdn.filesafe.space/9JzuUHcQvdlb7oRHmeq3/media/6aa01b5c16ed327815a7ed35.mp4",
    type: "video/mp4",
  },
  {
    id: "02",
    title: "How to read the dashboard in Veydra",
    description:
      "What Action Items, notifications, and the scheduler mean — and which numbers you can ignore.",
    url: "https://assets.cdn.filesafe.space/9JzuUHcQvdlb7oRHmeq3/media/6aa81ba549f830e49b1ece60.mp4",
    type: "video/mp4",
  },
  {
    id: "03",
    title: "How to build a proposal in Veydra",
    description:
      "Build a proposal from scratch: package, add-ons, a payment plan that balances, and how to send the share link.",
    url: "https://assets.cdn.filesafe.space/9JzuUHcQvdlb7oRHmeq3/media/6aa81ba59f8b31b6ab067c9b.mp4",
    type: "video/mp4",
  },
  {
    id: "04",
    title: "Bartending Upsell Tutorial",
    description:
      "Offer bartending on a booked wedding, send the upsell, and see the extra invoice and bartender job on the file.",
    url: "https://assets.cdn.filesafe.space/9JzuUHcQvdlb7oRHmeq3/media/6a9acb82ac5d03a10954f129.mov",
    type: "video/quicktime",
  },
];

type VideoItem = (typeof VEYDRA_TRAINING_VIDEOS)[number];

const ManagerTraining = () => {
  const [activeModalVideo, setActiveModalVideo] = useState<VideoItem | null>(
    null,
  );
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  const handleRequestFullscreen = async (video: VideoItem) => {
    const el = videoRefs.current[video.id];
    if (el) {
      try {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
          return;
        } else if ((el as any).webkitRequestFullscreen) {
          await (el as any).webkitRequestFullscreen();
          return;
        } else if ((el as any).webkitEnterFullscreen) {
          (el as any).webkitEnterFullscreen();
          return;
        }
      } catch (err) {
        // If iframe permissions restrict HTML5 fullscreen, fall back to theater modal
        console.warn(
          "Native fullscreen blocked by container iframe, opening theater view:",
          err,
        );
      }
    }
    setActiveModalVideo(video);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-8 flex items-start gap-4">
        <div className="rounded-xl bg-primary/10 p-3 text-primary">
          <GraduationCap className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Veydra Training
          </h1>
          <p className="text-muted-foreground mt-1">
            Short how-tos for managers and owners.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {VEYDRA_TRAINING_VIDEOS.map((video) => (
          <Card
            key={video.id}
            className="overflow-visible flex flex-col justify-between"
          >
            <div>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold rounded-md bg-muted px-2 py-0.5 text-muted-foreground">
                      {video.id}
                    </span>
                    <CardTitle className="text-base font-semibold leading-snug">
                      {video.title}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pb-3">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {video.description}
                </p>

                <div className="relative group rounded-lg overflow-hidden border border-border bg-black">
                  <video
                    ref={(el) => {
                      videoRefs.current[video.id] = el;
                    }}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full bg-black block"
                    style={{ aspectRatio: "16 / 9" }}
                  >
                    <source src={video.url} type={video.type} />
                  </video>

                  {/* Quick Expand Overlay Action */}
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-90 hover:opacity-100 transition-opacity pointer-events-auto">
                    <button
                      type="button"
                      onClick={() => setActiveModalVideo(video)}
                      title="Enlarge video (Theater mode)"
                      className="inline-flex items-center gap-1 rounded-md bg-black/75 hover:bg-black text-white text-[11px] font-medium px-2 py-1 shadow backdrop-blur-sm border border-white/20 transition-all hover:scale-105"
                    >
                      <Maximize2 className="h-3 w-3" />
                      <span>Enlarge</span>
                    </button>
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open full video in new tab"
                      className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-black/75 hover:bg-black text-white shadow backdrop-blur-sm border border-white/20 transition-all hover:scale-105"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </CardContent>
            </div>

            <div className="px-6 pb-4 pt-0 flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-3 mt-1">
              <span className="text-[11px]">HD Video</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2.5 gap-1 text-foreground"
                  onClick={() => setActiveModalVideo(video)}
                >
                  <Maximize2 className="h-3 w-3" />
                  Theater Mode
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-7 text-xs px-2.5 gap-1 text-muted-foreground hover:text-foreground"
                >
                  <a href={video.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                    New Tab
                  </a>
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Theater Mode Large Video Dialog */}
      <Dialog
        open={!!activeModalVideo}
        onOpenChange={(open) => {
          if (!open) setActiveModalVideo(null);
        }}
      >
        <DialogContent className="max-w-5xl w-[95vw] p-4 sm:p-6 bg-card border-border/60 shadow-2xl rounded-2xl">
          {activeModalVideo && (
            <div className="space-y-4">
              <DialogHeader className="pr-8">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold rounded-md bg-primary/10 text-primary px-2 py-0.5">
                    {activeModalVideo.id}
                  </span>
                  <DialogTitle className="text-lg sm:text-xl font-bold">
                    {activeModalVideo.title}
                  </DialogTitle>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground pt-1">
                  {activeModalVideo.description}
                </p>
              </DialogHeader>

              <div className="relative rounded-xl overflow-hidden bg-black border border-border/60 shadow-inner">
                <video
                  controls
                  autoPlay
                  playsInline
                  className="w-full max-h-[72vh] object-contain bg-black block"
                  style={{ aspectRatio: "16 / 9" }}
                >
                  <source
                    src={activeModalVideo.url}
                    type={activeModalVideo.type}
                  />
                </video>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">
                  Press Esc to exit large view
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="gap-1.5 text-xs rounded-full"
                >
                  <a
                    href={activeModalVideo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open in New Window
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagerTraining;
