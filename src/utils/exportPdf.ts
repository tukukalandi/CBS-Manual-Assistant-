import { jsPDF } from 'jspdf';
import type { CitationRef } from '../types';

export interface ExportAnswerParams {
  question?: string;
  answer: string;
  citations?: CitationRef[];
  timestamp?: number;
}

function makeSlug(text?: string, fallback = 'Reference'): string {
  const slug = (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 38);
  return slug || fallback;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripMarkdownForPdf(md: string): string {
  return md
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\|?[\s:-]+\|[\s|:-]*$/gm, '')
    .replace(/^\|\s*/gm, '• ')
    .replace(/\s*\|$/gm, '')
    .replace(/\s*\|\s*/g, '  |  ')
    .trim();
}

function markdownToWordHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const htmlParts: string[] = [];
  let inUl = false;
  let inOl = false;
  let inTable = false;
  let tableHeaderDone = false;

  const closeLists = () => {
    if (inUl) {
      htmlParts.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      htmlParts.push('</ol>');
      inOl = false;
    }
  };

  const closeTable = () => {
    if (inTable) {
      htmlParts.push('</tbody></table>');
      inTable = false;
      tableHeaderDone = false;
    }
  };

  const formatInline = (text: string) =>
    escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(
        /`([^`]+)`/g,
        '<span style="font-family:Consolas,monospace;background:#f5f0e8;color:#9e0c24;padding:1px 4px;">$1</span>'
      );

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      closeLists();
      closeTable();
      continue;
    }

    // Markdown table row
    if (line.startsWith('|') && line.endsWith('|')) {
      closeLists();
      // Skip separator row like | :--- | :--- |
      if (/^\|[\s:-]+(?:\|[\s:-]+)+\|$/.test(line)) {
        continue;
      }
      const cells = line
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());

      if (!inTable) {
        inTable = true;
        tableHeaderDone = false;
        htmlParts.push(
          '<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;margin:10px 0;font-size:10.5pt;border-color:#d6d3d1;">'
        );
      }

      if (!tableHeaderDone) {
        htmlParts.push(
          '<thead><tr style="background:#FAF7F2;">' +
            cells
              .map(
                (c) =>
                  `<th align="left" style="border:1px solid #d6d3d1;padding:6px 8px;font-weight:bold;">${formatInline(c)}</th>`
              )
              .join('') +
            '</tr></thead><tbody>'
        );
        tableHeaderDone = true;
      } else {
        htmlParts.push(
          '<tr>' +
            cells
              .map(
                (c) =>
                  `<td valign="top" style="border:1px solid #d6d3d1;padding:6px 8px;">${formatInline(c)}</td>`
              )
              .join('') +
            '</tr>'
        );
      }
      continue;
    } else {
      closeTable();
    }

    // Headings
    const hMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (hMatch) {
      closeLists();
      const level = Math.min(4, hMatch[1].length + 1);
      htmlParts.push(
        `<h${level} style="color:#A00D24;margin:14px 0 6px 0;font-family:Calibri,Arial,sans-serif;">${formatInline(hMatch[2])}</h${level}>`
      );
      continue;
    }

    // Bullet list
    const ulMatch = line.match(/^[-*•]\s+(.*)$/);
    if (ulMatch) {
      if (inOl) {
        htmlParts.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        htmlParts.push('<ul style="margin:6px 0 10px 18px;">');
        inUl = true;
      }
      htmlParts.push(`<li style="margin-bottom:4px;">${formatInline(ulMatch[1])}</li>`);
      continue;
    }

    // Numbered list
    const olMatch = line.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      if (inUl) {
        htmlParts.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        htmlParts.push('<ol style="margin:6px 0 10px 18px;">');
        inOl = true;
      }
      htmlParts.push(`<li style="margin-bottom:4px;">${formatInline(olMatch[1])}</li>`);
      continue;
    }

    closeLists();
    htmlParts.push(`<p style="margin:6px 0;line-height:1.55;">${formatInline(line)}</p>`);
  }

  closeLists();
  closeTable();
  return htmlParts.join('\n');
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function openExternalLinkSafe(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function buildAnswerPdfDoc(params: ExportAnswerParams): { doc: jsPDF; filename: string } {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const maxWidth = pageWidth - margin * 2;
  let y = 18;

  // India Post Postal Red header stripe
  doc.setFillColor(200, 16, 46);
  doc.rect(0, 0, pageWidth, 12, 'F');
  doc.setFillColor(255, 205, 0);
  doc.rect(0, 12, pageWidth, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('CBS Manual AI Assistant  |  Department of Posts, India', margin, 8);

  y = 22;
  doc.setTextColor(80, 74, 70);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const dateStr = new Date(params.timestamp || Date.now()).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  doc.text(
    `Reference Document: POSB CBS Manual 2026 (Part I & Part II)   |   Generated: ${dateStr}`,
    margin,
    y
  );
  y += 7;

  if (params.question) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(28, 25, 23);
    const qLines = doc.splitTextToSize(`Query: ${params.question}`, maxWidth);
    doc.text(qLines, margin, y);
    y += qLines.length * 5.5 + 3;

    doc.setDrawColor(214, 211, 209);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  }

  const cleanBody = stripMarkdownForPdf(params.answer);
  const paragraphs = cleanBody.split('\n');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(35, 31, 29);

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 16) {
      doc.addPage();
      y = 18;
    }
  };

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      y += 2.5;
      continue;
    }

    const isHeading = /^(Topic:|[\d]+\.\s+[A-Z]|Source References)/i.test(trimmed);
    if (isHeading) {
      ensureSpace(9);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(160, 13, 36);
      const lines = doc.splitTextToSize(trimmed, maxWidth);
      doc.text(lines, margin, y);
      y += lines.length * 5.2 + 1.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(35, 31, 29);
    } else {
      const lines = doc.splitTextToSize(trimmed, maxWidth);
      ensureSpace(lines.length * 4.8 + 2);
      doc.text(lines, margin, y);
      y += lines.length * 4.8 + 1.2;
    }
  }

  if (params.citations && params.citations.length > 0) {
    ensureSpace(16);
    y += 4;
    doc.setDrawColor(214, 211, 209);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(160, 13, 36);
    doc.text('Indexed PDF Page References', margin, y);
    y += 5.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(50, 46, 44);
    for (const c of params.citations.slice(0, 8)) {
      const line = `• CBS Manual ${c.partLabel} – ${c.chapter}, Page ${c.pdfPage}`;
      const wrapped = doc.splitTextToSize(line, maxWidth);
      ensureSpace(wrapped.length * 4.5 + 1);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 4.5 + 1;
    }
  }

  const filename = `CBS_Manual_${makeSlug(params.question)}.pdf`;
  return { doc, filename };
}

export function downloadAnswerAsPdf(params: ExportAnswerParams) {
  const { doc, filename } = buildAnswerPdfDoc(params);
  doc.save(filename);
}

export function createAnswerPdfFile(params: ExportAnswerParams): { file: File; filename: string } {
  const { doc, filename } = buildAnswerPdfDoc(params);
  const blob = doc.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });
  return { file, filename };
}

export function downloadAnswerAsDoc(params: ExportAnswerParams) {
  const dateStr = new Date(params.timestamp || Date.now()).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const citationsHtml =
    params.citations && params.citations.length > 0
      ? `<div style="margin-top:18px;padding-top:10px;border-top:1px solid #d6d3d1;">
           <h3 style="color:#A00D24;margin:0 0 6px 0;">Indexed PDF Page References</h3>
           <ul style="margin:4px 0 0 18px;">
             ${params.citations
               .slice(0, 8)
               .map(
                 (c) =>
                   `<li>CBS Manual ${escapeHtml(c.partLabel)} – ${escapeHtml(c.chapter)}, Page ${c.pdfPage}</li>`
               )
               .join('')}
           </ul>
         </div>`
      : '';

  const wordHtml = `\uFEFF<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>CBS Manual AI Assistant — Reference Document</title>
  <style>
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1c1917; line-height: 1.55; }
  </style>
