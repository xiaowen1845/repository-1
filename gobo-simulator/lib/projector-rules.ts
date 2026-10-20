export type Environment = "indoor" | "outdoor";
export type LightLevel = "dark" | "slightly-dark" | "bright";
export type Unit = "m" | "ft";
export type LensRatio = 0.3 | 0.36 | 0.5 | 0.8 | 1;
export const LENSES: readonly LensRatio[] = [0.3, 0.36, 0.5, 0.8, 1];
export const LIGHT_LABELS: Record<LightLevel, string> = {
  dark: "Dark", "slightly-dark": "Slightly Dark", bright: "Bright",
};
export const STORE = "https://gobosolution.com";
export const FINDER_URL = `${STORE}/pages/projector-finder`;
export const QUOTE_URL = `${STORE}/pages/request-a-quote`;

export type Projector = {
  id: string; name: string; wattage: number;
  environment: readonly Environment[]; lenses: readonly LensRatio[]; url: string;
};
// Product capabilities and empirical distance thresholds supplied by the owner.
// Product page URLs verified against the live store collections on 2026-10-20.
// Prices and availability are intentionally left to the product page.
export const PROJECTORS: readonly Projector[] = [
  { id: "indoor-35w", name: "35W Indoor Logo Projector", wattage: 35, environment: ["indoor"], lenses: [0.36, 0.5], url: `${STORE}/collections/indoor-logo-projectors/products/gobosolution-indoor-35w-logo-projector` },
  { id: "indoor-50w", name: "50W Indoor Logo Projector", wattage: 50, environment: ["indoor"], lenses: [0.36, 0.5], url: `${STORE}/collections/indoor-logo-projectors/products/gobosolution-indoor-50w-logo-projector` },
  { id: "outdoor-60w", name: "60W Outdoor Logo Projector", wattage: 60, environment: ["indoor", "outdoor"], lenses: [0.36, 0.5], url: `${STORE}/collections/outdoor-logo-projectors/products/gobosolution-outdoor-60w-logo-projector` },
  { id: "outdoor-80w", name: "80W Outdoor Logo Projector", wattage: 80, environment: ["indoor", "outdoor"], lenses: [0.36, 0.5, 0.8, 1], url: `${STORE}/collections/outdoor-logo-projectors/products/gobosolution-outdoor-80w-logo-projector` },
  { id: "outdoor-100w", name: "100W Outdoor Logo Projector", wattage: 100, environment: ["indoor", "outdoor"], lenses: [0.36, 0.5, 0.8, 1], url: `${STORE}/collections/outdoor-logo-projectors/products/gobosolution-outdoor-100w-logo-projector` },
  { id: "high-160w", name: "160W High-Power Logo Projector", wattage: 160, environment: ["indoor", "outdoor"], lenses: [0.3, 0.5, 1], url: `${STORE}/collections/high-power-logo-projectors/products/gobosolution-high-power-160w-logo-projector` },
  { id: "high-200w", name: "200W High-Power Logo Projector", wattage: 200, environment: ["indoor", "outdoor"], lenses: [0.3, 0.5, 1], url: `${STORE}/collections/high-power-logo-projectors/products/gobosolution-high-power-200w-logo-projector` },
  { id: "high-300w", name: "300W High-Power Logo Projector", wattage: 300, environment: ["indoor", "outdoor"], lenses: [0.3, 0.5, 1], url: `${STORE}/collections/high-power-logo-projectors/products/gobosolution-high-power-300w-logo-projector` },
];
export const WATTAGE_TABLE: Record<LightLevel, readonly (readonly [number, number])[]> = {
  dark: [[1,15],[2,20],[3,30],[4,40],[6,50],[8,90],[10,100],[15,160],[20,200],[30,300]],
  "slightly-dark": [[2,30],[3,40],[4,50],[6,90],[8,100],[10,160],[15,200],[20,300]],
  bright: [[2,40],[3,50],[4,90],[6,100],[8,160],[10,200],[15,300]],
};
const EPSILON = 1e-9;
export const MAX_ERROR_PERCENT = 15;
export function toMeters(value: number, unit: Unit) { return unit === "ft" ? value * 0.3048 : value; }
export function fromMeters(value: number, unit: Unit) { return unit === "ft" ? value / 0.3048 : value; }
export function displayNumber(value: number, decimals = 3) {
  return Number.isFinite(value) ? Number(value.toFixed(decimals)).toString() : "—";
}
export function referenceWattage(distanceM: number, light: LightLevel) {
  return WATTAGE_TABLE[light]?.find(([limit]) => distanceM <= limit + EPSILON)?.[1] ?? null;
}
export type SelectionInput = {
  distanceM: number; diameterM: number; environment: Environment; light: LightLevel;
  lens?: LensRatio;
};
export type Match = {
  kind: "match"; projector: Projector; lens: LensRatio; actualM: number;
  errorPct: number; grade: "Excellent Match" | "Good Match"; referenceWattage: number;
};
export type Selection = Match | { kind: "invalid" | "manual"; message: string };
export function findProjector(input: SelectionInput): Selection {
  const { distanceM, diameterM, environment, light, lens } = input;
  if (!Number.isFinite(distanceM) || !Number.isFinite(diameterM) || distanceM <= 0 || diameterM <= 0 ||
      !["indoor", "outdoor"].includes(environment) || !Object.hasOwn(LIGHT_LABELS, light) ||
      (lens !== undefined && !LENSES.includes(lens))) {
    return { kind: "invalid", message: "Enter a valid distance and image diameter greater than zero." };
  }
  if (diameterM / distanceM > 1 + EPSILON) {
    return { kind: "manual", message: "This image size needs a project-specific lens configuration." };
  }
  const minimum = referenceWattage(distanceM, light);
  if (minimum === null) return { kind: "manual", message: "This distance and light level need a project-specific review." };
  const matches: Match[] = [];
  for (const projector of PROJECTORS) {
    if (!projector.environment.includes(environment) || projector.wattage < minimum) continue;
    for (const ratio of projector.lenses) {
      if (lens !== undefined && lens !== ratio) continue;
      const actualM = distanceM * ratio;
      const errorPct = Math.abs(actualM - diameterM) / diameterM * 100;
      if (errorPct > MAX_ERROR_PERCENT + EPSILON) continue;
      matches.push({ kind: "match", projector, lens: ratio, actualM, errorPct,
        grade: errorPct <= 5 + EPSILON ? "Excellent Match" : "Good Match", referenceWattage: minimum });
    }
  }
  matches.sort((a,b) => Number(a.grade !== "Excellent Match") - Number(b.grade !== "Excellent Match") ||
    a.projector.wattage - b.projector.wattage || a.errorPct - b.errorPct);
  return matches[0] ?? { kind: "manual", message: "No standard setup matches within 15%. Please request a project review." };
}
export function recommendProjector(input: SelectionInput) {
  const result = findProjector(input);
  if (result.kind !== "match" || result.errorPct <= 5 + EPSILON) return { result, suggestion: null };
  const distanceM = input.diameterM / result.lens;
  // A distance adjustment is a new installation: recheck power and lens eligibility.
  const adjusted = findProjector({ ...input, distanceM, lens: result.lens });
  return { result, suggestion: adjusted.kind === "match" ? { distanceM, match: adjusted } : null };
}
