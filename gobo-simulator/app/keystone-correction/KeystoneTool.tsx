"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { calibrate, fitArtwork, projectInstallation, type Point, type Quad } from "./geometry";
import { downloadPng, OUTPUT_SIZE, renderArtwork } from "./render";
import styles from "./keystone.module.css";

const NAMES = ["Top left", "Top right", "Bottom right", "Bottom left"];
const INITIAL: Quad = [
  { x: 0.14, y: 0.13 }, { x: 0.87, y: 0.21 },
  { x: 0.81, y: 0.77 }, { x: 0.19, y: 0.87 },
];
const SQUARE: Quad = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
const identity = (x: number, y: number) => ({ x, y });
const AIM = { x: 0.5, y: 0.5 };
const INSTALLATION_FIELDS = [
  { key: "x", label: "X · Horizontal offset (m)", hint: "Positive to the right" },
  { key: "y", label: "Y · Vertical offset (m)", hint: "Positive above the target" },
  { key: "z", label: "Z · Perpendicular distance (m)", hint: "Measure straight out from the surface" },
  { key: "ratio", label: "Lens ratio · 1 : width", hint: "Enter 0.5 for a 1:0.5 lens" },
] as const;
const signedPercent = (value: number) => {
  const percent = Math.round(value * 100);
  return `${percent > 0 ? "+" : ""}${percent}%`;
};
const clamp = (value: number) => Math.min(1, Math.max(0, value));

