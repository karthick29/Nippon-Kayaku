import type { Product, RouteInputRole, SynthesisRoute } from '@/lib/types';

/* ════════════════════════════════════════════════════════════════════
   Synthesis route seed data — 9 routes.

   Established literature / industrial routes for catalogue products.
   Every route ships as `unreviewed`: they are plausible, cited-style
   summaries, not process documentation, and a Nippon Kayaku chemist
   should confirm each before it's relied on.

   Products are referenced by CAS number, never by position, so
   reordering products.ts can't silently rewire a route. External SMILES
   were checked against PubChem's InChIKey for the stated CAS and are in
   RDKit canonical form; `npm run check:structures` re-verifies them.

   Only three inputs are themselves catalogue products (TCP, sodium
   methoxide, Pd(OAc)₂), so where-used is shallow in the seed corpus —
   that is the honest shape of these 50 products, not a limitation.
   ════════════════════════════════════════════════════════════════════ */

interface InputSeed {
  role: RouteInputRole;
  /** CAS of a catalogue product… */
  productCas?: string;
  /** …or an external substance. */
  name?: string;
  cas?: string;
  smiles?: string;
}

interface RouteSeed {
  productCas: string;
  name: string;
  notes: string;
  inputs: InputSeed[];
}

const REVIEW_NOTE = 'Seeded from published literature — awaiting chemist review.';

const SEEDS: RouteSeed[] = [
  {
    productCas: '2921-88-2', // Chlorpyrifos
    name: 'Phosphorylation of 3,5,6-trichloro-2-pyridinol',
    notes: 'The sodium salt of 3,5,6-trichloro-2-pyridinol is condensed with O,O-diethyl phosphorochloridothioate.',
    inputs: [
      { role: 'building-block', productCas: '6515-38-4' },
      { role: 'building-block', name: 'O,O-Diethyl phosphorochloridothioate', cas: '2524-04-1', smiles: 'CCOP(=S)(Cl)OCC' },
      { role: 'reagent', name: 'Sodium hydroxide', cas: '1310-73-2', smiles: '[Na+].[OH-]' },
    ],
  },
  {
    productCas: '1675-54-3', // Bisphenol A diglycidyl ether
    name: 'Glycidylation of bisphenol A',
    notes:
      'Bisphenol A with excess epichlorohydrin, then dehydrochlorination with sodium hydroxide. Uses racemic epichlorohydrin — not the (S)-enantiomer in the catalogue.',
    inputs: [
      { role: 'building-block', name: 'Bisphenol A', cas: '80-05-7', smiles: 'CC(C)(c1ccc(O)cc1)c1ccc(O)cc1' },
      { role: 'building-block', name: 'Epichlorohydrin (racemic)', cas: '106-89-8', smiles: 'ClCC1CO1' },
      { role: 'reagent', name: 'Sodium hydroxide', cas: '1310-73-2', smiles: '[Na+].[OH-]' },
    ],
  },
  {
    productCas: '3140-73-6', // CDMT
    name: 'Methoxylation of cyanuric chloride',
    notes: 'Stepwise substitution of cyanuric chloride with methoxide; temperature control stops at the dimethoxy stage.',
    inputs: [
      { role: 'building-block', name: 'Cyanuric chloride', cas: '108-77-0', smiles: 'Clc1nc(Cl)nc(Cl)n1' },
      { role: 'reagent', productCas: '124-41-4' },
      { role: 'solvent', name: 'Methanol', cas: '67-56-1', smiles: 'CO' },
    ],
  },
  {
    productCas: '1445085-55-1', // XPhos Pd G3
    name: 'Buchwald third-generation precatalyst assembly',
    notes:
      '2-Aminobiphenyl mesylate is palladated with Pd(OAc)₂ to the μ-OMs dimer, which is then cleaved with XPhos.',
    inputs: [
      { role: 'building-block', productCas: '3375-31-3' },
      { role: 'building-block', name: '2-Aminobiphenyl', cas: '90-41-5', smiles: 'Nc1ccccc1-c1ccccc1' },
      { role: 'reagent', name: 'Methanesulfonic acid', cas: '75-75-2', smiles: 'CS(=O)(=O)O' },
      {
        role: 'building-block',
        name: 'XPhos',
        cas: '564483-18-7',
        smiles: 'CC(C)c1cc(C(C)C)c(-c2ccccc2P(C2CCCCC2)C2CCCCC2)c(C(C)C)c1',
      },
      { role: 'solvent', name: 'Toluene', cas: '108-88-3', smiles: 'Cc1ccccc1' },
      { role: 'solvent', name: 'Tetrahydrofuran', cas: '109-99-9', smiles: 'C1CCOC1' },
    ],
  },
  {
    productCas: '94-75-7', // 2,4-D
    name: 'Williamson etherification of 2,4-dichlorophenol',
    notes: 'Sodium 2,4-dichlorophenoxide with chloroacetic acid under alkaline conditions, then acidification.',
    inputs: [
      { role: 'building-block', name: '2,4-Dichlorophenol', cas: '120-83-2', smiles: 'Oc1ccc(Cl)cc1Cl' },
      { role: 'building-block', name: 'Chloroacetic acid', cas: '79-11-8', smiles: 'O=C(O)CCl' },
      { role: 'reagent', name: 'Sodium hydroxide', cas: '1310-73-2', smiles: '[Na+].[OH-]' },
    ],
  },
  {
    productCas: '1774-47-6', // Trimethylsulfoxonium iodide
    name: 'S-Methylation of dimethyl sulfoxide',
    notes: 'Dimethyl sulfoxide heated with methyl iodide (Kuhn–Trischmann).',
    inputs: [
      { role: 'building-block', name: 'Dimethyl sulfoxide', cas: '67-68-5', smiles: 'CS(C)=O' },
      { role: 'building-block', name: 'Methyl iodide', cas: '74-88-4', smiles: 'CI' },
    ],
  },
  {
    productCas: '24424-99-5', // Di-tert-butyl dicarbonate
    name: 'Tricarbonate route from potassium tert-butoxide',
    notes:
      'Potassium tert-butyl carbonate (from KOtBu and CO₂) with phosgene gives di-tert-butyl tricarbonate, which loses CO₂ over DABCO.',
    inputs: [
      { role: 'building-block', name: 'Potassium tert-butoxide', cas: '865-47-4', smiles: 'CC(C)(C)[O-].[K+]' },
      { role: 'building-block', name: 'Carbon dioxide', cas: '124-38-9', smiles: 'O=C=O' },
      { role: 'building-block', name: 'Phosgene', cas: '75-44-5', smiles: 'O=C(Cl)Cl' },
      { role: 'catalyst', name: '1,4-Diazabicyclo[2.2.2]octane (DABCO)', cas: '280-57-9', smiles: 'C1CN2CCN1CC2' },
    ],
  },
  {
    productCas: '60-09-3', // 4-Aminoazobenzene
    name: 'Diazoaminobenzene rearrangement',
    notes: 'Diazotisation of aniline to diazoaminobenzene, then acid-catalysed rearrangement in excess aniline.',
    inputs: [
      { role: 'building-block', name: 'Aniline', cas: '62-53-3', smiles: 'Nc1ccccc1' },
      { role: 'reagent', name: 'Sodium nitrite', cas: '7632-00-0', smiles: 'O=N[O-].[Na+]' },
      { role: 'reagent', name: 'Hydrochloric acid', cas: '7647-01-0', smiles: 'Cl' },
    ],
  },
  {
    productCas: '638-07-3', // Ethyl 4-chloroacetoacetate
    name: 'Chlorination of diketene, then esterification',
    notes: 'Diketene is chlorinated to 4-chloroacetoacetyl chloride, which is esterified with ethanol.',
    inputs: [
      { role: 'building-block', name: 'Diketene', cas: '674-82-8', smiles: 'C=C1CC(=O)O1' },
      { role: 'reagent', name: 'Chlorine', cas: '7782-50-5', smiles: 'ClCl' },
      { role: 'building-block', name: 'Ethanol', cas: '64-17-5', smiles: 'CCO' },
      { role: 'solvent', name: 'Dichloromethane', cas: '75-09-2', smiles: 'ClCCl' },
    ],
  },
];

