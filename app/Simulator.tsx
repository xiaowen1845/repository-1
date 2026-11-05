"use client";
/* eslint-disable @next/next/no-img-element -- Local preview assets and uploaded blob URLs render directly. */

import { useCallback, useEffect, useRef, useState } from "react";
import { LANGUAGES, parseLocale, storeUrl, translator, type Locale } from "../lib/localization";
import ProjectionCanvas, { type CanvasHandle, type Placement } from "../components/ProjectionCanvas";
import { FINDER_URL, QUOTE_URL, LENSES, LIGHT_LABELS, displayNumber, fromMeters, toMeters,
  findProjector, type Environment, type LensRatio, type LightLevel, type Unit } from "../lib/projector-rules";

const SCENES = [
  {id:"wall",label:"Empty Wall",src:"/scenes/wall.jpg",environment:"indoor"},
  {id:"restaurant",label:"Restaurant Wall",src:"/scenes/restaurant-wall.jpg",environment:"indoor"},
  {id:"bar",label:"Bar Interior",src:"/scenes/bar-interior.jpg",environment:"indoor"},
  {id:"hotel",label:"Hotel Lobby",src:"/scenes/hotel-lobby.jpg",environment:"indoor"},
  {id:"floor",label:"Floor Projection",src:"/scenes/floor-projection.jpg",environment:"indoor"},
  {id:"retail",label:"Retail Entrance",src:"/scenes/retail-entrance.jpg",environment:"outdoor"},
  {id:"parking",label:"Parking Lot",src:"/scenes/parking-lot.jpg",environment:"outdoor"},
  {id:"building",label:"Building Exterior",src:"/scenes/building-exterior.jpg",environment:"outdoor"},
] as const;
const LOGOS = [
  {id:"restaurant",label:"Restaurant",src:"/logos/restaurant.png"},
  {id:"bar",label:"Bar",src:"/logos/bar.png"},
  {id:"cafe",label:"Cafe",src:"/logos/cafe.png"},
  {id:"sale",label:"Sale",src:"/logos/sale.png"},
  {id:"vip",label:"VIP",src:"/logos/vip.png"},
] as const;
const INITIAL_PLACEMENT: Placement = {scale:100,x:.5,y:.5,angle:0};
const SCENE_BRIGHTNESS: Record<LightLevel,number> = {dark:55,"slightly-dark":80,bright:110};
type Upload = {src:string;name:string};
function Range({label,value,min,max,step=1,suffix="",disabled=false,onChange}: {
  label:string;value:number;min:number;max:number;step?:number;suffix?:string;disabled?:boolean;onChange:(value:number)=>void;
}) {
  return <label className="range-control"><span>{label}<output>{displayNumber(value,0)}{suffix}</output></span>
    <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={e=>onChange(Number(e.target.value))} />
  </label>;
}
export default function Simulator({ initialLocale }: { initialLocale: Locale }) {
  const [locale, setLocale] = useState(initialLocale);
  const t = translator(locale);
  const rtl = locale === "ar";
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    document.title = locale === "en"
      ? "Logo Projection Simulator | GoboSolution"
      : translator(locale)("Preview Your Logo Projection") + " | GoboSolution";
  }, [locale, rtl]);

  function selectLocale(next: Locale) {
    const url = new URL(window.location.href);
    if (next === "en") url.searchParams.delete("lang");
    else url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url);
    setLocale(next);
    setUploadError("");
    setExportMessage("");
  }

  const [step,setStep] = useState<1|2|3>(1);
  const [environment,setEnvironment] = useState<Environment>("indoor");
  const [sceneId,setSceneId] = useState("wall");
  const [customScene,setCustomScene] = useState<Upload|null>(null);
  const [logo,setLogo] = useState<Upload|null>(null);
  const [unit,setUnit] = useState<Unit>("m");
  // Canonical metres are never reconstructed from rounded display values.
  const [distanceM,setDistanceM] = useState<number|null>(6);
  const [distanceText,setDistanceText] = useState("6");
  const [targetDiameterM,setTargetDiameterM] = useState<number|null>(3);
  const [diameterText,setDiameterText] = useState("3");
  const [lens,setLens] = useState<LensRatio|"auto">("auto");
  const [light,setLight] = useState<LightLevel>("slightly-dark");
  const [placement,setPlacement] = useState<Placement>(INITIAL_PLACEMENT);
  const [rotating,setRotating] = useState(false);
  const [resetKey,setResetKey] = useState(0);
  const [projectionBrightness,setProjectionBrightness] = useState(85);
  const [sceneBrightness,setSceneBrightness] = useState(80);
  const [uploadError,setUploadError] = useState("");
  const [exportMessage,setExportMessage] = useState("");
  const [exporting,setExporting] = useState(false);
  const [canvasReady,setCanvasReady] = useState(false);
  const canvas = useRef<CanvasHandle>(null);
  const sceneInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const selectedScene = sceneId === "custom" && customScene ? {label:customScene.name,src:customScene.src} : SCENES.find(scene=>scene.id===sceneId) ?? SCENES[0];
  const sceneLabel = sceneId === "custom" ? selectedScene.label : t(selectedScene.label);
  const demo = LOGOS.find(item => item.src === logo?.src);
  const logoLabel = demo ? t("{name} Demo Logo", { name: t(demo.label) }) : logo?.name ?? "";
  const environmentLabel = t(environment === "indoor" ? "Indoor" : "Outdoor");
  const arrow = rtl ? "←" : "→";
  const backArrow = rtl ? "→" : "←";
  const selection = findProjector({distanceM:distanceM ?? NaN,diameterM:targetDiameterM ?? NaN,environment,light,
    lens:lens==="auto"?undefined:lens});
  const matched = selection.kind==="match" ? selection : null;
  const projectorName = matched && t(
    matched.projector.name.replace(/^\d+W/, "{power}W"),
    { power: matched.projector.wattage },
  );
  const size = (metres:number) => `${displayNumber(fromMeters(metres,unit))} ${unit}`;
  const updatePlacement = useCallback((next:Partial<Placement>)=>setPlacement(current=>({...current,...next})),[]);
  useEffect(()=>()=>{if(customScene?.src.startsWith("blob:")) URL.revokeObjectURL(customScene.src);},[customScene]);
  useEffect(()=>()=>{if(logo?.src.startsWith("blob:")) URL.revokeObjectURL(logo.src);},[logo]);

  function go(next:1|2|3) {
    if(next===step || (next===3 && !logo)) return;
    setCanvasReady(false);setExportMessage("");setUploadError("");setStep(next);
  }
  function chooseEnvironment(next:Environment) {
    setEnvironment(next);
    if(sceneId!=="custom") setSceneId(next==="indoor"?"wall":"retail");
  }
  function changeUnit(next:Unit) {
    setUnit(next);
    setDistanceText(distanceM===null?"":displayNumber(fromMeters(distanceM,next)));
    setDiameterText(targetDiameterM===null?"":displayNumber(fromMeters(targetDiameterM,next)));
  }
  function changeDistance(raw:string) {
    setDistanceText(raw);
    const n = Number(raw);
    setDistanceM(raw.trim() && Number.isFinite(n) && n>0 ? toMeters(n,unit) : null);
  }
  function changeDiameter(raw:string) {
    setDiameterText(raw);
    const n = Number(raw);
    setTargetDiameterM(raw.trim() && Number.isFinite(n) && n>0 ? toMeters(n,unit) : null);
  }
  function upload(file:File|undefined,kind:"logo"|"scene") {
    if(!file) return;
    const allowed = kind==="logo" ? /\.(png|jpe?g|svg)$/i : /\.(png|jpe?g)$/i;
    if(!allowed.test(file.name) || file.size>10*1024*1024) {
      setUploadError(t("Choose a {formats} file up to 10 MB.", { formats: t(kind === "logo" ? "PNG, JPG or SVG" : "PNG or JPG") }));return;
    }
    const asset={src:URL.createObjectURL(file),name:file.name};
    setUploadError("");
    if(kind==="scene") {setCustomScene(asset);setSceneId("custom");}
    else {setLogo(asset);setPlacement(INITIAL_PLACEMENT);setRotating(false);}
  }
  function resetPreview() {
    setRotating(false);setPlacement(INITIAL_PLACEMENT);setResetKey(key=>key+1);
    setProjectionBrightness(85);setSceneBrightness(SCENE_BRIGHTNESS[light]);setExportMessage("");
  }
  async function exportMockup() {
    setExporting(true);setExportMessage("");
    try {
      const blob = await canvas.current?.exportPNG();
      if(!blob) throw new Error("The preview is not ready yet.");
      const url=URL.createObjectURL(blob),link=document.createElement("a");
      link.href=url;link.download="gobosolution-projection-preview.png";
      document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),10000);
      setExportMessage(t("Your PNG is ready for download."));
    } catch(error) {setExportMessage(t(error instanceof Error ? error.message : "Export failed. Please try again."));}
    finally {setExporting(false);}
  }
  return <div className="simulator" lang={locale} dir={rtl ? "rtl" : "ltr"}><div className="simulator-inner">
    <header className="page-header">
      <label className="language-picker">
        <span>{t("Language")}</span>
        <select value={locale} onChange={e => selectLocale(parseLocale(e.target.value))}>
          {Object.entries(LANGUAGES).map(([code, name]) => <option key={code} value={code} lang={code}>{name}</option>)}
        </select>
      </label>
      <a className="wordmark" href={storeUrl("https://gobosolution.com/", locale)} target="_top" aria-label={t("GoboSolution home")}><img src="/brand/gobosolution-logo.png" alt="GoboSolution" width={300} height={59} /></a>
      <p className="eyebrow">{t("LOGO PROJECTION SIMULATOR")}</p><h1>{t("Preview Your Logo Projection")}</h1>
      <p>{t("Upload your logo, choose a scene, and see how your projection could look before selecting a projector.")}</p>
    </header>
    <nav className="steps" aria-label={t("Preview steps")}>{(["Choose a Scene","Add Your Logo","Preview"] as const).map((label,index)=>
      <button key={label} type="button" className={step===index+1?"step active":"step"} aria-current={step===index+1?"step":undefined} disabled={index===2&&!logo} onClick={()=>go((index+1) as 1|2|3)}>
        <span className="step-number">{index+1}</span><span>{t(label)}</span>{step>index+1&&<span className="step-done">✓</span>}
      </button>)}</nav>
    <input ref={sceneInput} type="file" hidden accept="image/png,image/jpeg,.png,.jpg,.jpeg" aria-label={t("Upload Your Own Scene")} onChange={e=>{upload(e.target.files?.[0],"scene");e.target.value="";}} />
    <input ref={logoInput} type="file" hidden accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg" aria-label={t("Upload Your Logo")} onChange={e=>{upload(e.target.files?.[0],"logo");e.target.value="";}} />
    {uploadError&&<p role="alert" className="error-message">{uploadError}</p>}

    {step===1&&<section className="panel">
      <div className="section-heading"><div><p className="eyebrow">{t("STEP {number}", { number: "01" })}</p><h2>{t("Choose a Scene")}</h2><p>{t("Start with your installation environment, then choose a background.")}</p></div></div>
      <div className="environments">{(["indoor","outdoor"] as const).map(value=><button type="button" key={value} className={`environment-card ${environment===value?"selected":""}`} aria-pressed={environment===value} onClick={()=>chooseEnvironment(value)}>
        <span className="environment-icon" aria-hidden="true">{value==="indoor"?"▱":"☀"}</span><strong>{t(value==="indoor"?"Indoor":"Outdoor")}</strong><span>{t(value==="indoor"?"Interior walls, floors and commercial spaces":"Exterior walls, entrances and buildings")}</span>
      </button>)}</div>
      <div className="section-subheading"><h3>{t("Scene Library")}</h3><button className="button secondary" type="button" onClick={()=>sceneInput.current?.click()}>{t("Upload Your Own Scene")}</button></div>
      <p className="muted small">{t("Choose a background or upload a PNG / JPG up to 10 MB.")}</p>
      <div className="asset-grid scenes">{SCENES.filter(scene=>scene.environment===environment).map(scene=><button key={scene.id} type="button" className={`asset-card ${sceneId===scene.id?"selected":""}`} aria-pressed={sceneId===scene.id} onClick={()=>{setSceneId(scene.id);setUploadError("");}}>
        {/* Existing local scene assets are intentionally rendered without remote optimization. */}
        <img src={scene.src} alt={t(scene.label)} /><span>{t(scene.label)}</span>
      </button>)}{customScene&&<button type="button" className={`asset-card ${sceneId==="custom"?"selected":""}`} aria-pressed={sceneId==="custom"} onClick={()=>{setSceneId("custom");setUploadError("");}}>
        <img src={customScene.src} alt={t("Your uploaded scene")} /><span>{customScene.name}</span>
      </button>}</div>
      <div className="step-footer"><span className="muted">{t("Selected: {name}", { name: sceneLabel })}</span><button className="button primary" type="button" onClick={()=>go(2)}>{t("Continue")} {arrow}</button></div>
    </section>}

    {step===2&&<section className="panel">
      <div className="section-heading"><div><p className="eyebrow">{t("STEP {number}", { number: "02" })}</p><h2>{t("Upload Your Logo")}</h2><p>{t("Upload a PNG, JPG, or SVG file to preview how your logo could appear in the selected environment.")}</p></div></div>
      <div className="upload-zone"><span className="upload-mark" aria-hidden="true">↥</span><h3>{t("Your brand, in the picture.")}</h3><p>{t("Transparent-background logos provide the best preview.")}</p>
        <button type="button" className="button primary" onClick={()=>logoInput.current?.click()}>{t("Upload Your Logo")}</button><span className="muted small">{t("PNG, JPG or self-contained SVG · Up to 10 MB")}</span>
        {logo&&<p className="selected-file">{t("Selected: {name}", { name: logoLabel })}</p>}
      </div>
      <div className="section-subheading"><h3>{t("Try a Demo Logo")}</h3><span className="muted small">{t("You can replace it at any time.")}</span></div>
      <div className="asset-grid logos">{LOGOS.map(item=><button type="button" key={item.id} className={`asset-card ${logo?.src===item.src?"selected":""}`} aria-pressed={logo?.src===item.src} onClick={()=>{setUploadError("");setLogo({src:item.src,name:t("{name} Demo Logo", { name:t(item.label) })});setPlacement(INITIAL_PLACEMENT);setRotating(false);}}>
        <img src={item.src} alt={t("{name} Demo Logo", { name:t(item.label) })} /><span>{t(item.label)}</span>
      </button>)}</div>
      <div className="step-footer"><button type="button" className="button secondary" onClick={()=>go(1)}>{backArrow} {t("Back")}</button><button type="button" className="button primary" disabled={!logo} onClick={()=>go(3)}>{t("Preview Projection")} {arrow}</button></div>
    </section>}

    {step===3&&logo&&<>
      <div className="preview-layout"><section className="preview-column">
        <div className="section-heading"><div><p className="eyebrow">{t("STEP {number}", { number: "03" })}</p><h2>{t("Your Projection Preview")}</h2><p>{sceneLabel} · {environmentLabel}</p></div></div>
        <ProjectionCanvas translate={t} ref={canvas} scene={selectedScene.src} logo={logo.src} logoIsSvg={logo.name.toLowerCase().endsWith(".svg")} diameterM={matched?.actualM??targetDiameterM??3} {...placement} rotating={rotating} resetKey={resetKey} projectionBrightness={projectionBrightness} sceneBrightness={sceneBrightness} onPlacement={updatePlacement} onReady={setCanvasReady} />
        <p className="preview-note">{t("Drag the logo to move it. Use the corner handles to resize. The scene is illustrative; estimated dimensions are shown separately.")}</p>
        <div className="preview-actions"><button className="button secondary" type="button" onClick={()=>go(2)}>{backArrow} {t("Change Logo")}</button><button className="button secondary" type="button" onClick={resetPreview}>{t("Reset Preview")}</button><button className="button primary" type="button" disabled={!canvasReady||exporting} onClick={()=>void exportMockup()}>{t(exporting?"Preparing PNG…":"Export Mockup")}</button></div>
        {exportMessage&&<p role="status" className="muted small">{exportMessage}</p>}

      </section><aside className="panel controls">
        <h3>{t("Preview Controls")}</h3>
        <fieldset><legend>{t("Projection Setup")}</legend>
          <div className="distance-row"><label htmlFor="distance">{t("Projection Distance")}<input id="distance" type="number" min="0" step="any" value={distanceText} onChange={e=>changeDistance(e.target.value)} inputMode="decimal" /></label>
            <label htmlFor="unit">{t("Unit")}<select id="unit" value={unit} onChange={e=>changeUnit(e.target.value as Unit)}><option value="m">m</option><option value="ft">ft</option></select></label></div>
          <label htmlFor="diameter">{t("Target Projection Diameter ({unit})", { unit })}<input id="diameter" type="number" min="0" step="any" value={diameterText} onChange={e=>changeDiameter(e.target.value)} inputMode="decimal" /></label>
          <p className="muted small">{t("Enter your installation distance and desired image diameter. We’ll match a projector and lens.")}</p>
          <div className="diameter-result"><span>{t("Estimated Projection Diameter")}</span><strong>{matched?size(matched.actualM):"—"}</strong><small>{matched ? t(lens === "auto" ? "With the automatically matched 1:{ratio} lens" : "With the selected 1:{ratio} lens", { ratio: matched.lens }) : t("Enter a matching setup to calculate")}</small></div>
          {selection.kind!=="match"&&<p role="status" className={selection.kind==="invalid"?"error-message":"notice"}>{t(selection.message)}</p>}
          <span className="control-label">{t("Ambient Light")}</span><div className="segmented">{(Object.keys(LIGHT_LABELS) as LightLevel[]).map(value=><button type="button" key={value} className={light===value?"selected":""} aria-pressed={light===value} onClick={()=>{setLight(value);setSceneBrightness(SCENE_BRIGHTNESS[value]);}}>{t(LIGHT_LABELS[value])}</button>)}</div>
          <details className="advanced-settings"><summary>{t("Advanced: Lens Selection")}</summary>
            <label htmlFor="lens">{t("Lens")}<select id="lens" value={lens} onChange={e=>setLens(e.target.value==="auto"?"auto":Number(e.target.value) as LensRatio)}><option value="auto">{t("Auto — Match my setup")}</option>{LENSES.map(value=><option key={value} value={value}>1:{value}{value===.3 ? " · " + t("High-Power only") : ""}</option>)}</select></label>
            <p className="muted small">{t("Choose a fixed lens if you already know your configuration. The 1:0.3 lens is available on High-Power models only.")}</p>
          </details>
        </fieldset>
        <fieldset><legend>{t("Logo Placement")}</legend>
          <Range label={t("Logo Size")} min={25} max={250} value={placement.scale} suffix="%" onChange={scale=>updatePlacement({scale})} />
          <p className="muted small">{t("Adjusts visual placement only.")}</p>
          <Range label={t("Horizontal Position")} min={0} max={100} value={placement.x*100} suffix="%" onChange={x=>updatePlacement({x:x/100})} />
          <Range label={t("Vertical Position")} min={0} max={100} value={placement.y*100} suffix="%" onChange={y=>updatePlacement({y:y/100})} />
          <button type="button" className="text-button" onClick={()=>updatePlacement({x:.5,y:.5})}>{t("Center Logo")}</button>
          <Range label={t("Logo Angle")} min={0} max={359} value={placement.angle} suffix="°" disabled={rotating} onChange={angle=>updatePlacement({angle})} />
          <div className="switch-row"><span>{t("Rotation")}</span><button type="button" role="switch" aria-checked={rotating} aria-label={t("Rotation")} className={`toggle ${rotating?"selected":""}`} onClick={()=>setRotating(!rotating)}>{t(rotating?"On":"Off")}</button></div>
        </fieldset>
        <fieldset><legend>{t("Visual Brightness")}</legend>
          <Range label={t("Projection Brightness")} min={0} max={100} value={projectionBrightness} suffix="%" onChange={setProjectionBrightness} />
          <Range label={t("Scene Brightness")} min={20} max={140} value={sceneBrightness} suffix="%" onChange={setSceneBrightness} />
          <p className="muted small">{t("Photo placement and visual brightness do not affect projector recommendations.")}</p>
        </fieldset>
      </aside>
        <section className="recommendation-card" aria-labelledby="recommendation-title" aria-live="polite" aria-atomic="true">
          <p className="eyebrow">{t("YOUR NEXT STEP")}</p><h2 id="recommendation-title">{t("Recommended for Your Setup")}</h2>
          {matched ? <>
            <div className="recommendation-heading"><h3>{projectorName}</h3><span className="match-badge">{t(matched.grade==="Excellent Match"?"Excellent size match":"Good size match")}</span></div>
            <p>{t("Selected for your {environment} setup at {distance} in {light} conditions. The 1:{ratio} lens produces approximately {size} at this distance.", {
              environment: locale === "en" ? environment : environmentLabel,
              distance: size(distanceM ?? 0),
              light: t(LIGHT_LABELS[light]).toLocaleLowerCase(locale),
              ratio: matched.lens,
              size: size(matched.actualM),
            })}</p>
            {environment==="indoor"&&matched.projector.id.startsWith("outdoor-")&&<p className="muted small">{t("This outdoor-rated model can also be used indoors.")}</p>}
            <dl className="setup-specs">
              <div><dt>{t("Projection Distance")}</dt><dd>{size(distanceM ?? 0)}</dd></div>
              <div><dt>{t("Target Diameter")}</dt><dd>{size(targetDiameterM ?? 0)}</dd></div>
              <div><dt>{t("Estimated Diameter")}</dt><dd>{size(matched.actualM)}</dd></div>
              <div><dt>{t("Matched Lens")}</dt><dd>1:{matched.lens}</dd></div>
            </dl>
            {matched.errorPct>5&&<p className="notice">{t("The estimated diameter differs from your target by {percent}%. Request a quote if your image size must be exact.", { percent: displayNumber(matched.errorPct, 1) })}</p>}
            <div className="recommendation-actions"><a className="button primary" href={storeUrl(matched.projector.url, locale)} target="_blank" rel="noopener noreferrer">{t("View Projector")} ↗</a><a className="button secondary" href={storeUrl(QUOTE_URL, locale)} target="_blank" rel="noopener noreferrer">{t("Request a Quote")} ↗</a></div>
            <p className="muted small recommendation-note">{t("Preliminary recommendation based on your measurements and ambient light. Select the 1:{ratio} lens on the product page and confirm installation conditions before ordering.", { ratio: matched.lens })}</p>
          </> : <>
            <h3>{t(selection.kind==="invalid"?"Tell us about your setup":"Let’s Confirm Your Installation")}</h3>
            <p>{selection.kind!=="match"&&t(selection.message)}</p>
            {selection.kind==="manual"&&<p>{t("We’ll help you confirm the projector and lens for your project.")}</p>}
            <a className="button secondary" href={storeUrl(QUOTE_URL, locale)} target="_blank" rel="noopener noreferrer">{t("Request a Quote")} ↗</a>
          </>}
          <p className="finder-link">{t("Want to compare more options?")} <a href={storeUrl(FINDER_URL, locale)} target="_blank" rel="noopener noreferrer">{t("Find My Projector")} ↗</a></p>
        </section>
      </div>
    </>}
    <footer className="page-footer">GoboSolution · {t("Preview your idea. Plan your projection.")}</footer>
  </div></div>;
}
