import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

// -----------------------------------------------------------------------------
// Climate Chess Infographic — Single CSV loader (mobile-friendly, tolerant yes)
// - Reads one CSV with columns:
//   Team, Piece, Order, Include, Score_Current, Score_Previous, Summary_Current, Links, Header_Flag
// - Header rows (Header_Flag=yes) render BIG titles with score + hover
// - Piece rows (Header_Flag=no, Include=yes) render in lists, sorted by Order
// - Snapshot title centered; Snapshot list split into two balanced columns
// - Mobile tweaks: responsive columns, 2-line piece names, tap-to-open hover
// -----------------------------------------------------------------------------

// --- Helpers for tolerant yes/no parsing -----------------------------------
const clean = (v) => String(v ?? "").trim();
const yesish = (v) => ["yes", "y", "true", "1"].includes(clean(v).toLowerCase());

// --- Responsive helpers ------------------------------------------------------
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)"); // ~Tailwind 'sm'
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return isMobile;
}

// --- Score helpers -----------------------------------------------------------
const SCORE_SYMBOL = {
  "plus-1": "➕",
  "plus-2": "➕➕",
  "plus-3": "➕➕➕",
  "minus-1": "➖",
  "minus-2": "➖➖",
  "minus-3": "➖➖➖",
  zero: "0",
};
const SCORE_VALUE = {
  "plus-3": 3,
  "plus-2": 2,
  "plus-1": 1,
  zero: 0,
  "minus-1": -1,
  "minus-2": -2,
  "minus-3": -3,
};

function ScoreBadge({ score, changed, delta, showScoreHighlights }) {
  const label = SCORE_SYMBOL[score] || "0";
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "";
  return (
    <span
      style={{
        marginLeft: "0.5rem",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        borderRadius: "9999px",
        padding: "0.125rem 0.5rem",
        fontSize: "0.875rem",
        fontWeight: 700,
        background: "#f1f5f9",
      }}
      title={delta > 0 ? "Score increased" : delta < 0 ? "Score decreased" : "Score unchanged"}
    >
      {label}
      {showScoreHighlights && (delta > 0 || delta < 0) && (
        <span style={{ color: "#b45309" }}>{arrow}</span>
      )}
    </span>
  );
}

function linkifyList(val) {
  if (!val) return [];
  const raw = Array.isArray(val) ? val : String(val).split(/[\s,]+/);
  return raw
    .map((s) => s.trim())
    .filter(Boolean)
    .map((u) => {
      try {
        const url = new URL(u);
        return { url: u, label: url.hostname.replace(/^www\./, "") };
      } catch {
        return { url: u, label: u };
      }
    });
}

function computeDelta(cur, prev) {
  const c = SCORE_VALUE[cur ?? "zero"] ?? 0;
  const p = SCORE_VALUE[prev ?? cur ?? "zero"] ?? 0;
  return c - p;
}

// --- CSV loader --------------------------------------------------------------
const CSV_PATHS = ["/climate_chess.csv", "/public/climate_chess.csv", "/data/climate_chess.csv"];

