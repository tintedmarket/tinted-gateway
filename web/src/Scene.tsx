/**
 * The product as an isometric line drawing: your prompt → the tinted pane → Tinted's enclave → the provider enclaves
 * that passed their proofs (one is held back) → a receipt on Solana. `focus` lights one part for the step-by-step section.
 */
const S = 34;
const OX = 250;
const OY = 150;
type P = [number, number, number];
const iso = ([x, y, z]: P): [number, number] => [OX + (x - y) * 0.866 * S, OY + (x + y) * 0.5 * S - z * S];
const pts = (ps: P[]) => ps.map((p) => iso(p).join(",")).join(" ");
const path = (ps: P[]) => "M" + ps.map((p) => iso(p).join(",")).join(" L");

const PROOF = "#7fd1b9";
const LINE = "#56625f";
const FAIL = "#e5706a";

function Box({ x, y, z = 0, w, d, h, stroke = LINE, fill = "#0b0f12", top, glow }: { x: number; y: number; z?: number; w: number; d: number; h: number; stroke?: string; fill?: string; top?: string; glow?: boolean }) {
  const t: P[] = [[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]];
  const l: P[] = [[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]];
  const r: P[] = [[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]];
  return (
    <g stroke={stroke} strokeWidth={1} strokeLinejoin="round" style={glow ? { filter: "drop-shadow(0 0 8px rgba(127,209,185,.55))" } : undefined}>
      <polygon points={pts(l)} fill={fill} />
      <polygon points={pts(r)} fill={fill} opacity={0.92} />
      <polygon points={pts(t)} fill={top ?? fill} />
    </g>
  );
}

function Label({ at, children, color = "#a7b0ad" }: { at: P; children: string; color?: string }) {
  const [x, y] = iso(at);
  return (
    <text x={x} y={y} fill={color} fontFamily="JetBrains Mono, monospace" fontSize={9.5} letterSpacing={1.2} textAnchor="middle">
      {children}
    </text>
  );
}

