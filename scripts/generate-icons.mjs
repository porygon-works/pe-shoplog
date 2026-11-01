// public/brand/icon-source.svg から PNG アイコンを作り直す。使い方: node scripts/generate-icons.mjs
// 文字は Google Fonts の Reggae One で描く（要ネットワーク）。public/icon.svg（文字をパスにしたもの）は別管理。
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try {
    return require("playwright");
  } catch {
    return require("/opt/node22/lib/node_modules/playwright");
  }
})();

const svg = readFileSync(new URL("../public/brand/icon-source.svg", import.meta.url), "utf8");
const pub = (name) => new URL(`../public/${name}`, import.meta.url).pathname;

// size: 出力の一辺、scale: 絵の大きさ（maskable は中央 80% に縮め、余白は #fbf8f2）。
function html(size, scale) {
  const art = size * scale;
  const off = (size - art) / 2;
  return `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Reggae+One&display=block" rel="stylesheet">
<style>html,body{margin:0;background:#fbf8f2}svg{position:absolute;left:${off}px;top:${off}px;width:${art}px;height:${art}px}</style>
</head><body>${svg}</body></html>`;
}

const targets = [
  ["icon-192.png", 192, 1],
  ["icon-512.png", 512, 1],
  ["apple-touch-icon.png", 180, 1],
  ["icon-maskable-512.png", 512, 0.8],
];

// 既定のブラウザが無い環境では PW_CHROMIUM_PATH、なければ /opt/pw-browsers/chromium を使う。
const browser = await chromium.launch().catch(() =>
  chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" }),
);
for (const [file, size, scale] of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(html(size, scale), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.load('14px "Reggae One"', "ぺーろぐ"));
  const ok = await page.evaluate(() => document.fonts.check('14px "Reggae One"', "ぺーろぐ"));
  if (!ok) throw new Error("Reggae One を読み込めませんでした");
  writeFileSync(pub(file), await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } }));
  await page.close();
  console.log("wrote", file);
}
await browser.close();
