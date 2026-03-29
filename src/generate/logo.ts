import opentype, { type Font } from "opentype.js";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

interface LogoOptions {
  productName: string;
  primaryColor: string;
  fontPath?: string;
}

export async function generateLogo(opts: LogoOptions): Promise<string> {
  const { productName, primaryColor } = opts;

  // Try to load a bundled font, fall back to SVG text element
  try {
    const fontPath = opts.fontPath ?? getBundledFontPath();
    const fontBuffer = await readFile(fontPath);
    // Buffer.buffer returns the underlying pool ArrayBuffer, not the content.
    // Must slice to get the correct range.
    const ab = fontBuffer.buffer.slice(
      fontBuffer.byteOffset,
      fontBuffer.byteOffset + fontBuffer.byteLength
    );
    const font = opentype.parse(ab);
    return generateSvgWithOutlines(font, productName, primaryColor);
  } catch {
    return generateSvgFallback(productName, primaryColor);
  }
}

function getBundledFontPath(): string {
  // Look for bundled font in package assets
  return join(
    new URL(".", import.meta.url).pathname,
    "..",
    "..",
    "assets",
    "SpaceGrotesk-Bold.ttf"
  );
}

function generateSvgWithOutlines(
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

function generateSvgFallback(name: string, color: string): string {
  // Research: 93% of SaaS logos use sans-serif, 42% lowercase, 48% title case
  // Use moderate letter-spacing for a clean, modern tech feel
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
