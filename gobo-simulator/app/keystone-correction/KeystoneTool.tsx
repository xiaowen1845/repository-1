"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { calibrate, fitArtwork, type Point, type Quad } from "./geometry";
import { downloadPng, OUTPUT_SIZE, renderCorrection } from "./render";
import styles from "./keystone.module.css";

const NAMES = ["Top left", "Top right", "Bottom right", "Bottom left"];
const INITIAL: Quad = [
  { x: 0.14, y: 0.13 }, { x: 0.87, y: 0.21 },
  { x: 0.81, y: 0.77 }, { x: 0.19, y: 0.87 },
];
const SQUARE: Quad = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
const clamp = (value: number) => Math.min(1, Math.max(0, value));

export default function KeystoneTool() {
  const [corners, setCorners] = useState<Quad>(INITIAL);
  const [artwork, setArtwork] = useState<{ image: ImageData; url: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const stage = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const uploadId = useRef(0);
  const toWall = calibrate(corners);
  const target = toWall && artwork ? fitArtwork(corners, artwork.image.width / artwork.image.height) : null;

  useEffect(() => {
    const ctx = preview.current?.getContext("2d");
    if (!ctx) return;
    const map = calibrate(corners);
    if (!map || !artwork) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      return;
    }
    const frame = requestAnimationFrame(() => {
      renderCorrection(ctx, artwork.image, map, fitArtwork(corners, artwork.image.width / artwork.image.height));
    });
    return () => cancelAnimationFrame(frame);
  }, [corners, artwork]);

  useEffect(() => {
    return () => {
      if (artwork) URL.revokeObjectURL(artwork.url);
    };
  }, [artwork]);

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
    setError("");
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError("Choose a PNG or JPEG file up to 10 MB.");
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
        setArtwork({ image, url: URL.createObjectURL(file), name: file.name });
      } finally {
        bitmap.close();
      }
    } catch {
      if (uploadId.current === id) setError("The image could not be opened. Try a different PNG or JPEG.");
    } finally {
      if (uploadId.current === id) setLoading(false);
    }
  }

  async function exportImage(kind: "calibration" | "correction") {
    setError("");
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
        context.font = "bold 56px sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        ["1", "2", "3", "4"].forEach((label, index) => {
          context.fillText(label, SQUARE[index].x ? OUTPUT_SIZE - 80 : 80, SQUARE[index].y ? OUTPUT_SIZE - 80 : 80);
        });
        await downloadPng(canvas, "gobosolution-square-calibration.png");
      } else if (artwork && toWall && target) {
        renderCorrection(context, artwork.image, toWall, target);
        await downloadPng(canvas, "gobosolution-keystone-corrected.png");
      }
    } catch {
      setError("The PNG could not be downloaded. Please try again.");
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
        <section>
          <h2>1. Calibrate the projection</h2>
          <p>Project the square pattern at the final mounting angle, with the same lens and orientation you will use for the artwork. Keep the entire white border visible.</p>
          <button type="button" onClick={() => void exportImage("calibration")}>Download calibration pattern</button>
          <p>Measure the four outer corners on the wall within a square reference area that contains them all. Use the same scale horizontally and vertically, with the origin at the top left. Move points 1–4 to match those positions.</p>
          <div className={styles.stage} ref={stage} aria-label="Square wall reference">
            {target && artwork && (
              /* eslint-disable-next-line @next/next/no-img-element -- Browser-local artwork blob. */
              <img src={artwork.url} alt="Expected artwork on the wall"
                style={{ left: `${target.left * 100}%`, top: `${target.top * 100}%`,
                  width: `${target.width * 100}%`, height: `${target.height * 100}%` }} />
            )}
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <polygon points={corners.map(p => `${p.x * 100},${p.y * 100}`).join(" ")}
                fill="none" stroke={toWall ? "#ffc77c" : "#ff9a9a"} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            </svg>
            {corners.map((point, index) => (
              <button key={NAMES[index]} type="button" className={styles.handle}
                style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
                aria-label={`${NAMES[index]} corner, X ${Math.round(point.x * 100)}%, Y ${Math.round(point.y * 100)}%. Move with arrow keys.`}
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
          <div className={styles.actions}>
            <button type="button" onClick={() => setCorners(INITIAL)}>Reset to example</button>
            <button type="button" onClick={() => setCorners(SQUARE)}>Set to square</button>
          </div>
          <p className={styles.coordinates}>
            {corners.map((point, index) => `${index + 1}. ${Math.round(point.x * 100)}%, ${Math.round(point.y * 100)}%`).join(" · ")}
          </p>
          {!toWall && <p role="alert">Use four distinct corners in order. The outline must be convex and its edges must not cross.</p>}
        </section>

        <section>
          <h2>2. Add artwork and export</h2>
          <label className={styles.upload}>
            Choose artwork <span>PNG or JPEG, up to 10 MB</span>
            <input type="file" accept="image/png,image/jpeg"
              onChange={event => {
                const file = event.currentTarget.files?.[0];
                if (file) void loadArtwork(file);
                event.currentTarget.value = "";
              }} />
          </label>
          <p role="status">{loading ? "Reading artwork…" : artwork?.name}</p>
          <h3>Pre-distorted artwork</h3>
          <canvas ref={preview} width={480} height={480} className={styles.output}
            role="img" aria-label="Preview of the pre-distorted artwork" />
          <p>The orange outline shows the measured footprint. The artwork inside it shows the expected shape on the wall. Use the corrected PNG at the same size, position and orientation as the calibration pattern.</p>
          <button type="button" disabled={!target || loading} onClick={() => void exportImage("correction")}>
            Download corrected PNG
          </button>
          <p className={styles.coordinates}>1024 × 1024 px with transparent padding. Check alignment with a test projection before production.</p>
          {error && <p role="alert">{error}</p>}
        </section>
      </div>
    </main>
  );
}
