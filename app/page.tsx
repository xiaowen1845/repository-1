import type { Metadata } from "next";
import Simulator from "./Simulator";
import { parseLocale, translator } from "../lib/localization";

type PageProps = { searchParams: Promise<{ lang?: string | string[] }> };

async function pageLocale(searchParams: PageProps["searchParams"]) {
  const { lang } = await searchParams;
  return parseLocale(Array.isArray(lang) ? lang[0] : lang);
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const locale = await pageLocale(searchParams);
  const t = translator(locale);
  return {
    title: locale === "en" ? "Logo Projection Simulator | GoboSolution" : t("Preview Your Logo Projection") + " | GoboSolution",
    description: t("Upload your logo, choose a scene, and see how your projection could look before selecting a projector."),
  };
}

export default async function Page({ searchParams }: PageProps) {
  return <Simulator initialLocale={await pageLocale(searchParams)} />;
}
