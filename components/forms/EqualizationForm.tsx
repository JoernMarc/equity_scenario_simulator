
import React, { useState, useMemo } from 'react';
import type { EqualizationPurchaseTransaction, Stakeholder, Language, Transaction, ShareClass } from '../../types';
import { TransactionType, TransactionStatus } from '../../types';
import type { Translations } from '../../i18n';
import HelpTooltip from '../HelpTooltip';

interface EqualizationFormProps {
  onSubmit: (transaction: EqualizationPurchaseTransaction) => void;
  onCancel: () => void;
  translations: Translations;
  transactionToEdit?: EqualizationPurchaseTransaction;
  stakeholders: Stakeholder[];
  language: Language;
  allTransactions: Transaction[];
  allShareClasses: ShareClass[];
  projectCurrency: string;
}

const baseInputClasses = "mt-1 block w-full px-3 py-2 bg-theme-surface border border-theme-strong rounded-md shadow-sm focus:outline-none focus:ring-theme-interactive focus:border-theme-interactive";

const CurrencyInput = ({ value, onChange, currency, locale, required = false, id }: { value: number | '', onChange: (value: number | '') => void, currency: string, locale: string, required?: boolean, id: string }) => (
    <div className="relative mt-1">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <span className="text-theme-secondary sm:text-sm">{new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(0).replace(/[0-9.,]/g, '').trim()}</span>
        </div>
        <input 
            type="number"
            id={id} 
            value={value} 
            onChange={e => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))} 
            required={required}
            className="block w-full rounded-md border-theme-strong bg-theme-surface pl-7 pr-3 py-2 shadow-sm focus:border-theme-interactive focus:ring-theme-interactive sm:text-sm text-right"
        />
    </div>
);


