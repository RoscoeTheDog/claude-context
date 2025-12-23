import { MilvusClient } from '@zilliz/milvus2-sdk-node';
import crypto from 'crypto';
import path from 'path';

export interface CodebaseConfig {
    ignorePatterns: string[];
    enableDirectoryPruning: boolean;  // Currently not used, reserved for future
    maxFileSize: number;
    fileExtensions: string[];
    followSymlinks: boolean;
    indexHiddenFiles: boolean;
    indexBinaryFiles: boolean;
}

export interface CodebaseConfigDocument {
    codebase_path: string;
    codebase_hash: string;
    config: CodebaseConfig;
    metadata: {
        createdAt: number;
        updatedAt: number;
        version: string;
    };
}

export const DEFAULT_CODEBASE_CONFIG: CodebaseConfig = {
    ignorePatterns: [],              // Empty by default - index everything
    enableDirectoryPruning: true,    // Reserved for future use
    maxFileSize: 10 * 1024 * 1024,  // 10MB
    fileExtensions: [],              // All extensions
    followSymlinks: false,
    indexHiddenFiles: true,
    indexBinaryFiles: false
};

export class CodebaseConfigManager {
    private client: MilvusClient | null;
    private collectionName = 'claude_context_configs';
    private configCache = new Map<string, CodebaseConfig>();

    constructor(client: MilvusClient | null) {

        this.client = client;
    }

    /**
     * Set the Milvus client (called after vectorDB initialization)
     */
    setClient(client: MilvusClient | null): void {
        this.client = client;
    }

    /**
     * Initialize the config collection if it doesn't exist
     */
    async initialize(): Promise<void> {
        if (!this.client) {
            console.warn('[ConfigManager] No client available (REST API mode) - config storage disabled');
            return;
        }

        try {
            const collections = await this.client.listCollections();
            const exists = collections.data?.some(c => c.name === this.collectionName);

            if (!exists) {
                await this.createConfigCollection();
                console.log('[ConfigManager] Created claude_context_configs collection');
            } else {
                // Load collection into memory
                await this.client.loadCollection({ collection_name: this.collectionName });
                console.log('[ConfigManager] Loaded existing configs collection');
            }
        } catch (error: any) {
            console.warn('[ConfigManager] Failed to initialize:', error.message);
            // Non-fatal - will use defaults
        }
    }

    /**
     * Get configuration for a codebase (from cache or database)
     */
    async getConfig(codebasePath: string): Promise<CodebaseConfig> {
        const normalizedPath = path.resolve(codebasePath);

        // Check cache first
        if (this.configCache.has(normalizedPath)) {
            return { ...this.configCache.get(normalizedPath)! };
        }

        // Load from database
        try {
            const config = await this.loadConfigFromDB(normalizedPath);
            this.configCache.set(normalizedPath, config);
            return { ...config };
        } catch (error: any) {
            console.warn(`[ConfigManager] Failed to load config for ${normalizedPath}:`, error.message);
            // Return defaults on error
            return { ...DEFAULT_CODEBASE_CONFIG };
        }
    }

    /**
     * Update configuration for a codebase (merges with existing)
     */
    async updateConfig(
        codebasePath: string,
        updates: Partial<CodebaseConfig>
    ): Promise<CodebaseConfig> {
        const normalizedPath = path.resolve(codebasePath);
        const currentConfig = await this.getConfig(normalizedPath);

        // Merge updates with current config
        const newConfig: CodebaseConfig = {
            ...currentConfig,
            ...updates
        };

        // Save to database
        await this.saveConfigToDB(normalizedPath, newConfig);

        // Update cache
        this.configCache.set(normalizedPath, newConfig);

        console.log(`[ConfigManager] Updated config for ${normalizedPath}`);
        return { ...newConfig };
    }

    /**
     * Reset configuration to defaults
     */
    async resetConfig(codebasePath: string): Promise<CodebaseConfig> {
        const normalizedPath = path.resolve(codebasePath);

        await this.saveConfigToDB(normalizedPath, DEFAULT_CODEBASE_CONFIG);
        this.configCache.set(normalizedPath, DEFAULT_CODEBASE_CONFIG);

        console.log(`[ConfigManager] Reset config for ${normalizedPath}`);
        return { ...DEFAULT_CODEBASE_CONFIG };
    }

