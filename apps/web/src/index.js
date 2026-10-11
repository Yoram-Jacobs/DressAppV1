import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import "@/lib/i18n";
import App from "@/App";


// Suppress benign browser extension message port disconnection errors from cluttering the console
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const msg = event?.reason?.message || String(event?.reason || "");
    if (
      msg.includes("message channel closed before a response was received") ||
      msg.includes("The message port closed before a response was received") ||
      msg.includes("ResizeObserver loop completed with undelivered notifications")
    ) {
      event.preventDefault();
      event.stopImmediatePropagation?.();
    }
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && 'PushManager' in window) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('Service Worker registered successfully:', reg.scope);
      })
      .catch((err) => {
        console.error('Service Worker registration failed:', err);
      });
  });
}

