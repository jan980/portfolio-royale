import { useState, useEffect, useCallback, useRef } from "react";

const API_KEY = "d7l12fpr01qm7o0a47o0d7l12fpr01qm7o0a47og";
const BUDGET = 100000;

// Jan 2, 2026 closing prices (hardcoded — verify if numbers look off)
const BUY_PRICES = {
  AMZN: 226.50, META: 649.85, AVGO: 346.89, ANET: 133.60, AMD: 223.47,
  TSM: 318.89,  VRT: 175.57,  SMCI: 30.96,  SOUN: 10.60,  MP: 54.97,
  IBIT: 50.94,  TQQQ: 52.26,  GOOGL: 314.93, GOOG: 315.32, IREN: 42.70,
  TMC: 6.78,   LIT: 66.27,   ASTS: 83.47,  NVO: 50.54,   IONQ: 46.77,
  RGTI: 23.60,  CRWD: 453.58, NVDA: 188.84, NEE: 80.38,   LMT: 494.46,
  OXY: 42.18,  DSDVY: 128.09, RDW: 9.03,   LLY: 1078.56, RKLB: 75.99,
  GOLD: 34.77,  MSTR: 157.16, MS: 180.90,   C: 118.08,    MSFT: 471.86,
  PLTR: 167.86, UBER: 82.86,  NOW: 147.45,  VEEV: 219.49, RDDT: 241.89,
  XOM: 121.84,
  URNU: 36.00,
};

const PLAYERS_DATA = {
  "Jan": [
    { ticker: "AMZN", allocation: 21000 },
    { ticker: "META", allocation: 25000 },
    { ticker: "AVGO", allocation: 9000 },
    { ticker: "ANET", allocation: 8000 },
    { ticker: "AMD", allocation: 7000 },
    { ticker: "TSM", allocation: 7000 },
    { ticker: "VRT", allocation: 7000 },
    { ticker: "SMCI", allocation: 7000 },
    { ticker: "SOUN", allocation: 5000 },
    { ticker: "MP", allocation: 4000 },
  ],
  "Nejc": [
    { ticker: "IBIT", allocation: 30000 },
    { ticker: "TQQQ", allocation: 20000 },
    { ticker: "GOOGL", allocation: 10000 },
    { ticker: "IREN", allocation: 10000 },
    { ticker: "TMC", allocation: 10000 },
    { ticker: "LIT", allocation: 10000 },
    { ticker: "ASTS", allocation: 10000 },
  ],
  "Filip": [
    { ticker: "AMD", allocation: 12000 },
    { ticker: "NVO", allocation: 8000 },
    { ticker: "IONQ", allocation: 8000 },
    { ticker: "RGTI", allocation: 6000 },
    { ticker: "GOOGL", allocation: 12000 },
    { ticker: "CRWD", allocation: 12000 },
    { ticker: "NVDA", allocation: 20000 },
    { ticker: "NEE", allocation: 6000 },
    { ticker: "LMT", allocation: 6000 },
    { ticker: "OXY", allocation: 10000 },
  ],
  "Matus": [
    { ticker: "NVO", allocation: 50000 },
    { ticker: "DSDVY", allocation: 25000 },
    { ticker: "URNU", allocation: 25000 },
  ],
  "Nil": [
    { ticker: "NVO", allocation: 15000 },
    { ticker: "RDW", allocation: 10000 },
    { ticker: "GOOG", allocation: 10000 },
    { ticker: "SMCI", allocation: 10000 },
    { ticker: "LLY", allocation: 5000 },
    { ticker: "RKLB", allocation: 10000 },
    { ticker: "GOLD", allocation: 10000 },
    { ticker: "MSTR", allocation: 10000 },
    { ticker: "MS", allocation: 10000 },
    { ticker: "C", allocation: 10000 },
  ],
  "Robbie": [
    { ticker: "AMZN", allocation: 16000 },
    { ticker: "MSFT", allocation: 14000 },
    { ticker: "PLTR", allocation: 12000 },
    { ticker: "UBER", allocation: 11000 },
    { ticker: "NOW", allocation: 10000 },
    { ticker: "VEEV", allocation: 9000 },
    { ticker: "AVGO", allocation: 9000 },
    { ticker: "RDDT", allocation: 8000 },
    { ticker: "XOM", allocation: 6000 },
    { ticker: "LMT", allocation: 5000 },
  ],
};

const INACTIVE = ["Jan Wilske", "Christiane", "Daniel"];

function getAllTickers() {
  const s = new Set();
  Object.values(PLAYERS_DATA).forEach(picks => picks.forEach(p => s.add(p.ticker)));
  return [...s];
}

