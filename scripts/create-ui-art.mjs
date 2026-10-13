import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "public/art/ui-v3");
const require = createRequire(process.env.SLOTBATTLE_ASSET_RUNTIME
  ? resolve(process.env.SLOTBATTLE_ASSET_RUNTIME, "package.json")
  : import.meta.url);
const sharp = require("sharp");
const manifest = [];
const svg = (w, h, content) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${content}</svg>\n`.split("\n").map((line) => line.trimEnd()).join("\n");
async function asset(name, w, h, content, scale = 1) {
  const source = svg(w, h, content);
  const bytes = await sharp(Buffer.from(source)).resize(w * scale, h * scale).png().toBuffer();
  await writeFile(resolve(output, "sources", `${name}.svg`), source);
  await writeFile(resolve(output, `${name}.png`), bytes);
  const alpha = await sharp(bytes).extractChannel(3).raw().toBuffer();
  manifest.push({ name: `${name}.png`, width: w * scale, height: h * scale,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    alphaSha256: createHash("sha256").update(alpha).digest("hex") });
}
await mkdir(resolve(output, "sources"), { recursive: true });

const states = ["idle", "hover", "pressed", "disabled"];
for (const tone of ["primary", "secondary"]) for (const state of states) {
  const light = tone === "primary";
  const disabled = state === "disabled", pressed = state === "pressed", hover = state === "hover";
  const fill = light ? disabled ? "#a8a9aa" : pressed ? "#d6d1c5" : "#eeeee9"
    : disabled ? "#35363a" : pressed ? "#1d1f25" : "#292b32";
  const rim = disabled ? "#686a70" : hover ? "#e0cfaa" : light ? "#c9c9c6" : "#b9babd";
  await asset(`action-${tone}-${state}`, 1024, 352, `
    <rect x="64" y="67" width="896" height="224" rx="112" fill="#000" opacity=".24"/>
    <rect x="64" y="64" width="896" height="224" rx="112" fill="${fill}" stroke="${rim}" stroke-width="3"/>
    <rect x="73" y="73" width="878" height="206" rx="103" fill="none" stroke="${light ? "#ffffff" : "#797b83"}" stroke-width="2" opacity="${disabled ? ".18" : ".5"}"/>
    <path d="M180 79H844" stroke="${light ? "#fff" : "#eee"}" stroke-width="2" opacity=".4"/>
    <path d="M186 273H838" stroke="${light ? "#666870" : "#050608"}" stroke-width="2" opacity=".24"/>
    <path d="m115 202 24 24m-12-36 24 24M884 126l24 24m-12-36 24 24" stroke="${hover ? "#d4bd84" : light ? "#b7b8b9" : "#636670"}" stroke-width="2" opacity=".55"/>
  `);
}
for (const state of ["idle", "selected", "disabled"]) {
  const selected = state === "selected", disabled = state === "disabled";
  await asset(`skill-${state}`, 256, 256, `
    <circle cx="128" cy="128" r="106" fill="${selected ? "#eee9dd" : "#23252c"}" fill-opacity="${selected ? "1" : ".88"}"/>
    <circle cx="128" cy="128" r="106" fill="none" stroke="${disabled ? "#7d7e85" : selected ? "#dbc391" : "#e3e2dc"}" stroke-width="${selected ? "6" : "3"}"/>
    <circle cx="128" cy="128" r="94" fill="none" stroke="${selected ? "#a98b53" : "#d2d1cb"}" stroke-width="1" opacity=".45"/>
    <path d="M66 44a106 106 0 0 1 124 0M44 190a106 106 0 0 0 168-26" fill="none" stroke="${selected ? "#e7d09c" : "#bfc0c3"}" stroke-width="4" opacity="${disabled ? ".25" : ".7"}"/>
    <path d="m128 15 5 7-5 7-5-7Z" fill="${selected ? "#e7d09c" : "#d8d9d9"}" opacity="${disabled ? ".3" : ".9"}"/>
  `);
}
for (const selected of [false, true]) {
  const name = selected ? "card-selected" : "card-idle";
  await asset(name, 128, 224, `
    ${selected ? '<rect x="6" y="12" width="116" height="200" rx="5" fill="none" stroke="#dbc590" stroke-width="1.5" opacity=".6"/>' : ""}
    <path d="M10 17h101l7 7v184H10Z" fill="#000" opacity=".25" transform="translate(0 2)"/>
    <path d="M10 16h101l7 7v185H10Z" fill="${selected ? "#f6f1e3" : "#eaeae5"}" stroke="${selected ? "#dfc48a" : "#aeb0b4"}" stroke-width="${selected ? "2" : ".8"}"/>
    <path d="M14 20h94l6 6v178H14Z" fill="none" stroke="#fff" stroke-width=".8" opacity=".8"/>
    <path d="M17 30v20M17 54v5" stroke="${selected ? "#c3a66f" : "#9c9d9b"}" stroke-width="1.3"/>
    <path d="m96 194 8-8m-3 9 7-7M22 28l4-4m-1 7 5-5" stroke="#b8b8b0" stroke-width=".7" opacity=".75"/>
    <path d="M42 202h44" stroke="#c1c1b8" stroke-width=".6"/>
    ${selected ? '<circle cx="105" cy="28" r="6" fill="#292b30"/><path d="m102 28 2 2 4-4" fill="none" stroke="#fff3d4" stroke-width="1"/>' : ""}
  `, 4);
}
for (const selected of [false, true]) {
  await asset(selected ? "choice-selected" : "choice-idle", 256, 256, `
    <path d="M8 8h217l23 23v217H8Z" fill="${selected ? "#eeebe1" : "#292b32"}" stroke="${selected ? "#d2b578" : "#84858d"}" stroke-width="${selected ? "4" : "2"}"/>
    <path d="M16 16h205l19 19v205H16Z" fill="none" stroke="${selected ? "#b2a27f" : "#4c4e57"}" stroke-width="1"/>
    <path d="M8 8h56M8 8v56m201 193 25-25" fill="none" stroke="${selected ? "#d2b578" : "#d2d2d2"}" stroke-width="3"/>
  `);
}
for (const light of [false, true]) {
  await asset(light ? "disc-light" : "disc-dark", 128, 128, `
    <circle cx="64" cy="64" r="59" fill="${light ? "#eeeae0" : "#282a30"}"/>
    <circle cx="64" cy="64" r="55" fill="none" stroke="${light ? "#86898e" : "#777980"}" stroke-width="1" opacity=".5"/>
  `);
}
await asset("panel-light", 1024, 1024, `
  <defs><pattern id="dots" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill="#51525b" opacity=".06"/></pattern></defs>
  <path d="M2 2h972q48 0 48 48v972H2Z" fill="#e9e9e6" stroke="#b9babd" stroke-width="3"/>
  <path d="M8 8h964q44 0 44 44v964H8Z" fill="url(#dots)" stroke="#fff" opacity=".6"/>
  <path d="M28 28h160M28 28v68" fill="none" stroke="#aca085" stroke-width="3"/>
  <path d="m938 52 22-22m-8 24 22-22" stroke="#c1c2c2" stroke-width="2"/>
`);
for (const tone of ["primary", "secondary"]) {
  const masks = manifest.filter((entry) => entry.name.startsWith(`action-${tone}-`)).map((entry) => entry.alphaSha256);
  if (new Set(masks).size !== 1) throw new Error(`${tone} action states changed their pixel footprint`);
}
await writeFile(resolve(output, "manifest.json"), JSON.stringify({
  theme: "neutral geometric game UI; reference: Honkai Star Rail actual interface",
  canvas: { width: 450, height: 800 },
  actionBody: { x: 64, y: 64, width: 896, height: 224 },
  cardBody: { x: 40, y: 64, width: 432, height: 768 },
  assets: manifest,
}, null, 2) + "\n");
console.log(`Created ${manifest.length} independent PNG assets with editable SVG sources.`);
