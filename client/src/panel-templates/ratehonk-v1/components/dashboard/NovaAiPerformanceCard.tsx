import { useEffect, useMemo, useState } from "react";

type AiPerformanceProps = {
  totalChats: number;
  resolvedChats: number;
  unresolvedChats: number;
  handoverToAgent: number;
  resolutionRate: number;
};

const ARC_START = 152;
const ARC_SWEEP = 236;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, endDeg);
  const end = polar(cx, cy, r, startDeg);
  const large = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
}

function arcLength(r: number) {
  return 2 * Math.PI * r * (ARC_SWEEP / 360);
}

function useAnimatedPercent(target: number, animate: boolean, durationMs = 900) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!animate) {
      setValue(0);
      return;
    }

    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, animate, durationMs]);

  return value;
}

type RingSpec = {
  r: number;
  stroke: string;
  track: string;
  progress: number;
  delay: number;
};

function AnimatedArcRing({
  cx,
  cy,
  spec,
  animate,
}: {
  cx: number;
  cy: number;
  spec: RingSpec;
  animate: boolean;
}) {
  const fullD = arcPath(cx, cy, spec.r, ARC_START, ARC_START + ARC_SWEEP);
  const len = arcLength(spec.r);
  const target = Math.min(1, Math.max(0, spec.progress));
  const visible = animate ? target : 0;

  return (
    <g>
      <path
        d={fullD}
        fill="none"
        stroke={spec.track}
        strokeWidth={9}
        strokeLinecap="round"
      />
      <path
        d={fullD}
        fill="none"
        stroke={spec.stroke}
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={`${len * visible} ${len}`}
        style={{
          transition: `stroke-dasharray 1.15s cubic-bezier(0.4, 0, 0.2, 1) ${spec.delay}ms`,
        }}
      />
    </g>
  );
}

export function NovaAiPerformanceCard({
  totalChats,
  resolvedChats,
  unresolvedChats,
  handoverToAgent,
  resolutionRate,
}: AiPerformanceProps) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(false);
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [totalChats, resolvedChats, unresolvedChats, handoverToAgent, resolutionRate]);

  const data = useMemo(
    () => ({
      total: totalChats,
      resolved: resolvedChats,
      unresolved: unresolvedChats,
      handover: handoverToAgent,
      resolutionRate,
    }),
    [totalChats, resolvedChats, unresolvedChats, handoverToAgent, resolutionRate],
  );

  const displayRate = useAnimatedPercent(data.resolutionRate, animate);

  const cx = 92;
  const cy = 92;
  const safeTotal = Math.max(data.total, 1);

  const rings: RingSpec[] = [
    {
      r: 74,
      stroke: "#1e40af",
      track: "#e8edf5",
      progress: 1,
      delay: 0,
    },
    {
      r: 58,
      stroke: "#38bdf8",
      track: "#e8f4fc",
      progress: data.resolved / safeTotal,
      delay: 120,
    },
    {
      r: 42,
      stroke: "#f87171",
      track: "#fdecec",
      progress: data.unresolved / safeTotal,
      delay: 240,
    },
    {
      r: 26,
      stroke: "#4ade80",
      track: "#e8f8ee",
      progress: data.handover / safeTotal,
      delay: 360,
    },
  ];

  const legend = [
    { label: "Total Chats", value: data.total, color: "#1e40af" },
    { label: "Resolved Chats", value: data.resolved, color: "#38bdf8" },
    { label: "Unresolved chats", value: data.unresolved, color: "#f87171" },
    { label: "Handover to Agent", value: data.handover, color: "#4ade80" },
  ];

  return (
    <div className="nova-panel-card nova-ai-performance flex h-full min-h-[240px] w-full flex-col">
      <h2 className="nova-ai-performance__title">Assistant Performance</h2>
      <div className="nova-ai-performance__body">
        <div className="nova-ai-performance__content">
        <div className="nova-ai-performance__chart" aria-hidden>
          <svg width={184} height={184} viewBox="0 0 184 184" className="overflow-visible">
            {rings.map((ring) => (
              <AnimatedArcRing key={ring.r} cx={cx} cy={cy} spec={ring} animate={animate} />
            ))}
          </svg>
          <div className="nova-ai-performance__center">
            <span
              className="nova-ai-performance__rate"
              data-testid="text-ai-resolution-rate"
              aria-live="polite"
            >
              {displayRate}
              <span className="nova-ai-performance__pct"> %</span>
            </span>
            <span className="nova-ai-performance__rate-label">Resolution Rate</span>
          </div>
        </div>

        <ul className="nova-ai-performance__legend">
          {legend.map((item, index) => (
            <li
              key={item.label}
              className={index < legend.length - 1 ? "nova-ai-performance__legend-row" : ""}
            >
              <span className="nova-ai-performance__legend-label">
                <span
                  className="nova-ai-performance__dot"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </span>
              <span className="nova-ai-performance__legend-value">
                {item.value.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
        </div>
      </div>
    </div>
  );
}