function fmt(n) { return "$" + Math.round(n).toLocaleString(); }
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
  const [buyPrices, setBuyPrices] = useState(BUY_PRICES);
  const [livePrices, setLivePrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const hasFetched = useRef(false);

  const fetchQuote = useCallback(async (ticker) => {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${API_KEY}`);
    if (!res.ok) return null;
    const data = await res.json();
    return (data.c && data.c > 0) ? data.c : null;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const tickers = getAllTickers();
    const lp = {};
    for (let i = 0; i < tickers.length; i++) {
      const t = tickers[i];
      setStage(`Live prices: ${i + 1}/${tickers.length} (${t})`);
      try {
        const price = await fetchQuote(t);
        if (price) lp[t] = price;
      } catch {}
      await delay(130);
    }
    setLivePrices(lp);
    setLastUpdate(new Date());
    setLoading(false);
    setStage("");
  }, [fetchQuote]);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      loadData();
    }
  }, [loadData]);

  const refreshLive = useCallback(async () => {
    setLoading(true);
    const tickers = getAllTickers();
    const lp = {};
    for (let i = 0; i < tickers.length; i++) {
      const t = tickers[i];
      setStage(`Refreshing: ${i + 1}/${tickers.length} (${t})`);
      try {
        const price = await fetchQuote(t);
        if (price) lp[t] = price;
      } catch {}
      await delay(130);
    }
    setLivePrices(prev => ({ ...prev, ...lp }));
    setLastUpdate(new Date());
    setLoading(false);
    setStage("");
  }, [fetchQuote]);

  const hasPrices = Object.keys(livePrices).length > 0 && Object.keys(buyPrices).length > 0;

  const leaderboard = Object.entries(PLAYERS_DATA)
    .map(([name, picks]) => ({ name, ...computePortfolio(picks, buyPrices, livePrices) }))
    .sort((a, b) => b.portfolioValue - a.portfolioValue);

  const selectedData = selectedPlayer && PLAYERS_DATA[selectedPlayer]
    ? computePortfolio(PLAYERS_DATA[selectedPlayer], buyPrices, livePrices)
    : null;

  return (
    <div style={{ background: "#FAFAF8", minHeight: "100vh", fontFamily: "'Instrument Serif', Georgia, serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />

      {/* Nav */}
      <nav style={{
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
          {lastUpdate && (
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "12px", color: "#999" }}>
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <button onClick={refreshLive} disabled={loading} style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: "13px", fontWeight: 500,
            background: loading ? "#F0EFEB" : "#1A1A1A", color: loading ? "#999" : "#fff",
            border: "none", borderRadius: "8px", padding: "8px 18px",
            cursor: loading ? "default" : "pointer",
          }}>
            {loading ? stage || "Loading..." : "Refresh prices"}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: "80px 40px 60px", maxWidth: "900px", margin: "0 auto" }}>
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

      {/* Leaderboard */}
      <section style={{ maxWidth: "900px", margin: "0 auto", padding: "0 40px 60px" }}>
        <div style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: "11px", fontWeight: 600,
          letterSpacing: "1.5px", color: "#bbb", textTransform: "uppercase", marginBottom: "20px",
        }}>Leaderboard</div>

        <div style={{ borderTop: "1px solid #E8E6E1" }}>
          {leaderboard.map((player, i) => {
            const isSelected = selectedPlayer === player.name;
            const ret = player.ret;
            return (
              <div key={player.name}
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
                  <span style={{
                    fontFamily: "'DM Sans', sans-serif", fontSize: "12px", color: "#bbb", marginLeft: "12px",
                  }}>
                    {player.rows.length} picks
                  </span>
                </div>
                <span style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: "14px", fontWeight: 500,
                  color: ret > 0 ? "#16a34a" : ret < 0 ? "#dc2626" : "#999",
                  minWidth: "70px", textAlign: "right",
                }}>{hasPrices ? fmtPct(ret) : "—"}</span>
                <span style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: "15px", fontWeight: 600,
                  color: "#1A1A1A", minWidth: "100px", textAlign: "right",
                }}>{hasPrices ? fmt(player.portfolioValue) : "—"}</span>
              </div>
            );
          })}
        </div>
        <div style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: "12px", color: "#bbb", marginTop: "16px",
        }}>{INACTIVE.join(", ")} haven't entered their picks yet.</div>
      </section>

      {/* Player Detail */}
      {selectedData && (
        <section style={{ maxWidth: "900px", margin: "0 auto", padding: "0 40px 80px" }}>
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

          <div style={{
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
                  {["Ticker", "Allocation", "Buy price", "Shares", "Live price", "Value", "P/L"].map((h, i) => (
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
      {!selectedPlayer && hasPrices && !loading && (
        <section style={{ maxWidth: "900px", margin: "0 auto", padding: "0 40px 80px" }}>
          <div style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: "11px", fontWeight: 600,
            letterSpacing: "1.5px", color: "#bbb", textTransform: "uppercase", marginBottom: "8px",
          }}>All holdings</div>
          <h2 style={{ fontSize: "36px", fontWeight: 400, color: "#1A1A1A", margin: "0 0 32px" }}>
            {getAllTickers().filter(t => livePrices[t] && buyPrices[t]).length} stocks tracked.
          </h2>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "1px", background: "#E8E6E1", borderRadius: "12px", overflow: "hidden",
          }}>
            {getAllTickers()
              .filter(t => livePrices[t] && buyPrices[t])
              .sort((a, b) =>
                ((livePrices[b] - buyPrices[b]) / buyPrices[b]) - ((livePrices[a] - buyPrices[a]) / buyPrices[a])
              )
              .map(ticker => {
                const owners = [];
                Object.entries(PLAYERS_DATA).forEach(([name, picks]) => {
                  if (picks.find(x => x.ticker === ticker)) owners.push(name);
                });
                const ret = (livePrices[ticker] - buyPrices[ticker]) / buyPrices[ticker];
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
                      <span style={{ color: "#666", fontWeight: 500 }}>{fmtPrice(livePrices[ticker])}</span>
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

      <footer style={{ borderTop: "1px solid #E8E6E1", padding: "32px 40px", maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Sans', sans-serif", fontSize: "12px", color: "#ccc", flexWrap: "wrap", gap: "8px" }}>
          <span>Portfolio Royale</span>
          <span>Prices via Finnhub · Buy-in: Jan 2, 2026 close</span>
        </div>
      </footer>
    </div>
  );
}
