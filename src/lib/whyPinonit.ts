export type CompareValue = boolean | string;

export type WhyFeature = {
  id: string;
  label: string;
  pinonit: CompareValue;
  calendly: CompareValue;
};

export type WhyScenario = {
  id: string;
  title: string;
  audience: string;
  pain: string;
  handle: string;
};

export const WHY_PINONIT = {
  seoTitle: 'Calendly alternative for small business | PinOnIt',
  seoDescription:
    'PinOnIt is the Calendly alternative for small business: SMS and WhatsApp reminders, reply-to-reschedule, deposits, quotes, QR codes, and group scheduling — from $6/mo.',
  ogImage: 'https://pinonit.com/og-why-pinonit.png',
  canonical: 'https://pinonit.com/why-pinonit',
  heroHeadline: 'Calendly books meetings. PinOnIt runs your business.',
  heroSubhead:
    'The Calendly alternative for small business: reminders people actually get, two-way SMS to cancel or reschedule, deposits, quotes, and QR codes — without a $16+/mo tax.',
  priceLine: '$6/mo after trial · cancel anytime',
  trialCta: 'Start free trial',
  features: [
    { id: 'sms', label: 'SMS reminders', pinonit: true, calendly: '$16+/mo' },
    { id: 'whatsapp', label: 'WhatsApp reminders', pinonit: true, calendly: false },
    { id: 'reply', label: 'Reply to cancel/reschedule', pinonit: true, calendly: false },
    { id: 'deposits', label: 'Deposits & paid booking', pinonit: true, calendly: '$16+/mo' },
    { id: 'quotes', label: 'Quotes/invoices/receipts', pinonit: true, calendly: false },
    { id: 'qr', label: 'QR booking codes', pinonit: true, calendly: false },
    { id: 'group', label: 'Group scheduling & polls', pinonit: true, calendly: '$16+/mo' },
    { id: 'weather', label: 'Weather alerts for outdoor jobs', pinonit: true, calendly: false },
    { id: 'team', label: 'Notify your team/assistant', pinonit: true, calendly: false },
    { id: 'slack', label: 'Slack booking alerts', pinonit: true, calendly: false },
    { id: 'types', label: 'Unlimited event types', pinonit: true, calendly: '$16+/mo' },
    { id: 'brand', label: 'Your branding on booking page', pinonit: true, calendly: '$16+/mo' },
    { id: 'price', label: 'Monthly price', pinonit: '$6', calendly: '$16+' },
  ] satisfies WhyFeature[],
  scenarios: [
    {
      id: 'trades',
      title: 'Mobile trades',
      audience: 'HVAC, plumbing, lawn, pool',
      pain: 'A no-show burns a drive across town and a half-day of work.',
      handle: 'PinOnIt texts and WhatsApps the job, then lets the client reply 2 to pick a new slot.',
    },
    {
      id: 'solo',
      title: 'Solo professional',
      audience: 'Consultants, coaches, accountants',
      pain: 'Calendly books the call — you still chase invoices and reminders in three other apps.',
      handle: 'One link for the meeting, the deposit, and the quote. Reminders go out without you.',
    },
    {
      id: 'personal',
      title: 'Personal services',
      audience: 'Salons, tutors, trainers',
      pain: 'Clients live on their phones, not email, and they forget 24-hour cancellation policies.',
      handle: 'SMS/WhatsApp reminders plus a QR code on the door. They reschedule in one tap, not a voicemail.',
    },
  ] satisfies WhyScenario[],
};
