const MAP_MARKERS: Record<string, { x: number; y: number }> = {
  us: { x: 72, y: 58 },
  ca: { x: 78, y: 42 },
  uk: { x: 168, y: 44 },
  es: { x: 162, y: 56 },
  au: { x: 302, y: 112 },
  in: { x: 248, y: 72 },
  mx: { x: 68, y: 68 },
  de: { x: 178, y: 46 },
  fr: { x: 170, y: 50 },
  ae: { x: 228, y: 68 },
};

/** Stylized dotted world map with country markers */
export function NovaWorldMap({
  activeMapKey,
  markerKeys,
}: {
  activeMapKey?: string;
  markerKeys: string[];
}) {
  const dots: Array<{ x: number; y: number }> = [];
  for (let y = 12; y <= 118; y += 7) {
    for (let x = 8; x <= 348; x += 7) {
      if ((x + y) % 11 === 0 || (x * y) % 17 === 0) {
        dots.push({ x, y });
      }
    }
  }

  const keys = [...new Set(markerKeys.filter((k) => MAP_MARKERS[k]))];

  return (
    <svg
      viewBox="0 0 360 130"
      className="nova-users-map__svg h-full w-full"
      aria-hidden
    >
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={1.2} fill="#d1d5db" />
      ))}
      {keys.map((key) => {
        const pos = MAP_MARKERS[key];
        if (!pos) return null;
        const active = key === activeMapKey;
        return (
          <g key={key}>
            {active ? (
              <circle cx={pos.x} cy={pos.y} r={14} fill="#2563eb" fillOpacity={0.15} />
            ) : null}
            <circle
              cx={pos.x}
              cy={pos.y}
              r={active ? 5 : 4}
              fill={active ? "#2563eb" : "#3b82f6"}
              stroke="#ffffff"
              strokeWidth={1.5}
            />
          </g>
        );
      })}
    </svg>
  );
}
