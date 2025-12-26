
import React, { useState, useEffect } from 'react';
import { GithubRepo, IGitService, GithubContent } from '../types';
import { parseMarkdown, inferFrontmatterType } from '../utils/parsing';
import { UploadIcon } from './icons/UploadIcon';
import { InfoIcon } from './icons/InfoIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { useI18n } from '../i18n/I18nContext';
import { ArrowUturnLeftIcon } from './icons/ArrowUturnLeftIcon';
import { SearchIcon } from './icons/SearchIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { useCollectionStore, CollectionTemplate, TemplateField } from '../features/collections';

interface TemplateGeneratorProps {
    gitService: IGitService;
    repo: GithubRepo;
    postsPath: string;
    /** Optional collection ID for per-collection template */
    collectionId?: string;
    /** Callback when template is saved (for syncing to .pageelrc.json) */
    onTemplateSaved?: () => void;
}

const defaultTemplate: Record<string, string> = {
    publishDate: 'date',
    title: 'string',
    author: 'string',
    excerpt: 'string',
    image: 'string',
    category: 'string',
    tags: 'array',
    metadata: 'object',
};

const MAX_COLUMNS = 5;

// Default widths in percentage
const DEFAULT_WIDTHS: Record<string, number> = {
    '__name__': 35, // Special key for Name column
    'default': 15
};

