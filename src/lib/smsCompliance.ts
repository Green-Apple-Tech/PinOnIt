/** TCPA / A2P disclosure copy — keep in sync with /sms-consent and Twilio campaign registration. */
export const SMS_BOOKING_CONSENT_TEXT =
  'By providing your phone number, you agree to receive SMS appointment reminders related to your scheduled appointment. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe and HELP for assistance.';

export const SMS_PRIVACY_DISCLOSURE =
  'SMS consent is not shared with third parties or affiliates for marketing purposes. By providing your mobile phone number, you consent to receive appointment-related text messages from PinOnIt and hosts using the PinOnIt platform. Message frequency varies. Message and data rates may apply. Reply STOP to opt out and HELP for assistance.';

export const SMS_TERMS_DISCLOSURE =
  'By opting into SMS notifications, you agree to receive appointment-related text messages from PinOnIt and hosts using the PinOnIt platform. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe and HELP for assistance.';

export function notifyViaIncludesSms(notifyVia: string[] | null | undefined): boolean {
  return Array.isArray(notifyVia) && notifyVia.includes('sms');
}

export function notifyViaIncludesWhatsapp(notifyVia: string[] | null | undefined): boolean {
  return Array.isArray(notifyVia) && notifyVia.includes('whatsapp');
}
