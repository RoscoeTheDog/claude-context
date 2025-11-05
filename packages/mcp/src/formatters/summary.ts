/**
 * Summary formatter - Metadata and brief descriptions only, no code
 * Token savings: ~75%
 * Use case: 11-25 results where agent needs overview before diving deeper
 */

import * as path from 'path';
import { SearchResult, ResultFormatter } from './types.js';

/**
 * Generate a brief description from code content (first few meaningful lines)
 */
function generateBriefDescription(content: string, maxLength: number = 150): string {
    // Split into lines and filter out empty lines
    const lines = content.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*'));

    // Take first 2-3 meaningful lines
    const snippet = lines.slice(0, 2).join(' ').substring(0, maxLength);

    return snippet.length < content.length ? snippet + '...' : snippet;
}

export const formatSummary: ResultFormatter = (
    results: SearchResult[],
    codebasePath: string,
    query: string,
    isIndexing: boolean
): string => {
    const codebaseInfo = path.basename(codebasePath);

    // Very compact header
    let output = `${results.length} results for "${query}" in ${codebaseInfo}:\n\n`;

    const formattedResults = results.map((result: SearchResult, index: number) => {
        const description = generateBriefDescription(result.content);

        // Minimalist format: number, location, brief description
        return `${index + 1}. ${result.relativePath}:${result.startLine}-${result.endLine}\n   ${description}`;
    }).join('\n\n');

    output += formattedResults;

    // Indexing tip (ultra-compact)
    if (isIndexing) {
        output += `\n\n💡 Indexing in progress.`;
    }

    return output;
};
