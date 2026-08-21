import { useState, useEffect, useCallback, type CSSProperties, type ElementType } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { effectivePlan } from '../lib/plan';
import { PageChecklist } from '../components/PageChecklist';
import type { MessageTemplate, ReminderRule, MessageLogEntry, Service } from '../lib/types';
import { SUPPORTED_LANGUAGES, TEMPLATE_VARIABLES } from '../lib/types';
import { formatErrorMessage, formatFunctionError } from '../lib/errors';
import { toast } from '../components/Toast';
import {
  Bell, Plus, Trash2, X, Check, Loader2, Mail, MessageSquare,
  Languages, Clock, ChevronDown, ChevronUp, Eye, Settings2,
  MoreVertical, AlertTriangle, Smartphone, Pencil, Zap,
  ArrowRight, CheckCircle2, BellRing, Phone, Save, PhoneCall,
} from 'lucide-react';
import { PHONE_PLACEHOLDER, PHONE_HINT, blurFormatPhone, normalizePhoneE164 } from '../lib/phone';
import { resolveDefaultReminderChannel, getWhatsappNumber } from '../lib/reminderChannels';
import { VoicePersonalReminder, PersonalReminderDefaultsEditor } from '../components/VoicePersonalReminder';
import { AlsoRemindPeople } from '../components/AlsoRemindPeople';
import { SMS_OPT_OUT_FOOTER } from '../lib/smsOptOut';
import { isValidSlackWebhookUrl } from '../lib/slackWebhook';
import { SmsBookingConsent } from '../components/SmsConsentText';

// ── helpers ──────────────────────────────────────────────────────────────────

function formatOffset(minutes: number): string {
  if (minutes === 0) return 'At booking time';
  if (minutes < 0) {
    const abs = Math.abs(minutes);
    if (abs >= 1440) return `${abs / 1440} day${abs / 1440 > 1 ? 's' : ''} before event`;
    if (abs >= 60) return `${abs / 60} hour${abs / 60 > 1 ? 's' : ''} before event`;
    return `${abs} min before event`;
  }
  if (minutes >= 1440) return `${minutes / 1440} day${minutes / 1440 > 1 ? 's' : ''} after event`;
  if (minutes >= 60) return `${minutes / 60} hour${minutes / 60 > 1 ? 's' : ''} after event`;
  return `${minutes} min after event`;
}

type Channel = 'email' | 'sms' | 'whatsapp' | 'voice';

const REMINDER_SLOTS = [
  { key: 'confirmation', label: 'Booking Confirmation', sublabel: 'Sent immediately when someone books', offset: 0, type: 'confirmation' as const },
  { key: 'reminder_15m', label: '15 Min Reminder', sublabel: '15 minutes before the event', offset: -15, type: 'reminder' as const },
  { key: 'reminder_30m', label: '30 Min Reminder', sublabel: '30 minutes before the event', offset: -30, type: 'reminder' as const },
  { key: 'reminder_60m', label: '1 Hour Reminder', sublabel: '60 minutes before the event', offset: -60, type: 'reminder' as const },
  { key: 'reminder_24h', label: '24 Hour Reminder', sublabel: '1 day before the event', offset: -1440, type: 'reminder' as const },
  { key: 'reminder_48h', label: '48 Hour Reminder', sublabel: '2 days before the event', offset: -2880, type: 'reminder' as const },
] as const;

const CHANNEL_TEMPLATES: Record<string, Record<Channel, { subject: string | null; body: string }>> = {
  confirmation: {
    email: { subject: 'Your {{service_name}} is confirmed', body: 'Hi {{guest_name}},\n\nYour {{service_name}} with {{host_name}} is confirmed.\n\nDate: {{date}} at {{time}} ({{timezone}})\nDuration: {{duration}}\n\n{{location}}\n\nNeed to reschedule? {{reschedule_link}}\n\n— {{host_name}}' },
    sms: { subject: null, body: `Hi {{guest_name}}, your {{service_name}} with {{host_name}} is confirmed for {{date}} at {{time}}. {{location}} ${SMS_OPT_OUT_FOOTER}` },
    whatsapp: { subject: null, body: `Hi {{guest_name}}! Your {{service_name}} with {{host_name}} is confirmed for {{date}} at {{time}}. {{location}} ${SMS_OPT_OUT_FOOTER}` },
    voice: { subject: null, body: 'Hi, this is a reminder from {{host_name}} that you have a {{service_name}} scheduled for {{date}} at {{time}}. We look forward to speaking with you.' },
  },
  reminder_15m: {
    email: { subject: 'Reminder: {{service_name}} starts in 15 minutes', body: 'Hi {{guest_name}},\n\nYour {{service_name}} with {{host_name}} starts in 15 minutes.\n\n{{location}}\n\n— {{host_name}}' },
    sms: { subject: null, body: `Hi {{guest_name}}, your {{service_name}} with {{host_name}} starts in 15 minutes. {{location}} ${SMS_OPT_OUT_FOOTER}` },
    whatsapp: { subject: null, body: `Hi {{guest_name}}! Your {{service_name}} with {{host_name}} starts in 15 minutes. {{location}} ${SMS_OPT_OUT_FOOTER}` },
    voice: { subject: null, body: 'Hi, this is a reminder from {{host_name}} that you have a {{service_name}} starting in 15 minutes. We look forward to speaking with you.' },
  },
  reminder_30m: {
    email: { subject: 'Reminder: {{service_name}} starts in 30 minutes', body: 'Hi {{guest_name}},\n\nYour {{service_name}} with {{host_name}} starts in 30 minutes.\n\n{{location}}\n\n— {{host_name}}' },
    sms: { subject: null, body: `Hi {{guest_name}}, your {{service_name}} with {{host_name}} starts in 30 minutes. {{location}} ${SMS_OPT_OUT_FOOTER}` },
    whatsapp: { subject: null, body: `Hi {{guest_name}}! Your {{service_name}} with {{host_name}} starts in 30 minutes. {{location}} ${SMS_OPT_OUT_FOOTER}` },
    voice: { subject: null, body: 'Hi, this is a reminder from {{host_name}} that you have a {{service_name}} starting in 30 minutes. We look forward to speaking with you.' },
  },
  reminder_60m: {
    email: { subject: 'Reminder: {{service_name}} starts in 1 hour', body: 'Hi {{guest_name}},\n\nYour {{service_name}} with {{host_name}} starts in 1 hour.\n\n{{location}}\n\n— {{host_name}}' },
    sms: { subject: null, body: `Hi {{guest_name}}, your {{service_name}} with {{host_name}} starts in 1 hour. {{location}} ${SMS_OPT_OUT_FOOTER}` },
    whatsapp: { subject: null, body: `Hi {{guest_name}}! Your {{service_name}} with {{host_name}} starts in 1 hour. {{location}} ${SMS_OPT_OUT_FOOTER}` },
    voice: { subject: null, body: 'Hi, this is a reminder from {{host_name}} that you have a {{service_name}} scheduled for {{date}} at {{time}}. We look forward to speaking with you.' },
  },
  reminder_24h: {
    email: { subject: 'Reminder: {{service_name}} tomorrow at {{time}}', body: 'Hi {{guest_name}},\n\nJust a reminder that your {{service_name}} with {{host_name}} is tomorrow at {{time}} ({{timezone}}).\n\n{{location}}\n\nSee you then!\n— {{host_name}}' },
    sms: { subject: null, body: `Hi {{guest_name}}, reminder: your {{service_name}} with {{host_name}} is tomorrow at {{time}}. {{location}} ${SMS_OPT_OUT_FOOTER}` },
    whatsapp: { subject: null, body: `Hi {{guest_name}}! Reminder: your {{service_name}} with {{host_name}} is tomorrow at {{time}}. {{location}} ${SMS_OPT_OUT_FOOTER}` },
    voice: { subject: null, body: 'Hi, this is a reminder from {{host_name}} that you have a {{service_name}} scheduled for tomorrow at {{time}}. We look forward to speaking with you.' },
  },
  reminder_48h: {
    email: { subject: 'Reminder: {{service_name}} in 2 days', body: 'Hi {{guest_name}},\n\nJust a heads up — your {{service_name}} with {{host_name}} is in 2 days on {{date}} at {{time}}.\n\n{{location}}\n\n— {{host_name}}' },
    sms: { subject: null, body: `Hi {{guest_name}}, your {{service_name}} with {{host_name}} is in 2 days — {{date}} at {{time}}. {{location}} ${SMS_OPT_OUT_FOOTER}` },
    whatsapp: { subject: null, body: `Hi {{guest_name}}! Your {{service_name}} with {{host_name}} is in 2 days — {{date}} at {{time}}. {{location}} ${SMS_OPT_OUT_FOOTER}` },
    voice: { subject: null, body: 'Hi, this is a reminder from {{host_name}} that you have a {{service_name}} scheduled for {{date}} at {{time}}. We look forward to speaking with you.' },
  },
};

// ── Quick-setup templates ─────────────────────────────────────────────────────
const QUICK_TEMPLATES = [
  {
    id: 'basic',
    label: 'Free',
    badge: 'Free',
    badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
    description: 'Email only, 1 hour before',
    icon: Mail,
    iconColor: 'text-blue-500',
    combos: [{ slotKey: 'confirmation', channel: 'email' as Channel }, { slotKey: 'reminder_60m', channel: 'email' as Channel }],
  },
  {
    id: 'pro',
    label: 'Pro',
    badge: 'Pro',
    badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
    description: 'Email + SMS + WhatsApp (customizable timing)',
    icon: MessageSquare,
    iconColor: 'text-[#5864C6]',
    combos: [
      { slotKey: 'confirmation', channel: 'email' as Channel },
      { slotKey: 'reminder_24h', channel: 'email' as Channel },
      { slotKey: 'reminder_60m', channel: 'sms' as Channel },
      { slotKey: 'reminder_30m', channel: 'whatsapp' as Channel },
    ],
  },
];

