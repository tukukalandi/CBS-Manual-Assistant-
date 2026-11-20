import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const MANUALS = [
  {
    part: 1,
    partLabel: 'Part I',
    title: 'POSB CBS Manual 2026 – Part I',
    file: path.join(ROOT, 'public/manuals/POSB_CBS_Manual_2026_Part_1.pdf'),
    publicUrl: '/manuals/POSB_CBS_Manual_2026_Part_1.pdf',
  },
  {
    part: 2,
    partLabel: 'Part II',
    title: 'POSB CBS Manual 2026 – Part II',
    file: path.join(ROOT, 'public/manuals/POSB_CBS_Manual_2026_Part_2.pdf'),
    publicUrl: '/manuals/POSB_CBS_Manual_2026_Part_2.pdf',
  },
];

// Common non-menu uppercase acronyms to exclude from menu code extraction
const NON_MENU_WORDS = new Set([
  'POSB', 'CBS', 'INDIA', 'POST', 'POSTS', 'GOVT', 'NOTE', 'RULE', 'RULES',
  'PART', 'PAGE', 'PARA', 'FORM', 'FORMS', 'CHAPTER', 'APPENDIX', 'SECTION',
  'ANNEXURE', 'TABLE', 'INDEX', 'MANUAL', 'FINACLE', 'MAKER', 'CHECKER',
  'SAVINGS', 'BANK', 'ACCOUNT', 'ACCOUNTS', 'OFFICE', 'HEAD', 'SUB', 'BRANCH',
  'CIRCLE', 'DIVISION', 'REGION', 'SYSTEM', 'SERVER', 'CLIENT', 'BRANCHES',
  'DATE', 'TIME', 'NAME', 'CODE', 'NUMBER', 'AMOUNT', 'TOTAL', 'STATUS',
  'TYPE', 'MODE', 'CASH', 'CHEQUE', 'TRANSFER', 'DEPOSIT', 'WITHDRAWAL',
  'CLOSURE', 'OPENING', 'INTEREST', 'BALANCE', 'PASSBOOK', 'DUPLICATE',
  'NOMINATION', 'DECEASED', 'CLAIM', 'MINOR', 'GUARDIAN', 'JOINT', 'SINGLE',
  'KYC', 'PAN', 'AADHAAR', 'AADHAR', 'UIDAI', 'CKYC', 'EKyc', 'EKYC', 'CIF',
  'SOL', 'SOLID', 'ATM', 'NEFT', 'RTGS', 'IMPS', 'UPI', 'ECS', 'NACH', 'DBT',
  'TDS', 'ITR', 'CBDT', 'RBI', 'MOF', 'DEA', 'DOP', 'CEPT', 'SBCO', 'PAO',
  'DAP', 'CPC', 'BPM', 'ABPM', 'GDS', 'SPM', 'APM', 'DPM', 'PM', 'SPO', 'SSPO',
  'ASP', 'IP', 'DPS', 'PMG', 'CPMG', 'DDG', 'ADG', 'DG', 'SO', 'HO', 'BO',
  'SB', 'RD', 'TD', 'MIS', 'SCSS', 'PPF', 'SSA', 'NSC', 'KVP', 'MSSC', 'TD1',
  'TD2', 'TD3', 'TD5', 'PMJJBY', 'PMSBY', 'APY', 'IPPB', 'DARPAN', 'CSI',
  'SAP', 'FSI', 'BGL', 'GL', 'LOT', 'DTR', 'EOD', 'BOD', 'SOD', 'DC', 'DR',
  'CR', 'DRCR', 'SMS', 'OTP', 'PIN', 'IVR', 'WEB', 'URL', 'PDF', 'CSV', 'XML',
  'TXT', 'DOC', 'XLS', 'NIC', 'NPCI', 'UID', 'DOB', 'DOCUMENTS', 'VERIFIED',
  'ENTER', 'CLICK', 'SUBMIT', 'VERIFY', 'CANCEL', 'MODIFY', 'INQUIRE', 'ADD',
  'DELETE', 'PRINT', 'REPORT', 'REPORTS', 'MENU', 'OPTION', 'FIELD', 'FIELDS',
  'SCREEN', 'BUTTON', 'TAB', 'LINK', 'NEXT', 'BACK', 'EXIT', 'CLOSE', 'OPEN',
  'YES', 'NO', 'OK', 'NIL', 'NA', 'ETC', 'VIZ', 'IE', 'EG', 'RS', 'INR', 'USD',
  'THE', 'AND', 'FOR', 'WITH', 'FROM', 'THAT', 'THIS', 'WILL', 'SHALL', 'MAY',
  'MUST', 'NOT', 'ALL', 'ANY', 'ARE', 'WAS', 'WERE', 'HAS', 'HAVE', 'HAD',
  'BEEN', 'BEING', 'ALSO', 'ONLY', 'SUCH', 'INTO', 'UPON', 'OVER', 'UNDER',
  'AFTER', 'BEFORE', 'DURING', 'THROUGH', 'BETWEEN', 'ABOVE', 'BELOW',
  'GENERAL', 'SPECIAL', 'OFFICIAL', 'PUBLIC', 'CENTRAL', 'STATE', 'NATIONAL',
  'DEPARTMENT', 'MINISTRY', 'COMMUNICATIONS', 'GOVERNMENT', 'DIRECTORATE',
  'ORDER', 'ORDERS', 'CIRCULAR', 'LETTER', 'MEMO', 'OFFICE', 'ISSUE', 'ISSUED',
  'MONTH', 'YEAR', 'DAYS', 'DAILY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'ANNUAL',
  'MAX', 'MIN', 'LIMIT', 'LIMITS', 'RATE', 'RATES', 'FEE', 'FEES', 'GST',
  'IFSC', 'MICR', 'UTR', 'RRN', 'STAN', 'TXN', 'TRAN', 'TRANS', 'ID', 'NO',
  'SR', 'SL', 'REF', 'DESC', 'REMARKS', 'ACTION', 'USER', 'ROLE', 'LEVEL',
  'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'STEP', 'STEPS', 'STAGE',
  'NEW', 'OLD', 'END', 'DAY', 'DUE', 'PAY', 'PAID', 'DUE', 'NET', 'GROSS',
  'SCHEME', 'SCHEMES', 'SERIES', 'ISSUE', 'MATURITY', 'PREMATURE', 'LOAN',
  'PLEDGE', 'TRANSFER', 'SILENT', 'DORMANT', 'FREEZE', 'UNFREEZE', 'LIEN',
  'STOP', 'PAYMENT', 'RETURN', 'BOUNCE', 'CLEARING', 'OUTWARD', 'INWARD',
  'AGENT', 'MPKBY', 'SAS', 'COMMISSION', 'DEDUCTION', 'RECOVERY', 'PENALTY',
  'DEFAULT', 'REVIVAL', 'EXTENSION', 'CONTINUATION', 'CONVERSION', 'MERGER',
  'CORRECTION', 'RECTIFICATION', 'REVERSAL', 'ADJUSTMENT', 'SETTLEMENT',
  'LEGAL', 'HEIR', 'SUCCESSION', 'PROBATE', 'INDEMNITY', 'AFFIDAVIT', 'SURETY',
  'WITNESS', 'SIGNATURE', 'THUMB', 'IMPRESSION', 'PHOTO', 'IDENTITY', 'ADDRESS',
  'PROOF', 'MOBILE', 'EMAIL', 'ONLINE', 'OFFLINE', 'PORTAL', 'DOPBNK', 'IB',
  'MB', 'EBANKING', 'NETBANKING', 'PASSBOOK', 'CHEQUEBOOK', 'CARD', 'DEBIT',
  'HOTLIST', 'BLOCK', 'UNBLOCK', 'REISSUE', 'RENEWAL', 'ACTIVE', 'INACTIVE',
  'CLOSED', 'OPENED', 'PENDING', 'POSTED', 'ENTERED', 'REJECTED', 'APPROVED',
  'ERROR', 'FAILED', 'SUCCESS', 'FAILURE', 'TIMEOUT', 'RECON', 'DISPUTE',
  'CHARGEBACK', 'COMPLAINT', 'TICKET', 'HELPDESK', 'AUDIT', 'INSPECTION',
  'CHECK', 'CHECKS', 'CONTROL', 'REGISTER', 'LEDGER', 'VOUCHER', 'SLIP',
  'RECEIPT', 'CERTIFICATE', 'STATEMENT', 'SUMMARY', 'DETAIL', 'DETAILS',
  'LIST', 'VIEW', 'SEARCH', 'QUERY', 'PROCESS', 'BATCH', 'JOB', 'RUN',
  'VALUE', 'VALID', 'INVALID', 'BLANK', 'EMPTY', 'ZERO', 'NULL', 'TRUE', 'FALSE',
  'JAN', 'FEB', 'MAR', 'APR', 'JUN', 'JUL', 'AUG', 'SEP', 'SEPT', 'OCT', 'NOV', 'DEC',
  'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN', 'AM', 'PM', 'IST',
  'FORM', 'PART', 'VOL', 'EDITION', 'REVISED', 'UPDATED', 'MARCH', 'APRIL',
  'JANUARY', 'FEBRUARY', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER',
  'OCTOBER', 'NOVEMBER', 'DECEMBER', 'CONTENTS', 'PREFACE', 'FOREWORD',
  'INTRODUCTION', 'DEFINITIONS', 'PROCEDURE', 'PROCEDURES', 'INSTRUCTIONS',
  'GUIDELINES', 'IMPORTANT', 'EXCEPTIONS', 'RESTRICTIONS', 'RESPONSIBILITIES',
  'CHECKLIST', 'FORMAT', 'SPECIMEN', 'PROFORMA', 'SCHEDULE', 'APPENDIX',
  'ANNEX', 'III', 'IV', 'VI', 'VII', 'VIII', 'IX', 'XI', 'XII', 'XIII', 'XIV',
  'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII', 'XXIV',
  'XXV', 'II', 'I', 'V', 'X', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
]);

