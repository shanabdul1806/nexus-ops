import axios, { AxiosInstance } from 'axios';
import {
  GrafanaDashboard,
  GrafanaDashboardDetail,
  GrafanaPanel,
  GrafanaDatasource,
  GrafanaHealth,
  GrafanaAlertInstance,
  GrafanaAlertRule,
  Severity,
} from '../../../shared/types';
import { logger } from '../utils/logger';

export class GrafanaConnector {
  private client: AxiosInstance;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 15_000,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  }

  /** Grafana server health check */
  async health(): Promise<GrafanaHealth | null> {
    try {
      const { data } = await this.client.get('/api/health');
      return {
        commit: (data as Record<string, string>).commit ?? '',
        database: (data as Record<string, string>).database as 'ok' | 'degraded' ?? 'ok',
        version: (data as Record<string, string>).version ?? '',
      };
    } catch (err) {
      logger.error('Grafana health check failed', { err });
      return null;
    }
  }

  /** Search dashboards — optional free-text query and/or tag filter */
  async listDashboards(query?: string, tags?: string[]): Promise<GrafanaDashboard[]> {
    try {
      const params: Record<string, unknown> = { type: 'dash-db', limit: 100 };
      if (query) params.query = query;
      if (tags?.length) params.tag = tags;
      const { data } = await this.client.get('/api/search', { params });
      return (data as Record<string, unknown>[]).map(this.mapDashboard);
    } catch (err) {
      logger.error('Grafana listDashboards failed', { err });
      return [];
    }
  }

  /** Fetch full dashboard detail by UID */
  async getDashboard(uid: string): Promise<GrafanaDashboardDetail | null> {
    try {
      const { data } = await this.client.get(`/api/dashboards/uid/${uid}`);
      const dash = data as Record<string, unknown>;
      const meta = dash.meta as Record<string, unknown>;
      const model = dash.dashboard as Record<string, unknown>;
      return {
        uid: model.uid as string,
        title: model.title as string,
        url: meta.url as string ?? '',
        tags: (model.tags as string[]) ?? [],
        panels: this.mapPanels((model.panels as Record<string, unknown>[]) ?? []),
        version: (model.version as number) ?? 0,
        schemaVersion: (model.schemaVersion as number) ?? 0,
      };
    } catch (err) {
      logger.error('Grafana getDashboard failed', { uid, err });
      return null;
    }
  }

  /** List all configured datasources */
  async listDatasources(): Promise<GrafanaDatasource[]> {
    try {
      const { data } = await this.client.get('/api/datasources');
      return (data as Record<string, unknown>[]).map(this.mapDatasource);
    } catch (err) {
      logger.error('Grafana listDatasources failed', { err });
      return [];
    }
  }

  /** Get a single datasource by UID */
  async getDatasource(uid: string): Promise<GrafanaDatasource | null> {
    try {
      const { data } = await this.client.get(`/api/datasources/uid/${uid}`);
      return this.mapDatasource(data as Record<string, unknown>);
    } catch (err) {
      logger.error('Grafana getDatasource failed', { uid, err });
      return null;
    }
  }

  /**
   * Active alert instances from Grafana Alertmanager (Grafana 9+ unified alerting).
   * Falls back to legacy /api/alerts for older Grafana versions.
   */
  async listAlertInstances(): Promise<GrafanaAlertInstance[]> {
    // Try unified alerting first (Grafana 9+)
    try {
      const { data } = await this.client.get(
        '/api/alertmanager/grafana/api/v2/alerts',
        { params: { active: true, silenced: false, inhibited: false } },
      );
      const raw = data as Record<string, unknown>[];
      return raw.map((a) => this.mapAlertInstance(a));
    } catch (unifiedErr) {
      // Fall back to legacy alert API (Grafana < 9)
      try {
        const { data } = await this.client.get('/api/alerts', {
          params: { state: 'alerting', limit: 100 },
        });
        const raw = data as Record<string, unknown>[];
        return raw.map((a) => this.mapLegacyAlert(a));
      } catch (legacyErr) {
        logger.error('Grafana listAlertInstances failed (both APIs)', { legacyErr });
        return [];
      }
    }
  }

  /**
   * Provisioned alert rules from Grafana unified alerting.
   * Requires Grafana 9+ and an Admin/Editor token.
   */
  async listAlertRules(): Promise<GrafanaAlertRule[]> {
    try {
      const { data } = await this.client.get('/api/v1/provisioning/alert-rules');
      const raw = data as Record<string, unknown>[];
      return raw.map((r) => ({
        uid: r.uid as string ?? '',
        title: r.title as string ?? '',
        condition: r.condition as string ?? '',
        folderUID: r.folderUID as string ?? '',
        ruleGroup: r.ruleGroup as string ?? '',
        noDataState: r.noDataState as string ?? 'NoData',
        execErrState: r.execErrState as string ?? 'Error',
        isPaused: (r.isPaused as boolean) ?? false,
      }));
    } catch (err) {
      logger.error('Grafana listAlertRules failed', { err });
      return [];
    }
  }

  // ─── Private mappers ────────────────────────────────────────────────────

  private mapAlertInstance(a: Record<string, unknown>): GrafanaAlertInstance {
    const labels = (a.labels as Record<string, string>) ?? {};
    const annotations = (a.annotations as Record<string, string>) ?? {};
    const status = (a.status as Record<string, unknown>) ?? {};
    return {
      fingerprint: a.fingerprint as string ?? '',
      name: labels.alertname ?? 'Grafana Alert',
      state: (status.state as GrafanaAlertInstance['state']) ?? 'active',
      severity: this.mapSeverity(labels.severity ?? labels.priority ?? ''),
      summary: annotations.summary ?? annotations.description ?? labels.alertname ?? '',
      labels,
      annotations,
      startsAt: a.startsAt as string ?? new Date().toISOString(),
      generatorURL: a.generatorURL as string ?? '',
      folder: labels.grafana_folder,
    };
  }

  private mapLegacyAlert(a: Record<string, unknown>): GrafanaAlertInstance {
    return {
      fingerprint: String(a.id ?? ''),
      name: a.name as string ?? 'Grafana Alert',
      state: 'active',
      severity: 'high',
      summary: (a.name as string) ?? '',
      labels: { alertname: a.name as string ?? '', panelId: String(a.panelId ?? '') },
      annotations: { summary: a.name as string ?? '' },
      startsAt: a.newStateDate as string ?? new Date().toISOString(),
      generatorURL: a.url as string ?? '',
      folder: undefined,
    };
  }

  private mapSeverity(raw: string): Severity {
    switch (raw.toLowerCase()) {
      case 'critical': return 'critical';
      case 'high':
      case 'error':   return 'high';
      case 'warning':
      case 'warn':
      case 'medium':  return 'medium';
      case 'info':
      case 'low':     return 'low';
      default:        return 'high';  // unknown severity → treat as high
    }
  }

  private mapDashboard(d: Record<string, unknown>): GrafanaDashboard {
    return {
      uid: d.uid as string,
      id: d.id as number,
      title: d.title as string,
      url: d.url as string ?? '',
      folderTitle: d.folderTitle as string | undefined,
      folderUid: d.folderUid as string | undefined,
      tags: (d.tags as string[]) ?? [],
      starred: (d.isStarred as boolean) ?? false,
      type: (d.type as GrafanaDashboard['type']) ?? 'dash-db',
    };
  }

  private mapPanels(raw: Record<string, unknown>[]): GrafanaPanel[] {
    return raw
      .filter((p) => p.type !== 'row')
      .map((p) => ({
        id: p.id as number ?? 0,
        title: (p.title as string) ?? '',
        type: (p.type as string) ?? 'unknown',
        gridPos: (p.gridPos as GrafanaPanel['gridPos']) ?? { x: 0, y: 0, w: 12, h: 8 },
        description: p.description as string | undefined,
      }));
  }

  private mapDatasource(d: Record<string, unknown>): GrafanaDatasource {
    return {
      id: d.id as number,
      uid: d.uid as string ?? '',
      name: d.name as string,
      type: d.type as string,
      url: d.url as string ?? '',
      access: (d.access as 'proxy' | 'direct') ?? 'proxy',
      isDefault: (d.isDefault as boolean) ?? false,
      jsonData: d.jsonData as Record<string, unknown> | undefined,
    };
  }
}
