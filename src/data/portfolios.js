export const START_DATE = "2026-01-02";

export const BUDGET = 100000;

// Jan 2, 2026 closing prices (hardcoded — verify if numbers look off)
export const BUY_PRICES = {
  AMZN: 226.50, META: 649.85, AVGO: 346.89, ANET: 133.60, AMD: 223.47,
  TSM: 318.89,  VRT: 175.57,  SMCI: 30.96,  SOUN: 10.60,  MP: 54.97,
  IBIT: 50.94,  TQQQ: 52.26,  GOOGL: 314.93, GOOG: 315.32, IREN: 42.70,
  TMC: 6.78,   LIT: 66.27,   ASTS: 83.47,  NVO: 50.54,   IONQ: 46.77,
  RGTI: 23.60,  CRWD: 453.58, NVDA: 188.84, NEE: 80.38,   LMT: 494.46,
  OXY: 42.18,  DSDVY: 128.09, RDW: 9.03,   LLY: 1078.56, RKLB: 75.99,
  GOLD: 34.77,  MSTR: 157.16, MS: 180.90,   C: 118.08,    MSFT: 471.86,
  PLTR: 167.86, UBER: 82.86,  NOW: 147.45,  VEEV: 219.49, RDDT: 241.89,
  XOM: 121.84,
  URA: 46.06,
};

export const PLAYERS_DATA = {
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
    { ticker: "URA", allocation: 25000 },
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

export const INACTIVE = ["Jan Wilske", "Christiane", "Daniel"];

export function getAllTickers() {
  const s = new Set();
  Object.values(PLAYERS_DATA).forEach(picks => picks.forEach(p => s.add(p.ticker)));
  return [...s];
}