</head>
<body>
  <div style="background:#C8102E;color:#ffffff;padding:10px 14px;border-bottom:4px solid #FFCD00;">
    <div style="font-size:14pt;font-weight:bold;">CBS Manual AI Assistant — Department of Posts, India</div>
    <div style="font-size:9pt;margin-top:2px;">Authoritative Reference: POSB CBS Manual 2026 (Part I &amp; Part II) &nbsp;|&nbsp; Generated: ${escapeHtml(dateStr)}</div>
  </div>
  ${
    params.question
      ? `<div style="background:#FAF7F2;border:1px solid #e7e5e4;padding:10px 12px;margin:14px 0;font-weight:bold;">Query: ${escapeHtml(params.question)}</div>`
      : ''
  }
  <div>${markdownToWordHtml(params.answer)}</div>
  ${citationsHtml}
</body>
</html>`;

  const blob = new Blob([wordHtml], { type: 'application/msword;charset=utf-8' });
  const filename = `CBS_Manual_${makeSlug(params.question)}.doc`;
  triggerBlobDownload(blob, filename);
}

export function downloadManualPageAsDoc(params: {
  part: 1 | 2;
  page: number;
  chapter: string;
  printedPage?: string;
  text: string;
  menus?: string[];
  forms?: string[];
}) {
  const partLabel = params.part === 1 ? 'Part I' : 'Part II';
  const wordHtml = `\uFEFF<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>POSB CBS Manual 2026 ${partLabel} — Page ${params.page}</title>
  <style>
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1c1917; line-height: 1.55; }
  </style>
