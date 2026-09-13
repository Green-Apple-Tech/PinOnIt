import { DOCS_TEMPLATE_UPLOAD_PATH } from './hostDocuments';

export const LEGAL_TEMPLATES_META = {
  title: 'Waiver and liability form templates — PinOnIt',
  description:
    'PinOnIt built-in waivers are general starting points. Requirements vary by state and activity. Download a form from a legal template site and upload it once to send for signature.',
  url: 'https://pinonit.com/legal-templates',
  ogImage: 'https://pinonit.com/og-why-pinonit.png',
};

/** Example third-party sites — not endorsements or partnerships. */
export const LEGAL_TEMPLATE_EXAMPLE_SITES = [
  {
    name: 'LawDepot',
    href: 'https://www.lawdepot.com/us/business/activity-waiver/',
    blurb: 'Activity waiver and release-of-liability forms, including state-specific versions.',
  },
  {
    name: 'US Legal Forms',
    href: 'https://www.uslegalforms.com/waivers/',
    blurb: 'Waiver and release forms organized by type and jurisdiction.',
  },
  {
    name: 'PandaDoc',
    href: 'https://www.pandadoc.com/liability-waiver-form-templates/',
    blurb: 'Liability waiver and release templates you can download as a PDF.',
  },
] as const;

export const LEGAL_TEMPLATES_DISCLAIMER =
  "PinOnIt doesn't provide legal documents or legal advice — these are third-party sites.";

export const LEGAL_TEMPLATES_UPLOAD_PATH = DOCS_TEMPLATE_UPLOAD_PATH;

export const LEGAL_TEMPLATES_UPLOAD_STEPS = [
  'Download the form you need from a legal template site (or use the PDF your attorney already reviewed).',
  'Export or save it as a PDF if it is not one already.',
  'Open Settings → Docs, give it a name (for example, “Standard zip-line waiver”), and upload it.',
  'Pick that named template from Document Type the next time you send — including hundreds of times.',
];
