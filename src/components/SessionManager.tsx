import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

const LAST_ACTIVITY_KEY = 'pinonit_last_activity';

function readLastActivity(): number {
  const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function touchActivity() {
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

export function SessionManager() {
  const { user, profile, loading } = useAuth();
  const timeoutMinutes = profile?.session_timeout_minutes ?? null;
  const signingOut = useRef(false);

  const signOutForInactivity = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    localStorage.removeItem(LAST_ACTIVITY_KEY);
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

    if (!localStorage.getItem(LAST_ACTIVITY_KEY)) {
      touchActivity();
    }

    checkInactivity();

    const events = ['mousemove', 'keydown', 'click', 'touchstart'] as const;
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

    const interval = window.setInterval(checkInactivity, 60_000);

    return () => {
      for (const evt of events) {
        window.removeEventListener(evt, onActivity);
      }
      window.clearInterval(interval);
    };
  }, [user, loading, checkInactivity]);

  return null;
}
