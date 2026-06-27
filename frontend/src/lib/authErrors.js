/** Must match backend/auth_errors.py AuthError codes. */
export const AuthError = {
  ACCOUNT_DELETED: "ACCOUNT_DELETED",
  DELETION_PENDING: "DELETION_PENDING",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  REJECTED: "REJECTED",
  SUSPENDED: "SUSPENDED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  LOGIN_LOCKED: "LOGIN_LOCKED",
};

const LOGIN_MESSAGES = {
  [AuthError.DELETION_PENDING]:
    "Sorry — this account is deleted. Your request is waiting for the administrator to confirm. You cannot sign in until then.",
  [AuthError.PENDING_APPROVAL]:
    "Sorry — your registration is still awaiting administrator approval. You cannot sign in yet. After you are approved, use the same email and password you chose when you enrolled.",
  [AuthError.REJECTED]:
    "Sorry — your registration was not approved by the administrator. Please contact IAM if you need help.",
  [AuthError.SUSPENDED]:
    "Sorry — this account has been suspended. Please contact the administrator.",
  [AuthError.INVALID_CREDENTIALS]:
    "Sorry — that email or password is incorrect. Please try again.",
  [AuthError.LOGIN_LOCKED]:
    "Sorry — too many failed sign-in attempts. Please wait 15 minutes and try again, or contact the administrator.",
};

export function isAccountDeletedError(code) {
  return code === AuthError.ACCOUNT_DELETED;
}

export function resolveLoginError(code = "") {
  if (isAccountDeletedError(code)) return null;
  if (LOGIN_MESSAGES[code]) return LOGIN_MESSAGES[code];
  const lower = String(code).toLowerCase();
  if (lower.includes("invalid email or password")) return LOGIN_MESSAGES[AuthError.INVALID_CREDENTIALS];
  if (lower.includes("too many failed login attempts")) return LOGIN_MESSAGES[AuthError.LOGIN_LOCKED];
  return code ? `Sorry — ${code}` : "Sorry — sign in failed. Please try again.";
}
