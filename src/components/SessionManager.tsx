import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { resolveSessionTimeoutMinutes } from '../lib/sessionTimeout';
import { storageGet, storageRemove, storageSet } from '../lib/safeStorage';

const LAST_ACTIVITY_KEY = 'pinonit_last_activity';

function readLastActivity(): number {
  const raw = storageGet(LAST_ACTIVITY_KEY);
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function touchActivity() {
  storageSet(LAST_ACTIVITY_KEY, String(Date.now()));
}

export function SessionManager() {
  const { user, profile, loading } = useAuth();
  const timeoutMinutes = resolveSessionTimeoutMinutes(profile?.session_timeout_minutes);
  const signingOut = useRef(false);

  const signOutForInactivity = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    storageRemove(LAST_ACTIVITY_KEY);
    await supabase.auth.signOut();
    window.location.href = '/login?signed_out=inactivity';
  }, []);

  const checkInactivity = useCallback(() => {
    if (!user || loading || !timeoutMinutes || timeoutMinutes <= 0) return;
    const elapsed = Date.now() - readLastActivity();
    if (elapsed > timeoutMinutes * 60 * 1000) {
      void signOutForInactivity();
    }
  }, [user, loading, timeoutMinutes, signOutForInactivity]);

  useEffect(() => {
    if (!user || loading) return;

    if (!storageGet(LAST_ACTIVITY_KEY)) {
      touchActivity();
    }

    checkInactivity();

    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const;
    let lastTouchWrite = 0;

    const onActivity = () => {
      const now = Date.now();
      if (now - lastTouchWrite < 5000) return;
      lastTouchWrite = now;
      touchActivity();
    };

    for (const evt of events) {
      window.addEventListener(evt, onActivity, { passive: true });
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkInactivity();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const interval = window.setInterval(checkInactivity, 15_000);

    return () => {
      for (const evt of events) {
        window.removeEventListener(evt, onActivity);
      }
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
    };
  }, [user, loading, checkInactivity]);

  return null;
}
