
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TrashIcon } from './icons/TrashIcon';
import { useI18n } from '../i18n/I18nContext';
import { useCollectionStore } from '../features/collections/store';
import { DocumentIcon } from './icons/DocumentIcon';
import { ArrowUturnLeftIcon } from './icons/ArrowUturnLeftIcon';
import { ClockIcon } from './icons/ClockIcon';
import { GithubRepo, IGitService } from '../types';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { ImageIcon } from './icons/ImageIcon';
import { updateFrontmatter } from '../utils/parsing';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { PlusIcon } from './icons/PlusIcon';
import PostImageSelectionModal from './PostImageSelectionModal';

// Declare global variables from CDN scripts
declare global {
  interface Window {
    marked: {
      parse: (markdown: string) => string;
    };
    DOMPurify: {
      sanitize: (html: string) => string;
    };
  }
}

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

interface PostDetailViewProps {
  post: PostData;
  onBack: () => void;
  onDelete: (post: PostData) => void;
  gitService: IGitService;
  repo: GithubRepo;
  projectType: 'astro' | 'github';
  domainUrl: string;
  onUpdate: () => void;
  imagesPath: string;
  imageFileTypes: string;
  onAction: () => void;
}

// --- Cover Image Component (Handles Auth/Lazy loading) ---
const CoverImage: React.FC<{ 
    thumbnailUrl: string | null, 
    gitService: IGitService, 
    repo: GithubRepo, 
    domainUrl: string, 
    projectType: 'astro' | 'github',
    className?: string
}> = ({ thumbnailUrl, gitService, repo, domainUrl, projectType, className }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!thumbnailUrl) {
            setImageUrl(null);
            return;
        }

        if (thumbnailUrl.startsWith('http')) {
            setImageUrl(thumbnailUrl);
            return;
        }

        // Logic for relative paths
        const resolve = async () => {
            setIsLoading(true);
            try {
                if (projectType === 'github' && repo.private) {
                    const fullPath = thumbnailUrl.startsWith('/') ? thumbnailUrl.substring(1) : thumbnailUrl;
                    const blob = await gitService.getFileAsBlob(fullPath);
                    const url = URL.createObjectURL(blob);
                    setImageUrl(url);
                } else if (projectType === 'astro' && domainUrl) {
                    // Astro Web Project
                    const cleanDomain = domainUrl.replace(/\/$/, '');
                    const cleanPath = thumbnailUrl.startsWith('/') ? thumbnailUrl : `/${thumbnailUrl}`;
                    setImageUrl(`${cleanDomain}${cleanPath}`);
                } else if (projectType === 'github') {
                    // Public Github
                    const path = thumbnailUrl.startsWith('/') ? thumbnailUrl : `/${thumbnailUrl}`;
                    setImageUrl(`https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}/${path}`);
                } else {
                    setImageUrl(null); // Fallback or needs domain
                }
            } catch (e) {
                console.error("Failed to load cover image", e);
                setImageUrl(null);
            } finally {
                setIsLoading(false);
            }
        };
        resolve();

        return () => {
            if (imageUrl && imageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(imageUrl);
            }
        };
    }, [thumbnailUrl, repo, domainUrl, projectType, gitService]);

    if (!thumbnailUrl) return null;

    return (
        <div className={`relative overflow-hidden group bg-gray-50 ${className}`}>
            {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                    <SpinnerIcon className="w-6 h-6 animate-spin text-notion-muted" />
                </div>
            ) : imageUrl ? (
                <img src={imageUrl} alt="Cover" className="w-full h-full object-cover" />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-notion-muted">
                    <ImageIcon className="w-8 h-8 opacity-50" />
                </div>
            )}
        </div>
    );
};

