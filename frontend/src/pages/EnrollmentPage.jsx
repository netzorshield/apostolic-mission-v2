import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Save, Send, Upload, CheckCircle } from "lucide-react";
import BackLink from "../components/BackLink";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  ENROLLMENT_STEPS,
  ENROLLMENT_DOCUMENTS,
  MINISTRY_AREAS,
  emptyEnrollmentData,
  applyApplicationPrefill,
  readApplicationPrefill,
  calcCompletion,
  syncEnrollmentLinkedFields,
} from "../lib/enrollmentSteps";

const riseToCenter = (delay = 0) => ({
  initial: { opacity: 0, y: 36 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] },
});

function Field({ label, children, className = "" }) {
  return (
    <div className={`mb-4 ${className}`}>
      <label className="label-iam">{label}</label>
      {children}
    </div>
  );
}

function SectionFields({ section, fields, data, setData, types = {}, labels = {}, readOnly = {} }) {
  const update = (key, val) => {
    let next = { ...data, [section]: { ...data[section], [key]: val } };
    if (section === "personal" && key === "nationality") {
      next = {
        ...next,
        address: { ...next.address, country: val },
        identity: { ...next.identity, country: val },
      };
    }
    setData(next);
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => {
        const isReadOnly = Boolean(readOnly[f]);
        const value = isReadOnly ? readOnly[f] : data[section][f];
        return (
        <Field key={f} label={labels[f] || f.replace(/_/g, " ")} className={types[f] === "textarea" ? "sm:col-span-2" : ""}>
          {types[f] === "textarea" ? (
            <textarea
              className="input-iam min-h-[100px]"
              value={value}
              onChange={(e) => update(f, e.target.value)}
              readOnly={isReadOnly}
              disabled={isReadOnly}
            />
          ) : (
            <input
              className={`input-iam ${isReadOnly ? "cursor-not-allowed bg-white/5 text-white/80" : ""}`}
              type={types[f] || (f.includes("date") ? "date" : "text")}
              value={value}
              onChange={(e) => update(f, e.target.value)}
              readOnly={isReadOnly}
              disabled={isReadOnly}
            />
          )}
          {f === "country" && section === "address" && (
            <p className="mt-1.5 font-inter text-xs text-iam-muted">
              {readOnly.country
                ? "Uses the same country from Step 1 — Personal Profile."
                : "Enter your country in Step 1 (Personal Profile) first."}
            </p>
          )}
          {f === "country" && section === "identity" && (
            <p className="mt-1.5 font-inter text-xs text-iam-muted">
              {readOnly.country
                ? "Uses the same country from Step 1 and Step 2."
                : "Complete Step 1 (Country) and Step 2 (Address) first."}
            </p>
          )}
        </Field>
      );
      })}
    </div>
  );
}

