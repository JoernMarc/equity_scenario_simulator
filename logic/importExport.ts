/**
 * Copyright (c) 2025 Jörn Densing, Wachtberg (Deutschland)
 * All Rights Reserved.
 *
 * Permission to use, copy, modify, and distribute this software and its
 * documentation for any purpose and without fee is hereby prohibited,
 * without a written agreement with Jörn Densing, Wachtberg (Deutschland).
 */
import type { Transaction, Stakeholder, ShareClass, BaseTransaction, FinancingRoundTransaction, Shareholding, ConvertibleLoanTransaction, FoundingTransaction } from '../types';
import { TransactionType, TransactionStatus, ConversionMechanism } from '../types';

// Make XLSX library available from the global scope (loaded via script tag)
declare const XLSX: any;

export interface ParsedImportData {
    projectName: string;
    stakeholders: Stakeholder[];
    transactions: Transaction[];
}

// Helper to add comments to an XLSX worksheet
const addCommentsToSheet = (worksheet: any, comments: { cell: string, text: string }[]) => {
    if (!worksheet['!comments']) {
        worksheet['!comments'] = [];
    }
    comments.forEach(comment => {
        worksheet['!comments'].push({
            ref: comment.cell,
            t: comment.text,
            a: 'SheetJS'
        });
    });
};

