import opentype, { type Font } from "opentype.js";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { generateStructured } from "../llm/client.js";
import { z } from "zod";
import type { Analysis, Positioning, Visual } from "../llm/schemas.js";

interface LogoOptions {
  analysis: Analysis;
  positioning: Positioning;
  visual: Visual;
}

export interface LogoResult {
  light: string;
  dark: string;
}

// Parametric mark design. LLM controls shape, fill, modifiers, rotation, accents.
// Code renders every combination deterministically. The combinatorial space is huge
// so no two projects should get the same mark.
const MarkDesignSchema = z.object({
  // Base container shape
  shape: z.enum(["circle", "rounded-square", "hexagon", "diamond", "triangle"]),

  // Fill style: solid bg + white letter, or outline + colored letter
  fill: z.enum(["solid", "outline"]),

  // Letter
  hasLetter: z.boolean(),
  letter: z.string().min(1).max(1),
  letterCase: z.enum(["upper", "lower"]),

  // Rotation of the entire mark in degrees
  rotation: z.number().int().min(-15).max(15),

  // Small dot accent near a corner (adds distinctiveness)
  accent: z.enum(["none", "dot-tr", "dot-tl", "dot-br", "dot-bl"]),

  // Offset shadow behind the shape (adds depth)
  shadow: z.boolean(),

  // For rounded-square: one corner stays sharp (like Figma's logo)
  sharpCorner: z.enum(["none", "tr", "tl", "br", "bl"]),

  reasoning: z.string(),
});

type MarkDesign = z.infer<typeof MarkDesignSchema>;

const SYSTEM_PROMPT = `You are designing a unique logomark for a software product. You are NOT generating SVG. You are choosing parameters that code will render into a clean mark.

SHAPES — pick the one that fits the product:
- circle: Universal, friendly. Social products, consumer SaaS, communities.
- rounded-square: App-native, tool-like. Mobile apps, dev tools, utilities.
- hexagon: Technical, structured. Data tools, infrastructure, backend.
- diamond: Premium, distinctive. Design tools, creative platforms, premium products.
- triangle: Dynamic, directional. Build tools, deploy, CI/CD, speed-focused.

FILL:
- solid: Shape is filled, letter is white. Bold, confident. Best for most products.
- outline: Shape is a stroke, letter is colored. Light, modern, minimal.

LETTER:
- hasLetter=true for most products. The first letter of the name inside the shape.
- hasLetter=false ONLY for products with an obvious shape metaphor (deploy=triangle, play=triangle, etc.)
- Uppercase for enterprise/authoritative. Lowercase for modern/friendly.

MODIFIERS (these make each mark unique — use them!):
- rotation: Tilt the mark -15 to 15 degrees. Even 5-10 degrees makes it feel dynamic. 0 = static/stable.
- accent: A small dot near a corner adds a distinctive signature. Like a period at the end of a statement.
- shadow: An offset shadow behind the shape adds depth and premium feel.
- sharpCorner: For rounded-square ONLY. Making one corner sharp breaks the symmetry and makes it iconic (like how Figma's logo has a distinctive corner treatment). Pick "none" for other shapes.

UNIQUENESS RULES:
- Do NOT default to rotation=0, accent=none, shadow=false. Those are boring.
- Use at least 2 modifiers. A rotated hexagon with a dot accent looks completely different from a straight hexagon.
- Think about what combination expresses this specific product's personality.
- A security tool might get: diamond, solid, uppercase, rotation=0, no accent, shadow (stable, weighty).
- A fun social app might get: circle, solid, lowercase, rotation=8, dot-br, no shadow (playful, light).
- A CLI tool might get: triangle, outline, no letter, rotation=-10, dot-tr, no shadow (sharp, minimal).

Fill ALL fields.`;

