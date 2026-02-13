# Datadog Observability for TextShift

Comprehensive monitoring and observability setup for the TextShift platform using Datadog.

## Overview

| Component | Status | Description |
|-----------|--------|-------------|
| Infrastructure Monitoring | Active | CPU, memory, disk, network metrics via Datadog Agent |
| APM (Application Performance Monitoring) | Active | Request tracing via `ddtrace-run` wrapper |
| Log Collection | Active | systemd journal logs (backend, nginx, PostgreSQL) |
| Database Monitoring | Active | PostgreSQL query performance, connections, table sizes |
| Nginx Monitoring | Active | Request rates, connections, response codes |
| Process Monitoring | Active | Running process tracking |
| RUM (Real User Monitoring) | Active | Frontend page loads, JS errors, user interactions |
| Session Replay | Active | Full user session recordings |
| Synthetic Monitors | Active | Uptime checks for homepage, API, grammar tool, SSL |
| Alerts | Active | Disk, CPU, memory, latency, error rate, host down |
| Continuous Profiler | Active | CPU/memory profiling via ddtrace |
| Application Security (ASM) | Active | Attack detection via ddtrace |

## Credentials

| Key | Location |
|-----|----------|
| API Key | `/etc/datadog-agent/datadog.yaml` on the droplet |
| Application Key | Used for Datadog API calls (stored securely) |
| Client Token | Frontend RUM snippet in `index.html` |
| RUM Application ID | Frontend RUM snippet in `index.html` |

All credentials are stored on the production droplet. See the environment credentials document for actual values.

## Architecture

```
                         Datadog Cloud (datadoghq.com)
                                    ^
                                    |
                    +----- Datadog Agent (port 8125/8126) -----+
                    |               ^                          |
                    |               |                          |
        +-----------+    +----------+----------+    +----------+
        |               |                     |               |
   System Metrics   APM Traces            Logs           DB Metrics
   (CPU/mem/disk)   (ddtrace-run)     (journald)      (PostgreSQL)
                         |
                    FastAPI Backend
                    (gunicorn:8000)
                         |
              +----------+----------+
              |                     |
         ML Inference          PostgreSQL
     (HF API / ONNX)         (localhost:5432)


   Browser (textshift.org)
         |
    RUM + Session Replay + Browser Logs
         |
         v
   Datadog RUM Intake (datadoghq.com)
```

## Datadog Agent Configuration

### Main Config (`/etc/datadog-agent/datadog.yaml`)

Key settings enabled:
```yaml
api_key: <DD_API_KEY>
hostname: textshift-production
tags:
  - env:production
  - service:textshift
  - project:textshift
apm_config:
  enabled: true
logs_enabled: true
process_config:
  process_collection:
    enabled: true
```

### Log Collection (`/etc/datadog-agent/conf.d/journald.d/conf.yaml`)

```yaml
logs:
  - type: journald
    container_mode: true
    include_units:
      - textshift-backend.service
      - nginx.service
      - postgresql@14-main.service
    service: textshift
    source: journald
```

### PostgreSQL Monitoring (`/etc/datadog-agent/conf.d/postgres.d/conf.yaml`)

```yaml
init_config:

instances:
  - host: localhost
    port: 5432
    username: datadog
    dbname: textshift
    tags:
      - env:production
      - service:textshift-db
    collect_activity_metrics: true
    collect_database_size_metrics: true
```

PostgreSQL user setup:
```sql
CREATE USER datadog WITH PASSWORD '<password>';
GRANT pg_monitor TO datadog;
GRANT SELECT ON pg_stat_database TO datadog;
```

### Nginx Monitoring (`/etc/datadog-agent/conf.d/nginx.d/conf.yaml`)

```yaml
init_config:

instances:
  - nginx_status_url: http://localhost/nginx_status
    tags:
      - env:production
      - service:textshift-nginx
```

Nginx config addition:
```nginx
location /nginx_status {
    stub_status;
    allow 127.0.0.1;
    deny all;
}
```

## APM Configuration

