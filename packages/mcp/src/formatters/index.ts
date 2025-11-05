/**
 * Result formatter orchestrator with auto-detection
 *
 * Automatically selects the optimal format based on result count for maximum token efficiency.
 * Respects feature flags and power user overrides.
 */

import { SearchResult, DetailLevel, ResultFormatter, DETAIL_THRESHOLDS } from './types.js';
import { formatFull } from './full.js';
import { formatCompact } from './compact.js';
import { formatSummary } from './summary.js';
import { formatLocations } from './locations.js';
import { FEATURE_FLAGS } from '../config/feature-flags.js';

/**
 * Auto-detect the optimal detail level based on result count
 * Implements the empirically-tested thresholds from the sprint spec
 *
 * @param resultCount Number of search results
 * @returns The optimal detail level
 */
export function detectDetailLevel(resultCount: number): DetailLevel {
    if (resultCount <= DETAIL_THRESHOLDS.FULL_MAX) {
        return 'full';      // 1-3 results: show everything
    }
    if (resultCount <= DETAIL_THRESHOLDS.COMPACT_MAX) {
        return 'compact';   // 4-10 results: 50% savings
    }
    if (resultCount <= DETAIL_THRESHOLDS.SUMMARY_MAX) {
        return 'summary';   // 11-25 results: 75% savings
    }
    return 'locations';     // 26+ results: 90% savings
}

/**
 * Get the appropriate formatter for the given detail level
 *
 * @param level Detail level (explicit or auto-detected)
 * @returns Formatter function
 */
export function getFormatter(level: DetailLevel): ResultFormatter {
    switch (level) {
        case 'full':
            return formatFull;
        case 'compact':
            return formatCompact;
        case 'summary':
            return formatSummary;
        case 'locations':
            return formatLocations;
        default:
            // Should never happen due to type safety, but fallback to full
            console.warn(`[FORMATTER] Unknown detail level '${level}', falling back to 'full'`);
            return formatFull;
    }
}

/**
 * Format search results with smart auto-detection or explicit override
 *
 * This is the main entry point for result formatting. It:
 * 1. Checks feature flag (silent fallback if disabled)
 * 2. Respects power user overrides (explicit detail parameter)
 * 3. Auto-detects optimal format based on result count
 * 4. Applies the selected formatter
 *
 * @param results Search results from Context.semanticSearch
 * @param codebasePath Absolute path to codebase
 * @param query User's search query
 * @param isIndexing Whether the codebase is currently being indexed
 * @param explicitDetail Optional power user override (null/'auto' = auto-detect)
 * @returns Formatted result string
 */
export function formatSearchResults(
    results: SearchResult[],
    codebasePath: string,
    query: string,
    isIndexing: boolean,
    explicitDetail?: DetailLevel | null
): string {
    // Feature flag check: silent fallback to full mode
    if (!FEATURE_FLAGS.SMART_RESULTS) {
        console.warn('[FORMATTER] Smart results disabled via CC_SMART_RESULTS=false, using full mode');
        return formatFull(results, codebasePath, query, isIndexing);
    }

    // Determine detail level
    let detailLevel: DetailLevel;

    if (explicitDetail && explicitDetail !== 'auto') {
        // Power user override: respect explicit choice
        detailLevel = explicitDetail;
        console.log(`[FORMATTER] Using explicit detail level: ${detailLevel} (override)`);
    } else {
        // Auto-detection: choose based on result count
        detailLevel = detectDetailLevel(results.length);
        console.log(`[FORMATTER] Auto-detected detail level: ${detailLevel} (${results.length} results)`);
    }

    // Get the appropriate formatter and apply it
    const formatter = getFormatter(detailLevel);
    return formatter(results, codebasePath, query, isIndexing);
}

// Re-export types and formatters for testing
export { DetailLevel, SearchResult, DETAIL_THRESHOLDS };
export { formatFull, formatCompact, formatSummary, formatLocations };
