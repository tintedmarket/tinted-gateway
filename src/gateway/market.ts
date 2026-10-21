import type { Listing, Provider } from "../providers/index.ts";
import { redpillProvider } from "../providers/redpill.ts";
import { tinfoilProvider } from "../providers/tinfoil.ts";
import type { Verification } from "../verify/types.ts";

/** The market: every provider's listings, their verification (cached), and our price. */
export const MARGIN = () => Number(process.env.TINTED_MARGIN ?? 0.15);
// Just under the 10-minute sweep, so every sweep re-verifies instead of finding a cache entry seconds from expiry.
const VERIFY_TTL_MS = 9 * 60_000;
const LISTINGS_TTL_MS = 30 * 60_000;

let providers: Provider[] | null = null;
export function getProviders(): Provider[] {
  if (!providers) {
    providers = [];
    if (process.env.TINFOIL_API_KEY) providers.push(tinfoilProvider(process.env.TINFOIL_API_KEY));
    if (process.env.REDPILL_API_KEY) providers.push(redpillProvider(process.env.REDPILL_API_KEY));
  }
  return providers;
}

let listingsCache: { at: number; list: Listing[] } | null = null;
export async function listings(): Promise<Listing[]> {
  if (!listingsCache || Date.now() - listingsCache.at > LISTINGS_TTL_MS) {
    const all = await Promise.all(getProviders().map((p) => p.listings().catch(() => [] as Listing[])));
    listingsCache = { at: Date.now(), list: all.flat() };
  }
  return listingsCache.list;
}

export async function findListing(id: string) {
  const l = (await listings()).find((x) => x.id === id);
  const p = l && getProviders().find((x) => x.id === l.provider);
  return l && p ? { listing: l, provider: p } : null;
}

const verifyCache = new Map<string, { at: number; v: Promise<Verification> }>();
/** Cached verification of one listing; concurrent callers share one in-flight check. */
export function verificationFor(listing: Listing, provider: Provider): Promise<Verification> {
  const hit = verifyCache.get(listing.id);
  if (hit && Date.now() - hit.at < VERIFY_TTL_MS) return hit.v;
  const v = provider.verify(listing.model);
  verifyCache.set(listing.id, { at: Date.now(), v });
  v.catch(() => verifyCache.delete(listing.id));
  return v;
}
export function cachedVerification(id: string) {
  return verifyCache.get(id);
}

/** Our price in micro-USD for a usage: provider price + margin. */
export function costMicros(l: Listing, usage: { input: number; output: number }) {
  return Math.ceil((usage.input * l.inputPerM + usage.output * l.outputPerM) * (1 + MARGIN()));
}
