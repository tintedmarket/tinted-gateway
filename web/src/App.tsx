import { lazy, Suspense, useEffect, useState } from "react";
import { Home } from "./pages/Home";
import { Market } from "./pages/Market";
import { Chat } from "./pages/Chat";
import { Account } from "./pages/Account";
import { Verify } from "./pages/Verify";
import { Docs } from "./pages/Docs";
// The ZK prover is heavy: load it only on the credits page.
const Credits = lazy(() => import("./pages/Credits").then((m) => ({ default: m.Credits })));

const ROUTES = { home: "Home", market: "Market", chat: "Chat", account: "Account", credits: "Anonymous", verify: "Verify", docs: "Docs" } as const;
type Route = keyof typeof ROUTES;

function parse(): { route: Route; arg: string } {
  const [r, ...rest] = location.hash.replace(/^#\/?/, "").split("/");
  return { route: (r in ROUTES ? r : "home") as Route, arg: decodeURIComponent(rest.join("/")) };
}
export const go = (route: Route, arg = "") => (location.hash = `/${route}${arg ? "/" + encodeURIComponent(arg) : ""}`);

export function App() {
  const [{ route, arg }, set] = useState(parse);
  useEffect(() => {
    const on = () => {
      set(parse());
      window.scrollTo(0, 0);
    };
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-20 border-b border-edge/70 bg-night/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <a href="#/" className="flex items-center gap-2">
            <span className="relative block size-5 rounded-[3px] border border-proof/60 bg-gradient-to-br from-proof/40 to-night" />
            <span className="font-display text-2xl leading-none">Tinted</span>
          </a>
          <div className="ml-auto flex gap-1 overflow-x-auto text-sm">
            {(Object.keys(ROUTES) as Route[]).filter((r) => r !== "home").map((r) => (
              <a key={r} href={`#/${r}`} className={`rounded px-2.5 py-1 whitespace-nowrap transition ${r === route ? "bg-pane-2 text-ink" : "text-ink-3 hover:text-ink"}`}>
                {ROUTES[r]}
              </a>
            ))}
          </div>
        </div>
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
      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-ink-3">
        Tinted runs inside an attested enclave. Don't take our word for it: <a className="underline hover:text-ink" href="#/verify">verify the gateway</a> ·{" "}
        <a className="underline hover:text-ink" href="https://github.com/tintedmarket/tinted-gateway">source</a> ·{" "}
        <a className="underline hover:text-ink" href="/llms.txt">for agents: llms.txt</a>
      </footer>
    </div>
  );
}
