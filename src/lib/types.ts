export interface ScheduleBreak {
  id: string;
  label: string;
  start: string; // 'HH:MM'
  end: string;   // 'HH:MM'
  enabled: boolean;
  days: number[]; // day-of-week numbers (0=Sun,1=Mon…6=Sat); empty = all days
}

export interface CalendarConflictSettings {
  block_all_day_busy: boolean;   // default true  — vacation, PTO, OOO all-day events
  block_free_all_day: boolean;   // default false — birthdays, public holidays marked free
  block_declined: boolean;       // default false — events the user declined
  block_tentative: boolean;      // default false — tentative/maybe events
}

export const DEFAULT_CALENDAR_CONFLICT_SETTINGS: CalendarConflictSettings = {
  block_all_day_busy: true,
  block_free_all_day: false,
  block_declined: false,
  block_tentative: false,
};

export interface Profile {
  id: string;
  email: string;
  notification_email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  timezone: string;
  slug: string | null;
  plan: 'trial' | 'pro' | 'expired';
  plan_override?: 'pro' | null;
  stripe_customer_id: string | null;
  referral_code: string | null;
  referred_by: string | null;
  signup_attribution?: Record<string, string> | null;
  brand_color: string;
  booking_page_header: string;
  phone: string | null;
  whatsapp_number: string | null;
  default_reminder_channel: 'email' | 'sms' | 'whatsapp' | 'voice' | null;
  sms_opt_in?: boolean | null;
  whatsapp_opt_in?: boolean | null;
  schedule_breaks: ScheduleBreak[];
  meeting_buffer_minutes: number;
  onboarding_completed: boolean;
  onboarding_step: number;
  referral_banner_dismissed: boolean;
  critical_alerts_enabled: boolean;
  critical_alert_phone: string | null;
  critical_auto_matches?: { type: 'email' | 'domain' | 'name'; value: string }[] | null;
  critical_alert_settings?: {
    sms_offsets?: number[];
    whatsapp_offsets?: number[];
    email_offsets?: number[];
    voice_enabled?: boolean;
    voice_offsets?: number[];
  } | null;
  voice_reminder_enabled: boolean;
  voice_message_template: string | null;
  personal_reminder_add_to_calendar?: boolean;
  personal_reminder_defaults?: {
    day_before?: string[];
    hour_before?: string[];
    ten_min?: string[];
  } | null;
  reminder_also?: Array<{
    id: string;
    name: string;
    email?: string;
    phone?: string;
    channels?: string[];
    scope?: 'manual' | 'all' | 'services';
    service_ids?: string[];
  }> | null;
  slack_webhook_url?: string | null;
  reschedule_cutoff_hours?: number;
  paid_booking_intro_seen: boolean;
  paid_booking_settings: PaidBookingSettings;
  paid_booking_theme: 'clean' | 'bold' | 'warm';
  show_wizard_button: boolean | null;
  wizard_active: boolean | null;
  default_link_expiry_days: number | null;
  single_use_links_enabled: boolean;
  single_use_links?: boolean;
  link_expiry?: string;
  session_timeout_minutes: number | null;
  calendar_conflict_settings: CalendarConflictSettings | null;
  global_require_terms: boolean;
  global_terms_text: string;
  waiver_template?: string | null;
  ui_mode?: 'simple' | 'advanced';
  revealed_tools?: string[] | null;
  business_type?: string | null;
  default_tax_percent?: number | null;
  quote_line_defaults?: { description: string; amount: number }[] | null;
  business_region?: string | null;
  platform_terms_accepted_at?: string | null;
  platform_terms_version?: string | null;
  /** When the host acknowledged Sign-by-Text single-signature / excluded-doc scope. */
  sign_by_text_scope_accepted_at?: string | null;
  /** Company / DBA name for Doc Center “[Business Name]” and public branding. */
  business_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaidBookingSettings {
  display_name?: string;
  tagline?: string;
  bio?: string;
  bg_color?: string;
  btn_color?: string;
  text_color?: string;
  btn_label?: string;
  layout?: 'list' | 'grid';
  show_descriptions?: boolean;
  show_images?: boolean;
  use_categories?: boolean;
  categories?: string[];
  business_photo_url?: string | null;
  /** When set, only these service IDs appear on the paid booking menu. */
  visible_service_ids?: string[] | null;
}

export type MeetingType = 'one_on_one' | 'group' | 'one_off';
export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly';

export interface Service {
  id: string;
  host_id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  color: string;
  is_active: boolean;
  meeting_type: MeetingType;
  max_invitees: number | null;
  // Scheduling controls
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_hours: number;
  max_bookings_per_day: number | null;
  booking_window_days: number;
  slot_increment_minutes: number;
  // Policy
  allow_cancellation: boolean;
  allow_reschedule: boolean;
  cancellation_policy: string;
  confirmation_redirect_url: string | null;
  // Location
  location: string;
  location_type: 'video' | 'in_person' | 'phone' | 'custom';
  // Payment
  payment_provider: 'none' | 'paypal' | 'p2p';
  paypal_me_link: string | null;
  paypal_handle: string | null;
  paypal_currency: string;
  venmo_handle: string | null;
  cashapp_handle: string | null;
  zelle_handle: string | null;
  /** @deprecated use cashapp_handle */
  cashapp_tag?: string | null;
  /** @deprecated use zelle_handle */
  zelle_contact?: string | null;
  payment_methods: string[];
  // Forms
  require_terms: boolean;
  require_nda: boolean;
  // Description visibility
  show_description_on_booking_page: boolean;
  show_description_on_paid_booking: boolean;
  // Paid booking
  banner_image_url: string | null;
  category: string | null;
  // Advanced
  follow_up_delay_hours: number | null;
  booking_calendar_ids: string[];
  is_recurring: boolean;
  recurrence_frequency: RecurrenceFrequency | null;
  recurrence_end_date: string | null;
  recurrence_end_occurrences: number | null;
  max_recurring_clients: number | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingPoll {
  id: string;
  host_id: string;
  title: string;
  description: string;
  duration_minutes: number;
  location: string;
  location_type: 'video' | 'phone' | 'in_person' | 'custom';
  status: 'open' | 'closed' | 'confirmed';
  confirmed_slot_start: string | null;
  confirmed_slot_end: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  slots?: MeetingPollSlot[];
  responses?: MeetingPollResponse[];
}

export interface MeetingPollSlot {
  id: string;
  poll_id: string;
  start_time: string;
  end_time: string;
  created_at: string;
  votes?: MeetingPollVote[];
}

export interface MeetingPollResponse {
  id: string;
  poll_id: string;
  invitee_name: string;
  invitee_email: string;
  token: string;
  created_at: string;
  votes?: MeetingPollVote[];
}

export interface MeetingPollVote {
  id: string;
  response_id: string;
  slot_id: string;
  availability: 'yes' | 'maybe' | 'no';
  created_at: string;
}

export interface AvailabilitySlot {
  id: string;
  host_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
}

export interface DateOverride {
  id: string;
  host_id: string;
  override_date: string; // 'YYYY-MM-DD'
  is_blocked: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string;
  created_at: string;
}

export interface BookingQuestion {
  id: string;
  service_id: string;
  host_id: string;
  label: string;
  field_type: 'text' | 'textarea' | 'select' | 'checkbox' | 'phone' | 'url';
  options: string[] | null;
  required: boolean;
  sort_order: number;
  created_at: string;
}

export interface BookingAnswer {
  id: string;
  booking_id: string;
  question_id: string;
  answer: string;
  created_at: string;
}

export interface Booking {
  id: string;
  service_id: string;
  host_id: string;
  guest_name: string;
  guest_email: string | null;
  guest_phone?: string | null;
  guest_address?: string | null;
  notify_via?: string[] | null;
  guest_timezone: string;
  start_time: string;
  end_time: string;
  status: 'tentative' | 'pending_approval' | 'confirmed' | 'canceled' | 'completed' | 'no_show';
  stripe_payment_id: string | null;
  paypal_order_id: string | null;
  payment_provider: string | null;
  notes: string;
  cancel_reason?: string | null;
  action_token?: string;
  reminder_channels?: string[];
  reminder_times?: string[];
  meet_link: string | null;
  calendar_event_id: string | null;
  external_calendar_events?: { connected_calendar_id: string; provider: 'google' | 'outlook'; provider_event_id: string }[] | null;
  also_remind_ids?: string[] | null;
  is_critical: boolean;
  voice_reminder_sent?: boolean;
  is_recurring: boolean;
  recurrence_frequency: RecurrenceFrequency | null;
  parent_booking_id: string | null;
  created_at: string;
  updated_at: string;
  services?: Service;
  profiles?: Profile;
}

export interface EmergencyContact {
  id: string;
  host_id: string;
  label: string;
  phone: string;
  sort_order: number;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  stripe_current_period_end: string | null;
  trial_ends_at?: string | null;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  plan: 'trial' | 'pro' | 'expired';
  created_at: string;
  updated_at: string;
}

export interface MessageTemplate {
  id: string;
  host_id: string;
  name: string;
  type: 'confirmation' | 'reminder' | 'follow_up' | 'custom';
  channel: 'email' | 'sms' | 'whatsapp' | 'both' | 'voice';
  subject: string | null;
  body: string;
  timing_offset_minutes: number;
  is_active: boolean;
  language: string;
  auto_translate: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageLogEntry {
  id: string;
  booking_id: string | null;
  host_id: string;
  template_id: string | null;
  channel: 'email' | 'sms' | 'whatsapp' | 'voice';
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  recipient: string;
  subject: string | null;
  body: string;
  language: string;
  sent_at: string | null;
  created_at: string;
}

export interface ReminderRule {
  id: string;
  host_id: string;
  service_id: string | null;
  template_id: string;
  timing_offset_minutes: number;
  is_active: boolean;
  is_critical: boolean;
  created_at: string;
  template?: MessageTemplate;
  service?: Service;
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const DAY_ABBREVS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'America/Toronto', 'America/Vancouver',
  'America/Sao_Paulo', 'America/Mexico_City', 'America/Bogota',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam',
  'Europe/Madrid', 'Europe/Rome', 'Europe/Stockholm', 'Europe/Zurich',
  'Europe/Moscow', 'Africa/Lagos', 'Africa/Johannesburg', 'Africa/Nairobi',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Singapore',
  'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 'Australia/Sydney',
  'Pacific/Auckland', 'UTC',
] as const;

export const SUPPORTED_LANGUAGES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  hi: 'Hindi',
  it: 'Italian',
  nl: 'Dutch',
  ru: 'Russian',
  pl: 'Polish',
  tr: 'Turkish',
  vi: 'Vietnamese',
};

export const TEMPLATE_VARIABLES = [
  { key: '{{guest_name}}', label: "Guest's name" },
  { key: '{{guest_address}}', label: 'Guest service address' },
  { key: '{{host_name}}', label: "Host's name" },
  { key: '{{service_name}}', label: 'Service name' },
  { key: '{{date}}', label: 'Appointment date' },
  { key: '{{time}}', label: 'Appointment time' },
  { key: '{{timezone}}', label: 'Timezone' },
  { key: '{{duration}}', label: 'Duration' },
  { key: '{{location}}', label: 'Meeting location/link' },
  { key: '{{booking_link}}', label: 'Booking page link' },
  { key: '{{cancel_link}}', label: 'Cancel link' },
  { key: '{{confirm_link}}', label: 'Confirm link' },
  { key: '{{reschedule_link}}', label: 'Reschedule link' },
] as const;

export type HostQuoteKind = 'quote' | 'invoice' | 'receipt';

export interface HostQuoteLineItem {
  description: string;
  amount: number;
}

export interface HostQuote {
  id: string;
  host_id: string;
  token: string;
  kind: HostQuoteKind;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  line_items: HostQuoteLineItem[];
  notes: string | null;
  pay_elsewhere_url: string | null;
  pay_elsewhere_label: string | null;
  currency: string;
  tax_percent: number;
  status: 'draft' | 'sent';
  sent_via: string[];
  created_at: string;
  updated_at: string;
}

export type SmbDocumentType =
  | 'nda'
  | 'invoice'
  | 'contract'
  | 'receipt'
  | 'waiver'
  | 'quote'
  | 'work_order'
  | 'change_order'
  | 'service_agreement'
  | 'scope_of_work'
  | 'consent_form'
  | 'cancellation_policy'
  | 'credit_card_authorization'
  | 'recurring_service_authorization'
  | 'property_access_authorization'
  | 'key_access_receipt'
  | 'inspection_acknowledgment'
  | 'completion_sign_off'
  | 'delivery_acceptance'
  | 'damage_condition_report'
  | 'rental_agreement'
  | 'photo_video_release'
  | 'walkthrough'
  | 'showing_acknowledgment'
  | 'repair_confirmation'
  | 'maintenance_approval'
  | 'other'
  | 'upload'
  | 'quick_addendum';
export type DocumentConfirmationType = 'sign' | 'approve' | 'confirm_receipt';
export type SmbDocumentStatus = 'pending' | 'viewed' | 'signed';

export interface DocumentTemplate {
  id: string;
  name: string;
  document_type: SmbDocumentType;
  confirmation_type: DocumentConfirmationType;
  summary_text: string;
  full_text: string;
  created_at: string;
}

export interface SmbDocument {
  id: string;
  token: string;
  sender_id: string;
  recipient_name: string;
  recipient_phone: string | null;
  recipient_email?: string | null;
  document_type: SmbDocumentType;
  /** When document_type is `other`, the sender’s custom label. */
  document_type_custom?: string | null;
  template_id: string;
  topic: string;
  custom_text?: string | null;
  status: SmbDocumentStatus;
  created_at: string;
  viewed_at: string | null;
  signed_at: string | null;
  signature_data: string | null;
  ip_address: string | null;
  user_agent: string | null;
  otp_verified: boolean;
  otp_verified_at: string | null;
  verification_required?: boolean;
  line_items?: HostQuoteLineItem[];
  tax_percent?: number;
  notes?: string | null;
  pay_elsewhere_url?: string | null;
  pay_elsewhere_label?: string | null;
  currency?: string;
  file_path?: string | null;
  file_name?: string | null;
  file_size_bytes?: number | null;
  esign_consent_text?: string | null;
  esign_consent_at?: string | null;
  document_agreed_at?: string | null;
  document_snapshot_text?: string | null;
  document_sha256?: string | null;
  certificate_path?: string | null;
  certificate_generated_at?: string | null;
  timezone_at_sign?: string | null;
}

export interface PublicSmbDocument {
  id: string;
  token: string;
  recipient_name: string;
  document_type: SmbDocumentType;
  document_type_custom?: string | null;
  template_id: string;
  topic: string;
  status: SmbDocumentStatus;
  otp_verified: boolean;
  created_at: string;
  viewed_at: string | null;
  signed_at: string | null;
  confirmation_type: DocumentConfirmationType;
  template_name: string;
  summary_text: string;
  full_text: string;
  verification_required?: boolean;
  line_items?: HostQuoteLineItem[];
  tax_percent?: number;
  notes?: string | null;
  pay_elsewhere_url?: string | null;
  pay_elsewhere_label?: string | null;
  currency?: string;
  file_path?: string | null;
  file_name?: string | null;
  file_size_bytes?: number | null;
  /** Sender company name for leftover [Business Name] placeholders. */
  sender_business_name?: string | null;
}

export const LOCATION_TYPES: Record<string, string> = {
  video: 'Video call',
  in_person: 'In-person',
  phone: 'Phone call',
  custom: 'Custom',
};

export const MEETING_TYPE_META: Record<MeetingType, { label: string; desc: string; badge: string }> = {
  one_on_one: { label: 'One-on-one', desc: '1 host → 1 invitee',           badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  group:      { label: 'Group',      desc: '1 host → multiple invitees',   badge: 'bg-teal-50 text-teal-700 border-teal-200' },
  one_off:    { label: 'Single use', desc: 'Only bookable via a one-time link', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
};
