/**
 * Locations formatter - File paths and line numbers only
 * Token savings: ~90%
 * Use case: 26+ results where agent needs to see what's available before reading specific files
 */

import * as path from 'path';
import { SearchResult, ResultFormatter } from './types.js';

export const formatLocations: ResultFormatter = (
    results: SearchResult[],
    codebasePath: string,
    query: string,
    isIndexing: boolean
): string => {
    const codebaseInfo = path.basename(codebasePath);

    // Minimal header
    let output = `${results.length} matches for "${query}" in ${codebaseInfo}:\n\n`;

    // Ultra-compact: just number and location
    const formattedResults = results.map((result: SearchResult, index: number) => {
        return `${index + 1}. ${result.relativePath}:${result.startLine}-${result.endLine}`;
    }).join('\n');

    output += formattedResults;

    // Note to agent about using Read tool
    output += `\n\n💡 Use the Read tool to view specific files.`;

    if (isIndexing) {
        output += ` Indexing in progress.`;
    }

    return output;
};
