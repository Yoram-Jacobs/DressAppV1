import React from "react";
import ReactDOM from "react-dom/client";
import { toast } from "sonner";
import "@/index.css";
import "@/lib/i18n";
import App from "@/App";

toast.success = () => {};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ("serviceWorker" in navigator && "PushManager" in window) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("Service Worker registered successfully:", reg.scope);
      })
      .catch((err) => {
        console.error("Service Worker registration failed:", err);
      });
  });
}





