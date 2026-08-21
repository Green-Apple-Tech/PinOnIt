#!/usr/bin/env bash
# Deploy Supabase edge functions for PinOnIt.
# OAuth callbacks MUST use --no-verify-jwt (browser redirects have no Authorization header).
set -euo pipefail

PROJECT_REF="adlusgtlwgcfyxgeoias"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

deploy() {
  local name="$1"
  shift
  echo "→ Deploying $name $*"
  supabase functions deploy "$name" --project-ref "$PROJECT_REF" "$@"
}

# OAuth / webhook callbacks — never require JWT at the gateway
# Stripe webhooks have NO Authorization header; deploying without --no-verify-jwt
# causes 401 "Missing authorization header" and Stripe will disable the endpoint.
for fn in google-calendar-callback outlook-calendar-callback calendly-callback zoom-callback stripe-webhook; do
  deploy "$fn" --no-verify-jwt
done

deploy stripe-checkout
deploy stripe-portal
deploy stripe-sync-subscription

# OAuth starters — calendly-auth uses verify_jwt=false (browser ?token= redirects); auth checked in function
deploy calendly-auth --no-verify-jwt
for fn in google-calendar-auth outlook-calendar-auth zoom-auth; do
  deploy "$fn"
done

deploy scrape-calendly
deploy send-quote

echo ""
echo "Done. OAuth callbacks deployed with --no-verify-jwt (Google + Microsoft + Calendly + Zoom + Stripe webhook)."
echo "If calendar connect fails with 'Missing authorization header', re-run this script or:"
echo "  supabase functions deploy google-calendar-callback --no-verify-jwt --project-ref $PROJECT_REF"
echo "  supabase functions deploy outlook-calendar-callback --no-verify-jwt --project-ref $PROJECT_REF"
echo "  supabase functions deploy calendly-callback --no-verify-jwt --project-ref $PROJECT_REF"
