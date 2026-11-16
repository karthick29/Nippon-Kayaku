/* ════════════════════════════════════════════════════════════════════
   npm run check:drawing

   Verifies, offline, the two rules that decide what a drawing from the
   structure editor means (src/lib/drawing.ts):
     • inspectDrawing — reads KET as Ketcher 3.18 writes it: counts atoms,
       spots reactions, names every query feature, and fingerprints the
       drawing so that selection alone never counts as a change
     • hasSmartsSyntax — sends SMARTS-only patterns to the SMARTS reader
       and never mistakes a seed SMILES for one

   The KET samples are what the editor produced for the SMILES/SMARTS in
   each case's name. Exits non-zero on any failure.
   ════════════════════════════════════════════════════════════════════ */

import assert from 'node:assert/strict';
import { buildProducts } from '../src/data/products';
import { hasSmartsSyntax, inspectDrawing, joinPhrases } from '../src/lib/drawing';

type Atom = Record<string, unknown>;
type Bond = Record<string, unknown>;

/** A KET document in the shape Ketcher writes: one molecule per fragment, extra root nodes for arrows. */
function ket(molecules: Array<{ atoms: Atom[]; bonds?: Bond[] }>, extraNodes: Array<Record<string, unknown>> = []): string {
  const doc: Record<string, unknown> = {
    root: { nodes: [...molecules.map((_, i) => ({ $ref: `mol${i}` })), ...extraNodes] },
    ket_version: '2.0.0',
  };
  molecules.forEach((m, i) => {
    doc[`mol${i}`] = { type: 'molecule', atoms: m.atoms.map((a, n) => ({ ...a, location: [n, 0, 0] })), bonds: m.bonds ?? [] };
  });
  return JSON.stringify(doc);
}

const single = (a: number, b: number): Bond => ({ type: 1, atoms: [a, b] });
const failures: string[] = [];

function check(name: string, fn: () => void): void {
  try {
    fn();
  } catch (cause) {
    failures.push(`${name}: ${cause instanceof Error ? cause.message.split('\n')[0] : String(cause)}`);
  }
}

/* ── inspectDrawing ─────────────────────────────────────────────── */

