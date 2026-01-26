import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  BarChart as RBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function BarChart({
  data = [],
  xKey = "name",
  yKey = "value",
  height = 320,
  barFill = "#3b82f6",
  xTickFormatter,
  yTickFormatter,
  tooltipFormatter,
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
      [yKey]: Number(d?.[yKey]) || 0,
      [xKey]: d?.[xKey] ?? "",
    }));
  }, [data, xKey, yKey]);

  const w = size.w;
  const h = size.h || height;

  return (
    <div ref={wrapRef} style={{ width: "100%", height, minWidth: 0 }}>
      {w > 0 && h > 0 && safeData.length > 0 ? (
        <RBarChart width={w} height={h} data={safeData} margin={{ top: 10, right: 18, left: 6, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey={xKey}
            interval={0}
            angle={-35}
            textAnchor="end"
            height={70}
            tickFormatter={xTickFormatter}
          />
          <YAxis tickFormatter={yTickFormatter} />
          <Tooltip formatter={tooltipFormatter} />
          <Bar dataKey={yKey} fill={barFill} isAnimationActive={false} />
        </RBarChart>
      ) : null}
    </div>
  );
}
