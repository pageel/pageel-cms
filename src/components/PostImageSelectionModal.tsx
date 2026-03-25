
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { IGitService, GithubContent } from '../types';
import { useI18n } from '../i18n/I18nContext';
import { CloseIcon } from './icons/CloseIcon';
import { UploadIcon } from './icons/UploadIcon';
import { ImageIcon } from './icons/ImageIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { SearchIcon } from './icons/SearchIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { isImageFile } from '../utils/image';

interface PostImageSelectionModalProps {
    gitService: IGitService;
    imagesPath: string;
    imageFileTypes: string;
    onClose: () => void;
    onConfirm: (result: { type: 'new' | 'existing', file?: File, path?: string }) => void;
}

// --- Internal Component for Lazy/Auth Image Loading ---
const RepoImagePreview: React.FC<{ gitService: IGitService, path: string, name: string, isSelected: boolean }> = ({ gitService, path, name, isSelected }) => {
    const [src, setSrc] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        
        const loadImage = async () => {
            try {
                const blob = await gitService.getFileAsBlob(path);
                if (isMounted) {
                    const url = URL.createObjectURL(blob);
                    setSrc(url);
                }
            } catch (e) {
                console.warn("Failed to load image preview", path);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadImage();

        return () => {
            isMounted = false;
            if (src) URL.revokeObjectURL(src);
        };
    }, [gitService, path]);

    return (
        <div className={`
            w-full aspect-square flex items-center justify-center bg-gray-50 overflow-hidden relative rounded-sm border cursor-pointer transition-all
            ${isSelected ? 'ring-2 ring-notion-blue border-notion-blue' : 'border-notion-border hover:bg-gray-100'}
        `}>
            {loading ? (
                <SpinnerIcon className="w-4 h-4 text-notion-muted animate-spin" />
            ) : src ? (
                <img src={src} alt={name} className="w-full h-full object-cover" />
            ) : (
                <ImageIcon className="w-6 h-6 text-notion-muted" />
            )}
            
            {/* Selection Overlay */}
            {isSelected && (
                <div className="absolute inset-0 bg-blue-500/10 flex items-start justify-end p-1 z-10">
                    <div className="bg-notion-blue rounded-full p-0.5 shadow-sm">
                        <CheckCircleIcon className="w-4 h-4 text-white" />
                    </div>
                </div>
            )}
            
            <div className="absolute bottom-0 left-0 right-0 bg-white/90 p-1 border-t border-notion-border">
                <p className="text-[10px] text-notion-text truncate text-center">{name}</p>
            </div>
        </div>
    );
};

