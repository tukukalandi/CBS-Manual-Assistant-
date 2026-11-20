export interface SuggestedQuery {
  title: string;
  question: string;
  category: string;
}

export interface FinacleMenuItem {
  code: string;
  purpose: string;
  category: string;
  partHint: 'Part I' | 'Part II' | 'Both Parts';
}

export const SUGGESTED_CBS_QUERIES: SuggestedQuery[] = [
  {
    title: 'SB Account Opening',
    question: 'What is the procedure for opening a Savings Account?',
    category: 'Account Opening',
  },
  {
    title: 'Maker & Checker for SB',
    question: 'Explain the Maker and Checker process for SB account opening.',
    category: 'Verification',
  },
  {
    title: 'RD Premature Closure',
    question: 'Explain the procedure for premature closure of an RD account.',
    category: 'RD Scheme',
  },
  {
    title: 'Account Closure Menus',
    question: 'What is the Finacle menu for account closure?',
    category: 'Finacle Menu',
  },
  {
    title: 'Deceased Claim Settlement',
    question: 'What is the procedure for deceased claim settlement?',
    category: 'Claims',
  },
  {
    title: 'TDS under Section 194N',
    question: 'Explain TDS deduction under Section 194N.',
    category: 'Taxation',
  },
  {
    title: 'Duplicate Passbook Issue',
    question: 'What is the procedure for issuing a duplicate passbook?',
    category: 'Passbook',
  },
  {
    title: 'Account Transfer Process',
    question: 'Explain the procedure for transferring an account.',
    category: 'Transfers',
  },
  {
    title: 'Required CBS Forms',
    question: 'Which form is required for deposit and withdrawal transactions in SB accounts?',
    category: 'Forms',
  },
  {
    title: 'Failed Transactions Handling',
    question: 'What are the steps for handling failed transactions?',
    category: 'Operations',
  },
];

export const EXAMPLE_LOOKUP_TERMS = [
  'CASBAO',
  'CRDP',
  'CASBAV',
  'HCAAC',
  'SB-103',
  '194N',
  'HPBP',
  'CMRC',
  'HACXFSOL',
  'HFINRPT',
];

export const FREQUENT_FINACLE_MENUS: FinacleMenuItem[] = [
  {
    code: 'CIF',
    purpose: 'Customer Information File creation, modification, verification, and inquiry',
    category: 'Customer / KYC',
    partHint: 'Both Parts',
  },
  {
    code: 'CMRC',
    purpose: 'Customer Master / CIF related maintenance and verification operations',
    category: 'Customer / KYC',
    partHint: 'Both Parts',
  },
  {
    code: 'CASBAO',
    purpose: 'Post Office Savings Account (SB) opening in Finacle',
    category: 'Account Opening',
    partHint: 'Part I',
  },
  {
    code: 'CASBAV',
    purpose: 'Verification of newly opened Savings Bank account (Checker)',
    category: 'Account Opening',
    partHint: 'Part I',
  },
  {
    code: 'CRDP',
    purpose: 'Recurring Deposit (RD) account opening and related processing',
    category: 'Account Opening',
    partHint: 'Part I',
  },
  {
    code: 'CMISAOP',
    purpose: 'Monthly Income Scheme (MIS) account opening in Finacle',
    category: 'Account Opening',
    partHint: 'Part I',
  },
  {
    code: 'CPPFAO',
    purpose: 'Public Provident Fund (PPF) account opening',
    category: 'Account Opening',
    partHint: 'Part I',
  },
  {
    code: 'CTM',
    purpose: 'Cash Transaction Maintenance (cash deposit and withdrawal)',
    category: 'Transactions',
    partHint: 'Both Parts',
  },
  {
    code: 'HTM',
    purpose: 'Transaction Maintenance (transfer, clearing, and general postings)',
    category: 'Transactions',
    partHint: 'Both Parts',
  },
  {
    code: 'CXFER',
    purpose: 'Transfer transactions between accounts in Finacle',
    category: 'Transactions',
    partHint: 'Part I',
  },
  {
    code: 'HCAAC',
    purpose: 'Closure of operative/savings accounts',
    category: 'Closure',
    partHint: 'Part I',
  },
  {
    code: 'HCAACTD',
    purpose: 'Closure of Term Deposit / Time Deposit / RD / MIS / SCSS accounts',
    category: 'Closure',
    partHint: 'Part I',
  },
  {
    code: 'HPBP',
    purpose: 'Passbook printing and duplicate passbook issuance',
    category: 'Passbook',
    partHint: 'Part I',
  },
  {
    code: 'HACLI',
    purpose: 'Account Ledger Inquiry for viewing transaction history',
    category: 'Inquiry & Reports',
    partHint: 'Both Parts',
  },
  {
    code: 'HACLINQ',
    purpose: 'Account Ledger / balance and transaction status inquiry',
    category: 'Inquiry & Reports',
    partHint: 'Both Parts',
  },
  {
    code: 'HACINT',
    purpose: 'Account Interest calculation and inquiry',
    category: 'Inquiry & Reports',
    partHint: 'Part I',
  },
  {
    code: 'HINTTM',
    purpose: 'Interest Table / Rate Maintenance and inquiry',
    category: 'Interest & Charges',
    partHint: 'Part I',
  },
  {
    code: 'HGCHRG',
    purpose: 'General Charges collection (such as duplicate passbook or service fees)',
    category: 'Interest & Charges',
    partHint: 'Both Parts',
  },
  {
    code: 'HACXFSOL',
    purpose: 'Transfer of account from one Post Office (SOL) to another SOL',
    category: 'Transfers',
    partHint: 'Part I',
  },
  {
    code: 'HAFSM',
    purpose: 'Account Freeze Status Maintenance (freeze / unfreeze account)',
    category: 'Account Control',
    partHint: 'Both Parts',
  },
  {
    code: 'HALM',
    purpose: 'Account Lien Maintenance (marking / lifting lien on accounts)',
    category: 'Account Control',
    partHint: 'Both Parts',
  },
  {
    code: 'HAFI',
    purpose: 'Audit File Inquiry for checking Maker/Checker activity logs',
    category: 'Audit & Reports',
    partHint: 'Both Parts',
  },
  {
    code: 'HFINRPT',
    purpose: 'Finacle Report Generation (daily/periodic MIS and CBS reports)',
    category: 'Audit & Reports',
    partHint: 'Both Parts',
  },
  {
    code: 'HPR',
    purpose: 'Print Queue / Report viewing and printing in Finacle',
    category: 'Audit & Reports',
    partHint: 'Both Parts',
  },
];
