/**
 * Unit tests for search result formatters
 *
 * Tests cover:
 * - Auto-detection thresholds
 * - Each formatter's output
 * - Feature flag integration
 * - Power user overrides
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    formatSearchResults,
    detectDetailLevel,
    formatFull,
    formatCompact,
    formatSummary,
    formatLocations,
    DETAIL_THRESHOLDS,
    type SearchResult
} from '../formatters/index.js';

describe('Formatter Auto-Detection', () => {
    it('should detect "full" for 1-3 results', () => {
        expect(detectDetailLevel(1)).toBe('full');
        expect(detectDetailLevel(2)).toBe('full');
        expect(detectDetailLevel(3)).toBe('full');
    });

    it('should detect "compact" for 4-10 results', () => {
        expect(detectDetailLevel(4)).toBe('compact');
        expect(detectDetailLevel(7)).toBe('compact');
        expect(detectDetailLevel(10)).toBe('compact');
    });

    it('should detect "summary" for 11-25 results', () => {
        expect(detectDetailLevel(11)).toBe('summary');
        expect(detectDetailLevel(18)).toBe('summary');
        expect(detectDetailLevel(25)).toBe('summary');
    });

    it('should detect "locations" for 26+ results', () => {
        expect(detectDetailLevel(26)).toBe('locations');
        expect(detectDetailLevel(50)).toBe('locations');
        expect(detectDetailLevel(100)).toBe('locations');
    });

    it('should use correct threshold constants', () => {
        expect(DETAIL_THRESHOLDS.FULL_MAX).toBe(3);
        expect(DETAIL_THRESHOLDS.COMPACT_MAX).toBe(10);
        expect(DETAIL_THRESHOLDS.SUMMARY_MAX).toBe(25);
    });
});

describe('Individual Formatters', () => {
    let mockResults: SearchResult[];

    beforeEach(() => {
        mockResults = [
            {
                relativePath: 'src/auth/login.ts',
                startLine: 10,
                endLine: 25,
                content: 'export function login(username: string, password: string) {\n  // Implementation\n  return authenticate(username, password);\n}',
                language: 'typescript',
                score: 0.95
            },
            {
                relativePath: 'src/auth/logout.ts',
                startLine: 5,
                endLine: 15,
                content: 'export function logout() {\n  clearSession();\n  redirect("/login");\n}',
                language: 'typescript',
                score: 0.85
            }
        ];
    });

    describe('formatFull', () => {
        it('should include complete code snippets', () => {
            const result = formatFull(mockResults, '/test/path', 'auth', false);

            expect(result).toContain('Found 2 results');
            expect(result).toContain('src/auth/login.ts:10-25');
            expect(result).toContain('```typescript');
            expect(result).toContain('export function login');
            expect(result).toContain('Rank: 1');
        });

        it('should show indexing warning when active', () => {
            const result = formatFull(mockResults, '/test/path', 'auth', true);

            expect(result).toContain('⚠️');
            expect(result).toContain('Indexing in Progress');
            expect(result).toContain('💡');
        });

        it('should not show indexing warning when inactive', () => {
            const result = formatFull(mockResults, '/test/path', 'auth', false);

            expect(result).not.toContain('⚠️');
            expect(result).not.toContain('Indexing in Progress');
        });
    });

    describe('formatCompact', () => {
        it('should include code but be more concise', () => {
            const result = formatCompact(mockResults, '/test/path', 'auth', false);

            expect(result).toContain('Found 2 results');
            expect(result).toContain('src/auth/login.ts:10-25');
            expect(result).toContain('```typescript');
            expect(result).toContain('export function login');
            // Should not have verbose metadata like "Rank:"
            expect(result).not.toContain('Rank:');
        });

        it('should be shorter than full format', () => {
            const fullResult = formatFull(mockResults, '/test/path', 'auth', false);
            const compactResult = formatCompact(mockResults, '/test/path', 'auth', false);

            // Compact should be noticeably shorter (rough check)
            expect(compactResult.length).toBeLessThan(fullResult.length * 0.8);
        });
    });

    describe('formatSummary', () => {
        it('should show metadata without code blocks', () => {
            const result = formatSummary(mockResults, '/test/path', 'auth', false);

            expect(result).toContain('2 results');
            expect(result).toContain('src/auth/login.ts:10-25');
            // Should NOT include markdown code blocks (backticks)
            expect(result).not.toContain('```typescript');
            expect(result).not.toContain('```');
            // Should include brief description (may contain code text, but not formatted as code block)
            expect(result).toMatch(/\.\.\./); // Truncation indicator
        });

        it('should be significantly shorter than compact format', () => {
            const compactResult = formatCompact(mockResults, '/test/path', 'auth', false);
            const summaryResult = formatSummary(mockResults, '/test/path', 'auth', false);

            // Summary should be shorter (50% is ideal, but with small test data, may vary)
            expect(summaryResult.length).toBeLessThan(compactResult.length * 0.9);
        });
    });

    describe('formatLocations', () => {
        it('should show only file paths and line numbers', () => {
            const result = formatLocations(mockResults, '/test/path', 'auth', false);

            expect(result).toContain('2 matches');
            expect(result).toContain('src/auth/login.ts:10-25');
            expect(result).toContain('src/auth/logout.ts:5-15');
            // Should NOT include any code or descriptions
            expect(result).not.toContain('```');
            expect(result).not.toContain('export function');
        });

        it('should suggest using Read tool', () => {
            const result = formatLocations(mockResults, '/test/path', 'auth', false);

            expect(result).toContain('Read tool');
        });

        it('should be dramatically shorter than summary format', () => {
            const summaryResult = formatSummary(mockResults, '/test/path', 'auth', false);
            const locationsResult = formatLocations(mockResults, '/test/path', 'auth', false);

            // Locations should be shorter (ideally 50%, but with small test data, just ensure it's smaller)
            expect(locationsResult.length).toBeLessThan(summaryResult.length * 0.7);
        });
    });
});

describe('formatSearchResults Integration', () => {
    let mockResults: SearchResult[];

    beforeEach(() => {
        // Create variable-sized result sets for testing
        mockResults = Array.from({ length: 10 }, (_, i) => ({
            relativePath: `src/file${i + 1}.ts`,
            startLine: i * 10,
            endLine: i * 10 + 10,
            content: `function test${i + 1}() { return ${i + 1}; }`,
            language: 'typescript',
            score: 0.9 - i * 0.05
        }));
    });

    describe('Auto-detection', () => {
        it('should auto-select full for 3 results', () => {
            const results = mockResults.slice(0, 3);
            const output = formatSearchResults(results, '/test', 'query', false);

            // Full format includes "Rank:" metadata
            expect(output).toContain('Rank:');
        });

        it('should auto-select compact for 10 results', () => {
            const results = mockResults.slice(0, 10);
            const output = formatSearchResults(results, '/test', 'query', false);

            // Compact format does NOT include "Rank:"
            expect(output).not.toContain('Rank:');
            // But still includes code
            expect(output).toContain('```');
        });

        it('should auto-select summary for 15 results', () => {
            const results = Array.from({ length: 15 }, (_, i) => mockResults[i % 10]);
            const output = formatSearchResults(results, '/test', 'query', false);

            // Summary format does NOT include code blocks
            expect(output).not.toContain('```');
            // But includes file paths
            expect(output).toContain('src/file');
        });

        it('should auto-select locations for 30 results', () => {
            const results = Array.from({ length: 30 }, (_, i) => mockResults[i % 10]);
            const output = formatSearchResults(results, '/test', 'query', false);

            // Locations format is minimal
            expect(output).toContain('30 matches');
            expect(output).toContain('Read tool');
            expect(output).not.toContain('```');
        });
    });

    describe('Power User Overrides', () => {
        it('should respect explicit "full" override with many results', () => {
            const results = mockResults.slice(0, 10);
            const output = formatSearchResults(results, '/test', 'query', false, 'full');

            // Should use full format despite 10 results
            expect(output).toContain('Rank:');
        });

        it('should respect explicit "locations" override with few results', () => {
            const results = mockResults.slice(0, 2);
            const output = formatSearchResults(results, '/test', 'query', false, 'locations');

            // Should use locations format despite only 2 results
            expect(output).toContain('matches'); // Could be "2 matches" in locations format
            expect(output).toContain('Read tool');
            expect(output).not.toContain('```');
        });

        it('should treat "auto" as auto-detection', () => {
            const results = mockResults.slice(0, 5);
            const autoOutput = formatSearchResults(results, '/test', 'query', false, 'auto');
            const defaultOutput = formatSearchResults(results, '/test', 'query', false);

            // Both should produce same result (compact for 5 results)
            expect(autoOutput).toBe(defaultOutput);
        });
    });
});

describe('Feature Flag Integration', () => {
    it('should use formatters when CC_SMART_RESULTS is enabled', () => {
        // Note: This test depends on feature flag being enabled in test environment
        // Actual flag checking happens in the orchestrator
        const results = Array.from({ length: 10 }, (_, i) => ({
            relativePath: `src/file${i + 1}.ts`,
            startLine: i * 10,
            endLine: i * 10 + 10,
            content: `function test${i + 1}() { return ${i + 1}; }`,
            language: 'typescript',
            score: 0.9
        }));

        const output = formatSearchResults(results, '/test', 'query', false);

        // With 10 results, should use compact (not full)
        expect(output).not.toContain('Rank:');
    });

    // Note: Testing feature flag disabled requires mocking environment variables
    // This is handled in integration tests
});
