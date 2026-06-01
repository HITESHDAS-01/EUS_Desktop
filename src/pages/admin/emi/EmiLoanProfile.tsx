import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { addMonths, format, startOfMonth } from 'date-fns';
import { Button, Input, Label } from '@/components/ui/basic';
import { api } from '@/lib/api';
import { formatCurrency, safeFormatDate } from '@/lib/utils';
import EmiLoanStatement from './EmiLoanStatement';
import type { EmiLoanBundle, EmiLoanStatus } from '@/types/db';

export default function EmiLoanProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bundle, setBundle] = useState<EmiLoanBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statementOpen, setStatementOpen] = useState(false);

  // record payment form
  const [showPayment, setShowPayment] = useState(false);
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // status edit
  const [newStatus, setNewStatus] = useState<EmiLoanStatus>('active');
  const [statusNotes, setStatusNotes] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const b = await api.getEmiLoanBundle(id);
      setBundle(b);
      setNewStatus(b.loan.status);
      setStatusNotes(b.loan.notes || '');
      // default payment due date = next unpaid EMI
      const next = nextUnpaidDueDate(b);
      if (next) setPaymentDueDate(format(next, 'yyyy-MM-dd'));
      if (b.loan.emi_amount) setPaymentAmount(String(b.loan.emi_amount));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading…</div>;
  if (error || !bundle) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 mb-4">{error || 'Loan not found.'}</p>
        <Button onClick={() => navigate('/admin/emi')}>Back to EMI</Button>
      </div>
    );
  }

  const { loan, customer, vendor, payments } = bundle;
  const totalPaid = payments.reduce((s, p) => s + p.amount_paid, 0);
  const principalPaid = payments.reduce((s, p) => s + p.principal_portion, 0);
  const interestPaid = payments.reduce((s, p) => s + p.interest_portion, 0);
  const penaltyPaid = payments.reduce((s, p) => s + p.penalty_portion, 0);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentLoading(true); setPaymentError('');
    try {
      const amt = Number(paymentAmount);
      if (amt <= 0) throw new Error('Amount must be greater than 0');

      // Flat-interest schedule: each EMI = interestPerEmi + principalPerEmi.
      // For a payment of `amt`, figure out how many full EMIs that covers
      // (rounded to the nearest fraction) and split interest proportionally.
      // This way a 2-EMI prepayment records 2x interest_portion, not 1x.
      const interestPerEmi = loan.total_interest / loan.tenure_months;
      const principalPerEmi = loan.financed_amount / loan.tenure_months;
      const emiSize = interestPerEmi + principalPerEmi; // ≈ loan.emi_amount
      const emisCovered = emiSize > 0 ? amt / emiSize : 0;
      let interestPortion = r2(interestPerEmi * emisCovered);
      let principalPortion = r2(amt - interestPortion);
      // Clamp principal so we never overpay outstanding (push leftover to interest).
      if (principalPortion > loan.remaining_principal) {
        const overflow = principalPortion - loan.remaining_principal;
        principalPortion = loan.remaining_principal;
        interestPortion = r2(interestPortion + overflow);
      }
      const dueDate = paymentDueDate || format(new Date(paymentDate), 'yyyy-MM-dd');
      const monthYear = format(startOfMonth(new Date(dueDate)), 'yyyy-MM-dd');

      await api.recordEmiPayment({
        loan_id: loan.id,
        amount_paid: amt,
        principal_portion: principalPortion,
        interest_portion: interestPortion,
        penalty_portion: 0,
        payment_date: paymentDate,
        due_date: dueDate,
        month_year: monthYear,
        payment_method: paymentMethod || null,
        notes: paymentNotes.trim() || null,
      });
      setShowPayment(false);
      setPaymentAmount(String(loan.emi_amount));
      setPaymentNotes('');
      await load();
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : String(err));
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleSaveStatus = async () => {
    setStatusSaving(true);
    try {
      await api.updateEmiLoan(loan.id, { status: newStatus, notes: statusNotes.trim() || null });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStatusSaving(false);
    }
  };

  // EMI schedule
  const schedule: { idx: number; due: Date; matched: boolean; payment?: typeof payments[number] }[] = [];
  const first = new Date(loan.first_emi_date);
  for (let i = 0; i < loan.tenure_months; i++) {
    const due = addMonths(first, i);
    const key = format(due, 'yyyy-MM');
    const match = payments.find((p) => format(new Date(p.due_date), 'yyyy-MM') === key);
    schedule.push({ idx: i + 1, due, matched: !!match, payment: match });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin/emi')} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-500 hover:text-[#1e5a48]">
            <i className="fas fa-arrow-left"></i>
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{loan.product_name}</h2>
            <p className="text-sm text-gray-500">
              {loan.loan_code} • {customer.full_name} • Vendor: {vendor.name}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStatementOpen(true)} className="gap-2">
            <i className="fas fa-print"></i> Statement
          </Button>
          <Button onClick={() => setShowPayment(true)} className="gap-2" disabled={loan.status !== 'active'}>
            <i className="fas fa-plus"></i> Record Payment
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Financed" value={formatCurrency(loan.financed_amount)} />
        <Stat label="EMI (×{tenure})" value={formatCurrency(loan.emi_amount)} sub={`${loan.tenure_months} months`} />
        <Stat label="Total Paid" value={formatCurrency(totalPaid)} accent="text-green-700" />
        <Stat label="Outstanding" value={formatCurrency(loan.remaining_principal)} accent="text-orange-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h3 className="font-bold text-gray-800 border-b pb-2">Loan Details</h3>
          <KV label="Loan Code" value={loan.loan_code} />
          <KV label="Product Category" value={loan.product_category} />
          <KV label="Product Price" value={formatCurrency(loan.product_price)} />
          <KV label="Downpayment" value={formatCurrency(loan.downpayment)} />
          <KV label="Interest Rate" value={`${loan.interest_rate}% p.a. (flat)`} />
          <KV label="Total Interest" value={formatCurrency(loan.total_interest)} />
          <KV label="Total Payable" value={formatCurrency(loan.total_payable)} />
          <KV label="Disbursed Date" value={safeFormatDate(loan.disbursed_date)} />
          <KV label="First EMI Date" value={safeFormatDate(loan.first_emi_date)} />
          <KV label="Vendor Paid" value={`${formatCurrency(loan.vendor_paid_amount)} on ${safeFormatDate(loan.vendor_paid_date)}`} />
          <KV label="Vendor Invoice" value={loan.vendor_invoice_number} />

          <div className="border-t pt-4 space-y-3">
            <Label>Status</Label>
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as EmiLoanStatus)} className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
              <option value="active">Active</option>
              <option value="closed">Closed</option>
              <option value="foreclosed">Foreclosed</option>
              <option value="defaulted">Defaulted</option>
            </select>
            <Label>Notes</Label>
            <textarea value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} rows={2} className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm resize-none" />
            <Button onClick={handleSaveStatus} disabled={statusSaving} variant="outline" className="w-full">
              {statusSaving ? 'Saving…' : 'Update Status'}
            </Button>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <i className="fas fa-calendar-alt text-[#1e5a48]"></i> EMI Schedule
              </h3>
              <p className="text-xs text-gray-500">
                Paid {payments.length} / {loan.tenure_months} · Principal {formatCurrency(principalPaid)} · Interest {formatCurrency(interestPaid)}
                {penaltyPaid > 0 ? ` · Penalty ${formatCurrency(penaltyPaid)}` : ''}
              </p>
            </div>
            <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="p-3 font-medium text-gray-600 w-12">#</th>
                    <th className="p-3 font-medium text-gray-600">Due Date</th>
                    <th className="p-3 font-medium text-gray-600">Status</th>
                    <th className="p-3 font-medium text-gray-600">Paid On</th>
                    <th className="p-3 font-medium text-gray-600 text-right">Amount</th>
                    <th className="p-3 font-medium text-gray-600">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {schedule.map(({ idx, due, matched, payment }) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="p-3 font-mono text-xs">{idx}</td>
                      <td className="p-3">{format(due, 'dd MMM yyyy')}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${matched ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {matched ? 'Paid' : 'Pending'}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600">{payment ? safeFormatDate(payment.payment_date) : '-'}</td>
                      <td className="p-3 text-right font-medium">{payment ? formatCurrency(payment.amount_paid) : '-'}</td>
                      <td className="p-3 font-mono text-xs text-gray-500">{payment?.receipt_number || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b flex justify-between items-center bg-[#0b3b2f] text-white">
              <h3 className="font-bold text-lg">Record EMI Payment</h3>
              <button onClick={() => setShowPayment(false)} className="text-white/70 hover:text-white">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <div className="p-6">
              {paymentError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{paymentError}</div>}
              <form onSubmit={handleRecordPayment} className="space-y-4">
                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Due Date (which EMI)</Label>
                  <Input type="date" value={paymentDueDate} onChange={(e) => setPaymentDueDate(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Amount Paid (₹)</Label>
                  <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} required min="1" step="0.01" />
                  <p className="text-xs text-gray-500">Default: 1 EMI ({formatCurrency(loan.emi_amount)})</p>
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                    <option>Cash</option>
                    <option>UPI</option>
                    <option>Bank Transfer</option>
                    <option>Cheque</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={paymentLoading}>
                  {paymentLoading ? 'Saving…' : 'Record Payment'}
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}

      {statementOpen && <EmiLoanStatement bundle={bundle} onClose={() => setStatementOpen(false)} />}
    </div>
  );
}

function r2(v: number) { return Math.round(v * 100) / 100; }

function nextUnpaidDueDate(b: EmiLoanBundle): Date | null {
  const first = new Date(b.loan.first_emi_date);
  for (let i = 0; i < b.loan.tenure_months; i++) {
    const due = addMonths(first, i);
    const key = format(due, 'yyyy-MM');
    if (!b.payments.some((p) => format(new Date(p.due_date), 'yyyy-MM') === key)) {
      return due;
    }
  }
  return null;
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`text-xl font-bold ${accent || 'text-gray-800'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function KV({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800 text-right">{value || 'N/A'}</span>
    </div>
  );
}
