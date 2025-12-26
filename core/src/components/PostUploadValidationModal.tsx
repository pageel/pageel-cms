
import React, { useState, useEffect } from 'react';
import { GithubRepo, IGitService } from '../types';
import { parseMarkdown, extractImageUrls } from '../utils/parsing';
import { useI18n } from '../i18n/I18nContext';
import { useCollectionStore } from '../features/collections/store';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { CloseIcon } from './icons/CloseIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { ImageIcon } from './icons/ImageIcon';

interface PostUploadValidationModalProps {
  file: File;
  gitService: IGitService;
  repo: GithubRepo;
  onConfirm: () => void;
  onCancel: () => void;
}

type ValidationStatus = 'pending' | 'loading' | 'success' | 'warning' | 'error';

interface CheckItem {
  id: string;
  label: string;
  status: ValidationStatus;
  message?: string;
}

const PostUploadValidationModal: React.FC<PostUploadValidationModalProps> = ({ file, gitService, repo, onConfirm, onCancel }) => {
  const { t } = useI18n();
  const [content, setContent] = useState<string>('');
  
  // Checks State
  const [fmStatus, setFmStatus] = useState<CheckItem>({ id: 'frontmatter', label: t('uploadValidation.frontmatter.label'), status: 'pending' });
  const [imageChecks, setImageChecks] = useState<CheckItem[]>([]);
  const [isCheckingImages, setIsCheckingImages] = useState(false);
  const [overallStatus, setOverallStatus] = useState<ValidationStatus>('loading');

  useEffect(() => {
    const readFile = () => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setContent(text);
        validateContent(text);
      };
      reader.onerror = () => {
        setFmStatus(prev => ({ ...prev, status: 'error', message: t('uploadValidation.error.fileRead') }));
        setOverallStatus('error');
      };
      reader.readAsText(file);
    };
    readFile();
  }, [file]);

  const validateContent = async (markdown: string) => {
    // 1. Validate Frontmatter
    try {
      const { frontmatter } = parseMarkdown(markdown);
      
      // Get template from collection store (single source of truth)
      const { getActiveCollection } = useCollectionStore.getState();
      const activeCollection = getActiveCollection();
      let template: Record<string, string> | null = null;
      
      if (activeCollection?.template) {
          // Convert CollectionTemplate to Record<string, string>
          template = {};
          activeCollection.template.fields.forEach(field => {
              template![field.name] = field.type;
          });
      }

      if (Object.keys(frontmatter).length === 0) {
           setFmStatus({ id: 'frontmatter', label: t('uploadValidation.frontmatter.label'), status: 'error', message: t('uploadValidation.frontmatter.notFound') });
      } else if (template) {
           const missingFields = [];
           for (const key of Object.keys(template)) {
               if (frontmatter[key] === undefined) missingFields.push(key);
           }
           if (missingFields.length > 0) {
               setFmStatus({ 
                   id: 'frontmatter', 
                   label: t('uploadValidation.frontmatter.label'), 
                   status: 'warning', 
                   message: t('uploadValidation.frontmatter.missingFields', { fields: missingFields.join(', ') }) 
                });
           } else {
               setFmStatus({ id: 'frontmatter', label: t('uploadValidation.frontmatter.label'), status: 'success', message: t('uploadValidation.frontmatter.valid') });
           }
      } else {
           setFmStatus({ id: 'frontmatter', label: t('uploadValidation.frontmatter.label'), status: 'success', message: t('uploadValidation.frontmatter.validBasic') });
      }

    } catch (e) {
      setFmStatus({ id: 'frontmatter', label: t('uploadValidation.frontmatter.label'), status: 'error', message: t('uploadValidation.frontmatter.parseError') });
    }

    // 2. Validate Images
    setIsCheckingImages(true);
    const urls = extractImageUrls(markdown);
    
    if (urls.length === 0) {
        setImageChecks([]);
        setIsCheckingImages(false);
        setOverallStatus('success'); 
        return;
    }

    const checks: CheckItem[] = await Promise.all(urls.map(async (url) => {
        const item: CheckItem = { id: url, label: url, status: 'loading' };
        
        if (url.startsWith('http')) {
            const checkExternalImage = async (imgUrl: string): Promise<boolean> => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve(true);
                    img.onerror = () => resolve(false);
                    img.src = imgUrl;
                });
            };

            try {
                const res = await fetch(url, { method: 'HEAD' });
                if (res.ok) {
                    item.status = 'success';
                    item.message = t('uploadValidation.images.externalValid');
                    return item;
                }
            } catch (e) { }

            const isAccessible = await checkExternalImage(url);
            
            if (isAccessible) {
                item.status = 'success';
                item.message = t('uploadValidation.images.externalValid');
            } else {
                item.status = 'error';
                item.message = t('uploadValidation.images.externalError');
            }
            return item;
        }

        let pathToCheck = url.startsWith('/') ? url.substring(1) : url;
        let found = false;

        if (await checkFileExists(pathToCheck)) found = true;
        if (!found && !pathToCheck.startsWith('public/')) {
            if (await checkFileExists(`public/${pathToCheck}`)) found = true;
        }
        
        if (found) {
            item.status = 'success';
            item.message = t('uploadValidation.images.foundRepo');
        } else {
            item.status = 'error';
            item.message = t('uploadValidation.images.notFoundRepo');
        }
        
        return item;
    }));

    setImageChecks(checks);
    setIsCheckingImages(false);
  };

  const checkFileExists = async (path: string): Promise<boolean> => {
      try {
          const sha = await (gitService as any).getFileSha(path);
          return !!sha;
      } catch {
          return false;
      }
  }

  useEffect(() => {
     if (fmStatus.status === 'error') {
         setOverallStatus('error');
         return;
     }
     
     if (isCheckingImages) {
         setOverallStatus('loading');
         return;
     }
     
     const hasImageError = imageChecks.some(c => c.status === 'error');
     if (hasImageError) {
         setOverallStatus('error');
         return;
     }

     if (fmStatus.status === 'warning' || imageChecks.some(c => c.status === 'warning')) {
         setOverallStatus('warning');
         return;
     }

     setOverallStatus('success');
  }, [fmStatus, imageChecks, isCheckingImages]);


  const renderStatusIcon = (status: ValidationStatus) => {
      switch(status) {
          case 'loading': return <SpinnerIcon className="w-4 h-4 animate-spin text-notion-blue" />;
          case 'success': return <CheckCircleIcon className="w-4 h-4 text-green-600" />;
          case 'warning': return <ExclamationTriangleIcon className="w-4 h-4 text-yellow-500" />;
          case 'error': return <CloseIcon className="w-4 h-4 text-red-500" />;
          default: return <div className="w-4 h-4" />;
      }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl border border-notion-border w-full max-w-lg flex flex-col overflow-hidden max-h-[85vh]">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-notion-border flex justify-between items-start bg-white">
            <div>
                <h3 className="text-base font-semibold text-notion-text">{t('uploadValidation.title')}</h3>
                <p className="text-xs text-notion-muted mt-0.5">{t('uploadValidation.subtitle', { name: file.name })}</p>
            </div>
            <button onClick={onCancel} className="text-notion-muted hover:text-notion-text p-1 hover:bg-notion-hover rounded-sm transition-colors">
                <CloseIcon className="w-4 h-4" />
            </button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto p-5 space-y-6">
            
            {/* Frontmatter Check */}
            <div>
                <div className="flex items-center mb-2">
                    <DocumentIcon className="w-4 h-4 text-notion-muted mr-2" />
                    <span className="text-xs font-semibold text-notion-muted uppercase tracking-wider">{t('uploadValidation.frontmatter.section')}</span>
                </div>
                <div className="bg-notion-sidebar border border-notion-border rounded-md p-3">
                    <div className="flex items-start">
                        <div className="mr-3 mt-0.5">{renderStatusIcon(fmStatus.status)}</div>
                        <div>
                            <p className="text-sm font-medium text-notion-text">{fmStatus.label}</p>
                            {fmStatus.message && <p className="text-xs text-notion-muted mt-0.5">{fmStatus.message}</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Images Check */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                        <ImageIcon className="w-4 h-4 text-notion-muted mr-2" />
                        <span className="text-xs font-semibold text-notion-muted uppercase tracking-wider">{t('uploadValidation.images.section')}</span>
                    </div>
                    {isCheckingImages && <span className="text-xs text-notion-blue flex items-center"><SpinnerIcon className="w-3 h-3 animate-spin mr-1"/> {t('uploadValidation.images.scanning')}</span>}
                </div>
                
                {imageChecks.length === 0 && !isCheckingImages ? (
                    <div className="p-3 bg-notion-sidebar border border-notion-border rounded-md text-xs text-notion-muted italic">
                        {t('uploadValidation.images.noImages')}
                    </div>
                ) : (
                    <div className="border border-notion-border rounded-md divide-y divide-notion-border bg-white">
                        {imageChecks.map((check) => (
                            <div key={check.id} className="p-2.5 flex items-start hover:bg-notion-hover/50 transition-colors">
                                <div className="mr-3 mt-0.5">{renderStatusIcon(check.status)}</div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-notion-text truncate font-medium" title={check.label}>{check.label}</p>
                                    <p className="text-xs text-notion-muted mt-0.5">{check.message}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-notion-border bg-notion-sidebar flex justify-between items-center">
            <div className="text-xs">
                {overallStatus === 'error' && <span className="text-red-600 font-medium flex items-center">{t('uploadValidation.summary.error')}</span>}
                {overallStatus === 'warning' && <span className="text-yellow-600 font-medium flex items-center">{t('uploadValidation.summary.warning')}</span>}
                {overallStatus === 'success' && <span className="text-green-600 font-medium flex items-center">{t('uploadValidation.summary.success')}</span>}
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={onCancel} 
                    className="px-3 py-1.5 bg-white border border-notion-border rounded-sm text-notion-text text-sm font-medium hover:bg-notion-hover transition-colors shadow-sm"
                >
                    {t('uploadValidation.cancel')}
                </button>
                <button 
                    onClick={onConfirm}
                    disabled={overallStatus === 'loading' || overallStatus === 'error'} 
                    className={`px-4 py-1.5 rounded-sm text-white text-sm font-medium shadow-sm transition-all flex items-center ${
                        overallStatus === 'loading' ? 'bg-gray-400 cursor-not-allowed' :
                        overallStatus === 'error' ? 'bg-red-400 cursor-not-allowed opacity-50' :
                        overallStatus === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700' :
                        'bg-notion-blue hover:bg-blue-600'
                    }`}
                >
                    {overallStatus === 'warning' ? t('uploadValidation.confirmWarning') : t('uploadValidation.confirm')}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PostUploadValidationModal;
