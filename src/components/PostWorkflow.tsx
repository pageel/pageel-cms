
import React, { useState, useRef, useEffect } from 'react';
import { useCollectionStore } from '../features/collections/store';
import { CollectionTemplate } from '../features/collections/types';
import { IGitService, GithubRepo } from '../types';
import { compressImage } from '../utils/image';
import { parseMarkdown, updateFrontmatter, slugify, extractImageUrls, escapeRegExp } from '../utils/parsing';
import { useI18n } from '../i18n/I18nContext';
import { UploadIcon } from './icons/UploadIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { ImageIcon } from './icons/ImageIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { ArrowUturnLeftIcon } from './icons/ArrowUturnLeftIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { CloseIcon } from './icons/CloseIcon';
import { PlusIcon } from './icons/PlusIcon';

interface PostWorkflowProps {
    gitService: IGitService;
    repo: GithubRepo;
    postsPath: string;
    imagesPath: string;
    imageFileTypes: string;
    newPostCommitTemplate: string;
    newImageCommitTemplate: string;
    imageCompressionEnabled: boolean;
    maxImageSize: number; // This is now in KB
    imageResizeMaxWidth: number;
    domainUrl: string;
    projectType: 'astro' | 'github';
    onComplete: () => void;
    onCancel: () => void; // New prop for going back to library
    onAction: () => void;
    collectionId?: string;
}

interface UploadedImage {
    file: File;
    preview: string;
    originalName: string;
    finalName: string;
}

// Notion-style Callout Component
const Callout: React.FC<{ icon: React.ReactNode; children: React.ReactNode; variant?: 'default' | 'error' | 'success' | 'warning' }> = ({ icon, children, variant = 'default' }) => {
    const bgColors = {
        default: 'bg-notion-sidebar',
        error: 'bg-red-50 border-red-100',
        success: 'bg-green-50 border-green-100',
        warning: 'bg-yellow-50 border-yellow-100'
    };
    
    return (
        <div className={`p-4 rounded-sm flex items-start text-sm ${bgColors[variant]} border border-transparent`}>
            <div className="mr-3 mt-0.5 flex-shrink-0 text-lg select-none">{icon}</div>
            <div className="text-notion-text leading-relaxed flex-grow">{children}</div>
        </div>
    );
};

