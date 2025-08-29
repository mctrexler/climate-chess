import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

// --- Score helpers -----------------------------------------------------------
const SCORE_SYMBOL = {
  "plus-1":"➕","plus-2":"➕➕","plus-3":"➕➕➕",
  "minus-1":"➖","minus-2":"➖➖","minus-3":"➖➖➖",
  zero:"0"
};
const SCORE_VALUE = {"plus-3":3,"plus-2":2,"plus-1":1,zero:0,"minus-1":-1,"minus-2":-2,"minus-3":-3};

function ScoreBadge({ score, changed, delta, showScoreHighlights }) {
  const label = SCORE_SYMBOL[score] || "0";
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "";
  const style = {
    marginLeft: "0.5rem",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
    borderRadius: "9999px",
    padding: "0.125rem 0.5rem",
    fontSize: "0.875rem",
    fontWeight: 600,
    background: "#f1f5f9",
    outline: changed && showScoreHighlights ? "2px solid #f59e0b" : "none"
  };
  return (
    <span style={style} title={delta>0 ? "Score increased" : delta<0 ? "Score decreased" : "Score unchanged"}>
      {label}{changed && showScoreHighlights && <span style={{color:"#b45309"}}>{arrow}</span>}
    </span>
  );
}

function computeRow(it){
  const cur = SCORE_VALUE[it.Score_Current ?? "zero"] ?? 0;
  const prev = SCORE_VALUE[it.Score_Previous ?? it.Score_Current ?? "zero"] ?? 0;
  const delta = cur - prev;
  return {
    ...it,
    delta,
    scoreChanged: delta !== 0,
    summaryChanged: !!it.Summary_Changed_Date
  };
}

function linkifyList(val){
  if(!val) return [];
  const raw = Array.isArray(val) ? val : String(val).split(/[\s,]+/);
  return raw.map(s=>s.trim()).filter(Boolean).map(u=>{
    try { const url = new URL(u); return { url: u, label: url.hostname.replace(/^www\./,"") }; }
    catch { return { url: u, label: u }; }
  });
}

