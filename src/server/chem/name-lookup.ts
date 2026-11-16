import 'server-only';
import type { Product } from '@/lib/types';
import { describeStructure } from './rdkit';

/* ════════════════════════════════════════════════════════════════════
   Name or CAS number → structure.

   Two sources, in order:

   1. The catalogue. Exact match on product name, synonym or CAS number.
      Nothing leaves the server, and it is always on.

   2. OPSIN (EBI's public IUPAC-name parser) — OFF unless the deployment
      sets ASTRA_NAME_LOOKUP=opsin. Turning it on sends the typed name to
      a service outside Nippon Kayaku; that is a decision for whoever runs
      the deployment, not a default. OPSIN reads systematic names
      ("4-hydroxy-3-methoxybenzaldehyde"), not trade names or CAS numbers.

   Whatever the source, the SMILES is parsed by RDKit before it is
   returned — an outside service's text is never trusted as a structure.
   ════════════════════════════════════════════════════════════════════ */

export interface NameMatch {
  name: string;
  casNumber?: string;
  smiles: string;
  source: 'catalogue' | 'opsin';
}

const OPSIN_URL = 'https://www.ebi.ac.uk/opsin/ws/';
const OPSIN_TIMEOUT_MS = 6000;

export const externalNameLookupEnabled = (): boolean => process.env.ASTRA_NAME_LOOKUP === 'opsin';

const fold = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');
const digits = (text: string) => text.replace(/\D/g, '');
const looksLikeCas = (text: string) => /^\d{2,7}-?\d{2}-?\d$/.test(text.trim());

/** Catalogue products with a structure whose name, synonym or CAS number is exactly `query`. */
export function matchCatalogue(products: Product[], query: string): Product[] {
  const wanted = fold(query);
  const cas = looksLikeCas(query) ? digits(query) : null;
  return products.filter(
    (p) =>
      p.smiles &&
      (fold(p.name) === wanted ||
        p.synonyms.some((s) => fold(s) === wanted) ||
        (cas !== null && digits(p.casNumber) === cas)),
  );
}

/** Asks OPSIN for a systematic name. Null on anything but a clean, parseable answer. */
export async function lookupOpsin(name: string): Promise<NameMatch | null> {
  if (!externalNameLookupEnabled() || looksLikeCas(name)) return null;
  try {
    const response = await fetch(`${OPSIN_URL}${encodeURIComponent(name.trim())}.smi`, {
      signal: AbortSignal.timeout(OPSIN_TIMEOUT_MS),
      headers: { Accept: 'text/plain' },
    });
    if (!response.ok) return null;
    const info = await describeStructure((await response.text()).trim());
    return info ? { name: name.trim(), smiles: info.canonicalSmiles, source: 'opsin' } : null;
  } catch {
    return null; // offline, timed out, or blocked — the catalogue answer stands
  }
}
