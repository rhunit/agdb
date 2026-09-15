import { formatDutchInt, formatSignedPercent } from "../lib/format";
import type { LocationId } from "../types";
import styles from "./TrendChart.module.css";

const LOCATION_COLOR: Record<LocationId, string> = {
  centrum: "#38b449",
  oost: "#4d3935",
  depijp: "#6f5d58",
};

const LOCATION_DASH: Record<LocationId, string | undefined> = {
  centrum: undefined,
  oost: undefined,
  depijp: "5 4",
};

const LOCATION_LABEL: Record<LocationId, string> = {
  centrum: "Centrum",
  oost: "Oost",
  depijp: "De Pijp",
};

interface SeriesPoint {
  week: string;
  total: number;
  byLocation: Record<LocationId, number>;
}

interface TrendChartProps {
  series: SeriesPoint[];
  locations: LocationId[];
  total: number;
  deltaPct: number;
}

const VB_WIDTH = 620;
const X_START = 20;
const X_END = 600;
const Y_TOP = 10;
const Y_BOTTOM = 205;

function scaleX(index: number, count: number) {
  return X_START + (index * (X_END - X_START)) / (count - 1);
}

function scaleY(value: number, min: number, max: number) {
  if (max === min) return (Y_TOP + Y_BOTTOM) / 2;
  return Y_BOTTOM - ((value - min) / (max - min)) * (Y_BOTTOM - Y_TOP);
}

export function TrendChart({
  series,
  locations,
  total,
  deltaPct,
}: TrendChartProps) {
  const allValues = series.flatMap((point) =>
    locations.map((id) => point.byLocation[id]),
  );
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const padding = (max - min) * 0.1 || max * 0.1 || 1;

  const tickIndices = [0, Math.floor((series.length - 1) / 2), series.length - 1];

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Zoekweergaven per locatie</div>
          <div className={styles.subtitle}>
            laatste 8 weken · {series[0]?.week}–{series[series.length - 1]?.week}
          </div>
        </div>
        <div className={styles.deltaPill}>
          {formatSignedPercent(deltaPct)} vs vorige week
        </div>
      </div>

      <div className={styles.legend}>
        {locations.map((id) => (
          <span key={id} className={styles.legendItem}>
            <span
              className={styles.legendSwatch}
              style={{ background: LOCATION_COLOR[id] }}
            />
            {LOCATION_LABEL[id]}
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${VB_WIDTH} 240`} className={styles.svg}>
        <line x1="0" y1="10" x2="620" y2="10" stroke="#e5e7eb" strokeWidth="1" />
        <line x1="0" y1="65" x2="620" y2="65" stroke="#e5e7eb" strokeWidth="1" />
        <line x1="0" y1="120" x2="620" y2="120" stroke="#e5e7eb" strokeWidth="1" />
        <line x1="0" y1="175" x2="620" y2="175" stroke="#e5e7eb" strokeWidth="1" />
        <line x1="0" y1="205" x2="620" y2="205" stroke="#d8dade" strokeWidth="1" />

        {locations.map((id) => {
          const points = series
            .map((point, i) => {
              const x = scaleX(i, series.length);
              const y = scaleY(point.byLocation[id], min - padding, max + padding);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ");
          const lastPoint = series[series.length - 1];
          const lastX = scaleX(series.length - 1, series.length);
          const lastY = scaleY(
            lastPoint.byLocation[id],
            min - padding,
            max + padding,
          );
          return (
            <g key={id}>
              <polyline
                points={points}
                fill="none"
                stroke={LOCATION_COLOR[id]}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeDasharray={LOCATION_DASH[id]}
              />
              <circle cx={lastX} cy={lastY} r="4" fill={LOCATION_COLOR[id]} />
            </g>
          );
        })}

        {tickIndices.map((i) => (
          <text
            key={i}
            x={scaleX(i, series.length)}
            y="224"
            fontFamily="Open Sans, Helvetica Neue, Helvetica, Arial, sans-serif"
            fontSize="11"
            fontWeight="600"
            fill="#6f5d58"
          >
            {series[i]?.week}
          </text>
        ))}
      </svg>

      <div className={styles.breakdown}>
        {locations.map((id) => {
          const latest = series[series.length - 1].byLocation[id];
          const previous = series[series.length - 2]?.byLocation[id];
          const pct =
            previous && previous > 0 ? ((latest - previous) / previous) * 100 : 0;
          return (
            <div key={id}>
              <div className={styles.breakdownLabel}>
                {LOCATION_LABEL[id].toUpperCase()}
              </div>
              <div className={styles.breakdownValue}>
                {formatDutchInt(latest)}
              </div>
              <div className={styles.breakdownDelta}>
                {formatSignedPercent(pct)}
              </div>
            </div>
          );
        })}
        {locations.length > 1 && (
          <div className={styles.totalNote}>
            Totaal alle locaties: {formatDutchInt(total)}
          </div>
        )}
      </div>
    </div>
  );
}
