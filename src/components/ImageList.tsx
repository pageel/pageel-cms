import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GithubRepo, IGitService, GithubContent } from '../types';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { UploadIcon } from './icons/UploadIcon';
import { SearchIcon } from './icons/SearchIcon';
import { ViewListIcon } from './icons/ViewListIcon';
import { ViewGridIcon } from './icons/ViewGridIcon';
import { ImageIcon } from './icons/ImageIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { TrashIcon } from './icons/TrashIcon';
import { InfoIcon } from './icons/InfoIcon';
import { CloseIcon } from './icons/CloseIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { useI18n } from '../i18n/I18nContext';
import ImageUploadModal from './ImageUploadModal';
import { ConfirmationModal } from './ConfirmationModal';
import { isImageFile, compressImage } from '../utils/image';
import { getRawGithubUrl, resolveImageSource } from '../utils/github';

interface ImageListProps {
  gitService: IGitService;
  repo: GithubRepo;
  path: string;
  imageFileTypes: string;
  domainUrl: string;
  projectType: 'astro' | 'github';
  repoStats: { postCount: number | null, imageCount: number | null };
  imageCompressionEnabled: boolean;
  maxImageSize: number;
  imageResizeMaxWidth: number;
  commitTemplate: string;
  onAction: () => void;
}

type SortOption = 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc';

// Simple Eye Icon for View action
const EyeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ImagePreview: React.FC<{ image: GithubContent; gitService: IGitService; repo: GithubRepo; className?: string }> = ({ image, gitService, repo, className = "w-full h-full object-cover" }) => {
    const [src, setSrc] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            setLoading(true);
            try {
                if (repo.private) {
                    const blob = await gitService.getFileAsBlob(image.path);
                    if (isMounted) setSrc(URL.createObjectURL(blob));
                } else {
                    // BUG-11: Use central utility for robust Raw GitHub URLs
                    setSrc(getRawGithubUrl(repo, image.path));
                }
            } catch (e) {
                // console.warn("Failed to load image", image.path);
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        load();
        return () => { 
            isMounted = false; 
            if (src && src.startsWith('blob:')) URL.revokeObjectURL(src); 
        };
    }, [image.sha, gitService, repo.full_name, repo.default_branch, repo.private]);

    if (loading) return <div className="w-full h-full flex items-center justify-center bg-gray-50"><SpinnerIcon className="w-4 h-4 animate-spin text-notion-muted" /></div>;
    
    if (src) return <img src={src} alt={image.name} className={className} />;
    
    return <div className="w-full h-full flex items-center justify-center text-notion-muted bg-gray-50"><ImageIcon className="w-6 h-6" /></div>;
};

