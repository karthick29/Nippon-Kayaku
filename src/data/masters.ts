import type { Application, EquipmentMaster, Location, ProductCategory } from '@/lib/types';

/* ════════════════════════════════════════════════════════════════════
   Master data — the reference tables behind every picker and filter.
   Editable in Settings → Master Data.
   ════════════════════════════════════════════════════════════════════ */

export const APPLICATIONS: Application[] = [
  {
    id: 'app-pharma-agro',
    name: 'Pharma and Agro Intermediate',
    slug: 'pharma-and-agro-intermediate',
    description: 'Dual-use intermediates feeding both pharmaceutical and crop-protection routes.',
    colorKey: 'pharma',
    sortOrder: 1,
    active: true,
  },
  {
    id: 'app-api',
    name: 'API Intermediate',
    slug: 'api-intermediate',
    description: 'Advanced intermediates one to three steps from a registered API.',
    colorKey: 'pharma',
    sortOrder: 2,
    active: true,
  },
  {
    id: 'app-agrochem',
    name: 'Agrochemical',
    slug: 'agrochemical',
    description: 'Actives and intermediates for herbicides, fungicides and insecticides.',
    colorKey: 'agro',
    sortOrder: 3,
    active: true,
  },
  {
    id: 'app-specialty',
    name: 'Specialty Chemical',
    slug: 'specialty-chemical',
    description: 'Performance chemicals sold on function rather than composition.',
    colorKey: 'specialty',
    sortOrder: 4,
    active: true,
  },
  {
    id: 'app-polymer',
    name: 'Polymer and Resin',
    slug: 'polymer-and-resin',
    description: 'Monomers, initiators and curing agents for polymer systems.',
    colorKey: 'polymer',
    sortOrder: 5,
    active: true,
  },
  {
    id: 'app-electronic',
    name: 'Electronic Chemical',
    slug: 'electronic-chemical',
    description: 'High-purity materials for semiconductor and display manufacturing.',
    colorKey: 'electronic',
    sortOrder: 6,
    active: true,
  },
  {
    id: 'app-dye',
    name: 'Dye and Pigment',
    slug: 'dye-and-pigment',
    description: 'Colourants, dye intermediates and pigment precursors.',
    colorKey: 'dye',
    sortOrder: 7,
    active: true,
  },
  {
    id: 'app-flavour',
    name: 'Flavour and Fragrance',
    slug: 'flavour-and-fragrance',
    description: 'Aroma chemicals and their synthetic precursors.',
    colorKey: 'specialty',
    sortOrder: 8,
    active: true,
  },
  {
    id: 'app-catalyst',
    name: 'Catalyst and Ligand',
    slug: 'catalyst-and-ligand',
    description: 'Homogeneous catalysts, ligands and phase-transfer agents.',
    colorKey: 'polymer',
    sortOrder: 9,
    active: true,
  },
  {
    id: 'app-photoresist',
    name: 'Photoresist Material',
    slug: 'photoresist-material',
    description: 'Photoacid generators, resins and additives for lithography.',
    colorKey: 'electronic',
    sortOrder: 10,
    active: true,
  },
];

export const CATEGORIES: ProductCategory[] = [
  {
    id: 'cat-intermediate',
    name: 'Intermediate',
    slug: 'intermediate',
    description: 'Multi-step synthetic intermediates.',
    sortOrder: 1,
    active: true,
  },
  {
    id: 'cat-building-block',
    name: 'Building Block',
    slug: 'building-block',
    description: 'Small, broadly reusable synthons.',
    sortOrder: 2,
    active: true,
  },
  {
    id: 'cat-reagent',
    name: 'Reagent',
    slug: 'reagent',
    description: 'Stoichiometric reagents for transformation steps.',
    sortOrder: 3,
    active: true,
  },
  {
    id: 'cat-catalyst',
    name: 'Catalyst',
    slug: 'catalyst',
    description: 'Catalytic species and ligand systems.',
    sortOrder: 4,
    active: true,
  },
  {
    id: 'cat-formulation',
    name: 'Formulation',
    slug: 'formulation',
    description: 'Solutions, dispersions and blended presentations.',
    sortOrder: 5,
    active: true,
  },
];

