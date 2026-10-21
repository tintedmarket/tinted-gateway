import { lazy, Suspense, useEffect, useId, useState } from "react";
import { Home } from "./pages/Home";
import { Market } from "./pages/Market";
import { Chat } from "./pages/Chat";
import { Account } from "./pages/Account";
import { Verify } from "./pages/Verify";
import { Docs } from "./pages/Docs";
// The ZK prover is heavy: load it only on the credits page.
const Credits = lazy(() => import("./pages/Credits").then((m) => ({ default: m.Credits })));

const ROUTES = { home: "Home", market: "Market", chat: "Chat", credits: "Anonymous", verify: "Verify", docs: "Developers", account: "Account" } as const;
type Route = keyof typeof ROUTES;
const NAV: Route[] = ["market", "credits", "verify", "docs"];

function parse(): { route: Route; arg: string } {
  const [r, ...rest] = location.hash.replace(/^#\/?/, "").split("/");
  return { route: (r in ROUTES ? r : "home") as Route, arg: decodeURIComponent(rest.join("/")) };
}
export const go = (route: Route, arg = "") => (location.hash = `/${route}${arg ? "/" + encodeURIComponent(arg) : ""}`);

/** The mark: a rounded pane cut on the diagonal, its lower half tinted. */
export function Mark({ className = "size-5", tone = "#f5f6f5", shade }: { className?: string; tone?: string; shade?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <clipPath id={id}>
        <rect x="1.5" y="1.5" width="21" height="21" rx="5" />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <rect x="1.5" y="1.5" width="21" height="21" fill={shade ?? tone} opacity={shade ? 1 : 0.24} />
        <path d="M1.5 1.5H22.5L1.5 22.5Z" fill={tone} />
      </g>
    </svg>
  );
}

function Logo() {
  return (
    <a href="#/" className="flex items-center gap-2">
      <Mark />
      <span className="text-[15px] font-medium tracking-[-0.01em]">Tinted</span>
    </a>
  );
}

const FOOTER: [string, [string, string][]][] = [
  ["Product", [["Market", "#/market"], ["Private chat", "#/chat"], ["Anonymous credits", "#/credits"], ["Account", "#/account"], ["X / Twitter", "https://x.com/tintedmarket"]]],
  ["Developers", [["Docs", "#/docs"], ["Docs for agents", "/llms.txt"], ["Models API", "https://api.tinted.market/v1/models"], ["Source", "https://github.com/tintedmarket/tinted-gateway"]]],
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

  useEffect(() => {
    document.title = `${ROUTES[route]} | Tinted`;
  }, [route]);

  return (
    <div className="min-h-screen overflow-x-clip">
      <nav className="sticky top-0 z-30 border-b border-edge/70 bg-night/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1344px] items-center gap-6 px-6">
          <Logo />
          <div className="ml-auto hidden items-center gap-7 text-sm text-ink-2 md:flex">
            {NAV.map((r) => (
              <a key={r} href={`#/${r}`} className={`transition hover:text-ink ${r === route ? "text-ink" : ""}`}>
                {ROUTES[r]}
              </a>
            ))}
            <span className="h-5 w-px bg-edge" />
            <a href="#/account" className={`transition hover:text-ink ${route === "account" ? "text-ink" : ""}`}>
              Account
            </a>
          </div>
          <a href="#/chat" className="ml-auto rounded-full bg-ink px-4 py-[7px] text-sm font-medium text-night transition hover:bg-white md:ml-0">
            Open chat
          </a>
          <button onClick={() => setOpen(!open)} className="grid size-9 place-items-center rounded-full border border-edge md:hidden" aria-label="Menu">
            <span className="text-ink-2">{open ? "×" : "≡"}</span>
          </button>
        </div>
        {open && (
          <div className="grid border-t border-edge px-6 py-2 md:hidden">
            {[...NAV, "chat" as Route, "account" as Route].map((r) => (
              <a key={r} href={`#/${r}`} className="py-2.5 text-ink-2">
                {ROUTES[r]}
              </a>
            ))}
          </div>
        )}
      </nav>

      <main className={route === "home" ? "" : "mx-auto max-w-[1344px] px-6 pt-16 pb-24"}>
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

      <div className="border-t border-edge">
        <div className="mx-auto flex max-w-[1344px] items-center gap-4 px-6 py-14 text-ink-2">
          Find us on
          <a href="https://x.com/tintedmarket" target="_blank" rel="noreferrer" aria-label="Tinted on X" className="grid size-9 place-items-center rounded-full bg-pane-2 text-ink transition hover:bg-edge">
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
              <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77Zm-1.08 16.17h1.7L7.4 4.74H5.58Z" />
            </svg>
          </a>
        </div>
      </div>
      <footer className="border-t border-edge">
        <div className="mx-auto grid max-w-[1344px] gap-10 px-6 pt-16 pb-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <Mark className="size-6" />
          {FOOTER.map(([title, links]) => (
            <div key={title}>
              <div className="text-sm font-medium">{title}</div>
              <div className="mt-5 grid gap-3 text-sm text-ink-2">
                {links.map(([l, h]) => (
                  <a key={l} href={h} className="transition hover:text-ink">
                    {l}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mx-auto max-w-[1344px] px-6 text-sm text-ink-3">© {new Date().getFullYear()} Tinted</div>
        <div className="mx-auto mt-10 flex max-w-[1344px] items-end gap-[3vw] overflow-hidden px-6 select-none" aria-hidden>
          <Mark className="h-[15vw] max-h-[220px] w-auto shrink-0" tone="#111215" />
          <span className="h-display translate-y-[18%] text-[17vw] leading-[0.8] text-[#111215] lg:text-[240px]">Tinted</span>
        </div>
      </footer>
    </div>
  );
}
