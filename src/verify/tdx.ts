import { createHash } from "node:crypto";
import dcap from "@phala/dcap-qvl-node";

/**
 * Where collateral (TCB info, CRLs, QE identity) is downloaded from. Every piece is signed by Intel and the verifier
 * checks those signatures up to Intel's root CA, so a mirror can't forge it: Intel PCS first, Phala's PCCS mirror if
 * Intel is unavailable.
 */
const COLLATERAL_SOURCES = ["https://api.trustedservices.intel.com/tdx/certification/v4", "https://pccs.phala.network/tdx/certification/v4"];

export interface TdxResult {
  status: string;
  advisories: string[];
  reportData: string;
  rtmr: [string, string, string, string];
  mrConfigId: string;
  debug: boolean;
}

/** Verify a TDX quote against Intel PCS collateral. Throws on an invalid signature chain. */
export async function verifyTdxQuote(quoteHex: string): Promise<TdxResult> {
  const quote = Buffer.from(quoteHex, "hex");
  let collateral: unknown = null;
  let lastErr: unknown;
  for (const src of COLLATERAL_SOURCES)
    for (let attempt = 0; attempt < 2 && !collateral; attempt++) {
      try {
        collateral = await dcap.js_get_collateral(src, quote);
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  if (!collateral) throw new Error(`TDX collateral unavailable: ${String(lastErr)}`);
  const res = dcap.js_verify(quote, collateral, BigInt(Math.floor(Date.now() / 1000))) as {
    status: string;
    advisory_ids: string[];
    report: { TD10?: Record<string, string>; TD15?: Record<string, string> };
  };
  const td = res.report.TD10 ?? res.report.TD15;
  if (!td) throw new Error("not a TD report");
  // TD attributes: bit 0 of the first byte is DEBUG.
  const debug = (parseInt(td.td_attributes.slice(0, 2), 16) & 1) === 1;
  return {
    status: res.status,
    advisories: res.advisory_ids,
    reportData: td.report_data,
    rtmr: [td.rt_mr0, td.rt_mr1, td.rt_mr2, td.rt_mr3],
    mrConfigId: td.mr_config_id,
    debug,
  };
}

/**
 * A dstack runtime event's digest: SHA-384(event_type as u32 LE ‖ ":" ‖ event ‖ ":" ‖ payload). Newer dstack event logs
 * omit the digest field, so it's computed from the event itself (which also means a log can't carry a digest that
 * disagrees with its own content).
 */
function runtimeDigest(e: { event_type?: number; event?: string; event_payload?: string }): Buffer {
  const type = Buffer.alloc(4);
  type.writeUInt32LE((e.event_type ?? 0) >>> 0);
  return createHash("sha384")
    .update(Buffer.concat([type, Buffer.from(":"), Buffer.from(e.event ?? ""), Buffer.from(":"), Buffer.from(e.event_payload ?? "", "hex")]))
    .digest();
}

/** Replay the dstack event log into RTMR3 and pull out the named events (compose-hash, os-image-hash, …). */
export function replayRtmr3(eventLog: { imr: number; digest: string; event_type?: number; event?: string; event_payload?: string }[]) {
  let r = Buffer.alloc(48);
  const events: Record<string, string> = {};
  for (const e of eventLog.filter((x) => x.imr === 3)) {
    const d = e.digest ? Buffer.from(e.digest, "hex") : runtimeDigest(e);
    if (e.digest && e.event && !runtimeDigest(e).equals(d)) throw new Error(`event ${e.event}: digest does not match its content`);
    r = createHash("sha384").update(Buffer.concat([r, d])).digest();
    if (e.event) events[e.event] = e.event_payload ?? "";
  }
  return { rtmr3: r.toString("hex"), events };
}

export const sha256Hex = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
