import { IGitService, RepoInfo, ContentInfo, RepoTreeInfo } from '../types';

export abstract class BaseGitService implements IGitService {
    protected token: string;
    protected owner: string;
    protected repoName: string;
    
    protected ignoredDirs = new Set(['node_modules', '.git', '.github', 'dist', 'build', 'vendor', '.vscode', 'pages', 'page']);
    protected ignoredTreeDirs = new Set(['node_modules', '.git', '.github', 'dist', 'build', 'vendor', '.vscode']);

    constructor(token: string, owner: string, repoName: string) {
        this.token = token;
        this.owner = owner;
        this.repoName = repoName;
    }

    // Abstract methods to be implemented by subclasses
    abstract getRepoContents(path: string): Promise<ContentInfo[]>;
    abstract getFileContent(path: string): Promise<string>;
    abstract uploadFile(path: string, file: File, commitMessage: string, sha?: string): Promise<any>;
    abstract createFileFromString(path: string, newContent: string, commitMessage: string): Promise<any>;
    abstract updateFileContent(path: string, newContent: string, commitMessage: string, sha: string): Promise<any>;
    abstract deleteFile(path: string, sha: string, commitMessage: string): Promise<any>;
    abstract getFileAsBlob(path: string): Promise<Blob>;
    abstract getRepoTree(path?: string): Promise<RepoTreeInfo[]>;
    abstract getRepoDetails(): Promise<RepoInfo>;
    abstract getFileSha(path: string): Promise<string | null>;
    
    // --- Shared Implementations ---

    async listFiles(path: string): Promise<RepoTreeInfo[]> {
        // Default implementation using getRepoContents (not recursive, limited to 1000)
        // Subclasses should override this with Git Tree API for better performance
        try {
            const contents = await this.getRepoContents(path);
            return contents.map(item => ({
                name: item.name,
                path: item.path,
                type: item.type === 'file' ? 'file' : 'dir',
                sha: item.sha,
                size: item.size
            }));
        } catch (e) {
            console.warn("listFiles failed, returning empty list", e);
            return [];
        }
    }

    private sortPaths(paths: string[], preferredNames: string[]): string[] {
        const results = Array.from(paths);
        results.sort((a, b) => {
            const aLastName = a.split('/').pop()?.toLowerCase() || '';
            const bLastName = b.split('/').pop()?.toLowerCase() || '';
            const aIsPreferred = preferredNames.includes(aLastName);
            const bIsPreferred = preferredNames.includes(bLastName);
            if (aIsPreferred && !bIsPreferred) return -1;
            if (!aIsPreferred && bIsPreferred) return 1;
            const aDepth = a.split('/').length;
            const bDepth = b.split('/').length;
            if (aDepth !== bDepth) return aDepth - bDepth;
            return a.localeCompare(b);
        });
        return results;
    }

    private async scanDirectoryGeneric(path: string, depth: number, maxDepth: number, foundDirs: Set<string>, fileCheck: (filename: string) => boolean) {
        if (depth >= maxDepth) return;
        try {
            const contents = await this.getRepoContents(path);
            let hasMatchingFile = false;
            const subDirs: ContentInfo[] = [];
            for (const item of contents) {
                if (item.type === 'file' && fileCheck(item.name)) {
                    hasMatchingFile = true;
                } else if (item.type === 'dir' && !this.ignoredDirs.has(item.name.toLowerCase())) {
                    subDirs.push(item);
                }
            }
            if (hasMatchingFile && path) {
                foundDirs.add(path);
            }
            await Promise.all(
                subDirs.map(dir => this.scanDirectoryGeneric(dir.path, depth + 1, maxDepth, foundDirs, fileCheck))
            );
        } catch (error) {
            console.warn(`Could not scan directory '${path}':`, error);
        }
    }

    async scanForContentDirectories(): Promise<string[]> {
        const foundDirs = new Set<string>();
        await this.scanDirectoryGeneric('', 0, 4, foundDirs, (name) => name.endsWith('.md') || name.endsWith('.mdx'));
        const preferredDirNames = ['posts', 'post', 'blog', 'content', 'data', 'articles'];
        return this.sortPaths(Array.from(foundDirs), preferredDirNames);
    }
    
    async scanForImageDirectories(): Promise<string[]> {
        const foundDirs = new Set<string>();
        await this.scanDirectoryGeneric('', 0, 4, foundDirs, (name) => /\.(jpe?g|png|gif|webp|svg)$/i.test(name));
        const preferredDirNames = ['images', 'assets', 'static', 'public'];
        const sorted = this.sortPaths(Array.from(foundDirs), preferredDirNames);
        const publicImagesIndex = sorted.findIndex(p => p.toLowerCase() === 'public/images');
        if (publicImagesIndex > 0) {
            const [publicImagesPath] = sorted.splice(publicImagesIndex, 1);
            sorted.unshift(publicImagesPath);
        }
        return sorted;
    }

    async findProductionUrl(): Promise<string | null> {
        const jsSiteRegex = /site\s*:\s*['"](https?:\/\/[^'"]+)['"]/;
        const yamlSiteRegex = /^\s*(?:site|url)\s*:\s*['"]?(https?:\/\/[^'"\s]+)['"]?/m;
        const filesToScan = [
            { path: 'astro.config.mjs', regex: jsSiteRegex },
            { path: 'astro.config.ts', regex: jsSiteRegex },
            { path: 'astro.config.js', regex: jsSiteRegex },
            { path: 'src/config.yaml', regex: yamlSiteRegex },
            { path: 'src/config.yml', regex: yamlSiteRegex },
            { path: 'src/config.ts', regex: jsSiteRegex },
            { path: 'src/config.js', regex: jsSiteRegex },
        ];
        for (const file of filesToScan) {
            try {
                const content = await this.getFileContent(file.path);
                const match = content.match(file.regex);
                if (match && match[1]) return match[1].replace(/\/$/, '');
            } catch (error) { /* File not found, continue */ }
        }
        try {
            const content = await this.getFileContent('package.json');
            const pkg = JSON.parse(content);
            if (pkg.homepage && typeof pkg.homepage === 'string' && pkg.homepage.startsWith('http')) {
                return pkg.homepage.replace(/\/$/, '');
            }
        } catch (error) { /* package.json not found or parsing failed */ }
        return null;
    }
}