import React, { useEffect, useState, useCallback } from 'react';
import { grafanaApi } from '../services/api';
import { GrafanaDashboard, GrafanaDashboardDetail, GrafanaDatasource, GrafanaHealth, GrafanaAlertInstance } from '@shared/types';

// Resolve Grafana's browser-facing URL at runtime (set via VITE_ build arg or window injection)
function getGrafanaBase(): string {
  const win = typeof window !== 'undefined' ? (window as unknown as Record<string, string>) : {};
  return win.ENV_GRAFANA_URL
    ?? (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_GRAFANA_URL
    ?? 'http://localhost:3001';
}

export default function GrafanaPage() {
  const [health, setHealth]               = useState<GrafanaHealth | null>(null);
  const [dashboards, setDashboards]       = useState<GrafanaDashboard[]>([]);
  const [datasources, setDatasources]     = useState<GrafanaDatasource[]>([]);
  const [alertInstances, setAlertInstances] = useState<GrafanaAlertInstance[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [search, setSearch]               = useState('');
  const [selectedDash, setSelectedDash]   = useState<GrafanaDashboard | null>(null);

  const grafanaBase = getGrafanaBase();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      grafanaApi.health().catch(() => null),
      grafanaApi.listDashboards().catch(() => [] as GrafanaDashboard[]),
      grafanaApi.listDatasources().catch(() => [] as GrafanaDatasource[]),
      grafanaApi.listAlertInstances().catch(() => [] as GrafanaAlertInstance[]),
    ]).then(([h, d, ds, ai]) => {
      setHealth(h);
      setDashboards(d);
      setDatasources(ds);
      setAlertInstances(ai);
      if (!h) setError('Could not reach Grafana. Check GRAFANA_URL and GRAFANA_TOKEN.');
    }).finally(() => setLoading(false));
  }, []);

  const filtered = dashboards.filter((d) =>
    !search || d.title.toLowerCase().includes(search.toLowerCase()) || d.tags.some((t) => t.includes(search.toLowerCase()))
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#e6edf3', margin: 0 }}>Grafana</h1>
            {health && (
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 10,
                background: health.database === 'ok' ? '#23863622' : '#f8514922',
                color: health.database === 'ok' ? '#3fb950' : '#f85149',
                border: `1px solid ${health.database === 'ok' ? '#23863644' : '#f8514944'}`,
              }}>
                v{health.version} · {health.database}
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: '#8b949e', margin: '4px 0 0' }}>
            {dashboards.length} dashboards · {datasources.length} datasources
            {alertInstances.length > 0 && (
              <span style={{ color: '#f85149', marginLeft: 6 }}>
                · {alertInstances.length} firing alert{alertInstances.length !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search dashboards…"
          style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid #30363d', background: '#0d1117', color: '#e6edf3', fontSize: 12, width: 200, outline: 'none' }}
        />
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#f8514922', border: '1px solid #f8514944', borderRadius: 8, color: '#f85149', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}
      {loading && <div style={{ color: '#8b949e', fontSize: 13 }}>Loading Grafana data…</div>}

      {/* Firing Alerts */}
      {!loading && alertInstances.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🔔</span> Firing Alerts
            <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: '#f8514922', color: '#f85149', border: '1px solid #f8514944' }}>
              {alertInstances.length} active
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alertInstances.map((a) => <AlertInstanceRow key={a.fingerprint} alert={a} />)}
          </div>
        </div>
      )}

      {/* Datasources strip */}
      {!loading && datasources.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {datasources.map((ds) => (
            <div key={ds.uid} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
              borderRadius: 20, background: '#161b22',
              border: `1px solid ${ds.isDefault ? '#1f6feb44' : '#30363d'}`,
              fontSize: 11, color: ds.isDefault ? '#58a6ff' : '#8b949e',
            }}>
              <span style={{ fontSize: 12 }}>{dsIcon(ds.type)}</span>
              {ds.name}
              {ds.isDefault && <span style={{ fontSize: 9, color: '#8b949e' }}>default</span>}
            </div>
          ))}
        </div>
      )}

      {/* Dashboard card grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, marginBottom: selectedDash ? 16 : 0 }}>
        {filtered.map((dash) => (
          <DashboardCard
            key={dash.uid}
            dash={dash}
            grafanaBase={grafanaBase}
            selected={selectedDash?.uid === dash.uid}
            onSelect={() => setSelectedDash(selectedDash?.uid === dash.uid ? null : dash)}
          />
        ))}
        {!loading && filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', color: '#8b949e', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
            No dashboards match your search.
          </div>
        )}
      </div>

      {/* Embedded dashboard view — full width below the grid */}
      {selectedDash && (
        <DashboardEmbed
          dash={selectedDash}
          grafanaBase={grafanaBase}
          onClose={() => setSelectedDash(null)}
        />
      )}
    </div>
  );
}

