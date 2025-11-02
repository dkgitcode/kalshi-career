export function currency(cents?: number | null) {
  return typeof cents === "number" ? `$${(cents / 100).toFixed(2)}` : "—"
}


