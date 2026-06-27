import { useWallpaper } from "../lib/wallpaper";
import { wallpaperImageStyle } from "../lib/wallpaperStyle";

export default function WallpaperBackground({ overlay = "bg-iam-bg/70", className = "" }) {
  const { wallpaper } = useWallpaper();
  const removed = wallpaper.type === "none" || !wallpaper.url;

  return (
    <div className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-iam-bg ${className}`} aria-hidden>
      {!removed && (
        <div className="h-full w-full bg-iam-bg" style={wallpaperImageStyle(wallpaper)} />
      )}
      <div className={`absolute inset-0 ${removed ? "bg-iam-bg" : overlay}`} />
    </div>
  );
}
