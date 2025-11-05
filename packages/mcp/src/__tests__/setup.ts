/**
 * Vitest setup file
 * Runs before all tests to configure environment
 */

// Enable feature flags for testing
process.env.CC_SMART_RESULTS = 'true';
process.env.CC_ALLOW_EXPERIMENTAL = 'true';

console.log('[TEST-SETUP] Feature flags enabled for testing');
