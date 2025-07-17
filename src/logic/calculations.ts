
import type { Transaction, CapTable, CapTableEntry, Shareholding, ConvertibleLoanTransaction, FinancingRoundTransaction, ShareClass, WaterfallResult, WaterfallDistribution, VestingSchedule, VotingResult, VoteDistributionEntry, Language, DebtInstrumentTransaction, UpdateShareClassTransaction, ShareTransferTransaction } from '../types';
import { TransactionType, ConversionMechanism } from '../types';
import { Translations } from '../i18n';
import { snakeToCamel } from './utils';

/**
 * Calculates the number of days between two date strings (YYYY-MM-DD).
 * @param date1Str Start date
 * @param date2Str End date
 * @returns The number of days between the two dates.
 */
function daysBetween(date1Str: string, date2Str: string): number {
    const d1 = new Date(date1Str);
    const d2 = new Date(date2Str);
    // Disregard time and timezone by using UTC
    const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
    return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

/**
 * Calculates the accrued interest for a loan up to a certain date.
 * @param loan The convertible loan or debt instrument.
 * @param asOfDate The date to calculate interest up to.
 * @returns The total accrued interest.
 */
export function calculateAccruedInterest(loan: { date: string, amount: number, interestRate?: number }, asOfDate: string): number {
    const days = daysBetween(loan.date, asOfDate);
    if (days < 0) return 0;
    // Using 365.25 to average for leap years
    return loan.amount * (loan.interestRate || 0) * (days / 365.25);
}


/**
 * Converts a single convertible loan into a shareholding based on the terms of a financing round.
 * @param loan The convertible loan to convert.
 * @param round The financing round that triggers the conversion.
 * @param preMoneyShares The total number of shares before the round and conversions.
 * @param pricePerShareInRound The price per share for new investors in the round.
 * @returns A new Shareholding object representing the converted loan.
 */
function convertLoanToShares(loan: ConvertibleLoanTransaction, round: FinancingRoundTransaction, preMoneyShares: number, pricePerShareInRound: number): Shareholding {
  // 1. Calculate accrued interest
  const interest = calculateAccruedInterest(loan, round.date);
  const totalOwed = loan.amount + interest;

  // 2. Determine the conversion price
  let conversionPrice = Infinity;

  switch (loan.conversionMechanism) {
    case ConversionMechanism.CAP_AND_DISCOUNT:
      const capPrice = loan.valuationCap && preMoneyShares > 0 ? loan.valuationCap / preMoneyShares : Infinity;
      const discountPrice = pricePerShareInRound * (1 - (loan.discount || 0));
      conversionPrice = Math.min(capPrice, discountPrice);
      break;
      
    case ConversionMechanism.FIXED_PRICE:
      if (loan.fixedConversionPrice && loan.fixedConversionPrice > 0) {
        conversionPrice = loan.fixedConversionPrice;
      }
      break;
      
    case ConversionMechanism.FIXED_RATIO:
      if (loan.ratioAmount && loan.ratioAmount > 0 && loan.ratioShares && loan.ratioShares > 0) {
        // Calculate the implicit price from the ratio
        conversionPrice = loan.ratioAmount / loan.ratioShares;
      }
      break;
      
    default:
      // Fallback for older data that might not have the mechanism field, or if it's unknown
      console.warn(`Unknown or missing conversion mechanism for loan: ${loan.id}. Falling back to Cap & Discount.`);
      const fallbackCapPrice = loan.valuationCap && preMoneyShares > 0 ? loan.valuationCap / preMoneyShares : Infinity;
      const fallbackDiscountPrice = pricePerShareInRound * (1 - (loan.discount || 0));
      conversionPrice = Math.min(fallbackCapPrice, fallbackDiscountPrice);
      break;
  }

  if (conversionPrice === Infinity || conversionPrice <= 0) {
    console.error(`Could not determine a valid conversion price for loan: ${loan.id}. Conversion failed.`);
    // Return a shareholding with 0 shares to indicate failure without crashing.
    return {
      id: crypto.randomUUID(),
      stakeholderId: loan.stakeholderId,
      stakeholderName: loan.investorName,
      shareClassId: round.newShareClass.id,
      shares: 0,
      investment: loan.amount,
      originalPricePerShare: 0,
    };
  }
  
  // 3. Calculate the number of shares
  const convertedShares = Math.round(totalOwed / conversionPrice);

  return {
    id: crypto.randomUUID(),
    stakeholderId: loan.stakeholderId,
    stakeholderName: loan.investorName,
    shareClassId: round.newShareClass.id, // Converts into the new share class
    shares: convertedShares,
    investment: loan.amount, // Original investment amount
    originalPricePerShare: conversionPrice, // The effective price they paid
  };
}


/**
 * Calculates the total number of shares from a list of shareholdings.
 * @param shareholdings List of shareholdings.
 * @returns The sum of shares.
 */
function calculateTotalShares(shareholdings: Shareholding[]): number {
    return shareholdings.reduce((sum, sh) => sum + sh.shares, 0);
}

/**
 * Calculates vested shares based on a schedule.
 */
function calculateVestedShares(totalShares: number, schedule: VestingSchedule, asOfDate: string): number {
    const asOf = new Date(asOfDate);
    const grantDate = new Date(schedule.grantDate);

    if (asOf < grantDate) return 0;

    let monthsPassed = (asOf.getFullYear() - grantDate.getFullYear()) * 12;
    monthsPassed -= grantDate.getMonth();
    monthsPassed += asOf.getMonth();
    monthsPassed = monthsPassed <= 0 ? 0 : monthsPassed;
    
    if (monthsPassed < schedule.cliffMonths) {
        return 0;
    }

    if (monthsPassed >= schedule.vestingPeriodMonths) {
        return totalShares;
    }

    const vestedRatio = monthsPassed / schedule.vestingPeriodMonths;
    return Math.floor(totalShares * vestedRatio);
}

/**
 * Groups shareholdings by stakeholder and share class to create CapTableEntry items.
 */
function groupShareholdings(shareholdings: Shareholding[], totalShares: number, shareClassMap: Map<string, string>): CapTableEntry[] {
    const grouped: { [key: string]: CapTableEntry } = {};

    for (const sh of shareholdings) {
        const key = `${sh.stakeholderId}-${sh.shareClassId}`;
        
        if (!grouped[key]) {
            grouped[key] = {
                stakeholderId: sh.stakeholderId,
                stakeholderName: sh.stakeholderName,
                shareClassId: sh.shareClassId,
                shareClassName: shareClassMap.get(sh.shareClassId) || 'Unknown Class',
                shares: 0,
                vestedShares: 0, // Will be calculated later
                percentage: 0,
                initialInvestment: 0,
            };
        }
        grouped[key].shares += sh.shares;
        grouped[key].initialInvestment = (grouped[key].initialInvestment || 0) + (sh.investment || 0);
    }
    
    const entries = Object.values(grouped);
    if (totalShares > 0) {
        entries.forEach(entry => {
            entry.percentage = (entry.shares / totalShares) * 100;
        });
    }

    return entries.sort((a,b) => b.shares - a.shares);
}

/**
 * Reconstructs the state of all share classes at a specific point in time by applying all transactions chronologically.
 * @param transactions The full list of project transactions.
 * @param asOfDate The date for which to determine the state.
 * @returns A Map of ShareClass objects, keyed by their ID.
 */
export function getShareClassesAsOf(transactions: Transaction[], asOfDate: string): Map<string, ShareClass> {
  const shareClasses = new Map<string, ShareClass>();
  
  // Filter only relevant transactions up to the asOfDate and sort them to ensure chronological application
  const relevantTransactions = transactions
    .filter(tx => tx.date <= asOfDate)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (const tx of relevantTransactions) {
    if (tx.type === 'FOUNDING') {
      // Deep copy to avoid mutation of original transaction data
      tx.shareClasses.forEach(sc => shareClasses.set(sc.id, JSON.parse(JSON.stringify(sc))));
    } else if (tx.type === 'FINANCING_ROUND') {
      // Deep copy
      shareClasses.set(tx.newShareClass.id, JSON.parse(JSON.stringify(tx.newShareClass)));
    } else if (tx.type === 'UPDATE_SHARE_CLASS') {
      const classToUpdate = shareClasses.get(tx.shareClassIdToUpdate);
      if (classToUpdate) {
        // Apply the partial updates to the existing class state
        Object.assign(classToUpdate, tx.updatedProperties);
      }
    }
  }
  
  return shareClasses;
}


/**
 * Calculates the capitalization table at a specific point in time.
 */
export function calculateCapTable(transactions: Transaction[], asOfDate: string, excludeTransactionId?: string): CapTable {
  const allShareClasses = getShareClassesAsOf(transactions, asOfDate);
  const shareClassMap = new Map<string, string>();
  allShareClasses.forEach((sc, id) => shareClassMap.set(id, sc.name));
  
  let currentShareholdings: Shareholding[] = [];
  const vestingSchedulesMap = new Map<string, VestingSchedule>();
  
  const relevantTransactions = transactions.filter(tx => tx.date <= asOfDate && tx.id !== excludeTransactionId);

  // First pass to collect all vesting schedule definitions (they are not point-in-time dependent)
  transactions.forEach(tx => {
    if (tx.type === 'FOUNDING' && tx.vestingSchedules) {
      tx.vestingSchedules.forEach(vs => vestingSchedulesMap.set(vs.id, vs));
    }
  });


  for (const tx of relevantTransactions) {
    switch (tx.type) {
      case 'FOUNDING':
        currentShareholdings.push(...tx.shareholdings);
        break;
        
      case 'FINANCING_ROUND':
        const preRoundSharesForDilution = calculateTotalShares(currentShareholdings);
        if (preRoundSharesForDilution > 0) {
            const newPricePerShare = tx.preMoneyValuation / preRoundSharesForDilution;
            
            // ANTI-DILUTION ADJUSTMENT
            currentShareholdings.forEach(sh => {
                const shareClass = allShareClasses.get(sh.shareClassId);
                if (shareClass && sh.originalPricePerShare && newPricePerShare < sh.originalPricePerShare) {
                    if (shareClass.antiDilutionProtection === 'FULL_RATCHET') {
                        const originalInvestment = sh.shares * sh.originalPricePerShare;
                        const newShareCount = Math.round(originalInvestment / newPricePerShare);
                        sh.shares = newShareCount; // Adjust shares in place
                    }
                }
            });
        }
        
        // CONVERTIBLE LOAN CONVERSION
        if (tx.convertsLoanIds && tx.convertsLoanIds.length > 0) {
          const loansToConvert = transactions
            .filter(t => t.type === 'CONVERTIBLE_LOAN' && tx.convertsLoanIds!.includes(t.id)) as ConvertibleLoanTransaction[];
          
          const preMoneySharesAfterDilution = calculateTotalShares(currentShareholdings);
          const pricePerShareInRound = preMoneySharesAfterDilution > 0 ? tx.preMoneyValuation / preMoneySharesAfterDilution : 0;

          if (pricePerShareInRound > 0) {
            for (const loan of loansToConvert) {
              const convertedShareholding = convertLoanToShares(loan, tx, preMoneySharesAfterDilution, pricePerShareInRound);
              currentShareholdings.push(convertedShareholding);
            }
          }
        }

        currentShareholdings.push(...tx.newShareholdings);
        break;
        
      case 'CONVERTIBLE_LOAN':
      case 'DEBT_INSTRUMENT':
      case 'UPDATE_SHARE_CLASS':
        // These transactions don't directly create shareholdings,
        // they are handled during financing rounds, waterfalls, or share class state reconstruction.
        break;
      
      case 'SHARE_TRANSFER': {
        const transferTx = tx as ShareTransferTransaction;

        // Find the seller's holdings
        const sellerHoldings = currentShareholdings.filter(
            sh => sh.stakeholderId === transferTx.sellerStakeholderId && sh.shareClassId === transferTx.shareClassId
        );

        if (sellerHoldings.length > 0) {
            let sharesToTransfer = transferTx.numberOfShares;
            
            // Deduct shares from seller's holdings, proportionally if they have multiple tranches
            for (const holding of sellerHoldings) {
                if (sharesToTransfer <= 0) break;
                const deduction = Math.min(holding.shares, sharesToTransfer);
                holding.shares -= deduction;
                sharesToTransfer -= deduction;
            }

            // Add shares to buyer
            const buyerHoldingIndex = currentShareholdings.findIndex(
                sh => sh.stakeholderId === transferTx.buyerStakeholderId && sh.shareClassId === transferTx.shareClassId
            );
    
            if (buyerHoldingIndex > -1) {
                currentShareholdings[buyerHoldingIndex].shares += transferTx.numberOfShares;
            } else {
                currentShareholdings.push({
                    id: crypto.randomUUID(),
                    stakeholderId: transferTx.buyerStakeholderId,
                    stakeholderName: transferTx.buyerStakeholderName,
                    shareClassId: transferTx.shareClassId,
                    shares: transferTx.numberOfShares,
                    investment: transferTx.numberOfShares * transferTx.pricePerShare,
                    originalPricePerShare: transferTx.pricePerShare,
                });
            }
        } else {
            console.warn(`Seller for Share Transfer not found or has no shares of classId ${transferTx.shareClassId}. Tx ID: ${transferTx.id}`);
        }
        break;
      }
    }
  }

  const totalShares = calculateTotalShares(currentShareholdings);
  const entries = groupShareholdings(currentShareholdings, totalShares, shareClassMap);
  
  let totalVestedShares = 0;
  entries.forEach(entry => {
    const holdingsForEntry = currentShareholdings.filter(
      sh => sh.stakeholderId === entry.stakeholderId && sh.shareClassId === entry.shareClassId
    );
    
    let vestedForEntry = 0;
    holdingsForEntry.forEach(sh => {
      if (sh.vestingScheduleId) {
        const schedule = vestingSchedulesMap.get(sh.vestingScheduleId);
        vestedForEntry += schedule ? calculateVestedShares(sh.shares, schedule, asOfDate) : sh.shares;
      } else {
        vestedForEntry += sh.shares; // No vesting, fully vested
      }
    });
    entry.vestedShares = vestedForEntry;
    totalVestedShares += vestedForEntry;
  });

  return { asOfDate, totalShares, totalVestedShares, entries };
}

// Helper function to find the initial investment for a specific stakeholder and share class
function findInitialInvestment(capTableEntry: CapTableEntry): number {
    return capTableEntry.initialInvestment || 0;
}


/**
 * Simulates the distribution of liquidation proceeds (Waterfall Analysis).
 */
export function simulateWaterfall(
  capTable: CapTable,
  allTransactions: Transaction[],
  exitProceeds: number,
  transactionCosts: number,
  translations: Translations,
  language: Language
): WaterfallResult {
  
  const locale = language === 'de' ? 'de-DE' : 'en-US';
  const formatCurrency = (val: number) => val.toLocaleString(locale, { style: 'currency', currency: 'EUR' });
  const calculationLog: string[] = [];
  const distributions: WaterfallDistribution[] = [];
  
  calculationLog.push(`Simulation started with Exit Proceeds: ${formatCurrency(exitProceeds)} and Transaction Costs: ${formatCurrency(transactionCosts)}.`);
  let remainingProceeds = exitProceeds - transactionCosts;
  calculationLog.push(`-> Net Exit Proceeds available for distribution: ${formatCurrency(remainingProceeds)}.`);
  
  // --- UNIFIED DEBT WATERFALL ---
  calculationLog.push(`Step 1: Consolidating and sorting all debt claims.`);

  // Find IDs of convertible loans that have converted to equity and are no longer debt.
  const convertedLoanIds = new Set<string>();
  allTransactions.forEach(tx => {
      if (tx.type === 'FINANCING_ROUND' && tx.convertsLoanIds) {
          tx.convertsLoanIds.forEach(id => convertedLoanIds.add(id));
      }
  });

  // Create a unified list of all debt-like claims (pure debt and non-converted loans).
  const allDebtClaims = allTransactions
    .filter(tx => 
      (tx.type === 'DEBT_INSTRUMENT') || 
      (tx.type === 'CONVERTIBLE_LOAN' && !convertedLoanIds.has(tx.id))
    )
    .map(tx => {
      const loan = tx as DebtInstrumentTransaction | ConvertibleLoanTransaction;
      return {
        id: loan.id,
        date: loan.date,
        name: 'lenderName' in loan ? loan.lenderName : loan.investorName,
        amount: loan.amount,
        interestRate: loan.interestRate || 0,
        seniority: loan.seniority || 'SUBORDINATED', 
        typeLabelKey: tx.type === 'DEBT_INSTRUMENT' ? 'debtInstrument' : 'convertibleLoan',
      };
    });
    
  // Sort all claims by their seniority.
  const seniorityOrder: Record<DebtInstrumentTransaction['seniority'], number> = { 'SENIOR_SECURED': 1, 'SENIOR_UNSECURED': 2, 'SUBORDINATED': 3 };
  allDebtClaims.sort((a, b) => seniorityOrder[a.seniority] - seniorityOrder[b.seniority]);
  
  if (allDebtClaims.length > 0) {
      calculationLog.push(`Step 2: Paying off debt claims in order of seniority.`);
  }

  // Pay off the sorted claims one by one.
  for (const claim of allDebtClaims) {
    if (remainingProceeds <= 0) break;
    
    const interest = calculateAccruedInterest(claim, capTable.asOfDate);
    const totalOwed = claim.amount + interest;
    const payoutAmount = Math.min(totalOwed, remainingProceeds);

    const seniorityKey = snakeToCamel(claim.seniority) as keyof Translations;
    const typeLabel = translations[claim.typeLabelKey as keyof Translations] as string;
    const seniorityLabel = (translations[seniorityKey] as string) || claim.seniority;
    
    distributions.push({
      stakeholderId: `debt-${claim.id}`,
      stakeholderName: claim.name,
      shareClassId: 'debt',
      shareClassName: `${typeLabel} (${seniorityLabel})`,
      initialInvestment: claim.amount,
      fromDebtRepayment: payoutAmount,
      fromLiquidationPreference: 0,
      fromParticipation: 0,
      fromConvertedShares: 0,
      totalProceeds: payoutAmount,
      multiple: claim.amount > 0 ? payoutAmount / claim.amount : 0,
    });
    
    remainingProceeds -= payoutAmount;
    calculationLog.push(`   - Paying ${claim.name} (${typeLabel}, ${seniorityLabel}): Owed ${formatCurrency(totalOwed)}. Paid ${formatCurrency(payoutAmount)}. Remaining: ${formatCurrency(remainingProceeds)}.`);
  }

  // --- END OF DEBT WATERFALL ---
  
  if (remainingProceeds <= 0) {
      calculationLog.push(`Proceeds exhausted after debt repayment.`);
      distributions.sort((a,b) => b.totalProceeds - a.totalProceeds);
      return { netExitProceeds: exitProceeds - transactionCosts, distributions, remainingValue: remainingProceeds, calculationLog };
  }
  
  const shareClasses = getShareClassesAsOf(allTransactions, capTable.asOfDate);

  interface EnhancedEntry extends CapTableEntry {
    shareClass: ShareClass;
    payout: WaterfallDistribution;
    hasConverted: boolean;
  }

  const allEntries: EnhancedEntry[] = capTable.entries.map(entry => {
    const shareClass = shareClasses.get(entry.shareClassId)!;
    const investment = findInitialInvestment(entry);
    return {
      ...entry, shareClass, 
      payout: {
        stakeholderId: entry.stakeholderId, stakeholderName: entry.stakeholderName,
        shareClassId: entry.shareClassId, shareClassName: entry.shareClassName,
        initialInvestment: investment, 
        fromDebtRepayment: 0,
        fromLiquidationPreference: 0, 
        fromParticipation: 0,
        fromConvertedShares: 0, 
        totalProceeds: 0, 
        multiple: 0,
      },
      hasConverted: false
    };
  }).filter(e => e.vestedShares > 0);

  const preferredEntries = allEntries
    .filter(e => e.shareClass.liquidationPreferenceRank > 0)
    .sort((a, b) => a.shareClass.liquidationPreferenceRank - b.shareClass.liquidationPreferenceRank);

  calculationLog.push(`Step 3: Evaluating preferred shares conversion (Non-Participating).`);
  const valuePerCommonShareIfAllConverted = remainingProceeds / capTable.totalVestedShares;
  calculationLog.push(`   - As-converted value per share: ${formatCurrency(valuePerCommonShareIfAllConverted)}.`);
  
  for (const entry of preferredEntries) {
      if (entry.shareClass.liquidationPreferenceType === 'NON_PARTICIPATING') {
          const preferenceAmount = entry.initialInvestment * entry.shareClass.liquidationPreferenceFactor;
          const conversionValue = entry.vestedShares * valuePerCommonShareIfAllConverted;
          if (conversionValue > preferenceAmount) {
              entry.hasConverted = true;
              calculationLog.push(`   - ${entry.stakeholderName} (${entry.shareClassName}): Converts. As-converted value (${formatCurrency(conversionValue)}) > Preference (${formatCurrency(preferenceAmount)}).`);
          } else {
              calculationLog.push(`   - ${entry.stakeholderName} (${entry.shareClassName}): Takes preference. Preference (${formatCurrency(preferenceAmount)}) >= As-converted value (${formatCurrency(conversionValue)}).`);
          }
      }
  }

  calculationLog.push(`Step 4: Paying out liquidation preferences.`);
  for (const entry of preferredEntries) {
      if (remainingProceeds <= 0) break;
      if (!entry.hasConverted) {
          const preferenceAmount = entry.initialInvestment * entry.shareClass.liquidationPreferenceFactor;
          const payoutAmount = Math.min(preferenceAmount, remainingProceeds);
          entry.payout.fromLiquidationPreference = payoutAmount;
          remainingProceeds -= payoutAmount;
          calculationLog.push(`   - Paying ${entry.stakeholderName} (${entry.shareClassName}) preference: ${formatCurrency(payoutAmount)}. Remaining proceeds: ${formatCurrency(remainingProceeds)}.`);
      }
  }

  calculationLog.push(`Step 5: Distributing remaining proceeds (${formatCurrency(remainingProceeds)}) to common and participating shares.`);
  if (remainingProceeds > 0.01) {
    const finalDistributionShares = allEntries
      .filter(e => 
        e.shareClass.liquidationPreferenceRank === 0 || 
        e.hasConverted ||                               
        e.shareClass.liquidationPreferenceType === 'FULL_PARTICIPATING' ||
        e.shareClass.liquidationPreferenceType === 'CAPPED_PARTICIPATING'
      )
      .reduce((sum, e) => sum + e.vestedShares, 0);

    if (finalDistributionShares > 0) {
      const valuePerFinalShare = remainingProceeds / finalDistributionShares;
      calculationLog.push(`   - Total participating/common shares: ${finalDistributionShares.toLocaleString(locale)}. Final value per share: ${formatCurrency(valuePerFinalShare)}.`);
      
      for (const entry of allEntries) {
        let logMsg = '';
        const isCommonOrConverted = entry.shareClass.liquidationPreferenceRank === 0 || entry.hasConverted;
        const isFullParticipating = entry.shareClass.liquidationPreferenceType === 'FULL_PARTICIPATING' && !entry.hasConverted;
        const isCappedParticipating = entry.shareClass.liquidationPreferenceType === 'CAPPED_PARTICIPATING' && !entry.hasConverted;

        if (isCommonOrConverted) {
          const payout = entry.vestedShares * valuePerFinalShare;
          entry.payout.fromConvertedShares += payout;
          logMsg = `gets ${formatCurrency(payout)} from common/converted shares.`;
        } 
        else if (isFullParticipating) {
          const payout = entry.vestedShares * valuePerFinalShare;
          entry.payout.fromParticipation += payout;
          logMsg = `gets ${formatCurrency(payout)} from full participation.`;
        } 
        else if (isCappedParticipating) {
          const cap = entry.initialInvestment * (entry.shareClass.participationCapFactor || 1);
          const alreadyPaid = entry.payout.fromLiquidationPreference;
          const potentialPayout = entry.vestedShares * valuePerFinalShare;
          const allowedPayout = Math.max(0, cap - alreadyPaid);
          const participationPayout = Math.min(potentialPayout, allowedPayout);
          entry.payout.fromParticipation += participationPayout;
          logMsg = `gets ${formatCurrency(participationPayout)} from capped participation (Cap: ${formatCurrency(cap)}, Already paid: ${formatCurrency(alreadyPaid)}).`;
        }
         if (logMsg) calculationLog.push(`   - ${entry.stakeholderName} (${entry.shareClassName}) ${logMsg}`);
      }
    } else {
        calculationLog.push(`   - No shares eligible for final distribution. Remaining proceeds: ${formatCurrency(remainingProceeds)}.`);
    }
  }

  const finalEquityDistributions: WaterfallDistribution[] = [];
  allEntries.forEach(e => {
      e.payout.totalProceeds = e.payout.fromDebtRepayment + e.payout.fromLiquidationPreference + e.payout.fromParticipation + e.payout.fromConvertedShares;
      if (e.payout.initialInvestment > 0) {
          e.payout.multiple = e.payout.totalProceeds / e.payout.initialInvestment;
      }
      finalEquityDistributions.push(e.payout);
  });
  
  // Combine all distributions
  const allDistributions = [...distributions, ...finalEquityDistributions.filter(d => d.totalProceeds > 0.01)];
  allDistributions.sort((a,b) => b.totalProceeds - a.totalProceeds);

  calculationLog.push(`Step 6: Finalizing distributions.`);
  return {
    netExitProceeds: exitProceeds - transactionCosts,
    distributions: allDistributions,
    remainingValue: remainingProceeds,
    calculationLog,
  };
}

/**
 * Simulates voting power based on the current cap table and historical transactions.
 */
export function simulateVote(capTable: CapTable, transactions: Transaction[]): VotingResult {
  const shareClasses = getShareClassesAsOf(transactions, capTable.asOfDate);
  const voteDistribution: VoteDistributionEntry[] = [];
  
  const totalVotes = capTable.entries.reduce((sum, entry) => {
    const shareClass = shareClasses.get(entry.shareClassId);
    return sum + (entry.vestedShares * (shareClass?.votesPerShare || 0));
  }, 0);

  if (totalVotes === 0) {
      return {
          voteDistribution: [],
          totalVotes: 0,
          asOfDate: capTable.asOfDate
      }
  }

  capTable.entries.forEach(entry => {
    const shareClass = shareClasses.get(entry.shareClassId);
    if(shareClass) {
        const votes = entry.vestedShares * shareClass.votesPerShare;
        if(votes > 0) {
            voteDistribution.push({
                stakeholderName: entry.stakeholderName,
                shareClassName: entry.shareClassName,
                votes,
                percentage: (votes / totalVotes) * 100
            });
        }
    }
  });

  voteDistribution.sort((a,b) => b.votes - a.votes);
  
  return { voteDistribution, totalVotes, asOfDate: capTable.asOfDate };
}