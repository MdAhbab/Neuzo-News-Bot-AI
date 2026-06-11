import { Component, type ReactNode } from "react";

/** Wraps canvas/visual sub-trees so a render failure degrades gracefully. */
export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown) {
    // eslint-disable-next-line no-console
    console.warn("Visual sub-tree failed to render:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="grid h-full place-items-center p-6 text-center font-mono text-xs text-muted-foreground">
            Visualization unavailable on this device.
          </div>
        )
      );
    }
    return this.props.children;
  }
}
