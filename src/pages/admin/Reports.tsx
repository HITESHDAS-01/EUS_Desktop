import { useEffect, useState } from 'react';
import { addMonths, differenceInMonths, endOfMonth, format, startOfMonth } from 'date-fns';
import { Input, Label } from '@/components/ui/basic';
import { api, photoSrc } from '@/lib/api';
import { calculateMaturityAmount, formatCurrency, safeFormatDate } from '@/lib/utils';
import { useSettings } from '@/lib/SettingsContext';
import type {
  MemberRow,
  RepaymentReportRow,
  SavingsRow,
} from '@/types/db';

type Tab = 'maturity' | 'collection' | 'defaulter' | 'interest' | 'monthly_sheet';

type MaturityRow = MemberRow & {
  totalSavings: number;
  projectedAmount: number;
  maturityDate: Date;
  monthsRemaining: number;
  maturityStatus: 'Matured' | 'Maturing Soon' | 'Not Matured';
};

type MonthlySheetRow = MemberRow & {
  sheetStatus: 'Paid' | 'Late' | 'Pending' | 'N/A';
  statusIcon: string;
  paidAmount: number | null;
  paidDate: string | null;
};

export default function Reports() {
  const { numeric: settings } = useSettings();
  const [activeTab, setActiveTab] = useState<Tab>('maturity');

  const [maturityRows, setMaturityRows] = useState<MaturityRow[]>([]);
  const [maturityFilter, setMaturityFilter] = useState<'all' | 'matured' | 'soon'>('all');

  const [collectionRows, setCollectionRows] = useState<SavingsRow[]>([]);
  const [interestRows, setInterestRows] = useState<RepaymentReportRow[]>([]);
  const [defaulterRows, setDefaulterRows] = useState<MemberRow[]>([]);
  const [monthlySheet, setMonthlySheet] = useState<MonthlySheetRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  useEffect(() => {
    if (activeTab === 'maturity') void loadMaturity();
    if (activeTab === 'collection') void loadCollection();
    if (activeTab === 'interest') void loadInterest();
    if (activeTab === 'defaulter') void loadDefaulter();
    if (activeTab === 'monthly_sheet') void loadMonthlySheet();
  }, [activeTab, startDate, endDate]);

  const roiCatB = Number(settings['roi_category_b'] ?? 36) || 36;
  const roi24 = Number(settings['roi_category_c_24'] ?? 16) || 16;
  const roi36 = Number(settings['roi_category_c_36'] ?? 27) || 27;
  const dueDay = Number(settings['monthly_due_day'] ?? 10) || 10;

  const loadMaturity = async () => {
    setLoading(true);
    try {
      const members = await api.listMembers();
      const active = members.filter((m) => m.status === 'active');
      const enriched: MaturityRow[] = await Promise.all(
        active.map(async (m) => {
          const savings = await api.listMemberSavings(m.id);
          const totalInst = savings.reduce((s, x) => s + x.amount, 0);
          let totalSavings = 0;
          if (m.category === 'A') totalSavings = (m.initial_investment ?? 0) + totalInst;
          else if (m.category === 'B') totalSavings = m.initial_investment ?? 0;
          else if (m.category === 'C') totalSavings = totalInst;

          let roi = 0;
          if (m.category === 'B') roi = roiCatB;
          else if (m.category === 'C' && m.chosen_term_months === 24) roi = roi24;
          else if (m.category === 'C' && m.chosen_term_months === 36) roi = roi36;

          const projected = calculateMaturityAmount(
            m.category,
            m.initial_investment ?? 0,
            totalSavings,
            roi,
            m.status,
          );

          const join = new Date(m.join_date);
          const safeJoin = isNaN(join.getTime()) ? new Date() : join;
          const maturityDate = addMonths(safeJoin, m.chosen_term_months || 36);
          const monthsRemaining = differenceInMonths(maturityDate, new Date());
          let status: MaturityRow['maturityStatus'] = 'Not Matured';
          if (monthsRemaining <= 0) status = 'Matured';
          else if (monthsRemaining <= 3) status = 'Maturing Soon';

          return {
            ...m,
            totalSavings,
            projectedAmount: projected,
            maturityDate,
            monthsRemaining,
            maturityStatus: status,
          };
        }),
      );
      enriched.sort((a, b) => a.maturityDate.getTime() - b.maturityDate.getTime());
      setMaturityRows(enriched);
    } finally {
      setLoading(false);
    }
  };

  const loadCollection = async () => {
    setLoading(true);
    try {
      const rows = await api.listSavingsInRange(startDate, endDate);
      setCollectionRows(rows);
    } finally {
      setLoading(false);
    }
  };

  const loadInterest = async () => {
    setLoading(true);
    try {
      const rows = await api.listRepaymentsInRange(startDate, endDate);
      setInterestRows(rows);
    } finally {
      setLoading(false);
    }
  };

  const loadDefaulter = async () => {
    setLoading(true);
    try {
      // Use month_year-based filter (matches eus original) so a late payment
      // recorded in the next month still counts for its original month.
      const [members, savingsInRange] = await Promise.all([
        api.listMembers(),
        api.listSavingsByMonthYearRange(startDate, endDate),
      ]);
      const paid = new Set(savingsInRange.map((s) => s.member_id));
      const def = members.filter(
        (m) => (m.category === 'A' || m.category === 'C') && m.status === 'active' && !paid.has(m.id),
      );
      setDefaulterRows(def);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlySheet = async () => {
    setLoading(true);
    try {
      const [members, savings] = await Promise.all([
        api.listMembers(),
        // month_year, not payment_date — late payments still count for May.
        api.listSavingsByMonthYearRange(
          format(startOfMonth(new Date()), 'yyyy-MM-dd'),
          format(endOfMonth(new Date()), 'yyyy-MM-dd'),
        ),
      ]);
      const active = members
        .filter((m) => m.status === 'active')
        .sort((a, b) => (a.member_code || '').localeCompare(b.member_code || ''));
      const paidMap = new Map<string, SavingsRow>();
      for (const tx of savings) paidMap.set(tx.member_id, tx);
      const today = new Date();
      const isLate = today.getDate() > dueDay;
      const rows: MonthlySheetRow[] = active.map((m) => {
        if (m.category === 'B') {
          return { ...m, sheetStatus: 'N/A', statusIcon: '➖', paidAmount: null, paidDate: null };
        }
        const tx = paidMap.get(m.id);
        if (tx) {
          return {
            ...m,
            sheetStatus: 'Paid',
            statusIcon: '✅',
            paidAmount: tx.amount,
            paidDate: tx.payment_date,
          };
        }
        return {
          ...m,
          sheetStatus: isLate ? 'Late' : 'Pending',
          statusIcon: isLate ? '❌' : '⏳',
          paidAmount: null,
          paidDate: null,
        };
      });
      setMonthlySheet(rows);
    } finally {
      setLoading(false);
    }
  };

  const filteredMaturity = maturityRows.filter((m) => {
    if (maturityFilter === 'all') return true;
    if (maturityFilter === 'matured') return m.maturityStatus === 'Matured';
    if (maturityFilter === 'soon') return m.maturityStatus === 'Maturing Soon';
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">System Reports</h2>

      <div className="flex border-b border-gray-200 overflow-x-auto">
        {([
          ['maturity', 'Maturity Report'],
          ['collection', 'Collection Report'],
          ['defaulter', 'Defaulter Report'],
          ['interest', 'Interest Earned'],
          ['monthly_sheet', 'Monthly Sheet'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
              activeTab === id
                ? 'border-b-2 border-[#1e5a48] text-[#1e5a48]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {(activeTab === 'collection' || activeTab === 'defaulter' || activeTab === 'interest') && (
        <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex-1">
            <Label className="text-xs text-gray-500 mb-1 block">Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="flex-1">
            <Label className="text-xs text-gray-500 mb-1 block">End Date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
      )}

      {activeTab === 'maturity' && (
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800">Maturity Overview</h3>
          <select
            className="h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            value={maturityFilter}
            onChange={(e) => setMaturityFilter(e.target.value as typeof maturityFilter)}
          >
            <option value="all">All Active Members</option>
            <option value="matured">Matured Only</option>
            <option value="soon">Maturing in ≤ 3 Months</option>
          </select>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <p className="p-8 text-center text-gray-500">Loading report…</p>
          ) : activeTab === 'maturity' ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4 font-medium">Member</th>
                  <th className="p-4 font-medium">Category / Term</th>
                  <th className="p-4 font-medium">Total Savings</th>
                  <th className="p-4 font-medium">Maturity Date</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium text-right">Projected Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredMaturity.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">No members match this filter.</td></tr>
                ) : (
                  filteredMaturity.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <MemberCell
                          name={m.profiles?.full_name || ''}
                          code={m.member_code || ''}
                          photo={m.profiles?.photo_url}
                        />
                      </td>
                      <td className="p-4">Cat {m.category} <span className="text-gray-400">({m.chosen_term_months || '-'}m)</span></td>
                      <td className="p-4 font-medium">{formatCurrency(m.totalSavings)}</td>
                      <td className="p-4">{safeFormatDate(m.maturityDate)}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          m.maturityStatus === 'Matured' ? 'bg-green-100 text-green-700' :
                          m.maturityStatus === 'Maturing Soon' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{m.maturityStatus}</span>
                      </td>
                      <td className="p-4 text-right font-bold text-[#f7b05e]">{formatCurrency(m.projectedAmount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : activeTab === 'collection' ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4 font-medium">Date</th>
                  <th className="p-4 font-medium">Receipt No</th>
                  <th className="p-4 font-medium">Member</th>
                  <th className="p-4 font-medium text-right">Amount</th>
                  <th className="p-4 font-medium text-right">Penalty</th>
                  <th className="p-4 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {collectionRows.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">No collections in this period.</td></tr>
                ) : (
                  collectionRows.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="p-4">{safeFormatDate(tx.payment_date)}</td>
                      <td className="p-4 font-mono text-xs text-gray-500">{tx.receipt_number}</td>
                      <td className="p-4">
                        <MemberCell name={tx.member_full_name || ''} code={tx.member_code || ''} photo={tx.member_photo_url} />
                      </td>
                      <td className="p-4 text-right">{formatCurrency(tx.amount)}</td>
                      <td className="p-4 text-right text-orange-500">{formatCurrency(tx.penalty)}</td>
                      <td className="p-4 text-right font-bold text-green-600">{formatCurrency(tx.amount + tx.penalty)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : activeTab === 'defaulter' ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4 font-medium">Member</th>
                  <th className="p-4 font-medium">Category</th>
                  <th className="p-4 font-medium">Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {defaulterRows.length === 0 ? (
                  <tr><td colSpan={3} className="p-8 text-center text-gray-500">No defaulters in this period.</td></tr>
                ) : (
                  defaulterRows.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <MemberCell name={m.profiles?.full_name || ''} code={m.member_code || ''} photo={m.profiles?.photo_url} />
                      </td>
                      <td className="p-4">Cat {m.category}</td>
                      <td className="p-4 text-gray-600">{m.profiles?.phone || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : activeTab === 'interest' ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4 font-medium">Date</th>
                  <th className="p-4 font-medium">Receipt No</th>
                  <th className="p-4 font-medium">Member</th>
                  <th className="p-4 font-medium text-right">Principal Paid</th>
                  <th className="p-4 font-medium text-right">Interest Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {interestRows.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-500">No interest earned in this period.</td></tr>
                ) : (
                  interestRows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="p-4">{safeFormatDate(r.payment_date)}</td>
                      <td className="p-4 font-mono text-xs text-gray-500">{r.receipt_number}</td>
                      <td className="p-4">
                        <MemberCell name={r.member_full_name || ''} code={r.member_code || ''} photo={r.member_photo_url} />
                      </td>
                      <td className="p-4 text-right">{formatCurrency(r.principal_portion)}</td>
                      <td className="p-4 text-right font-bold text-teal-600">+{formatCurrency(r.interest_portion)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : activeTab === 'monthly_sheet' ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4 font-medium">Member</th>
                  <th className="p-4 font-medium">Category</th>
                  <th className="p-4 font-medium text-center">Status</th>
                  <th className="p-4 font-medium text-right">Amount Paid</th>
                  <th className="p-4 font-medium text-right">Payment Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {monthlySheet.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-500">No active members.</td></tr>
                ) : (
                  monthlySheet.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <MemberCell name={m.profiles?.full_name || ''} code={m.member_code || ''} photo={m.profiles?.photo_url} />
                      </td>
                      <td className="p-4">Cat {m.category}</td>
                      <td className="p-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center justify-center gap-1 ${
                          m.sheetStatus === 'Paid' ? 'bg-green-100 text-green-700' :
                          m.sheetStatus === 'Late' ? 'bg-red-100 text-red-700' :
                          m.sheetStatus === 'Pending' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {m.statusIcon} {m.sheetStatus}
                        </span>
                      </td>
                      <td className="p-4 text-right font-medium">{m.paidAmount != null ? formatCurrency(m.paidAmount) : '-'}</td>
                      <td className="p-4 text-right text-gray-500">{m.paidDate ? safeFormatDate(m.paidDate) : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MemberCell({ name, code, photo }: { name: string; code: string; photo?: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-[#1e5a48]/10 flex items-center justify-center text-[#1e5a48] overflow-hidden border border-[#1e5a48]/10 shrink-0">
        {photo ? (
          <img src={photoSrc(photo)} alt="" className="w-full h-full object-cover" />
        ) : (
          <i className="fas fa-user"></i>
        )}
      </div>
      <div>
        <p className="font-bold text-gray-800">{name}</p>
        <p className="text-xs font-mono text-[#1e5a48]">{code}</p>
      </div>
    </div>
  );
}
