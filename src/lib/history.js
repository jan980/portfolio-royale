const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
});

export function marketDate(value) {
  return dateFormatter.format(new Date(value));
}

// Wait until 18:00 New York time before including today's regular-session bar.
// This also handles US/European daylight-saving changes without a fixed offset.
export function latestEligibleDate(now = new Date()) {
  const date = marketDate(now);
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour: "numeric", hourCycle: "h23",
  }).format(now));
  if (hour >= 18) return date;
  const yesterday = new Date(`${date}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return yesterday.toISOString().slice(0, 10);
}

export function normalizeInstrument(result, startDate, cutoff, recordedBuyPrice) {
  if (result.meta.currency !== "USD") throw new Error(`Unexpected currency: ${result.meta.currency}`);
  const prices = result.quotes
    .map((quote) => [marketDate(quote.date), quote.close])
    .filter(([date, close]) => date >= startDate && date <= cutoff && Number.isFinite(close) && close > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  if (!prices.length || prices[0][0] !== startDate) throw new Error(`Missing ${startDate} closing price`);
  const splits = (result.events?.splits ?? [])
    .map((split) => ({ date: marketDate(split.date), numerator: split.numerator, denominator: split.denominator }))
    .filter((split) => split.date > startDate);
  if (splits.some((split) => !(split.numerator > 0 && split.denominator > 0))) throw new Error("Invalid split event");
  // Yahoo's Close is already split-adjusted. Do not apply split events again to
  // daily returns; they are retained for entry-price validation and audit only.
  const splitFactor = splits.reduce((factor, split) => factor * split.numerator / split.denominator, 1);
  const adjustedRecordedBuyPrice = recordedBuyPrice / splitFactor;
  return {
    symbol: result.meta.symbol,
    name: result.meta.longName || result.meta.shortName || result.meta.symbol,
    currency: result.meta.currency,
    prices,
    splits,
    recordedBuyPrice,
    adjustedRecordedBuyPrice,
    startPriceDifferencePct: (prices[0][1] / adjustedRecordedBuyPrice - 1) * 100,
  };
}

export function validateHistory(history, tickers, startDate) {
  if (history?.schemaVersion !== 1 || history.startDate !== startDate) throw new Error("Unsupported history snapshot");
  if (!Array.isArray(history.dates) || !history.dates.length || history.dates[0] !== startDate) throw new Error("Missing start date");
  const dates = history.dates;
  if (dates.some((date, index) => !/^\d{4}-\d{2}-\d{2}$/.test(date) || (index > 0 && date <= dates[index - 1]))) {
    throw new Error("History dates must be unique and ascending");
  }
  if (history.endDate !== dates.at(-1)) throw new Error("Invalid end date");
  for (const ticker of tickers) {
    const instrument = history.instruments?.[ticker];
    if (instrument?.symbol !== ticker || instrument.currency !== "USD") throw new Error(`Invalid instrument: ${ticker}`);
    if (instrument.prices?.length !== dates.length || instrument.prices.some(([date, close], index) => date !== dates[index] || !Number.isFinite(close) || close <= 0)) {
      throw new Error(`Incomplete or invalid daily prices for ${ticker}; snapshot unchanged`);
    }
  }
  return history;
}

export function portfolioSeries(history, players, budget) {
  return history.dates.map((date, index) => {
    const values = {};
    for (const [name, picks] of Object.entries(players)) {
      const cash = budget - picks.reduce((sum, pick) => sum + pick.allocation, 0);
      const value = cash + picks.reduce((sum, pick) => {
        const prices = history.instruments[pick.ticker].prices;
        return sum + pick.allocation * prices[index][1] / prices[0][1];
      }, 0);
      values[name] = { value, returnPct: (value / budget - 1) * 100 };
    }
    return { date, values };
  });

}

export function historyPrices(history, index = history.dates.length - 1) {
  return Object.fromEntries(Object.entries(history.instruments).map(([ticker, instrument]) => [ticker, instrument.prices[index][1]]));
}
