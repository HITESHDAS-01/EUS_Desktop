import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addMonths, format } from 'date-fns';
import { Button, Input, Label } from '@/components/ui/basic';
import { api } from '@/lib/api';
import { formatCurrency, safeFormatDate } from '@/lib/utils';
import type { EmiCustomer, EmiLoan, EmiLoanStatus, Vendor } from '@/types/db';

const DEFAULT_RATE = 18;
const TENURE_OPTIONS = [3, 6, 9, 12, 18, 24, 36];

export default function EmiLoans() {
  const navigate = useNavigate();
  const [loans, setLoans] = useState<EmiLoan[]>([]);
  const [customers, setCustomers] = useState<EmiCustomer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EmiLoanStatus>('all');

  const [isOpen, setIsOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [customerId, setCustomerId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [productName, setProductName] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [downpayment, setDownpayment] = useState('0');
  const [interestRate, setInterestRate] = useState(String(DEFAULT_RATE));
  const [tenureMonths, setTenureMonths] = useState('12');
  const [disbursedDate, setDisbursedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [firstEmiDate, setFirstEmiDate] = useState(format(addMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => { void fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [l, c, v] = await Promise.all([
        api.listEmiLoans(),
        api.listEmiCustomers(),
        api.listVendors(),
      ]);
      setLoans(l); setCustomers(c); setVendors(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const calc = (() => {
    const price = Number(productPrice) || 0;
    const dp = Number(downpayment) || 0;
    const rate = Number(interestRate) || 0;
    const tenure = Number(tenureMonths) || 0;
    if (price <= 0 || tenure <= 0) {
      return { financed: 0, totalInterest: 0, totalPayable: 0, emi: 0 };
    }
    const financed = Math.max(0, price - dp);
    const totalInterest = (financed * rate * tenure) / (12 * 100);
    const totalPayable = financed + totalInterest;
    const emi = tenure > 0 ? totalPayable / tenure : 0;
    return {
      financed: r2(financed),
      totalInterest: r2(totalInterest),
      totalPayable: r2(totalPayable),
      emi: r2(emi),
    };
  })();

  const reset = () => {
    setCustomerId(''); setVendorId('');
    setProductName(''); setProductCategory('');
    setProductPrice(''); setDownpayment('0');
    setInterestRate(String(DEFAULT_RATE));
    setTenureMonths('12');
    setDisbursedDate(format(new Date(), 'yyyy-MM-dd'));
    setFirstEmiDate(format(addMonths(new Date(), 1), 'yyyy-MM-dd'));
    setVendorInvoiceNumber(''); setNotes(''); setFormError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true); setFormError('');
    try {
      if (!customerId) throw new Error('Please select a customer');
      if (!vendorId) throw new Error('Please select a vendor');
      if (!productName.trim()) throw new Error('Product name is required');
      const price = Number(productPrice);
      const dp = Number(downpayment);
      if (price <= 0) throw new Error('Product price must be greater than 0');
      if (dp > price) throw new Error('Downpayment cannot exceed product price');
      if (calc.financed <= 0) throw new Error('Financed amount must be greater than 0 (reduce downpayment)');
      const t = Number(tenureMonths);
      if (t <= 0) throw new Error('Tenure must be at least 1 month');

      const created = await api.createEmiLoan({
        customer_id: customerId,
        vendor_id: vendorId,
        product_name: productName.trim(),
        product_category: productCategory.trim() || null,
        product_price: price,
        downpayment: dp,
        interest_rate: Number(interestRate),
        tenure_months: t,
        disbursed_date: disbursedDate,
        first_emi_date: firstEmiDate,
        vendor_invoice_number: vendorInvoiceNumber.trim() || null,
        notes: notes.trim() || null,
      });
      setIsOpen(false); reset();
      setSuccess(`Loan ${created.loan_code} created.`);
      await fetchData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setFormLoading(false);
    }
  };

  const filtered = loans
    .filter((l) => statusFilter === 'all' || l.status === statusFilter)
    .filter((l) => {
      const q = searchQuery.toLowerCase();
      return (
        (l.loan_code || '').toLowerCase().includes(q) ||
        l.product_name.toLowerCase().includes(q) ||
        (l.customer_name || '').toLowerCase().includes(q) ||
        (l.customer_code || '').toLowerCase().includes(q)
      );
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-xl font-bold text-gray-800">EMI Loans ({loans.length})</h2>
        <Button onClick={() => { reset(); setIsOpen(true); }} className="gap-2">
          <i className="fas fa-plus"></i> Create EMI Loan
        </Button>
      </div>

      {success && (
        <div className="p-3 rounded-lg border bg-green-50 text-green-700 border-green-200 flex justify-between">
          <p>{success}</p><button onClick={() => setSuccess('')}><i className="fas fa-times"></i></button>
        </div>
      )}
      {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{error}</div>}

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            type="text"
            placeholder="Search by loan code, product, customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1e5a48]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-4 py-2 rounded-lg border border-gray-200 bg-white"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
          <option value="foreclosed">Foreclosed</option>
          <option value="defaulted">Defaulted</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Loan</th>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Vendor</th>
                <th className="p-4 font-medium text-right">EMI / Tenure</th>
                <th className="p-4 font-medium text-right">Outstanding</th>
                <th className="p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">No loans found.</td></tr>
              ) : (
                filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/emi/loans/${l.id}`)}>
                    <td className="p-4">
                      <p className="font-medium text-gray-800">{l.product_name}</p>
                      <p className="text-xs font-mono text-[#1e5a48]">{l.loan_code}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-gray-800">{l.customer_name}</p>
                      <p className="text-xs font-mono text-gray-500">{l.customer_code}</p>
                    </td>
                    <td className="p-4 text-gray-600">{l.vendor_name}</td>
                    <td className="p-4 text-right">
                      <p className="font-medium">{formatCurrency(l.emi_amount)}</p>
                      <p className="text-xs text-gray-500">{l.tenure_months} months</p>
                    </td>
                    <td className="p-4 text-right font-bold text-orange-600">{formatCurrency(l.remaining_principal)}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        l.status === 'active' ? 'bg-green-100 text-green-700' :
                        l.status === 'closed' ? 'bg-gray-100 text-gray-700' :
                        l.status === 'foreclosed' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>{l.status.toUpperCase()}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b flex justify-between items-center bg-[#0b3b2f] text-white">
              <h3 className="font-bold text-lg">Create EMI Loan</h3>
              <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {formError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{formError}</div>}
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Customer <span className="text-red-500">*</span></Label>
                    <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                      <option value="">-- Select --</option>
                      {customers.map((c) => <option key={c.id} value={c.id}>{c.customer_code} - {c.full_name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Vendor <span className="text-red-500">*</span></Label>
                    <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} required className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                      <option value="">-- Select --</option>
                      {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Product Name <span className="text-red-500">*</span></Label>
                    <Input value={productName} onChange={(e) => setProductName(e.target.value)} required placeholder="e.g. Samsung 55″ TV" />
                  </div>
                  <div className="space-y-2">
                    <Label>Product Category</Label>
                    <Input value={productCategory} onChange={(e) => setProductCategory(e.target.value)} placeholder="e.g. Television" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Product Price (₹) <span className="text-red-500">*</span></Label>
                    <Input type="number" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} required min="1" />
                  </div>
                  <div className="space-y-2">
                    <Label>Downpayment (₹)</Label>
                    <Input type="number" value={downpayment} onChange={(e) => setDownpayment(e.target.value)} min="0" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Interest Rate (% p.a. flat)</Label>
                    <Input type="number" step="0.1" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} required min="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tenure (months)</Label>
                    <select value={tenureMonths} onChange={(e) => setTenureMonths(e.target.value)} className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                      {TENURE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Vendor Invoice #</Label>
                    <Input value={vendorInvoiceNumber} onChange={(e) => setVendorInvoiceNumber(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Disbursed Date</Label>
                    <Input type="date" value={disbursedDate} onChange={(e) => setDisbursedDate(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>First EMI Date</Label>
                    <Input type="date" value={firstEmiDate} onChange={(e) => setFirstEmiDate(e.target.value)} required />
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 grid grid-cols-2 gap-3 text-sm">
                  <Row label="Financed Amount" value={formatCurrency(calc.financed)} />
                  <Row label="Total Interest" value={formatCurrency(calc.totalInterest)} />
                  <Row label="Total Payable" value={formatCurrency(calc.totalPayable)} />
                  <Row label="Monthly EMI" value={formatCurrency(calc.emi)} accent />
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm resize-none" />
                </div>

                <div className="pt-2">
                  <Button type="submit" className="w-full" disabled={formLoading}>
                    {formLoading ? 'Creating…' : 'Create Loan'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function r2(v: number) { return Math.round(v * 100) / 100; }

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs text-blue-700">{label}</p>
      <p className={accent ? 'text-lg font-bold text-blue-900' : 'font-medium text-blue-900'}>{value}</p>
    </div>
  );
}
