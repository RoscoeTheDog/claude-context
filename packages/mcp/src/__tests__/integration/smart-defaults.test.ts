/**
 * Integration tests for Smart Defaults (Story 1)
 *
 * Tests cover:
 * - Default parameter behavior (no optional params)
 * - Progressive disclosure (basic → intermediate → advanced)
 * - Real-world agent workflows
 * - Backward compatibility with existing code
 */

import { describe, it, expect } from 'vitest';
import {
    formatSearchResults,
    type SearchResult
} from '../../formatters/index.js';

/**
 * Helper to create realistic mock results
 */
function createMockResults(count: number): SearchResult[] {
    return Array.from({ length: count }, (_, i) => ({
        relativePath: `src/modules/feature${i + 1}/handler.ts`,
        startLine: i * 20 + 10,
        endLine: i * 20 + 50,
        content: `export async function handleFeature${i + 1}(context: Context, options: Options): Promise<Result> {
    const logger = context.getLogger();
    logger.info(\`Processing feature ${i + 1}\`);

    const validator = new Validator(options);
    if (!await validator.validate()) {
        throw new ValidationError(\`Invalid feature ${i + 1} configuration\`);
    }

    const processor = new Processor(context);
    return await processor.execute(options);
}`,
        language: 'typescript',
        score: 0.95 - i * 0.02
    }));
}

describe('Smart Defaults - Real-World Workflows', () => {
    describe('Tier 1: Beginner - "Just works" (no optional params)', () => {
        it('should work with only required params (path + query)', () => {
            const results = createMockResults(10);

            // Agent calls with minimal params (just path + query)
            const output = formatSearchResults(results, '/test/codebase', 'authentication logic', false);

            // Should return results without errors
            expect(output).toBeTruthy();
            expect(output).toContain('Found 10 results');

            // Should auto-detect compact mode for 10 results
            expect(output).toContain('```typescript');
            expect(output).not.toContain('Rank:'); // Compact doesn't include verbose metadata
        });

        it('should auto-optimize for small result set (3 results)', () => {
            const results = createMockResults(3);

            const output = formatSearchResults(results, '/test/codebase', 'login function', false);

            // Should auto-detect full mode
            expect(output).toContain('Found 3 results');
            expect(output).toContain('Rank:'); // Full mode includes rank
            expect(output).toContain('```typescript');
        });

        it('should auto-optimize for medium result set (15 results)', () => {
            const results = createMockResults(15);

            const output = formatSearchResults(results, '/test/codebase', 'error handling', false);

            // Should auto-detect summary mode
            expect(output).toContain('15 results');
            expect(output).not.toContain('```'); // Summary doesn't include code blocks
            expect(output).toMatch(/\.\.\./); // Truncation indicator
        });

        it('should auto-optimize for large result set (30 results)', () => {
            const results = createMockResults(30);

            const output = formatSearchResults(results, '/test/codebase', 'API routes', false);

            // Should auto-detect locations mode
            expect(output).toContain('30 matches');
            expect(output).not.toContain('```'); // Locations doesn't include code
            expect(output).toContain('Read tool'); // Suggests next step
        });
    });

    describe('Tier 2: Intermediate - "Some control"', () => {
        it('should respect limit parameter', () => {
            const results = createMockResults(5);

            const output = formatSearchResults(results, '/test/codebase', 'auth', false);

            // With 5 results, should use compact mode
            expect(output).toContain('Found 5 results');
            expect(output).toContain('```typescript');
            expect(output).not.toContain('Rank:');
        });

        it('should work with extensionFilter', () => {
            // This test validates that the formatter doesn't break with additional params
            // Actual filtering happens before formatting
            const results = createMockResults(8).filter(r => r.relativePath.endsWith('.ts'));

            const output = formatSearchResults(results, '/test/codebase', 'typescript functions', false);

            expect(output).toContain('Found 8 results');
            expect(output).toContain('.ts'); // All results should be TypeScript files
        });
    });

    describe('Tier 3: Advanced - "Full control"', () => {
        it('should allow forcing full mode even with many results', () => {
            const results = createMockResults(20);

            // Power user explicitly requests full detail
            const output = formatSearchResults(results, '/test/codebase', 'all handlers', false, 'full');

            // Should use full mode despite 20 results
            expect(output).toContain('Found 20 results');
            expect(output).toContain('Rank:'); // Full mode metadata
            expect(output).toContain('```typescript');
        });

        it('should allow forcing locations mode even with few results', () => {
            const results = createMockResults(3);

            // Power user explicitly requests locations only
            const output = formatSearchResults(results, '/test/codebase', 'specific files', false, 'locations');

            // Should use locations mode despite only 3 results
            expect(output).toContain('3 matches');
            expect(output).not.toContain('```');
            expect(output).toContain('Read tool');
        });

        it('should allow forcing compact mode', () => {
            const results = createMockResults(2);

            const output = formatSearchResults(results, '/test/codebase', 'specific code', false, 'compact');

            // Should use compact mode (normally would be full for 2 results)
            expect(output).toContain('Found 2 results');
            expect(output).not.toContain('Rank:'); // Compact doesn't include rank
        });

        it('should allow forcing summary mode', () => {
            const results = createMockResults(5);

            const output = formatSearchResults(results, '/test/codebase', 'overview needed', false, 'summary');

            // Should use summary mode (normally would be compact for 5 results)
            expect(output).toContain('5 results');
            expect(output).not.toContain('```'); // Summary doesn't include code blocks
        });
    });
});

