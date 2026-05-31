import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { formatCurrency, safeFormatDate } from '@/lib/utils';
import type { DashboardStats } from '@/types/db';

const cardClass =
  'bg-white rounded-3xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-[0_8px_20px_-6px_rgba(6,81,237,0.15)] transition-shadow duration-300 border border-gray-50 relative overflow-hidden group';

export default function AdminHome() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getDashboardStats()
      .then(setStats)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) return <div className="p-6">Loading dashboard...</div>;

  const cards: { label: string; value: string; icon: string; color: string }[] = [
    { label: 'Total Treasury',          value: formatCurrency(stats.total_treasury),         icon: 'fa-vault',           color: 'text-[#1e5a48]' },
    { label: 'Active Loans',            value: formatCurrency(stats.active_loans),           icon: 'fa-hand-holding-usd', color: 'text-blue-500' },
    { label: 'Total Members',           value: String(stats.total_members),                  icon: 'fa-users',           color: 'text-purple-500' },
    { label: 'Current Month Collection', value: formatCurrency(stats.current_month_collection), icon: 'fa-calendar-check', color: 'text-green-500' },
    { label: 'Total Penalty Collected', value: formatCurrency(stats.total_penalty_collected), icon: 'fa-exclamation-circle', color: 'text-orange-500' },
    { label: 'Total Interest Earned',   value: formatCurrency(stats.total_interest_earned),   icon: 'fa-chart-line',       color: 'text-teal-500' },
    { label: 'Matured Members',         value: String(stats.matured_members_count),          icon: 'fa-award',           color: 'text-red-500' },
    { label: 'Pending Installments',    value: String(stats.pending_installments),           icon: 'fa-clock',           color: 'text-amber-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-medium text-gray-800 tracking-tight">Dashboard Overview</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {cards.map((c) => (
          <div key={c.label} className={cardClass}>
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <i className={`fas ${c.icon} text-6xl ${c.color}`}></i>
            </div>
            <p className="text-sm text-gray-500 font-medium mb-2 relative z-10">{c.label}</p>
            <p className="text-3xl font-bold text-gray-800 tracking-tight relative z-10">
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mt-8">
        {/* Recent Activity */}
        <div className="bg-white rounded-3xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-50 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-medium text-gray-800">Recent Transactions</h3>
          </div>
          <div className="p-0 flex-1 overflow-y-auto max-h-[400px]">
            <table className="w-full text-left text-sm">
              <tbody>
                {stats.recent_tx.length === 0 ? (
                  <tr>
                    <td className="p-6 text-gray-500 text-center">
                      No recent transactions.
                    </td>
                  </tr>
                ) : (
                  stats.recent_tx.map((tx, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors"
                    >
                      <td className="p-4 pl-6 font-medium text-gray-700">{tx.member_code}</td>
                      <td className="p-4 text-gray-500">{safeFormatDate(tx.created_at)}</td>
                      <td className="p-4 pr-6 font-bold text-right text-green-600">
                        +{formatCurrency(tx.amount + tx.penalty)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Overdue Payments */}
        <div className="bg-white rounded-3xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-50 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-medium text-orange-800 flex items-center gap-2">
              <i className="fas fa-exclamation-triangle text-orange-500"></i> Overdue Payments
            </h3>
          </div>
          <div className="p-6 space-y-4 flex-1 bg-orange-50/30 overflow-y-auto max-h-[400px]">
            {stats.overdue.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <i className="fas fa-check-circle text-4xl text-green-400 mb-3"></i>
                <p>No overdue payments this month!</p>
              </div>
            ) : (
              stats.overdue.map((m) => (
                <div
                  key={m.id}
                  className="bg-white border border-orange-100 p-4 rounded-2xl flex justify-between items-center shadow-sm hover:shadow-md transition-shadow"
                >
                  <div>
                    <p className="font-bold text-gray-800">{m.member_code}</p>
                    <p className="text-sm text-gray-500 font-medium mt-0.5">{m.full_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-orange-600 font-bold bg-orange-100 px-2 py-1 rounded">
                      Late
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{m.phone}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Maturity Alerts */}
        <div className="bg-white rounded-3xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-50 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-medium text-red-800 flex items-center gap-2">
              <i className="fas fa-bell text-red-500"></i> Maturity Alerts
            </h3>
          </div>
          <div className="p-6 space-y-4 flex-1 bg-red-50/30 overflow-y-auto max-h-[400px]">
            {stats.maturing.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <i className="fas fa-calendar-check text-4xl text-gray-300 mb-3"></i>
                <p>No upcoming maturities in 3 months.</p>
              </div>
            ) : (
              stats.maturing.map((m) => {
                const past = (m.months_remaining ?? 0) <= 0;
                return (
                  <div
                    key={m.id}
                    className={`bg-white border ${
                      past ? 'border-red-200' : 'border-orange-100'
                    } p-4 rounded-2xl flex justify-between items-center shadow-sm hover:shadow-md transition-shadow`}
                  >
                    <div>
                      <p className="font-bold text-gray-800">{m.member_code}</p>
                      <p
                        className={`text-sm font-medium mt-0.5 ${
                          past ? 'text-red-500' : 'text-orange-500'
                        }`}
                      >
                        {past
                          ? `Matured on ${
                              m.maturity_date ? format(new Date(m.maturity_date), 'dd MMM yyyy') : '—'
                            }`
                          : `Maturing in ${m.months_remaining} months`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-xl text-gray-800">
                        {formatCurrency(m.projected_amount ?? 0)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
