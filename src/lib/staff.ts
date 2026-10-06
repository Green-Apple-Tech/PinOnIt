/** Logins allowed to use internal staff tools. */
export const STAFF_EMAILS = ['support@pinonit.com', 'stebbins.peter@gmail.com'] as const;

export function isStaffEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return (STAFF_EMAILS as readonly string[]).includes(email.toLowerCase());
}
