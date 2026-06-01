/*
  # Create signature_preferences table

  1. New Tables
    - `signature_preferences`
      - `user_id` (uuid, primary key, references auth.users)
      - `logo_width` (int, default 60) — logo width in pixels, 40–200
      - `logo_position` (text, default 'top-left') — 'top-left' | 'top-right' | 'inline'
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Users can only read and write their own row
*/

CREATE TABLE IF NOT EXISTS signature_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  logo_width integer NOT NULL DEFAULT 60,
  logo_position text NOT NULL DEFAULT 'top-left',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE signature_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own signature preferences"
  ON signature_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own signature preferences"
  ON signature_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own signature preferences"
  ON signature_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