// --- Lightbox Component ---
const ImageLightbox: React.FC<{ 
    image: GithubContent; 
    onClose: () => void; 
    gitService: IGitService; 
    repo: GithubRepo;
    publicUrl: string;
}> = ({ image, onClose, gitService, repo, publicUrl }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(publicUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="relative max-w-5xl w-full h-full flex flex-col justify-center items-center" onClick={e => e.stopPropagation()}>
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50"
                >
                    <CloseIcon className="w-6 h-6" />
                </button>

                <div className="flex-grow flex items-center justify-center w-full overflow-hidden relative mb-4">
                    <ImagePreview image={image} gitService={gitService} repo={repo} className="max-w-full max-h-[80vh] object-contain shadow-2xl rounded-sm" />
                </div>

                <div className="bg-white rounded-md p-4 w-full max-w-md shadow-xl flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="font-semibold text-notion-text text-sm truncate max-w-[250px]" title={image.name}>{image.name}</h3>
                            <p className="text-xs text-notion-muted">{(image.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-full border border-gray-200">
                            {image.path.split('.').pop()?.toUpperCase()}
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="flex-grow bg-gray-50 border border-notion-border rounded-sm px-3 py-2 text-xs text-notion-muted truncate font-mono select-all">
                            {publicUrl}
                        </div>
                        <button 
                            onClick={handleCopy}
                            className="flex-shrink-0 p-2 bg-notion-text text-white hover:bg-black rounded-sm transition-colors"
                            title="Copy URL"
                        >
                            {copied ? <CheckCircleIcon className="w-4 h-4" /> : <ClipboardIcon className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ImageList: React.FC<ImageListProps> = ({ 
    gitService, repo, path, imageFileTypes, domainUrl, projectType, 
    repoStats, imageCompressionEnabled, maxImageSize, imageResizeMaxWidth, 
    commitTemplate, onAction 
}) => {
    const { t } = useI18n();
    const [images, setImages] = useState<GithubContent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState<SortOption>('name-asc');
    const [currentPage, setCurrentPage] = useState(1);
    const IMAGES_PER_PAGE = 24;

    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
    
    // Modal States
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadFiles, setUploadFiles] = useState<File[]>([]);
    const uploadInputRef = useRef<HTMLInputElement>(null);
    
    const [imageToDelete, setImageToDelete] = useState<GithubContent | null>(null);
    const [previewImage, setPreviewImage] = useState<GithubContent | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchImages = async () => {
        if (!path) {
            setImages([]);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const items = await gitService.listFiles(path);
            const imageList = items.filter(item => item.type === 'file' && isImageFile(item.name, imageFileTypes));
            
            const mappedImages = imageList.map(i => ({
                name: i.name,
                path: i.path,
                sha: i.sha || '',
                size: i.size || 0,
                type: 'file' as const,
                url: i.url || '',
                html_url: '',
                git_url: '',
                download_url: null,
                _links: { self: '', git: '', html: '' }
            }));
            
            setImages(mappedImages);
        } catch (err) {
            if (err instanceof Error && err.message.includes('404')) {
                setError(t('imageList.error.dirNotFound', { path }));
            } else {
                setError(err instanceof Error ? err.message : 'Failed to fetch images');
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchImages();
    }, [path, gitService]);

    const getPublicUrl = (image: GithubContent) => {
        // BUG-11: Use central utility for consistent path resolution
        return resolveImageSource(image.path, repo, projectType, domainUrl);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedUrl(text);
        setTimeout(() => setCopiedUrl(null), 2000);
    };

    const handleUploadClick = () => {
        uploadInputRef.current?.click();
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setUploadFiles(Array.from(e.target.files));
            setIsUploadModalOpen(true);
            e.target.value = '';
        }
    };

    const handleUploadConfirm = async (filesToUpload: File[]) => {
        try {
            await Promise.all(filesToUpload.map(async (file) => {
                const processedFile = imageCompressionEnabled 
                    ? await compressImage(file, maxImageSize, imageResizeMaxWidth)
                    : file;
                
                const commitMsg = commitTemplate.replace('{filename}', processedFile.name);
                const fullPath = path ? `${path}/${processedFile.name}` : processedFile.name;
                await gitService.uploadFile(fullPath, processedFile, commitMsg);
            }));
            
            onAction();
            fetchImages();
            setIsUploadModalOpen(false);
        } catch (e) {
            console.error(e);
            alert("Upload failed partially or completely. Check console.");
        }
    };

    const handleDeleteClick = (image: GithubContent) => {
        setImageToDelete(image);
    };

    const confirmDelete = async () => {
        if (!imageToDelete) return;
        setIsDeleting(true);
        try {
            const commitMsg = `chore(assets): delete image ${imageToDelete.name}`;
            await gitService.deleteFile(imageToDelete.path, imageToDelete.sha, commitMsg);
            onAction();
            fetchImages();
        } catch (e) {
            alert("Delete failed.");
        } finally {
            setIsDeleting(false);
            setImageToDelete(null);
        }
    };

    const sortedAndFilteredImages = useMemo(() => {
        let result = [...images];
        
        // Filter
        if (searchQuery) {
            result = result.filter(img => img.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }

        // Sort
        result.sort((a, b) => {
            if (sortOption === 'name-asc') return a.name.localeCompare(b.name);
            if (sortOption === 'name-desc') return b.name.localeCompare(a.name);
            if (sortOption === 'size-asc') return a.size - b.size;
            if (sortOption === 'size-desc') return b.size - a.size;
            return 0;
        });

        return result;
    }, [images, searchQuery, sortOption]);

    const totalPages = Math.ceil(sortedAndFilteredImages.length / IMAGES_PER_PAGE);
    const currentImages = sortedAndFilteredImages.slice((currentPage - 1) * IMAGES_PER_PAGE, currentPage * IMAGES_PER_PAGE);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <SpinnerIcon className="animate-spin h-8 w-8 text-notion-muted" />
                <span className="ml-4 text-notion-muted">{t('imageList.loading')}</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 border border-red-200 bg-red-50 text-left rounded-md shadow-sm">
                <h4 className="font-bold text-red-800">Error</h4>
                <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <input type="file" ref={uploadInputRef} onChange={onFileChange} multiple accept={imageFileTypes} className="hidden" />
            
            {isUploadModalOpen && (
                <ImageUploadModal 
                    files={uploadFiles} 
                    existingFileNames={images.map(i => i.name)}
                    onClose={() => setIsUploadModalOpen(false)}
                    onUpload={handleUploadConfirm}
                />
            )}

            <ConfirmationModal 
                isOpen={!!imageToDelete}
                onClose={() => setImageToDelete(null)}
                onConfirm={confirmDelete}
                title={t('imageList.delete')}
                description={t('imageList.deleteConfirm', { name: imageToDelete?.name })}
                confirmLabel={t('imageList.delete')}
                isProcessing={isDeleting}
            />

            {/* Lightbox */}
            {previewImage && (
                <ImageLightbox 
                    image={previewImage} 
                    gitService={gitService} 
                    repo={repo}
                    onClose={() => setPreviewImage(null)} 
                    publicUrl={getPublicUrl(previewImage)}
                />
            )}

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-2 justify-between items-center z-10 relative">
                <div className="relative flex-grow w-full sm:w-auto max-w-md">
                    <input
                        type="text"
                        placeholder={t('imageList.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        className="w-full pl-8 pr-4 py-1.5 bg-transparent border border-notion-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-notion-blue focus:bg-white transition-all text-notion-text placeholder-notion-muted/70 shadow-sm"
                    />
                    <SearchIcon className="absolute left-2.5 top-2 h-3.5 w-3.5 text-notion-muted" />
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {/* Sort Dropdown */}
                    <div className="relative">
                        <select 
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value as SortOption)}
                            className="appearance-none pl-3 pr-8 py-1.5 bg-white border border-notion-border rounded-sm text-xs font-medium text-notion-text focus:outline-none focus:ring-1 focus:ring-notion-blue shadow-sm cursor-pointer hover:bg-gray-50"
                        >
                            <option value="name-asc">Name (A-Z)</option>
                            <option value="name-desc">Name (Z-A)</option>
                            <option value="size-asc">Size (Smallest)</option>
                            <option value="size-desc">Size (Largest)</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-notion-muted">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>

                    <div className="flex bg-notion-sidebar p-0.5 rounded-sm border border-notion-border">
                        <button 
                            onClick={() => setViewMode('table')}
                            className={`p-1 rounded-sm transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-notion-text' : 'text-notion-muted hover:text-notion-text hover:bg-gray-200/50'}`}
                        >
                            <ViewListIcon className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-1 rounded-sm transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-notion-text' : 'text-notion-muted hover:text-notion-text hover:bg-gray-200/50'}`}
                        >
                            <ViewGridIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <button
                        onClick={handleUploadClick}
                        className="flex items-center justify-center px-3 py-1.5 bg-notion-blue hover:bg-blue-600 text-white text-xs font-medium rounded-sm transition-colors shadow-sm"
                    >
                        <UploadIcon className="w-3.5 h-3.5 mr-1.5" />
                        {t('imageList.upload')}
                    </button>
                </div>
            </div>

            {/* Info Banner */}
            {projectType === 'github' && !repo.private && (
                <div className="bg-blue-50 border border-blue-100 rounded-sm p-3 flex items-start gap-3">
                    <InfoIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-semibold text-blue-900">{t('imageList.infoBanner.title')}</h4>
                        <p className="text-xs text-blue-700 mt-1">{t('imageList.infoBanner.description')}</p>
                    </div>
                </div>
            )}
            
            {projectType === 'astro' && domainUrl && (
                 <div className="bg-green-50 border border-green-100 rounded-sm p-3 flex items-start gap-3">
                    <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-semibold text-green-900">{t('imageList.infoBannerWeb.title')}</h4>
                        <p className="text-xs text-green-700 mt-1">{t('imageList.infoBannerWeb.description')}</p>
                    </div>
                </div>
            )}

            {currentImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-notion-border border-dashed">
                    <ImageIcon className="w-10 h-10 text-notion-select mb-3" />
                    <p className="text-notion-muted font-medium">{t('imageList.noResults')}</p>
                </div>
            ) : (
                <>
                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {currentImages.map((image) => (
                            <div 
                                key={image.sha} 
                                className="group relative bg-white border border-notion-border rounded-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden cursor-pointer"
                                onClick={() => setPreviewImage(image)}
                            >
                                <div className="aspect-square relative overflow-hidden bg-gray-50 border-b border-notion-border">
                                    <ImagePreview image={image} gitService={gitService} repo={repo} />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPreviewImage(image);
                                            }}
                                            className="p-1.5 bg-white text-notion-text rounded-sm hover:bg-gray-100 transition-colors shadow-sm"
                                            title="View"
                                        >
                                            <EyeIcon className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const url = getPublicUrl(image);
                                                if (url) copyToClipboard(url);
                                            }} 
                                            className="p-1.5 bg-white text-notion-text rounded-sm hover:bg-gray-100 transition-colors shadow-sm"
                                            title={t('imageList.copyUrlButton')}
                                        >
                                            {copiedUrl === getPublicUrl(image) ? <CheckCircleIcon className="w-4 h-4 text-green-600" /> : <ClipboardIcon className="w-4 h-4" />}
                                        </button>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteClick(image);
                                            }} 
                                            className="p-1.5 bg-white text-red-600 rounded-sm hover:bg-red-50 transition-colors shadow-sm"
                                            title={t('imageList.delete')}
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="p-2 bg-white text-xs truncate">
                                    <span className="text-notion-text font-medium block truncate" title={image.name}>{image.name}</span>
                                    <div className="text-[10px] text-notion-muted mt-0.5">{(image.size / 1024).toFixed(1)} KB</div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white border border-notion-border rounded-sm overflow-hidden">
                        <table className="min-w-full divide-y divide-notion-border">
                            <thead className="bg-notion-sidebar">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-notion-muted uppercase tracking-wider">Preview</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-notion-muted uppercase tracking-wider">Name</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-notion-muted uppercase tracking-wider">Size</th>
                                    <th scope="col" className="relative px-6 py-3">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-notion-border">
                                {currentImages.map((image) => (
                                    <tr 
                                        key={image.sha} 
                                        className="hover:bg-notion-hover/30 transition-colors group cursor-pointer"
                                        onClick={() => setPreviewImage(image)}
                                    >
                                        <td className="px-6 py-2 whitespace-nowrap">
                                            <div className="h-10 w-10 rounded-sm overflow-hidden bg-gray-100 border border-notion-border">
                                                <ImagePreview image={image} gitService={gitService} repo={repo} />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-notion-text">
                                            {image.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-notion-muted">
                                            {(image.size / 1024).toFixed(1)} KB
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                                <button 
                                                    onClick={() => setPreviewImage(image)}
                                                    className="text-notion-muted hover:text-notion-blue transition-colors"
                                                    title="View"
                                                >
                                                    <EyeIcon className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        const url = getPublicUrl(image);
                                                        if (url) copyToClipboard(url);
                                                    }}
                                                    className="text-notion-muted hover:text-notion-blue transition-colors"
                                                    title="Copy URL"
                                                >
                                                    {copiedUrl === getPublicUrl(image) ? <CheckCircleIcon className="w-4 h-4 text-green-600" /> : <ClipboardIcon className="w-4 h-4" />}
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteClick(image)}
                                                    className="text-notion-muted hover:text-red-600 transition-colors"
                                                    title="Delete"
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
                    <div className="mt-6 flex justify-center items-center">
                        <nav className="isolate inline-flex -space-x-px rounded-sm shadow-sm" aria-label="Pagination">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="relative inline-flex items-center rounded-l-sm px-2 py-1.5 text-gray-400 ring-1 ring-inset ring-notion-border hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                            >
                                <span className="sr-only">Previous</span>
                                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" /></svg>
                            </button>
                            <div className="relative inline-flex items-center px-4 py-1.5 text-xs font-semibold text-notion-text ring-1 ring-inset ring-notion-border focus:outline-offset-0 bg-white">
                                {t('postList.pagination.pageInfo', { current: currentPage, total: totalPages })}
                            </div>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="relative inline-flex items-center rounded-r-sm px-2 py-1.5 text-gray-400 ring-1 ring-inset ring-notion-border hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                            >
                                <span className="sr-only">Next</span>
                                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg>
                            </button>
                        </nav>
                    </div>
                )}
                </>
            )}
        </div>
    );
};

export default ImageList;