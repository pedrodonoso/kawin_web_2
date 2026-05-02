export const WorkshopType = {
  CLASS:    "class",
  WORKSHOP: "workshop",
  COURSE:   "course",
  EVENT:    "event",
} as const;

export const WorkshopStatus = {
  DRAFT:     "draft",
  PUBLISHED: "published",
  ARCHIVED:  "archived",
} as const;

export const ApprovalStatus = {
  NOT_SUBMITTED:      "not_submitted",
  PENDING_REVIEW:     "pending_review",
  APPROVED:           "approved",
  CHANGES_REQUESTED:  "changes_requested",
} as const;

export const BookingStatus = {
  PENDING:   "pending",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
} as const;

export const PaymentStatus = {
  PENDING:  "pending",
  PAID:     "paid",
  REFUNDED: "refunded",
} as const;

export const UserRole = {
  STUDENT:    "student",
  INSTRUCTOR: "instructor",
  BOTH:       "both",
  ADMIN:      "admin",
} as const;

export const Modality = {
  IN_PERSON: "in-person",
  ONLINE:    "online",
  HYBRID:    "hybrid",
} as const;

export const DiscountType = {
  PERCENT: "percent",
  FLAT:    "flat",
} as const;

export const CommissionZone = {
  PLATFORM:   "platform",
  INSTRUCTOR: "instructor",
} as const;

export const SlotStatus = {
  AVAILABLE:        "available",
  FULL:             "full",
  CANCELLED:        "cancelled",
  NOT_MATERIALIZED: "not_materialized",
} as const;

export const WorkshopTypeLabel: Record<string, string> = {
  [WorkshopType.WORKSHOP]: "Taller",
  [WorkshopType.COURSE]:   "Curso",
  [WorkshopType.CLASS]:    "Clase",
  [WorkshopType.EVENT]:    "Evento",
};

export const ModalityLabel: Record<string, string> = {
  [Modality.IN_PERSON]: "Presencial",
  [Modality.ONLINE]:    "Online",
  [Modality.HYBRID]:    "Híbrido",
};

export const WorkshopStatusLabel: Record<string, string> = {
  [WorkshopStatus.PUBLISHED]: "Publicado",
  [WorkshopStatus.DRAFT]:     "Borrador",
  [WorkshopStatus.ARCHIVED]:  "Archivado",
};

export const COMMISSION_RATE = 0.15;
