import type { Company, CompanyEquipment, EquipmentKey } from '@/lib/types';
import { slugify } from '@/lib/slug';

/* ════════════════════════════════════════════════════════════════════
   Company seed data — 20 CDMO / specialty manufacturers.

   The first four rows (Arkgen, DSK InnoSciences, Sravathi, Gomti) come
   from the brief. Those source rows were partially column-misaligned and
   sparse — e.g. the Arkgen row ran one column short from "MS" onward, and
   the Gomti row carried no PhD count. They have been normalised onto the
   canonical column set; every value present in the source is preserved,
   and gaps are filled with plausible values flagged in docs/DATA.md.
   The remaining 16 companies are generated to the same shape.
   ════════════════════════════════════════════════════════════════════ */

/** Anchor for the seeded corpus — must match SEED_NOW in dataset.ts. */
const REFERENCE_YEAR = 2026;
const REFERENCE_MONTH = 5; // June (0-indexed), one month before SEED_NOW

type EqValue = number | string | boolean | null;

interface CompanySeed {
  name: string;
  locationId: string;
  chemicalStaff: number;
  phdCount: number;
  established: number;
  capital?: string;
  strength?: string;
  presentation?: string;
  remarks?: string;
  website?: string;
  contactEmail?: string;
  /** null / false / 0-with-no-spec means the capability is absent. */
  eq: Partial<Record<EquipmentKey, EqValue>>;
  /** Optional per-equipment remarks. */
  eqRemarks?: Partial<Record<EquipmentKey, string>>;
}

