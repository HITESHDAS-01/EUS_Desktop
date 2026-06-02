import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Button, Input, Label } from '@/components/ui/basic';
import { api, photoSrc } from '@/lib/api';
import { formatCurrency, safeFormatDate } from '@/lib/utils';
import { useSettings } from '@/lib/SettingsContext';
import type { LoanRow, MemberRow, SavingsRow } from '@/types/db';

type EnrichedMember = MemberRow & {
  totalSavings: number;
  outstandingLoan: number;
  maxLoan: number;
};

export default function Loans() {
  const { numeric: settings, version: settingsVersion } = useSettings();
  const eligibilityPct = (Number(settings['loan_eligibility_percent'] ?? 80) || 80) / 100;

  const [activeTab, setActiveTab] = useState<'disburse' | 'repay'>('disburse');
  const [members, setMembers] = useState<EnrichedMember[]>([]);
  const [activeLoans, setActiveLoans] = useState<LoanRow[]>([]);
  const [loading, setLoading] = useState(true);

  // disburse form
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [disburseAmount, setDisburseAmount] = useState('');
  const [interestRate, setInterestRate] = useState('2');
  const [disburseDate, setDisburseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [eligibility, setEligibility] = useState(0);

  // repay form
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [repayPrincipal, setRepayPrincipal] = useState('');
  const [repayInterest, setRepayInterest] = useState('');
  const [repayDate, setRepayDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // settingsVersion: re-fetch members + recompute maxLoan when admin changes
  // loan_eligibility_percent — the cap is computed from this setting.
  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsVersion]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [loans, allMembers] = await Promise.all([
        api.listActiveLoans(),
        api.listMembers(),
      ]);
      setActiveLoans(loans);

      // sum outstanding loan per member
      const outstandingByMember = new Map<string, number>();
      for (const l of loans) {
        outstandingByMember.set(
          l.member_id,
          (outstandingByMember.get(l.member_id) ?? 0) + Number(l.remaining_principal),
        );
      }

      // need each active member's total savings for eligibility calc
      const activeMembers = allMembers.filter((m) => m.status === 'active');
      const enriched: EnrichedMember[] = await Promise.all(
        activeMembers.map(async (m) => {
          let savings: SavingsRow[] = [];
          if (m.category === 'A' || m.category === 'C') {
            savings = await api.listMemberSavings(m.id);
          }
          const totalInst = savings.reduce((s, x) => s + Number(x.amount), 0);
          let total = 0;
          if (m.category === 'A') total = Number(m.initial_investment ?? 0) + totalInst;
          else if (m.category === 'B') total = Number(m.initial_investment ?? 0);
          else if (m.category === 'C') total = totalInst;

          const outstanding = outstandingByMember.get(m.id) ?? 0;
          const net = Math.max(0, total - outstanding);
          return {
            ...m,
            totalSavings: total,
            outstandingLoan: outstanding,
            maxLoan: net * eligibilityPct,
          };
        }),
      );
      setMembers(enriched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMemberSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedMemberId(id);
    const m = members.find((x) => x.id === id);
    if (m) {
      setEligibility(m.maxLoan);
      setInterestRate(String(m.loan_interest_rate ?? 2));
    } else {
      setEligibility(0);
      setInterestRate('2');
    }
  };

  useEffect(() => {
    if (selectedLoanId) {
      const loan = activeLoans.find((l) => l.id === selectedLoanId);
      if (loan) {
        const interestDue = (Number(loan.remaining_principal) * Number(loan.interest_rate)) / 100;
        setRepayInterest(String(interestDue));
      }
    } else {
      setRepayInterest('');
      setRepayPrincipal('');
    }
  }, [selectedLoanId, activeLoans]);

  const handleDisburse = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true); setError(''); setSuccessMsg('');
    try {
      const m = members.find((x) => x.id === selectedMemberId);
      if (!m) throw new Error('Select a member');
      const amt = Number(disburseAmount);
      if (amt <= 0) throw new Error('Loan amount must be greater than 0');
      if (amt > eligibility) {
        throw new Error(`Amount exceeds ${Math.round(eligibilityPct * 100)}% eligibility limit (max ${formatCurrency(eligibility)}).`);
      }
      await api.disburseLoan({
        member_id: selectedMemberId,
        principal_amount: amt,
        interest_rate: Number(interestRate),
        disbursed_date: disburseDate,
      });
      setSuccessMsg('Loan disbursed successfully!');
      setSelectedMemberId(''); setDisburseAmount('');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true); setError(''); setSuccessMsg('');
    try {
      const loan = activeLoans.find((l) => l.id === selectedLoanId);
      if (!loan) throw new Error('Select a loan');
      const principal = Number(repayPrincipal);
      const interest = Number(repayInterest);
      if (principal < 0 || interest < 0) throw new Error('Amounts cannot be negative');
      if (principal + interest <= 0) throw new Error('Total payment must be greater than 0');
      if (principal > Number(loan.remaining_principal)) {
        throw new Error(`Principal repayment exceeds outstanding balance (${formatCurrency(loan.remaining_principal)}).`);
      }
      await api.recordLoanRepayment({
        loan_id: selectedLoanId,
        principal_portion: principal,
        interest_portion: interest,
        payment_date: repayDate,
      });
      setSuccessMsg(`Repayment recorded. Principal reduced by ${formatCurrency(principal)}.`);
      setSelectedLoanId(''); setRepayPrincipal(''); setRepayInterest('');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Loan Management</h2>

      <div className="flex border-b border-gray-200">
        {(['disburse', 'repay'] as const).map((tab) => (
          <button
            key={tab}
            className={`px-6 py-3 font-medium text-sm ${activeTab === tab ? 'border-b-2 border-[#1e5a48] text-[#1e5a48]' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => { setActiveTab(tab); setError(''); setSuccessMsg(''); }}
          >
            {tab === 'disburse' ? 'Disburse New Loan' : 'Record Repayment'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-2xl">
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{error}</div>}
        {successMsg && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm border border-green-100">{successMsg}</div>}

        {activeTab === 'disburse' ? (
          <form onSubmit={handleDisburse} className="space-y-4">
            <div className="space-y-2">
              <Label>Select Member</Label>
              <select
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                value={selectedMemberId} onChange={handleMemberSelect} required
              >
                <option value="">-- Select Member --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.member_code} - {m.profiles?.full_name}
                  </option>
                ))}
              </select>
            </div>

            {selectedMemberId && (() => {
              const sel = members.find((m) => m.id === selectedMemberId);
              const totalSav = sel?.totalSavings ?? 0;
              const outstanding = sel?.outstandingLoan ?? 0;
              return (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-blue-800">Total savings (collateral):</span>
                    <span className="text-blue-900 font-medium">{formatCurrency(totalSav)}</span>
                  </div>
                  {outstanding > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-blue-800">Less: existing loan balance:</span>
                      <span className="text-red-700 font-medium">− {formatCurrency(outstanding)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                    <span className="text-sm text-blue-800 font-medium">Max new loan ({Math.round(eligibilityPct * 100)}% of net):</span>
                    <span className="text-lg font-bold text-blue-900">{formatCurrency(eligibility)}</span>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Disbursement Date</Label>
                <Input type="date" value={disburseDate} onChange={(e) => setDisburseDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Interest Rate (% per month)</Label>
                <Input type="number" step="0.1" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} required min="0" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Loan Amount (₹)</Label>
              <Input type="number" value={disburseAmount} onChange={(e) => setDisburseAmount(e.target.value)} required min="1" max={eligibility || undefined} />
            </div>

            <Button type="submit" className="w-full" disabled={formLoading || !selectedMemberId}>
              {formLoading ? 'Processing…' : 'Disburse Loan'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleRepay} className="space-y-4">
            <div className="space-y-2">
              <Label>Select Active Loan</Label>
              <select
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                value={selectedLoanId} onChange={(e) => setSelectedLoanId(e.target.value)} required
              >
                <option value="">-- Select Loan --</option>
                {activeLoans.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.member_code} - {l.member_full_name} (Bal: {formatCurrency(l.remaining_principal)})
                  </option>
                ))}
              </select>
            </div>

            {selectedLoanId && (() => {
              const l = activeLoans.find((x) => x.id === selectedLoanId);
              if (!l) return null;
              return (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-800 font-medium">Outstanding Principal:</span>
                    <span className="text-lg font-bold text-blue-900">{formatCurrency(l.remaining_principal)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-800 font-medium">Estimated Interest (1 mo):</span>
                    <span className="text-lg font-bold text-blue-900">
                      {formatCurrency((l.remaining_principal * l.interest_rate) / 100)}
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input type="date" value={repayDate} onChange={(e) => setRepayDate(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Principal Amount (₹)</Label>
                <Input type="number" value={repayPrincipal} onChange={(e) => setRepayPrincipal(e.target.value)} required min="0" />
              </div>
              <div className="space-y-2">
                <Label>Interest Amount (₹)</Label>
                <Input type="number" value={repayInterest} onChange={(e) => setRepayInterest(e.target.value)} required min="0" />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={formLoading || !selectedLoanId}>
              {formLoading ? 'Processing…' : 'Record Repayment'}
            </Button>
          </form>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-8">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">Active Loans Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Member</th>
                <th className="p-4 font-medium">Disbursed Date</th>
                <th className="p-4 font-medium text-right">Original Amount</th>
                <th className="p-4 font-medium text-right">Interest Rate</th>
                <th className="p-4 font-medium text-right">Outstanding Principal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">Loading…</td></tr>
              ) : activeLoans.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">No active loans.</td></tr>
              ) : (
                activeLoans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#1e5a48]/10 flex items-center justify-center text-[#1e5a48] overflow-hidden border border-[#1e5a48]/10 shrink-0">
                          {loan.member_photo_url ? (
                            <img src={photoSrc(loan.member_photo_url)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <i className="fas fa-user"></i>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{loan.member_full_name}</p>
                          <p className="text-xs font-mono text-[#1e5a48]">{loan.member_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-gray-600">{safeFormatDate(loan.disbursed_date)}</td>
                    <td className="p-4 text-right font-medium">{formatCurrency(loan.principal_amount)}</td>
                    <td className="p-4 text-right text-gray-600">{loan.interest_rate}% / mo</td>
                    <td className="p-4 text-right font-bold text-blue-600">{formatCurrency(loan.remaining_principal)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
