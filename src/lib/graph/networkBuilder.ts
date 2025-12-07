/**
 * Citation Network Graph Builder
 *
 * Builds citation network graphs from paper data.
 * Supports various graph layouts and relationship types.
 */

import type { Paper, NetworkGraph, NetworkNode, NetworkEdge, Citation } from '@/types/citationNetwork';
import { calculateBatchSimilarity } from '@/lib/similarity/paperSimilarity';

export interface NetworkBuilderOptions {
  /** Maximum depth of citation relationships to include */
  maxDepth?: number;
  /** Minimum citation count to include a paper */
  minCitations?: number;
  /** Maximum number of nodes in the graph */
  maxNodes?: number;
  /** Include co-citation relationships */
  includeCoCitations?: boolean;
  /** Include bibliographic coupling */
  includeBibliographicCoupling?: boolean;
  /** Include semantic edges based on shared topics */
  includeSemanticEdges?: boolean;
  /** Minimum similarity threshold for semantic edges (0-1) */
  minSemanticSimilarity?: number;
}

export interface BuildNetworkResult {
  graph: NetworkGraph;
  stats: {
    totalPapers: number;
    includedPapers: number;
    totalEdges: number;
    avgCitations: number;
    yearRange: [number, number];
  };
}

/**
 * Builds a citation network from a list of papers
 */
export function buildCitationNetwork(
  papers: Paper[],
  originPaperId: string,
  options: NetworkBuilderOptions = {}
): BuildNetworkResult {
  const {
    minCitations = 0,
    maxNodes = 100,
    includeSemanticEdges = false,
    minSemanticSimilarity = 0.5,
  } = options;

  // Filter papers by citation threshold
  const filteredPapers = papers.filter((p) => p.citationCount >= minCitations);

  // Limit to maxNodes, prioritizing by citation count
  const sortedPapers = [...filteredPapers].sort((a, b) => b.citationCount - a.citationCount);
  const includedPapers = sortedPapers.slice(0, maxNodes);

  // Find origin paper
  const originPaper = includedPapers.find((p) => p.id === originPaperId) || includedPapers[0];

  // Calculate similarity scores for all papers relative to origin
  console.log(`[Citation Network] Calculating similarity scores for ${includedPapers.length} papers...`);
  const similarities = calculateBatchSimilarity(includedPapers, originPaper);

  // Add similarity scores to papers
  const papersWithSimilarity = includedPapers.map((paper) => {
    const similarity = similarities.get(paper.id);
    return {
      ...paper,
      similarityToOrigin: similarity?.overall,
      similarityBreakdown: similarity?.breakdown,
    };
  });

  // Build nodes
  const nodes: NetworkNode[] = papersWithSimilarity.map((paper) => ({
    id: paper.id,
    paper: paper,
    x: 0,
    y: 0,
    isOrigin: paper.id === originPaperId,
    isSelected: false,
    level: 0,
  }));

  // Build edges based on citation relationships
  const edges: NetworkEdge[] = [];

  // For now, create a simple citation graph
  // In a real implementation, you would have citation relationship data
  edges.push(...generateCitationEdges(includedPapers, originPaperId));

  if (includeSemanticEdges) {
    edges.push(...generateSemanticEdges(includedPapers, minSemanticSimilarity));
  }

  // Calculate statistics
  const stats = calculateNetworkStats(includedPapers, edges);

  const graph: NetworkGraph = {
    nodes,
    edges,
    originPaperId,
  };

  return {
    graph,
    stats: {
      ...stats,
      totalPapers: papers.length,
      includedPapers: includedPapers.length,
    },
  };
}

/**
 * Generates citation edges between papers
 */
function generateCitationEdges(papers: Paper[], originPaperId: string): NetworkEdge[] {
  const edges: NetworkEdge[] = [];
  const origin = papers.find((p) => p.id === originPaperId);

  if (!origin) return edges;

  // Sort papers by year to determine citation direction
  const sortedByYear = [...papers].sort((a, b) => a.year - b.year);

  // Create edges from newer papers to older papers they likely cite
  for (let i = 0; i < sortedByYear.length; i++) {
    const source = sortedByYear[i];

    // Skip if this is too old to cite newer papers
    if (source.year < 1990) continue;

    // Find papers this one might cite (older papers with high citations)
    const potentialCitations = sortedByYear
      .slice(0, i)
      .filter((target) => {
        // Only cite papers from previous years
        if (target.year >= source.year) return false;

        // More likely to cite highly cited papers
        if (target.citationCount < 50) return false;

        // More likely to cite recent papers (within 10 years)
        if (source.year - target.year > 10) return false;

        return true;
      })
      .sort((a, b) => b.citationCount - a.citationCount)
      .slice(0, 5); // Each paper cites up to 5 others

    for (const target of potentialCitations) {
      const citation: Citation = {
        sourceId: source.id,
        targetId: target.id,
        type: 'cites',
      };

      edges.push({
        id: `${source.id}-${target.id}`,
        source: source.id,
        target: target.id,
        citation: citation,
        weight: 1,
      });
    }
  }

  return edges;
}

