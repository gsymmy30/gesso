import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface ArchetypePalette {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  muted: string;
}

export interface ArchetypeFontPairing {
  heading: string;
  body: string;
}

export interface Archetype {
  name: string;
  description: string;
  palettes: ArchetypePalette[];
  fontPairings: ArchetypeFontPairing[];
}

const ARCHETYPES_DIR = new URL(".", import.meta.url).pathname;

const cache = new Map<string, Archetype>();

const VALID_ARCHETYPES = [
  "cli-tool",
  "sdk-library",
  "api-service",
  "data-infra",
  "web-app",
  "devtool",
] as const;

export type ArchetypeName = (typeof VALID_ARCHETYPES)[number];

export function loadArchetype(name: string): Archetype | null {
  if (cache.has(name)) return cache.get(name)!;

  const safeName = VALID_ARCHETYPES.includes(name as ArchetypeName) ? name : null;
  if (!safeName) return null;

  try {
    const filePath = join(ARCHETYPES_DIR, `${safeName}.json`);
    const data = JSON.parse(readFileSync(filePath, "utf-8")) as Archetype;
    cache.set(name, data);
    return data;
  } catch {
    return null;
  }
}

export function loadAllArchetypes(): Map<string, Archetype> {
  for (const name of VALID_ARCHETYPES) {
    loadArchetype(name);
  }
  return cache;
}

export function getArchetypePalettes(name: string): ArchetypePalette[] {
  return loadArchetype(name)?.palettes ?? [];
}

export function getArchetypeFontPairings(name: string): ArchetypeFontPairing[] {
  return loadArchetype(name)?.fontPairings ?? [];
}