// ── Add reminder form step config ─────────────────────────────────────────────
const TIMING_OPTIONS = [
  { label: '15 min before', slotKey: 'reminder_15m', offset: -15 },
  { label: '30 min before', slotKey: 'reminder_30m', offset: -30 },
  { label: '1 hour before', slotKey: 'reminder_60m', offset: -60 },
  { label: '24 hours before', slotKey: 'reminder_24h', offset: -1440 },
  { label: '48 hours before', slotKey: 'reminder_48h', offset: -2880 },
];

const CHANNEL_INFO: { key: Channel; label: string; color: string; bg: string }[] = [
  { key: 'email',    label: 'Email',      color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
  { key: 'sms',     label: 'SMS',        color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
  { key: 'whatsapp',label: 'WhatsApp',   color: 'text-[#5864C6] dark:text-[#8891e8]', bg: 'bg-[#5864C6]/5 dark:bg-[#5864C6]/10 border-[#5864C6]/20 dark:border-[#5864C6]/30' },
  { key: 'voice',   label: 'Voice Call', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800' },
];

/** Always returns a real lucide component — avoids React #130 from `<ch.icon />` when icon is undefined. */
function ChannelIcon({
  channel,
  className,
  style,
}: {
  channel: string;
  className?: string;
  style?: CSSProperties;
}) {
  const Icon: ElementType | undefined =
    (channel === 'sms' ? Smartphone
      : channel === 'whatsapp' ? MessageSquare
      : channel === 'voice' ? PhoneCall
      : Mail) || Mail;
  if (!Icon) return <span className={className} style={style} aria-hidden />;
  return <Icon className={className} style={style} />;
}

/** One grid for label + 4 channel columns (header and rows share tracks). */
const REMINDER_MATRIX_GRID =
  'grid grid-cols-[minmax(0,1fr)_repeat(4,minmax(3.25rem,5rem))] gap-x-3 sm:gap-x-4';

const inputCls = 'w-full px-3 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-base focus:outline-none focus:ring-2 focus:ring-[#5864C6] transition';
const selectCls = inputCls;

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${on ? '' : 'bg-slate-300 dark:bg-slate-600'}`}
      style={on ? { backgroundColor: '#5864C6' } : {}}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function RemindersPage({
  embedded,
  onOpenProfileTab,
}: {
  embedded?: boolean;
  onOpenProfileTab?: () => void;
} = {}) {
  const navigate = useNavigate();
  const { user, profile, subscription, refreshProfile } = useAuth();
  const isPro = effectivePlan(subscription, profile) === 'pro';

  const goToProfileSettings = useCallback(() => {
    onOpenProfileTab?.();
    navigate('/dashboard/settings?tab=profile');
  }, [navigate, onOpenProfileTab]);

  // Contact channels (profiles.phone / whatsapp_number)
  const [contactPhone, setContactPhone] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [editingContact, setEditingContact] = useState(false);
  const [savingContact, setSavingContact] = useState(false);

  // Critical alerts
  const [criticalAlertsEnabled, setCriticalAlertsEnabled] = useState(profile?.critical_alerts_enabled !== false);
  const [savingCritical, setSavingCritical] = useState(false);
  const [savedCritical, setSavedCritical] = useState(false);
  const [testingCall, setTestingCall] = useState(false);
  const [testCallMsg, setTestCallMsg] = useState('');

  const defaultWizardChannel = resolveDefaultReminderChannel(profile?.default_reminder_channel);
  const effectiveWhatsapp = getWhatsappNumber(profile);

  const getDefaultWizardChannels = useCallback(
    () => new Set<Channel>([defaultWizardChannel]),
    [defaultWizardChannel],
  );

  useEffect(() => {
    const ch = resolveDefaultReminderChannel(profile?.default_reminder_channel);
    setWizardChannels(new Set([ch]));
    setPreviewChannel(ch);
    const storedPhone = profile?.phone ?? '';
    setContactPhone(storedPhone ? blurFormatPhone(storedPhone) : '');
    setSlackWebhookUrl(profile?.slack_webhook_url ?? '');
  }, [profile?.default_reminder_channel, profile?.phone, profile?.slack_webhook_url]);

  const handleSaveCriticalAlerts = async () => {
    if (!user) return;
    setSavingCritical(true);
    await supabase.from('profiles').update({
      critical_alerts_enabled: criticalAlertsEnabled,
    }).eq('id', user.id);
    setSavingCritical(false);
    setSavedCritical(true);
    setTimeout(() => setSavedCritical(false), 2000);
  };

  const handleTestCall = async () => {
    if (!contactPhone.trim()) return;
    setTestingCall(true);
    setTestCallMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-critical-call`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token ?? ''}`,
            Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
        }
      );
      const json = await res.json();
      if (json.error) setTestCallMsg(`Error: ${json.error}`);
      else setTestCallMsg('Test call initiated! You should receive a call shortly.');
    } catch (e) {
      setTestCallMsg(`Error: ${String(e)}`);
    }
    setTestingCall(false);
    setTimeout(() => setTestCallMsg(''), 6000);
  };
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [rules, setRules] = useState<(ReminderRule & { template?: MessageTemplate; service?: Service })[]>([]);
  const [log, setLog] = useState<MessageLogEntry[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSlot, setSavingSlot] = useState<string | null>(null);
  const [applyingQuick, setApplyingQuick] = useState<string | null>(null);

  // Add-reminder wizard
  const [showAddForm, setShowAddForm] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardTiming, setWizardTiming] = useState<string>('reminder_24h');
  const [wizardChannels, setWizardChannels] = useState<Set<Channel>>(() => new Set(['whatsapp']));
  const [wizardBodies, setWizardBodies] = useState<Record<Channel, string>>({ email: '', sms: '', whatsapp: '', voice: '' });
  const [wizardSubject, setWizardSubject] = useState('');
  const [wizardSaving, setWizardSaving] = useState(false);
  const [previewChannel, setPreviewChannel] = useState<Channel>('whatsapp');

  // Test SMS
  const [showTestSms, setShowTestSms] = useState(Boolean(embedded));
  const [testSmsPhone, setTestSmsPhone] = useState('');
  const [testSmsSending, setTestSmsSending] = useState(false);
  const [testWhatsappSending, setTestWhatsappSending] = useState(false);
  const [testVoiceSending, setTestVoiceSending] = useState(false);
  const [testSmsResult, setTestSmsResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [savingSlack, setSavingSlack] = useState(false);
  const [testingSlack, setTestingSlack] = useState(false);
  const [slackMsg, setSlackMsg] = useState('');

  // Advanced section
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedTab, setAdvancedTab] = useState<'templates' | 'rules' | 'log' | 'critical' | 'voice' | 'slack'>('templates');

  // Template form (advanced)
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplType, setTplType] = useState<MessageTemplate['type']>('reminder');
  const [tplChannel, setTplChannel] = useState<MessageTemplate['channel']>('email');
  const [tplSubject, setTplSubject] = useState('');
  const [tplBody, setTplBody] = useState('');
  const [tplOffset, setTplOffset] = useState(-1440);
  const [tplAutoTranslate, setTplAutoTranslate] = useState(false);
  const [tplLanguage, setTplLanguage] = useState('en');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [tplOffsetHours, setTplOffsetHours] = useState(24);
  const [tplOffsetMinutes, setTplOffsetMinutes] = useState(0);
  const [tplOffsetDirection, setTplOffsetDirection] = useState<'before' | 'after'>('before');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState<string | null>(null);

  // Rule form (advanced)
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleTemplateId, setRuleTemplateId] = useState('');
  const [ruleServiceId, setRuleServiceId] = useState('');
  const [ruleOffset, setRuleOffset] = useState(-1440);
  const [ruleOffsetHours, setRuleOffsetHours] = useState(24);
  const [ruleOffsetMinutes, setRuleOffsetMinutes] = useState(0);
  const [ruleOffsetDirection, setRuleOffsetDirection] = useState<'before' | 'after'>('before');
  const [ruleIsCritical, setRuleIsCritical] = useState(false);
  const [savingRule, setSavingRule] = useState(false);

  const computeOffset = (hours: number, mins: number, dir: 'before' | 'after') => {
    const total = hours * 60 + mins;
    return dir === 'before' ? -total : total;
  };

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [tplRes, ruleRes, logRes, svcRes] = await Promise.all([
        supabase.from('message_templates').select('*').eq('host_id', profile.id).order('created_at'),
        supabase.from('reminder_rules').select('*, message_templates(*), services(*)').eq('host_id', profile.id).order('timing_offset_minutes'),
        supabase.from('message_log').select('*').eq('host_id', profile.id).order('created_at', { ascending: false }).limit(200),
        supabase.from('services').select('*').eq('host_id', profile.id),
      ]);
      const storedPhone = (profile as { phone?: string }).phone ?? '';
      setContactPhone(storedPhone ? blurFormatPhone(storedPhone) : '');
      setContactWhatsapp((() => {
        const stored = (profile as { whatsapp_number?: string }).whatsapp_number ?? '';
        return stored ? blurFormatPhone(stored) : '';
      })());
      const loadedTemplates = tplRes.data ?? [];
      setTemplates(loadedTemplates);
      setRules((ruleRes.data ?? []).map((r) => {
        const row = r as ReminderRule & { message_templates?: MessageTemplate | null; services?: Service | null };
        const { message_templates, services, ...rule } = row;
        return {
          ...rule,
          template: message_templates ?? undefined,
          service: services ?? undefined,
        };
      }));
      setLog(logRes.data ?? []);
      setServices(svcRes.data ?? []);
      setLoading(false);
      if (!testSmsPhone) {
        const seed = storedPhone || (profile as { whatsapp_number?: string }).whatsapp_number || '';
        if (seed) setTestSmsPhone(blurFormatPhone(seed));
      }

      // Seed default 1-hour email reminder for brand-new users
      if (loadedTemplates.length === 0) {
        const slot = REMINDER_SLOTS.find((s) => s.key === 'reminder_60m')!;
        const tplContent = CHANNEL_TEMPLATES['reminder_60m']['email'];
        const { data: tpl } = await supabase
          .from('message_templates')
          .insert({ host_id: profile.id, name: `${slot.label} — Email`, type: slot.type, channel: 'email', subject: tplContent.subject, body: tplContent.body, timing_offset_minutes: slot.offset, is_active: true, language: 'en', auto_translate: false })
          .select().maybeSingle();
        if (tpl) {
          setTemplates([tpl]);
          const { data: rule } = await supabase
            .from('reminder_rules')
            .insert({ host_id: profile.id, template_id: tpl.id, service_id: null, timing_offset_minutes: slot.offset, is_active: true, is_critical: false })
            .select('*, message_templates(*), services(*)').maybeSingle();
          if (rule) {
            setRules([{ ...rule, template: (rule as Record<string, unknown>).message_templates as MessageTemplate | undefined, service: (rule as Record<string, unknown>).services as Service | undefined }]);
          }
        }
      }
    })();
  }, [profile]);

  const handleSaveContact = async () => {
    if (!profile) return;
    setSavingContact(true);
    try {
      const phoneE164 = normalizePhoneE164(contactPhone.trim());
      const whatsappE164 = normalizePhoneE164(contactWhatsapp.trim()) || phoneE164;
      const { error } = await supabase.from('profiles').update({
        phone: phoneE164 || null,
        whatsapp_number: whatsappE164 || null,
      }).eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      setEditingContact(false);
    } catch (err) {
      console.error('Failed to save contact channels:', err);
      toast.error(`Failed to save: ${formatErrorMessage(err)}`);
    } finally {
      setSavingContact(false);
    }
  };

  const isSlotChannelActive = (slotKey: string, channel: Channel): boolean => {
    const slot = REMINDER_SLOTS.find((s) => s.key === slotKey);
    if (!slot) return false;
    return templates.some((t) => t.type === slot.type && t.timing_offset_minutes === slot.offset && t.channel === channel);
  };

  const enableSlotChannel = async (slotKey: string, channel: Channel) => {
    if (!profile) return;
    const slot = REMINDER_SLOTS.find((s) => s.key === slotKey);
    if (!slot) return;
    const tplContent = CHANNEL_TEMPLATES[slotKey]?.[channel];
    if (!tplContent) return;
    const channelLabel = channel === 'email' ? 'Email' : channel === 'sms' ? 'SMS' : channel === 'voice' ? 'Voice Call' : 'WhatsApp';
    const { data: tpl } = await supabase
      .from('message_templates')
      .insert({ host_id: profile.id, name: `${slot.label} — ${channelLabel}`, type: slot.type, channel, subject: tplContent.subject, body: tplContent.body, timing_offset_minutes: slot.offset, is_active: true, language: 'en', auto_translate: false })
      .select().maybeSingle();
    if (tpl) {
      setTemplates((prev) => [...prev, tpl]);
      const { data: rule } = await supabase
        .from('reminder_rules')
        .insert({ host_id: profile.id, template_id: tpl.id, service_id: null, timing_offset_minutes: slot.offset, is_active: true, is_critical: false })
        .select('*, message_templates(*), services(*)').maybeSingle();
      if (rule) {
        setRules((prev) => [...prev, { ...rule, template: (rule as Record<string, unknown>).message_templates as MessageTemplate | undefined, service: (rule as Record<string, unknown>).services as Service | undefined }]);
      }
    }
  };

  const disableSlotChannel = async (slotKey: string, channel: Channel) => {
    const slot = REMINDER_SLOTS.find((s) => s.key === slotKey);
    if (!slot) return;
    const tpl = templates.find((t) => t.type === slot.type && t.timing_offset_minutes === slot.offset && t.channel === channel);
    if (!tpl) return;
    const relatedRules = rules.filter((r) => r.template_id === tpl.id);
    for (const r of relatedRules) await supabase.from('reminder_rules').delete().eq('id', r.id);
    await supabase.from('message_templates').delete().eq('id', tpl.id);
    setRules((prev) => prev.filter((r) => r.template_id !== tpl.id));
    setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
  };

  const handleToggleSlotChannel = async (slotKey: string, channel: Channel) => {
    const savingId = `${slotKey}-${channel}`;
    setSavingSlot(savingId);
    if (isSlotChannelActive(slotKey, channel)) {
      await disableSlotChannel(slotKey, channel);
    } else {
      await enableSlotChannel(slotKey, channel);
    }
    setSavingSlot(null);
  };

  const handleApplyQuickTemplate = async (qtId: string) => {
    if (!profile) return;
    setApplyingQuick(qtId);
    const qt = QUICK_TEMPLATES.find((q) => q.id === qtId);
    if (!qt) { setApplyingQuick(null); return; }
    for (const combo of qt.combos) {
      if (!isSlotChannelActive(combo.slotKey, combo.channel)) {
        await enableSlotChannel(combo.slotKey, combo.channel);
      }
    }
    setApplyingQuick(null);
  };

  // Wizard submit
  const handleWizardSave = async () => {
    if (!profile || wizardChannels.size === 0) return;
    setWizardSaving(true);
    const slot = REMINDER_SLOTS.find((s) => s.key === wizardTiming);
    if (!slot) { setWizardSaving(false); return; }
    for (const ch of Array.from(wizardChannels)) {
      if (isSlotChannelActive(wizardTiming, ch)) continue;
      const defaultContent = CHANNEL_TEMPLATES[wizardTiming]?.[ch];
      const body = wizardBodies[ch] || defaultContent?.body || '';
      const subject = ch === 'email' ? (wizardSubject || defaultContent?.subject || null) : null;
      const channelLabel = ch === 'email' ? 'Email' : ch === 'sms' ? 'SMS' : ch === 'voice' ? 'Voice Call' : 'WhatsApp';
      const { data: tpl } = await supabase
        .from('message_templates')
        .insert({ host_id: profile.id, name: `${slot.label} — ${channelLabel}`, type: slot.type, channel: ch, subject, body, timing_offset_minutes: slot.offset, is_active: true, language: 'en', auto_translate: false })
        .select().maybeSingle();
      if (tpl) {
        setTemplates((prev) => [...prev, tpl]);
        const { data: rule } = await supabase
          .from('reminder_rules')
          .insert({ host_id: profile.id, template_id: tpl.id, service_id: null, timing_offset_minutes: slot.offset, is_active: true, is_critical: false })
          .select('*, message_templates(*), services(*)').maybeSingle();
        if (rule) {
          setRules((prev) => [...prev, { ...rule, template: (rule as Record<string, unknown>).message_templates as MessageTemplate | undefined, service: (rule as Record<string, unknown>).services as Service | undefined }]);
        }
      }
    }
    setShowAddForm(false);
    setWizardStep(1);
    setWizardChannels(getDefaultWizardChannels());
    setWizardBodies({ email: '', sms: '', whatsapp: '', voice: '' });
    setWizardSubject('');
    setWizardSaving(false);
  };

  const initWizardBodies = (timing: string, channels: Set<Channel>) => {
    const b: Record<Channel, string> = { email: '', sms: '', whatsapp: '', voice: '' };
    for (const ch of Array.from(channels)) {
      b[ch] = CHANNEL_TEMPLATES[timing]?.[ch]?.body ?? '';
    }
    setWizardBodies(b);
    const slot = REMINDER_SLOTS.find((s) => s.key === timing);
    const emailContent = CHANNEL_TEMPLATES[timing]?.email;
    setWizardSubject(emailContent?.subject ?? (slot ? `Reminder: ${slot.label}` : ''));
  };

  const renderPreview = (body: string) =>
    body
      .replace(/\{\{guest_name\}\}/g, 'Jane Smith')
      .replace(/\{\{host_name\}\}/g, profile?.full_name ?? 'You')
      .replace(/\{\{service_name\}\}/g, '60 Min Meeting')
      .replace(/\{\{date\}\}/g, 'Monday, May 5')
      .replace(/\{\{time\}\}/g, '2:00 PM')
      .replace(/\{\{timezone\}\}/g, profile?.timezone ?? 'America/New_York')
      .replace(/\{\{duration\}\}/g, '60 min')
      .replace(/\{\{location\}\}/g, 'Zoom: https://zoom.us/j/123')
      .replace(/\{\{booking_link\}\}/g, 'https://pinonit.com/jane')
      .replace(/\{\{cancel_link\}\}/g, '[Cancel]')
      .replace(/\{\{reschedule_link\}\}/g, '[Reschedule]')
      .replace(/\{\{confirm_link\}\}/g, '[Confirm]');

  // Advanced template helpers
  const resetTemplateForm = () => {
    setTplName(''); setTplType('reminder'); setTplChannel('email');
    setTplSubject(''); setTplBody(''); setTplOffset(-1440);
    setTplOffsetHours(24); setTplOffsetMinutes(0); setTplOffsetDirection('before');
    setTplAutoTranslate(false); setTplLanguage('en');
    setEditingTemplate(null); setShowTemplateForm(false);
  };

  const startEditTemplate = (t: MessageTemplate) => {
    setEditingTemplate(t);
    setTplName(t.name); setTplType(t.type); setTplChannel(t.channel);
    setTplSubject(t.subject ?? ''); setTplBody(t.body); setTplOffset(t.timing_offset_minutes);
    const abs = Math.abs(t.timing_offset_minutes);
    setTplOffsetHours(Math.floor(abs / 60));
    setTplOffsetMinutes(abs % 60);
    setTplOffsetDirection(t.timing_offset_minutes <= 0 ? 'before' : 'after');
    setTplAutoTranslate(t.auto_translate); setTplLanguage(t.language);
    setShowTemplateForm(true); setAdvancedTab('templates'); setShowAdvanced(true);
  };

  const handleSaveTemplate = async () => {
    if (!profile || !tplName || !tplBody) return;
    setSavingTemplate(true);
    if (editingTemplate) {
      const { data } = await supabase.from('message_templates').update({ name: tplName, type: tplType, channel: tplChannel, subject: tplSubject || null, body: tplBody, timing_offset_minutes: tplOffset, auto_translate: tplAutoTranslate, language: tplLanguage }).eq('id', editingTemplate.id).select().maybeSingle();
      if (data) setTemplates((prev) => prev.map((t) => (t.id === data.id ? data : t)));
    } else {
      const { data } = await supabase.from('message_templates').insert({ host_id: profile.id, name: tplName, type: tplType, channel: tplChannel, subject: tplSubject || null, body: tplBody, timing_offset_minutes: tplOffset, auto_translate: tplAutoTranslate, language: tplLanguage }).select().maybeSingle();
      if (data) setTemplates((prev) => [...prev, data]);
    }
    resetTemplateForm(); setSavingTemplate(false);
  };

  const handleDeleteTemplate = async (id: string) => {
    await supabase.from('message_templates').delete().eq('id', id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const handleToggleRule = async (rule: ReminderRule & { template?: MessageTemplate; service?: Service }) => {
    const updated = { ...rule, is_active: !rule.is_active };
    await supabase.from('reminder_rules').update({ is_active: updated.is_active }).eq('id', rule.id);
    setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
  };

  const handleToggleCritical = async (rule: ReminderRule & { template?: MessageTemplate; service?: Service }) => {
    const updated = { ...rule, is_critical: !rule.is_critical };
    await supabase.from('reminder_rules').update({ is_critical: updated.is_critical }).eq('id', rule.id);
    setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
  };

  const handleDeleteRule = async (id: string) => {
    await supabase.from('reminder_rules').delete().eq('id', id);
    setRules((prev) => prev.filter((r) => r.id !== id));
    setOpenMenu(null);
  };

  const handleSaveRule = async () => {
    if (!profile || !ruleTemplateId) return;
    setSavingRule(true);
    const { data } = await supabase.from('reminder_rules').insert({ host_id: profile.id, template_id: ruleTemplateId, service_id: ruleServiceId || null, timing_offset_minutes: ruleOffset, is_critical: ruleIsCritical }).select('*, message_templates(*), services(*)').maybeSingle();
    if (data) {
      setRules((prev) => [...prev, { ...data, template: (data as Record<string, unknown>).message_templates as MessageTemplate | undefined, service: (data as Record<string, unknown>).services as Service | undefined }]);
    }
    setShowRuleForm(false); setRuleTemplateId(''); setRuleServiceId(''); setRuleOffset(-1440); setRuleIsCritical(false);
    setSavingRule(false);
  };

  const activeCount = templates.filter((t) => rules.some((r) => r.template_id === t.id && r.is_active)).length;

  const isTemplateCheckboxActive = (tpl: MessageTemplate): boolean => {
    const slot = REMINDER_SLOTS.find((s) => s.offset === tpl.timing_offset_minutes && s.type === tpl.type);
    if (!slot) return false;
    return isSlotChannelActive(slot.key, tpl.channel as Channel);
  };
  const hasAnyReminders = templates.length > 0;

  const handleTestMessage = async (channel: 'sms' | 'whatsapp' | 'voice') => {
    const to = normalizePhoneE164(testSmsPhone);
    if (!to) return;
    if (channel === 'sms') setTestSmsSending(true);
    else if (channel === 'whatsapp') setTestWhatsappSending(true);
    else setTestVoiceSending(true);
    setTestSmsResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const now = new Date();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-reminder`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
            Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            test_sms: channel === 'sms',
            test_whatsapp: channel === 'whatsapp',
            test_voice: channel === 'voice',
            to,
            guest_name: 'Test Guest',
            host_name: profile?.full_name ?? 'Your Host',
            duration: '30',
            date: now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
            time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          }),
        }
      );
      const json = await res.json().catch(() => ({})) as { success?: boolean; error?: unknown };
      const label = channel === 'whatsapp' ? 'WhatsApp' : channel === 'voice' ? 'voicemail' : 'SMS';
      const sent = res.ok && json.success === true && !json.error;
      if (!sent) {
        setTestSmsResult({
          ok: false,
          message: formatFunctionError(json, `Failed to send ${label}. Check Twilio WhatsApp template / credentials.`),
        });
      } else {
        setTestSmsResult({
          ok: true,
          message: channel === 'voice'
            ? `Test call started to ${to}. Answer to hear the reminder voicemail.`
            : `Test ${label} queued to ${to}. Check your phone — “queued” is not the same as delivered.`,
        });
        const { data: latest } = await supabase
          .from('message_log')
          .select('*')
          .eq('host_id', profile?.id)
          .order('created_at', { ascending: false })
          .limit(200);
        if (latest) setLog(latest);
      }
    } catch (e) {
      setTestSmsResult({ ok: false, message: String(e) });
    }
    setTestSmsSending(false);
    setTestWhatsappSending(false);
    setTestVoiceSending(false);
  };

  const handleSaveSlackWebhook = async () => {
    if (!profile?.id) return;
    const trimmed = slackWebhookUrl.trim();
    if (trimmed && !isValidSlackWebhookUrl(trimmed)) {
      setSlackMsg('URL must start with https://hooks.slack.com/services/');
      return;
    }
    setSavingSlack(true);
    setSlackMsg('');
    const { error } = await supabase
      .from('profiles')
      .update({ slack_webhook_url: trimmed || null })
      .eq('id', profile.id);
    setSavingSlack(false);
    if (error) {
      setSlackMsg(error.message);
      return;
    }
    await refreshProfile();
    setSlackMsg(trimmed ? 'Saved.' : 'Cleared.');
    setTimeout(() => setSlackMsg(''), 2500);
  };

  const handleTestSlack = async () => {
    const trimmed = slackWebhookUrl.trim();
    if (!isValidSlackWebhookUrl(trimmed)) {
      setSlackMsg('URL must start with https://hooks.slack.com/services/');
      return;
    }
    setTestingSlack(true);
    setSlackMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-reminder`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
            Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            test_slack: true,
            slack_webhook_url: trimmed,
            text: 'PinOnIt test: Slack notifications are working.',
          }),
        },
      );
      const json = await res.json().catch(() => ({})) as { success?: boolean; error?: unknown };
      if (!res.ok || json.error) {
        setSlackMsg(formatFunctionError(json, 'Slack test failed. Check the webhook URL.'));
      } else {
        setSlackMsg('Test sent. Check your Slack channel.');
      }
    } catch (e) {
      setSlackMsg(String(e));
    }
    setTestingSlack(false);
  };

  if (loading) {
    return (
      <main className="p-6 md:p-8 max-w-3xl">
        <div className="text-center py-12 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </div>
      </main>
    );
  }

  const Wrapper = embedded ? 'div' : 'main';
  return (
    <Wrapper className={embedded ? 'w-full' : 'p-6 md:p-8 max-w-3xl space-y-6'}>

      {/* Contextual checklist — hidden for Pro users */}
      {!isPro && (
        <PageChecklist
          storageKey="reminders_checklist"
          items={[
            { id: 'template', label: 'Create your first reminder template', why: 'Templates are the messages sent to guests before meetings', done: templates.length > 0 },
            { id: 'phone', label: 'Add your phone number for SMS/WhatsApp', why: 'Required to receive SMS and WhatsApp reminders yourself', done: !!(contactPhone || effectiveWhatsapp) },
          ]}
        />
      )}

      {/* ── Header ── */}
      {!profile?.phone && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              Add your phone number in Settings → Profile to receive SMS and voice call reminders.
            </p>
            <Link
              to="/dashboard/settings?tab=profile"
              onClick={(e) => {
                e.preventDefault();
                goToProfileSettings();
              }}
              className="inline-flex items-center gap-1 mt-1.5 text-sm font-semibold text-amber-700 dark:text-amber-300 hover:underline"
            >
              Add phone number →
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reminders &amp; Messages</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Remind yourself, your guests, and extra people (coworkers or anyone else) — not just meetings. Email, SMS, WhatsApp, or Voice for you and guests; extra people get email, SMS, or WhatsApp (no voice).
          </p>
        </div>
        {hasAnyReminders && (
          <button
            onClick={() => { setWizardChannels(getDefaultWizardChannels()); setPreviewChannel(defaultWizardChannel); setShowAddForm(true); setWizardStep(1); }}
            className="shrink-0 inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2 text-white text-sm font-semibold rounded-xl transition-all hover:opacity-90" style={{ backgroundColor: '#5864C6' }}
          >
            <Plus className="h-4 w-4" /> Add Reminder
          </button>
        )}
      </div>

      <VoicePersonalReminder />

      <AlsoRemindPeople />

      {isPro && (
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => { setShowTestSms((v) => !v); setTestSmsResult(null); }}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-slate-400" />
              Test SMS, WhatsApp &amp; voicemail
            </span>
            {showTestSms ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </button>
          {showTestSms && (
            <div className="border-t border-slate-200 dark:border-slate-800 px-5 py-4 space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Send a sample to this number now. SMS sends a text; voicemail places a Twilio call. WhatsApp uses an approved Twilio Utility template (not a freeform chat). If that template is missing, you will see an error instead of a false “sent”. Results show in Activity log.
              </p>
              <input
                type="tel"
                value={testSmsPhone}
                onChange={(e) => { setTestSmsPhone(e.target.value); setTestSmsResult(null); }}
                onBlur={(e) => { if (e.target.value.trim()) setTestSmsPhone(blurFormatPhone(e.target.value)); }}
                placeholder={PHONE_PLACEHOLDER}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5864C6] transition"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleTestMessage('sms')}
                  disabled={testSmsSending || testWhatsappSending || testVoiceSending || !testSmsPhone.trim()}
                  className="px-4 py-2 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 shrink-0 hover:opacity-90" style={{ backgroundColor: '#5864C6' }}
                >
                  {testSmsSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                  {testSmsSending ? 'Sending…' : 'Test SMS'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleTestMessage('whatsapp')}
                  disabled={testSmsSending || testWhatsappSending || testVoiceSending || !testSmsPhone.trim()}
                  className="px-4 py-2 disabled:opacity-50 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shrink-0 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {testWhatsappSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                  {testWhatsappSending ? 'Sending…' : 'Test WhatsApp'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleTestMessage('voice')}
                  disabled={testSmsSending || testWhatsappSending || testVoiceSending || !testSmsPhone.trim()}
                  className="px-4 py-2 disabled:opacity-50 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shrink-0 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {testVoiceSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneCall className="h-4 w-4" />}
                  {testVoiceSending ? 'Calling…' : 'Test voicemail'}
                </button>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">{PHONE_HINT}</p>
              <SmsBookingConsent className="text-xs text-gray-500 dark:text-slate-400 mt-1" />
              {testSmsResult && (
                <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm ${
                  testSmsResult.ok
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200'
                    : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
                }`}>
                  {testSmsResult.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
                  <span className="whitespace-pre-wrap">{testSmsResult.message}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Activity log</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Email, SMS, WhatsApp, and voice messages — including tests and extra reminders.
            </p>
          </div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[420px] overflow-y-auto">
          {log.map((entry) => (
            <div key={entry.id} className="px-5 py-3 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <ChannelIcon
                  channel={entry.channel}
                  className={`h-4 w-4 shrink-0 mt-0.5 ${entry.channel === 'email' ? 'text-blue-400' : entry.channel === 'voice' ? 'text-violet-400' : entry.channel === 'sms' ? 'text-amber-400' : ''}`}
                  style={entry.channel === 'whatsapp' ? { color: '#5864C6' } : undefined}
                />
                <div className="min-w-0">
                  <p className="text-sm text-slate-900 dark:text-white truncate">{entry.recipient}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{entry.subject || entry.body}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full ${entry.status === 'sent' || entry.status === 'delivered' ? '' : entry.status === 'failed' ? 'bg-red-500/10 text-red-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`} style={entry.status === 'sent' || entry.status === 'delivered' ? { backgroundColor: '#5864C620', color: '#5864C6' } : {}}>
                  {entry.status}
                </span>
                <span className="text-[11px] text-slate-400">
                  {new Date(entry.sent_at || entry.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
          {log.length === 0 && (
            <p className="px-5 py-8 text-center text-slate-400 text-sm">No messages sent yet. Use the test section above to send a sample SMS, WhatsApp, or voicemail.</p>
          )}
        </div>
      </div>

      {/* ── FIRST-TIME SETUP GUIDE (shown when no reminders exist, not for Pro) ── */}
      {!hasAnyReminders && !showAddForm && !isPro && (
        <div className="rounded-2xl border-2 border-dashed border-[#5864C6]/30 dark:border-[#5864C6]/20 bg-[#5864C6]/5 dark:bg-[#5864C6]/5 p-8 text-center">
          <div className="h-16 w-16 rounded-2xl bg-[#5864C6]/10 dark:bg-[#5864C6]/20 flex items-center justify-center mx-auto mb-5">
            <Bell className="h-8 w-8" style={{ color: '#5864C6' }} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Never miss anything — not just meetings
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 max-w-md mx-auto">
            Set up reminders for anything you don't want to miss — a flight, a prescription refill, a kid's pickup, or a meeting. Stack multiple reminders across email, SMS, WhatsApp, and voice. Set it up in 3 simple steps.
          </p>

          {/* 3-step visual */}
          <div className="grid sm:grid-cols-3 gap-4 mb-8 text-left max-w-lg mx-auto">
            {[
              { n: '1', title: 'Pick your timing', desc: 'How far in advance to remind your guest' },
              { n: '2', title: 'Pick your channels', desc: 'Email, SMS, and/or WhatsApp' },
              { n: '3', title: 'Customize your message', desc: 'Or use our ready-made template' },
            ].map((step) => (
              <div key={step.n} className="flex gap-3 items-start">
                <span className="h-7 w-7 rounded-full text-white text-sm font-black flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: '#5864C6' }}>{step.n}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{step.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => { setWizardChannels(getDefaultWizardChannels()); setPreviewChannel(defaultWizardChannel); setShowAddForm(true); setWizardStep(1); }}
            className="inline-flex items-center gap-2 px-8 py-3.5 text-white font-bold rounded-xl transition-all shadow-lg text-base hover:opacity-90" style={{ backgroundColor: '#5864C6' }}
          >
            <Zap className="h-5 w-5" /> Set Up My First Reminder
          </button>
          <p className="mt-4 text-xs text-slate-400">Or pick a quick-start template below</p>
        </div>
      )}

      {/* ── QUICK SETUP TEMPLATES — hidden for Pro users ── */}
      {!showAddForm && !isPro && (
        <div>
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
            {hasAnyReminders ? 'Add more reminders with one click' : 'Quick-start templates'}
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {QUICK_TEMPLATES.map((qt) => {
              const alreadyApplied = qt.combos.every((c) => isSlotChannelActive(c.slotKey, c.channel));
              const requiresPro = qt.id === 'pro';
              const locked = requiresPro && !isPro;
              const Icon = qt.icon || Mail;
              return (
                <div
                  key={qt.id}
                  className={`rounded-2xl border p-5 transition-all ${
                    alreadyApplied
                      ? 'border-[#5864C6]/40 bg-[#5864C6]/5 dark:bg-[#5864C6]/10'
                      : locked
                      ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 opacity-80'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-[#5864C6]/40 dark:hover:border-[#5864C6]/40 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${alreadyApplied ? 'bg-[#5864C6]/10 dark:bg-[#5864C6]/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      <Icon className={`h-5 w-5 ${alreadyApplied ? 'text-[#5864C6]' : qt.iconColor}`} />
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${qt.badgeColor}`}>{qt.badge}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">{qt.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{qt.description}</p>
                  {alreadyApplied ? (
                    <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#5864C6' }}>
                      <CheckCircle2 className="h-4 w-4" /> Applied
                    </div>
                  ) : locked ? (
                    <div>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">This is a Pro feature — upgrade for $6/mo, cancel anytime.</p>
                      <a
                        href="/dashboard/billing"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        Upgrade to Pro
                      </a>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleApplyQuickTemplate(qt.id)}
                      disabled={applyingQuick === qt.id}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold hover:opacity-80 transition-colors disabled:opacity-50"
                      style={{ color: '#5864C6' }}
                    >
                      {applyingQuick === qt.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                      Apply this template
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ADD REMINDER WIZARD ── */}
      {showAddForm && (
        <div className="rounded-2xl border border-[#5864C6]/30 dark:border-[#5864C6]/20 bg-white dark:bg-slate-900/60 overflow-hidden shadow-lg">
          {/* Wizard header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
            <div className="flex items-center gap-3">
              {([1, 2, 3] as const).map((s) => (
                <div key={s} className="flex items-center gap-2">
                  {s > 1 && <div className={`h-px w-6 ${wizardStep >= s ? 'bg-[#5864C6]' : 'bg-slate-200 dark:bg-slate-700'}`} />}
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${wizardStep === s ? 'text-white shadow-md' : wizardStep > s ? 'bg-[#5864C6]/10 dark:bg-[#5864C6]/20' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}
                    style={wizardStep === s ? { backgroundColor: '#5864C6' } : wizardStep > s ? { color: '#5864C6' } : {}}
                  >
                    {wizardStep > s ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : s}
                  </div>
                  {!showAddForm ? null : (
                    <span className={`text-xs font-medium hidden sm:block ${wizardStep === s ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                      {s === 1 ? 'When?' : s === 2 ? 'How?' : 'Message'}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => { setShowAddForm(false); setWizardStep(1); }} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            {/* Step 1: Timing */}
            {wizardStep === 1 && (
              <div>
                <p className="text-base font-bold text-slate-900 dark:text-white mb-1">When should we remind your guest?</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Pick how far in advance to send the reminder.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                  {TIMING_OPTIONS.map((opt) => {
                    const anyActive = (['email', 'sms', 'whatsapp'] as Channel[]).some((ch) => isSlotChannelActive(opt.slotKey, ch));
                    return (
                      <button
                        key={opt.slotKey}
                        onClick={() => setWizardTiming(opt.slotKey)}
                        className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                          wizardTiming === opt.slotKey
                            ? 'border-[#5864C6] bg-[#5864C6]/5 dark:bg-[#5864C6]/10'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Clock className={`h-4 w-4 ${wizardTiming === opt.slotKey ? 'text-[#5864C6]' : 'text-slate-400'}`} />
                          {anyActive && <span className="text-[10px] font-semibold text-white px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#5864C6' }}>Active</span>}
                        </div>
                        <p className={`text-sm font-semibold mt-1 ${wizardTiming === opt.slotKey ? 'text-[#5864C6] dark:text-[#8891e8]' : 'text-slate-800 dark:text-slate-200'}`}>{opt.label}</p>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setWizardStep(2)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-white font-semibold rounded-xl transition-all hover:opacity-90" style={{ backgroundColor: '#5864C6' }}
                >
                  Next: Pick channels <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Step 2: Channels */}
            {wizardStep === 2 && (
              <div>
                <p className="text-base font-bold text-slate-900 dark:text-white mb-1">How should we send the reminder?</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Select all channels you want — any combination is allowed.</p>
                <div className="mb-6">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3 block">Channel</span>
                  <div className="flex gap-5">
                    {CHANNEL_INFO.map((ch) => {
                      const checked = wizardChannels.has(ch.key);
                      const isLast = wizardChannels.size === 1 && checked;
                      return (
                        <label
                          key={ch.key}
                          title={isLast ? 'At least one channel required' : undefined}
                          className={`flex items-center gap-2.5 cursor-pointer select-none group ${isLast ? 'cursor-not-allowed' : ''}`}
                        >
                          <div className="relative">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                if (isLast) return;
                                const next = new Set(wizardChannels);
                                if (next.has(ch.key)) next.delete(ch.key);
                                else next.add(ch.key);
                                setWizardChannels(next);
                              }}
                              className="sr-only"
                            />
                            <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all ${
                              checked
                                ? 'bg-brand-600 border-brand-600'
                                : 'border-slate-300 dark:border-slate-600 group-hover:border-brand-400'
                            }`}>
                              {checked && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
                            </div>
                          </div>
                          <ChannelIcon channel={ch.key} className={`h-4 w-4 shrink-0 ${checked ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500'}`} />
                          <span className={`text-sm font-medium ${checked ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>{ch.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                {(wizardChannels.has('sms') && !contactPhone) || (wizardChannels.has('whatsapp') && !effectiveWhatsapp) || (wizardChannels.has('voice') && !contactPhone) ? (
                  <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs text-amber-700 dark:text-amber-400 space-y-1">
                    {(wizardChannels.has('sms') || wizardChannels.has('voice')) && !contactPhone && (
                      <p>
                        Add a phone number in{' '}
                        <Link to="/dashboard/settings?tab=profile" className="font-semibold underline">Settings → Profile</Link>
                        {' '}to enable SMS and voice reminders to you.
                      </p>
                    )}
                    {wizardChannels.has('whatsapp') && !effectiveWhatsapp && (
                      <p>
                        Add a phone or WhatsApp number in{' '}
                        <Link to="/dashboard/settings?tab=profile" className="font-semibold underline">Settings → Profile</Link>
                        {' '}to enable WhatsApp reminders.
                      </p>
                    )}
                  </div>
                ) : null}
                <div className="flex items-center gap-3">
                  <button onClick={() => setWizardStep(1)} className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                    Back
                  </button>
                  <button
                    onClick={() => {
                      initWizardBodies(wizardTiming, wizardChannels);
                      setPreviewChannel(Array.from(wizardChannels)[0]);
                      setWizardStep(3);
                    }}
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-white font-semibold rounded-xl transition-all hover:opacity-90" style={{ backgroundColor: '#5864C6' }}
                  >
                    Next: Customize message <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Message + Live Preview */}
            {wizardStep === 3 && (
              <div>
                <p className="text-base font-bold text-slate-900 dark:text-white mb-1">Customize your message</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Pre-filled with a template — edit as needed. Variables like {'{{'+'guest_name}}'} are replaced automatically.</p>

                <div className="grid md:grid-cols-2 gap-5">
                  {/* Editor side */}
                  <div className="space-y-4">
                    {/* Channel tabs */}
                    {wizardChannels.size > 1 && (
                      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        {Array.from(wizardChannels).map((ch) => {
                          const info = CHANNEL_INFO.find((c) => c.key === ch);
                          return (
                            <button
                              key={ch}
                              onClick={() => setPreviewChannel(ch)}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                previewChannel === ch ? 'bg-white dark:bg-slate-900 shadow text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                              }`}
                            >
                              <ChannelIcon channel={ch} className="h-3.5 w-3.5" />
                              {info?.label ?? ch}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {wizardChannels.has('email') && previewChannel === 'email' && (
                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Email subject</label>
                        <input type="text" value={wizardSubject} onChange={(e) => setWizardSubject(e.target.value)} className={inputCls} placeholder="Subject line..." />
                      </div>
                    )}

                    {Array.from(wizardChannels).map((ch) => (
                      previewChannel !== ch ? null : (
                        <div key={ch}>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              {ch === 'voice' ? 'Voice message script' : 'Message body'}
                            </label>
                            {ch === 'sms' && (
                              <span className={`text-xs ${wizardBodies[ch].length > 160 ? 'text-amber-500' : 'text-slate-400'}`}>
                                {wizardBodies[ch].length}/160
                              </span>
                            )}
                          </div>
                          {ch === 'voice' && (
                            <p className="text-xs text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded-lg px-3 py-2 mb-2">
                              This script will be read aloud to the guest via an automated phone call using Twilio.
                            </p>
                          )}
                          <textarea
                            value={wizardBodies[ch]}
                            onChange={(e) => setWizardBodies((prev) => ({ ...prev, [ch]: e.target.value }))}
                            rows={ch === 'email' ? 7 : 4}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#5864C6] transition resize-none font-mono"
                          />
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {TEMPLATE_VARIABLES.slice(0, 6).map((v) => (
                              <button
                                key={v.key}
                                onClick={() => setWizardBodies((prev) => ({ ...prev, [ch]: prev[ch] + v.key }))}
                                className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs text-slate-600 dark:text-slate-300 rounded transition-colors"
                                title={v.label}
                              >
                                {v.key}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    ))}
                  </div>

                  {/* Live preview side */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Live preview</p>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden">
                      {/* Preview channel pill */}
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        {(() => {
                          const ch = previewChannel;
                          const info = CHANNEL_INFO.find((c) => c.key === ch);
                          return <><ChannelIcon channel={ch} className={`h-4 w-4 ${info?.color ?? ''}`} /><span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{info?.label ?? ch} preview</span></>;
                        })()}
                      </div>
                      <div className="p-4">
                        {previewChannel === 'email' && wizardSubject && (
                          <p className="text-sm font-bold text-slate-900 dark:text-white mb-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                            {renderPreview(wizardSubject)}
                          </p>
                        )}
                        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {renderPreview(wizardBodies[previewChannel] || CHANNEL_TEMPLATES[wizardTiming]?.[previewChannel]?.body || '')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-6">
                  <button onClick={() => setWizardStep(2)} className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                    Back
                  </button>
                  <button
                    onClick={handleWizardSave}
                    disabled={wizardSaving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-white font-semibold rounded-xl transition-all disabled:opacity-60 hover:opacity-90" style={{ backgroundColor: '#5864C6' }}
                  >
                    {wizardSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Save reminder
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ACTIVE REMINDERS GRID ── */}
      {hasAnyReminders && !showAddForm && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Active reminders
              <span className="ml-2 px-1.5 py-0.5 text-white rounded-full text-[10px]" style={{ backgroundColor: '#5864C6' }}>{activeCount}</span>
            </p>
          </div>

          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="min-w-[540px] bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            {/* Column headers — 5-column grid: When + 4 channels */}
            <div
              className={`${REMINDER_MATRIX_GRID} items-center px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800`}
            >
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">When</span>
              {CHANNEL_INFO.map((ch) => (
                <div key={ch.key} className={`flex flex-col items-center justify-center gap-1 text-center ${ch.color}`}>
                  <ChannelIcon channel={ch.key} className="h-5 w-5 shrink-0" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide leading-tight max-w-full">
                    {ch.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {REMINDER_SLOTS.map((slot) => {
                const anyActive = CHANNEL_INFO.some((ch) => isSlotChannelActive(slot.key, ch.key));
                return (
                  <div
                    key={slot.key}
                    className={`${REMINDER_MATRIX_GRID} items-center px-5 py-4 transition-colors ${anyActive ? 'hover:bg-[#5864C6]/5 dark:hover:bg-[#5864C6]/5' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20 opacity-60'}`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{slot.label}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{slot.sublabel}</p>
                    </div>
                    {CHANNEL_INFO.map((ch) => {
                      const savingId = `${slot.key}-${ch.key}`;
                      const isSaving = savingSlot === savingId;
                      const checked = isSlotChannelActive(slot.key, ch.key);
                      return (
                        <div key={ch.key} className="flex justify-center">
                          {isSaving ? (
                            <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#5864C6' }} />
                          ) : (
                            <button
                              onClick={() => handleToggleSlotChannel(slot.key, ch.key)}
                              className={`min-h-11 min-w-11 rounded-lg flex items-center justify-center border-2 transition-all ${
                                checked
                                  ? 'border-transparent'
                                  : 'border-slate-300 dark:border-slate-600 hover:border-[#5864C6]/50'
                              }`}
                              style={checked ? { backgroundColor: '#5864C6', borderColor: '#5864C6' } : {}}
                            >
                              {checked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
          </div>
        </div>
      )}

      {/* ── EMPTY STATE (has visited but removed all) ── */}
      {hasAnyReminders && templates.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <Bell className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">Your guests won't receive any notifications yet</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mb-5">Add a reminder to start sending automated messages.</p>
          <button
            onClick={() => { setWizardChannels(getDefaultWizardChannels()); setPreviewChannel(defaultWizardChannel); setShowAddForm(true); setWizardStep(1); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-white font-semibold rounded-xl transition-all hover:opacity-90" style={{ backgroundColor: '#5864C6' }}
          >
            <Plus className="h-4 w-4" /> Add First Reminder
          </button>
        </div>
      )}

      {/* ── CONTACT CHANNELS ── */}
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Your contact channels</p>
            <p className="text-xs text-slate-400 mt-0.5">Needed for SMS and WhatsApp reminders</p>
          </div>
          {!editingContact && (
            <button
              onClick={() => setEditingContact(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          )}
        </div>

        {editingContact ? (
          <div className="px-5 py-4 space-y-3">
            {[
              { label: 'Phone (SMS)', icon: Smartphone, value: contactPhone, setter: setContactPhone, placeholder: PHONE_PLACEHOLDER, hint: PHONE_HINT },
              { label: 'WhatsApp number', icon: MessageSquare, value: contactWhatsapp, setter: setContactWhatsapp, placeholder: PHONE_PLACEHOLDER, hint: PHONE_HINT },
            ].map(({ label, icon: Glyph, value, setter, placeholder, hint }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 flex justify-center shrink-0">
                  {Glyph ? <Glyph className="h-4 w-4 text-slate-400" /> : null}
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</label>
                  <input
                    type="tel"
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    onBlur={() => { if (value.trim()) setter(blurFormatPhone(value)); }}
                    placeholder={placeholder}
                    className={inputCls}
                  />
                  {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
                </div>
              </div>
            ))}
            <SmsBookingConsent className="text-xs text-gray-500 dark:text-slate-400 mt-1" />
            <div className="flex items-center gap-2 pt-1">
              <button onClick={handleSaveContact} disabled={savingContact} className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 hover:opacity-90" style={{ backgroundColor: '#5864C6' }}>
                {savingContact ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
              </button>
              <button onClick={() => setEditingContact(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <div className="flex items-center gap-3 px-5 py-3">
              <Mail className="h-4 w-4 text-blue-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Email</span>
                <p className="text-sm text-slate-800 dark:text-slate-200 mt-0.5">{profile?.email}</p>
              </div>
              <span className="text-xs px-2 py-0.5 text-white rounded-full font-medium" style={{ backgroundColor: '#5864C6' }}>Active</span>
            </div>
            {[
              { label: 'SMS', icon: Smartphone, value: contactPhone, placeholder: 'Add phone to enable SMS' },
              { label: 'WhatsApp', icon: MessageSquare, value: contactWhatsapp || (effectiveWhatsapp && !contactWhatsapp ? blurFormatPhone(effectiveWhatsapp) : ''), placeholder: 'Add number to enable WhatsApp' },
            ].map(({ label, icon: Glyph, value, placeholder }) => (
              <div
                key={label}
                role={!value ? 'button' : undefined}
                tabIndex={!value ? 0 : undefined}
                onClick={!value ? () => setEditingContact(true) : undefined}
                onKeyDown={!value ? (e) => { if (e.key === 'Enter' || e.key === ' ') setEditingContact(true); } : undefined}
                className={`flex items-center gap-3 px-5 py-3 ${!value ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors' : ''}`}
              >
                {Glyph ? <Glyph className="h-4 w-4 text-slate-400 shrink-0" /> : null}
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
                  <p className={`text-sm mt-0.5 ${value ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 italic'}`}>{value || placeholder}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${value ? 'text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                  style={value ? { backgroundColor: '#5864C6' } : {}}>
                  {value ? 'Active' : 'Not set'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ADVANCED SECTION ── */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl">
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors rounded-2xl"
        >
          <span className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-slate-400" />
            Message Templates, Logs &amp; Voice defaults
          </span>
          {showAdvanced ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>

        {showAdvanced && (
          <div className="border-t border-slate-200 dark:border-slate-800">
            <div className="flex gap-0 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 overflow-x-auto">
              {([
                { key: 'voice' as const, label: 'Voice defaults', icon: PhoneCall },
                { key: 'slack' as const, label: 'Slack', icon: MessageSquare },
                { key: 'templates' as const, label: 'Templates', icon: Mail },
                { key: 'rules' as const, label: 'Rules', icon: Bell },
                { key: 'log' as const, label: 'Message Log', icon: Eye },
                { key: 'critical' as const, label: 'Critical Alerts', icon: BellRing },
              ]).map((t) => {
                const Icon = t.icon || Mail;
                return (
                <button key={t.key} onClick={() => setAdvancedTab(t.key)}
                  className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${advancedTab === t.key ? 'border-[#5864C6] text-[#5864C6] dark:text-[#8891e8] bg-white dark:bg-slate-900/50' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                  <Icon className={`h-3.5 w-3.5 ${t.key === 'critical' ? 'text-red-500' : ''}`} />{t.label}
                </button>
                );
              })}
            </div>

            <div className="p-5">
              {advancedTab === 'voice' && <PersonalReminderDefaultsEditor />}

              {advancedTab === 'slack' && (
                <div className="space-y-3 max-w-xl">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Optional Incoming Webhook. After a booking confirmation or reminder is emailed or texted, PinOnIt posts the same copy to this Slack channel. Failures are logged and never block the booking.
                  </p>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Slack webhook URL
                  </label>
                  <input
                    type="url"
                    value={slackWebhookUrl}
                    onChange={(e) => { setSlackWebhookUrl(e.target.value); setSlackMsg(''); }}
                    placeholder="https://hooks.slack.com/services/…"
                    className="w-full min-h-11 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-base text-slate-900 dark:text-white"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveSlackWebhook()}
                      disabled={savingSlack}
                      className="min-h-11 px-4 rounded-xl text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
                      style={{ backgroundColor: '#5864C6' }}
                    >
                      {savingSlack ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleTestSlack()}
                      disabled={testingSlack || !slackWebhookUrl.trim()}
                      className="min-h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-50 inline-flex items-center gap-2"
                    >
                      {testingSlack ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                      Send test message
                    </button>
                  </div>
                  {slackMsg && (
                    <p className={`text-sm ${slackMsg.startsWith('URL') || slackMsg.toLowerCase().includes('fail') || slackMsg.toLowerCase().includes('error') ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>
                      {slackMsg}
                    </p>
                  )}
                </div>
              )}

              {/* Templates tab */}
              {advancedTab === 'templates' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">These templates define the content of each reminder. Enable reminders using the checkboxes above.</p>
                    </div>
                    <button onClick={() => { resetTemplateForm(); setShowTemplateForm(true); }}
                      className="px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-1.5 shrink-0 hover:opacity-90" style={{ backgroundColor: '#5864C6' }}>
                      <Plus className="h-3.5 w-3.5" /> New template
                    </button>
                  </div>

                  {showTemplateForm && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl mb-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">{editingTemplate ? 'Edit template' : 'New template'}</h3>
                        <button onClick={resetTemplateForm} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"><X className="h-4 w-4" /></button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Name</label>
                          <input type="text" value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="e.g. Day-before reminder" className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Type</label>
                          <select value={tplType} onChange={(e) => setTplType(e.target.value as MessageTemplate['type'])} className={selectCls}>
                            <option value="confirmation">Confirmation</option>
                            <option value="reminder">Reminder</option>
                            <option value="follow_up">Follow-up</option>
                            <option value="custom">Custom</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Channel</label>
                          <select value={tplChannel} onChange={(e) => setTplChannel(e.target.value as MessageTemplate['channel'])} className={selectCls}>
                            <option value="email">Email</option>
                            <option value="sms">SMS</option>
                            <option value="whatsapp">WhatsApp</option>
                            <option value="voice">Voice Call</option>
                            <option value="both">Email + SMS</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">When to send</label>
                          <div className="flex items-center gap-2 flex-wrap">
                            <input type="number" min={0} value={tplOffsetHours}
                              onChange={(e) => { const h = Math.max(0, parseInt(e.target.value) || 0); setTplOffsetHours(h); setTplOffset(computeOffset(h, tplOffsetMinutes, tplOffsetDirection)); }}
                              className="w-16 px-2 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#5864C6] transition" />
                            <span className="text-xs text-slate-600 dark:text-slate-300">hr</span>
                            <input type="number" min={0} max={59} value={tplOffsetMinutes}
                              onChange={(e) => { const m = Math.min(59, Math.max(0, parseInt(e.target.value) || 0)); setTplOffsetMinutes(m); setTplOffset(computeOffset(tplOffsetHours, m, tplOffsetDirection)); }}
                              className="w-16 px-2 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#5864C6] transition" />
                            <span className="text-xs text-slate-600 dark:text-slate-300">min</span>
                            <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                              {(['before', 'after'] as const).map((d) => (
                                <button key={d} type="button"
                                  onClick={() => { setTplOffsetDirection(d); setTplOffset(computeOffset(tplOffsetHours, tplOffsetMinutes, d)); }}
                                  className={`px-2 py-1.5 text-xs font-medium capitalize transition-colors ${tplOffsetDirection === d ? 'bg-brand-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                  {d}
                                </button>
                              ))}
                            </div>
                          </div>
                          <p className="text-xs mt-1" style={{ color: '#5864C6' }}>{formatOffset(tplOffset)}</p>
                        </div>
                      </div>
                      {tplChannel !== 'sms' && tplChannel !== 'whatsapp' && (
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Email subject</label>
                          <input type="text" value={tplSubject} onChange={(e) => setTplSubject(e.target.value)} placeholder="e.g. Your appointment is confirmed" className={inputCls} />
                        </div>
                      )}
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Message body</label>
                        <textarea value={tplBody} onChange={(e) => setTplBody(e.target.value)} rows={4}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#5864C6] transition resize-none font-mono"
                          placeholder="Hi {{guest_name}}, your {{service_name}} is confirmed..." />
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {TEMPLATE_VARIABLES.map((v) => (
                            <button key={v.key} onClick={() => setTplBody((prev) => prev + v.key)}
                              className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs text-slate-600 dark:text-slate-300 rounded transition-colors" title={v.label}>
                              {v.key}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm font-medium"><Languages className="h-4 w-4" style={{ color: '#5864C6' }} />AI auto-translate</div>
                          <Toggle on={tplAutoTranslate} onChange={() => setTplAutoTranslate(!tplAutoTranslate)} />
                        </div>
                        {tplAutoTranslate && (
                          <div className="mt-2">
                            <select value={tplLanguage} onChange={(e) => setTplLanguage(e.target.value)} className={selectCls}>
                              {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                      {tplBody && (
                        <div>
                          <button onClick={() => setPreviewOpen(previewOpen === 'form' ? null : 'form')} className="text-xs hover:opacity-80 inline-flex items-center gap-1" style={{ color: '#5864C6' }}>
                            {previewOpen === 'form' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} Preview with sample data
                          </button>
                          {previewOpen === 'form' && (
                            <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                              {tplSubject && tplChannel !== 'sms' && tplChannel !== 'whatsapp' && (
                                <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">{renderPreview(tplSubject)}</p>
                              )}
                              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{renderPreview(tplBody)}</p>
                            </div>
                          )}
                        </div>
                      )}
                      <button onClick={handleSaveTemplate} disabled={savingTemplate || !tplName || !tplBody}
                        className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 hover:opacity-90" style={{ backgroundColor: '#5864C6' }}>
                        {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        {editingTemplate ? 'Update' : 'Create'} template
                      </button>
                    </div>
                  )}

                  <div className="space-y-2">
                    {templates.map((tpl) => {
                      const checkboxActive = isTemplateCheckboxActive(tpl);
                      return (
                      <div key={tpl.id} className="p-3.5 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ChannelIcon
                              channel={tpl.channel}
                              className={`h-4 w-4 shrink-0 ${tpl.channel === 'sms' ? 'text-amber-400' : tpl.channel === 'voice' ? 'text-violet-400' : tpl.channel === 'email' || tpl.channel === 'both' ? 'text-blue-400' : ''}`}
                              style={tpl.channel === 'whatsapp' ? { color: '#5864C6' } : undefined}
                            />
                            <span className="font-medium text-sm truncate">{tpl.name}</span>
                            <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full shrink-0 capitalize">{tpl.type.replace('_', ' ')}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${checkboxActive ? 'text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`} style={checkboxActive ? { backgroundColor: '#5864C6' } : {}}>
                              {checkboxActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-slate-400 flex items-center gap-1"><Clock className="h-3 w-3" />{formatOffset(tpl.timing_offset_minutes)}</span>
                            <button onClick={() => startEditTemplate(tpl)} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"><Eye className="h-4 w-4" /></button>
                            <button onClick={() => handleDeleteTemplate(tpl.id)} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </div>
                        {tpl.subject && <p className="text-xs text-slate-500 mt-1 pl-6">Subject: {tpl.subject}</p>}
                        <p className="text-xs text-slate-400 line-clamp-1 mt-0.5 pl-6">{tpl.body}</p>
                      </div>
                      );
                    })}
                    {templates.length === 0 && !showTemplateForm && (
                      <p className="text-center py-8 text-slate-400 text-sm">No custom templates yet.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Rules tab */}
              {advancedTab === 'rules' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Link templates to services with custom timing rules.</p>
                    <button onClick={() => setShowRuleForm(true)} disabled={templates.length === 0}
                      className="px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 shrink-0 hover:opacity-90" style={{ backgroundColor: '#5864C6' }}>
                      <Plus className="h-3.5 w-3.5" /> Add rule
                    </button>
                  </div>
                  {templates.length === 0 && (
                    <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs text-amber-700 dark:text-amber-400">
                      Create a template first. <button onClick={() => setAdvancedTab('templates')} className="underline font-medium">Go to Templates</button>
                    </div>
                  )}
                  {showRuleForm && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl mb-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">New reminder rule</h3>
                        <button onClick={() => { setShowRuleForm(false); setRuleIsCritical(false); }} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"><X className="h-4 w-4" /></button>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Message template</label>
                        <select value={ruleTemplateId} onChange={(e) => setRuleTemplateId(e.target.value)} className={selectCls}>
                          <option value="">Select a template...</option>
                          {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.channel})</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Service (empty = all)</label>
                        <select value={ruleServiceId} onChange={(e) => setRuleServiceId(e.target.value)} className={selectCls}>
                          <option value="">All services</option>
                          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">When to send</label>
                        <div className="flex items-center gap-2 flex-wrap">
                          <input type="number" min={0} value={ruleOffsetHours}
                            onChange={(e) => { const h = Math.max(0, parseInt(e.target.value) || 0); setRuleOffsetHours(h); setRuleOffset(computeOffset(h, ruleOffsetMinutes, ruleOffsetDirection)); }}
                            className="w-20 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#5864C6] transition" />
                          <span className="text-sm text-slate-600 dark:text-slate-300">hr</span>
                          <input type="number" min={0} max={59} value={ruleOffsetMinutes}
                            onChange={(e) => { const m = Math.min(59, Math.max(0, parseInt(e.target.value) || 0)); setRuleOffsetMinutes(m); setRuleOffset(computeOffset(ruleOffsetHours, m, ruleOffsetDirection)); }}
                            className="w-20 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#5864C6] transition" />
                          <span className="text-sm text-slate-600 dark:text-slate-300">min</span>
                          <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                            {(['before', 'after'] as const).map((d) => (
                              <button key={d} type="button"
                                onClick={() => { setRuleOffsetDirection(d); setRuleOffset(computeOffset(ruleOffsetHours, ruleOffsetMinutes, d)); }}
                                className={`px-3 py-2 text-xs font-medium capitalize transition-colors ${ruleOffsetDirection === d ? 'bg-brand-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                {d}
                              </button>
                            ))}
                          </div>
                        </div>
                        <p className="text-xs mt-1" style={{ color: '#5864C6' }}>{formatOffset(ruleOffset)}</p>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-xl">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          <div>
                            <p className="text-xs font-semibold text-red-700 dark:text-red-400">Critical</p>
                            <p className="text-xs text-red-600/60 dark:text-red-400/50">Sends multi-channel reminders aggressively</p>
                          </div>
                        </div>
                        <Toggle on={ruleIsCritical} onChange={() => setRuleIsCritical((v) => !v)} />
                      </div>
                      <button onClick={handleSaveRule} disabled={savingRule || !ruleTemplateId}
                        className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 hover:opacity-90" style={{ backgroundColor: '#5864C6' }}>
                        {savingRule ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Add rule
                      </button>
                    </div>
                  )}
                  {rules.length > 0 ? (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                      {rules.map((rule) => (
                        <div key={rule.id} className="flex items-center gap-4 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`text-sm font-medium ${rule.is_active ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{rule.template?.name ?? 'Unknown'}</p>
                              {rule.is_critical && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-semibold rounded"><AlertTriangle className="h-3 w-3" />CRITICAL</span>}
                            </div>
                            {rule.service && <p className="text-xs text-slate-400 mt-0.5">{(rule.service as Service).name}</p>}
                          </div>
                          <Toggle on={rule.is_active} onChange={() => handleToggleRule(rule)} />
                          <span className="text-xs text-slate-400 hidden sm:block w-36 shrink-0">{formatOffset(rule.timing_offset_minutes)}</span>
                          <div className="relative shrink-0">
                            <button onClick={() => setOpenMenu(openMenu === rule.id ? null : rule.id)} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {openMenu === rule.id && (
                              <div className="absolute right-0 top-8 z-20 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1">
                                <button onClick={() => { handleToggleCritical(rule); setOpenMenu(null); }} className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                                  <AlertTriangle className="h-3.5 w-3.5 text-red-400" />{rule.is_critical ? 'Remove critical' : 'Mark critical'}
                                </button>
                                {rule.template && (
                                  <button onClick={() => { startEditTemplate(rule.template!); setOpenMenu(null); }} className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                                    <Eye className="h-3.5 w-3.5" />Edit template
                                  </button>
                                )}
                                <button onClick={() => handleDeleteRule(rule.id)} className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
                                  <Trash2 className="h-3.5 w-3.5" />Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !showRuleForm && (
                    <p className="text-center py-8 text-slate-400 text-sm">No custom rules yet.</p>
                  )}
                </div>
              )}

              {/* Log tab */}
              {advancedTab === 'log' && (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Full history also appears in Activity log above.</p>
                  <div className="space-y-2">
                    {log.map((entry) => (
                      <div key={entry.id} className="p-3 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <ChannelIcon
                            channel={entry.channel}
                            className={`h-4 w-4 shrink-0 ${entry.channel === 'email' ? 'text-blue-400' : entry.channel === 'voice' ? 'text-violet-400' : entry.channel === 'sms' ? 'text-amber-400' : ''}`}
                            style={entry.channel === 'whatsapp' ? { color: '#5864C6' } : undefined}
                          />
                          <div className="min-w-0">
                            <p className="text-sm truncate">{entry.recipient}</p>
                            {entry.subject && <p className="text-xs text-slate-400 truncate">{entry.subject}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {entry.language !== 'en' && <span className="text-xs inline-flex items-center gap-0.5" style={{ color: '#5864C6' }}><Languages className="h-3 w-3" />{SUPPORTED_LANGUAGES[entry.language] ?? entry.language}</span>}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${entry.status === 'sent' || entry.status === 'delivered' ? 'text-white' : entry.status === 'failed' ? 'bg-red-500/10 text-red-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`} style={entry.status === 'sent' || entry.status === 'delivered' ? { backgroundColor: '#5864C620', color: '#5864C6' } : {}}>{entry.status}</span>
                          <span className="text-xs text-slate-400">{new Date(entry.sent_at || entry.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                    {log.length === 0 && <p className="text-center py-8 text-slate-400 text-sm">No messages sent yet.</p>}
                  </div>
                </div>
              )}

              {/* Critical Alerts tab */}
              {advancedTab === 'critical' && (
                <div className="space-y-5 max-w-lg">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-brand-50 dark:bg-brand-950/30 flex items-center justify-center shrink-0">
                      <BellRing className="h-4 w-4 text-brand-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Critical Meeting Alerts</h3>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Receive a voice call 5 and 1 minute before any meeting you mark as critical.</p>
                    </div>
                  </div>

                  <label className="flex items-center justify-between gap-4 cursor-pointer p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Enable voice call reminders</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">You will receive a phone call before critical meetings start.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCriticalAlertsEnabled(v => !v)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${criticalAlertsEnabled ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${criticalAlertsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </label>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Call me at</label>
                    {contactPhone ? (
                      <p className="text-sm text-slate-800 dark:text-slate-200 font-mono">{contactPhone}</p>
                    ) : (
                      <p className="text-sm text-slate-400 italic">No phone number on file.</p>
                    )}
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      Uses your profile phone number.{' '}
                      <Link
                        to="/dashboard/settings?tab=profile"
                        onClick={(e) => {
                          e.preventDefault();
                          goToProfileSettings();
                        }}
                        className="font-medium text-brand-500 hover:underline"
                      >
                        {contactPhone ? 'Update in Settings → Profile' : 'Add phone number →'}
                      </Link>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={handleSaveCriticalAlerts}
                      disabled={savingCritical}
                      className="flex items-center gap-1.5 px-4 py-2 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-all hover:opacity-90"
                      style={{ backgroundColor: '#5864C6' }}
                    >
                      {savingCritical ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : savedCritical ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                      {savedCritical ? 'Saved!' : 'Save'}
                    </button>
                    <button
                      onClick={handleTestCall}
                      disabled={testingCall || !contactPhone.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-all"
                    >
                      {testingCall ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}
                      Test call now
                    </button>
                    {testCallMsg && (
                      <p className={`text-xs font-medium ${testCallMsg.startsWith('Error') ? 'text-red-500' : ''}`} style={!testCallMsg.startsWith('Error') ? { color: '#5864C6' } : {}}>
                        {testCallMsg}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Wrapper>
  );
}

export default RemindersPage;