const TemplateGenerator: React.FC<TemplateGeneratorProps> = ({ gitService, repo, postsPath, collectionId, onTemplateSaved }) => {
    const [currentTemplate, setCurrentTemplate] = useState<Record<string, string> | null>(null);
    const [parsedTemplate, setParsedTemplate] = useState<Record<string, string> | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Scan state
    const [repoPosts, setRepoPosts] = useState<GithubContent[]>([]);
    const [isScanning, setIsScanning] = useState(false);

    // Columns config state
    const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({ '__name__': 35 });

    const { t } = useI18n();
    
    // Collection store for per-collection templates
    const { workspace, updateCollection } = useCollectionStore();
    const activeCollection = collectionId 
        ? workspace?.collections.find(c => c.id === collectionId) 
        : null;

    // Fallback keys for localStorage (repo-wide)
    const templateKey = `postTemplate_${repo.full_name}`;
    const columnsKey = `postTableColumns_${repo.full_name}`;
    const widthsKey = `postTableColumnWidths_${repo.full_name}`;

    // Convert CollectionTemplate to Record<string, string> format
    const collectionTemplateToRecord = (template: CollectionTemplate): Record<string, string> => {
        const record: Record<string, string> = {};
        template.fields.forEach(field => {
            record[field.name] = field.type;
        });
        return record;
    };

    // Convert Record<string, string> to CollectionTemplate format
    const recordToCollectionTemplate = (record: Record<string, string>): CollectionTemplate => {
        return {
            fields: Object.entries(record).map(([name, type]) => ({
                name,
                type: type as TemplateField['type'],
            })),
        };
    };

    useEffect(() => {
        // Load template from collection store if available, otherwise from localStorage
        if (activeCollection?.template) {
            setCurrentTemplate(collectionTemplateToRecord(activeCollection.template));
            setSelectedColumns(activeCollection.tableColumns || []);
            setColumnWidths(activeCollection.columnWidths || { '__name__': 35 });
        } else {
            // Fallback to localStorage
            const savedTemplate = localStorage.getItem(templateKey);
            const savedColumns = localStorage.getItem(columnsKey);
            const savedWidths = localStorage.getItem(widthsKey);

            if (savedTemplate) {
                try {
                    setCurrentTemplate(JSON.parse(savedTemplate));
                } catch (e) {
                    console.error("Failed to parse template from localStorage", e);
                }
            } else {
                setCurrentTemplate(null);
            }

            if (savedColumns) {
                try {
                    setSelectedColumns(JSON.parse(savedColumns));
                } catch {
                    setSelectedColumns([]);
                }
            } else {
                setSelectedColumns([]);
            }

            if (savedWidths) {
                try {
                    setColumnWidths(JSON.parse(savedWidths));
                } catch {
                    setColumnWidths({ '__name__': 35 });
                }
            }
        }
    }, [collectionId, activeCollection?.template, templateKey, columnsKey, widthsKey]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setError(null);
        setSuccess(null);
        setParsedTemplate(null);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                processContent(content);
            } catch (err) {
                setError(err instanceof Error ? err.message : t('templateGenerator.error.parse'));
            } finally {
                setIsLoading(false);
            }
        };
        reader.onerror = () => {
            setError(t('templateGenerator.error.read'));
            setIsLoading(false);
        };
        reader.readAsText(file);
    };

    const handleScanPosts = async () => {
        if (!postsPath) {
            setError(t('templateGenerator.error.noPostsPath'));
            return;
        }
        setIsScanning(true);
        setError(null);
        try {
            const contents = await gitService.getRepoContents(postsPath);
            const posts = contents.filter(item =>
                item.type === 'file' && (item.name.endsWith('.md') || item.name.endsWith('.mdx'))
            );
            setRepoPosts(posts);
            if (posts.length === 0) {
                setError(t('templateGenerator.error.noPostsInRepo'));
            }
        } catch (e) {
            setError(t('templateGenerator.error.fetchPosts'));
        } finally {
            setIsScanning(false);
        }
    };

    const handleRepoPostSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const path = e.target.value;
        if (!path) return;

        setIsLoading(true);
        setError(null);
        setSuccess(null);
        setParsedTemplate(null);

        try {
            const content = await gitService.getFileContent(path);
            processContent(content);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('templateGenerator.error.parse'));
        } finally {
            setIsLoading(false);
        }
    }

    const processContent = (content: string) => {
        const { frontmatter } = parseMarkdown(content);

        if (Object.keys(frontmatter).length === 0) {
            throw new Error(t('templateGenerator.error.noFrontmatter'));
        }

        const newTemplate: Record<string, string> = {};
        for (const [key, value] of Object.entries(frontmatter)) {
            newTemplate[key] = inferFrontmatterType(value);
        }
        setParsedTemplate(newTemplate);

        // Auto-select limited to MAX_COLUMNS, excluding fixed columns
        const potentialCols = Object.keys(newTemplate).filter(k => !['title', 'image', 'cover', 'thumbnail'].includes(k));
        setSelectedColumns(potentialCols.slice(0, MAX_COLUMNS));
    }

    const saveTemplate = async (templateToSave: Record<string, string>) => {
        setIsSaving(true);
        setError(null);
        try {
            // Get the target collection - either the specified one or the active one
            const targetCollectionId = collectionId || useCollectionStore.getState().workspace?.activeCollectionId;
            const targetCollection = targetCollectionId 
                ? useCollectionStore.getState().workspace?.collections.find(c => c.id === targetCollectionId)
                : activeCollection;

            if (targetCollectionId && targetCollection) {
                const collectionTemplate = recordToCollectionTemplate(templateToSave);
                updateCollection(targetCollectionId, {
                    template: collectionTemplate,
                    tableColumns: selectedColumns,
                    columnWidths: columnWidths,
                });
                // Notify parent to sync .pageelrc.json
                onTemplateSaved?.();
            } else {
                // No collection exists - save to first collection or show error
                const firstCollection = useCollectionStore.getState().workspace?.collections[0];
                if (firstCollection) {
                    const collectionTemplate = recordToCollectionTemplate(templateToSave);
                    updateCollection(firstCollection.id, {
                        template: collectionTemplate,
                        tableColumns: selectedColumns,
                        columnWidths: columnWidths,
                    });
                    onTemplateSaved?.();
                } else {
                    console.warn("No collection available to save template to");
                }
            }

            setCurrentTemplate(templateToSave);
            const isDefault = JSON.stringify(templateToSave) === JSON.stringify(defaultTemplate);
            setSuccess(isDefault ? t('templateGenerator.success.default') : t('templateGenerator.success.saved'));
            setParsedTemplate(null);
        } catch (e) {
            setError("Failed to save template.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadSample = (template: Record<string, string>) => {
        let fmString = '---\n';
        for (const [key, type] of Object.entries(template)) {
            switch (type) {
                case 'date': fmString += `${key}: ${new Date().toISOString().split('T')[0]}\n`; break;
                case 'array': fmString += `${key}:\n  - item1\n  - item2\n`; break;
                case 'object': fmString += `${key}:\n  subKey: "sub value"\n`; break;
                case 'string':
                default: fmString += `${key}: "Your ${key} here"\n`; break;
            }
        }
        fmString += '---\n\nYour content here...';

        const blob = new Blob([fmString], { type: 'text/markdown;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'template-sample.md';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };

    const toggleColumnSelection = (field: string) => {
        setSelectedColumns(prev => {
            if (prev.includes(field)) {
                return prev.filter(f => f !== field);
            }
            if (prev.length >= MAX_COLUMNS) {
                return prev;
            }
            return [...prev, field];
        });
    };

    const handleWidthChange = (field: string, value: string) => {
        const val = parseInt(value, 10);
        if (isNaN(val) || val < 5 || val > 90) return; // Basic validation
        setColumnWidths(prev => ({
            ...prev,
            [field]: val
        }));
    };

    const renderTypePill = (type: string) => {
        const typeStyles: Record<string, string> = {
            'string': 'bg-blue-50 text-blue-700 border-blue-100',
            'date': 'bg-orange-50 text-orange-700 border-orange-100',
            'array': 'bg-purple-50 text-purple-700 border-purple-100',
            'object': 'bg-gray-100 text-gray-700 border-gray-200',
            'default': 'bg-gray-50 text-gray-600 border-gray-200'
        };
        const style = typeStyles[type] || typeStyles['default'];
        return (
            <span className={`px-2 py-0.5 inline-flex text-xs font-medium rounded-sm border ${style}`}>
                {type}
            </span>
        );
    }

    const renderConfigurationCard = (template: Record<string, string>, title: string, isPreview: boolean) => {
        // Filter out fields that shouldn't be optional columns
        const configurableFields = Object.keys(template).filter(key => key !== 'title' && key !== 'image' && key !== 'cover' && key !== 'thumbnail');

        return (
            <div className={`rounded-lg shadow-sm border ${isPreview ? 'bg-white border-notion-blue/30 ring-1 ring-notion-blue/20' : 'bg-white border-notion-border'} p-0 transition-all duration-300 overflow-hidden`}>
                <div className="px-5 py-4 border-b border-notion-border bg-gray-50/50 flex justify-between items-center">
                    <div>
                        <h3 className="text-sm font-bold text-notion-text">{title}</h3>
                        {isPreview && <span className="text-[10px] text-notion-blue font-medium mt-0.5 block">Unsaved Changes</span>}
                    </div>
                </div>

                {/* Validation Rules Section - Table Style */}
                <div className="p-0">
                    <table className="min-w-full text-left border-collapse">
                        <thead className="bg-notion-sidebar border-b border-notion-border">
                            <tr>
                                <th scope="col" className="px-5 py-2 text-[11px] font-semibold text-notion-muted uppercase tracking-wider border-r border-notion-border/50">{t('templateGenerator.table.field')}</th>
                                <th scope="col" className="px-5 py-2 text-[11px] font-semibold text-notion-muted uppercase tracking-wider">{t('templateGenerator.table.type')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-notion-border">
                            {Object.entries(template).map(([key, type]) => (
                                <tr key={key} className="hover:bg-notion-hover/30 transition-colors">
                                    <td className="px-5 py-2 text-sm text-notion-text font-medium border-r border-notion-border/50 flex items-center">
                                        <span className="w-4 h-4 mr-2 text-notion-muted/70">
                                            {/* Simulate Notion Property Icons */}
                                            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M13.33 2.67H2.67C1.93 2.67 1.33 3.27 1.33 4V12C1.33 12.73 1.93 13.33 2.67 13.33H13.33C14.07 13.33 14.67 12.73 14.67 12V4C14.67 3.27 14.07 2.67 13.33 2.67ZM13.33 12H2.67V4H13.33V12Z" /></svg>
                                        </span>
                                        {key}
                                    </td>
                                    <td className="px-5 py-2">
                                        {renderTypePill(type)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Column Configuration Section */}
                {configurableFields.length > 0 && (
                    <div className="p-5 border-t border-notion-border bg-gray-50/30">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-semibold text-notion-muted uppercase tracking-wider">{t('templateGenerator.columns.title')}</h4>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-sm ${selectedColumns.length >= MAX_COLUMNS ? 'bg-orange-100 text-orange-800' : 'bg-notion-sidebar text-notion-muted'}`}>
                                {selectedColumns.length}/{MAX_COLUMNS}
                            </span>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-4">
                            {configurableFields.map(field => {
                                const isSelected = selectedColumns.includes(field);
                                const isDisabled = !isSelected && selectedColumns.length >= MAX_COLUMNS;

                                return (
                                    <button
                                        key={field}
                                        onClick={() => toggleColumnSelection(field)}
                                        disabled={isDisabled}
                                        className={`
                                            px-2.5 py-1 rounded-sm text-xs font-medium transition-all duration-200 border
                                            ${isSelected
                                                ? 'bg-notion-blue text-white border-notion-blue shadow-sm'
                                                : isDisabled
                                                    ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                                                    : 'bg-white text-notion-text border-notion-border hover:bg-notion-hover'
                                            }
                                        `}
                                    >
                                        {field}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Column Width Configuration Table */}
                        <h4 className="text-xs font-semibold text-notion-muted uppercase tracking-wider mb-2">Column Widths (%)</h4>
                        <div className="bg-white border border-notion-border rounded-sm overflow-hidden text-sm">
                            {/* Fixed Name Column */}
                            <div className="flex items-center justify-between px-3 py-2 border-b border-notion-border">
                                <span className="text-notion-text font-medium text-xs">Col 1: Name (Fixed)</span>
                                <div className="flex items-center">
                                    <input
                                        type="number"
                                        value={columnWidths['__name__'] || 35}
                                        onChange={(e) => handleWidthChange('__name__', e.target.value)}
                                        className="w-12 text-right px-1 py-0.5 border border-notion-border rounded-sm text-xs focus:ring-1 focus:ring-notion-blue focus:outline-none"
                                    />
                                    <span className="text-xs text-notion-muted ml-1">%</span>
                                </div>
                            </div>

                            {/* Dynamic Columns */}
                            {selectedColumns.map((field, idx) => (
                                <div key={field} className="flex items-center justify-between px-3 py-2 border-b border-notion-border last:border-b-0">
                                    <span className="text-notion-text font-medium text-xs capitalize truncate">Col {idx + 2}: {field}</span>
                                    <div className="flex items-center">
                                        <input
                                            type="number"
                                            value={columnWidths[field] || 15}
                                            onChange={(e) => handleWidthChange(field, e.target.value)}
                                            className="w-12 text-right px-1 py-0.5 border border-notion-border rounded-sm text-xs focus:ring-1 focus:ring-notion-blue focus:outline-none"
                                        />
                                        <span className="text-xs text-notion-muted ml-1">%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Actions Footer */}
                <div className="p-4 border-t border-notion-border bg-white flex flex-wrap gap-3 justify-end">
                    {isPreview ? (
                        <button
                            onClick={() => saveTemplate(template)}
                            disabled={isSaving}
                            className="inline-flex items-center bg-notion-blue hover:bg-blue-600 text-white font-medium py-1.5 px-4 rounded-sm transition duration-200 shadow-sm disabled:opacity-50 text-sm"
                        >
                            {isSaving ? <SpinnerIcon className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircleIcon className="w-4 h-4 mr-2" />}
                            {t('templateGenerator.saveButton')}
                        </button>
                    ) : (
                        <>
                            <button onClick={() => handleDownloadSample(template)} className="inline-flex items-center justify-center bg-white hover:bg-notion-hover text-notion-text font-medium py-1.5 px-3 rounded-sm border border-notion-border transition duration-200 text-sm shadow-sm">
                                <DownloadIcon className="w-3.5 h-3.5 mr-2 text-notion-muted" />
                                {t('templateGenerator.downloadButton')}
                            </button>

                            <button
                                onClick={() => saveTemplate(template)}
                                disabled={isSaving}
                                className="inline-flex items-center justify-center bg-white hover:bg-notion-hover text-notion-blue font-medium py-1.5 px-3 rounded-sm border border-notion-border transition duration-200 text-sm shadow-sm disabled:opacity-50"
                            >
                                {isSaving && <SpinnerIcon className="w-3.5 h-3.5 mr-2 animate-spin" />}
                                {t('templateGenerator.saveButton')}
                            </button>

                            {!isPreview && JSON.stringify(template) !== JSON.stringify(defaultTemplate) && (
                                <button
                                    onClick={() => saveTemplate(defaultTemplate)}
                                    disabled={isSaving}
                                    className="ml-auto inline-flex items-center justify-center text-xs text-notion-muted hover:text-red-600 font-medium py-1.5 px-2 transition duration-200 disabled:opacity-50"
                                >
                                    <ArrowUturnLeftIcon className="w-3 h-3 mr-1.5" />
                                    {t('templateGenerator.useDefaultButton')}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* --- LEFT COLUMN: Source Selection --- */}
            <div className="lg:col-span-5 space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-notion-border">
                    <div className="flex items-center mb-4">
                        <div className="bg-notion-sidebar p-2 rounded-sm mr-3 border border-notion-border">
                            <DocumentIcon className="w-5 h-5 text-notion-text" />
                        </div>
                        <h2 className="text-lg font-bold text-notion-text">{t('templateGenerator.title')}</h2>
                    </div>
                    <p className="text-notion-muted text-sm mb-4 leading-relaxed">{t('templateGenerator.description')}</p>

                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-sm flex items-start text-xs text-blue-800">
                        <InfoIcon className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-blue-600" />
                        <span>{t('templateGenerator.info')}</span>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-notion-border">
                    <h3 className="font-semibold text-sm text-notion-text mb-4 uppercase tracking-wide text-notion-muted">{t('templateGenerator.uploadTitle')}</h3>

                    {/* Upload Area */}
                    <label htmlFor="template-upload" className="group relative block w-full border-2 border-dashed border-notion-border rounded-lg p-8 text-center cursor-pointer hover:border-notion-blue hover:bg-blue-50/20 transition-all duration-200">
                        <div className="mx-auto h-10 w-10 text-notion-muted group-hover:text-notion-blue transition-colors duration-200">
                            <UploadIcon />
                        </div>
                        <span className="mt-3 block text-sm font-medium text-notion-text group-hover:text-notion-blue transition-colors">
                            {isLoading ? t('templateGenerator.processing') : t('templateGenerator.uploadDesc')}
                        </span>
                        <input id="template-upload" type="file" className="sr-only" accept=".md,.mdx" onChange={handleFileChange} disabled={isLoading} />
                    </label>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <div className="w-full border-t border-notion-border"></div>
                        </div>
                        <div className="relative flex justify-center">
                            <span className="px-3 bg-white text-xs font-semibold text-notion-muted">{t('templateGenerator.or')}</span>
                        </div>
                    </div>

                    {/* Scan Area */}
                    <div>
                        <h3 className="font-semibold text-sm text-notion-text mb-2">{t('templateGenerator.scanRepoTitle')}</h3>
                        <p className="text-xs text-notion-muted mb-3">{t('templateGenerator.scanRepoDesc')}</p>

                        <div className="flex flex-col sm:flex-row gap-2">
                            <button
                                onClick={handleScanPosts}
                                disabled={isScanning || isLoading}
                                className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-notion-border shadow-sm text-sm font-medium rounded-sm text-notion-text bg-white hover:bg-notion-hover focus:outline-none focus:ring-1 focus:ring-notion-blue disabled:opacity-50 transition-colors"
                            >
                                {isScanning ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin mr-2" /> : <SearchIcon className="w-3.5 h-3.5 mr-2 text-notion-muted" />}
                                {t('templateGenerator.scanButton')}
                            </button>
                            {repoPosts.length > 0 && (
                                <select
                                    className="flex-[2] block w-full pl-3 pr-8 py-2 text-base border-notion-border focus:outline-none focus:ring-notion-blue focus:border-notion-blue sm:text-sm rounded-sm bg-white"
                                    onChange={handleRepoPostSelect}
                                    defaultValue=""
                                    disabled={isLoading}
                                >
                                    <option value="" disabled>{t('templateGenerator.selectPlaceholder')}</option>
                                    {repoPosts.map(post => (
                                        <option key={post.sha} value={post.path}>{post.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-sm text-sm text-red-600">
                        <p className="font-semibold text-xs uppercase mb-1">Error</p>
                        <p>{error}</p>
                    </div>
                )}
                {success && (
                    <div className="flex items-center p-3 text-sm text-green-700 bg-green-50 border border-green-100 rounded-sm shadow-sm">
                        <CheckCircleIcon className="w-4 h-4 mr-3 text-green-600" />
                        <span className="font-medium">{success}</span>
                    </div>
                )}
            </div>

            {/* --- RIGHT COLUMN: Configuration --- */}
            <div className="lg:col-span-7 sticky top-6">
                {parsedTemplate
                    ? renderConfigurationCard(parsedTemplate, t('templateGenerator.previewTitle'), true)
                    : renderConfigurationCard(currentTemplate || defaultTemplate, currentTemplate ? t('templateGenerator.activeTitle') : t('templateGenerator.defaultTitle'), false)
                }
            </div>
        </div>
    );
};

export default TemplateGenerator;
