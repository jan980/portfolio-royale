import { useState, useMemo, useCallback, useRef } from "react";
import PerformanceChart, { displayDate } from "./PerformanceChart.jsx";
import useMarketHistory from "./useMarketHistory.js";
import { historyPrices } from "./lib/history.js";
import { BUDGET, BUY_PRICES, PLAYERS_DATA, INACTIVE, getAllTickers } from "./data/portfolios.js";

const API_KEY = "d7l12fpr01qm7o0a47o0d7l12fpr01qm7o0a47og";

function fmt(n) { return Math.round(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }); }
function fmtPct(n) { return (n >= 0 ? "+" : "") + (n * 100).toFixed(2) + "%"; }
function fmtPrice(n) { return "$" + n.toFixed(2); }

function computePortfolio(picks, buyPrices, livePrices) {
  let totalValue = 0, totalInvested = 0;
  const rows = picks.map(p => {
    const bp = buyPrices[p.ticker];
    const lp = livePrices[p.ticker];
    const shares = bp ? p.allocation / bp : 0;
    const currentValue = (lp && bp) ? shares * lp : p.allocation;
    const pl = currentValue - p.allocation;
    totalValue += currentValue;
    totalInvested += p.allocation;
    return { ...p, buyPrice: bp, shares, livePrice: lp, currentValue, pl };
  });
  const cash = BUDGET - totalInvested;
  const portfolioValue = totalValue + cash;
  const ret = portfolioValue / BUDGET - 1;
  return { rows, portfolioValue, ret, totalInvested, cash };
}

const delay = ms => new Promise(r => setTimeout(r, ms));

