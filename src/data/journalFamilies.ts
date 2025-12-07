/**
 * Major biomedical journal families with their specialized journals
 * Impact factors are approximate and for display purposes
 */

export interface JournalFamily {
  id: string;
  displayName: string;
  impactFactor: number;
  color: string; // Brand color for visual grouping
  icon?: string;
  members: string[]; // All journal names that belong to this family
}

export const JOURNAL_FAMILIES: JournalFamily[] = [
  {
    id: 'nature',
    displayName: 'Nature',
    impactFactor: 69,
    color: '#0066CC', // Nature blue
    icon: '🔬',
    members: [
      'Nature',
      'Nature Medicine',
      'Nature Biotechnology',
      'Nature Genetics',
      'Nature Immunology',
      'Nature Neuroscience',
      'Nature Structural & Molecular Biology',
      'Nature Cell Biology',
      'Nature Methods',
      'Nature Chemical Biology',
      'Nature Protocols',
      'Nature Reviews Genetics',
      'Nature Reviews Immunology',
      'Nature Reviews Neuroscience',
      'Nature Reviews Molecular Cell Biology',
      'Nature Reviews Drug Discovery',
      'Nature Reviews Cancer',
      'Nature Communications',
      'Nature Metabolism',
      'Nature Microbiology',
      'Nature Plants',
      'Nature Ecology & Evolution',
      'Nature Climate Change',
      'Nature Energy',
      'Nature Nanotechnology',
      'Nature Photonics',
      'Nature Physics',
      'Nature Chemistry',
      'Nature Materials'
    ]
  },
  {
    id: 'science',
    displayName: 'Science',
    impactFactor: 56,
    color: '#DC143C', // Science red
    icon: '🧪',
    members: [
      'Science',
      'Science Translational Medicine',
      'Science Signaling',
      'Science Immunology',
      'Science Advances',
      'Science Robotics'
    ]
  },
  {
    id: 'cell',
    displayName: 'Cell',
    impactFactor: 64,
    color: '#00A651', // Cell green
    icon: '🧬',
    members: [
      'Cell',
      'Cell Stem Cell',
      'Cell Metabolism',
      'Molecular Cell',
      'Developmental Cell',
      'Cell Reports',
      'Cancer Cell',
      'Immunity',
      'Neuron',
      'Cell Host & Microbe',
      'Cell Chemical Biology',
      'Cell Systems',
      'Trends in Cell Biology',
      'Trends in Immunology',
      'Trends in Neurosciences',
      'Trends in Genetics',
      'Trends in Biotechnology',
      'Trends in Biochemical Sciences',
      'Current Biology',
      'Structure',
      'Molecular Therapy',
      'Cell Reports Medicine',
      'Cell Reports Methods',
      'Cell Genomics'
    ]
  },
  {
    id: 'nejm',
    displayName: 'New England Journal of Medicine',
    impactFactor: 176,
    color: '#8B0000', // NEJM maroon
    icon: '🏥',
    members: [
      'New England Journal of Medicine',
      'NEJM Evidence',
      'NEJM Catalyst',
      'NEJM Journal Watch'
    ]
  },
  {
    id: 'lancet',
    displayName: 'The Lancet',
    impactFactor: 168,
    color: '#E03C31', // Lancet red
    icon: '💉',
    members: [
      'The Lancet',
      'The Lancet Oncology',
      'The Lancet Neurology',
      'The Lancet Infectious Diseases',
      'The Lancet Respiratory Medicine',
      'The Lancet Diabetes & Endocrinology',
      'The Lancet Haematology',
      'The Lancet Gastroenterology & Hepatology',
      'The Lancet HIV',
      'The Lancet Psychiatry',
      'The Lancet Global Health',
      'The Lancet Public Health',
      'The Lancet Digital Health',
      'The Lancet Planetary Health',
      'The Lancet Rheumatology',
      'The Lancet Microbe'
    ]
  },
  {
    id: 'jama',
    displayName: 'JAMA',
    impactFactor: 157,
    color: '#004B87', // JAMA blue
    icon: '🩺',
    members: [
      'JAMA',
      'JAMA Internal Medicine',
      'JAMA Oncology',
      'JAMA Cardiology',
      'JAMA Neurology',
      'JAMA Psychiatry',
      'JAMA Surgery',
      'JAMA Pediatrics',
      'JAMA Dermatology',
      'JAMA Ophthalmology',
      'JAMA Otolaryngology-Head & Neck Surgery',
      'JAMA Network Open',
      'JAMA Health Forum'
    ]
  },
  {
    id: 'plos',
    displayName: 'PLOS',
    impactFactor: 9,
    color: '#F68212', // PLOS orange
    icon: '📚',
    members: [
      'PLOS Biology',
      'PLOS Medicine',
      'PLOS ONE',
      'PLOS Genetics',
      'PLOS Computational Biology',
      'PLOS Pathogens',
      'PLOS Neglected Tropical Diseases'
    ]
  },
  {
    id: 'bmc',
    displayName: 'BMC',
    impactFactor: 8,
    color: '#0099CC', // BMC blue
    icon: '📖',
    members: [
      'BMC Biology',
      'BMC Medicine',
      'BMC Genomics',
      'BMC Bioinformatics',
      'BMC Cancer',
      'BMC Neuroscience',
      'BMC Immunology',
      'BMC Medical Genomics',
      'BMC Infectious Diseases',
      'BMC Public Health'
    ]
  },
  {
    id: 'pnas',
    displayName: 'PNAS',
    impactFactor: 12,
    color: '#003F87', // PNAS blue
    icon: '🏛️',
    members: [
      'Proceedings of the National Academy of Sciences',
      'PNAS',
      'Proceedings of the National Academy of Sciences of the United States of America'
    ]
  },
  {
    id: 'other-high-impact',
    displayName: 'Other High-Impact Journals',
    impactFactor: 15,
    color: '#666666',
    icon: '⭐',
    members: [
      'eLife',
      'Genome Biology',
      'Genome Research',
      'Nucleic Acids Research',
      'Blood',
      'Circulation',
      'Gastroenterology',
      'Hepatology',
      'Journal of Clinical Investigation',
      'Journal of Experimental Medicine',
      'Annals of Internal Medicine',
      'BMJ',
      'Molecular Psychiatry',
      'Brain',
      'Journal of Cell Biology'
    ]
  }
];

/**
 * Find which journal family a venue belongs to
 */
export function findJournalFamily(venue: string): JournalFamily | null {
  if (!venue) return null;

  const venueLower = venue.toLowerCase().trim();

  for (const family of JOURNAL_FAMILIES) {
    for (const member of family.members) {
      if (venueLower === member.toLowerCase() || venueLower.includes(member.toLowerCase())) {
        return family;
      }
    }
  }

  return null;
}

/**
 * Get all unique family IDs from a list of venues
 */
export function getJournalFamiliesFromVenues(venues: string[]): Set<string> {
  const familyIds = new Set<string>();

  venues.forEach(venue => {
    const family = findJournalFamily(venue);
    if (family) {
      familyIds.add(family.id);
    }
  });

  return familyIds;
}