</head>
<body>
  <div style="background:#C8102E;color:#ffffff;padding:10px 14px;border-bottom:4px solid #FFCD00;">
    <div style="font-size:13pt;font-weight:bold;">POSB CBS Manual 2026 – ${partLabel} (Department of Posts, India)</div>
    <div style="font-size:9.5pt;margin-top:2px;">${escapeHtml(params.chapter)} &nbsp;|&nbsp; PDF Page ${params.page}${params.printedPage && params.printedPage !== String(params.page) ? ` (Printed p. ${escapeHtml(params.printedPage)})` : ''}</div>
  </div>
  ${
    (params.menus && params.menus.length > 0) || (params.forms && params.forms.length > 0)
      ? `<div style="background:#FAF7F2;border:1px solid #e7e5e4;padding:8px 12px;margin:12px 0;font-size:10pt;">
          ${params.menus && params.menus.length > 0 ? `<div><strong>Finacle Menus:</strong> ${escapeHtml(params.menus.join(', '))}</div>` : ''}
          ${params.forms && params.forms.length > 0 ? `<div><strong>Forms:</strong> ${escapeHtml(params.forms.join(', '))}</div>` : ''}
         </div>`
      : ''
  }
  <div style="white-space:pre-wrap;margin-top:12px;">${escapeHtml(params.text)}</div>
