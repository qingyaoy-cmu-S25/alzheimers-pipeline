/**
 * Citation Network Page Component
 *
 * Full-page citation network visualization with paper search.
 * Three-column layout: Papers List | Graph Visualization | Paper Details
 *
 * Adapted from BioCopilot for Vite/React
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { ForceGraphVisualization } from './ForceGraphVisualization';
import { cancerMockData } from '@/data/mockCancerCellData';
import { buildCitationNetwork } from '@/lib/graph/networkBuilder';
import type { Paper, NetworkGraph } from '@/types/citationNetwork';
import '@/styles/citationNetwork.css';
import '@/styles/citationGraph.css';

/**
 * Props for CitationNetworkPage component
 */
export interface CitationNetworkPageProps {
  /** Callback when back button is clicked */
  onBack?: () => void;
  /** Initial search query */
  initialQuery?: string;
}

/**
 * Citation Network Page Component
 */
export function CitationNetworkPage({
  onBack,
  initialQuery = '',
}: CitationNetworkPageProps) {
  // Build initial graph with similarity data
  const initialGraph = useMemo(() => {
    const result = buildCitationNetwork(cancerMockData.papers, 'cancer-1', {
      maxNodes: 50,
      minCitations: 0,
      includeCoCitations: false,
    });
    return result.graph;
  }, []);

  // State for search and data
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [papers, setPapers] = useState<Paper[]>(cancerMockData.papers);
  const [baseGraph, setBaseGraph] = useState<NetworkGraph>(initialGraph);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // State for UI
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [yearRange, setYearRange] = useState<[number, number]>([1970, 2025]);
  const [sortBy, setSortBy] = useState<'relevance' | 'citations' | 'recent'>('relevance');

  // Ref for paper list scrolling
  const paperListRef = useRef<HTMLDivElement>(null);

  /**
   * Performs search (currently uses mock data filtering)
   */
  const performSearch = async (query: string) => {
    if (!query || query.trim().length === 0) {
      setSearchError('Please enter a search query');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchQuery(query);

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      const queryLower = query.toLowerCase();
      const filteredPapers = cancerMockData.papers.filter(
        (paper) =>
          paper.title.toLowerCase().includes(queryLower) ||
          paper.abstract?.toLowerCase().includes(queryLower) ||
          paper.authors.some((author) => author.toLowerCase().includes(queryLower))
      );

      if (filteredPapers.length === 0) {
        setSearchError(`No papers found for "${query}". Try a different search term.`);
        setIsSearching(false);
        return;
      }

      setPapers(filteredPapers);

      const originPaper = filteredPapers[0];
      const networkResult = buildCitationNetwork(filteredPapers, originPaper.id, {
        maxNodes: 50,
        minCitations: 0,
        includeCoCitations: false,
      });

      setBaseGraph(networkResult.graph);
    } catch (error) {
      console.error('[Citation Network] Search error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setSearchError(errorMessage);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchInput);
  };

  const handleReset = () => {
    setPapers(cancerMockData.papers);
    setBaseGraph(initialGraph);
    setSearchError(null);
    setSearchQuery('');
    setSearchInput('');
    setYearRange([1970, 2025]);
  };

  const handleBackClick = () => {
    if (onBack) {
      onBack();
    }
  };

  const handleSetOrigin = () => {
    if (selectedPaperId && papers.length > 0) {
      const networkResult = buildCitationNetwork(papers, selectedPaperId, {
        maxNodes: 50,
        minCitations: 0,
      });
      setBaseGraph(networkResult.graph);
    }
  };

  const handleNodeClick = useCallback((paperId: string) => {
    setSelectedPaperId(paperId);
    // Scroll to paper in list (only within the papers-list container)
    setTimeout(() => {
      const paperElement = document.getElementById(`paper-card-${paperId}`);
      const container = paperListRef.current;
      if (paperElement && container) {
        // Calculate scroll position relative to container
        const containerRect = container.getBoundingClientRect();
        const elementRect = paperElement.getBoundingClientRect();
        const scrollTop = container.scrollTop + (elementRect.top - containerRect.top) - (containerRect.height / 2) + (elementRect.height / 2);
        container.scrollTo({ top: scrollTop, behavior: 'smooth' });
      }
    }, 100);
  }, []);

  const handleNodeHover = useCallback(() => {
    // Can be used for hover effects
  }, []);

  // Filter and sort papers based on year range and sort option
  const filteredPapers = useMemo(() => {
    const filtered = papers.filter((paper) => {
      return paper.year >= yearRange[0] && paper.year <= yearRange[1];
    });

    // Sort based on selected option
    switch (sortBy) {
      case 'relevance':
        return filtered.sort((a, b) => (b.similarityToOrigin || 0) - (a.similarityToOrigin || 0));
      case 'citations':
        return filtered.sort((a, b) => b.citationCount - a.citationCount);
      case 'recent':
        return filtered.sort((a, b) => b.year - a.year);
      default:
        return filtered;
    }
  }, [papers, yearRange, sortBy]);

  // Filter graph based on year range (computed, not stored in state)
  const graph = useMemo(() => {
    if (baseGraph.nodes.length === 0) return baseGraph;

    const validPaperIds = new Set(
      papers
        .filter((p) => p.year >= yearRange[0] && p.year <= yearRange[1])
        .map((p) => p.id)
    );

    const filteredNodes = baseGraph.nodes.filter((node) => validPaperIds.has(node.id));
    const filteredEdges = baseGraph.edges.filter(
      (edge) => validPaperIds.has(edge.source) && validPaperIds.has(edge.target)
    );

    return {
      ...baseGraph,
      nodes: filteredNodes,
      edges: filteredEdges,
    };
  }, [baseGraph, papers, yearRange]);

  const selectedPaper = selectedPaperId
    ? papers.find((p) => p.id === selectedPaperId) || null
    : null;

  const formatAuthors = (authors: string[]) => {
    if (authors.length === 0) return 'Unknown authors';
    if (authors.length === 1) return authors[0];
    if (authors.length === 2) return `${authors[0]} and ${authors[1]}`;
    return `${authors[0]}, ${authors[1]}, et al.`;
  };

  const getDirectCitations = (paperId: string) => {
    return graph.edges.filter((e) => e.source === paperId).length;
  };

  const getCitedBy = (paperId: string) => {
    return graph.edges.filter((e) => e.target === paperId).length;
  };

  const getCoCitations = (paperId: string) => {
    const thisPaperCites = graph.edges.filter((e) => e.source === paperId).map((e) => e.target);
    return graph.edges.filter((e) => e.source !== paperId && thisPaperCites.includes(e.target))
      .length;
  };

  return (
    <div className="citation-network-page">
      {/* Loading Overlay */}
      {isSearching && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              border: '6px solid #E3F2FD',
              borderTop: '6px solid #2196F3',
              animation: 'spin 1s linear infinite',
            }}
          ></div>
          <div
            style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#1976D2',
            }}
          >
            Searching...
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="citation-network-header">
        <div className="header-left">
          {onBack && (
            <button className="back-button" onClick={handleBackClick}>
              ← Back
            </button>
          )}
          <h1>Citation Network Visualization</h1>
        </div>
        <div className="header-right">
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="search"
              placeholder="Search papers (e.g., cancer, metabolism)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="search-input"
              disabled={isSearching}
              style={{ width: '350px' }}
            />
            <button
              type="submit"
              className="primary-button"
              disabled={isSearching || !searchInput.trim()}
            >
              Search
            </button>
          </form>
          {searchQuery && (
            <button className="secondary-button" onClick={handleReset}>
              Reset
            </button>
          )}
        </div>
      </header>

      {/* Search Status / Error Banner */}
      {searchError && (
        <div className="search-status error">
          <span>{searchError}</span>
          <button onClick={() => setSearchError(null)}>×</button>
        </div>
      )}

      {searchQuery && !searchError && (
        <div className="search-status success">
          <span>
            Showing results for: <strong>"{searchQuery}"</strong> ({papers.length} papers)
          </span>
        </div>
      )}

      {/* Main Three-Column Layout */}
      <div className="citation-network-content">
        {/* Left Sidebar - Papers List */}
        <aside className="papers-sidebar">
          <div className="sidebar-header">
            <h3>Papers</h3>
            <span className="count-badge">{filteredPapers.length}</span>
          </div>

          <div className="filters">
            <div className="filter-group">
              <label>Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'relevance' | 'citations' | 'recent')}
                className="sort-select"
              >
                <option value="relevance">Highest Relevance</option>
                <option value="citations">Most Citations</option>
                <option value="recent">Most Recent</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Year Range: {yearRange[0]} - {yearRange[1]}</label>
              <div className="dual-range-container">
                {/* Track background - shows blue only between the two thumbs */}
                <div
                  className="range-track"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: 0,
                    right: 0,
                    height: '4px',
                    transform: 'translateY(-50%)',
                    borderRadius: '2px',
                    background: `linear-gradient(to right,
                      #e0e0e0 0%,
                      #e0e0e0 ${((yearRange[0] - 1970) / (2025 - 1970)) * 100}%,
                      #2196F3 ${((yearRange[0] - 1970) / (2025 - 1970)) * 100}%,
                      #2196F3 ${((yearRange[1] - 1970) / (2025 - 1970)) * 100}%,
                      #e0e0e0 ${((yearRange[1] - 1970) / (2025 - 1970)) * 100}%,
                      #e0e0e0 100%)`,
                  }}
                />
                <input
                  type="range"
                  min="1970"
                  max="2025"
                  value={yearRange[0]}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val < yearRange[1]) {
                      setYearRange([val, yearRange[1]]);
                    }
                  }}
                  className="range-slider range-slider-min"
                />
                <input
                  type="range"
                  min="1970"
                  max="2025"
                  value={yearRange[1]}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val > yearRange[0]) {
                      setYearRange([yearRange[0], val]);
                    }
                  }}
                  className="range-slider range-slider-max"
                />
              </div>
            </div>
          </div>

          <div className="papers-list" ref={paperListRef}>
            {filteredPapers.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px', textAlign: 'center' }}>
                <p style={{ color: '#999' }}>No papers in this year range</p>
              </div>
            ) : (
              filteredPapers.map((paper) => (
                  <div
                    key={paper.id}
                    id={`paper-card-${paper.id}`}
                    className={`paper-card ${paper.id === graph.originPaperId ? 'origin' : ''} ${
                      paper.id === selectedPaperId ? 'selected' : ''
                    }`}
                    onClick={() => handleNodeClick(paper.id)}
                  >
                    <div className="paper-card-title">{paper.title}</div>
                    <div className="paper-card-authors">{formatAuthors(paper.authors)}</div>
                    <div className="paper-card-meta">
                      <span>{paper.year}</span>
                      <span>•</span>
                      <span>{paper.citationCount.toLocaleString()} citations</span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </aside>

        {/* Center - Graph Visualization */}
        <main className="graph-container">
          <div className="graph-toolbar">
            <div className="toolbar-section">
              <div className="graph-info">
                <span className="info-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                  {graph.nodes.length} Papers
                </span>
                <span className="info-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                  {graph.edges.length} Citations
                </span>
              </div>
            </div>
          </div>

          <div className="graph-visualization">
            {graph.nodes.length > 0 ? (
              <ForceGraphVisualization
                graph={graph}
                onNodeClick={handleNodeClick}
                onNodeHover={handleNodeHover}
                selectedPaperId={selectedPaperId}
              />
            ) : (
              <div className="empty-state" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <p>No papers to display</p>
                <p style={{ fontSize: '14px', color: '#999' }}>Try adjusting the year range</p>
              </div>
            )}
          </div>
        </main>

        {/* Right Panel - Paper Details */}
        <aside className="details-panel">
          {selectedPaper ? (
            <>
              <div className="panel-header">
                <h3>Paper Details</h3>
                <button className="close-button" onClick={() => setSelectedPaperId(null)}>
                  ✕
                </button>
              </div>

              <div className="paper-details">
                <div className="detail-section">
                  <div className="paper-title">{selectedPaper.title}</div>
                  <div className="paper-authors">{formatAuthors(selectedPaper.authors)}</div>
                  <div className="paper-meta">
                    <span className="meta-item">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      {selectedPaper.year}
                    </span>
                    <span className="meta-item">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                      </svg>
                      {selectedPaper.source}
                    </span>
                    <span className="meta-item">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      {selectedPaper.citationCount.toLocaleString()} citations
                    </span>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>ABSTRACT</h4>
                  <p className="abstract-text">{selectedPaper.abstract || 'No abstract available'}</p>
                </div>

                <div className="detail-section">
                  <h4>NETWORK METRICS</h4>
                  <div className="metrics-grid">
                    <div className="metric-card" style={{ borderLeftColor: '#2196F3' }}>
                      <div className="metric-value" style={{ color: '#2196F3' }}>
                        {getDirectCitations(selectedPaper.id)}
                      </div>
                      <div className="metric-label">DIRECT CITATIONS</div>
                    </div>
                    <div className="metric-card" style={{ borderLeftColor: '#4CAF50' }}>
                      <div className="metric-value" style={{ color: '#4CAF50' }}>
                        {getCitedBy(selectedPaper.id)}
                      </div>
                      <div className="metric-label">CITED BY</div>
                    </div>
                    <div className="metric-card" style={{ borderLeftColor: '#00BCD4' }}>
                      <div className="metric-value" style={{ color: '#00BCD4' }}>
                        {getCoCitations(selectedPaper.id)}
                      </div>
                      <div className="metric-label">CO-CITATIONS</div>
                    </div>
                  </div>
                </div>

                <div className="detail-actions">
                  <button className="action-button secondary" onClick={handleSetOrigin}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="15 3 21 3 21 9" />
                      <polyline points="9 21 3 21 3 15" />
                      <line x1="21" y1="3" x2="14" y2="10" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                    Set as Origin
                  </button>
                  {selectedPaper.url && (
                    <button
                      className="action-button secondary"
                      onClick={() => {
                        if (selectedPaper.url) {
                          window.open(selectedPaper.url, '_blank', 'noopener,noreferrer');
                        }
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                      View Paper
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#CCC" strokeWidth="1">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
              <p>Select a paper to view details</p>
              <p className="empty-subtitle">Click a node in the graph or a paper in the list</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default CitationNetworkPage;
