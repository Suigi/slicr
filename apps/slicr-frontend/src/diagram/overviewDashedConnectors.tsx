import { routeRoundedPolyline } from '../domain/diagramRouting';
import type { DiagramCrossSliceLink } from './rendererContract';

function toGradientId(key: string) {
  return `overview-dashed-connector-gradient-${
    Array.from(key)
      .map((character) => /[A-Za-z0-9_-]/.test(character) ? character : `_${character.codePointAt(0)?.toString(16)}_`)
      .join('')
  }`;
}

type OverviewDashedConnectorsProps = {
  crossSliceLinks: DiagramCrossSliceLink[];
};

export function OverviewDashedConnectors({ crossSliceLinks }: OverviewDashedConnectorsProps) {
  const dashedConnectors = crossSliceLinks.filter(
    (link) => link.renderMode === 'dashed-connector' && link.points && link.points.length >= 2
  );

  if (dashedConnectors.length === 0) {
    return null;
  }

  return (
    <>
      <defs>
        {dashedConnectors.map((link) => {
          const start = link.points![0]!;
          const end = link.points![link.points!.length - 1]!;
          return (
            <linearGradient
              key={toGradientId(link.key)}
              id={toGradientId(link.key)}
              className="overview-dashed-connector-gradient"
              gradientUnits="userSpaceOnUse"
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
            >
              <stop offset="0%" stopColor="var(--overview-dashed-connector)" stopOpacity="0.65" />
              <stop offset="32%" stopColor="var(--overview-dashed-connector)" stopOpacity="0" />
              <stop offset="68%" stopColor="var(--overview-dashed-connector)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--overview-dashed-connector)" stopOpacity="0.65" />
            </linearGradient>
          );
        })}
      </defs>

      {dashedConnectors.map((link) => (
        <path
          key={link.key}
          d={routeRoundedPolyline(link.points!, 5)}
          className="overview-dashed-connector"
          stroke={`url(#${toGradientId(link.key)})`}
        />
      ))}
    </>
  );
}
