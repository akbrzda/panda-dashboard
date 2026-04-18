export const READINESS_STATUS_LABELS = {
  ready: "Ready",
  beta: "Beta",
  partial: "Partial",
  planned: "Planned",
};

export const READINESS_STATUS_BADGE_VARIANTS = {
  ready: "success",
  beta: "warning",
  partial: "outline",
  planned: "secondary",
};

export function getReadinessStatusLabel(status) {
  return READINESS_STATUS_LABELS[status] || READINESS_STATUS_LABELS.planned;
}

export function getReadinessStatusBadgeVariant(status) {
  return READINESS_STATUS_BADGE_VARIANTS[status] || READINESS_STATUS_BADGE_VARIANTS.planned;
}
