/**
 * Paper Similarity Calculator
 *
 * Calculates multi-dimensional similarity scores between papers based on:
 * - Citation relationships
 * - Topic/field-of-study overlap
 * - Temporal proximity
 * - Author overlap
 * - Venue similarity
 *
 * @module lib/similarity/paperSimilarity
 */

import type { Paper } from '@/types/citationNetwork';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Breakdown of similarity scores across different dimensions
 */
export interface SimilarityBreakdown {
  /** Citation-based similarity (0-1) */
  citation: number;
  /** Topic/field-of-study similarity (0-1) */
  topic: number;
  /** Temporal proximity similarity (0-1) */
  temporal: number;
  /** Author overlap similarity (0-1) */
  author: number;
  /** Venue/journal similarity (0-1) */
  venue: number;
}

/**
 * Complete similarity result
 */
export interface SimilarityResult {
  /** Overall similarity score (0-1) */
  overall: number;
  /** Breakdown by dimension */
  breakdown: SimilarityBreakdown;
}

/**
 * Configuration for similarity calculation weights
 */
export interface SimilarityWeights {
  citation: number;
  topic: number;
  temporal: number;
  author: number;
  venue: number;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Default weights for similarity dimensions
 * Weights should sum to 1.0
 */
export const DEFAULT_WEIGHTS: SimilarityWeights = {
  citation: 0.35,   // Citation relationship is most important
  topic: 0.25,      // Semantic similarity
  temporal: 0.15,   // Publication time proximity
  author: 0.15,     // Author overlap
  venue: 0.10,      // Venue/journal similarity
};

/**
 * Venue family groupings for similarity calculation
 */
const VENUE_FAMILIES: { [key: string]: string[] } = {
  nature: ['nature', 'nat.', 'nature medicine', 'nature biotechnology', 'nature genetics'],
  science: ['science', 'science advances', 'science translational medicine'],
  cell: ['cell', 'cell reports', 'molecular cell', 'cancer cell', 'cell stem cell'],
  plos: ['plos', 'plos one', 'plos biology', 'plos genetics', 'plos computational biology'],
  bmc: ['bmc', 'bmc biology', 'bmc genomics', 'bmc bioinformatics'],
  oxford: ['nucleic acids research', 'bioinformatics', 'human molecular genetics'],
  springer: ['genome biology', 'genome medicine'],
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculates Jaccard similarity between two sets
 * Jaccard similarity = |A n B| / |A u B|
 */
function jaccardSimilarity<T>(set1: T[], set2: T[]): number {
  if (set1.length === 0 && set2.length === 0) return 0;

  const s1 = new Set(set1.map(item => String(item).toLowerCase()));
  const s2 = new Set(set2.map(item => String(item).toLowerCase()));

  const intersection = new Set([...s1].filter(x => s2.has(x)));
  const union = new Set([...s1, ...s2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Normalizes a string for comparison (lowercase, trim)
 */
function normalize(str: string): string {
  return str.toLowerCase().trim();
}

/**
 * Checks if two venues belong to the same family
 */
function sameVenueFamily(venue1: string, venue2: string): boolean {
  const v1 = normalize(venue1);
  const v2 = normalize(venue2);

  for (const family of Object.values(VENUE_FAMILIES)) {
    const inFamily1 = family.some(v => v1.includes(v) || v.includes(v1));
    const inFamily2 = family.some(v => v2.includes(v) || v.includes(v2));

    if (inFamily1 && inFamily2) return true;
  }

  return false;
}

// ============================================================================
// Similarity Calculation Functions
// ============================================================================

/**
 * Calculate citation-based similarity
 *
 * Considers:
 * - Direct citation relationship (1.0 if papers cite each other)
 * - Same paper (1.0)
 * - No relationship (0.0)
 *
 * Note: This is a simplified version. In a full implementation,
 * you would check the actual citation graph distance.
 */
export function calculateCitationSimilarity(
  paper: Paper,
  origin: Paper,
  citationGraph?: Map<string, Set<string>>
): number {
  // Same paper
  if (paper.id === origin.id) return 1.0;

  // If we have citation graph, check relationship
  if (citationGraph) {
    const paperCitations = citationGraph.get(paper.id) || new Set();
    const originCitations = citationGraph.get(origin.id) || new Set();

    // Direct citation relationship
    if (paperCitations.has(origin.id) || originCitations.has(paper.id)) {
      return 0.8;
    }

    // Shared citations (co-citation)
    const sharedCitations = new Set(
      [...paperCitations].filter(id => originCitations.has(id))
    );

    if (sharedCitations.size > 0) {
      const totalCitations = new Set([...paperCitations, ...originCitations]).size;
      return (sharedCitations.size / totalCitations) * 0.6;
    }
  }

  // No known relationship
  return 0.0;
}

/**
 * Calculate topic/field-of-study similarity
 *
 * Uses Jaccard similarity on fieldsOfStudy arrays
 */
export function calculateTopicSimilarity(paper: Paper, origin: Paper): number {
  const fields1 = paper.fieldsOfStudy || [];
  const fields2 = origin.fieldsOfStudy || [];

  if (fields1.length === 0 && fields2.length === 0) {
    // If neither paper has fields, try keyword extraction from titles
    const titleWords1 = extractKeywords(paper.title);
    const titleWords2 = extractKeywords(origin.title);
    return jaccardSimilarity(titleWords1, titleWords2) * 0.5; // Lower weight for title-only
  }

  return jaccardSimilarity(fields1, fields2);
}

/**
 * Extract keywords from text (simple implementation)
 * Removes common words and returns significant terms
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'been', 'be',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
    'could', 'may', 'might', 'can', 'using', 'used', 'via', 'through'
  ]);

  return text
    .toLowerCase()
    .split(/\W+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 10); // Top 10 keywords
}

/**
 * Calculate temporal similarity
 *
 * Papers published closer together are more similar
 * - Same year: 1.0
 * - Within 2 years: 0.8
 * - Within 5 years: 0.5
 * - Within 10 years: 0.2
 * - More than 10 years: exponential decay
 */
export function calculateTemporalSimilarity(paper: Paper, origin: Paper): number {
  const yearDiff = Math.abs(paper.year - origin.year);

  if (yearDiff === 0) return 1.0;
  if (yearDiff <= 2) return 0.8;
  if (yearDiff <= 5) return 0.5;
  if (yearDiff <= 10) return 0.2;

  // Exponential decay for older papers
  return Math.max(0, Math.exp(-yearDiff / 10));
}

/**
 * Calculate author overlap similarity
 *
 * Uses Jaccard similarity on author lists
 * Accounts for different author name formats
 */
export function calculateAuthorSimilarity(paper: Paper, origin: Paper): number {
  if (paper.authors.length === 0 && origin.authors.length === 0) return 0;

  // Normalize author names (last name only for better matching)
  const extractLastName = (fullName: string): string => {
    const parts = fullName.trim().split(/\s+/);
    return parts[parts.length - 1].toLowerCase();
  };

  const authors1 = paper.authors.map(extractLastName);
  const authors2 = origin.authors.map(extractLastName);

  return jaccardSimilarity(authors1, authors2);
}

/**
 * Calculate venue similarity
 *
 * - Same venue: 1.0
 * - Same venue family (e.g., Nature family): 0.7
 * - Different venues: 0.0
 */
export function calculateVenueSimilarity(paper: Paper, origin: Paper): number {
  const venue1 = paper.venue || paper.source || 'unknown';
  const venue2 = origin.venue || origin.source || 'unknown';

  if (venue1 === 'unknown' || venue2 === 'unknown') return 0;

  // Exact match
  if (normalize(venue1) === normalize(venue2)) return 1.0;

  // Same family
  if (sameVenueFamily(venue1, venue2)) return 0.7;

  // Different venues
  return 0.0;
}

// ============================================================================
// Main Similarity Calculation
// ============================================================================

/**
 * Calculate overall similarity between two papers
 *
 * @param paper - The paper to compare
 * @param origin - The origin paper to compare against
 * @param weights - Optional custom weights for dimensions
 * @param citationGraph - Optional citation graph for relationship detection
 * @returns Complete similarity result with overall score and breakdown
 *
 * @example
 * const similarity = calculatePaperSimilarity(paper1, paper2);
 * console.log(`Overall: ${similarity.overall}`);
 * console.log(`Citation: ${similarity.breakdown.citation}`);
 */
export function calculatePaperSimilarity(
  paper: Paper,
  origin: Paper,
  weights: SimilarityWeights = DEFAULT_WEIGHTS,
  citationGraph?: Map<string, Set<string>>
): SimilarityResult {
  // Calculate individual dimensions
  const breakdown: SimilarityBreakdown = {
    citation: calculateCitationSimilarity(paper, origin, citationGraph),
    topic: calculateTopicSimilarity(paper, origin),
    temporal: calculateTemporalSimilarity(paper, origin),
    author: calculateAuthorSimilarity(paper, origin),
    venue: calculateVenueSimilarity(paper, origin),
  };

  // Calculate weighted overall score
  const overall =
    breakdown.citation * weights.citation +
    breakdown.topic * weights.topic +
    breakdown.temporal * weights.temporal +
    breakdown.author * weights.author +
    breakdown.venue * weights.venue;

  return {
    overall: Math.max(0, Math.min(1, overall)), // Clamp to [0, 1]
    breakdown,
  };
}

/**
 * Calculate similarity for multiple papers against an origin
 *
 * @param papers - Array of papers to compare
 * @param origin - The origin paper
 * @param weights - Optional custom weights
 * @param citationGraph - Optional citation graph
 * @returns Map of paper ID to similarity result
 *
 * @example
 * const similarities = calculateBatchSimilarity(papers, originPaper);
 * papers.forEach(p => {
 *   console.log(`${p.title}: ${similarities.get(p.id).overall}`);
 * });
 */
export function calculateBatchSimilarity(
  papers: Paper[],
  origin: Paper,
  weights: SimilarityWeights = DEFAULT_WEIGHTS,
  citationGraph?: Map<string, Set<string>>
): Map<string, SimilarityResult> {
  const results = new Map<string, SimilarityResult>();

  papers.forEach(paper => {
    const similarity = calculatePaperSimilarity(paper, origin, weights, citationGraph);
    results.set(paper.id, similarity);
  });

  return results;
}

/**
 * Build citation graph from paper array
 * Useful for citation similarity calculation
 *
 * @param papers - Array of papers with citation information
 * @returns Map of paper ID to set of cited paper IDs
 */
export function buildCitationGraphMap(papers: Paper[]): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  // Initialize sets for all papers
  papers.forEach(paper => {
    graph.set(paper.id, new Set());
  });

  // Note: This is a placeholder. In a real implementation,
  // you would need citation data (which papers cite which)
  // This could come from the Semantic Scholar API's citation/reference endpoints

  return graph;
}

/**
 * Sort papers by similarity to origin (descending)
 *
 * @param papers - Array of papers to sort
 * @param similarities - Map of similarities
 * @returns Sorted array of papers (most similar first)
 */
export function sortBySimilarity(
  papers: Paper[],
  similarities: Map<string, SimilarityResult>
): Paper[] {
  return [...papers].sort((a, b) => {
    const simA = similarities.get(a.id)?.overall || 0;
    const simB = similarities.get(b.id)?.overall || 0;
    return simB - simA; // Descending order
  });
}

/**
 * Get similarity color for UI display
 *
 * @param similarity - Similarity score (0-1)
 * @returns CSS color string
 */
export function getSimilarityColor(similarity: number): string {
  if (similarity >= 0.8) return '#4CAF50'; // Green - High similarity
  if (similarity >= 0.6) return '#8BC34A'; // Light green
  if (similarity >= 0.4) return '#FFC107'; // Amber - Medium similarity
  if (similarity >= 0.2) return '#FF9800'; // Orange - Low similarity
  return '#F44336'; // Red - Very low similarity
}

/**
 * Get similarity label for UI display
 *
 * @param similarity - Similarity score (0-1)
 * @returns Human-readable label
 */
export function getSimilarityLabel(similarity: number): string {
  if (similarity >= 0.8) return 'Highly Similar';
  if (similarity >= 0.6) return 'Similar';
  if (similarity >= 0.4) return 'Moderately Similar';
  if (similarity >= 0.2) return 'Somewhat Related';
  return 'Distantly Related';
}

// ============================================================================
// Exports
// ============================================================================

export default {
  calculatePaperSimilarity,
  calculateBatchSimilarity,
  calculateCitationSimilarity,
  calculateTopicSimilarity,
  calculateTemporalSimilarity,
  calculateAuthorSimilarity,
  calculateVenueSimilarity,
  buildCitationGraphMap,
  sortBySimilarity,
  getSimilarityColor,
  getSimilarityLabel,
};
