import { useMemo, useState } from "react";
import { BUDGET, PLAYERS_DATA } from "./data/portfolios.js";
import { portfolioSeries } from "./lib/history.js";
import { PLAYER_COLORS, money, percent, displayDate } from "./lib/presentation.js";

const WIDTH = 800, HEIGHT = 260;

export default function PerformanceChart({ history, selectedPlayer, liveMode }) {
  const [range, setRange] = useState("All");
  const [hoverDate, setHoverDate] = useState(null);
  const [keyboardDate, setKeyboardDate] = useState(null);
  const allPoints = useMemo(() => portfolioSeries(history, PLAYERS_DATA, BUDGET), [history]);
  // Trading-session windows match the reference's 1M and 3M controls.
  const points = useMemo(() => range === "All" ? allPoints : allPoints.slice(range === "1M" ? -21 : -63), [allPoints, range]);
  const names = Object.keys(PLAYERS_DATA);
  const orderedNames = [...names.filter((name) => name !== selectedPlayer), selectedPlayer];
  const values = points.flatMap((point) => names.map((name) => point.values[name].returnPct));
  const min = Math.min(0, ...values) - 2;
  const max = Math.max(0, ...values) + 2;
  const x = (index) => index / Math.max(points.length - 1, 1) * WIDTH;
  const y = (value) => HEIGHT - (value - min) / (max - min) * HEIGHT;
  const requestedDate = hoverDate ?? keyboardDate;
  const selectedIndex = points.findIndex((point) => point.date === requestedDate);
  const inspecting = selectedIndex >= 0;
  const index = inspecting ? selectedIndex : points.length - 1;
  const point = points[index];
  const selected = point.values[selectedPlayer];
  const color = PLAYER_COLORS[selectedPlayer];

  function inspectPointer(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    setHoverDate(points[Math.round(fraction * (points.length - 1))].date);
  }
  function inspectKey(event) {
    let next;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = Math.max(0, index - 1);
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") next = Math.min(points.length - 1, index + 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = points.length - 1;
    else if (event.key === "Escape") { setHoverDate(null); setKeyboardDate(null); return; }
    else return;
    event.preventDefault();
    setHoverDate(null);
    setKeyboardDate(points[next].date);
  }

  return (
    <section className="performance-section" aria-label={`${selectedPlayer}'s historical performance`}>
      <div className="performance-toolbar">
        <div className="performance-readout">
          <div className="performance-date"><span className="player-dot" style={{ background: color }} />{selectedPlayer} · {displayDate(point.date)}{inspecting ? "" : " close"}</div>
          <div className="performance-total"><span>{money(selected.value)}</span><span className={selected.returnPct < -0.005 ? "negative" : "positive"}>{percent(selected.returnPct)}</span></div>
        </div>
        <div className="range-controls" aria-label="Chart date range">
          {["1M", "3M", "All"].map((item) => <button key={item} aria-pressed={range === item} onClick={() => { setRange(item); setHoverDate(null); setKeyboardDate(null); }}>{item}</button>)}
        </div>
      </div>
      <div className="performance-plot" role="slider" tabIndex={0} aria-label={`${selectedPlayer} portfolio history. Use arrow keys to explore trading days.`}
        aria-valuemin={0} aria-valuemax={points.length - 1} aria-valuenow={index}
        aria-valuetext={`${displayDate(point.date, { year: "numeric" })}: ${money(selected.value)}, ${percent(selected.returnPct)}`}
        onPointerDown={inspectPointer} onPointerMove={inspectPointer} onPointerLeave={() => setHoverDate(null)} onPointerCancel={() => setHoverDate(null)} onKeyDown={inspectKey} onBlur={() => setKeyboardDate(null)}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" x2={WIDTH} y1={y(0)} y2={y(0)} stroke="#d9d6cf" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          {orderedNames.map((name) => <path key={name}
            d={points.map((entry, i) => `${i ? "L" : "M"}${x(i).toFixed(2)} ${y(entry.values[name].returnPct).toFixed(2)}`).join(" ")}
            fill="none" stroke={name === selectedPlayer ? color : "#dcd9d2"} strokeWidth={name === selectedPlayer ? 2 : 1.25}
            strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
        </svg>
        <span className="zero-label" style={{ top: `${y(0) / HEIGHT * 100}%` }}>0%</span>
        {inspecting && <>
          <span className="chart-crosshair" style={{ left: `${x(index) / WIDTH * 100}%` }} />
          <span className="chart-marker" style={{ left: `${x(index) / WIDTH * 100}%`, top: `${y(selected.returnPct) / HEIGHT * 100}%`, background: color }} />
        </>}
      </div>
      <div className="chart-dates"><span>{displayDate(points[0].date)}</span><span>{displayDate(points.at(-1).date)}</span></div>
      {liveMode && <p className="chart-context">Chart shows daily closes through {displayDate(history.endDate)}. Live quotes are shown in the leaderboard and picks.</p>}
    </section>
  );
}
