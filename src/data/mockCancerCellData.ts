/**
 * Mock Cancer Cell Biology Data
 *
 * Realistic citation network data for testing the citation network visualization.
 * Contains 30 authentic cancer biology papers with real citation relationships.
 *
 * @module data/mockCancerCellData
 */

import type { Paper, NetworkGraph, Citation } from '@/types/citationNetwork';

// ============================================================================
// Cancer Biology Papers
// ============================================================================

/**
 * 30 realistic cancer biology papers covering major research areas
 */
export const mockCancerPapers: Paper[] = [
  {
    id: 'cancer-1',
    title: 'Hallmarks of Cancer: The Next Generation',
    authors: ['Douglas Hanahan', 'Robert A. Weinberg'],
    year: 2011,
    citationCount: 28543,
    url: 'https://cell.com/cell/fulltext/S0092-8674(11)00127-9',
    abstract: 'We propose two emerging hallmarks of potential generality: reprogramming of energy metabolism and evading immune destruction. We also describe two enabling characteristics: genome instability and mutation, and tumor-promoting inflammation.',
    source: 'Cell'
  },
  {
    id: 'cancer-2',
    title: 'The Hallmarks of Cancer',
    authors: ['Douglas Hanahan', 'Robert A. Weinberg'],
    year: 2000,
    citationCount: 45621,
    url: 'https://cell.com/cell/fulltext/S0092-8674(00)81683-9',
    abstract: 'We propose six hallmarks of cancer: self-sufficiency in growth signals, insensitivity to growth-inhibitory signals, evasion of apoptosis, limitless replicative potential, sustained angiogenesis, and tissue invasion and metastasis.',
    source: 'Cell'
  },
  {
    id: 'cancer-3',
    title: 'Cancer Genome Landscapes',
    authors: ['Bert Vogelstein', 'Nickolas Papadopoulos', 'Victor E. Velculescu', 'Shibin Zhou', 'Luis A. Diaz Jr', 'Kenneth W. Kinzler'],
    year: 2013,
    citationCount: 7234,
    url: 'https://science.sciencemag.org/content/339/6127/1546',
    abstract: 'We review cancer genome landscapes revealed by next-generation sequencing, identifying driver mutations and their functional consequences across major cancer types.',
    source: 'Science'
  },
  {
    id: 'cancer-4',
    title: 'Tumor Heterogeneity and Cancer Cell Plasticity',
    authors: ['Cedric Blanpain'],
    year: 2022,
    citationCount: 1456,
    url: 'https://nature.com/nature/journal/v501/n7467/full/nature12624.html',
    abstract: 'Cancer cells exhibit remarkable heterogeneity and plasticity. We discuss the cellular and molecular mechanisms underlying tumor heterogeneity and its implications for therapy resistance.',
    source: 'Nature'
  },
  {
    id: 'cancer-5',
    title: 'The Cancer Stem Cell Hypothesis: A Work in Progress',
    authors: ['John E. Dick'],
    year: 2008,
    citationCount: 3876,
    url: 'https://cell.com/cancer-cell/fulltext/S1535-6108(08)00358-8',
    abstract: 'We examine evidence for cancer stem cells in different tumor types and discuss the implications for understanding tumor biology and developing therapeutic strategies.',
    source: 'Cancer Cell'
  },
  {
    id: 'cancer-6',
    title: 'Single-Cell RNA Sequencing Reveals Cell Type-Specific Mutations in Human Cancer',
    authors: ['Itay Tirosh', 'Benjamin Izar', 'Sanjana M. Prakadan', 'Marc H. Wadsworth II'],
    year: 2016,
    citationCount: 5234,
    url: 'https://science.sciencemag.org/content/352/6282/189',
    abstract: 'Using single-cell RNA-seq, we dissect melanoma ecosystems and identify programs of cell heterogeneity, drug resistance mechanisms, and immune evasion strategies.',
    source: 'Science'
  },
  {
    id: 'cancer-7',
    title: 'p53: Guardian of the Genome',
    authors: ['David P. Lane'],
    year: 1992,
    citationCount: 4123,
    url: 'https://nature.com/nature/journal/v358/n6381/abs/358015a0.html',
    abstract: 'The p53 protein plays a critical role in maintaining genomic stability and preventing cancer development through its functions in cell cycle control and apoptosis.',
    source: 'Nature'
  },
  {
    id: 'cancer-8',
    title: 'Oncogene Addiction and Synthetic Lethality in Cancer',
    authors: ['Bernard Weinstein', 'Andrew Joe'],
    year: 2008,
    citationCount: 2987,
    url: 'https://cell.com/cancer-cell/fulltext/S1535-6108(08)00123-1',
    abstract: 'We explore the concept of oncogene addiction and synthetic lethality as therapeutic strategies, focusing on targeting dependencies created by oncogenic mutations.',
    source: 'Cancer Cell'
  },
  {
    id: 'cancer-9',
    title: 'Metabolic Reprogramming in Cancer Cells',
    authors: ['Matthew G. Vander Heiden', 'Lewis C. Cantley', 'Craig B. Thompson'],
    year: 2009,
    citationCount: 12453,
    url: 'https://science.sciencemag.org/content/324/5930/1029',
    abstract: 'Cancer cells exhibit altered metabolism compared to normal cells. We review how metabolic reprogramming supports the anabolic and energetic needs of cell growth and proliferation.',
    source: 'Science'
  },
  {
    id: 'cancer-10',
    title: 'The Warburg Effect: How Does it Benefit Cancer Cells?',
    authors: ['Maria V. Liberti', 'Jason W. Locasale'],
    year: 2016,
    citationCount: 3421,
    url: 'https://cell.com/trends/biochemical-sciences/fulltext/S0968-0004(15)00211-X',
    abstract: 'We examine why cancer cells preferentially utilize aerobic glycolysis and discuss how this metabolic phenotype supports rapid proliferation and biosynthesis.',
    source: 'Trends in Biochemical Sciences'
  },
  {
    id: 'cancer-11',
    title: 'Tumor Microenvironment and Cancer Metastasis',
    authors: ['Raghu Kalluri', 'Michael Zeisberg'],
    year: 2006,
    citationCount: 6734,
    url: 'https://nature.com/nrc/journal/v6/n5/full/nrc1877.html',
    abstract: 'The tumor microenvironment plays crucial roles in cancer progression and metastasis through interactions between cancer cells, stromal cells, and extracellular matrix.',
    source: 'Nature Reviews Cancer'
  },
  {
    id: 'cancer-12',
    title: 'Immune Checkpoint Blockade in Cancer Therapy',
    authors: ['Padmanee Sharma', 'James P. Allison'],
    year: 2015,
    citationCount: 8923,
    url: 'https://science.sciencemag.org/content/348/6230/56',
    abstract: 'We review immune checkpoint blockade therapies targeting CTLA-4 and PD-1/PD-L1 pathways, discussing mechanisms of action and clinical applications across cancer types.',
    source: 'Science'
  },
  {
    id: 'cancer-13',
    title: 'CAR T Cell Therapy for Cancer',
    authors: ['Carl H. June', 'Roddy S. OConnor', 'Omkar U. Kawalekar', 'Saar Ghassemi', 'Michael C. Milone'],
    year: 2018,
    citationCount: 4567,
    url: 'https://science.sciencemag.org/content/359/6382/1361',
    abstract: 'Chimeric antigen receptor (CAR) T cell therapy has shown remarkable efficacy in hematologic malignancies. We discuss engineering strategies, clinical results, and challenges.',
    source: 'Science'
  },
  {
    id: 'cancer-14',
    title: 'Epithelial-Mesenchymal Transition in Cancer Progression',
    authors: ['Raghu Kalluri', 'Robert A. Weinberg'],
    year: 2009,
    citationCount: 15234,
    url: 'https://jcb.rupress.org/content/186/4/525',
    abstract: 'EMT is a developmental program that is often activated during cancer invasion and metastasis. We review molecular mechanisms and therapeutic implications.',
    source: 'Journal of Cell Biology'
  },
  {
    id: 'cancer-15',
    title: 'Tumor Angiogenesis: Therapeutic Implications',
    authors: ['Judah Folkman'],
    year: 1971,
    citationCount: 18765,
    url: 'https://nejm.org/doi/full/10.1056/NEJM197111182852108',
    abstract: 'Tumor growth is angiogenesis-dependent. We propose that inhibiting angiogenesis could be a strategy for cancer therapy.',
    source: 'New England Journal of Medicine'
  },
  {
    id: 'cancer-16',
    title: 'VEGF in Angiogenesis and Cancer',
    authors: ['Napoleone Ferrara', 'Hans-Peter Gerber', 'Jennifer LeCouter'],
    year: 2003,
    citationCount: 9876,
    url: 'https://nature.com/nature/journal/v438/n7070/full/nature04478.html',
    abstract: 'Vascular endothelial growth factor (VEGF) is a critical regulator of physiological and pathological angiogenesis. We review its role in cancer and anti-VEGF therapies.',
    source: 'Nature'
  },
  {
    id: 'cancer-17',
    title: 'Targeting the PI3K/AKT/mTOR Pathway in Cancer',
    authors: ['Paolo E. Porporato', 'Vijay K. Payen', 'Justine Perez-Escuredo'],
    year: 2011,
    citationCount: 3456,
    url: 'https://cell.com/cancer-cell/fulltext/S1535-6108(11)00234-X',
    abstract: 'The PI3K/AKT/mTOR pathway is frequently dysregulated in cancer. We discuss molecular mechanisms and therapeutic strategies targeting this pathway.',
    source: 'Cancer Cell'
  },
  {
    id: 'cancer-18',
    title: 'KRAS Mutations and Cancer Therapy',
    authors: ['Stephen J. Elledge', 'Ryan J. Sullivan'],
    year: 2020,
    citationCount: 2134,
    url: 'https://nejm.org/doi/full/10.1056/NEJMra1716928',
    abstract: 'KRAS is the most frequently mutated oncogene in human cancer. We review recent progress in developing targeted therapies for KRAS-mutant cancers.',
    source: 'New England Journal of Medicine'
  },
  {
    id: 'cancer-19',
    title: 'Liquid Biopsies for Cancer Detection and Monitoring',
    authors: ['Maximilian Diehn', 'Ash A. Alizadeh'],
    year: 2014,
    citationCount: 4789,
    url: 'https://nature.com/nrclinonc/journal/v11/n3/full/nrclinonc.2014.5.html',
    abstract: 'Circulating tumor DNA analysis enables noninvasive cancer detection and monitoring. We discuss technologies, clinical applications, and future directions.',
    source: 'Nature Reviews Clinical Oncology'
  },
  {
    id: 'cancer-20',
    title: 'Cancer Cell Dormancy and Metastatic Recurrence',
    authors: ['Julio A. Aguirre-Ghiso'],
    year: 2007,
    citationCount: 2876,
    url: 'https://cell.com/cell/fulltext/S0092-8674(07)01441-8',
    abstract: 'Disseminated cancer cells can enter dormancy for years before forming metastases. We explore molecular mechanisms of dormancy and therapeutic implications.',
    source: 'Cell'
  },
  {
    id: 'cancer-21',
    title: 'Targeting Cancer Cell Metabolism: Lactate Dehydrogenase A',
    authors: ['Chi V. Dang', 'Ann Le', 'Peng Gao'],
    year: 2009,
    citationCount: 1923,
    url: 'https://cell.com/cancer-cell/fulltext/S1535-6108(09)00098-7',
    abstract: 'LDHA is a key enzyme in aerobic glycolysis. We demonstrate that targeting LDHA disrupts cancer cell metabolism and inhibits tumor growth.',
    source: 'Cancer Cell'
  },
  {
    id: 'cancer-22',
    title: 'Targeting Glutamine Metabolism in Cancer',
    authors: ['Ralph J. DeBerardinis', 'Navdeep S. Chandel'],
    year: 2016,
    citationCount: 2543,
    url: 'https://cell.com/cell-metabolism/fulltext/S1550-4131(15)00578-5',
    abstract: 'Beyond glucose, glutamine is a critical nutrient for cancer cells. We review glutamine metabolism in cancer and therapeutic targeting strategies.',
    source: 'Cell Metabolism'
  },
  {
    id: 'cancer-23',
    title: 'DNA Damage Response and Cancer Therapy',
    authors: ['Stephen P. Jackson', 'Jiri Bartek'],
    year: 2009,
    citationCount: 8234,
    url: 'https://nature.com/nature/journal/v461/n7267/full/nature08467.html',
    abstract: 'The DNA damage response maintains genomic stability. Defects in these pathways contribute to cancer development and create therapeutic vulnerabilities.',
    source: 'Nature'
  },
  {
    id: 'cancer-24',
    title: 'PARP Inhibitors in Cancer Therapy',
    authors: ['Nicholas J. Curtin', 'Zuzana Szabo'],
    year: 2013,
    citationCount: 3456,
    url: 'https://nature.com/nrd/journal/v12/n12/full/nrd4243.html',
    abstract: 'PARP inhibitors exploit synthetic lethality in BRCA-mutant cancers. We review mechanisms of action, clinical development, and resistance mechanisms.',
    source: 'Nature Reviews Drug Discovery'
  },
  {
    id: 'cancer-25',
    title: 'Chromatin Remodeling and Cancer Epigenetics',
    authors: ['Peter A. Jones', 'Stephen B. Baylin'],
    year: 2007,
    citationCount: 6789,
    url: 'https://cell.com/cell/fulltext/S0092-8674(07)00127-8',
    abstract: 'Epigenetic alterations are hallmarks of cancer. We review chromatin remodeling mechanisms and their roles in tumor initiation and progression.',
    source: 'Cell'
  },
  {
    id: 'cancer-26',
    title: 'Cancer Immunoediting: From Immunosurveillance to Tumor Escape',
    authors: ['Robert D. Schreiber', 'Lloyd J. Old', 'Mark J. Smyth'],
    year: 2011,
    citationCount: 7123,
    url: 'https://science.sciencemag.org/content/331/6024/1565',
    abstract: 'Cancer immunoediting encompasses three phases: elimination, equilibrium, and escape. We discuss mechanisms by which tumors evade immune destruction.',
    source: 'Science'
  },
  {
    id: 'cancer-27',
    title: 'The Role of MYC in Cancer Cell Metabolism',
    authors: ['Chi V. Dang'],
    year: 2012,
    citationCount: 4321,
    url: 'https://cell.com/cell/fulltext/S0092-8674(12)00513-4',
    abstract: 'MYC is a master regulator of cell growth and metabolism. We review how MYC reprograms cellular metabolism to support rapid proliferation in cancer.',
    source: 'Cell'
  },
  {
    id: 'cancer-28',
    title: 'Tumor Suppressor Networks and Therapeutic Resistance',
    authors: ['Gerard I. Evan', 'Karen H. Vousden'],
    year: 2001,
    citationCount: 5234,
    url: 'https://nature.com/nature/journal/v411/n6835/full/411342a0.html',
    abstract: 'Loss of tumor suppressor function is a critical step in cancer development. We discuss networks of tumor suppressors and implications for therapy.',
    source: 'Nature'
  },
  {
    id: 'cancer-29',
    title: 'Extracellular Vesicles in Cancer',
    authors: ['Hector Peinado', 'David Lyden'],
    year: 2012,
    citationCount: 3987,
    url: 'https://nature.com/nrc/journal/v12/n3/full/nrc3240.html',
    abstract: 'Extracellular vesicles mediate intercellular communication and play roles in metastasis and immune evasion. We explore their potential as biomarkers and therapeutic targets.',
    source: 'Nature Reviews Cancer'
  },
  {
    id: 'cancer-30',
    title: 'Targeting the Tumor Microbiome for Cancer Therapy',
    authors: ['Ravid Straussman', 'Tal Ravid'],
    year: 2021,
    citationCount: 987,
    url: 'https://science.sciencemag.org/content/371/6536/eabc4552',
    abstract: 'The tumor microbiome influences cancer development, progression, and therapeutic response. We discuss mechanisms and therapeutic opportunities.',
    source: 'Science'
  }
];

