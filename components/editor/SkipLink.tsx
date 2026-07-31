"use client";

export function SkipLink() {
  return (
    <a href="#main-content" className="skip-link" onClick={(e) => {
      e.preventDefault();
      const target = document.getElementById("main-content");
      target?.focus();
    }}>
      Skip to content
    </a>
  );
}