// Known real Finacle POSB CBS menu code prefixes and explicit codes
const KNOWN_FINACLE_MENUS = new Set([
  'CASBAO', 'CASBAV', 'CASBAM', 'CASBAI', 'CASBAOP',
  'CRDP', 'CRDPV', 'CRDPM', 'CRDPI', 'CRDACO', 'CRDACV', 'CRDACM', 'CRDACI', 'CRDO', 'CRDV',
  'CTDAO', 'CTDAV', 'CTDAM', 'CTDAI', 'CMISAO', 'CMISAV', 'CMISAM', 'CMISAI', 'CMISAOP',
  'CSCSAO', 'CSCSAV', 'CSCSAM', 'CSCSAI', 'CSCAOP', 'CSCAAO', 'CSCAAV', 'CSCAAM', 'CSCAOC',
  'CPPFAO', 'CPPFAV', 'CPPFAM', 'CPPFAI', 'CPPF', 'CSSAO', 'CSSAV', 'CSSAM', 'CSSAI', 'CSSA',
  'CNSCAO', 'CNSCAV', 'CKVPAO', 'CKVPAV', 'CMSSCAO', 'CMSSCAV', 'CNSC', 'CKVP', 'CMSSC',
  'CSBCO', 'CSBCV', 'CSBCM', 'CSBCI', 'HCAAC', 'HCAACV', 'HCAACTD', 'HCAACTDV', 'HCAACRD',
  'HCAACMIS', 'HCAACSCS', 'HCAACPPF', 'HCAACSSA', 'CAAC', 'CAACTD',
  'CTM', 'HTM', 'HXFER', 'HCASHDEP', 'HCASHWD', 'HCASHP', 'HFTI', 'HFTR', 'HAFI', 'HFINRPT',
  'HACLI', 'HACLPOA', 'HACLINQ', 'HACI', 'HACCBAL', 'HACINT', 'HACTI', 'HACXFRSC', 'HACXFSC',
  'HACXFSOL', 'HIOT', 'HIO', 'HCCA', 'HAFSM', 'HFRZ', 'HACM', 'HACMTD', 'HACMRD',
  'HPBP', 'HPBPR', 'HPR', 'HPS', 'HDUPPB', 'CPB', 'CPBP', 'CISR', 'CISA', 'HICHB', 'HCHBM', 'HCHBI',
  'HSPP', 'HSPPAU', 'HSTOP', 'HSI', 'HSIM', 'HSII', 'HSIAD', 'HSIR', 'HSSII',
  'CIF', 'CCIF', 'CIFM', 'CIFI', 'CIFV', 'CCIFM', 'CCIFI', 'CCIFV', 'CCIFCR', 'CCIFMOD', 'CCIFINQ',
  'CDEDUP', 'CMRC', 'CMRCV', 'CNAC', 'CNACV', 'CNOM', 'HNOM', 'HCLM', 'CCLM', 'CDCS', 'CDCSV',
  'CBO', 'CBOV', 'CBOM', 'CSOLOP', 'HSOLVAL', 'HSOLSTAT', 'HEOD', 'HBOD', 'HSOD', 'HFINACLE',
  'HTDSIP', 'HTDSCALC', 'HTDTRAN', 'HTD', 'HREN', 'HRENHIST', 'HREJREP', 'HCLZ', 'HOCTM', 'HICTM',
  'HIRM', 'HORM', 'HBR', 'HGEN', 'HGEN2', 'HBG', 'HLIEN', 'HALM', 'HMEMOPAD', 'HMEMO',
  'HSIEXEC', 'HREVPEND', 'HREVT', 'HTR', 'HTRANS', 'HINTTM', 'HINTCERT', 'HICERT', 'HBP',
  'CAGENT', 'CAGENTM', 'CAGNT', 'CMPKBY', 'CSAS', 'CPOSB', 'CRECON', 'CEB', 'CIB', 'CMB',
  'CATM', 'CATMM', 'CATMI', 'CCARD', 'CCARDM', 'CCARDI', 'CPIN', 'CIBR', 'CMBR', 'CSMS',
  'CNACH', 'CECS', 'CDBT', 'CNEFT', 'CRTGS', 'CIMPS', 'CUPI', 'CIPPB', 'CPAY',
  'HUPM', 'HUPMA', 'HUPMI', 'HROLE', 'HEFM', 'HUSR', 'HUSER', 'HUSRM', 'HPW', 'HPWD',
  'HLNGI', 'HLP', 'HLOAN', 'HCLAO', 'HCLAV', 'HCLAC', 'HCLPAY', 'CRDLN', 'CRDLNV', 'CPPFLN',
  'HPLDG', 'CPLDG', 'CPLDGV', 'CEXT', 'CEXTV', 'CREV', 'CREVV', 'CCONV', 'CCONVV',
  'HTRAN', 'HTRANSFER', 'HDEP', 'HWD', 'HCLOS', 'HOPEN', 'HVER', 'HMOD', 'HINQ',
  'CSOL', 'HSOL', 'HGL', 'HBGL', 'HBRTI', 'HTRANSUM', 'HDTR', 'HLOT', 'CSBCO', 'CSBC',
  'CCIFCR', 'CCIFMD', 'CCIFVR', 'CCIFIN', 'CMOB', 'CPAN', 'CAADHAAR', 'CKYC', 'CCKYC',
  'CSB', 'CRD', 'CTD', 'CMIS', 'CSCSS', 'CPPF', 'CSSA', 'CDORM', 'CSILENT', 'CREACT',
  'HREOPEN', 'HREACT', 'HDORM', 'HACCDET', 'HACBAL', 'HACCSTMT', 'HSTMNT', 'HPASS',
]);

