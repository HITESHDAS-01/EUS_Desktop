import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/basic';
import { api, photoSrc } from '@/lib/api';
import { calculateMaturityAmount, formatCurrency, safeFormatDate } from '@/lib/utils';
import { useSettings } from '@/lib/SettingsContext';
import type { StatementBundle } from '@/types/db';

interface Props {
  memberId: string;
  onClose: () => void;
}

export default function StatementModal({ memberId, onClose }: Props) {
  const { numeric, brand } = useSettings();
  const [bundle, setBundle] = useState<StatementBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!memberId) return;
    setLoading(true);
    api
      .getStatementBundle(memberId)
      .then(setBundle)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [memberId]);

  const handleDownload = async () => {
    const element = document.getElementById('printable-statement');
    if (!element) return;
    setPrinting(true);
    try {
      const { default: html2pdf } = await import('html2pdf.js');
      await html2pdf()
        .set({
          margin: 0.5,
          filename: `Statement_${bundle?.member.member_code || 'Member'}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
        })
        .from(element)
        .save();
    } finally {
      setPrinting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg">Loading statement…</div>
      </div>
    );
  }
  if (!bundle) return null;

  const { member, savings, loans, repayments } = bundle;
  const totalInst = savings.reduce((s, x) => s + x.amount, 0);
  const totalPenalty = savings.reduce((s, x) => s + x.penalty, 0);
  const activeLoanBalance = loans
    .filter((l) => l.status === 'active')
    .reduce((s, l) => s + l.remaining_principal, 0);

  // Match eus rules
  let totalSavings = 0;
  if (member.category === 'A') totalSavings = (member.initial_investment ?? 0) + totalInst;
  else if (member.category === 'B') totalSavings = member.initial_investment ?? 0;
  else if (member.category === 'C') totalSavings = totalInst;

  let roi = 0;
  if (member.category === 'B') roi = Number(numeric['roi_category_b'] ?? 36) || 36;
  else if (member.category === 'C' && member.chosen_term_months === 24) roi = Number(numeric['roi_category_c_24'] ?? 16) || 16;
  else if (member.category === 'C' && member.chosen_term_months === 36) roi = Number(numeric['roi_category_c_36'] ?? 27) || 27;

  const maturity = calculateMaturityAmount(
    member.category,
    member.initial_investment ?? 0,
    totalSavings,
    roi,
    member.status,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl my-8 overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-[#0b3b2f] text-white sticky top-0 z-10">
          <h3 className="font-bold text-lg">Account Statement</h3>
          <div className="flex items-center gap-3">
            <Button onClick={handleDownload} disabled={printing} className="gap-2">
              <i className="fas fa-download"></i> {printing ? 'Preparing…' : 'Download PDF'}
            </Button>
            <button onClick={onClose} className="text-white/70 hover:text-white">
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>

        <div id="printable-statement" className="p-8 bg-white text-gray-800">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-[#0b3b2f] pb-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-[#0b3b2f]">{brand.orgName}</h1>
              <p className="text-base text-gray-700">{brand.orgNameNative}</p>
              <p className="text-xs text-gray-500 mt-1">{brand.tagline}</p>
            </div>
            <div className="text-right text-xs text-gray-600">
              <p className="font-bold text-lg text-[#0b3b2f]">ACCOUNT STATEMENT</p>
              <p>Generated: {format(new Date(), 'dd MMM yyyy, hh:mm a')}</p>
            </div>
          </div>

          {/* Member info */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="flex gap-4">
              <div className="w-20 h-20 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center text-gray-400 border">
                {member.profiles?.photo_url ? (
                  <img src={photoSrc(member.profiles.photo_url)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <i className="fas fa-user text-2xl"></i>
                )}
              </div>
              <div className="text-sm">
                <p className="font-bold text-lg text-gray-900">{member.profiles?.full_name}</p>
                <p className="font-mono text-[#1e5a48]">{member.member_code}</p>
                <p className="text-gray-600 mt-1">Phone: {member.profiles?.phone || 'N/A'}</p>
                <p className="text-gray-600">Cat {member.category} • Joined {safeFormatDate(member.join_date)}</p>
              </div>
            </div>
            <div className="text-sm space-y-1">
              <p><span className="text-gray-500">Address:</span> {member.profiles?.address || 'N/A'}</p>
              <p><span className="text-gray-500">Nominee:</span> {member.profiles?.nominee_name || 'N/A'}</p>
              <p><span className="text-gray-500">Status:</span> <strong className="uppercase">{member.status}</strong></p>
              <p><span className="text-gray-500">Term:</span> {member.chosen_term_months ? `${member.chosen_term_months} months` : 'N/A'}</p>
            </div>
          </div>

          {/* Summary card */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <SummaryCard label="Total Deposits" value={formatCurrency(totalSavings)} accent="text-green-700" />
            <SummaryCard label="Penalty Paid" value={formatCurrency(totalPenalty)} accent="text-red-600" />
            <SummaryCard label="Active Loan" value={formatCurrency(activeLoanBalance)} accent="text-orange-600" />
            <SummaryCard label={`Maturity @ ${roi}%`} value={formatCurrency(maturity)} accent="text-[#0b3b2f]" />
          </div>

          {/* Savings table */}
          <div className="mb-6">
            <h3 className="font-bold text-gray-800 mb-2">Savings History</h3>
            {savings.length === 0 ? (
              <p className="text-sm text-gray-500 italic border border-dashed border-gray-200 rounded p-3 text-center">No savings yet.</p>
            ) : (
              <table className="w-full text-left text-sm border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 border-b">Date</th>
                    <th className="p-2 border-b">Receipt</th>
                    <th className="p-2 border-b text-right">Amount</th>
                    <th className="p-2 border-b text-right">Penalty</th>
                  </tr>
                </thead>
                <tbody>
                  {savings.map((s) => (
                    <tr key={s.id} className="border-b">
                      <td className="p-2">{safeFormatDate(s.payment_date)}</td>
                      <td className="p-2 font-mono text-xs">{s.receipt_number}</td>
                      <td className="p-2 text-right">{formatCurrency(s.amount)}</td>
                      <td className="p-2 text-right">{s.penalty > 0 ? formatCurrency(s.penalty) : '-'}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold">
                    <td className="p-2" colSpan={2}>Total</td>
                    <td className="p-2 text-right">{formatCurrency(totalInst)}</td>
                    <td className="p-2 text-right">{formatCurrency(totalPenalty)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* Loans */}
          <div>
            <h3 className="font-bold text-gray-800 mb-2">Loan Ledger</h3>
            {loans.length === 0 ? (
              <p className="text-sm text-gray-500 italic border border-dashed border-gray-200 rounded p-3 text-center">No loans on record.</p>
            ) : (
              loans.map((loan) => {
                const reps = repayments.filter((r) => r.loan_id === loan.id);
                return (
                  <div key={loan.id} className="border border-gray-200 rounded mb-3 overflow-hidden">
                    <div className="bg-orange-50 p-3 border-b text-sm flex justify-between">
                      <div>
                        <p className="font-bold">Disbursed: {formatCurrency(loan.principal_amount)} on {safeFormatDate(loan.disbursed_date)}</p>
                        <p className="text-xs text-gray-600">Rate: {loan.interest_rate}% / mo · Status: {loan.status}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Remaining</p>
                        <p className="font-bold text-orange-600">{formatCurrency(loan.remaining_principal)}</p>
                      </div>
                    </div>
                    {reps.length === 0 ? (
                      <p className="text-xs text-gray-500 italic p-2">No repayments yet.</p>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="p-2 border-b">Date</th>
                            <th className="p-2 border-b">Receipt</th>
                            <th className="p-2 border-b text-right">Principal</th>
                            <th className="p-2 border-b text-right">Interest</th>
                            <th className="p-2 border-b text-right">Total Paid</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reps.map((r) => (
                            <tr key={r.id} className="border-b">
                              <td className="p-2">{safeFormatDate(r.payment_date)}</td>
                              <td className="p-2 font-mono text-xs">{r.receipt_number}</td>
                              <td className="p-2 text-right">{formatCurrency(r.principal_portion)}</td>
                              <td className="p-2 text-right">{formatCurrency(r.interest_portion)}</td>
                              <td className="p-2 text-right font-bold">{formatCurrency(r.amount_paid)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-8 pt-4 border-t-2 border-[#0b3b2f] text-xs text-gray-500 text-center">
            <p>This is a computer-generated statement. For queries, contact the administrator.</p>
            <p className="mt-1 font-medium text-[#0b3b2f]">{brand.orgName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="border border-gray-200 rounded p-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`font-bold text-lg ${accent}`}>{value}</p>
    </div>
  );
}
