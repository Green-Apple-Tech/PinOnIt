import { useState, useEffect } from 'react';
import { SUPPORT_EMAIL } from '../lib/contactEmail';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { syncStripeSubscription } from '../lib/stripe';
import { effectivePlan, isActivePlan, isComplimentaryPro } from '../lib/plan';
import { PRO_PRICE, STRIPE_PRO_PRICE_ID } from '../lib/pricing';
import { recordPlatformTermsAcceptance } from '../lib/platformLegal';
import { TrialTermsNotice } from '../components/TrialTermsNotice';
import {
  Check, Zap, Loader2, AlertCircle,
  Shield, Info, X,
} from 'lucide-react';

const PRICE_ID = STRIPE_PRO_PRICE_ID;

function GuaranteeBadge() {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-flex items-center gap-1.5">
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-full cursor-default"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        <Shield className="h-3.5 w-3.5 text-indigo-600" />
        <span className="text-xs font-semibold text-indigo-700">60-Day Money Back Guarantee</span>
        <Info className="h-3 w-3 text-indigo-500" />
      </div>
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 px-3 py-2.5 bg-slate-900 text-white text-xs rounded-xl shadow-xl leading-relaxed">
          Not happy? Email {SUPPORT_EMAIL} within 60 days for a full refund, no questions asked.
        </div>
      )}
    </div>
  );
}