export async function generateLogo(opts: LogoOptions): Promise<LogoResult> {
  const { analysis, positioning, visual } = opts;
  const name = analysis.productName;
  const primaryColor = visual.palette.primary;
  const accentColor = visual.palette.accent;

  // Load font
  let font: Font | null = null;
  try {
    const fontPath = getBundledFontPath();
    const fontBuffer = await readFile(fontPath);
    const ab = fontBuffer.buffer.slice(
      fontBuffer.byteOffset,
      fontBuffer.byteOffset + fontBuffer.byteLength
    );
    font = opentype.parse(ab);
  } catch { /* text fallback */ }

  // LLM picks parametric design
  const design = await generateStructured({
    schema: MarkDesignSchema,
    schemaName: "mark_design",
    temperature: 0.8,
    system: SYSTEM_PROMPT,
    prompt: `Product: ${name}
What it does: ${positioning.oneLiner}
Category: ${analysis.productCategory}
Archetype: ${analysis.archetype}
Tech stack: ${analysis.techStack.slice(0, 3).join(", ")}
Personality: ${analysis.writingStyle.tone}

Design a unique mark for this product. Make it distinctive — use modifiers.`,
    maxTokens: 512,
    timeoutMs: 15_000,
  });

  // Build mark SVG from parameters
  const markSvg = buildMark(design, font);

  // Apply brand colors
  const markLight = markSvg
    .replace(/fill="currentColor"/g, `fill="${accentColor}"`)
    .replace(/stroke="currentColor"/g, `stroke="${accentColor}"`);

  const markDark = markSvg
    .replace(/fill="currentColor"/g, `fill="${accentColor}"`)
    .replace(/stroke="currentColor"/g, `stroke="${accentColor}"`);

  // Build wordmarks
  let wordmarkLight: string;
  let wordmarkDark: string;
  if (font) {
    wordmarkLight = buildOutlinedWordmark(font, name, primaryColor);
    wordmarkDark = buildOutlinedWordmark(font, name, "#FFFFFF");
  } else {
    wordmarkLight = buildTextWordmark(name, primaryColor);
    wordmarkDark = buildTextWordmark(name, "#FFFFFF");
  }

  return {
    light: composeLogo(markLight, wordmarkLight, name, primaryColor, accentColor),
    dark: composeLogo(markDark, wordmarkDark, name, primaryColor, accentColor),
  };
}

// ── Mark Builder ──────────────────────────────────────────────

function buildMark(design: MarkDesign, font: Font | null): string {
  const letter = design.hasLetter
    ? (design.letterCase === "upper" ? design.letter.toUpperCase() : design.letter.toLowerCase())
    : null;

  const elements: string[] = [];

  // Shadow layer (behind main shape)
  if (design.shadow) {
    const sx = 3, sy = 3;
    elements.push(renderShape(design.shape, 24 + sx, 24 + sy, design.fill, 0.2, "none"));
  }

  // Main shape
  elements.push(renderShape(design.shape, 24, 24, design.fill, 1, design.sharpCorner));

  // Letter
  if (letter) {
    const letterColor = design.fill === "solid" ? "#FFFFFF" : "currentColor";
    const letterSize = getLetterSize(design.shape);
    elements.push(renderLetter(letter, font, letterColor, letterSize, 24, 24));
  }

  // Dot accent
  if (design.accent !== "none") {
    const pos = getAccentPos(design.accent, design.shape);
    elements.push(`  <circle cx="${pos.x}" cy="${pos.y}" r="3.5" fill="currentColor"/>`);
  }

  let inner = elements.join("\n");

  // Rotation
  if (design.rotation !== 0) {
    inner = `  <g transform="rotate(${design.rotation} 24 24)">\n${inner}\n  </g>`;
  }

  return wrapSvg(inner);
}

// ── Shape Rendering ───────────────────────────────────────────

function renderShape(
  shape: string,
  cx: number,
  cy: number,
  fill: string,
  opacity: number,
  sharpCorner: string
): string {
  const opacityAttr = opacity < 1 ? ` opacity="${opacity}"` : "";

  if (fill === "outline") {
    return renderShapeOutline(shape, cx, cy, opacityAttr);
  }
  return renderShapeSolid(shape, cx, cy, opacityAttr, sharpCorner);
}