const cases: Array<{ name: string; ket: string; atoms: number; reaction?: boolean; features?: string[] }> = [
  { name: 'empty canvas', ket: ket([]), atoms: 0 },
  { name: 'ethanol CCO', ket: ket([{ atoms: [{ label: 'C' }, { label: 'C' }, { label: 'O' }], bonds: [single(0, 1), single(1, 2)] }]), atoms: 3 },
  { name: 'salt [Na+].[Cl-]', ket: ket([{ atoms: [{ label: 'Na', charge: 1 }] }, { atoms: [{ label: 'Cl', charge: -1 }] }]), atoms: 2 },
  { name: 'isotope C[13CH3]', ket: ket([{ atoms: [{ label: 'C' }, { label: 'C', isotope: 13 }], bonds: [single(0, 1)] }]), atoms: 2 },
  { name: 'deuterium C[2H]', ket: ket([{ atoms: [{ label: 'C' }, { label: 'D' }], bonds: [single(0, 1)] }]), atoms: 2 },
  { name: 'radical C[CH2]', ket: ket([{ atoms: [{ label: 'C' }, { label: 'C', radical: 2 }], bonds: [single(0, 1)] }]), atoms: 2 },
  {
    name: 'stereocentre C[C@H](N)O',
    ket: ket([{ atoms: [{ label: 'C' }, { label: 'C', stereoLabel: 'abs' }, { label: 'N' }, { label: 'O' }], bonds: [{ type: 1, atoms: [1, 0], stereo: 6 }, single(1, 2), single(1, 3)] }]),
    atoms: 4,
  },
  { name: 'aromatic bonds', ket: ket([{ atoms: [{ label: 'C' }, { label: 'C' }], bonds: [{ type: 4, atoms: [0, 1] }] }]), atoms: 2 },
  {
    name: 'atom list [C,N]CO',
    ket: ket([{ atoms: [{ type: 'atom-list', elements: ['C', 'N'] }, { label: 'C' }, { label: 'O' }], bonds: [single(0, 1), single(1, 2)] }]),
    atoms: 3,
    features: ['an atom list'],
  },
  { name: 'not-list', ket: ket([{ atoms: [{ type: 'atom-list', elements: ['C'], notList: true }] }]), atoms: 1, features: ['a “not” atom list'] },
  { name: 'any bond C~C', ket: ket([{ atoms: [{ label: 'C' }, { label: 'C' }], bonds: [{ atoms: [0, 1], customQuery: '~' }] }]), atoms: 2, features: ['a custom query bond'] },
  { name: 'any bond (type 8)', ket: ket([{ atoms: [{ label: 'C' }, { label: 'C' }], bonds: [{ type: 8, atoms: [0, 1] }] }]), atoms: 2, features: ['an “any” bond'] },
  { name: 'single-or-double bond', ket: ket([{ atoms: [{ label: 'C' }, { label: 'C' }], bonds: [{ type: 5, atoms: [0, 1] }] }]), atoms: 2, features: ['a “single or double” bond'] },
  { name: 'ring bond constraint', ket: ket([{ atoms: [{ label: 'C' }, { label: 'C' }], bonds: [{ type: 1, atoms: [0, 1], topology: 1 }] }]), atoms: 2, features: ['a ring/chain bond constraint'] },
  { name: 'wildcard *CC', ket: ket([{ atoms: [{ label: '*' }, { label: 'C' }, { label: 'C' }], bonds: [single(0, 1), single(1, 2)] }]), atoms: 3, features: ['the generic atom “*”'] },
  { name: 'generic atom A', ket: ket([{ atoms: [{ label: 'A' }, { label: 'C' }], bonds: [single(0, 1)] }]), atoms: 2, features: ['the generic atom “A”'] },
  { name: 'generic group AH', ket: ket([{ atoms: [{ label: 'AH' }] }]), atoms: 1, features: ['the generic atom “AH”'] },
  { name: 'R-group [R1]CC', ket: ket([{ atoms: [{ type: 'rg-label', $refs: ['rg-1'] }, { label: 'C' }, { label: 'C' }], bonds: [single(0, 1), single(1, 2)] }]), atoms: 3, features: ['an R-group label'] },
  { name: 'query property [#6;a]C', ket: ket([{ atoms: [{ label: 'C', queryProperties: { aromaticity: 'aromatic' } }, { label: 'C' }], bonds: [single(0, 1)] }]), atoms: 2, features: ['atom query properties'] },
  { name: 'empty queryProperties is not a query', ket: ket([{ atoms: [{ label: 'C', queryProperties: {} }] }]), atoms: 1 },
  {
    name: 'two features, each named once',
    ket: ket([{ atoms: [{ type: 'atom-list', elements: ['C', 'N'] }, { type: 'atom-list', elements: ['O', 'S'] }, { label: 'C' }], bonds: [{ type: 8, atoms: [0, 1] }, single(1, 2)] }]),
    atoms: 3,
    features: ['an atom list', 'an “any” bond'],
  },
  {
    name: 'reaction CC>>CO',
    ket: ket(
      [{ atoms: [{ label: 'C' }, { label: 'C' }], bonds: [single(0, 1)] }, { atoms: [{ label: 'C' }, { label: 'O' }], bonds: [single(0, 1)] }],
      [{ type: 'arrow', data: { mode: 'open-angle', pos: [] } }],
    ),
    atoms: 4,
    reaction: true,
  },
  { name: 'reaction plus sign', ket: ket([{ atoms: [{ label: 'C' }] }, { atoms: [{ label: 'O' }] }], [{ type: 'plus', location: [0, 0, 0] }]), atoms: 2, reaction: true },
  { name: 'multi-tailed arrow', ket: ket([{ atoms: [{ label: 'C' }] }], [{ type: 'multi-tailed-arrow', data: {} }]), atoms: 1, reaction: true },
];

for (const c of cases) {
  check(c.name, () => {
    const report = inspectDrawing(c.ket);
    assert.equal(report.atomCount, c.atoms, 'atom count');
    assert.equal(report.hasReaction, c.reaction ?? false, 'reaction');
    assert.deepEqual(report.queryFeatures, c.features ?? [], 'query features');
  });
}

