/**
 * Force Graph Visualization Component
 *
 * Physics-based force-directed graph using react-force-graph-2d
 * Inspired by paper-web-viz design
 *
 * @module components/CitationNetwork/ForceGraphVisualization
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { ZoomIn, ZoomOut, Maximize2, Filter, ChevronDown, ChevronRight } from 'lucide-react';
import type { NetworkGraph } from '@/types/citationNetwork';
import { JOURNAL_FAMILIES, findJournalFamily } from '@/data/journalFamilies';

// ============================================================================
// Types
// ============================================================================

interface ForceGraphNode {
  id: string;
  name: string;
  title: string;
  year: number;
  val: number;
  citationCount: number;
  isOrigin?: boolean;
  similarityToOrigin?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface ForceGraphLink {
  source: string | ForceGraphNode;
  target: string | ForceGraphNode;
  semanticSimilarity?: number;
}

interface ForceGraphData {
  nodes: ForceGraphNode[];
  links: ForceGraphLink[];
}

interface ForceGraphVisualizationProps {
  graph: NetworkGraph;
  onNodeClick?: (paperId: string) => void;
  onNodeHover?: (paperId: string | null) => void;
  selectedPaperId?: string | null;
  className?: string;
}

// ============================================================================
// Data Conversion
// ============================================================================

/**
 * Extract first author's last name from authors array
 */
function getFirstAuthorLastName(authors?: string[]): string {
  if (!authors || authors.length === 0) return 'Unknown';

  const firstAuthor = authors[0];
  // Split by space and get the last part (last name)
  const parts = firstAuthor.trim().split(' ');
  return parts[parts.length - 1];
}

/**
 * Convert BioCopilot NetworkGraph to ForceGraph format
 */
function convertToForceGraphData(graph: NetworkGraph): ForceGraphData {
  // Convert nodes
  const nodes: ForceGraphNode[] = graph.nodes.map((node) => {
    const lastName = getFirstAuthorLastName(node.paper?.authors);
    const year = node.paper?.year || 2020;

    return {
      id: node.id,
      name: `${lastName} ${year}`,
      title: node.paper?.title || 'Untitled',
      year: year,
      // Increased range from 30-200 to 20-400 for more dramatic size differences
      val: Math.max(20, Math.min(400, Math.log10((node.paper?.citationCount || 0) + 1) * 50)),
      citationCount: node.paper?.citationCount || 0,
      isOrigin: node.isOrigin,
      similarityToOrigin: node.paper?.similarityToOrigin,
    };
  });

  // Convert edges
  const links: ForceGraphLink[] = graph.edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    semanticSimilarity: edge.semanticSimilarity,
  }));

  return { nodes, links };
}

// ============================================================================
// Component
// ============================================================================