export function BillingPage({ embedded }: { embedded?: boolean }) {
  const { user, profile, subscription, refreshProfile } = useAuth();
  const currentPlan = effectivePlan(subscription, profile);
  const isPaidPro = currentPlan === 'pro';
  const isTrial = currentPlan === 'trial';
  const isExpired = currentPlan === 'expired';
  const hasAccess = isActivePlan(currentPlan);
  const isComplimentary = isComplimentaryPro(profile);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [successBanner, setSuccessBanner] = useState(false);

  // Heal plan from Stripe (webhook can lag or miss) and show success after checkout
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const fromCheckout = params.get('checkout') === 'success';
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        for (let attempt = 0; attempt < 3; attempt++) {
          const synced = await syncStripeSubscription(session.access_token);
          if (cancelled) return;
          await refreshProfile?.();
          if (synced?.plan && synced.plan !== 'expired') break;
          if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
        }
      } else {
        await refreshProfile?.();
      }
      if (cancelled) return;
      if (fromCheckout) {
        setSuccessBanner(true);
        const url = new URL(window.location.href);
        url.searchParams.delete('checkout');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshProfile]);

  const handleUpgrade = async (trialDays?: number) => {
    setCheckoutError(null);
    setCheckoutLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setCheckoutError('You must be signed in to upgrade.');
        setCheckoutLoading(false);
        return;
      }
      if (user) void recordPlatformTermsAcceptance(user.id);
      const { readCreatorTouch } = await import('../lib/creatorAttribution');
      const body: Record<string, unknown> = {
        price_id: PRICE_ID,
        app_url: window.location.origin,
      };
      const creatorTouch = readCreatorTouch();
      if (creatorTouch) {
        body.creator_code = creatorTouch.code;
        await supabase.rpc('claim_creator_attribution', { p_code: creatorTouch.code });
      }
      if (trialDays) body.trial_period_days = trialDays;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(body),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.url) {
        setCheckoutError(json.error ?? 'Checkout unavailable right now. Please try again.');
        setCheckoutLoading(false);
        return;
      }
      window.location.href = json.url;
    } catch {
      setCheckoutError('Unable to connect. Please try again.');
      setCheckoutLoading(false);
    }
  };

  const handleFourteenDayNoCard = async () => {
    if (!user) {
      setCheckoutError('You must be signed in to start a trial.');
      return;
    }
    setCheckoutError(null);
    setCheckoutLoading(true);
    try {
      void recordPlatformTermsAcceptance(user.id);
      const { hasStripeBilling, startLocalTrial } = await import('../lib/localTrial');
      if (!(await hasStripeBilling(user.id))) {
        const { error } = await startLocalTrial();
        if (error) throw new Error(error);
      }
      await refreshProfile();
      setSuccessBanner(true);
    } catch (e) {
      setCheckoutError((e as Error).message ?? 'Could not start the 14-day trial.');
    }
    setCheckoutLoading(false);
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-portal`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
      const { url } = await res.json();
      if (url) window.location.href = url;
    } finally {
      setPortalLoading(false);
    }
  };

  const nextBillingDate = subscription?.stripe_current_period_end
    ? new Date(subscription.stripe_current_period_end).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null;

  const trialEndsDate = subscription?.trial_ends_at
    ? new Date(subscription.trial_ends_at).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null;

  const trialDaysLeft = subscription?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0;

  return (
    <div className={embedded ? 'space-y-4 max-w-2xl' : 'p-4 sm:p-6 md:p-8 max-w-2xl space-y-4'}>

      {/* Success banner */}
      {successBanner && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl success">
          <Check className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800">
              {isComplimentaryPro(profile)
                ? "You're on Pro — complimentary, no payment needed."
                : "You're on Pro — $9.99/mo, cancel anytime in Billing."}
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">All Pro features are now active on your account.</p>
          </div>
          <button onClick={() => setSuccessBanner(false)} className="p-1 text-emerald-400 hover:text-emerald-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Current plan card ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1.5">Current plan</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
                hasAccess
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {hasAccess && <Zap className="h-3.5 w-3.5" />}
                {isComplimentary ? 'Pro — complimentary' : isTrial ? 'Pro trial' : isPaidPro ? 'Pro' : 'Expired'}
              </span>
              {isTrial && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
                  {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} left{trialEndsDate ? ` · ends ${trialEndsDate}` : ''}
                </span>
              )}
            </div>
          </div>
          {isPaidPro && nextBillingDate && !isTrial && !isComplimentary && (
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-400">Next billing</p>
              <p className="text-sm font-semibold text-gray-700">{nextBillingDate}</p>
              <p className="text-sm text-gray-500">${PRO_PRICE}/mo</p>
            </div>
          )}
          {isTrial && trialEndsDate && (
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-400">Trial ends</p>
              <p className="text-sm font-semibold text-gray-700">{trialEndsDate}</p>
              <p className="text-xs text-gray-400 mt-0.5">then ${PRO_PRICE}/mo</p>
            </div>
          )}
        </div>

        <ul className="space-y-2.5 mb-5">
          {[
            'Unlimited event types',
            'SMS + WhatsApp + Email + voice reminders',
            'Calendar sync (Google, Outlook, Apple)',
            'Paid booking storefront & quotes',
            'Two-way SMS reschedule',
            'No PinOnIt branding on booking pages',
          ].map((f) => (
            <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
              <Check className="h-4 w-4 text-indigo-600 shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        {isExpired ? (
          <>
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              Your trial ended. Subscribe to turn booking pages and reminders back on. Your data is still here.
            </div>
            {checkoutError && (
              <div className="mb-4 flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {checkoutError}
              </div>
            )}
            <button
              onClick={() => handleUpgrade()}
              disabled={checkoutLoading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all inline-flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 hover:opacity-90"
              style={{ backgroundColor: '#5864C6' }}
            >
              {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Reactivate Pro — ${PRO_PRICE}/mo
            </button>
            <button
              onClick={() => void handleFourteenDayNoCard()}
              disabled={checkoutLoading}
              className="w-full mt-2 py-3 rounded-xl text-sm font-semibold border-2 border-brand-600 text-brand-700 transition-all inline-flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-brand-50"
            >
              Restart 14-day trial (no card)
            </button>
            <TrialTermsNotice className="mt-4" />
          </>
        ) : (
          <>
            {isTrial && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                {trialEndsDate
                  ? `Your trial ends ${trialEndsDate}. Subscribe before then to keep booking and reminders running.`
                  : 'You are on a full-access trial.'}
              </div>
            )}

            {isComplimentary ? (
              <p className="text-sm text-gray-500">
                This account is on Pro at no charge. There is nothing to pay and no billing to manage.
              </p>
            ) : isTrial ? (
              <>
                {checkoutError && (
                  <div className="mb-4 flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {checkoutError}
                  </div>
                )}
                <button
                  onClick={() => handleUpgrade()}
                  disabled={checkoutLoading}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all inline-flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 hover:opacity-90"
                  style={{ backgroundColor: '#5864C6' }}
                >
                  {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Subscribe — ${PRO_PRICE}/mo
                </button>
                <button
                  onClick={() => handleUpgrade(60)}
                  disabled={checkoutLoading}
                  className="w-full mt-2 py-3 rounded-xl text-sm font-semibold border-2 border-brand-600 text-brand-700 transition-all inline-flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-brand-50"
                >
                  60 days free — card on file (Calendly switchers)
                </button>
                <TrialTermsNotice className="mt-4" />
              </>
            ) : (
              <>
                <button
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  className="w-full py-3 rounded-xl text-sm font-semibold bg-gray-900 hover:bg-gray-800 text-white transition-all inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Manage Billing
                </button>
                <p className="mt-2 text-xs text-center text-gray-400">
                  Cancel anytime — no contracts, no fees. You keep Pro access until {nextBillingDate ?? 'end of billing period'}.
                </p>
              </>
            )}

            <div className="mt-4 flex justify-center">
              <GuaranteeBadge />
            </div>
          </>
        )}
      </div>

    </div>
  );
}