export const exportToExcel = (project: { name: string, stakeholders: Stakeholder[], transactions: Transaction[] }) => {
    const { stakeholders, transactions } = project;
    const stakeholderIdMap = new Map<string, string>();
    const stakeholderNameMap = new Map<string, string>();

    stakeholders.forEach((sh) => {
        const baseName = sh.name.replace(/[^a-zA-Z0-9]/g, '-');
        let userDefinedId = baseName;
        let count = 1;
        while (Array.from(stakeholderIdMap.values()).includes(userDefinedId)) userDefinedId = `${baseName}-${count++}`;
        stakeholderIdMap.set(sh.id, userDefinedId);
        stakeholderNameMap.set(sh.id, sh.name);
    });

    const stakeholderSheet: any[] = [];
    stakeholders.forEach(sh => {
        stakeholderSheet.push({
            stakeholderId: stakeholderIdMap.get(sh.id),
            name: sh.name
        });
    });

    const transactionSheet: any[] = [];
    const shareClassSheet: any[] = [];
    const shareholdingSheet: any[] = [];

    transactions.forEach((tx, index) => {
        const transactionName = `${tx.type.replace(/_/g, '-')}-${tx.date}-${index}`;
        const { id, shareClasses, shareholdings, newShareClass, newShareholdings, convertsLoanIds, stakeholderId, ...baseTxData } = tx as any;
        if ('convertsLoanIds' in tx && tx.convertsLoanIds) baseTxData.convertsLoanTransactionNames = tx.convertsLoanIds.map(loanId => { const loan = transactions.find(t => t.id === loanId); if (!loan) return undefined; const loanIndex = transactions.findIndex(t => t.id === loanId); return `${loan.type.replace(/_/g, '-')}-${loan.date}-${loanIndex}`; }).filter(Boolean).join(', ');
        transactionSheet.push({ transactionName, ...baseTxData });
        if (tx.type === TransactionType.FOUNDING) {
            tx.shareClasses.forEach(sc => { const { id, ...classData } = sc; shareClassSheet.push({ transactionName, ...classData }); });
            tx.shareholdings.forEach(sh => { const shareClassName = tx.shareClasses.find(sc => sc.id === sh.shareClassId)?.name || ''; shareholdingSheet.push({ transactionName, stakeholderId: stakeholderIdMap.get(sh.stakeholderId), shareClassName, shares: sh.shares, investment: sh.investment }); });
        } else if (tx.type === TransactionType.FINANCING_ROUND) {
            const { id, ...classData } = tx.newShareClass;
            shareClassSheet.push({ transactionName, ...classData });
            tx.newShareholdings.forEach(sh => { shareholdingSheet.push({ transactionName, stakeholderId: stakeholderIdMap.get(sh.stakeholderId), shareClassName: tx.newShareClass.name, shares: sh.shares, investment: sh.investment }); });
        }
    });
    
    const stakeholdersWs = XLSX.utils.json_to_sheet(stakeholderSheet);
    const transactionsWs = XLSX.utils.json_to_sheet(transactionSheet);
    const shareClassesWs = XLSX.utils.json_to_sheet(shareClassSheet);
    const shareholdingsWs = XLSX.utils.json_to_sheet(shareholdingSheet);
    
    addCommentsToSheet(stakeholdersWs, [ { cell: 'A1', text: 'A unique ID for each stakeholder. Can be edited, but must remain unique. E.g., "Max-Mustermann-1"' }, { cell: 'B1', text: 'The full name of the person or entity.' } ]);
    addCommentsToSheet(transactionsWs, [ { cell: 'A1', text: 'A unique name for this transaction, used to link other sheets. E.g., "Seed-Round-2024-05-10"' }, { cell: 'I1', text: '(For Financing Rounds) A comma-separated list of "transactionName"s of the convertible loans being converted.' }, ]);
    addCommentsToSheet(shareClassesWs, [ { cell: 'A1', text: 'The "transactionName" from the Transactions sheet this class belongs to.'}, { cell: 'B1', text: 'The name of this share class, e.g., "Series A Preferred". Must be unique within its transaction.'}, { cell: 'D1', text: 'The multiplier for the preference, e.g. 1.5 for 1.5x.' }, { cell: 'E1', text: 'Must be one of: NON_PARTICIPATING, FULL_PARTICIPATING, CAPPED_PARTICIPATING' }, ]);
    addCommentsToSheet(shareholdingsWs, [ { cell: 'A1', text: 'The "transactionName" from the Transactions sheet.'}, { cell: 'B1', text: 'The "stakeholderId" from the Stakeholders sheet.'}, { cell: 'C1', text: 'The "name" of the share class from the ShareClasses sheet.'}, ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, stakeholdersWs, "Stakeholders");
    XLSX.utils.book_append_sheet(wb, transactionsWs, "Transactions");
    XLSX.utils.book_append_sheet(wb, shareClassesWs, "ShareClasses");
    XLSX.utils.book_append_sheet(wb, shareholdingsWs, "Shareholdings");
    
    XLSX.writeFile(wb, `captable-template-${project.name.replace(/\s/g, '_')}.xlsx`);
};


export const parseExcelImport = (file: File): Promise<ParsedImportData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetNames = ["Stakeholders", "Transactions", "ShareClasses", "Shareholdings"];
            const [stakeholdersSheet, transactionsSheet, shareClassesSheet, shareholdingsSheet] = sheetNames.map(name => { if (!workbook.Sheets[name]) throw new Error(`Missing required sheet: ${name}`); return XLSX.utils.sheet_to_json(workbook.Sheets[name]); });
            const importedStakeholdersRaw = stakeholdersSheet as { stakeholderId?: string; name?: string }[];
            const importedTransactionsRaw = transactionsSheet as any[];
            const importedShareClassesRaw = shareClassesSheet as any[];
            const importedShareholdingsRaw = shareholdingsSheet as any[];
            const stakeholderIds = new Set<string>();
            for(const sh of importedStakeholdersRaw) { if (!sh.stakeholderId || !sh.name) throw new Error("In 'Stakeholders' sheet: Each row must have a stakeholderId and a name."); if (stakeholderIds.has(sh.stakeholderId)) throw new Error(`In 'Stakeholders' sheet: Duplicate stakeholderId found: ${sh.stakeholderId}.`); stakeholderIds.add(sh.stakeholderId); }
            const transactionNames = new Set<string>();
            for(const tx of importedTransactionsRaw) { if (!tx.transactionName) throw new Error("In 'Transactions' sheet: Each row must have a transactionName."); if(transactionNames.has(tx.transactionName)) throw new Error(`In 'Transactions' sheet: Duplicate transactionName found: ${tx.transactionName}.`); transactionNames.add(tx.transactionName); }
            const newStakeholders: Stakeholder[] = importedStakeholdersRaw.map(s => ({ id: crypto.randomUUID(), name: s.name! }));
            const userToInternalIdMap = new Map(importedStakeholdersRaw.map((s, i) => [s.stakeholderId!, newStakeholders[i].id]));
            const userToNameMap = new Map(importedStakeholdersRaw.map((s) => [s.stakeholderId, s.name]));
            const txMapByName = new Map<string, Transaction>();
            importedTransactionsRaw.forEach((rawTx: any) => {
                const { transactionName, ...txData } = rawTx;
                const classesByTxName = importedShareClassesRaw.reduce((acc, sc) => { (acc[sc.transactionName] = acc[sc.transactionName] || []).push(sc); return acc; }, {} as Record<string, any[]>);
                const holdingsByTxName = importedShareholdingsRaw.reduce((acc, sh) => { (acc[sh.transactionName] = acc[sh.transactionName] || []).push(sh); return acc; }, {} as Record<string, any[]>);
                const txId = crypto.randomUUID();
                const parseNum = (val: any) => (val === undefined || val === null || val === '') ? undefined : Number(val);
                const parseDate = (val:any) => val instanceof Date ? val.toISOString().split('T')[0] : typeof val === 'number' ? new Date(Math.round((val - 25569)*86400*1000)).toISOString().split('T')[0] : val;
                const baseTx: BaseTransaction = { id: txId, type: txData.type, status: txData.status || 'ACTIVE', date: parseDate(txData.date), validFrom: parseDate(txData.validFrom) || parseDate(txData.date), validTo: parseDate(txData.validTo) };
                let transaction: Transaction;
                if (baseTx.type === TransactionType.CONVERTIBLE_LOAN) {
                    const stakeholderIdForLoan = importedShareholdingsRaw.find(sh => sh.transactionName === transactionName)?.stakeholderId;
                    transaction = {
                        ...baseTx,
                        type: TransactionType.CONVERTIBLE_LOAN,
                        investorName: userToNameMap.get(stakeholderIdForLoan) || txData.investorName,
                        stakeholderId: userToInternalIdMap.get(stakeholderIdForLoan) || '',
                        amount: parseNum(txData.amount) ?? 0,
                        interestRate: parseNum(txData.interestRate),
                        conversionMechanism: txData.conversionMechanism || ConversionMechanism.CAP_AND_DISCOUNT,
                        valuationCap: parseNum(txData.valuationCap),
                        discount: parseNum(txData.discount),
                        fixedConversionPrice: parseNum(txData.fixedConversionPrice),
                        ratioShares: parseNum(txData.ratioShares),
                        ratioAmount: parseNum(txData.ratioAmount),
                        seniority: txData.seniority || 'SUBORDINATED',
                    };
                } else if (baseTx.type === TransactionType.FOUNDING) {
                    const classesForTx = classesByTxName[transactionName] || [];
                    const holdingsForTx = holdingsByTxName[transactionName] || [];
                    const shareClassMap = new Map<string, string>();
                    const shareClasses: ShareClass[] = classesForTx.map((sc:any) => { const classId = crypto.randomUUID(); shareClassMap.set(sc.name, classId); return { id: classId, name: sc.name, liquidationPreferenceRank: parseNum(sc.liquidationPreferenceRank) ?? 0, liquidationPreferenceFactor: parseNum(sc.liquidationPreferenceFactor) ?? 1, participationCapFactor: parseNum(sc.participationCapFactor), liquidationPreferenceType: sc.liquidationPreferenceType || 'NON_PARTICIPATING', antiDilutionProtection: sc.antiDilutionProtection || 'NONE', votesPerShare: 1, protectiveProvisions: [] }; });
                    const shareholdings: Shareholding[] = holdingsForTx.map((sh: any) => ({ id: crypto.randomUUID(), stakeholderId: userToInternalIdMap.get(sh.stakeholderId) || '', stakeholderName: userToNameMap.get(sh.stakeholderId) || '', shareClassId: shareClassMap.get(sh.shareClassName) || '', shares: parseNum(sh.shares) ?? 0, investment: parseNum(sh.investment), }));
                    transaction = { ...baseTx, type: TransactionType.FOUNDING, companyName: txData.companyName, legalForm: txData.legalForm, currency: txData.currency || 'EUR', shareClasses, shareholdings };
                } else if (baseTx.type === TransactionType.FINANCING_ROUND) {
                    const classData = (classesByTxName[transactionName] || [])[0];
                    const holdingsForTx = holdingsByTxName[transactionName] || [];
                    const newShareClass: ShareClass = { id: crypto.randomUUID(), name: classData.name, liquidationPreferenceRank: parseNum(classData.liquidationPreferenceRank) ?? 1, liquidationPreferenceFactor: parseNum(classData.liquidationPreferenceFactor) ?? 1, participationCapFactor: parseNum(classData.participationCapFactor), liquidationPreferenceType: classData.liquidationPreferenceType || 'NON_PARTICIPATING', antiDilutionProtection: classData.antiDilutionProtection || 'BROAD_BASED', votesPerShare: 1, protectiveProvisions: [] };
                    const newShareholdings: Shareholding[] = holdingsForTx.map((sh: any) => ({ id: crypto.randomUUID(), stakeholderId: userToInternalIdMap.get(sh.stakeholderId) || '', stakeholderName: userToNameMap.get(sh.stakeholderId) || '', shareClassId: newShareClass.id, shares: parseNum(sh.shares) ?? 0, investment: parseNum(sh.investment), }));
                    transaction = { ...baseTx, type: TransactionType.FINANCING_ROUND, roundName: txData.roundName, preMoneyValuation: parseNum(txData.preMoneyValuation) ?? 0, newShareClass, newShareholdings, convertsLoanIds: [] };
                } else { throw new Error(`Unknown transaction type: ${baseTx.type}`); }
                txMapByName.set(transactionName, transaction);
            });
            importedTransactionsRaw.forEach(rawTx => { if (rawTx.type === 'FINANCING_ROUND' && rawTx.convertsLoanTransactionNames) { const financingRoundTx = txMapByName.get(rawTx.transactionName) as FinancingRoundTransaction; const loanNamesToConvert = (rawTx.convertsLoanTransactionNames || '').split(',').map((s:string) => s.trim()).filter(Boolean); financingRoundTx.convertsLoanIds = loanNamesToConvert.map((loanName: string) => txMapByName.get(loanName)?.id).filter((id: string | undefined): id is string => !!id); } });
            const projectName = file.name.replace(/\.(xlsx|xls)$/i, '');
            resolve({ projectName, stakeholders: newStakeholders, transactions: Array.from(txMapByName.values()) });
        } catch (error: any) {
            console.error("Error parsing Excel file:", error);
            reject(new Error(error.message || 'An unknown error occurred.'));
        }
    };
    reader.onerror = (error) => {
        console.error("Error reading file:", error);
        reject(new Error('Error reading the file.'));
    };
    reader.readAsBinaryString(file);
  });
};