export const SUPPORT_MISSION_TITLE = "Support Our Mission";

export const HELP_TYPE_OPTIONS = [
  {
    value: "financial",
    label: "Financial Support",
    description: "Money or financial help. Member can enter an amount.",
  },
  {
    value: "volunteering",
    label: "Volunteering & Service",
    description: "Offering time and hands-on service.",
  },
  {
    value: "prayer",
    label: "Prayer Support",
    description: "Prayer commitment for the mission.",
  },
  {
    value: "resources",
    label: "Resources & Equipment",
    description: "Materials, equipment, or supplies.",
  },
  {
    value: "ministry",
    label: "Ministry Support",
    description: "Support for ministry work.",
  },
  {
    value: "other",
    label: "Other Help",
    description: "Any other way to help — described in the message.",
  },
];

export const HELP_TYPES = Object.fromEntries(
  HELP_TYPE_OPTIONS.map(({ value, label }) => [value, label])
);

export function helpTypeLabel(value) {
  return HELP_TYPES[value] || value || "—";
}

export function helpTypeDescription(value) {
  return HELP_TYPE_OPTIONS.find((t) => t.value === value)?.description || "";
}
