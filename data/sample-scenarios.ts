
import type { Transaction, Stakeholder, SampleScenario, ShareClass } from '../types';
import { TransactionType, TransactionStatus, ConversionMechanism } from '../types';

const stakeholder_anna = { id: 'sh-anna', name: 'Anna Founder' };
const stakeholder_ben = { id: 'sh-ben', name: 'Ben Co-Founder' };
const stakeholder_angelika = { id: 'sh-angelika', name: 'Angelika Angel' };
const stakeholder_vc = { id: 'sh-vc-a', name: 'Vision Capital' };
const stakeholder_pe = { id: 'sh-pe-b', name: 'Growth Equity Partners' };
const stakeholder_abank = { id: 'sh-abank', name: 'A-Bank' };
const stakeholder_binvestor = { id: 'sh-binvestor', name: 'B-Investor GmbH' };
const stakeholder_chris = { id: 'sh-chris', name: 'Chris Cool' };


const common_class: ShareClass = {
  id: 'sc-common',
  name: 'Common Stock',
  liquidationPreferenceRank: 0,
  liquidationPreferenceFactor: 1,
  liquidationPreferenceType: 'NON_PARTICIPATING',
  antiDilutionProtection: 'NONE',
  votesPerShare: 1,
  protectiveProvisions: [],
};

const common_class_supervoting: Partial<Omit<ShareClass, 'id'>> = {
  votesPerShare: 10,
};

const seed_class: ShareClass = {
  id: 'sc-seed',
  name: 'Seed Preferred',
  liquidationPreferenceRank: 1,
  liquidationPreferenceFactor: 1,
  liquidationPreferenceType: 'NON_PARTICIPATING',
  antiDilutionProtection: 'FULL_RATCHET',
  votesPerShare: 1,
  protectiveProvisions: ['SALE_OF_COMPANY'],
};

const series_a_class: ShareClass = {
  id: 'sc-series-a',
  name: 'Series A Preferred',
  liquidationPreferenceRank: 2,
  liquidationPreferenceFactor: 1,
  liquidationPreferenceType: 'NON_PARTICIPATING',
  antiDilutionProtection: 'BROAD_BASED',
  votesPerShare: 1,
  protectiveProvisions: [],
};

const vesting_schedule_anna = {
    id: 'vs-anna',
    name: 'Founder Vesting',
    grantDate: '2023-01-10',
    vestingPeriodMonths: 48,
    cliffMonths: 12,
};

const founding_tx: Transaction = {
  id: 'tx-founding',
  date: '2023-01-10',
  type: TransactionType.FOUNDING,
  status: TransactionStatus.ACTIVE,
  validFrom: '2023-01-10',
  companyName: 'FutureTech GmbH',
  legalForm: 'GmbH',
  currency: 'EUR',
  shareClasses: [common_class],
  shareholdings: [
    { id: 'shh-anna', stakeholderId: stakeholder_anna.id, stakeholderName: stakeholder_anna.name, shareClassId: common_class.id, shares: 500000, investment: 12500, originalPricePerShare: 0.025, vestingScheduleId: vesting_schedule_anna.id },
    { id: 'shh-ben', stakeholderId: stakeholder_ben.id, stakeholderName: stakeholder_ben.name, shareClassId: common_class.id, shares: 500000, investment: 12500, originalPricePerShare: 0.025 },
  ],
  vestingSchedules: [vesting_schedule_anna],
};

const convertible_tx: Transaction = {
    id: 'tx-convertible',
    date: '2023-06-15',
    type: TransactionType.CONVERTIBLE_LOAN,
    status: TransactionStatus.ACTIVE,
    validFrom: '2023-06-15',
    stakeholderId: stakeholder_angelika.id,
    investorName: stakeholder_angelika.name,
    amount: 150000,
    interestRate: 0.06,
    conversionMechanism: ConversionMechanism.CAP_AND_DISCOUNT,
    valuationCap: 4000000,
    discount: 0.2,
    seniority: 'SUBORDINATED'
};

const seed_round_tx: Transaction = {
    id: 'tx-seed-round',
    date: '2024-02-20',
    type: TransactionType.FINANCING_ROUND,
    status: TransactionStatus.ACTIVE,
    validFrom: '2024-02-20',
    roundName: 'Seed Round',
    preMoneyValuation: 5000000,
    newShareClass: seed_class,
    newShareholdings: [
        { id: 'shh-vc-a', stakeholderId: stakeholder_vc.id, stakeholderName: stakeholder_vc.name, shareClassId: seed_class.id, shares: 250000, investment: 1250000, originalPricePerShare: 5.00 },
    ],
    convertsLoanIds: [convertible_tx.id],
};

const down_round_tx: Transaction = {
    id: 'tx-down-round',
    date: '2024-09-01',
    type: TransactionType.FINANCING_ROUND,
    status: TransactionStatus.ACTIVE,
    validFrom: '2024-09-01',
    roundName: 'Series A',
    preMoneyValuation: 4000000, // Lower than seed post-money, creating a down-round
    newShareClass: series_a_class,
    newShareholdings: [
        { id: 'shh-pe-b', stakeholderId: stakeholder_pe.id, stakeholderName: stakeholder_pe.name, shareClassId: series_a_class.id, shares: 0, investment: 2000000, originalPricePerShare: 0 }, // Shares will be calculated
    ],
    convertsLoanIds: [],
};


