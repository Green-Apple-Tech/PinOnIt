-- DANGER: Development/testing only — wipes ALL user data on this Supabase project.
-- Run in Supabase SQL Editor (Dashboard → SQL → New query).
--
-- PinOnIt does NOT use google_calendar_tokens / outlook_calendar_tokens.
-- OAuth tokens live in connected_calendars (+ gmail_* columns on profiles).

BEGIN;

-- Polls (children first)
DELETE FROM public.meeting_poll_votes;
DELETE FROM public.meeting_poll_responses;
DELETE FROM public.meeting_poll_slots;
DELETE FROM public.meeting_polls;

-- Coordinated meetings
DELETE FROM public.coordinated_meeting_participants;
DELETE FROM public.coordinated_meetings;

-- Bookings and dependents
DELETE FROM public.booking_answers;
DELETE FROM public.event_reminder_overrides;
DELETE FROM public.group_bookings;
DELETE FROM public.message_log;
DELETE FROM public.single_use_links;
DELETE FROM public.bookings;

-- Calendar OAuth tokens + synced events
DELETE FROM public.calendar_events;
DELETE FROM public.connected_calendars;

-- Services and dependents
DELETE FROM public.service_reminders;
DELETE FROM public.booking_questions;
DELETE FROM public.team_members;
DELETE FROM public.reminder_rules;
DELETE FROM public.services;

-- Host-owned data
DELETE FROM public.contacts;
DELETE FROM public.emergency_contacts;
DELETE FROM public.date_overrides;
DELETE FROM public.availability;
DELETE FROM public.message_templates;
DELETE FROM public.referral_credits;
DELETE FROM public.referrals;
DELETE FROM public.signature_preferences;
DELETE FROM public.subscriptions;
DELETE FROM public.bot_leads;

-- Profiles (clears gmail_access_token, outlook flags, etc.)
DELETE FROM public.profiles;

-- Optional: system logs (no user FK)
DELETE FROM public.uptime_logs;

-- Auth users last
DELETE FROM auth.users;

COMMIT;

SELECT 'Wipe complete' AS status;
