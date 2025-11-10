import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { parseISO, format } from "date-fns";

const navSections = [
  {
    heading: "Review",
    items: [
      { label: "Dashboard", view: "dashboard" },
      { label: "Reviews", view: "reviews" },
    ],
  },
  {
    heading: "Others",
    items: [
      { label: "Settings" },
    ],
  },
];

const sentimentColors = {
  positive: "text-emerald-600 bg-emerald-50",
  neutral: "text-slate-600 bg-slate-100",
  negative: "text-rose-600 bg-rose-50",
};

const attentionStatuses = new Set(["problematic", "mixed"]);

const prettyPercent = (value) => `${value.toFixed(1)}%`;

const chip = (label) => (
  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-xs font-medium text-slate-700 mr-1">
    {label}
  </span>
);

function useSessions() {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/data/sessions_analysis.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (alive) setSessions(json);
      } catch (e) {
        setError(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { sessions, error, loading };
}

function getAllReviews(sessions) {
  return sessions?.flatMap((s) => s.reviews.map((r) => ({ ...r, __session: s }))) ?? [];
}

function getDateRangeLabel(reviews) {
  const dates = reviews
    .map((r) => {
      if (!r.review_date) return null;
      const parsed = parseISO(r.review_date);
      return Number.isNaN(+parsed) ? null : parsed;
    })
    .filter(Boolean)
    .sort((a, b) => a - b);
  if (!dates.length) return "No dated reviews";
  return `${format(dates[0], "dd MMM yyyy")} - ${format(dates[dates.length - 1], "dd MMM yyyy")}`;
}

function buildMonthlyTrend(reviews) {
  const buckets = new Map();
  for (const review of reviews) {
    if (!review.review_date) continue;
    const parsed = parseISO(review.review_date);
    if (Number.isNaN(+parsed)) continue;
    const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = format(parsed, "MMM");
    const bucket =
      buckets.get(key) || {
        monthKey: key,
        month: monthLabel,
        positive: 0,
        neutral: 0,
        negative: 0,
        total: 0,
        ratingSum: 0,
        ratingCount: 0,
      };
    bucket.total += 1;
    if (review.sentiment_label === "positive") bucket.positive += 1;
    else if (review.sentiment_label === "negative") bucket.negative += 1;
    else bucket.neutral += 1;

    if (Number.isFinite(review.rating)) {
      bucket.ratingSum += review.rating;
      bucket.ratingCount += 1;
    }
    buckets.set(key, bucket);
  }
  return [...buckets.values()]
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map((bucket) => ({
      month: bucket.month,
      positive: bucket.positive,
      neutral: bucket.neutral,
      negative: bucket.negative,
      total: bucket.total,
      avgRating: bucket.ratingCount ? bucket.ratingSum / bucket.ratingCount : null,
    }));
}


function formatFriendlyDate(value, fallback = "—") {
  if (!value) return fallback;
  const dateObj = value instanceof Date ? value : parseISO(value);
  if (!(dateObj instanceof Date) || Number.isNaN(+dateObj)) return fallback;
  return format(dateObj, "dd MMM yyyy");
}

function formatSessionTitle({ session_title, session_id }) {
  const base = session_title?.trim();
  if (base) return base;
  if (!session_id) return "Untitled session";
  return session_id
    .split(/[-_]/g)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function escapeCsvValue(value) {
  if (value == null) return "";
  const safe = String(value).replace(/"/g, '""');
  return `"${safe}"`;
}

function getLatestReviewDate(reviews = []) {
  let latest = null;
  for (const review of reviews) {
    if (!review.review_date) continue;
    const parsed = parseISO(review.review_date);
    if (Number.isNaN(+parsed)) continue;
    if (!latest || parsed > latest) latest = parsed;
  }
  return latest;
}

function buildChronologicalTrend(reviews) {
  const buckets = new Map();
  for (const review of reviews) {
    if (!review.review_date) continue;
    const parsed = parseISO(review.review_date);
    if (Number.isNaN(+parsed)) continue;
    const key = parsed.toISOString().slice(0, 10);
    const bucket =
      buckets.get(key) || {
        date: parsed,
        count: 0,
        ratingSum: 0,
        ratingCount: 0,
      };
    bucket.count += 1;
    if (Number.isFinite(review.rating)) {
      bucket.ratingSum += review.rating;
      bucket.ratingCount += 1;
    }
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .sort((a, b) => a.date - b.date)
    .map((bucket) => ({
      date: bucket.date,
      label: format(bucket.date, "dd MMM"),
      count: bucket.count,
      avgRating: bucket.ratingCount ? bucket.ratingSum / bucket.ratingCount : null,
    }));
}

function Sidebar({ activeView, onSelectView }) {
  return (
    <aside className="hidden lg:flex lg:w-64 xl:w-72 flex-col border-r bg-white/95 backdrop-blur-sm">
      <div className="px-6 py-5 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-indigo-600 text-white font-semibold flex items-center justify-center">
          M
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Selftalk</p>
          <p className="text-xs text-slate-500">Customer insights</p>
        </div>
      </div>
      <nav className="flex-1 px-4 space-y-8">
        {navSections.map((section) => (
          <div key={section.heading}>
            <p className="text-xs uppercase tracking-wide text-slate-400 px-3 mb-3">{section.heading}</p>
            <div className="space-y-1.5">
              {section.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.view ? () => onSelectView(item.view) : undefined}
                  className={`w-full text-left rounded-xl px-3 py-2 text-sm font-medium ${
                    item.view && item.view === activeView
                      ? "bg-indigo-600 text-white shadow"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="px-6 py-5 border-t">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600">
            CR
          </div>
          <div>
            <p className="text-sm font-semibold">Cristian Reghiment</p>
            <p className="text-xs text-slate-500">AI engineer</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.location.href = "mailto:creghiment@gmail.com";
            }
          }}
          className="mt-4 w-full rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-600"
        >
          Contact
        </button>
      </div>
    </aside>
  );
}

function TopBar({
  dateRange,
  activeView,
  filters,
  onFilterChange,
  filtersOpen,
  onToggleFilters,
  onExport,
  onShare,
}) {
  const sentimentOptions = [
    { label: "All", value: "all" },
    { label: "Positive", value: "positive" },
    { label: "Neutral", value: "neutral" },
    { label: "Negative", value: "negative" },
  ];
  const statusOptions = [
    { label: "All statuses", value: "all" },
    { label: "Problematic", value: "problematic" },
    { label: "Mixed", value: "mixed" },
  ];

  return (
    <header className="bg-white border-b">
      <div className="px-4 sm:px-6 lg:px-10 py-4 space-y-4 lg:space-y-0 lg:flex lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Review</p>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">
              {activeView === "reviews" ? "Reviews" : "Dashboard"}
            </h1>
            <div className="hidden md:flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-slate-500">
              <span>12 Aug 2023</span>
              <span>→</span>
              <span>12 Aug 2024</span>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-1">{dateRange}</p>
        </div>
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleFilters}
            className={`rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium ${
              filtersOpen ? "bg-indigo-600 text-white" : "text-slate-600"
            }`}
          >
            Filter
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
            onClick={onExport}
          >
            Export
          </button>
          <button
            type="button"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow"
            onClick={onShare}
          >
            Share
          </button>
          {filtersOpen && (
            <div className="absolute right-0 top-full mt-3 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl z-20">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Sentiment</p>
              <div className="flex flex-wrap gap-2">
                {sentimentOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onFilterChange("sentiment", option.value)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      filters.sentiment === option.value ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-xs uppercase tracking-wide text-slate-400 mt-4 mb-2">Session status</p>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onFilterChange("status", option.value)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      filters.status === option.value ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-[11px] text-slate-400">Filters apply to the Reviews view.</p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function KPICards({ cards }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">{card.label}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{card.value}</p>
          {card.delta != null && card.deltaLabel ? (
            <p className={`mt-2 text-xs font-medium ${card.delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {card.deltaLabel}
            </p>
          ) : (
            card.support && <p className="mt-2 text-xs text-slate-500">{card.support}</p>
          )}
        </div>
      ))}
    </section>
  );
}

function PerformanceCard({ data }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Performance overview</p>
          <p className="text-xs text-slate-500">Monthly sentiment mix</p>
        </div>
        <button className="text-xs text-slate-500 rounded-full border px-3 py-1">This year</button>
      </div>
      <div className="h-72 mt-4">
        {data.length ? (
          <ResponsiveContainer>
            <BarChart data={data} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend formatter={(value) => <span className="text-xs text-slate-500">{value}</span>} />
              <Bar dataKey="positive" stackId="sentiment" name="Positive" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="neutral" stackId="sentiment" name="Neutral" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="negative" stackId="sentiment" name="Negative" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-slate-500">No dated reviews yet.</div>
        )}
      </div>
    </div>
  );
}

function ReviewTrendChart({ data }) {
  const limited = data.slice(-30);
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Review trends</p>
          <p className="text-xs text-slate-500">Chronological review volume & rating</p>
        </div>
        <span className="text-xs text-slate-500">{limited.length} data points</span>
      </div>
      <div className="h-72 mt-4">
        {limited.length ? (
          <ResponsiveContainer>
            <LineChart data={limited}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis
                yAxisId="count"
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                yAxisId="rating"
                orientation="right"
                domain={[0, 5]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
              />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="count"
                type="monotone"
                dataKey="count"
                name="Reviews"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="rating"
                type="monotone"
                dataKey="avgRating"
                name="Avg rating"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-slate-500">
            No dated reviews yet.
          </div>
        )}
      </div>
    </div>
  );
}

function SentimentSummary({ sentimentCounts, totalReviews }) {
  const rows = [
    { label: "Positive", value: sentimentCounts.positive, color: "bg-emerald-500" },
    { label: "Neutral", value: sentimentCounts.neutral, color: "bg-slate-400" },
    { label: "Negative", value: sentimentCounts.negative, color: "bg-rose-500" },
  ];
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">Distribution</p>
        <p className="text-xs text-slate-500">Breakdown of sentiment labels this period</p>
      </div>
      <div className="space-y-3">
        {rows.map((row) => {
          const percent = totalReviews ? (row.value / totalReviews) * 100 : 0;
          return (
            <div key={row.label}>
              <div className="flex items-center justify-between text-sm">
                <p>{row.label}</p>
                <p className="text-slate-500">
                  {row.value} • {prettyPercent(percent)}
                </p>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full ${row.color}`} style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecentReviewsCard({ reviews }) {
  const getInitials = (name) => {
    if (!name) return "??";
    return name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const sentimentBadge = (label) => {
    const base = sentimentColors[label] || sentimentColors.neutral;
    return (
      <span className={`px-2 py-[2px] rounded-full text-xs font-medium ${base}`}>
        {label ?? "neutral"}
      </span>
    );
  };

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      <div className="p-5 border-b">
        <p className="text-sm font-semibold text-slate-900">Recent reviews</p>
        <p className="text-xs text-slate-500">Latest mentions across all sources</p>
      </div>
      <ul className="divide-y">
        {reviews.map((review) => (
          <li key={review.review_id} className="p-5 flex gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600">
              {getInitials(review.reviewer)}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-sm text-slate-900">{review.reviewer || "Anonymous"}</p>
                <span className="text-xs text-slate-400">• {formatFriendlyDate(review.review_date, "Unknown date")}</span>
                {review.sentiment_label && sentimentBadge(review.sentiment_label)}
              </div>
              <p className="text-xs text-amber-500">
                {"★".repeat(Math.round(review.rating || 0)).padEnd(5, "☆")}
              </p>
              <p className="text-sm text-slate-600 line-clamp-3">{review.review_text}</p>
            </div>
          </li>
        ))}
        {!reviews.length && (
          <li className="p-5 text-sm text-slate-500">No reviews captured yet.</li>
        )}
      </ul>
    </div>
  );
}

function SessionsTable({ sessions, statusFilter }) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState({ key: "attention_score", dir: "desc" });

  const rows = useMemo(() => {
    return sessions
      .filter((session) => attentionStatuses.has(session.status))
      .filter((session) => (statusFilter === "all" ? true : session.status === statusFilter))
      .map((session) => {
        const lastReviewDate = getLatestReviewDate(session.reviews || []);
        return {
          ...session,
          lastReviewDate,
          displayTitle: formatSessionTitle(session),
        };
      });
  }, [sessions, statusFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = [...rows];
    if (q) {
      arr = arr.filter((s) => {
        const title = s.displayTitle?.toLowerCase() ?? "";
        const id = s.session_id?.toLowerCase() ?? "";
        return title.includes(q) || id.includes(q);
      });
    }

    const dir = sortBy.dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const getValue = (item) => {
        if (sortBy.key === "last_review_date") {
          return item.lastReviewDate ? item.lastReviewDate.getTime() : 0;
        }
        return item[sortBy.key] ?? 0;
      };
      const va = getValue(a);
      const vb = getValue(b);
      if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb) * dir;
      return (va - vb) * dir;
    });
    return arr;
  }, [rows, query, sortBy]);

  const setSort = (key) => setSortBy((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));

  return (
    <div className="rounded-2xl border bg-white shadow-sm p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">Sessions needing attention</p>
          <p className="text-xs text-slate-500">Sort by sentiment, rating, or attention score</p>
        </div>
        <input
          className="w-full md:w-64 rounded-xl border px-3 py-2 text-sm"
          placeholder="Search sessions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3 text-left">Session</th>
              <th className="p-3 text-left cursor-pointer" onClick={() => setSort("n_reviews")}>
                # Reviews
              </th>
              <th className="p-3 text-left cursor-pointer" onClick={() => setSort("avg_rating")}>
                Avg Rating
              </th>
              <th className="p-3 text-left cursor-pointer" onClick={() => setSort("avg_sentiment")}>
                Avg Sentiment
              </th>
              <th className="p-3 text-left cursor-pointer" onClick={() => setSort("pct_negative")}>
                % Negative
              </th>
              <th className="p-3 text-left cursor-pointer" onClick={() => setSort("last_review_date")}>
                Last Review
              </th>
              <th className="p-3 text-left cursor-pointer" onClick={() => setSort("attention_score")}>
                Attention
              </th>
              <th className="p-3 text-left">Main themes</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.session_id} className="border-t">
                <td className="p-3 max-w-[260px]">
                  <div className="font-medium line-clamp-2 text-slate-900">{s.displayTitle}</div>
                  <div className="text-xs text-slate-500">{s.session_id}</div>
                </td>
                <td className="p-3">{s.n_reviews}</td>
                <td className="p-3">{s.avg_rating ?? "—"}</td>
                <td className="p-3">{s.avg_sentiment.toFixed(2)}</td>
                <td className="p-3">{prettyPercent(s.pct_negative * 100)}</td>
                <td className="p-3">{formatFriendlyDate(s.lastReviewDate)}</td>
                <td className="p-3">
                  <div className="inline-flex items-center gap-2">
                    <span className="text-sm font-semibold">{s.attention_score}</span>
                    <div className="h-2 w-24 rounded bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full ${
                          s.attention_score >= 70
                            ? "bg-rose-500"
                            : s.attention_score >= 40
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${s.attention_score}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  {Object.entries(s.themes || {})
                    .filter(([, v]) => v > 0)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([k]) => chip(k))}
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-[2px] rounded-full text-xs font-medium ${
                      s.status === "problematic"
                        ? "bg-rose-100 text-rose-700"
                        : s.status === "successful"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function App() {
  const { sessions, error, loading } = useSessions();
  const [activeView, setActiveView] = useState("dashboard");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ sentiment: "all", status: "all" });
  const [toast, setToast] = useState(null);

  const allReviews = useMemo(() => getAllReviews(sessions), [sessions]);
  const filteredReviews = useMemo(() => {
    if (filters.sentiment === "all") return allReviews;
    return allReviews.filter((review) => (review.sentiment_label || "neutral") === filters.sentiment);
  }, [allReviews, filters.sentiment]);
  const dateRangeLabel = useMemo(() => getDateRangeLabel(allReviews), [allReviews]);
  const sentimentCounts = useMemo(() => {
    return filteredReviews.reduce(
      (acc, review) => {
        acc[review.sentiment_label || "neutral"] += 1;
        return acc;
      },
      { positive: 0, neutral: 0, negative: 0 }
    );
  }, [filteredReviews]);
  const totalReviews = allReviews.length;
  const filteredTotalReviews = filteredReviews.length;
  const avgRating = useMemo(() => {
    const values = allReviews
      .map((r) => (Number.isFinite(r.rating) ? Number(r.rating) : null))
      .filter((v) => v != null);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }, [allReviews]);
  const monthlyTrend = useMemo(() => buildMonthlyTrend(allReviews), [allReviews]);
  const chronologicalTrend = useMemo(() => buildChronologicalTrend(filteredReviews), [filteredReviews]);
  const recentReviews = useMemo(() => {
    return [...filteredReviews]
      .filter((r) => r.review_text)
      .sort((a, b) => {
        const da = a.review_date ? Date.parse(a.review_date) : 0;
        const db = b.review_date ? Date.parse(b.review_date) : 0;
        return db - da;
      })
      .slice(0, 4);
  }, [filteredReviews]);

  useEffect(() => {
    setFiltersOpen(false);
  }, [activeView]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => {
      if (prev[key] === value) return prev;
      return { ...prev, [key]: value };
    });
  };

  const handleExport = () => {
    setFiltersOpen(false);
    if (!filteredReviews.length) {
      setToast("No reviews to export");
      return;
    }
    const header = "review_id,session_id,review_date,rating,sentiment_label,preview";
    const rows = filteredReviews.map((review) => {
      const values = [
        review.review_id ?? "",
        review.session_id ?? "",
        review.review_date ?? "",
        review.rating ?? "",
        review.sentiment_label ?? "",
        (review.review_text || "").replace(/\s+/g, " ").trim().slice(0, 160),
      ];
      return values.map(escapeCsvValue).join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reviews-export-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setToast(`Exported ${filteredReviews.length} reviews`);
  };

  const handleShare = async () => {
    setFiltersOpen(false);
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    const hasNavigator = typeof navigator !== "undefined";
    try {
      if (hasNavigator && navigator.share) {
        await navigator.share({ title: "Review Dashboard", url: shareUrl });
        setToast("Share sheet opened");
      } else if (hasNavigator && navigator.clipboard && shareUrl) {
        await navigator.clipboard.writeText(shareUrl);
        setToast("Link copied to clipboard");
      } else {
        setToast("Copy this link: " + shareUrl);
      }
    } catch (error) {
      setToast("Share canceled");
    }
  };

  const lastMonth = monthlyTrend[monthlyTrend.length - 1];
  const prevMonth = monthlyTrend[monthlyTrend.length - 2];

  const ratingDelta =
    lastMonth && prevMonth && Number.isFinite(lastMonth.avgRating) && Number.isFinite(prevMonth.avgRating)
      ? lastMonth.avgRating - prevMonth.avgRating
      : null;
  const reviewsDelta =
    lastMonth && prevMonth && prevMonth.total
      ? ((lastMonth.total - prevMonth.total) / prevMonth.total) * 100
      : null;
  const cards = [
    {
      label: "Average rating",
      value: avgRating ? `${avgRating.toFixed(2)}` : "—",
      delta: ratingDelta,
      deltaLabel: ratingDelta != null ? `${ratingDelta >= 0 ? "+" : ""}${ratingDelta.toFixed(2)} vs prev month` : null,
    },
    {
      label: "Total reviews",
      value: totalReviews,
      delta: reviewsDelta,
      deltaLabel: reviewsDelta != null ? `${reviewsDelta >= 0 ? "+" : ""}${reviewsDelta.toFixed(1)}% vs prev month` : null,
    },
  ];

  if (loading) return <div className="p-6">Loading…</div>;
  if (error) return <div className="p-6 text-rose-600">Failed to load sessions_analysis.json — {String(error)}</div>;
  if (!sessions?.length) return <div className="p-6">No data.</div>;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar
          activeView={activeView}
          onSelectView={(view) => {
            setActiveView(view);
            setFiltersOpen(false);
          }}
        />
        <div className="flex-1 flex flex-col">
          <TopBar
            dateRange={dateRangeLabel}
            activeView={activeView}
            filters={filters}
            onFilterChange={handleFilterChange}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen((prev) => !prev)}
            onExport={handleExport}
            onShare={handleShare}
          />
          <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 space-y-8">
            {activeView === "dashboard" && (
              <>
                <KPICards cards={cards} />
                <PerformanceCard data={monthlyTrend} />
              </>
            )}
            {activeView === "reviews" && (
              <>
                <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
                  <ReviewTrendChart data={chronologicalTrend} />
                  <SentimentSummary sentimentCounts={sentimentCounts} totalReviews={filteredTotalReviews} />
                </div>
                <RecentReviewsCard reviews={recentReviews} />
                <SessionsTable sessions={sessions} statusFilter={filters.status} />
              </>
            )}
          </main>
        </div>
      </div>
      {toast && (
        <div className="fixed bottom-4 right-4 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
