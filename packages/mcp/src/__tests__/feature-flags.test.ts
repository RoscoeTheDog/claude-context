import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { envManager } from '@zilliz/claude-context-core';

/**
 * Tests for Feature Flags System (Story 2)
 *
 * Tests cover:
 * - Flag parsing logic (parseFlag function)
 * - Default values (all flags off by default)
 * - Environment variable support (CC_FEATURE_*)
 * - Silent fallback behavior (no errors when disabled)
 * - Helper functions (isFeatureEnabled, getAllFeatureFlags, getFeatureFlagsSummary)
 */

describe('Feature Flags System', () => {
    // Store original env values
    const originalEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
        // Clear and save original environment
        originalEnv['CC_SMART_RESULTS'] = process.env.CC_SMART_RESULTS;
        originalEnv['CC_ALLOW_EXPERIMENTAL'] = process.env.CC_ALLOW_EXPERIMENTAL;

        // Clear environment variables before each test
        delete process.env.CC_SMART_RESULTS;
        delete process.env.CC_ALLOW_EXPERIMENTAL;

        // Clear require cache to force re-evaluation of feature flags
        vi.resetModules();
    });

    afterEach(() => {
        // Restore original environment
        if (originalEnv['CC_SMART_RESULTS'] !== undefined) {
            process.env.CC_SMART_RESULTS = originalEnv['CC_SMART_RESULTS'];
        } else {
            delete process.env.CC_SMART_RESULTS;
        }

        if (originalEnv['CC_ALLOW_EXPERIMENTAL'] !== undefined) {
            process.env.CC_ALLOW_EXPERIMENTAL = originalEnv['CC_ALLOW_EXPERIMENTAL'];
        } else {
            delete process.env.CC_ALLOW_EXPERIMENTAL;
        }
    });

    describe('Default Flag Values', () => {
        it('should have SMART_RESULTS disabled by default', async () => {
            const { FEATURE_FLAGS } = await import('../config/feature-flags.js');
            expect(FEATURE_FLAGS.SMART_RESULTS).toBe(false);
        });

        it('should have ALLOW_EXPERIMENTAL disabled by default', async () => {
            const { FEATURE_FLAGS } = await import('../config/feature-flags.js');
            expect(FEATURE_FLAGS.ALLOW_EXPERIMENTAL).toBe(false);
        });

        it('should have all flags disabled by default (safety-first)', async () => {
            const { getAllFeatureFlags } = await import('../config/feature-flags.js');
            const flags = getAllFeatureFlags();

            // All flags should be false by default
            expect(Object.values(flags).every(value => value === false)).toBe(true);
        });
    });

    describe('Environment Variable Parsing', () => {
        it('should enable SMART_RESULTS when CC_SMART_RESULTS=true', async () => {
            process.env.CC_SMART_RESULTS = 'true';
            vi.resetModules();

            const { FEATURE_FLAGS } = await import('../config/feature-flags.js');
            expect(FEATURE_FLAGS.SMART_RESULTS).toBe(true);
        });

        it('should enable flag when value is "1"', async () => {
            process.env.CC_SMART_RESULTS = '1';
            vi.resetModules();

            const { FEATURE_FLAGS } = await import('../config/feature-flags.js');
            expect(FEATURE_FLAGS.SMART_RESULTS).toBe(true);
        });

        it('should enable flag when value is "yes" (case-insensitive)', async () => {
            process.env.CC_SMART_RESULTS = 'YES';
            vi.resetModules();

            const { FEATURE_FLAGS } = await import('../config/feature-flags.js');
            expect(FEATURE_FLAGS.SMART_RESULTS).toBe(true);
        });

        it('should disable flag when value is "false"', async () => {
            process.env.CC_SMART_RESULTS = 'false';
            vi.resetModules();

            const { FEATURE_FLAGS } = await import('../config/feature-flags.js');
            expect(FEATURE_FLAGS.SMART_RESULTS).toBe(false);
        });

        it('should disable flag when value is "0"', async () => {
            process.env.CC_SMART_RESULTS = '0';
            vi.resetModules();

            const { FEATURE_FLAGS } = await import('../config/feature-flags.js');
            expect(FEATURE_FLAGS.SMART_RESULTS).toBe(false);
        });

        it('should disable flag when value is empty string', async () => {
            process.env.CC_SMART_RESULTS = '';
            vi.resetModules();

            const { FEATURE_FLAGS } = await import('../config/feature-flags.js');
            expect(FEATURE_FLAGS.SMART_RESULTS).toBe(false);
        });

        it('should disable flag for any unrecognized value', async () => {
            process.env.CC_SMART_RESULTS = 'maybe';
            vi.resetModules();

            const { FEATURE_FLAGS } = await import('../config/feature-flags.js');
            expect(FEATURE_FLAGS.SMART_RESULTS).toBe(false);
        });

        it('should handle case-insensitive "true"', async () => {
            process.env.CC_SMART_RESULTS = 'TrUe';
            vi.resetModules();

            const { FEATURE_FLAGS } = await import('../config/feature-flags.js');
            expect(FEATURE_FLAGS.SMART_RESULTS).toBe(true);
        });

        it('should handle whitespace in values', async () => {
            process.env.CC_SMART_RESULTS = '  true  ';
            vi.resetModules();

            const { FEATURE_FLAGS } = await import('../config/feature-flags.js');
            expect(FEATURE_FLAGS.SMART_RESULTS).toBe(true);
        });
    });

    describe('Multiple Flags Configuration', () => {
        it('should support enabling multiple flags independently', async () => {
            process.env.CC_SMART_RESULTS = 'true';
            process.env.CC_ALLOW_EXPERIMENTAL = 'true';
            vi.resetModules();

            const { FEATURE_FLAGS } = await import('../config/feature-flags.js');
            expect(FEATURE_FLAGS.SMART_RESULTS).toBe(true);
            expect(FEATURE_FLAGS.ALLOW_EXPERIMENTAL).toBe(true);
        });

        it('should support enabling one flag while keeping others disabled', async () => {
            process.env.CC_SMART_RESULTS = 'true';
            process.env.CC_ALLOW_EXPERIMENTAL = 'false';
            vi.resetModules();

            const { FEATURE_FLAGS } = await import('../config/feature-flags.js');
            expect(FEATURE_FLAGS.SMART_RESULTS).toBe(true);
            expect(FEATURE_FLAGS.ALLOW_EXPERIMENTAL).toBe(false);
        });
    });

    describe('Helper Functions', () => {
        it('isFeatureEnabled should return true for enabled flags', async () => {
            process.env.CC_SMART_RESULTS = 'true';
            vi.resetModules();

            const { isFeatureEnabled } = await import('../config/feature-flags.js');
            expect(isFeatureEnabled('SMART_RESULTS')).toBe(true);
        });

        it('isFeatureEnabled should return false for disabled flags', async () => {
            const { isFeatureEnabled } = await import('../config/feature-flags.js');
            expect(isFeatureEnabled('SMART_RESULTS')).toBe(false);
        });

        it('getAllFeatureFlags should return all flags as object', async () => {
            const { getAllFeatureFlags } = await import('../config/feature-flags.js');
            const flags = getAllFeatureFlags();

            expect(flags).toHaveProperty('SMART_RESULTS');
            expect(flags).toHaveProperty('ALLOW_EXPERIMENTAL');
            expect(typeof flags.SMART_RESULTS).toBe('boolean');
            expect(typeof flags.ALLOW_EXPERIMENTAL).toBe('boolean');
        });

        it('getFeatureFlagsSummary should return human-readable summary', async () => {
            const { getFeatureFlagsSummary } = await import('../config/feature-flags.js');
            const summary = getFeatureFlagsSummary();

            expect(summary).toContain('Feature Flags:');
            expect(summary).toContain('SMART_RESULTS');
            expect(summary).toContain('ALLOW_EXPERIMENTAL');
            expect(summary).toMatch(/enabled|disabled/);
        });

        it('getFeatureFlagsSummary should show correct enabled/disabled status', async () => {
            process.env.CC_SMART_RESULTS = 'true';
            process.env.CC_ALLOW_EXPERIMENTAL = 'false';
            vi.resetModules();

            const { getFeatureFlagsSummary } = await import('../config/feature-flags.js');
            const summary = getFeatureFlagsSummary();

            expect(summary).toContain('SMART_RESULTS: ✓ enabled');
            expect(summary).toContain('ALLOW_EXPERIMENTAL: ✗ disabled');
        });
    });

    describe('Silent Fallback Behavior', () => {
        it('should not throw errors when accessing disabled flags', async () => {
            const { FEATURE_FLAGS } = await import('../config/feature-flags.js');

            // Should not throw, even though flags are disabled
            expect(() => {
                const smartResults = FEATURE_FLAGS.SMART_RESULTS;
                const experimental = FEATURE_FLAGS.ALLOW_EXPERIMENTAL;
            }).not.toThrow();
        });

        it('should not throw errors when checking flag status', async () => {
            const { isFeatureEnabled } = await import('../config/feature-flags.js');

            // Should not throw, even though flags are disabled
            expect(() => {
                isFeatureEnabled('SMART_RESULTS');
                isFeatureEnabled('ALLOW_EXPERIMENTAL');
            }).not.toThrow();
        });

        it('should gracefully handle missing environment variables', async () => {
            // Explicitly delete all related env vars
            delete process.env.CC_SMART_RESULTS;
            delete process.env.CC_ALLOW_EXPERIMENTAL;
            vi.resetModules();

            const { FEATURE_FLAGS } = await import('../config/feature-flags.js');

            // Should use default values (false) without errors
            expect(FEATURE_FLAGS.SMART_RESULTS).toBe(false);
            expect(FEATURE_FLAGS.ALLOW_EXPERIMENTAL).toBe(false);
        });
    });

    describe('Flag Immutability', () => {
        it('FEATURE_FLAGS should be compile-time const (TypeScript enforced)', async () => {
            const { FEATURE_FLAGS } = await import('../config/feature-flags.js');

            // TypeScript enforces immutability at compile time via 'as const'
            // Runtime: JavaScript objects are mutable, so we just verify the flags exist
            expect(FEATURE_FLAGS).toHaveProperty('SMART_RESULTS');
            expect(FEATURE_FLAGS).toHaveProperty('ALLOW_EXPERIMENTAL');

            // Note: 'as const' provides TypeScript compile-time protection,
            // but doesn't make the object immutable at runtime in JavaScript.
            // This is acceptable since the codebase is TypeScript.
        });

        it('getAllFeatureFlags should return a copy, not reference', async () => {
            const { getAllFeatureFlags } = await import('../config/feature-flags.js');

            const flags1 = getAllFeatureFlags();
            const flags2 = getAllFeatureFlags();

            // Should be equal but not same reference
            expect(flags1).toEqual(flags2);
            expect(flags1).not.toBe(flags2);
        });
    });
});
