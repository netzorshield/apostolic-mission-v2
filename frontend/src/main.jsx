import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import { WallpaperProvider } from "./lib/wallpaper";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <WallpaperProvider>
          <App />
        </WallpaperProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
