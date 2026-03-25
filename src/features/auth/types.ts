/**
 * Auth Feature Types
 * 
 * These interfaces enable swappable auth implementations:
 * - Core: GitTokenAuthProvider (Git tokens + sessionStorage)
 * - Pro: DatabaseAuthProvider (Database + OAuth + Roles)
 */

import { GithubUser, GithubRepo, IGitService, ServiceType } from '../../types';

// Type aliases for auth context
export type UserInfo = GithubUser;
export type RepoInfo = GithubRepo;

/**
 * Result of a successful authentication
 */
export interface AuthResult {
  user: UserInfo;
  repo: RepoInfo;
  gitService: IGitService;
  serviceType: ServiceType;
}

/**
 * Credentials for Git token authentication
 */
export interface GitTokenCredentials {
  token: string;
  repoUrl: string;
  serviceType: ServiceType;
  instanceUrl?: string; // For self-hosted Gitea/Gogs
}

/**
 * Auth Provider Interface
 * 
 * Implement this interface for different auth strategies:
 * - GitTokenAuthProvider: Git tokens stored in sessionStorage
 * - DatabaseAuthProvider (Pro): Database + OAuth + Roles
 */
export interface IAuthProvider {
  /**
   * Authenticate with provided credentials
   */
  login(credentials: GitTokenCredentials): Promise<AuthResult>;
  
  /**
   * Clear authentication state
   */
  logout(): Promise<void>;
  
  /**
   * Restore session from storage (sessionStorage/database)
   */
  restoreSession(): Promise<AuthResult | null>;
  
  /**
   * Check if user is currently authenticated
   */
  isAuthenticated(): boolean;
  
  /**
   * Get current user info
   */
  getCurrentUser(): UserInfo | null;
  
  /**
   * Get current Git service instance
   */
  getGitService(): IGitService | null;
}
