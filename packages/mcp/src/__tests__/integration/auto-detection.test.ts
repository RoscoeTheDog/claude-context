/**
 * Integration tests for Auto-Detection Logic (Story 1)
 *
 * Tests cover:
 * - Threshold boundary testing (3, 10, 25, 26 results)
 * - Auto-detection accuracy
 * - Performance of auto-detection logic
 * - Consistency across different queries
 */

import { describe, it, expect } from 'vitest';
import {
    formatSearchResults,
    detectDetailLevel,
    DETAIL_THRESHOLDS,
    type SearchResult,
    type DetailLevel
} from '../../formatters/index.js';

/**
 * Helper to create mock results
 */
function createResults(count: number): SearchResult[] {
    return Array.from({ length: count }, (_, i) => ({
        relativePath: `src/file${i + 1}.ts`,
        startLine: i * 10,
        endLine: i * 10 + 20,
        content: `export function func${i + 1}() {\n  // Implementation ${i + 1}\n  return ${i + 1};\n}`,
        language: 'typescript',
        score: 0.9 - i * 0.01
    }));
}

/**
 * Helper to detect mode from output (for validation)
 */
function detectModeFromOutput(output: string): DetailLevel {
    if (output.includes('Rank:')) return 'full';
    if (output.includes('```') && !output.includes('Rank:')) return 'compact';
    if (output.includes('matches') && output.includes('Read tool')) return 'locations';
    if (!output.includes('```')) return 'summary';
    return 'full'; // fallback
}

describe('Auto-Detection Threshold Boundaries', () => {
    describe('Full Mode Thresholds (1-3 results)', () => {
        it('should detect full for exactly 1 result', () => {
            const level = detectDetailLevel(1);
            expect(level).toBe('full');
        });

        it('should detect full for exactly 2 results', () => {
            const level = detectDetailLevel(2);
            expect(level).toBe('full');
        });

        it('should detect full for exactly 3 results (boundary)', () => {
            const level = detectDetailLevel(3);
            expect(level).toBe('full');
        });

        it('should validate full mode output for 3 results', () => {
            const results = createResults(3);
            const output = formatSearchResults(results, '/test', 'query', false);

            expect(detectModeFromOutput(output)).toBe('full');
            expect(output).toContain('Rank:');
            expect(output).toContain('```typescript');
        });
    });

    describe('Compact Mode Thresholds (4-10 results)', () => {
        it('should detect compact for exactly 4 results (lower boundary)', () => {
            const level = detectDetailLevel(4);
            expect(level).toBe('compact');
        });

        it('should detect compact for 7 results (mid-range)', () => {
            const level = detectDetailLevel(7);
            expect(level).toBe('compact');
        });

        it('should detect compact for exactly 10 results (upper boundary)', () => {
            const level = detectDetailLevel(10);
            expect(level).toBe('compact');
        });

        it('should validate compact mode output for 4 results', () => {
            const results = createResults(4);
            const output = formatSearchResults(results, '/test', 'query', false);

            expect(detectModeFromOutput(output)).toBe('compact');
            expect(output).not.toContain('Rank:');
            expect(output).toContain('```typescript');
        });

        it('should validate compact mode output for 10 results', () => {
            const results = createResults(10);
            const output = formatSearchResults(results, '/test', 'query', false);

            expect(detectModeFromOutput(output)).toBe('compact');
            expect(output).toContain('Found 10 results');
        });
    });

    describe('Summary Mode Thresholds (11-25 results)', () => {
        it('should detect summary for exactly 11 results (lower boundary)', () => {
            const level = detectDetailLevel(11);
            expect(level).toBe('summary');
        });

        it('should detect summary for 18 results (mid-range)', () => {
            const level = detectDetailLevel(18);
            expect(level).toBe('summary');
        });

        it('should detect summary for exactly 25 results (upper boundary)', () => {
            const level = detectDetailLevel(25);
            expect(level).toBe('summary');
        });

        it('should validate summary mode output for 11 results', () => {
            const results = createResults(11);
            const output = formatSearchResults(results, '/test', 'query', false);

            expect(detectModeFromOutput(output)).toBe('summary');
            expect(output).not.toContain('```');
            expect(output).toContain('11 results');
        });

        it('should validate summary mode output for 25 results', () => {
            const results = createResults(25);
            const output = formatSearchResults(results, '/test', 'query', false);

            expect(detectModeFromOutput(output)).toBe('summary');
            expect(output).toContain('25 results');
        });
    });

    describe('Locations Mode Thresholds (26+ results)', () => {
        it('should detect locations for exactly 26 results (lower boundary)', () => {
            const level = detectDetailLevel(26);
            expect(level).toBe('locations');
        });

        it('should detect locations for 50 results', () => {
            const level = detectDetailLevel(50);
            expect(level).toBe('locations');
        });

        it('should detect locations for 100 results', () => {
            const level = detectDetailLevel(100);
            expect(level).toBe('locations');
        });

        it('should validate locations mode output for 26 results', () => {
            const results = createResults(26);
            const output = formatSearchResults(results, '/test', 'query', false);

            expect(detectModeFromOutput(output)).toBe('locations');
            expect(output).toContain('26 matches');
            expect(output).toContain('Read tool');
        });

        it('should validate locations mode output for 100 results', () => {
            const results = createResults(100);
            const output = formatSearchResults(results, '/test', 'query', false);

            expect(detectModeFromOutput(output)).toBe('locations');
            expect(output).toContain('100 matches');
        });
    });
});