function DocumentUploadRow({ docKey, label, required, accept, filename, onUploaded, disabled }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [isPdf, setIsPdf] = useState(false);

  useEffect(() => {
    if (!filename) {
      setPreviewUrl("");
      setIsPdf(false);
      return undefined;
    }
    let objectUrl;
    api
      .fetchEnrollmentDocument(docKey)
      .then((blob) => {
        setIsPdf(blob.type === "application/pdf");
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        setPreviewUrl("");
        setIsPdf(false);
      });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [filename, docKey]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large (max 10MB).");
      e.target.value = "";
      return;
    }
    setUploading(true);
    setError("");
    try {
      const res = await api.uploadEnrollmentDocument(docKey, file);
      onUploaded(res.filename);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="label-iam mb-0">
          {label}
          {required ? " *" : ""}
        </p>
        {filename && (
          <span className="inline-flex items-center gap-1 font-inter text-xs text-emerald-400">
            <CheckCircle className="h-3.5 w-3.5" /> Uploaded
          </span>
        )}
      </div>
      {previewUrl && !isPdf && (
        <img src={previewUrl} alt="" className="mt-3 max-h-40 rounded-lg border border-white/10 object-contain" />
      )}
      {previewUrl && isPdf && (
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block font-inter text-xs text-iam-gold-light hover:underline"
        >
          View uploaded PDF
        </a>
      )}
      <label className={`btn-ghost mt-3 inline-flex cursor-pointer text-xs ${disabled ? "pointer-events-none opacity-50" : ""}`}>
        <Upload className="h-4 w-4" />
        {uploading ? "Uploading…" : filename ? "Replace file" : "Choose file"}
        <input
          type="file"
          className="hidden"
          accept={accept}
          onChange={handleFile}
          disabled={disabled || uploading}
        />
      </label>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}

function DocumentsStep({ data, setData, disabled, onAutoSave }) {
  const updateDoc = async (key, filename) => {
    const next = { ...data, documents: { ...data.documents, [key]: filename } };
    setData(next);
    if (onAutoSave) {
      try {
        await onAutoSave(next);
      } catch {
        /* draft sync optional */
      }
    }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {ENROLLMENT_DOCUMENTS.map((doc) => (
        <DocumentUploadRow
          key={doc.key}
          docKey={doc.key}
          label={doc.label}
          required={doc.required}
          accept={doc.accept}
          filename={data.documents[doc.key]}
          onUploaded={(filename) => updateDoc(doc.key, filename)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

function StepContent({ stepKey, data, setData, documentsDisabled }) {
  if (stepKey === "personal") {
    return (
      <SectionFields
        section="personal"
        data={data}
        setData={setData}
        fields={[
          "first_name",
          "middle_name",
          "last_name",
          "preferred_name",
          "gender",
          "date_of_birth",
          "nationality",
          "marital_status",
          "occupation",
          "organization",
          "languages",
        ]}
        labels={{ nationality: "Country" }}
      />
    );
  }

  if (stepKey === "address") {
    const countryFromStep1 = (data.personal?.nationality || "").trim();
    return (
      <>
        <p className="mb-4 font-inter text-sm text-iam-muted">
          Enter your phone number once here — it is used for your account, sign-in recovery, and admin records.
        </p>
        <SectionFields
          section="address"
          data={data}
          setData={setData}
          fields={["country", "phone", "state", "district", "city", "street", "postal_code"]}
          labels={{ phone: "Phone Number" }}
          types={{ phone: "tel" }}
          readOnly={{ country: countryFromStep1 }}
        />
      </>
    );
  }

  if (stepKey === "identity") {
    const countryFromEnrollment =
      (data.address?.country || data.personal?.nationality || "").trim();
    return (
      <SectionFields
        section="identity"
        data={data}
        setData={setData}
        fields={["id_type", "id_number", "country"]}
        readOnly={{ country: countryFromEnrollment }}
      />
    );
  }

  if (stepKey === "church") {
    return (
      <SectionFields
        section="church"
        data={data}
        setData={setData}
        fields={[
          "church_name",
          "registration_number",
          "pastor_name",
          "pastor_phone",
          "role",
          "years_in_church",
        ]}
      />
    );
  }

  if (stepKey === "spiritual") {
    const toggleArea = (area) => {
      const current = data.spiritual.ministry_areas || [];
      const next = current.includes(area)
        ? current.filter((a) => a !== area)
        : [...current, area];
      setData({ ...data, spiritual: { ...data.spiritual, ministry_areas: next } });
    };

    return (
      <>
        <SectionFields
          section="spiritual"
          data={data}
          setData={setData}
          fields={["salvation_date", "baptism_status", "baptism_date"]}
        />
        <div className="mt-4">
          <p className="label-iam mb-3">Ministry areas of interest</p>
          <div className="flex flex-wrap gap-2">
            {MINISTRY_AREAS.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => toggleArea(area)}
                className={`rounded-full px-3 py-1.5 font-inter text-xs transition ${
                  (data.spiritual.ministry_areas || []).includes(area)
                    ? "bg-iam-gold/25 text-iam-gold-light"
                    : "bg-white/5 text-iam-muted hover:text-white"
                }`}
              >
                {area}
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (stepKey === "mission") {
    return (
      <SectionFields
        section="mission"
        data={data}
        setData={setData}
        fields={["why_join", "how_heard", "skills", "availability"]}
        types={{ why_join: "textarea", skills: "textarea" }}
      />
    );
  }

  if (stepKey === "emergency") {
    return (
      <>
        <p className="mb-4 font-inter text-sm text-iam-muted">
          Your phone number was collected in Step 2 (Address). Add someone we can contact in an emergency below.
        </p>
        <SectionFields
          section="emergency"
          data={data}
          setData={setData}
          fields={["name", "relationship", "email", "address"]}
          types={{ address: "textarea" }}
        />
      </>
    );
  }

  if (stepKey === "documents") {
    return (
      <>
        <p className="mb-4 font-inter text-sm text-iam-muted">
          Upload your profile photo, government ID, and address proof. Files are private and only visible to you and IAM
          administrators. JPG, PNG, WEBP, GIF, or PDF (max 10MB each).
        </p>
        <DocumentsStep
          data={data}
          setData={setData}
          disabled={documentsDisabled}
          onAutoSave={(next) => api.saveEnrollment(syncEnrollmentLinkedFields(next))}
        />
      </>
    );
  }

  if (stepKey === "agreement") {
    const updateAgreement = (key, val) =>
      setData({ ...data, agreement: { ...data.agreement, [key]: val } });

    return (
      <div className="space-y-4">
        {[
          { key: "accuracy", text: "I confirm that all information provided is accurate and complete." },
          { key: "privacy", text: "I agree to the privacy policy and data handling practices of IAM." },
          { key: "guidelines", text: "I agree to uphold the mission guidelines and code of conduct." },
        ].map(({ key, text }) => (
          <label key={key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 p-4">
            <input
              type="checkbox"
              className="mt-1 accent-iam-gold"
              checked={!!data.agreement[key]}
              onChange={(e) => updateAgreement(key, e.target.checked)}
            />
            <span className="font-inter text-sm text-white/90">{text}</span>
          </label>
        ))}
        <Field label="Digital signature (type your full name)">
          <input
            className="input-iam"
            value={data.agreement.signature}
            onChange={(e) => updateAgreement("signature", e.target.value)}
            placeholder="Your full legal name"
          />
        </Field>
      </div>
    );
  }

  return null;
}

export default function EnrollmentPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [step, setStep] = useState(0);
  const [data, setData] = useState(emptyEnrollmentData());
  const [status, setStatus] = useState("");
  const [editUnlocked, setEditUnlocked] = useState(false);
  const [changesReviewStatus, setChangesReviewStatus] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getEnrollment()
      .then((res) => {
        const base = res?.pending_changes || res?.data || {};
        let merged = syncEnrollmentLinkedFields({ ...emptyEnrollmentData(), ...base });
        merged = applyApplicationPrefill(merged, readApplicationPrefill());
        merged = syncEnrollmentLinkedFields(merged);
        setData(merged);
        if (res?.status) setStatus(res.status);
        setEditUnlocked(Boolean(res?.edit_unlocked));
        setChangesReviewStatus(res?.changes_review_status || "");
      })
      .catch(() => {
        setData(syncEnrollmentLinkedFields(applyApplicationPrefill(emptyEnrollmentData(), readApplicationPrefill())));
      });
  }, []);

  useEffect(() => {
    setData((current) => syncEnrollmentLinkedFields(current));
  }, [data.personal.nationality, data.address?.country]);

  const persistData = (payload) => syncEnrollmentLinkedFields(payload);

  const current = ENROLLMENT_STEPS[step];
  const completion = calcCompletion(data);
  const isLast = step === ENROLLMENT_STEPS.length - 1;

  const save = async (silent = false) => {
    if (!silent) setMsg("Saving…");
    setSaving(true);
    try {
      await api.saveEnrollment(persistData(data));
      if (!silent) {
        setMsg("Draft saved");
        setTimeout(() => setMsg(""), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  const goNext = async () => {
    await save(true);
    setStep((s) => Math.min(s + 1, ENROLLMENT_STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goPrev = () => {
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    const { agreement } = data;
    if (!agreement.accuracy || !agreement.privacy || !agreement.guidelines || !agreement.signature?.trim()) {
      setMsg("Please complete all agreements and sign before submitting.");
      return;
    }
    setSaving(true);
    try {
      await api.saveEnrollment(persistData(data));
      if (status === "approved" && editUnlocked) {
        await api.submitEnrollmentChanges(persistData(data));
        setEditUnlocked(false);
        setChangesReviewStatus("pending_review");
        navigate("/dashboard");
        return;
      }
      await api.submitEnrollment(persistData(data));
      sessionStorage.removeItem("iam_apply_prefill");
      setStatus("pending_review");
      setMsg("Enrollment submitted for review");
    } finally {
      setSaving(false);
    }
  };

  if (status === "approved" && !editUnlocked) {
    if (changesReviewStatus === "pending_review") {
      return (
        <div className="relative min-h-screen px-6 py-16 text-center">
          <h1 className="font-cinzel text-3xl text-iam-gold-light">Changes Awaiting Verification</h1>
          <p className="mt-4 max-w-lg mx-auto text-iam-muted">
            Your updated profile has been submitted. An administrator will review and approve your changes.
          </p>
          <button className="btn-gold mt-8" type="button" onClick={() => navigate("/dashboard")}>
            Back to Member Portal
          </button>
        </div>
      );
    }
    return <Navigate to="/dashboard" replace />;
  }

  if (status === "pending_review") {
    const portalReady = user?.status === "active" && user?.enrollment_complete;
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
        <motion.h1
          className="font-cinzel text-3xl text-iam-gold-light"
          {...riseToCenter(0)}
        >
          {portalReady ? "You Are a User & Member" : "Awaiting Admin Approval"}
        </motion.h1>
        <motion.p className="mt-4 max-w-lg text-iam-muted" {...riseToCenter(0.12)}>
          {portalReady
            ? "Your membership is active. You can sign in and use the IAM Member Portal."
            : "Your enrollment has been submitted. This account cannot sign in until an administrator approves your registration. If you have another IAM account, you may sign in with that email instead."}
        </motion.p>
        {portalReady ? (
          <motion.div {...riseToCenter(0.24)}>
            <button className="btn-gold mt-8" type="button" onClick={() => navigate("/dashboard")}>
              Go to Member Portal
            </button>
          </motion.div>
        ) : (
          <motion.div className="mt-8 flex flex-col items-center gap-4" {...riseToCenter(0.24)}>
            <button
              type="button"
              className="font-inter text-base text-white/60 transition hover:text-iam-gold-light"
              onClick={() => logout()}
            >
              Sign in
            </button>
            <BackLink to="/" label="Back to home" showIcon={false} className="text-base" />
          </motion.div>
        )}
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <header className="border-b border-white/5 bg-iam-surface/50 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-inter text-[10px] uppercase tracking-widest text-iam-gold">
              {status === "approved" && editUnlocked ? "Profile Edit — Admin Approved" : "Membership Enrollment"}
            </p>
            <h1 className="font-playfair text-xl text-white">Step {current.id}: {current.title}</h1>
          </div>
          <span className="font-inter text-sm text-iam-muted">{completion}% complete</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <nav className="space-y-1">
            {ENROLLMENT_STEPS.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setStep(i)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left font-inter text-sm transition ${
                  i === step
                    ? "bg-iam-gold/20 text-iam-gold-light"
                    : i < step
                      ? "text-white/70 hover:bg-white/5"
                      : "text-iam-muted hover:bg-white/5"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    i <= step ? "bg-iam-gold/25 text-iam-gold-light" : "bg-white/10 text-iam-muted"
                  }`}
                >
                  {s.id}
                </span>
                {s.title}
              </button>
            ))}
          </nav>
        </aside>

        <main>
          {user?.status === "pending_approval" && (
            <div className="mb-6 rounded-lg border border-iam-gold/30 bg-iam-gold/10 p-4">
              <p className="font-inter text-sm text-iam-gold-light">
                Your registration is awaiting admin approval. Complete all enrollment steps below.
                You cannot access the <strong>IAM Member Portal</strong> or sign in again until an administrator approves you.
                After approval, sign in with the <strong>same email and password</strong> you created when you enrolled.
              </p>
            </div>
          )}

          <div className="mb-4 flex gap-1 lg:hidden">
            {ENROLLMENT_STEPS.map((s, i) => (
              <div
                key={s.key}
                className={`h-1 flex-1 rounded-full ${i <= step ? "bg-iam-gold" : "bg-white/10"}`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={current.key}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="glass-panel p-8"
            >
              <h2 className="mb-2 font-playfair text-2xl text-white">
                Step {current.id}: {current.title}
              </h2>
              <p className="mb-6 font-inter text-sm text-iam-muted">
                {step + 1} of {ENROLLMENT_STEPS.length}
              </p>
              <StepContent
                stepKey={current.key}
                data={data}
                setData={setData}
                documentsDisabled={saving}
              />
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button type="button" className="btn-ghost" onClick={goPrev} disabled={step === 0}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>

            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn-ghost" onClick={() => save()} disabled={saving}>
                <Save className="h-4 w-4" /> Save Draft
              </button>
              {isLast ? (
                <button type="button" className="btn-gold" onClick={submit} disabled={saving}>
                  <Send className="h-4 w-4" />{" "}
                  {status === "approved" && editUnlocked ? "Submit Changes for Approval" : "Submit Enrollment"}
                </button>
              ) : (
                <button type="button" className="btn-gold" onClick={goNext} disabled={saving}>
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          {msg && <p className="mt-4 text-center text-sm text-iam-gold">{msg}</p>}
        </main>
      </div>
    </div>
  );
}
