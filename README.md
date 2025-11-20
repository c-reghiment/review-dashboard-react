# Review Analysis Dashboard

Insights pipeline and dashboard for https://selftalk.space/journeys. The project covers the full workflow required in the task brief:

- **Data collection**: scrape or manually capture reviews per journey/session.
- **Organization**: standardize fields (session, rating, text, date, reviewer, source URL).
- **AI analysis**: enrich every review with sentiment, themes, pain points, and feature requests, then classify each session as successful/mixed/problematic.
- **Visualization**: a React + Vite dashboard surfaces KPIs, per‑session drilldowns, trends, and prioritized insights so the team can act quickly.

---

## Highlights

- **Purpose-built pipeline** for the SelfTalk journeys site with scripts for scraping, aggregating, and analyzing reviews.
- **Heuristic + NLP stack** (Playwright, VADER sentiment, Natural, Stopword) to label sentiment, themes (content/presenter/utility/technical), pain points, and feature requests.
- **Attention scoring** that combines negative share, sentiment, and technical complaints to spotlight problematic sessions.
- **Modern dashboard** (React 19, Recharts, date-fns, Tailwind-esque styles) with Overview, Per Session, Trends, and Insights tabs.

---

## Dashboard visualization (UI requirements)

The React dashboard turns `sessions_analysis.json` into an actionable control center.

### Overview — general metrics

- KPI strip summarises **average rating** and **total reviews**, complete with month-over-month deltas.
- Sentiment distribution card (on the Reviews tab) shows the **share of positive/neutral/negative** reviews using stacked bars so you can eyeball balance at a glance.
- Filters in the top bar allow narrowing data by sentiment label before any chart/table is rendered; exports and sharing respect the current filters.

### Per session — rating, sentiment, themes

- “Sessions needing attention” is a sortable table (searchable via title or slug) highlighting **problematic** and **mixed** sessions.
- Each row lists review count, average rating, average sentiment, percentage of negative feedback, latest review date, attention score, and the top three derived themes via chips.
- Status pills (problematic, mixed) plus an attention-score progress bar call out which journeys require follow up.

### Trends — evolution over time

- Review Trend chart visualizes the chronological timeline (latest 30 points) with **review volume** and **average rating** lines on dual axes.
- The Performance Overview bar chart stacks monthly sentiment totals, highlighting how emotions shift across the year.
- All charts respond to the sentiment filter so stakeholders can inspect only positive, neutral, or negative trajectories.

### Actionable insights — sessions needing attention

- Attention scoring (computed in the analysis step) powers the table ordering, surfacing the highest-risk sessions first.
- Status filtering (via the filter popover) lets operators focus on only problematic journeys when triaging.
- Export button generates a CSV of the currently filtered reviews (review id, session id, date, rating, sentiment, text preview) for offline analysis, and the Share button copies the link.

---

## Repository tour

| Path | Description |
| --- | --- |
| `scripts/scrape-selftalk.mjs` | Playwright scraper for `/journey/*` pages. Pulls JSON-LD, DOM reviews, screenshots/debug artifacts. |
| `scripts/aggregate-reviews.mjs` | Groups `reviews_clean.json` into per-session aggregates and exports CSV/JSON. |
| `scripts/analyze-reviews.mjs` | NLP enrichment + scoring + ranking (writes `sessions_analysis.json`). |
| `data/` | Working directory for raw and processed datasets. Safe place to QA outputs before publishing. |
| `public/data/` | Files served to the dashboard. Copy the latest `sessions_analysis.json` here so the UI can fetch it. |
| `src/` | Front-end (React) implementation of the dashboard (`src/App.jsx`). |
| `debug/` | Optional screenshots/HTML dumps generated when the scraper runs with debug flags. |

---

## Prerequisites

- Node.js 18+ (native fetch + ES modules).
- npm 9+.
- Playwright browsers (`npx playwright install` once after `npm install`).
- Access to the SelfTalk website or exported reviews (CSV/JSON).

---

## Quick start

```bash
npm install
npx playwright install  # once, for the headless browser
cp data/sessions_analysis.json public/data/sessions_analysis.json  # seed demo data
npm run dev
```

Visit `http://localhost:5173` to explore the dashboard. Replace the copied dataset with fresh outputs after you run the pipeline below.


### 1. Collecting reviews


```bash
BASE=https://selftalk.space node scripts/scrape-selftalk.mjs \
  --headful \         # optional: watch the browser
  --debug \           # optional: dump candidate elements
  --screenshot        # optional: store PNGs under debug/
```

