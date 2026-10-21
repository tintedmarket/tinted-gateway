import { lazy, Suspense, useEffect, useState } from "react";
import { Home } from "./pages/Home";
import { Market } from "./pages/Market";
import { Chat } from "./pages/Chat";
import { Account } from "./pages/Account";
import { Verify } from "./pages/Verify";
import { Docs } from "./pages/Docs";
// The ZK prover is heavy: load it only on the credits page.
const Credits = lazy(() => import("./pages/Credits").then((m) => ({ default: m.Credits })));

const ROUTES = { home: "Home", market: "Market", chat: "Chat", credits: "Anonymous", verify: "Verify", docs: "Docs", account: "Account" } as const;
type Route = keyof typeof ROUTES;
const NAV: Route[] = ["market", "chat", "credits", "verify", "docs"];

function parse(): { route: Route; arg: string } {
  const [r, ...rest] = location.hash.replace(/^#\/?/, "").split("/");
  return { route: (r in ROUTES ? r : "home") as Route, arg: decodeURIComponent(rest.join("/")) };
}
export const go = (route: Route, arg = "") => (location.hash = `/${route}${arg ? "/" + encodeURIComponent(arg) : ""}`);

function Logo() {
  return (
    <a href="#/" className="flex items-center gap-2">
      <svg viewBox="0 0 24 24" className="size-6">
        <path d="M4 8 L12 4 L20 8 L20 16 L12 20 L4 16 Z" fill="none" stroke="#7fd1b9" strokeWidth="1.3" />
        <path d="M4 8 L12 12 L20 8 M12 12 L12 20" stroke="#7fd1b9" strokeWidth="1.3" fill="none" opacity=".55" />
        <path d="M12 4 L20 8 L12 12 L4 8 Z" fill="#7fd1b9" opacity=".25" />
      </svg>
      <span className="text-[17px] font-semibold tracking-[-0.02em]">tinted</span>
      <span className="font-mono text-[11px] text-ink-3">.market</span>
    </a>
  );
}

const FOOTER: [string, [string, string][]][] = [
  ["Product", [["Market", "#/market"], ["Private chat", "#/chat"], ["Anonymous credits", "#/credits"], ["Account", "#/account"]]],
  ["Developers", [["Docs", "#/docs"], ["llms.txt", "/llms.txt"], ["Models API", "https://api.tinted.market/v1/models"], ["Source", "https://github.com/tintedmarket/tinted-gateway"]]],
  ["Trust", [["Verify the gateway", "#/verify"], ["TLS evidence", "https://api.tinted.market/evidences/"], ["ZK setup", "https://github.com/tintedmarket/tinted-gateway/tree/main/zk"], ["Attestation", "https://api.tinted.market/attestation"]]],
];

export function App() {
  const [{ route, arg }, set] = useState(parse);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => {
      set(parse());
      setOpen(false);
      window.scrollTo(0, 0);
    };
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);

  return (
    <div className="min-h-screen overflow-x-clip">
      <nav className="sticky top-3 z-30 mx-auto mt-3 max-w-6xl px-3">
        <div className="flex items-center gap-4 rounded-2xl border border-edge bg-night/75 px-4 py-2.5 shadow-[0_10px_40px_-12px_rgba(0,0,0,.8)] backdrop-blur-xl">
          <Logo />
          <div className="ml-6 hidden gap-1 text-sm md:flex">
            {NAV.map((r) => (
              <a key={r} href={`#/${r}`} className={`rounded-lg px-3 py-1.5 transition ${r === route ? "bg-pane-2 text-ink" : "text-ink-3 hover:text-ink"}`}>
                {ROUTES[r]}
              </a>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <a href="#/account" className="hidden rounded-lg border border-edge px-3 py-1.5 text-sm text-ink-2 hover:text-ink sm:block">
              Account
            </a>
            <a href="#/chat" className="rounded-lg bg-proof px-3.5 py-1.5 text-sm font-medium text-night hover:brightness-110">
              Open chat
            </a>
            <button onClick={() => setOpen(!open)} className="grid size-9 place-items-center rounded-lg border border-edge md:hidden" aria-label="Menu">
              <span className="font-mono text-ink-2">{open ? "×" : "≡"}</span>
            </button>
          </div>
        </div>
        {open && (
          <div className="mt-2 grid gap-1 rounded-2xl border border-edge bg-night/95 p-2 backdrop-blur-xl md:hidden">
            {[...NAV, "account" as Route].map((r) => (
              <a key={r} href={`#/${r}`} className="rounded-lg px-3 py-2 text-ink-2 hover:bg-pane-2">
                {ROUTES[r]}
              </a>
            ))}
          </div>
        )}
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-10">
        {route === "home" && <Home />}
        {route === "market" && <Market />}
        {route === "chat" && <Chat initialModel={arg} />}
        {route === "account" && <Account />}
        {route === "verify" && <Verify initialId={arg} />}
        {route === "docs" && <Docs />}
        {route === "credits" && (
          <Suspense fallback={<div className="text-sm text-ink-3">Loading the prover…</div>}>
            <Credits />
          </Suspense>
        )}
      </main>

      <footer className="border-t border-edge">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-ink-3">The Private Inference Market. Confidential models, proved on every call, paid on Solana.</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-edge px-3 py-1 font-mono text-[11px] text-ink-3">
              <span className="size-1.5 animate-pulse rounded-full bg-proof" /> gateway attested
            </div>
          </div>
          {FOOTER.map(([title, links]) => (
            <div key={title}>
              <div className="font-mono text-[11px] tracking-[0.18em] text-ink-3 uppercase">{title}</div>
              <div className="mt-4 grid gap-2.5 text-sm">
                {links.map(([l, h]) => (
                  <a key={l} href={h} className="text-ink-2 hover:text-proof">
                    {l}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 border-t border-edge px-4 py-5 font-mono text-[11px] text-ink-3">
          <span>© {new Date().getFullYear()} Tinted</span>
          <span>Don't trust. Verify.</span>
        </div>
      </footer>
    </div>
  );
}
