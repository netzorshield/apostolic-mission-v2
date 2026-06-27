import { useEffect, useState } from "react";
import { Image, Link2, Trash2, Upload } from "lucide-react";
import { api } from "../lib/api";
import { useWallpaper } from "../lib/wallpaper";
import { WALLPAPER_FIT_OPTIONS, wallpaperImageStyle } from "../lib/wallpaperStyle";

const DEFAULT_DISPLAY = {
  fit: "cover",
  position_x: 50,
  position_y: 50,
  zoom: 100,
};

export default function AdminWallpaperPanel() {
  const { wallpaper, refreshWallpaper } = useWallpaper();
  const [url, setUrl] = useState(wallpaper.url || "");
  const [display, setDisplay] = useState({
    fit: wallpaper.fit || DEFAULT_DISPLAY.fit,
    position_x: wallpaper.position_x ?? DEFAULT_DISPLAY.position_x,
    position_y: wallpaper.position_y ?? DEFAULT_DISPLAY.position_y,
    zoom: wallpaper.zoom ?? DEFAULT_DISPLAY.zoom,
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setUrl(wallpaper.url || "");
    setDisplay({
      fit: wallpaper.fit || DEFAULT_DISPLAY.fit,
      position_x: wallpaper.position_x ?? DEFAULT_DISPLAY.position_x,
      position_y: wallpaper.position_y ?? DEFAULT_DISPLAY.position_y,
      zoom: wallpaper.zoom ?? DEFAULT_DISPLAY.zoom,
    });
  }, [wallpaper]);

  const previewWallpaper = { ...wallpaper, url: url || wallpaper.url, ...display };
  const removed = wallpaper.type === "none" || (!wallpaper.url && !url);

  const handleSaveUrl = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api.updateWallpaper({ url, ...display });
      await refreshWallpaper();
      setMessage("Wallpaper updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDisplay = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api.updateWallpaper(display);
      await refreshWallpaper();
      setMessage("Image size and position saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Choose an image to upload.");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const data = await api.uploadWallpaper(file);
      setUrl(data.url);
      await refreshWallpaper();
      setFile(null);
      setMessage("Wallpaper uploaded.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm("Remove the site wallpaper? Pages will use a plain dark background.")) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api.removeWallpaper();
      setUrl("");
      setFile(null);
      await refreshWallpaper();
      setMessage("Wallpaper removed.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="glass-panel p-6">
        <h3 className="font-cinzel text-sm uppercase tracking-widest text-iam-gold-light">Site Wallpaper</h3>
        <p className="mt-2 font-inter text-sm text-iam-muted">
          One background image for every page — Home, Apply, Enroll, Login, Member Portal, and Admin. Upload an image
          or paste a URL, then adjust how it fits on screen.
        </p>

        <form onSubmit={handleSaveUrl} className="mt-6 space-y-4">
          <div>
            <label className="label-iam flex items-center gap-2">
              <Link2 className="h-3 w-3" /> Image URL
            </label>
            <input
              className="input-iam"
              placeholder="https://example.com/image.jpg"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-gold" disabled={loading || !url}>
            Save Image URL
          </button>
        </form>

        <form onSubmit={handleUpload} className="mt-8 space-y-4 border-t border-white/10 pt-6">
          <div>
            <label className="label-iam flex items-center gap-2">
              <Upload className="h-3 w-3" /> Upload Image
            </label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="block w-full font-inter text-xs text-iam-muted file:mr-3 file:rounded-md file:border-0 file:bg-iam-gold/20 file:px-3 file:py-2 file:text-iam-gold-light"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <button type="submit" className="btn-ghost" disabled={loading || !file}>
            Upload & Apply
          </button>
        </form>

        <div className="mt-8 space-y-4 border-t border-white/10 pt-6">
          <p className="font-inter text-xs uppercase tracking-widest text-iam-gold-light">Image Size & Position</p>

          <div>
            <label className="label-iam" htmlFor="wallpaper-fit">How image fits</label>
            <select
              id="wallpaper-fit"
              className="input-iam"
              value={display.fit}
              onChange={(e) => setDisplay({ ...display, fit: e.target.value })}
            >
              {WALLPAPER_FIT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {display.fit === "cover" && (
            <div>
              <label className="label-iam" htmlFor="wallpaper-zoom">
                Zoom — {display.zoom}%
              </label>
              <input
                id="wallpaper-zoom"
                type="range"
                min={50}
                max={200}
                value={display.zoom}
                onChange={(e) => setDisplay({ ...display, zoom: Number(e.target.value) })}
                className="w-full accent-iam-gold"
              />
            </div>
          )}

          <div>
            <label className="label-iam" htmlFor="wallpaper-pos-x">
              Horizontal position — {display.position_x}%
            </label>
            <input
              id="wallpaper-pos-x"
              type="range"
              min={0}
              max={100}
              value={display.position_x}
              onChange={(e) => setDisplay({ ...display, position_x: Number(e.target.value) })}
              className="w-full accent-iam-gold"
            />
          </div>

          <div>
            <label className="label-iam" htmlFor="wallpaper-pos-y">
              Vertical position — {display.position_y}%
            </label>
            <input
              id="wallpaper-pos-y"
              type="range"
              min={0}
              max={100}
              value={display.position_y}
              onChange={(e) => setDisplay({ ...display, position_y: Number(e.target.value) })}
              className="w-full accent-iam-gold"
            />
          </div>

          <button type="button" className="btn-gold" onClick={handleSaveDisplay} disabled={loading || removed}>
            Save Size & Position
          </button>
        </div>

        <div className="mt-8 border-t border-white/10 pt-6">
          <button
            type="button"
            onClick={handleRemove}
            disabled={loading || removed}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-4 py-2 font-inter text-xs uppercase tracking-wider text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
            Remove Wallpaper
          </button>
          {removed && (
            <p className="mt-2 font-inter text-xs text-iam-muted">No wallpaper is set. Upload or save a URL to restore one.</p>
          )}
        </div>

        {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}
        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
      </div>

      <div className="glass-panel overflow-hidden p-4">
        <p className="mb-3 font-inter text-xs uppercase tracking-widest text-iam-muted">Live Preview</p>
        <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-iam-bg">
          {removed ? (
            <div className="flex h-full items-center justify-center">
              <p className="font-inter text-sm text-iam-muted">No wallpaper — plain background</p>
            </div>
          ) : (
            <div className="h-full w-full" style={wallpaperImageStyle(previewWallpaper)} />
          )}
          {!removed && <div className="absolute inset-0 bg-black/40" />}
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-4">
            <Image className="h-4 w-4 text-iam-gold" />
            <div className="min-w-0 flex-1">
              <p className="font-inter text-[10px] uppercase tracking-widest text-iam-gold">Image wallpaper</p>
              <p className="truncate font-inter text-xs text-white/70">{previewWallpaper.url || "—"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