function renderShapeSolid(
  shape: string,
  cx: number,
  cy: number,
  opacityAttr: string,
  sharpCorner: string
): string {
  const ox = cx - 24, oy = cy - 24; // offset from center

  switch (shape) {
    case "circle":
      return `  <circle cx="${cx}" cy="${cy}" r="22" fill="currentColor"${opacityAttr}/>`;

    case "rounded-square": {
      if (sharpCorner !== "none") {
        return renderRoundedSquareWithSharpCorner(ox, oy, sharpCorner, opacityAttr);
      }
      return `  <rect x="${4 + ox}" y="${4 + oy}" width="40" height="40" rx="10" fill="currentColor"${opacityAttr}/>`;
    }

    case "hexagon": {
      const pts = hexPoints(cx, cy, 22);
      return `  <polygon points="${pts}" fill="currentColor"${opacityAttr}/>`;
    }

    case "diamond":
      return `  <rect x="${10 + ox}" y="${10 + oy}" width="28" height="28" rx="3" fill="currentColor" transform="rotate(45 ${cx} ${cy})"${opacityAttr}/>`;

    case "triangle": {
      const p = [
        `${cx},${cy - 21}`,
        `${cx + 21},${cy + 18}`,
        `${cx - 21},${cy + 18}`,
      ].join(" ");
      return `  <polygon points="${p}" fill="currentColor"${opacityAttr}/>`;
    }

    default:
      return `  <circle cx="${cx}" cy="${cy}" r="22" fill="currentColor"${opacityAttr}/>`;
  }
}

function renderShapeOutline(
  shape: string,
  cx: number,
  cy: number,
  opacityAttr: string
): string {
  const sw = 3;

  switch (shape) {
    case "circle":
      return `  <circle cx="${cx}" cy="${cy}" r="21" fill="none" stroke="currentColor" stroke-width="${sw}"${opacityAttr}/>`;

    case "rounded-square":
      return `  <rect x="${5}" y="${5}" width="38" height="38" rx="9" fill="none" stroke="currentColor" stroke-width="${sw}"${opacityAttr}/>`;

    case "hexagon": {
      const pts = hexPoints(cx, cy, 21);
      return `  <polygon points="${pts}" fill="none" stroke="currentColor" stroke-width="${sw}"${opacityAttr}/>`;
    }

    case "diamond":
      return `  <rect x="11" y="11" width="26" height="26" rx="2" fill="none" stroke="currentColor" stroke-width="${sw}" transform="rotate(45 ${cx} ${cy})"${opacityAttr}/>`;

    case "triangle": {
      const p = [
        `${cx},${cy - 20}`,
        `${cx + 20},${cy + 17}`,
        `${cx - 20},${cy + 17}`,
      ].join(" ");
      return `  <polygon points="${p}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linejoin="round"${opacityAttr}/>`;
    }

    default:
      return `  <circle cx="${cx}" cy="${cy}" r="21" fill="none" stroke="currentColor" stroke-width="${sw}"${opacityAttr}/>`;
  }
}

function renderRoundedSquareWithSharpCorner(
  ox: number,
  oy: number,
  corner: string,
  opacityAttr: string
): string {
  // Rounded square with one sharp corner, drawn as a path
  const x = 4 + ox, y = 4 + oy, w = 40, h = 40, r = 10;
  const x2 = x + w, y2 = y + h;

  // Each corner: sharp = no arc, rounded = arc
  const trSharp = corner === "tr";
  const tlSharp = corner === "tl";
  const brSharp = corner === "br";
  const blSharp = corner === "bl";

  let d = `M${x + (tlSharp ? 0 : r)},${y}`;
  // Top edge → top-right
  d += ` H${trSharp ? x2 : x2 - r}`;
  d += trSharp ? "" : ` Q${x2},${y} ${x2},${y + r}`;
  // Right edge → bottom-right
  d += ` V${brSharp ? y2 : y2 - r}`;
  d += brSharp ? "" : ` Q${x2},${y2} ${x2 - r},${y2}`;
  // Bottom edge → bottom-left
  d += ` H${blSharp ? x : x + r}`;
  d += blSharp ? "" : ` Q${x},${y2} ${x},${y2 - r}`;
  // Left edge → top-left
  d += ` V${tlSharp ? y : y + r}`;
  d += tlSharp ? "" : ` Q${x},${y} ${x + r},${y}`;
  d += " Z";

  return `  <path d="${d}" fill="currentColor"${opacityAttr}/>`;
}

// ── Geometry Helpers ──────────────────────────────────────────