const DAY_MS = 86_400_000;

/**
 * Resolves seeds against the built product list. Deterministic: ids are
 * positional, dates step back from `seedNow` and never precede the product.
 */
export function buildRoutes(products: Product[], seedNow: Date): SynthesisRoute[] {
  const byCas = new Map(products.map((p) => [p.casNumber, p]));
  const resolve = (cas: string): Product => {
    const product = byCas.get(cas);
    if (!product) throw new Error(`Route seed references unknown product CAS ${cas}`);
    return product;
  };

  return SEEDS.map((seed, index) => {
    const product = resolve(seed.productCas);
    const id = `rte-${String(index + 1).padStart(3, '0')}`;
    const stepped = seedNow.getTime() - (index + 1) * 3 * DAY_MS;
    const created = new Date(Math.max(stepped, new Date(product.createdAt).getTime() + DAY_MS)).toISOString();

    return {
      id,
      productId: product.id,
      name: seed.name,
      isPreferred: true,
      reviewStatus: 'unreviewed',
      notes: `${seed.notes} ${REVIEW_NOTE}`,
      inputs: seed.inputs.map((input, i) => ({
        id: `${id}-in-${i + 1}`,
        routeId: id,
        role: input.role,
        sortOrder: i,
        ...(input.productCas
          ? { productId: resolve(input.productCas).id }
          : { externalName: input.name, externalCas: input.cas, externalSmiles: input.smiles }),
      })),
      createdAt: created,
      updatedAt: created,
    };
  });
}

export const ROUTE_SEED_COUNT = SEEDS.length;
