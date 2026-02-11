
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { IGitService, GithubRepo, ProjectType } from '../types';
import { parseMarkdown, updateFrontmatter } from '../utils/parsing';
import { useI18n } from '../i18n/I18nContext';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { SearchIcon } from './icons/SearchIcon';
import { ViewListIcon } from './icons/ViewListIcon';
import { ViewGridIcon } from './icons/ViewGridIcon';
import { UploadIcon } from './icons/UploadIcon';
import { TrashIcon } from './icons/TrashIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { ImageIcon } from './icons/ImageIcon';
import PostDetailView from './PostDetailView';
import PostUploadValidationModal from './PostUploadValidationModal';
import PostImageSelectionModal from './PostImageSelectionModal';
import { ConfirmationModal } from './ConfirmationModal';
import { useCollectionStore } from '../features/collections/store';
import { resolveImageSource } from '../utils/github';
import FilterBar, { matchesFilter, FilterValue } from './FilterBar';

interface PostListProps {
  gitService: IGitService;
  repo: GithubRepo;
  path: string;
  imagesPath: string;
  domainUrl: string;
  projectType: ProjectType;
  onPostUpdate: () => void;
  postFileTypes: string;
  imageFileTypes: string;
  newImageCommitTemplate: string;
  updatePostCommitTemplate: string;
  imageCompressionEnabled: boolean;
  maxImageSize: number;
  imageResizeMaxWidth: number;
  onAction: () => void;
}

type SortOption = string; // e.g. 'date-desc', 'title-asc', or '{field}-asc'/'{field}-desc'

interface PostData {
  frontmatter: Record<string, any>;
  body: string;
  rawContent: string;
  name: string;
  sha: string;
  path: string;
  html_url: string;
  thumbnailUrl: string | null;
}

