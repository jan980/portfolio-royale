import YahooFinance from "yahoo-finance2";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { START_DATE, BUY_PRICES, getAllTickers } from "../src/data/portfolios.js";
import { latestEligibleDate, normalizeInstrument, validateHistory } from "../src/lib/history.js";

const output = fileURLToPath(new URL("../public/data/market-history.json", import.meta.url));
const now = new Date();
const cutoff = latestEligibleDate(now);
const period2 = new Date(`${cutoff}T00:00:00Z`);
period2.setUTCDate(period2.getUTCDate() + 1);
const yahoo = new YahooFinance();
const instruments = {};
const failures = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Re-fetch the small year-to-date window so a new split cannot mix old and new
// price bases. Never replace the last good snapshot with a partial refresh.
for (const ticker of getAllTickers()) {
  let error;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await yahoo.chart(ticker, {
        period1: START_DATE,
        period2,
        interval: "1d",
        events: "div|split",
      });
      instruments[ticker] = normalizeInstrument(result, START_DATE, cutoff, BUY_PRICES[ticker]);
      console.log(`${ticker}: ${instruments[ticker].prices.length} closes (${instruments[ticker].name})`);
      error = null;
      break;
    } catch (caught) {
      error = caught;
      if (attempt < 2) await sleep(2000 * (attempt + 1));
    }
  }
  if (error) failures.push(`${ticker}: ${error.message}`);
  await sleep(300);
}

if (failures.length) throw new Error(`Snapshot unchanged. Failed symbols:\n${failures.join("\n")}`);

const dates = instruments.AMD.prices.map(([date]) => date);
const snapshot = {
  schemaVersion: 1,
  source: "Yahoo Finance via yahoo-finance2",
  methodology: "split-adjusted-close; dividends excluded",
  startDate: START_DATE,
  endDate: dates.at(-1),
  generatedAt: now.toISOString(),
  dates,
  instruments,
};
validateHistory(snapshot, getAllTickers(), START_DATE);

for (const [ticker, instrument] of Object.entries(instruments)) {
  if (Math.abs(instrument.startPriceDifferencePct) > 0.15) {
    console.warn(`${ticker}: recorded entry differs from verified close by ${instrument.startPriceDifferencePct.toFixed(2)}% (after splits).`);
  }
}

let previous;
try { previous = JSON.parse(await readFile(output, "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw error; }
if (previous && previous.endDate > snapshot.endDate) {
  throw new Error(`Snapshot unchanged: new history ends earlier (${snapshot.endDate}) than saved history (${previous.endDate}).`);
}
// Avoid daily no-op commits on holidays and weekends.
if (previous && JSON.stringify({ ...previous, generatedAt: null }) === JSON.stringify({ ...snapshot, generatedAt: null })) {
  console.log(`Already current through ${snapshot.endDate}.`);
} else {
  await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
  await writeFile(`${output}.tmp`, `${JSON.stringify(snapshot)}\n`);
  await rename(`${output}.tmp`, output);
  console.log(`Saved ${dates.length} complete trading days for ${getAllTickers().length} symbols, through ${snapshot.endDate}.`);
}
