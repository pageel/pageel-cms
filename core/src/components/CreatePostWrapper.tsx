
import React, { useState } from 'react';
import PostWorkflow from './PostWorkflow';
import { IGitService, GithubRepo } from '../types';
import { useI18n } from '../i18n/I18nContext';
import { ArrowUturnLeftIcon } from './icons/ArrowUturnLeftIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { DocumentIcon } from './icons/DocumentIcon';

interface CreatePostWrapperProps {
    gitService: IGitService;
    repo: GithubRepo;
    settings: any;
    postsPath: string;
    imagesPath: string;
    collectionId?: string;
    onComplete: () => void;
    onAction: () => void;
}

type Mode = 'library' | 'post-wizard';

const CreatePostWrapper: React.FC<CreatePostWrapperProps> = ({ 
    gitService, 
    repo, 
    settings, 
    postsPath,
    imagesPath,
    collectionId,
    onComplete, 
    onAction 
}) => {
    const { t } = useI18n();
    const [mode, setMode] = useState<Mode>('library');

    if (mode === 'library') {
        return (
            <div className="w-full animate-fade-in">
                
                {/* Intro Section */}
                <div className="mb-8">
                    <p className="text-base text-notion-text max-w-2xl leading-relaxed">
                        {t('workflows.libraryDesc')}
                    </p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Workflow Card: Post Wizard */}
                    <button 
                        onClick={() => setMode('post-wizard')}
                        className="group relative flex flex-col bg-white border border-notion-border rounded-lg overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-1 hover:border-notion-blue/50 text-left h-full"
                    >
                        {/* Card Cover */}
                        <div className="h-32 bg-gradient-to-br from-blue-50 to-indigo-50 w-full flex items-center justify-center border-b border-notion-border group-hover:from-blue-100 group-hover:to-indigo-100 transition-colors">
                             <div className="bg-white p-3 rounded-xl shadow-sm border border-blue-100">
                                <CheckCircleIcon className="w-8 h-8 text-blue-500" />
                             </div>
                        </div>
                        
                        {/* Card Body */}
                        <div className="p-5 flex-grow flex flex-col">
                            <h3 className="text-base font-bold text-notion-text mb-2 group-hover:text-blue-600 transition-colors">
                                {t('workflows.wizard.title')}
                            </h3>
                            <p className="text-sm text-notion-muted leading-relaxed">
                                {t('workflows.wizard.desc')}
                            </p>
                        </div>

                        {/* Badge - "Free" */}
                        <div className="absolute top-3 right-3">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-800 border border-green-200 shadow-sm">
                                Free
                            </span>
                        </div>
                    </button>

                    {/* Placeholder: AI Writer (Example of Premium/Future) */}
                    <div className="group relative flex flex-col bg-gray-50/50 border border-notion-border border-dashed rounded-lg overflow-hidden h-full transition-opacity cursor-not-allowed">
                        <div className="h-32 bg-gray-100/50 w-full flex items-center justify-center border-b border-notion-border border-dashed">
                             <span className="text-4xl grayscale opacity-30">✨</span>
                        </div>
                        <div className="p-5">
                            <h3 className="text-base font-bold text-notion-muted mb-2">AI Writer</h3>
                            <p className="text-sm text-notion-muted opacity-70">Generate full blog posts from a simple prompt using AI.</p>
                        </div>
                        <div className="absolute top-3 right-3">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-gray-200 text-gray-500 border border-gray-300">
                                Coming Soon
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in">
            {mode === 'post-wizard' && (
                <PostWorkflow 
                    gitService={gitService}
                    repo={repo}
                    postsPath={postsPath}
                    imagesPath={imagesPath}
                    collectionId={collectionId}
                    imageFileTypes={settings.imageFileTypes}
                    newPostCommitTemplate={settings.newPostCommit}
                    newImageCommitTemplate={settings.newImageCommit}
                    imageCompressionEnabled={settings.imageCompressionEnabled}
                    maxImageSize={settings.maxImageSize}
                    imageResizeMaxWidth={settings.imageResizeMaxWidth}
                    domainUrl={settings.domainUrl}
                    projectType={settings.projectType}
                    onComplete={onComplete}
                    onCancel={() => setMode('library')}
                    onAction={onAction}
                />
            )}
        </div>
    );
};

export default CreatePostWrapper;
