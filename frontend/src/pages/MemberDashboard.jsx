import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, LogOut, Pencil, Send, ChevronDown } from "lucide-react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import BrandLogo from "../components/BrandLogo";
import AdminPostsSection from "../components/AdminPostsSection";
import EnrollmentDetails from "../components/EnrollmentDetails";
import { PortalField, PortalHeadlineStrip, PortalSectionHeadline } from "../components/PortalHeadlines";
import MemberSupportSection from "../components/MemberSupportSection";
import { calcCompletion } from "../lib/enrollmentSteps";

export default function MemberDashboard() {
  const { user, logout } = useAuth();
  const [card, setCard] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [error, setError] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [openSection, setOpenSection] = useState(null);
  const [deletionStatus, setDeletionStatus] = useState({ status: "none" });
  const [deleteMessage, setDeleteMessage] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = () => {
    api.getCard().then(setCard).catch(() => setError("Membership card not yet issued"));
    api.getEnrollment().then(setEnrollment).catch(() => {});
    if (user && user.role !== "admin") {
      api.getDeletionStatus().then(setDeletionStatus).catch(() => {});
    }
  };

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  useEffect(() => {
    if (user?.status === "deletion_hold" || deletionStatus.status === "deletion_hold") {
      logout();
    }
  }, [user?.status, deletionStatus.status, logout]);

  const expiresAt = card?.expires_at ? new Date(card.expires_at).toLocaleDateString() : null;
  const enrollmentData = enrollment?.data || null;
  const completion = enrollmentData ? calcCompletion(enrollmentData) : 0;
  const editUnlocked = Boolean(enrollment?.edit_unlocked);
  const editRequestPending = enrollment?.edit_request_status === "pending";
  const changesPending = enrollment?.changes_review_status === "pending_review";
  const editRejected = enrollment?.edit_request_status === "rejected";
  const changesRejected = enrollment?.changes_review_status === "rejected";
  const canDeleteAccount = Boolean(user && user.role !== "admin");
  const deletionPending = deletionStatus.status === "pending";
  const deletionOnHold = deletionStatus.status === "deletion_hold";

  const handleRequestDelete = async () => {
    const reason = deleteMessage.trim();
    if (!reason) {
      setDeleteMsg("Please tell us why you want to delete your account.");
      return;
    }
    if (!deleteConfirm) {
      setDeleteMsg("Please confirm you want to delete your account.");
      return;
    }
    setDeleteLoading(true);
    setDeleteMsg("");
    try {
      await api.requestAccountDeletion(reason, true);
      await logout();
    } catch (err) {
      setDeleteMsg(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const portalSections = [
    { id: "account", title: "Account" },
    { id: "mission", title: "Mission" },
    { id: "membership", title: "Membership" },
    { id: "identity", title: "Identity" },
    { id: "support", title: "Support Our Mission", eyebrow: "International Apostolic Mission" },
  ];

  const selectSection = (id) => {
    setOpenSection((prev) => (prev === id ? null : id));
    if (id !== "account") {
      setDeleteOpen(false);
    }
  };

  const handleRequestEdit = async () => {
    setLoading(true);
    setActionMsg("");
    try {
      const updated = await api.requestEnrollmentEdit(editMessage);
      setEnrollment(updated);
      setEditMessage("");
      setActionMsg("Edit request sent to admin. You will be notified when approved.");
    } catch (err) {
      setActionMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen">
      <header className="flex items-center justify-between border-b border-white/5 bg-iam-bg/70 px-6 py-4 backdrop-blur-md">
        <BrandLogo to="/dashboard" subtitle="Member Portal" />
        <button type="button" onClick={() => logout()} className="btn-ghost py-2 text-xs">
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="font-playfair text-4xl text-white md:text-5xl">Welcome, {user?.name}</h1>
        </motion.div>

        <PortalHeadlineStrip
          items={portalSections}
          activeId={openSection}
          onSelect={selectSection}
          compact
        />

        {openSection && (
        <motion.div
          key={openSection}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="glass-panel mb-10 p-6 md:p-8"
        >
          {openSection === "account" && (
            <>
              <div className="grid gap-x-10 sm:grid-cols-2">
                <PortalField label="Full Name" value={user?.name} />
                <PortalField label="Email" value={user?.email} />
                <PortalField label="Status" value={user?.status === "active" ? "Active" : user?.status} />
              </div>

              {canDeleteAccount && (
                <div id="account-deletion" className="mt-8 border-t border-white/10 pt-6">
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(!deleteOpen)}
                    aria-expanded={deleteOpen}
                    className="flex w-full items-center justify-between gap-4 rounded-lg border border-red-500/25 bg-red-500/5 px-4 py-4 text-left transition hover:bg-red-500/10"
                  >
                    <span className="font-cinzel text-sm uppercase tracking-[0.2em] text-red-300">Delete Account</span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-red-300/80 transition-transform duration-200 ${
                        deleteOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {deleteOpen && (
                    <div className="mt-4 space-y-4 rounded-lg border border-red-500/20 bg-red-500/5 p-5">
                      {deletionPending && (
                        <p className="font-inter text-sm text-iam-gold-light">
                          Your account deletion request is awaiting admin approval.
                        </p>
                      )}

                      {deletionOnHold && (
                        <p className="font-inter text-sm text-red-300">
                          Your account is scheduled for deletion. Contact the administrator to restore access.
                        </p>
                      )}

                      {deletionStatus.status === "rejected" && !deletionPending && (
                        <p className="font-inter text-sm text-iam-muted">
                          Your last deletion request was rejected
                          {deletionStatus.reason ? `: ${deletionStatus.reason}` : "."}
                        </p>
                      )}

                      {!deletionPending &&
                        !deletionOnHold &&
                        (deletionStatus.status === "none" || deletionStatus.status === "rejected") && (
                          <div className="space-y-4">
                            <div>
                              <label
                                htmlFor="delete-reason"
                                className="font-inter text-[10px] font-medium uppercase tracking-[0.22em] text-iam-muted"
                              >
                                Reason for deletion <span className="text-red-300">*</span>
                              </label>
                              <textarea
                                id="delete-reason"
                                className="input-iam mt-2 min-h-[100px] w-full"
                                placeholder="Please explain why you want to delete your account..."
                                value={deleteMessage}
                                onChange={(e) => setDeleteMessage(e.target.value)}
                                required
                              />
                            </div>
                            <label className="flex items-start gap-2 font-inter text-sm text-iam-muted">
                              <input
                                type="checkbox"
                                className="mt-1 accent-iam-gold"
                                checked={deleteConfirm}
                                onChange={(e) => setDeleteConfirm(e.target.checked)}
                              />
                              I understand this sends a deletion request to the administrator
                            </label>
                            <button
                              type="button"
                              className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-4 py-2 font-inter text-xs uppercase tracking-wider text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                              onClick={handleRequestDelete}
                              disabled={deleteLoading}
                            >
                              <Send className="h-4 w-4" /> Send Request to Admin
                            </button>
                          </div>
                        )}

                      {deleteMsg && <p className="font-inter text-sm text-iam-gold-light">{deleteMsg}</p>}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {openSection === "mission" && (
            <>
              <p className="font-cormorant text-xl text-white/90">
                Share International Apostolic Mission with someone ready to begin their journey.
              </p>
              <Link to="/enroll" className="btn-gold mt-8 inline-flex">
                Refer Someone <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}

          {openSection === "membership" && (
            <>
              {enrollmentData ? (
                <>
                  <div className="mb-6 flex items-center justify-end">
                    <span className="rounded-full border border-iam-gold/30 bg-iam-gold/10 px-3 py-1 font-cinzel text-xs text-iam-gold-light">
                      {completion}% complete
                    </span>
                  </div>
                  <EnrollmentDetails data={enrollmentData} enrollmentId={enrollment?.id} />
                </>
              ) : (
                <p className="font-inter text-sm text-iam-muted">
                  No enrollment on file yet. Complete all 9 steps to build your membership profile.
                </p>
              )}

              <div className="mt-8 border-t border-white/10 pt-8">
                {editUnlocked && (
                  <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6">
                    <p className="font-playfair text-xl text-emerald-100">Edit Access Approved</p>
                    <p className="mt-2 font-inter text-sm text-emerald-200/90">
                      Admin approved your edit request. You can update your profile now.
                    </p>
                    <Link to="/enrollment" className="btn-gold mt-4 inline-flex">
                      <Pencil className="h-4 w-4" /> Edit Profile
                    </Link>
                  </div>
                )}

                {editRequestPending && (
                  <p className="mb-6 rounded-xl border border-iam-gold/30 bg-iam-gold/10 p-6 font-inter text-sm text-iam-gold-light">
                    Your request to edit this profile is awaiting admin approval.
                  </p>
                )}

                {changesPending && (
                  <p className="mb-6 rounded-xl border border-iam-gold/30 bg-iam-gold/10 p-6 font-inter text-sm text-iam-gold-light">
                    Your updated profile has been submitted and is awaiting admin verification.
                  </p>
                )}

                {editRejected && (
                  <p className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-6 font-inter text-sm text-red-300">
                    Edit request denied{enrollment?.edit_reject_reason ? `: ${enrollment.edit_reject_reason}` : "."}
                  </p>
                )}

                {changesRejected && (
                  <p className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-6 font-inter text-sm text-red-300">
                    Profile changes not approved
                    {enrollment?.changes_reject_reason ? `: ${enrollment.changes_reject_reason}` : "."}
                  </p>
                )}

                {enrollmentData &&
                  enrollment?.status === "approved" &&
                  !editUnlocked &&
                  !editRequestPending &&
                  !changesPending && (
                    <div className="space-y-4">
                      <p className="font-cormorant text-xl text-white/90">
                        To change your approved profile, send a request to the administrator. After approval you can edit
                        and submit changes for verification.
                      </p>
                      <textarea
                        className="input-iam min-h-[100px] w-full"
                        placeholder="Optional message — what would you like to update?"
                        value={editMessage}
                        onChange={(e) => setEditMessage(e.target.value)}
                      />
                      <button type="button" className="btn-gold" onClick={handleRequestEdit} disabled={loading}>
                        <Send className="h-4 w-4" /> Request Edit from Admin
                      </button>
                    </div>
                  )}

                {!enrollmentData && (
                  <Link to="/enrollment" className="btn-gold mt-4 inline-flex">
                    Complete Enrollment
                  </Link>
                )}

                {actionMsg && <p className="mt-4 font-inter text-sm text-iam-gold-light">{actionMsg}</p>}
              </div>
            </>
          )}

          {openSection === "identity" && (
            <>
              {card ? (
                <div className="grid gap-x-10 sm:grid-cols-2">
                  <PortalField label="Member ID" value={card.member_id} />
                  <PortalField label="Valid Until" value={expiresAt} />
                </div>
              ) : (
                <p className="font-inter text-sm text-iam-muted">
                  {error || "Complete membership enrollment and await approval to receive your digital ID."}
                </p>
              )}
            </>
          )}

          {openSection === "support" && (
            <>
              <PortalSectionHeadline
                eyebrow="International Apostolic Mission"
                title="Support Our Mission"
                description="Choose a support type to see your submissions with full details, or submit a new offer."
                compact
              />
              <MemberSupportSection />
            </>
          )}
        </motion.div>
        )}

        <AdminPostsSection />
      </main>
    </div>
  );
}
