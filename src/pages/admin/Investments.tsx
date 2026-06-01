import { useEffect, useState } from 'react';
import { format, addMonths, isAfter, isBefore } from 'date-fns';
import { Button, Input, Label } from '@/components/ui/basic';
import { api } from '@/lib/api';
import { formatCurrency, safeFormatDate } from '@/lib/utils';
import ExternalLoans from './ExternalLoans';
import type { ExtInvestment, ExtInvestmentInput } from '@/types/db';

const TYPES = ['Business', 'Stocks', 'SIP', 'Personal Loan', 'Real Estate', 'Other'];
const PAYOUTS = ['Monthly', 'Quarterly', 'Annually', 'At Maturity', 'Irregular'];

export default function Investments() {
  const [activeTab, setActiveTab] = useState<'portfolio' | 'loans'>('portfolio');
  const [investments, setInvestments] = useState<ExtInvestment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [isEdit, setIsEdit] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState('Business');
  const [principal, setPrincipal] = useState('');
  const [expectedRoi, setExpectedRoi] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [maturityDate, setMaturityDate] = useState('');
  const [payoutFrequency, setPayoutFrequency] = useState('Monthly');
  const [notes, setNotes] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const [returnAmount, setReturnAmount] = useState('');
  const [returnDate, setReturnDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [returnDesc, setReturnDesc] = useState('');

  useEffect(() => { void fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true); setError('');
    try {
      setInvestments(await api.listInvestments());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setIsEdit(false); setSelectedId('');
    setName(''); setType('Business'); setPrincipal(''); setExpectedRoi('');
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setMaturityDate(''); setPayoutFrequency('Monthly'); setNotes('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true); setError('');
    try {
      const input: ExtInvestmentInput = {
        name: name.trim(),
        type,
        principal_amount: Number(principal),
        expected_roi: expectedRoi ? Number(expectedRoi) : null,
        start_date: startDate,
        maturity_date: maturityDate || null,
        payout_frequency: payoutFrequency,
        notes: notes.trim() || null,
      };
      if (isEdit) {
        await api.updateInvestment(selectedId, input);
        setSuccess('Investment updated successfully!');
      } else {
        await api.createInvestment(input);
        setSuccess('Investment added successfully!');
      }
      setIsAddOpen(false); reset();
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleAddReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true); setError('');
    try {
      await api.addInvestmentReturn({
        investment_id: selectedId,
        amount: Number(returnAmount),
        return_date: returnDate,
        description: returnDesc.trim() || null,
      });
      setSuccess('Return recorded successfully!');
      setIsReturnOpen(false);
      setReturnAmount(''); setReturnDate(format(new Date(), 'yyyy-MM-dd')); setReturnDesc('');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    setFormLoading(true); setError('');
    try {
      await api.deleteInvestment(selectedId);
      setSuccess('Investment deleted.');
      setIsDeleteOpen(false);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFormLoading(false);
    }
  };

  const openEdit = (inv: ExtInvestment) => {
    setIsEdit(true); setSelectedId(inv.id);
    setName(inv.name); setType(inv.type);
    setPrincipal(String(inv.principal_amount));
    setExpectedRoi(inv.expected_roi != null ? String(inv.expected_roi) : '');
    setStartDate(inv.start_date);
    setMaturityDate(inv.maturity_date || '');
    setPayoutFrequency(inv.payout_frequency || 'Monthly');
    setNotes(inv.notes || '');
    setIsAddOpen(true);
  };

  const active = investments.filter((i) => i.status === 'Active');
  const totalInvested = active.reduce((s, i) => s + i.principal_amount, 0);
  const totalReturns = investments.reduce((s, i) => s + i.total_returns, 0);
  const currentValue = totalInvested + totalReturns;

  const threeMo = addMonths(new Date(), 3);
  const maturingSoon = active.filter((i) => {
    if (!i.maturity_date) return false;
    const m = new Date(i.maturity_date);
    return isAfter(m, new Date()) && isBefore(m, threeMo);
  }).sort((a, b) => new Date(a.maturity_date!).getTime() - new Date(b.maturity_date!).getTime());

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Organization Investments</h2>
        <div className="flex bg-gray-200 p-1 rounded-lg">
          {(['portfolio', 'loans'] as const).map((t) => (
            <button
              key={t}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                activeTab === t ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab(t)}
            >
              {t === 'portfolio' ? 'Portfolio' : 'External Loans'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'portfolio' && (
        <>
          <div className="flex justify-end">
            <Button onClick={() => { reset(); setIsAddOpen(true); }} className="gap-2">
              <i className="fas fa-plus"></i> New Investment
            </Button>
          </div>

          {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100">{error}</div>}
          {success && <div className="p-4 bg-green-50 text-green-700 rounded-xl border border-green-100">{success}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <SumCard label="Total Invested (Active)" value={formatCurrency(totalInvested)} icon="fa-wallet" color="bg-blue-50 text-blue-600" />
            <SumCard label="Current Value" value={formatCurrency(currentValue)} icon="fa-chart-line" color="bg-green-50 text-green-600" />
            <SumCard label="Total Returns Earned" value={formatCurrency(totalReturns)} icon="fa-hand-holding-usd" color="bg-teal-50 text-teal-600" />
            <SumCard label="Active Investments" value={String(active.length)} icon="fa-briefcase" color="bg-purple-50 text-purple-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800">Investment Portfolio</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="p-4 font-medium">Investment</th>
                      <th className="p-4 font-medium text-right">Principal</th>
                      <th className="p-4 font-medium text-right">Returns</th>
                      <th className="p-4 font-medium text-right">Current Value</th>
                      <th className="p-4 font-medium text-center">Status</th>
                      <th className="p-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading portfolio…</td></tr>
                    ) : investments.length === 0 ? (
                      <tr><td colSpan={6} className="p-8 text-center text-gray-500">No investments yet.</td></tr>
                    ) : investments.map((inv) => {
                      const cv = inv.principal_amount + inv.total_returns;
                      return (
                        <tr key={inv.id} className="hover:bg-gray-50">
                          <td className="p-4">
                            <div className="font-bold text-gray-800">{inv.name}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                              <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{inv.type}</span>
                              {inv.expected_roi != null && <span>{inv.expected_roi}% ROI</span>}
                            </div>
                          </td>
                          <td className="p-4 text-right font-medium">{formatCurrency(inv.principal_amount)}</td>
                          <td className="p-4 text-right text-green-600">+{formatCurrency(inv.total_returns)}</td>
                          <td className="p-4 text-right font-bold text-[#1e5a48]">{formatCurrency(cv)}</td>
                          <td className="p-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              inv.status === 'Active' ? 'bg-green-100 text-green-700' :
                              inv.status === 'Matured' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>{inv.status}</span>
                          </td>
                          <td className="p-4 text-right space-x-2 whitespace-nowrap">
                            {inv.status === 'Active' && (
                              <button
                                onClick={() => { setSelectedId(inv.id); setIsReturnOpen(true); }}
                                className="text-sm text-[#f7b05e] hover:text-[#e09b4d] font-medium bg-[#f7b05e]/10 px-3 py-1.5 rounded-lg"
                                title="Add Return"
                              >+ Add Return</button>
                            )}
                            <button onClick={() => openEdit(inv)} className="text-sm text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg" title="Edit">
                              <i className="fas fa-edit"></i>
                            </button>
                            <button onClick={() => { setSelectedId(inv.id); setIsDeleteOpen(true); }} className="text-sm text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg" title="Delete">
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <i className="fas fa-calendar-alt text-[#f7b05e]"></i> Maturity Calendar
                </h3>
                <p className="text-xs text-gray-500 mt-1">Maturing in next 3 months</p>
              </div>
              <div className="p-4 flex-1 overflow-y-auto">
                {maturingSoon.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <i className="fas fa-check-circle text-3xl text-gray-300 mb-2 block"></i>
                    No investments maturing soon.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {maturingSoon.map((inv) => (
                      <div key={inv.id} className="p-4 rounded-xl border border-orange-100 bg-orange-50/50 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-gray-800">{inv.name}</p>
                          <p className="text-xs text-gray-500 mt-1">Principal: {formatCurrency(inv.principal_amount)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-orange-600">{safeFormatDate(inv.maturity_date)}</p>
                          <p className="text-xs text-orange-500 mt-0.5">Maturity Date</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {isAddOpen && (
            <Modal title={isEdit ? 'Edit Investment' : 'Add New Investment'} onClose={() => setIsAddOpen(false)} wide>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Investment Name / Entity</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. ABC Corp Stocks" />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <select className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
                      {TYPES.map((t) => <option key={t} value={t}>{t === 'Stocks' ? 'Stocks / Mutual Funds' : t === 'Personal Loan' ? 'Personal Loan (Non-Member)' : t}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Principal Amount (₹)</Label>
                    <Input type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} required min="1" />
                  </div>
                  <div className="space-y-2">
                    <Label>Expected ROI (%) <span className="text-gray-400 font-normal">(Optional)</span></Label>
                    <Input type="number" step="0.1" value={expectedRoi} onChange={(e) => setExpectedRoi(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Maturity Date <span className="text-gray-400 font-normal">(Optional)</span></Label>
                    <Input type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Payout Frequency</Label>
                    <select className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" value={payoutFrequency} onChange={(e) => setPayoutFrequency(e.target.value)}>
                      {PAYOUTS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Notes <span className="text-gray-400 font-normal">(Optional)</span></Label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm resize-none" />
                  </div>
                </div>
                <div className="pt-4 flex justify-end gap-3 border-t mt-6">
                  <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={formLoading}>{formLoading ? 'Saving…' : 'Save Investment'}</Button>
                </div>
              </form>
            </Modal>
          )}

          {isReturnOpen && (
            <Modal title="Record Return / Dividend" onClose={() => setIsReturnOpen(false)} accent>
              <form onSubmit={handleAddReturn} className="space-y-4">
                <div className="space-y-2">
                  <Label>Return Amount (₹)</Label>
                  <Input type="number" value={returnAmount} onChange={(e) => setReturnAmount(e.target.value)} required min="1" />
                </div>
                <div className="space-y-2">
                  <Label>Date Received</Label>
                  <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Description / Reference <span className="text-gray-400 font-normal">(Optional)</span></Label>
                  <Input value={returnDesc} onChange={(e) => setReturnDesc(e.target.value)} placeholder="e.g. Q1 Dividend" />
                </div>
                <div className="pt-4 flex justify-end gap-3 border-t mt-6">
                  <Button type="button" variant="outline" onClick={() => setIsReturnOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={formLoading}>{formLoading ? 'Saving…' : 'Record Return'}</Button>
                </div>
              </form>
            </Modal>
          )}

          {isDeleteOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
                <div className="p-6 text-center">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                    <i className="fas fa-exclamation-triangle"></i>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Delete Investment?</h3>
                  <p className="text-gray-600 mb-6">This will delete all associated return records too. Cannot be undone.</p>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
                    <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={formLoading}>
                      {formLoading ? 'Deleting…' : 'Delete'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'loans' && <ExternalLoans />}
    </div>
  );
}

function SumCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-full ${color} flex items-center justify-center text-xl shrink-0`}>
        <i className={`fas ${icon}`}></i>
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose, wide, accent }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean; accent?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} overflow-hidden flex flex-col max-h-[90vh]`}>
        <div className={`p-5 border-b flex justify-between items-center ${accent ? 'bg-[#1e5a48]' : 'bg-[#0b3b2f]'} text-white shrink-0`}>
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
