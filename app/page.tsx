"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  bulkAPI,
  deleteAPI,
  fetchDataAPI,
  insertAPI,
  updateAPI,
} from "@/lib/api";

type RecordItem = {
  id: number;
  device: string;
  temperature: number;
  humidity: number;
  pressure: number;
};

type QueryState = {
  start: string;
  end: string;
  cursor: string;
  limit: string;
  latestAnchor: string;
};

type FormState = {
  device: string;
  temperature: string;
  humidity: string;
  pressure: string;
};

const initialForm: FormState = {
  device: "",
  temperature: "",
  humidity: "",
  pressure: "",
};

const initialQuery: QueryState = {
  start: "",
  end: "",
  cursor: "",
  limit: "20",
  latestAnchor: "1000000",
};

const chartConfig = [
  {
    key: "temperature" as const,
    label: "Temperature",
    color: "#ff6b6b",
    suffix: "°C",
    gradientId: "tempGradient",
  },
  {
    key: "humidity" as const,
    label: "Humidity",
    color: "#5da9ff",
    suffix: "%",
    gradientId: "humidityGradient",
  },
  {
    key: "pressure" as const,
    label: "Pressure",
    color: "#58d68d",
    suffix: "hPa",
    gradientId: "pressureGradient",
  },
];

export default function Home() {
  const [data, setData] = useState<RecordItem[]>([]);
  const [cursor, setCursor] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [query, setQuery] = useState<QueryState>(initialQuery);
  const [bulk, setBulk] = useState("");
  const [deviceFilter, setDeviceFilter] = useState("");
  const [selectedDevice, setSelectedDevice] = useState("All devices");
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState("");

  const normalizeRecords = (incoming: RecordItem[]) => {
    return incoming
      .map((item) => ({
        ...item,
        temperature: Number(item.temperature),
        humidity: Number(item.humidity),
        pressure: Number(item.pressure),
      }))
      .sort((a, b) => b.id - a.id);
  };

  const setCursorFromRecords = (records: RecordItem[]) => {
    if (records.length > 0) {
      setCursor(records[records.length - 1].id);
    }
  };

  const fetchLatestWindow = async (limit: number) => {
    const json = await fetchDataAPI({ desc: "1", limit: String(limit) });
    const normalized = normalizeRecords(json ?? []);

    if (normalized.length === 0) {
      throw new Error("ESP device is offline or no data is available.");
    }

    setData(normalized);
    setCursorFromRecords(normalized);
    setLastUpdated(new Date().toLocaleString());
  };

  const fetchData = async (nextQuery: QueryState = query) => {
    try {
      setIsLoading(true);
      setErrorMessage("");
      const limit = Number(nextQuery.limit) || 20;

      if (!nextQuery.start && !nextQuery.end && !nextQuery.cursor) {
        await fetchLatestWindow(limit);
        return;
      }

      const json = await fetchDataAPI(nextQuery);
      const normalized = normalizeRecords(json ?? []);
      const visibleWindow = normalized.slice(0, limit);

      setData(visibleWindow);
      setCursorFromRecords(visibleWindow);
      setLastUpdated(new Date().toLocaleString());
    } catch {
      setData([]);
      setCursor(0);
      setErrorMessage("ESP device is offline or unreachable. Reconnect it and refresh the dashboard.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");
      const limit = Number(query.limit) || 20;
      const rangeEnd = Math.max(cursor - 1, 0);
      const rangeStart = Math.max(rangeEnd - limit + 1, 0);

      const json = await fetchDataAPI({
        start: String(rangeStart),
        end: String(rangeEnd),
        limit: String(limit),
      });
      const normalized = normalizeRecords(json ?? []);

      setData((prev) => {
        const merged = [...prev, ...normalized];
        const unique = Array.from(
          new Map(merged.map((item) => [item.id, item])).values(),
        );
        return unique.sort((a, b) => b.id - a.id);
      });

      setCursorFromRecords(normalized);
      setLastUpdated(new Date().toLocaleString());
    } catch {
      setErrorMessage("Could not load more records because the ESP device is offline or unreachable.");
    } finally {
      setIsLoading(false);
    }
  };

  const insertData = async () => {
    if (!form.device || !form.temperature || !form.humidity || !form.pressure) {
      return;
    }

    await insertAPI({
      device: form.device,
      temperature: Number(form.temperature),
      humidity: Number(form.humidity),
      pressure: Number(form.pressure),
    });

    setForm(initialForm);
    fetchData();
  };

  const deleteData = async (id: number) => {
    await deleteAPI(id);
    fetchData();
  };

  const updateField = async (
    id: number,
    field: "temperature" | "humidity" | "pressure",
    value: string,
  ) => {
    if (value === "") return;
    await updateAPI(id, { [field]: Number(value) });
    setData((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: Number(value) } : item,
      ),
    );
  };

  const normalizeBulkPayload = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";

    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      const objectMatches = trimmed.match(/\{[\s\S]*?\}/g);

      if (!objectMatches || objectMatches.length === 0) {
        throw new Error("Bulk payload must contain valid JSON objects.");
      }

      const normalized = `[${objectMatches.join(",")}]`;
      JSON.parse(normalized);
      return normalized;
    }
  };

  const bulkInsert = async () => {
    if (!bulk.trim()) return;

    try {
      setErrorMessage("");
      const normalizedBulk = normalizeBulkPayload(bulk);
      await bulkAPI(normalizedBulk);
      setBulk("");
      fetchData();
    } catch {
      setErrorMessage(
        "Bulk insert payload is invalid. Use a valid JSON array or newline-separated JSON objects.",
      );
    }
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(filteredData, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "esp-dashboard-data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    const resetQuery = { ...initialQuery };
    setQuery(resetQuery);
    setDeviceFilter("");
    setSelectedDevice("All devices");
    fetchData(resetQuery);
  };

  useEffect(() => {
    fetchData(initialQuery);
  }, []);

  const devices = useMemo(() => {
    return ["All devices", ...Array.from(new Set(data.map((item) => item.device)))];
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchesSearch = item.device
        .toLowerCase()
        .includes(deviceFilter.toLowerCase());

      const matchesDevice =
        selectedDevice === "All devices" || item.device === selectedDevice;

      return matchesSearch && matchesDevice;
    });
  }, [data, deviceFilter, selectedDevice]);

  const chartData = useMemo(() => [...filteredData].reverse(), [filteredData]);

  const metrics = useMemo(() => {
    const total = filteredData.length;

    const average = (key: keyof Pick<RecordItem, "temperature" | "humidity" | "pressure">) =>
      total
        ? (
            filteredData.reduce((sum, item) => sum + Number(item[key] || 0), 0) / total
          ).toFixed(key === "pressure" ? 1 : 1)
        : "0.0";

    const latest = filteredData[0];

    return {
      total,
      averageTemperature: average("temperature"),
      averageHumidity: average("humidity"),
      latestPressure: latest ? latest.pressure.toFixed(1) : "0.0",
      latestDevice: latest?.device ?? "N/A",
    };
  }, [filteredData]);

  const latestEntries = filteredData.slice(0, 5);

  return (
    <main className="dashboard-shell">
      <section className="dashboard-hero">
        <div>
          <div className="badge">ESP8266 • Mini Database</div>
          <h1>Modern telemetry dashboard for your sensor network</h1>
          <p>
            Monitor device activity, query records, update values inline, and
            compare temperature, humidity, and pressure trends in one responsive view.
          </p>
        </div>

        <div className="hero-side">
          <div className="hero-status-card">
            <span className="field-label">Status</span>
            <strong>{isLoading ? "Syncing data..." : "System online"}</strong>
            <span className="muted-text">
              {lastUpdated ? `Last updated: ${lastUpdated}` : "Waiting for first sync"}
            </span>
          </div>

          <div className="action-row">
            <button onClick={() => fetchData()} className="btn-primary" disabled={isLoading}>
              Refresh Data
            </button>
            <button onClick={resetFilters} className="btn-ghost">
              Reset Filters
            </button>
            <button onClick={exportJSON} className="btn-secondary">
              Export JSON
            </button>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Connection Status</h2>
              <p>{errorMessage}</p>
            </div>
            <span className="pill">Offline</span>
          </div>
          <div className="action-row">
            <button onClick={() => fetchData()} className="btn-primary" disabled={isLoading}>
              Retry Connection
            </button>
          </div>
        </section>
      ) : null}

      <section className="dashboard-grid">
        <article className="stat-card">
          <span className="field-label">Total Records</span>
          <strong>{metrics.total}</strong>
          <span className="pill">Visible dataset</span>
        </article>

        <article className="stat-card">
          <span className="field-label">Average Temperature</span>
          <strong>{metrics.averageTemperature}°C</strong>
          <span className="pill">Across filtered records</span>
        </article>

        <article className="stat-card">
          <span className="field-label">Average Humidity</span>
          <strong>{metrics.averageHumidity}%</strong>
          <span className="pill">Humidity health check</span>
        </article>

        <article className="stat-card">
          <span className="field-label">Latest Pressure</span>
          <strong>{metrics.latestPressure} hPa</strong>
          <span className="pill">{metrics.latestDevice}</span>
        </article>
      </section>

      <section className="section-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Query Controls</h2>
              <p>Filter the dataset by ID range and pagination.</p>
            </div>
            <span className="pill">Live controls</span>
          </div>

          <div className="form-grid">
            <label className="field">
              <span className="field-label">Start ID</span>
              <input
                placeholder="e.g. 1"
                className="input"
                value={query.start}
                onChange={(e) => setQuery({ ...query, start: e.target.value })}
              />
            </label>

            <label className="field">
              <span className="field-label">End ID</span>
              <input
                placeholder="e.g. 80"
                className="input"
                value={query.end}
                onChange={(e) => setQuery({ ...query, end: e.target.value })}
              />
            </label>

            <label className="field">
              <span className="field-label">Cursor</span>
              <input
                placeholder="0"
                className="input"
                value={query.cursor}
                onChange={(e) => setQuery({ ...query, cursor: e.target.value })}
              />
            </label>

            <label className="field">
              <span className="field-label">Limit</span>
              <input
                placeholder="20"
                className="input"
                value={query.limit}
                onChange={(e) => setQuery({ ...query, limit: e.target.value })}
              />
            </label>
          </div>

          <div className="action-row">
            <button onClick={() => fetchData()} className="btn-primary" disabled={isLoading}>
              Run Query
            </button>
            <button onClick={loadMore} className="btn-secondary" disabled={isLoading}>
              Load More
            </button>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Insert New Reading</h2>
              <p>Add a fresh sensor entry to the ESP database.</p>
            </div>
            <span className="pill">Manual entry</span>
          </div>

          <div className="form-grid">
            <label className="field">
              <span className="field-label">Device Name</span>
              <input
                placeholder="NodeMCU-Lab"
                className="input"
                value={form.device}
                onChange={(e) => setForm({ ...form, device: e.target.value })}
              />
            </label>

            <label className="field">
              <span className="field-label">Temperature</span>
              <input
                placeholder="28.4"
                className="input"
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: e.target.value })}
              />
            </label>

            <label className="field">
              <span className="field-label">Humidity</span>
              <input
                placeholder="52"
                className="input"
                value={form.humidity}
                onChange={(e) => setForm({ ...form, humidity: e.target.value })}
              />
            </label>

            <label className="field">
              <span className="field-label">Pressure</span>
              <input
                placeholder="1008.6"
                className="input"
                value={form.pressure}
                onChange={(e) => setForm({ ...form, pressure: e.target.value })}
              />
            </label>
          </div>

          <div className="action-row">
            <button onClick={insertData} className="btn-primary">
              Insert Record
            </button>
            <button onClick={() => setForm(initialForm)} className="btn-ghost">
              Clear Form
            </button>
          </div>
        </article>
      </section>

      <section className="section-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Bulk Upload</h2>
              <p>Paste raw JSON payloads for faster data ingestion.</p>
            </div>
            <span className="pill">Batch mode</span>
          </div>

          <label className="field">
            <span className="field-label">Bulk JSON Payload</span>
            <textarea
              className="input bulk-textarea"
              placeholder={`[{"device":"esp-1","temperature":28,"humidity":55,"pressure":1007},{"device":"esp-2","temperature":29,"humidity":58,"pressure":1009}]`}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
            />
          </label>

          <div className="action-row">
            <button onClick={bulkInsert} className="btn-primary">
              Run Bulk Insert
            </button>
            <button onClick={() => setBulk("")} className="btn-ghost">
              Clear Payload
            </button>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Device Filters</h2>
              <p>Quickly inspect one node or search by device name.</p>
            </div>
            <span className="pill">Client-side filter</span>
          </div>

          <div className="form-grid">
            <label className="field">
              <span className="field-label">Search device</span>
              <input
                className="input"
                placeholder="Type a device name"
                value={deviceFilter}
                onChange={(e) => setDeviceFilter(e.target.value)}
              />
            </label>

            <label className="field">
              <span className="field-label">Select device</span>
              <select
                className="input"
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
              >
                {devices.map((device) => (
                  <option key={device} value={device}>
                    {device}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mini-list">
            {latestEntries.map((item) => (
              <div key={item.id} className="mini-list-item">
                <div>
                  <strong>{item.device}</strong>
                  <span className="muted-text">Record #{item.id}</span>
                </div>
                <span className="pill">
                  {item.temperature}°C / {item.humidity}%
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Sensor Charts</h2>
            <p>Three focused charts aligned horizontally on larger screens.</p>
          </div>
          <span className="pill">Responsive analytics</span>
        </div>

        <div className="chart-grid">
          {chartConfig.map((chart) => (
            <article key={chart.key} className="chart-card">
              <div className="panel-header compact">
                <div>
                  <h3>{chart.label}</h3>
                  <p>{filteredData.length} points</p>
                </div>
                <span className="badge">{chart.suffix}</span>
              </div>

              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id={chart.gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chart.color} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={chart.color} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148, 163, 184, 0.16)" vertical={false} />
                  <XAxis dataKey="id" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#081120",
                      border: "1px solid rgba(148, 163, 184, 0.2)",
                      borderRadius: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey={chart.key}
                    stroke={chart.color}
                    fill={`url(#${chart.gradientId})`}
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Combined Trend Overview</h2>
            <p>Compare all readings together for anomaly detection.</p>
          </div>
          <span className="pill">Multi-metric line chart</span>
        </div>

        <div className="chart-card chart-card-wide">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.16)" vertical={false} />
              <XAxis dataKey="id" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  background: "#081120",
                  border: "1px solid rgba(148, 163, 184, 0.2)",
                  borderRadius: 12,
                }}
              />
              <Line type="monotone" dataKey="temperature" stroke="#ff6b6b" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="humidity" stroke="#5da9ff" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="pressure" stroke="#58d68d" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Records Table</h2>
            <p>Inline edit values, remove rows, and inspect all filtered results.</p>
          </div>
          <span className="pill">{filteredData.length} visible</span>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Device</th>
                <th>Temperature</th>
                <th>Humidity</th>
                <th>Pressure</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredData.map((item) => (
                <tr key={item.id}>
                  <td data-label="ID">#{item.id}</td>
                  <td data-label="Device">
                    <div className="table-device">
                      <strong>{item.device}</strong>
                      <span className="muted-text">ESP Node</span>
                    </div>
                  </td>
                  <td data-label="Temperature">
                    <input
                      defaultValue={item.temperature}
                      className="table-inline-input"
                      onBlur={(e) => updateField(item.id, "temperature", e.target.value)}
                    />
                  </td>
                  <td data-label="Humidity">
                    <input
                      defaultValue={item.humidity}
                      className="table-inline-input"
                      onBlur={(e) => updateField(item.id, "humidity", e.target.value)}
                    />
                  </td>
                  <td data-label="Pressure">
                    <input
                      defaultValue={item.pressure}
                      className="table-inline-input"
                      onBlur={(e) => updateField(item.id, "pressure", e.target.value)}
                    />
                  </td>
                  <td data-label="Actions">
                    <button onClick={() => deleteData(item.id)} className="btn-danger">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