The backend uses `ddtrace-run` to wrap the gunicorn process for zero-code APM instrumentation.

### systemd Service (`/etc/systemd/system/textshift-backend.service`)

```ini
[Service]
Environment=DD_SERVICE=textshift-backend
Environment=DD_ENV=production
Environment=DD_VERSION=1.0.0
Environment=DD_TRACE_ENABLED=true
Environment=DD_LOGS_INJECTION=true
Environment=DD_PROFILING_ENABLED=true
Environment=DD_APPSEC_ENABLED=true
ExecStart=/opt/textshift/backend/venv/bin/ddtrace-run \
  /opt/textshift/backend/venv/bin/gunicorn app.main:app \
  -w 1 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 --timeout 300
```

### Required Python Package

```
ddtrace>=1.0.0
```

Install: `pip install ddtrace` in the backend virtualenv.

## RUM (Real User Monitoring)

The frontend includes the Datadog RUM + Browser Logs SDK in `index.html`:

```html
<script src="https://www.datadoghq-browser-agent.com/us1/v5/datadog-rum.js"></script>
<script src="https://www.datadoghq-browser-agent.com/us1/v5/datadog-logs.js"></script>
<script>
  window.DD_RUM && window.DD_RUM.init({
    clientToken: "<DD_CLIENT_TOKEN>",
    applicationId: "<DD_RUM_APPLICATION_ID>",
    site: "datadoghq.com",
    service: "textshift-frontend",
    env: "production",
    version: "1.0.0",
    sessionSampleRate: 100,
    sessionReplaySampleRate: 100,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: "mask-user-input"
  });
  window.DD_LOGS && window.DD_LOGS.init({
    clientToken: "<DD_CLIENT_TOKEN>",
    site: "datadoghq.com",
    service: "textshift-frontend",
    env: "production",
    forwardErrorsToLogs: true,
    sessionSampleRate: 100
  });
</script>
```

## Synthetic Monitors

| Monitor | URL | Frequency | Assertions |
|---------|-----|-----------|------------|
| Homepage Uptime | `https://textshift.org/` | 5 min | HTTP 200, <10s |
| API Health Check | `https://textshift.org/api/tools/status` | 5 min | HTTP 200, <15s |
| Grammar Tool Page | `https://textshift.org/writing-tools?tool=grammar` | 10 min | HTTP 200, <10s |
| SSL Certificate | `textshift.org:443` | 24 hr | Expires >30 days |

## Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| Disk Usage > 80% | `system.disk.in_use > 0.8` | Critical (warn at 70%) |
| CPU Usage > 90% | `system.cpu.user > 90` | Critical (warn at 80%) |
| Memory Usage > 90% | `system.mem.pct_usable < 0.1` | Critical (warn at 20%) |
| Host Unreachable | `system.uptime < 1` (no data 10m) | Critical |
| API Latency > 10s | `trace.fastapi.request.duration > 10` | Critical (warn at 5s) |
| Error Rate > 5% | `trace errors / hits > 0.05` | Critical (warn at 2%) |

All alerts notify: `noreply@mail.textshift.org`

## Datadog Dashboards

Access at [app.datadoghq.com](https://app.datadoghq.com):

- **Infrastructure:** `/infrastructure` - Host metrics, processes
- **APM:** `/apm/home` - Service map, traces, latency
- **Logs:** `/logs` - Searchable log explorer
- **RUM:** `/rum/explorer` - Frontend performance, sessions
- **Synthetics:** `/synthetics/tests` - Uptime monitor results
- **Monitors:** `/monitors/manage` - Alert status

## Troubleshooting

### Check Agent Status
```bash
sudo systemctl status datadog-agent
sudo datadog-agent status
sudo datadog-agent configcheck
```

### Verify APM Traces
```bash
sudo datadog-agent status | grep -A 20 "APM Agent"
```

### Check Log Collection
```bash
sudo datadog-agent status | grep -A 20 "Logs Agent"
```

### Restart Agent
```bash
sudo systemctl restart datadog-agent
```

### View Agent Logs
```bash
sudo journalctl -u datadog-agent -f
```
