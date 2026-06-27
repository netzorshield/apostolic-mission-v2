export const WALLPAPER_FIT_OPTIONS = [
  { id: "cover", label: "Fill screen (crop edges)" },
  { id: "contain", label: "Show full image" },
  { id: "fill", label: "Stretch to screen" },
];

export function wallpaperImageStyle(wallpaper) {
  if (!wallpaper?.url) return {};
  const fit = wallpaper.fit || "cover";
  const px = wallpaper.position_x ?? 50;
  const py = wallpaper.position_y ?? 50;
  const zoom = wallpaper.zoom ?? 100;

  let backgroundSize = fit;
  if (fit === "cover") {
    backgroundSize = `${zoom}%`;
  } else if (fit === "fill") {
    backgroundSize = "100% 100%";
  }

  return {
    backgroundImage: `url('${wallpaper.url}')`,
    backgroundSize,
    backgroundPosition: `${px}% ${py}%`,
    backgroundRepeat: "no-repeat",
  };
}
