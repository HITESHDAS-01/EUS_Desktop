import { useEffect, useState } from 'react';
import { format, getDate, startOfMonth, setDate } from 'date-fns';
import { Button, Input, Label } from '@/components/ui/basic';
import { api, photoSrc } from '@/lib/api';
import { formatCurrency, safeFormatDate } from '@/lib/utils';
import { useSettings } from '@/lib/SettingsContext';
import type { MemberRow, SavingsRow } from '@/types/db';

export default function Transactions() {
  const { numeric: settings } = useSettings();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [transactions, setTransactions] = useState<SavingsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<SavingsRow | null>(null);
  const [txToDelete, setTxToDelete] = useState<SavingsRow | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [filterMember, setFilterMember] = useState('All');

  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [overridePenalty, setOverridePenalty] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');

  const penaltyPercent = Number(settings['penalty_percentage'] ?? 5) || 5;
  const dueDay = Number(settings['monthly_due_day'] ?? 10) || 10;
  const gracePeriod = Number(settings['grace_period_days'] ?? 3) || 3;

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [allMembers, allTx] = await Promise.all([api.listMembers(), api.listSavings()]);
      setMembers(allMembers.filter((m) => (m.category === 'A' || m.category === 'C') && m.status === 'active'));
      setTransactions(allTx);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedMemberId(''); setAmount('');
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setOverridePenalty(''); setError(''); setEditingTx(null);
  };

  const openAdd = () => { resetForm(); setIsFormOpen(true); };

  const openEdit = (tx: SavingsRow) => {
    resetForm();
    setEditingTx(tx);
    setSelectedMemberId(tx.member_id);
    setAmount(String(tx.amount));
    setPaymentDate(tx.payment_date);
    setIsFormOpen(true);
  };

  const computePreviewPenalty = (): number => {
    if (overridePenalty !== '') {
      const p = Number(overridePenalty);
      return isNaN(p) || p < 0 ? 0 : p;
    }
    const member = members.find((m) => m.id === selectedMemberId);
    const memberCategory = member?.category ?? editingTx?.member_category;
    if (memberCategory !== 'C' || !paymentDate || !amount) return 0;
    const payDate = new Date(paymentDate);
    if (isNaN(payDate.getTime())) return 0;
    if (getDate(payDate) > dueDay + gracePeriod) {
      return (Number(amount) * penaltyPercent) / 100;
    }
    return 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');
    try {
      if (!selectedMemberId) throw new Error('Please select a member');
      if (!paymentDate) throw new Error('Please select a payment date');
      const payDate = new Date(paymentDate);
      if (isNaN(payDate.getTime())) throw new Error('Invalid payment date');

      const member = members.find((m) => m.id === selectedMemberId);
      const memberCategory = member?.category ?? editingTx?.member_category;

      let penalty = 0;
      if (overridePenalty !== '') {
        const p = Number(overridePenalty);
        if (isNaN(p) || p < 0) throw new Error('Penalty must be 0 or greater');
        penalty = p;
      } else if (memberCategory === 'C' && getDate(payDate) > dueDay + gracePeriod) {
        penalty = (Number(amount) * penaltyPercent) / 100;
      }

      const monthYear = startOfMonth(payDate);
      const dueDate = setDate(monthYear, dueDay);

      if (editingTx) {
        await api.updateSavings(editingTx.id, {
          amount: Number(amount),
          penalty,
          payment_date: paymentDate,
          due_date: format(dueDate, 'yyyy-MM-dd'),
          month_year: format(monthYear, 'yyyy-MM-dd'),
        });
      } else {
        await api.createSavings({
          member_id: selectedMemberId,
          amount: Number(amount),
          penalty,
          payment_date: paymentDate,
          due_date: format(dueDate, 'yyyy-MM-dd'),
          month_year: format(monthYear, 'yyyy-MM-dd'),
        });
      }
      setIsFormOpen(false);
      resetForm();
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!txToDelete) return;
    setDeleting(true); setDeleteError('');
    try {
      await api.deleteSavings(txToDelete.id);
      setTxToDelete(null);
      await fetchData();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  };

  const filteredTx = transactions.filter((tx) => {
    const txMonth = format(new Date(tx.payment_date), 'yyyy-MM');
    const matchMonth = filterMonth === '' || txMonth === filterMonth;
    const matchMember = filterMember === 'All' || tx.member_id === filterMember;
    return matchMonth && matchMember;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Savings Transactions</h2>
        <Button onClick={openAdd} className="gap-2">
          <i className="fas fa-plus"></i> Record Installment
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="w-full sm:w-48">
          <Label className="text-xs text-gray-500 mb-1 block">Month</Label>
          <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
        </div>
        <div className="flex-1">
          <Label className="text-xs text-gray-500 mb-1 block">Member</Label>
          <select
            value={filterMember}
            onChange={(e) => setFilterMember(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e5a48]"
          >
            <option value="All">All Members</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.member_code} - {m.profiles?.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Receipt No</th>
                <th className="p-4 font-medium">Member</th>
                <th className="p-4 font-medium text-right">Amount</th>
                <th className="p-4 font-medium text-right">Penalty</th>
                <th className="p-4 font-medium text-right">Total</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">Loading…</td></tr>
              ) : filteredTx.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">No transactions found for the selected filters.</td></tr>
              ) : (
                filteredTx.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="p-4">{safeFormatDate(tx.payment_date)}</td>
                    <td className="p-4 font-mono text-xs text-gray-500">{tx.receipt_number}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#1e5a48]/10 flex items-center justify-center text-[#1e5a48] overflow-hidden border border-[#1e5a48]/10 shrink-0">
                          {tx.member_photo_url ? (
                            <img src={photoSrc(tx.member_photo_url)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <i className="fas fa-user"></i>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{tx.member_full_name}</p>
                          <p className="text-xs font-mono text-[#1e5a48]">{tx.member_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right font-medium text-green-600">{formatCurrency(tx.amount)}</td>
                    <td className="p-4 text-right text-red-500">{tx.penalty > 0 ? formatCurrency(tx.penalty) : '-'}</td>
                    <td className="p-4 text-right font-bold">{formatCurrency(tx.amount + tx.penalty)}</td>
                    <td className="p-4 text-right space-x-3 whitespace-nowrap">
                      <button onClick={() => openEdit(tx)} className="text-[#f7b05e] hover:text-[#e09d3e]" title="Edit">
                        <i className="fas fa-edit"></i>
                      </button>
                      <button onClick={() => { setDeleteError(''); setTxToDelete(tx); }} className="text-red-500 hover:text-red-700" title="Delete">
                        <i className="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-5 border-b flex justify-between items-center bg-[#0b3b2f] text-white">
              <h3 className="font-bold text-lg">{editingTx ? 'Edit Installment' : 'Record Installment'}</h3>
              <button onClick={() => { setIsFormOpen(false); resetForm(); }} className="text-white/70 hover:text-white">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{error}</div>}
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Member (Cat A & C only)</Label>
                  <select
                    value={selectedMemberId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedMemberId(id);
                      const sel = members.find((m) => m.id === id);
                      if (sel?.monthly_installment) setAmount(String(sel.monthly_installment));
                      else setAmount('');
                    }}
                    required
                    disabled={!!editingTx}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100"
                  >
                    <option value="">-- Select Member --</option>
                    {editingTx && !members.find((m) => m.id === selectedMemberId) && (
                      <option value={selectedMemberId}>
                        {editingTx.member_code} - {editingTx.member_full_name}
                      </option>
                    )}
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.member_code} - {m.profiles?.full_name} (Cat {m.category})
                      </option>
                    ))}
                  </select>
                  {editingTx && <p className="text-xs text-gray-500">Member cannot be changed on edit (audit trail).</p>}
                </div>

                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
                  <p className="text-xs text-gray-500">
                    Penalty of {penaltyPercent}% auto-applies if date is after the {dueDay + gracePeriod}th ({dueDay}th + {gracePeriod} days grace).
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Installment Amount (₹)</Label>
                  <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required min="1" />
                </div>

                <div className="space-y-2">
                  <Label>Penalty Override (₹) <span className="text-gray-400 font-normal">— optional</span></Label>
                  <Input
                    type="number"
                    value={overridePenalty}
                    onChange={(e) => setOverridePenalty(e.target.value)}
                    min="0" step="0.01"
                    placeholder="Leave blank to auto-calculate"
                  />
                  <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded px-3 py-2">
                    <i className="fas fa-calculator text-[#1e5a48] mr-1"></i>
                    Will save: <strong>{formatCurrency(computePreviewPenalty())}</strong>{' '}
                    <span className="text-gray-400">
                      ({overridePenalty !== '' ? 'manual override' : computePreviewPenalty() > 0 ? 'auto: late payment' : 'auto: within grace period'})
                    </span>
                  </p>
                </div>

                <div className="pt-4">
                  <Button type="submit" className="w-full" disabled={formLoading}>
                    {formLoading ? 'Saving…' : editingTx ? 'Update Transaction' : 'Record Transaction'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {txToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b bg-red-50 text-red-800 flex items-center gap-3">
              <i className="fas fa-exclamation-triangle text-xl"></i>
              <h3 className="font-bold text-lg">Confirm Deletion</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">Permanently delete this installment? This will reduce the member's total savings.</p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-sm space-y-1">
                <div><span className="text-gray-500">Receipt:</span> <span className="font-mono">{txToDelete.receipt_number}</span></div>
                <div><span className="text-gray-500">Member:</span> <span className="font-medium">{txToDelete.member_full_name} ({txToDelete.member_code})</span></div>
                <div><span className="text-gray-500">Date:</span> {safeFormatDate(txToDelete.payment_date)}</div>
                <div><span className="text-gray-500">Total:</span> <span className="font-bold">{formatCurrency(txToDelete.amount + txToDelete.penalty)}</span></div>
              </div>
              {deleteError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{deleteError}</div>}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setTxToDelete(null)} disabled={deleting}>Cancel</Button>
                <Button onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
                  {deleting ? 'Deleting…' : 'Delete Transaction'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
