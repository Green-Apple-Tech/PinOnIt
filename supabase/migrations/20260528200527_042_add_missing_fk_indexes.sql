/*
  # Add missing foreign key indexes

  1. Changes
    - Add index on `booking_answers.question_id` (FK to booking_questions)
      — prevents sequential scans on cascade deletes and JOIN queries

  2. Notes
    - `booking_answers.booking_id` index already exists (idx_booking_answers_booking_id)
    - This fills the gap for the question_id FK column
*/

CREATE INDEX IF NOT EXISTS idx_booking_answers_question_id
  ON booking_answers(question_id);
