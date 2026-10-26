// Types mirroring the Supabase/PostgreSQL schema.
// Keep in sync with supabase/migrations/0001_init.sql

export type ReportType = 'LOST' | 'FOUND';
export type ItemStatus = 'ACTIVE' | 'RESOLVED' | 'CANCELLED';
export type ProfileBanner = 'AURORA' | 'CIRCUIT' | 'NIGHT_SKY' | 'CRYSTAL' | 'EMBER';
export type ReFoundPlusBadgeStyle = 'CLASSIC' | 'PRISM' | 'EMBER' | 'OCEAN' | 'EMERALD';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null; // private profile-photos storage path, signed by the client when displayed
  campus_email: string | null;
  proximity_assist_enabled: boolean;
  proximity_radius_meters: number;
  push_notifications_enabled: boolean;
  email_notifications_enabled: boolean;
  notification_preferences: {
    matches: boolean;
    verification: boolean;
    messages: boolean;
    recovery: boolean;
    savedSearches: boolean;
    proximity: boolean;
  };
  profile_accent: 'DEFAULT' | 'TEAL' | 'GREEN' | 'LIME' | 'CYAN' | 'BLUE' | 'INDIGO' | 'VIOLET' | 'PURPLE' | 'PINK' | 'ROSE' | 'RED' | 'ORANGE' | 'AMBER' | 'YELLOW';
  profile_banner: ProfileBanner;
  supporter_badge_style: ReFoundPlusBadgeStyle;
  supporter_recognition_enabled: boolean;
  supporter_display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface RefoundPlusEntitlement {
  user_id: string;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'REVOKED';
  source: 'MANUAL' | 'PAYMENT' | 'TRIAL';
  starts_at: string | null;
  first_started_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  reporter_id: string;
  report_type: ReportType;
  title: string;
  description: string | null;
  category: string;
  color: string | null;
  item_datetime: string;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  status: ItemStatus;
  created_at: string;
  updated_at: string;
  last_confirmed_active_at: string;
  stale_reminded_at: string | null;
}

export interface ItemImage {
  id: string;
  item_id: string;
  storage_path: string;
  is_primary: boolean;
  created_at: string;
}

export interface CampusLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  location_type: string | null;
  created_at: string;
}

/** Hidden/private ownership-verification attributes. Never surfaced publicly. */
export interface ItemVerificationAttribute {
  id: string;
  item_id: string;
  attribute_key: string;
  attribute_value: string;
  created_at: string;
}

// Convenience composite type used by the UI
export interface ItemWithImages extends Item {
  item_images: ItemImage[];
}

/** Sensitive report details returned only by the audited admin RPC. */
export type AdminReportDetails = Pick<
  Item,
  | 'id'
  | 'report_type'
  | 'title'
  | 'description'
  | 'category'
  | 'color'
  | 'item_datetime'
  | 'location_name'
  | 'status'
  | 'created_at'
  | 'updated_at'
> & {
  item_images: ItemImage[];
  verification_attributes: ItemVerificationAttribute[];
};

// ============================================================================
// Sprint 2 — matching, verification, notifications
// ============================================================================

export type MatchStatus =
  | 'POTENTIAL_MATCH'
  | 'VERIFICATION_PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'RECOVERY_IN_PROGRESS'
  | 'HANDOFF_SCHEDULED'
  | 'RECOVERED';

export interface ItemMatch {
  id: string;
  lost_item_id: string;
  found_item_id: string;
  score: number;
  reasons: string[];
  distance_meters: number | null;
  time_difference_minutes: number | null;
  status: MatchStatus;
  handoff_scheduled_at: string | null;
  handoff_location: string | null;
  created_at: string;
  updated_at: string;
}

/** A match with both sides' public item data joined in for display. */
export interface ItemMatchWithItems extends ItemMatch {
  lost: ItemWithImages;
  found: ItemWithImages;
}

export type NotificationType =
  | 'MATCH_FOUND'
  | 'VERIFICATION_REQUESTED'
  | 'VERIFICATION_UPDATE'
  | 'MATCH_VERIFIED'
  | 'MATCH_REJECTED'
  | 'RECOVERY_UPDATE'
  | 'HANDOFF_SCHEDULED'
  | 'NEW_MESSAGE'
  | 'PROXIMITY_ALERT'
  | 'SAVED_SEARCH_MATCH'
  | 'REPORT_STALE_REMINDER'
  | 'REPORT_ARCHIVED_STALE';

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  related_match_id: string | null;
  related_item_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface MatchVerificationAttempt {
  id: string;
  match_id: string;
  attribute_key: string;
  is_correct: boolean;
  attempted_by: string;
  created_at: string;
}

// ============================================================================
// Sprint 4 — recovery timeline, messaging, push subscriptions
// ============================================================================

export interface MatchStatusHistoryEntry {
  id: string;
  match_id: string;
  status: MatchStatus;
  changed_at: string;
}

export interface MatchMessage {
  id: string;
  match_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  fcm_token: string;
  created_at: string;
}

export interface AdminSupportMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface AdminSupportConversation {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  user_name: string;
  campus_email: string | null;
}

// ============================================================================
// Sprint 5 — admin dashboard, analytics, audit log, suspicious activity
// ============================================================================

export type AuditEventType =
  | 'REPORT_CREATED'
  | 'REPORT_UPDATED'
  | 'MATCH_GENERATED'
  | 'VERIFICATION_ATTEMPTED'
  | 'VERIFICATION_PASSED'
  | 'VERIFICATION_REJECTED'
  | 'MESSAGE_SENT'
  | 'ITEM_RECOVERED'
  | 'ADMIN_ACTION';

export interface AuditLogEntry {
  id: string;
  event_type: AuditEventType;
  actor_id: string | null;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type FlagStatus = 'PENDING_REVIEW' | 'REVIEWED' | 'DISMISSED';

export interface RuleHit {
  rule: string;
  count: number;
}

export interface SuspiciousActivityFlag {
  id: string;
  user_id: string;
  rule_hits: RuleHit[];
  risk_score: number;
  risk_level: RiskLevel;
  status: FlagStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminDashboardStats {
  active_lost_count: number;
  active_found_count: number;
  potential_matches_count: number;
  verified_matches_count: number;
  recovered_count: number;
  avg_recovery_hours: number | null;
  reports_this_week: number;
  recovery_rate_pct: number;
}

export interface AdminMatchAnalytics {
  avg_score: number | null;
  strong_matches: number;
  possible_matches: number;
  rejected_matches: number;
  verified_matches: number;
  recovery_conversion_pct: number;
}

export interface LocationHeatmapRow {
  location_name: string;
  report_type: ReportType;
  report_count: number;
}

export interface RecoveryHotspotRow {
  location_name: string;
  recovered_count: number;
}

export interface CategoryFrequencyRow {
  category: string;
  report_type: ReportType;
  report_count: number;
}

export interface TimeDistributionRow {
  hour_of_day: number;
  report_count: number;
}
