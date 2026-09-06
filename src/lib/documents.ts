import type { Payment, RentInvoice } from '@/lib/supabase';

function downloadBlob(filename: string, content: BlobPart, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function createPdf(title: string, lines: string[], filename: string) {
  const safeLines = lines.map((line) => escapePdfText(String(line).slice(0, 95)));
  const commands = [
    'q',
    '0.96 0.97 0.99 rg 0 0 226 320 re f',
    'Q',
    'BT /F1 14 Tf 22 292 Td',
    `(${escapePdfText(title)}) Tj`,
    '/F1 8 Tf',
    '0 -14 Td (HIGH PARK CONSULT LTD) Tj',
    '0 -11 Td (Property Management & Real Estate) Tj',
    '0 -14 Td 180 0 Td',
    'ET',
    'BT /F1 9 Tf 18 242 Td',
    ...safeLines.map((line, i) => `${i === 0 ? '' : '0 -16 Td '}(${line}) Tj`),
    'ET',
    '0.15 0.23 0.36 RG 18 70 m 208 70 l S',
    'BT /F1 8 Tf 18 55 Td (Thank you for your payment.) Tj 0 -12 Td (Keep this receipt for your records.) Tj ET',
    'BT /F1 7 Tf 18 22 Td (Generated electronically by HighPark Consult PMS) Tj ET',
  ].join(' ');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 226 320] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  downloadBlob(filename, pdf, 'application/pdf');
}

export function getInvoiceNumber(invoice: Pick<RentInvoice, 'id' | 'period'>) {
  return `INV-${invoice.period.replace(/[^0-9]/g, '')}-${invoice.id.slice(0, 8).toUpperCase()}`;
}

export function getReceiptNumber(payment: Pick<Payment, 'id' | 'created_at' | 'transaction_ref' | 'receipt_number'>) {
  if (payment.receipt_number) return payment.receipt_number;
  if (payment.transaction_ref) return `RCP-${payment.transaction_ref.replace(/[^A-Za-z0-9]/g, '').slice(-10).toUpperCase()}`;
  const day = new Date(payment.created_at).toISOString().slice(0, 10).replace(/-/g, '');
  return `RCP-${day}-${payment.id.slice(0, 8).toUpperCase()}`;
}

export function downloadInvoicePdf({
  invoice,
  propertyName,
  unitNumber,
  tenantName,
}: {
  invoice: RentInvoice;
  propertyName: string;
  unitNumber: string | null;
  tenantName: string;
}) {
  const number = getInvoiceNumber(invoice);
  createPdf('HIGHPARK CONSULT LTD — RENT INVOICE', [
    `Invoice: ${number}`,
    `Tenant: ${tenantName}`,
    `Property: ${propertyName}`,
    `Unit: ${unitNumber || '—'}`,
    `Period: ${invoice.period}`,
    `Due date: ${invoice.due_date}`,
    `Invoice amount: KSh ${Number(invoice.amount || 0).toLocaleString('en-KE')}`,
    `Balance: KSh ${Number(invoice.balance || 0).toLocaleString('en-KE')}`,
    `Status: ${invoice.status.replace('_', ' ')}`,
    'Thank you for choosing HighPark Consult Ltd.',
  ], `${number.toLowerCase()}.pdf`);
}

export function downloadPaymentReceiptPdf({
  payment,
  propertyName,
  unitNumber,
  tenantName,
}: {
  payment: Payment;
  propertyName: string;
  unitNumber: string | null;
  tenantName: string;
}) {
  const number = getReceiptNumber(payment);
  createPdf('PAYMENT RECEIPT', [
    `Receipt No: ${number}`,
    `Date: ${new Date(payment.created_at).toLocaleString('en-KE')}`,
    `Received from: ${tenantName}`,
    `Property: ${propertyName}`,
    `Unit: ${unitNumber || 'N/A'}`,
    `Payment type: ${payment.payment_type.replace('_', ' ')}`,
    `Method: ${payment.payment_method.replace('_', ' ')}`,
    `Transaction: ${payment.transaction_ref || payment.provider_reference || 'N/A'}`,
    `AMOUNT RECEIVED: KSh ${Number(payment.amount || 0).toLocaleString('en-KE')}`,
    'STATUS: VERIFIED / RECEIVED',
  ], `${number.toLowerCase()}.pdf`);
}

export { downloadBlob };
