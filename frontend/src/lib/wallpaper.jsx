import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";

const DEFAULT_WALLPAPER = {
  type: "image",
  url: "/uploads/wallpapers/default-sunset.png",
  fit: "cover",
  position_x: 50,
  position_y: 50,
  zoom: 100,
};

const WallpaperContext = createContext({
  wallpaper: DEFAULT_WALLPAPER,
  refreshWallpaper: async () => {},
});

export function WallpaperProvider({ children }) {
  const [wallpaper, setWallpaper] = useState(DEFAULT_WALLPAPER);

  const refreshWallpaper = useCallback(async () => {
    try {
      const data = await api.getWallpaper();
      setWallpaper(data);
    } catch {
      setWallpaper(DEFAULT_WALLPAPER);
    }
  }, []);

  useEffect(() => {
    refreshWallpaper();
  }, [refreshWallpaper]);

  return (
    <WallpaperContext.Provider value={{ wallpaper, refreshWallpaper }}>
      {children}
    </WallpaperContext.Provider>
  );
}

export function useWallpaper() {
  return useContext(WallpaperContext);
}