const SEEDS: CompanySeed[] = [
  /* ── From the brief ─────────────────────────────────────────────── */
  {
    name: 'Arkgen',
    locationId: 'loc-bangalore',
    chemicalStaff: 15,
    phdCount: 2,
    established: 2014,
    capital: '$1M',
    strength: 'Custom synthesis and route scouting at gram-to-100 g scale',
    presentation: 'OK',
    remarks: 'Compact discovery-support team; strong on chloroformate and carbamate chemistry.',
    website: 'https://arkgen.example.in',
    contactEmail: 'bd@arkgen.example.in',
    eq: {
      hoods: 12,
      autoclave: '500 mL, 2 L',
      flowChemistry: false,
      kiloLab: '100 L Glass',
      rotavapor: '10 cm',
      openReaction: 3,
      hplc: 2,
      gc: 0,
      ms: null,
      prepHplc: null,
      nmr: null,
      pilotPlant: null,
      incineration: false,
    },
    eqRemarks: { autoclave: 'Two SS316 units, 100 bar rated' },
  },
  {
    name: 'DSK InnoSciences',
    locationId: 'loc-hosur',
    chemicalStaff: 80,
    phdCount: 7,
    established: 2013,
    capital: '$6M',
    strength: 'Polymer synthesis',
    presentation: '100 mL, 250 mL, 500 mL',
    remarks: 'Largest analytical bench in the panel; in-house 400 MHz NMR.',
    website: 'https://dskinnosciences.example.in',
    contactEmail: 'contact@dskinnosciences.example.in',
    eq: {
      hoods: 75,
      autoclave: '100 mL, 250 mL, 500 mL',
      flowChemistry: false,
      kiloLab: '20 L',
      rotavapor: 4,
      openReaction: 6,
      hplc: 2,
      gc: 2,
      ms: 1,
      prepHplc: null,
      nmr: '400 MHz',
      pilotPlant: null,
      incineration: false,
      hydrogenation: '5 L, 20 L',
    },
    eqRemarks: { nmr: 'Bruker 400 MHz, autosampler' },
  },
  {
    name: 'Sravathi Advance Process Technologies',
    locationId: 'loc-bangalore',
    chemicalStaff: 50,
    phdCount: 3,
    established: 2019,
    capital: '$4M',
    strength: 'Flow Chemistry',
    presentation: 'Continuous output, campaign based',
    remarks: 'Continuous-flow specialist; process intensification and hazardous-step containment.',
    website: 'https://sravathi.example.in',
    contactEmail: 'info@sravathi.example.in',
    eq: {
      hoods: 50,
      autoclave: '1 L, 5 L',
      flowChemistry: true,
      kiloLab: '50 L',
      rotavapor: '20 cm',
      openReaction: 8,
      hplc: 4,
      gc: 3,
      ms: 1,
      prepHplc: 1,
      nmr: null,
      pilotPlant: null,
      incineration: false,
      cryoReactor: '-40 °C, 20 L',
    },
    eqRemarks: { flowChemistry: 'Corning AFR and Vapourtec R-series skids' },
  },
  {
    name: 'Gomti Research and Pharmachem',
    locationId: 'loc-bangalore',
    chemicalStaff: 10,
    phdCount: 1,
    established: 1997,
    capital: '$2M',
    strength: 'Pilot plant with on-site incineration',
    presentation: 'Drums, 25–200 kg',
    remarks: 'Oldest facility in the panel; own effluent incineration keeps halogenated waste in-house.',
    website: 'https://gomtiresearch.example.in',
    contactEmail: 'sales@gomtiresearch.example.in',
    eq: {
      hoods: 3,
      autoclave: '2 L',
      flowChemistry: false,
      kiloLab: '10 L',
      rotavapor: '10 cm',
      openReaction: 2,
      hplc: 1,
      gc: 1,
      ms: null,
      prepHplc: null,
      nmr: null,
      pilotPlant: '500 L, 1000 L GLR',
      incineration: true,
    },
    eqRemarks: { incineration: 'On-site rotary kiln, halogenated stream approved' },
  },

  /* ── Generated panel ────────────────────────────────────────────── */
  {
    name: 'Vindhya Fine Chemicals',
    locationId: 'loc-hyderabad',
    chemicalStaff: 140,
    phdCount: 12,
    established: 2006,
    capital: '$18M',
    strength: 'cGMP API intermediates, USFDA inspected',
    presentation: '25 kg fibre drums, 200 kg HDPE',
    remarks: 'Three cGMP blocks; supports registered starting materials for regulated markets.',
    website: 'https://vindhyafine.example.in',
    contactEmail: 'bd@vindhyafine.example.in',
    eq: {
      hoods: 96, autoclave: '250 mL, 2 L, 10 L', flowChemistry: true, kiloLab: '100 L Glass, 250 L SS',
      rotavapor: '20 cm', openReaction: 14, hplc: 9, gc: 6, ms: 3, prepHplc: 2, nmr: '400 MHz',
      pilotPlant: '2000 L GLR x 4', incineration: true, hydrogenation: '50 L, 200 L', cryoReactor: '-70 °C, 100 L',
    },
  },
  {
    name: 'Kaveri Organics',
    locationId: 'loc-chennai',
    chemicalStaff: 62,
    phdCount: 5,
    established: 2011,
    capital: '$5M',
    strength: 'Agrochemical intermediates at multi-tonne scale',
    presentation: '50 kg bags, 1 MT jumbo',
    remarks: 'Cost-competitive on chlorination and nitration steps.',
    website: 'https://kaveriorganics.example.in',
    eq: {
      hoods: 44, autoclave: '5 L, 20 L', flowChemistry: false, kiloLab: '50 L, 100 L',
      rotavapor: '20 cm', openReaction: 9, hplc: 3, gc: 4, ms: 1, prepHplc: null, nmr: null,
      pilotPlant: '1000 L GLR x 2', incineration: false, hydrogenation: '20 L',
    },
  },
  {
    name: 'Deccan Speciality Labs',
    locationId: 'loc-hyderabad',
    chemicalStaff: 34,
    phdCount: 6,
    established: 2016,
    capital: '$3M',
    strength: 'Chiral separation and preparative purification',
    presentation: '100 g – 5 kg, amber glass',
    remarks: 'Two prep-HPLC lines and SFC; strong chiral method development.',
    website: 'https://deccanspeciality.example.in',
    eq: {
      hoods: 26, autoclave: '250 mL, 1 L', flowChemistry: false, kiloLab: '20 L',
      rotavapor: '10 cm', openReaction: 5, hplc: 7, gc: 2, ms: 3, prepHplc: 2, nmr: '300 MHz',
      pilotPlant: null, incineration: false, cryoReactor: '-40 °C, 10 L',
    },
  },
  {
    name: 'Narmada Intermediates',
    locationId: 'loc-vadodara',
    chemicalStaff: 210,
    phdCount: 9,
    established: 1994,
    capital: '$26M',
    strength: 'Large-volume dye and pigment intermediates',
    presentation: '500 kg, 1 MT jumbo bags',
    remarks: 'Backward integrated to key aromatics; zero-liquid-discharge plant.',
    website: 'https://narmadaintermediates.example.in',
    eq: {
      hoods: 58, autoclave: '20 L, 100 L', flowChemistry: false, kiloLab: '100 L, 250 L',
      rotavapor: '20 cm', openReaction: 18, hplc: 6, gc: 5, ms: 2, prepHplc: 1, nmr: null,
      pilotPlant: '5000 L GLR x 6', incineration: true, hydrogenation: '200 L, 1000 L',
    },
  },
  {
    name: 'Sahyadri CDMO',
    locationId: 'loc-pune',
    chemicalStaff: 118,
    phdCount: 14,
    established: 2009,
    capital: '$15M',
    strength: 'End-to-end CDMO from route scouting to validation batches',
    presentation: '1 kg – 500 kg, GMP packed',
    remarks: 'Dedicated process safety lab with RC1 and DSC screening.',
    website: 'https://sahyadricdmo.example.in',
    eq: {
      hoods: 84, autoclave: '500 mL, 5 L, 50 L', flowChemistry: true, kiloLab: '100 L Glass, 200 L SS',
      rotavapor: '20 cm', openReaction: 16, hplc: 11, gc: 7, ms: 4, prepHplc: 2, nmr: '500 MHz',
      pilotPlant: '2000 L GLR x 3', incineration: true, hydrogenation: '20 L, 100 L', cryoReactor: '-90 °C, 50 L',
    },
  },
  {
    name: 'Konkan Performance Materials',
    locationId: 'loc-mumbai',
    chemicalStaff: 76,
    phdCount: 8,
    established: 2004,
    capital: '$9M',
    strength: 'Polymer additives and curing agents',
    presentation: '25 kg drums, 200 L totes',
    remarks: 'Rheology and thermal characterisation suite in-house.',
    website: 'https://konkanpm.example.in',
    eq: {
      hoods: 40, autoclave: '2 L, 20 L', flowChemistry: false, kiloLab: '50 L',
      rotavapor: '20 cm', openReaction: 11, hplc: 4, gc: 3, ms: 1, prepHplc: null, nmr: '400 MHz',
      pilotPlant: '1000 L SS x 2', incineration: false, hydrogenation: '20 L',
    },
  },
  {
    name: 'Bharat Electronic Chemicals',
    locationId: 'loc-ankleshwar',
    chemicalStaff: 95,
    phdCount: 11,
    established: 2015,
    capital: '$22M',
    strength: 'Sub-ppb metals control for semiconductor grade material',
    presentation: 'Class 100 packed, 1 L – 20 L',
    remarks: 'Cleanroom filling line; ICP-MS trace metals lab.',
    website: 'https://bharatelectronicchem.example.in',
    eq: {
      hoods: 52, autoclave: '1 L, 10 L', flowChemistry: true, kiloLab: '50 L Quartz-lined',
      rotavapor: '10 cm', openReaction: 7, hplc: 8, gc: 6, ms: 5, prepHplc: 2, nmr: '400 MHz',
      pilotPlant: '500 L x 2', incineration: false, cryoReactor: '-40 °C, 20 L',
    },
  },
  {
    name: 'Godavari Life Sciences',
    locationId: 'loc-visakhapatnam',
    chemicalStaff: 165,
    phdCount: 10,
    established: 2001,
    capital: '$20M',
    strength: 'High-pressure hydrogenation and catalytic reduction',
    presentation: '25 kg – 1 MT',
    remarks: 'Six hydrogenation autoclaves up to 100 bar with hydrogen generation on site.',
    website: 'https://godavarils.example.in',
    eq: {
      hoods: 62, autoclave: '5 L, 50 L, 200 L', flowChemistry: false, kiloLab: '100 L, 250 L',
      rotavapor: '20 cm', openReaction: 15, hplc: 7, gc: 5, ms: 2, prepHplc: 1, nmr: null,
      pilotPlant: '3000 L GLR x 4', incineration: true, hydrogenation: '5 L, 50 L, 200 L, 1000 L',
    },
  },
  {
    name: 'Tungabhadra Catalysts',
    locationId: 'loc-bangalore',
    chemicalStaff: 28,
    phdCount: 9,
    established: 2018,
    capital: '$4M',
    strength: 'Homogeneous catalyst and ligand design',
    presentation: '10 g – 5 kg, glove-box packed',
    remarks: 'Air-sensitive handling with four glove boxes; Schlenk line bank.',
    website: 'https://tungabhadracat.example.in',
    eq: {
      hoods: 22, autoclave: '100 mL, 500 mL', flowChemistry: true, kiloLab: '10 L',
      rotavapor: '10 cm', openReaction: 6, hplc: 3, gc: 2, ms: 2, prepHplc: 1, nmr: '500 MHz',
      pilotPlant: null, incineration: false, cryoReactor: '-90 °C, 5 L',
    },
  },
  {
    name: 'Palar Agro Sciences',
    locationId: 'loc-cuddalore',
    chemicalStaff: 187,
    phdCount: 6,
    established: 1989,
    capital: '$24M',
    strength: 'Tonne-scale agrochemical actives',
    presentation: '200 kg drums, 1 MT IBC',
    remarks: 'Coastal site with captive effluent treatment and marine discharge consent.',
    website: 'https://palaragro.example.in',
    eq: {
      hoods: 48, autoclave: '20 L, 100 L', flowChemistry: false, kiloLab: '100 L, 500 L',
      rotavapor: '20 cm', openReaction: 20, hplc: 5, gc: 6, ms: 2, prepHplc: null, nmr: null,
      pilotPlant: '5000 L GLR x 8', incineration: true, hydrogenation: '100 L, 500 L',
    },
  },
  {
    name: 'Chambal Fine Organics',
    locationId: 'loc-vadodara',
    chemicalStaff: 54,
    phdCount: 4,
    established: 2012,
    capital: '$6M',
    strength: 'Nitration and diazotisation under continuous control',
    presentation: '25 kg – 200 kg',
    remarks: 'Flow nitration cell reduces hold-up of energetic intermediates.',
    website: 'https://chambalfine.example.in',
    eq: {
      hoods: 36, autoclave: '2 L, 10 L', flowChemistry: true, kiloLab: '50 L',
      rotavapor: '20 cm', openReaction: 10, hplc: 4, gc: 3, ms: 1, prepHplc: null, nmr: null,
      pilotPlant: '1000 L GLR x 2', incineration: false, cryoReactor: '-20 °C, 50 L',
    },
  },
  {
    name: 'Aravalli Research Chemicals',
    locationId: 'loc-pune',
    chemicalStaff: 22,
    phdCount: 7,
    established: 2020,
    capital: '$2M',
    strength: 'Milligram-to-gram library synthesis',
    presentation: '10 mg – 100 g vials',
    remarks: 'Discovery-stage partner; parallel synthesis with 96-position blocks.',
    website: 'https://aravalliresearch.example.in',
    eq: {
      hoods: 18, autoclave: '100 mL', flowChemistry: false, kiloLab: null,
      rotavapor: '10 cm', openReaction: 4, hplc: 4, gc: 1, ms: 2, prepHplc: 1, nmr: '400 MHz',
      pilotPlant: null, incineration: false,
    },
  },
  {
    name: 'Meghna Speciality Solutions',
    locationId: 'loc-hosur',
    chemicalStaff: 68,
    phdCount: 5,
    established: 2008,
    capital: '$7M',
    strength: 'Solvent-based formulation and dilution services',
    presentation: '20 L, 200 L, 1000 L IBC',
    remarks: 'Toluene and THF handling with nitrogen blanketing throughout.',
    website: 'https://meghnaspeciality.example.in',
    eq: {
      hoods: 30, autoclave: '5 L', flowChemistry: false, kiloLab: '100 L, 200 L',
      rotavapor: '20 cm', openReaction: 8, hplc: 3, gc: 4, ms: 1, prepHplc: null, nmr: null,
      pilotPlant: '2000 L SS x 3', incineration: false,
    },
  },
  {
    name: 'Yamuna Pharma Chem',
    locationId: 'loc-hyderabad',
    chemicalStaff: 132,
    phdCount: 13,
    established: 2003,
    capital: '$17M',
    strength: 'Regulated-market API intermediates with full DMF support',
    presentation: '5 kg – 100 kg, double LDPE',
    remarks: 'EDQM and PMDA inspected; complete elemental impurity package.',
    website: 'https://yamunapharmachem.example.in',
    eq: {
      hoods: 88, autoclave: '500 mL, 5 L, 20 L', flowChemistry: true, kiloLab: '100 L Glass, 250 L SS',
      rotavapor: '20 cm', openReaction: 17, hplc: 12, gc: 8, ms: 4, prepHplc: 3, nmr: '500 MHz',
      pilotPlant: '2000 L GLR x 5', incineration: true, hydrogenation: '20 L, 100 L, 500 L', cryoReactor: '-70 °C, 100 L',
    },
  },
  {
    name: 'Tapti Colour Chem',
    locationId: 'loc-ankleshwar',
    chemicalStaff: 96,
    phdCount: 3,
    established: 1998,
    capital: '$11M',
    strength: 'Azo and anthraquinone dye intermediates',
    presentation: '50 kg bags, 500 kg jumbo',
    remarks: 'Continuous coupling line; strong on sulphonated aromatics.',
    website: 'https://tapticolour.example.in',
    eq: {
      hoods: 34, autoclave: '10 L, 50 L', flowChemistry: false, kiloLab: '100 L',
      rotavapor: '20 cm', openReaction: 13, hplc: 4, gc: 2, ms: 1, prepHplc: null, nmr: null,
      pilotPlant: '3000 L GLR x 3', incineration: true,
    },
  },
  {
    name: 'Beas Aroma Chemicals',
    locationId: 'loc-mumbai',
    chemicalStaff: 44,
    phdCount: 4,
    established: 2010,
    capital: '$5M',
    strength: 'Aroma chemicals and terpene derivatives',
    presentation: '5 kg, 25 kg, 190 kg drums',
    remarks: 'Fractional distillation columns to 40 theoretical plates.',
    website: 'https://beasaroma.example.in',
    eq: {
      hoods: 24, autoclave: '2 L, 10 L', flowChemistry: false, kiloLab: '50 L, 100 L',
      rotavapor: '20 cm', openReaction: 9, hplc: 3, gc: 5, ms: 2, prepHplc: 1, nmr: '300 MHz',
      pilotPlant: '1000 L SS x 2', incineration: false, hydrogenation: '20 L',
    },
  },
  {
    name: 'Krishna Process Technologies',
    locationId: 'loc-chennai',
    chemicalStaff: 39,
    phdCount: 6,
    established: 2017,
    capital: '$4M',
    strength: 'Photochemistry and electrochemical synthesis',
    presentation: '100 g – 20 kg',
    remarks: 'Flow photoreactor bank plus divided-cell electrolysis rigs.',
    website: 'https://krishnaprocess.example.in',
    eq: {
      hoods: 28, autoclave: '500 mL, 2 L', flowChemistry: true, kiloLab: '20 L',
      rotavapor: '10 cm', openReaction: 6, hplc: 5, gc: 3, ms: 2, prepHplc: 1, nmr: '400 MHz',
      pilotPlant: null, incineration: false, cryoReactor: '-40 °C, 20 L',
    },
  },
  {
    name: 'Indus Photoresist Materials',
    locationId: 'loc-visakhapatnam',
    chemicalStaff: 58,
    phdCount: 15,
    established: 2021,
    capital: '$30M',
    strength: 'Photoacid generators and lithography resins',
    presentation: 'Amber HDPE, 500 g – 10 kg',
    remarks: 'Newest facility in the panel; yellow-room synthesis and packing throughout.',
    website: 'https://indusphotoresist.example.in',
    eq: {
      hoods: 42, autoclave: '250 mL, 1 L', flowChemistry: true, kiloLab: '20 L',
      rotavapor: '10 cm', openReaction: 5, hplc: 9, gc: 4, ms: 6, prepHplc: 3, nmr: '500 MHz',
      pilotPlant: null, incineration: false, cryoReactor: '-70 °C, 20 L',
    },
  },
];

