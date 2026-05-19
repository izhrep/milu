import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import "./index.css";
import { initThemeOverrides } from "./features/ThemeEditor/themeOverrides";

initThemeOverrides();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
