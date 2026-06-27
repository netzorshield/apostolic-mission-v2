import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, ChevronDown, Pencil, Plus, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { api } from "../lib/api";
import { runDeleteAction } from "../lib/safeDelete";

function formatWhen(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function MissionEngagementPanel({ postId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .adminMissionEngagement(postId)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [postId]);

  if (loading) {
    return <p className="mt-3 font-inter text-xs text-iam-muted">Loading engagement…</p>;
  }
  if (error) {
    return <p className="mt-3 font-inter text-xs text-red-300">{error}</p>;
  }
  if (!data) return null;

  const topLevelComments = data.comments.filter((c) => !c.parent_id);
  const repliesByParent = data.comments.reduce((acc, c) => {
    if (!c.parent_id) return acc;
    if (!acc[c.parent_id]) acc[c.parent_id] = [];
    acc[c.parent_id].push(c);
    return acc;
  }, {});

  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-black/25 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-inter text-[10px] uppercase tracking-widest text-iam-gold">Member engagement</p>
        <button type="button" className="font-inter text-xs text-iam-muted hover:text-white" onClick={onClose}>
          Hide
        </button>
      </div>
      <div className="mb-4 flex flex-wrap gap-4 font-inter text-sm text-white">
        <span>♥ {data.like_count || 0} likes</span>
        <span>💬 {data.comment_count || 0} comments</span>
        <span>↗ {data.share_count || 0} shares</span>
      </div>

      <div className="space-y-4">
        <div>
          <p className="mb-2 font-inter text-xs font-medium uppercase tracking-wider text-iam-muted">Who liked</p>
          {data.likes.length === 0 ? (
            <p className="font-inter text-xs text-iam-muted">No likes yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.likes.map((like) => (
                <li key={like.id || `${like.user_id}-${like.created_at}`} className="rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                  <p className="font-inter text-sm text-white">{like.user_name}</p>
                  <p className="font-inter text-xs text-iam-muted">
                    {like.member_id || like.email || "Member"} · {formatWhen(like.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 font-inter text-xs font-medium uppercase tracking-wider text-iam-muted">Comments</p>
          {topLevelComments.length === 0 ? (
            <p className="font-inter text-xs text-iam-muted">No comments yet.</p>
          ) : (
            <ul className="space-y-3">
              {topLevelComments.map((comment) => (
                <li key={comment.id} className="rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                  <p className="font-inter text-xs font-medium text-iam-gold-light">{comment.user_name}</p>
                  <p className="mt-1 whitespace-pre-wrap font-inter text-sm text-white/90">{comment.body}</p>
                  <p className="mt-1 font-inter text-[10px] text-iam-muted">{formatWhen(comment.created_at)}</p>
                  {(repliesByParent[comment.id] || []).map((reply) => (
                    <div key={reply.id} className="ml-4 mt-3 border-l border-white/10 pl-3">
                      <p className="font-inter text-xs font-medium text-iam-gold-light">{reply.user_name}</p>
                      <p className="mt-1 whitespace-pre-wrap font-inter text-sm text-white/90">{reply.body}</p>
                      <p className="mt-1 font-inter text-[10px] text-iam-muted">{formatWhen(reply.created_at)}</p>
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="font-inter text-[10px] text-iam-muted">
          Share count increases when members tap Share on this post.
        </p>
      </div>
    </div>
  );
}

export default function AdminMissionPanel() {
  const navigate = useNavigate();
  const [published, setPublished] = useState([]);
  const [archived, setArchived] = useState([]);
  const [view, setView] = useState("published");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [heading, setHeading] = useState("");
  const [body, setBody] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [existingMediaUrl, setExistingMediaUrl] = useState("");
  const [existingMediaType, setExistingMediaType] = useState("none");
  const [removeMedia, setRemoveMedia] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [watchPostId, setWatchPostId] = useState(null);

  const load = () => {
    api.adminMissionPosts("published").then(setPublished).catch(() => setPublished([]));
    api.adminMissionPosts("archived").then(setArchived).catch(() => setArchived([]));
  };

  useEffect(load, []);

  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const resetForm = () => {
    setHeading("");
    setBody("");
    setPendingFile(null);
    setPreviewUrl("");
    setExistingMediaUrl("");
    setExistingMediaType("none");
    setRemoveMedia(false);
    setEditing(null);
    setShowForm(false);
    setError("");
  };

  const startEdit = (post) => {
    setEditing(post);
    setHeading(post.heading || "");
    setBody(post.body || "");
    setPendingFile(null);
    setExistingMediaUrl(post.media_url || "");
    setExistingMediaType(post.media_type || "none");
    setRemoveMedia(false);
    setShowForm(true);
    setError("");
  };

  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setError("Image too large (max 50MB). Choose a smaller file.");
      e.target.value = "";
      return;
    }
    const ext = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";
    const allowed = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "bmp", "tif", "tiff", "mp4", "webm", "mov", "pdf"];
    if (ext && !allowed.includes(ext)) {
      setError(`Unsupported file type (.${ext}). Use JPG, PNG, WEBP, or GIF.`);
      e.target.value = "";
      return;
    }
    setPendingFile(file);
    setRemoveMedia(false);
    setError("");
    e.target.value = "";
  };

  const clearMedia = () => {
    setPendingFile(null);
    setPreviewUrl("");
    if (editing?.media_url) {
      setRemoveMedia(true);
      setExistingMediaUrl("");
      setExistingMediaType("none");
    }
  };

  const displayImage =
    previewUrl || (!removeMedia && existingMediaUrl && existingMediaType === "image" ? existingMediaUrl : "");

  const handleSave = async (e) => {
    e.preventDefault();
    const title = heading.trim();
    const text = body.trim();
    if (!title) {
      setError("Heading is required — members will see this as the title.");
      return;
    }
    const hasMedia = Boolean(pendingFile || (!removeMedia && existingMediaUrl));
    if (!text && !hasMedia) {
      setError("Type a message or upload an image (or both).");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await api.updateMissionPostPublish(editing.id, title, text, pendingFile, removeMedia);
      } else {
        await api.publishMissionPost(title, text, pendingFile);
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id) => {
    if (!window.confirm("Archive this post? Members will no longer see it.")) return;
    await api.archiveMissionPost(id);
    load();
  };

  const handleRestore = async (id) => {
    await api.restoreMissionPost(id);
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Permanently delete this post and all comments?")) return;
    await runDeleteAction(async () => {
      if (watchPostId === id) setWatchPostId(null);
      if (editing?.id === id) resetForm();
      await api.deleteMissionPost(id);
      load();
    }, navigate);
  };

  const list = view === "published" ? published : archived;

  return (
    <div className="space-y-6">
      <p className="font-inter text-sm text-iam-muted">
        Type any message and/or upload images for members. They see only your heading and what you publish.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setView("published")}
          className={`rounded-full px-4 py-1.5 font-inter text-xs uppercase tracking-wider ${
            view === "published" ? "bg-iam-gold/25 text-iam-gold-light" : "bg-white/5 text-iam-muted"
          }`}
        >
          Published ({published.length})
        </button>
        <button
          type="button"
          onClick={() => setView("archived")}
          className={`rounded-full px-4 py-1.5 font-inter text-xs uppercase tracking-wider ${
            view === "archived" ? "bg-iam-gold/25 text-iam-gold-light" : "bg-white/5 text-iam-muted"
          }`}
        >
          Archived ({archived.length})
        </button>
        <button
          type="button"
          className="btn-gold ml-auto py-2 text-xs"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" /> New Post
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="glass-panel space-y-4 p-6">
          <p className="font-cinzel text-sm uppercase tracking-widest text-iam-gold-light">
            {editing ? "Edit Post" : "New Mission Post"}
          </p>
          <div>
            <label className="label-iam" htmlFor="mission-heading">
              Heading (shown to members)
            </label>
            <input
              id="mission-heading"
              className="input-iam w-full"
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              placeholder="e.g. Kingdom Mission Update"
              required
            />
          </div>
          <div>
            <label className="label-iam" htmlFor="mission-body">
              Type anything
            </label>
            <textarea
              id="mission-body"
              className="input-iam min-h-[160px] w-full"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message — text, updates, announcements…"
            />
          </div>
          <div>
            <label className="label-iam">Upload image (optional)</label>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="btn-ghost inline-flex cursor-pointer text-xs">
                <Upload className="h-4 w-4" /> Choose image
                <input
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
                  onChange={handleFilePick}
                />
              </label>
              {(displayImage || pendingFile || existingMediaUrl) && (
                <button type="button" className="btn-ghost py-1 text-xs" onClick={clearMedia}>
                  <X className="h-3.5 w-3.5" /> Remove image
                </button>
              )}
            </div>
            {displayImage && (
              <img
                src={displayImage}
                alt=""
                className="mt-3 max-h-56 rounded-lg border border-white/10 object-contain"
              />
            )}
            {pendingFile && (
              <p className="mt-2 font-inter text-xs text-iam-gold-light">{pendingFile.name}</p>
            )}
          </div>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-gold py-2 text-xs" disabled={saving}>
              {saving ? "Publishing…" : editing ? "Save Changes" : "Publish to Members"}
            </button>
            <button type="button" className="btn-ghost py-2 text-xs" onClick={resetForm}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {list.length === 0 && (
        <p className="font-inter text-sm text-iam-muted">
          {view === "published" ? "No published posts yet." : "No archived posts."}
        </p>
      )}

      {list.map((post) => (
        <div key={post.id} className="glass-panel p-5">
          <h3 className="font-playfair text-xl text-white">{post.heading}</h3>
          {post.body && <p className="mt-2 whitespace-pre-wrap font-inter text-sm text-iam-muted">{post.body}</p>}
          {post.media_url && post.media_type === "image" && (
            <img
              src={post.media_url}
              alt=""
              className="mt-3 max-h-40 rounded-lg border border-white/10 object-cover"
            />
          )}
          <button
            type="button"
            className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-inter text-sm text-iam-gold-light transition hover:bg-white/5"
            onClick={() => setWatchPostId(watchPostId === post.id ? null : post.id)}
          >
            <span>♥ {post.like_count || 0}</span>
            <span>💬 {post.comment_count || 0}</span>
            <span>↗ {post.share_count || 0}</span>
            <span className="ml-auto inline-flex items-center gap-1 text-xs uppercase tracking-wider text-iam-muted">
              {watchPostId === post.id ? "Hide" : "Watch"}
              <ChevronDown className={`h-3.5 w-3.5 transition ${watchPostId === post.id ? "rotate-180" : ""}`} />
            </span>
          </button>
          {watchPostId === post.id && (
            <MissionEngagementPanel postId={post.id} onClose={() => setWatchPostId(null)} />
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-ghost py-1.5 text-xs" onClick={() => startEdit(post)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            {view === "published" ? (
              <button type="button" className="btn-ghost py-1.5 text-xs" onClick={() => handleArchive(post.id)}>
                <Archive className="h-3.5 w-3.5" /> Archive
              </button>
            ) : (
              <button type="button" className="btn-gold py-1.5 text-xs" onClick={() => handleRestore(post.id)}>
                <RotateCcw className="h-3.5 w-3.5" /> Restore
              </button>
            )}
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-3 py-1.5 font-inter text-xs text-red-300 hover:bg-red-500/10"
              onClick={() => handleDelete(post.id)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
