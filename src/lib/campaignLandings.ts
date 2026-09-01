import type { LucideIcon } from 'lucide-react';
import { FileText, MessageSquare, PenLine, Smartphone } from 'lucide-react';
import { HOLD_UP_COPY, LEGAL_DISCLAIMER } from './documents';

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
  steps: CampaignStep[];
  secondaryUseCase: string;
  holdUp: string;
  disclaimer: string;
  metaTitle: string;
  metaDescription: string;
};

export const CAMPAIGN_PAGES: Record<string, CampaignCopy> = {
  nda: {
    slug: 'nda',
    eyebrow: 'Doc Center',
    headline: 'Send a legally-backed NDA over text — in 30 seconds',
    subhead:
      "No app, no login, no downloads for the other person. Just their phone number. They get a text, tap the link, verify it's really them with a one-time code, and sign — right from their phone.",
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
      'Send a legally-backed NDA over text in 30 seconds. No app or login for the other person — they verify by SMS and sign on their phone. Also waivers, contracts, invoices, and receipts.',
  },
};

export function campaignCopy(slug: string): CampaignCopy | null {
  return CAMPAIGN_PAGES[slug] ?? null;
}
