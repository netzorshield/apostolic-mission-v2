const API = "/api";
const TOKEN_KEY = "iam_token";

function purgeLegacySharedToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("iam_remember");
  } catch {
    /* ignore */
  }
}

export function clearStoredSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  purgeLegacySharedToken();
}

export function setStoredToken(token) {
  purgeLegacySharedToken();
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function getStoredToken() {
  purgeLegacySharedToken();
  return sessionStorage.getItem(TOKEN_KEY);
}

async function parseResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      clearStoredSession();
    }
    const detail = data.detail;
    let msg =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((item) => item?.msg || item?.message).filter(Boolean).join(" ") || "Request failed"
          : res.statusText || "Request failed";
    if (res.status === 405) {
      msg = "Publish failed (server out of date). Restart the backend and hard refresh the page (Ctrl+F5).";
    }
    if (res.status === 403 && msg === "Admin access required") {
      msg = "Admin sign-in required. Sign in again in this tab, then publish.";
    }
    throw new Error(msg);
  }
  return data;
}

/** Public endpoints — never attach a signed-in token (admin or member). */
async function requestPublic(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...options.headers,
  };
  const res = await fetch(`${API}${path}`, { ...options, headers });
  return parseResponse(res);
}

async function request(path, options = {}) {
  const token = getStoredToken();
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res = await fetch(`${API}${path}`, { ...options, headers });
  return parseResponse(res);
}

