import opentype, { type Font } from "opentype.js";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { generateStructured } from "../llm/client.js";
import { LogoMarkSchema, type LogoMark } from "../llm/schemas.js";
import type { Analysis, Positioning, Visual } from "../llm/schemas.js";

interface LogoOptions {
  analysis: Analysis;
  positioning: Positioning;
  visual: Visual;
}

export async function generateLogo(opts: LogoOptions): Promise<string> {
  const { analysis, positioning, visual } = opts;
  const name = analysis.productName;
  const primaryColor = visual.palette.primary;
  const accentColor = visual.palette.accent;

  // Generate mark via LLM
  const mark = await generateMark(analysis, positioning, visual);

  // Try font-outlined wordmark, fall back to text element
  let wordmarkSvg: string;
  try {
    const fontPath = getBundledFontPath();
    const fontBuffer = await readFile(fontPath);
    const ab = fontBuffer.buffer.slice(
      fontBuffer.byteOffset,
      fontBuffer.byteOffset + fontBuffer.byteLength
    );
    const font = opentype.parse(ab);
    wordmarkSvg = buildOutlinedWordmark(font, name, primaryColor);
  } catch {
    wordmarkSvg = buildTextWordmark(name, primaryColor);
  }

  return composeLogo(mark, wordmarkSvg, name, primaryColor, accentColor);
}

async function generateMark(
  analysis: Analysis,
  positioning: Positioning,
  visual: Visual
): Promise<LogoMark> {
  return generateStructured({
    schema: LogoMarkSchema,
    schemaName: "logo_mark",
    temperature: 0.7,
    system: `You are an expert logo designer who creates simple, memorable SVG logomarks.

RULES:
- Output a SINGLE SVG path that works as a logomark/symbol (not text, not letters)
- The path should be simple and geometric — think Stripe's S-curve, Vercel's triangle, Next.js's N-mark, GitHub's octocat silhouette
- Use 1-3 subpaths maximum. Simpler is better.
- The mark should visually relate to what the product does or its core metaphor
- Design for monochrome rendering (single fill color)
- The viewBox should be square: "0 0 48 48" (48x48 grid)
- Path coordinates must stay within the viewBox bounds
- Do NOT use text, letters, or the product name in the mark
- Do NOT use generic shapes (plain circle, plain square) — the mark should be distinctive
- Do NOT use clipart or overly detailed illustrations
- Think about negative space and how the mark reads at 16x16 (favicon) and 256x256

GOOD examples of what to aim for:
- A CLI tool → terminal prompt bracket/cursor shape
- An API service → connection/node graph shape
- A data tool → abstract data flow shape
- A framework → structural/foundation shape
- A devtool → tool/gear/wrench abstraction

Output the path data as a single d="" attribute value.`,
    prompt: `Design a logomark for:

Product: ${analysis.productName}
Type: ${analysis.archetype}
Category: ${analysis.productCategory}
What it does: ${positioning.oneLiner}
Unique approach: ${analysis.uniqueApproach}
Problem it solves: ${analysis.problemStatement}
Palette: primary ${visual.palette.primary}, accent ${visual.palette.accent}

Generate a concept description and the SVG path data.`,
    maxTokens: 1024,
    timeoutMs: 20_000,
  });
}

function composeLogo(
  mark: LogoMark,
  wordmarkSvg: string,
  name: string,
  primaryColor: string,
  accentColor: string
): string {
  // Parse wordmark dimensions from its SVG
  const wMatch = wordmarkSvg.match(/width="(\d+)"/);
  const hMatch = wordmarkSvg.match(/height="(\d+)"/);
  const wordmarkWidth = wMatch ? parseInt(wMatch[1]) : name.length * 28 + 40;
  const wordmarkHeight = hMatch ? parseInt(hMatch[1]) : 64;

  // Extract wordmark inner content (everything between <svg> tags)
  const wordmarkInner = wordmarkSvg
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>/, "")
    .trim();

  const markSize = 48;
  const gap = 16;
  const totalWidth = markSize + gap + wordmarkWidth;
  const totalHeight = Math.max(markSize, wordmarkHeight);

  // Center mark and wordmark vertically
  const markY = (totalHeight - markSize) / 2;
  const wordmarkY = (totalHeight - wordmarkHeight) / 2;

  // Parse mark viewBox
  const vbParts = mark.viewBox.split(" ").map(Number);
  const [vbX, vbY, vbW, vbH] = vbParts.length === 4 ? vbParts : [0, 0, 48, 48];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">
  <!-- Mark: ${escapeXml(mark.concept)} -->
  <g transform="translate(0, ${markY})">
    <svg viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="${markSize}" height="${markSize}">
      <path d="${escapeXml(mark.svgPathData)}" fill="${accentColor}"/>
    </svg>
  </g>
  <!-- Wordmark -->
  <g transform="translate(${markSize + gap}, ${wordmarkY})">
    ${wordmarkInner}
  </g>
</svg>`;
}

function getBundledFontPath(): string {
  return join(
    new URL(".", import.meta.url).pathname,
    "..",
    "assets",
    "SpaceGrotesk-Bold.ttf"
  );
}

function buildOutlinedWordmark(
  font: Font,
  name: string,
  color: string
): string {
  const fontSize = 48;
  const path = font.getPath(name, 0, fontSize, fontSize);
  const bbox = path.getBoundingBox();
  const width = Math.ceil(bbox.x2 - bbox.x1) + 20;
  const height = Math.ceil(bbox.y2 - bbox.y1) + 20;
  const pathData = path.toPathData(2);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bbox.x1 - 10} ${bbox.y1 - 10} ${width} ${height}" width="${width}" height="${height}">
  <path d="${pathData}" fill="${color}"/>
</svg>`;
}

function buildTextWordmark(name: string, color: string): string {
  const charWidth = 28;
  const width = name.length * charWidth + 40;
  const height = 64;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <text x="20" y="46" font-family="system-ui, -apple-system, sans-serif" font-size="42" font-weight="600" letter-spacing="-0.02em" fill="${color}">${escapeXml(name)}</text>
</svg>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
