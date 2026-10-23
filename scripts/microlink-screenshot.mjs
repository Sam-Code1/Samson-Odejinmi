// Takes a PNG screenshot with Microlink (https://microlink.io) and saves it locally.
// Server-side only: the API key comes from MICROLINK_API_KEY and is sent by the SDK as the x-api-key header.
//
//   node --env-file=.env.local scripts/microlink-screenshot.mjs [url] [output.png]
//
// Each run is one request against the Microlink plan.
import { writeFile } from "node:fs/promises";
import createClient, { MicrolinkError } from "microlink.io";

const target = process.argv[2] ?? "https://github.com/";
const out = process.argv[3] ?? "microlink-screenshot.png";

if (!process.env.MICROLINK_API_KEY) {
  console.error("MICROLINK_API_KEY is not set. Add it to .env.local (it's git-ignored).");
  process.exit(1);
}

const microlink = createClient({ apiKey: process.env.MICROLINK_API_KEY });

try {
  const shot = await microlink.screenshot(target, { type: "png" });
  const res = await fetch(shot.url);
  if (!res.ok) throw new Error(`Downloading the screenshot failed (${res.status})`);
  await writeFile(out, Buffer.from(await res.arrayBuffer()));
  const r = microlink.last?.response;
  console.log({
    url: shot.url, type: shot.type, width: shot.width, height: shot.height, size: shot.size_pretty ?? shot.size,
    savedTo: out, requestId: r?.headers?.get?.("x-request-id") ?? r?.headers?.["x-request-id"], plan: r?.headers?.get?.("x-pricing-plan") ?? r?.headers?.["x-pricing-plan"],
  });
} catch (error) {
  if (error instanceof MicrolinkError) {
    const h = (k) => error.headers?.get?.(k) ?? error.headers?.[k];
    const reset = Number(h("x-rate-limit-reset"));
    console.error("Microlink error:", error.code ?? (error.statusCode === 429 ? "ERATE" : "unknown"), error.statusCode, error.description ?? error.message);
    console.error({
      plan: h("x-pricing-plan"), limit: h("x-rate-limit-limit"), remaining: h("x-rate-limit-remaining"),
      resetsAt: reset ? new Date(reset * 1000).toISOString() : undefined, requestId: h("x-request-id"),
    });
  } else {
    console.error(error);
  }
  process.exit(1);
}