export const api = {
  login: (email, password) =>
    requestPublic("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (email, password, name) =>
    requestPublic("/auth/register", { method: "POST", body: JSON.stringify({ email, password, name }) }),
  me: () => request("/auth/me"),
  logout: () => requestPublic("/auth/logout", { method: "POST" }),
  forgotPassword: (body) =>
    requestPublic("/auth/forgot-password", { method: "POST", body: JSON.stringify(body) }),
  passwordResetStatus: () => requestPublic("/auth/password-reset-status"),
  accountRestoreRequest: (body) =>
    requestPublic("/auth/account-restore-request", { method: "POST", body: JSON.stringify(body) }),
  apply: (body) => requestPublic("/applications", { method: "POST", body: JSON.stringify(body) }),
  submitHelp: (body) => request("/helps", { method: "POST", body: JSON.stringify(body) }),
  myHelps: () => request("/helps/mine"),
  uploadEnrollmentDocument: (docType, file) => {
    const fd = new FormData();
    fd.append("file", file, file.name || "upload");
    return request(`/enrollment/documents/${docType}`, { method: "POST", body: fd });
  },
  fetchEnrollmentDocument: async (docType) => {
    const token = getStoredToken();
    const res = await fetch(`${API}/enrollment/documents/${docType}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Could not load document");
    return res.blob();
  },
  openEnrollmentDocument: async (docType, enrollmentId) => {
    const token = getStoredToken();
    const path = enrollmentId
      ? `${API}/admin/enrollments/${enrollmentId}/documents/${docType}`
      : `${API}/enrollment/documents/${docType}`;
    const res = await fetch(path, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Could not open document");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
  adminEnrollmentDocumentUrl: (enrollmentId, docType) =>
    `/api/admin/enrollments/${enrollmentId}/documents/${docType}`,
  getEnrollment: () => request("/enrollment"),
  saveEnrollment: (data) =>
    request("/enrollment/save", { method: "POST", body: JSON.stringify({ data }) }),
  submitEnrollment: (data) =>
    request("/enrollment/submit", { method: "POST", body: JSON.stringify({ data }) }),
  requestEnrollmentEdit: (message = "") =>
    request("/enrollment/edit-request", { method: "POST", body: JSON.stringify({ message }) }),
  submitEnrollmentChanges: (data) =>
    request("/enrollment/submit-changes", { method: "POST", body: JSON.stringify({ data }) }),
  getCard: () => request("/membership/card"),
  adminStats: () => request("/admin/stats"),
  adminUsers: () => request("/admin/users"),
  adminRequests: () => request("/admin/requests"),
  adminMembers: () => request("/admin/members"),
  adminHelps: () => request("/admin/helps"),
  patchHelp: (id, body) =>
    request(`/admin/helps/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteApplication: (id) => request(`/admin/applications/${id}`, { method: "DELETE" }),
  deleteMember: (id) => request(`/admin/members/${id}`, { method: "DELETE" }),
  deleteEnrollment: (id) => request(`/admin/enrollments/${id}`, { method: "DELETE" }),
  deleteHelp: (id) => request(`/admin/helps/${id}`, { method: "DELETE" }),
  adminRecycleBin: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.date) qs.set("date", params.date);
    const query = qs.toString();
    return request(`/admin/recycle-bin${query ? `?${query}` : ""}`);
  },
  restoreRecycleItem: (id) => request(`/admin/recycle-bin/${id}/restore`, { method: "POST" }),
  purgeRecycleItem: (id) => request(`/admin/recycle-bin/${id}`, { method: "DELETE" }),
  patchUser: (id, body) =>
    request(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  resetUserPassword: (id, password) =>
    request(`/admin/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  deleteUserPassword: (id) => request(`/admin/users/${id}/password`, { method: "DELETE" }),
  adminApplications: () => request("/applications"),
  patchApplication: (id, body) =>
    request(`/applications/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  adminEnrollments: () => request("/enrollment/all"),
  approveEnrollment: (id) => request(`/enrollment/${id}/approve`, { method: "POST" }),
  approveRegistration: (id) => request(`/admin/registrations/${id}/approve`, { method: "POST" }),
  rejectRegistration: (id, reason) =>
    request(`/admin/registrations/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ status: "rejected", reason }),
    }),
  rejectEnrollment: (id, reason) =>
    request(`/enrollment/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ status: "rejected", reason }),
    }),
  approveEditRequest: (id) =>
    request(`/admin/enrollments/${id}/approve-edit-request`, { method: "POST" }),
  rejectEditRequest: (id, reason) =>
    request(`/admin/enrollments/${id}/reject-edit-request`, {
      method: "POST",
      body: JSON.stringify({ status: "rejected", reason }),
    }),
  approveProfileChanges: (id) =>
    request(`/admin/enrollments/${id}/approve-changes`, { method: "POST" }),
  rejectProfileChanges: (id, reason) =>
    request(`/admin/enrollments/${id}/reject-changes`, {
      method: "POST",
      body: JSON.stringify({ status: "rejected", reason }),
    }),
  getWallpaper: () => request("/wallpaper"),
  updateWallpaper: (body) =>
    request("/admin/wallpaper", { method: "PUT", body: JSON.stringify(body) }),
  uploadWallpaper: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return request("/admin/wallpaper/upload", { method: "POST", body: fd });
  },
  removeWallpaper: () => request("/admin/wallpaper", { method: "DELETE" }),
  getEmailSettings: () => request("/admin/email-settings"),
  updateEmailSettings: (body) =>
    request("/admin/email-settings", { method: "PUT", body: JSON.stringify(body) }),
  testEmailSettings: () => request("/admin/email-settings/test", { method: "POST" }),
  getAdminAccount: () => request("/admin/account"),
  updateAdminAccount: (body) =>
    request("/admin/account", { method: "PATCH", body: JSON.stringify(body) }),
  getDeletionStatus: () => request("/account/deletion-status"),
  requestAccountDeletion: (message, confirm = true) =>
    request("/account/delete-request", {
      method: "POST",
      body: JSON.stringify({ message, confirm }),
    }),
  adminDeletionRequests: () => request("/admin/deletion-requests"),
  adminDeletedAccounts: (stage = "all") =>
    request(`/admin/deleted-accounts?stage=${encodeURIComponent(stage)}`),
  generateDeletedAccountReport: (id) =>
    request(`/admin/deleted-accounts/${id}/report`, { method: "POST" }),
  purgeDeletedAccount: (id) =>
    request(`/admin/deleted-accounts/${id}/purge`, { method: "POST" }),
  adminDeletionReports: () => request("/admin/deletion-reports"),
  downloadDeletionReport: async (reportId) => {
    const token = getStoredToken();
    const res = await fetch(`${API}/admin/deletion-reports/${reportId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      clearStoredSession();
      throw new Error("Could not download report");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `iam-deletion-report-${reportId}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  },
  approveDeletionRequest: (id) =>
    request(`/admin/deletion-requests/${id}/approve`, { method: "POST" }),
  rejectDeletionRequest: (id, reason) =>
    request(`/admin/deletion-requests/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  adminRestoreRequests: () => request("/admin/account-restore-requests"),
  approveRestoreRequest: (id) =>
    request(`/admin/account-restore-requests/${id}/approve`, { method: "POST" }),
  rejectRestoreRequest: (id) =>
    request(`/admin/account-restore-requests/${id}/reject`, { method: "POST" }),
  restoreDeletedAccount: (id) =>
    request(`/admin/deleted-accounts/${id}/restore`, { method: "POST" }),
  adminMemberActivity: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.date) qs.set("date", params.date);
    if (params.user_id) qs.set("user_id", params.user_id);
    const query = qs.toString();
    return request(`/admin/member-activity${query ? `?${query}` : ""}`);
  },
  addMemberActivityNote: (userId, detail) =>
    request("/admin/member-activity", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, detail }),
    }),
  adminSecurityAudit: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.date) qs.set("date", params.date);
    const query = qs.toString();
    return request(`/admin/security/audit${query ? `?${query}` : ""}`);
  },
  missionFeed: () => request("/mission/feed"),
  missionComments: (postId) => request(`/mission/posts/${postId}/comments`),
  missionLike: (postId) => request(`/mission/posts/${postId}/like`, { method: "POST" }),
  missionComment: (postId, body, parentId = null) =>
    request(`/mission/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body, ...(parentId ? { parent_id: parentId } : {}) }),
    }),
  missionUpdateComment: (postId, commentId, body) =>
    request(`/mission/posts/${postId}/comments/${commentId}`, {
      method: "PATCH",
      body: JSON.stringify({ body }),
    }),
  missionDeleteComment: (postId, commentId) =>
    request(`/mission/posts/${postId}/comments/${commentId}`, { method: "DELETE" }),
  missionShare: (postId) => request(`/mission/posts/${postId}/share`, { method: "POST" }),
  adminMissionPosts: (status = "published") =>
    request(`/admin/mission-posts?status=${encodeURIComponent(status)}`),
  adminMissionEngagement: (postId) => request(`/admin/mission-posts/${postId}/engagement`),
  publishMissionPost: (heading, body, file) => {
    const fd = new FormData();
    fd.append("heading", heading);
    fd.append("body", body);
    if (file) fd.append("file", file, file.name || "upload.png");
    return request("/admin/mission/publish", { method: "POST", body: fd });
  },
  updateMissionPostPublish: (id, heading, body, file, removeMedia = false) => {
    const fd = new FormData();
    fd.append("heading", heading);
    fd.append("body", body);
    if (file) fd.append("file", file, file.name || "upload.png");
    if (removeMedia) fd.append("remove_media", "true");
    return request(`/admin/mission/${id}/update`, { method: "POST", body: fd });
  },
  createMissionPost: (body) =>
    request("/admin/mission-posts", { method: "POST", body: JSON.stringify(body) }),
  updateMissionPost: (id, body) =>
    request(`/admin/mission-posts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  archiveMissionPost: (id) => request(`/admin/mission-posts/${id}/archive`, { method: "POST" }),
  restoreMissionPost: (id) => request(`/admin/mission-posts/${id}/restore`, { method: "POST" }),
  deleteMissionPost: (id) => request(`/admin/mission-posts/${id}`, { method: "DELETE" }),
  uploadMissionMedia: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return request("/admin/mission/upload", { method: "POST", body: fd });
  },
};
