/** Keep in sync with src/lib/coordination.ts — Deno edge cannot import from src/. */

export function icsEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function formatIcsUtc(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildCoordinationIcs(opts: {
  uid: string;
  title: string;
  location?: string | null;
  startIso: string;
  endIso: string;
  description?: string | null;
}) {
  const stamp = formatIcsUtc(new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PinOnIt//Coordination//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${icsEscape(opts.uid)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${formatIcsUtc(opts.startIso)}`,
    `DTEND:${formatIcsUtc(opts.endIso)}`,
    `SUMMARY:${icsEscape(opts.title)}`,
  ];
  if (opts.location?.trim()) lines.push(`LOCATION:${icsEscape(opts.location.trim())}`);
  if (opts.description?.trim()) lines.push(`DESCRIPTION:${icsEscape(opts.description.trim())}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