async function fetchCsv(url) {
  const res = await fetch(`${url}?ts=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (parsed.errors?.length) throw new Error(`Parse error`);
  return parsed.data || [];
}

// --- Data shaping ------------------------------------------------------------
const SECTIONS = ["Climate Snapshot", "Chessboard", "Team No-Urgency", "Team Urgency"];

function normalizeRow(r) {
  const Team = clean(r.Team);
  const Piece = clean(r.Piece);

  // Blank Include defaults to "yes". yes|y|true|1 -> yes
  const Include = yesish(r.Include || "yes") ? "yes" : "no";
  // yes|y|true|1 -> header row
  const Header_Flag = yesish(r.Header_Flag) ? "yes" : "no";

  const Score_Current = clean(r.Score_Current).toLowerCase() || "zero";
  const Score_Previous = clean(r.Score_Previous).toLowerCase();
  const Summary_Current = clean(r.Summary_Current);
  const Links = clean(r.Links);

  const o = parseInt(clean(r.Order), 10);
  const Order = Number.isFinite(o) ? o : 9999;

  // Drop junk/trailing rows (e.g., dropdown lists)
  if (!Team || !Piece) return null;

  return { Team, Piece, Include, Header_Flag, Score_Current, Score_Previous, Summary_Current, Links, Order };
}

function splitSnapshotTwoColumns(items) {
  // balance roughly by count
  const left = [];
  const right = [];
  let lc = 0;
  let rc = 0;
  items.forEach((it) => {
    if (lc <= rc) {
      left.push(it);
      lc++;
    } else {
      right.push(it);
      rc++;
    }
  });
  return { left, right };
}

// --- UI atoms ---------------------------------------------------------------
function HoverCard({ open, children }) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: "1rem",
        top: "100%",
        marginTop: "0.5rem",
        zIndex: 30,
        width: "min(40rem, 90vw)",
        background: "white",
        border: "1px solid #e2e8f0",
        borderRadius: "0.75rem",
        padding: "0.75rem",
        fontSize: "0.85rem",
        boxShadow: "0 10px 15px rgba(0,0,0,0.1)",
        maxHeight: "22rem",
        overflowY: "auto",
      }}
    >
      {children}
    </div>
  );
}

function TitleHeader({
  title,
  scoreCurrent,
  scorePrevious,
  summary,
  links,
  centered = false,
  showScoreHighlights,
}) {
  const [open, setOpen] = useState(false);
  const isTouch = typeof window !== "undefined" && "ontouchstart" in window;
  const delta = computeDelta(scoreCurrent, scorePrevious);
  const linkObjs = linkifyList(links);

  return (
    <div
      onMouseEnter={() => !isTouch && setOpen(true)}
      onMouseLeave={() => !isTouch && setOpen(false)}
      onClick={() => isTouch && setOpen((v) => !v)}
      style={{
        position: "relative",
        background: centered ? "transparent" : "#f8fafc",
        padding: centered ? 0 : "0.9rem 1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: centered ? "center" : "space-between",
          gap: "0.5rem",
        }}
      >
        <div
          style={{
            fontSize: centered ? "1.375rem" : "1.125rem",
            fontWeight: centered ? 900 : 800,
            letterSpacing: centered ? "0.015em" : "0.01em",
            color: "#0f172a",
          }}
        >
          {title}
        </div>
        <ScoreBadge
          score={scoreCurrent}
          changed={delta !== 0}
          delta={delta}
          showScoreHighlights={showScoreHighlights}
        />
      </div>

      <HoverCard open={open}>
        <div style={{ fontWeight: 700, color: "#334155", marginBottom: "0.25rem" }}>Context</div>
        <div style={{ whiteSpace: "pre-line", color: "#334155" }}>
          {summary || "No summary provided."}
        </div>
        {linkObjs.length > 0 && (
          <ul style={{ marginTop: "0.5rem", paddingLeft: "1rem" }}>
            {linkObjs.map((l, i) => (
              <li key={i} style={{ marginBottom: "0.25rem" }}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#334155", textDecoration: "underline" }}
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </HoverCard>
    </div>
  );
}

function HoverRow({ row, showScoreHighlights }) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const isTouch = typeof window !== "undefined" && "ontouchstart" in window;
  const links = linkifyList(row.Links);
  const delta = computeDelta(row.Score_Current, row.Score_Previous);

  return (
    <div
      style={{ position: "relative", display: "flex", alignItems: "center", padding: "0.75rem 1rem" }}
      onMouseEnter={() => !isTouch && setOpen(true)}
      onMouseLeave={() => !isTouch && setOpen(false)}
      onClick={() => isTouch && setOpen((v) => !v)}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          width: "100%",
        }}
      >
        <span
          title={row.Piece}
          style={{
            minWidth: 0,
            fontWeight: 600,
            color: "#1f2937",
            // mobile-friendly wrapping (2 lines on phones)
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            whiteSpace: isMobile ? "normal" : "nowrap",
            textOverflow: isMobile ? "clip" : "ellipsis",
            fontSize: isMobile ? "0.95rem" : "1rem",
            lineHeight: isMobile ? 1.25 : 1.2,
            paddingRight: "0.5rem",
          }}
        >
          {row.Piece}
        </span>
        <ScoreBadge
          score={row.Score_Current}
          changed={delta !== 0}
          delta={delta}
          showScoreHighlights={showScoreHighlights}
        />
      </div>

      <HoverCard open={open}>
        <div style={{ fontWeight: 600, color: "#334155", marginBottom: "0.25rem" }}>Context</div>
        <div style={{ whiteSpace: "pre-line", color: "#334155" }}>{row.Summary_Current}</div>
        {links.length > 0 && (
          <ul style={{ marginTop: "0.5rem", paddingLeft: "1rem" }}>
            {links.map((l, i) => (
              <li key={i} style={{ marginBottom: "0.25rem" }}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#334155", textDecoration: "underline" }}
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </HoverCard>
    </div>
  );
}

function Column({ titleMeta, items, showScoreHighlights }) {
  const hasHeader = !!titleMeta;
  return (
    <div
      style={{
        borderRadius: "1rem",
        background: "white",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        border: "1px solid #e2e8f0",
      }}
    >
      {hasHeader && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
          }}
        >
          <TitleHeader
            title={titleMeta.title}
            scoreCurrent={titleMeta.Score_Current}
            scorePrevious={titleMeta.Score_Previous}
            summary={titleMeta.Summary_Current}
            links={titleMeta.Links}
            showScoreHighlights={showScoreHighlights}
          />
        </div>
      )}
      <div>
        {items.map((row, i) => (
          <React.Fragment key={`${row.Team}-${row.Piece}-${i}`}>
            <HoverRow row={row} showScoreHighlights={showScoreHighlights} />
            {i < items.length - 1 && <div style={{ height: 1, background: "#f1f5f9" }} />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// --- Main -------------------------------------------------------------------
export default function Infographic() {
  const [rows, setRows] = useState(null); // all normalized rows
  const [source, setSource] = useState("(loading)");
  const [error, setError] = useState(null);
  const [showScoreHighlights, setShowScoreHighlights] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const isMobile = useIsMobile();

  useEffect(() => {
    (async () => {
      setError(null);
      try {
        // Allow injection for testing: window.__CLIMATE_CHESS_DATA_SINGLE (normalized)
        const injected =
          typeof window !== "undefined" && window.__CLIMATE_CHESS_DATA_SINGLE;
        if (injected && Array.isArray(injected)) {
          const norm = injected.map(normalizeRow).filter(Boolean);
          setRows(norm);
          setSource("window.__CLIMATE_CHESS_DATA_SINGLE");
          return;
        }
        // Load CSV from known paths
        let loaded = null,
          where = "";
        for (const p of CSV_PATHS) {
          try {
            loaded = await fetchCsv(p);
            where = p;
            break;
          } catch {}
        }
        if (!loaded) throw new Error("Could not load climate_chess.csv from known paths.");
        const norm = loaded.map(normalizeRow).filter(Boolean);
        setRows(norm);
        setSource(where);
      } catch (e) {
        setError(String(e?.message || e));
      }
    })();
  }, [reloadKey]);

  const grouped = useMemo(() => {
    if (!rows) return null;

    // Split header vs pieces; filter Include=yes for pieces
    const headerByTeam = {};
    SECTIONS.forEach((sec) => (headerByTeam[sec] = null));
    rows.forEach((r) => {
      if (
        r.Header_Flag === "yes" &&
        SECTIONS.includes(r.Team) &&
        r.Piece.toLowerCase() === r.Team.toLowerCase()
      ) {
        headerByTeam[r.Team] = { ...r, title: r.Team };
      }
    });

    const piecesByTeam = {};
    SECTIONS.forEach((sec) => (piecesByTeam[sec] = []));
    rows
      .filter(
        (r) => r.Header_Flag !== "yes" && r.Include === "yes" && SECTIONS.includes(r.Team)
      )
      .forEach((r) => {
        piecesByTeam[r.Team].push(r);
      });

    // Sort by Order ascending (ties by Piece)
    Object.keys(piecesByTeam).forEach((team) => {
      piecesByTeam[team].sort((a, b) => {
        const ao = a.Order ?? 9999;
        const bo = b.Order ?? 9999;
        if (ao !== bo) return ao - bo;
        return String(a.Piece || "").localeCompare(String(b.Piece || ""));
      });
    });

    return { headerByTeam, piecesByTeam };
  }, [rows]);

  const lastUpdated = useMemo(() => new Date(), [rows]);

  if (error) {
    return (
      <div style={{ padding: 16, color: "#b91c1c" }}>
        CSV load error: {error} &mdash; ensure <code>/public/climate_chess.csv</code> exists and uses the agreed columns.
      </div>
    );
  }
  if (!grouped) return <div style={{ padding: 16 }}>Loading…</div>;

  const snapshotItems = grouped.piecesByTeam["Climate Snapshot"] || [];
  const { left: snapshotLeft, right: snapshotRight } = splitSnapshotTwoColumns(snapshotItems);

  return (
    <div
      style={{
        margin: "0 auto",
        maxWidth: "72rem",
        padding: isMobile ? "0.75rem" : "1.5rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Header Bar */}
      <header style={{ display: "grid", gap: "0.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>
          Climate Chess – Interactive Infographic
        </h1>
        <div style={{ fontSize: "0.875rem", color: "#475569" }}>
          Data source: {source} · Last loaded:{" "}
          {new Intl.DateTimeFormat(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          }).format(lastUpdated)}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              padding: "0.4rem 0.7rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              background: showScoreHighlights ? "#059669" : "white",
              color: showScoreHighlights ? "white" : "#0f172a",
            }}
            title="Toggle highlights for score changes"
            onClick={() => setShowScoreHighlights((v) => !v)}
          >
            Score Changes: {showScoreHighlights ? "ON" : "OFF"}
          </button>
          <button
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              padding: "0.4rem 0.7rem",
              fontSize: "0.875rem",
              fontWeight: 600,
            }}
            onClick={() => setReloadKey((k) => k + 1)}
            title="Force re-read CSV"
          >
            Reload Data
          </button>
        </div>
      </header>

      {/* Centered Snapshot Title with score + hover */}
      <section style={{ marginTop: "1rem" }}>
        <TitleHeader
          title="Climate Snapshot"
          scoreCurrent={grouped.headerByTeam["Climate Snapshot"]?.Score_Current || "zero"}
          scorePrevious={grouped.headerByTeam["Climate Snapshot"]?.Score_Previous || ""}
          summary={grouped.headerByTeam["Climate Snapshot"]?.Summary_Current || ""}
          links={grouped.headerByTeam["Climate Snapshot"]?.Links || ""}
          centered
          showScoreHighlights={showScoreHighlights}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${isMobile ? 1 : 2}, minmax(0,1fr))`,
            gap: "1rem",
            marginTop: "0.5rem",
          }}
        >
          <Column
            titleMeta={null}
            items={snapshotLeft}
            showScoreHighlights={showScoreHighlights}
          />
          <Column
            titleMeta={null}
            items={snapshotRight}
            showScoreHighlights={showScoreHighlights}
          />
        </div>
      </section>

      {/* Three columns below */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${isMobile ? 1 : 3}, minmax(0,1fr))`,
          gap: "1rem",
          marginTop: "1rem",
        }}
      >
        <Column
          titleMeta={
            grouped.headerByTeam["Chessboard"] && {
              ...grouped.headerByTeam["Chessboard"],
              title: "Chessboard (Terrain)",
            }
          }
          items={grouped.piecesByTeam["Chessboard"]}
          showScoreHighlights={showScoreHighlights}
        />
        <Column
          titleMeta={
            grouped.headerByTeam["Team No-Urgency"] && {
              ...grouped.headerByTeam["Team No-Urgency"],
              title: "Team No-Urgency Pieces",
            }
          }
          items={grouped.piecesByTeam["Team No-Urgency"]}
          showScoreHighlights={showScoreHighlights}
        />
        <Column
          titleMeta={
            grouped.headerByTeam["Team Urgency"] && {
              ...grouped.headerByTeam["Team Urgency"],
              title: "Team Urgency Pieces",
            }
          }
          items={grouped.piecesByTeam["Team Urgency"]}
          showScoreHighlights={showScoreHighlights}
        />
      </section>
    </div>
  );
}
