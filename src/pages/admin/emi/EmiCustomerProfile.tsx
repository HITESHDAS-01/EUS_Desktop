import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/basic';
import { api, photoSrc } from '@/lib/api';
import { formatCurrency, safeFormatDate } from '@/lib/utils';
import type { EmiCustomer, EmiLoan } from '@/types/db';

export default function EmiCustomerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<EmiCustomer | null>(null);
  const [loans, setLoans] = useState<EmiLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getEmiCustomer(id), api.listEmiLoans()])
      .then(([c, allLoans]) => {
        setCustomer(c);
        setLoans(allLoans.filter((l) => l.customer_id === id));
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading…</div>;
  if (error || !customer) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 mb-4">{error || 'Customer not found.'}</p>
        <Button onClick={() => navigate('/admin/emi')}>Back to EMI</Button>
      </div>
    );
  }

  const totalDisbursed = loans.reduce((s, l) => s + l.vendor_paid_amount, 0);
  const outstanding = loans.filter((l) => l.status === 'active').reduce((s, l) => s + l.remaining_principal, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4 mb-2">
        <button onClick={() => navigate('/admin/emi')} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-500 hover:text-[#1e5a48]">
          <i className="fas fa-arrow-left"></i>
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">EMI Customer Profile</h2>
          <p className="text-sm text-gray-500">{customer.customer_code} • {customer.full_name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-[#1e5a48]/10 rounded-full flex items-center justify-center text-[#1e5a48] text-2xl overflow-hidden border-2 border-[#1e5a48]/20">
              {customer.photo_url ? (
                <img src={photoSrc(customer.photo_url)} alt="" className="w-full h-full object-cover" />
              ) : (
                <i className="fas fa-user"></i>
              )}
            </div>
            <div>
              <h3 className="font-bold text-xl text-gray-800">{customer.full_name}</h3>
              <p className="text-xs font-mono text-[#1e5a48]">{customer.customer_code}</p>
            </div>
          </div>
          <div className="space-y-4">
            <KV label="Phone" value={customer.phone} />
            <KV label="Address" value={customer.address} />
            <KV label="Father/Husband Name" value={customer.father_husband_name} />
            <div className="grid grid-cols-2 gap-4">
              <KV label="Date of Birth" value={safeFormatDate(customer.date_of_birth)} />
              <KV label="PAN" value={customer.pan_number} />
            </div>
            <KV label="Aadhaar / VID" value={customer.aadhaar_vid} />
            <div className="grid grid-cols-2 gap-4">
              <KV label="Occupation" value={customer.occupation} />
              <KV label="Monthly Income" value={customer.monthly_income ? formatCurrency(customer.monthly_income) : null} />
            </div>
            <KV label="Nominee" value={customer.nominee_name} />
            <KV label="Notes" value={customer.notes} />
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Total Loans" value={String(loans.length)} accent="text-[#0b3b2f]" />
            <Stat label="Disbursed" value={formatCurrency(totalDisbursed)} accent="text-blue-700" />
            <Stat label="Outstanding" value={formatCurrency(outstanding)} accent="text-orange-700" />
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <i className="fas fa-mobile-alt text-[#1e5a48]"></i> EMI Loans
              </h3>
            </div>
            {loans.length === 0 ? (
              <p className="p-8 text-center text-gray-500 italic">No EMI loans for this customer.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 font-medium text-gray-600">Loan Code</th>
                      <th className="p-3 font-medium text-gray-600">Product</th>
                      <th className="p-3 font-medium text-gray-600 text-right">EMI</th>
                      <th className="p-3 font-medium text-gray-600 text-right">Outstanding</th>
                      <th className="p-3 font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loans.map((l) => (
                      <tr key={l.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/emi/loans/${l.id}`)}>
                        <td className="p-3 font-mono text-xs text-[#1e5a48]">{l.loan_code}</td>
                        <td className="p-3">{l.product_name}</td>
                        <td className="p-3 text-right">{formatCurrency(l.emi_amount)}</td>
                        <td className="p-3 text-right font-bold text-orange-600">{formatCurrency(l.remaining_principal)}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            l.status === 'active' ? 'bg-green-100 text-green-700' :
                            l.status === 'closed' ? 'bg-gray-100 text-gray-700' :
                            l.status === 'foreclosed' ? 'bg-blue-100 text-blue-700' :
                            'bg-red-100 text-red-700'
                          }`}>{l.status.toUpperCase()}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${accent}`}>{value}</p>
    </div>
  );
}
