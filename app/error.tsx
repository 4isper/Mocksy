"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="editor-shell">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <h1>Mocksy</h1>
      </div>
      <div className="panel" role="alert" style={{ padding: 24, display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Something went wrong</h2>
        <p style={{ margin: 0, opacity: 0.7 }}>
          The editor hit an unexpected error. Your last saved scene is still safe in this browser.
        </p>
        <button type="button" className="btn btn-primary" onClick={reset} style={{ justifySelf: "start" }}>
          Try again
        </button>
      </div>
    </main>
  );
}
