import { SMS_ON_MY_WAY_EXAMPLE } from '../lib/onMyWay';

/** Public A2P sample list on /sms-consent — keep in sync with the Twilio campaign. */
export const SMS_EXAMPLES = [
  'Reminder: Your appointment with [Host Name] is tomorrow at [Time]. Reply STOP to unsubscribe.',
  'Your appointment with [Host Name] has been confirmed for [Date] at [Time]. Reply STOP to unsubscribe.',
  'Your appointment with [Host Name] has been rescheduled to [Date] at [Time]. Reply STOP to unsubscribe.',
  'Your appointment with [Host Name] has been canceled. Contact the host for details. Reply STOP to unsubscribe.',
  SMS_ON_MY_WAY_EXAMPLE,
];
