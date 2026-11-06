import type { Metadata } from "next";
import KeystoneTool from "./KeystoneTool";

export const metadata: Metadata = {
  title: "GOBO Keystone Correction Tool | GoboSolution",
  description: "Use a four-corner calibration to prepare pre-distorted GOBO artwork for an angled projection.",
};

export default function KeystonePage() {
  return <KeystoneTool />;
}
