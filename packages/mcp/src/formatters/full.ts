/**
 * Full detail formatter - Complete code snippets with all metadata
 * Token savings: 0% (baseline)
 * Use case: 1-3 results where agent needs full context
 */

import * as path from 'path';
import { SearchResult, ResultFormatter } from './types.js';
import { truncateContent } from '../utils.js';

export const formatFull: ResultFormatter = (
    results: SearchResult[],
    codebasePath: string,
    query: string,
    isIndexing: boolean
): string => {
    const codebaseInfo = path.basename(codebasePath);
    const indexingStatusMessage = isIndexing
        ? `\n⚠️  **Indexing in Progress**: This codebase is currently being indexed in the background. Search results may be incomplete until indexing completes.`
        : '';

    const formattedResults = results.map((result: SearchResult, index: number) => {
        const location = `${result.relativePath}:${result.startLine}-${result.endLine}`;
        const context = truncateContent(result.content, 5000);

        return `${index + 1}. Code snippet (${result.language}) [${codebaseInfo}]\n` +
            `   Location: ${location}\n` +
            `   Rank: ${index + 1}\n` +
            `   Context: \n\`\`\`${result.language}\n${context}\n\`\`\`\n`;
    }).join('\n');

    let resultMessage = `Found ${results.length} results for query: "${query}" in codebase '${codebasePath}'${indexingStatusMessage}\n\n${formattedResults}`;

    if (isIndexing) {
        resultMessage += `\n\n💡 **Tip**: This codebase is still being indexed. More results may become available as indexing progresses.`;
    }

    return resultMessage;
};
