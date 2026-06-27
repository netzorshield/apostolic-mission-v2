import { ENROLLMENT_STEPS, ENROLLMENT_DOCUMENTS } from "../lib/enrollmentSteps";
import { api } from "../lib/api";
import { PortalField, PortalStepAccordion } from "./PortalHeadlines";

function formatValue(val) {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) return val.length ? val.join(", ") : null;
  return String(val);
}

function DocumentFields({ documents, enrollmentId }) {
  const uploaded = ENROLLMENT_DOCUMENTS.filter((doc) => documents[doc.key]);
  if (!uploaded.length) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {uploaded.map((doc) => (
        <div key={doc.key} className="rounded-lg border border-white/10 bg-black/20 p-3">
          <p className="font-inter text-[10px] uppercase tracking-widest text-iam-muted">{doc.label}</p>
          <button
            type="button"
            className="mt-2 font-inter text-sm text-iam-gold-light hover:underline"
            onClick={() => api.openEnrollmentDocument(doc.key, enrollmentId)}
          >
            View document
          </button>
        </div>
      ))}
    </div>
  );
}

export default function EnrollmentDetails({ data, enrollmentId, className = "" }) {
  if (!data) return null;

  return (
    <div className={className}>
      {ENROLLMENT_STEPS.map((step) => {
        const section = data[step.key];
        if (!section || typeof section !== "object") return null;

        if (step.key === "documents") {
          const hasDocs = ENROLLMENT_DOCUMENTS.some((doc) => section[doc.key]);
          if (!hasDocs) return null;
          return (
            <PortalStepAccordion
              key={step.key}
              stepId={step.key}
              title={`Step ${step.id} — ${step.title}`}
            >
              <DocumentFields documents={section} enrollmentId={enrollmentId} />
            </PortalStepAccordion>
          );
        }

        const entries = Object.entries(section).filter(([, val]) => formatValue(val) !== null);
        if (!entries.length) return null;
        return (
          <PortalStepAccordion
            key={step.key}
            stepId={step.key}
            title={`Step ${step.id} — ${step.title}`}
          >
            <div className="grid gap-x-8 sm:grid-cols-2">
              {entries.map(([key, val]) => (
                <PortalField key={key} label={key.replace(/_/g, " ")} value={formatValue(val)} />
              ))}
            </div>
          </PortalStepAccordion>
        );
      })}
    </div>
  );
}
