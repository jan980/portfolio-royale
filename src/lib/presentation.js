export const PLAYER_COLORS = {
  Filip: "#3f8f5f", Jan: "#4a6fa5", Robbie: "#6f7a3e",
  Nil: "#c2553f", Nejc: "#b07a2a", Matus: "#9a6aa0",
};
export const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
export function percent(value) {
  const rounded = Math.abs(value) < 0.005 ? 0 : value;
  return `${rounded >= 0 ? "+" : "−"}${Math.abs(rounded).toFixed(2)}%`;
}
export const signedMoney = (value) => `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`;
export const price = (value) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
export const displayDate = (date, options = {}) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
  month: "short", day: "numeric", timeZone: "UTC", ...options,
});
