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
    <a href="#/" className="flex items-baseline gap-1.5">
      <span className="inline-block size-3.5 translate-y-[1px] bg-ink" />
      <span className="condensed text-2xl leading-none uppercase">Tinted</span>
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
      <nav className="sticky top-0 z-30 border-b border-ink bg-night/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-4 py-3">
          <Logo />
          <div className="ml-4 hidden gap-5 font-mono text-[12px] uppercase md:flex">
            {NAV.map((r, k) => (
              <a key={r} href={`#/${r}`} className={`hover:text-signal ${r === route ? "text-ink underline decoration-signal decoration-2 underline-offset-[6px]" : "text-ink-2"}`}>
                <span className="text-ink-3">0{k + 1}</span> {ROUTES[r]}
              </a>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <a href="#/account" className="hidden font-mono text-[12px] text-ink-2 uppercase hover:text-signal sm:block">
              Account
            </a>
            <a href="#/chat" className="bg-ink px-4 py-2 text-[13px] font-semibold tracking-wide text-night uppercase hover:bg-signal">
              Open chat
            </a>
            <button onClick={() => setOpen(!open)} className="grid size-9 place-items-center border border-ink md:hidden" aria-label="Menu">
              <span className="font-mono">{open ? "×" : "≡"}</span>
            </button>
          </div>
        </div>
        {open && (
          <div className="grid border-t border-ink md:hidden">
            {[...NAV, "account" as Route].map((r) => (
              <a key={r} href={`#/${r}`} className="border-b border-edge px-4 py-3 font-mono text-[13px] uppercase">
                {ROUTES[r]}
              </a>
            ))}
          </div>
        )}
      </nav>

      <main className="mx-auto max-w-[1400px] px-4 pb-10">
        <div className={route === "home" ? "" : "pt-12"}>
          {route === "home" && <Home />}
          {route === "market" && <Market />}
          {route === "chat" && <Chat initialModel={arg} />}
          {route === "account" && <Account />}
          {route === "verify" && <Verify initialId={arg} />}
          {route === "docs" && <Docs />}
          {route === "credits" && (
            <Suspense fallback={<div className="font-mono text-sm text-ink-3">Loading the prover…</div>}>
              <Credits />
            </Suspense>
          )}
        </div>
      </main>

      <footer className="border-t border-ink">
        <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <p className="max-w-xs text-ink-2">The private inference market. Models in hardware enclaves, inspected before every call, paid on Solana.</p>
          {FOOTER.map(([title, links]) => (
            <div key={title}>
              <div className="font-mono text-[11px] text-ink-3 uppercase">{title}</div>
              <div className="mt-3 grid gap-1.5">
                {links.map(([l, h]) => (
                  <a key={l} href={h} className="hover:text-signal">
                    {l}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        {/* the wordmark, half behind a strip of film */}
        <div className="relative overflow-hidden border-t border-ink">
          <div className="condensed px-2 text-center text-[24vw] leading-[0.78] uppercase select-none">Tinted</div>
          <div className="film absolute inset-x-0 bottom-0 h-[46%]" />
          <div className="absolute right-4 bottom-3 font-mono text-[11px] text-white/60 uppercase">Don't trust · verify</div>
        </div>
      </footer>
    </div>
  );
}