export function ForceGraphVisualization({
  graph,
  onNodeClick,
  onNodeHover,
  selectedPaperId,
  className = '',
}: ForceGraphVisualizationProps) {
  const fgRef = useRef<any>();
  const [graphData, setGraphData] = useState<ForceGraphData>({ nodes: [], links: [] });
  const [linkDistance, setLinkDistance] = useState(9000);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedVenues, setSelectedVenues] = useState<Set<string>>(new Set());
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());

  // Extract unique venues from the graph
  const uniqueVenues = useMemo(() => {
    const venues = new Set<string>();
    graph.nodes.forEach(node => {
      if (node.paper?.venue) {
        venues.add(node.paper.venue);
      }
    });
    return Array.from(venues).sort();
  }, [graph]);

  // Group venues by journal family
  const groupedVenues = useMemo(() => {
    const familyMap = new Map<string, {
      family: typeof JOURNAL_FAMILIES[0];
      venues: string[];
      totalCount: number;
    }>();
    const ungroupedVenues: string[] = [];

    uniqueVenues.forEach(venue => {
      const family = findJournalFamily(venue);
      if (family) {
        if (!familyMap.has(family.id)) {
          familyMap.set(family.id, {
            family,
            venues: [],
            totalCount: 0,
          });
        }
        const group = familyMap.get(family.id)!;
        group.venues.push(venue);
        // Count papers in this venue
        const count = graph.nodes.filter(n => n.paper?.venue === venue).length;
        group.totalCount += count;
      } else {
        ungroupedVenues.push(venue);
      }
    });

    // Sort families by total count (descending)
    const sortedFamilies = Array.from(familyMap.values()).sort((a, b) => b.totalCount - a.totalCount);

    return { families: sortedFamilies, ungrouped: ungroupedVenues };
  }, [uniqueVenues, graph]);

  // Toggle venue selection
  const toggleVenue = useCallback((venue: string) => {
    setSelectedVenues(prev => {
      const newSet = new Set(prev);
      if (newSet.has(venue)) {
        newSet.delete(venue);
      } else {
        newSet.add(venue);
      }
      return newSet;
    });
  }, []);

  // Toggle entire family selection
  const toggleFamily = useCallback((familyVenues: string[]) => {
    setSelectedVenues(prev => {
      const newSet = new Set(prev);
      const allSelected = familyVenues.every(v => newSet.has(v));

      if (allSelected) {
        // Deselect all venues in family
        familyVenues.forEach(v => newSet.delete(v));
      } else {
        // Select all venues in family
        familyVenues.forEach(v => newSet.add(v));
      }
      return newSet;
    });
  }, []);

  // Toggle family expansion
  const toggleExpanded = useCallback((familyId: string) => {
    setExpandedFamilies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(familyId)) {
        newSet.delete(familyId);
      } else {
        newSet.add(familyId);
      }
      return newSet;
    });
  }, []);

  // Convert graph data when it changes
  useEffect(() => {
    const data = convertToForceGraphData(graph);

    // Filter nodes based on selected venues
    let filteredData = data;
    if (selectedVenues.size > 0) {
      const filteredNodeIds = new Set(
        graph.nodes
          .filter(node => node.paper?.venue && selectedVenues.has(node.paper.venue))
          .map(node => node.id)
      );

      filteredData = {
        nodes: data.nodes.filter(node => filteredNodeIds.has(node.id)),
        links: data.links.filter(link =>
          filteredNodeIds.has(typeof link.source === 'string' ? link.source : (link.source as ForceGraphNode).id) &&
          filteredNodeIds.has(typeof link.target === 'string' ? link.target : (link.target as ForceGraphNode).id)
        ),
      };
    }

    setGraphData(filteredData);

    // Calculate dynamic link distance based on number of nodes
    const nodeCount = data.nodes.length;
    const baseDistance = 5000;
    const scaleFactor = Math.sqrt(nodeCount);
    const calculatedDistance = baseDistance * scaleFactor;
    const finalDistance = Math.max(8000, Math.min(calculatedDistance, 30000));

    setLinkDistance(finalDistance);
    console.log(`[ForceGraph] ${nodeCount} nodes, link distance: ${finalDistance.toFixed(0)}px`);
  }, [graph, selectedVenues]);

  /**
   * Set initial zoom level and configure forces after graph loads
   */
  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      // Configure D3 forces for more stable, subtle movement
      if (fgRef.current.d3Force) {
        // Reduce charge force (repulsion between nodes) for less aggressive spreading
        fgRef.current.d3Force('charge')?.strength(-200);

        // Set link force with more damping for smoother connections
        const linkForce = fgRef.current.d3Force('link');
        if (linkForce) {
          linkForce.distance(linkDistance / 100);
          linkForce.strength(0.5); // Softer link strength for less rigid connections
        }

        // Add center force to keep graph centered
        fgRef.current.d3Force('center')?.strength(0.05);

        // Reduce collision force for subtler interactions
        fgRef.current.d3Force('collision')?.strength(0.5);
      }

      // Wait for initial layout to complete
      setTimeout(() => {
        if (fgRef.current) {
          // Set initial zoom to 1.44 (equivalent to 2 zoom-in clicks: 1.2 * 1.2)
          fgRef.current.zoom(1.44, 0);
        }
      }, 500);
    }
  }, [graphData, linkDistance]);

  /**
   * Auto-center on selected node when selectedPaperId changes (paper card click)
   */
  useEffect(() => {
    if (selectedPaperId && fgRef.current && graphData.nodes.length > 0) {
      // Find the selected node in the graph data
      const selectedNode = graphData.nodes.find(n => n.id === selectedPaperId);

      if (selectedNode && selectedNode.x !== undefined && selectedNode.y !== undefined) {
        // Wait a bit to ensure node has settled into position
        setTimeout(() => {
          if (fgRef.current) {
            const currentZoom = fgRef.current.zoom();
            // Only slightly adjust zoom if too far out (more subtle)
            const targetZoom = currentZoom < 1.2 ? 1.2 : currentZoom;
            // Longer, smoother transition (1200ms)
            fgRef.current.centerAt(selectedNode.x, selectedNode.y, 1200);
            if (targetZoom !== currentZoom) {
              fgRef.current.zoom(targetZoom, 1200);
            }
          }
        }, 100);
      }
    }
  }, [selectedPaperId, graphData]);

  /**
   * Get node color based on properties
   * 20-level blue gradient from dark (high similarity) to pale (low similarity)
   */
  const getNodeColor = useCallback((node: ForceGraphNode) => {
    // Green only for origin node
    if (node.isOrigin) {
      return 'hsl(122, 47%, 45%)'; // Green for origin
    }

    // 20-level blue gradient based on similarity (darker = higher similarity)
    // Lightness ranges from 30% (darkest) to 85% (palest)
    const similarity = node.similarityToOrigin || 0;

    // Calculate lightness: 30% at similarity 1.0, 85% at similarity 0.0
    // Formula: lightness = 85 - (similarity * 55)
    const lightness = 85 - (similarity * 55);

    return `hsl(207, 90%, ${lightness}%)`;
  }, []);

  /**
   * Get link color
   */
  const getLinkColor = useCallback((link: any) => {
    if (link.semanticSimilarity && link.semanticSimilarity > 0.5) {
      return 'hsl(24, 100%, 50%)'; // Orange for semantic edges
    }
    return 'hsl(0, 0%, 85%)'; // Light gray for citation edges
  }, []);

  /**
   * Handle zoom in
   */
  const handleZoomIn = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.zoom(fgRef.current.zoom() * 1.2, 400);
    }
  }, []);

  /**
   * Handle zoom out
   */
  const handleZoomOut = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.zoom(fgRef.current.zoom() * 0.8, 400);
    }
  }, []);

  /**
   * Handle reset view - center on origin node with zoomed out view to show more nodes
   */
  const handleResetView = useCallback(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      // Find the origin node
      const originNode = graphData.nodes.find(n => n.isOrigin);
      if (originNode && originNode.x !== undefined && originNode.y !== undefined) {
        // Center on origin with zoomed out view (0.8) to show more nodes
        fgRef.current.centerAt(originNode.x, originNode.y, 800);
        fgRef.current.zoom(0.8, 800);
      } else {
        // Fallback to zoomToFit if no origin found
        fgRef.current.zoomToFit(400, 80);
      }
    }
  }, [graphData]);

  /**
   * Handle node click
   */
  const handleNodeClick = useCallback((node: any) => {
    if (onNodeClick) {
      onNodeClick(node.id);
    }
    // Center view on clicked node with subtle, gentle transition
    if (fgRef.current && node.x !== undefined && node.y !== undefined) {
      const currentZoom = fgRef.current.zoom();
      // Only slightly adjust zoom if too far out (more subtle)
      const targetZoom = currentZoom < 1.2 ? 1.2 : currentZoom;
      // Longer, smoother transition (1200ms instead of 800ms)
      fgRef.current.centerAt(node.x, node.y, 1200);
      if (targetZoom !== currentZoom) {
        fgRef.current.zoom(targetZoom, 1200);
      }
    }
  }, [onNodeClick]);

  /**
   * Handle node hover
   */
  const handleNodeHover = useCallback((node: any) => {
    if (onNodeHover) {
      onNodeHover(node ? node.id : null);
    }
  }, [onNodeHover]);

  /**
   * Custom node canvas rendering
   */
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name; // Already formatted as "LastName Year"
    const fontSize = 13 / globalScale;
    // Thin font (300 weight) for lighter appearance
    ctx.font = `300 ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const size = Math.sqrt(node.val) * 0.8;
    const isSelected = selectedPaperId === node.id;

    // Draw node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    ctx.fillStyle = getNodeColor(node);
    ctx.fill();

    // Draw highlight ring if selected
    if (isSelected) {
      ctx.strokeStyle = 'hsl(330, 65%, 55%)'; // Pink highlight for selected
      ctx.lineWidth = 4 / globalScale;
      ctx.beginPath();
      ctx.arc(node.x, node.y, size + 6 / globalScale, 0, 2 * Math.PI);
      ctx.stroke();
    }
    // Draw highlight ring if origin
    else if (node.isOrigin) {
      ctx.strokeStyle = 'hsl(122, 47%, 35%)';
      ctx.lineWidth = 3 / globalScale;
      ctx.beginPath();
      ctx.arc(node.x, node.y, size + 4 / globalScale, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Draw label (LastName Year format) - single line with lighter color
    ctx.fillStyle = isSelected ? 'rgba(100, 100, 100, 1)' : 'rgba(120, 120, 120, 0.85)';
    ctx.fillText(label, node.x, node.y + size + fontSize * 1.2);
  }, [getNodeColor, selectedPaperId]);

  /**
   * Define clickable area for nodes (must match visual size)
   */
  const nodePointerAreaPaint = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
    const size = Math.sqrt(node.val) * 0.8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, size + 5, 0, 2 * Math.PI); // Slightly larger than visual for easier clicking
    ctx.fill();
  }, []);

  return (
    <div className={`force-graph-container ${className}`} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Floating Zoom Controls */}
      <div className="floating-zoom-controls">
        <button
          onClick={handleZoomIn}
          className="zoom-button"
          title="Zoom In"
          aria-label="Zoom in"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={handleZoomOut}
          className="zoom-button"
          title="Zoom Out"
          aria-label="Zoom out"
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={handleResetView}
          className="zoom-button"
          title="Fit View"
          aria-label="Fit entire graph in view"
        >
          <Maximize2 size={16} />
        </button>
        <button
          onClick={() => setShowFilterDropdown(!showFilterDropdown)}
          className={`zoom-button ${selectedVenues.size > 0 ? 'active' : ''}`}
          title="Filter by Source"
          aria-label="Filter by paper source/venue"
        >
          <Filter size={16} />
        </button>
      </div>

      {/* Improved Filter Dropdown with Journal Families */}
      {showFilterDropdown && (
        <div
          className="filter-dropdown"
          style={{
            position: 'absolute',
            top: '180px',
            left: '24px',
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
            maxHeight: '400px',
            overflowY: 'auto',
            width: '320px',
            zIndex: 1000,
          }}
        >
          {/* Header */}
          <div style={{
            fontWeight: '600',
            marginBottom: '12px',
            fontSize: '13px',
            color: '#333',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>Filter by Journal</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {selectedVenues.size > 0 && (
                <button
                  onClick={() => setSelectedVenues(new Set())}
                  style={{
                    padding: '4px 8px',
                    background: '#f5f5f5',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '10px',
                    cursor: 'pointer',
                    color: '#666',
                  }}
                >
                  Clear ({selectedVenues.size})
                </button>
              )}
              <button
                onClick={() => setShowFilterDropdown(false)}
                style={{
                  padding: '4px 6px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  color: '#666',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: '1',
                }}
                title="Close filter"
                aria-label="Close filter"
              >
                x
              </button>
            </div>
          </div>

          {uniqueVenues.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#999', padding: '8px' }}>
              No venues available
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {/* Journal Families */}
              {groupedVenues.families.map(({ family, venues, totalCount }) => {
                const isExpanded = expandedFamilies.has(family.id);
                const allSelected = venues.every(v => selectedVenues.has(v));
                const someSelected = venues.some(v => selectedVenues.has(v)) && !allSelected;

                return (
                  <div
                    key={family.id}
                    style={{
                      border: '1px solid #e5e5e5',
                      borderRadius: '6px',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Family Header */}
                    <div
                      style={{
                        padding: '8px 10px',
                        background: allSelected ? '#e3f2fd' : (someSelected ? '#f5f5f5' : 'white'),
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        borderBottom: isExpanded ? '1px solid #e5e5e5' : 'none',
                      }}
                    >
                      {/* Expand/Collapse Icon */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpanded(family.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '2px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          color: '#666',
                        }}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>

                      {/* Family Checkbox */}
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(input) => {
                          if (input) {
                            input.indeterminate = someSelected;
                          }
                        }}
                        onChange={() => toggleFamily(venues)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '16px',
                          height: '16px',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      />

                      {/* Family Info */}
                      <div
                        style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => toggleExpanded(family.id)}
                      >
                        {/* Icon */}
                        <span style={{ fontSize: '16px' }}>{family.icon}</span>

                        {/* Name and Impact Factor */}
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '12px',
                            fontWeight: '600',
                            color: family.color,
                          }}>
                            {family.displayName}
                          </div>
                          <div style={{ fontSize: '10px', color: '#999' }}>
                            IF: {family.impactFactor}
                          </div>
                        </div>

                        {/* Paper Count Badge */}
                        <div style={{
                          background: '#f0f0f0',
                          padding: '2px 6px',
                          borderRadius: '10px',
                          fontSize: '10px',
                          fontWeight: '600',
                          color: '#666',
                        }}>
                          {totalCount}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Venues List */}
                    {isExpanded && venues.length > 1 && (
                      <div style={{
                        padding: '6px 10px 6px 46px',
                        background: '#fafafa',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}>
                        {venues.map(venue => {
                          const venueCount = graph.nodes.filter(n => n.paper?.venue === venue).length;
                          return (
                            <label
                              key={venue}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '3px',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedVenues.has(venue)}
                                onChange={() => toggleVenue(venue)}
                                style={{
                                  width: '14px',
                                  height: '14px',
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                }}
                              />
                              <span style={{ flex: 1, lineHeight: '1.3', color: '#555' }}>
                                {venue}
                              </span>
                              <span style={{
                                fontSize: '10px',
                                color: '#999',
                                fontWeight: '500',
                              }}>
                                {venueCount}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Ungrouped Venues */}
              {groupedVenues.ungrouped.length > 0 && (
                <div style={{
                  marginTop: '8px',
                  paddingTop: '8px',
                  borderTop: '1px solid #e5e5e5',
                }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#999',
                    marginBottom: '6px',
                  }}>
                    Other Journals
                  </div>
                  {groupedVenues.ungrouped.map(venue => {
                    const venueCount = graph.nodes.filter(n => n.paper?.venue === venue).length;
                    return (
                      <label
                        key={venue}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '3px',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedVenues.has(venue)}
                          onChange={() => toggleVenue(venue)}
                          style={{
                            width: '14px',
                            height: '14px',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ flex: 1, lineHeight: '1.3', color: '#555' }}>
                          {venue}
                        </span>
                        <span style={{
                          fontSize: '10px',
                          color: '#999',
                          fontWeight: '500',
                        }}>
                          {venueCount}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Force Graph */}
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        nodeLabel={(node: any) => {
          const similarity = node.similarityToOrigin;
          const similarityText = similarity !== undefined && similarity > 0
            ? `\nRelevance: ${(similarity * 100).toFixed(0)}%`
            : '';
          return `${node.title}${similarityText}`;
        }}
        nodeVal={(node: any) => node.val}
        nodeColor={(node: any) => getNodeColor(node as ForceGraphNode)}
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={nodePointerAreaPaint}
        linkColor={getLinkColor}
        linkWidth={1}
        linkDirectionalParticles={0}
        d3AlphaDecay={0.01}
        d3VelocityDecay={0.3}
        d3AlphaMin={0.001}
        onNodeHover={handleNodeHover}
        onNodeClick={handleNodeClick}
        cooldownTicks={200}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        backgroundColor="hsl(0, 0%, 98%)"
        nodeRelSize={6}
        warmupTicks={100}
        onEngineStop={() => {
          if (fgRef.current) {
            fgRef.current.d3Force('charge')?.strength(-200);
            fgRef.current.d3Force('link')?.distance(linkDistance / 100);
          }
        }}
      />
    </div>
  );
}

export default ForceGraphVisualization;
