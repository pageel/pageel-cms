
// Define global jsyaml
declare const jsyaml: {
    load: (str: string) => any;
    dump: (obj: any, options?: any) => string;
};

export interface ParsedMarkdown {
  frontmatter: Record<string, any>;
  thumbnailUrl: string | null;
  body: string;
}

// Find first image in markdown body
const findThumbnailInBody = (body: string): string | null => {
  const imageRegex = /!\[.*?\]\((.*?)\)/;
  const match = body.match(imageRegex);
  return match ? match[1] : null;
};

export const parseMarkdown = (content: string): ParsedMarkdown => {
  const frontmatterRegex = /^---([\s\S]*?)---/;
  const match = content.match(frontmatterRegex);

  let frontmatter: Record<string, any> = {};
  let body = content;

  if (match) {
    try {
        const parsed = jsyaml.load(match[1]);
        if (parsed && typeof parsed === 'object') {
            frontmatter = parsed;
        }
    } catch (e) {
        console.warn("Frontmatter parse error:", e);
    }
    body = content.substring(match[0].length).trim();
  }
  
  // Create a case-insensitive lookup object for frontmatter
  const fmLower = Object.fromEntries(Object.entries(frontmatter).map(([k, v]) => [k.toLowerCase(), v]));

  // Prioritize frontmatter keys for the thumbnail
  const thumbnailFromFm = fmLower['image'] || fmLower['thumbnail'] || fmLower['cover'] || null;

  const thumbnailUrl = thumbnailFromFm || findThumbnailInBody(body);

  return { frontmatter, thumbnailUrl, body };
};

export const updateFrontmatter = (content: string, updates: Record<string, any>): string => {
  const { frontmatter, body } = parseMarkdown(content);
  const newFrontmatter = { ...frontmatter, ...updates };

  // Use js-yaml to dump. lineWidth: -1 prevents line wrapping for long strings
  const yamlString = jsyaml.dump(newFrontmatter, { lineWidth: -1 });

  return `---\n${yamlString}---\n${body}`;
};

export const slugify = (str: string): string => {
  return str
    .toString()
    .normalize('NFD') // split an accented letter in the base letter and the acent
    .replace(/[\u0300-\u036f]/g, '') // remove all previously split accents
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // replace spaces with -
    .replace(/[^\w-]+/g, '') // remove all non-word chars
    .replace(/--+/g, '-'); // replace multiple - with single -
};

export const parseRepoUrl = (url: string): { owner: string; repo: string } | null => {
    const trimmed = url.trim().replace(/\/+$/, '').replace(/\.git$/, '');
    
    // Case 1: Simple "owner/repo" format (no protocol, no domain)
    if (!trimmed.includes('://') && !trimmed.includes('.')) {
        const parts = trimmed.split('/').filter(p => p);
        if (parts.length === 2) {
            return { owner: parts[0], repo: parts[1] };
        }
        return null;
    }
    
    // Case 2: Full URL or URL with domain
    try {
        let urlToParse = trimmed;
        // Add protocol if missing
        if (!urlToParse.includes('://')) {
            urlToParse = 'https://' + urlToParse;
        }
        
        const urlObj = new URL(urlToParse);
        const pathParts = urlObj.pathname.split('/').filter(p => p);
        
        if (pathParts.length >= 2) {
            const repo = pathParts[pathParts.length - 1].replace('.git', '');
            const owner = pathParts[pathParts.length - 2];
            return { owner, repo };
        }
        return null;
    } catch(e) {
        console.error("Invalid URL provided to parseRepoUrl:", e);
        return null;
    }
}

export const inferFrontmatterType = (value: any): string => {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date'; 
    if (typeof value === 'object' && value !== null) return 'object';
    // Check if string looks like date
    if (typeof value === 'string' && !isNaN(Date.parse(value)) && value.includes('-')) return 'date';
    return 'string';
};

/**
 * Escapes characters in a string that have special meaning in a regular expression.
 * @param str The input string.
 * @returns The escaped string, safe to use in a RegExp.
 */
export const escapeRegExp = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
};

/**
 * Extracts all image URLs from markdown content.
 * Looks for:
 * 1. Markdown syntax: ![alt](url)
 * 2. HTML syntax: <img src="url" />
 */
export const extractImageUrls = (markdown: string): string[] => {
  const urls: string[] = [];
  
  // 1. Markdown Regex: ![alt](url "optional title")
  const mdRegex = /!\[.*?\]\((.*?)(?:\s+".*?")?\)/g;
  let match;
  while ((match = mdRegex.exec(markdown)) !== null) {
    if (match[1]) urls.push(match[1].trim());
  }

  // 2. HTML Regex: <img ... src="url" ... />
  const htmlRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
  while ((match = htmlRegex.exec(markdown)) !== null) {
    if (match[1]) urls.push(match[1].trim());
  }
  
  // 3. Frontmatter image fields (simple heuristic)
  const { frontmatter } = parseMarkdown(markdown);
  const possibleImageKeys = ['image', 'cover', 'thumbnail', 'heroImage'];
  possibleImageKeys.forEach(key => {
      if (frontmatter[key] && typeof frontmatter[key] === 'string') {
          urls.push(frontmatter[key]);
      }
  });

  return [...new Set(urls)]; // Deduplicate
};
