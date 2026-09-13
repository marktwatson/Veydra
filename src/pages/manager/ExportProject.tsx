import { useState, useEffect } from "react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Download,
  FileArchive,
  Loader2,
  CheckCircle,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

// Use Vite's glob import to read raw file contents
const srcFiles = import.meta.glob("/src/**/*", {
  query: "?raw",
  import: "default",
});
const rootFiles = import.meta.glob("/*.*", {
  query: "?raw",
  import: "default",
});
const publicFiles = import.meta.glob("/public/**/*", {
  query: "?raw",
  import: "default",
});

export default function ExportProject() {
  const [isExporting, setIsExporting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    setIsIframe(window !== window.parent);
  }, []);

  const handleGenerate = async () => {
    setIsExporting(true);
    setDownloadUrl(null);
    const loadingToast = toast.loading("Gathering source files...");

    try {
      const zip = new JSZip();
      let count = 0;

      const addFilesToZip = async (
        files: Record<string, () => Promise<any>>,
      ) => {
        for (const path in files) {
          // Skip build artifacts and node_modules just in case
          if (
            path.includes("node_modules") ||
            path.includes(".git") ||
            path.includes("dist")
          )
            continue;

          try {
            const content = await files[path]();
            // Remove the leading slash for the zip path
            const zipPath = path.startsWith("/") ? path.slice(1) : path;
            zip.file(zipPath, content);
            count++;
          } catch (e) {
            console.error(`Failed to load ${path}`, e);
          }
        }
      };

      toast.loading("Zipping source files...", { id: loadingToast });
      await addFilesToZip(srcFiles);
      await addFilesToZip(rootFiles);
      await addFilesToZip(publicFiles);

      toast.loading("Generating ZIP archive...", { id: loadingToast });
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);

      setDownloadUrl(url);
      setFileCount(count);
      toast.success(`Successfully bundled ${count} files!`, {
        id: loadingToast,
      });
    } catch (error) {
      console.error("Export failed", error);
      toast.error("Failed to generate project ZIP. Please check the console.", {
        id: loadingToast,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Using a direct anchor tag instead of programmatic click to bypass iframe sandbox restrictions

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
          <FileArchive className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Export Source Code
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Download a complete backup of your Vibe project files.
          </p>
        </div>
      </div>

      <Card className="border-primary/20 shadow-sm">
        <CardHeader>
          <CardTitle>Download Project ZIP</CardTitle>
          <CardDescription>
            This tool will bundle all your React source code, components, pages,
            and configuration files into a single ZIP file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isIframe && (
            <Alert
              variant="destructive"
              className="mb-6 bg-destructive/10 border-destructive/20 text-destructive"
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Action Required</AlertTitle>
              <AlertDescription className="mt-2">
                Downloads are blocked inside this editor's secure iframe
                sandbox.
                <br />
                <br />
                To download your code, please click the{" "}
                <strong>Open in New Tab</strong> icon (the small square with an
                arrow ↗️) at the top right corner of this preview window. Then,
                run the export from that new tab!
              </AlertDescription>
            </Alert>
          )}

          <div className="bg-muted/50 p-4 rounded-md mb-6 text-sm text-muted-foreground space-y-2">
            <p>
              <strong>How to use this export:</strong>
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-1">
              <li>Click "Generate ZIP" to bundle the files.</li>
              <li>
                Click "Download ZIP Now" to save <code>portal-source.zip</code>{" "}
                on your computer.
              </li>
              <li>Extract and copy code directly into any new instance.</li>
            </ol>
          </div>

          {!downloadUrl ? (
            <Button
              onClick={handleGenerate}
              disabled={isExporting}
              className="w-full sm:w-auto"
              size="lg"
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <FileArchive className="mr-2 h-5 w-5" />
              )}
              {isExporting ? "Generating ZIP Archive..." : "Generate ZIP"}
            </Button>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/20 p-3 rounded-md border border-green-200 dark:border-green-800">
                <CheckCircle className="h-4 w-4" />
                Ready to download! ({fileCount} files bundled successfully)
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  asChild
                  size="lg"
                  className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                >
                  <a href={downloadUrl} download="portal-source.zip">
                    <Download className="mr-2 h-5 w-5" />
                    Download ZIP Now
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setDownloadUrl(null)}
                >
                  Start Over
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