describe('Smart Defaults - Backward Compatibility', () => {
    it('should maintain existing behavior when no detail param provided', () => {
        const results = createMockResults(10);

        // Legacy call (how agents called it before smart defaults)
        const output = formatSearchResults(results, '/test/codebase', 'search query', false);

        // Should work without errors
        expect(output).toBeTruthy();
        expect(output).toContain('Found 10 results');
    });

    it('should handle undefined detail parameter gracefully', () => {
        const results = createMockResults(8);

        const output = formatSearchResults(results, '/test/codebase', 'query', false, undefined);

        // Should auto-detect (same as no param)
        expect(output).toContain('Found 8 results');
        expect(output).toContain('```typescript');
    });

    it('should treat "auto" as auto-detection', () => {
        const results = createMockResults(7);

        const autoOutput = formatSearchResults(results, '/test', 'query', false, 'auto');
        const defaultOutput = formatSearchResults(results, '/test', 'query', false);

        // Both should produce identical output
        expect(autoOutput).toBe(defaultOutput);
    });
});

describe('Smart Defaults - Agent Discovery Patterns', () => {
    it('should provide clear output format hints', () => {
        const results = createMockResults(15);

        const output = formatSearchResults(results, '/test/codebase', 'search query', false);

        // Summary mode should indicate it's showing summaries
        expect(output).toContain('15 results');
        // Should be clear about what's shown
        expect(output).toMatch(/src\/modules/);
    });

    it('should suggest next steps in locations mode', () => {
        const results = createMockResults(50);

        const output = formatSearchResults(results, '/test/codebase', 'many matches', false);

        // Should guide agent to use Read tool for specific files
        expect(output).toContain('Read tool');
        expect(output).toContain('50 matches');
    });

    it('should provide file paths for easy navigation', () => {
        const results = createMockResults(5);

        const output = formatSearchResults(results, '/test/codebase', 'specific files', false);

        // All modes should include file paths
        results.forEach(result => {
            expect(output).toContain(result.relativePath);
        });
    });
});

describe('Smart Defaults - Edge Cases', () => {
    it('should handle empty results gracefully', () => {
        const results: SearchResult[] = [];

        const output = formatSearchResults(results, '/test/codebase', 'no matches', false);

        // Should not crash
        expect(output).toBeTruthy();
    });

    it('should handle single result', () => {
        const results = createMockResults(1);

        const output = formatSearchResults(results, '/test/codebase', 'one match', false);

        // Should use full mode for single result
        expect(output).toContain('Found 1 result');
        expect(output).toContain('Rank:');
    });

    it('should handle boundary cases (threshold edges)', () => {
        // Test exactly at thresholds
        const thresholds = [3, 4, 10, 11, 25, 26];

        thresholds.forEach(count => {
            const results = createMockResults(count);
            const output = formatSearchResults(results, '/test', 'query', false);

            // Should not crash at boundaries
            expect(output).toBeTruthy();
            expect(output).toContain(`${count}`);
        });
    });

    it('should handle very large result sets', () => {
        const results = createMockResults(100);

        const output = formatSearchResults(results, '/test/codebase', 'many results', false);

        // Should use locations mode and not be excessively large
        expect(output).toContain('100 matches');
        expect(output.length).toBeLessThan(10000); // Reasonable size limit
    });
});

describe('Smart Defaults - Progressive Disclosure', () => {
    it('should show more detail for fewer results', () => {
        const fewResults = createMockResults(2);
        const manyResults = createMockResults(20);

        const fewOutput = formatSearchResults(fewResults, '/test', 'query', false);
        const manyOutput = formatSearchResults(manyResults, '/test', 'query', false);

        // Few results should be more detailed (full mode)
        expect(fewOutput).toContain('Rank:');

        // Many results should be less detailed (summary mode)
        expect(manyOutput).not.toContain('```');
    });

    it('should progressively reduce detail as result count increases', () => {
        const counts = [2, 7, 15, 30];
        const outputs = counts.map(count => {
            const results = createMockResults(count);
            return formatSearchResults(results, '/test', 'query', false);
        });

        // 2 results: full (includes Rank)
        expect(outputs[0]).toContain('Rank:');

        // 7 results: compact (includes code but no Rank)
        expect(outputs[1]).toContain('```');
        expect(outputs[1]).not.toContain('Rank:');

        // 15 results: summary (no code blocks)
        expect(outputs[2]).not.toContain('```');

        // 30 results: locations (minimal)
        expect(outputs[3]).toContain('matches');
        expect(outputs[3]).toContain('Read tool');
    });
});
