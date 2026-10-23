# Portfolio Royale

Six fixed $100,000 portfolios, entered at the January 2, 2026 close.

## Local development

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
npm test
npm run build
```

The app starts from `public/data/market-history.json`. No Yahoo request or API key is needed to load the chart. Live quotes remain optional through the existing Finnhub integration.

## Daily history

```sh
npm run history:update
```

The downloader uses [yahoo-finance2](https://github.com/gadicc/yahoo-finance2) on the server/command line, never in the browser. It fetches the 42 unique symbols once each, serially with pacing and bounded retries, then saves the full dataset atomically. It excludes today's bar until 18:00 America/New_York. It validates the common trading calendar, currency, symbol, and positive prices for every holding. A failed symbol, missing trading date, or regressing end date rejects the entire refresh and preserves the saved snapshot.

The complete window is fetched again on updates because Yahoo's historical Close series is split-adjusted. Appending new-basis prices to an old-basis cache after a split would corrupt returns. There are only about 10,000 prices for the current competition. Existing history remains available during upstream outages. Yahoo is unofficial and may rate-limit or change its endpoints; the library's code license does not license redistribution of the underlying data.

`Refresh daily portfolio history` runs on weekdays at 23:37 UTC and supports manual dispatch. The workflow becomes scheduled when present on `main`. It commits only a complete, tested data snapshot. No paid market-data API or new secret is required. Branch protection must allow this bot's data commits; otherwise use a reviewed data PR or another permitted storage path. GitHub may delay scheduled runs and disable schedules on inactive public repositories after 60 days; check the Actions page if updates stop. Data freshness is visible in the app.

Production loads the bundled snapshot immediately and also checks the public snapshot on GitHub's `main` branch. This permits daily data updates even when a bot commit does not trigger a Vercel deployment. A failed/older remote response cannot replace newer cached data. Before this feature reaches `main`, previews use their bundled snapshot. `VITE_HISTORY_URL` can override the remote JSON URL; local development uses only the bundled snapshot unless this variable is set.

## Calculation rules

- Original allocations and uninvested cash are preserved; there is no daily rebalancing.
- `value(t) = cash + sum(allocation * close(t) / close(start))`.
- `return(t) = value(t) / 100000 - 1`.
- Close uses Yahoo's split-adjusted, dividend-unadjusted values. Do not use `adjclose` or apply split events to the ratio again.
- The verified start close is used for both historical charts and the daily/live leaderboard. Original hardcoded entries are retained in `src/data/portfolios.js` and the dataset for audit. Some were different from January 2's verified closes (notably NVO); using verified prices corrects the previous scores.
- All portfolios start at exactly $100,000 and 0%. Cash dividends, reinvestment, fees, taxes, and deposits/withdrawals are outside these competition rules.
- Live mode is explicitly separate from historical closes. Missing or old live quotes use the saved close and the UI reports the fallback count. The daily chart never appends an intraday quote.
- `GOLD` means **Gold.com, Inc.**, confirmed by the user. Preserve that identity.

Tests cover split handling, dividend exclusion, allocation weights/cash, New York daylight-saving cutoffs, incomplete-data rejection, and the saved dataset's coverage and starting values.

## Deployment

This remains the existing Vite app on Vercel. Use `npm run build`, output directory `dist`, and Node.js 22+. No new backend or paid service is needed. Merge the feature branch to publish through the existing Git integration and enable the daily workflow. Keep Yahoo's data-use terms in mind before expanding beyond the current personal portfolio competition.
