"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Canvas, FabricImage, FabricObject } from "fabric";

export type Placement = { scale: number; x: number; y: number; angle: number };
export type CanvasHandle = { exportPNG: () => Promise<Blob> };
type Props = Placement & {
  scene: string; logo: string; logoIsSvg: boolean; diameterM: number; rotating: boolean; resetKey: number;
  projectionBrightness: number; sceneBrightness: number;
  onPlacement: (placement: Partial<Placement>) => void;
  onReady: (ready: boolean) => void;
};
type FabricModule = typeof import("fabric");
type Context = {
  canvas: Canvas; fabric: FabricModule; scene: FabricImage | null; logo: FabricObject | null;
  sceneToken: number; logoToken: number; frame: number | null; resetKey: number; logoSource: string;
};
const bound = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
function baseWidth(ctx: Context, props: Props) {
  return ctx.canvas.getWidth() * .2 * bound(props.diameterM / 3, .4, 2.4);
}
function syncScene(ctx: Context, props: Props) {
  const img = ctx.scene;
  if (!img) return;
  const width = ctx.canvas.getWidth(), height = ctx.canvas.getHeight();
  const ratio = Math.max(width / img.width, height / img.height);
  img.set({ left: width / 2, top: height / 2, scaleX: ratio, scaleY: ratio });
  img.filters = [new ctx.fabric.filters.Brightness({ brightness: (props.sceneBrightness - 100) / 100 })];
  img.applyFilters();
  ctx.canvas.sendObjectToBack(img);
}
function syncLogo(ctx: Context, props: Props) {
  const img = ctx.logo;
  if (!img) return;
  img.scaleToWidth(baseWidth(ctx, props) * props.scale / 100);
  img.set({ left: props.x * ctx.canvas.getWidth(), top: props.y * ctx.canvas.getHeight(),
    opacity: props.projectionBrightness / 100,
    shadow: new ctx.fabric.Shadow({color:"rgba(255,255,255,0.4)",blur:8,offsetX:0,offsetY:0}),
  });
  if (!props.rotating) img.rotate(props.angle);
  img.setCoords();
  ctx.canvas.bringObjectToFront(img);
}

