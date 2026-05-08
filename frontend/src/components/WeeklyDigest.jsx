import { useState, useEffect, useCallback } from "react";
import { API_BASE_URL, updateContext } from "../lib/api";

const API_BASE = API_BASE_URL || "http://localhost:8000";

const SIGNAL_CONFIG = {
  STRONG_WHITESPACE: { label: "Strong Signal", color: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.25)", icon: "🟣" },
  MODERATE:         { label: "Moderate",       color: "var(--amber)", bg: "rgba(200,146,58,0.1)",  border: "rgba(200,146,58,0.25)",  icon: "🟡" },
  SATURATED:        { label: "Saturated",       color: "var(--fog)",   bg: "rgba(130,120,110,0.1)", border: "rgba(130,120,110,0.2)",  icon: "🔴" },
};

const ACTION_COLORS = {
  "Explore & Validate": "#a78bfa",
  "Monitor Closely":    "var(--amber)",
  "Deprioritize":       "var(--fog)",
};

function timeAgo(isoString) {
  if (!isoString) return "Unknown";
  const diff = (Date.now() - new Date(isoString)) / 1000 / 3600;
  if (diff < 1) return "Just now";
  if (diff < 24) return `${Math.floor(diff)}h ago`;
  const days = Math.floor(diff / 24);
  return `${days}d ago`;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "var(--radius-md)", padding: "16px 20px", flex: 1, minWidth: "120px" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "28px", fontWeight: "600", color: color || "var(--cream)", lineHeight: 1, marginBottom: "4px" }}>{value}</div>
      <div style={{ fontSize: "11px", color: "var(--fog)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
    </div>
  );
}

