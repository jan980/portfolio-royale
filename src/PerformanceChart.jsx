import { useEffect, useMemo, useRef, useState } from "react";
import { BUDGET, PLAYERS_DATA } from "./data/portfolios.js";
import { portfolioSeries } from "./lib/history.js";
import "./history.css";

const COLORS = { Jan: "#426d9e", Nejc: "#ad7627", Filip: "#33846d", Matus: "#a56c9c", Nil: "#bc6252", Robbie: "#787b40" };
const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
const percent = (value) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
export const displayDate = (date, options = {}) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC", ...options });
const PLOT = { left: 68, right: 18, top: 26, bottom: 42 };

export default function PerformanceChart({ history, error, retry, selectedPlayer, onSelectPlayer }) {
  const [metric, setMetric] = useState("returnPct");
  const [period, setPeriod] = useState("ALL");
  const [hoverIndex, setHoverIndex] = useState(null);
  const [scrubDate, setScrubDate] = useState(null);
  const svgRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(840);
  useEffect(() => {
    if (!svgRef.current) return;
    const observer = new ResizeObserver(([entry]) => setChartWidth(Math.max(300, entry.contentRect.width)));
    observer.observe(svgRef.current);
    return () => observer.disconnect();
  }, [history]);
  const allPoints = useMemo(() => history ? portfolioSeries(history, PLAYERS_DATA, BUDGET) : [], [history]);
  const points = useMemo(() => {
    if (period === "ALL") return allPoints;
    const cutoff = new Date(`${history.endDate}T12:00:00Z`);
    cutoff.setUTCMonth(cutoff.getUTCMonth() - (period === "1M" ? 1 : 3));
    return allPoints.filter((point) => point.date >= cutoff.toISOString().slice(0, 10));
  }, [allPoints, history, period]);

  if (!history) return (
    <section className="history-section history-placeholder" aria-label="Portfolio performance">
      <p className="eyebrow">THE LONG GAME</p>
      <h2>Every trading day. Every portfolio.</h2>
      <p role="status">{error || "Loading daily portfolio history…"}</p>
      {error && <button className="quiet-button" onClick={retry}>Try again</button>}
    </section>
  );

  const names = Object.keys(PLAYERS_DATA);
  const WIDTH = chartWidth, HEIGHT = chartWidth < 600 ? 270 : 310;
  const visibleNames = selectedPlayer ? [selectedPlayer] : names;
  const values = points.flatMap((point) => visibleNames.map((name) => point.values[name][metric]));
  const baseline = metric === "returnPct" ? 0 : BUDGET;
  const low = Math.min(baseline, ...values);
  const high = Math.max(baseline, ...values);
  const padding = Math.max((high - low) * 0.12, metric === "returnPct" ? 1 : 1000);
  const min = low - padding, max = high + padding;
  const plotWidth = WIDTH - PLOT.left - PLOT.right;
  const plotHeight = HEIGHT - PLOT.top - PLOT.bottom;
  const x = (index) => PLOT.left + index / Math.max(points.length - 1, 1) * plotWidth;
  const y = (value) => PLOT.top + (max - value) / (max - min) * plotHeight;
  const scrubIndex = scrubDate ? points.findIndex((point) => point.date === scrubDate) : -1;
  const activeIndex = Math.min(points.length - 1, hoverIndex ?? (scrubIndex >= 0 ? scrubIndex : points.length - 1));
  const active = points[activeIndex];
  const ranking = [...names].sort((a, b) => allPoints.at(-1).values[b].value - allPoints.at(-1).values[a].value);
  const dateTicks = [...new Set([0, Math.round((points.length - 1) / 3), Math.round(2 * (points.length - 1) / 3), points.length - 1])];
  const stale = Date.now() - Date.parse(`${history.endDate}T21:00:00Z`) > 4 * 86400000;

  function inspectPointer(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = (event.clientX - rect.left) / rect.width * WIDTH;
    setHoverIndex(Math.round(Math.max(0, Math.min(1, (relativeX - PLOT.left) / plotWidth)) * (points.length - 1)));
  }

  return (
    <section className="history-section" aria-labelledby="performance-title">
      <div className="history-heading">
        <div>
          <p className="eyebrow">THE LONG GAME</p>
          <h2 id="performance-title">{selectedPlayer ? `${selectedPlayer}’s journey.` : "Six portfolios. One starting line."}</h2>
          <p className="history-subtitle">$100,000 at the January 2 close. See how every pick played out.</p>
        </div>
        <div className="history-asof"><span className="status-dot" />Daily closes through {displayDate(history.endDate, { year: "numeric" })}</div>
      </div>

      <div className="history-panel">
        <div className="chart-toolbar">
          <div className="segmented" aria-label="Chart metric">
            <button aria-pressed={metric === "returnPct"} onClick={() => setMetric("returnPct")}>Return %</button>
            <button aria-pressed={metric === "value"} onClick={() => setMetric("value")}>Value $</button>
          </div>
          <div className="segmented period-controls" aria-label="Date range">
            {["1M", "3M", "ALL"].map((range) => <button key={range} aria-pressed={period === range} onClick={() => { setPeriod(range); setHoverIndex(null); setScrubDate(null); }}>{range === "ALL" ? "Since start" : range}</button>)}
          </div>
        </div>

        <div className="chart-caption">
          <span>{displayDate(active.date, { year: "numeric" })}<span className="muted"> · market close</span></span>
          {selectedPlayer ? <button className="text-button" onClick={() => onSelectPlayer(null)}>Compare everyone ↗</button> : <span className="chart-hint">Hover or slide to explore</span>}
        </div>
        <svg ref={svgRef} className="performance-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby="chart-title chart-description" onPointerMove={inspectPointer} onPointerLeave={() => setHoverIndex(null)}>
          <title id="chart-title">{selectedPlayer || "All players"}: daily portfolio {metric === "value" ? "value" : "return"}</title>
          <desc id="chart-description">Historical closing values from {points[0].date} to {points.at(-1).date}. Use the trading date slider below to read exact dollar values and percentage returns.</desc>
          {[0, 1, 2, 3, 4].map((tick) => {
            const value = min + (max - min) * tick / 4;
            return <g key={tick}>
              <line x1={PLOT.left} x2={WIDTH - PLOT.right} y1={y(value)} y2={y(value)} stroke="#eeede8" />
              <text x={PLOT.left - 12} y={y(value) + 4} textAnchor="end" className="axis-label">{metric === "value" ? `$${Math.round(value / 1000)}k` : `${value.toFixed(0)}%`}</text>
            </g>;
          })}
          <line x1={PLOT.left} x2={WIDTH - PLOT.right} y1={y(baseline)} y2={y(baseline)} stroke="#ccc9c0" strokeDasharray="4 5" />
          {dateTicks.map((index) => <text key={index} x={x(index)} y={HEIGHT - 12} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} className="axis-label">{displayDate(points[index].date)}</text>)}
          {visibleNames.map((name) => <path key={name} d={points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(2)},${y(point.values[name][metric]).toFixed(2)}`).join(" ")} fill="none" stroke={COLORS[name]} strokeWidth={selectedPlayer ? 2.8 : 2} strokeLinejoin="round" strokeLinecap="round" />)}
          <line x1={x(activeIndex)} x2={x(activeIndex)} y1={PLOT.top} y2={HEIGHT - PLOT.bottom} stroke="#b9b6ac" strokeDasharray="3 4" />
          {visibleNames.map((name) => <circle key={name} cx={x(activeIndex)} cy={y(active.values[name][metric])} r="4" fill={COLORS[name]} stroke="white" strokeWidth="2" />)}
        </svg>
        <div className="date-scrubber">
          <label htmlFor="trading-date">Trading day</label>
          <input id="trading-date" aria-label="Trading date" aria-valuetext={displayDate(active.date, { year: "numeric" })} type="range" min="0" max={points.length - 1} value={activeIndex} onChange={(event) => { setHoverIndex(null); setScrubDate(points[Number(event.target.value)].date); }} />
          <button className="text-button" onClick={() => { setHoverIndex(null); setScrubDate(null); }}>Latest</button>
        </div>

        <div className="chart-player-grid" aria-label={`Portfolio values at ${active.date}`}>
          {ranking.map((name) => <button className={`chart-player ${selectedPlayer === name ? "is-selected" : ""}`} key={name} aria-pressed={selectedPlayer === name} onClick={() => onSelectPlayer(selectedPlayer === name ? null : name)} style={{ "--player-color": COLORS[name] }}>
            <span className="chart-player-name"><span className="player-swatch" />{name}</span>
            <span className="chart-player-value">{money(active.values[name].value)}</span>
            <span className={`chart-player-return ${active.values[name].returnPct < -0.005 ? "negative" : "positive"}`}>{percent(Math.abs(active.values[name].returnPct) < 0.005 ? 0 : active.values[name].returnPct)}</span>
          </button>)}
        </div>
        <p className="chart-note">{points.length} trading days shown · Returns since January 2 · Splits accounted for · Dividends excluded</p>
      </div>
      {stale && <p className="history-warning" role="status">Showing saved prices from {displayDate(history.endDate)}. A newer daily update is not available yet.</p>}
      <details className="history-methodology">
        <summary>How the chart is calculated</summary>
        <p>Each original allocation buys fractional shares at the verified January 2, 2026 closing price. Daily value is the original allocation multiplied by that day’s closing-price ratio, plus any uninvested cash. All portfolios start at $100,000. Prices use the same split-adjusted basis; cash dividends and reinvestment are excluded.</p>
        <p>The chart contains completed US trading sessions only. Starting prices are verified against Yahoo Finance, so results may differ from the previous manually entered prices. Daily closes and live prices are shown separately. Missing history is never replaced with zero or estimated returns.</p>
        <p>Source: Yahoo Finance via yahoo-finance2. Dataset saved {new Date(history.generatedAt).toLocaleString("en-US")}. Select a player to focus the chart and see their holdings below.</p>
      </details>
    </section>
  );
}
