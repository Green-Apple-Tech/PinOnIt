import { StrictMode, Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { supabaseConfigured } from './lib/supabase';

const CHUNK_RELOAD_KEY = 'pinonit-chunk-reload';

function isStaleDeployError(error: Error) {
  const message = `${error.name} ${error.message}`;
  return /Failed to fetch dynamically imported module|Loading chunk|Importing a module script failed|error loading dynamically imported module/i.test(
    message,
  );
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
    try {
      if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;
      sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
      window.location.reload();
    } catch {
      /* private mode / blocked storage */
    }
  }
  render() {
    if (this.state.error) {
      return (
        <BootMessage
          title="This page hit an error"
          detail={`${this.state.error.message}. Reload, or open pinonit.com in a new tab.`}
        />
      );
    }
    return this.props.children;
  }
}

async function boot() {
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
      try {
        if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
          window.location.reload();
          return;
        }
      } catch {
        /* private mode / blocked storage */
      }
    }
    createRoot(rootEl).render(
      <BootMessage
        title="PinOnIt failed to start"
        detail={`${message}. Hard-refresh with Cmd+Shift+R, or open pinonit.com in a new tab.`}
      />,
    );
  }
}

void boot();
