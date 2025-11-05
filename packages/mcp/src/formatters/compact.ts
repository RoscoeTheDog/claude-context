/**
 * Compact formatter - Code snippets with condensed metadata
 * Token savings: ~50%
 * Use case: 4-10 results where agent needs code but can handle less verbosity
 */

import * as path from 'path';
import { SearchResult, ResultFormatter } from './types.js';
import { truncateContent } from '../utils.js';

export const formatCompact: ResultFormatter = (
    results: SearchResult[],
    codebasePath: string,
    query: string,
    isIndexing: boolean
): string => {
    const codebaseInfo = path.basename(codebasePath);

    // Compact header (no indexing warning in header for brevity)
    let output = `Found ${results.length} results for "${query}" in ${codebaseInfo}:\n\n`;

    const formattedResults = results.map((result: SearchResult, index: number) => {
        // Truncate code aggressively to achieve 50% reduction (1200 chars vs 5000)
        const code = truncateContent(result.content, 1200);

        // More compact format: single-line header, code block only
        return `${index + 1}. ${result.relativePath}:${result.startLine}-${result.endLine}\n` +
            `\`\`\`${result.language}\n${code}\n\`\`\``;
    }).join('\n\n');

    output += formattedResults;

    // Indexing tip only if in progress (at the end, more compact)
    if (isIndexing) {
        output += `\n\n💡 Indexing in progress.`;
    }

    return output;
};