export default function KeystoneTool() {
  const [corners, setCorners] = useState<Quad>(INITIAL);
  const [usePosition, setUsePosition] = useState(false);
  const [position, setPosition] = useState({ x: "0", y: "0", z: "", ratio: "" });
  const installation = useMemo(() => {
    if (Object.values(position).some(value => value.trim() === "")) return null;
    return projectInstallation({
      x: Number(position.x), y: Number(position.y), z: Number(position.z), widthRatio: Number(position.ratio),
    });
  }, [position]);
  const [artwork, setArtwork] = useState<{ image: ImageData; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [downloadError, setDownloadError] = useState<"calibration" | "correction" | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const before = useRef<HTMLCanvasElement>(null);
  const after = useRef<HTMLCanvasElement>(null);
  const uploadId = useRef(0);
  const outline = usePosition ? installation?.corners : corners;
  const mapping = useMemo(() => outline ? calibrate(outline) : null, [outline]);
  const center = useMemo(() => mapping?.toWall(AIM.x, AIM.y), [mapping]);
  const target = useMemo(() => center && outline && artwork
    ? fitArtwork(outline, artwork.image.width / artwork.image.height, center)
    : null, [center, outline, artwork]);
  const cornerOffsets = center && corners.map(point =>
    `X ${signedPercent(point.x - center.x)}, Y ${signedPercent(center.y - point.y)}`);

  useEffect(() => {
    const output = preview.current?.getContext("2d");
    const uncorrected = before.current?.getContext("2d");
    const corrected = after.current?.getContext("2d");
    if (!mapping || !target || !artwork) {
      for (const context of [output, uncorrected, corrected]) {
        if (context) context.clearRect(0, 0, context.canvas.width, context.canvas.height);
      }
      return;
    }
    const frame = requestAnimationFrame(() => {
      if (output) renderArtwork(output, artwork.image, mapping.toWall, target);
      if (uncorrected) {
        const original = fitArtwork(SQUARE, artwork.image.width / artwork.image.height);
        renderArtwork(uncorrected, artwork.image, mapping.toProjector, original);
      }
      if (corrected) renderArtwork(corrected, artwork.image, identity, target);
    });
    return () => cancelAnimationFrame(frame);
  }, [mapping, target, artwork]);

  useEffect(() => () => { uploadId.current++; }, []);

  function moveCorner(index: number, point: Point) {
    setCorners(previous => {
      const next: [Point, Point, Point, Point] = [...previous];
      next[index] = { x: clamp(point.x), y: clamp(point.y) };
      return next;
    });
  }

  function dragCorner(event: PointerEvent<HTMLButtonElement>, index: number) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !stage.current) return;
    const bounds = stage.current.getBoundingClientRect();
    moveCorner(index, {
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    });
  }

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

  async function exportImage(kind: "calibration" | "correction") {
    setDownloadError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = OUTPUT_SIZE;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable.");
      if (kind === "calibration") {
        context.fillStyle = "white";
        context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
        context.fillStyle = "black";
        context.fillRect(16, 16, OUTPUT_SIZE - 32, OUTPUT_SIZE - 32);
        context.fillStyle = "white";
        const midpoint = OUTPUT_SIZE / 2;
        context.fillRect(midpoint - 20, midpoint - 2, 40, 4);
        context.fillRect(midpoint - 2, midpoint - 20, 4, 40);
        context.font = "bold 56px sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        ["1", "2", "3", "4"].forEach((label, index) => {
          context.fillText(label, SQUARE[index].x ? OUTPUT_SIZE - 80 : 80, SQUARE[index].y ? OUTPUT_SIZE - 80 : 80);
        });
        await downloadPng(canvas, "gobosolution-square-calibration.png");
      } else if (artwork && mapping && target) {
        renderArtwork(context, artwork.image, mapping.toWall, target);
        await downloadPng(canvas, "gobosolution-keystone-corrected.png");
      }
    } catch {
      setDownloadError(kind);
    }
  }

  return (
    <main className={styles.tool}>
      <header>
        <p className={styles.brand}>GoboSolution</p>
        <h1>GOBO Keystone Correction Tool</h1>
        <p>Prepare artwork for a projector aimed at a flat surface from an angle.</p>
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
          {usePosition ? <>
            <p>Face the projection surface and use the intended artwork center as the origin. Measure from the projector lens. This estimate assumes a flat surface, a level image, and a lens aimed at the target center.</p>
            <div className={styles.measurements}>
              {INSTALLATION_FIELDS.map(({ key, label, hint }) => (
                <label key={key}>
                  {label}
                  <input type="number" step="any" inputMode={key === "x" || key === "y" ? "text" : "decimal"} value={position[key]}
                    aria-describedby={`keystone-hint-${key}`}
                    onChange={event => setPosition({ ...position, [key]: event.target.value })} />
                  <span id={`keystone-hint-${key}`}>{hint}</span>
                </label>
              ))}
            </div>
            {installation ? (
              <p role="status">Lens to target {installation.distance.toFixed(2)} m · Footprint {installation.width.toFixed(2)} × {installation.height.toFixed(2)} m</p>
            ) : (
              <p role="status">Enter all four values. Z and the lens ratio must be positive, and all four image corners must reach the surface.</p>
            )}
          </> : <>
            <p>Project the square pattern at the final mounting angle, with the same lens and orientation you will use for the artwork. Keep the entire white border visible.</p>
            <button type="button" onClick={() => void exportImage("calibration")}>Download calibration pattern</button>
            {downloadError === "calibration" && <p className={styles.error} role="alert">The pattern could not be downloaded. Try again.</p>}
            <p>Use the projected center cross as (0, 0). Pick a square reference area centered on the cross and large enough to contain all four corners. Move points 1–4 to match the white border, starting at the top left and going clockwise.</p>
          </>}
          <div className={styles.stage} ref={stage} role="group" aria-label="Square wall reference">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              {outline && <polygon points={outline.map(p => `${p.x * 100},${p.y * 100}`).join(" ")}
                fill="none" stroke={mapping ? "#ffc77c" : "#ff9a9a"} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
              {center && (
                <circle cx={center.x * 100} cy={center.y * 100} r="1.5" fill="#ffc77c" />
              )}
            </svg>
            {!usePosition && corners.map((point, index) => (
              <button key={NAMES[index]} type="button" className={styles.handle}
                style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
                aria-label={`${NAMES[index]} corner. ${cornerOffsets?.[index] ?? ""} Move with arrow keys.`}
                onPointerDown={event => event.currentTarget.setPointerCapture(event.pointerId)}
                onPointerMove={event => dragCorner(event, index)}
                onKeyDown={event => {
                  const step = event.shiftKey ? 0.05 : 0.01;
                  const dx = Number(event.key === "ArrowRight") - Number(event.key === "ArrowLeft");
                  const dy = Number(event.key === "ArrowDown") - Number(event.key === "ArrowUp");
                  if (dx || dy) {
                    event.preventDefault();
                    moveCorner(index, { x: point.x + dx * step, y: point.y + dy * step });
                  }
                }}>{index + 1}</button>
            ))}
          </div>
          {!usePosition && <>
            <div className={styles.actions}>
              <button type="button" onClick={() => setCorners(INITIAL)}>Reset to example</button>
              <button type="button" onClick={() => setCorners(SQUARE)}>Set to square</button>
            </div>
            {cornerOffsets && <>
              <p className={styles.coordinates}>Offsets from the center dot, as a percentage of the reference square. Positive X is right. Positive Y is up.</p>
              <ul className={styles.cornerList} aria-label="Corner offsets from the projection center">
                {cornerOffsets.map((offset, index) => (
                  <li key={NAMES[index]}>{index + 1}. {offset}</li>
                ))}
              </ul>
            </>}
            {!mapping && <p className={styles.error} role="alert">Use four distinct corners in order. The outline must be convex and its edges must not cross.</p>}
          </>}
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
            <h2 id="projection-comparison">3. Compare on the wall</h2>
            <p>Both previews show the same wall area and projection footprint. Before uses artwork fitted to the projector image. After shows the expected upright artwork at its original proportions, centered inside the footprint.</p>
            {!target && <p className={styles.coordinates}>Complete calibration and choose artwork to see the comparison.</p>}
            <div className={styles.comparisonGrid}>
              {[
                { label: "Before correction", canvas: before },
                { label: "After correction", canvas: after },
              ].map(({ label, canvas }) => (
                <figure key={label}>
                  <figcaption>{label}</figcaption>
                  <div className={styles.wallPreview}>
                    <canvas ref={canvas} width={360} height={360} role="img" aria-label={`${label}, expected view on the wall`} />
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
            <canvas ref={preview} width={480} height={480} className={styles.output}
              role="img" aria-label="Preview of the pre-distorted artwork" />
            <p>{usePosition
                ? "Keep the modeled lens position and aim when projecting the corrected image."
                : "Use the corrected PNG at the same size, position and orientation as the calibration pattern."}</p>
            {!target && <p className={styles.coordinates}>Complete calibration and add artwork to enable the download.</p>}
            <button type="button" disabled={!target || loading} onClick={() => void exportImage("correction")}>
              Download corrected PNG
            </button>
            <p className={styles.coordinates}>1024 × 1024 px with transparent padding. Check alignment with a test projection before production.</p>
            {downloadError === "correction" && <p className={styles.error} role="alert">The corrected PNG could not be downloaded. Try again.</p>}
          </section>
        </div>
      </div>
    </main>
  );
}
