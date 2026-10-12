import { supabase } from './supabase';

/** Bump when the sender notice changes enough to require a new acknowledgment. */
export const SMS_SIGNATURE_IDENTITY_NOTICE_VERSION = 1;

export const SMS_SIGNATURE_IDENTITY_NOTICE_TITLE =
  "Always Confirm/Verify the Signer's Phone Number";

export const SMS_SIGNATURE_IDENTITY_NOTICE_BODY =
  'SMS 2FA verifies access to the phone number. You should always try to ensure the number belongs to the signer or is their authorized company phone.';

export const SMS_SIGNATURE_IDENTITY_NOTICE_CHECKBOX = 'I understand.';

/** Immutable text stored with the acknowledgment. Keep in sync with the database function. */
export const SMS_SIGNATURE_IDENTITY_NOTICE_TEXT = [
  SMS_SIGNATURE_IDENTITY_NOTICE_TITLE,
  SMS_SIGNATURE_IDENTITY_NOTICE_BODY,
  SMS_SIGNATURE_IDENTITY_NOTICE_CHECKBOX,
].join('\n\n');

/** Sender is about to text a document that requires an SMS signature code. */
export function smsSignatureSendNeedsIdentityAck(verificationRequired: boolean, willText: boolean) {
  return verificationRequired && willText;
}

export function identityContinueEnabled(checked: boolean, busy: boolean) {
  return checked && !busy;
}

export async function senderHasSmsSignatureIdentityAck(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('sms_signature_identity_acks')
    .select('notice_version')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return false;
  return Number(data.notice_version) >= SMS_SIGNATURE_IDENTITY_NOTICE_VERSION;
}

export async function acknowledgeSmsSignatureIdentity(): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('acknowledge_sms_signature_identity', {
    p_version: SMS_SIGNATURE_IDENTITY_NOTICE_VERSION,
  });
  const row = (data ?? null) as { ok?: boolean; error?: string } | null;
  if (error || !row?.ok) {
    return { ok: false, error: error?.message ?? row?.error ?? 'Could not save that acknowledgment.' };
  }
  return { ok: true };
}
