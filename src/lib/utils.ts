export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function formatMoney(amountMinor: number, currency: string) {
  // Integer minor units in, no float arithmetic on money: only the display divides. Whole amounts show no decimals
  // (₦5,000, $5); others show two ($4.99).
  const whole = amountMinor % 100 === 0;
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : currency === "GBP" ? "en-GB" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amountMinor / 100);
}

/** Only allow same-site relative redirects. */
export function safeNext(value: FormDataEntryValue | string | null | undefined, fallback = "/dashboard") {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : fallback;
}