function normalizeLineText(items) {
  // Group PDF text items by Y coordinate (line) and sort left-to-right by X
  const lines = [];
  const Y_TOLERANCE = 3.2;

  for (const item of items) {
    if (!item || typeof item.str !== 'string') continue;
    const str = item.str;
    if (!str && !item.hasEOL) continue;
    const x = item.transform ? item.transform[4] : 0;
    const y = item.transform ? item.transform[5] : 0;

    let line = lines.find((l) => Math.abs(l.y - y) <= Y_TOLERANCE);
    if (!line) {
      line = { y, items: [] };
      lines.push(line);
    }
    line.items.push({ x, str, width: item.width || 0 });
  }

  // Sort top-to-bottom (higher y is higher on PDF page)
  lines.sort((a, b) => b.y - a.y);

  const outputLines = [];
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    let lineText = '';
    let prevEnd = null;
    for (const seg of line.items) {
      if (prevEnd !== null) {
        const gap = seg.x - prevEnd;
        if (gap > 2 && !lineText.endsWith(' ') && !seg.str.startsWith(' ')) {
          lineText += gap > 22 ? '  ' : ' ';
        }
      }
      lineText += seg.str;
      prevEnd = seg.x + seg.width;
    }
    const cleaned = lineText.replace(/\s+$/g, '').replace(/^\s+/g, '');
    if (cleaned) outputLines.push(cleaned);
  }

  return outputLines;
}