export function Scene({ focus = -1, className = "" }: { focus?: number; className?: string }) {
  const on = (...steps: number[]) => (focus < 0 || steps.includes(focus) ? 1 : 0.22);
  const providers: { y: number; name: string; ok: boolean }[] = [
    { y: 0.5, name: "HELD BACK", ok: false },
    { y: 2.9, name: "TINFOIL", ok: true },
    { y: 5.3, name: "PROVIDER", ok: true },
  ];
  const toPane: P[] = [[1.5, 3.3, 1.05], [4, 3.3, 1.05]];
  const toGate: P[] = [[4, 3.3, 1.05], [5.6, 3.3, 1.05]];
  const toProv: P[] = [[7.8, 3.4, 0.05], [9.1, 3.4, 0.05], [9.1, 3.6, 0.05], [10.4, 3.6, 0.05]];

  return (
    <svg viewBox="20 80 630 440" className={className} role="img" aria-label="Your prompt passes through tinted glass into Tinted's enclave, then only to provider enclaves that passed their proofs; receipts go to Solana.">
      <defs>
        <linearGradient id="pane" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={PROOF} stopOpacity={0.28} />
          <stop offset="0.55" stopColor={PROOF} stopOpacity={0.06} />
          <stop offset="1" stopColor={PROOF} stopOpacity={0.2} />
        </linearGradient>
      </defs>
      {/* the slab */}
      <g opacity={0.9}>
        <Box x={0} y={0} z={-0.45} w={13} d={7.2} h={0.45} fill="#080b0d" stroke="#2c3539" />
      </g>

      {/* routes from the gateway to each provider, drawn on the floor */}
      <g opacity={on(2, 3)}>
        {providers.map((p) => (
          <path key={p.name} d={path([[7.8, 3.4, 0.02], [9.1, 3.4, 0.02], [9.1, p.y + 0.7, 0.02], [10.4, p.y + 0.7, 0.02]])} fill="none" stroke={p.ok ? PROOF : FAIL} strokeOpacity={p.ok ? 0.7 : 0.55} className={p.ok ? "flow" : undefined} strokeDasharray={p.ok ? undefined : "2 4"} />
        ))}
      </g>

      {/* you */}
      <g opacity={on(0)}>
        <Box x={0.8} y={2.6} w={1.4} d={1.4} h={1} top={focus === 0 ? "#12201c" : undefined} stroke={focus === 0 ? PROOF : LINE} glow={focus === 0} />
        <Label at={[1.5, 3.3, 1.65]}>YOU</Label>
      </g>

      {/* the pane of tinted glass */}
      <g opacity={on(0, 3)}>
        <polygon points={pts([[4, 0.6, 0], [4, 6.6, 0], [4, 6.6, 3.3], [4, 0.6, 3.3]])} fill="url(#pane)" stroke={PROOF} strokeOpacity={0.75} />
        <path d={path([[4, 1.4, 3.3], [4, 0.6, 2.5]])} stroke="#e8ece9" strokeOpacity={0.35} />
        <path d={path([[4, 3.0, 3.3], [4, 0.6, 0.9]])} stroke="#e8ece9" strokeOpacity={0.18} />
        <Label at={[4, 3.6, 3.75]} color={PROOF}>ONE-WAY GLASS</Label>
      </g>

      {/* Tinted's enclave */}
      <g opacity={on(1, 3)}>
        <Box x={5.6} y={2.3} w={2.2} d={2.2} h={1.8} stroke={focus === 1 || focus === 3 ? PROOF : "#7a8784"} glow={focus === 1 || focus === 3} />
        <Box x={6.2} y={2.9} z={1.8} w={1} d={1} h={0.22} stroke={PROOF} top="#163029" glow />
        <Label at={[6.7, 3.4, 2.75]} color={PROOF}>TINTED · TDX</Label>
      </g>

      {/* the receipt log on Solana */}
      <g opacity={on(4)}>
        {[0, 0.38, 0.76].map((z, i) => (
          <Box key={i} x={5.9} y={5.3} z={z} w={1.5} d={1.2} h={0.26} stroke={focus === 4 ? PROOF : LINE} top={focus === 4 && i === 2 ? "#12201c" : undefined} glow={focus === 4 && i === 2} />
        ))}
        <path d={path([[6.7, 4.5, 0.4], [6.7, 5.3, 0.4]])} stroke={PROOF} strokeOpacity={0.6} className="flow" fill="none" />
        <Label at={[6.65, 5.9, 1.55]}>SOLANA</Label>
      </g>

      {/* provider enclaves */}
      {providers.map((p) => (
        <g key={p.name} opacity={on(1, 2, 3) * (p.ok ? 1 : focus === 2 || focus === 1 || focus < 0 ? 1 : 0.6)}>
          <Box x={10.4} y={p.y} w={1.4} d={1.4} h={1.15} stroke={p.ok ? (focus === 3 && p.y === 2.9 ? PROOF : "#7a8784") : FAIL} glow={focus === 3 && p.y === 2.9} />
          <Label at={[11.1, p.y + 0.7, 1.85]} color={p.ok ? "#a7b0ad" : FAIL}>
            {p.name}
          </Label>
          {(focus === 1 || focus === 2) && (
            <g>
              {(() => {
                const [x, y] = iso([11.1, p.y + 0.7, 2.45]);
                return p.ok ? (
                  <g>
                    <circle cx={x} cy={y} r={8} fill="#0b0f12" stroke={PROOF} />
                    <path d={`M${x - 3.5},${y} l2.5,2.6 l4.5,-5`} stroke={PROOF} strokeWidth={1.6} fill="none" />
                  </g>
                ) : (
                  <g>
                    <circle cx={x} cy={y} r={8} fill="#0b0f12" stroke={FAIL} />
                    <path d={`M${x - 3},${y - 3} l6,6 M${x + 3},${y - 3} l-6,6`} stroke={FAIL} strokeWidth={1.6} />
                  </g>
                );
              })()}
            </g>
          )}
        </g>
      ))}

      {/* packets: plaintext before the pane, ciphertext after it */}
      <g opacity={on(0, 1, 2, 3)}>
        {[0, 0.7, 1.4].map((b) => (
          <circle key={"a" + b} r={3.2} fill="#e8ece9">
            <animateMotion dur="2.1s" begin={`${b}s`} repeatCount="indefinite" path={path(toPane)} />
          </circle>
        ))}
        {[0.3, 1.0, 1.7].map((b) => (
          <rect key={"b" + b} x={-3} y={-3} width={6} height={6} fill="none" stroke={PROOF} strokeWidth={1.4}>
            <animateMotion dur="2.1s" begin={`${b}s`} repeatCount="indefinite" path={path(toGate)} />
          </rect>
        ))}
        {[0.6, 1.3, 2.0].map((b) => (
          <rect key={"c" + b} x={-2.5} y={-2.5} width={5} height={5} fill={PROOF} opacity={0.85}>
            <animateMotion dur="2.1s" begin={`${b}s`} repeatCount="indefinite" path={path(toProv)} />
          </rect>
        ))}
      </g>
    </svg>
  );
}
