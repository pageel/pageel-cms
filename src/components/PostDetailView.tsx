
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
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
import { resolveImageSource } from '../utils/github';
import { PlusIcon } from './icons/PlusIcon';
import { EditIcon } from './icons/EditIcon';
import { CloseIcon } from './icons/CloseIcon';
import PostImageSelectionModal from './PostImageSelectionModal';



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
                } else {
                    // BUG-11: Use central utility for consistent image source resolution
                    setImageUrl(resolveImageSource(thumbnailUrl, repo, projectType, domainUrl));
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

// --- Gallery Thumbnail Component (for gallery editor) ---
const GalleryThumbnail: React.FC<{
    src: string;
    label: string;
    gitService: IGitService;
    repo: GithubRepo;
    projectType: 'astro' | 'github';
    domainUrl: string;
}> = ({ src, label, gitService, repo, projectType, domainUrl }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!src) { setIsLoading(false); return; }

        // External URLs → use directly
        if (src.startsWith('http')) {
            setImageUrl(src);
            setIsLoading(false);
            return;
        }

        const loadImage = async () => {
            setIsLoading(true);
            try {
                if (projectType === 'github' && repo.private) {
                    // Private repo → load via blob API
                    const fullPath = src.startsWith('/') ? src.substring(1) : src;
                    // Try with public/ prefix for Astro projects
                    let pathToFetch = fullPath;
                    if (!fullPath.startsWith('public/') && !fullPath.startsWith('images/')) {
                        pathToFetch = 'public' + (fullPath.startsWith('/') ? fullPath : '/' + fullPath);
                    }
                    const blob = await gitService.getFileAsBlob(pathToFetch);
                    setImageUrl(URL.createObjectURL(blob));
                } else {
                    // Public repo → resolve URL
                    setImageUrl(resolveImageSource(src, repo, projectType, domainUrl));
                }
            } catch {
                // Fallback: try alternate path
                try {
                    const altPath = src.startsWith('/') ? 'public' + src : src;
                    const blob = await gitService.getFileAsBlob(altPath);
                    setImageUrl(URL.createObjectURL(blob));
                } catch {
                    setImageUrl(null);
                }
            } finally {
                setIsLoading(false);
            }
        };
        loadImage();

        return () => {
            if (imageUrl && imageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(imageUrl);
            }
        };
    }, [src]);

    if (isLoading) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-notion-sidebar/50">
                <SpinnerIcon className="w-5 h-5 animate-spin text-notion-muted" />
            </div>
        );
    }

    if (imageUrl) {
        return <img src={imageUrl} alt={label} className="w-full h-full object-cover" />;
    }

    return (
        <div className="w-full h-full flex items-center justify-center bg-notion-sidebar/50">
            <div className="text-center px-2">
                <ImageIcon className="w-6 h-6 text-notion-muted/40 mx-auto mb-1" />
                <p className="text-[9px] text-notion-muted/60 truncate max-w-full">{src.split('/').pop()}</p>
            </div>
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
          
          // BUG-11: Use central utility for consistent image source resolution in markdown/HTML preview
          return resolveImageSource(url, repo, projectType, domainUrl);
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
    const processedContent = processContentImages(markdownContent);
    const rawMarkup = marked.parse(processedContent) as string;
    const sanitizedMarkup = DOMPurify.sanitize(rawMarkup);
    return { __html: sanitizedMarkup };
  };
  
  // --- Field Edit Modal State ---
  const [fieldModalKey, setFieldModalKey] = useState<string | null>(null);
  const [fieldModalValue, setFieldModalValue] = useState<string>('');
  const [fieldModalIsComplex, setFieldModalIsComplex] = useState(false);
  // Gallery-specific state
  const [fieldModalGalleryItems, setFieldModalGalleryItems] = useState<Array<Record<string, any>>>([]);
  const [fieldModalIsGallery, setFieldModalIsGallery] = useState(false);
  const [galleryDragIndex, setGalleryDragIndex] = useState<number | null>(null);
  const [isGalleryPickerOpen, setIsGalleryPickerOpen] = useState(false);

  // Detect gallery-like array: [{src: "...", label?: "..."}, ...]
  const isGalleryArray = (value: any): boolean => {
      return Array.isArray(value) && value.length > 0 
          && typeof value[0] === 'object' && value[0] !== null 
          && ('src' in value[0] || 'image' in value[0] || 'url' in value[0]);
  };

  const getGalleryImageKey = (item: Record<string, any>): string => {
      if ('src' in item) return 'src';
      if ('image' in item) return 'image';
      if ('url' in item) return 'url';
      return 'src';
  };

  const openFieldModal = (key: string, value: any) => {
      setFieldModalKey(key);
      if (isGalleryArray(value)) {
          setFieldModalIsGallery(true);
          setFieldModalIsComplex(false);
          setFieldModalGalleryItems(value.map((item: any) => ({ ...item })));
          setFieldModalValue('');
      } else {
          setFieldModalIsGallery(false);
          const isComplex = (typeof value === 'object' && value !== null);
          setFieldModalIsComplex(isComplex);
          if (isComplex) {
              setFieldModalValue(JSON.stringify(value, null, 2));
          } else if (Array.isArray(value)) {
              setFieldModalValue(value.join(', '));
          } else {
              setFieldModalValue(String(value || ''));
          }
      }
  };

  const handleFieldModalSave = () => {
      if (!fieldModalKey) return;
      if (fieldModalIsGallery) {
          handleFrontmatterChange(fieldModalKey, fieldModalGalleryItems);
          setFieldModalKey(null);
          return;
      }
      let parsedValue: any;
      if (fieldModalIsComplex) {
          try { parsedValue = JSON.parse(fieldModalValue); }
          catch { alert('Invalid JSON format.'); return; }
      } else {
          const originalValue = editableFrontmatter[fieldModalKey];
          if (Array.isArray(originalValue)) {
              parsedValue = fieldModalValue.split(',').map((s: string) => s.trim()).filter((s: string) => s);
          } else {
              parsedValue = fieldModalValue;
          }
      }
      handleFrontmatterChange(fieldModalKey, parsedValue);
      setFieldModalKey(null);
  };

  // Gallery helpers
  const handleGalleryItemChange = (index: number, field: string, value: string) => {
      setFieldModalGalleryItems(prev => {
          const updated = [...prev];
          updated[index] = { ...updated[index], [field]: value };
          return updated;
      });
  };

  const handleGalleryRemove = (index: number) => {
      setFieldModalGalleryItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleGalleryDragStart = (index: number) => { setGalleryDragIndex(index); };

  const handleGalleryDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (galleryDragIndex === null || galleryDragIndex === index) return;
      setFieldModalGalleryItems(prev => {
          const updated = [...prev];
          const [dragged] = updated.splice(galleryDragIndex, 1);
          updated.splice(index, 0, dragged);
          return updated;
      });
      setGalleryDragIndex(index);
  };

  const handleGalleryDragEnd = () => { setGalleryDragIndex(null); };

  const handleGalleryAddFromPicker = (result: { type: 'new' | 'existing', file?: File, path?: string }) => {
      if (result.path) {
          let finalPath = result.path;
          if (finalPath.startsWith('public/')) finalPath = finalPath.replace('public/', '/');
          else if (!finalPath.startsWith('http') && !finalPath.startsWith('/')) finalPath = '/' + finalPath;
          const imageKey = fieldModalGalleryItems.length > 0 ? getGalleryImageKey(fieldModalGalleryItems[0]) : 'src';
          const fileName = finalPath.split('/').pop()?.replace(/\.[^.]+$/, '') || 'New Image';
          setFieldModalGalleryItems(prev => [...prev, { [imageKey]: finalPath, label: fileName }]);
      }
      setIsGalleryPickerOpen(false);
  };

  // Helper: detect if value is array of objects
  const isArrayOfObjects = (value: any): boolean => {
      return Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null;
  };

  // Helper: format complex value for inline display
  const formatComplexPreview = (value: any): string => {
      if (isArrayOfObjects(value)) {
          return `[${value.length} items]`;
      }
      if (Array.isArray(value)) {
          return value.join(', ');
      }
      if (typeof value === 'object' && value !== null) {
          const keys = Object.keys(value);
          return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '…' : ''}}`;
      }
      return String(value || '');
  };

  const renderInput = (key: string, value: any) => {
      const isDate = value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)) && value.includes('-') && value.length === 10);
      const isArray = Array.isArray(value);
      const isComplex = typeof value === 'object' && value !== null && !isArray;

      // Array of objects (gallery, etc.) — show preview + edit button
      if (isArrayOfObjects(value)) {
          const isGallery = isGalleryArray(value);
          return (
              <button
                onClick={() => openFieldModal(key, value)}
                className="w-full text-left flex items-center gap-1.5 px-1 py-0.5 text-sm text-notion-blue hover:bg-notion-hover/50 rounded-sm transition-colors group"
              >
                <span className="truncate text-xs">
                  {isGallery ? `🖼 ${value.length} images` : `[${value.length} items]`}
                </span>
                <EditIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </button>
          );
      }

      // Simple arrays (tags, etc.) — inline edit + click to expand
      if (isArray) {
          return (
              <div className="flex items-center w-full gap-1">
                <input 
                  type="text" 
                  className="flex-grow bg-transparent border-b border-transparent focus:border-notion-blue focus:ring-0 text-sm py-0.5 px-1 hover:bg-notion-hover/50 rounded-sm transition-colors min-w-0"
                  value={value.join(', ')}
                  onChange={(e) => handleFrontmatterChange(key, e.target.value.split(',').map((s: string) => s.trim()).filter((s: string) => s))}
                />
                <button
                  onClick={() => openFieldModal(key, value)}
                  className="p-0.5 text-notion-muted hover:text-notion-blue rounded-sm transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                  title="Expand to edit"
                >
                  <EditIcon className="w-3 h-3" />
                </button>
              </div>
          );
      }

      if (isDate) {
          const dateStr = value instanceof Date ? value.toISOString().split('T')[0] : value;
          return (
              <input 
                type="date"
                className="w-full bg-transparent border-b border-transparent focus:border-notion-blue focus:ring-0 text-sm py-0.5 px-1 hover:bg-notion-hover/50 rounded-sm transition-colors cursor-pointer"
                value={dateStr}
                onChange={(e) => handleFrontmatterChange(key, e.target.value)}
              />
          );
      }

      // Complex objects (non-array) — show preview + edit button
      if (isComplex) {
          return (
              <button
                onClick={() => openFieldModal(key, value)}
                className="w-full text-left flex items-center gap-1.5 px-1 py-0.5 text-sm text-notion-blue hover:bg-notion-hover/50 rounded-sm transition-colors group"
              >
                <span className="truncate text-xs">{formatComplexPreview(value)}</span>
                <EditIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </button>
          );
      }

      // String/number — inline edit + expand button for long values
      const isLongValue = typeof value === 'string' && value.length > 50;
      return (
        <div className="flex items-center w-full gap-1">
          <input 
              type="text" 
              className="flex-grow bg-transparent border-b border-transparent focus:border-notion-blue focus:ring-0 text-sm py-0.5 px-1 hover:bg-notion-hover/50 rounded-sm transition-colors min-w-0"
              value={String(value || '')}
              onChange={(e) => handleFrontmatterChange(key, e.target.value)}
          />
          {isLongValue && (
            <button
              onClick={() => openFieldModal(key, value)}
              className="p-0.5 text-notion-muted hover:text-notion-blue rounded-sm transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
              title="Expand to edit"
            >
              <EditIcon className="w-3 h-3" />
            </button>
          )}
        </div>
      );
  };

  const hasCoverImage = !!(editableFrontmatter.image || editableFrontmatter.cover || editableFrontmatter.thumbnail || editableFrontmatter.heroImage || post.thumbnailUrl);

  return (
    <div className="h-full flex flex-col bg-white animate-fade-in relative -mx-4 sm:-mx-6 -my-8">
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

      {/* Gallery Image Picker (reuse PostImageSelectionModal) */}
      {isGalleryPickerOpen && (
          <PostImageSelectionModal
            gitService={gitService}
            imagesPath={imagesPath}
            imageFileTypes={imageFileTypes}
            onClose={() => setIsGalleryPickerOpen(false)}
            onConfirm={handleGalleryAddFromPicker}
          />
      )}

      {/* Frontmatter Field Edit Modal */}
      {fieldModalKey && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`bg-white rounded-lg shadow-xl w-full flex flex-col border border-notion-border overflow-hidden ${
            fieldModalIsGallery ? 'max-w-2xl max-h-[85vh]' : 'max-w-lg max-h-[80vh]'
          }`}>
            <header className="px-5 py-3 border-b border-notion-border flex items-center justify-between bg-white flex-shrink-0">
              <div className="flex items-center gap-2">
                {fieldModalIsGallery 
                  ? <ImageIcon className="w-4 h-4 text-notion-muted" />
                  : <EditIcon className="w-4 h-4 text-notion-muted" />
                }
                <h3 className="text-sm font-semibold text-notion-text capitalize">{fieldModalKey}</h3>
                {fieldModalIsGallery ? (
                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-sm font-medium">
                    {fieldModalGalleryItems.length} images
                  </span>
                ) : fieldModalIsComplex ? (
                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-sm font-medium">JSON</span>
                ) : null}
              </div>
              <button onClick={() => setFieldModalKey(null)} className="text-notion-muted hover:text-notion-text p-1 hover:bg-notion-hover rounded-sm transition-colors">
                <CloseIcon className="w-4 h-4" />
              </button>
            </header>

            {fieldModalIsGallery ? (
              <>
                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                  {fieldModalGalleryItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-notion-muted">
                      <ImageIcon className="w-10 h-10 opacity-30 mb-3" />
                      <p className="text-sm">No images in gallery</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {fieldModalGalleryItems.map((item, index) => {
                        const imgKey = getGalleryImageKey(item);
                        const imgSrc = item[imgKey] || '';
                        const labelKey = 'label' in item ? 'label' : 'alt' in item ? 'alt' : 'title' in item ? 'title' : 'label';
                        const label = item[labelKey] || '';
                        return (
                          <div 
                            key={index}
                            draggable
                            onDragStart={() => handleGalleryDragStart(index)}
                            onDragOver={(e) => handleGalleryDragOver(e, index)}
                            onDragEnd={handleGalleryDragEnd}
                            className={`group/card relative rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
                              galleryDragIndex === index 
                                ? 'border-notion-blue shadow-md ring-2 ring-blue-200 scale-[0.97]' 
                                : 'border-notion-border hover:border-notion-blue/40 hover:shadow-sm'
                            }`}
                          >
                            <div className="aspect-square bg-gray-50 rounded-t-lg overflow-hidden relative">
                              <GalleryThumbnail 
                                src={imgSrc} 
                                label={label} 
                                gitService={gitService} 
                                repo={repo} 
                                projectType={projectType} 
                                domainUrl={domainUrl} 
                              />
                              <span className="absolute top-1.5 left-1.5 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded-full font-medium">
                                {index + 1}
                              </span>
                              <button
                                onClick={() => handleGalleryRemove(index)}
                                className="absolute top-1.5 right-1.5 p-1 bg-red-500/80 hover:bg-red-600 text-white rounded-full opacity-0 group-hover/card:opacity-100 transition-opacity"
                                title="Remove"
                              >
                                <CloseIcon className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="p-2 space-y-1">
                              <input
                                type="text"
                                value={label}
                                onChange={(e) => handleGalleryItemChange(index, labelKey, e.target.value)}
                                placeholder="Label..."
                                className="w-full text-xs bg-transparent border-b border-transparent focus:border-notion-blue focus:ring-0 py-0.5 px-0.5 text-notion-text placeholder-notion-muted/50 hover:bg-notion-hover/30 rounded-sm transition-colors"
                              />
                              <input
                                type="text"
                                value={imgSrc}
                                onChange={(e) => handleGalleryItemChange(index, imgKey, e.target.value)}
                                placeholder="/images/..."
                                className="w-full text-[10px] font-mono bg-transparent border-b border-transparent focus:border-notion-blue focus:ring-0 py-0.5 px-0.5 text-notion-muted placeholder-notion-muted/30 hover:bg-notion-hover/30 rounded-sm transition-colors truncate"
                              />
                            </div>
                          </div>
                        );
                      })}
                      <button
                        onClick={() => setIsGalleryPickerOpen(true)}
                        className="aspect-square rounded-lg border-2 border-dashed border-notion-border hover:border-notion-blue/50 flex flex-col items-center justify-center gap-2 text-notion-muted hover:text-notion-blue transition-colors group/add"
                      >
                        <PlusIcon className="w-6 h-6 opacity-40 group-hover/add:opacity-70 transition-opacity" />
                        <span className="text-[10px] font-medium">Add Image</span>
                      </button>
                    </div>
                  )}
                </div>
                <footer className="px-4 py-3 border-t border-notion-border flex items-center justify-between bg-gray-50 flex-shrink-0">
                  <p className="text-[10px] text-notion-muted">💡 Drag to reorder • Click × to remove</p>
                  <div className="flex gap-2">
                    <button onClick={() => setFieldModalKey(null)} className="px-3 py-1.5 text-sm text-notion-text border border-notion-border rounded-sm hover:bg-notion-hover transition-colors">Cancel</button>
                    <button onClick={handleFieldModalSave} className="px-4 py-1.5 text-sm text-white bg-notion-blue rounded-sm hover:bg-blue-600 transition-colors font-medium">Save</button>
                  </div>
                </footer>
              </>
            ) : (
              <>
                <div className="flex-grow p-4 overflow-y-auto">
                  <textarea
                    className={`w-full h-60 p-3 text-sm border border-notion-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y bg-notion-sidebar/20 ${
                      fieldModalIsComplex ? 'font-mono text-xs leading-relaxed' : 'leading-normal'
                    }`}
                    value={fieldModalValue}
                    onChange={(e) => setFieldModalValue(e.target.value)}
                    spellCheck={!fieldModalIsComplex}
                    placeholder={fieldModalIsComplex ? 'Edit JSON...' : 'Edit value...'}
                  />
                  {fieldModalIsComplex && (
                    <p className="text-[10px] text-notion-muted mt-2">💡 Edit as JSON format.</p>
                  )}
                </div>
                <footer className="px-4 py-3 border-t border-notion-border flex justify-end gap-2 bg-gray-50 flex-shrink-0">
                  <button onClick={() => setFieldModalKey(null)} className="px-3 py-1.5 text-sm text-notion-text border border-notion-border rounded-sm hover:bg-notion-hover transition-colors">Cancel</button>
                  <button onClick={handleFieldModalSave} className="px-4 py-1.5 text-sm text-white bg-notion-blue rounded-sm hover:bg-blue-600 transition-colors font-medium">Save</button>
                </footer>
              </>
            )}
          </div>
        </div>
      )}

      {/* Sticky Header - Aligned to Content */}
      <header className="h-12 border-b border-notion-border bg-white sticky top-0 z-30 flex-shrink-0 backdrop-blur-md bg-white/85">
        <div className="px-6 h-full flex justify-between items-center w-full">
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

      {/* Main Scrollable Content — 2-column WordPress-style layout */}
      <div id="post-detail-container" className="flex-grow overflow-y-auto bg-white custom-scrollbar">
            <div className="flex flex-col lg:flex-row w-full h-full">

              {/* LEFT COLUMN — Content Editor */}
              <div className="flex-1 min-w-0 px-6 py-8 overflow-y-auto">
                {/* Title - Auto Resizing Textarea */}
                <textarea 
                    ref={titleTextareaRef}
                    className="text-3xl lg:text-4xl font-bold text-notion-text mb-6 break-words leading-tight tracking-tight w-full border-none focus:ring-0 p-0 placeholder-gray-300 resize-none overflow-hidden bg-transparent"
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

                <div className="border-t border-notion-border mb-6"></div>

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
                <div className="pb-20">
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

              {/* RIGHT COLUMN — Settings Panel (WordPress-style) */}
              <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-notion-border bg-notion-sidebar/30 overflow-y-auto">
                <div className="p-5 space-y-5">

                  {/* Featured Image Section */}
                  <div>
                    <p className="text-[10px] uppercase font-bold text-notion-muted mb-3 tracking-wider">Featured Image</p>
                    {hasCoverImage ? (
                      <div className="relative group">
                        <CoverImage 
                            thumbnailUrl={editableFrontmatter.image || editableFrontmatter.cover || editableFrontmatter.thumbnail || editableFrontmatter.heroImage || post.thumbnailUrl} 
                            gitService={gitService} 
                            repo={repo} 
                            domainUrl={domainUrl} 
                            projectType={projectType}
                            className="w-full h-40 object-cover rounded-lg border border-notion-border"
                        />
                        <button
                          onClick={handleUpdateImage}
                          className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center rounded-lg transition-all"
                        >
                          <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium bg-black/60 px-3 py-1.5 rounded-md transition-opacity">
                            Change Image
                          </span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleUpdateImage}
                        className="w-full h-28 rounded-lg border-2 border-dashed border-notion-border hover:border-notion-blue/50 flex flex-col items-center justify-center gap-2 text-notion-muted hover:text-notion-blue transition-colors group"
                      >
                        <ImageIcon className="w-6 h-6 opacity-50 group-hover:opacity-80 transition-opacity" />
                        <span className="text-xs font-medium">Set Featured Image</span>
                      </button>
                    )}
                  </div>

                  <div className="border-t border-notion-border"></div>

                  {/* Metadata Fields */}
                  <div>
                    <p className="text-[10px] uppercase font-bold text-notion-muted mb-3 tracking-wider">Properties</p>
                    <div className="space-y-0">
                      {Object.entries(editableFrontmatter).filter(([k]) => k !== 'title').map(([key, value]) => (
                          <div key={key} className="flex py-1.5 group items-start">
                              <div className="w-24 flex-shrink-0 flex items-center text-notion-muted pt-1">
                                  <div className="flex items-center px-1 py-0.5 rounded-sm transition-colors cursor-default">
                                      <svg viewBox="0 0 16 16" className="w-3 h-3 mr-1.5 fill-current opacity-50 flex-shrink-0"><path d="M1.5 6.5a1 1 0 011-1h11a1 1 0 011 1v7a1 1 0 01-1 1h-11a1 1 0 01-1-1v-7z" opacity="0.6"/><path d="M1.5 2.5a1 1 0 011-1h11a1 1 0 011 1v2a1 1 0 01-1 1h-11a1 1 0 01-1-1v-2z"/></svg>
                                      <span className="capitalize truncate text-[11px] font-medium">{key}</span>
                                  </div>
                              </div>
                              <div className="flex-grow min-w-0 flex items-center">
                                  {renderInput(key, value)}
                              </div>
                          </div>
                      ))}
                    </div>
                  </div>

                  {/* Missing Fields Suggestions */}
                  {missingFields.length > 0 && (
                      <>
                        <div className="border-t border-dashed border-notion-border"></div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-notion-muted mb-2 tracking-wider">Suggested Properties</p>
                          {missingFields.map(field => (
                              <div key={field} className="flex py-1.5 group items-center opacity-70 hover:opacity-100 transition-opacity">
                                  <div className="w-24 flex-shrink-0 flex items-center text-notion-muted">
                                      <div className="flex items-center px-1 py-0.5 rounded-sm">
                                          <svg viewBox="0 0 16 16" className="w-3 h-3 mr-1.5 fill-current opacity-50"><path d="M1.5 6.5a1 1 0 011-1h11a1 1 0 011 1v7a1 1 0 01-1 1h-11a1 1 0 01-1-1v-7z" opacity="0.6"/><path d="M1.5 2.5a1 1 0 011-1h11a1 1 0 011 1v2a1 1 0 01-1 1h-11a1 1 0 01-1-1v-2z"/></svg>
                                          <span className="capitalize truncate text-[11px] font-medium">{field}</span>
                                      </div>
                                  </div>
                                  <div className="flex-grow">
                                      <button 
                                          onClick={() => handleAddMissingField(field)}
                                          className="text-xs text-notion-blue hover:underline flex items-center"
                                      >
                                          <PlusIcon className="w-3 h-3 mr-1" />
                                          Add
                                      </button>
                                  </div>
                              </div>
                          ))}
                        </div>
                      </>
                  )}

                  <div className="border-t border-notion-border"></div>

                  {/* File Info */}
                  <div>
                    <p className="text-[10px] uppercase font-bold text-notion-muted mb-2 tracking-wider">File</p>
                    <div className="text-xs text-notion-muted space-y-1">
                      <p className="truncate" title={post.path}>📄 {post.name}</p>
                      <p className="truncate" title={post.path}>📁 {post.path}</p>
                    </div>
                  </div>

                </div>
              </div>

            </div>
      </div>
    </div>
  );
};

export default PostDetailView;
