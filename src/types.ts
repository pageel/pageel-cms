
export interface GithubUser {
  login: string;
  avatar_url: string;
  html_url: string;
  name: string;
}

export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string;
  pushed_at: string;
  default_branch: string;
  owner: {
    login: string;
  };
  permissions?: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
  stargazers_count?: number; // from GitHub
  stars_count?: number; // from Gitea/Gogs
}

export interface GithubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: 'file' | 'dir';
  content?: string; // Present when fetching a file
  encoding?: 'base64'; // Present when fetching a file
  _links: {
    self: string;
    git: string;
    html: string;
  };
}

export interface RepoTreeItem {
  path: string;
  name: string;
  type: 'dir' | 'file';
  hasMarkdown?: boolean;
  sha?: string;
  size?: number;
  url?: string;
}

export type ProjectType = 'astro' | 'github';

export interface AppSettings {
  projectType: ProjectType;
  postsPath: string;
  imagesPath: string;
  domainUrl: string;
  postFileTypes: string;
  imageFileTypes: string;
  publishDateSource: 'file' | 'system';
  imageCompressionEnabled: boolean;
  maxImageSize: number;
  imageResizeMaxWidth: number;
  newPostCommit: string;
  updatePostCommit: string;
  newImageCommit: string;
  updateImageCommit: string;
}

// --- Service Adapter Interfaces ---

export type ServiceType = 'github' | 'gitea' | 'gogs';
export type UserInfo = GithubUser;
export type RepoInfo = GithubRepo;
export type ContentInfo = GithubContent;
export type RepoTreeInfo = RepoTreeItem;

export interface IGitService {
  // Methods for file/content operations
  getRepoContents(path: string): Promise<ContentInfo[]>;
  listFiles(path: string): Promise<RepoTreeInfo[]>; // Optimized for large lists
  getFileContent(path: string): Promise<string>;
  getFileSha(path: string): Promise<string | null>; // TD-04: Get file SHA for updates
  uploadFile(path: string, file: File, commitMessage: string, sha?: string): Promise<any>;
  createFileFromString(path: string, newContent: string, commitMessage: string): Promise<any>;
  updateFileContent(path: string, newContent: string, commitMessage: string, sha: string): Promise<any>;
  deleteFile(path: string, sha: string, commitMessage: string): Promise<any>;
  getFileAsBlob(path: string): Promise<Blob>;
  
  // Methods for repo scanning and info retrieval
  scanForContentDirectories(): Promise<string[]>;
  scanForImageDirectories(): Promise<string[]>;
  findProductionUrl(): Promise<string | null>;
  getRepoTree(path?: string): Promise<RepoTreeInfo[]>;
  getRepoDetails(): Promise<RepoInfo>;
}