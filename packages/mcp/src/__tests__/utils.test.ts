import { describe, it, expect } from 'vitest';
import {
    isFilesystemRoot,
    resolveRealPath,
    directoryExists,
    normalizePathForComparison,
} from '../utils.js';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

/**
 * Tests for Path Utility Functions
 * Phase 3, Task 3.1a & 3.1b
 */

describe('Path Utilities', () => {
    describe('isFilesystemRoot', () => {
        it('should return true for Unix root', () => {
            // Only test Unix root on Unix platforms
            if (process.platform !== 'win32') {
                expect(isFilesystemRoot('/')).toBe(true);
            }
        });

        // Windows-specific tests (only run on Windows)
        if (process.platform === 'win32') {
            it('should return true for Windows drive root C:\\', () => {
                expect(isFilesystemRoot('C:\\')).toBe(true);
            });

            it('should return true for Windows drive root D:\\', () => {
                expect(isFilesystemRoot('D:\\')).toBe(true);
            });

            it('should return true for other Windows drive roots', () => {
                expect(isFilesystemRoot('E:\\')).toBe(true);
                expect(isFilesystemRoot('Z:\\')).toBe(true);
            });

            it('should return true for Windows UNC paths', () => {
                // Use String.raw to properly escape backslashes in UNC paths
                expect(isFilesystemRoot(String.raw`\\server\share`)).toBe(true);
                expect(isFilesystemRoot(String.raw`\\myserver\myshare`)).toBe(true);
            });

            it('should return false for Windows subdirectories', () => {
                expect(isFilesystemRoot('C:\\Users')).toBe(false);
                expect(isFilesystemRoot('C:\\Program Files')).toBe(false);
                expect(isFilesystemRoot('D:\\Data\\Projects')).toBe(false);
            });

            it('should handle normalized Windows paths', () => {
                // path.normalize converts forward slashes to backslashes on Windows
                const normalized = path.normalize('C:/');
                expect(isFilesystemRoot(normalized)).toBe(true);
            });
        }

        // Unix/macOS-specific tests (only run on Unix-like systems)
        if (process.platform !== 'win32') {
            it('should return false for Unix subdirectories', () => {
                expect(isFilesystemRoot('/home')).toBe(false);
                expect(isFilesystemRoot('/home/user')).toBe(false);
                expect(isFilesystemRoot('/usr/local')).toBe(false);
                expect(isFilesystemRoot('/var/log')).toBe(false);
            });
        }

        it('should return false for relative paths', () => {
            expect(isFilesystemRoot('.')).toBe(false);
            expect(isFilesystemRoot('..')).toBe(false);
            expect(isFilesystemRoot('./src')).toBe(false);
            expect(isFilesystemRoot('../parent')).toBe(false);
        });

        it('should return false for empty path', () => {
            expect(isFilesystemRoot('')).toBe(false);
        });

        it('should handle paths with trailing slashes correctly', () => {
            if (process.platform === 'win32') {
                expect(isFilesystemRoot('C:\\')).toBe(true);
                expect(isFilesystemRoot('D:\\')).toBe(true);
            } else {
                // On Unix, '/' is the filesystem root
                expect(isFilesystemRoot('/')).toBe(true);
            }
        });
    });

    describe('resolveRealPath', () => {
        it('should return real path for existing directory', () => {
            const realPath = resolveRealPath(__dirname);
            expect(realPath).toBeTruthy();
            expect(path.isAbsolute(realPath)).toBe(true);
        });

        it('should return original path for non-existent paths', () => {
            const nonExistent = '/nonexistent/test/path';
            const result = resolveRealPath(nonExistent);
            expect(result).toBe(nonExistent);
        });

        it('should handle current directory', () => {
            const result = resolveRealPath('.');
            expect(result).toBeTruthy();
            expect(path.isAbsolute(result)).toBe(true);
        });

        // Symlink test (create temporary symlink)
        it('should resolve symlinks to real paths', () => {
            const tmpDir = os.tmpdir();
            const targetDir = path.join(tmpDir, 'test-target-' + Date.now());
            const symlinkPath = path.join(tmpDir, 'test-symlink-' + Date.now());

            try {
                // Create target directory
                fs.mkdirSync(targetDir, { recursive: true });

                // Create symlink
                fs.symlinkSync(targetDir, symlinkPath, 'dir');

                // Resolve symlink
                const resolved = resolveRealPath(symlinkPath);

                // Should resolve to real target path
                expect(resolved).toBeTruthy();
                expect(fs.realpathSync(symlinkPath)).toBe(resolved);

                // Cleanup
                fs.rmSync(symlinkPath, { recursive: true, force: true });
                fs.rmSync(targetDir, { recursive: true, force: true });
            } catch (error: any) {
                // Skip test if symlink creation fails (permissions, etc.)
                if (error.code !== 'EPERM' && error.code !== 'EACCES') {
                    throw error;
                }
                console.warn('Skipping symlink test due to permissions');
            }
        });

        it('should handle permission errors gracefully', () => {
            // Test with a path that likely doesn't exist
            const result = resolveRealPath('/root/.ssh/id_rsa_nonexistent');
            expect(result).toBeTruthy(); // Should return original or fallback
        });
    });

    describe('directoryExists', () => {
        it('should return true for existing directory', () => {
            expect(directoryExists(__dirname)).toBe(true);
        });

        it('should return false for non-existent path', () => {
            expect(directoryExists('/nonexistent/path/to/nowhere')).toBe(false);
        });

        it('should return false for file (not directory)', () => {
            expect(directoryExists(__filename)).toBe(false);
        });

        it('should return true for current directory', () => {
            expect(directoryExists('.')).toBe(true);
        });

        it('should return true for parent directory', () => {
            expect(directoryExists('..')).toBe(true);
        });

        it('should handle root directory', () => {
            if (process.platform === 'win32') {
                const driveLetter = process.cwd().substring(0, 2); // e.g., "C:"
                expect(directoryExists(driveLetter + '\\')).toBe(true);
            } else {
                expect(directoryExists('/')).toBe(true);
            }
        });

        it('should handle permission errors gracefully', () => {
            // Path that likely doesn't exist or has permission issues
            const restrictedPath = process.platform === 'win32'
                ? 'C:\\System Volume Information'
                : '/root/.ssh';

            // Should not throw, just return false
            const result = directoryExists(restrictedPath);
            expect(typeof result).toBe('boolean');
        });

        it('should return false for empty path', () => {
            expect(directoryExists('')).toBe(false);
        });
    });

    describe('normalizePathForComparison', () => {
        it('should convert backslashes to forward slashes', () => {
            const result = normalizePathForComparison('C:\\Users\\Test\\file.txt');
            expect(result).toContain('/');
            expect(result).not.toContain('\\');
        });

        it('should remove trailing slash', () => {
            expect(normalizePathForComparison('/home/user/')).toBe('/home/user');
            expect(normalizePathForComparison('C:\\Users\\Test\\')).not.toMatch(/\/$/);
        });

        it('should preserve root slash', () => {
            expect(normalizePathForComparison('/')).toBe('/');
        });

        it('should lowercase on Windows', () => {
            if (process.platform === 'win32') {
                const result = normalizePathForComparison('C:\\USERS\\TEST');
                expect(result).toBe(result.toLowerCase());
            }
        });

        it('should preserve case on Unix', () => {
            if (process.platform !== 'win32') {
                const result = normalizePathForComparison('/HOME/USER');
                expect(result).toBe('/HOME/USER'); // Case preserved
            }
        });

        it('should handle mixed separators', () => {
            const result = normalizePathForComparison('C:/Users\\Test/file.txt');
            expect(result).not.toContain('\\');
            expect(result).toMatch(/\//);
        });

        it('should normalize relative paths', () => {
            const result = normalizePathForComparison('./src/../lib');
            expect(result).toBeTruthy();
            // Should resolve to normalized form
        });

        it('should handle paths with multiple consecutive slashes', () => {
            const result = normalizePathForComparison('/home//user///documents');
            expect(result).not.toMatch(/\/\//); // No double slashes
        });
    });
});
