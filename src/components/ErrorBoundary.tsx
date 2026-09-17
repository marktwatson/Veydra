import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);

    // Auto-reload on chunk load errors (common after deployments)
    const isChunkLoadError =
      error.name === "ChunkLoadError" ||
      (error.message &&
        error.message
          .toLowerCase()
          .includes("failed to fetch dynamically imported module"));

    if (isChunkLoadError) {
      const hasReloaded = sessionStorage.getItem("chunk_error_reloaded");
      if (!hasReloaded) {
        sessionStorage.setItem("chunk_error_reloaded", "true");
        window.location.reload();
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full border border-red-200">
            <h1 className="text-2xl font-bold text-red-600 mb-4">
              Something went wrong
            </h1>
            <div className="bg-red-50 p-4 rounded overflow-auto font-mono text-sm text-red-800 border border-red-100 max-h-[60vh]">
              {this.state.error && this.state.error.toString()}
              <br />
              {this.state.error && this.state.error.stack}
            </div>
            <button
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