function EqualizationForm({ onSubmit, onCancel, translations, transactionToEdit, stakeholders, language, allTransactions, allShareClasses, projectCurrency }: EqualizationFormProps) {
  const isEditing = !!transactionToEdit;
  const t = translations;
  const locale = language === 'de' ? 'de-DE' : 'en-US';

  // Basic Info
  const [date, setDate] = useState(transactionToEdit?.date || new Date().toISOString().split('T')[0]);
  const [newStakeholderName, setNewStakeholderName] = useState(transactionToEdit?.newStakeholderName || '');
  
  // Purchase Details
  const [purchasedShares, setPurchasedShares] = useState<number|''>(transactionToEdit?.purchasedShares || '');
  const [shareClassId, setShareClassId] = useState(transactionToEdit?.shareClassId || '');
  const [pricePerShare, setPricePerShare] = useState<number|''>(transactionToEdit?.pricePerShare || '');

  // Equalization Details
  const [equalizationInterestRate, setEqualizationInterestRate] = useState<number|''>(transactionToEdit ? transactionToEdit.equalizationInterestRate * 100 : '');
  const [referenceTransactionId, setReferenceTransactionId] = useState(transactionToEdit?.referenceTransactionId || '');

  // Status
  const [status, setStatus] = useState<TransactionStatus>(transactionToEdit?.status || TransactionStatus.DRAFT);
  const [validFrom, setValidFrom] = useState(transactionToEdit?.validFrom || new Date().toISOString().split('T')[0]);
  const [validTo, setValidTo] = useState(transactionToEdit?.validTo || '');
  
  const referenceTransactions = useMemo(() => {
    return allTransactions.filter(tx => tx.type === TransactionType.FOUNDING || tx.type === TransactionType.FINANCING_ROUND);
  }, [allTransactions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStakeholderName || purchasedShares === '' || !shareClassId || pricePerShare === '' || equalizationInterestRate === '' || !referenceTransactionId) {
        return;
    }

    const transaction: EqualizationPurchaseTransaction = {
      id: transactionToEdit?.id || crypto.randomUUID(),
      type: TransactionType.EQUALIZATION_PURCHASE,
      date,
      status,
      validFrom,
      validTo: validTo || undefined,
      newStakeholderId: '', // Will be set in App.tsx
      newStakeholderName,
      purchasedShares,
      shareClassId,
      pricePerShare,
      equalizationInterestRate: equalizationInterestRate / 100,
      referenceTransactionId,
    };
    onSubmit(transaction);
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <datalist id="stakeholders-list">
        {stakeholders.map(s => <option key={s.id} value={s.name} />)}
      </datalist>

      <h3 className="text-xl font-semibold text-theme-primary">{isEditing ? t.editEqualizationPurchase : t.addEqualizationPurchase}</h3>
      
      <fieldset>
        <legend className="text-lg font-medium text-theme-primary mb-2 flex items-center gap-2">{t.purchaseDetails} <HelpTooltip text={t.help.purchaseDetails} /></legend>
        <div className="space-y-4 p-4 bg-theme-subtle rounded-lg border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="date" className="block text-sm font-medium text-theme-secondary">{t.date}</label>
                    <input type="date" id="date" value={date} onChange={e => setDate(e.target.value)} required className={baseInputClasses}/>
                </div>
                 <div>
                    <label htmlFor="newStakeholderName" className="block text-sm font-medium text-theme-secondary">{t.newStakeholderName}</label>
                    <input type="text" id="newStakeholderName" value={newStakeholderName} onChange={e => setNewStakeholderName(e.target.value)} required className={baseInputClasses} list="stakeholders-list"/>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label htmlFor="purchasedShares" className="block text-sm font-medium text-theme-secondary">{t.purchasedShares}</label>
                    <input type="number" min="1" id="purchasedShares" value={purchasedShares} onChange={e => setPurchasedShares(e.target.value === '' ? '' : parseInt(e.target.value, 10))} required className={`${baseInputClasses} text-right`} />
                </div>
                <div>
                    <label htmlFor="shareClassId" className="block text-sm font-medium text-theme-secondary">{t.shareClass}</label>
                    <select id="shareClassId" value={shareClassId} onChange={e => setShareClassId(e.target.value)} required className={baseInputClasses}>
                        <option value="" disabled>{t.selectShareClassToPurchase}</option>
                        {allShareClasses.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                    </select>
                </div>
                 <div>
                    <label htmlFor="pricePerShare" className="block text-sm font-medium text-theme-secondary">{t.pricePerShare}</label>
                    <CurrencyInput id="pricePerShare" value={pricePerShare} onChange={setPricePerShare} required currency={projectCurrency} locale={locale} />
                </div>
            </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-lg font-medium text-theme-primary mb-2 flex items-center gap-2">{t.equalizationDetails} <HelpTooltip text={t.help.equalizationDetails} /></legend>
        <div className="space-y-4 p-4 bg-theme-subtle rounded-lg border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="equalizationInterestRate" className="flex items-center text-sm font-medium text-theme-secondary">{t.equalizationInterestRate} <HelpTooltip text={t.help.equalizationInterestRate} /></label>
                     <div className="relative mt-1">
                        <input type="number" id="equalizationInterestRate" min="0" step="any" value={equalizationInterestRate} onChange={e => setEqualizationInterestRate(e.target.value === '' ? '' : parseFloat(e.target.value))} required className={`${baseInputClasses} text-right pr-6`} />
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                            <span className="text-theme-secondary sm:text-sm">%</span>
                        </div>
                    </div>
                </div>
                 <div>
                    <label htmlFor="referenceTransactionId" className="block text-sm font-medium text-theme-secondary">{t.referenceTransaction}</label>
                    <select id="referenceTransactionId" value={referenceTransactionId} onChange={e => setReferenceTransactionId(e.target.value)} required className={baseInputClasses}>
                        <option value="" disabled>{t.selectReferenceTransaction}</option>
                        {referenceTransactions.map(tx => {
                            const name = tx.type === TransactionType.FOUNDING ? `${t.founding}: ${tx.companyName}` : `${t.financingRound}: ${(tx as any).roundName}`;
                            return <option key={tx.id} value={tx.id}>{name} ({tx.date})</option>
                        })}
                    </select>
                </div>
            </div>
        </div>
      </fieldset>
      
       <fieldset className="pt-4 mt-4 border-t border-theme-subtle">
        <legend className="text-lg font-medium text-theme-primary mb-2">{t.statusAndValidity}</legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-theme-secondary">{t.status}</label>
              <select id="status" value={status} onChange={e => setStatus(e.target.value as TransactionStatus)} required className={baseInputClasses}>
                <option value={TransactionStatus.DRAFT}>{t.draft}</option>
                <option value={TransactionStatus.ACTIVE}>{t.active}</option>
                <option value={TransactionStatus.ARCHIVED}>{t.archived}</option>
              </select>
            </div>
            <div>
              <label htmlFor="validFrom" className="block text-sm font-medium text-theme-secondary">{t.validFrom}</label>
              <input type="date" id="validFrom" value={validFrom} onChange={e => setValidFrom(e.target.value)} required className={baseInputClasses}/>
            </div>
            <div>
              <label htmlFor="validTo" className="block text-sm font-medium text-theme-secondary">{t.validTo} <span className="text-theme-subtle">({t.optional})</span></label>
              <input type="date" id="validTo" value={validTo} onChange={e => setValidTo(e.target.value)} className={baseInputClasses}/>
            </div>
        </div>
      </fieldset>

      <div className="flex justify-end gap-4 pt-4 border-t border-theme-subtle">
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-theme-subtle text-theme-primary rounded-md hover:bg-theme-background">{t.cancel}</button>
        <button type="submit" className="px-4 py-2 bg-theme-interactive text-theme-on-interactive rounded-md hover:bg-theme-interactive-hover">{isEditing ? t.update : t.save}</button>
      </div>
    </form>
  );
};

export default EqualizationForm;
