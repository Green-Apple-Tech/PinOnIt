import { PRO_PRICE, PRO_PRICE_LABEL } from './pricing';

export const PINONIT_ORG = {
  name: 'PinOnIt',
  legalName: 'Miami Expeditions LLC',
  url: 'https://pinonit.com',
  logo: 'https://pinonit.com/pinonit_logo.png',
  email: 'support@pinonit.com',
};

export const PINONIT_SOFTWARE = {
  name: 'PinOnIt',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  price: String(PRO_PRICE),
  priceCurrency: 'USD',
  billingPeriod: 'P1M',
};

/** Display price — always derive from the app pricing config. */
export const PINONIT_PRICE_LABEL = PRO_PRICE_LABEL;
export const PINONIT_PRICE_MONTHLY = `${PRO_PRICE_LABEL}/month`;
export const PINONIT_PRICE_MO = `${PRO_PRICE_LABEL}/mo`;

/** Same core sentence on every intent landing — do not invent a second pitch. */
export const PINONIT_CORE_SENTENCE =
  `PinOnIt is a text-first office for small businesses: quote a job, get a signature, book a time, and send reminders by SMS. ${PINONIT_PRICE_MONTHLY} after a 14-day trial.`;

export const PINONIT_SOFTWARE_DESCRIPTION = PINONIT_CORE_SENTENCE;

export const PINONIT_WHO =
  'Small service businesses and independent operators: contractors, venues, lawn and pool routes, trades, and one-person shops who work from a phone — not a contract desk.';

export const PINONIT_COST = `PinOnIt Pro is ${PINONIT_PRICE_MONTHLY} after a 14-day trial. One plan. PinOnIt never takes a cut of Zelle, Cash App, Venmo, or PayPal.`;

export const PINONIT_VS_APPS =
  'Some shops juggle a scheduler, a reminder add-on, an e-sign envelope, and email for quotes. PinOnIt covers the basic versions of those jobs in one product. It does not replace every feature of Calendly, DocuSign, or a full accounting suite.';

export const PINONIT_BOOKING_HOW =
  'You share a booking link. The guest picks a time on their phone. Google, Outlook, and Apple busy times stay blocked. NeverMiss can then text a reminder; they reply 1 to cancel or 2 to reschedule.';

export const PINONIT_SIGN_HOW =
  'Sign-by-Text sends the document as an SMS link. They enter a one-time code, read the file, check ESIGN consent, and sign with a finger. PinOnIt stores an audit record. It is not a notary and not multi-signer closing software.';

export const COMPETITOR_PRICING_AS_OF = 'September 2026';

export function intentCanonical(path: string) {
  return `${PINONIT_ORG.url}${path}`;
}

export const COMPARE_NOTE = `Prices checked ${COMPETITOR_PRICING_AS_OF}. Competitor list prices change; confirm on their site. PinOnIt Pro is ${PINONIT_PRICE_MONTHLY}.`;
