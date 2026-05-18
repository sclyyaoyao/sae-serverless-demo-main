const VIEW = 220;
const CX = VIEW / 2;
const CY = VIEW / 2;
const R = 78;

/**
 * 轻量 SVG 五维雷达图（0–100），无第三方图表依赖。
 */
export function RadarChart({ dimensions, stroke = '#2563eb', fill = 'rgba(37, 99, 235, 0.18)' }) {
  const n = dimensions?.length || 0;
  if (n < 3) {
    return (
      <div className="radar-chart radar-chart--empty" role="img" aria-label="雷达图数据不足">
        <p className="radar-chart-placeholder">至少需要 3 个维度才能绘制雷达图</p>
      </div>
    );
  }

  const angles = dimensions.map((_, i) => (-Math.PI / 2 + (2 * Math.PI * i) / n));
  const gridLevels = [20, 40, 60, 80, 100];

  const pointFor = (value, i) => {
    const t = angles[i];
    const r = (R * Math.max(0, Math.min(100, value))) / 100;
    return {
      x: CX + r * Math.cos(t),
      y: CY + r * Math.sin(t),
    };
  };

  const polyPoints = dimensions
    .map((d, i) => {
      const p = pointFor(d.value, i);
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <div className="radar-chart" role="img" aria-label="评估雷达图">
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="radar-chart-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        {gridLevels.map((lvl) => {
          const rr = (R * lvl) / 100;
          const gp = angles
            .map((t) => `${CX + rr * Math.cos(t)},${CY + rr * Math.sin(t)}`)
            .join(' ');
          return (
            <polygon
              key={lvl}
              points={gp}
              fill="none"
              stroke="rgba(15, 23, 42, 0.08)"
              strokeWidth="1"
            />
          );
        })}

        {angles.map((t, i) => (
          <line
            key={i}
            x1={CX}
            y1={CY}
            x2={CX + R * Math.cos(t)}
            y2={CY + R * Math.sin(t)}
            stroke="rgba(15, 23, 42, 0.12)"
            strokeWidth="1"
          />
        ))}

        <polygon points={polyPoints} fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />

        {dimensions.map((d, i) => {
          const t = angles[i];
          const lx = CX + (R + 22) * Math.cos(t);
          const ly = CY + (R + 22) * Math.sin(t);
          return (
            <text
              key={d.label}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="10"
              fill="#334155"
              className="radar-chart-label"
            >
              {d.label.length > 6 ? `${d.label.slice(0, 5)}…` : d.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