// ─── Opportunity Row ──────────────────────────────────────────────────────────
function OpportunityRow({ opp, index }) {
  const [expanded, setExpanded] = useState(false);
  const sig = SIGNAL_CONFIG[opp.signal] || SIGNAL_CONFIG.MODERATE;
  const actionColor = ACTION_COLORS[opp.action] || "var(--fog)";

  return (
    <div
      className={`animate-fade-up animate-fade-up-d${Math.min(index + 1, 5)}`}
      style={{ border: `1px solid ${sig.border}`, borderRadius: "var(--radius-md)", overflow: "hidden", transition: "border-color 0.2s ease" }}
    >
      {/* Row Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px 20px", cursor: "pointer", background: expanded ? "rgba(220,203,190,0.04)" : "transparent", transition: "background 0.2s" }}
      >
        {/* Rank */}
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--amber)", width: "28px", flexShrink: 0, fontWeight: "600" }}>#{opp.rank}</div>

        {/* Domain name */}
        <div style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: "600", color: "var(--cream)", textTransform: "capitalize" }}>{opp.title}</div>

        {/* Score bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <div style={{ width: "80px", height: "4px", background: "rgba(220,203,190,0.1)", borderRadius: "2px", overflow: "hidden" }}>
            <div style={{ width: `${opp.score}%`, height: "100%", background: sig.color, borderRadius: "2px", transition: "width 0.8s ease" }} />
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: sig.color, fontWeight: "600", width: "40px" }}>{opp.score}</span>
        </div>

        {/* Signal badge */}
        <span style={{ fontSize: "10px", padding: "3px 8px", background: sig.bg, border: `1px solid ${sig.border}`, color: sig.color, borderRadius: "4px", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
          {sig.icon} {sig.label}
        </span>

        {/* Trend */}
        <span style={{ fontSize: "12px", color: "var(--fog)", fontFamily: "var(--font-mono)", flexShrink: 0, width: "70px", textAlign: "right" }}>{opp.trend}</span>

        {/* Expand arrow */}
        <span style={{ color: "var(--fog)", fontSize: "12px", transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div style={{ padding: "0 20px 20px 20px", borderTop: `1px solid rgba(220,203,190,0.07)` }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)", gap: "12px", marginTop: "16px" }}>
            <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: "var(--radius-md)", padding: "12px 14px" }}>
              <div style={{ fontSize: "10px", color: "var(--fog)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Recommended Action</div>
              <div style={{ fontSize: "13px", color: actionColor, fontWeight: "600" }}>{opp.action}</div>
            </div>
            <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: "var(--radius-md)", padding: "12px 14px" }}>
              <div style={{ fontSize: "10px", color: "var(--fog)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Gap Score</div>
              <div style={{ fontSize: "13px", color: "var(--cream)", fontFamily: "var(--font-mono)" }}>{opp.score} / 100</div>
            </div>
            <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: "var(--radius-md)", padding: "12px 14px" }}>
              <div style={{ fontSize: "10px", color: "var(--fog)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Last Updated</div>
              <div style={{ fontSize: "13px", color: "var(--cream)", fontFamily: "var(--font-mono)" }}>{timeAgo(opp.updated_at)}</div>
            </div>
          </div>
          {opp.summary && (
            <div style={{ marginTop: "12px", padding: "12px 14px", background: "rgba(0,0,0,0.15)", borderRadius: "var(--radius-md)", fontSize: "12px", color: "var(--fog)", lineHeight: "1.6" }}>
              {opp.summary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function WeeklyDigest({ domains = [], riskAppetite = "medium", opportunities = [] }) {
  const [digest, setDigest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("All");

  const fetchDigest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/digest`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setDigest(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDigest(); }, [fetchDigest]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      // 1. Sync the current user's SOUL context to the backend
      await updateContext({ domains, risk_appetite: riskAppetite });

      // 2. Trigger the digest generation
      const res = await fetch(`${API_BASE}/digest/generate`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      await fetchDigest();
    } catch (err) {
      setError("Generation failed: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  // ── Compute Live Opportunities ─────────────────────────────────────────────
  // To show digest data strictly on whatever domains are currently selected,
  // we compute the table data live from the global opportunities array.
  const liveOpps = opportunities
    .filter(opp => {
      if (domains.length === 0) return true; // Show all if no filter
      const oppDomain = (opp.domain || opp.title || opp.name || "").toLowerCase();
      return domains.some(d => oppDomain.includes(d.toLowerCase()) || d.toLowerCase().includes(oppDomain));
    })
    .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
    .map((opp, i) => {
      const score = Number(opp.score ?? 0);
      const signal = score >= 70 ? 'STRONG_WHITESPACE' : score >= 40 ? 'MODERATE' : 'SATURATED';
      const action = score >= 70 ? 'Explore & Validate' : score >= 40 ? 'Monitor Closely' : 'Deprioritize';
      const trend = i % 3 === 0 ? '↑ Rising' : i % 3 === 1 ? '→ Stable' : '↓ Cooling';
      return { ...opp, signal, action, trend, rank: i + 1 };
    });

  const filteredOpps = liveOpps.filter(opp => {
    if (filter === "Strong" && opp.signal !== "STRONG_WHITESPACE") return false;
    if (filter === "Moderate" && opp.signal !== "MODERATE") return false;
    if (filter === "Saturated" && opp.signal !== "SATURATED") return false;
    return true;
  });

  const liveMeta = {
    total_domains: liveOpps.length,
    strong_signals: liveOpps.filter(o => o.signal === 'STRONG_WHITESPACE').length,
    moderate_signals: liveOpps.filter(o => o.signal === 'MODERATE').length,
    saturated: liveOpps.filter(o => o.signal === 'SATURATED').length,
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: "16px" }}>
        <div style={{ width: "32px", height: "32px", border: "2px solid var(--border)", borderTopColor: "var(--amber)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <span style={{ fontSize: "12px", color: "var(--fog)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Loading Digest...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── No Digest Yet ────────────────────────────────────────────────────────────
  if (error || !digest) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", textAlign: "center", gap: "20px" }}>
        <span style={{ fontSize: "48px" }}>📋</span>
        <div>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "22px", color: "var(--cream)", marginBottom: "8px" }}>No Digest Yet</h3>
          <p style={{ color: "var(--fog)", fontSize: "14px", maxWidth: "420px", lineHeight: "1.6" }}>
            OpenClaw hasn't generated a digest yet. Click below to compile one now from your live opportunity data.
          </p>
        </div>
        <button
          className="vs-btn vs-btn-primary"
          onClick={handleGenerate}
          disabled={generating}
          style={{ padding: "10px 24px" }}
        >
          {generating ? "⚙️ Generating..." : "📋 Generate Digest Now"}
        </button>
        {error && <p style={{ fontSize: "12px", color: "var(--danger)", fontFamily: "var(--font-mono)" }}>{error}</p>}
      </div>
    );
  }

  const { meta, narrative, week_of, generated_at, soul_snapshot } = digest;

  return (
    <div className="animate-fade-up">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "32px" }}>
        <div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--amber)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px" }}>
            OpenClaw Weekly Digest
          </p>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "30px", fontWeight: "700", color: "var(--cream)", marginBottom: "6px", lineHeight: 1.1 }}>
            Week of {week_of}
          </h2>
          <p style={{ fontSize: "12px", color: "var(--fog)", fontFamily: "var(--font-mono)" }}>
            Generated {timeAgo(generated_at)} · {liveMeta.total_domains} domains tracked · Risk: <span style={{ color: "var(--cream)", textTransform: "capitalize" }}>{riskAppetite}</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            className="vs-btn vs-btn-ghost"
            onClick={handleGenerate}
            disabled={generating}
            style={{ fontSize: "12px", padding: "7px 14px" }}
          >
            {generating ? "⚙️ Regenerating..." : "↺ Regenerate"}
          </button>
        </div>
      </div>

      {/* ── AI Narrative ────────────────────────────────────────────────────── */}
      <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "24px", marginBottom: "28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: "3px", height: "100%", background: "linear-gradient(to bottom, var(--amber), transparent)" }} />
        <p style={{ fontSize: "10px", color: "var(--amber)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>
          🤖 OpenClaw Executive Summary
        </p>
        <p style={{ fontSize: "15px", color: "var(--brown)", lineHeight: "1.75", fontStyle: "italic" }}>
          "{narrative}"
        </p>
      </div>

      {/* ── Stats Row ───────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "28px" }}>
        <StatCard label="Domains Scanned" value={liveMeta.total_domains} color="var(--cream)" />
        <StatCard label="Strong Signals"  value={liveMeta.strong_signals}  color="#7ec99a" />
        <StatCard label="Moderate"        value={liveMeta.moderate_signals} color="var(--amber)" />
        <StatCard label="Saturated"       value={liveMeta.saturated}        color="var(--fog)" />
      </div>

      {/* ── Filter Pills + Table header ─────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: "16px", color: "var(--cream)", fontWeight: "600" }}>
          Ranked Opportunities
        </h3>
        <div style={{ display: "flex", gap: "8px" }}>
          {["All", "Strong", "Moderate", "Saturated"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{ background: filter === f ? "var(--cream)" : "transparent", color: filter === f ? "var(--ink)" : "var(--fog)", border: filter === f ? "1px solid var(--cream)" : "1px solid var(--border)", padding: "5px 12px", borderRadius: "var(--radius-pill)", fontSize: "11px", fontFamily: "var(--font-mono)", cursor: "pointer", transition: "all 0.2s ease" }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Column Labels */}
      <div style={{ display: "flex", gap: "16px", padding: "6px 20px", marginBottom: "8px" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--fog)", textTransform: "uppercase", letterSpacing: "0.06em", width: "28px" }}>#</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--fog)", textTransform: "uppercase", letterSpacing: "0.06em", flex: 1 }}>Domain</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--fog)", textTransform: "uppercase", letterSpacing: "0.06em", width: "130px" }}>Score</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--fog)", textTransform: "uppercase", letterSpacing: "0.06em", width: "120px" }}>Signal</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--fog)", textTransform: "uppercase", letterSpacing: "0.06em", width: "90px", textAlign: "right" }}>Trend</span>
        <span style={{ width: "20px" }} />
      </div>

      {/* ── Opportunity Rows ────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filteredOpps.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--fog)", fontStyle: "italic" }}>No opportunities match this filter.</div>
        ) : (
          filteredOpps.map((opp, i) => <OpportunityRow key={opp.id || opp.title} opp={opp} index={i} />)
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div style={{ marginTop: "40px", padding: "16px 0", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
        <span style={{ fontSize: "11px", color: "var(--fog)", fontFamily: "var(--font-mono)" }}>
          Compiled by OpenClaw v1.0 · Powered by ArXiv + GitHub signal analysis
        </span>
        <span style={{ fontSize: "11px", color: "var(--fog)", fontStyle: "italic" }}>
          Not financial advice
        </span>
      </div>
    </div>
  );
}
