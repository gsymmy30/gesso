import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

interface OgImageOptions {
  productName: string;
  tagline: string;
  palette: {
    primary: string;
    background: string;
    text: string;
    accent: string;
  };
}

export async function generateOgImage(opts: OgImageOptions): Promise<Buffer> {
  const fonts = await loadFonts();
  if (fonts.length === 0) {
    throw new Error("No font files found in assets/. OG image generation requires bundled fonts.");
  }

  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "80px",
          backgroundColor: opts.palette.background,
          fontFamily: "sans-serif",
        },
        children: [
          {
            type: "div",
            props: {
              style: {
                fontSize: "72px",
                fontWeight: 700,
                color: opts.palette.primary,
                marginBottom: "24px",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
              },
              children: opts.productName,
            },
          },
          {
            type: "div",
            props: {
              style: {
                fontSize: "32px",
                color: opts.palette.text,
                lineHeight: 1.4,
                maxWidth: "900px",
                opacity: 0.85,
              },
              children: opts.tagline,
            },
          },
          {
            type: "div",
            props: {
              style: {
                position: "absolute",
                bottom: "60px",
                left: "80px",
                width: "60px",
                height: "4px",
                backgroundColor: opts.palette.accent,
              },
              children: "",
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts,
    }
  );

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width" as const, value: 1200 },
  });
  return Buffer.from(resvg.render().asPng());
}

async function loadFontBuffer(filename: string): Promise<ArrayBuffer | null> {
  try {
    const fontPath = join(
      new URL(".", import.meta.url).pathname,
      "..",
      "assets",
      filename
    );
    const buffer = await readFile(fontPath);
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );
  } catch {
    return null;
  }
}

async function loadFonts() {
  const fonts: { name: string; data: ArrayBuffer; weight: 700 | 400; style: "normal" }[] = [];
  const bold = await loadFontBuffer("SpaceGrotesk-Bold.ttf");
  if (bold) fonts.push({ name: "sans-serif", data: bold, weight: 700 as const, style: "normal" as const });
  const regular = await loadFontBuffer("SpaceGrotesk-Regular.ttf");
  if (regular) fonts.push({ name: "sans-serif", data: regular, weight: 400 as const, style: "normal" as const });
  return fonts;
}
