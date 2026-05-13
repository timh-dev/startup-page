import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import "@/assets/styles/index.css";
import { hydrateSettingsFromIndexedDb } from "@/lib/settings";

// views without layouts
import IndexPage from "@/features/dashboard/pages";

void hydrateSettingsFromIndexedDb().finally(() => {
  const rootElement = document.getElementById("root");

  if (!rootElement) {
    throw new Error("Root element was not found.");
  }

  createRoot(rootElement).render(
    <StrictMode>
      <HashRouter>
        <Routes>
          <Route path="/" element={<IndexPage />} />
        </Routes>
      </HashRouter>
    </StrictMode>
  );
});