describe('Auto-Detection Accuracy', () => {
    it('should consistently detect correct mode for same result count', () => {
        // Run detection multiple times to ensure consistency
        const counts = [2, 5, 15, 30];
        const expectedModes: DetailLevel[] = ['full', 'compact', 'summary', 'locations'];

        counts.forEach((count, i) => {
            // Run detection 10 times
            for (let j = 0; j < 10; j++) {
                const level = detectDetailLevel(count);
                expect(level).toBe(expectedModes[i]);
            }
        });
    });

    it('should detect correct mode for all counts from 1 to 50', () => {
        for (let count = 1; count <= 50; count++) {
            const level = detectDetailLevel(count);

            if (count <= 3) {
                expect(level).toBe('full');
            } else if (count <= 10) {
                expect(level).toBe('compact');
            } else if (count <= 25) {
                expect(level).toBe('summary');
            } else {
                expect(level).toBe('locations');
            }
        }
    });

    it('should match format output to detected level', () => {
        const testCases = [
            { count: 2, expected: 'full' },
            { count: 7, expected: 'compact' },
            { count: 15, expected: 'summary' },
            { count: 30, expected: 'locations' }
        ];

        testCases.forEach(({ count, expected }) => {
            const results = createResults(count);
            const output = formatSearchResults(results, '/test', 'query', false);
            const detectedFromOutput = detectModeFromOutput(output);

            expect(detectedFromOutput).toBe(expected);
        });
    });
});

describe('Auto-Detection Performance', () => {
    it('should detect level quickly for small counts', () => {
        const start = performance.now();

        for (let i = 0; i < 1000; i++) {
            detectDetailLevel(5);
        }

        const elapsed = performance.now() - start;

        // Should complete 1000 detections in < 10ms (avg 0.01ms per detection)
        expect(elapsed).toBeLessThan(10);
    });

    it('should detect level quickly for large counts', () => {
        const start = performance.now();

        for (let i = 0; i < 1000; i++) {
            detectDetailLevel(1000);
        }

        const elapsed = performance.now() - start;

        // Should complete 1000 detections in < 10ms (same threshold)
        expect(elapsed).toBeLessThan(10);
    });

    it('should have O(1) complexity (constant time)', () => {
        const counts = [1, 10, 100, 1000, 10000];
        const timings: number[] = [];

        counts.forEach(count => {
            const iterations = 10000;
            const start = performance.now();

            for (let i = 0; i < iterations; i++) {
                detectDetailLevel(count);
            }

            const elapsed = performance.now() - start;
            timings.push(elapsed);
        });

        // All timings should be within same order of magnitude (O(1))
        const maxTiming = Math.max(...timings);
        const minTiming = Math.min(...timings);

        // Max should not be more than 5x min (relaxed to account for system variance)
        // The key insight is that all operations complete in milliseconds regardless of count
        expect(maxTiming).toBeLessThan(minTiming * 5);

        // Also verify all operations are fast (< 50ms for 10k iterations)
        timings.forEach(timing => {
            expect(timing).toBeLessThan(50);
        });
    });
});

