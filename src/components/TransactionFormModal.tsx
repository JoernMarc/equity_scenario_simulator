
import React, { useMemo } from 'react';
import { TransactionType, Transaction, FoundingTransaction, ConvertibleLoanTransaction, FinancingRoundTransaction, ShareTransferTransaction, Stakeholder, Language, ShareClass, DebtInstrumentTransaction, UpdateShareClassTransaction, CapTable } from '../types';
import CompanyForm from './forms/CompanyForm';
import ConvertibleLoanForm from './forms/ConvertibleLoanForm';
import FinancingRoundForm from './forms/FinancingRoundForm';
import ShareTransferForm from './forms/ShareTransferForm';
import DebtForm from './forms/DebtForm';
import UpdateShareClassForm from './forms/UpdateShareClassForm';
import CloseIcon from './icons/CloseIcon';
import { Translations } from '../i18n';
import { calculateCapTable, getShareClassesAsOf } from '../logic/calculations';

interface TransactionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  formType: TransactionType | null;
  onSubmit: (transaction: Transaction) => void;
  translations: Translations;
  transactionToEdit?: Transaction | null;
  language: Language;
  transactions: Transaction[];
  stakeholders: Stakeholder[];
  capTable: CapTable | null;
}

function TransactionFormModal({ 
    isOpen, 
    onClose, 
    formType, 
    onSubmit, 
    translations, 
    transactionToEdit,
    language,
    transactions,
    stakeholders,
    capTable
}: TransactionFormModalProps) {
  if (!isOpen || !formType) return null;

  const allShareClasses = useMemo(() => {
    if (formType === TransactionType.UPDATE_SHARE_CLASS) {
        const asOfDate = new Date().toISOString().split('T')[0];
        return Array.from(getShareClassesAsOf(transactions, asOfDate).values());
    }
    return [];
  }, [formType, transactions]);


  const renderForm = () => {
    switch (formType) {
      case TransactionType.FOUNDING:
        return <CompanyForm 
                  onSubmit={onSubmit} 
                  onCancel={onClose} 
                  translations={translations} 
                  transactionToEdit={transactionToEdit as FoundingTransaction} 
                  stakeholders={stakeholders}
                  language={language}
                />;
      case TransactionType.CONVERTIBLE_LOAN:
        return <ConvertibleLoanForm 
                  onSubmit={onSubmit} 
                  onCancel={onClose} 
                  translations={translations} 
                  transactionToEdit={transactionToEdit as ConvertibleLoanTransaction} 
                  stakeholders={stakeholders} 
                />;
      case TransactionType.FINANCING_ROUND: {
        const activeTxs = transactions.filter(tx => tx.status === 'ACTIVE');
        const capTableDate = (transactionToEdit as FinancingRoundTransaction)?.date || new Date().toISOString().split('T')[0];
        const excludeId = transactionToEdit?.id;

        const capTableBefore = calculateCapTable(activeTxs, capTableDate, excludeId);
        const preRoundTotalShares = capTableBefore.totalShares;
        
        const convertedInOtherRounds = new Set<string>();
        activeTxs.forEach(tx => {
            if (tx.type === TransactionType.FINANCING_ROUND && tx.id !== excludeId && tx.convertsLoanIds) {
                tx.convertsLoanIds.forEach(id => convertedInOtherRounds.add(id));
            }
        });

        const convertibleLoans = activeTxs.filter(tx =>
            tx.type === TransactionType.CONVERTIBLE_LOAN && !convertedInOtherRounds.has(tx.id)
        ) as ConvertibleLoanTransaction[];

        return <FinancingRoundForm 
                    onSubmit={onSubmit} 
                    onCancel={onClose} 
                    translations={translations} 
                    transactionToEdit={transactionToEdit as FinancingRoundTransaction}
                    preRoundTotalShares={preRoundTotalShares}
                    convertibleLoans={convertibleLoans}
                    stakeholders={stakeholders}
                    language={language}
                />;
      }
      case TransactionType.SHARE_TRANSFER: {
        return <ShareTransferForm
                    onSubmit={onSubmit}
                    onCancel={onClose}
                    translations={translations}
                    transactionToEdit={transactionToEdit as ShareTransferTransaction}
                    stakeholders={stakeholders}
                    capTable={capTable}
                />
      }
      case TransactionType.DEBT_INSTRUMENT:
        return <DebtForm
                  onSubmit={onSubmit}
                  onCancel={onClose}
                  translations={translations}
                  transactionToEdit={transactionToEdit as DebtInstrumentTransaction}
               />;
      case TransactionType.UPDATE_SHARE_CLASS: {
        return <UpdateShareClassForm
                    onSubmit={onSubmit}
                    onCancel={onClose}
                    translations={translations}
                    transactionToEdit={transactionToEdit as UpdateShareClassTransaction}
                    allShareClasses={allShareClasses}
                    allTransactions={transactions}
                />
      }
      default:
        return null;
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div 
        className="relative bg-theme-surface rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-theme-secondary hover:text-theme-primary"
          aria-label="Close"
        >
          <CloseIcon />
        </button>
        {renderForm()}
      </div>
    </div>
  );
};

export default TransactionFormModal;