/**
 * Generates semantic edges based on shared fields of study
 * Papers with significant topic overlap get semantic connections
 */
function generateSemanticEdges(papers: Paper[], minSimilarity: number = 0.5): NetworkEdge[] {
  const edges: NetworkEdge[] = [];

  // Compare all pairs of papers
  for (let i = 0; i < papers.length; i++) {
    for (let j = i + 1; j < papers.length; j++) {
      const paper1 = papers[i];
      const paper2 = papers[j];

      // Skip if either paper lacks fieldsOfStudy
      if (!paper1.fieldsOfStudy || !paper2.fieldsOfStudy) continue;
      if (paper1.fieldsOfStudy.length === 0 || paper2.fieldsOfStudy.length === 0) continue;

      // Calculate Jaccard similarity of fields of study
      const set1 = new Set(paper1.fieldsOfStudy.map((f) => f.toLowerCase()));
      const set2 = new Set(paper2.fieldsOfStudy.map((f) => f.toLowerCase()));

      const intersection = new Set([...set1].filter((x) => set2.has(x)));
      const union = new Set([...set1, ...set2]);

      const similarity = intersection.size / union.size;

      // Only create edge if similarity exceeds threshold
      if (similarity >= minSimilarity) {
        edges.push({
          id: `semantic-${paper1.id}-${paper2.id}`,
          source: paper1.id,
          target: paper2.id,
          citation: {
            sourceId: paper1.id,
            targetId: paper2.id,
            type: 'cites', // Placeholder
          },
          weight: similarity * 2, // Weight based on similarity
          edgeType: 'semantic',
          semanticSimilarity: similarity,
          sharedFieldsOfStudy: Array.from(intersection),
        });
      }
    }
  }

  console.log(`[Citation Network] Generated ${edges.length} semantic edges (min similarity: ${minSimilarity})`);
  return edges;
}

/**
 * Calculates network statistics
 */
function calculateNetworkStats(
  papers: Paper[],
  edges: NetworkEdge[]
): {
  totalEdges: number;
  avgCitations: number;
  yearRange: [number, number];
} {
  const years = papers.map((p) => p.year);
  const totalCitations = papers.reduce((sum, p) => sum + p.citationCount, 0);

  return {
    totalEdges: edges.length,
    avgCitations: Math.round(totalCitations / papers.length),
    yearRange: [Math.min(...years), Math.max(...years)],
  };
}

/**
 * Filters network by year range
 */
export function filterNetworkByYearRange(
  graph: NetworkGraph,
  papers: Paper[],
  yearRange: [number, number]
): NetworkGraph {
  const [minYear, maxYear] = yearRange;

  // Filter nodes
  const filteredNodes = graph.nodes.filter((node) => {
    const paper = node.paper;
    return paper && paper.year >= minYear && paper.year <= maxYear;
  });

  const validNodeIds = new Set(filteredNodes.map((n) => n.id));

  // Filter edges to only include valid nodes
  const filteredEdges = graph.edges.filter(
    (edge) => validNodeIds.has(edge.source) && validNodeIds.has(edge.target)
  );

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
    originPaperId: graph.originPaperId,
  };
}

/**
 * Finds the most influential papers in the network
 */
export function findInfluentialPapers(
  graph: NetworkGraph,
  papers: Paper[],
  limit: number = 10
): Paper[] {
  // Calculate influence score based on citations and network centrality
  const paperScores = papers.map((paper) => {
    const node = graph.nodes.find((n) => n.id === paper.id);
    if (!node) return { paper, score: 0 };

    // Count incoming and outgoing edges
    const inDegree = graph.edges.filter((e) => e.target === node.id).length;
    const outDegree = graph.edges.filter((e) => e.source === node.id).length;

    // Calculate influence: citation count + network centrality
    const score = paper.citationCount + inDegree * 100 + outDegree * 10;

    return { paper, score };
  });

  return paperScores
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.paper);
}

/**
 * Expands network by adding papers cited by a specific paper
 */
export function expandNetwork(
  graph: NetworkGraph,
  papers: Paper[],
  paperId: string,
  additionalPapers: Paper[]
): NetworkGraph {
  // This would fetch and add papers cited by the specified paper
  // For now, return the original graph
  // In real implementation: fetch citations, add new nodes and edges

  console.log(`Would expand network from paper ${paperId}`);
  return graph;
}
