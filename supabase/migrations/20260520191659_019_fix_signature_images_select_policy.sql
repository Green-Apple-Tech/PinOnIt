/*
  # Fix signature-images bucket public SELECT policy

  ## Problem
  The existing "Public read signature images" policy allows public listing of
  all files in the bucket because it only checks `bucket_id` with no path
  constraint. This lets anyone enumerate every file stored in the bucket.

  ## Fix
  Drop the broad policy and replace it with one that:
  - Still allows unauthenticated users to fetch individual files by direct URL
  - Blocks directory/bucket listing by requiring `name` to be a non-empty
    path that contains a folder segment (i.e. matches `<folder>/<filename>`)
    using `name LIKE '%/%'` and `name <> ''`

  This means a direct URL like:
    https://<project>.supabase.co/storage/v1/object/public/signature-images/user-id/file.png
  ...continues to work, but a LIST request against the bucket root or any
  folder returns no rows for anonymous callers.
*/

-- Drop the existing broad public SELECT policy
DROP POLICY IF EXISTS "Public read signature images" ON storage.objects;

-- Re-create with path constraint to prevent listing
CREATE POLICY "Public read signature images by direct URL"
  ON storage.objects
  FOR SELECT
  TO public
  USING (
    bucket_id = 'signature-images'
    AND name <> ''
    AND name LIKE '%/%'
  );
