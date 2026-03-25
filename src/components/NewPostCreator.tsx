





import React, { useState, useEffect, useCallback } from 'react';
import { GithubRepo, IGitService } from '../types';
import { slugify, parseMarkdown, updateFrontmatter, escapeRegExp } from '../utils/parsing';
import { compressImage } from '../utils/image';
import { UploadIcon } from './icons/UploadIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { PhotoIcon } from './icons/PhotoIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { InfoIcon } from './icons/InfoIcon';
import { useI18n } from '../i18n/I18nContext';

interface NewPostCreatorProps {
  gitService: IGitService;
  repo: GithubRepo;
  postsPath: string;
  imagesPath: string;
  newPostCommitTemplate: string;
  newImageCommitTemplate: string;
  imageFileTypes: string;
  publishDateSource: 'file' | 'system';
  imageCompressionEnabled: boolean;
  maxImageSize: number;
  imageResizeMaxWidth: number;
}

const TimelineItem: React.FC<{
  title: string;
  description: string;
  isComplete: boolean;
  isActive: boolean;
  isLast?: boolean;
}> = ({ title, description, isComplete, isActive, isLast = false }) => {
  return (
    <li className={`relative ${isLast ? '' : 'pb-10'} pl-8`}>
        {!isLast && <div className="absolute left-4 top-4 -ml-px mt-0.5 h-full w-0.5 bg-gray-200"></div>}
        <div className="absolute left-4 top-0 -ml-px h-full w-0.5" aria-hidden="true"></div>
        <div className="relative flex items-start space-x-3">
            <div>
                <div className="relative px-1">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ring-4 ${isActive ? 'ring-blue-100' : 'ring-white'} ${isComplete ? 'bg-blue-600' : 'bg-gray-200'}`}>
                        {isComplete ? (
                            <CheckCircleIcon className="h-5 w-5 text-white" />
                        ) : (
                            <span className={`text-sm font-semibold ${isActive ? 'text-blue-600' : 'text-gray-600'}`}>
                                {isComplete ? '' : '...'}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <div className="min-w-0 flex-1 py-1.5">
                <div className={`text-sm font-semibold ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>{title}</div>
                <div className="text-sm text-gray-500">{description}</div>
            </div>
        </div>
    </li>
  );
};

