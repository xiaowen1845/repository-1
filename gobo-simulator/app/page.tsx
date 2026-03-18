"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useRef, useState } from "react";

type Scenario = "indoor" | "outdoor" | "high";
type LocationLight = "Dark" | "Normal" | "Bright";
type ProjectionMode = "Static" | "Rotation";

type ProductInfo = {
  title: string;
  price: string;
  image: string;
  url: string;
  wattageW: number;
};

const BRAND = {
  orange: "#ED9121",
  darkBg: "#0B1220",
  cardBg: "#1F2937",
  canvasBg: "#111827",
  text: "#FFFFFF",
  muted: "#9CA3AF",
} as const;

const BASE_DIAMETER_FT = 3.3;

const LOGO_LIBRARY = [
  { id: "restaurant", label: "Restaurant Logo", src: "/logos/restaurant.png" },
  { id: "bar", label: "Bar Logo", src: "/logos/bar.png" },
  { id: "cafe", label: "Cafe Logo", src: "/logos/cafe.png" },
  { id: "sale", label: "Sale Logo", src: "/logos/sale.png" },
  { id: "vip", label: "VIP Logo", src: "/logos/vip.png" },
] as const;

const SCENE_LIBRARY = [
  { id: "empty", label: "Empty Wall", src: "/scenes/wall.jpg" },
  { id: "restaurant", label: "Restaurant Wall", src: "/scenes/restaurant-wall.jpg" },
  { id: "bar", label: "Bar Interior", src: "/scenes/bar-interior.jpg" },
  { id: "retail", label: "Retail Store Entrance", src: "/scenes/retail-entrance.jpg" },
  { id: "hotel", label: "Hotel Lobby", src: "/scenes/hotel-lobby.jpg" },
  { id: "parking", label: "Parking Lot", src: "/scenes/parking-lot.jpg" },
  { id: "building", label: "Building Exterior", src: "/scenes/building-exterior.jpg" },
  { id: "floor", label: "Floor Projection", src: "/scenes/floor-projection.jpg" },
] as const;

const SCENARIO_CONFIG: Record<
  Scenario,
  {
    label: string;
    description: string;
    wattageOptions: readonly number[];
    lensOptions: readonly number[];
    goboSizeMm: number;
  }
> = {
  indoor: {
    label: "Indoor Projection",
    description: "Bars, restaurants, retail stores",
    wattageOptions: [25, 35, 50],
    lensOptions: [0.2, 0.33, 0.5, 0.65, 1.0],
    goboSizeMm: 37.5,
  },
  outdoor: {
    label: "Outdoor Projection",
    description: "Storefront walls and outdoor signage",
    wattageOptions: [60, 80, 100],
    lensOptions: [0.2, 0.3, 0.5, 0.65, 1.0],
    goboSizeMm: 37.5,
  },
  high: {
    label: "Long Distance Projection",
    description: "Large buildings, landmarks, event projection",
    wattageOptions: [120, 150, 200],
    lensOptions: [0.2, 0.33, 0.45, 0.65, 1.0],
    goboSizeMm: 53,
  },
} as const;