check('selection does not change the fingerprint', () => {
  const plain = ket([{ atoms: [{ label: 'C' }, { label: 'O' }], bonds: [single(0, 1)] }]);
  const selected = ket([{ atoms: [{ label: 'C', selected: true }, { label: 'O' }], bonds: [{ ...single(0, 1), selected: true }] }]);
  assert.equal(inspectDrawing(plain).fingerprint, inspectDrawing(selected).fingerprint);
});
check('a different element changes the fingerprint', () => {
  const a = ket([{ atoms: [{ label: 'C' }, { label: 'O' }], bonds: [single(0, 1)] }]);
  const b = ket([{ atoms: [{ label: 'C' }, { label: 'N' }], bonds: [single(0, 1)] }]);
  assert.notEqual(inspectDrawing(a).fingerprint, inspectDrawing(b).fingerprint);
});
check('a different bond order changes the fingerprint', () => {
  const a = ket([{ atoms: [{ label: 'C' }, { label: 'C' }], bonds: [single(0, 1)] }]);
  const b = ket([{ atoms: [{ label: 'C' }, { label: 'C' }], bonds: [{ type: 2, atoms: [0, 1] }] }]);
  assert.notEqual(inspectDrawing(a).fingerprint, inspectDrawing(b).fingerprint);
});
check('non-KET input throws rather than reading as empty', () => {
  assert.throws(() => inspectDrawing('CCO'));
  assert.throws(() => inspectDrawing('{}'));
  assert.throws(() => inspectDrawing('{"root":{}}'));
});
check('joinPhrases', () => {
  assert.equal(joinPhrases([]), '');
  assert.equal(joinPhrases(['a']), 'a');
  assert.equal(joinPhrases(['a', 'b']), 'a and b');
  assert.equal(joinPhrases(['a', 'b', 'c']), 'a, b and c');
});

/* ── hasSmartsSyntax ────────────────────────────────────────────── */

const SMARTS = [
  '[#6]~[#6]', '[#6,#7;A]-C-O', '[*,H]-[#6]-[#6]', '[#6]-[#6;13]', '[*:1]-[#6]-[#6]', '[#6]1:[#6]:[#6]:[#6]:[#6]:[#6]:1',
  '*~C', '[#6;x4]', '[!C]-[#6]', '[#6]-,=[#6]', 'C-,=C', 'C!@C', '[C,N]CO', '[$(C=O)]N', '[C;R]', '[N&H2]', 'c1ccccc1~*',
];
const SMILES = [
  'CCO', 'C1=CC=CC=C1', 'c1ccccc1O', 'C#N', 'CC#CC', '[Na+].[Cl-]', 'C[C@H](N)C(=O)O', 'C/C=C/C', 'F/C=C\\F', '[13CH3]C', 'C[2H]',
  '[NH4+]', '[O-][N+](=O)c1ccccc1', '*CO', 'CC[*:1]', 'C1CC1C#N', '[Cu+2].[O-]S(=O)(=O)[O-]', 'C[C@@H]1CC[C@H](C)CC1',
  '*CC |$;;$|', 'CC[*:1] |$;;_R1$|', 'C |rb:0:4|', 'CC(C)C |a:1,o1:1,2|', '',
];
for (const pattern of SMARTS) check(`SMARTS ${pattern}`, () => assert.equal(hasSmartsSyntax(pattern), true));
for (const smiles of SMILES) check(`SMILES ${smiles || '(empty)'}`, () => assert.equal(hasSmartsSyntax(smiles), false));

const seeded = buildProducts(() => '', () => '').filter((p) => p.smiles);
for (const p of seeded) check(`seed ${p.name}`, () => assert.equal(hasSmartsSyntax(p.smiles!), false, `${p.smiles} read as SMARTS`));

const total = cases.length + 5 + SMARTS.length + SMILES.length + seeded.length;
if (failures.length > 0) {
  console.error(`✗ ${failures.length} of ${total} drawing checks failed:\n`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(`✓ ${total} drawing checks passed (${cases.length} KET drawings, ${SMARTS.length + SMILES.length} patterns, ${seeded.length} seed structures)`);
