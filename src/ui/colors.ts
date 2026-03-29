import chalk, { type ChalkInstance } from "chalk";

// Gesso default palette (before brand colors load)
const GESSO = {
  primary: "#5BA4A4",
  accent: "#E8B87D",
  success: "#7EC89B",
  error: "#D4726A",
  text: "#E8E6E3",
  muted: "#8B8B8B",
};

let brandColors: Record<string, string> | null = null;

export function setBrandColors(colors: Record<string, string>) {
  brandColors = colors;
}

export function hasBrandColors(): boolean {
  return brandColors !== null;
}

function hex(color: string): ChalkInstance {
  return chalk.hex(color);
}

export const ui = {
  get primary() {
    return hex(brandColors?.primary ?? GESSO.primary);
  },
  get accent() {
    return hex(brandColors?.accent ?? GESSO.accent);
  },
  get success() {
    return hex(GESSO.success);
  },
  get error() {
    return hex(GESSO.error);
  },
  get text() {
    return hex(GESSO.text);
  },
  get muted() {
    return hex(GESSO.muted);
  },
  dim: chalk.dim,
  bold: chalk.bold,
};

export function colorBar(
  score: number,
  maxScore: number,
  width: number = 10
): string {
  const ratio = Math.min(score / maxScore, 1);
  const filled = Math.round(ratio * width);
  const empty = width - filled;

  let color: string;
  if (ratio >= 0.7) color = GESSO.success;
  else if (ratio >= 0.4) color = GESSO.accent;
  else color = GESSO.error;

  return hex(color)("█".repeat(filled)) + chalk.dim("░".repeat(empty));
}

export function colorSwatch(hexColor: string): string {
  return chalk.bgHex(hexColor)("      ");
}
