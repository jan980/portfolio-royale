import { useState, useMemo, useCallback, useRef } from "react";
import PerformanceChart from "./PerformanceChart.jsx";
import { PLAYER_COLORS, money, percent, signedMoney, price, displayDate } from "./lib/presentation.js";
import "./history.css";
import useMarketHistory from "./useMarketHistory.js";
import { historyPrices } from "./lib/history.js";
import { BUDGET, BUY_PRICES, PLAYERS_DATA, INACTIVE, getAllTickers } from "./data/portfolios.js";

const API_KEY = "d7l12fpr01qm7o0a47o0d7l12fpr01qm7o0a47og";

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
  const [selectedPlayer, setSelectedPlayer] = useState("Jan");
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

  const liveMode = valuationMode === "live";
  const fallbackCount = getAllTickers().length - Object.keys(livePrices).length;
  const leaderboard = Object.entries(PLAYERS_DATA)
    .map(([name, picks]) => ({ name, ...computePortfolio(picks, buyPrices, displayPrices) }))
    .sort((a, b) => b.portfolioValue - a.portfolioValue);
  const selectedData = history ? computePortfolio(PLAYERS_DATA[selectedPlayer], buyPrices, displayPrices) : null;
  const holdings = selectedData?.rows.slice().sort((a, b) => b.pl / b.allocation - a.pl / a.allocation) ?? [];
  const closeDate = history ? displayDate(history.endDate) : "Daily close";
  const asOf = !history ? "Loading daily closes" : !liveMode ? `${closeDate} market close`
    : loading ? "Updating live quotes" : Object.keys(livePrices).length ? "Live · intraday" : `${closeDate} close · saved`;
  const stale = history && Date.now() - Date.parse(`${history.endDate}T21:00:00Z`) > 4 * 86400000;

  return (
    <div className="app-shell">
      <header className="site-header shell">
        <div className="wordmark"><span className="brand-mark" aria-hidden="true" />Portfolio Royale</div>
        <div className="mode-switch" aria-label="Portfolio valuation">
          <button aria-pressed={!liveMode} onClick={() => setValuationMode("close")}>{history ? `${closeDate} close` : "Daily close"}</button>
          <button aria-pressed={liveMode} disabled={!history || loading} onClick={() => { if (lastUpdate) setValuationMode("live"); else refreshLive(); }}><span className="live-dot" aria-hidden="true" />Live</button>
        </div>
      </header>

      <main className="main-content shell">
        <section className="hero">
          <h1>Who's printing tendies and who's bag-holding?</h1>
          <p>6 degenerate apes, $100k each, real yolo picks. Buy-in locked at Jan 2, 2026 close. Diamond hands only. 💎🙌🚀</p>
        </section>

        <section className="leaderboard" aria-labelledby="leaderboard-title">
          <div className="section-heading"><h2 id="leaderboard-title">Leaderboard</h2><span className="as-of">{asOf}</span></div>
          <div className="leaderboard-list">
            {leaderboard.map((player, index) => <button className="leaderboard-row" key={player.name}
              aria-pressed={selectedPlayer === player.name} aria-controls="selected-picks"
              onClick={() => setSelectedPlayer(player.name)}>
              <span className="leaderboard-rank">{index + 1}</span>
              <span className="leaderboard-person"><span className="player-dot" style={{ background: PLAYER_COLORS[player.name] }} /><span className="leaderboard-name">{player.name}</span><span className="pick-count">{player.rows.length} picks</span></span>
              <span className="leaderboard-numbers"><span className="leaderboard-value">{history ? money(player.portfolioValue) : "—"}</span><span className={`leaderboard-return ${player.ret < 0 ? "negative" : "positive"}`}>{history ? percent(player.ret * 100) : "—"}</span></span>
            </button>)}
          </div>
          <p className="inactive-note">{INACTIVE.slice(0, -1).join(", ")} and {INACTIVE.at(-1)} haven't entered their picks yet.</p>
          {!history && <div className="data-status" role="status">{historyError || "Loading daily portfolio history…"}{historyError && <button className="text-button" onClick={retryHistory}>Try again</button>}</div>}
          {history && liveMode && <div className="live-status" role="status">
            <span>{loading ? stage : `${Object.keys(livePrices).length} live quotes · ${fallbackCount} ${fallbackCount === 1 ? "position uses" : "positions use"} the ${closeDate} close. Checked ${lastUpdate?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`}</span>
            <button className="text-button" onClick={refreshLive} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
          </div>}
          {stale && <p className="stale-note" role="status">Showing saved prices from {closeDate}. A newer daily update is not available yet.</p>}
        </section>

        {history && <PerformanceChart history={history} selectedPlayer={selectedPlayer} liveMode={liveMode} />}

        {selectedData && <section className="holdings-section" id="selected-picks" aria-labelledby="picks-title">
          <div className="section-heading"><h2 id="picks-title">{selectedPlayer}'s picks</h2><span className="holdings-summary">{money(selectedData.totalInvested)} invested · {money(selectedData.cash)} cash · {holdings.length} positions</span></div>
          <table className="holdings-table" aria-label={`${selectedPlayer}'s ${liveMode ? "latest" : "closing"} holdings`}>
            <thead><tr><th scope="col">Ticker</th><th scope="col" className="desktop-column">Invested</th><th scope="col" className="desktop-column">Price</th><th scope="col">Value</th><th scope="col">Return</th></tr></thead>
            <tbody>{holdings.map((holding) => <tr key={holding.ticker}>
              <td>{holding.ticker}</td>
              <td className="desktop-column">{money(holding.allocation)}</td>
              <td className="desktop-column">{price(holding.livePrice)}{liveMode && !livePrices[holding.ticker] && <span className="saved-price" title={`Saved ${closeDate} close`} aria-label={`Saved ${closeDate} close`}>*</span>}</td>
              <td>{money(holding.currentValue)}</td>
              <td><span className={`holding-return ${holding.pl < 0 ? "negative" : "positive"}`}><span>{signedMoney(holding.pl)}</span><span>{percent(holding.pl / holding.allocation * 100)}</span></span></td>
            </tr>)}</tbody>
          </table>
          {liveMode && holdings.some((holding) => !livePrices[holding.ticker]) && <p className="chart-context">Saved {closeDate} closes used for {holdings.filter((holding) => !livePrices[holding.ticker]).map((holding) => holding.ticker).join(", ")}.</p>}
        </section>}
      </main>

      <footer className="site-footer shell">
        <div className="footer-line"><span>Portfolio Royale</span><span>Returns since Jan 2 close · Splits adjusted · Dividends excluded · Yahoo Finance / Finnhub</span></div>
        <details className="methodology"><summary>How returns are calculated</summary>
          <p>Each original allocation buys fractional shares at the verified January 2, 2026 close. Daily value is that allocation multiplied by the closing-price ratio, plus any uninvested cash. Stock splits are accounted for; dividends and reinvestment are excluded.</p>
          <p>The chart uses completed trading sessions. In Live mode, the leaderboard and picks use current quotes where available and explicitly identify saved closing prices used as a fallback. Select a player in the leaderboard, then hover, touch, or use arrow keys on their chart to explore history.</p>
          <p>Verified starting prices may differ from the original manually entered entries. Missing historical prices are never replaced with zero or estimated returns.{history && ` Dataset saved ${new Date(history.generatedAt).toLocaleString("en-US")}.`}</p>
        </details>
      </footer>
    </div>
  );
}
