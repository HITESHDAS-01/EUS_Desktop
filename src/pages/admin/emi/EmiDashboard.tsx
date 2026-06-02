import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { formatCurrency, safeFormatDate } from '@/lib/utils';
import { useSettings } from '@/lib/SettingsContext';
import type { EmiDashboardStats } from '@/types/db';

export default function EmiDashboard() {
  const navigate = useNavigate();
  const { version: settingsVersion } = useSettings();
  const [stats, setStats] = useState<EmiDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Re-fetch on settings reload — grace_period_days affects the server-side
  // overdue scan.
  useEffect(() => {
    setLoading(true);
    api
      .getEmiDashboardStats()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [settingsVersion]);

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-64">
        <i className="fas fa-spinner fa-spin text-4xl text-[#f7b05e]"></i>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
        <p className="font-bold">Could not load dashboard</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }
  if (!stats) return null;

  const hasAnyData = stats.active_count + stats.closed_count + stats.foreclosed_count + stats.defaulted_count > 0;
  if (!hasAnyData) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-[#1e5a48]/10 flex items-center justify-center text-[#1e5a48] mx-auto mb-4">
          <i className="fas fa-mobile-alt text-2xl"></i>
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-2">No EMI activity yet</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Add vendors + customers, then create your first EMI loan. The dashboard will populate automatically.
        </p>
      </div>
    );
  }

  const collectionRate = stats.expected_emi_this_month > 0
    ? Math.round((stats.collected_this_month / stats.expected_emi_this_month) * 100)
    : 0;
  const today = new Date();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon="fas fa-rupee-sign"     color="bg-blue-100 text-blue-700"     label="Total Disbursed"  value={formatCurrency(stats.total_disbursed)} />
        <Kpi icon="fas fa-hourglass-half" color="bg-orange-100 text-orange-700" label="Outstanding"      value={formatCurrency(stats.outstanding)} />
        <Kpi icon="fas fa-check-circle"   color="bg-green-100 text-green-700"   label="Collected So Far" value={formatCurrency(stats.total_collected)} />
        <Kpi icon="fas fa-mobile-alt"     color="bg-purple-100 text-purple-700" label="Active Loans"     value={String(stats.active_count)} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
          <i className="fas fa-calendar-day text-[#1e5a48]"></i>
          This Month's Pulse — {format(today, 'MMMM yyyy')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Pulse label="Expected EMI" value={formatCurrency(stats.expected_emi_this_month)} muted />
          <Pulse label="Collected" value={formatCurrency(stats.collected_this_month)} color="text-green-700" />
          <Pulse
            label="Collection Rate"
            value={`${collectionRate}%`}
            color={collectionRate >= 80 ? 'text-green-700' : collectionRate >= 50 ? 'text-yellow-700' : 'text-red-700'}
            barPct={collectionRate}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className={`p-5 border-b border-gray-100 flex justify-between items-center ${stats.overdue.length > 0 ? 'bg-red-50' : 'bg-gray-50/50'}`}>
          <h3 className={`text-lg font-bold flex items-center gap-2 ${stats.overdue.length > 0 ? 'text-red-800' : 'text-gray-800'}`}>
            <i className={`fas ${stats.overdue.length > 0 ? 'fa-exclamation-triangle' : 'fa-check-circle'}`}></i>
            Overdue EMIs
            <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${stats.overdue.length > 0 ? 'bg-red-200 text-red-800' : 'bg-gray-200 text-gray-700'}`}>
              {stats.overdue.length}
            </span>
          </h3>
          {stats.overdue.length > 0 && (
            <span className="text-sm font-bold text-red-700">
              {formatCurrency(stats.overdue.reduce((s, r) => s + r.overdue_amount, 0))} unpaid
            </span>
          )}
        </div>
        {stats.overdue.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <i className="fas fa-thumbs-up text-3xl text-green-400 mb-3"></i>
            <p className="font-medium">No overdue EMIs. All active loans are up to date.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4 font-medium">Customer</th>
                  <th className="p-4 font-medium">Product / Loan</th>
                  <th className="p-4 font-medium text-right">Unpaid EMIs</th>
                  <th className="p-4 font-medium text-right">Overdue Amount</th>
                  <th className="p-4 font-medium text-right">Days Late</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.overdue.map((r) => (
                  <tr key={r.loan_id} className="hover:bg-red-50/40 cursor-pointer" onClick={() => navigate(`/admin/emi/loans/${r.loan_id}`)}>
                    <td className="p-4">
                      <p className="font-medium text-gray-800">{r.customer_name}</p>
                      <p className="text-xs font-mono text-gray-500">{r.customer_code}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-gray-800">{r.product_name}</p>
                      <p className="text-xs font-mono text-[#1e5a48]">{r.loan_code}</p>
                    </td>
                    <td className="p-4 text-right">{r.unpaid_count} × {formatCurrency(r.emi_amount)}</td>
                    <td className="p-4 text-right font-bold text-red-700">{formatCurrency(r.overdue_amount)}</td>
                    <td className="p-4 text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        r.days_overdue > 30 ? 'bg-red-200 text-red-900' :
                        r.days_overdue > 14 ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>{r.days_overdue} days</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-history text-[#1e5a48]"></i> Recent Payments
          </h3>
        </div>
        {stats.recent_payments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No payments recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-3 font-medium">Date</th>
                  <th className="p-3 font-medium">Customer</th>
                  <th className="p-3 font-medium">Loan</th>
                  <th className="p-3 font-medium text-right">Amount</th>
                  <th className="p-3 font-medium">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.recent_payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/emi/loans/${p.loan_id}`)}>
                    <td className="p-3 text-xs">{safeFormatDate(p.payment_date)}</td>
                    <td className="p-3">{p.customer_name || '—'}</td>
                    <td className="p-3">
                      <p className="text-xs">{p.product_name || '—'}</p>
                      <p className="text-xs font-mono text-gray-500">{p.loan_code}</p>
                    </td>
                    <td className="p-3 text-right font-bold text-[#1e5a48]">{formatCurrency(p.amount_paid)}</td>
                    <td className="p-3 font-mono text-xs text-gray-500">{p.receipt_number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-3">Portfolio Status</h3>
        <div className="flex flex-wrap gap-3 text-sm">
          <StatusPill color="bg-green-100 text-green-800"   label="Active"     count={stats.active_count} />
          <StatusPill color="bg-gray-100 text-gray-800"     label="Closed"     count={stats.closed_count} />
          <StatusPill color="bg-blue-100 text-blue-800"     label="Foreclosed" count={stats.foreclosed_count} />
          <StatusPill color="bg-red-100 text-red-800"       label="Defaulted"  count={stats.defaulted_count} />
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon, color, label, value }: { icon: string; color: string; label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
      <div className={`w-12 h-12 rounded-full ${color} flex items-center justify-center text-xl`}>
        <i className={icon}></i>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-base lg:text-lg font-bold text-gray-800 truncate">{value}</p>
      </div>
    </div>
  );
}

function Pulse({ label, value, color, muted, barPct }: { label: string; value: string; color?: string; muted?: boolean; barPct?: number }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-bold ${color || (muted ? 'text-gray-700' : 'text-gray-800')}`}>{value}</p>
      {barPct !== undefined && (
        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
          <div
            className={`h-1.5 ${barPct >= 80 ? 'bg-green-500' : barPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${Math.min(100, barPct)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function StatusPill({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className={`px-3 py-1.5 rounded-full font-medium ${color} flex items-center gap-2`}>
      <span>{label}</span>
      <span className="bg-white/60 rounded-full px-2 py-0.5 text-xs font-bold">{count}</span>
    </div>
  );
}
