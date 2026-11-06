"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { calibrate, convertDistance, fitArtwork, normalizeFootprint, projectInstallation, type DistanceUnit, type Quad } from "./geometry";
import { renderArtwork } from "./render";
import { LENSES } from "../../lib/projector-rules";
import InstallationDiagram from "./InstallationDiagram";
import styles from "./keystone.module.css";

const NAMES = ["Top left", "Top right", "Bottom right", "Bottom left"];
const CORNER_EXAMPLE = [
  { x: -0.66, y: 0.55 }, { x: 0.54, y: 0.45 },
  { x: 0.54, y: -0.45 }, { x: -0.66, y: -0.55 },
];
const CORNER_GUIDE: Quad = [{ x: 0.12, y: 0.12 }, { x: 0.88, y: 0.12 }, { x: 0.88, y: 0.88 }, { x: 0.12, y: 0.88 }];
const CORNER_AXES = ["x", "y"] as const;
const SQUARE: Quad = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
const identity = (x: number, y: number) => ({ x, y });
const AIM = { x: 0.5, y: 0.5 };
const BRAND_LENS_RATIOS = LENSES.map(ratio => `1:${ratio}`).join(", ");
const INSTALLATION_FIELDS = [
  { key: "x", label: "X · Horizontal offset", hint: "Lens point left of target = negative. Right = positive." },
  { key: "y", label: "Y · Up/down offset", hint: "Toward the artwork bottom = negative. Toward the top = positive." },
  { key: "z", label: "Z · Perpendicular distance", hint: "Perpendicular from the surface to the lens. Always positive." },
  { key: "ratio", label: "Lens ratio · 1 : width", hint: `GoboSolution lens ratios by model: ${BRAND_LENS_RATIOS}. Enter 0.5 for 1:0.5.` },
] as const;
export default function KeystoneTool() {
  const [corners, setCorners] = useState(() => NAMES.map(() => ({ x: "", y: "" })));
  const [usePosition, setUsePosition] = useState(false);
  const [unit, setUnit] = useState<DistanceUnit>("m");
  const [position, setPosition] = useState({ x: "0", y: "0", z: "", ratio: "" });
  const installation = useMemo(() => {
    if (Object.values(position).some(value => value.trim() === "")) return null;
    return projectInstallation({
      x: convertDistance(Number(position.x), unit, "m"),
      y: convertDistance(Number(position.y), unit, "m"),
      z: convertDistance(Number(position.z), unit, "m"),
      widthRatio: Number(position.ratio),
    });
  }, [position, unit]);
  const [artwork, setArtwork] = useState<{ image: ImageData; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const before = useRef<HTMLCanvasElement>(null);
  const after = useRef<HTMLCanvasElement>(null);
  const uploadId = useRef(0);
  const cornersComplete = corners.every(point => point.x !== "" && point.y !== "");
  const measuredOutline = useMemo(() => cornersComplete
    ? normalizeFootprint(corners.map(point => ({ x: Number(point.x), y: Number(point.y) })))
    : null, [corners, cornersComplete]);
  const outline = usePosition ? installation?.corners : measuredOutline;
  const mapping = useMemo(() => outline ? calibrate(outline) : null, [outline]);
  const target = useMemo(() => mapping && outline && artwork
    ? fitArtwork(outline, artwork.image.width / artwork.image.height, AIM)
    : null, [mapping, outline, artwork]);

  useEffect(() => {
    const uncorrected = before.current?.getContext("2d");
    const corrected = after.current?.getContext("2d");
    if (!mapping || !target || !artwork) {
      for (const context of [uncorrected, corrected]) {
        if (context) context.clearRect(0, 0, context.canvas.width, context.canvas.height);
      }
      return;
    }
    const frame = requestAnimationFrame(() => {
      if (uncorrected) {
        const original = fitArtwork(SQUARE, artwork.image.width / artwork.image.height);
        renderArtwork(uncorrected, artwork.image, mapping.toProjector, original);
      }
      if (corrected) renderArtwork(corrected, artwork.image, identity, target);
    });
    return () => cancelAnimationFrame(frame);
  }, [mapping, target, artwork]);

  useEffect(() => () => { uploadId.current++; }, []);

  async function loadArtwork(file: File) {
    const id = ++uploadId.current;
    setLoading(false);
    setArtwork(null);
    setUploadError("");
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setUploadError("Choose a PNG or JPEG file up to 10 MB.");
      return;
    }
    setLoading(true);
    try {
      const bitmap = await createImageBitmap(file);
      try {
        if (uploadId.current !== id) return;
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas unavailable.");
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        setArtwork({ image, name: file.name });
      } finally {
        bitmap.close();
      }
    } catch {
      if (uploadId.current === id) setUploadError("The image could not be opened. Try a different PNG or JPEG.");
    } finally {
      if (uploadId.current === id) setLoading(false);
    }
  }

  function changeUnit(next: DistanceUnit) {
    const convert = (value: string) => {
      if (value === "") return "";
      const converted = convertDistance(Number(value), unit, next);
      return String(Number(converted.toFixed(8)) || converted);
    };
    setPosition(previous => ({
      ...previous,
      x: convert(previous.x), y: convert(previous.y), z: convert(previous.z),
    }));
    setCorners(previous => previous.map(point => ({ x: convert(point.x), y: convert(point.y) })));
    setUnit(next);
  }

  const displayDistance = (metres: number) => convertDistance(metres, "m", unit).toFixed(2);

  return (
    <main className={`simulator-inner ${styles.tool}`}>
      <header className="page-header">
        <a className="wordmark" href="https://gobosolution.com/" target="_top" aria-label="GoboSolution home">
          <Image src="/brand/gobosolution-logo.png" alt="GoboSolution" width={300} height={59} unoptimized />
        </a>
        <p className="eyebrow">LOGO PROJECTION TOOLS</p>
        <h1>GOBO Keystone Correction Tool</h1>
        <p>Prepare artwork for angled projection onto a wall, floor, or other flat surface.</p>
      </header>

      <div className={styles.layout}>
        <section className={styles.panel} aria-labelledby="keystone-calibration">
          <h2 id="keystone-calibration">1. Calibrate the projection</h2>
          <fieldset className={styles.mode}>
            <legend>Calibration method</legend>
            <label><input type="radio" name="keystone-method" checked={!usePosition}
              onChange={() => setUsePosition(false)} /> Installed projector · measure a test projection</label>
            <label><input type="radio" name="keystone-method" checked={usePosition}
              onChange={() => setUsePosition(true)} /> Plan an installation · enter X/Y/Z</label>
          </fieldset>
          <label className={styles.unit}>
            Distance unit
            <select value={unit} onChange={event => changeUnit(event.target.value === "in" ? "in" : "m")}>
              <option value="m">Metres (m)</option>
              <option value="in">Inches (in)</option>
            </select>
          </label>
          {usePosition ? <>
            <ol className={styles.measurementGuide}>
              <li>Mark the desired artwork center on the projection surface. This is the only origin, (0, 0). Decide which edge of the artwork should be the top, especially for floor projection.</li>
              <li>From the lens, follow a line perpendicular to the projection surface. Mark where it meets the surface as the lens point.</li>
              <li>From that same origin, measure X left or right and Y toward the bottom or top of the artwork to reach the lens point. Measure Z from the lens point perpendicular to the surface to reach the lens.</li>
            </ol>
            <p>The calculation assumes a flat surface, with the projector aimed at the target center and its image aligned to the chosen artwork orientation.</p>
            <InstallationDiagram unit={unit} />
            <div className={styles.measurements}>
              {INSTALLATION_FIELDS.map(({ key, label, hint }) => (
                <label key={key}>
                  {key === "ratio" ? label : `${label} (${unit})`}
                  <input type="number" step="any" inputMode={key === "x" || key === "y" ? "text" : "decimal"} value={position[key]}
                    aria-describedby={`keystone-hint-${key}`}
                    onChange={event => setPosition({ ...position, [key]: event.target.value })} />
                  <span id={`keystone-hint-${key}`}>{hint}</span>
                </label>
              ))}
            </div>
            {installation ? (
              <p role="status">Lens to target {displayDistance(installation.distance)} {unit} · Footprint {displayDistance(installation.width)} × {displayDistance(installation.height)} {unit}</p>
            ) : (
              <p role="status">Enter all four values. Z and the lens ratio must be positive, and all four image corners must reach the surface.</p>
            )}
          </> : <>
            <ol className={styles.measurementGuide}>
              <li>Use an existing test projection with a clear border that was square in the original artwork. Use the final lens, size, and orientation.</li>
              <li>Find where the two diagonals of the projected border cross. This is (0, 0). Number the corners from the top left, clockwise.</li>
              <li>From that center, measure each corner in two directions along the surface. X is left (−) or right (+). Y is toward the bottom (−) or top (+) of the artwork.</li>
            </ol>
            <div className={styles.measurements}>
              {NAMES.map((name, index) => (
                <fieldset key={name} className={styles.cornerFields}>
                  <legend>{index + 1}. {name}</legend>
                  {CORNER_AXES.map(axis => (
                    <label key={axis}>
                      {axis.toUpperCase()} ({unit})
                      <input type="number" step="any" value={corners[index][axis]}
                        onChange={event => {
                          const value = event.target.value;
                          setCorners(previous => previous.map((point, i) =>
                            i === index ? { ...point, [axis]: value } : point));
                        }} />
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
            <button type="button" onClick={() => setCorners(CORNER_EXAMPLE.map(point => ({
              x: String(Number(displayDistance(point.x))), y: String(Number(displayDistance(point.y))),
            })))}>Load example measurements</button>
            {!cornersComplete && <p className={styles.coordinates}>Enter X and Y for all four corners to see the measured outline.</p>}
            {cornersComplete && !mapping && <p className={styles.error} role="alert">
              Check the corner order and signs. The four corners must form a convex outline around (0, 0).
            </p>}
          </>}
          {(!usePosition || outline) && (
            <div className={styles.stage} role="group" aria-label={outline ? "Projection outline" : "Example corner order"}>
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <polygon points={(outline ?? CORNER_GUIDE).map(p => `${p.x * 100},${p.y * 100}`).join(" ")}
                  fill="none" stroke="#ffc77c" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                <circle cx="50" cy="50" r="1.5" fill="#ffc77c" />
                {!usePosition && (outline ?? CORNER_GUIDE).map((point, index) => (
                  <text key={NAMES[index]} x={point.x * 100} y={point.y * 100}
                    textAnchor="middle" dominantBaseline="central">{index + 1}</text>
                ))}
              </svg>
            </div>
          )}
        </section>

        <div className={styles.workspace}>
          <section className={styles.panel} aria-labelledby="keystone-artwork">
            <h2 id="keystone-artwork">2. Add artwork</h2>
            <div className={styles.upload}>
              <p className={styles.coordinates} id="keystone-file-formats">PNG or JPEG, up to 10 MB</p>
              <button type="button" aria-describedby="keystone-file-formats" onClick={() => fileInput.current?.click()}>
                {artwork ? "Replace artwork" : "Choose artwork"}
              </button>
              <input ref={fileInput} type="file" hidden accept="image/png,image/jpeg"
                onChange={event => {
                  const file = event.currentTarget.files?.[0];
                  if (file) void loadArtwork(file);
                  event.currentTarget.value = "";
                }} />
            </div>
            <p className={styles.coordinates} role="status">{loading ? "Reading artwork…" : artwork?.name}</p>
            {uploadError && <p className={styles.error} role="alert">{uploadError}</p>}
          </section>

          <section className={styles.panel} aria-labelledby="projection-comparison">
            <h2 id="projection-comparison">3. Compare on the projection surface</h2>
            <p>Both previews show the same surface area and projection footprint. Before uses artwork fitted to the projector image. After shows the expected artwork aligned to the chosen orientation at its original proportions, centered inside the footprint.</p>
            {!target && <p className={styles.coordinates}>Complete calibration and choose artwork to see the comparison.</p>}
            <div className={styles.comparisonGrid}>
              {[
                { label: "Before correction", canvas: before },
                { label: "After correction", canvas: after },
              ].map(({ label, canvas }) => (
                <figure key={label}>
                  <figcaption>{label}</figcaption>
                  <div className={styles.wallPreview}>
                    <canvas ref={canvas} width={360} height={360} role="img" aria-label={`${label}, expected view on the projection surface`} />
                    {mapping && outline && (
                      <svg viewBox="0 0 100 100" aria-hidden="true">
                        <polygon points={outline.map(p => `${p.x * 100},${p.y * 100}`).join(" ")}
                          fill="none" stroke="#ffc77c" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                      </svg>
                    )}
                  </div>
                </figure>
              ))}
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="keystone-export">
            <h2 id="keystone-export">4. Export corrected artwork</h2>
            <p>Calibration and Before / After previews are free. Downloading the corrected production PNG requires payment.</p>
            <p className={styles.coordinates}>Paid checkout and download are currently unavailable in this preview.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
