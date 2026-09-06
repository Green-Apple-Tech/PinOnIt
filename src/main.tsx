import { StrictMode, Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { supabaseConfigured } from './lib/supabase';

const CHUNK_RELOAD_KEY = 'pinonit-chunk-reload';
const CACHE_BUST_PARAM = '_cb';

function stripCacheBustParam() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(CACHE_BUST_PARAM)) return;
    url.searchParams.delete(CACHE_BUST_PARAM);
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, '', next || url.pathname);
  } catch {
    /* ignore */
  }
}

function isStaleDeployError(error: Error) {
  const message = `${error.name} ${error.message}`;
  return /Failed to fetch dynamically imported module|Loading chunk|Importing a module script failed|error loading dynamically imported module|Failed to load module script/i.test(
    message,
  );
}

function cacheBustReload(): boolean {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has(CACHE_BUST_PARAM)) return false;
    url.searchParams.set(CACHE_BUST_PARAM, String(Date.now()));
    window.location.replace(url.href);
    return true;
  } catch {
    return false;
  }
}

function hardReloadOnce() {
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
      // Prefer URL bust if session key is stuck from a prior attempt
      return cacheBustReload();
    }
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  } catch {
    return cacheBustReload();
  }
  if (cacheBustReload()) return true;
  window.location.reload();
  return true;
}

function BootMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 420, margin: '20vh auto', padding: 24, color: '#0f172a' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{title}</h1>
      <p style={{ fontSize: 14, lineHeight: 1.5, color: '#475569' }}>{detail}</p>
    </div>
  );
}

class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
    if (!isStaleDeployError(error)) return;
    hardReloadOnce();
  }
  render() {
    if (this.state.error) {
      return (
        <BootMessage
          title="This page hit an error"
          detail={`${this.state.error.message}. Close the tab and open pinonit.com/login again.`}
        />
      );
    }
    return this.props.children;
  }
}

async function boot() {
  stripCacheBustParam();

  const rootEl = document.getElementById('root');
  if (!rootEl) {
    document.body.textContent = 'PinOnIt failed to start (missing #root).';
    return;
  }

  if (!supabaseConfigured) {
    createRoot(rootEl).render(
      <BootMessage
        title="Supabase keys are missing"
        detail="Bolt preview needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Secrets. Production Publish uses the same names. After they are set, refresh this preview — or open pinonit.com in a new tab."
      />,
    );
    return;
  }

  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    sessionStorage.removeItem('pinonit-script-reload');
  } catch {
    /* ignore */
  }

  try {
    const { default: App } = await import('./App.tsx');
    (window as Window & { __PINONIT_BOOTED__?: boolean }).__PINONIT_BOOTED__ = true;
    createRoot(rootEl).render(
      <StrictMode>
        <RootErrorBoundary>
          <App />
        </RootErrorBoundary>
      </StrictMode>,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isStaleDeployError(error instanceof Error ? error : new Error(message))) {
      if (hardReloadOnce()) return;
    }
    createRoot(rootEl).render(
      <BootMessage
        title="PinOnIt failed to start"
        detail={`${message}. Close the tab and open pinonit.com/login again.`}
      />,
    );
  }
}

void boot();
