export type UiMode = 'simple' | 'advanced';
export type BusinessType = 'mobile_trade' | 'personal_services' | 'professional_services' | 'other';
export type RevealedToolId = 'paid-booking' | 'quotes' | 'group-scheduling' | 'analytics';

export const BUSINESS_TYPE_OPTIONS: { id: BusinessType; label: string; desc: string }[] = [
  { id: 'mobile_trade', label: 'Mobile trade', desc: 'You go to the client — plumbing, HVAC, mobile detailing, in-home repair.' },
  { id: 'personal_services', label: 'Personal services', desc: 'Salon, spa, tutoring, coaching, pet care, fitness.' },
  { id: 'professional_services', label: 'Professional services', desc: 'Consulting, legal, finance, real estate, agencies.' },
  { id: 'other', label: 'Other', desc: 'Something else — we will start you with a simple 30-minute meeting.' },
];

export function presetsForBusinessType(type: BusinessType) {
  switch (type) {
    case 'mobile_trade':
      return {
        reminderChannel: 'sms' as const,
        locationType: 'in_person' as const,
        eventName: '30 Min On-Site Visit',
        revealed: ['paid-booking'] as RevealedToolId[],
      };
    case 'personal_services':
      return {
        reminderChannel: 'sms' as const,
        locationType: 'in_person' as const,
        eventName: '30 Min Consultation',
        revealed: ['paid-booking'] as RevealedToolId[],
      };
    case 'professional_services':
      return {
        reminderChannel: 'email' as const,
        locationType: 'video' as const,
        eventName: '30 Min Consultation',
        revealed: [] as RevealedToolId[],
      };
    default:
      return {
        reminderChannel: 'email' as const,
        locationType: 'video' as const,
        eventName: '30 Min Consultation',
        revealed: [] as RevealedToolId[],
      };
  }
}

export function parseRevealedTools(value: unknown): RevealedToolId[] {
  const allowed = new Set<RevealedToolId>(['paid-booking', 'quotes', 'group-scheduling', 'analytics']);
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is RevealedToolId => typeof id === 'string' && allowed.has(id as RevealedToolId));
}

export async function revealTool(
  userId: string,
  tool: RevealedToolId,
  current: string[] | null | undefined,
): Promise<RevealedToolId[]> {
  const next = new Set(parseRevealedTools(current));
  if (next.has(tool)) return [...next];
  next.add(tool);
  const list = [...next];
  const { supabase } = await import('./supabase');
  await supabase.from('profiles').update({ revealed_tools: list }).eq('id', userId);
  return list;
}