function detectChapterOrAppendix(lines, currentChapter, pdfPage, part) {
  const topLines = lines.slice(0, 12);
  const joinedTop = topLines.join('\n');
  const dotLeaderCount = lines.filter((l) => /\.{3,}/.test(l)).length;

  // Detect Table of Contents pages first (never treat TOC entries as chapter starts)
  if (
    /^TABLE OF CONTENTS|^CONTENTS$/im.test(joinedTop) ||
    (pdfPage <= 22 && dotLeaderCount >= 3)
  ) {
    return 'Table of Contents';
  }
  if (/^PREFACE$/im.test(joinedTop) && pdfPage <= 20) {
    return 'Preface';
  }
  if (/^FOREWORD$/im.test(joinedTop) && pdfPage <= 20) {
    return 'Foreword';
  }

  // Only inspect the top portion of a page for true Chapter / Appendix headings
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i];
    if (/\.{3,}/.test(line)) continue;
    if (line.length > 105) continue;

    // Match "CHAPTER - 4", "Chapter 4: ...", "CHAPTER 4 – ..."
    const chapMatch = line.match(/^(?:CHAPTER|Chapter)\s*[-–:]?\s*([0-9]{1,2}|[IVX]{1,5})(?:\s*[-–:.]\s*(.*))?$/);
    if (chapMatch) {
      let rest = (chapMatch[2] || '').replace(/^[\s:\-–.]+/, '').trim();
      if (!rest && lines[i + 1] && lines[i + 1].length < 95 && !/^(page|\d+$|rule\s+\d)/i.test(lines[i + 1])) {
        rest = lines[i + 1].trim();
      }
      // Reject prose sentences accidentally starting with "Chapter X ..."
      if (rest.split(/\s+/).length > 14 || /\.$/.test(rest)) continue;
      if (rest.length > 85) rest = rest.slice(0, 85).trim();
      return rest ? `Chapter ${chapMatch[1].toUpperCase()} – ${rest}` : `Chapter ${chapMatch[1].toUpperCase()}`;
    }

    // Match "APPENDIX - I", "Appendix IV – ...", "ANNEXURE A"
    const appMatch = line.match(
      /^(?:APPENDIX|Appendix|ANNEXURE|Annexure)\s*[-–:]?\s*([IVXLC]{1,6}|[0-9]{1,2}|[A-Z])(?:\s*[-–:.]\s*(.*))?$/
    );
    if (appMatch) {
      let rest = (appMatch[2] || '').replace(/^[\s:\-–.]+/, '').trim();
      if (
        !rest &&
        lines[i + 1] &&
        lines[i + 1].length < 95 &&
        !/^(page|\d+$|appendix|annexure)/i.test(lines[i + 1])
      ) {
        rest = lines[i + 1].trim();
      }
      // Reject inline sentences like "Appendix III - The outstation cheques will be..."
      if (rest.split(/\s+/).length > 14 || /\b(will be|shall be|is to be|has been)\b/i.test(rest)) {
        continue;
      }
      // Strip trailing repeated "Appendix - I" header artifacts
      rest = rest.replace(/\s*Appendix\s*[-–]?\s*[IVXLC0-9]+$/i, '').trim();
      if (rest.length > 85) rest = rest.slice(0, 85).trim();
      const label = /^annex/i.test(line) ? 'Annexure' : 'Appendix';
      return rest ? `${label} ${appMatch[1].toUpperCase()} – ${rest}` : `${label} ${appMatch[1].toUpperCase()}`;
    }
  }

  if (pdfPage <= 2) {
    return part === 1 ? 'Cover & Front Matter (Part I)' : 'Cover & Front Matter (Part II)';
  }

  return currentChapter;
}

