import { useLocation } from "react-router-dom";
import WallpaperBackground from "./WallpaperBackground";

export default function AppWallpaper() {
  const { pathname } = useLocation();
  const overlay = pathname === "/" ? "bg-transparent" : "bg-iam-bg/72";
  return <WallpaperBackground overlay={overlay} />;
}
