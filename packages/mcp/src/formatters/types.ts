/**
 * Result formatter types for search_code MCP tool
 *
 * These formatters provide progressive token optimization while maintaining search accuracy.
 * Selection is based on result count using auto-detection thresholds.
 */

/**
 * Detail level for search result formatting
 * - auto: Auto-detect based on result count (default)
 * - full: Complete code snippets + all metadata (0% savings, baseline)
 * - compact: Code snippets + summaries (50% reduction)
 * - summary: Metadata + descriptions only (75% reduction)
 * - locations: File paths + line numbers only (90% reduction)
 */
export type DetailLevel = 'auto' | 'full' | 'compact' | 'summary' | 'locations';

/**
 * Search result data structure (from Context.semanticSearch)
 */
export interface SearchResult {
    relativePath: string;
    startLine: number;
    endLine: number;
    content: string;
    language: string;
    score?: number;
    [key: string]: any; // Allow additional metadata fields
}

/**
 * Formatter function interface
 * All formatters receive the same input and return formatted text
 */
export interface ResultFormatter {
    (
        results: SearchResult[],
        codebasePath: string,
        query: string,
        isIndexing: boolean
    ): string;
}

/**
 * Auto-detection thresholds for result formatting
 * Based on empirical testing for optimal token efficiency
 */
export const DETAIL_THRESHOLDS = {
    FULL_MAX: 3,      // 1-3 results → full detail
    COMPACT_MAX: 10,  // 4-10 results → compact format
    SUMMARY_MAX: 25,  // 11-25 results → summary format
    // 26+ results → locations only
} as const;