    /**
     * List all configured codebases
     */
    async listConfigs(): Promise<Array<{ path: string, config: CodebaseConfig }>> {
        if (!this.client) {
            console.warn('[ConfigManager] Cannot list configs - no client available (REST API mode)');
            return [];
        }

        try {
            const results = await this.client.query({
                collection_name: this.collectionName,
                filter: 'codebase_hash != ""',
                output_fields: ['codebase_path', 'config'],
                limit: 1000
            });

            return results.data.map(doc => ({
                path: doc.codebase_path as string,
                config: doc.config as CodebaseConfig
            }));
        } catch (error: any) {
            console.warn('[ConfigManager] Failed to list configs:', error.message);
            return [];
        }
    }

    /**
     * Delete configuration for a codebase
     */
    async deleteConfig(codebasePath: string): Promise<void> {
        if (!this.client) {
            console.warn('[ConfigManager] Cannot delete config - no client available (REST API mode)');
            return;
        }

        const normalizedPath = path.resolve(codebasePath);
        const hash = this.getCodebaseHash(normalizedPath);

        try {
            await this.client.delete({
                collection_name: this.collectionName,
                filter: `codebase_hash == "${hash}"`
            });

            this.configCache.delete(normalizedPath);
            console.log(`[ConfigManager] Deleted config for ${normalizedPath}`);
        } catch (error: any) {
            console.warn(`[ConfigManager] Failed to delete config:`, error.message);
        }
    }

    // Private helper methods

    private async createConfigCollection(): Promise<void> {
        if (!this.client) {
            return;
        }

        await this.client.createCollection({
            collection_name: this.collectionName,
            fields: [
                {
                    name: 'id',
                    data_type: 'Int64',
                    is_primary_key: true,
                    autoID: true
                },
                {
                    name: 'codebase_path',
                    data_type: 'VarChar',
                    max_length: 1024
                },
                {
                    name: 'codebase_hash',
                    data_type: 'VarChar',
                    max_length: 32
                },
                {
                    name: 'config',
                    data_type: 'JSON'
                },
                {
                    name: 'metadata',
                    data_type: 'JSON'
                }
            ]
        });

        // Create index on codebase_hash for fast lookup
        await this.client.createIndex({
            collection_name: this.collectionName,
            field_name: 'codebase_hash',
            index_type: 'STL_SORT'
        });

        await this.client.loadCollection({
            collection_name: this.collectionName
        });
    }

    private async loadConfigFromDB(codebasePath: string): Promise<CodebaseConfig> {
        if (!this.client) {
            return { ...DEFAULT_CODEBASE_CONFIG };
        }

        const hash = this.getCodebaseHash(codebasePath);

        const results = await this.client.query({
            collection_name: this.collectionName,
            filter: `codebase_hash == "${hash}"`,
            output_fields: ['config'],
            limit: 1
        });

        if (results.data.length > 0) {
            return results.data[0].config as CodebaseConfig;
        }

        // No config found, return defaults
        return { ...DEFAULT_CODEBASE_CONFIG };
    }

    private async saveConfigToDB(
        codebasePath: string,
        config: CodebaseConfig
    ): Promise<void> {
        if (!this.client) {
            console.warn('[ConfigManager] Cannot save config - no client available (REST API mode)');
            return;
        }

        const hash = this.getCodebaseHash(codebasePath);

        // Check if config already exists
        const existing = await this.client.query({
            collection_name: this.collectionName,
            filter: `codebase_hash == "${hash}"`,
            output_fields: ['id', 'metadata'],
            limit: 1
        });

        const now = Date.now();
        const doc: any = {
            codebase_path: codebasePath,
            codebase_hash: hash,
            config: config,
            metadata: {
                createdAt: existing.data.length > 0
                    ? (existing.data[0].metadata as any).createdAt
                    : now,
                updatedAt: now,
                version: '1.0'
            }
        };

        if (existing.data.length > 0) {
            // Delete existing first
            await this.client.delete({
                collection_name: this.collectionName,
                filter: `codebase_hash == "${hash}"`
            });
        }

        // Insert new/updated config
        await this.client.insert({
            collection_name: this.collectionName,
            data: [doc]
        });
    }

    private getCodebaseHash(codebasePath: string): string {
        return crypto.createHash('md5').update(codebasePath).digest('hex');
    }
}
