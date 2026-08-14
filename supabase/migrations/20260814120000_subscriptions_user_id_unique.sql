/*
  One subscription row per user so Stripe checkout/webhook upserts on user_id succeed.
  Prefer a row that already has a Stripe subscription, then a real cus_ customer id.
*/

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY
        (stripe_subscription_id IS NOT NULL) DESC,
        (stripe_customer_id LIKE 'cus_%') DESC,
        updated_at DESC NULLS LAST
    ) AS rn
  FROM subscriptions
)
DELETE FROM subscriptions
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_id_key ON subscriptions (user_id);
