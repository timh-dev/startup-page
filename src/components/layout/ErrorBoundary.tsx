import React from "react";

interface ErrorBoundaryProps {
  children?: React.ReactNode;
  className?: string;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        return this.props.fallback ?? null;
      }
      return (
        <div
          className={`flex h-full w-full items-center justify-center rounded-[inherit] bg-muted/30 p-4 text-center ${this.props.className ?? ""}`}
        >
          <p className="text-xs text-muted-foreground opacity-70">Something went wrong</p>
        </div>
      );
    }
    return this.props.children;
  }
}
