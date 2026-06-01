/*
  # Fix connected_calendars purpose defaults

  Both use_for_scheduling and use_for_reminders should default to true
  so calendar conflict checking and reminders work out of the box.
*/

UPDATE connected_calendars
SET use_for_scheduling = true
WHERE use_for_scheduling IS NULL OR use_for_scheduling = false;

UPDATE connected_calendars
SET use_for_reminders = true
WHERE use_for_reminders IS NULL OR use_for_reminders = false;

ALTER TABLE connected_calendars
  ALTER COLUMN use_for_scheduling SET DEFAULT true;

ALTER TABLE connected_calendars
  ALTER COLUMN use_for_reminders SET DEFAULT true;
