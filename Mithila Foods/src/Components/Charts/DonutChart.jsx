// src/Charts/DonutChart.jsx
import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";

const DEFAULT_COLORS = ["#16a34a", "#f59e0b"]; // Paid, Outstanding

export default function DonutChart({
  data = [],
  colors = DEFAULT_COLORS,
  centerTop = "",
  centerBottom = "",
  height = 260,
}) {
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const update = () => {
      const r = el.getBoundingClientRect();
      setSize({
        w: Math.max(0, Math.floor(r.width)),
        h: Math.max(0, Math.floor(r.height)),
      });
    };

    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  const safeData = useMemo(() => {
    return (data || []).map((d) => ({
      ...d,
      value: Math.max(0, Number(d.value) || 0),
    }));
  }, [data]);

  // If hidden (display:none) => size will be 0; DO NOT render chart (prevents warning)
  const w = size.w;
  const h = size.h || height;

  const outerRadius = Math.max(40, Math.floor(Math.min(w, h) * 0.38));
  const innerRadius = Math.floor(outerRadius * 0.55);

  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  return (
    <div ref={wrapRef} style={{ width: "100%", height, minWidth: 0 }}>
      {w > 0 && h > 0 && safeData.length > 0 ? (
        <PieChart width={w} height={h}>
          <Pie
            data={safeData}
            dataKey="value"
            nameKey="name"
            cx={cx}
            cy={cy}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={0}
            stroke="none"
            isAnimationActive={false}
          >
            {safeData.map((_, idx) => (
              <Cell
                key={idx}
                fill={colors[idx % colors.length]}
                stroke="none"
              />
            ))}
          </Pie>

          <Tooltip />

          {/* Center text */}
          <text
            x={cx}
            y={cy - 10}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fontSize: 18, fontWeight: 800 }}
          >
            {centerTop}
          </text>

          <text
            x={cx}
            y={cy + 18}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fontSize: 14, opacity: 0.8 }}
          >
            {centerBottom}
          </text>
        </PieChart>
      ) : null}
    </div>
  );
}