describe('Threshold Configuration Validation', () => {
    it('should have correct threshold constants', () => {
        expect(DETAIL_THRESHOLDS.FULL_MAX).toBe(3);
        expect(DETAIL_THRESHOLDS.COMPACT_MAX).toBe(10);
        expect(DETAIL_THRESHOLDS.SUMMARY_MAX).toBe(25);
    });

    it('should have non-overlapping thresholds', () => {
        expect(DETAIL_THRESHOLDS.FULL_MAX).toBeLessThan(DETAIL_THRESHOLDS.COMPACT_MAX);
        expect(DETAIL_THRESHOLDS.COMPACT_MAX).toBeLessThan(DETAIL_THRESHOLDS.SUMMARY_MAX);
    });

    it('should have sensible threshold values', () => {
        // Thresholds should be positive
        expect(DETAIL_THRESHOLDS.FULL_MAX).toBeGreaterThan(0);
        expect(DETAIL_THRESHOLDS.COMPACT_MAX).toBeGreaterThan(0);
        expect(DETAIL_THRESHOLDS.SUMMARY_MAX).toBeGreaterThan(0);

        // Thresholds should be reasonable (< 1000)
        expect(DETAIL_THRESHOLDS.FULL_MAX).toBeLessThan(1000);
        expect(DETAIL_THRESHOLDS.COMPACT_MAX).toBeLessThan(1000);
        expect(DETAIL_THRESHOLDS.SUMMARY_MAX).toBeLessThan(1000);
    });
});

describe('Edge Cases and Boundary Conditions', () => {
    it('should handle zero results', () => {
        const level = detectDetailLevel(0);
        // Should not crash, return some sensible default
        expect(['full', 'compact', 'summary', 'locations']).toContain(level);
    });

    it('should handle negative counts gracefully', () => {
        // This shouldn't happen in practice, but test defensive coding
        const level = detectDetailLevel(-1);
        expect(['full', 'compact', 'summary', 'locations']).toContain(level);
    });

    it('should handle very large counts', () => {
        const level = detectDetailLevel(999999);
        expect(level).toBe('locations');
    });

    it('should handle fractional counts by rounding', () => {
        // JavaScript's type system should prevent this, but test robustness
        const level = detectDetailLevel(5.7 as any);
        expect(level).toBe('compact'); // 5.7 rounds to 5 or 6, both compact
    });
});

describe('Consistency Across Different Queries', () => {
    it('should produce same mode for same result count regardless of content', () => {
        const count = 8;

        // Create results with different content
        const results1 = createResults(count);
        const results2 = Array.from({ length: count }, (_, i) => ({
            relativePath: `different/path${i}.js`,
            startLine: 1,
            endLine: 100,
            content: 'x'.repeat(1000), // Very long content
            language: 'javascript',
            score: 0.5
        }));

        const output1 = formatSearchResults(results1, '/test1', 'query1', false);
        const output2 = formatSearchResults(results2, '/test2', 'query2', false);

        const mode1 = detectModeFromOutput(output1);
        const mode2 = detectModeFromOutput(output2);

        // Both should detect compact for 8 results
        expect(mode1).toBe('compact');
        expect(mode2).toBe('compact');
    });

    it('should produce same mode for same count with different file types', () => {
        const count = 12;

        const tsResults = Array.from({ length: count }, (_, i) => ({
            relativePath: `src/file${i}.ts`,
            startLine: 1,
            endLine: 10,
            content: 'TypeScript code',
            language: 'typescript',
            score: 0.9
        }));

        const pyResults = Array.from({ length: count }, (_, i) => ({
            relativePath: `src/file${i}.py`,
            startLine: 1,
            endLine: 10,
            content: 'Python code',
            language: 'python',
            score: 0.9
        }));

        const tsOutput = formatSearchResults(tsResults, '/test', 'query', false);
        const pyOutput = formatSearchResults(pyResults, '/test', 'query', false);

        // Both should detect summary for 12 results
        expect(detectModeFromOutput(tsOutput)).toBe('summary');
        expect(detectModeFromOutput(pyOutput)).toBe('summary');
    });
});

describe('Integration with Power User Overrides', () => {
    it('should bypass auto-detection when explicit detail provided', () => {
        const count = 10;
        const results = createResults(count);

        // Auto would choose compact, but force full
        const output = formatSearchResults(results, '/test', 'query', false, 'full');

        expect(detectModeFromOutput(output)).toBe('full');
        expect(output).toContain('Rank:');
    });

    it('should respect override even when it seems suboptimal', () => {
        const count = 2;
        const results = createResults(count);

        // Auto would choose full, but force locations
        const output = formatSearchResults(results, '/test', 'query', false, 'locations');

        expect(detectModeFromOutput(output)).toBe('locations');
        expect(output).toContain('matches');
    });

    it('should treat undefined detail as auto-detection', () => {
        const count = 7;

        const autoLevel = detectDetailLevel(count);
        const results = createResults(count);
        const output = formatSearchResults(results, '/test', 'query', false, undefined);

        expect(detectModeFromOutput(output)).toBe(autoLevel);
    });
});