// ─── Dashboard Card ───────────────────────────────────────────────────────────

function DashboardCard({ dash, grafanaBase, selected, onSelect }: {
  dash: GrafanaDashboard;
  grafanaBase: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const dashUrl = `${grafanaBase}${dash.url}`;
  return (
    <div
      onClick={onSelect}
      style={{
        borderRadius: 10, border: `1px solid ${selected ? '#1f6feb' : '#30363d'}`,
        background: selected ? '#1f2937' : '#161b22',
        padding: '14px 16px', cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>📊</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: selected ? '#79c0ff' : '#58a6ff',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {dash.title}
            </span>
            {dash.starred && <span style={{ fontSize: 11 }}>⭐</span>}
          </div>
          {dash.folderTitle && (
            <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>📁 {dash.folderTitle}</div>
          )}
          {dash.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
              {dash.tags.map((t) => (
                <span key={t} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#1f6feb22', color: '#58a6ff' }}>{t}</span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <a href={dashUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
            title="Open in Grafana"
            style={{ fontSize: 11, color: '#8b949e', textDecoration: 'none' }}>↗</a>
          <span style={{ fontSize: 10, color: selected ? '#58a6ff' : '#484f58' }}>
            {selected ? '▲ embedded' : '▼ embed'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Embed Panel ────────────────────────────────────────────────────

type EmbedTab = 'dashboard' | 'panels';

function DashboardEmbed({ dash, grafanaBase, onClose }: {
  dash: GrafanaDashboard;
  grafanaBase: string;
  onClose: () => void;
}) {
  const [tab, setTab]         = useState<EmbedTab>('dashboard');
  const [detail, setDetail]   = useState<GrafanaDashboardDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [iframeH, setIframeH] = useState(580);

  const dashEmbedUrl = `${grafanaBase}${dash.url}?kiosk=tv&refresh=30s`;
  const dashOpenUrl  = `${grafanaBase}${dash.url}`;

  const loadDetail = useCallback(async () => {
    if (detail || detailLoading) return;
    setDetailLoading(true);
    try { setDetail(await grafanaApi.getDashboard(dash.uid)); }
    catch { /* ignore */ }
    finally { setDetailLoading(false); }
  }, [dash.uid, detail, detailLoading]);

  useEffect(() => {
    if (tab === 'panels') loadDetail();
  }, [tab, loadDetail]);

  return (
    <div style={{ borderRadius: 12, border: '1px solid #1f6feb', background: '#0d1117', overflow: 'hidden' }}>
      {/* Embed header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#161b22', borderBottom: '1px solid #21262d' }}>
        <span style={{ fontSize: 16 }}>📊</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#e6edf3', flex: 1 }}>{dash.title}</span>

        {/* Tabs */}
        {(['dashboard', 'panels'] as EmbedTab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
            background: tab === t ? '#1f6feb' : '#21262d',
            color: tab === t ? '#fff' : '#8b949e',
            border: `1px solid ${tab === t ? '#1f6feb' : '#30363d'}`,
          }}>
            {t === 'dashboard' ? '⬛ Full Dashboard' : '▦ Panel Grid'}
          </button>
        ))}

        {/* Height control */}
        <select value={iframeH} onChange={(e) => setIframeH(Number(e.target.value))}
          style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, background: '#21262d', color: '#8b949e', border: '1px solid #30363d', cursor: 'pointer' }}>
          <option value={400}>Compact</option>
          <option value={580}>Medium</option>
          <option value={800}>Tall</option>
          <option value={1100}>Full</option>
        </select>

        <a href={dashOpenUrl} target="_blank" rel="noreferrer"
          style={{ fontSize: 12, color: '#58a6ff', textDecoration: 'none', padding: '4px 10px', borderRadius: 6, border: '1px solid #1f6feb44', background: '#1f6feb11' }}>
          Open in Grafana ↗
        </a>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>✕</button>
      </div>

      {/* Full dashboard iframe */}
      {tab === 'dashboard' && (
        <div style={{ position: 'relative', background: '#0d1117' }}>
          <iframe
            src={dashEmbedUrl}
            style={{ width: '100%', height: iframeH, border: 'none', display: 'block' }}
            title={`Grafana: ${dash.title}`}
            allow="fullscreen"
          />
        </div>
      )}

      {/* Panel grid — individual panel iframes */}
      {tab === 'panels' && (
        <div style={{ padding: 16 }}>
          {detailLoading && (
            <div style={{ color: '#8b949e', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>Loading panels…</div>
          )}
          {!detailLoading && detail && detail.panels.length === 0 && (
            <div style={{ color: '#8b949e', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>No panels found in this dashboard.</div>
          )}
          {!detailLoading && detail && detail.panels.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: '#484f58', marginBottom: 12 }}>
                {detail.panels.length} panels — each renders live from Grafana · auto-refresh 30s
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 12 }}>
                {detail.panels.map((p) => {
                  const panelUrl = `${grafanaBase}/d-solo/${dash.uid}?orgId=1&panelId=${p.id}&refresh=30s`;
                  const panelH = Math.max(180, Math.round((p.gridPos.h / 24) * 500));
                  return (
                    <div key={p.id} style={{ borderRadius: 8, border: '1px solid #21262d', overflow: 'hidden', background: '#161b22' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#1c2128', borderBottom: '1px solid #21262d' }}>
                        <span style={{ fontSize: 13 }}>{panelIcon(p.type)}</span>
                        <span style={{ fontSize: 11, color: '#e6edf3', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.title || '(untitled)'}
                        </span>
                        <span style={{ fontSize: 10, color: '#484f58' }}>{p.type}</span>
                        <a href={`${grafanaBase}${dash.url}?viewPanel=${p.id}`} target="_blank" rel="noreferrer"
                          style={{ fontSize: 10, color: '#8b949e', textDecoration: 'none' }}>↗</a>
                      </div>
                      <iframe
                        src={panelUrl}
                        style={{ width: '100%', height: panelH, border: 'none', display: 'block' }}
                        title={p.title || `Panel ${p.id}`}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Alert Instance Row ───────────────────────────────────────────────────────

const SEV_COLOR: Record<string, string> = {
  critical: '#f85149', high: '#f85149', medium: '#d29922', low: '#3fb950', info: '#58a6ff',
};

function AlertInstanceRow({ alert }: { alert: GrafanaAlertInstance }) {
  const color = SEV_COLOR[alert.severity] ?? '#8b949e';
  const diff  = Date.now() - new Date(alert.startsAt).getTime();
  const m     = Math.floor(diff / 60000);
  const timeAgoStr = m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: '#161b22', border: `1px solid ${color}44` }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>{alert.name}</span>
          {alert.folder && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#21262d', color: '#8b949e' }}>{alert.folder}</span>}
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: `${color}22`, color, border: `1px solid ${color}44` }}>{alert.severity}</span>
        </div>
        {alert.summary && <div style={{ fontSize: 12, color: '#8b949e', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.summary}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: '#8b949e' }}>firing {timeAgoStr}</span>
        {alert.generatorURL && (
          <a href={alert.generatorURL} target="_blank" rel="noreferrer"
            style={{ fontSize: 11, color: '#58a6ff', textDecoration: 'none', padding: '2px 8px', borderRadius: 4, border: '1px solid #1f6feb44', background: '#1f6feb11' }}>
            View →
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dsIcon(type: string): string {
  const icons: Record<string, string> = {
    prometheus: '🔥', loki: '📜', influxdb: '📈', elasticsearch: '🔍',
    mysql: '🐬', postgres: '🐘', tempo: '⏱', jaeger: '🔭',
  };
  return icons[type] ?? '🗄';
}

function panelIcon(type: string): string {
  const icons: Record<string, string> = {
    timeseries: '📈', graph: '📈', gauge: '🎯', stat: '📊',
    table: '📋', bargauge: '📊', piechart: '🥧', logs: '📜',
    alertlist: '🔔', text: '📝', heatmap: '🗺', histogram: '📊',
    nodeGraph: '🕸', traces: '🔭',
  };
  return icons[type] ?? '📊';
}