export const LOCATIONS: Location[] = [
  { id: 'loc-bangalore', name: 'Bangalore', slug: 'bangalore', state: 'Karnataka', country: 'India', region: 'South', sortOrder: 1, active: true },
  { id: 'loc-hosur', name: 'Hosur', slug: 'hosur', state: 'Tamil Nadu', country: 'India', region: 'South', sortOrder: 2, active: true },
  { id: 'loc-hyderabad', name: 'Hyderabad', slug: 'hyderabad', state: 'Telangana', country: 'India', region: 'South', sortOrder: 3, active: true },
  { id: 'loc-chennai', name: 'Chennai', slug: 'chennai', state: 'Tamil Nadu', country: 'India', region: 'South', sortOrder: 4, active: true },
  { id: 'loc-cuddalore', name: 'Cuddalore', slug: 'cuddalore', state: 'Tamil Nadu', country: 'India', region: 'South', sortOrder: 5, active: true },
  { id: 'loc-visakhapatnam', name: 'Visakhapatnam', slug: 'visakhapatnam', state: 'Andhra Pradesh', country: 'India', region: 'South', sortOrder: 6, active: true },
  { id: 'loc-pune', name: 'Pune', slug: 'pune', state: 'Maharashtra', country: 'India', region: 'West', sortOrder: 7, active: true },
  { id: 'loc-mumbai', name: 'Mumbai', slug: 'mumbai', state: 'Maharashtra', country: 'India', region: 'West', sortOrder: 8, active: true },
  { id: 'loc-vadodara', name: 'Vadodara', slug: 'vadodara', state: 'Gujarat', country: 'India', region: 'West', sortOrder: 9, active: true },
  { id: 'loc-ankleshwar', name: 'Ankleshwar', slug: 'ankleshwar', state: 'Gujarat', country: 'India', region: 'West', sortOrder: 10, active: true },
];

export const EQUIPMENT_MASTER: EquipmentMaster[] = [
  { id: 'eq-hoods', key: 'hoods', name: 'Fume Hoods', group: 'Infrastructure', valueType: 'count', unit: 'hoods', sortOrder: 1 },
  { id: 'eq-open-reaction', key: 'openReaction', name: 'Open Reaction Stations', group: 'Reaction', valueType: 'count', unit: 'stations', sortOrder: 2 },
  { id: 'eq-autoclave', key: 'autoclave', name: 'Autoclave', group: 'Reaction', valueType: 'spec', sortOrder: 3 },
  { id: 'eq-hydrogenation', key: 'hydrogenation', name: 'Hydrogenation', group: 'Reaction', valueType: 'spec', sortOrder: 4 },
  { id: 'eq-flow-chemistry', key: 'flowChemistry', name: 'Flow Chemistry', group: 'Reaction', valueType: 'boolean', sortOrder: 5 },
  { id: 'eq-cryo-reactor', key: 'cryoReactor', name: 'Cryogenic Reactor', group: 'Reaction', valueType: 'spec', sortOrder: 6 },
  { id: 'eq-kilo-lab', key: 'kiloLab', name: 'Kilo Lab', group: 'Scale-up', valueType: 'spec', sortOrder: 7 },
  { id: 'eq-pilot-plant', key: 'pilotPlant', name: 'Pilot Plant', group: 'Scale-up', valueType: 'spec', sortOrder: 8 },
  { id: 'eq-rotavapor', key: 'rotavapor', name: 'Rotavapor', group: 'Isolation', valueType: 'spec', sortOrder: 9 },
  { id: 'eq-hplc', key: 'hplc', name: 'HPLC', group: 'Analytical', valueType: 'count', unit: 'units', sortOrder: 10 },
  { id: 'eq-gc', key: 'gc', name: 'GC', group: 'Analytical', valueType: 'count', unit: 'units', sortOrder: 11 },
  { id: 'eq-ms', key: 'ms', name: 'MS', group: 'Analytical', valueType: 'count', unit: 'units', sortOrder: 12 },
  { id: 'eq-prep-hplc', key: 'prepHplc', name: 'Prep HPLC', group: 'Analytical', valueType: 'count', unit: 'units', sortOrder: 13 },
  { id: 'eq-nmr', key: 'nmr', name: 'NMR', group: 'Analytical', valueType: 'spec', sortOrder: 14 },
  { id: 'eq-incineration', key: 'incineration', name: 'Incineration Facility', group: 'Infrastructure', valueType: 'boolean', sortOrder: 15 },
];

export const EQUIPMENT_BY_KEY = new Map(EQUIPMENT_MASTER.map((e) => [e.key, e]));
export const APPLICATION_BY_ID = new Map(APPLICATIONS.map((a) => [a.id, a]));
export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));
export const LOCATION_BY_ID = new Map(LOCATIONS.map((l) => [l.id, l]));
