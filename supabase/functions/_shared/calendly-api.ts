import {
  CALENDLY_API_BASE,
  refreshCalendlyToken,
  tokenExpiresAt,
  isTokenExpired,
} from "./calendly-oauth.ts";

export interface CalendlyImportEvent {
  name: string;
  duration_minutes: number;
  description: string;
  color: string;
  location_type: "video" | "in_person" | "phone" | "custom";
  location: string;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  is_active: boolean;
  calendly_slug: string | null;
  calendly_event_type_uri: string | null;
  booking_method: string | null;
}

export interface CalendlyImportAvailability {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface CalendlyImportProfile {
  full_name: string | null;
  avatar_url: string | null;
  timezone: string | null;
  email: string | null;
  slug: string | null;
  scheduling_url: string | null;
}

export interface CalendlyImportResult {
  source: "oauth";
  username: string | null;
  profile: CalendlyImportProfile;
  events: CalendlyImportEvent[];
  availability: CalendlyImportAvailability[];
}

interface IntegrationRow {
  id: string;
  host_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
}

const WDAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

async function calendlyGet<T>(accessToken: string, path: string, query?: Record<string, string>): Promise<T> {
  const url = new URL(`${CALENDLY_API_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendly API ${path} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

function mapLocation(
  locations: Array<{ kind?: string; location?: string; phone_number?: string }> | undefined
): { location_type: CalendlyImportEvent["location_type"]; location: string } {
  const loc = locations?.[0];
  if (!loc) return { location_type: "video", location: "" };

  const kind = (loc.kind ?? "").toLowerCase();
  const value = loc.location ?? loc.phone_number ?? "";

  if (["zoom", "google_meet", "google_conference", "microsoft_teams", "microsoft_teams_conference", "webex", "goto_meeting"].includes(kind)) {
    return { location_type: "video", location: value };
  }
  if (["outbound_call", "inbound_call", "ask_invitee"].includes(kind)) {
    return { location_type: "phone", location: value };
  }
  if (kind === "physical") {
    return { location_type: "in_person", location: value };
  }
  if (kind === "custom") {
    return { location_type: "custom", location: value };
  }
  return { location_type: "custom", location: value };
}

function parseAvailabilityRules(
  rules: Array<{ type?: string; wday?: string; intervals?: Array<{ from?: string; to?: string }> }> | undefined
): CalendlyImportAvailability[] {
  const rows: CalendlyImportAvailability[] = [];
  if (!rules?.length) return rows;

  for (const rule of rules) {
    if (rule.type !== "wday" || !rule.wday) continue;
    const day = WDAY_MAP[rule.wday.toLowerCase()];
    if (day === undefined) continue;
    for (const interval of rule.intervals ?? []) {
      if (!interval.from || !interval.to) continue;
      rows.push({
        day_of_week: day,
        start_time: interval.from.slice(0, 5),
        end_time: interval.to.slice(0, 5),
      });
    }
  }
  return rows;
}

// deno-lint-ignore no-explicit-any
export async function fetchCalendlyImportViaOAuth(
  supabase: any,
  integration: IntegrationRow,
  clientId: string,
  clientSecret: string
): Promise<CalendlyImportResult> {
  let accessToken = integration.access_token;

  if (isTokenExpired(integration.expires_at) && integration.refresh_token) {
    const refreshed = await refreshCalendlyToken({
      refreshToken: integration.refresh_token,
      clientId,
      clientSecret,
    });
    if (!refreshed.access_token) {
      throw new Error(refreshed.error_description ?? refreshed.error ?? "Calendly token refresh failed");
    }
    accessToken = refreshed.access_token;
    await supabase
      .from("integrations")
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token ?? integration.refresh_token,
        expires_at: tokenExpiresAt(refreshed.expires_in),
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id);
  }

  const me = await calendlyGet<{ resource: Record<string, unknown> }>(accessToken, "/users/me");
  const user = me.resource;
  const userUri = String(user.uri ?? "");

  const profile: CalendlyImportProfile = {
    full_name: (user.name as string) ?? null,
    avatar_url: (user.avatar_url as string) ?? null,
    timezone: (user.timezone as string) ?? null,
    email: (user.email as string) ?? null,
    slug: (user.slug as string) ?? null,
    scheduling_url: (user.scheduling_url as string) ?? null,
  };

  const eventResp = await calendlyGet<{ collection: Array<Record<string, unknown>> }>(
    accessToken,
    "/event_types",
    { user: userUri, count: "100", active: "true" }
  );

  const events: CalendlyImportEvent[] = (eventResp.collection ?? []).map((et) => {
    const { location_type, location } = mapLocation(
      et.locations as Array<{ kind?: string; location?: string; phone_number?: string }>
    );
    const duration = typeof et.duration === "number" ? et.duration : 30;
    return {
      name: String(et.name ?? "Meeting"),
      duration_minutes: duration,
      description: String(et.description_plain ?? et.description ?? "").slice(0, 2000),
      color: String(et.color ?? "#10b981"),
      location_type,
      location,
      buffer_before_minutes: Number(et.before_event_buffer ?? 0),
      buffer_after_minutes: Number(et.after_event_buffer ?? 0),
      is_active: et.active !== false,
      calendly_slug: (et.slug as string) ?? null,
      calendly_event_type_uri: (et.uri as string) ?? null,
      booking_method: (et.booking_method as string) ?? null,
    };
  });

  let availability: CalendlyImportAvailability[] = [];
  try {
    const schedResp = await calendlyGet<{ collection: Array<Record<string, unknown>> }>(
      accessToken,
      "/user_availability_schedules",
      { user: userUri }
    );
    const schedules = schedResp.collection ?? [];
    const defaultSchedule =
      schedules.find((s) => s.default === true) ?? schedules[0];
    availability = parseAvailabilityRules(
      defaultSchedule?.rules as Array<{ type?: string; wday?: string; intervals?: Array<{ from?: string; to?: string }> }>
    );
  } catch (err) {
    console.warn("[calendly-api] availability schedules unavailable:", err);
  }

  return {
    source: "oauth",
    username: profile.slug,
    profile,
    events,
    availability,
  };
}
