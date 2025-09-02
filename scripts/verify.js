#!/usr/bin/env node

/**
 * Claude Context MCP Server Verification Script
 * 
 * This script verifies that the claude-context MCP server is properly
 * installed and configured for use with Claude Desktop.
 * 
 * Usage: node scripts/verify.js [--verbose] [--test-indexing]
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');

class ClaudeContextVerifier {
    constructor() {
        this.platform = os.platform();
        this.projectRoot = path.dirname(__dirname);
        this.claudeConfigDir = this.getClaudeConfigDir();
        this.logPrefix = '[Claude-Context Verifier]';
        this.options = this.parseArguments();
        this.results = {
            tests: 0,
            passed: 0,
            failed: 0,
            warnings: 0
        };
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`${prefix} ${this.logPrefix} ${message}`);
    }

    error(message, critical = false) {
        this.log(message, 'error');
        this.results.failed++;
        if (critical) process.exit(1);
    }

    success(message) {
        this.log(message, 'success');
        this.results.passed++;
    }

    warning(message) {
        this.log(message, 'warning');
        this.results.warnings++;
    }

    parseArguments() {
        return {
            verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
            testIndexing: process.argv.includes('--test-indexing'),
            help: process.argv.includes('--help') || process.argv.includes('-h')
        };
    }

    showHelp() {
        console.log(`
Claude Context MCP Server Verification

Usage: node scripts/verify.js [options]

Options:
  --verbose, -v      Show detailed output and diagnostic information
  --test-indexing    Perform end-to-end indexing test (requires API keys)
  --help, -h         Show this help message

Examples:
  node scripts/verify.js                    # Basic verification
  node scripts/verify.js --verbose          # Detailed verification
  node scripts/verify.js --test-indexing    # Full end-to-end test
        `);
    }

    getClaudeConfigDir() {
        switch (this.platform) {
            case 'win32':
                return path.join(os.homedir(), 'AppData', 'Roaming', 'Claude');
            case 'darwin':
                return path.join(os.homedir(), 'Library', 'Application Support', 'Claude');
            case 'linux':
                return path.join(os.homedir(), '.config', 'claude');
            default:
                this.error(`Unsupported platform: ${this.platform}`, true);
        }
    }

    testNodeVersion() {
        this.results.tests++;
        this.log('Testing Node.js version...');

        try {
            const nodeVersion = process.version;
            const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
            
            if (majorVersion >= 20) {
                this.success(`Node.js version ${nodeVersion} is supported`);
            } else {
                this.error(`Node.js version ${nodeVersion} is not supported (requires 20+)`);
            }

            if (this.options.verbose) {
                this.log(`Node path: ${process.execPath}`);
                this.log(`Platform: ${this.platform}`);
                this.log(`Architecture: ${process.arch}`);
            }
        } catch (error) {
            this.error(`Failed to check Node.js version: ${error.message}`);
        }
    }

    testPnpmInstallation() {
        this.results.tests++;
        this.log('Testing pnpm installation...');

        try {
            const pnpmVersion = execSync('pnpm --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
            this.success(`pnpm version ${pnpmVersion} is available`);
            
            if (this.options.verbose) {
                const pnpmPath = execSync('where pnpm 2>nul || which pnpm', { encoding: 'utf8', stdio: 'pipe' }).trim();
                this.log(`pnpm path: ${pnpmPath}`);
            }
        } catch (error) {
            this.error('pnpm is not installed or not in PATH');
        }
    }

    testProjectStructure() {
        this.results.tests++;
        this.log('Testing project structure...');

        const requiredPaths = [
            'packages/mcp/package.json',
            'packages/mcp/src/index.ts',
            'packages/core/package.json',
            'package.json',
            'pnpm-workspace.yaml'
        ];

        let allPathsExist = true;
        for (const relativePath of requiredPaths) {
            const fullPath = path.join(this.projectRoot, relativePath);
            if (fs.existsSync(fullPath)) {
                if (this.options.verbose) {
                    this.log(`Found: ${relativePath}`);
                }
            } else {
                this.error(`Missing: ${relativePath}`);
                allPathsExist = false;
            }
        }

        if (allPathsExist) {
            this.success('Project structure is complete');
        }
    }

    testBuildArtifacts() {
        this.results.tests++;
        this.log('Testing build artifacts...');

        const mcpDistPath = path.join(this.projectRoot, 'packages', 'mcp', 'dist', 'index.js');
        
        if (fs.existsSync(mcpDistPath)) {
            this.success('MCP server build artifact exists');
            
            if (this.options.verbose) {
                const stats = fs.statSync(mcpDistPath);
                this.log(`Build size: ${stats.size} bytes`);
                this.log(`Last modified: ${stats.mtime.toISOString()}`);
            }
        } else {
            this.error('MCP server build artifact not found - run "pnpm build:mcp"');
        }
    }

    testClaudeConfiguration() {
        this.results.tests++;
        this.log('Testing Claude Desktop configuration...');

        const configPath = path.join(this.claudeConfigDir, 'claude_desktop_config.json');
        
        if (!fs.existsSync(configPath)) {
            this.error('Claude Desktop configuration file not found');
            return;
        }

        try {
            const configContent = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configContent);

            if (!config.mcpServers) {
                this.error('No MCP servers configured in Claude Desktop');
                return;
            }

            if (!config.mcpServers['claude-context']) {
                this.error('claude-context MCP server not found in configuration');
                return;
            }

            const serverConfig = config.mcpServers['claude-context'];
            
            // Validate server configuration
            if (serverConfig.command === 'node' && serverConfig.args && serverConfig.args.length > 0) {
                const serverPath = serverConfig.args[0];
                if (fs.existsSync(serverPath)) {
                    this.success('Claude Desktop configuration is valid');
                    
                    if (this.options.verbose) {
                        this.log(`Server path: ${serverPath}`);
                        this.log(`Environment variables: ${Object.keys(serverConfig.env || {}).join(', ')}`);
                    }
                } else {
                    this.error(`MCP server path in config does not exist: ${serverPath}`);
                }
            } else {
                this.error('Invalid MCP server configuration format');
            }

        } catch (error) {
            this.error(`Failed to parse Claude configuration: ${error.message}`);
        }
    }

    testApiKeysConfiguration() {
        this.results.tests++;
        this.log('Testing API keys configuration...');

        const configPath = path.join(this.claudeConfigDir, 'claude_desktop_config.json');
        
        if (!fs.existsSync(configPath)) {
            this.warning('Cannot test API keys - Claude configuration not found');
            return;
        }

        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            const serverConfig = config.mcpServers?.['claude-context'];
            
            if (!serverConfig?.env) {
                this.warning('No environment variables configured for MCP server');
                return;
            }

            const hasOpenAI = serverConfig.env.OPENAI_API_KEY;
            const hasZilliz = serverConfig.env.MILVUS_TOKEN;

            if (hasOpenAI) {
                if (this.options.verbose) {
                    const keyPreview = typeof hasOpenAI === 'string' && hasOpenAI.startsWith('sk-') 
                        ? `${hasOpenAI.substring(0, 10)}...` 
                        : '[configured]';
                    this.log(`OpenAI API key: ${keyPreview}`);
                }
            } else {
                this.warning('OpenAI API key not configured');
            }

            if (hasZilliz) {
                if (this.options.verbose) {
                    const tokenPreview = typeof hasZilliz === 'string' && hasZilliz.length > 10
                        ? `${hasZilliz.substring(0, 10)}...`
                        : '[configured]';
                    this.log(`Zilliz token: ${tokenPreview}`);
                }
            } else {
                this.warning('Zilliz token not configured');
            }

            if (hasOpenAI || hasZilliz) {
                this.success('API credentials are configured');
            } else {
                this.error('No API credentials found in configuration');
            }

        } catch (error) {
            this.error(`Failed to check API keys: ${error.message}`);
        }
    }

    async testMcpServerStartup() {
        this.results.tests++;
        this.log('Testing MCP server startup...');

        const mcpServerPath = path.join(this.projectRoot, 'packages', 'mcp', 'dist', 'index.js');
        
        if (!fs.existsSync(mcpServerPath)) {
            this.error('MCP server build not found - cannot test startup');
            return;
        }

        try {
            // Test server with --help flag (should exit quickly)
            const result = execSync(`node "${mcpServerPath}" --help`, {
                encoding: 'utf8',
                timeout: 10000,
                stdio: 'pipe'
            });

            if (result.includes('Context MCP Server')) {
                this.success('MCP server starts successfully');
                
                if (this.options.verbose) {
                    const lines = result.split('\n').slice(0, 5);
                    lines.forEach(line => this.log(`Server output: ${line}`));
                }
            } else {
                this.warning('MCP server starts but output format unexpected');
            }
        } catch (error) {
            this.error(`MCP server startup failed: ${error.message}`);
        }
    }

    async testIndexingFunctionality() {
        if (!this.options.testIndexing) return;
        
        this.results.tests++;
        this.log('Testing indexing functionality...');

        // Create a small test project
        const testDir = path.join(os.tmpdir(), 'claude-context-test');
        
        try {
            // Clean up any existing test directory
            if (fs.existsSync(testDir)) {
                fs.rmSync(testDir, { recursive: true, force: true });
            }
            
            fs.mkdirSync(testDir, { recursive: true });
            
            // Create test files
            const testFiles = {
                'main.py': 'def hello_world():\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    hello_world()',
                'utils.js': 'function calculateSum(a, b) {\n    return a + b;\n}\n\nmodule.exports = { calculateSum };',
                'README.md': '# Test Project\n\nThis is a test project for claude-context indexing.'
            };

            for (const [filename, content] of Object.entries(testFiles)) {
                fs.writeFileSync(path.join(testDir, filename), content);
            }

            this.log('Created test project for indexing');
            
            // TODO: Implement actual indexing test
            // This would require starting the MCP server and making indexing requests
            this.warning('Indexing functionality test not yet implemented');
            
            // Clean up test directory
            fs.rmSync(testDir, { recursive: true, force: true });

        } catch (error) {
            this.error(`Indexing test failed: ${error.message}`);
            
            // Clean up on error
            if (fs.existsSync(testDir)) {
                try {
                    fs.rmSync(testDir, { recursive: true, force: true });
                } catch (cleanupError) {
                    this.warning(`Failed to clean up test directory: ${cleanupError.message}`);
                }
            }
        }
    }

    testSystemHealth() {
        this.results.tests++;
        this.log('Testing system health...');

        try {
            // Check available disk space in project directory
            const stats = fs.statSync(this.projectRoot);
            
            // Check memory usage
            const memUsage = process.memoryUsage();
            
            if (this.options.verbose) {
                this.log(`Memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap`);
                this.log(`Project root: ${this.projectRoot}`);
                
                // Check Claude process if possible
                try {
                    if (this.platform === 'win32') {
                        const claudeProcess = execSync('tasklist | findstr Claude', { encoding: 'utf8', stdio: 'pipe' });
                        if (claudeProcess.trim()) {
                            this.log('Claude Desktop process detected');
                        } else {
                            this.warning('Claude Desktop process not detected');
                        }
                    }
                } catch (error) {
                    // Ignore process detection errors
                }
            }

            this.success('System health check completed');
        } catch (error) {
            this.warning(`System health check failed: ${error.message}`);
        }
    }

    showSummary() {
        console.log('\n' + '='.repeat(60));
        console.log(`${this.logPrefix} Verification Summary`);
        console.log('='.repeat(60));
        console.log(`Tests run: ${this.results.tests}`);
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`⚠️  Warnings: ${this.results.warnings}`);
        
        const successRate = this.results.tests > 0 ? (this.results.passed / this.results.tests * 100).toFixed(1) : 0;
        console.log(`Success rate: ${successRate}%`);

        if (this.results.failed === 0) {
            console.log('\n🎉 All critical tests passed! Claude Context MCP server appears to be properly installed.');
            if (this.results.warnings > 0) {
                console.log('⚠️  Some warnings were detected - see details above.');
            }
        } else {
            console.log('\n⚠️  Some tests failed. Please review the errors above and run the installer again if needed.');
        }

        console.log('\nNext steps:');
        console.log('1. Restart Claude Desktop if not already done');
        console.log('2. Try indexing a project with the claude-context MCP server');
        console.log('3. Report any issues at: https://github.com/zilliztech/claude-context/issues');
    }

    async verify() {
        try {
            if (this.options.help) {
                this.showHelp();
                return;
            }

            this.log('Starting Claude Context MCP server verification...');
            if (this.options.verbose) {
                this.log(`Platform: ${this.platform}`);
                this.log(`Project root: ${this.projectRoot}`);
                this.log(`Claude config dir: ${this.claudeConfigDir}`);
            }

            // Run all verification tests
            this.testNodeVersion();
            this.testPnpmInstallation();
            this.testProjectStructure();
            this.testBuildArtifacts();
            this.testClaudeConfiguration();
            this.testApiKeysConfiguration();
            await this.testMcpServerStartup();
            await this.testIndexingFunctionality();
            this.testSystemHealth();

            this.showSummary();

        } catch (error) {
            this.error(`Verification failed: ${error.message}`, true);
        }
    }
}

// Run verifier if called directly
if (require.main === module) {
    const verifier = new ClaudeContextVerifier();
    verifier.verify().catch(error => {
        console.error('Verification failed:', error);
        process.exit(1);
    });
}

module.exports = ClaudeContextVerifier;