export default function App() {
  const { history, error: historyError, retry: retryHistory } = useMarketHistory();
  const [livePrices, setLivePrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [valuationMode, setValuationMode] = useState("close");
  const fetching = useRef(false);
  const buyPrices = useMemo(() => history ? historyPrices(history, 0) : BUY_PRICES, [history]);
  const dailyPrices = useMemo(() => history ? historyPrices(history) : {}, [history]);
  const displayPrices = valuationMode === "close" ? dailyPrices : { ...dailyPrices, ...livePrices };

  const fetchQuote = useCallback(async (ticker) => {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${API_KEY}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    // Only count current-session quotes as live. Older or unavailable quotes
    // use the explicitly labelled daily close instead.
    if (!Number.isFinite(data.c) || data.c <= 0 || !data.t || Date.now() / 1000 - data.t > 24 * 60 * 60) return null;
    return data.c;
  }, []);

  const refreshLive = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    setValuationMode("live");
    setLoading(true);
    const tickers = getAllTickers();
    const prices = {};
    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i];
      setStage(`Live prices: ${i + 1}/${tickers.length}`);
      try {
        const price = await fetchQuote(ticker);
        if (price) prices[ticker] = price;
      } catch { /* Saved daily close remains available. */ }
      await delay(130);
    }
    setLivePrices(prices);
    setLastUpdate(new Date());
    setLoading(false);
    setStage("");
    fetching.current = false;
  }, [fetchQuote]);

  const hasPrices = Boolean(history);
  const fallbackCount = getAllTickers().length - Object.keys(livePrices).length;
  const priceLabel = valuationMode === "close" ? "Closing price" : "Latest price";
  const leaderboard = Object.entries(PLAYERS_DATA)
    .map(([name, picks]) => ({ name, ...computePortfolio(picks, buyPrices, displayPrices) }))
    .sort((a, b) => b.portfolioValue - a.portfolioValue);
  const selectedData = selectedPlayer && history
    ? computePortfolio(PLAYERS_DATA[selectedPlayer], buyPrices, displayPrices)
    : null;

  return (
    <div style={{ background: "#FAFAF8", minHeight: "100vh", fontFamily: "'Instrument Serif', Georgia, serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />

      {/* Nav */}
      <nav className="app-nav" style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "16px 40px", borderBottom: "1px solid #E8E6E1",
        background: "#FAFAF8", position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect width="20" height="20" rx="4" fill="#1A1A1A"/>
            <path d="M6 14L10 6L14 14" stroke="#FAFAF8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="7.5" y1="11.5" x2="12.5" y2="11.5" stroke="#FAFAF8" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "14px", fontWeight: 600, color: "#1A1A1A" }}>
            Portfolio Royale
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {history && (
            <span className="quote-asof" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "12px", color: "#999" }}>
              {valuationMode === "close" ? `${displayDate(history.endDate)} close` : lastUpdate ? lastUpdate.toLocaleTimeString() : "Fetching quotes"}
            </span>
          )}
          <button onClick={refreshLive} disabled={loading || !history} style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: "13px", fontWeight: 500,
            background: loading ? "#F0EFEB" : "#1A1A1A", color: loading ? "#999" : "#fff",
            border: "none", borderRadius: "8px", padding: "8px 18px",
            cursor: loading ? "default" : "pointer",
          }}>
            {loading ? stage || "Loading..." : valuationMode === "close" ? "View live prices" : "Refresh live prices"}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="app-hero" style={{ padding: "64px 40px 52px", maxWidth: "900px", margin: "0 auto" }}>
        <h1 style={{
          fontSize: "clamp(42px, 6vw, 72px)", fontWeight: 400, color: "#1A1A1A",
          lineHeight: 1.05, margin: 0, letterSpacing: "-1.5px",
        }}>
          Who's printing tendies<br/>and who's bag-holding?
        </h1>
        <p style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: "16px", color: "#888",
          marginTop: "20px", lineHeight: 1.6, maxWidth: "440px",
        }}>
          6 degenerate apes, $100k each, real yolo picks. Buy-in locked at Jan 2, 2026 close. Diamond hands only. 💎🙌🚀
        </p>
        <div style={{
          display: "flex", gap: "24px", marginTop: "32px",
          fontFamily: "'DM Sans', sans-serif", fontSize: "13px", color: "#aaa", flexWrap: "wrap",
        }}>
          <span>{Object.keys(PLAYERS_DATA).length} active players</span>
          <span>·</span>
          <span>{getAllTickers().length} unique tickers</span>
          <span>·</span>
          <span>Buy-in: Jan 2, 2026</span>
        </div>
      </section>

      <PerformanceChart history={history} error={historyError} retry={retryHistory} selectedPlayer={selectedPlayer} onSelectPlayer={setSelectedPlayer} />

      {/* Leaderboard */}
      <section className="app-section" style={{ maxWidth: "980px", margin: "0 auto", padding: "0 40px 60px" }}>
        <div className="leaderboard-toolbar">
          <div className="eyebrow" style={{ marginBottom: 0 }}>Leaderboard</div>
          <div className="segmented" aria-label="Leaderboard valuation">
            <button aria-pressed={valuationMode === "close"} onClick={() => setValuationMode("close")}>Daily close</button>
            <button aria-pressed={valuationMode === "live"} disabled={!history || loading} onClick={() => { if (lastUpdate) setValuationMode("live"); else refreshLive(); }}>Live</button>
          </div>
        </div>
        <p className="leaderboard-caption">{!history ? "Waiting for verified closing prices." : valuationMode === "close"
          ? `${displayDate(history.endDate, { year: "numeric" })} market close · Matches the chart’s latest day`
          : loading ? "Fetching live quotes. Saved daily closes remain visible until the update completes."
          : `${Object.keys(livePrices).length} live quotes · ${fallbackCount} ${fallbackCount === 1 ? "position uses" : "positions use"} the ${displayDate(history.endDate)} close`}</p>

        <div style={{ borderTop: "1px solid #E8E6E1" }}>
          {leaderboard.map((player, i) => {
            const isSelected = selectedPlayer === player.name;
            const ret = player.ret;
            return (
              <button className="leaderboard-row" key={player.name} aria-pressed={isSelected}
                onClick={() => setSelectedPlayer(isSelected ? null : player.name)}
                style={{
                  display: "grid", gridTemplateColumns: "32px 1fr auto auto",
                  alignItems: "center", gap: "16px", padding: "18px 0",
                  borderBottom: "1px solid #E8E6E1", cursor: "pointer",
                  background: isSelected ? "#F5F4F0" : "transparent",
                  marginLeft: isSelected ? "-16px" : "0", marginRight: isSelected ? "-16px" : "0",
                  paddingLeft: isSelected ? "16px" : "0", paddingRight: isSelected ? "16px" : "0",
                  borderRadius: isSelected ? "8px" : "0", transition: "all 0.2s ease",
                }}>
                <span style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: "14px", fontWeight: 500,
                  color: i === 0 ? "#1A1A1A" : "#ccc",
                }}>{i + 1}</span>
                <div>
                  <span style={{ fontSize: "18px", color: "#1A1A1A", letterSpacing: "-0.3px" }}>
                    {player.name}
                  </span>
                  <span className="player-picks" style={{
                    fontFamily: "'DM Sans', sans-serif", fontSize: "12px", color: "#bbb", marginLeft: "12px",
                  }}>
                    {player.rows.length} picks
                  </span>
                </div>
                <span className="leaderboard-return" style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: "14px", fontWeight: 500,
                  color: ret > 0 ? "#16a34a" : ret < 0 ? "#dc2626" : "#999",
                  minWidth: "70px", textAlign: "right",
                }}>{hasPrices ? fmtPct(ret) : "—"}</span>
                <span className="leaderboard-value" style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: "15px", fontWeight: 600,
                  color: "#1A1A1A", minWidth: "100px", textAlign: "right",
                }}>{hasPrices ? fmt(player.portfolioValue) : "—"}</span>
              </button>
            );
          })}
        </div>
        <div style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: "12px", color: "#bbb", marginTop: "16px",
        }}>{INACTIVE.join(", ")} haven't entered their picks yet.</div>
      </section>

      {/* Player Detail */}
      {selectedData && (
        <section className="app-section" style={{ maxWidth: "980px", margin: "0 auto", padding: "0 40px 80px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "32px", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <div style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: "11px", fontWeight: 600,
                letterSpacing: "1.5px", color: "#bbb", textTransform: "uppercase", marginBottom: "8px",
              }}>Portfolio breakdown</div>
              <h2 style={{ fontSize: "36px", fontWeight: 400, color: "#1A1A1A", margin: 0 }}>{selectedPlayer}</h2>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "28px", fontWeight: 600, color: "#1A1A1A" }}>
                {fmt(selectedData.portfolioValue)}
              </div>
              <div style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: "15px", fontWeight: 500,
                color: selectedData.ret > 0 ? "#16a34a" : selectedData.ret < 0 ? "#dc2626" : "#999",
              }}>{fmtPct(selectedData.ret)}</div>
            </div>
          </div>

          <div className="portfolio-stats" style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
            gap: "1px", background: "#E8E6E1", borderRadius: "12px", overflow: "hidden", marginBottom: "40px",
          }}>
            {[
              { label: "Invested", value: fmt(selectedData.totalInvested) },
              { label: "Cash", value: fmt(selectedData.cash) },
              { label: "Positions", value: selectedData.rows.length },
            ].map((s, i) => (
              <div key={i} style={{ background: "#fff", padding: "20px 24px" }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "11px", color: "#999", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>{s.label}</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "20px", fontWeight: 600, color: "#1A1A1A" }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #E8E6E1", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Sans', sans-serif", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E8E6E1" }}>
                  {["Ticker", "Allocation", "Entry (split adj.)", "Shares", priceLabel, "Value", "P/L"].map((h, i) => (
                    <th key={h} style={{
                      padding: "12px 16px", textAlign: i === 0 ? "left" : "right",
                      fontSize: "11px", fontWeight: 600, letterSpacing: "0.8px", color: "#999",
                      textTransform: "uppercase", background: "#FAFAF8", whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedData.rows.map((r, i) => {
                  const ret = (r.livePrice && r.buyPrice) ? (r.livePrice - r.buyPrice) / r.buyPrice : 0;
                  return (
                    <tr key={i} style={{ borderBottom: i < selectedData.rows.length - 1 ? "1px solid #F0EFEB" : "none" }}>
                      <td style={{ padding: "14px 16px", fontWeight: 600, color: "#1A1A1A" }}>{r.ticker}</td>
                      <td style={{ padding: "14px 16px", textAlign: "right", color: "#666" }}>{fmt(r.allocation)}</td>
                      <td style={{ padding: "14px 16px", textAlign: "right", color: "#666" }}>{r.buyPrice ? fmtPrice(r.buyPrice) : "—"}</td>
                      <td style={{ padding: "14px 16px", textAlign: "right", color: "#aaa" }}>{r.shares ? r.shares.toFixed(2) : "—"}</td>
                      <td style={{ padding: "14px 16px", textAlign: "right", color: "#1A1A1A", fontWeight: 500 }}>{r.livePrice ? fmtPrice(r.livePrice) : "—"}</td>
                      <td style={{ padding: "14px 16px", textAlign: "right", color: "#1A1A1A", fontWeight: 600 }}>{fmt(r.currentValue)}</td>
                      <td style={{
                        padding: "14px 16px", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap",
                        color: r.pl > 0 ? "#16a34a" : r.pl < 0 ? "#dc2626" : "#999",
                      }}>
                        {r.pl >= 0 ? "+" : ""}{fmt(r.pl)}
                        <span style={{ fontSize: "11px", marginLeft: "6px", fontWeight: 400, opacity: 0.7 }}>{fmtPct(ret)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Stock grid */}
      {!selectedPlayer && hasPrices && (
        <section className="app-section" style={{ maxWidth: "980px", margin: "0 auto", padding: "0 40px 80px" }}>
          <div style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: "11px", fontWeight: 600,
            letterSpacing: "1.5px", color: "#bbb", textTransform: "uppercase", marginBottom: "8px",
          }}>All holdings</div>
          <h2 style={{ fontSize: "36px", fontWeight: 400, color: "#1A1A1A", margin: "0 0 32px" }}>
            {getAllTickers().filter(t => displayPrices[t] && buyPrices[t]).length} stocks tracked.
          </h2>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "1px", background: "#E8E6E1", borderRadius: "12px", overflow: "hidden",
          }}>
            {getAllTickers()
              .filter(t => displayPrices[t] && buyPrices[t])
              .sort((a, b) =>
                ((displayPrices[b] - buyPrices[b]) / buyPrices[b]) - ((displayPrices[a] - buyPrices[a]) / buyPrices[a])
              )
              .map(ticker => {
                const owners = [];
                Object.entries(PLAYERS_DATA).forEach(([name, picks]) => {
                  if (picks.find(x => x.ticker === ticker)) owners.push(name);
                });
                const ret = (displayPrices[ticker] - buyPrices[ticker]) / buyPrices[ticker];
                return (
                  <div key={ticker} style={{ background: "#fff", padding: "20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "14px", fontWeight: 600, color: "#1A1A1A" }}>{ticker}</span>
                      <span style={{
                        fontFamily: "'DM Sans', sans-serif", fontSize: "12px", fontWeight: 600,
                        color: ret > 0 ? "#16a34a" : ret < 0 ? "#dc2626" : "#999",
                      }}>{fmtPct(ret)}</span>
                    </div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "11px", color: "#aaa", display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                      <span>{fmtPrice(buyPrices[ticker])}</span>
                      <span style={{ color: "#666", fontWeight: 500 }}>{fmtPrice(displayPrices[ticker])}</span>
                    </div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "11px", color: "#bbb" }}>
                      {owners.join(", ")}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      <footer className="app-footer" style={{ borderTop: "1px solid #E8E6E1", padding: "32px 40px", maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Sans', sans-serif", fontSize: "12px", color: "#ccc", flexWrap: "wrap", gap: "8px" }}>
          <span>Portfolio Royale</span>
          <span>History via Yahoo Finance · Live via Finnhub · Jan 2, 2026 start</span>
        </div>
      </footer>
    </div>
  );
}
