"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useLocation } from "@/context/LocationContext";
import { fetchOpenMeteoForecast } from "@/lib/openMeteo";
import { evaluateAlerts } from "@/lib/alertRules";
import { audioAlertEngine } from "@/lib/audioAlert";
import type { WeatherAlert } from "@/lib/types";

interface CustomRule {
  id: string;
  name: string;
  metric: "temperature" | "windSpeed" | "rainfall" | "uvIndex" | "aqi";
  operator: "gt" | "lt" | "gte" | "lte";
  threshold: number;
  durationHours: number;
  severity: "info" | "watch" | "warning" | "danger";
  enabled: boolean;
  createdAt: string;
}

interface AlertHistoryItem {
  id: string;
  location: string;
  title: string;
  message: string;
  severity: string;
  kind: string;
  read: boolean;
  triggeredAt: string;
}

export default function AlertsPage() {
  const { location } = useLocation();
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">("default");

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(0.6);

  const [webhookUrl, setWebhookUrl] = useState("");
  const [sendingWebhook, setSendingWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const [watchdogActive, setWatchdogActive] = useState(false);
  const [lastWatchdogCheck, setLastWatchdogCheck] = useState<string | null>(null);
  const [activeBannerAlert, setActiveBannerAlert] = useState<string | null>(null);
  const watchdogIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [customRules, setCustomRules] = useState<CustomRule[]>([]);
  const [alertHistory, setAlertHistory] = useState<AlertHistoryItem[]>([]);
  const [schedulerStatus, setSchedulerStatus] = useState<string | null>(null);
  const [evaluatingCron, setEvaluatingCron] = useState(false);

  const [newRule, setNewRule] = useState({
    name: "",
    metric: "temperature",
    operator: "gt",
    threshold: 35,
    severity: "warning",
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      if ("Notification" in window) {
        setPushPermission(Notification.permission);
      } else {
        setPushPermission("unsupported");
      }

      const savedWebhook = localStorage.getItem("skywatch_alert_webhook");
      if (savedWebhook) setWebhookUrl(savedWebhook);

      const savedSound = localStorage.getItem("skywatch_alert_sound");
      if (savedSound !== null) setSoundEnabled(savedSound === "true");

      const savedVol = localStorage.getItem("skywatch_alert_volume");
      if (savedVol !== null) setSoundVolume(Number(savedVol));
    }
  }, []);

  const loadRulesAndHistory = useCallback(() => {
    axios
      .get("/api/alerts/rules")
      .then((res) => setCustomRules(res.data.rules || []))
      .catch(() => {});
    axios
      .get("/api/alerts/history")
      .then((res) => setAlertHistory(res.data.alerts || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadRulesAndHistory();
  }, [loadRulesAndHistory]);

  const evaluateLocationWeather = useCallback(async () => {
    if (!location) return;
    setLoading(true);
    setError(null);
    try {
      const meteo = await fetchOpenMeteoForecast(location.lat, location.lon);
      const evaluated = evaluateAlerts(location.name, meteo.daily);
      setAlerts(evaluated);
      setLastWatchdogCheck(new Date().toLocaleTimeString());

      if (evaluated.length > 0) {
        const primary = evaluated[0];
        setActiveBannerAlert(`⚠️ ${primary.title}: ${primary.message}`);

        if (soundEnabled) {
          if (primary.severity === "warning") {
            audioAlertEngine.playWarningChime(soundVolume);
          } else {
            audioAlertEngine.playInfoChime(soundVolume);
          }
        }
      } else {
        setActiveBannerAlert(null);
      }
    } catch {
      setError("Could not evaluate meteorological conditions for this location.");
    } finally {
      setLoading(false);
    }
  }, [location, soundEnabled, soundVolume]);

  useEffect(() => {
    evaluateLocationWeather();
  }, [evaluateLocationWeather]);

  useEffect(() => {
    if (watchdogActive) {
      watchdogIntervalRef.current = setInterval(() => {
        evaluateLocationWeather();
      }, 30000);
    } else {
      if (watchdogIntervalRef.current) {
        clearInterval(watchdogIntervalRef.current);
        watchdogIntervalRef.current = null;
      }
    }
    return () => {
      if (watchdogIntervalRef.current) clearInterval(watchdogIntervalRef.current);
    };
  }, [watchdogActive, evaluateLocationWeather]);

  const enablePush = async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setPushPermission(permission);
    if (permission === "granted") {
      new Notification("SkyWatch Alert System Active", {
        body: "Real-time desktop notifications are now enabled for severe meteorological events.",
        icon: "/favicon.ico",
      });
      if (soundEnabled) audioAlertEngine.playInfoChime(soundVolume);
    }
  };

  const triggerTestAlert = (severity: "info" | "warning" | "danger" = "warning") => {
    if (soundEnabled) {
      if (severity === "danger") audioAlertEngine.playDangerSiren(soundVolume);
      else if (severity === "warning") audioAlertEngine.playWarningChime(soundVolume);
      else audioAlertEngine.playInfoChime(soundVolume);
    }

    if (pushPermission === "granted") {
      new Notification(`[TEST] SkyWatch ${severity.toUpperCase()} Alert`, {
        body: `Test broadcast for ${location?.name ?? "your area"} — meteorological alert systems operating normally.`,
        icon: "/favicon.ico",
      });
    }

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([150, 80, 150]);
    }
  };

  const handleSaveAndTestWebhook = async () => {
    if (!webhookUrl.trim()) return;
    localStorage.setItem("skywatch_alert_webhook", webhookUrl);
    setSendingWebhook(true);
    setWebhookResult(null);

    try {
      const res = await axios.post("/api/notify/webhook", {
        webhookUrl,
        title: "SkyWatch Meteorological Alert (Test)",
        message: `Real-time weather monitoring test alert dispatched from dashboard for ${location?.name || "Active Station"}. Severe thresholds monitoring is online.`,
        severity: "warning",
        location: location?.name || "Active Station",
        metrics: {
          temp: 28,
          wind: 35,
          rain: 12,
        },
      });

      setWebhookResult({
        ok: true,
        message: res.data.message || "Webhook delivered successfully!",
      });
      loadRulesAndHistory();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error || err.message
        : "Failed to dispatch webhook.";
      setWebhookResult({ ok: false, message: msg });
    } finally {
      setSendingWebhook(false);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.name.trim()) return;
    try {
      const res = await axios.post("/api/alerts/rules", newRule);
      setCustomRules((prev) => [res.data.rule, ...prev]);
      setNewRule({
        name: "",
        metric: "temperature",
        operator: "gt",
        threshold: 35,
        severity: "warning",
      });
    } catch {
      alert("Failed to save custom rule.");
    }
  };

  const toggleRule = async (id: string, currentEnabled: boolean) => {
    try {
      await axios.patch("/api/alerts/rules", { id, enabled: !currentEnabled });
      setCustomRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, enabled: !currentEnabled } : r))
      );
    } catch {
      alert("Failed to update rule.");
    }
  };

  const deleteRule = async (id: string) => {
    try {
      await axios.delete(`/api/alerts/rules?id=${id}`);
      setCustomRules((prev) => prev.filter((r) => r.id !== id));
    } catch {
      alert("Failed to delete rule.");
    }
  };

  const triggerBackgroundScheduler = async () => {
    setEvaluatingCron(true);
    setSchedulerStatus(null);
    try {
      const res = await axios.post("/api/alerts/cron", {
        location: location ? { name: location.name, lat: location.lat, lon: location.lon } : undefined,
      });
      setSchedulerStatus(
        `Background evaluation complete. Evaluated ${res.data?.triggeredCount?.length ?? 0} triggered conditions.`
      );
      loadRulesAndHistory();
    } catch {
      setSchedulerStatus("Failed to run background scheduler.");
    } finally {
      setEvaluatingCron(false);
    }
  };

  const markAllHistoryRead = async () => {
    await axios.post("/api/alerts/history", { action: "read-all" });
    setAlertHistory((prev) => prev.map((a) => ({ ...a, read: true })));
  };

  const clearHistory = async () => {
    await axios.post("/api/alerts/history", { action: "clear" });
    setAlertHistory([]);
  };

  if (!location) {
    return (
      <div className="setup-message">
        Pick a city on the Dashboard page first to see alerts for it.
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="section-title" style={{ marginBottom: 4 }}>
            Weather Alerts &amp; Early Warning System
          </h1>
          <p className="section-sub" style={{ margin: 0 }}>
            Real-time threshold detection, Web Audio warning chimes, browser desktop notifications, and instant webhook dispatches (Discord, Slack, Custom).
          </p>
        </div>
        <button
          className="btn btn-accent"
          onClick={triggerBackgroundScheduler}
          disabled={evaluatingCron}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          {evaluatingCron ? "Evaluating Rules..." : "⚡ Run Rule Evaluator Now"}
        </button>
      </div>

      {activeBannerAlert && (
        <div
          style={{
            marginTop: 14,
            padding: "12px 18px",
            background: "rgba(220, 38, 38, 0.15)",
            border: "1px solid rgba(220, 38, 38, 0.5)",
            borderRadius: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 0 12px rgba(220, 38, 38, 0.2)",
          }}
        >
          <div style={{ fontWeight: 600, color: "#f87171", fontSize: "0.92rem" }}>
            {activeBannerAlert}
          </div>
          <button
            className="btn btn-outline"
            style={{ fontSize: "0.75rem", padding: "4px 10px" }}
            onClick={() => setActiveBannerAlert(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {schedulerStatus && (
        <div className="mt">
          <Badge kind="info">{schedulerStatus}</Badge>
        </div>
      )}

      {loading && <LoadingSpinner label="Evaluating local meteorological conditions..." />}
      {error && <div className="error-message">{error}</div>}

      {!loading && (
        <div className="grid grid-2 mt">
          {alerts.length === 0 ? (
            <Card>
              <Badge kind="success">Normal Conditions</Badge>
              <h3 style={{ margin: "10px 0 6px" }}>All Clear for {location.name}</h3>
              <p className="text-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                No severe storms, gale winds, or extreme heat detected at this time.
              </p>
            </Card>
          ) : (
            alerts.map((alert) => (
              <Card key={alert.id}>
                <div className="flex justify-between items-center">
                  <Badge kind={alert.severity === "warning" ? "danger" : "warning"}>
                    {alert.severity.toUpperCase()}
                  </Badge>
                  <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                    {location.name}
                  </span>
                </div>
                <h3 style={{ margin: "10px 0 6px" }}>{alert.title}</h3>
                <p style={{ margin: 0, fontSize: "0.85rem" }}>{alert.message}</p>
              </Card>
            ))
          )}
        </div>
      )}

      <div className="grid grid-2 mt">
        <Card title="🔊 Emergency Sound & Audio Chimes">
          <p className="text-muted" style={{ fontSize: "0.82rem", marginBottom: 14 }}>
            Synthesized via Web Audio API. Emits acoustic warning tones and danger sirens when severe weather is detected without needing external plugins.
          </p>

          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <label style={{ fontSize: "0.88rem", fontWeight: 600 }}>Enable Sound Alerts</label>
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => {
                setSoundEnabled(e.target.checked);
                localStorage.setItem("skywatch_alert_sound", String(e.target.checked));
              }}
              style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#3b82f6" }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <div className="flex justify-between items-center" style={{ fontSize: "0.82rem", marginBottom: 6 }}>
              <span className="text-muted">Chime Volume</span>
              <span style={{ fontWeight: 700 }}>{Math.round(soundVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={soundVolume}
              onChange={(e) => {
                const vol = Number(e.target.value);
                setSoundVolume(vol);
                localStorage.setItem("skywatch_alert_volume", String(vol));
              }}
              style={{ width: "100%", accentColor: "#3b82f6", cursor: "pointer" }}
            />
          </div>

          <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
            <button
              className="btn btn-outline"
              style={{ fontSize: "0.78rem", padding: "6px 12px" }}
              onClick={() => triggerTestAlert("danger")}
              title="Test danger siren"
            >
              🚨 Test Danger Siren
            </button>
            <button
              className="btn btn-outline"
              style={{ fontSize: "0.78rem", padding: "6px 12px" }}
              onClick={() => triggerTestAlert("warning")}
              title="Test warning chime"
            >
              ⚠️ Test Warning Chime
            </button>
            <button
              className="btn btn-outline"
              style={{ fontSize: "0.78rem", padding: "6px 12px" }}
              onClick={() => triggerTestAlert("info")}
              title="Test soft info ping"
            >
              🔔 Test Info Ping
            </button>
          </div>
        </Card>

        <Card title="🖥️ Desktop Push &amp; Live Watchdog">
          <p className="text-muted" style={{ fontSize: "0.82rem", marginBottom: 12 }}>
            Native Web Notifications API delivers real OS popups on macOS, Windows, Linux, and Android.
          </p>

          <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>Browser Permission</div>
              <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                Status: {pushPermission.toUpperCase()}
              </div>
            </div>
            {pushPermission === "granted" ? (
              <Badge kind="success">Active</Badge>
            ) : (
              <button
                className="btn"
                style={{ fontSize: "0.78rem", padding: "5px 12px" }}
                onClick={enablePush}
              >
                Enable Desktop Push
              </button>
            )}
          </div>

          <div
            style={{
              borderTop: "1px solid var(--card-border)",
              paddingTop: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                Live Weather Watchdog (Auto-Poll 30s)
              </div>
              <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                {lastWatchdogCheck ? `Last check: ${lastWatchdogCheck}` : "Continuous background monitor"}
              </div>
            </div>
            <button
              className={`tab ${watchdogActive ? "active" : ""}`}
              style={{ padding: "5px 14px", fontSize: "0.78rem", fontWeight: 700 }}
              onClick={() => setWatchdogActive((w) => !w)}
            >
              {watchdogActive ? "🟢 Watchdog Active" : "⚪ Watchdog Paused"}
            </button>
          </div>
        </Card>
      </div>

      <Card title="⚡ Real-Time Webhook Alert Dispatcher (Discord, Slack, Custom)" className="mt">
        <p className="text-muted" style={{ fontSize: "0.82rem", marginBottom: 14 }}>
          Send live alerts directly to your Discord channel, Slack workspace, Telegram bot, or custom API endpoint (Zapier, n8n, Webhook.site) via real server-side HTTP POST.
        </p>

        <div className="flex items-center gap-8" style={{ marginBottom: 12, flexWrap: "wrap" }}>
          <span className="text-muted" style={{ fontSize: "0.78rem" }}>Quick Preset:</span>
          <button
            className="btn btn-outline"
            style={{ fontSize: "0.74rem", padding: "3px 8px" }}
            onClick={() => setWebhookUrl("https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN")}
          >
            🎮 Discord Webhook
          </button>
          <button
            className="btn btn-outline"
            style={{ fontSize: "0.74rem", padding: "3px 8px" }}
            onClick={() => setWebhookUrl("https://hooks.slack.com/services/T00/B00/XXXX")}
          >
            💬 Slack Webhook
          </button>
          <button
            className="btn btn-outline"
            style={{ fontSize: "0.74rem", padding: "3px 8px" }}
            onClick={() => setWebhookUrl("https://webhook.site/YOUR-UUID-HERE")}
          >
            🌐 Webhook.site (Free Tester)
          </button>
        </div>

        <div className="field">
          <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>Target Webhook URL</label>
          <div className="flex gap-8">
            <input
              type="url"
              placeholder="https://discord.com/api/webhooks/... or https://hooks.slack.com/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-accent"
              style={{ whiteSpace: "nowrap" }}
              disabled={sendingWebhook || !webhookUrl.trim()}
              onClick={handleSaveAndTestWebhook}
            >
              {sendingWebhook ? "Dispatching..." : "🚀 Send Test Webhook Alert"}
            </button>
          </div>
        </div>

        {webhookResult && (
          <div style={{ marginTop: 10 }}>
            <Badge kind={webhookResult.ok ? "success" : "danger"}>
              {webhookResult.message}
            </Badge>
          </div>
        )}
      </Card>

      <div className="grid grid-2 mt">
        <Card title="Create Custom Alert Rule">
          <form onSubmit={handleCreateRule}>
            <div className="field">
              <label>Rule Name</label>
              <input
                type="text"
                placeholder="e.g. Extreme Heat Warning, High Wind Alert"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                required
              />
            </div>
            <div className="form-row">
              <div className="field">
                <label>Metric</label>
                <select
                  value={newRule.metric}
                  onChange={(e) =>
                    setNewRule({ ...newRule, metric: e.target.value as CustomRule["metric"] })
                  }
                >
                  <option value="temperature">Temperature (°C)</option>
                  <option value="windSpeed">Wind Speed (km/h)</option>
                  <option value="rainfall">Rainfall (mm)</option>
                  <option value="uvIndex">UV Index</option>
                  <option value="aqi">Air Quality Index (1-5)</option>
                </select>
              </div>
              <div className="field">
                <label>Condition</label>
                <select
                  value={newRule.operator}
                  onChange={(e) =>
                    setNewRule({ ...newRule, operator: e.target.value as CustomRule["operator"] })
                  }
                >
                  <option value="gt">Greater Than (&gt;)</option>
                  <option value="gte">Greater Than or Equal (&ge;)</option>
                  <option value="lt">Less Than (&lt;)</option>
                  <option value="lte">Less Than or Equal (&le;)</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Threshold Value</label>
                <input
                  type="number"
                  step="any"
                  value={newRule.threshold}
                  onChange={(e) => setNewRule({ ...newRule, threshold: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="field">
                <label>Severity</label>
                <select
                  value={newRule.severity}
                  onChange={(e) =>
                    setNewRule({ ...newRule, severity: e.target.value as CustomRule["severity"] })
                  }
                >
                  <option value="watch">Watch</option>
                  <option value="warning">Warning</option>
                  <option value="danger">Danger</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn mt">
              + Save Alert Rule
            </button>
          </form>
        </Card>

        <Card title={`Active Alert Rules (${customRules.length})`}>
          {customRules.length === 0 ? (
            <p className="text-muted">
              No custom rules created yet. Add a rule on the left to monitor specific weather conditions automatically.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {customRules.map((rule) => (
                <div
                  key={rule.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 12px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid var(--card-border)",
                    borderRadius: 8,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{rule.name}</div>
                    <div className="text-muted" style={{ fontSize: "0.78rem" }}>
                      Condition: {rule.metric} {rule.operator} {rule.threshold} · Severity: {rule.severity}
                    </div>
                  </div>
                  <div className="flex gap-8 items-center">
                    <button
                      className={`tab ${rule.enabled ? "active" : ""}`}
                      style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                      onClick={() => toggleRule(rule.id, rule.enabled)}
                    >
                      {rule.enabled ? "Active" : "Paused"}
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => deleteRule(rule.id)}
                      title="Delete rule"
                      style={{ color: "var(--danger)" }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Alert History &amp; Triggered Events" className="mt">
        <div className="flex justify-between items-center" style={{ marginBottom: 12 }}>
          <p className="text-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
            Audit log of all standard weather alerts, custom rule triggers, and webhook dispatches.
          </p>
          <div className="flex gap-8">
            <button
              className="btn btn-outline"
              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
              onClick={markAllHistoryRead}
            >
              Mark All Read
            </button>
            <button
              className="btn btn-outline"
              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
              onClick={clearHistory}
            >
              Clear Log
            </button>
          </div>
        </div>

        {alertHistory.length === 0 ? (
          <p className="text-muted" style={{ fontSize: "0.85rem" }}>
            No recorded alerts in history. Run the background scheduler or dispatch a test alert above.
          </p>
        ) : (
          <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {alertHistory.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: item.read ? "rgba(255,255,255,0.03)" : "rgba(37,99,235,0.08)",
                  border: "1px solid var(--card-border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div className="flex items-center gap-8">
                    <Badge
                      kind={
                        item.severity === "danger"
                          ? "danger"
                          : item.severity === "warning"
                          ? "warning"
                          : "info"
                      }
                    >
                      {item.severity.toUpperCase()}
                    </Badge>
                    <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{item.title}</span>
                    <span className="text-muted" style={{ fontSize: "0.78rem" }}>
                      ({item.location})
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.82rem" }}>{item.message}</p>
                </div>
                <span className="text-muted" style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                  {new Date(item.triggeredAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
