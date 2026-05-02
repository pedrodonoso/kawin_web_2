<?php

namespace App\Constants;

class WorkshopType
{
    const CLASS_TYPE = 'class';
    const WORKSHOP   = 'workshop';
    const COURSE     = 'course';
    const EVENT      = 'event';
}

class WorkshopStatus
{
    const DRAFT     = 'draft';
    const PUBLISHED = 'published';
    const ARCHIVED  = 'archived';
}

class ApprovalStatus
{
    const NOT_SUBMITTED      = 'not_submitted';
    const PENDING_REVIEW     = 'pending_review';
    const APPROVED           = 'approved';
    const CHANGES_REQUESTED  = 'changes_requested';
}

class BookingStatus
{
    const PENDING   = 'pending';
    const CONFIRMED = 'confirmed';
    const CANCELLED = 'cancelled';
}

class PaymentStatus
{
    const PENDING  = 'pending';
    const PAID     = 'paid';
    const REFUNDED = 'refunded';
}

class UserRole
{
    const STUDENT    = 'student';
    const INSTRUCTOR = 'instructor';
    const BOTH       = 'both';
    const ADMIN      = 'admin';
}

class Modality
{
    const IN_PERSON = 'in-person';
    const ONLINE    = 'online';
    const HYBRID    = 'hybrid';
}

class DiscountType
{
    const PERCENT = 'percent';
    const FLAT    = 'flat';
}

class CommissionZone
{
    const PLATFORM   = 'platform';
    const INSTRUCTOR = 'instructor';
}

class CancelReason
{
    const STUDENT_REQUEST  = 'student_request';
    const SCHEDULE_CHANGE  = 'schedule_change';
    const INSTRUCTOR_CANCEL = 'instructor_cancel';
}

class AdminAction
{
    const APPROVE           = 'approve';
    const SEND_OBSERVATIONS = 'send_observations';
}

class Billing
{
    const COMMISSION_RATE = 0.15;
}
