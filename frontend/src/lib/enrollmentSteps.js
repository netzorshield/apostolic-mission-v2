export const ENROLLMENT_STEPS = [
  { id: 1, key: "personal", title: "Personal Profile" },
  { id: 2, key: "address", title: "Address" },
  { id: 3, key: "identity", title: "Identity" },
  { id: 4, key: "church", title: "Church" },
  { id: 5, key: "spiritual", title: "Spiritual Background" },
  { id: 6, key: "mission", title: "Mission Interest" },
  { id: 7, key: "emergency", title: "Emergency Contact" },
  { id: 8, key: "documents", title: "Documents" },
  { id: 9, key: "agreement", title: "Agreement" },
];

export const MINISTRY_AREAS = [
  "Evangelism",
  "Discipleship",
  "Worship",
  "Prayer",
  "Youth",
  "Children",
  "Media",
  "Administration",
  "Missions",
  "Other",
];

export const ENROLLMENT_DOCUMENTS = [
  { key: "profile_photo", label: "Profile photo", required: true, accept: "image/jpeg,image/png,image/webp,image/gif,.heic,.heif" },
  { key: "government_id", label: "Government ID", required: true, accept: "image/jpeg,image/png,image/webp,image/gif,.pdf,.heic,.heif" },
  { key: "address_proof", label: "Address proof", required: true, accept: "image/jpeg,image/png,image/webp,image/gif,.pdf,.heic,.heif" },
  {
    key: "church_recommendation",
    label: "Church recommendation (optional)",
    required: false,
    accept: "image/jpeg,image/png,image/webp,image/gif,.pdf,.heic,.heif",
  },
];

export const emptyEnrollmentData = () => ({
  personal: {
    first_name: "",
    middle_name: "",
    last_name: "",
    preferred_name: "",
    gender: "",
    date_of_birth: "",
    nationality: "",
    marital_status: "",
    occupation: "",
    organization: "",
    languages: "",
  },
  address: {
    country: "",
    phone: "",
    state: "",
    district: "",
    city: "",
    street: "",
    postal_code: "",
  },
  identity: { id_type: "", id_number: "", country: "" },
  church: {
    church_name: "",
    registration_number: "",
    pastor_name: "",
    pastor_phone: "",
    role: "",
    years_in_church: "",
  },
  spiritual: { salvation_date: "", baptism_status: "", baptism_date: "", ministry_areas: [] },
  mission: { why_join: "", how_heard: "", skills: "", availability: "" },
  emergency: { name: "", relationship: "", mobile: "", email: "", address: "" },
  documents: {
    profile_photo: "",
    government_id: "",
    address_proof: "",
    church_recommendation: "",
  },
  agreement: { accuracy: false, privacy: false, guidelines: false, signature: "" },
});

export function enrollmentCountry(data) {
  return ((data.personal?.nationality || data.address?.country || "") + "").trim();
}

/** Keep address.country and identity.country aligned with Step 1 (and Step 2). */
export function syncEnrollmentLinkedFields(data) {
  const fromStep1 = (data.personal?.nationality || "").trim();
  const resolvedCountry = fromStep1 || (data.address?.country || "").trim();

  let next = data;
  let changed = false;

  if (fromStep1 && data.address?.country !== fromStep1) {
    next = { ...next, address: { ...next.address, country: fromStep1 } };
    changed = true;
  }

  const countryForIdentity = (next.address?.country || fromStep1 || "").trim();
  if (countryForIdentity && next.identity?.country !== countryForIdentity) {
    next = { ...next, identity: { ...next.identity, country: countryForIdentity } };
    changed = true;
  }

  if (!resolvedCountry) {
    if (next.identity?.country) {
      next = { ...next, identity: { ...next.identity, country: "" } };
      changed = true;
    }
    if (!fromStep1 && next.address?.country) {
      next = { ...next, address: { ...next.address, country: "" } };
      changed = true;
    }
  }

  return changed ? next : data;
}

/** @deprecated Use syncEnrollmentLinkedFields */
export function syncAddressCountryFromPersonal(data) {
  return syncEnrollmentLinkedFields(data);
}

export function applyApplicationPrefill(data, application) {
  if (!application) return data;
  const next = {
    ...data,
    personal: {
      ...data.personal,
      first_name: application.first_name || data.personal.first_name,
      last_name: application.last_name || data.personal.last_name,
      nationality: application.country || data.personal.nationality,
    },
    address: {
      ...data.address,
      country: application.country || data.address.country,
      phone: application.mobile || data.address.phone,
    },
    mission: {
      ...data.mission,
      why_join: application.purpose || data.mission.why_join,
    },
  };
  return syncEnrollmentLinkedFields(next);
}

export function readApplicationPrefill() {
  try {
    const raw = sessionStorage.getItem("iam_apply_prefill");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function calcCompletion(data) {
  let total = 0;
  let filled = 0;

  ["personal", "address", "identity", "church", "spiritual", "mission", "emergency", "documents"].forEach((key) => {
    const section = data[key] || {};
    Object.entries(section).forEach(([field, value]) => {
      if (field === "ministry_areas") {
        total += 1;
        if (Array.isArray(value) && value.length > 0) filled += 1;
        return;
      }
      total += 1;
      if (value !== "" && value !== null && value !== undefined) filled += 1;
    });
  });

  const agreement = data.agreement || {};
  ["accuracy", "privacy", "guidelines", "signature"].forEach((key) => {
    total += 1;
    if (key === "signature" ? agreement[key] : agreement[key]) filled += 1;
  });

  return total ? Math.round((filled / total) * 100) : 0;
}