// Data for Scenario 3: Advanced Waterfall
const debt_founding_tx: Transaction = {
  id: 'tx-debt-founding', date: '2023-01-01', type: TransactionType.FOUNDING, status: TransactionStatus.ACTIVE, validFrom: '2023-01-01',
  companyName: 'Debt Test AG', legalForm: 'AG', currency: 'EUR',
  shareClasses: [common_class],
  shareholdings: [ { id: 'shh-debt-anna', stakeholderId: stakeholder_anna.id, stakeholderName: stakeholder_anna.name, shareClassId: common_class.id, shares: 1000, investment: 50000 }],
};
const senior_debt_tx: Transaction = {
  id: 'tx-senior-debt', date: '2023-02-01', type: TransactionType.DEBT_INSTRUMENT, status: TransactionStatus.ACTIVE, validFrom: '2023-02-01',
  lenderName: stakeholder_abank.name, amount: 500000, interestRate: 0.05, seniority: 'SENIOR_SECURED',
};
const sub_debt_tx: Transaction = {
  id: 'tx-sub-debt', date: '2023-03-01', type: TransactionType.DEBT_INSTRUMENT, status: TransactionStatus.ACTIVE, validFrom: '2023-03-01',
  lenderName: stakeholder_binvestor.name, amount: 100000, interestRate: 0.10, seniority: 'SUBORDINATED',
};

// Data for Scenario 4: Governance & Secondaries
const gov_founding_tx: Transaction = {
    id: 'tx-gov-founding', date: '2023-01-15', type: TransactionType.FOUNDING, status: TransactionStatus.ACTIVE, validFrom: '2023-01-15',
    companyName: 'Governance Inc.', legalForm: 'C-Corp', currency: 'USD',
    shareClasses: [common_class],
    shareholdings: [
        { id: 'shh-gov-anna', stakeholderId: stakeholder_anna.id, stakeholderName: stakeholder_anna.name, shareClassId: common_class.id, shares: 500, investment: 500 },
        { id: 'shh-gov-ben', stakeholderId: stakeholder_ben.id, stakeholderName: stakeholder_ben.name, shareClassId: common_class.id, shares: 500, investment: 500 },
    ],
};
const secondary_tx: Transaction = {
    id: 'tx-secondary', date: '2023-08-01', type: TransactionType.SHARE_TRANSFER, status: TransactionStatus.ACTIVE, validFrom: '2023-08-01',
    sellerStakeholderId: stakeholder_anna.id,
    buyerStakeholderId: stakeholder_chris.id,
    buyerStakeholderName: stakeholder_chris.name,
    shareClassId: common_class.id,
    numberOfShares: 100,
    pricePerShare: 10,
};
const super_voting_tx: Transaction = {
    id: 'tx-super-voting', date: '2024-01-01', type: TransactionType.UPDATE_SHARE_CLASS, status: TransactionStatus.ACTIVE, validFrom: '2024-01-01',
    shareClassIdToUpdate: common_class.id,
    updatedProperties: common_class_supervoting,
};


export const sampleScenarios: SampleScenario[] = [
  {
    id: 'seed-round-scenario',
    titleKey: 'scenarioSeedRoundTitle',
    descriptionKey: 'scenarioSeedRoundDescription',
    data: {
      projectName: 'Beispiel: Seed Runde',
      stakeholders: [ stakeholder_anna, stakeholder_ben, stakeholder_angelika, stakeholder_vc ],
      transactions: [ founding_tx, convertible_tx, seed_round_tx ],
    }
  },
  {
    id: 'down-round-scenario',
    titleKey: 'scenarioDownRoundTitle',
    descriptionKey: 'scenarioDownRoundDescription',
    data: {
      projectName: 'Beispiel: Down-Round',
      stakeholders: [ stakeholder_anna, stakeholder_ben, stakeholder_angelika, stakeholder_vc, stakeholder_pe ],
      transactions: [ founding_tx, convertible_tx, seed_round_tx, down_round_tx ],
    }
  },
  {
    id: 'advanced-waterfall-scenario',
    titleKey: 'scenarioAdvancedWaterfallTitle',
    descriptionKey: 'scenarioAdvancedWaterfallDescription',
    data: {
        projectName: 'Beispiel: Waterfall mit Schulden',
        stakeholders: [ stakeholder_anna, stakeholder_abank, stakeholder_binvestor ],
        transactions: [ debt_founding_tx, senior_debt_tx, sub_debt_tx ],
    }
  },
  {
    id: 'governance-secondaries-scenario',
    titleKey: 'scenarioGovernanceTitle',
    descriptionKey: 'scenarioGovernanceDescription',
    data: {
        projectName: 'Beispiel: Governance & Secondaries',
        stakeholders: [ stakeholder_anna, stakeholder_ben, stakeholder_chris ],
        transactions: [ gov_founding_tx, secondary_tx, super_voting_tx ],
    }
  },
];
