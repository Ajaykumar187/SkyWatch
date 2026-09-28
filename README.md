# SkyWatch

A weather monitoring dashboard built with Next.js and TypeScript. It shows live conditions, hourly and 7-day forecasts, air quality, historical trends, and a weather map, and it also lets you save cities, compare them side by side, set alert rules, and export reports.

I built this to get hands-on with the Next.js App Router, working with more than one weather API, and building a small full-stack app (auth, server routes, file-based persistence) without reaching for a database on day one.

## What it does

- **Dashboard**: current temperature, humidity, wind, pressure, visibility, dew point, UV index, sunrise/sunset, moon phase, and air quality (AQI, PM2.5, PM10, CO, NO₂, SO₂, O₃).
- **Forecast**: hourly and 7-day views.
- **Analytics**: charts for temperature, rainfall, wind, humidity and AQI, plus 30-day history and a monthly summary.
- **AI insights**: rain probability, heatwave, flood risk and storm detection with a confidence score. These are rule-based, not ML (see [Limitations](#limitations-and-design-decisions)).
- **Map**: Leaflet map with precipitation, cloud, wind, temperature and pressure layers, and a satellite basemap.
- **Alerts**: heavy rain, thunderstorm, heatwave and flood alerts, deliverable by browser notification, email (Nodemailer) or SMS (Twilio).
- **Compare**: put multiple cities next to each other.
- **Accounts**: register/login, favorite cities, search history, and alert preferences.
- **Reports**: export weather statistics as PDF or CSV.
- **UX**: dark/light theme, responsive layout, voice search (Chrome/Edge), and "use my current location".

## Tech stack

| Area | Tools |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Charts and maps | Recharts, Leaflet |
| Reports | jsPDF |
| Notifications | Nodemailer, Twilio (via REST), Web Notification API |
| Data sources | OpenWeatherMap, Open-Meteo |
| Tooling | ESLint, npm |

## Getting started

**Prerequisites:** Node.js 18+ and a free [OpenWeatherMap API key](https://openweathermap.org/api).

```bash
git clone <your-repo-url>
cd SkyWatch
npm install
```

Create a `.env.local` file in the project root:

```
OPENWEATHER_API_KEY=your_key_here
```

Then start the dev server:

```bash
npm run dev
```

Open http://localhost:3000. Note that new OpenWeatherMap keys can take a few minutes to activate after signup, so if you see "invalid key" errors right away, wait a bit and retry.

Other scripts:

```bash
npm run build    # production build
npm start        # run the production build
npm run lint     # ESLint
```

## How it works

The app uses two weather providers, each for what it does best:

- **OpenWeatherMap** handles current weather, air quality (plus history) and map tiles. These calls go through my own API routes (`/api/weather`, `/api/air-quality`, `/api/map-tiles/...`) so the API key stays on the server and never reaches the browser.
- **Open-Meteo** needs no key and supports CORS, so the browser calls it directly for forecasts, UV index, historical data and city geocoding (`src/lib/openMeteo.ts`).
- **Moon phase** is calculated locally in `src/lib/moonPhase.ts`, so it needs no API at all.

User data (accounts, favorites, search history, preferences) is stored in JSON files under `data/`. Passwords are salted and hashed with `scrypt`, and sessions use a cookie token.

## Project structure

```
src/
  app/
    page.tsx          Dashboard
    forecast/         Hourly and 7-day forecast
    analytics/        Trend charts and history
    ai/               Rule-based predictions
    map/              Interactive map
    alerts/           Alert rules and notifications
    compare/          Multi-city comparison
    account/          Login, signup, profile, saved data
    reports/          PDF / CSV export
    api/              Server routes (weather, air quality, auth, favorites,
                      search history, preferences, notify, map tiles)
  components/         Navbar, SearchBar, MapView, Card, Badge, ...
  context/            Theme and current-location state
  lib/                API clients, prediction and alert logic, auth, storage, types
data/                 JSON storage for the user module (created at runtime)
```

## Limitations and design decisions

I'd rather be upfront about what this project is and isn't:

- **Storage is file-based.** It's fine for local use and for a normal always-on Node server, but it won't persist on serverless hosts with read-only or ephemeral filesystems (like a default Vercel deploy). For production I'd move `src/lib/storage.ts` to Postgres or SQLite behind the same interface.
- **Auth is basic.** Hashed passwords and cookie sessions are enough for a demo, but there's no password reset, rate limiting or email verification yet.
- **Predictions are rule-based.** The "AI" features in `src/lib/aiEngine.ts` apply clear thresholds to forecast data (for example, a heatwave needs consecutive days at or above 38°C). Every score comes with its reasons, so results are easy to trace. It is not a trained model and shouldn't replace official warnings.
- **Alerts run on page load.** There's no background scheduler. Email and SMS work, but you enter your own SMTP/Twilio credentials in the form; nothing is stored server-side. A proper version would use a cron job and a push service.
- **Browser notifications only fire while the tab is open.** True background push needs a service worker and a push server.
- **No real radar.** The map's precipitation layer is OpenWeatherMap's forecast tiles, not radar reflectivity, and the satellite view is Esri's imagery basemap rather than a live weather satellite feed. Radar, cyclone tracking and lightning detection would need paid data providers.
- **Voice search** relies on the Web Speech API, which is available in Chrome and Edge only.

## Roadmap

- Replace JSON storage with a real database
- Password reset and rate limiting
- Scheduled alerts with a background job
- Automated tests for the prediction and alert logic
- Deploy a live demo

## License

Released under the [MIT License](LICENSE).

## Author

**Ajay Kumar**