- The scraper discovers `/journey/*` URLs via `sitemap.xml`. If discovery fails, list fallbacks in `data/seeds.txt` (one URL or path per line).
- CLI flags: `--concurrency=6`, `--min-delay=60`, `--max-delay=120`, `--save-html`, `--screenshot`, `--headful`.
- Outputs: `data/reviews_clean.json` (primary) and `data/reviews_clean.csv`.

### 2. Aggregate per session

```bash
node scripts/aggregate-reviews.mjs
```

This step:

- Sorts each session’s reviews by date.
- Calculates counts, rating buckets, first/last review date.
- Writes
  - `data/sessions_aggregated.json` (per-session metrics + embedded reviews),
  - `data/sessions_aggregated.csv` (flat metrics), and
  - `data/reviews_by_session.csv` (all reviews sorted by session/date).


### 3. AI analysis & scoring

```bash
node scripts/analyze-reviews.mjs
```

What happens in this phase:

- **Sentiment**: VADER (English) + heuristics for Romanian negatives → `sentiment` (−1…1) and `sentiment_label`.
- **Theme detection**: tokenizes & stems text, matches against `THEME_LEX` dictionaries for `content`, `presenter`, `utility`, `technical`.
- **Pain points**: extracts negative sentences or ones with clue words.
- **Feature requests**: captures up to two sentences that hit `FEATURE_TRIGGERS`.
- **Session scoring**: averages sentiment, computes `% negative`, weights technical complaints, and derives an `attention_score` (0–100) + `status` (`problematic`, `mixed`, `successful`).

Outputs:

- `data/reviews_enriched.json` – each review with AI annotations.
- `data/sessions_analysis.json` – ranked sessions consumed by the dashboard.
- `data/sessions_ranked.csv` – same as above in CSV form for stakeholders.

### 4. Publish to the dashboard

```bash
cp data/sessions_analysis.json public/data/sessions_analysis.json
npm run dev   # or npm run build && npm run preview
```

- The React app fetches `public/data/sessions_analysis.json` on load (no need to rebuild unless UI code changes).
- Tabs:
  - **Overview** – global KPIs, sentiment buckets, rating distribution.
  - **Per Session** – sortable table with reviews, attention score, themes, and status chips.
  - **Trends** – weekly sentiment + review volume time series (requires dated reviews).
  - **Insights** – top attention sessions with pain points and feature requests summarized.

Deploy by running `npm run build` and serving the `dist/` folder on any static host (Vercel, Netlify, Cloudflare Pages, etc.).

---

## Data contracts

**Review record (`reviews_clean.json` / `reviews_enriched.json`):**

```json
{
  "session_id": "journey-ritual",
  "session_title": "Morning Ritual for Calm",
  "rating": 5,
  "review_text": "Loved the pacing and exercises.",
  "review_date": "2024-01-12",
  "reviewer": "Maria",
  "source_url": "https://selftalk.space/journey/ritual",
  "sentiment": 0.74,
  "sentiment_label": "positive",
  "themes": ["content", "utility"],
  "pain_points": [],
  "feature_requests": []
}
```

**Session record (`sessions_analysis.json`):**

```json
{
  "session_id": "journey-ritual",
  "session_title": "Morning Ritual for Calm",
  "n_reviews": 18,
  "avg_rating": 4.6,
  "avg_sentiment": 0.58,
  "pct_negative": 0.06,
  "themes": { "content": 11, "presenter": 4, "utility": 12, "technical": 1 },
  "top_pain_points": [{ "text": "audio volume is low", "count": 2 }],
  "top_feature_requests": [{ "text": "add downloadable summary", "count": 3 }],
  "attention_score": 24,
  "status": "successful",
  "reviews": [ /* latest first */ ]
}
```


## Tips & troubleshooting

- **Scraper throttling**: adjust `--concurrency`, `--min-delay`, and `--max-delay` if the site rate limits you.
- **Cookie walls/modals**: the script tries to auto-dismiss; if it fails, use `--headful` and handle it manually.
- **Missing dates**: the DOM extractor attempts to convert “2 weeks ago” style strings. For accuracy, prefer explicit timestamps.
- **Language coverage**: theme dictionaries include common English/Romanian variants. Extend `THEME_LEX`, `FEATURE_TRIGGERS`, and `NEG_CLUES` for new languages before re-running analysis.

## Additional notes
- The scraper took the longest, especially debugging. A challenge was setting everything up with matching versions that would work together. Codex in VS Code works really well and helped a lot.