function detectPrintedPage(lines, pdfPage) {
  if (!lines.length) return String(pdfPage);
  const candidates = [lines[0], lines[lines.length - 1], lines[lines.length - 2]].filter(Boolean);
  for (const c of candidates) {
    const trimmed = c.trim();
    const m1 = trimmed.match(/^(?:Page\s*)?(\d{1,3}|[ivxlcdm]{1,6})$/i);
    if (m1) return m1[1];
    const m2 = trimmed.match(/Page\s+(\d{1,3})\s*(?:of\s*\d+)?$/i);
    if (m2) return m2[1];
  }
  return String(pdfPage);
}

function extractMenus(text) {
  const found = new Set();

  // 1. Check known Finacle menu codes anywhere as whole words
  const tokens = text.match(/\b[A-Z][A-Z0-9]{2,11}\b/g) || [];
  for (const tok of tokens) {
    if (KNOWN_FINACLE_MENUS.has(tok)) {
      found.add(tok);
    }
  }

  // 2. Context-based Finacle menu detection: "menu CASBAO", "CASBAO menu", "menu code: XYZ", "Option: XYZ"
  const ctxPatterns = [
    /\b(?:menu(?:\s+code|\s+option|\s+id)?|finacle\s+menu|invoke|command)\s*(?:is|code|:|-|–|"|'|`)?\s*([A-Z][A-Z0-9]{2,11})\b/gi,
    /\b([A-Z][A-Z0-9]{3,11})\s+(?:menu(?:\s+option|\s+code)?)\b/g,
  ];

  for (const pat of ctxPatterns) {
    let m;
    while ((m = pat.exec(text)) !== null) {
      const candidate = m[1];
      if (
        candidate &&
        candidate === candidate.toUpperCase() &&
        /^[A-Z][A-Z0-9]{2,11}$/.test(candidate) &&
        !NON_MENU_WORDS.has(candidate) &&
        !/^\d+$/.test(candidate)
      ) {
        found.add(candidate);
      }
    }
  }

  return Array.from(found);
}

function extractRulesAndForms(text) {
  const rules = new Set();
  const forms = new Set();

  // Rules & Sections
  const ruleMatches = text.match(/\b(?:Rule|Section|Sec\.?|Para)\s+\d+[A-Za-z0-9().-]*/gi) || [];
  for (const r of ruleMatches) {
    const clean = r.replace(/\s+/g, ' ').replace(/[.,;:]$/, '').trim();
    if (clean.length <= 28) rules.add(clean);
  }

  // Forms like SB-3, SB-7, SB-7A, SB-103, SB-84, Form-1, Form 15G, Form 15H, KYC Form, NC-32, ACG-17, etc.
  const formMatches =
    text.match(/\b(?:SB|RD|TD|MIS|PPF|SCSS|SSA|NSC|KVP|NC|ACG|MS|TR|BO|SO|HO)-\d+[A-Za-z0-9()/-]*\b/g) || [];
  for (const f of formMatches) {
    forms.add(f.replace(/[.,;:]$/, ''));
  }

  const formWordMatches = text.match(/\bForm\s*[-–]?\s*(?:[A-Z0-9]{1,6}(?:\([a-z0-9]+\))?)\b/gi) || [];
  for (const f of formWordMatches) {
    const clean = f.replace(/\s+/g, ' ').replace(/[.,;:]$/, '').trim();
    if (!/^Form\s+(?:of|to|in|is|be|on|by|or|at|as|an|no)$/i.test(clean)) {
      forms.add(clean);
    }
  }

  // Section 194N, 80C, etc.
  const secCodes = text.match(/\b194[A-Z]\b|\b269(?:SS|ST|T)\b|\b80C\b/g) || [];
  for (const s of secCodes) rules.add(`Section ${s}`);

  return {
    rules: Array.from(rules).slice(0, 20),
    forms: Array.from(forms).slice(0, 20),
  };
}

function extractHeadings(lines) {
  const headings = [];
  for (const line of lines) {
    if (line.length < 4 || line.length > 110) continue;
    if (/^(?:CHAPTER|APPENDIX|ANNEXURE|\d+\.\d+|\d+\.)\s+[A-Za-z]/.test(line)) {
      if (!/\.{3,}\s*\d+\s*$/.test(line)) {
        headings.push(line);
      }
    }
  }
  return headings.slice(0, 8);
}

async function extractManual(manual) {
  console.log(`Reading ${manual.title} from ${manual.file}...`);
  const data = new Uint8Array(fs.readFileSync(manual.file));
  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  });

  const doc = await loadingTask.promise;
  const numPages = doc.numPages;
  console.log(`  -> Total PDF pages: ${numPages}`);

  const pages = [];
  let currentChapter = manual.part === 1 ? 'Front Matter (Part I)' : 'Front Matter (Part II)';

  for (let p = 1; p <= numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const lines = normalizeLineText(content.items);
    const text = lines.join('\n').trim();

    currentChapter = detectChapterOrAppendix(lines, currentChapter, p, manual.part);
    const printedPage = detectPrintedPage(lines, p);
    const menus = extractMenus(text);
    const { rules, forms } = extractRulesAndForms(text);
    const headings = extractHeadings(lines);

    pages.push({
      id: `p${manual.part}-${p}`,
      part: manual.part,
      partLabel: manual.partLabel,
      pdfPage: p,
      printedPage,
      chapter: currentChapter,
      headings,
      menus,
      rules,
      forms,
      text,
    });

    if (p % 100 === 0 || p === numPages) {
      console.log(`  -> Extracted ${p}/${numPages} pages`);
    }
  }

  return { numPages, pages };
}

