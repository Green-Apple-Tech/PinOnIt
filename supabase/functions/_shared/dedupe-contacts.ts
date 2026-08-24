/** Postgres upsert cannot touch the same (host_id, email) twice in one statement. */
export function dedupeContactRows<T extends { email: string }>(rows: T[]): T[] {
  const map = new Map<string, T>();
  for (const row of rows) {
    const email = String(row.email ?? "").trim().toLowerCase();
    if (!email.includes("@")) continue;
    const next = { ...row, email };
    const prev = map.get(email);
    if (!prev) {
      map.set(email, next);
      continue;
    }
    const rec = next as Record<string, unknown>;
    const old = prev as Record<string, unknown>;
    map.set(email, {
      ...prev,
      ...next,
      full_name: filled(rec.full_name) ? rec.full_name : old.full_name,
      phone: filled(rec.phone) ? rec.phone : old.phone,
      company: filled(rec.company) ? rec.company : old.company,
    } as T);
  }
  return [...map.values()];
}

function filled(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value != null && value !== "";
}
