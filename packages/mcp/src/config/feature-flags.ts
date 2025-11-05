import { envManager } from "@zilliz/claude-context-core";

/**
 * Feature flags for token efficiency enhancements (v0.5.0)
 *
 * These flags control optional token optimization features that can be disabled
 * if they cause issues or confusion for agents. All flags default to OFF (false)
 * to ensure backward compatibility and opt-in behavior.
 *
 * Environment Variables:
 * - CC_SMART_RESULTS: Enable smart adaptive search results (Story 1)
 * - CC_ALLOW_EXPERIMENTAL: Enable experimental features (global override)
 *
 * All flags default to false (disabled) for maximum safety.
 */

/**
 * Parse boolean environment variable with safe defaults.
 * Accepts: "true", "1", "yes" (case-insensitive) as true values.
 * Everything else (including undefined) is treated as false.
 *
 * @param envVar Environment variable name (e.g., 'CC_SMART_RESULTS')
 * @param defaultValue Default value if env var not set (typically false)
 * @returns Parsed boolean value
 */
function parseFlag(envVar: string, defaultValue: boolean): boolean {
    const value = envManager.get(envVar);
    if (value === undefined || value === null) {
        return defaultValue;
    }
    const normalized = value.toLowerCase().trim();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

/**
 * Feature flags configuration.
 * All flags default to false (disabled) for backward compatibility.
 */
export const FEATURE_FLAGS = {
    /**
     * Story 1: Smart Adaptive Search Results
     *
     * When enabled, search_code automatically adapts output format based on result count:
     * - 1-3 results: full detail (0% savings)
     * - 4-10 results: compact mode (50% token savings)
     * - 11-25 results: summary mode (75% token savings)
     * - 26+ results: locations only (90% token savings)
     *
     * When disabled: Always returns full detail (legacy behavior).
     *
     * Environment: CC_SMART_RESULTS=true
     * Default: false (disabled, opt-in)
     * Fallback: Silent (returns full mode, no errors)
     */
    SMART_RESULTS: parseFlag('CC_SMART_RESULTS', false),

    /**
     * Global experimental features flag.
     *
     * When enabled, allows all experimental token efficiency features.
     * When disabled, all features use safe defaults.
     *
     * Environment: CC_ALLOW_EXPERIMENTAL=true
     * Default: false (disabled, opt-in)
     */
    ALLOW_EXPERIMENTAL: parseFlag('CC_ALLOW_EXPERIMENTAL', false),
} as const;

/**
 * Check if a specific feature is enabled.
 *
 * @param featureName Name of the feature flag
 * @returns true if feature is enabled, false otherwise
 */
export function isFeatureEnabled(featureName: keyof typeof FEATURE_FLAGS): boolean {
    return FEATURE_FLAGS[featureName] === true;
}

/**
 * Get all feature flags as a plain object (for logging/debugging).
 *
 * @returns Object with all feature flag names and values
 */
export function getAllFeatureFlags(): Record<string, boolean> {
    return { ...FEATURE_FLAGS };
}

/**
 * Get feature flags status summary for health checks.
 *
 * @returns Human-readable string describing feature flag status
 */
export function getFeatureFlagsSummary(): string {
    const flags = Object.entries(FEATURE_FLAGS)
        .map(([key, value]) => `${key}: ${value ? '✓ enabled' : '✗ disabled'}`)
        .join(', ');
    return `Feature Flags: ${flags}`;
}
