#!/usr/bin/env node

/**
 * Claude Context MCP Server Installation Script
 * 
 * This script automatically installs and configures the claude-context MCP server
 * for use with Claude Desktop. It handles cross-platform installation, dependency
 * checking, and configuration setup.
 * 
 * Usage: node scripts/install.js [--config=path/to/config.json]
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');

class ClaudeContextInstaller {
    constructor() {
        this.platform = os.platform();
        this.projectRoot = path.dirname(__dirname);
        this.config = null;
        this.claudeConfigDir = this.getClaudeConfigDir();
        this.logPrefix = '[Claude-Context Installer]';
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
        console.log(`${prefix} ${this.logPrefix} ${message}`);
    }

    error(message, exit = true) {
        this.log(message, 'error');
        if (exit) process.exit(1);
    }

    success(message) {
        this.log(message, 'success');
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
                this.error(`Unsupported platform: ${this.platform}`);
        }
    }

    loadConfig() {
        const configArg = process.argv.find(arg => arg.startsWith('--config='));
        const configPath = configArg 
            ? configArg.split('=')[1]
            : path.join(this.projectRoot, 'scripts', 'install-config.json');

        if (!fs.existsSync(configPath)) {
            this.error(`Configuration file not found: ${configPath}`);
        }

        try {
            this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            this.log(`Loaded configuration from: ${configPath}`);
        } catch (error) {
            this.error(`Failed to parse configuration file: ${error.message}`);
        }
    }

    async validateApiKeys() {
        this.log('Validating API keys...');
        
        const apiKeys = this.getApiKeys();
        
        // Validate OpenAI API key if specified
        if (apiKeys.openai) {
            await this.validateOpenAIKey(apiKeys.openai);
        }

        // Validate Zilliz/Milvus token if specified
        if (apiKeys.zilliz) {
            await this.validateZillizToken(apiKeys.zilliz);
        }

        // Check if at least one valid API configuration exists
        if (!apiKeys.openai && !apiKeys.zilliz) {
            this.error('No valid API keys found. Please configure at least OpenAI and Zilliz credentials.');
        }

        this.success('API key validation completed');
    }

    getApiKeys() {
        const keys = {};

        // Priority: config file > environment variables
        if (this.config.apiKeys?.openai) {
            keys.openai = this.config.apiKeys.openai;
        } else if (process.env.OPENAI_API_KEY) {
            keys.openai = process.env.OPENAI_API_KEY;
        }

        if (this.config.apiKeys?.zilliz) {
            keys.zilliz = this.config.apiKeys.zilliz;
        } else if (process.env.ZILLIZ_API_KEY) {
            keys.zilliz = process.env.ZILLIZ_API_KEY;
        }

        return keys;
    }

    async validateOpenAIKey(apiKey) {
        this.log('Validating OpenAI API key...');
        
        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'User-Agent': 'claude-context-installer/1.0'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            this.success('OpenAI API key is valid');
        } catch (error) {
            this.error(`OpenAI API key validation failed: ${error.message}`);
        }
    }

    async validateZillizToken(token) {
        this.log('Validating Zilliz API token...');
        
        try {
            // Basic token format validation
            if (!token || typeof token !== 'string' || token.length < 10) {
                throw new Error('Invalid token format');
            }

            // For now, we'll do basic validation. Full validation would require
            // making a request to Zilliz, but that might create unnecessary resources
            this.success('Zilliz API token format is valid');
        } catch (error) {
            this.error(`Zilliz API token validation failed: ${error.message}`);
        }
    }

    checkSystemDependencies() {
        this.log('Checking system dependencies...');

        // Check Node.js version
        try {
            const nodeVersion = process.version;
            const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
            if (majorVersion < 20) {
                this.error(`Node.js version ${nodeVersion} is not supported. Please install Node.js 20 or higher.`);
            }
            this.log(`Node.js version: ${nodeVersion} ✓`);
        } catch (error) {
            this.error(`Failed to check Node.js version: ${error.message}`);
        }

        // Check for pnpm
        try {
            const pnpmVersion = execSync('pnpm --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
            this.log(`pnpm version: ${pnpmVersion} ✓`);
        } catch (error) {
            this.error('pnpm is not installed. Please install pnpm first: npm install -g pnpm');
        }

        this.success('System dependencies check completed');
    }

    buildMcpServer() {
        this.log('Building MCP server...');

        try {
            // Install dependencies
            this.log('Installing dependencies...');
            execSync('pnpm install', { 
                cwd: this.projectRoot,
                stdio: this.config.verbose ? 'inherit' : 'pipe'
            });

            // Build the MCP server
            this.log('Building MCP server...');
            execSync('pnpm build:mcp', { 
                cwd: this.projectRoot,
                stdio: this.config.verbose ? 'inherit' : 'pipe'
            });

            // Verify build output exists
            const mcpDistPath = path.join(this.projectRoot, 'packages', 'mcp', 'dist', 'index.js');
            if (!fs.existsSync(mcpDistPath)) {
                throw new Error('MCP server build output not found');
            }

            this.success('MCP server build completed');
        } catch (error) {
            this.error(`Failed to build MCP server: ${error.message}`);
        }
    }

    createClaudeConfig() {
        this.log('Creating Claude configuration...');

        // Ensure Claude config directory exists
        if (!fs.existsSync(this.claudeConfigDir)) {
            fs.mkdirSync(this.claudeConfigDir, { recursive: true });
            this.log(`Created Claude config directory: ${this.claudeConfigDir}`);
        }

        const configPath = path.join(this.claudeConfigDir, 'claude_desktop_config.json');
        const mcpServerPath = path.join(this.projectRoot, 'packages', 'mcp', 'dist', 'index.js');
        
        // Prepare environment variables
        const apiKeys = this.getApiKeys();
        const env = {};

        if (apiKeys.openai) {
            env.OPENAI_API_KEY = apiKeys.openai;
        }

        if (apiKeys.zilliz) {
            env.MILVUS_TOKEN = apiKeys.zilliz;
        }

        // Add optional configuration
        if (this.config.embeddingProvider) {
            env.EMBEDDING_PROVIDER = this.config.embeddingProvider;
        }

        if (this.config.embeddingModel) {
            env.EMBEDDING_MODEL = this.config.embeddingModel;
        }

        if (this.config.milvusAddress) {
            env.MILVUS_ADDRESS = this.config.milvusAddress;
        }

        const claudeConfig = {
            mcpServers: {
                "claude-context": {
                    command: "node",
                    args: [mcpServerPath],
                    env: env
                }
            }
        };

        // Backup existing config if it exists
        if (fs.existsSync(configPath)) {
            const backupPath = `${configPath}.backup.${Date.now()}`;
            fs.copyFileSync(configPath, backupPath);
            this.log(`Backed up existing configuration to: ${backupPath}`);
        }

        // Write new configuration
        try {
            fs.writeFileSync(configPath, JSON.stringify(claudeConfig, null, 2));
            this.success(`Claude configuration created: ${configPath}`);
        } catch (error) {
            this.error(`Failed to write Claude configuration: ${error.message}`);
        }
    }

    async testMcpServer() {
        this.log('Testing MCP server...');

        const mcpServerPath = path.join(this.projectRoot, 'packages', 'mcp', 'dist', 'index.js');
        const apiKeys = this.getApiKeys();

        try {
            // Set up environment for test
            const env = { ...process.env };
            if (apiKeys.openai) env.OPENAI_API_KEY = apiKeys.openai;
            if (apiKeys.zilliz) env.MILVUS_TOKEN = apiKeys.zilliz;
            if (this.config.embeddingProvider) env.EMBEDDING_PROVIDER = this.config.embeddingProvider;

            // Test server startup with --help flag
            const result = execSync(`node "${mcpServerPath}" --help`, {
                env,
                encoding: 'utf8',
                timeout: 10000,
                stdio: 'pipe'
            });

            if (result.includes('Context MCP Server')) {
                this.success('MCP server test completed successfully');
            } else {
                throw new Error('Unexpected server response');
            }
        } catch (error) {
            this.error(`MCP server test failed: ${error.message}`);
        }
    }

    async install() {
        try {
            this.log('Starting Claude Context MCP Server installation...');
            
            // Step 1: Load configuration
            this.loadConfig();
            
            // Step 2: Validate API keys first (most important, fails fast)
            await this.validateApiKeys();
            
            // Step 3: Check system dependencies
            this.checkSystemDependencies();
            
            // Step 4: Build MCP server
            this.buildMcpServer();
            
            // Step 5: Create Claude configuration
            this.createClaudeConfig();
            
            // Step 6: Test MCP server
            await this.testMcpServer();
            
            this.success('Installation completed successfully!');
            this.log('');
            this.log('Next steps:');
            this.log('1. Restart Claude Desktop to load the new MCP server');
            this.log('2. The claude-context server will be available for code indexing');
            this.log('3. Run "node scripts/verify.js" to verify the installation');
            this.log('');
            
        } catch (error) {
            this.error(`Installation failed: ${error.message}`);
        }
    }
}

// Run installer if called directly
if (require.main === module) {
    const installer = new ClaudeContextInstaller();
    installer.install().catch(error => {
        console.error('Installation failed:', error);
        process.exit(1);
    });
}

module.exports = ClaudeContextInstaller;