const PostDetailView: React.FC<PostDetailViewProps> = ({ post, onBack, onDelete, gitService, repo, projectType, domainUrl, onUpdate, imagesPath, imageFileTypes, onAction }) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const { t, language } = useI18n();

  // --- Editable State ---
  const [editableFrontmatter, setEditableFrontmatter] = useState<Record<string, any>>(post.frontmatter);
  const [editableBody, setEditableBody] = useState<string>(post.body);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  
  // Updates specific to Detail View
  const updatePostFileInputRef = useRef<HTMLInputElement>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Auto-resize title textarea
  useEffect(() => {
      if (titleTextareaRef.current) {
          titleTextareaRef.current.style.height = 'auto';
          titleTextareaRef.current.style.height = titleTextareaRef.current.scrollHeight + 'px';
      }
  }, [editableFrontmatter.title]);

  // Calculate missing fields on mount based on template
  useEffect(() => {
      const { getActiveCollection } = useCollectionStore.getState();
      const activeCollection = getActiveCollection();
      
      if (activeCollection?.template) {
          const templateKeys = activeCollection.template.fields.map(f => f.name);
          const currentKeys = Object.keys(editableFrontmatter);
          const missing = templateKeys.filter(key => !currentKeys.includes(key));
          setMissingFields(missing);
      }
  }, [editableFrontmatter]); // Re-calc if frontmatter changes (e.g. adding a field)

  // Scroll to top when component mounts
  useEffect(() => {
      const container = document.getElementById('post-detail-container');
      if (container) container.scrollTop = 0;
  }, [post.sha]);

  // Handle Input Changes
  const handleFrontmatterChange = (key: string, value: any) => {
      setEditableFrontmatter(prev => ({
          ...prev,
          [key]: value
      }));
      setIsDirty(true);
  };

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditableBody(e.target.value);
      setIsDirty(true);
  };

  const handleAddMissingField = (key: string) => {
      let defaultValue: any = "";
      if (key === 'date' || key === 'publishDate') defaultValue = new Date().toISOString().split('T')[0];
      if (key === 'tags') defaultValue = [];
      
      handleFrontmatterChange(key, defaultValue);
      setMissingFields(prev => prev.filter(k => k !== key));
  };

  const handleSave = async () => {
      if (!isDirty) return;
      setIsSaving(true);
      try {
          const finalContent = updateFrontmatter(editableBody, editableFrontmatter);
          const commitMessage = `fix(content): update post "${post.name}" from editor`;
          
          await gitService.updateFileContent(post.path, finalContent, commitMessage, post.sha);
          onAction(); // Trigger sync
          onUpdate(); // Refresh parent list logic if needed (e.g. update list cache)
          setIsDirty(false);
      } catch (e) {
          alert(`Failed to save: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
          setIsSaving(false);
      }
  };

  // --- External Actions (Update File / Image) ---
  
  const handleUpdateFile = () => {
      updatePostFileInputRef.current?.click();
  }

  const confirmUpdateFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      try {
          const reader = new FileReader();
          reader.onload = async (ev) => {
              const content = ev.target?.result as string;
              const commitMsg = `fix(content): update post "${post.name}" content`;
              await gitService.updateFileContent(post.path, content, commitMsg, post.sha);
              
              onAction(); // Trigger sync
              
              // Instead of full refresh, maybe reload current post data?
              // For simplicity, we call onBack to list or trigger parent update.
              // Here we try to update local state to reflect new file content immediately
              onUpdate();
              onBack(); // Go back to list to see updated data
          };
          reader.readAsText(file);
      } catch (err) {
          alert("Update failed");
      } finally {
          setIsUploading(false);
          e.target.value = '';
      }
  };

  const handleUpdateImage = () => {
      setIsImageModalOpen(true);
  }

  const handleImageConfirm = async (result: { type: 'new' | 'existing', file?: File, path?: string }) => {
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
              if (projectType === 'astro' && domainUrl) {
                  let relPath = imageUrl;
                  if (relPath.startsWith('public/')) relPath = relPath.replace('public/', '/');
                  else if (!relPath.startsWith('/')) relPath = '/' + relPath;
                  const cleanDomain = domainUrl.replace(/\/$/, '');
                  finalUrl = `${cleanDomain}${relPath}`;
              } else {
                  // Keep relative path or cleanup for other types if needed
                  if (imageUrl.startsWith('public/')) finalUrl = imageUrl.replace('public/', '/');
                  else if (!imageUrl.startsWith('/')) finalUrl = '/' + imageUrl;
              }

              // 2. Update Frontmatter
              // Determine which field to update
              const fm = editableFrontmatter;
              let targetField = 'image';
              if (fm.cover) targetField = 'cover';
              else if (fm.thumbnail) targetField = 'thumbnail';
              else if (fm.heroImage) targetField = 'heroImage';

              // Update local state
              const updatedFM = { ...fm, [targetField]: finalUrl };
              const newContent = updateFrontmatter(editableBody, updatedFM);
              const commitMsg = `fix(content): update image for "${post.name}"`;
              
              await gitService.updateFileContent(post.path, newContent, commitMsg, post.sha);
              
              onAction(); // Trigger sync
              setEditableFrontmatter(updatedFM);
              // Force reload cover image if possible, usually requires re-mount or key change
              onUpdate();
          }
      } catch (e) {
          alert("Failed to update image");
          console.error(e);
      } finally {
          setIsUploading(false);
          setIsImageModalOpen(false);
      }
  };

  const processContentImages = (content: string) => {
      if (!content) return '';
      
      const resolveUrl = (url: string) => {
          if (url.startsWith('http') || url.startsWith('https') || url.startsWith('data:')) return url;
          
          if (projectType === 'github' && !repo.private) {
               const path = url.startsWith('/') ? url : `/${url}`;
               return `https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}${path}`;
          }

          if (projectType === 'astro' && domainUrl) {
              const cleanDomain = domainUrl.replace(/\/$/, '');
              let path = url;
              if (path.startsWith('public/')) path = path.replace('public/', '/');
              if (!path.startsWith('/')) path = '/' + path;
              return `${cleanDomain}${path}`;
          }
          
          return url;
      };

      // 1. Replace Markdown images: ![alt](url "title")
      let processed = content.replace(/(!\[.*?\])\(([^)\s]+)(.*?)\)/g, (match, prefix, url, suffix) => {
          const newUrl = resolveUrl(url);
          return `${prefix}(${newUrl}${suffix})`;
      });

      // 2. Replace HTML images: <img src="url">
      processed = processed.replace(/(<img[^>]+src=["'])([^"']+)(["'][^>]*>)/gi, (match, prefix, url, suffix) => {
          const newUrl = resolveUrl(url);
          return `${prefix}${newUrl}${suffix}`;
      });

      return processed;
  };

  const createMarkup = (markdownContent: string) => {
    if (window.marked && window.DOMPurify) {
      const processedContent = processContentImages(markdownContent);
      const rawMarkup = window.marked.parse(processedContent);
      const sanitizedMarkup = window.DOMPurify.sanitize(rawMarkup);
      return { __html: sanitizedMarkup };
    }
    return { __html: '<p>Preview library not loaded.</p>' };
  };
  
  const renderInput = (key: string, value: any) => {
      const isDate = value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)) && value.includes('-') && value.length === 10);
      const isArray = Array.isArray(value);

      if (isArray) {
          // Edit array as comma-separated string
          return (
              <input 
                type="text" 
                className="w-full bg-transparent border-b border-transparent focus:border-notion-blue focus:ring-0 text-sm py-0.5 px-1 hover:bg-notion-hover/50 rounded-sm transition-colors"
                value={value.join(', ')}
                onChange={(e) => handleFrontmatterChange(key, e.target.value.split(',').map((s: string) => s.trim()).filter((s: string) => s))}
              />
          );
      }

      if (isDate) {
          const dateStr = value instanceof Date ? value.toISOString().split('T')[0] : value;
          return (
              <input 
                type="date"
                className="w-full bg-transparent border-b border-transparent focus:border-notion-blue focus:ring-0 text-sm py-0.5 px-1 hover:bg-notion-hover/50 rounded-sm transition-colors cursor-pointer"
                value={dateStr}
                onChange={(e) => handleFrontmatterChange(key, e.target.value)} // Date input returns YYYY-MM-DD
              />
          );
      }

      if (typeof value === 'object' && value !== null) {
          return <span className="text-notion-muted text-sm italic px-1">[Complex Object - Editing Disabled]</span>;
      }

      return (
        <input 
            type="text" 
            className="w-full bg-transparent border-b border-transparent focus:border-notion-blue focus:ring-0 text-sm py-0.5 px-1 hover:bg-notion-hover/50 rounded-sm transition-colors"
            value={String(value || '')}
            onChange={(e) => handleFrontmatterChange(key, e.target.value)}
        />
      );
  };

  const hasCoverImage = !!(editableFrontmatter.image || editableFrontmatter.cover || editableFrontmatter.thumbnail || editableFrontmatter.heroImage || post.thumbnailUrl);

  return (
    <div className="h-full flex flex-col bg-white animate-fade-in relative -mx-6 sm:-mx-8 lg:-mx-12 -my-8">
      <input type="file" ref={updatePostFileInputRef} className="hidden" accept=".md,.mdx" onChange={confirmUpdateFile} />
      
      {isImageModalOpen && (
          <PostImageSelectionModal
            gitService={gitService}
            imagesPath={imagesPath}
            imageFileTypes={imageFileTypes}
            onClose={() => setIsImageModalOpen(false)}
            onConfirm={handleImageConfirm}
          />
      )}

      {/* Sticky Header - Aligned to Content */}
      <header className="h-12 border-b border-notion-border bg-white sticky top-0 z-30 flex-shrink-0 backdrop-blur-md bg-white/85">
        <div className="max-w-4xl mx-auto px-8 lg:px-12 h-full flex justify-between items-center w-full">
            <div className="flex items-center gap-2 overflow-hidden">
                <button 
                        onClick={onBack}
                        className="flex items-center text-sm text-notion-text hover:bg-notion-hover px-2 py-1 rounded-sm transition-colors"
                >
                    <ArrowUturnLeftIcon className="w-4 h-4 mr-1.5 text-notion-muted" />
                    <span className="font-medium">Back</span>
                </button>
                <span className="text-notion-border text-lg font-light">|</span>
                <div className="flex items-center text-sm text-notion-muted truncate">
                        <span className="truncate font-medium text-notion-text text-sm max-w-[200px]">{editableFrontmatter.title || post.name}</span>
                </div>
            </div>
            
            <div className="flex items-center space-x-2">
                {/* Quick Actions */}
                <button
                    onClick={handleUpdateFile}
                    disabled={isUploading}
                    className="flex items-center px-2 py-1 text-notion-muted hover:text-notion-text hover:bg-notion-hover rounded-sm text-xs font-medium transition-colors"
                    title={t('postList.updateFile')}
                >
                    <DocumentIcon className="w-3.5 h-3.5 mr-1" />
                    <span className="hidden sm:inline">Update File</span>
                </button>
                <button
                    onClick={handleUpdateImage}
                    disabled={isUploading}
                    className="flex items-center px-2 py-1 text-notion-muted hover:text-notion-text hover:bg-notion-hover rounded-sm text-xs font-medium transition-colors"
                    title={t('postList.updateImage')}
                >
                    <ImageIcon className="w-3.5 h-3.5 mr-1" />
                    <span className="hidden sm:inline">Update Image</span>
                </button>

                <div className="w-[1px] h-4 bg-notion-border mx-1"></div>

                {isDirty && (
                    <button
                        onClick={handleSave}
                        disabled={isSaving || isUploading}
                        className="flex items-center px-3 py-1 bg-notion-blue text-white text-xs font-medium rounded-sm shadow-sm hover:bg-blue-600 transition-colors disabled:opacity-50 mr-2"
                    >
                        {isSaving ? <SpinnerIcon className="w-3 h-3 animate-spin mr-1.5" /> : <CheckCircleIcon className="w-3.5 h-3.5 mr-1.5" />}
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>
                )}
                
                <button
                    onClick={() => onDelete(post)}
                    className="p-1.5 text-notion-muted hover:text-red-600 hover:bg-notion-hover rounded-sm transition-colors flex items-center text-xs font-medium"
                    title={t('postPreview.delete')}
                >
                    <TrashIcon className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">{t('postPreview.delete')}</span>
                </button>
            </div>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <div id="post-detail-container" className="flex-grow overflow-y-auto bg-white custom-scrollbar pb-20">
            <div className="max-w-4xl mx-auto px-8 lg:px-12 py-8 relative w-full">
                
                {/* Contained Cover Image */}
                {hasCoverImage && (
                    <CoverImage 
                        thumbnailUrl={editableFrontmatter.image || editableFrontmatter.cover || editableFrontmatter.thumbnail || editableFrontmatter.heroImage || post.thumbnailUrl} 
                        gitService={gitService} 
                        repo={repo} 
                        domainUrl={domainUrl} 
                        projectType={projectType}
                        className="w-full h-48 object-cover rounded-xl shadow-sm border border-notion-border mb-[-2rem]"
                    />
                )}

                {/* Floating Icon */}
                <div className="relative z-10 pl-2">
                    <div className={`
                        w-20 h-20 rounded-md shadow-sm flex items-center justify-center text-4xl select-none bg-white
                        ${hasCoverImage ? '' : 'mt-12 mb-[-1rem]'}
                    `}>
                        <span className="transform -translate-y-0.5">📄</span>
                    </div>
                </div>

                <div className="pt-8">
                    {/* Title - Auto Resizing Textarea */}
                    <textarea 
                        ref={titleTextareaRef}
                        className="text-4xl font-bold text-notion-text mb-8 break-words leading-tight tracking-tight w-full border-none focus:ring-0 p-0 placeholder-gray-300 resize-none overflow-hidden bg-transparent mt-4"
                        value={editableFrontmatter.title || ''}
                        onChange={(e) => {
                            handleFrontmatterChange('title', e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        onKeyDown={(e) => { if(e.key === 'Enter') e.preventDefault(); }}
                        placeholder="Untitled"
                        rows={1}
                    />

                    {/* Metadata Grid */}
                    <div className="mb-10 space-y-0 text-sm">
                        {/* Existing Fields */}
                        {Object.entries(editableFrontmatter).filter(([k]) => k !== 'title').map(([key, value]) => (
                            <div key={key} className="flex py-1.5 group items-start">
                                <div className="w-32 flex-shrink-0 flex items-center text-notion-muted pt-1">
                                    <div className="flex items-center px-1.5 py-0.5 rounded-sm transition-colors cursor-default">
                                        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 mr-2 fill-current opacity-60 flex-shrink-0"><path d="M1.5 6.5a1 1 0 011-1h11a1 1 0 011 1v7a1 1 0 01-1 1h-11a1 1 0 01-1-1v-7z" opacity="0.6"/><path d="M1.5 2.5a1 1 0 011-1h11a1 1 0 011 1v2a1 1 0 01-1 1h-11a1 1 0 01-1-1v-2z"/></svg>
                                        <span className="capitalize truncate text-xs font-medium">{key}</span>
                                    </div>
                                </div>
                                <div className="flex-grow min-w-0 flex items-center px-1.5">
                                    {renderInput(key, value)}
                                </div>
                            </div>
                        ))}

                        {/* Missing Fields Suggestions */}
                        {missingFields.length > 0 && (
                            <div className="pt-2 mt-2 border-t border-dashed border-notion-border">
                                <p className="text-[10px] uppercase font-bold text-notion-muted mb-2 px-1.5">Suggested Properties</p>
                                {missingFields.map(field => (
                                    <div key={field} className="flex py-1.5 group items-center opacity-70 hover:opacity-100 transition-opacity">
                                        <div className="w-32 flex-shrink-0 flex items-center text-notion-muted">
                                            <div className="flex items-center px-1.5 py-0.5 rounded-sm">
                                                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 mr-2 fill-current opacity-60"><path d="M1.5 6.5a1 1 0 011-1h11a1 1 0 011 1v7a1 1 0 01-1 1h-11a1 1 0 01-1-1v-7z" opacity="0.6"/><path d="M1.5 2.5a1 1 0 011-1h11a1 1 0 011 1v2a1 1 0 01-1 1h-11a1 1 0 01-1-1v-2z"/></svg>
                                                <span className="capitalize truncate text-xs font-medium">{field}</span>
                                            </div>
                                        </div>
                                        <div className="flex-grow px-1.5">
                                            <button 
                                                onClick={() => handleAddMissingField(field)}
                                                className="text-xs text-notion-blue hover:underline flex items-center"
                                            >
                                                <PlusIcon className="w-3 h-3 mr-1" />
                                                Add property
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="border-t border-notion-border mb-8"></div>

                    {/* Tabs */}
                    <div className="flex items-center gap-6 mb-6">
                        <button
                            onClick={() => setActiveTab('preview')}
                            className={`pb-1 text-sm font-medium transition-all ${
                                activeTab === 'preview'
                                ? 'text-notion-text border-b-2 border-notion-text'
                                : 'text-notion-muted hover:text-notion-text border-b-2 border-transparent'
                            }`}
                        >
                            {t('postPreview.tabPreview')}
                        </button>
                        <button
                            onClick={() => setActiveTab('code')}
                            className={`pb-1 text-sm font-medium transition-all ${
                                activeTab === 'code'
                                ? 'text-notion-text border-b-2 border-notion-text'
                                : 'text-notion-muted hover:text-notion-text border-b-2 border-transparent'
                            }`}
                        >
                            {t('postPreview.tabMarkdown')} (Edit)
                        </button>
                    </div>

                    {/* Content Area */}
                    {activeTab === 'preview' ? (
                        <div
                            className="prose prose-slate prose-sm sm:prose-base max-w-none text-notion-text
                            prose-headings:font-semibold prose-headings:text-gray-900
                            prose-h1:text-4xl prose-h1:font-bold prose-h1:tracking-tight prose-h1:mt-10 prose-h1:mb-6 prose-h1:pb-2 prose-h1:border-b prose-h1:border-gray-200
                            prose-h2:text-2xl prose-h2:font-semibold prose-h2:tracking-tight prose-h2:mt-8 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-gray-200
                            prose-h3:text-xl prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-3
                            prose-h4:text-lg prose-h4:font-semibold prose-h4:mt-4 prose-h4:mb-2
                            prose-h5:text-base prose-h5:font-semibold prose-h5:mt-4 prose-h5:mb-2
                            prose-h6:text-sm prose-h6:font-bold prose-h6:text-gray-600 prose-h6:uppercase prose-h6:mt-4 prose-h6:mb-2
                            prose-p:text-gray-800 prose-p:leading-7 prose-p:my-4
                            prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                            prose-ul:list-disc prose-ul:pl-6 prose-ul:my-4
                            prose-ol:list-decimal prose-ol:pl-6 prose-ol:my-4
                            prose-li:my-1.5 prose-li:text-gray-800
                            prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:text-gray-600 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:my-6
                            prose-img:rounded-lg prose-img:shadow-sm prose-img:my-6
                            prose-code:text-sm prose-code:bg-gray-100 prose-code:text-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-mono prose-code:font-medium prose-code:before:content-none prose-code:after:content-none
                            prose-pre:bg-gray-50 prose-pre:border prose-pre:border-gray-200 prose-pre:text-gray-800 prose-pre:rounded-lg prose-pre:p-4 prose-pre:shadow-sm prose-pre:my-6
                            prose-hr:my-8 prose-hr:border-gray-200"
                            dangerouslySetInnerHTML={createMarkup(editableBody)}
                        />
                    ) : (
                        <div className="rounded-lg border border-notion-border overflow-hidden bg-white shadow-inner">
                            <textarea 
                                className="w-full h-[60vh] p-6 text-xs font-mono text-notion-text overflow-x-auto whitespace-pre-wrap leading-relaxed focus:outline-none resize-none bg-notion-sidebar/30"
                                value={editableBody}
                                onChange={handleBodyChange}
                                spellCheck={false}
                            />
                        </div>
                    )}
                </div>
            </div>
      </div>
    </div>
  );
};

export default PostDetailView;
