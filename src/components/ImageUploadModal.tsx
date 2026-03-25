
import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { CloseIcon } from './icons/CloseIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { TrashIcon } from './icons/TrashIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';

interface ImageUploadModalProps {
    files: File[];
    existingFileNames: string[];
    onClose: () => void;
    onUpload: (files: File[]) => Promise<void>;
}

interface FileWithStatus {
    file: File;
    preview: string;
    exists: boolean;
    overwrite: boolean;
}

const ImageUploadModal: React.FC<ImageUploadModalProps> = ({ files, existingFileNames, onClose, onUpload }) => {
    const { t } = useI18n();
    const [fileList, setFileList] = useState<FileWithStatus[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        const processed = files.map(file => ({
            file,
            preview: URL.createObjectURL(file),
            exists: existingFileNames.includes(file.name),
            overwrite: false 
        }));
        setFileList(processed);

        return () => {
            processed.forEach(f => URL.revokeObjectURL(f.preview));
        }
    }, [files, existingFileNames]);

    const toggleOverwrite = (index: number) => {
        setFileList(prev => prev.map((item, i) =>
            i === index ? { ...item, overwrite: !item.overwrite } : item
        ));
    };

    const removeFile = (index: number) => {
        setFileList(prev => {
            const newList = [...prev];
            URL.revokeObjectURL(newList[index].preview);
            newList.splice(index, 1);
            return newList;
        });
    };

    const handleUploadClick = async () => {
        const filesToUpload = fileList
            .filter(item => !item.exists || item.overwrite)
            .map(item => item.file);

        if (filesToUpload.length === 0) {
            onClose();
            return;
        }

        setIsUploading(true);
        await onUpload(filesToUpload);
        setIsUploading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl border border-notion-border w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
                <header className="px-5 py-4 border-b border-notion-border flex justify-between items-center bg-white">
                    <h3 className="text-base font-semibold text-notion-text">{t('imageUploadModal.title')}</h3>
                    <button onClick={onClose} disabled={isUploading} className="text-notion-muted hover:text-notion-text p-1 rounded-sm hover:bg-notion-hover transition-colors">
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </header>
                
                <div className="p-2 flex-grow overflow-y-auto bg-notion-sidebar">
                    {fileList.length === 0 ? (
                        <p className="text-center text-notion-muted text-sm italic py-8">{t('imageUploadModal.noFiles')}</p>
                    ) : (
                        <ul className="space-y-1">
                            {fileList.map((item, index) => (
                                <li key={index} className="flex items-center p-2 rounded-sm bg-white border border-notion-border hover:bg-notion-hover/50 transition-colors group">
                                    <div className="h-10 w-10 flex-shrink-0 rounded-sm overflow-hidden bg-gray-100 mr-3 border border-notion-border">
                                        <img src={item.preview} alt="preview" className="h-full w-full object-cover" />
                                    </div>
                                    
                                    <div className="flex-grow min-w-0 mr-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-medium text-notion-text truncate" title={item.file.name}>{item.file.name}</p>
                                            <span className="text-[10px] text-notion-muted ml-2 bg-notion-sidebar px-1.5 rounded-sm border border-notion-border whitespace-nowrap">{(item.file.size / 1024).toFixed(1)} KB</span>
                                        </div>
                                        
                                        <div className="mt-0.5">
                                            {item.exists ? (
                                                <div className="flex items-center text-xs">
                                                    <ExclamationTriangleIcon className={`w-3 h-3 mr-1 ${item.overwrite ? 'text-yellow-600' : 'text-red-500'}`} />
                                                    <span className={`mr-2 ${item.overwrite ? 'text-yellow-700' : 'text-red-700'}`}>
                                                        {t('imageUploadModal.exists')}
                                                    </span>
                                                    <label className="flex items-center cursor-pointer select-none hover:text-notion-text text-notion-muted transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            checked={item.overwrite}
                                                            onChange={() => toggleOverwrite(index)}
                                                            disabled={isUploading}
                                                            className="mr-1.5 rounded-sm text-notion-blue focus:ring-0 border-gray-300 w-3.5 h-3.5"
                                                        />
                                                        {t('imageUploadModal.overwriteOption')}
                                                    </label>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-green-600 flex items-center">
                                                    <CheckCircleIcon className="w-3 h-3 mr-1" />
                                                    {t('imageUploadModal.ready')}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <button 
                                        onClick={() => removeFile(index)} 
                                        disabled={isUploading}
                                        className="p-1.5 text-notion-muted hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors opacity-0 group-hover:opacity-100"
                                        title="Remove file"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <footer className="px-5 py-3 border-t border-notion-border bg-white flex justify-end gap-2">
                    <button 
                        onClick={onClose} 
                        disabled={isUploading}
                        className="px-3 py-1.5 bg-white border border-notion-border rounded-sm text-notion-text font-medium hover:bg-notion-hover transition-colors text-sm shadow-sm"
                    >
                        {t('imageUploadModal.cancel')}
                    </button>
                    <button
                        onClick={handleUploadClick}
                        disabled={isUploading || fileList.filter(i => !i.exists || i.overwrite).length === 0}
                        className="px-4 py-1.5 bg-notion-blue text-white font-medium rounded-sm hover:bg-blue-600 transition-all text-sm shadow-sm flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isUploading && <SpinnerIcon className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                        {t('imageUploadModal.upload', { count: fileList.filter(i => !i.exists || i.overwrite).length })}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default ImageUploadModal;
