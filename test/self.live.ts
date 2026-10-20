// Verify the live Tinted gateway like any provider: TDX quote (Intel PCS), receipt key bound in report_data,
// event log replays to RTMR3, compose hash == sha256(app_compose), and the compose pins our GitHub-built image.
import { createHash } from "node:crypto";
import { verifyTdxQuote, replayRtmr3, sha256Hex } from "../src/verify/tdx.ts";
const URL_ = process.argv[2] ?? "https://f5cd74b3a21a2ca3cfbdfb072c61c470e18c9924-8787.dstack-pha-prod5.phala.network";
const a = (await (await fetch(`${URL_}/attestation`)).json()) as { receiptKey: string; quote: string; eventLog: string; appCompose: string };
const tdx = await verifyTdxQuote(a.quote.replace(/^0x/, ""));
console.log("TDX:", tdx.status, "advisories", JSON.stringify(tdx.advisories), "debug", tdx.debug);
const want = createHash("sha256").update(`tinted-receipt-key:${a.receiptKey}`).digest("hex") + "0".repeat(64);
console.log("receipt key bound in report_data:", tdx.reportData.toLowerCase() === want);
const replay = replayRtmr3(JSON.parse(a.eventLog));
console.log("event log replays to RTMR3:", replay.rtmr3 === tdx.rtmr[3].toLowerCase());
const composeHash = sha256Hex(a.appCompose);
console.log("compose hash == sha256(app_compose):", replay.events["compose-hash"] === composeHash);
const compose = JSON.parse(a.appCompose).docker_compose_file as string;
console.log("measured image:", compose.match(/image:\s*(\S+)/)?.[1]);
console.log("os image hash:", replay.events["os-image-hash"]);
