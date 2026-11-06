import { convertDistance, type DistanceUnit } from "./geometry";
import styles from "./keystone.module.css";

export default function InstallationDiagram({ unit }: { unit: DistanceUnit }) {
  const example = (metres: number) => `${Number(convertDistance(metres, "m", unit).toFixed(2))} ${unit}`;

  return (
    <figure className={styles.installationDiagram}>
      <svg viewBox="0 0 316 258" role="img" aria-labelledby="keystone-diagram-title keystone-diagram-description">
        <title id="keystone-diagram-title">X and Y share one origin at the target center</title>
        <desc id="keystone-diagram-description">
          Viewed in the intended artwork orientation, the target center is (0, 0). Left is negative X, right is positive X,
          down is negative Y, and up is positive Y. The example lens point is above and to the right.
          A separate side view shows Z measured straight from the projection surface to the lens.
        </desc>

        <text x="12" y="20">Surface view</text>
        <path className={styles.axisLine} d="M55 104H261M156 35V169M61 99l-6 5 6 5m194-10 6 5-6 5M151 41l5-6 5 6m-10 122 5 6 5-6" />
        <path className={styles.guideLine} d="M156 65H219V104" />
        <circle cx="219" cy="65" r="4" className={styles.lensDot} />
        <text x="219" y="54" textAnchor="middle">Lens point on surface</text>
        <circle cx="156" cy="104" r="5" className={styles.axisDot} />
        <text className={styles.axisLabel} x="145" y="122" textAnchor="end">(0, 0) Target center</text>
        <text className={styles.axisLabel} x="49" y="108" textAnchor="end">−X Left</text>
        <text className={styles.axisLabel} x="266" y="108">+X Right</text>
        <text className={styles.axisLabel} x="156" y="26" textAnchor="middle">+Y Up</text>
        <text className={styles.axisLabel} x="156" y="186" textAnchor="middle">−Y Down</text>

        <path className={styles.diagramDivider} d="M12 195H304" />
        <text x="12" y="212">Side view</text>
        <path className={styles.diagramDivider} d="M69 217V249" />
        <path className={styles.axisLine} d="M69 231H237m-7-5 7 5-7 5" />
        <circle cx="69" cy="231" r="4" className={styles.lensDot} />
        <rect className={styles.wallPlane} x="239" y="220" width="35" height="22" rx="3" />
        <text className={styles.axisLabel} x="153" y="222" textAnchor="middle">+Z</text>
        <text x="69" y="257" textAnchor="middle">Surface</text>
        <text x="256" y="257" textAnchor="middle">Lens</text>
      </svg>
      <figcaption>
        Example. The lens point is {example(0.6)} right and {example(0.4)} toward the top of the artwork from the target center,
        so X and Y are both positive. Z is {example(3)} perpendicular to the surface.
      </figcaption>
    </figure>
  );
}
