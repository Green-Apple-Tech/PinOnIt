-- Per-host saved waiver language + stronger starter copy on the waiver template.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS waiver_template text;

UPDATE public.document_templates
SET full_text = 'REPLACE THIS TEXT WITH YOUR OWN LIABILITY WAIVER LANGUAGE, REVIEWED BY AN ATTORNEY FOR YOUR STATE AND YOUR SPECIFIC ACTIVITY. Liability waiver enforceability varies by state and by activity — many states will not enforce waivers for gross negligence, and some states specifically restrict or void waivers for gyms/fitness facilities, amusement activities, employment relationships, or waivers signed on behalf of minors. This starter text is not legal advice. Have an attorney review your waiver for your state and industry before relying on it.'
WHERE document_type = 'waiver';

NOTIFY pgrst, 'reload schema';
