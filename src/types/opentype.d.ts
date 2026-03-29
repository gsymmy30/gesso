declare module "opentype.js" {
  interface Path {
    getBoundingBox(): { x1: number; y1: number; x2: number; y2: number };
    toPathData(decimalPlaces?: number): string;
  }

  interface Font {
    getPath(text: string, x: number, y: number, fontSize: number): Path;
  }

  function parse(buffer: ArrayBuffer): Font;

  export default { parse };
  export { Font, Path };
}
