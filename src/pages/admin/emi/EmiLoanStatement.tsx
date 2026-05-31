import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/basic';
import { formatCurrency, safeFormatDate } from '@/lib/utils';
import { useSettings } from '@/lib/SettingsContext';
import type { EmiLoanBundle } from '@/types/db';

interface Props {
  bundle: EmiLoanBundle;
  onClose: () => void;
}

export default function EmiLoanStatement({ bundle, onClose }: Props) {
  const { brand } = useSettings();
  const [printing, setPrinting] = useState(false);
  const { loan, customer, vendor, payments } = bundle;

  const totalPaid = payments.reduce((s, p) => s + p.amount_paid, 0);
  const principalPaid = payments.reduce((s, p) => s + p.principal_portion, 0);
  const interestPaid = payments.reduce((s, p) => s + p.interest_portion, 0);
  const penaltyPaid = payments.reduce((s, p) => s + p.penalty_portion, 0);

  const handleDownload = async () => {
    const el = document.getElementById('emi-statement');
    if (!el) return;
    setPrinting(true);
    try {
      const { default: html2pdf } = await import('html2pdf.js');
      await html2pdf()
        .set({
          margin: 0.5,
          filename: `EMI_Statement_${loan.loan_code || loan.id}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
        })
        .from(el)
        .save();
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl my-8 overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-[#0b3b2f] text-white sticky top-0 z-10">
          <h3 className="font-bold text-lg">EMI Loan Statement</h3>
          <div className="flex items-center gap-3">
            <Button onClick={handleDownload} disabled={printing} className="gap-2">
              <i className="fas fa-download"></i> {printing ? 'Preparing…' : 'Download PDF'}
            </Button>
            <button onClick={onClose} className="text-white/70 hover:text-white">
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>

        <div id="emi-statement" className="p-8 bg-white text-gray-800">
          <div className="flex items-start justify-between border-b-2 border-[#0b3b2f] pb-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-[#0b3b2f]">{brand.orgName}</h1>
              <p className="text-base text-gray-700">{brand.orgNameNative}</p>
              <p className="text-xs text-gray-500 mt-1">Product EMI · {brand.tagline}</p>
            </div>
            <div className="text-right text-xs text-gray-600">
              <p className="font-bold text-lg text-[#0b3b2f]">EMI STATEMENT</p>
              <p>{loan.loan_code}</p>
              <p>Generated: {format(new Date(), 'dd MMM yyyy, hh:mm a')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="text-sm">
              <p className="text-gray-500 text-xs uppercase tracking-wider">Customer</p>
              <p className="font-bold text-lg">{customer.full_name}</p>
              <p className="font-mono text-[#1e5a48]">{customer.customer_code}</p>
              <p className="text-gray-600 mt-1">{customer.phone || ''}</p>
              <p className="text-gray-600">{customer.address || ''}</p>
            </div>
            <div className="text-sm">
              <p className="text-gray-500 text-xs uppercase tracking-wider">Product / Vendor</p>
              <p className="font-bold text-lg">{loan.product_name}</p>
              <p className="text-gray-600">{loan.product_category || ''}</p>
              <p className="text-gray-600 mt-1">Vendor: {vendor.name}</p>
              <p className="text-gray-600">Invoice: {loan.vendor_invoice_number || '—'}</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-6">
            <Card label="Product Price" value={formatCurrency(loan.product_price)} />
            <Card label="Financed" value={formatCurrency(loan.financed_amount)} />
            <Card label="EMI" value={formatCurrency(loan.emi_amount)} accent />
            <Card label="Outstanding" value={formatCurrency(loan.remaining_principal)} />
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
            <div className="border border-gray-200 rounded p-3 space-y-1">
              <Row label="Disbursed Date" value={safeFormatDate(loan.disbursed_date)} />
              <Row label="First EMI Date" value={safeFormatDate(loan.first_emi_date)} />
              <Row label="Tenure" value={`${loan.tenure_months} months`} />
              <Row label="Interest Rate" value={`${loan.interest_rate}% p.a. (flat)`} />
              <Row label="Total Interest" value={formatCurrency(loan.total_interest)} />
              <Row label="Total Payable" value={formatCurrency(loan.total_payable)} />
            </div>
            <div className="border border-gray-200 rounded p-3 space-y-1">
              <Row label="Total Paid" value={formatCurrency(totalPaid)} />
              <Row label="Principal Paid" value={formatCurrency(principalPaid)} />
              <Row label="Interest Paid" value={formatCurrency(interestPaid)} />
              <Row label="Penalty Paid" value={formatCurrency(penaltyPaid)} />
              <Row label="Status" value={loan.status.toUpperCase()} />
              <Row label="Remaining" value={formatCurrency(loan.remaining_principal)} />
            </div>
          </div>

          <div>
            <h3 className="font-bold text-gray-800 mb-2">Payment History</h3>
            {payments.length === 0 ? (
              <p className="text-sm text-gray-500 italic border border-dashed border-gray-200 rounded p-3 text-center">No payments recorded.</p>
            ) : (
              <table className="w-full text-left text-sm border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 border-b">Date</th>
                    <th className="p-2 border-b">Receipt</th>
                    <th className="p-2 border-b">Due</th>
                    <th className="p-2 border-b text-right">Principal</th>
                    <th className="p-2 border-b text-right">Interest</th>
                    <th className="p-2 border-b text-right">Penalty</th>
                    <th className="p-2 border-b text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b">
                      <td className="p-2">{safeFormatDate(p.payment_date)}</td>
                      <td className="p-2 font-mono text-xs">{p.receipt_number}</td>
                      <td className="p-2">{safeFormatDate(p.due_date)}</td>
                      <td className="p-2 text-right">{formatCurrency(p.principal_portion)}</td>
                      <td className="p-2 text-right">{formatCurrency(p.interest_portion)}</td>
                      <td className="p-2 text-right">{p.penalty_portion > 0 ? formatCurrency(p.penalty_portion) : '-'}</td>
                      <td className="p-2 text-right font-bold">{formatCurrency(p.amount_paid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-8 pt-4 border-t-2 border-[#0b3b2f] text-xs text-gray-500 text-center">
            <p>This is a computer-generated statement.</p>
            <p className="mt-1 font-medium text-[#0b3b2f]">{brand.orgName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border border-gray-200 rounded p-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`font-bold text-lg ${accent ? 'text-[#0b3b2f]' : 'text-gray-800'}`}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}