const ALL_KEYS: EquipmentKey[] = [
  'hoods', 'openReaction', 'autoclave', 'hydrogenation', 'flowChemistry', 'cryoReactor',
  'kiloLab', 'pilotPlant', 'rotavapor', 'hplc', 'gc', 'ms', 'prepHplc', 'nmr', 'incineration',
];

/** Expands the compact seed shape into normalised Company + CompanyEquipment rows. */
export function buildCompanies(locationName: (id: string) => string): {
  companies: Company[];
  equipment: CompanyEquipment[];
} {
  const companies: Company[] = [];
  const equipment: CompanyEquipment[] = [];

  SEEDS.forEach((seed, index) => {
    const id = `cmp-${String(index + 1).padStart(3, '0')}`;

    // `established` is when the company was founded; `createdAt` is when
    // it was onboarded into ASTRA. Onboarding is spread across the 24
    // months ending at the seed reference month so the dashboard's
    // rolling-12-month trend has both series populated.
    const monthsAgo = 23 - ((index * 5) % 24);
    const created = new Date(
      Date.UTC(REFERENCE_YEAR, REFERENCE_MONTH - monthsAgo, ((index * 7) % 27) + 1, 9, 30),
    );
    const updated = new Date(created.getTime() + (index % 9) * 86_400_000 * 21);

    companies.push({
      id,
      name: seed.name,
      slug: slugify(seed.name),
      locationId: seed.locationId,
      locationName: locationName(seed.locationId),
      chemicalStaff: seed.chemicalStaff,
      phdCount: seed.phdCount,
      established: seed.established,
      capital: seed.capital,
      strength: seed.strength,
      presentation: seed.presentation,
      remarks: seed.remarks,
      website: seed.website,
      contactEmail: seed.contactEmail ?? `bd@${slugify(seed.name).replace(/-/g, '')}.example.in`,
      createdAt: created.toISOString(),
      updatedAt: updated.toISOString(),
      deletedAt: null,
    });

    ALL_KEYS.forEach((key) => {
      const raw = seed.eq[key];
      const available =
        raw === true || (typeof raw === 'number' && raw > 0) || (typeof raw === 'string' && raw.length > 0);

      equipment.push({
        id: `${id}-${key}`,
        companyId: id,
        equipmentKey: key,
        available,
        count: typeof raw === 'number' ? raw : undefined,
        specification: typeof raw === 'string' ? raw : undefined,
        capacity: typeof raw === 'string' ? raw : undefined,
        remarks: seed.eqRemarks?.[key],
      });
    });
  });

  return { companies, equipment };
}

export const COMPANY_SEED_COUNT = SEEDS.length;
