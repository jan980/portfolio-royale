import { useEffect, useState } from "react";
import { START_DATE, getAllTickers } from "./data/portfolios.js";
import { validateHistory } from "./lib/history.js";

// The public data file updates independently of Vercel deployments. The bundled
// copy keeps the chart available if GitHub or the upstream price provider fails.
const remoteUrl = import.meta.env.VITE_HISTORY_URL || "https://raw.githubusercontent.com/jan980/portfolio-royale/main/public/data/market-history.json";

async function readSnapshot(url, signal) {
  const response = await fetch(url, { signal, cache: "no-cache" });
  if (!response.ok) throw new Error(`History request failed (${response.status})`);
  return validateHistory(await response.json(), getAllTickers(), START_DATE);
}

export default function useMarketHistory() {
  const [state, setState] = useState({ history: null, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let active = true;
    let loaded = false;
    setState((previous) => ({ ...previous, error: null }));
    const accept = (history) => {
      loaded = true;
      if (!active) return;
      setState((previous) => {
        if (previous.history && (previous.history.endDate > history.endDate ||
          (previous.history.endDate === history.endDate && previous.history.generatedAt > history.generatedAt))) return previous;
        return { history, error: null };
      });
    };
    // Read both independently; an unavailable remote never delays the local copy.
    const urls = [`${import.meta.env.BASE_URL}data/market-history.json`];
    if (import.meta.env.PROD || import.meta.env.VITE_HISTORY_URL) urls.push(remoteUrl);
    Promise.allSettled(urls.map((url) => readSnapshot(url, controller.signal).then(accept))).then(() => {
      clearTimeout(timeout);
      if (active && !loaded) setState((previous) => ({ ...previous, error: "Daily history could not be loaded. Please try again." }));
    });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [attempt]);
  return { ...state, retry: () => setAttempt((value) => value + 1) };
}
