#!/usr/bin/env node

/**
 * Claude Context MCP Server Uninstall Script
 * 
 * This script removes the claude-context MCP server from Claude Desktop
 * configuration and optionally cleans up build artifacts.
 * 
 * Usage: node scripts/uninstall.js [--clean] [--force]
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

class ClaudeContextUninstaller {
    constructor() {
        this.platform = os.platform();
        this.projectRoot = path.dirname(__dirname);
        this.claudeConfigDir = this.getClaudeConfigDir();
        this.logPrefix = '[Claude-Context Uninstaller]';
        this.options = this.parseArguments();
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`${prefix} ${this.logPrefix} ${message}`);
    }

    error(message, exit = true) {
        this.log(message, 'error');
        if (exit) process.exit(1);
    }

    success(message) {
        this.log(message, 'success');
    }

    warning(message) {
        this.log(message, 'warning');
    }

    parseArguments() {
        return {
            clean: process.argv.includes('--clean'),
            force: process.argv.includes('--force'),
            help: process.argv.includes('--help') || process.argv.includes('-h')
        };
    }

    showHelp() {
        console.log(`
Claude Context MCP Server Uninstaller

Usage: node scripts/uninstall.js [options]

Options:
  --clean     Remove build artifacts and node_modules
  --force     Skip confirmation prompts
  --help, -h  Show this help message

Examples:
  node scripts/uninstall.js              # Remove from Claude config only
  node scripts/uninstall.js --clean      # Remove config and clean build files
  node scripts/uninstall.js --force      # Skip all confirmation prompts
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
                this.error(`Unsupported platform: ${this.platform}`);
        }
    }

    async confirmAction(message) {
        if (this.options.force) return true;

        // Simple confirmation for non-interactive environments
        console.log(`${message} (y/N)`);
        console.log('Run with --force to skip confirmations');
        return false;
    }

    async removeFromClaudeConfig() {
        this.log('Checking Claude Desktop configuration...');

        const configPath = path.join(this.claudeConfigDir, 'claude_desktop_config.json');
        
        if (!fs.existsSync(configPath)) {
            this.warning('Claude Desktop configuration file not found');
            return;
        }

        try {
            const configContent = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configContent);

            // Check if claude-context is configured
            if (!config.mcpServers || !config.mcpServers['claude-context']) {
                this.warning('claude-context MCP server not found in Claude configuration');
                return;
            }

            // Create backup before modifying
            const backupPath = `${configPath}.backup.${Date.now()}`;
            fs.copyFileSync(configPath, backupPath);
            this.log(`Created backup: ${backupPath}`);

            // Remove claude-context from configuration
            delete config.mcpServers['claude-context'];

            // If no other MCP servers, remove the entire mcpServers section
            if (Object.keys(config.mcpServers).length === 0) {
                delete config.mcpServers;
            }

            // Write updated configuration
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            this.success('Removed claude-context from Claude Desktop configuration');

        } catch (error) {
            this.error(`Failed to update Claude configuration: ${error.message}`);
        }
    }

    findBackupFiles() {
        const configPath = path.join(this.claudeConfigDir, 'claude_desktop_config.json');
        const configDir = path.dirname(configPath);
        
        if (!fs.existsSync(configDir)) return [];

        try {
            const files = fs.readdirSync(configDir);
            return files
                .filter(file => file.startsWith('claude_desktop_config.json.backup.'))
                .map(file => path.join(configDir, file))
                .sort((a, b) => {
                    // Sort by timestamp (newest first)
                    const timestampA = a.split('.backup.')[1];
                    const timestampB = b.split('.backup.')[1];
                    return parseInt(timestampB) - parseInt(timestampA);
                });
        } catch (error) {
            this.warning(`Could not read backup files: ${error.message}`);
            return [];
        }
    }

    async restoreBackup() {
        const backups = this.findBackupFiles();
        
        if (backups.length === 0) {
            this.warning('No backup files found');
            return;
        }

        const latestBackup = backups[0];
        this.log(`Found ${backups.length} backup file(s), latest: ${path.basename(latestBackup)}`);

        if (!this.options.force) {
            const confirmed = await this.confirmAction('Restore the latest backup?');
            if (!confirmed) {
                this.log('Backup restoration skipped');
                return;
            }
        }

        try {
            const configPath = path.join(this.claudeConfigDir, 'claude_desktop_config.json');
            fs.copyFileSync(latestBackup, configPath);
            this.success(`Restored configuration from backup: ${path.basename(latestBackup)}`);
        } catch (error) {
            this.error(`Failed to restore backup: ${error.message}`);
        }
    }

    async cleanBuildArtifacts() {
        if (!this.options.clean) return;

        this.log('Cleaning build artifacts...');

        const pathsToClean = [
            path.join(this.projectRoot, 'packages', 'mcp', 'dist'),
            path.join(this.projectRoot, 'packages', 'core', 'dist'),
            path.join(this.projectRoot, 'node_modules'),
            path.join(this.projectRoot, 'packages', 'mcp', 'node_modules'),
            path.join(this.projectRoot, 'packages', 'core', 'node_modules')
        ];

        for (const cleanPath of pathsToClean) {
            if (fs.existsSync(cleanPath)) {
                try {
                    if (fs.statSync(cleanPath).isDirectory()) {
                        fs.rmSync(cleanPath, { recursive: true, force: true });
                        this.log(`Removed: ${path.relative(this.projectRoot, cleanPath)}/`);
                    }
                } catch (error) {
                    this.warning(`Failed to remove ${cleanPath}: ${error.message}`);
                }
            }
        }

        // Clean pnpm cache if requested
        if (this.options.force) {
            try {
                execSync('pnpm store prune', { stdio: 'pipe' });
                this.log('Cleaned pnpm store');
            } catch (error) {
                this.warning('Could not clean pnpm store');
            }
        }

        this.success('Build artifacts cleanup completed');
    }

    listBackupFiles() {
        const backups = this.findBackupFiles();
        
        if (backups.length === 0) {
            this.log('No backup files found');
            return;
        }

        this.log(`Found ${backups.length} backup file(s):`);
        backups.forEach((backup, index) => {
            const timestamp = backup.split('.backup.')[1];
            const date = new Date(parseInt(timestamp)).toLocaleString();
            const size = fs.statSync(backup).size;
            console.log(`  ${index + 1}. ${path.basename(backup)} (${date}, ${size} bytes)`);
        });
    }

    async cleanupBackups() {
        const backups = this.findBackupFiles();
        
        // Keep the most recent 3 backups, remove older ones
        const backupsToRemove = backups.slice(3);
        
        if (backupsToRemove.length === 0) {
            this.log('No old backup files to clean up');
            return;
        }

        this.log(`Found ${backupsToRemove.length} old backup files to remove`);

        if (!this.options.force) {
            const confirmed = await this.confirmAction(`Remove ${backupsToRemove.length} old backup files?`);
            if (!confirmed) {
                this.log('Backup cleanup skipped');
                return;
            }
        }

        let removed = 0;
        for (const backup of backupsToRemove) {
            try {
                fs.unlinkSync(backup);
                removed++;
                this.log(`Removed old backup: ${path.basename(backup)}`);
            } catch (error) {
                this.warning(`Failed to remove backup ${path.basename(backup)}: ${error.message}`);
            }
        }

        if (removed > 0) {
            this.success(`Removed ${removed} old backup files`);
        }
    }

    async uninstall() {
        try {
            if (this.options.help) {
                this.showHelp();
                return;
            }

            this.log('Starting claude-context MCP server uninstallation...');
            
            // Step 1: Remove from Claude configuration
            await this.removeFromClaudeConfig();
            
            // Step 2: List and optionally clean up backups
            this.listBackupFiles();
            await this.cleanupBackups();
            
            // Step 3: Clean build artifacts if requested
            await this.cleanBuildArtifacts();
            
            this.success('Uninstallation completed successfully!');
            this.log('');
            this.log('Next steps:');
            this.log('1. Restart Claude Desktop to unload the MCP server');
            this.log('2. The claude-context server has been removed from Claude');
            
            if (this.options.clean) {
                this.log('3. Build artifacts have been cleaned up');
                this.log('4. Run "pnpm install && pnpm build:mcp" to rebuild if needed');
            } else {
                this.log('3. Run with --clean flag to remove build artifacts');
            }
            
            const backups = this.findBackupFiles();
            if (backups.length > 0) {
                this.log(`4. ${backups.length} configuration backup(s) retained`);
                this.log('   Use "node scripts/uninstall.js --restore" to restore if needed');
            }
            
        } catch (error) {
            this.error(`Uninstallation failed: ${error.message}`);
        }
    }
}

// Handle restore command separately
if (process.argv.includes('--restore')) {
    const uninstaller = new ClaudeContextUninstaller();
    uninstaller.restoreBackup().catch(error => {
        console.error('Restore failed:', error);
        process.exit(1);
    });
} else {
    // Run uninstaller if called directly
    if (require.main === module) {
        const uninstaller = new ClaudeContextUninstaller();
        uninstaller.uninstall().catch(error => {
            console.error('Uninstallation failed:', error);
            process.exit(1);
        });
    }
}

module.exports = ClaudeContextUninstaller;