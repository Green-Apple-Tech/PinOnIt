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
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  timezone: string;
  slug: string | null;
  plan: 'free' | 'pro';
  stripe_customer_id: string | null;
  referral_code: string | null;
  referred_by: string | null;
  brand_color: string;
  booking_page_header: string;
  phone: string | null;
  whatsapp_number: string | null;
  default_reminder_channel: 'email' | 'sms' | 'whatsapp' | 'voice' | null;
  schedule_breaks: ScheduleBreak[];
  meeting_buffer_minutes: number;
  onboarding_completed: boolean;
  onboarding_step: number;
  referral_banner_dismissed: boolean;
  critical_alerts_enabled: boolean;
  critical_alert_phone: string | null;
  voice_reminder_enabled: boolean;
  voice_message_template: string | null;
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
  paypal_currency: string;
  venmo_handle: string | null;
  cashapp_tag: string | null;
  zelle_contact: string | null;
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
  guest_email: string;
  guest_timezone: string;
  start_time: string;
  end_time: string;
  status: 'tentative' | 'pending_approval' | 'confirmed' | 'canceled' | 'completed' | 'no_show';
  stripe_payment_id: string | null;
  paypal_order_id: string | null;
  payment_provider: string | null;
  notes: string;
  meet_link: string | null;
  calendar_event_id: string | null;
  is_critical: boolean;
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
  plan: 'free' | 'pro';
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
  booking_id: string;
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
