import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Heart,
  MessageCircle,
  Share2,
  Send,
  Reply,
  Pencil,
  Trash2,
  X,
  Check,
  Copy,
  Facebook,
  Instagram,
  Download,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { runDeleteAction } from "../lib/safeDelete";

function missionShareLink() {
  return `${window.location.origin}/dashboard`;
}

function buildMissionShareText(post) {
  const link = missionShareLink();
  const parts = [post.heading || "IAM Mission"];
  if (post.body?.trim()) {
    parts.push(post.body.trim());
  }
  parts.push(link);
  return parts.join("\n\n");
}

function missionMediaFilename(post) {
  const url = post.media_url || "";
  const ext = url.split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg";
  const base = (post.heading || "iam-image")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 48) || "iam-image";
  return `${base}.${ext}`;
}

async function downloadPostImage(post, onFeedback) {
  const url = post.media_url;
  if (!url || post.media_type !== "image") return;
  const filename = missionMediaFilename(post);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(blobUrl);
    onFeedback?.("Image downloaded");
  } catch {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    onFeedback?.("Download started");
  }
}

function ShareMenu({ post, sharePayload, onCopyFeedback }) {
  const shareText = buildMissionShareText(post);
  const shareUrl = missionShareLink();

  const copyShare = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        onCopyFeedback("Copied to clipboard");
      }
    } catch {
      onCopyFeedback("Could not copy — try again");
    }
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
  };

  const shareFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(sharePayload?.heading || post.heading || "IAM Mission")}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const shareInstagram = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        onCopyFeedback("Copied — paste in Instagram");
      }
    } catch {
      /* ignore */
    }
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  };

  const btn =
    "inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/25 px-2 py-1 font-inter text-[10px] text-white/90 transition hover:border-iam-gold/40 hover:bg-iam-gold/10 hover:text-iam-gold-light";

  return (
    <div className="mt-3 w-full rounded-md border border-iam-gold/20 bg-black/20 px-3 py-2">
      <p className="mb-1.5 font-inter text-[8px] uppercase tracking-[0.2em] text-iam-muted/80">Share to</p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={btn} onClick={copyShare}>
          <Copy className="h-3 w-3" /> Copy
        </button>
        <button type="button" className={btn} onClick={shareWhatsApp}>
          <MessageCircle className="h-3 w-3" /> WhatsApp
        </button>
        <button type="button" className={btn} onClick={shareFacebook}>
          <Facebook className="h-3 w-3" /> Facebook
        </button>
        <button type="button" className={btn} onClick={shareInstagram}>
          <Instagram className="h-3 w-3" /> Instagram
        </button>
      </div>
      <p className="mt-1.5 font-inter text-[8px] leading-snug text-iam-muted/70">
        Copy saves the post text and link — paste anywhere you like.
      </p>
    </div>
  );
}

