import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/basic';
import { api, photoSrc } from '@/lib/api';
import { formatCurrency, safeFormatDate } from '@/lib/utils';
import type { StatementBundle } from '@/types/db';

export default function MemberProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bundle, setBundle] = useState<StatementBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .getStatementBundle(id)
      .then(setBundle)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading profile…</div>;
  if (error || !bundle) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 mb-4">{error || 'Member not found.'}</p>
        <Button onClick={() => navigate('/admin/members')}>Back to Members</Button>
      </div>
    );
  }

  const { member, savings, loans, repayments } = bundle;
  const totalSavings = savings.reduce((s, x) => s + x.amount, 0);
  const totalPenalty = savings.reduce((s, x) => s + x.penalty, 0);
  const activeLoanBalance = loans
    .filter((l) => l.status === 'active')
    .reduce((s, l) => s + l.remaining_principal, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/admin/members')}
          className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-500 hover:text-[#1e5a48] transition-colors"
        >
          <i className="fas fa-arrow-left"></i>
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Member Profile</h2>
          <p className="text-sm text-gray-500">
            {member.member_code} • {member.profiles?.full_name}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-[#1e5a48]/10 rounded-full flex items-center justify-center text-[#1e5a48] text-2xl overflow-hidden border-2 border-[#1e5a48]/20">
                {member.profiles?.photo_url ? (
                  <img src={photoSrc(member.profiles.photo_url)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <i className="fas fa-user"></i>
                )}
              </div>
              <div>
                <h3 className="font-bold text-xl text-gray-800">{member.profiles?.full_name}</h3>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold inline-block mt-1 ${
                    member.category === 'A'
                      ? 'bg-purple-100 text-purple-700'
                      : member.category === 'B'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                  }`}
                >
                  Category {member.category}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <KV label="Phone" value={member.profiles?.phone} />
              <KV label="Address" value={member.profiles?.address} />
              <KV label="Father/Husband Name" value={member.profiles?.father_husband_name} />
              <div className="grid grid-cols-2 gap-4">
                <KV label="Gender" value={member.profiles?.gender} />
                <KV label="Date of Birth" value={safeFormatDate(member.profiles?.date_of_birth)} />
              </div>
              <KV label="Aadhaar / VID No." value={member.profiles?.aadhaar_vid} />
              <KV label="Nominee Name" value={member.profiles?.nominee_name} />
              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <KV label="Join Date" value={safeFormatDate(member.join_date)} />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Status</p>
                  <span className="bg-green-50 text-green-600 px-2 py-1 rounded text-xs font-medium border border-green-200 mt-1 inline-block">
                    {member.status.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">Financial Summary</h3>
            <div className="space-y-4">
              <Stat label="Total Savings" value={formatCurrency(totalSavings)} color="text-green-600" />
              <Stat label="Active Loan Balance" value={formatCurrency(activeLoanBalance)} color="text-orange-600" />
              <Stat label="Total Penalty Paid" value={formatCurrency(totalPenalty)} color="text-red-600" />
              <div className="flex justify-between items-center border-t pt-3">
                <span className="text-gray-600 font-medium">Monthly Installment</span>
                <span className="font-bold text-gray-800">{formatCurrency(member.monthly_installment ?? 0)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <i className="fas fa-book text-[#1e5a48]"></i> Savings Passbook
              </h3>
            </div>
            <div className="p-0 overflow-x-auto max-h-[400px] overflow-y-auto">
              {savings.length === 0 ? (
                <p className="p-8 text-center text-gray-500 italic">No savings transactions found.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 sticky top-0 shadow-sm">
                    <tr>
                      <th className="p-4 font-medium text-gray-600">Date</th>
                      <th className="p-4 font-medium text-gray-600">Receipt No.</th>
                      <th className="p-4 font-medium text-gray-600 text-right">Amount</th>
                      <th className="p-4 font-medium text-gray-600 text-right">Penalty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {savings.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="p-4">{safeFormatDate(tx.payment_date)}</td>
                        <td className="p-4 font-mono text-xs text-gray-500">{tx.receipt_number}</td>
                        <td className="p-4 text-right font-bold text-green-600">+{formatCurrency(tx.amount)}</td>
                        <td className="p-4 text-right text-red-500">{tx.penalty > 0 ? formatCurrency(tx.penalty) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <i className="fas fa-hand-holding-usd text-orange-500"></i> Loan Passbook
              </h3>
            </div>
            <div className="p-6 space-y-6 max-h-[500px] overflow-y-auto">
              {loans.length === 0 ? (
                <p className="text-center text-gray-500 italic">No loans found.</p>
              ) : (
                loans.map((loan) => {
                  const loanReps = repayments.filter((r) => r.loan_id === loan.id);
                  return (
                    <div key={loan.id} className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                      <div className="bg-orange-50/30 p-4 border-b border-gray-100 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-gray-800">Loan Disbursed: {formatCurrency(loan.principal_amount)}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Date: {safeFormatDate(loan.disbursed_date)} | Interest: {loan.interest_rate}% | Status: <span className="uppercase font-medium">{loan.status}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500 mb-1">Remaining Principal</p>
                          <p className="font-bold text-orange-600 text-lg">{formatCurrency(loan.remaining_principal)}</p>
                        </div>
                      </div>
                      <div className="p-0 overflow-x-auto">
                        {loanReps.length > 0 ? (
                          <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="p-3 font-medium text-gray-600">Date</th>
                                <th className="p-3 font-medium text-gray-600">Receipt</th>
                                <th className="p-3 font-medium text-gray-600 text-right">Principal</th>
                                <th className="p-3 font-medium text-gray-600 text-right">Interest</th>
                                <th className="p-3 font-medium text-gray-600 text-right">Total Paid</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {loanReps.map((rep) => (
                                <tr key={rep.id} className="hover:bg-gray-50/80">
                                  <td className="p-3">{safeFormatDate(rep.payment_date)}</td>
                                  <td className="p-3 font-mono text-xs text-gray-500">{rep.receipt_number}</td>
                                  <td className="p-3 text-right text-gray-700">{formatCurrency(rep.principal_portion)}</td>
                                  <td className="p-3 text-right text-gray-700">{formatCurrency(rep.interest_portion)}</td>
                                  <td className="p-3 text-right font-bold text-green-600">{formatCurrency(rep.amount_paid)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="p-4 text-sm text-gray-500 italic text-center">No repayments made yet.</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="font-medium text-gray-800">{value || 'N/A'}</p>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-600">{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );
}