async function main() {
  const allPages = [];
  const meta = {
    generatedAt: new Date().toISOString(),
    manuals: [],
    totalPages: 0,
    topMenuCodes: [],
    chapters: [],
  };

  const menuFreq = new Map();
  const chapterMap = new Map();

  for (const manual of MANUALS) {
    if (!fs.existsSync(manual.file)) {
      throw new Error(`Missing manual PDF: ${manual.file}`);
    }
    const { numPages, pages } = await extractManual(manual);
    meta.manuals.push({
      part: manual.part,
      partLabel: manual.partLabel,
      title: manual.title,
      totalPages: numPages,
      publicUrl: manual.publicUrl,
      fileName: path.basename(manual.file),
    });

    for (const pg of pages) {
      allPages.push(pg);
      for (const m of pg.menus) {
        menuFreq.set(m, (menuFreq.get(m) || 0) + 1);
      }
      const chKey = `${pg.part}::${pg.chapter}`;
      if (!chapterMap.has(chKey)) {
        chapterMap.set(chKey, {
          part: pg.part,
          partLabel: pg.partLabel,
          chapter: pg.chapter,
          startPage: pg.pdfPage,
          endPage: pg.pdfPage,
        });
      } else {
        chapterMap.get(chKey).endPage = pg.pdfPage;
      }
    }
  }

  meta.totalPages = allPages.length;
  meta.topMenuCodes = Array.from(menuFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60)
    .map(([code, count]) => ({ code, count }));
  meta.chapters = Array.from(chapterMap.values());

  const outDir = path.join(ROOT, 'data');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'cbs-manual-index.json');

  const payload = { meta, pages: allPages };
  fs.writeFileSync(outPath, JSON.stringify(payload), 'utf8');

  const stat = fs.statSync(outPath);
  console.log(`\nIndexed ${allPages.length} total pages to ${outPath} (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`Detected ${menuFreq.size} unique Finacle menu codes.`);
  console.log(`Top 25 menu codes:`, meta.topMenuCodes.slice(0, 25).map((m) => `${m.code}(${m.count})`).join(', '));
  console.log(`Chapters detected: ${meta.chapters.length}`);
}

main().catch((err) => {
  console.error('Indexing failed:', err);
  process.exit(1);
});