function MissionMedia({ post, embedded = false, onDownload }) {
  if (!post.media_url || post.media_type === "none") return null;
  const wrap = embedded ? "mt-4" : "mt-4";
  if (post.media_type === "image") {
    return (
      <div className={`${wrap} relative`}>
        <img
          src={post.media_url}
          alt={post.heading || "Mission update"}
          className="max-h-[28rem] w-full rounded-lg border border-white/10 object-contain bg-black/30"
        />
        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/60 px-2 py-1 font-inter text-[10px] uppercase tracking-wider text-white/90 backdrop-blur-sm transition hover:border-iam-gold/40 hover:text-iam-gold-light"
          >
            <Download className="h-3 w-3" /> Download
          </button>
        )}
      </div>
    );
  }
  if (post.media_type === "video") {
    return (
      <video
        src={post.media_url}
        controls
        className={`${wrap} max-h-[28rem] w-full rounded-lg border border-white/10 bg-black/30`}
      />
    );
  }
  if (post.media_type === "document" && post.media_url.toLowerCase().endsWith(".pdf")) {
    return (
      <div className={wrap}>
        <p className="mb-2 font-inter text-[10px] uppercase tracking-widest text-iam-muted">Uploaded document</p>
        <iframe
          title={post.heading || "Mission document"}
          src={post.media_url}
          className="h-80 w-full rounded-lg border border-white/10 bg-black/30"
        />
        <a
          href={post.media_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex text-sm text-iam-gold-light hover:underline"
        >
          Open document in new tab
        </a>
      </div>
    );
  }
  return (
    <div className={wrap}>
      <p className="mb-2 font-inter text-[10px] uppercase tracking-widest text-iam-muted">Uploaded file</p>
      <a
        href={post.media_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex rounded-lg border border-iam-gold/30 bg-iam-gold/10 px-4 py-2 text-sm text-iam-gold-light hover:bg-iam-gold/15"
      >
        View attachment
      </a>
    </div>
  );
}

function buildCommentTree(comments) {
  const byId = new Map();
  const roots = [];
  comments.forEach((c) => byId.set(c.id, { ...c, replies: [] }));
  comments.forEach((c) => {
    const node = byId.get(c.id);
    if (c.parent_id && byId.has(c.parent_id)) {
      byId.get(c.parent_id).replies.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function CommentItem({
  comment,
  postId,
  depth,
  onEdit,
  onDelete,
  replyToId,
  setReplyToId,
  replyText,
  setReplyText,
  onSubmitReply,
  replyLoading,
}) {
  const isReplying = replyToId === comment.id;

  return (
    <div className={depth > 0 ? "ml-4 border-l border-iam-gold/20 pl-3" : ""}>
      <div className="rounded-lg bg-black/20 px-3 py-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="font-inter text-xs font-medium text-iam-gold-light">{comment.user_name}</p>
          {comment.is_own && (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => onEdit(comment)}
                className="rounded p-1 text-iam-muted transition hover:text-iam-gold-light"
                aria-label="Edit comment"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(comment.id)}
                className="rounded p-1 text-iam-muted transition hover:text-red-300"
                aria-label="Delete comment"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        <p className="mt-1 whitespace-pre-wrap font-inter text-sm text-white/90">{comment.body}</p>
        {comment.updated_at && (
          <p className="mt-1 font-inter text-[10px] text-iam-muted">Edited</p>
        )}
        <button
          type="button"
          onClick={() => {
            setReplyToId(isReplying ? null : comment.id);
            setReplyText("");
          }}
          className="mt-2 inline-flex items-center gap-1 font-inter text-[10px] uppercase tracking-wider text-iam-muted transition hover:text-iam-gold-light"
        >
          <Reply className="h-3 w-3" /> Reply
        </button>
      </div>

      {isReplying && (
        <form
          onSubmit={(e) => onSubmitReply(e, comment.id)}
          className="mt-2 flex gap-2"
        >
          <input
            className="input-iam flex-1 py-2 text-sm"
            placeholder={`Reply to ${comment.user_name}...`}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn-gold shrink-0 py-2" disabled={replyLoading}>
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}

      {comment.replies?.length > 0 && (
        <div className="mt-2 space-y-2">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              postId={postId}
              depth={depth + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              replyToId={replyToId}
              setReplyToId={setReplyToId}
              replyText={replyText}
              setReplyText={setReplyText}
              onSubmitReply={onSubmitReply}
              replyLoading={replyLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MissionPostCard({ post, onUpdate, embedded = false }) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [shareCount, setShareCount] = useState(post.share_count || 0);
  const [commentCount, setCommentCount] = useState(post.comment_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [replyToId, setReplyToId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState("");
  const [loading, setLoading] = useState(false);
  const [replyLoading, setReplyLoading] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePayload, setSharePayload] = useState(null);
  const [downloadMsg, setDownloadMsg] = useState("");
  const hasImage = post.media_type === "image" && post.media_url;

  const loadComments = () => {
    api.missionComments(post.id).then(setComments).catch(() => setComments([]));
  };

  const toggleComments = () => {
    if (!showComments) loadComments();
    setShowComments(!showComments);
  };

  const handleLike = async () => {
    try {
      const res = await api.missionLike(post.id);
      setLiked(res.liked);
      setLikeCount(res.like_count);
      onUpdate?.();
    } catch {
      /* ignore */
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text) return;
    setLoading(true);
    try {
      const created = await api.missionComment(post.id, text);
      setComments((c) => [...c, created]);
      setCommentCount((n) => n + 1);
      setCommentText("");
      onUpdate?.();
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async (e, parentId) => {
    e.preventDefault();
    const text = replyText.trim();
    if (!text) return;
    setReplyLoading(true);
    try {
      const created = await api.missionComment(post.id, text, parentId);
      setComments((c) => [...c, created]);
      setCommentCount((n) => n + 1);
      setReplyText("");
      setReplyToId(null);
      onUpdate?.();
    } catch {
      /* ignore */
    } finally {
      setReplyLoading(false);
    }
  };

  const startEdit = (comment) => {
    setEditingComment(comment);
    setEditText(comment.body);
    setReplyToId(null);
  };

  const cancelEdit = () => {
    setEditingComment(null);
    setEditText("");
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    const text = editText.trim();
    if (!editingComment || !text) return;
    setLoading(true);
    try {
      const updated = await api.missionUpdateComment(post.id, editingComment.id, text);
      setComments((list) => list.map((c) => (c.id === updated.id ? updated : c)));
      cancelEdit();
      onUpdate?.();
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm("Delete this comment? Replies you wrote will also be removed.")) return;
    await runDeleteAction(async () => {
      const res = await api.missionDeleteComment(post.id, commentId);
      loadComments();
      setCommentCount(res.comment_count ?? 0);
      if (editingComment?.id === commentId) cancelEdit();
      onUpdate?.();
    }, navigate);
  };

  const handleShare = async () => {
    if (shareOpen) {
      setShareOpen(false);
      return;
    }
    setShareLoading(true);
    try {
      const res = await api.missionShare(post.id);
      setShareCount(res.share_count);
      setSharePayload(res);
      setShareOpen(true);
      onUpdate?.();
    } catch {
      /* ignore */
    } finally {
      setShareLoading(false);
    }
  };

  const showShareFeedback = (msg) => {
    setShareMsg(msg);
    setTimeout(() => setShareMsg(""), 2500);
  };

  const handleDownloadImage = () => {
    downloadPostImage(post, (msg) => {
      setDownloadMsg(msg);
      setTimeout(() => setDownloadMsg(""), 2500);
    });
  };

  const commentTree = buildCommentTree(comments);

  return (
    <article
      className={
        embedded
          ? "overflow-hidden rounded-xl border border-white/10 bg-black/20 p-5 md:p-6"
          : "glass-panel mb-6 overflow-hidden p-6 md:p-8"
      }
    >
      <h3 className={`font-playfair text-white ${embedded ? "text-xl md:text-2xl" : "text-2xl md:text-3xl"}`}>
        {post.heading}
      </h3>
      {post.body && (
        <p className="mt-4 whitespace-pre-wrap font-inter text-sm leading-relaxed text-iam-muted md:text-base">
          {post.body}
        </p>
      )}
      <MissionMedia post={post} embedded={embedded} onDownload={hasImage ? handleDownloadImage : undefined} />

      <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-white/10 pt-5">
        <button
          type="button"
          onClick={handleLike}
          className={`inline-flex items-center gap-2 font-inter text-xs uppercase tracking-wider transition ${
            liked ? "text-red-300" : "text-iam-muted hover:text-iam-gold-light"
          }`}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-red-300" : ""}`} />
          Like {likeCount > 0 && `(${likeCount})`}
        </button>
        <button
          type="button"
          onClick={toggleComments}
          className="inline-flex items-center gap-2 font-inter text-xs uppercase tracking-wider text-iam-muted transition hover:text-iam-gold-light"
        >
          <MessageCircle className="h-4 w-4" />
          Comment {commentCount > 0 && `(${commentCount})`}
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={shareLoading}
          className={`inline-flex items-center gap-2 font-inter text-xs uppercase tracking-wider transition ${
            shareOpen ? "text-iam-gold-light" : "text-iam-muted hover:text-iam-gold-light"
          }`}
        >
          <Share2 className="h-4 w-4" />
          {shareLoading ? "…" : "Share"} {shareCount > 0 && `(${shareCount})`}
        </button>
        {hasImage && (
          <button
            type="button"
            onClick={handleDownloadImage}
            className="inline-flex items-center gap-2 font-inter text-xs uppercase tracking-wider text-iam-muted transition hover:text-iam-gold-light"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        )}
        {shareMsg && <span className="text-xs text-iam-gold-light">{shareMsg}</span>}
        {downloadMsg && <span className="text-xs text-iam-gold-light">{downloadMsg}</span>}
      </div>

      {shareOpen && sharePayload && (
        <ShareMenu post={post} sharePayload={sharePayload} onCopyFeedback={showShareFeedback} />
      )}

      {showComments && (
        <div className="mt-5 border-t border-white/10 pt-5">
          <div className="max-h-72 space-y-3 overflow-y-auto">
            {commentTree.length === 0 && (
              <p className="font-inter text-xs text-iam-muted">No comments yet. Be the first to comment.</p>
            )}
            {commentTree.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                postId={post.id}
                depth={0}
                onEdit={startEdit}
                onDelete={handleDelete}
                replyToId={replyToId}
                setReplyToId={setReplyToId}
                replyText={replyText}
                setReplyText={setReplyText}
                onSubmitReply={handleReply}
                replyLoading={replyLoading}
              />
            ))}
          </div>

          {editingComment && (
            <form onSubmit={saveEdit} className="mt-4 rounded-lg border border-iam-gold/30 bg-black/25 p-3">
              <p className="mb-2 font-inter text-xs text-iam-gold-light">Edit your comment</p>
              <textarea
                className="input-iam min-h-[72px] w-full text-sm"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                required
              />
              <div className="mt-2 flex gap-2">
                <button type="submit" className="btn-gold py-1.5 text-xs" disabled={loading}>
                  <Check className="h-3.5 w-3.5" /> Save
                </button>
                <button type="button" className="btn-ghost py-1.5 text-xs" onClick={cancelEdit}>
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
              </div>
            </form>
          )}

          <form onSubmit={handleComment} className="mt-4 flex gap-2">
            <input
              className="input-iam flex-1"
              placeholder="Write a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <button type="submit" className="btn-gold shrink-0 py-2" disabled={loading}>
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

export default function MissionFeed({ embedded = false, hideWhenEmpty = false, onLoaded }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!user) {
      setPosts([]);
      setLoading(false);
      onLoaded?.([]);
      return;
    }
    api
      .missionFeed()
      .then((data) => {
        setPosts(data);
        onLoaded?.(data);
      })
      .catch(() => {
        setPosts([]);
        onLoaded?.([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  if (loading) return null;
  if (posts.length === 0) {
    if (hideWhenEmpty) return null;
    if (embedded) {
      return (
        <p className="font-inter text-sm text-iam-muted">No admin updates yet. Check back soon.</p>
      );
    }
    return null;
  }

  return (
    <section className={embedded ? "space-y-5" : "mb-10"}>
      {posts.map((post) => (
        <MissionPostCard key={post.id} post={post} onUpdate={load} embedded={embedded} />
      ))}
    </section>
  );
}
