"use client";

import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  message?: string;
  retryLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              height: "100%",
              color: "var(--text-secondary)",
              fontSize: 13,
              padding: 24,
              textAlign: "center"
            }}
          >
            <span>{this.props.message ?? "Something went wrong"}</span>
            <button
              className="btn"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              {this.props.retryLabel ?? "Retry"}
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
