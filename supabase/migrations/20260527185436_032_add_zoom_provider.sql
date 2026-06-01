/*
  # Add Zoom to connected_calendars provider constraint

  ## Changes
  - Drops the existing CHECK constraint on `connected_calendars.provider`
    and replaces it with one that also allows 'zoom'.
  - No data changes — existing rows are unaffected.
*/

ALTER TABLE connected_calendars
  DROP CONSTRAINT IF EXISTS connected_calendars_provider_check;

ALTER TABLE connected_calendars
  ADD CONSTRAINT connected_calendars_provider_check
  CHECK (provider IN ('google', 'outlook', 'apple', 'caldav', 'ical', 'zoom'));
