import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { CheckCircle, AlertTriangle, XCircle, Clock, RefreshCw, Activity } from 'lucide-react';

interface UptimeLog {
  id: string;
  checked_at: string;
  status: 'ok' | 'degraded' | 'down';
  response_time_ms: number | null;
  error_message: string | null;
  service_name: string;
}

interface ServiceStatus {
  name: string;
  key: string;
  status: 'operational' | 'degraded' | 'down' | 'unknown';
  uptime90: number;
  lastChecked: string | null;
}

const SERVICE_NAMES = ['Booking Page', 'Dashboard', 'Database', 'Email/SMS Reminders'];

function statusIcon(s: ServiceStatus['status']) {
  if (s === 'operational') return <CheckCircle className="h-5 w-5 text-indigo-600" />;
  if (s === 'degraded') return <AlertTriangle className="h-5 w-5 text-amber-500" />;
  if (s === 'down') return <XCircle className="h-5 w-5 text-red-500" />;
  return <Clock className="h-5 w-5 text-gray-400" />;
}

function statusBadge(s: ServiceStatus['status']) {
  if (s === 'operational') return <span className="px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 text-xs font-semibold rounded-full">Operational</span>;
  if (s === 'degraded') return <span className="px-2.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-semibold rounded-full">Degraded</span>;
  if (s === 'down') return <span className="px-2.5 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs font-semibold rounded-full">Down</span>;
  return <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-500 text-xs font-semibold rounded-full">Unknown</span>;
}

function overallStatus(services: ServiceStatus[]): ServiceStatus['status'] {
  if (services.some((s) => s.status === 'down')) return 'down';
  if (services.some((s) => s.status === 'degraded')) return 'degraded';
  if (services.every((s) => s.status === 'operational')) return 'operational';
  return 'unknown';
}

function formatRelative(iso: string | null) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function StatusPage() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [recentLogs, setRecentLogs] = useState<UptimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = async () => {
    setLoading(true);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();

    const { data: logs } = await supabase
      .from('uptime_logs')
      .select('*')
      .gte('checked_at', ninetyDaysAgo)
      .order('checked_at', { ascending: false })
      .limit(500);

    const allLogs: UptimeLog[] = (logs ?? []) as UptimeLog[];

    const built: ServiceStatus[] = SERVICE_NAMES.map((name) => {
      const svcLogs = allLogs.filter((l) => l.service_name === name);
      const latest = svcLogs[0];
      const uptime = svcLogs.length > 0
        ? Math.round((svcLogs.filter((l) => l.status === 'ok').length / svcLogs.length) * 1000) / 10
        : 100;

      let status: ServiceStatus['status'] = 'unknown';
      if (latest) {
        if (latest.status === 'ok') status = 'operational';
        else if (latest.status === 'degraded') status = 'degraded';
        else status = 'down';
      }

      return { name, key: name, status, uptime90: uptime, lastChecked: latest?.checked_at ?? null };
    });

    setServices(built);
    setRecentLogs(allLogs.slice(0, 20));
    setLastRefresh(new Date());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const overall = overallStatus(services);

  const overallBg = overall === 'operational' ? 'from-indigo-700 to-indigo-600'
    : overall === 'degraded' ? 'from-amber-600 to-amber-500'
    : overall === 'down' ? 'from-red-600 to-red-500'
    : 'from-[#5864C6] to-[#4a56b8]';

  const overallText = overall === 'operational' ? 'All Systems Operational'
    : overall === 'degraded' ? 'Partial Service Degradation'
    : overall === 'down' ? 'Service Disruption Detected'
    : 'Checking System Status...';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/pinonit_logo.png" alt="Pin on It" className="h-7 w-auto" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Pin on It</span>
          </Link>
          <span className="text-xs text-gray-400 dark:text-slate-500">Status Page</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* Overall status banner */}
        <div className={`bg-gradient-to-r ${overallBg} rounded-2xl p-6 mb-8 text-white shadow-lg`}>
          <div className="flex items-center gap-3 mb-1">
            <Activity className="h-6 w-6" />
            <h1 className="text-xl font-bold">{overallText}</h1>
          </div>
          <p className="text-sm opacity-80">
            Last checked: {formatRelative(lastRefresh.toISOString())}
          </p>
        </div>

        {/* Services */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 mb-8 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Services</h2>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#5864C6] transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          {loading ? (
            <div className="px-6 py-8 flex justify-center">
              <RefreshCw className="h-5 w-5 animate-spin text-gray-300 dark:text-slate-600" />
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {services.map((svc) => (
                <div key={svc.key} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {statusIcon(svc.status)}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{svc.name}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">
                        {svc.lastChecked ? `Last checked ${formatRelative(svc.lastChecked)}` : 'No data yet'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">{svc.uptime90}%</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">90-day uptime</p>
                    </div>
                    {statusBadge(svc.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Uptime bars — last 90 pings per service */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 mb-8 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Incidents</h2>
          </div>
          {recentLogs.filter((l) => l.status !== 'ok').length === 0 ? (
            <div className="px-6 py-8 text-center">
              <CheckCircle className="h-8 w-8 text-indigo-500 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-slate-400">No incidents in the last 90 days.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {recentLogs
                .filter((l) => l.status !== 'ok')
                .slice(0, 10)
                .map((log) => (
                  <div key={log.id} className="px-6 py-4 flex items-start gap-3">
                    {log.status === 'degraded'
                      ? <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      : <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-200">
                        {log.service_name} — {log.status === 'degraded' ? 'Degraded performance' : 'Service outage'}
                      </p>
                      {log.error_message && (
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 truncate">{log.error_message}</p>
                      )}
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                        {new Date(log.checked_at).toLocaleString()}
                        {log.response_time_ms ? ` · ${log.response_time_ms}ms` : ''}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-slate-600">
          Monitored every 5 minutes &middot;{' '}
          <a href="https://pinonit.com" className="hover:text-[#5864C6] transition-colors">pinonit.com</a>
        </p>
      </main>
    </div>
  );
}
