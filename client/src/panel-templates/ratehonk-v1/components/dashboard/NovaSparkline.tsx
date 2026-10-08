function buildPath(values: number[], width: number, height: number): string {
  if (!values.length) return "";
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = i * step;
      const y = height - 6 - (v / max) * (height - 12);
      return `${x},${y}`;
    })
    .join(" ");
}

export function NovaSparkline({
  values,
  color = "#2563eb",
  variant = "up",
}: {
  values: number[];
  color?: string;
  variant?: "up" | "down";
}) {
  const w = 120;
  const h = 36;
  const path = buildPath(values.length ? values : [1, 2, 1, 3, 2, 4], w, h);
  const stroke = variant === "down" ? "#ef4444" : color;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={path}
      />
    </svg>
  );
}