const PRODUCT_MAP: Record<string, ProductInfo> = {
  "indoor-25": {
    title: "25W Indoor Logo Projector",
    price: "$399",
    image: "/products/25w.jpg",
    url: "/products/25w",
    wattageW: 25,
  },
  "indoor-35": {
    title: "35W Indoor Logo Projector",
    price: "$499",
    image: "/products/35w.jpg",
    url: "/products/35w",
    wattageW: 35,
  },
  "indoor-50": {
    title: "50W Indoor Logo Projector",
    price: "$599",
    image: "/products/50w.jpg",
    url: "/products/50w",
    wattageW: 50,
  },
  "outdoor-60": {
    title: "60W Outdoor Logo Projector",
    price: "$699",
    image: "/products/60w.jpg",
    url: "/products/60w",
    wattageW: 60,
  },
  "outdoor-80": {
    title: "80W Outdoor Logo Projector",
    price: "$799",
    image: "/products/80w.jpg",
    url: "/products/80w",
    wattageW: 80,
  },
  "outdoor-100": {
    title: "100W Outdoor Logo Projector",
    price: "$899",
    image: "/products/100w.jpg",
    url: "/products/100w",
    wattageW: 100,
  },
  "high-120": {
    title: "120W Long Throw Logo Projector",
    price: "$999",
    image: "/products/120w.jpg",
    url: "/products/120w",
    wattageW: 120,
  },
  "high-150": {
    title: "150W Long Throw Logo Projector",
    price: "$1,199",
    image: "/products/150w.jpg",
    url: "/products/150w",
    wattageW: 150,
  },
  "high-200": {
    title: "200W Long Throw Logo Projector",
    price: "$1,499",
    image: "/products/200w.jpg",
    url: "/products/200w",
    wattageW: 200,
  },
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function recommendLens(distanceFt: number) {
  if (distanceFt < 10) return 0.2;
  if (distanceFt < 20) return 0.33;
  if (distanceFt < 40) return 0.5;
  if (distanceFt < 60) return 0.65;
  return 1.0;
}

function closestAvailableLens(target: number, available: readonly number[]) {
  if (available.length === 0) return target;
  let best = available[0]!;
  let bestDelta = Math.abs(best - target);
  for (const v of available) {
    const d = Math.abs(v - target);
    if (d < bestDelta) {
      best = v;
      bestDelta = d;
    }
  }
  return best;
}

function toLensRatio(n: string, allowed: readonly number[]): number {
  const parsed = Number(n);
  if (!allowed.includes(parsed)) return allowed[0] ?? 0.33;
  return parsed;
}

function formatNumber(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function locationLightToOpacity(light: LocationLight) {
  if (light === "Dark") return 0.92;
  if (light === "Normal") return 0.78;
  return 0.62;
}

function locationLightToGlow(light: LocationLight) {
  if (light === "Dark") return 38;
  if (light === "Normal") return 28;
  return 18;
}

function recommendWattage(scenario: Scenario, distanceFt: number) {
  const d = distanceFt;
  if (scenario === "indoor") {
    if (d < 10) return 25;
    if (d < 20) return 35;
    return 50;
  }
  if (scenario === "outdoor") {
    if (d < 30) return 60;
    if (d < 40) return 80;
    return 100;
  }
  if (d < 80) return 120;
  if (d < 120) return 150;
  return 200;
}

function projectorRecommendation(scenario: Scenario, distanceFt: number) {
  const wattageW = recommendWattage(scenario, distanceFt);
  const key = `${scenario === "high" ? "high" : scenario}-${wattageW}`;
  const product = PRODUCT_MAP[key];
  if (product) {
    return { productKey: key, projectorName: product.title, wattageW: product.wattageW, href: product.url };
  }
  // Fallback (shouldn't happen unless PRODUCT_MAP is incomplete)
  return { productKey: key, projectorName: `${wattageW}W Logo Projector`, wattageW, href: "/products" };
}

export default function Home() {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<any | null>(null);
  const canvasRef = useRef<any | null>(null);
  const sceneRef = useRef<any | null>(null);
  const logoObjectRef = useRef<any | null>(null);
  const widthLineRef = useRef<any | null>(null);
  const heightLineRef = useRef<any | null>(null);
  const widthLabelRef = useRef<any | null>(null);
  const heightLabelRef = useRef<any | null>(null);
  const rafRef = useRef<number | null>(null);
  const locationLightRef = useRef<LocationLight>("Normal");

  const logoUploadRef = useRef<HTMLInputElement | null>(null);
  const sceneUploadRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [scenario, setScenario] = useState<Scenario>("indoor");
  const [logo, setLogo] = useState<string | null>(null);
  const [scene, setScene] = useState<string | null>(null);

  const [selectedLogoId, setSelectedLogoId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

  const [distance, setDistance] = useState<number>(10);
  const [lensRatio, setLensRatio] = useState<number>(0.33);
  const [locationLight, setLocationLight] = useState<LocationLight>("Normal");
  const [projectionMode, setProjectionMode] = useState<ProjectionMode>("Static");

  const projectionDiameterFt = useMemo(() => distance * lensRatio, [distance, lensRatio]);
  const projectionDiameterM = useMemo(() => projectionDiameterFt * 0.3048, [projectionDiameterFt]);
  const goboSizeMm = useMemo(() => SCENARIO_CONFIG[scenario].goboSizeMm, [scenario]);

  const recommendedProjector = useMemo(
    () => projectorRecommendation(scenario, distance),
    [scenario, distance],
  );

  const distanceRef = useRef(distance);
  const lensRatioRef = useRef(lensRatio);

  const ensureLayerOrder = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = sceneRef.current;
    const logo = logoObjectRef.current;

    const guides = [
      widthLineRef.current,
      heightLineRef.current,
      widthLabelRef.current,
      heightLabelRef.current,
    ].filter(Boolean);

    if (scene) {
      canvas.sendObjectToBack(scene);
    }

    if (logo) {
      canvas.bringObjectToFront(logo);
    }

    guides.forEach((obj) => {
      canvas.bringObjectToFront(obj);
    });
  }, []);

  const updateDimensionLabels = React.useCallback((diameterFt: number) => {
    const fabric = fabricRef.current;
    const canvas = canvasRef.current;
    const logo = logoObjectRef.current;
    if (!fabric || !canvas || !logo) return;

    const FabricLine = fabric.Line;
    const FabricText = fabric.Text;

    const logoWidth =
      typeof logo.getScaledWidth === "function"
        ? logo.getScaledWidth()
        : (logo.width || 0) * (logo.scaleX || 1);
    const logoHeight =
      typeof logo.getScaledHeight === "function"
        ? logo.getScaledHeight()
        : (logo.height || 0) * (logo.scaleY || 1);

    const logoCenterX = logo.left ?? canvas.width / 2;
    const logoCenterY = logo.top ?? canvas.height / 2;

    const topDimensionY = logoCenterY - logoHeight / 2 - 40;
    const rightDimensionX = logoCenterX + logoWidth / 2 + 40;

    const horizontalStartX = logoCenterX - logoWidth / 2;
    const horizontalEndX = logoCenterX + logoWidth / 2;

    const verticalStartY = logoCenterY - logoHeight / 2;
    const verticalEndY = logoCenterY + logoHeight / 2;

    const dimensionLabel = `${formatNumber(diameterFt, 2)} ft`;

    if (!widthLineRef.current) {
      widthLineRef.current = new FabricLine(
        [horizontalStartX, topDimensionY, horizontalEndX, topDimensionY],
        {
          stroke: "#FFFFFF",
          strokeWidth: 2,
          selectable: false,
          evented: false,
        },
      );
      canvas.add(widthLineRef.current);
    } else {
      widthLineRef.current.set({
        x1: horizontalStartX,
        y1: topDimensionY,
        x2: horizontalEndX,
        y2: topDimensionY,
      });
    }

    if (!heightLineRef.current) {
      heightLineRef.current = new FabricLine(
        [rightDimensionX, verticalStartY, rightDimensionX, verticalEndY],
        {
          stroke: "#FFFFFF",
          strokeWidth: 2,
          selectable: false,
          evented: false,
        },
      );
      canvas.add(heightLineRef.current);
    } else {
      heightLineRef.current.set({
        x1: rightDimensionX,
        y1: verticalStartY,
        x2: rightDimensionX,
        y2: verticalEndY,
      });
    }

    if (!widthLabelRef.current) {
      widthLabelRef.current = new FabricText(dimensionLabel, {
        left: logoCenterX,
        top: topDimensionY,
        originX: "center",
        originY: "center",
        fontSize: 14,
        fill: "#FFFFFF",
        backgroundColor: "rgba(0,0,0,0.55)",
        padding: 6,
        selectable: false,
        evented: false,
      });
      canvas.add(widthLabelRef.current);
    } else {
      widthLabelRef.current.set({
        text: dimensionLabel,
        left: logoCenterX,
        top: topDimensionY,
      });
      widthLabelRef.current.setCoords();
    }

    if (!heightLabelRef.current) {
      heightLabelRef.current = new FabricText(dimensionLabel, {
        left: rightDimensionX,
        top: logoCenterY,
        originX: "center",
        originY: "center",
        fontSize: 14,
        fill: "#FFFFFF",
        backgroundColor: "rgba(0,0,0,0.55)",
        padding: 6,
        selectable: false,
        evented: false,
      });
      canvas.add(heightLabelRef.current);
    } else {
      heightLabelRef.current.set({
        text: dimensionLabel,
        left: rightDimensionX,
        top: logoCenterY,
      });
      heightLabelRef.current.setCoords();
    }

    ensureLayerOrder();
    canvas.requestRenderAll();
  }, [ensureLayerOrder]);

  const updateProjectionSize = React.useCallback(
    (diameterFt: number) => {
      const canvas = canvasRef.current;
      const logo = logoObjectRef.current;
      if (!canvas || !logo) return;

      if (!Number.isFinite(diameterFt) || diameterFt <= 0) return;

      const BASE_PROJECTION_WIDTH = canvas.getWidth() * 0.15;
      const rawScale = Math.pow(diameterFt / BASE_DIAMETER_FT, 0.5);
      const scaleFactor = clamp(rawScale, 0.6, 2.2);
      const targetWidth = BASE_PROJECTION_WIDTH * scaleFactor;

      if (typeof logo.scaleToWidth === "function") {
        logo.scaleToWidth(targetWidth);
        logo.setCoords();
        (logo as any).__goboBaseScaleX = logo.scaleX ?? 1;
        (logo as any).__goboBaseScaleY = logo.scaleY ?? 1;
      }

      updateDimensionLabels(diameterFt);
      ensureLayerOrder();
      canvas.requestRenderAll();
    },
    [updateDimensionLabels, ensureLayerOrder],
  );

  const applyProjectionEffect = React.useCallback(() => {
    const fabric = fabricRef.current;
    const canvas = canvasRef.current;
    const obj = logoObjectRef.current;
    if (!fabric || !canvas || !obj) return;

    const FabricShadow = fabric.Shadow;

    const d = distanceRef.current;
    const distanceOpacity = clamp(0.9 - d / 120, 0.45, 0.9);
    const lightOpacity = locationLightToOpacity(locationLightRef.current);
    const opacity = clamp(distanceOpacity * (lightOpacity / 0.78), 0.35, 0.95);
    const glow = locationLightToGlow(locationLightRef.current);

    obj.set({
      opacity,
      shadow: new FabricShadow({
        color: "rgba(237, 145, 33, 0.65)",
        blur: glow,
        offsetX: 0,
        offsetY: 0,
      }),
    });

    if (obj.type === "image" && obj.filters) {
      const Blur = fabric.Image?.filters?.Blur;
      if (Blur) {
        obj.filters = [new Blur({ blur: d / 80 })];
        obj.applyFilters();
      }
    }

    ensureLayerOrder();
    canvas.requestRenderAll();
  }, [ensureLayerOrder]);

  useEffect(() => {
    locationLightRef.current = locationLight;
    applyProjectionEffect();
  }, [locationLight, applyProjectionEffect]);

  const loadScene = async (src: string) => {
    const fabric = fabricRef.current;
    const canvas = canvasRef.current;

    if (!fabric || !canvas) return;

    const FabricImage = fabric.Image;

    try {
      // Remove old scene
      if (sceneRef.current) {
        canvas.remove(sceneRef.current);
        sceneRef.current = null;
      }

      // Load image
      const img = await FabricImage.fromURL(src, { crossOrigin: "anonymous" });

      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();

      const scale = Math.max(canvasWidth / img.width, canvasHeight / img.height);

      img.set({
        originX: "center",
        originY: "center",
        left: canvasWidth / 2,
        top: canvasHeight / 2,
        scaleX: scale,
        scaleY: scale,
        selectable: false,
        evented: false,
      });
      canvas.add(img);
      sceneRef.current = img;
      ensureLayerOrder();
      canvas.requestRenderAll();
    } catch (err) {
      console.error("Scene load failed:", err);
    }
  };

  const clearRotationLoop = React.useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startRotationLoop = React.useCallback(() => {
    clearRotationLoop();
    const canvas = canvasRef.current;
    const obj = logoObjectRef.current;
    if (!canvas || !obj) return;

    const tick = () => {
      if (!canvasRef.current || !logoObjectRef.current) return;
      logoObjectRef.current.rotate(((logoObjectRef.current.angle ?? 0) + 0.35) % 360);
      canvasRef.current.requestRenderAll();
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [clearRotationLoop]);

  const placeLogo = React.useCallback(
    (src: string) => {
      const fabric = fabricRef.current;
      const canvas = canvasRef.current;
      if (!fabric || !canvas) return;

      const FabricImage = fabric.Image;
      if (!FabricImage?.fromURL) return;

      const isBlobUrl = src.startsWith("blob:");
      const loadOptions = isBlobUrl ? {} : { crossOrigin: "anonymous" as const };

      (async () => {
        try {
          const img = await FabricImage.fromURL(src, loadOptions);
          if (!img || !canvasRef.current) return;

          const canvasInstance = canvasRef.current;

          if (logoObjectRef.current) {
            canvasInstance.remove(logoObjectRef.current);
            logoObjectRef.current = null;
          }

          img.set({
            left: canvasInstance.width / 2,
            top: canvasInstance.height / 2,
            originX: "center",
            originY: "center",
            selectable: true,
            evented: true,
          });

          canvasInstance.add(img);
          canvasInstance.setActiveObject(img);

          logoObjectRef.current = img;

          const diameterFt = distanceRef.current * lensRatioRef.current;
          if (Number.isFinite(diameterFt) && diameterFt > 0) {
            updateProjectionSize(diameterFt);
          }
          applyProjectionEffect();
          ensureLayerOrder();

          canvasInstance.requestRenderAll();
        } catch (err) {
          console.error("Failed to load logo image", err);
        }
      })();
    }, [applyProjectionEffect, updateProjectionSize, ensureLayerOrder]);

  const exportMockup = React.useCallback(() => {
    const fabric = fabricRef.current;
    const canvas = canvasRef.current;
    if (!fabric || !canvas) return;

    const FabricText = fabric.Text;
    const canvasWidth = canvas.getWidth?.() ?? 800;
    const canvasHeight = canvas.getHeight?.() ?? 450;

    const watermark = new FabricText("Generated by gobosolution.com", {
      left: canvasWidth - 14,
      top: canvasHeight - 14,
      originX: "right",
      originY: "bottom",
      fontSize: 16,
      fill: "rgba(255,255,255,0.55)",
      fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto",
      selectable: false,
      evented: false,
    });

    canvas.add(watermark);
    canvas.requestRenderAll();

    const dataUrl = canvas.toDataURL({
      format: "png",
      multiplier: 2,
      enableRetinaScaling: true,
    });

    canvas.remove(watermark);
    canvas.requestRenderAll();

    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "logo-projection-mockup.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, []);

  useEffect(() => {
    return () => {
      clearRotationLoop();
      try {
        canvasRef.current?.dispose?.();
      } finally {
        canvasRef.current = null;
        sceneRef.current = null;
        fabricRef.current = null;
        logoObjectRef.current = null;
        widthLineRef.current = null;
        heightLineRef.current = null;
        widthLabelRef.current = null;
        heightLabelRef.current = null;
      }
    };
  }, [clearRotationLoop]);

  useEffect(() => {
    if (step === 3) return;
    if (canvasRef.current) {
      canvasRef.current.dispose();
      canvasRef.current = null;
    }

    fabricRef.current = null;
    logoObjectRef.current = null;
    sceneRef.current = null;
  }, [step]);

  useEffect(() => {
    if (step !== 3) return;
    if (!canvasElRef.current) return;
    if (canvasRef.current) return;

    let cancelled = false;

    async function initCanvas() {
      const mod = await import("fabric");
      if (cancelled) return;

      const Canvas = mod.Canvas;
      const FabricImage = mod.Image;
      const FabricText = mod.Text;
      const FabricLine = mod.Line;
      const FabricShadow = mod.Shadow;
      void FabricImage;
      void FabricText;
      void FabricLine;
      void FabricShadow;

      fabricRef.current = mod;

      const el = canvasElRef.current;
      if (!el) return;

      const container = el.parentElement;
      const containerWidth = container?.offsetWidth || 800;
      const canvasWidth = Math.min(containerWidth, 800);
      const canvasHeight = (canvasWidth * 9) / 16;

      const canvas = new Canvas(el, {
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: undefined,
        preserveObjectStacking: true,
        selection: true,
      });

      canvasRef.current = canvas;
      (canvasRef as any).currentWidth = canvasWidth;
      (canvasRef as any).currentHeight = canvasHeight;

      loadScene(scene ?? "/scenes/wall.jpg");

      canvas.on("after:render", () => {
        ensureLayerOrder();
      });

      canvas.on("mouse:down", () => {
        document.body.style.touchAction = "none";
      });

      canvas.on("mouse:up", () => {
        document.body.style.touchAction = "auto";
      });

      canvas.on("object:modified", (e: any) => {
        applyProjectionEffect();
        if (e?.target === logoObjectRef.current) {
          const diameterFt = distanceRef.current * lensRatioRef.current;
          if (Number.isFinite(diameterFt) && diameterFt > 0) {
            updateDimensionLabels(diameterFt);
          }
        }
        ensureLayerOrder();
      });
      canvas.on("object:scaling", (e: any) => {
        applyProjectionEffect();
        if (e?.target === logoObjectRef.current) {
          const obj = logoObjectRef.current;
          (obj as any).__goboBaseScaleX = obj.scaleX ?? 1;
          (obj as any).__goboBaseScaleY = obj.scaleY ?? 1;
          const diameterFt = distanceRef.current * lensRatioRef.current;
          if (Number.isFinite(diameterFt) && diameterFt > 0) {
            updateDimensionLabels(diameterFt);
          }
        }
        ensureLayerOrder();
      });
      canvas.on("object:rotating", (e: any) => {
        applyProjectionEffect();
        if (e?.target === logoObjectRef.current) {
          const diameterFt = distanceRef.current * lensRatioRef.current;
          if (Number.isFinite(diameterFt) && diameterFt > 0) {
            updateDimensionLabels(diameterFt);
          }
        }
        ensureLayerOrder();
      });
      canvas.on("object:moving", (e: any) => {
        applyProjectionEffect();
        if (e?.target === logoObjectRef.current) {
          const diameterFt = distanceRef.current * lensRatioRef.current;
          if (Number.isFinite(diameterFt) && diameterFt > 0) {
            updateDimensionLabels(diameterFt);
          }
        }
        ensureLayerOrder();
      });

      if (logo) placeLogo(logo);
      setTimeout(() => {
        ensureLayerOrder();
        canvas.requestRenderAll();
      }, 50);
    }

    initCanvas();

    return () => {
      cancelled = true;
    };
  }, [step]);

  useEffect(() => {
    if (projectionMode === "Rotation") startRotationLoop();
    else clearRotationLoop();
  }, [projectionMode, startRotationLoop, clearRotationLoop]);

  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !canvasElRef.current) return;

      const container = canvasElRef.current.parentElement;
      if (!container) return;

      const width = Math.min(container.offsetWidth, 800);
      const height = (width * 9) / 16;

      canvasRef.current.setWidth(width);
      canvasRef.current.setHeight(height);

      if (sceneRef.current) {
        const img = sceneRef.current;

        const scale = Math.max(
          width / img.width,
          height / img.height,
        );

        img.set({
          scaleX: scale,
          scaleY: scale,
          left: width / 2,
          top: height / 2,
        });
      }

      canvasRef.current.requestRenderAll();
    };

    if (step !== 3) return;

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [step]);

  useEffect(() => {
    distanceRef.current = distance;
    lensRatioRef.current = lensRatio;

    const diameterFt = distance * lensRatio;
    if (!Number.isFinite(diameterFt) || diameterFt <= 0) return;

    updateProjectionSize(diameterFt);
    applyProjectionEffect();
  }, [distance, lensRatio, updateProjectionSize]);

  const projectionDiameterText = useMemo(() => {
    const ft = formatNumber(projectionDiameterFt, 2);
    const m = formatNumber(projectionDiameterM, 2);
    return { ft, m };
  }, [projectionDiameterFt, projectionDiameterM]);

  const goboText = useMemo(() => `${goboSizeMm}mm`, [goboSizeMm]);

  const lensOptions = useMemo(() => SCENARIO_CONFIG[scenario].lensOptions, [scenario]);

  useEffect(() => {
    if (lensOptions.includes(lensRatio)) return;
    setLensRatio(lensOptions[0] ?? 0.33);
  }, [scenario, lensOptions, lensRatio]);

  const recommendedLensRatio = useMemo(() => closestAvailableLens(recommendLens(distance), lensOptions), [distance, lensOptions]);

  const recommendedProduct = useMemo(() => {
    return PRODUCT_MAP[recommendedProjector.productKey] ?? null;
  }, [recommendedProjector.productKey]);

  return (
    <div
      className="min-h-screen w-full"
      style={{
        backgroundColor: BRAND.darkBg,
        color: BRAND.text,
      }}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-2">
          <div className="inline-flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-xl"
              style={{
                background:
                  "radial-gradient(90% 90% at 30% 20%, rgba(237,145,33,0.65) 0%, rgba(237,145,33,0.18) 35%, rgba(17,24,39,0.0) 70%), #111827",
                border: "1px solid rgba(237,145,33,0.25)",
              }}
            />
            <div className="flex flex-col">
              <h1 className="text-2xl font-semibold tracking-tight">GOBO Logo Projection Simulator</h1>
              <p className="text-sm" style={{ color: BRAND.muted }}>
                Configure your scenario, upload assets, preview projection, and get a product match.
              </p>
            </div>
          </div>
        </header>

        <style jsx global>{`
          canvas {
            touch-action: none;
          }
        `}</style>

        <div className="flex flex-col gap-4">
          <div
            className="rounded-xl border px-4 py-3"
            style={{ backgroundColor: BRAND.cardBg, borderColor: "rgba(255,255,255,0.10)" }}
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { k: 1 as const, label: "Step 1 — Scenario" },
                { k: 2 as const, label: "Step 2 — Logo & Scene" },
                { k: 3 as const, label: "Step 3 — Preview" },
              ].map((s) => {
                const active = step === s.k;
                const done = step > s.k;
                return (
                  <button
                    key={s.k}
                    type="button"
                    onClick={() => setStep(s.k)}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-white/5"
                    style={{
                      borderColor: active ? "rgba(237,145,33,0.45)" : "rgba(255,255,255,0.10)",
                      backgroundColor: active ? "rgba(237,145,33,0.10)" : "rgba(17,24,39,0.35)",
                      color: BRAND.text,
                    }}
                  >
                    <span className="truncate">{s.label}</span>
                    <span className="ml-3 text-xs" style={{ color: done ? BRAND.orange : BRAND.muted }}>
                      {done ? "Done" : active ? "Current" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {step === 1 && (
            <main
              className="rounded-xl border p-6"
              style={{ backgroundColor: BRAND.cardBg, borderColor: "rgba(255,255,255,0.10)" }}
            >
              <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-lg font-semibold">Select Use Scenario</h2>
                    <p className="text-sm" style={{ color: BRAND.muted }}>
                      Choose where you’ll project. We’ll auto-configure the technical settings in Step 3.
                    </p>
                  </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {(Object.keys(SCENARIO_CONFIG) as Scenario[]).map((key) => {
                    const cfg = SCENARIO_CONFIG[key];
                    const active = scenario === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setScenario(key)}
                        className="relative rounded-xl border p-4 text-left transition-colors hover:bg-white/5"
                        style={{
                          borderColor: active ? "rgba(237,145,33,0.55)" : "rgba(255,255,255,0.10)",
                          background:
                            active
                              ? "radial-gradient(90% 90% at 20% 15%, rgba(237,145,33,0.22) 0%, rgba(17,24,39,0.0) 55%), rgba(17,24,39,0.35)"
                              : "rgba(17,24,39,0.35)",
                        }}
                      >
                        <div
                          className="absolute right-3 top-3 rounded-full px-2 py-1 text-xs font-semibold"
                          style={{
                            backgroundColor: "rgba(237,145,33,0.14)",
                            color: BRAND.orange,
                            border: "1px solid rgba(237,145,33,0.22)",
                          }}
                        >
                          {cfg.goboSizeMm}mm GOBO
                        </div>

                        <div className="flex flex-col gap-2 pr-16">
                          <div className="text-base font-semibold">{cfg.label}</div>
                          <div className="text-sm" style={{ color: BRAND.muted }}>
                            {cfg.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="text-sm" style={{ color: BRAND.muted }}>
                    Selected: <span className="font-semibold text-white">{SCENARIO_CONFIG[scenario].label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
                    style={{ backgroundColor: BRAND.orange, color: "#0B1220" }}
                  >
                    Continue →
                  </button>
                </div>
                </div>
            </main>
          )}

          {step === 2 && (
            <main className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
              <section
                className="rounded-xl border p-6"
                style={{ backgroundColor: BRAND.cardBg, borderColor: "rgba(255,255,255,0.10)" }}
              >
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <h2 className="text-lg font-semibold">Upload Logo and Scene</h2>
                      <p className="text-sm" style={{ color: BRAND.muted }}>
                        Upload files or pick from the libraries below.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-white/5"
                      style={{ borderColor: "rgba(255,255,255,0.12)", color: BRAND.text }}
                    >
                      Back
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-xl border p-4" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">Logo</div>
                        {logo ? (
                          <span className="text-xs font-medium" style={{ color: BRAND.orange }}>
                            Selected
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: BRAND.muted }}>
                            Required
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => logoUploadRef.current?.click()}
                          className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
                          style={{ backgroundColor: BRAND.orange, color: "#0B1220" }}
                        >
                          Upload Logo
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            document
                              .getElementById("logo-library")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-white/5"
                          style={{ borderColor: "rgba(255,255,255,0.12)", color: BRAND.text }}
                        >
                          Add from Library
                        </button>
                      </div>
                      <p className="mt-3 text-xs" style={{ color: BRAND.muted }}>
                        Tip: PNG logos with transparent background work best for projection.
                      </p>
                    </div>

                    <div className="rounded-xl border p-4" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">Scene</div>
                        {scene ? (
                          <span className="text-xs font-medium" style={{ color: BRAND.orange }}>
                            Selected
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: BRAND.muted }}>
                            Optional
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => sceneUploadRef.current?.click()}
                          className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-white/5"
                          style={{ borderColor: "rgba(255,255,255,0.12)", color: BRAND.text }}
                        >
                          Upload Scene
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById("scene-library");
                            if (!el) return;

                            el.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            });
                          }}
                          className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-white/5"
                          style={{ borderColor: "rgba(255,255,255,0.12)", color: BRAND.text }}
                        >
                          Add from Library
                        </button>
                      </div>
                      <p className="mt-3 text-xs" style={{ color: BRAND.muted }}>
                        Choose a real photo for the best preview. JPG format is recommended for better performance. The simulator will still work without a scene.
                      </p>
                    </div>
                  </div>

                  <input
                    ref={logoUploadRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml,.svg,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = URL.createObjectURL(f);
                      placeLogo(url);
                      setLogo(url);
                       setSelectedLogoId(null);
                      e.target.value = "";
                    }}
                  />
                  <input
                    ref={sceneUploadRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = URL.createObjectURL(f);
                      loadScene(url);
                      setScene(url);
                      setSelectedSceneId(null);
                      e.target.value = "";
                    }}
                  />

                  <div className="flex items-center justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      disabled={!logo}
                      className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
                      style={{ backgroundColor: BRAND.orange, color: "#0B1220" }}
                    >
                      Continue →
                    </button>
                  </div>
                </div>
              </section>

              <aside
                className="h-fit rounded-xl border p-6"
                style={{ backgroundColor: BRAND.cardBg, borderColor: "rgba(255,255,255,0.10)" }}
              >
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-semibold">Logo Library</h3>
                    <p className="text-xs" style={{ color: BRAND.muted }}>
                      Or pick a logo to place immediately.
                    </p>
                  </div>
                  <div id="logo-library" className="grid grid-cols-3 gap-3">
                    {LOGO_LIBRARY.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => {
                          placeLogo(l.src);
                          setLogo(l.src);
                          setSelectedLogoId(l.id);
                        }}
                        className="group rounded-xl border p-2 text-left transition-colors hover:bg-white/5"
                        style={{
                          borderColor:
                            selectedLogoId === l.id
                              ? "rgba(237,145,33,0.6)"
                              : "rgba(255,255,255,0.10)",
                          backgroundColor:
                            selectedLogoId === l.id
                              ? "rgba(237,145,33,0.07)"
                              : "transparent",
                        }}
                        title={l.label}
                      >
                        <div className="relative">
                          {selectedLogoId === l.id && (
                            <div
                              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full"
                              style={{
                                backgroundColor: BRAND.orange,
                                color: "#0B1220",
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              ✓
                            </div>
                          )}
                          <div
                            className="aspect-square w-full rounded-lg border transition-colors group-hover:border-white/25"
                            style={{
                              borderColor:
                                selectedLogoId === l.id
                                  ? "rgba(237,145,33,0.6)"
                                  : "rgba(255,255,255,0.08)",
                              backgroundColor: "rgba(17,24,39,0.55)",
                            }}
                          >
                            <img src={l.src} alt={l.label} className="h-full w-full object-contain p-1" draggable={false} />
                          </div>
                        </div>
                        <div className="mt-2 truncate text-xs" style={{ color: BRAND.muted }}>
                          {l.label}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <h3 className="text-base font-semibold">Scene Library</h3>
                    <button
                      type="button"
                      onClick={() => {
                        loadScene("/scenes/wall.jpg");
                        setScene("/scenes/wall.jpg");
                        setSelectedSceneId(null);
                      }}
                      className="text-xs font-medium underline underline-offset-4 hover:text-white"
                      style={{ color: BRAND.muted }}
                    >
                      Reset scene
                    </button>
                  </div>
                  <div id="scene-library" className="grid grid-cols-2 gap-3">
                    {SCENE_LIBRARY.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          loadScene(s.src);
                          setScene(s.src);
                          setSelectedSceneId(s.id);
                        }}
                        className="group rounded-xl border p-2 text-left transition-colors hover:bg-white/5"
                        style={{
                          borderColor:
                            selectedSceneId === s.id
                              ? "rgba(237,145,33,0.6)"
                              : "rgba(255,255,255,0.10)",
                          backgroundColor:
                            selectedSceneId === s.id
                              ? "rgba(237,145,33,0.07)"
                              : "transparent",
                        }}
                        title={s.label}
                      >
                        <div className="relative">
                          {selectedSceneId === s.id && (
                            <div
                              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full"
                              style={{
                                backgroundColor: BRAND.orange,
                                color: "#0B1220",
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              ✓
                            </div>
                          )}
                          <div
                            className="aspect-[16/9] w-full overflow-hidden rounded-lg border transition-colors group-hover:border-white/25"
                            style={{
                              borderColor:
                                selectedSceneId === s.id
                                  ? "rgba(237,145,33,0.6)"
                                  : "rgba(255,255,255,0.08)",
                              backgroundColor: "rgba(17,24,39,0.55)",
                            }}
                          >
                            <img src={s.src} alt={s.label} className="h-full w-full object-cover" draggable={false} />
                          </div>
                        </div>
                        <div className="mt-2 truncate text-xs" style={{ color: BRAND.muted }}>
                          {s.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </aside>
            </main>
          )}

          {step === 3 && (
            <main className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
              <section className="flex flex-col gap-3">
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between px-2">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-white/5"
                      style={{ borderColor: "rgba(255,255,255,0.12)", color: BRAND.text }}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={exportMockup}
                      className="rounded-lg px-3 py-2 text-sm font-medium shadow-sm transition-colors"
                      style={{ backgroundColor: BRAND.orange, color: "#0B1220" }}
                    >
                      Export Mockup
                    </button>
                  </div>

                  <div
                    className="relative w-full overflow-hidden rounded-xl border border-white/10"
                    style={{
                      maxWidth: "100%",
                      aspectRatio: "16 / 9",
                    }}
                  >
                    <canvas
                      ref={canvasElRef}
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                      }}
                    />
                  </div>
                </div>

                <p className="text-xs" style={{ color: BRAND.muted }}>
                  If you don’t see the preview update, ensure you selected a logo in Step 2. You can still drag/scale/rotate
                  on the canvas as usual.
                </p>
              </section>

              <aside className="h-fit rounded-xl border p-6" style={{ backgroundColor: BRAND.cardBg, borderColor: "rgba(255,255,255,0.10)" }}>
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-lg font-semibold">Projection Configuration</h2>
                    <p className="text-sm" style={{ color: BRAND.muted }}>
                      Scenario: <span className="font-semibold text-white">{SCENARIO_CONFIG[scenario].label}</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Distance</label>
                        <span className="text-sm tabular-nums" style={{ color: BRAND.muted }}>
                          {distance} ft
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={120}
                        value={distance}
                        onChange={(e) => setDistance(clamp(Number(e.target.value), 1, 120))}
                        className="w-full accent-[--brand]"
                        style={{ ["--brand" as any]: BRAND.orange }}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium">Lens</label>
                      <select
                        value={String(lensRatio)}
                        onChange={(e) => setLensRatio(toLensRatio(e.target.value, lensOptions))}
                        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                        style={{
                          backgroundColor: "rgba(17,24,39,0.65)",
                          borderColor: "rgba(255,255,255,0.12)",
                          color: BRAND.text,
                          boxShadow: "none",
                        }}
                      >
                        {lensOptions.map((v) => (
                          <option key={v} value={String(v)}>
                            {v === 1 ? "1.0" : String(v)}
                          </option>
                        ))}
                      </select>
                      {recommendedLensRatio !== lensRatio ? (
                        <div className="text-xs" style={{ color: BRAND.muted }}>
                          Suggested lens for {distance} ft:{" "}
                          <span className="font-semibold text-white">
                            {recommendedLensRatio === 1 ? "1.0" : String(recommendedLensRatio)}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium">Location Light</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["Dark", "Normal", "Bright"] as const).map((v) => {
                          const active = locationLight === v;
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setLocationLight(v)}
                              className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
                              style={{
                                borderColor: active ? "rgba(237,145,33,0.45)" : "rgba(255,255,255,0.12)",
                                backgroundColor: active ? "rgba(237,145,33,0.12)" : "rgba(17,24,39,0.45)",
                                color: BRAND.text,
                              }}
                            >
                              {v}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium">Projection Mode</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["Static", "Rotation"] as const).map((v) => {
                          const active = projectionMode === v;
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setProjectionMode(v)}
                              className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
                              style={{
                                borderColor: active ? "rgba(237,145,33,0.45)" : "rgba(255,255,255,0.12)",
                                backgroundColor: active ? "rgba(237,145,33,0.12)" : "rgba(17,24,39,0.45)",
                                color: BRAND.text,
                              }}
                            >
                              {v}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    
                  </div>

                  <div className="rounded-xl border p-4" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-baseline justify-between">
                        <h3 className="text-sm font-semibold">Projection Size</h3>
                        <span className="text-xs font-mono" style={{ color: BRAND.muted }}>
                          diameter = distance × lens
                        </span>
                      </div>
                      <div id="scene-library" className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border p-3" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
                          <div className="text-xs" style={{ color: BRAND.muted }}>
                            Diameter (ft)
                          </div>
                          <div className="text-lg font-semibold tabular-nums">{projectionDiameterText.ft}</div>
                        </div>
                        <div className="rounded-lg border p-3" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
                          <div className="text-xs" style={{ color: BRAND.muted }}>
                            Diameter (m)
                          </div>
                          <div className="text-lg font-semibold tabular-nums">{projectionDiameterText.m}</div>
                        </div>
                      </div>
                      <div className="mt-2 rounded-lg border p-3" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
                        <div className="text-xs" style={{ color: BRAND.muted }}>
                          Recommended GOBO Size
                        </div>
                        <div className="text-lg font-semibold tabular-nums">{goboText}</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border p-4" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <h3 className="text-sm font-semibold">Product Recommendation</h3>
                        <p className="text-xs" style={{ color: BRAND.muted }}>
                          Based on scenario + distance.
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl border p-3" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
                      <div className="flex gap-3">
                        <div
                          className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border"
                          style={{ borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(17,24,39,0.55)" }}
                        >
                          <img
                            src={recommendedProduct?.image ?? "/products/placeholder.jpg"}
                            alt={recommendedProduct?.title ?? recommendedProjector.projectorName}
                            className="h-full w-full object-cover"
                            draggable={false}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">
                            {recommendedProduct?.title ?? recommendedProjector.projectorName}
                          </div>
                          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs" style={{ color: BRAND.muted }}>
                            <div>
                              <span className="font-semibold text-white">{recommendedProjector.wattageW}W</span> wattage
                            </div>
                            <div>
                              <span className="font-semibold text-white">
                                {recommendedLensRatio === 1 ? "1.0" : String(recommendedLensRatio)}
                              </span>{" "}
                              lens
                            </div>
                            <div>
                              <span className="font-semibold text-white">{goboText}</span> GOBO
                            </div>
                            <div>
                              <span className="font-semibold text-white">{recommendedProduct?.price ?? "—"}</span> price
                            </div>
                          </div>

                          <div className="mt-3 flex items-center gap-2">
                            <a
                              href={recommendedProduct?.url ?? recommendedProjector.href}
                              className="rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
                              style={{ backgroundColor: BRAND.orange, color: "#0B1220" }}
                            >
                              Shop Now
                            </a>
                            <a
                              href={recommendedProduct?.url ?? recommendedProjector.href}
                              className="text-xs font-medium underline underline-offset-4 hover:text-white"
                              style={{ color: BRAND.muted }}
                            >
                              View details
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            </main>
          )}
        </div>
      </div>
    </div>
  );
}