const ProjectionCanvas = forwardRef<CanvasHandle, Props>(function ProjectionCanvas(props, ref) {
  const element = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const context = useRef<Context | null>(null);
  const latest = useRef(props);
  const [ready, setReady] = useState(false);
  const [sceneLoading, setSceneLoading] = useState(true);
  const [logoLoading, setLogoLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { latest.current = props; });

  useEffect(() => {
    let active = true;
    let local: Context | null = null;
    let observer: ResizeObserver | undefined;
    async function initialize() {
      try {
        const fabric = await import("fabric");
        if (!active || !element.current || !container.current) return;
        const canvas = new fabric.Canvas(element.current, {
          preserveObjectStacking:true, selection:false, uniformScaling:true,
          backgroundColor:"#111827",
        });
        local = { canvas, fabric, scene:null, logo:null, sceneToken:0, logoToken:0, frame:null, resetKey:latest.current.resetKey, logoSource:latest.current.logo };
        context.current = local;
        const ctx = local;
        const resize = () => {
          if (!container.current) return;
          const width = container.current.clientWidth;
          if (!width) return;
          canvas.setDimensions({width, height:width * 9 / 16});
          syncScene(ctx, latest.current);
          syncLogo(ctx, latest.current);
          canvas.requestRenderAll();
        };
        resize();
        observer = new ResizeObserver(resize);
        observer.observe(container.current);
        canvas.on("object:modified", event => {
          if (event.target !== ctx.logo || !ctx.logo) return;
          latest.current.onPlacement({
            x:bound(ctx.logo.left / canvas.getWidth(),0,1),
            y:bound(ctx.logo.top / canvas.getHeight(),0,1),
            scale:bound(ctx.logo.getScaledWidth() / baseWidth(ctx,latest.current) * 100,25,250),
            angle:((ctx.logo.angle % 360)+360)%360,
          });
        });
        setReady(true);
      } catch { if (active) setError("The preview could not start. Please reload and try again."); }
    }
    void initialize();
    return () => {
      active = false;
      observer?.disconnect();
      if (local) {
        if (local.frame !== null) cancelAnimationFrame(local.frame);
        context.current = null;
        void local.canvas.dispose();
      }
    };
  }, []);

  useEffect(() => {
    const ctx = context.current;
    if (!ready || !ctx) return;
    const token = ++ctx.sceneToken;
    const abort = new AbortController();
    setSceneLoading(true);
    setError("");
    void ctx.fabric.FabricImage.fromURL(props.scene, {signal:abort.signal, crossOrigin:props.scene.startsWith("blob:") ? undefined : "anonymous"})
      .then(img => {
        if (context.current !== ctx || token !== ctx.sceneToken || abort.signal.aborted) { img.dispose(); return; }
        if (ctx.scene) { ctx.canvas.remove(ctx.scene); ctx.scene.dispose(); }
        ctx.scene = img;
        img.set({originX:"center",originY:"center",selectable:false,evented:false});
        ctx.canvas.add(img);
        syncScene(ctx, latest.current);
        ctx.canvas.requestRenderAll();
        setSceneLoading(false);
      }).catch(() => { if (!abort.signal.aborted) { setSceneLoading(false); setError("This scene could not be loaded. Try a different image."); } });
    return () => { abort.abort(); };
  }, [ready, props.scene]);

  useEffect(() => {
    const ctx = context.current;
    if (!ready || !ctx) return;
    const token = ++ctx.logoToken;
    const abort = new AbortController();
    setLogoLoading(true);
    setError("");
    const load = async () => {
      if (props.logoIsSvg) {
        const parsed = await ctx.fabric.loadSVGFromURL(props.logo, undefined, {signal:abort.signal});
        const objects = parsed.objects.filter((object): object is FabricObject => object !== null);
        if (!objects.length) throw new Error("SVG has no renderable artwork.");
        return ctx.fabric.util.groupSVGElements(objects, parsed.options);
      }
      return ctx.fabric.FabricImage.fromURL(props.logo, {signal:abort.signal, crossOrigin:props.logo.startsWith("blob:") ? undefined : "anonymous"});
    };
    void load().then(img => {
        if (!Number.isFinite(img.width) || !Number.isFinite(img.height) || img.width <= 0 || img.height <= 0) {
          img.dispose();
          throw new Error("Logo has invalid dimensions.");
        }
        if (context.current !== ctx || token !== ctx.logoToken || abort.signal.aborted) { img.dispose(); return; }
        if (ctx.logo) { ctx.canvas.remove(ctx.logo); ctx.logo.dispose(); }
        ctx.logo = img;
        img.set({originX:"center",originY:"center",lockScalingFlip:true});
        ctx.canvas.add(img);
        syncLogo(ctx, latest.current);
        ctx.canvas.requestRenderAll();
        setLogoLoading(false);
      }).catch(() => { if (!abort.signal.aborted) { setLogoLoading(false); setError("This logo could not be loaded. Try a PNG, JPG or self-contained SVG."); } });
    return () => { abort.abort(); };
  }, [ready, props.logo, props.logoIsSvg]);

  useEffect(() => {
    const ctx = context.current;
    if (!ctx) return;
    const resetRequested = ctx.resetKey !== props.resetKey || ctx.logoSource !== props.logo;
    ctx.resetKey = props.resetKey;
    ctx.logoSource = props.logo;
    if (!props.rotating && ctx.frame !== null) {
      cancelAnimationFrame(ctx.frame);
      ctx.frame = null;
      const angle = resetRequested ? props.angle : ctx.logo?.angle ?? props.angle;
      latest.current.onPlacement({angle});
      syncLogo(ctx, {...props,angle});
    } else syncLogo(ctx,props);
    if (props.rotating && ctx.frame === null && ctx.logo) {
      let previous = performance.now();
      const tick = (now: number) => {
        if (context.current !== ctx) return;
        if (ctx.logo) ctx.logo.rotate((ctx.logo.angle + Math.min(now-previous,100) * .025)%360);
        previous = now;
        ctx.canvas.requestRenderAll();
        ctx.frame = requestAnimationFrame(tick);
      };
      ctx.frame = requestAnimationFrame(tick);
    }
    ctx.canvas.requestRenderAll();
  }, [props, ready, logoLoading]);

  useEffect(() => {
    const ctx = context.current;
    if (!ctx) return;
    syncScene(ctx, latest.current);
    ctx.canvas.requestRenderAll();
  }, [props.sceneBrightness, ready, sceneLoading]);

  const {onReady} = props;
  const exportReady = ready && !sceneLoading && !logoLoading && !error;
  useEffect(() => { onReady(Boolean(exportReady)); }, [exportReady, onReady]);
  useImperativeHandle(ref, () => ({
    async exportPNG() {
      const ctx = context.current;
      if (!ctx?.logo || !ctx.scene) throw new Error("Wait for your scene and logo to load.");
      const active = ctx.canvas.getActiveObject();
      ctx.canvas.discardActiveObject();
      const watermark = new ctx.fabric.FabricText("GoboSolution", {
        left:ctx.canvas.getWidth()-10, top:ctx.canvas.getHeight()-10,
        originX:"right", originY:"bottom", fontSize:12, fontFamily:"Archivo",
        fill:"rgba(255,255,255,0.6)", selectable:false, evented:false,
      });
      ctx.canvas.add(watermark);
      ctx.canvas.renderAll();
      try {
        const blob = await ctx.canvas.toBlob({format:"png",multiplier:2});
        if (!blob) throw new Error("The PNG could not be created.");
        return blob;
      } finally {
        ctx.canvas.remove(watermark);
        watermark.dispose();
        if (active) ctx.canvas.setActiveObject(active);
        ctx.canvas.requestRenderAll();
      }
    },
  }), []);

  return <>
    <div className="projection-stage" ref={container} aria-label="Logo projection canvas">
      <canvas ref={element} />
      {(!ready || sceneLoading || logoLoading) && !error && <div className="canvas-status" role="status">Preparing your preview…</div>}
    </div>
    {error && <p className="error-message" role="alert">{error}</p>}
  </>;
});
export default ProjectionCanvas;
