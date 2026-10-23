import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { historyPrices, latestEligibleDate, marketDate, normalizeInstrument, portfolioSeries, validateHistory } from "../src/lib/history.js";
import { BUDGET, PLAYERS_DATA, START_DATE, getAllTickers } from "../src/data/portfolios.js";

test("a split does not manufacture a loss, and dividend-adjusted prices are not used", () => {
  const instrument = normalizeInstrument({
    meta: { symbol: "TEST", currency: "USD", longName: "Test company" },
    quotes: [
      { date: "2026-01-02T14:30:00Z", close: 50, adjclose: 45 },
      { date: "2026-01-05T14:30:00Z", close: 50, adjclose: 50 },
      { date: "2026-01-06T14:30:00Z", close: 55, adjclose: 55 },
    ],
    events: { splits: [{ date: "2026-01-05T14:30:00Z", numerator: 2, denominator: 1 }] },
  }, START_DATE, "2026-01-06", 100);
  assert.equal(instrument.adjustedRecordedBuyPrice, 50);
  assert.equal(instrument.startPriceDifferencePct, 0);
  const series = portfolioSeries({ dates: instrument.prices.map(([date]) => date), instruments: { TEST: instrument } }, { Alice: [{ ticker: "TEST", allocation: 100000 }] }, 100000);
  assert.equal(series[0].values.Alice.value, 100000);
  assert.equal(series[1].values.Alice.value, 100000);
  assert.equal(series[2].values.Alice.value, 110000);
  assert.ok(Math.abs(series[2].values.Alice.returnPct - 10) < 1e-10);
});

test("original weights and uninvested cash are preserved without daily rebalancing", () => {
  const history = { dates: [START_DATE, "2026-01-05"], instruments: {
    A: { prices: [[START_DATE, 10], ["2026-01-05", 20]] },
    B: { prices: [[START_DATE, 20], ["2026-01-05", 10]] },
  } };
  const series = portfolioSeries(history, { Alice: [{ ticker: "A", allocation: 60000 }, { ticker: "B", allocation: 30000 }] }, 100000);
  // 6,000 A shares * $20 + 1,500 B shares * $10 + $10,000 cash.
  assert.equal(series[1].values.Alice.value, 145000);
  assert.ok(Math.abs(series[1].values.Alice.returnPct - 45) < 1e-10);
});

test("end-of-day cutoff follows New York time including daylight saving", () => {
  assert.equal(latestEligibleDate(new Date("2026-01-06T22:59:00Z")), "2026-01-05");
  assert.equal(latestEligibleDate(new Date("2026-01-06T23:00:00Z")), "2026-01-06");
  assert.equal(latestEligibleDate(new Date("2026-10-23T21:59:00Z")), "2026-10-22");
  assert.equal(latestEligibleDate(new Date("2026-10-23T22:00:00Z")), "2026-10-23");
  assert.equal(marketDate("2026-01-03T01:00:00Z"), "2026-01-02");
});

test("invalid closes and unfinished sessions are excluded, missing start is rejected", () => {
  const response = {
    meta: { symbol: "TEST", currency: "USD" },
    quotes: [
      { date: "2026-01-02T14:30:00Z", close: 10 },
      { date: "2026-01-05T14:30:00Z", close: null },
      { date: "2026-01-06T14:30:00Z", close: 15 },
    ],
  };
  assert.deepEqual(normalizeInstrument(response, START_DATE, "2026-01-05", 10).prices, [[START_DATE, 10]]);
  assert.throws(() => normalizeInstrument({ ...response, quotes: response.quotes.slice(1) }, START_DATE, "2026-01-06", 10), /Missing/);
  assert.throws(() => normalizeInstrument({ ...response, meta: { currency: "EUR" } }, START_DATE, "2026-01-06", 10), /currency/);
});

const snapshot = JSON.parse(await readFile(new URL("../public/data/market-history.json", import.meta.url), "utf8"));

test("saved history covers every required holding on every trading date", () => {
  validateHistory(snapshot, getAllTickers(), START_DATE);
  assert.equal(Object.keys(snapshot.instruments).length, 42);
  assert.ok(snapshot.dates.length >= 2);
  assert.ok(snapshot.endDate <= latestEligibleDate());
  const series = portfolioSeries(snapshot, PLAYERS_DATA, BUDGET);
  for (const name of Object.keys(PLAYERS_DATA)) {
    assert.ok(Math.abs(series[0].values[name].value - BUDGET) < 1e-8);
    assert.ok(series.every((point) => Number.isFinite(point.values[name].value) && point.values[name].value > 0));
  }
  assert.equal(snapshot.instruments.GOLD.name, "Gold.com, Inc.");
  assert.ok(Math.abs(historyPrices(snapshot, 0).AMD - 223.47) < 0.001);
});

test("an incomplete, duplicate, or corrupt snapshot is rejected", () => {
  const missing = structuredClone(snapshot);
  missing.instruments.AMD.prices.splice(1, 1);
  assert.throws(() => validateHistory(missing, getAllTickers(), START_DATE), /Incomplete/);
  const duplicate = structuredClone(snapshot);
  duplicate.dates[1] = duplicate.dates[0];
  assert.throws(() => validateHistory(duplicate, getAllTickers(), START_DATE), /unique/);
  const corrupt = structuredClone(snapshot);
  corrupt.instruments.AMD.prices[1][1] = 0;
  assert.throws(() => validateHistory(corrupt, getAllTickers(), START_DATE), /Incomplete/);
  const absent = structuredClone(snapshot);
  delete absent.instruments.GOLD;
  assert.throws(() => validateHistory(absent, getAllTickers(), START_DATE), /instrument/);
});
