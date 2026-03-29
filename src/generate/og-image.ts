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
  const fontData = await loadFont();

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
      fonts: fontData
        ? [{ name: "sans-serif", data: fontData, weight: 700, style: "normal" as const }]
        : [],
    }
  );

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width" as const, value: 1200 },
  });
  return Buffer.from(resvg.render().asPng());
}

async function loadFont(): Promise<ArrayBuffer | null> {
  try {
    const fontPath = join(
      new URL(".", import.meta.url).pathname,
      "..",
      "..",
      "assets",
      "SpaceGrotesk-Bold.ttf"
    );
    const buffer = await readFile(fontPath);
    // Buffer.buffer returns the underlying pool ArrayBuffer, not the content.
    // Must slice to get the correct range.
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );
  } catch {
    // No bundled font — satori will use system fonts
    return null;
  }
}
