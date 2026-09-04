import { StrictMode, Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
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
          detail={`${this.state.error.message}. Reload, or open pinonit.com in a new tab if this is the Bolt preview.`}
        />
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  document.body.textContent = 'PinOnIt failed to start (missing #root).';
} else if (!supabaseConfigured) {
  createRoot(rootEl).render(
    <BootMessage
      title="Supabase keys are missing"
      detail="Bolt preview needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Production Publish uses the same names in Bolt secrets. After they are set, refresh this preview."
    />,
  );
} else {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    /* ignore */
  }
  createRoot(rootEl).render(
    <StrictMode>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </StrictMode>,
  );
}
