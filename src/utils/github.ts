
import { GithubRepo } from '../types';

/**
 * Generates a Raw GitHub URL for a given path.
 * Adds 'public/' prefix if not already present since static assets
 * are typically served from the public/ folder in web projects.
 */
export const getRawGithubUrl = (repo: GithubRepo, path: string, _projectType: string = 'astro'): string => {
    if (!path) return '';
    if (path.startsWith('http')) return path;

    // Remove leading slash for path normalization
    let cleanPath = path.startsWith('/') ? path.substring(1) : path;
    
    // Static assets are typically in public/ folder.
    // Add 'public/' prefix if not already present.
    if (!cleanPath.startsWith('public/')) {
        cleanPath = 'public/' + cleanPath; // images/foo.png → public/images/foo.png
    }

    // Use the explicit branch format (refs/heads/branch) for stability
    const branch = repo.default_branch || 'main';
    return `https://raw.githubusercontent.com/${repo.full_name}/refs/heads/${branch}/${cleanPath}`;
};

/**
 * Resolves an image path to a public URL (production) or fallback (Raw GitHub).
 */
export const resolveImageSource = (
    path: string, 
    repo: GithubRepo, 
    projectType: string, 
    domainUrl?: string
): string => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;

    // If we have a production domain and it's an Astro project, use it.
    if (projectType === 'astro' && domainUrl) {
        const cleanDomain = domainUrl.replace(/\/$/, '');
        // For Astro, we assume the path is relative to public/ but referenced without it
        let relPath = path;
        if (relPath.startsWith('public/')) relPath = relPath.substring(7);
        if (!relPath.startsWith('/')) relPath = '/' + relPath;
        return `${cleanDomain}${relPath}`;
    }

    // Fallback: Raw GitHub (Public) or Blob (Private)
    // Note: Private repo blobs are handled by components using gitService.getFileAsBlob
    return getRawGithubUrl(repo, path, projectType);
};
