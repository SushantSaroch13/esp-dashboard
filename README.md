# esp-dashboard

A Next.js frontend dashboard for visualising and managing sensor data stored on an ESP8266 device — deployed on Vercel, reading live data through the [esp-relay](https://github.com/SushantSaroch13/esp-relay) WebSocket tunnel.

---

## Why this exists

This dashboard is the frontend layer of the [ESP8266 Mini Database](https://github.com/SushantSaroch13/ESP8266-mini-database-HTTP-WS) project.

The ESP8266 stores sensor records (temperature, humidity, pressure) directly in its flash memory and exposes a REST API. Because the device sits behind a home ISP with CGNAT, it can't be reached directly from the internet. The [esp-relay](https://github.com/SushantSaroch13/esp-relay) server handles the tunnelling — this dashboard talks to the relay, which forwards requests to the ESP over a persistent WebSocket.

```
[esp-dashboard]  ──HTTPS──>  [esp-relay on Railway]  ──WebSocket──>  [ESP8266]
  Vercel                        Node.js relay                          LittleFS
```

---

## Tech stack

| Tool | Purpose |
|------|---------|
| [Next.js 15](https://nextjs.org) | React framework (App Router) |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| Vercel | Hosting & deployment |

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/SushantSaroch13/esp-dashboard
cd esp-dashboard
npm install
```

### 2. Configure environment

Create a `.env.local` file in the root:

```env
RELAY_URL=https://your-relay.up.railway.app
ESP_API_USER=admin
ESP_API_PASS=yourpassword
```

> These are kept server-side (Next.js API routes / server components) — never exposed to the browser.

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploy on Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → import this repo
3. Add environment variables (`ESP_API_URL`, `ESP_API_USER`, `ESP_API_PASS`) in the Vercel project settings
4. Deploy — Vercel auto-builds on every push to `main`

---

## Related repos

| Repo | Description |
|------|-------------|
| [ESP8266-mini-database-HTTP-WS](https://github.com/SushantSaroch13/ESP8266-mini-database-HTTP-WS) | ESP8266 firmware — stores sensor data, exposes REST API |
| [esp-relay](https://github.com/SushantSaroch13/esp-relay) | Node.js WebSocket relay — bridges the ESP to the public internet |

---

## Author

**Sushant Saroch**

---

## ⭐ If you like this project

Give it a ⭐ on GitHub!
