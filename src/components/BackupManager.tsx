
import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { GithubRepo, GithubContent, IGitService } from '../types';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { ImageIcon } from './icons/ImageIcon';
import { useI18n } from '../i18n/I18nContext';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { SettingsIcon } from './icons/SettingsIcon';



interface BackupManagerProps {
    gitService: IGitService;
    repo: GithubRepo;
    postsPath: string;
    imagesPath: string;
}

interface ZipData {
    blob: Blob;
    name: string;
    size: string;
}

const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const BackupManager: React.FC<BackupManagerProps> = ({ gitService, repo, postsPath, imagesPath }) => {
    const { t } = useI18n();
    
    // File fetching state
    const [postFiles, setPostFiles] = useState<GithubContent[]>([]);
    const [imageFiles, setImageFiles] = useState<GithubContent[]>([]);
    const [isFetchingCounts, setIsFetchingCounts] = useState(true);

    // Zipping state
    const [isZippingPosts, setIsZippingPosts] = useState(false);
    const [postsZip, setPostsZip] = useState<ZipData | null>(null);
    const [postsError, setPostsError] = useState<string | null>(null);
    const [isZippingImages, setIsZippingImages] = useState(false);
    const [imagesZip, setImagesZip] = useState<ZipData | null>(null);
    const [imagesError, setImagesError] = useState<string | null>(null);

    useEffect(() => {
        const fetchFileCounts = async () => {
            setIsFetchingCounts(true);
            try {
                const [postContents, imageContents] = await Promise.all([
                    gitService.getRepoContents(postsPath).catch(() => []),
                    gitService.getRepoContents(imagesPath).catch(() => [])
                ]);
                setPostFiles(postContents.filter(item => item.type === 'file' && (item.name.endsWith('.md') || item.name.endsWith('.mdx'))));
                setImageFiles(imageContents.filter(item => item.type === 'file'));
            } catch (error) {
                console.error("Failed to fetch file lists", error);
            } finally {
                setIsFetchingCounts(false);
            }
        };
        fetchFileCounts();
    }, [gitService, postsPath, imagesPath]);

    const createZip = async (
        filesToBackup: GithubContent[],
        backupType: 'posts' | 'images',
        setIsZipping: (loading: boolean) => void,
        setError: (error: string | null) => void,
        setZipData: (data: ZipData | null) => void
    ) => {
        setIsZipping(true);
        setError(null);
        setZipData(null);

        if (filesToBackup.length === 0) {
            setError(t('backupManager.error.noFiles'));
            setIsZipping(false);
            return;
        }

        try {
            const zip = new JSZip();
            await Promise.all(filesToBackup.map(async (file) => {
                const blob = await gitService.getFileAsBlob(file.path);
                zip.file(file.name, blob);
            }));
            
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const date = new Date().toISOString().split('T')[0];
            const zipName = `${repo.name}-${backupType}-backup-${date}.zip`;
            
            setZipData({ blob: zipBlob, name: zipName, size: formatBytes(zipBlob.size) });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsZipping(false);
        }
    };
    
    const handleDownload = (zipData: ZipData) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipData.blob);
        link.download = zipData.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };

    const handleDownloadConfig = async () => {
        try {
            const content = await gitService.getFileContent('.pageelrc.json');
            const blob = new Blob([content], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = '.pageelrc.json';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        } catch (e) {
            alert(t('backupManager.config.notFound'));
        }
    };
    
    const BackupRow: React.FC<{
        title: string;
        description: string;
        icon: React.ReactNode;
        buttonLabel: string;
        isProcessing: boolean;
        zipData: ZipData | null;
        error: string | null;
        onAction: () => void;
        onDownload: () => void;
        onReset: () => void;
    }> = ({ title, description, icon, buttonLabel, isProcessing, zipData, error, onAction, onDownload, onReset }) => {
        return (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white border-b border-notion-border last:border-b-0 hover:bg-notion-hover/30 transition-colors gap-4">
                <div className="flex items-start">
                    <div className="mr-3 mt-0.5 text-notion-muted">{icon}</div>
                    <div>
                        <h4 className="text-sm font-medium text-notion-text">{title}</h4>
                        <p className="text-xs text-notion-muted mt-0.5 max-w-md">{description}</p>
                        {error && <p className="text-xs text-red-600 mt-1 flex items-center"><ExclamationTriangleIcon className="w-3 h-3 mr-1"/>{error}</p>}
                    </div>
                </div>
                <div className="flex-shrink-0">
                    {zipData ? (
                        <div className="flex items-center gap-2">
                            <div className="text-right mr-2 hidden sm:block">
                                <p className="text-xs font-medium text-green-600">Ready</p>
                                <p className="text-[10px] text-notion-muted">{zipData.size}</p>
                            </div>
                            <button 
                                onClick={onDownload} 
                                className="inline-flex items-center px-3 py-1.5 bg-white border border-notion-border rounded-sm text-sm font-medium text-notion-text hover:bg-notion-hover shadow-sm"
                            >
                                <DownloadIcon className="w-3.5 h-3.5 mr-1.5" />
                                {t('backupManager.create.downloadButton')}
                            </button>
                            <button onClick={onReset} className="text-xs text-notion-muted underline ml-2 hover:text-notion-text">Reset</button>
                        </div>
                    ) : (
                        <button
                            onClick={onAction}
                            disabled={isProcessing || isFetchingCounts}
                            className="inline-flex items-center px-3 py-1.5 bg-white border border-notion-border rounded-sm text-sm font-medium text-notion-text hover:bg-notion-hover shadow-sm disabled:opacity-50 min-w-[120px] justify-center"
                        >
                            {isProcessing ? <SpinnerIcon className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                            {isProcessing ? 'Processing...' : buttonLabel}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="mb-6 p-4 bg-notion-sidebar border border-notion-border rounded-md">
                <h3 className="text-sm font-bold text-notion-text uppercase tracking-wide mb-1">{t('backupManager.create.title')}</h3>
                <p className="text-xs text-notion-muted">{t('backupManager.create.description')}</p>
            </div>

            {/* List */}
            <div className="border border-notion-border rounded-md overflow-hidden bg-white shadow-sm">
                <BackupRow 
                    title={t('backupManager.posts.title')}
                    description={t('backupManager.posts.filesFound', { count: postFiles.length })}
                    icon={<DocumentIcon className="w-5 h-5" />}
                    buttonLabel="Create Archive"
                    isProcessing={isZippingPosts}
                    zipData={postsZip}
                    error={postsError}
                    onAction={() => createZip(postFiles, 'posts', setIsZippingPosts, setPostsError, setPostsZip)}
                    onDownload={() => postsZip && handleDownload(postsZip)}
                    onReset={() => setPostsZip(null)}
                />
                
                <BackupRow 
                    title={t('backupManager.images.title')}
                    description={t('backupManager.images.filesFound', { count: imageFiles.length })}
                    icon={<ImageIcon className="w-5 h-5" />}
                    buttonLabel="Create Archive"
                    isProcessing={isZippingImages}
                    zipData={imagesZip}
                    error={imagesError}
                    onAction={() => createZip(imageFiles, 'images', setIsZippingImages, setImagesError, setImagesZip)}
                    onDownload={() => imagesZip && handleDownload(imagesZip)}
                    onReset={() => setImagesZip(null)}
                />

                <BackupRow 
                    title={t('backupManager.config.title')}
                    description={t('backupManager.config.description')}
                    icon={<SettingsIcon className="w-5 h-5" />}
                    buttonLabel="Export JSON"
                    isProcessing={false}
                    zipData={null}
                    error={null}
                    onAction={handleDownloadConfig}
                    onDownload={() => {}}
                    onReset={() => {}}
                />
            </div>
        </div>
    );
};

export default BackupManager;
