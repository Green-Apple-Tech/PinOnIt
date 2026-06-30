import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SUPPORT_EMAIL } from '../lib/contactEmail';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import {
  Check, Zap, Loader2, AlertCircle, ArrowRight,
  DollarSign, TrendingUp, Copy, Users, ChevronDown,
  Shield, Info, X,
} from 'lucide-react';

const PRICE_ID = 'price_1TZHhhIVv38UYFOXMXT2EV8v';
const PRO_PRICE = 6;

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
  const { profile, subscription, refreshProfile } = useAuth();
  const currentPlan = subscription?.plan ?? profile?.plan ?? 'free';
  const isPro = currentPlan === 'pro';
  const isTrialing = subscription?.status === 'trialing';

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [myConverted, setMyConverted] = useState(0);
  const [myTotalCents, setMyTotalCents] = useState(0);
  const [thisMonthCents, setThisMonthCents] = useState(0);
  const [referralOpen, setReferralOpen] = useState(false);
  const [successBanner, setSuccessBanner] = useState(false);

  const referralLink = profile?.referral_code
    ? `${window.location.origin}/ref/${profile.referral_code}`
    : '';

  // Show success banner if returning from checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      setSuccessBanner(true);
      refreshProfile?.();
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      const [{ count }, { data: credits }] = await Promise.all([
        supabase
          .from('referrals')
          .select('id', { count: 'exact', head: true })
          .eq('referrer_id', profile.id)
          .eq('status', 'converted'),
        supabase
          .from('referral_credits')
          .select('amount_cents, created_at')
          .eq('user_id', profile.id),
      ]);
      const now = new Date();
      const allC = credits ?? [];
      setMyConverted(count ?? 0);
      setMyTotalCents(allC.reduce((s, c) => s + c.amount_cents, 0));
      setThisMonthCents(
        allC
          .filter((c) => {
            const d = new Date(c.created_at);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          })
          .reduce((s, c) => s + c.amount_cents, 0)
      );
    })();
  }, [profile?.id]);

  const copyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
      const body: Record<string, unknown> = {
        price_id: PRICE_ID,
        app_url: window.location.origin,
      };
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
    <div className={embedded ? 'space-y-4 max-w-2xl' : 'p-6 md:p-8 max-w-2xl space-y-4'}>

      {/* Success banner */}
      {successBanner && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl success">
          <Check className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800">You're on Pro — $6/mo, cancel anytime in Billing.</p>
            <p className="text-xs text-emerald-600 mt-0.5">All Pro features are now active on your account.</p>
          </div>
          <button onClick={() => setSuccessBanner(false)} className="p-1 text-emerald-400 hover:text-emerald-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Current plan card ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1.5">Current plan</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
                isPro
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {isPro && <Zap className="h-3.5 w-3.5" />}
                {isPro ? 'Pro' : 'Free'}
              </span>
              {isTrialing && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
                  Pro Trial — {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} remaining (no charge until {trialEndsDate})
                </span>
              )}
            </div>
          </div>
          {isPro && nextBillingDate && !isTrialing && (
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-400">Next billing</p>
              <p className="text-sm font-semibold text-gray-700">{nextBillingDate}</p>
              <p className="text-sm text-gray-500">${PRO_PRICE}/mo</p>
            </div>
          )}
          {isTrialing && trialEndsDate && (
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-400">Trial ends</p>
              <p className="text-sm font-semibold text-gray-700">{trialEndsDate}</p>
              <p className="text-xs text-gray-400 mt-0.5">then ${PRO_PRICE}/mo</p>
            </div>
          )}
        </div>

        {!isPro ? (
          <>
            <ul className="space-y-2.5 mb-5">
              {[
                '1 event type',
                'Basic scheduling',
                'Email reminders',
                'Referral program access',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                  <Check className="h-4 w-4 text-indigo-600 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            {/* Trial offer callout */}
            <div className="mb-4 p-4 bg-brand-50 border border-brand-100 rounded-xl">
              <p className="text-sm font-semibold text-brand-800 mb-0.5">Try every Pro feature free for 60 days</p>
              <p className="text-xs text-brand-600">
                Switch from Calendly? No charge for 60 days. New user? 14 days free. Cancel anytime.
              </p>
            </div>

            {checkoutError && (
              <div className="mb-4 flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {checkoutError}
              </div>
            )}

            <button
              onClick={() => handleUpgrade(14)}
              disabled={checkoutLoading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all inline-flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 hover:opacity-90" style={{ backgroundColor: '#5864C6' }}
            >
              {checkoutLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <ArrowRight className="h-4 w-4" />}
              Keep Pro after trial — ${PRO_PRICE}/mo
            </button>

            <p className="mt-2 text-xs text-center text-gray-400">
              Cancel anytime — no contracts, no fees
            </p>

            <div className="mt-4 flex justify-center">
              <GuaranteeBadge />
            </div>
          </>
        ) : (
          <>
            <ul className="space-y-2.5 mb-5">
              {[
                'Unlimited event types',
                'SMS + WhatsApp + Email reminders',
                'Calendar sync (Google, Outlook, Apple)',
                'PayPal payments at booking',
                'Email signature creator',
                'Remove PinOnIt branding',
                'Priority support',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                  <Check className="h-4 w-4 text-indigo-600 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            {isTrialing && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                Your trial ends {trialEndsDate} — no charge until then. Cancel before that date and you will never be billed.
              </div>
            )}

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

            <div className="mt-4 flex justify-center">
              <GuaranteeBadge />
            </div>
          </>
        )}
      </div>

      {/* ── Referral program (collapsible) ────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <button
          onClick={() => setReferralOpen((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
        >
          <div>
            <p className="text-sm font-semibold text-gray-800">Referral Program</p>
            <p className="text-xs text-gray-400 mt-0.5">Share PinOnIt and earn $1/month per referral</p>
          </div>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform shrink-0 ${referralOpen ? 'rotate-180' : ''}`} />
        </button>

        {referralOpen && (
          <div className="px-6 pb-6 border-t border-gray-100 pt-4 space-y-4">
            {myConverted > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Referrals', value: myConverted, icon: Users, color: 'text-blue-600' },
                  { label: 'This month', value: `$${(thisMonthCents / 100).toFixed(0)}`, icon: DollarSign, color: 'text-indigo-600' },
                  { label: 'All time', value: `$${(myTotalCents / 100).toFixed(0)}`, icon: TrendingUp, color: 'text-teal-600' },
                ].map((s) => (
                  <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <s.icon className={`h-4 w-4 mx-auto mb-1 ${s.color}`} />
                    <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-400">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {referralLink ? (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your referral link</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                    <span className="text-sm text-indigo-600 font-mono truncate block">{referralLink}</span>
                  </div>
                  <button
                    onClick={copyLink}
                    className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-xl transition-all hover:opacity-90" style={{ backgroundColor: '#5864C6' }}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  Refer 6 Pro users and your plan is free forever. Refer more and we pay you.{' '}
                  <Link to="/leaderboard" className="text-indigo-600 hover:underline">View leaderboard</Link>
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Your referral link will appear here once your account is set up.</p>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