// Component to handle authenticated image loading for private repos
const ThumbnailWithAuth: React.FC<{ gitService: IGitService, imagePath: string, className?: string }> = ({ gitService, imagePath, className = "h-full w-full object-cover" }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!imagePath) {
            setIsLoading(false);
            return;
        }
        
        if (imagePath.startsWith('http')) {
            setImageUrl(imagePath);
            setIsLoading(false);
            return;
        }

        let isMounted = true;
        let objectUrl: string | null = null;

        const fetchBlob = async () => {
            setIsLoading(true);
            // Remove leading slash if present for API call
            const fullPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
            try {
                const blob = await gitService.getFileAsBlob(fullPath);
                if (isMounted) {
                    objectUrl = URL.createObjectURL(blob);
                    setImageUrl(objectUrl);
                }
            } catch (e) {
                // console.error(`Failed to fetch blob for ${fullPath}`, e);
                if (isMounted) setImageUrl(null);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchBlob();

        return () => {
            isMounted = false;
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [gitService, imagePath]);
    
    if (isLoading) {
        return <div className={`flex items-center justify-center bg-gray-50 ${className}`}><SpinnerIcon className="w-3 h-3 animate-spin text-gray-400" /></div>;
    }

    if (!imageUrl) {
        return <div className={`flex items-center justify-center bg-gray-50 ${className}`}><ImageIcon className="text-gray-300 w-1/2 h-1/2" /></div>;
    }

    return <img src={imageUrl} alt="Thumbnail" className={className} />;
};

const PostList: React.FC<PostListProps> = ({
  gitService,
  repo,
  path,
  imagesPath, // Needed for potential relative path resolution logic if expanded
  domainUrl,
  projectType,
  onPostUpdate,
  postFileTypes,
  imageFileTypes,
  updatePostCommitTemplate,
  onAction
}) => {
  const { t, language } = useI18n();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');
  const [currentPage, setCurrentPage] = useState(1);
  const POSTS_PER_PAGE = 20;

  // WF-08: Filter state
  const [activeFilters, setActiveFilters] = useState<Record<string, FilterValue>>({});
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [selectedPost, setSelectedPost] = useState<PostData | null>(null);
  const [postToDelete, setPostToDelete] = useState<PostData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Upload state
  const uploadPostInputRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Update specific post file state
  const updatePostFileInputRef = useRef<HTMLInputElement>(null);
  const [postToUpdateFile, setPostToUpdateFile] = useState<PostData | null>(null);

  // Update specific post image state
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [postToUpdateImage, setPostToUpdateImage] = useState<PostData | null>(null);

  // Columns Configuration
  const { getActiveCollection } = useCollectionStore();
  const activeCollection = getActiveCollection();
  const activeTemplate = activeCollection?.template || null;
  const [visibleFields, setVisibleFields] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({ '__name__': 35 });

  useEffect(() => {
    // 1. Prioritize active collection settings
    if (activeCollection) {
        // Use collection's tableColumns (or empty array if not set)
        setVisibleFields(activeCollection.tableColumns || []);
        setColumnWidths(activeCollection.columnWidths || { '__name__': 35 });
        return; // Skip fallback if collection exists
    }

    // 2. Fallback to repo-wide settings in localStorage (legacy support)
    const columnsKey = `postTableColumns_${repo.full_name}`;
    const widthsKey = `postTableColumnWidths_${repo.full_name}`;
    
    const savedColumnsStr = localStorage.getItem(columnsKey);
    const savedWidthsStr = localStorage.getItem(widthsKey);
    
    if (savedColumnsStr) {
         try {
             setVisibleFields(JSON.parse(savedColumnsStr));
         } catch {
             setVisibleFields([]);
         }
    } else {
        // No saved columns, use empty by default
        setVisibleFields([]);
    }

    if (savedWidthsStr) {
        try {
            setColumnWidths(JSON.parse(savedWidthsStr));
        } catch {
            setColumnWidths({ '__name__': 35 });
        }
    }
  }, [repo.full_name, activeCollection?.id, activeCollection?.tableColumns, activeCollection?.columnWidths]);

  const fetchPosts = async () => {
    if (!path) {
        setPosts([]);
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
        const files = await gitService.listFiles(path);
        const mdFiles = files.filter(f => f.type === 'file' && (f.name.endsWith('.md') || f.name.endsWith('.mdx')));
        
        const postDataPromises = mdFiles.map(async (file) => {
            try {
                const content = await gitService.getFileContent(file.path);
                const { frontmatter, thumbnailUrl, body } = parseMarkdown(content);
                return {
                    frontmatter,
                    body,
                    rawContent: content,
                    name: file.name,
                    sha: file.sha || '',
                    path: file.path,
                    html_url: file.url || '',
                    thumbnailUrl
                } as PostData;
            } catch (e) {
                console.error(`Failed to parse ${file.name}`, e);
                return null;
            }
        });

        const results = await Promise.all(postDataPromises);
        setPosts(results.filter((p): p is PostData => p !== null));
        onPostUpdate(); // Update stats
    } catch (err) {
        if (err instanceof Error && err.message.includes('404')) {
            setError(t('postList.error.dirNotFound', { path }));
        } else {
            setError(t('app.error.unknown'));
        }
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [path, gitService]);

  // WF-08: Filter handlers
  const handleFilterChange = (field: string, filter: FilterValue | null) => {
    setActiveFilters(prev => {
      const next = { ...prev };
      if (filter === null) {
        delete next[field];
      } else {
        next[field] = filter;
      }
      return next;
    });
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setActiveFilters({});
    setCurrentPage(1);
  };

  // WF-08: Column header sort handler
  const handleColumnSort = (field: string) => {
    if (sortOption === `${field}-asc`) {
      setSortOption(`${field}-desc`);
    } else {
      setSortOption(`${field}-asc`);
    }
  };

  // WF-08: Get sort indicator for column header
  const getSortIndicator = (field: string): string | null => {
    if (sortOption === `${field}-asc`) return '▲';
    if (sortOption === `${field}-desc`) return '▼';
    return null;
  };

  // WF-08: Build dynamic sort options from template
  const dynamicSortOptions = useMemo(() => {
    const baseOptions = [
      { value: 'date-desc', label: 'Date (Newest)' },
      { value: 'date-asc', label: 'Date (Oldest)' },
      { value: 'title-asc', label: 'Title (A-Z)' },
      { value: 'title-desc', label: 'Title (Z-A)' },
    ];
    if (activeTemplate?.fields) {
      const extraFields = activeTemplate.fields.filter(
        f => !['title', 'image', 'cover', 'thumbnail', 'heroImage'].includes(f.name) &&
             f.type !== 'object' && f.type !== 'array'
      );
      extraFields.forEach(f => {
        baseOptions.push(
          { value: `${f.name}-asc`, label: `${f.name} (A→Z)` },
          { value: `${f.name}-desc`, label: `${f.name} (Z→A)` },
        );
      });
    }
    return baseOptions;
  }, [activeTemplate]);

  const filteredPosts = useMemo(() => {
      let result = posts;

      // Text search
      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          result = result.filter(p => 
              p.name.toLowerCase().includes(q) || 
              (p.frontmatter.title && String(p.frontmatter.title).toLowerCase().includes(q)) ||
              (p.frontmatter.author && String(p.frontmatter.author).toLowerCase().includes(q))
          );
      }

      // WF-08: Apply template-based filters
      for (const [field, filter] of Object.entries(activeFilters) as [string, FilterValue][]) {
        result = result.filter(post => matchesFilter(post.frontmatter[field], filter));
      }
      
      // Sort logic (supports dynamic field-based sorting)
      result = [...result].sort((a, b) => {
          const dateA = new Date(a.frontmatter.date || a.frontmatter.publishDate || 0).getTime();
          const dateB = new Date(b.frontmatter.date || b.frontmatter.publishDate || 0).getTime();
          const titleA = (a.frontmatter.title || a.name).toLowerCase();
          const titleB = (b.frontmatter.title || b.name).toLowerCase();

          if (sortOption === 'date-desc') return dateB - dateA;
          if (sortOption === 'date-asc') return dateA - dateB;
          if (sortOption === 'title-asc') return titleA.localeCompare(titleB);
          if (sortOption === 'title-desc') return titleB.localeCompare(titleA);

          // WF-08: Dynamic field sorting
          const match = sortOption.match(/^(.+)-(asc|desc)$/);
          if (match) {
            const [, field, direction] = match;
            const valA = a.frontmatter[field];
            const valB = b.frontmatter[field];
            let cmp = 0;
            if (valA === undefined || valA === null) cmp = 1;
            else if (valB === undefined || valB === null) cmp = -1;
            else if (typeof valA === 'number' && typeof valB === 'number') cmp = valA - valB;
            else if (valA instanceof Date || (typeof valA === 'string' && !isNaN(Date.parse(String(valA))))) {
              cmp = new Date(valA).getTime() - new Date(valB).getTime();
            } else {
              cmp = String(valA).localeCompare(String(valB));
            }
            return direction === 'desc' ? -cmp : cmp;
          }
          return 0;
      });

      return result;
  }, [posts, searchQuery, sortOption, activeFilters]);

  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
  const currentPosts = filteredPosts.slice((currentPage - 1) * POSTS_PER_PAGE, currentPage * POSTS_PER_PAGE);

  // --- Actions ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setUploadFile(e.target.files[0]);
          setIsUploadModalOpen(true);
          e.target.value = '';
      }
  };

  const confirmUpload = async () => {
      if (!uploadFile) return;
      setIsUploading(true);
      try {
          const reader = new FileReader();
          reader.onload = async (e) => {
              const content = e.target?.result as string;
              const commitMsg = `feat(content): add post "${uploadFile.name}"`;
              const filePath = path ? `${path}/${uploadFile.name}` : uploadFile.name;
              
              await gitService.createFileFromString(filePath, content, commitMsg);
              onAction();
              fetchPosts();
              setIsUploadModalOpen(false);
              setUploadFile(null);
          };
          reader.readAsText(uploadFile);
      } catch (e) {
          alert("Upload failed");
      } finally {
          setIsUploading(false);
      }
  };

  // Update specific post file
  const handleUpdatePostFile = (post: PostData) => {
      setPostToUpdateFile(post);
      updatePostFileInputRef.current?.click();
  };

  const confirmUpdatePostFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !postToUpdateFile) return;

      setIsUploading(true);
      try {
          const reader = new FileReader();
          reader.onload = async (ev) => {
              const content = ev.target?.result as string;
              const commitMsg = updatePostCommitTemplate.replace('{filename}', postToUpdateFile.name) || `fix(content): update post "${postToUpdateFile.name}"`;
              
              await gitService.updateFileContent(postToUpdateFile.path, content, commitMsg, postToUpdateFile.sha);
              onAction();
              fetchPosts();
              setPostToUpdateFile(null);
          };
          reader.readAsText(file);
      } catch (err) {
          alert("Update failed");
      } finally {
          setIsUploading(false);
          e.target.value = '';
      }
  };

  // Update specific post image
  const handleUpdateImage = (post: PostData) => {
      setPostToUpdateImage(post);
      setIsImageModalOpen(true);
  };

  const handleImageConfirm = async (result: { type: 'new' | 'existing', file?: File, path?: string }) => {
      if (!postToUpdateImage) return;
      setIsUploading(true);
      try {
          let imageUrl = '';
          // 1. Upload if new
          if (result.type === 'new' && result.file) {
              const commitMsg = `feat(assets): add image "${result.file.name}"`;
              const fullPath = imagesPath ? `${imagesPath}/${result.file.name}` : result.file.name;
              await gitService.uploadFile(fullPath, result.file, commitMsg);
              imageUrl = fullPath;
          } else if (result.type === 'existing' && result.path) {
              imageUrl = result.path;
          }

          if (imageUrl) {
              // Format URL based on project settings
              let finalUrl = imageUrl;
              
              // Standardize: if starting with public/, remove it for the MD/frontmatter reference
              // this makes the paths work in local Astro dev environments.
              if (finalUrl.startsWith('public/')) {
                  finalUrl = finalUrl.replace('public/', '/');
              } else if (!finalUrl.startsWith('http') && !finalUrl.startsWith('/')) {
                  finalUrl = '/' + finalUrl;
              }

              // 2. Update Frontmatter
              // Determine which field to update
              const fm = postToUpdateImage.frontmatter;
              let targetField = 'image';
              if (fm.cover) targetField = 'cover';
              else if (fm.thumbnail) targetField = 'thumbnail';
              else if (fm.heroImage) targetField = 'heroImage';

              const newContent = updateFrontmatter(postToUpdateImage.rawContent, { [targetField]: finalUrl });
              const commitMsg = `fix(content): update image for "${postToUpdateImage.name}"`;
              
              await gitService.updateFileContent(postToUpdateImage.path, newContent, commitMsg, postToUpdateImage.sha);
              onAction();
              fetchPosts();
          }
      } catch (e) {
          alert("Failed to update image");
          console.error(e);
      } finally {
          setIsUploading(false);
          setIsImageModalOpen(false);
          setPostToUpdateImage(null);
      }
  };

  const confirmDelete = async () => {
      if (!postToDelete) return;
      setIsDeleting(true);
      try {
          const commitMsg = `chore(content): delete post "${postToDelete.name}"`;
          await gitService.deleteFile(postToDelete.path, postToDelete.sha, commitMsg);
          onAction();
          fetchPosts();
          if (selectedPost?.path === postToDelete.path) setSelectedPost(null);
      } catch (e) {
          alert("Delete failed");
      } finally {
          setIsDeleting(false);
          setPostToDelete(null);
      }
  };

  // Helper to resolve image URLs for display
  const resolveImageUrl = (thumbnailUrl: string | null): string | null | 'needs-domain' => {
    if (!thumbnailUrl) return null;
    if (thumbnailUrl.startsWith('http') || thumbnailUrl.startsWith('data:')) return thumbnailUrl;
    
    // BUG-11: Use central utility for consistent image source resolution
    const resolved = resolveImageSource(thumbnailUrl, repo, projectType, domainUrl);
    
    if (!resolved && thumbnailUrl.startsWith('/') && !domainUrl && projectType === 'astro') {
        return 'needs-domain';
    }
    
    return resolved || null;
  };

  const renderDynamicCell = (post: PostData, field: string) => {
      // Date handling
      if (field.toLowerCase().includes('date')) {
          let dateVal = post.frontmatter[field];
          if (!dateVal && field === 'date') {
               // Fallback common date fields
               dateVal = post.frontmatter.publishDate || post.frontmatter.pubDate;
          }
          if (dateVal) {
             const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
             if (!isNaN(d.getTime())) {
                 const dateOptions: Intl.DateTimeFormatOptions = language === 'vi' 
                    ? { year: 'numeric', month: '2-digit', day: '2-digit' } 
                    : { year: 'numeric', month: 'short', day: 'numeric' };
                 return <span className="text-notion-text text-xs whitespace-nowrap">{d.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', dateOptions)}</span>;
             }
             return <span className="text-notion-text text-xs whitespace-normal break-words">{String(dateVal)}</span>;
          }
          return <span className="text-gray-300 text-xs">-</span>;
      }

      const val = post.frontmatter[field];
      if (val === undefined || val === null || val === '') return <span className="text-gray-300 text-xs">-</span>;
      
      // Array (Tags) handling - Changed to text with commas
      if (Array.isArray(val) && val.length > 0) {
        return (
            <span className="text-notion-text text-xs whitespace-normal break-words leading-snug">
                {val.join(', ')}
            </span>
        );
      }
      
      if (typeof val === 'object' && val !== null) {
        return <span className="text-[10px] text-notion-muted italic">[Object]</span>
      }

      return <span className="text-notion-text text-xs block whitespace-normal break-words leading-snug line-clamp-2" title={String(val)}>{String(val)}</span>;
  };

  if (selectedPost) {
      return (
          <PostDetailView 
            post={selectedPost} 
            onBack={() => setSelectedPost(null)}
            onDelete={(p) => setPostToDelete(p)}
            gitService={gitService}
            repo={repo}
            projectType={projectType}
            domainUrl={domainUrl}
            onUpdate={fetchPosts}
            imagesPath={imagesPath}
            imageFileTypes={imageFileTypes}
            onAction={onAction}
          />
      );
  }

  return (
    <div className="space-y-4">
      <input type="file" ref={uploadPostInputRef} className="hidden" accept={postFileTypes} onChange={handleFileUpload} />
      <input type="file" ref={updatePostFileInputRef} className="hidden" accept={postFileTypes} onChange={confirmUpdatePostFile} />
      
      {isUploadModalOpen && uploadFile && (
          <PostUploadValidationModal 
            file={uploadFile}
            gitService={gitService}
            repo={repo}
            onConfirm={confirmUpload}
            onCancel={() => { setIsUploadModalOpen(false); setUploadFile(null); }}
          />
      )}

      {isImageModalOpen && (
          <PostImageSelectionModal
            gitService={gitService}
            imagesPath={imagesPath}
            imageFileTypes={imageFileTypes}
            onClose={() => setIsImageModalOpen(false)}
            onConfirm={handleImageConfirm}
          />
      )}

      <ConfirmationModal 
        isOpen={!!postToDelete}
        onClose={() => setPostToDelete(null)}
        onConfirm={confirmDelete}
        title={t('postList.deleteConfirm', { name: postToDelete?.name || '' })}
        description={t('postList.deleteConfirm', { name: postToDelete?.name || '' })}
        confirmLabel={t('postPreview.delete')}
        isProcessing={isDeleting}
      />

      {/* Toolbar */}
      <div className="mb-4 flex flex-col sm:flex-row gap-2 justify-between items-center z-10 relative">
        <div className="relative flex-grow w-full sm:w-auto max-w-md">
            <input
            type="text"
            placeholder={t('postList.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
            }}
            className="w-full pl-8 pr-4 py-1.5 bg-transparent border border-notion-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-notion-blue focus:bg-white transition-all text-notion-text placeholder-notion-muted/70 shadow-sm"
            />
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
            <SearchIcon className="h-3.5 w-3.5 text-notion-muted" />
            </div>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* WF-08: Filter toggle */}
            {activeTemplate && (
              <button
                onClick={() => setIsFilterOpen(prev => !prev)}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-sm border transition-colors shadow-sm ${
                  isFilterOpen || Object.keys(activeFilters).length > 0
                    ? 'bg-notion-blue text-white border-notion-blue'
                    : 'bg-white text-notion-text border-notion-border hover:bg-gray-50'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filter
                {Object.keys(activeFilters).length > 0 && (
                  <span className="text-[10px] font-bold bg-white/20 rounded-full px-1.5">
                    {Object.keys(activeFilters).length}
                  </span>
                )}
              </button>
            )}

            {/* Sort Dropdown (WF-08: dynamic options from template) */}
            <div className="relative">
                <select 
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as SortOption)}
                    className="appearance-none pl-3 pr-8 py-1.5 bg-white border border-notion-border rounded-sm text-xs font-medium text-notion-text focus:outline-none focus:ring-1 focus:ring-notion-blue shadow-sm cursor-pointer hover:bg-gray-50"
                >
                    {dynamicSortOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-notion-muted">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
            </div>

            <div className="flex bg-notion-sidebar p-0.5 rounded-sm border border-notion-border">
                <button 
                    onClick={() => setViewMode('table')}
                    className={`p-1 rounded-sm transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-notion-text' : 'text-notion-muted hover:text-notion-text hover:bg-gray-200/50'}`}
                    title={t('postList.viewMode.table')}
                >
                    <ViewListIcon className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => setViewMode('grid')}
                    className={`p-1 rounded-sm transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-notion-text' : 'text-notion-muted hover:text-notion-text hover:bg-gray-200/50'}`}
                    title={t('postList.viewMode.grid')}
                >
                    <ViewGridIcon className="w-4 h-4" />
                </button>
            </div>

            <button
                onClick={() => uploadPostInputRef.current?.click()}
                className="flex items-center justify-center px-3 py-1.5 bg-notion-blue hover:bg-blue-600 text-white text-xs font-medium rounded-sm transition-colors shadow-sm"
            >
                <UploadIcon className="w-3.5 h-3.5 mr-1.5" />
                {t('postList.uploadButton')}
            </button>
        </div>
      </div>

      {/* WF-08: FilterBar */}
      {isFilterOpen && activeTemplate && (
        <FilterBar
          template={activeTemplate}
          posts={posts}
          activeFilters={activeFilters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />
      )}

      {isLoading ? (
          <div className="flex justify-center items-center h-64">
              <SpinnerIcon className="w-8 h-8 animate-spin text-notion-muted" />
              <span className="ml-3 text-notion-muted">{t('postList.loading')}</span>
          </div>
      ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-sm">
              {error}
          </div>
      ) : currentPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border border-dashed border-notion-border rounded-sm bg-gray-50">
              <DocumentIcon className="w-10 h-10 text-notion-muted mb-2" />
              <p className="text-notion-muted">{t('postList.noPosts')}</p>
          </div>
      ) : (
          <div>
              {/* Grid or Table View */}
              {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {currentPosts.map(post => (
                          <div 
                            key={post.sha} 
                            onClick={() => setSelectedPost(post)}
                            className="bg-white border border-notion-border rounded-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden flex flex-col h-full"
                          >
                              <div className="h-32 bg-gray-100 overflow-hidden relative border-b border-notion-border">
                                {projectType === 'github' && repo.private && post.thumbnailUrl ? (
                                    <ThumbnailWithAuth gitService={gitService} imagePath={post.thumbnailUrl} className="w-full h-full object-cover" />
                                ) : (() => {
                                    const resolvedUrl = resolveImageUrl(post.thumbnailUrl);
                                    if (resolvedUrl && resolvedUrl !== 'needs-domain') {
                                        return <img src={resolvedUrl} alt="" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />;
                                    } else {
                                        return (
                                            <div className="flex items-center justify-center w-full h-full text-notion-muted">
                                                <DocumentIcon className="w-8 h-8 opacity-50" />
                                            </div>
                                        );
                                    }
                                })()}
                              </div>
                              <div className="p-4 flex-grow">
                                  <h3 className="text-sm font-semibold text-notion-text mb-1 line-clamp-2">{post.frontmatter.title || post.name}</h3>
                                  <div className="text-xs text-notion-muted line-clamp-3">
                                      {post.frontmatter.description || post.frontmatter.excerpt || (post.body ? post.body.substring(0, 100) : '')}
                                  </div>
                              </div>
                              <div className="px-4 py-2 border-t border-notion-border text-[10px] text-notion-muted flex justify-between items-center bg-gray-50">
                                  <span>{post.frontmatter.date ? new Date(post.frontmatter.date).toLocaleDateString() : 'No Date'}</span>
                                  <span>{post.frontmatter.author}</span>
                              </div>
                          </div>
                      ))}
                  </div>
              ) : (
                  <div className="border border-notion-border rounded-sm overflow-x-auto bg-white">
                      <table className="w-full divide-y divide-notion-border text-sm table-fixed">
                          <colgroup>
                              <col style={{ width: `${columnWidths['__name__'] || 35}%` }} />
                              {visibleFields.map(field => (
                                  <col key={field} style={{ width: `${columnWidths[field] || 15}%` }} />
                              ))}
                              <col style={{ width: '100px' }} />
                          </colgroup>
                          <thead className="bg-notion-sidebar text-notion-muted font-semibold">
                              <tr>
                                  <th
                                    className="px-4 py-2 text-left text-xs font-normal border-r border-notion-border uppercase tracking-wide select-none truncate cursor-pointer hover:bg-gray-100 transition-colors"
                                    onClick={() => handleColumnSort('title')}
                                  >
                                    <span className="flex items-center gap-1">
                                      Name
                                      {getSortIndicator('title') && <span className="text-notion-blue text-[10px]">{getSortIndicator('title')}</span>}
                                    </span>
                                  </th>
                                  {visibleFields.map(field => (
                                      <th
                                        key={field}
                                        className="px-4 py-2 text-left text-xs font-normal border-r border-notion-border uppercase tracking-wide select-none truncate cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => handleColumnSort(field)}
                                      >
                                        <span className="flex items-center gap-1">
                                          {field}
                                          {getSortIndicator(field) && <span className="text-notion-blue text-[10px]">{getSortIndicator(field)}</span>}
                                        </span>
                                      </th>
                                  ))}
                                  <th className="px-4 py-2 w-10"></th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-notion-border">
                              {currentPosts.map(post => (
                                  <tr key={post.sha} onClick={() => setSelectedPost(post)} className="hover:bg-notion-hover/50 cursor-pointer group transition-colors">
                                      <td className="px-4 py-2 border-r border-notion-border overflow-hidden">
                                          <div className="flex items-start gap-3">
                                              {/* Mini Thumbnail */}
                                              <div className="w-8 h-8 flex-shrink-0 mt-0.5 bg-gray-100 rounded-sm border border-notion-border overflow-hidden">
                                                  {projectType === 'github' && repo.private && post.thumbnailUrl ? (
                                                      <ThumbnailWithAuth gitService={gitService} imagePath={post.thumbnailUrl} className="w-full h-full object-cover" />
                                                  ) : (() => {
                                                      const resolvedUrl = resolveImageUrl(post.thumbnailUrl);
                                                      return resolvedUrl && resolvedUrl !== 'needs-domain' ? (
                                                          <img src={resolvedUrl} alt="" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
                                                      ) : (
                                                          <div className="flex items-center justify-center w-full h-full text-notion-muted">
                                                              <DocumentIcon className="w-4 h-4" />
                                                          </div>
                                                      );
                                                  })()}
                                              </div>
                                              
                                              <div className="min-w-0">
                                                  <span className="font-medium text-notion-text block truncate" title={post.frontmatter.title || post.name}>
                                                      {post.frontmatter.title || post.name}
                                                  </span>
                                              </div>
                                          </div>
                                      </td>
                                      
                                      {visibleFields.map(field => (
                                          <td key={field} className="px-4 py-2 border-r border-notion-border align-top overflow-hidden">
                                              {renderDynamicCell(post, field)}
                                          </td>
                                      ))}

                                      <td className="px-4 py-2 text-right">
                                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button
                                                  onClick={(e) => { e.stopPropagation(); handleUpdatePostFile(post); }}
                                                  className="p-1 text-notion-muted hover:text-notion-text hover:bg-gray-200 rounded-sm transition-colors"
                                                  title={t('postList.updateFile')}
                                              >
                                                  <DocumentIcon className="w-4 h-4" />
                                              </button>
                                              <button
                                                  onClick={(e) => { e.stopPropagation(); handleUpdateImage(post); }}
                                                  className="p-1 text-notion-muted hover:text-notion-text hover:bg-gray-200 rounded-sm transition-colors"
                                                  title={t('postList.updateImage')}
                                              >
                                                  <ImageIcon className="w-4 h-4" />
                                              </button>
                                              <button 
                                                onClick={(e) => { e.stopPropagation(); setPostToDelete(post); }} 
                                                className="text-notion-muted hover:text-red-600 hover:bg-red-50 p-1 rounded-sm transition-colors"
                                              >
                                                  <TrashIcon className="w-4 h-4" />
                                              </button>
                                          </div>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                  <div className="mt-4 flex justify-center gap-2">
                      <button 
                        disabled={currentPage === 1} 
                        onClick={() => setCurrentPage(p => p - 1)}
                        className="px-3 py-1 bg-white border border-notion-border rounded-sm text-xs disabled:opacity-50 hover:bg-notion-hover"
                      >
                          {t('postList.pagination.prev')}
                      </button>
                      <span className="text-xs flex items-center text-notion-muted">
                          {t('postList.pagination.pageInfo', { current: currentPage, total: totalPages })}
                      </span>
                      <button 
                        disabled={currentPage === totalPages} 
                        onClick={() => setCurrentPage(p => p + 1)}
                        className="px-3 py-1 bg-white border border-notion-border rounded-sm text-xs disabled:opacity-50 hover:bg-notion-hover"
                      >
                          {t('postList.pagination.next')}
                      </button>
                  </div>
              )}
          </div>
      )}
    </div>
  );
};

export default PostList;
