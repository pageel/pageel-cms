
import React, { useState, useEffect } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { CloseIcon } from './icons/CloseIcon';
import { TrashIcon } from './icons/TrashIcon';
import { useI18n } from '../i18n/I18nContext';
import { DocumentIcon } from './icons/DocumentIcon';



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

interface PostPreviewModalProps {
  post: PostData;
  onClose: () => void;
  onDelete: (post: PostData) => void;
}

const PostPreviewModal: React.FC<PostPreviewModalProps> = ({ post, onClose, onDelete }) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const { t } = useI18n();

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const createMarkup = (markdownContent: string) => {
    const rawMarkup = marked.parse(markdownContent) as string;
    const sanitizedMarkup = DOMPurify.sanitize(rawMarkup);
    return { __html: sanitizedMarkup };
  };
  
  const renderMetadataValue = (key: string, value: any) => {
    if (Array.isArray(value)) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item, index) => (
            <span key={`${key}-${index}`} className="bg-[#E3E2E0] text-[#32302C] text-[12px] px-1.5 py-0.5 rounded-[3px] leading-tight">
              {String(item)}
            </span>
          ))}
        </div>
      );
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return <span className="text-[#787774] text-sm italic">[Object]</span>;
    }
    if (typeof value === 'string' && value.startsWith('http')) {
        return <a href={value} target="_blank" rel="noopener noreferrer" className="text-notion-blue hover:underline break-all text-sm">{value}</a>
    }
    return <span className="text-[#37352F] text-sm break-words leading-relaxed">{String(value)}</span>;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col border border-notion-border overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Notion Center Peek Style */}
        <header className="px-4 py-3 border-b border-notion-border flex justify-between items-center bg-white flex-shrink-0 h-[48px]">
          <div className="flex items-center gap-2 text-sm text-[#787774] truncate">
             <div className="flex items-center hover:bg-notion-hover px-1.5 py-0.5 rounded cursor-pointer transition-colors">
                <DocumentIcon className="w-4 h-4 mr-1.5" />
                <span className="text-xs">Page</span>
             </div>
             <span className="text-gray-300">/</span>
             <span className="truncate font-medium text-notion-text text-sm cursor-default">{post.frontmatter.title || post.name}</span>
          </div>
          <div className="flex items-center space-x-1">
            <button
                onClick={() => onDelete(post)}
                className="p-1 text-[#787774] hover:text-red-600 hover:bg-notion-hover rounded-sm transition-colors"
                title={t('postPreview.delete')}
            >
                <TrashIcon className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1 text-[#787774] hover:text-[#37352F] hover:bg-notion-hover rounded-sm transition-colors">
              <CloseIcon className="w-4.5 h-4.5" />
            </button>
          </div>
        </header>

        <div className="flex-grow overflow-y-auto bg-white custom-scrollbar">
            {/* Cover Image (if any) */}
            {post.thumbnailUrl && (
                <div className="h-48 w-full bg-gray-50 border-b border-notion-border relative overflow-hidden group">
                    <img src={post.thumbnailUrl} alt="Cover" className="w-full h-full object-cover" />
                </div>
            )}

            <div className="max-w-3xl mx-auto px-8 lg:px-12 py-10">
                {/* Icon Placeholder Area */}
                <div className="mb-4 text-5xl">📄</div>

                {/* Title */}
                <h1 className="text-4xl font-bold text-[#37352F] mb-8 break-words leading-tight tracking-tight">
                    {post.frontmatter.title || post.name.replace(/\.(md|mdx)$/, '')}
                </h1>

                {/* Properties (Metadata) - Grid Layout */}
                <div className="mb-8 space-y-0.5">
                    {Object.entries(post.frontmatter).filter(([k]) => k !== 'title').map(([key, value]) => (
                        <div key={key} className="flex py-1.5 text-sm group hover:bg-notion-hover/30 rounded-sm -mx-2 px-2 transition-colors">
                            <div className="w-40 flex-shrink-0 flex items-center text-[#787774]">
                                {/* Simulate random icons for properties */}
                                <span className="mr-2 opacity-70">
                                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current"><path d="M1.5 6.5a1 1 0 011-1h11a1 1 0 011 1v7a1 1 0 01-1 1h-11a1 1 0 01-1-1v-7z" opacity="0.6"/><path d="M1.5 2.5a1 1 0 011-1h11a1 1 0 011 1v2a1 1 0 01-1 1h-11a1 1 0 01-1-1v-2z"/></svg>
                                </span>
                                <span className="capitalize truncate text-sm">{key}</span>
                            </div>
                            <div className="flex-grow min-w-0 flex items-center">
                                {renderMetadataValue(key, value)}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="border-t border-[#E9E9E7] my-8"></div>

                {/* Tabs for Content View */}
                <div className="flex border-b border-[#E9E9E7] mb-8 sticky top-0 bg-white z-10 pt-2">
                    <button
                        onClick={() => setActiveTab('preview')}
                        className={`pb-2 px-1 mr-6 text-sm font-medium transition-all ${
                            activeTab === 'preview'
                            ? 'text-[#37352F] border-b-2 border-[#37352F]'
                            : 'text-[#787774] hover:text-[#37352F] border-b-2 border-transparent'
                        }`}
                    >
                        {t('postPreview.tabPreview')}
                    </button>
                    <button
                        onClick={() => setActiveTab('code')}
                        className={`pb-2 px-1 text-sm font-medium transition-all ${
                            activeTab === 'code'
                            ? 'text-[#37352F] border-b-2 border-[#37352F]'
                            : 'text-[#787774] hover:text-[#37352F] border-b-2 border-transparent'
                        }`}
                    >
                        {t('postPreview.tabMarkdown')}
                    </button>
                </div>

                {/* Content Area */}
                {activeTab === 'preview' ? (
                    <div
                        className="prose prose-sm sm:prose-base max-w-none text-[#37352F] markdown-preview pb-20 prose-headings:font-semibold prose-a:text-notion-blue prose-img:rounded-md prose-img:shadow-sm"
                        dangerouslySetInnerHTML={createMarkup(post.body)}
                    />
                ) : (
                    <pre className="bg-[#F7F6F3] p-4 rounded-md text-xs font-mono text-[#37352F] border border-[#E9E9E7] overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner">
                        {post.rawContent}
                    </pre>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default PostPreviewModal;