function HoverRow({ row, showScoreHighlights, showSummaryDots }){
  const [open,setOpen] = useState(false);
  const r = computeRow(row);
  const links = linkifyList(row.Evidence_Links);

  return (
    <div
      style={{ position:"relative", display:"flex", alignItems:"center", padding:"0.75rem 1rem" }}
      onMouseEnter={()=>setOpen(true)}
      onMouseLeave={()=>setOpen(false)}
    >
      {/* single line: dot + piece + score */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"0.5rem", width:"100%" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", minWidth:0 }}>
          {showSummaryDots && r.summaryChanged && (
            <span title="Summary updated"
              style={{ width:8, height:8, borderRadius:9999, background:"#f59e0b", flexShrink:0 }} />
          )}
          <span title={row.Piece} style={{
            minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
            paddingRight:"0.5rem", fontWeight:600, color:"#1f2937"
          }}>
            {row.Piece}
          </span>
        </div>
        <ScoreBadge score={row.Score_Current} changed={r.scoreChanged} delta={r.delta} showScoreHighlights={showScoreHighlights} />
      </div>

      {/* hover card (no dates or from→to details; links shown without "Sources") */}
      {open && (
        <div
          style={{
            position:"absolute", left:"1rem", top:"100%", marginTop:"0.5rem", zIndex:20,
            width:"min(38rem,90vw)", background:"white", border:"1px solid #e2e8f0",
            borderRadius:"0.75rem", padding:"0.75rem", fontSize:"0.8rem",
            boxShadow:"0 10px 15px rgba(0,0,0,0.1)", maxHeight:"22rem", overflowY:"auto"
          }}
        >
          <div style={{ fontWeight:600, color:"#334155", marginBottom:"0.25rem" }}>Context</div>
          <div style={{ whiteSpace:"pre-line", color:"#334155" }}>{row.Summary_Current}</div>

          {links.length>0 && (
            <ul style={{ marginTop:"0.5rem", paddingLeft:"1rem" }}>
              {links.map((l,i)=>(
                <li key={i} style={{ marginBottom:"0.25rem" }}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ color:"#334155", textDecoration:"underline" }}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Column({ title, items, showScoreHighlights, showSummaryDots }){
  return (
    <div style={{ borderRadius:"1rem", background:"white", boxShadow:"0 1px 2px rgba(0,0,0,0.05)", border:"1px solid #e2e8f0" }}>
      <div style={{ position:"sticky", top:0, zIndex:10, borderTopLeftRadius:"1rem", borderTopRightRadius:"1rem",
                    background:"#f8fafc", padding:"0.75rem 1rem", fontSize:"1rem", fontWeight:600, color:"#1e293b" }}>
        {title}
      </div>
      <div>
        {items.map((row,i)=>(
          <React.Fragment key={i}>
            <HoverRow row={row} showScoreHighlights={showScoreHighlights} showSummaryDots={showSummaryDots} />
            {i < items.length-1 && <div style={{ height:1, background:"#f1f5f9" }} />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function Changelog({ data, open, onClose, mode }){
  if(!open) return null;

  const rows = Object.entries(data).flatMap(([team, arr]) =>
    arr.map(r => ({...computeRow(r), Team: team}))
  );
  const filtered = rows.filter(r => mode === "score" ? r.scoreChanged : r.summaryChanged);
  const grouped = filtered.reduce((acc,r)=>{ (acc[r.Team] ||= []).push(r); return acc; },{});
  const total = filtered.length;

  return (
    <div
      onClick={onClose}
      style={{ position:"fixed", inset:0, zIndex:40, display:"flex", justifyContent:"flex-end", background:"rgba(0,0,0,0.3)" }}
    >
      <div
        onClick={(e)=>e.stopPropagation()}
        style={{ height:"100%", width:"min(30rem,100%)", overflow:"auto", background:"white", padding:"1rem",
                 boxShadow:"0 10px 15px rgba(0,0,0,0.2)" }}
      >
        <div style={{ marginBottom:"0.75rem", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:"1.125rem", fontWeight:600, color:"#0f172a" }}>
            Changelog – {mode === "score" ? "Score changes" : "Summary updates"}
          </div>
          <button onClick={onClose} style={{ border:"1px solid #cbd5e1", borderRadius:8, padding:"0.25rem 0.5rem", fontSize:"0.875rem" }}>
            Close
          </button>
        </div>
        <div style={{ fontSize:"0.9rem", color:"#475569" }}>{total} item{total===1?"":"s"} updated.</div>
        <div style={{ marginTop:"0.75rem" }}>
          {Object.entries(grouped).map(([team, arr])=>(
            <div key={team} style={{ marginBottom:"0.75rem" }}>
              <div style={{ marginBottom:"0.5rem", fontSize:"0.9rem", fontWeight:600, color:"#1f2937" }}>{team}</div>
              <ul style={{ listStyle:"none", padding:0, margin:0 }}>
                {arr.map((r,i)=>(
                  <li key={i} style={{ border:"1px solid #e2e8f0", borderRadius:8, padding:"0.5rem", fontSize:"0.75rem", marginBottom:"0.5rem" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <div style={{ fontWeight:600, color:"#1f2937" }}>{r.Piece}</div>
                      <div style={{ color:"#475569" }}>
                        {mode==="score" ? "Score changed" : "Summary updated"}
                      </div>
                    </div>
                    <div style={{ marginTop:"0.25rem", color:"#334155" }}>{r.Summary_Current}</div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Infographic(){
  const [data, setData] = useState(null);
  const [showScoreHighlights, setShowScoreHighlights] = useState(true);
  const [showSummaryDots, setShowSummaryDots] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [logMode, setLogMode] = useState("summary"); // 'summary' | 'score'
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    Papa.parse(`/climate_chess.csv?ts=${Date.now()}`, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;

        // Canonicalize & group
        const CANON = {"team urgency":"Team Urgency","team no-urgency":"Team No-Urgency","symptoms":"Symptoms"};
        const normTeam = (t)=> CANON[(t||"").trim().toLowerCase()] || (t||"").trim();

        const grouped = { "Team Urgency": [], "Team No-Urgency": [], "Symptoms": [] };
        rows.forEach(r => {
          const team = normTeam(r.Team);
          if (grouped[team]) grouped[team].push(r);
        });

        // Sort within each column by Order, then Piece
        Object.keys(grouped).forEach(k=>{
          grouped[k].sort((a,b)=>{
            const ao = parseInt(a.Order||"9999",10), bo = parseInt(b.Order||"9999",10);
            if (ao !== bo) return ao - bo;
            return String(a.Piece||"").localeCompare(String(b.Piece||""));
          });
        });

        setData(grouped);
      },
      error: (err) => { console.error("CSV parse error", err); }
    });
  }, [reloadKey]);

  const lastUpdated = useMemo(()=>{
    if(!data) return new Date();
    const all = Object.values(data).flat();
    const times = all.map(r=>Math.max(
      Date.parse(r.Score_Changed_Date || 0) || 0,
      Date.parse(r.Summary_Changed_Date || 0) || 0
    ));
    const ms = Math.max(...times,0);
    return ms ? new Date(ms) : new Date();
  }, [data]);

  if (!data) return <div style={{padding:16}}>Loading…</div>;

  return (
    <div style={{ margin:"0 auto", maxWidth: "72rem", padding:"1.5rem", fontFamily:"system-ui, sans-serif" }}>
      <header style={{ display:"grid", gap:"0.75rem" }}>
        <h1 style={{ fontSize:"1.5rem", fontWeight:700, color:"#0f172a" }}>Climate Chess – Interactive Infographic</h1>
        <p style={{ color:"#334155" }}>
          <strong>Climate Chess</strong> frames the struggle over climate action as a live contest between
          <em> Team Urgency</em> and <em> Team No-Urgency</em>. The outcome appears as real-world <em>Symptoms</em> (results) on the right.
        </p>
        <div style={{ fontSize:"0.875rem", color:"#475569" }}>
          Infographic last updated: {new Intl.DateTimeFormat(undefined,{year:"numeric",month:"short",day:"numeric"}).format(lastUpdated)}
        </div>
        <div style={{ border:"1px solid #e2e8f0", borderRadius:12, background:"#f8fafc", padding:"0.75rem", fontSize:"0.9rem", color:"#334155" }}>
          <strong>Scoring context:</strong> Scores change infrequently and reflect longer-term status. A score change signals a significant development.
          Hover summaries can update more often; the ● dot indicates a recent summary update. ▲/▼ on the chip indicate the score moved.
        </div>

        <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:"0.5rem" }}>
          <button
            style={{ border:"1px solid #cbd5e1", borderRadius:12, padding:"0.5rem 0.75rem",
                     fontSize:"0.875rem", fontWeight:600, background: showSummaryDots?"#059669":"white", color: showSummaryDots?"white":"#0f172a" }}
            onClick={()=>setShowSummaryDots(v=>!v)} title="Toggle indicators for hover summary updates"
          >
            Summary Updates: {showSummaryDots ? "ON" : "OFF"}
          </button>

          <button
            style={{ border:"1px solid #cbd5e1", borderRadius:12, padding:"0.5rem 0.75rem",
                     fontSize:"0.875rem", fontWeight:600, background: showScoreHighlights?"#059669":"white", color: showScoreHighlights?"white":"#0f172a" }}
            onClick={()=>setShowScoreHighlights(v=>!v)} title="Toggle highlights for score changes"
          >
            Score Changes: {showScoreHighlights ? "ON" : "OFF"}
          </button>

          <button
            style={{ border:"1px solid #cbd5e1", borderRadius:12, padding:"0.5rem 0.75rem",
                     fontSize:"0.875rem", fontWeight:600, background:"white", color:"#0f172a" }}
            onClick={()=>setLogOpen(o=>!o)} title="Open/close changelog"
          >
            {logOpen ? "Close Changelog" : "View Changelog"}
          </button>

          <button
            style={{ border:"1px solid #cbd5e1", borderRadius:12, padding:"0.5rem 0.75rem",
                     fontSize:"0.875rem", fontWeight:600, background:"white", color:"#0f172a" }}
            onClick={()=>setReloadKey(k=>k+1)} title="Force re-read CSV"
          >
            Reload Data
          </button>

          <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", fontSize:"0.75rem" }}>
            <label>Mode:</label>
            <select
              value={logMode}
              onChange={(e)=>setLogMode(e.target.value)}
              title="Choose which updates to list"
              style={{ border:"1px solid #cbd5e1", borderRadius:8, padding:"2px 6px" }}
            >
              <option value="summary">Summary updates</option>
              <option value="score">Score changes</option>
            </select>
          </div>

          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:"0.5rem",
                        border:"1px solid #e2e8f0", borderRadius:12, background:"#f8fafc", padding:"0.375rem 0.5rem", fontSize:"0.75rem" }}>
            <span style={{ fontWeight:600, color:"#0f172a" }}>Legend</span>
            <span style={{ color:"#334155" }}>➕/➖ = score · ▲/▼ = score changed · ● = summary updated</span>
          </div>
        </div>
      </header>

      {/* Three columns */}
      <section style={{
        display:"grid", gridTemplateColumns:"repeat(3, minmax(0,1fr))", gap:"1rem", marginTop:"1rem"
      }}>
        <Column title="Team Urgency Pieces" items={data["Team Urgency"]} showScoreHighlights={showScoreHighlights} showSummaryDots={showSummaryDots} />
        <Column title="Team No-Urgency Pieces" items={data["Team No-Urgency"]} showScoreHighlights={showScoreHighlights} showSummaryDots={showSummaryDots} />
        <Column title="Symptoms / Risks (Results)" items={data["Symptoms"]} showScoreHighlights={showScoreHighlights} showSummaryDots={showSummaryDots} />
      </section>

      <Changelog data={data} open={logOpen} onClose={()=>setLogOpen(false)} mode={logMode} />
    </div>
  );
}