const NewPostCreator: React.FC<NewPostCreatorProps> = ({
  gitService, repo, postsPath, imagesPath, newPostCommitTemplate, newImageCommitTemplate, imageFileTypes, publishDateSource, imageCompressionEnabled, maxImageSize, imageResizeMaxWidth
}) => {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageNameChanges, setImageNameChanges] = useState<Record<string, string>>({});
  
  const [markdownFile, setMarkdownFile] = useState<File | null>(null);
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const [validatedFrontmatter, setValidatedFrontmatter] = useState<Record<string, any> | null>(null);
  const [validationStatus, setValidationStatus] = useState<{error?: string, success?: string}>({});
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [validationTemplate, setValidationTemplate] = useState<Record<string, string> | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    const templateJson = localStorage.getItem(`postTemplate_${repo.full_name}`);
    if (templateJson) {
      try {
        setValidationTemplate(JSON.parse(templateJson));
      } catch (e) {
        console.error("Failed to parse validation template from localStorage", e);
      }
    }
  }, [repo.full_name]);

  useEffect(() => {
    return () => {
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [imagePreviews]);

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files);
      const newNameChanges: Record<string, string> = {};

      const processedFiles: File[] = await Promise.all(
        files.map(async (originalFile: File): Promise<File> => {
          const processedFile = imageCompressionEnabled
            ? await compressImage(originalFile, maxImageSize, imageResizeMaxWidth)
            : originalFile;
          
          if (originalFile.name !== processedFile.name) {
            newNameChanges[originalFile.name] = processedFile.name;
          }
          return processedFile;
        })
      );

      setImageFiles(prev => [...prev, ...processedFiles]);
      setImageNameChanges(prev => ({...prev, ...newNameChanges}));

      const newPreviews = processedFiles.map(file => URL.createObjectURL(file));
      setImagePreviews(prev => [...prev, ...newPreviews]);
    }
  };
  
  const resetState = () => {
      setImageFiles([]);
      setImagePreviews([]);
      setImageNameChanges({});
      setMarkdownFile(null);
      setMarkdownContent(null);
      setValidatedFrontmatter(null);
      setValidationStatus({});
      setIsProcessingFile(false);
      setIsPublishing(false);
      setError(null);
      setSuccess(null);
  }

  const validateWithTemplate = (frontmatter: Record<string, any>, template: Record<string, string>): string[] => {
      const errors: string[] = [];
      for (const [key, type] of Object.entries(template)) {
          if (frontmatter[key] === undefined) {
              errors.push(t('newPost.validationErrors.missingField', { field: key }));
              continue;
          }
          const value = frontmatter[key];
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
      return errors;
  }
  
  const validateWithDefaults = (frontmatter: Record<string, any>): string[] => {
      const errors: string[] = [];
      const requiredStringFields = ['title', 'author', 'excerpt', 'category'];
      requiredStringFields.forEach(field => {
        if (!frontmatter[field] || typeof frontmatter[field] !== 'string' || String(frontmatter[field]).trim() === '') {
          errors.push(t('newPost.validationErrors.missingDefaultField', { field }));
        }
      });
      if (!frontmatter.publishDate) {
        errors.push(t('newPost.validationErrors.missingPublishDate'));
      } else if (isNaN(new Date(frontmatter.publishDate).getTime())) {
        errors.push(t('newPost.validationErrors.invalidPublishDate'));
      }
      if (!frontmatter.tags || !Array.isArray(frontmatter.tags) || frontmatter.tags.length === 0) {
        errors.push(t('newPost.validationErrors.missingTags'));
      }
      if (imageFiles.length > 0 && (!frontmatter.image || typeof frontmatter.image !== 'string' || frontmatter.image.trim() === '')) {
          errors.push(t('newPost.validationErrors.missingImage'));
      }
      return errors;
  }


  const handleMarkdownFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setValidationStatus({});
    setMarkdownFile(null);
    setMarkdownContent(null);
    setValidatedFrontmatter(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      
      try {
        let finalContent = content;
        // Override publishDate if setting is 'system'
        if (publishDateSource === 'system') {
            const today = new Date().toISOString().split('T')[0];
            finalContent = updateFrontmatter(content, { publishDate: today });
        }
        
        const { frontmatter } = parseMarkdown(finalContent);
        
        const errors = validationTemplate 
            ? validateWithTemplate(frontmatter, validationTemplate)
            : validateWithDefaults(frontmatter);

        if (errors.length > 0) {
            throw new Error(t('newPost.validationErrors.validationFailIntro') + '\n' + errors.join('\n'));
        }

        setMarkdownContent(finalContent);
        setMarkdownFile(file);
        setValidatedFrontmatter(frontmatter);
        setValidationStatus({ success: t('newPost.validationSuccess') });

      } catch (err) {
          const errorMessage = err instanceof Error ? err.message : t('newPost.validationErrors.parseError');
          setValidationStatus({ error: `${t('newPost.validationErrorTitle')}\n${errorMessage}` });
      } finally {
          setIsProcessingFile(false);
      }
    };
    reader.onerror = () => {
        setIsProcessingFile(false);
        setValidationStatus({ error: t('newPost.validationErrors.fileReadError') });
    }
    reader.readAsText(file);
  };
  
  const renderMetadataValue = (key: string, value: any) => {
    if (Array.isArray(value)) {
      return (
        <div className="flex flex-wrap gap-1">
          {value.map((item, index) => (
            <span key={`${key}-${index}`} className="bg-gray-200 text-gray-800 text-xs font-medium px-2 py-0.5 rounded-full">
              {String(item)}
            </span>
          ))}
        </div>
      );
    }
    if (typeof value === 'object' && value !== null) {
        return (
            <div className="pl-3 mt-1 space-y-1">
                {Object.entries(value).map(([subKey, subValue]) => (
                    <div key={subKey} className="grid grid-cols-3 text-xs">
                        <span className="font-semibold text-gray-500 capitalize col-span-1">{subKey}:</span>
                        <span className="text-gray-700 col-span-2 break-all">{String(subValue)}</span>
                    </div>
                ))}
            </div>
        )
    }
    if (typeof value === 'string' && value.startsWith('http')) {
        return <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{value}</a>
    }
    return <span className="text-gray-900 break-all">{String(value)}</span>;
  };

  const handlePublish = async () => {
    if (!markdownContent || !markdownFile || validationStatus.error) {
        setError(t('newPost.publishError'));
        return;
    }

    setIsPublishing(true);
    setError(null);
    setSuccess(null);

    try {
        // First, upload all the (processed) image files
        await Promise.all(imageFiles.map(file => {
            const commitMessage = newImageCommitTemplate.replace('{filename}', file.name);
            const fullPath = imagesPath ? `${imagesPath}/${file.name}` : file.name;
            return gitService.uploadFile(fullPath, file, commitMessage);
        }));

        // Now, prepare the markdown file, updating any changed image names
        let finalMarkdownContent = markdownContent;
        for (const [originalName, newName] of Object.entries(imageNameChanges)) {
            const regex = new RegExp(escapeRegExp(originalName), 'g');
            finalMarkdownContent = finalMarkdownContent.replace(regex, newName);
        }

        const { frontmatter } = parseMarkdown(finalMarkdownContent);
        // Ensure slugify receives a string, even if title is undefined or unknown type
        const slug = slugify(String(frontmatter.title || ''));
        const fileExtension = markdownFile.name.split('.').pop() || 'md';
        const filename = `${slug}.${fileExtension}`;
        const postPath = postsPath ? `${postsPath}/${filename}` : filename;
        
        const commitMessage = newPostCommitTemplate.replace('{filename}', filename);
        await gitService.createFileFromString(postPath, finalMarkdownContent, commitMessage);

        setSuccess(t('newPost.publishSuccess', { filename }));
        setTimeout(resetState, 3000);

    } catch(err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred during publishing.');
    } finally {
        setIsPublishing(false);
    }
  };

  const imagesUploaded = imageFiles.length > 0;
  const postValidated = !!validatedFrontmatter && !validationStatus.error;
  const isPublished = !!success;

  return (
    <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
      <div className="flex-grow space-y-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold text-gray-800 mb-1 flex items-center">
            <PhotoIcon className="w-6 h-6 mr-3 text-purple-500" />
            {t('newPost.step1Title')}
          </h2>
          <p className="text-gray-600 text-sm mb-6">{t('newPost.step1Desc')}</p>
          
          <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 text-center transition-colors bg-white hover:border-blue-500">
            <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
            <label htmlFor="image-upload" className="relative cursor-pointer">
              <span className="text-blue-600 font-semibold">{t('newPost.imageSelect')}</span>
              <p className="text-xs text-gray-500">{t('newPost.imageSelectDesc')}</p>
            </label>
            <input id="image-upload" name="file-upload" type="file" className="sr-only" accept={imageFileTypes} onChange={handleImageChange} multiple />
          </div>

          {imagePreviews.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold text-gray-700 mb-2">{t('newPost.imagePreviews')}</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                {imagePreviews.map((src, index) => (
                  <img key={index} src={src} alt={`Preview ${index}`} className="w-full h-24 object-cover rounded-md border border-gray-200" />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold text-gray-800 mb-1 flex items-center">
            <DocumentIcon className="w-6 h-6 mr-3 text-blue-500" />
            {t('newPost.step2Title')}
          </h2>
          <p className="text-gray-600 text-sm mb-4">{t('newPost.step2Desc')}</p>
           
          <div className="mb-6 p-3 text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-md flex items-start">
            <InfoIcon className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
            <div>
                {validationTemplate ? (
                    <span dangerouslySetInnerHTML={{ __html: t('newPost.validationInfo.custom') }} />
                ) : (
                    <span dangerouslySetInnerHTML={{ __html: t('newPost.validationInfo.default') }} />
                )}
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 text-center transition-colors bg-white hover:border-blue-500">
              <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
              <label htmlFor="md-upload" className="relative cursor-pointer">
                <span className="text-blue-600 font-semibold">{t('newPost.postSelect')}</span>
                <p className="text-xs text-gray-500">{t('newPost.postSelectDesc')}</p>
              </label>
              <input id="md-upload" name="md-upload" type="file" className="sr-only" accept=".md,.mdx" onChange={handleMarkdownFileChange} />
            </div>

            {isProcessingFile && (
              <div className="flex items-center text-sm text-gray-600">
                <SpinnerIcon className="animate-spin h-4 w-4 mr-2" />
                {t('newPost.processing')}
              </div>
            )}
            {validationStatus.error && (
              <div className="p-3 bg-red-50 border-l-4 border-red-400 text-red-700 text-sm whitespace-pre-wrap">
                {validationStatus.error}
              </div>
            )}
            {validatedFrontmatter && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-semibold text-green-800 mb-3">{validationStatus.success}</p>
                 <div className="bg-white p-3 border border-gray-200 rounded-md space-y-2">
                    {Object.entries(validatedFrontmatter).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-4 gap-2 items-start text-sm">
                        <span className="font-semibold text-gray-600 capitalize col-span-1 break-words">{key}:</span>
                        <div className="col-span-3">{renderMetadataValue(key, value)}</div>
                    </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <aside className="lg:w-80 flex-shrink-0">
        <div className="sticky top-28 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('newPost.progress.title')}</h3>
                <ol>
                    <TimelineItem title={t('newPost.progress.step1')} description={t('newPost.progress.step1Desc')} isComplete={imagesUploaded} isActive={true} />
                    <TimelineItem title={t('newPost.progress.step2')} description={t('newPost.progress.step2Desc')} isComplete={postValidated} isActive={imagesUploaded} />
                    <TimelineItem title={t('newPost.progress.step3')} description={t('newPost.progress.step3Desc')} isComplete={isPublished} isActive={postValidated} isLast={true} />
                </ol>
            </div>
             <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('newPost.howItWorks.title')}</h3>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    <li>{t('newPost.howItWorks.li1')}</li>
                    <li>{t('newPost.howItWorks.li2')}</li>
                    <li>{t('newPost.howItWorks.li3')}</li>
                    <li>{t('newPost.howItWorks.li4')}</li>
                </ul>
            </div>
             <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <button
                onClick={handlePublish}
                disabled={isPublishing || !postValidated}
                className="w-full flex justify-center items-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                {isPublishing ? (
                    <>
                    <SpinnerIcon className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                    {t('newPost.publishing')}
                    </>
                ) : (
                    t('newPost.publishButton')
                )}
                </button>
                 {error && <p className="text-center text-red-500 text-sm mt-3">{error}</p>}
                {success && <p className="text-center text-green-500 text-sm mt-3">{success}</p>}
            </div>
        </div>
      </aside>
    </div>
  );
};

export default NewPostCreator;
