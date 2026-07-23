/** TCPA / A2P disclosure copy — keep in sync with /sms-consent and Twilio campaign registration. */

/**
 * Exact Twilio A2P checkbox CTA — must match campaign registration verbatim.
 * Shown immediately next to the SMS opt-in checkbox on public booking forms.
 */
export const SMS_BOOKING_CONSENT_CTA =
  'By checking this box and providing your mobile phone number, you agree to receive appointment-related SMS messages from Pin On It. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe and HELP for assistance.';

/** @deprecated Use SMS_BOOKING_CONSENT_CTA */
export const SMS_BOOKING_CONSENT_TEXT = SMS_BOOKING_CONSENT_CTA;

/** @deprecated Use SMS_BOOKING_CONSENT_CTA */
export const SMS_BOOKING_CONSENT_DISCLOSURE = SMS_BOOKING_CONSENT_CTA;

/** Footnote below the checkbox on booking forms (not part of Twilio CTA). */
export const SMS_BOOKING_CONSENT_DETAILS =
  'SMS messages are sent only if the user voluntarily enters a phone number, checks the SMS consent box, and submits the booking. SMS consent is not required to complete a booking and is not shared with third parties or affiliates for marketing purposes.';

export const SMS_OPTIONAL_BOOKING_NOTICE =
  'Providing your mobile phone number and receiving SMS reminders is completely optional. You may complete your booking without providing a phone number or consenting to SMS.';

export const SMS_OPTIONAL_POLICY_SENTENCE =
  'SMS consent is optional and is not required to book an appointment. SMS consent is not shared with third parties or affiliates for marketing purposes.';

export const SMS_CONSENT_PAGE_OPTIONAL_STATEMENT =
  'Providing a phone number is optional. SMS reminders are optional. SMS consent is not required to book an appointment. Users may complete the booking process without providing a phone number or consenting to receive SMS messages.';

export const SMS_PRIVACY_DISCLOSURE = SMS_BOOKING_CONSENT_CTA;

export const SMS_TERMS_DISCLOSURE = SMS_BOOKING_CONSENT_CTA;

export function notifyViaIncludesSms(notifyVia: string[] | null | undefined): boolean {
  return Array.isArray(notifyVia) && notifyVia.includes('sms');
}

export function notifyViaIncludesWhatsapp(notifyVia: string[] | null | undefined): boolean {
  return Array.isArray(notifyVia) && notifyVia.includes('whatsapp');
}