</body>
</html>`;

  const blob = new Blob([wordHtml], { type: 'application/msword;charset=utf-8' });
  const filename = `POSB_CBS_Manual_2026_Part_${params.part}_Page_${params.page}.doc`;
  triggerBlobDownload(blob, filename);
}

export async function shareAnswerPdfViaWhatsApp(
  params: ExportAnswerParams
): Promise<{ mode: 'native-share' | 'download-and-wa' | 'cancelled'; filename: string }> {
  const { file, filename } = createAnswerPdfFile(params);
  const citationsSummary = (params.citations || [])
    .slice(0, 4)
    .map((c) => `• CBS Manual ${c.partLabel} – ${c.chapter}, Page ${c.pdfPage}`)
    .join('\n');

  const shortText = [
    `*CBS Manual AI Assistant (India Post)*`,
    params.question ? `*Query:* ${params.question}` : '',
    '',
    stripMarkdownForPdf(params.answer).slice(0, 900) +
      (params.answer.length > 900 ? '…' : ''),
    citationsSummary ? `\n*Source References:*\n${citationsSummary}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  // 1. On supported mobile/desktop devices, share the actual PDF file via native Share Sheet (WhatsApp)
  try {
    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };
    if (typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
      await nav.share({
        files: [file],
        title: params.question || 'CBS Manual 2026 Reference',
        text: `POSB CBS Manual 2026 Reference: ${params.question || 'Answer PDF'}`,
      });
      return { mode: 'native-share', filename };
    }
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      return { mode: 'cancelled', filename };
    }
    // Fall through to PDF download + WhatsApp web/app link
  }

  // 2. Fallback: download the PDF immediately AND open WhatsApp with the message ready to attach the PDF
  triggerBlobDownload(file, filename);
  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
    `${shortText}\n\n(PDF file "${filename}" saved to your device — attach it here to send)`
  )}`;
  openExternalLinkSafe(waUrl);
  return { mode: 'download-and-wa', filename };
}

export async function shareManualPdfViaWhatsApp(params: {
  part: 1 | 2;
  page?: number;
  chapter?: string;
}): Promise<{ mode: 'native-share' | 'link-and-wa' | 'cancelled'; filename: string }> {
  const partLabel = params.part === 1 ? 'Part I' : 'Part II';
  const filename = `POSB_CBS_Manual_2026_Part_${params.part}.pdf`;
  const pdfPath = `/manuals/${filename}`;
  const fullUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${pdfPath}${params.page ? `#page=${params.page}` : ''}`
      : pdfPath;

  const message = [
    `*POSB CBS Manual 2026 – ${partLabel}* (Department of Posts, India)`,
    params.chapter ? `*Section:* ${params.chapter}` : '',
    params.page ? `*Page:* ${params.page}` : '',
    `*PDF Link:* ${fullUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  // Attempt native file share on devices that support sharing PDF files (e.g., mobile WhatsApp)
  try {
    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };
    if (typeof nav.share === 'function' && typeof nav.canShare === 'function') {
      // Quick check if PDF file sharing is supported before fetching full manual
      const probe = new File(['%PDF'], filename, { type: 'application/pdf' });
      if (nav.canShare({ files: [probe] })) {
        const res = await fetch(pdfPath);
        if (res.ok) {
          const blob = await res.blob();
          const file = new File([blob], filename, { type: 'application/pdf' });
          await nav.share({
            files: [file],
            title: `POSB CBS Manual 2026 – ${partLabel}`,
            text: message,
          });
          return { mode: 'native-share', filename };
        }
      }
    }
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      return { mode: 'cancelled', filename };
    }
    // Fall through to WhatsApp link
  }

  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  openExternalLinkSafe(waUrl);
  return { mode: 'link-and-wa', filename };
}

export function printAnswerContent(params: {
  question?: string;
  answer: string;
  citations?: CitationRef[];
}) {
  const bodyHtml = markdownToWordHtml(params.answer);
  const citationsHtml = (params.citations || [])
    .map(
      (c) =>
        `<li>CBS Manual ${escapeHtml(c.partLabel)} – ${escapeHtml(c.chapter)}, Page ${c.pdfPage}</li>`
    )
    .join('');

  const html = `<!doctype html>
<html>
<head>
  <title>CBS Manual AI Assistant — Printable Reference</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; color: #1c1917; max-width: 780px; margin: 24px auto; padding: 0 18px; line-height: 1.6; }
    .banner { border-bottom: 3px solid #C8102E; padding-bottom: 10px; margin-bottom: 18px; }
    .banner h1 { margin: 0; font-size: 18px; color: #C8102E; }
    .banner p { margin: 4px 0 0; font-size: 12px; color: #57534e; }
    .question { background: #FAF7F2; border: 1px solid #e7e5e4; padding: 10px 14px; border-radius: 6px; font-weight: 600; margin-bottom: 18px; }
    .refs { margin-top: 22px; padding-top: 12px; border-top: 1px solid #d6d3d1; font-size: 13px; }
  </style>
</head>
<body>
  <div class="banner">
    <h1>CBS Manual AI Assistant — Department of Posts, India</h1>
    <p>Authoritative Reference: POSB CBS Manual 2026 (Part I &amp; Part II)</p>
  </div>
  ${params.question ? `<div class="question">${escapeHtml(params.question)}</div>` : ''}
  <div>${bodyHtml}</div>
  ${citationsHtml ? `<div class="refs"><strong>Source References</strong><ul>${citationsHtml}</ul></div>` : ''}
</body>
</html>`;

  const existing = document.getElementById('cbs-print-iframe');
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'cbs-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.print();
    }
    setTimeout(() => iframe.remove(), 1500);
  }, 150);
}