const PostWorkflow: React.FC<PostWorkflowProps> = ({
    gitService,
    repo,
    postsPath,
    imagesPath,
    imageFileTypes,
    newPostCommitTemplate,
    newImageCommitTemplate,
    imageCompressionEnabled,
    maxImageSize,
    imageResizeMaxWidth,
    domainUrl,
    projectType,
    onComplete,
    onCancel,
    onAction,
    collectionId
}) => {
    const { t } = useI18n();
    const { getActiveCollection } = useCollectionStore();
    const activeCollection = getActiveCollection();
    const [step, setStep] = useState(1);
    
    // Step 1: Images
    const [images, setImages] = useState<UploadedImage[]>([]);
    const imageInputRef = useRef<HTMLInputElement>(null);

    // Step 2: Content
    const [postFile, setPostFile] = useState<File | null>(null);
    const [postContent, setPostContent] = useState<string>('');
    const [frontmatter, setFrontmatter] = useState<Record<string, any>>({});
    const [imageMappings, setImageMappings] = useState<Record<string, string>>({});
    const [bodyImageMappings, setBodyImageMappings] = useState<Record<string, string>>({});
    
    // Validation State
    const [validationTemplate, setValidationTemplate] = useState<Record<string, string> | null>(null);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [validationSuccess, setValidationSuccess] = useState<string | null>(null);
    
    // Image Validation State
    const [imageValidation, setImageValidation] = useState<Record<string, 'checking' | 'valid' | 'invalid' | 'external'>>({});
    const [markdownImages, setMarkdownImages] = useState<string[]>([]);

    // Step 3: Publish
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishStatus, setPublishStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Load template on mount
    useEffect(() => {
        // 1. Try to load from active collection
        if (activeCollection && activeCollection.template) {
            const templateMap: Record<string, string> = {};
            activeCollection.template.fields.forEach(field => {
                templateMap[field.name] = field.type;
            });
            setValidationTemplate(templateMap);
            return;
        }

        // 2. Fallback to legacy global template
        const templateJson = localStorage.getItem(`postTemplate_${repo.full_name}`);
        if (templateJson) {
            try {
                setValidationTemplate(JSON.parse(templateJson));
            } catch (e) {
                console.error("Failed to parse validation template", e);
            }
        }
    }, [repo.full_name, activeCollection?.id, activeCollection?.template]);

    // --- Validation Logic ---
    const validateFrontmatter = (fm: Record<string, any>) => {
        const errors: string[] = [];
        
        if (validationTemplate) {
            // Validate against custom template
            for (const [key, type] of Object.entries(validationTemplate)) {
                if (fm[key] === undefined) {
                    errors.push(t('newPost.validationErrors.missingField', { field: key }));
                    continue;
                }
                const value = fm[key];
                if (type === 'array' && !Array.isArray(value)) {
                    errors.push(t('newPost.validationErrors.mustBeArray', { field: key }));
                } else if (type === 'date' && isNaN(new Date(value).getTime())) {
                    errors.push(t('newPost.validationErrors.mustBeDate', { field: key }));
                } else if (type === 'object' && (typeof value !== 'object' || Array.isArray(value) || value === null)) {
                    errors.push(t('newPost.validationErrors.mustBeObject', { field: key }));
                } else if (type === 'string' && typeof value !== 'string') {
                    errors.push(t('newPost.validationErrors.mustBeString', { field: key }));
                }
            }
        } else {
            // Default validation
            const requiredStringFields = ['title'];
            requiredStringFields.forEach(field => {
                if (!fm[field] || typeof fm[field] !== 'string' || String(fm[field]).trim() === '') {
                    errors.push(t('newPost.validationErrors.missingDefaultField', { field }));
                }
            });
        }

        setValidationErrors(errors);
        if (errors.length === 0) {
            setValidationSuccess(t('newPost.validationSuccess'));
        } else {
            setValidationSuccess(null);
        }
    };

    const checkPath = async (path: string): Promise<'valid' | 'invalid' | 'external'> => {
        if (!path) return 'invalid';
        if (path.startsWith('http') || path.startsWith('//')) return 'external';

        // Remove query params or anchors if any (simple split)
        const cleanPath = path.split('?')[0].split('#')[0];
        let p = cleanPath.startsWith('/') ? cleanPath.slice(1) : cleanPath;
        
        // Check 1: Exact path
        try {
            const sha = await gitService.getFileSha(p);
            if (sha) return 'valid';
        } catch {}

        // Check 2: public/ + path
        if (!p.startsWith('public/')) {
            try {
                const sha = await gitService.getFileSha(`public/${p}`);
                if (sha) return 'valid';
            } catch {}
        }

        return 'invalid';
    };

    const validateImageLinks = async (content: string, fm: Record<string, any>) => {
        const bodyUrls = extractImageUrls(content);
        const fmUrls = Object.entries(fm)
            .filter(([k]) => ['image', 'cover', 'thumbnail', 'hero', 'heroImage', 'ogImage'].includes(k) || k.toLowerCase().includes('image'))
            .map(([, v]) => v)
            .filter((v): v is string => typeof v === 'string'); // Type predicate to ensure string[]

        const uniqueUrls = Array.from(new Set([...bodyUrls, ...fmUrls]));
        
        const initialStatus: Record<string, any> = {};
        uniqueUrls.forEach(u => initialStatus[u] = 'checking');
        setImageValidation(initialStatus);
        
        // Store body URLs specifically for the list view
        setMarkdownImages(bodyUrls);

        const finalStatus: Record<string, any> = {};
        await Promise.all(uniqueUrls.map(async (url) => {
            finalStatus[url] = await checkPath(url);
        }));
        
        setImageValidation(finalStatus);
    };

    // --- Step 1 Logic ---
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files) as File[];
            const processed = await Promise.all(files.map(async (file) => {
                // compressImage now takes KB, not MB
                const finalFile = imageCompressionEnabled 
                    ? await compressImage(file, maxImageSize, imageResizeMaxWidth)
                    : file;
                return {
                    file: finalFile,
                    preview: URL.createObjectURL(finalFile),
                    originalName: file.name,
                    finalName: finalFile.name
                };
            }));
            setImages(prev => [...prev, ...processed]);
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    // --- Step 2 Logic ---
    const handlePostUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const content = ev.target?.result as string;
            setPostContent(content);
            setPostFile(file);
            try {
                const { frontmatter: fm } = parseMarkdown(content);
                setFrontmatter(fm);
                setImageMappings({});
                setBodyImageMappings({});
                setImageValidation({});
                validateFrontmatter(fm);
                validateImageLinks(content, fm);
            } catch (err) {
                console.error(err);
                setValidationErrors([t('newPost.validationErrors.parseError')]);
            }
        };
        reader.readAsText(file);
    };

    const getImageFields = () => {
        // Detect likely image fields
        const keys = Object.keys(frontmatter);
        return keys.filter(k => 
            ['image', 'cover', 'thumbnail', 'hero', 'heroImage', 'ogImage'].includes(k) || 
            k.toLowerCase().includes('image') || 
            k.toLowerCase().includes('img')
        );
    };

    const getPublicUrl = (filename: string) => {
        // Construct the public URL based on imagesPath
        // If imagesPath is "public/images", URL is "/images/filename"
        let path = imagesPath;
        if (path.startsWith('public/')) {
            path = path.replace('public/', '/');
        } else if (path === 'public') {
            path = '/';
        } else if (!path.startsWith('/')) {
            path = '/' + path;
        }
        
        // Ensure trailing slash only if path is not just "/"
        if (path !== '/' && !path.endsWith('/')) {
            path += '/';
        }
        
        // Only prepend domain if it's a Web Project (Astro) AND domain is set
        if (projectType === 'astro' && domainUrl) {
            const cleanDomain = domainUrl.replace(/\/$/, '');
            return `${cleanDomain}${path}${filename}`;
        }

        return `${path}${filename}`;
    };

    const handleMappingChange = (field: string, filename: string) => {
        setImageMappings(prev => ({ ...prev, [field]: filename }));
    };

    const handleBodyMappingChange = (url: string, filename: string) => {
        setBodyImageMappings(prev => ({ ...prev, [url]: filename }));
    };

    // --- Step 3 Logic ---
    const handlePublish = async () => {
        if (!postFile || !postContent) return;
        setIsPublishing(true);
        setPublishStatus('idle');
        setErrorMessage(null);

        try {
            // 1. Upload Images
            for (const img of images) {
                const commitMsg = newImageCommitTemplate.replace('{filename}', img.finalName);
                const fullPath = imagesPath ? `${imagesPath}/${img.finalName}` : img.finalName;
                await gitService.uploadFile(fullPath, img.file, commitMsg);
            }

            // 2. Prepare Frontmatter Updates
            const updates: Record<string, any> = {};
            
            // Apply mapped images to Frontmatter
            Object.entries(imageMappings).forEach(([field, filename]) => {
                if (filename && filename !== 'keep') {
                    updates[field] = getPublicUrl(String(filename));
                }
            });

            // 3. Update Content
            let updatedContent = updateFrontmatter(postContent, updates);

            // Apply mapped images to Body
            Object.entries(bodyImageMappings).forEach(([url, filename]) => {
                if (filename && filename !== 'keep') {
                    const newUrl = getPublicUrl(String(filename));
                    
                    // Targeted replacement using Regex to avoid substring replacement issues
                    // This targets markdown syntax ![...](url) or HTML src="url" or just "url" inside parens
                    const escapedUrl = escapeRegExp(String(url));
                    
                    // Match pattern:
                    // Group 1: Opening delimiter ( ( " ' )
                    // Group 2: The URL
                    // Group 3: Closing delimiter ( ) " ' ) or space
                    const regex = new RegExp(`([("'])${escapedUrl}([)"'\\s])`, 'g');
                    updatedContent = updatedContent.replace(regex, `$1${newUrl}$2`);
                }
            });

            // 4. Upload Post
            const titleRaw = frontmatter.title || postFile.name.replace(/\.[^/.]+$/, "");
            const slug = slugify(String(titleRaw));
            
            const ext = postFile.name.split('.').pop() || 'md';
            const postFilename = `${slug}.${ext}`;
            const fullPostPath = postsPath ? `${postsPath}/${postFilename}` : postFilename;
            const postCommitMsg = newPostCommitTemplate.replace('{filename}', postFilename);

            await gitService.createFileFromString(fullPostPath, updatedContent, postCommitMsg);
            
            onAction(); // Trigger sync update
            setPublishStatus('success');
            setTimeout(() => {
                onComplete();
            }, 2000);

        } catch (e: any) {
            setPublishStatus('error');
            const message = e instanceof Error ? e.message : String(e);
            setErrorMessage(message);
        } finally {
            setIsPublishing(false);
        }
    };

    const renderValidationIcon = (status: 'checking' | 'valid' | 'invalid' | 'external') => {
        if (!status) return <span className="text-gray-400">-</span>;
        if (status === 'checking') return <SpinnerIcon className="w-4 h-4 animate-spin text-notion-blue" />;
        if (status === 'valid') return <CheckCircleIcon className="w-4 h-4 text-green-600" title={t('postWorkflow.step2.imageValidation.exists')} />;
        if (status === 'invalid') return <ExclamationTriangleIcon className="w-4 h-4 text-red-600" title={t('postWorkflow.step2.imageValidation.notFound')} />;
        if (status === 'external') return <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{t('postWorkflow.step2.imageValidation.external')}</span>;
        return null;
    };

    // Notion-like Step Indicator
    const steps = [
        { num: 1, label: t('postWorkflow.step1.title') },
        { num: 2, label: t('postWorkflow.step2.title') },
        { num: 3, label: t('postWorkflow.step3.title') },
    ];

    return (
        <div className="max-w-3xl mx-auto py-8">
            
            {/* Header Area */}
            <div className="mb-8">
                <div className="flex items-center text-sm text-notion-muted mb-6">
                    <button
                        onClick={() => step === 1 ? onCancel() : setStep(s => s - 1)}
                        className="flex items-center hover:text-notion-text hover:underline underline-offset-2 transition-colors mr-4"
                        disabled={isPublishing}
                    >
                        <ArrowUturnLeftIcon className="w-4 h-4 mr-1.5" />
                        {step === 1 ? t('workflows.backToLibrary') : t('postWorkflow.navigation.back')}
                    </button>
                    <span className="text-gray-300">/</span>
                    <span className="ml-2 font-medium text-notion-text">{t('postWorkflow.title')}</span>
                </div>

                <div className="flex items-center space-x-1 border-b border-notion-border pb-4">
                    {steps.map((s, idx) => (
                        <React.Fragment key={s.num}>
                            <button
                                disabled={isPublishing} // Disable jumping while publishing
                                onClick={() => {
                                    // Allow going back, but restrict going forward unless data is present
                                    if (s.num < step) setStep(s.num);
                                }}
                                className={`flex items-center px-3 py-1.5 rounded-sm transition-all text-sm ${
                                    step === s.num 
                                    ? 'bg-notion-hover text-notion-text font-medium' 
                                    : step > s.num
                                        ? 'text-notion-muted hover:text-notion-text hover:bg-notion-hover/50 cursor-pointer'
                                        : 'text-gray-300 cursor-default'
                                }`}
                            >
                                <span className={`w-5 h-5 flex items-center justify-center rounded-sm text-[10px] mr-2 font-bold ${
                                    step === s.num ? 'bg-notion-text text-white' : 'bg-gray-100 text-gray-500'
                                }`}>
                                    {s.num}
                                </span>
                                {s.label}
                            </button>
                            {idx < steps.length - 1 && <span className="text-gray-200">→</span>}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* Content Area - Notion "Page" Style */}
            <div className="bg-white min-h-[400px] animate-fade-in">
                
                {/* --- Step 1: Assets --- */}
                {step === 1 && (
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold text-notion-text mb-2">Upload Assets</h2>
                            <p className="text-notion-muted text-sm">{t('postWorkflow.step1.desc')}</p>
                        </div>

                        <div className="space-y-4">
                            {/* Upload Area */}
                            <div 
                                onClick={() => imageInputRef.current?.click()}
                                className="group border border-notion-border rounded-sm p-4 hover:bg-notion-hover/40 transition-colors cursor-pointer flex items-center gap-4"
                            >
                                <div className="w-12 h-12 bg-notion-sidebar rounded-sm flex items-center justify-center group-hover:bg-white border border-transparent group-hover:border-notion-border transition-colors">
                                    <UploadIcon className="w-5 h-5 text-notion-muted" />
                                </div>
                                <div className="flex-grow">
                                    <p className="text-sm font-medium text-notion-text">{t('postWorkflow.step1.uploadTitle')}</p>
                                    <p className="text-xs text-notion-muted">{t('postWorkflow.step1.uploadDesc')}</p>
                                </div>
                                <input ref={imageInputRef} type="file" multiple accept={imageFileTypes} className="hidden" onChange={handleImageUpload} />
                            </div>

                            {/* Gallery */}
                            {images.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-2 mt-6">
                                        <h3 className="text-xs font-bold text-notion-muted uppercase tracking-wide">
                                            {t('postWorkflow.step1.selected', { count: images.length })}
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {images.map((img, idx) => (
                                            <div key={idx} className="group relative aspect-square bg-notion-sidebar rounded-sm border border-notion-border overflow-hidden">
                                                <img src={img.preview} alt="preview" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <button 
                                                        onClick={() => removeImage(idx)}
                                                        className="bg-white/90 p-1.5 rounded-sm hover:bg-white hover:text-red-600 text-notion-text transition-colors shadow-sm"
                                                    >
                                                        <CloseIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className="absolute bottom-0 left-0 right-0 bg-white/90 text-notion-text text-[10px] p-1 truncate border-t border-notion-border">
                                                    {img.originalName}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex justify-end pt-4">
                            <button
                                onClick={() => setStep(2)}
                                className="px-4 py-1.5 bg-notion-blue text-white text-sm font-medium rounded-sm hover:bg-blue-600 transition-colors shadow-sm"
                            >
                                {t('postWorkflow.navigation.next')}
                            </button>
                        </div>
                    </div>
                )}

                {/* --- Step 2: Content --- */}
                {step === 2 && (
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold text-notion-text mb-2">Post Content</h2>
                            <p className="text-notion-muted text-sm">{t('postWorkflow.step2.desc')}</p>
                        </div>

                        {!postFile ? (
                            <div 
                                onClick={() => document.getElementById('post-upload')?.click()}
                                className="border border-notion-border border-dashed rounded-sm p-12 text-center hover:bg-notion-hover/30 transition-colors cursor-pointer group"
                            >
                                <DocumentIcon className="mx-auto h-10 w-10 text-notion-muted mb-3 group-hover:text-notion-text transition-colors" />
                                <label htmlFor="post-upload" className="cursor-pointer block">
                                    <span className="text-notion-blue font-medium text-sm hover:underline">{t('postWorkflow.step2.uploadTitle')}</span>
                                    <input id="post-upload" type="file" className="sr-only" accept=".md,.mdx" onChange={handlePostUpload} />
                                </label>
                                <p className="text-xs text-notion-muted mt-1">{t('postWorkflow.step2.uploadDesc')}</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* File & Validation Status */}
                                <div className="border border-notion-border rounded-sm overflow-hidden">
                                    <div className="px-4 py-2 bg-notion-sidebar border-b border-notion-border flex justify-between items-center">
                                        <div className="flex items-center text-sm font-medium text-notion-text">
                                            <DocumentIcon className="w-4 h-4 mr-2 text-notion-muted" />
                                            {postFile.name}
                                        </div>
                                        <button onClick={() => setPostFile(null)} className="text-notion-muted hover:text-red-600 p-1">
                                            <CloseIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                    
                                    <div className="p-4 bg-white">
                                        {validationErrors.length > 0 ? (
                                            <Callout variant="error" icon={<ExclamationTriangleIcon className="w-5 h-5 text-red-600" />}>
                                                <span className="font-semibold block mb-1">Validation Failed</span>
                                                <ul className="list-disc list-inside space-y-0.5 text-notion-muted">
                                                    {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                                                </ul>
                                            </Callout>
                                        ) : (
                                            <Callout variant="success" icon={<CheckCircleIcon className="w-5 h-5 text-green-600" />}>
                                                {validationSuccess}
                                            </Callout>
                                        )}
                                    </div>
                                </div>

                                {/* Frontmatter Mapping Table */}
                                <div>
                                    <h3 className="text-xs font-bold text-notion-muted uppercase tracking-wide mb-3 border-b border-notion-border pb-1">
                                        {t('postWorkflow.step2.mappingTitle')}
                                    </h3>
                                    
                                    {getImageFields().length > 0 ? (
                                        <div className="border border-notion-border rounded-sm overflow-hidden text-sm">
                                            <div className="bg-notion-sidebar border-b border-notion-border flex px-3 py-2 text-xs font-medium text-notion-muted">
                                                <div className="w-1/4">Field</div>
                                                <div className="w-1/3">Current Value</div>
                                                <div className="flex-1">Map to Upload</div>
                                            </div>
                                            {getImageFields().map(field => (
                                                <div key={field} className="flex px-3 py-2 border-b border-notion-border last:border-0 bg-white items-center">
                                                    <div className="w-1/4 font-medium text-notion-text">{field}</div>
                                                    <div className="w-1/3 text-notion-muted truncate pr-2 text-xs font-mono" title={String(frontmatter[field])}>
                                                        {frontmatter[field] || <span className="italic opacity-50">Empty</span>}
                                                    </div>
                                                    <div className="flex-1">
                                                        <select 
                                                            className="w-full text-xs border border-notion-border rounded-sm py-1 px-2 focus:ring-1 focus:ring-notion-blue focus:outline-none bg-notion-sidebar hover:bg-white transition-colors cursor-pointer"
                                                            onChange={(e) => handleMappingChange(field, e.target.value)}
                                                            value={imageMappings[field] || 'keep'}
                                                        >
                                                            <option value="keep">{t('postWorkflow.step2.keepCurrent')}</option>
                                                            {images.map((img, idx) => (
                                                                <option key={idx} value={img.finalName}>{img.finalName}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-notion-muted italic">{t('postWorkflow.step2.noImageFields')}</p>
                                    )}
                                </div>

                                {/* Markdown Body Image Check */}
                                <div>
                                    <h3 className="text-xs font-bold text-notion-muted uppercase tracking-wide mb-3 border-b border-notion-border pb-1">
                                        {t('postWorkflow.step2.imageValidation.inContent')}
                                    </h3>
                                    {markdownImages.length > 0 ? (
                                        <div className="border border-notion-border rounded-sm overflow-hidden text-sm">
                                            <div className="bg-notion-sidebar border-b border-notion-border flex px-3 py-2 text-xs font-medium text-notion-muted">
                                                <div className="w-8 text-center">St</div>
                                                <div className="w-1/2">Path in Markdown</div>
                                                <div className="flex-1">Replace with Upload</div>
                                            </div>
                                            {markdownImages.map((url, idx) => (
                                                <div key={idx} className="flex px-3 py-2 border-b border-notion-border last:border-0 bg-white items-center">
                                                    <div className="w-8 flex justify-center">
                                                        {renderValidationIcon(imageValidation[url])}
                                                    </div>
                                                    <div className="w-1/2 text-notion-muted truncate pr-2 text-xs font-mono" title={url}>
                                                        {url}
                                                    </div>
                                                    <div className="flex-1">
                                                        <select 
                                                            className="w-full text-xs border border-notion-border rounded-sm py-1 px-2 focus:ring-1 focus:ring-notion-blue focus:outline-none bg-notion-sidebar hover:bg-white transition-colors cursor-pointer"
                                                            onChange={(e) => handleBodyMappingChange(url, e.target.value)}
                                                            value={bodyImageMappings[url] || 'keep'}
                                                        >
                                                            <option value="keep">{t('postWorkflow.step2.keepCurrent')}</option>
                                                            {images.map((img, i) => (
                                                                <option key={i} value={img.finalName}>{img.finalName}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-notion-muted italic">{t('postWorkflow.step2.imageValidation.noContentImages')}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end pt-4">
                            <button
                                onClick={() => setStep(3)}
                                disabled={!postFile || validationErrors.length > 0}
                                className="px-4 py-1.5 bg-notion-blue text-white text-sm font-medium rounded-sm hover:bg-blue-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t('postWorkflow.navigation.next')}
                            </button>
                        </div>
                    </div>
                )}

                {/* --- Step 3: Publish --- */}
                {step === 3 && (
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold text-notion-text mb-2">Review & Publish</h2>
                            <p className="text-notion-muted text-sm">{t('postWorkflow.step3.desc')}</p>
                        </div>

                        <div className="bg-notion-sidebar border border-notion-border rounded-sm p-5 space-y-3">
                            <div className="flex justify-between items-center text-sm border-b border-notion-border pb-2">
                                <span className="text-notion-muted">{t('postWorkflow.step3.imagesToUpload')}</span>
                                <span className="font-medium text-notion-text bg-white px-2 py-0.5 rounded-sm border border-notion-border">{images.length}</span>
                            </div>
                            
                            <div className="flex justify-between items-center text-sm border-b border-notion-border pb-2">
                                <span className="text-notion-muted">{t('postWorkflow.step3.postFile')}</span>
                                <span className="font-medium text-notion-text bg-white px-2 py-0.5 rounded-sm border border-notion-border">{postFile?.name}</span>
                            </div>

                            <div className="flex justify-between items-center text-sm">
                                <span className="text-notion-muted">{t('postWorkflow.step3.frontmatterUpdates')}</span>
                                <span className="font-medium text-notion-text bg-white px-2 py-0.5 rounded-sm border border-notion-border">
                                    {Object.keys(imageMappings).filter(k => imageMappings[k] !== 'keep').length + 
                                     Object.keys(bodyImageMappings).filter(k => bodyImageMappings[k] !== 'keep').length}
                                </span>
                            </div>
                        </div>

                        {publishStatus === 'error' && (
                            <Callout variant="error" icon={<ExclamationTriangleIcon className="w-5 h-5 text-red-600" />}>
                                <strong>Error:</strong> {errorMessage}
                            </Callout>
                        )}

                        {publishStatus === 'success' ? (
                            <div className="text-center py-10 bg-green-50 border border-green-100 rounded-sm">
                                <CheckCircleIcon className="w-12 h-12 text-green-600 mx-auto mb-3" />
                                <h3 className="text-lg font-bold text-notion-text mb-2">{t('postWorkflow.step3.success')}</h3>
                                <button 
                                    onClick={onComplete}
                                    className="mt-4 px-4 py-2 bg-notion-blue text-white rounded-sm hover:bg-blue-600 font-medium text-sm shadow-sm"
                                >
                                    {t('postWorkflow.step3.viewButton')}
                                </button>
                            </div>
                        ) : (
                            <div className="flex justify-end pt-4">
                                <button
                                    onClick={handlePublish}
                                    disabled={isPublishing}
                                    className="w-full sm:w-auto px-6 py-2 bg-notion-text hover:bg-black text-white font-medium rounded-sm shadow-lg transition-all duration-200 disabled:opacity-50 flex justify-center items-center"
                                >
                                    {isPublishing && <SpinnerIcon className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />}
                                    {isPublishing ? t('postWorkflow.step3.publishing') : t('postWorkflow.step3.publishButton')}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PostWorkflow;