const PostImageSelectionModal: React.FC<PostImageSelectionModalProps> = ({ 
    gitService, imagesPath, imageFileTypes, onClose, onConfirm 
}) => {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState<'upload' | 'select'>('upload');
    
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [conflictCheckStatus, setConflictCheckStatus] = useState<'checking' | 'exists' | 'clear' | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [repoImages, setRepoImages] = useState<GithubContent[]>([]);
    const [isLoadingImages, setIsLoadingImages] = useState(false);
    const [selectedRepoImage, setSelectedRepoImage] = useState<string | null>(null); // Stores path
    const [searchQuery, setSearchQuery] = useState('');
    
    const [visibleCount, setVisibleCount] = useState(20);
    const IMAGES_PER_PAGE = 20;

    useEffect(() => {
        if (activeTab === 'select' && repoImages.length === 0) {
            fetchRepoImages();
        }
    }, [activeTab]);

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        }
    }, [previewUrl]);

    const fetchRepoImages = async () => {
        setIsLoadingImages(true);
        try {
            const items = await gitService.listFiles(imagesPath);
            const images = items.filter(item => item.type === 'file' && isImageFile(item.name, imageFileTypes));
            
            const mapped = images.map(i => ({
                name: i.name,
                path: i.path,
                sha: i.sha || '',
                size: i.size || 0,
                type: 'file',
                url: i.url || '',
                html_url: '',
                git_url: '',
                download_url: null,
                _links: { self: '', git: '', html: '' }
            } as GithubContent));

            mapped.sort((a, b) => b.name.localeCompare(a.name)); 
            setRepoImages(mapped);
        } catch (e) {
            console.error("Failed to fetch repo images", e);
        } finally {
            setIsLoadingImages(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            checkConflict(file.name);
        }
    };

    const checkConflict = async (filename: string) => {
        setConflictCheckStatus('checking');
        try {
            const path = imagesPath ? `${imagesPath}/${filename}` : filename;
            const sha = await gitService.getFileSha(path);
            setConflictCheckStatus(sha ? 'exists' : 'clear');
        } catch {
            setConflictCheckStatus('clear');
        }
    };

    const handleConfirm = () => {
        if (activeTab === 'upload' && selectedFile) {
            onConfirm({ type: 'new', file: selectedFile });
        } else if (activeTab === 'select' && selectedRepoImage) {
            onConfirm({ type: 'existing', path: selectedRepoImage });
        }
        onClose();
    };

    const filteredImages = useMemo(() => {
        return repoImages.filter(img => img.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [repoImages, searchQuery]);

    const visibleImages = useMemo(() => {
        return filteredImages.slice(0, visibleCount);
    }, [filteredImages, visibleCount]);

    const handleLoadMore = () => {
        setVisibleCount(prev => prev + IMAGES_PER_PAGE);
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
            <div className="bg-white rounded-lg shadow-xl border border-notion-border w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
                <header className="px-4 py-3 border-b border-notion-border flex justify-between items-center bg-white flex-shrink-0">
                    <h3 className="text-base font-semibold text-notion-text">{t('postList.imageSelection.title')}</h3>
                    <button onClick={onClose} className="text-notion-muted hover:text-notion-text p-1 rounded-sm hover:bg-notion-hover transition-colors">
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </header>

                <div className="flex border-b border-notion-border bg-notion-sidebar px-4 pt-2">
                    <button
                        onClick={() => setActiveTab('upload')}
                        className={`mr-4 pb-2 text-sm font-medium transition-colors border-b-2 ${
                            activeTab === 'upload' ? 'text-notion-text border-notion-text' : 'text-notion-muted border-transparent hover:text-notion-text'
                        }`}
                    >
                        {t('postList.imageSelection.tabUpload')}
                    </button>
                    <button
                        onClick={() => setActiveTab('select')}
                        className={`pb-2 text-sm font-medium transition-colors border-b-2 ${
                            activeTab === 'select' ? 'text-notion-text border-notion-text' : 'text-notion-muted border-transparent hover:text-notion-text'
                        }`}
                    >
                        {t('postList.imageSelection.tabSelect')}
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto p-6 bg-white">
                    {activeTab === 'upload' ? (
                        <div className="space-y-4">
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="border border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:bg-notion-hover transition-all bg-notion-sidebar"
                            >
                                {previewUrl ? (
                                    <div className="relative inline-block">
                                        <img src={previewUrl} alt="Preview" className="max-h-64 rounded-sm shadow-sm border border-notion-border" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-sm">
                                            <p className="text-white text-sm font-medium">{t('postList.imageSelection.uploadDesc')}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <UploadIcon className="mx-auto h-8 w-8 text-notion-muted mb-2" />
                                        <p className="text-notion-text text-sm font-medium">{t('postList.imageSelection.uploadDesc')}</p>
                                    </>
                                )}
                                <input 
                                    ref={fileInputRef}
                                    type="file" 
                                    accept={imageFileTypes} 
                                    className="hidden" 
                                    onChange={handleFileChange} 
                                />
                            </div>

                            {selectedFile && (
                                <div className="bg-notion-sidebar p-3 rounded-sm border border-notion-border">
                                    <p className="text-sm font-medium text-notion-text mb-1">Selected: {selectedFile.name}</p>
                                    
                                    {conflictCheckStatus === 'checking' && (
                                        <span className="text-xs text-notion-muted flex items-center">
                                            <SpinnerIcon className="w-3 h-3 animate-spin mr-1" /> {t('postList.imageSelection.checking')}
                                        </span>
                                    )}
                                    {conflictCheckStatus === 'exists' && (
                                        <span className="text-xs text-yellow-600 flex items-center font-medium">
                                            <ExclamationTriangleIcon className="w-3.5 h-3.5 mr-1" />
                                            {t('postList.imageSelection.fileExistsWarning', { name: selectedFile.name })}
                                        </span>
                                    )}
                                    {conflictCheckStatus === 'clear' && (
                                        <span className="text-xs text-green-600 flex items-center font-medium">
                                            <CheckCircleIcon className="w-3.5 h-3.5 mr-1" />
                                            Ready to upload
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder={t('postList.imageSelection.selectPlaceholder')}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 border border-notion-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-notion-blue focus:bg-white bg-notion-sidebar transition-all"
                                />
                                <SearchIcon className="absolute left-2.5 top-2 h-4 w-4 text-notion-muted" />
                            </div>

                            {isLoadingImages ? (
                                <div className="flex justify-center py-12">
                                    <SpinnerIcon className="w-6 h-6 text-notion-muted animate-spin" />
                                </div>
                            ) : filteredImages.length === 0 ? (
                                <p className="text-center text-notion-muted text-sm py-8">{t('postList.imageSelection.noImagesFound')}</p>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                        {visibleImages.map((img) => (
                                            <div 
                                                key={img.path} 
                                                onClick={() => setSelectedRepoImage(img.path)}
                                            >
                                                <RepoImagePreview 
                                                    gitService={gitService}
                                                    path={img.path}
                                                    name={img.name}
                                                    isSelected={selectedRepoImage === img.path}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    {visibleImages.length < filteredImages.length && (
                                        <div className="text-center pt-2">
                                            <button 
                                                onClick={handleLoadMore}
                                                className="text-xs text-notion-muted hover:text-notion-text font-medium px-3 py-1 bg-notion-sidebar rounded-sm hover:bg-notion-hover border border-notion-border transition-colors"
                                            >
                                                Load More
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <footer className="px-4 py-3 border-t border-notion-border bg-white flex justify-end gap-2">
                    <button 
                        onClick={onClose} 
                        className="px-3 py-1.5 bg-white border border-notion-border rounded-sm text-notion-text font-medium hover:bg-notion-hover transition-colors text-sm shadow-sm"
                    >
                        {t('directoryPicker.cancel')}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={
                            (activeTab === 'upload' && !selectedFile) ||
                            (activeTab === 'select' && !selectedRepoImage)
                        }
                        className="px-4 py-1.5 bg-notion-blue text-white font-medium rounded-sm hover:bg-blue-600 transition-all text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {activeTab === 'upload' ? t('postList.imageSelection.tabUpload') : 'Select Image'}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default PostImageSelectionModal;
