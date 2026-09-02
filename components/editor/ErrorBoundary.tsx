"use client";

import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { useTranslations } from "next-intl";

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
          <div className="empty-state" style={{ height: "100%" }}>
            <span className="empty-state-text">{this.props.message ?? "Something went wrong"}</span>
            <button type="button" className="btn btn-sm empty-state-action" onClick={() => this.setState({ hasError: false, error: null })}>
              {this.props.retryLabel ?? "Retry"}
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

/**
 * Localized ErrorBoundary for use inside a NextIntl provider. Reads the
 * `errors` namespace and passes translated strings down; the raw
 * `ErrorBoundary` keeps static English defaults so it stays usable without a
 * translation context (tests, isolated embeds).
 */
export function LocalizedErrorBoundary({ children }: { children: ReactNode }) {
  const t = useTranslations("errors");
  return (
    <ErrorBoundary message={t("message")} retryLabel={t("tryAgain")}>
      {children}
    </ErrorBoundary>
  );
}
