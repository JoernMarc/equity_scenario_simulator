
import React, { useCallback, useRef } from 'react';
import type { Translations } from '../i18n';
import CloseIcon from './icons/CloseIcon';
import DownloadIcon from './icons/DownloadIcon';
import UploadIcon from './icons/UploadIcon';
import type { ParsedImportData } from '../logic/importExport';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: () => void;
  onExportExcelTemplate: () => void;
  onImport: (file: File) => void;
  translations: Translations;
  parsedImportData: ParsedImportData | null;
  importError: string | null;
  onConfirmImport: () => void;
  onClearImportPreview: () => void;
  isExportDisabled: boolean;
}

function ImportExportModal({
  isOpen,
  onClose,
  onExport,
  onExportExcelTemplate,
  onImport,
  translations: t,
  parsedImportData,
  importError,
  onConfirmImport,
  onClearImportPreview,
  isExportDisabled
}: ImportExportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onImport(e.dataTransfer.files[0]);
    }
  }, [onImport]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImport(e.target.files[0]);
    }
  };
  
  const triggerFileInput = () => fileInputRef.current?.click();

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-export-title"
    >
      <div 
        className="relative bg-theme-surface rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
            <h3 id="import-export-title" className="text-xl font-semibold text-theme-primary">{t.importExportTitle}</h3>
            <button 
                onClick={onClose} 
                className="text-theme-secondary hover:text-theme-primary"
                aria-label="Close"
            >
                <CloseIcon />
            </button>
        </div>
        
        <div className="overflow-y-auto space-y-6">
            <div className="space-y-4">
                <h4 className="font-semibold text-theme-primary">{t.export}</h4>
                <div className="p-4 bg-theme-subtle rounded-md border border-theme-subtle space-y-3">
                    <div>
                        <p className="font-medium text-theme-primary">{t.exportToJson}</p>
                        <p className="text-sm text-theme-secondary mb-2">{t.exportDescription}</p>
                        <button onClick={onExport} disabled={isExportDisabled} className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-theme-on-interactive bg-theme-interactive rounded-md hover:bg-theme-interactive-hover disabled:bg-theme-disabled">
                            <DownloadIcon className="w-4 h-4" /> {t.exportToJson}
                        </button>
                    </div>
                     <div className="pt-3 border-t border-theme-subtle">
                        <p className="font-medium text-theme-primary">{t.exportAsExcelTemplate}</p>
                        <p className="text-sm text-theme-secondary mb-2">{t.exportAsExcelTemplateDescription}</p>
                        <button onClick={onExportExcelTemplate} disabled={isExportDisabled} className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-theme-on-interactive bg-theme-interactive rounded-md hover:bg-theme-interactive-hover disabled:bg-theme-disabled">
                             <DownloadIcon className="w-4 h-4" /> {t.exportAsExcelTemplate}
                        </button>
                    </div>
                </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-theme-strong">
                <h4 className="font-semibold text-theme-primary">{t.importFromExcel}</h4>
                <div className="prose prose-sm text-theme-secondary max-w-none">
                    <p>{t.importDescription}</p>
                    <h5 className="font-semibold text-theme-primary">{t.importInstructionsTitle}</h5>
                    <ul>
                        <li>{t.importSheetTransactions}</li>
                        <li>{t.importSheetStakeholders}</li>
                        <li>{t.importSheetShareClasses}</li>
                        <li>{t.importSheetShareholdings}</li>
                    </ul>
                </div>

                {!parsedImportData && !importError && (
                    <div 
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={triggerFileInput}
                        className="border-2 border-dashed border-theme-strong rounded-lg p-10 text-center cursor-pointer hover:bg-theme-subtle"
                    >
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
                        <UploadIcon className="w-12 h-12 mx-auto text-theme-secondary" />
                        <p className="mt-2 text-sm text-theme-secondary">{t.dropFileHere}</p>
                    </div>
                )}
                
                {importError && (
                     <div className="p-4 bg-theme-danger-subtle-bg text-theme-danger-subtle-text rounded-md">
                        <p className="font-bold">{t.importError}</p>
                        <p className="text-sm">{t.importSpecificError.replace('{error}', importError)}</p>
                        <button onClick={onClearImportPreview} className="mt-2 px-3 py-1 text-sm bg-theme-danger text-theme-on-interactive rounded-md">{t.tryAgain}</button>
                    </div>
                )}

                {parsedImportData && (
                    <div className="p-4 bg-theme-success-subtle-bg text-theme-success-subtle-text rounded-md">
                        <p className="font-bold">{t.importPreviewTitle}</p>
                        <p className="mt-2">{t.importDataFound
                            .replace('{projectName}', parsedImportData.projectName)
                            .replace('{countTransactions}', String(parsedImportData.transactions.length))
                            .replace('{countStakeholders}', String(parsedImportData.stakeholders.length))
                        }</p>
                        <p className="mt-1 text-xs">{t.importPreviewWarning}</p>
                        <div className="flex gap-4 mt-4">
                            <button onClick={onConfirmImport} className="px-3 py-1 text-sm bg-theme-success text-theme-on-interactive rounded-md">{t.confirmImport}</button>
                            <button onClick={onClearImportPreview} className="px-3 py-1 text-sm bg-theme-subtle text-theme-primary rounded-md">{t.cancel}</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}

export default ImportExportModal;