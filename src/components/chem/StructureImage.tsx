import 'server-only';
import { depictStructure } from '@/server/chem/rdkit';
import { StructureSvg } from './StructureSvg';

const DIMENSIONS = {
  sm: { width: 160, height: 120 },
  md: { width: 320, height: 220 },
  lg: { width: 480, height: 320 },
  /** Short and wide — search result cards. */
  wide: { width: 320, height: 150 },
} as const;

/** Server Component — draws a SMILES string with RDKit at render time. */
export async function StructureImage({
  smiles,
  name,
  size = 'md',
  highlight,
  className,
}: {
  smiles: string | undefined;
  /** Substance name, used for the accessible label. */
  name: string;
  size?: keyof typeof DIMENSIONS;
  highlight?: { atoms: number[]; bonds: number[] };
  className?: string;
}) {
  const svg = smiles ? await depictStructure(smiles, { ...DIMENSIONS[size], highlight }) : null;
  return (
    <StructureSvg
      svg={svg}
      label={`Chemical structure of ${name}`}
      size={size === 'wide' ? 'sm' : size}
      className={className}
    />
  );
}
