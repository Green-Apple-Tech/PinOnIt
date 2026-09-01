import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  FileText,
  Mail,
  MessageCircle,
  MessageSquare,
  PenLine,
  Phone,
  Smartphone,
} from 'lucide-react';
import { HOLD_UP_COPY, LEGAL_DISCLAIMER } from './documentCopy';

export const NDA_HEADLINE = 'Send an NDA over text — verified and signed in 30 seconds';

export const NDA_SUBHEAD =
  'No app, no login, no downloads for the other person. Just their phone number.';

export const NDA_SUPPORTING_LINE =
  'Send a waiver, invoice, contract, receipt, or quote via instant SMS — they approve right from their phone, no app needed.';

export const DOC_TYPE_SHORTCUTS = [
  { label: 'NDAs', type: 'nda' },
  { label: 'contracts', type: 'contract' },
  { label: 'invoices', type: 'invoice' },
  { label: 'waivers', type: 'waiver' },
  { label: 'receipts', type: 'receipt' },
  { label: 'quotes', type: 'quote' },
] as const;

export const REMINDERS_HEADLINE =
  'Reminders they actually get — text, WhatsApp, email, and a call';

export const REMINDERS_SUBHEAD =
  'A booking is worthless if nobody shows. PinOnIt sends Smart Reminders on the channel people answer: SMS, WhatsApp, email, and voice. Every appointment gets a ping. Critical ones get extras. You can remind yourself about a call or an errand the same way — type it or say it.';

export type CampaignStep = {
  title: string;
  desc: string;
  icon: LucideIcon;
};

export type CampaignCopy = {
  slug: string;
  eyebrow: string;
  headline: string;
  subhead: string;
  supportingLine?: string;
  typeShortcuts?: readonly { label: string; type: string }[];
  steps: CampaignStep[];
  secondaryUseCase: string;
  holdUp?: string;
  disclaimer?: string;
  metaTitle: string;
  metaDescription: string;
  loggedInCtaTo: string;
  loggedInCtaLabel: string;
};

export const CAMPAIGN_PAGES: Record<string, CampaignCopy> = {
  nda: {
    slug: 'nda',
    eyebrow: 'Doc Center',
    headline: NDA_HEADLINE,
    subhead: NDA_SUBHEAD,
    supportingLine: NDA_SUPPORTING_LINE,
    typeShortcuts: DOC_TYPE_SHORTCUTS,
    steps: [
      { icon: FileText, title: 'Type the topic', desc: 'A short line for what the NDA covers — a deal, a hire, a conversation.' },
      { icon: Smartphone, title: 'Enter their number', desc: 'Just a phone. They do not create an account or download anything.' },
      { icon: MessageSquare, title: 'They verify by text', desc: 'A one-time code confirms it is really them before they can sign.' },
      { icon: PenLine, title: 'They sign', desc: 'Signature, timestamp, and identity confirmation — from their phone.' },
    ],
    secondaryUseCase:
      'Also works for liability waivers, contracts, invoices, and receipts — all with the same verified signature and audit trail.',
    holdUp: HOLD_UP_COPY,
    disclaimer: LEGAL_DISCLAIMER,
    metaTitle: 'Send an NDA over text | PinOnIt Doc Center',
    metaDescription:
      'Send an NDA over text in 30 seconds. No app or login for the other person — they verify by SMS and sign on their phone. Also waivers, contracts, invoices, and receipts.',
    loggedInCtaTo: '/dashboard/documents/new',
    loggedInCtaLabel: 'Open Doc Center',
  },
  reminders: {
    slug: 'reminders',
    eyebrow: 'Smart Reminders',
    headline: REMINDERS_HEADLINE,
    subhead: REMINDERS_SUBHEAD,
    steps: [
      { icon: Bell, title: 'Book it or add it', desc: 'A client picks a time, or you tell PinOnIt to remind you about a call, a follow-up, or an errand.' },
      { icon: Mail, title: 'Choose the channel', desc: 'Email, SMS, WhatsApp, voice — or stack them when the meeting actually matters.' },
      { icon: MessageCircle, title: 'They get the ping', desc: 'Timed reminders before the appointment. Critical meetings get extra SMS or WhatsApp at 1 hour and 15 minutes.' },
      { icon: Phone, title: 'They can reply', desc: 'Guests can text 2 to reschedule. You stay off phone tag; they still show up.' },
    ],
    secondaryUseCase:
      'Same reminders for PinOnIt bookings and for anything you add yourself. Coworkers and assistants can get copied in when you need a backup.',
    holdUp:
      'Four channels, timed automatically, with extra alerts when missing it would cost you the hour.',
    metaTitle: 'Smart Reminders | PinOnIt',
    metaDescription:
      'SMS, WhatsApp, email, and voice reminders so bookings and appointments actually get shown up to. No extra apps for your clients.',
    loggedInCtaTo: '/dashboard/reminders',
    loggedInCtaLabel: 'Open Smart Reminders',
  },
};

export function campaignCopy(slug: string): CampaignCopy | null {
  return CAMPAIGN_PAGES[slug] ?? null;
}