function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`);
  }
  return pts.join(" ");
}

function getLetterSize(shape: string): number {
  switch (shape) {
    case "circle": return 26;
    case "rounded-square": return 24;
    case "hexagon": return 22;
    case "diamond": return 18;
    case "triangle": return 18;
    default: return 24;
  }
}

function getAccentPos(accent: string, shape: string): { x: number; y: number } {
  // Position the dot just outside the shape's bounding area
  const offset = shape === "circle" || shape === "hexagon" ? 4 : 2;
  switch (accent) {
    case "dot-tr": return { x: 42 + offset, y: 6 - offset + 4 };
    case "dot-tl": return { x: 6 - offset, y: 6 - offset + 4 };
    case "dot-br": return { x: 42 + offset, y: 42 + offset - 4 };
    case "dot-bl": return { x: 6 - offset, y: 42 + offset - 4 };
    default: return { x: 44, y: 6 };
  }
}

function wrapSvg(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">\n${inner}\n</svg>`;
}

// ── Letter Rendering ──────────────────────────────────────────

function renderLetter(
  letter: string,
  font: Font | null,
  color: string,
  targetSize: number,
  cx: number,
  cy: number
): string {
  if (font) {
    return renderLetterOutlined(letter, font, color, targetSize, cx, cy);
  }
  return renderLetterText(letter, color, targetSize, cx, cy);
}

function renderLetterOutlined(
  letter: string,
  font: Font,
  color: string,
  targetSize: number,
  cx: number,
  cy: number
): string {
  const fontSize = 100;
  const path = font.getPath(letter, 0, fontSize, fontSize);
  const bbox = path.getBoundingBox();

  const glyphWidth = bbox.x2 - bbox.x1;
  const glyphHeight = bbox.y2 - bbox.y1;

  if (glyphWidth === 0 || glyphHeight === 0) {
    return renderLetterText(letter, color, targetSize, cx, cy);
  }

  const scale = targetSize / Math.max(glyphWidth, glyphHeight);
  const scaledWidth = glyphWidth * scale;
  const scaledHeight = glyphHeight * scale;

  const tx = cx - scaledWidth / 2 - bbox.x1 * scale;
  const ty = cy - scaledHeight / 2 - bbox.y1 * scale;

  const pathData = path.toPathData(2);
  return `  <g transform="translate(${tx.toFixed(1)}, ${ty.toFixed(1)}) scale(${scale.toFixed(4)})"><path d="${pathData}" fill="${color}"/></g>`;
}

function renderLetterText(
  letter: string,
  color: string,
  targetSize: number,
  cx: number,
  cy: number
): string {
  return `  <text x="${cx}" y="${cy}" font-family="system-ui, -apple-system, sans-serif" font-size="${targetSize}" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="${color}">${escapeXml(letter)}</text>`;
}

// ── Logo Composition ──────────────────────────────────────────

function composeLogo(
  markSvg: string,
  wordmarkSvg: string,
  name: string,
  primaryColor: string,
  accentColor: string
): string {
  const wMatch = wordmarkSvg.match(/width="([\d.]+)"/);
  const hMatch = wordmarkSvg.match(/height="([\d.]+)"/);
  const wordmarkWidth = wMatch ? parseFloat(wMatch[1]) : name.length * 28 + 40;
  const wordmarkHeight = hMatch ? parseFloat(hMatch[1]) : 64;

  const wordmarkInner = wordmarkSvg
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>/, "")
    .trim();

  const markInner = markSvg
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>/, "")
    .trim();

  const markSize = 48;
  const gap = 16;
  const totalWidth = markSize + gap + wordmarkWidth;
  const totalHeight = Math.max(markSize, wordmarkHeight);

  const markY = (totalHeight - markSize) / 2;
  const wordmarkY = (totalHeight - wordmarkHeight) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">
  <!-- Logomark -->
  <g transform="translate(0, ${markY})">
    <svg viewBox="0 0 48 48" width="${markSize}" height="${markSize}">
      ${markInner}
    </svg>
  </g>
  <!-- Wordmark -->
  <g transform="translate(${markSize + gap}, ${wordmarkY})">
    ${wordmarkInner}
  </g>
</svg>`;
}

// ── Helpers ───────────────────────────────────────────────────

function getBundledFontPath(): string {
  return join(
    new URL(".", import.meta.url).pathname,
    "..",
    "assets",
    "SpaceGrotesk-Bold.ttf"
  );
}

function buildOutlinedWordmark(font: Font, name: string, color: string): string {
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