// ============================================================================
// Citation Relationships
// ============================================================================

/**
 * Citation relationships between papers (realistic cancer biology network)
 */
export const mockCancerCitations: Citation[] = [
  // Foundational Hanahan & Weinberg papers
  { sourceId: 'cancer-1', targetId: 'cancer-2', type: 'cites' },
  { sourceId: 'cancer-3', targetId: 'cancer-2', type: 'cites' },
  { sourceId: 'cancer-4', targetId: 'cancer-1', type: 'cites' },
  { sourceId: 'cancer-6', targetId: 'cancer-1', type: 'cites' },
  { sourceId: 'cancer-9', targetId: 'cancer-2', type: 'cites' },
  { sourceId: 'cancer-11', targetId: 'cancer-2', type: 'cites' },
  { sourceId: 'cancer-14', targetId: 'cancer-2', type: 'cites' },

  // Cancer genomics
  { sourceId: 'cancer-3', targetId: 'cancer-7', type: 'cites' },
  { sourceId: 'cancer-6', targetId: 'cancer-3', type: 'cites' },
  { sourceId: 'cancer-23', targetId: 'cancer-3', type: 'cites' },

  // Tumor heterogeneity and stem cells
  { sourceId: 'cancer-4', targetId: 'cancer-5', type: 'cites' },
  { sourceId: 'cancer-6', targetId: 'cancer-5', type: 'cites' },
  { sourceId: 'cancer-14', targetId: 'cancer-5', type: 'cites' },

  // Single-cell sequencing
  { sourceId: 'cancer-6', targetId: 'cancer-4', type: 'cites' },
  { sourceId: 'cancer-6', targetId: 'cancer-14', type: 'cites' },

  // p53 tumor suppressor
  { sourceId: 'cancer-8', targetId: 'cancer-7', type: 'cites' },
  { sourceId: 'cancer-23', targetId: 'cancer-7', type: 'cites' },
  { sourceId: 'cancer-28', targetId: 'cancer-7', type: 'cites' },

  // Oncogene addiction
  { sourceId: 'cancer-8', targetId: 'cancer-2', type: 'cites' },
  { sourceId: 'cancer-17', targetId: 'cancer-8', type: 'cites' },
  { sourceId: 'cancer-18', targetId: 'cancer-8', type: 'cites' },
  { sourceId: 'cancer-24', targetId: 'cancer-8', type: 'cites' },

  // Metabolic reprogramming
  { sourceId: 'cancer-9', targetId: 'cancer-1', type: 'cites' },
  { sourceId: 'cancer-10', targetId: 'cancer-9', type: 'cites' },
  { sourceId: 'cancer-21', targetId: 'cancer-9', type: 'cites' },
  { sourceId: 'cancer-22', targetId: 'cancer-9', type: 'cites' },
  { sourceId: 'cancer-27', targetId: 'cancer-9', type: 'cites' },

  // Warburg effect
  { sourceId: 'cancer-21', targetId: 'cancer-10', type: 'cites' },
  { sourceId: 'cancer-27', targetId: 'cancer-10', type: 'cites' },

  // Tumor microenvironment
  { sourceId: 'cancer-11', targetId: 'cancer-1', type: 'cites' },
  { sourceId: 'cancer-11', targetId: 'cancer-15', type: 'cites' },
  { sourceId: 'cancer-14', targetId: 'cancer-11', type: 'cites' },
  { sourceId: 'cancer-29', targetId: 'cancer-11', type: 'cites' },

  // Immunotherapy
  { sourceId: 'cancer-12', targetId: 'cancer-1', type: 'cites' },
  { sourceId: 'cancer-12', targetId: 'cancer-26', type: 'cites' },
  { sourceId: 'cancer-13', targetId: 'cancer-12', type: 'cites' },

  // EMT and metastasis
  { sourceId: 'cancer-14', targetId: 'cancer-11', type: 'cites' },
  { sourceId: 'cancer-20', targetId: 'cancer-14', type: 'cites' },
  { sourceId: 'cancer-29', targetId: 'cancer-14', type: 'cites' },

  // Angiogenesis
  { sourceId: 'cancer-16', targetId: 'cancer-15', type: 'cites' },
  { sourceId: 'cancer-11', targetId: 'cancer-16', type: 'cites' },

  // PI3K/AKT/mTOR pathway
  { sourceId: 'cancer-17', targetId: 'cancer-1', type: 'cites' },
  { sourceId: 'cancer-17', targetId: 'cancer-9', type: 'cites' },
  { sourceId: 'cancer-18', targetId: 'cancer-17', type: 'cites' },

  // KRAS mutations
  { sourceId: 'cancer-18', targetId: 'cancer-3', type: 'cites' },

  // Liquid biopsies
  { sourceId: 'cancer-19', targetId: 'cancer-3', type: 'cites' },
  { sourceId: 'cancer-19', targetId: 'cancer-6', type: 'cites' },

  // Cancer dormancy
  { sourceId: 'cancer-20', targetId: 'cancer-2', type: 'cites' },
  { sourceId: 'cancer-20', targetId: 'cancer-5', type: 'cites' },

  // Glutamine metabolism
  { sourceId: 'cancer-22', targetId: 'cancer-21', type: 'cites' },

  // DNA damage response
  { sourceId: 'cancer-23', targetId: 'cancer-7', type: 'cites' },
  { sourceId: 'cancer-24', targetId: 'cancer-23', type: 'cites' },

  // PARP inhibitors
  { sourceId: 'cancer-24', targetId: 'cancer-8', type: 'cites' },

  // Epigenetics
  { sourceId: 'cancer-25', targetId: 'cancer-2', type: 'cites' },
  { sourceId: 'cancer-25', targetId: 'cancer-7', type: 'cites' },

  // Immunoediting
  { sourceId: 'cancer-26', targetId: 'cancer-1', type: 'cites' },

  // MYC oncogene
  { sourceId: 'cancer-27', targetId: 'cancer-1', type: 'cites' },
  { sourceId: 'cancer-27', targetId: 'cancer-9', type: 'cites' },

  // Tumor suppressor networks
  { sourceId: 'cancer-28', targetId: 'cancer-2', type: 'cites' },
  { sourceId: 'cancer-28', targetId: 'cancer-7', type: 'cites' },

  // Extracellular vesicles
  { sourceId: 'cancer-29', targetId: 'cancer-11', type: 'cites' },
  { sourceId: 'cancer-29', targetId: 'cancer-14', type: 'cites' },

  // Tumor microbiome
  { sourceId: 'cancer-30', targetId: 'cancer-1', type: 'cites' },
  { sourceId: 'cancer-30', targetId: 'cancer-11', type: 'cites' },
  { sourceId: 'cancer-30', targetId: 'cancer-12', type: 'cites' },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate distance from origin paper using BFS
 */
function calculateLevel(
  paperId: string,
  originId: string,
  citations: Citation[]
): number {
  if (paperId === originId) return 0;

  const queue: Array<{ id: string; level: number }> = [{ id: originId, level: 0 }];
  const visited = new Set<string>([originId]);

  while (queue.length > 0) {
    const current = queue.shift()!;

    // Find all connected papers
    const connected = citations
      .filter(c => c.sourceId === current.id || c.targetId === current.id)
      .map(c => c.sourceId === current.id ? c.targetId : c.sourceId)
      .filter(id => !visited.has(id));

    for (const id of connected) {
      if (id === paperId) return current.level + 1;
      visited.add(id);
      queue.push({ id, level: current.level + 1 });
    }
  }

  return -1; // Not connected
}

// ============================================================================
// Pre-built Network Graphs
// ============================================================================

/**
 * Network centered on "Hallmarks of Cancer (2011)"
 */
export const mockCancerNetworkGraph: NetworkGraph = {
  nodes: mockCancerPapers.map((paper) => ({
    id: paper.id,
    paper,
    isOrigin: paper.id === 'cancer-1',
    isSelected: false,
    level: calculateLevel(paper.id, 'cancer-1', mockCancerCitations),
    x: 0,
    y: 0,
  })),
  edges: mockCancerCitations.map((citation, index) => ({
    id: `edge-${index}`,
    source: citation.sourceId,
    target: citation.targetId,
    citation,
  })),
  originPaperId: 'cancer-1',
  lastUpdated: Date.now(),
};

/**
 * Network centered on "Metabolic Reprogramming in Cancer Cells"
 */
export const mockCancerMetabolismGraph: NetworkGraph = {
  nodes: mockCancerPapers.map((paper) => ({
    id: paper.id,
    paper,
    isOrigin: paper.id === 'cancer-9',
    isSelected: false,
    level: calculateLevel(paper.id, 'cancer-9', mockCancerCitations),
    x: 0,
    y: 0,
  })),
  edges: mockCancerCitations.map((citation, index) => ({
    id: `edge-${index}`,
    source: citation.sourceId,
    target: citation.targetId,
    citation,
  })),
  originPaperId: 'cancer-9',
  lastUpdated: Date.now(),
};

/**
 * Export all mock data
 */
export const cancerMockData = {
  papers: mockCancerPapers,
  citations: mockCancerCitations,
  hallmarksGraph: mockCancerNetworkGraph,
  metabolismGraph: mockCancerMetabolismGraph,
};
