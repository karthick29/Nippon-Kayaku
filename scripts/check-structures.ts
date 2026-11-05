/* ════════════════════════════════════════════════════════════════════
   npm run check:structures

   Verifies every seed structure in src/data/products.ts and every external
   route input in src/data/routes.ts, offline:
     • SMILES parses and is already in RDKit canonical form
     • stored InChIKey matches the one RDKit derives from the SMILES
     • element counts match the seed's molecular formula
     • average MW is within 0.1 of the seed's molecular weight

   The SMILES/InChIKey pairs were sourced from PubChem by CAS number, so a
   match here means structure, formula, weight and CAS all agree. The
   formula check alone would NOT catch a wrong enantiomer — the InChIKey
   check does. Exits non-zero on any failure.
   ════════════════════════════════════════════════════════════════════ */

import initRDKit from '@rdkit/rdkit';
import { buildProducts } from '../src/data/products';
import { buildRoutes } from '../src/data/routes';
import { isValidCasChecksum } from '../src/lib/validation';
import { countMolJson, formatHill, sameFormula } from '../src/lib/formula';

async function main(): Promise<void> {
  const rdkit = await initRDKit();
  const products = buildProducts(() => '', () => '');
  const failures: string[] = [];
  const withoutStructure: string[] = [];

  for (const p of products) {
    if (!p.smiles) {
      withoutStructure.push(`${p.name} (${p.casNumber})`);
      continue;
    }
    const label = `${p.name} (${p.casNumber})`;
    const mol = rdkit.get_mol(p.smiles);
    if (!mol) {
      failures.push(`${label}: SMILES does not parse — ${p.smiles}`);
      continue;
    }
    try {
      const canonical = mol.get_smiles();
      const inchi = mol.get_inchi();
      const inchiKey = inchi ? rdkit.get_inchikey_for_inchi(inchi) : '';
      const formula = formatHill(countMolJson(mol.get_json()));
      const { amw } = JSON.parse(mol.get_descriptors()) as { amw: number };

      if (canonical !== p.smiles) failures.push(`${label}: not canonical — store ${canonical}`);
      if (inchiKey !== p.inchiKey) failures.push(`${label}: InChIKey ${p.inchiKey} ≠ RDKit ${inchiKey}`);
      if (p.molecularFormula && !sameFormula(p.molecularFormula, formula)) {
        failures.push(`${label}: formula ${p.molecularFormula} ≠ structure ${formula}`);
      }
      if (p.molecularWeight !== undefined && Math.abs(amw - p.molecularWeight) > 0.1) {
        failures.push(`${label}: MW ${p.molecularWeight} ≠ structure ${amw.toFixed(2)}`);
      }
    } finally {
      mol.delete();
    }
  }

  // Route inputs: external substances must have a parseable, canonical SMILES
  // and a checksum-valid CAS. (buildRoutes also throws on an unknown product CAS.)
  const routes = buildRoutes(products, new Date('2026-07-01T00:00:00.000Z'));
  const externals = routes.flatMap((r) => r.inputs.filter((i) => !i.productId).map((i) => ({ route: r.name, input: i })));
  for (const { route, input } of externals) {
    const label = `Route “${route}” input ${input.externalName} (${input.externalCas ?? 'no CAS'})`;
    if (input.externalCas && !isValidCasChecksum(input.externalCas)) failures.push(`${label}: CAS check digit does not validate`);
    if (!input.externalSmiles) continue;
    const mol = rdkit.get_mol(input.externalSmiles);
    if (!mol) {
      failures.push(`${label}: SMILES does not parse — ${input.externalSmiles}`);
      continue;
    }
    const canonical = mol.get_smiles();
    mol.delete();
    if (canonical !== input.externalSmiles) failures.push(`${label}: not canonical — store ${canonical}`);
  }

  const checked = products.length - withoutStructure.length;
  console.log(`Checked ${checked} product structures and ${externals.length} route inputs across ${routes.length} routes (RDKit ${rdkit.version()}).`);
  if (withoutStructure.length) {
    console.log(`No structure recorded (${withoutStructure.length}): ${withoutStructure.join('; ')}`);
  }
  if (failures.length) {
    console.error(`\n✗ ${failures.length} problem(s):\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
  console.log('✓ All structures agree with their formula, weight and InChIKey; route inputs are canonical with valid CAS numbers.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
