/**
 * Prometheus metrics registry for the Nexus Ops backend.
 * Exposes both default Node.js metrics and custom application metrics.
 *
 * Usage: GET /metrics  → Prometheus scrape endpoint
 */
import { Registry, Gauge, Counter, collectDefaultMetrics } from 'prom-client';
import { db } from '../storage/db';
import { incidents, alerts } from '../storage/schema';
import { isNull, count, sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

export const metricsRegistry = new Registry();

// Collect default Node.js metrics (event loop lag, heap, GC, etc.)
collectDefaultMetrics({ register: metricsRegistry, prefix: 'nexus_node_' });

// ─── Application-level gauges ────────────────────────────────────────────────

export const incidentsGauge = new Gauge({
  name: 'nexus_incidents_total',
  help: 'Total number of incidents grouped by status and severity',
  labelNames: ['status', 'severity'] as const,
  registers: [metricsRegistry],
});

export const alertsGauge = new Gauge({
  name: 'nexus_alerts_active',
  help: 'Number of currently active (unresolved) alerts, grouped by severity',
  labelNames: ['severity'] as const,
  registers: [metricsRegistry],
});

export const alertsTotal = new Counter({
  name: 'nexus_alerts_fired_total',
  help: 'Total alerts fired since startup, grouped by severity and source',
  labelNames: ['severity', 'source'] as const,
  registers: [metricsRegistry],
});

// ─── Refresh gauges from DB ───────────────────────────────────────────────────

/** Call on each /metrics scrape to update DB-backed gauges */
export async function refreshMetrics(): Promise<void> {
  try {
    // Incidents by status × severity
    incidentsGauge.reset();
    const incRows = await db
      .select({ status: incidents.status, severity: incidents.severity, cnt: count() })
      .from(incidents)
      .groupBy(incidents.status, incidents.severity);
    for (const row of incRows) {
      incidentsGauge.set({ status: row.status, severity: row.severity }, row.cnt);
    }

    // Active alerts by severity
    alertsGauge.reset();
    const alertRows = await db
      .select({ severity: alerts.severity, cnt: count() })
      .from(alerts)
      .where(isNull(alerts.resolvedAt))
      .groupBy(alerts.severity);
    for (const row of alertRows) {
      alertsGauge.set({ severity: row.severity }, row.cnt);
    }
  } catch (err) {
    logger.error('refreshMetrics failed', { err });
  }
}
