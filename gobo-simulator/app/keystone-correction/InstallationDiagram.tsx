import { convertDistance, type DistanceUnit } from "./geometry";
import styles from "./keystone.module.css";

export default function InstallationDiagram({ unit }: { unit: DistanceUnit }) {
  const example = (metres: number) => `${Number(convertDistance(metres, "m", unit).toFixed(2))} ${unit}`;

  return (
    <figure className={styles.installationDiagram}>
      <svg viewBox="0 0 316 218" role="img" aria-labelledby="keystone-diagram-title keystone-diagram-description">
        <title id="keystone-diagram-title">Example projector installation</title>
        <desc id="keystone-diagram-description">
          Start at the target center on the wall. Move right along the wall for X, up along the wall for Y,
          then straight out, perpendicular to the wall, for Z to reach the projector lens.
        </desc>
        <path className={styles.wallPlane} d="M18 28 154 92 154 211 18 147Z" />
        <text x="18" y="20">Wall</text>
        <path className={styles.aimLine} d="M266 88 68 129" />
        <path className={styles.axisLine} d="M68 129 125 156V88H266" />
        <path className={styles.axisLine} d="m117 147 8 9-11 1m6-61 5-8 5 8m128-13 8 5-8 5" />
        <circle cx="68" cy="129" r="3.5" className={styles.axisDot} />
        <text x="24" y="123">Target</text>
        <text x="24" y="138">center</text>
        <text className={styles.axisLabel} x="92" y="163">X</text>
        <text className={styles.axisLabel} x="107" y="117">Y</text>
        <text className={styles.axisLabel} x="192" y="78">Z</text>
        <rect className={styles.wallPlane} x="267" y="75" width="35" height="26" rx="4" />
        <circle cx="266" cy="88" r="4" className={styles.axisDot} />
        <text x="241" y="120">Projector</text>
        <text x="241" y="135">lens</text>
      </svg>
      <figcaption>
        Example from the target center. X is {example(0.6)} right, Y is {example(0.4)} up,
        and Z is {example(3)} straight out from the wall. The dashed line shows where the lens aims.
      </figcaption>
    </figure>
  );
}
