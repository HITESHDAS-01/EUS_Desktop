import { useState } from 'react';

type Topic = {
  id: string;
  title: string;
  icon: string;
  body: { heading?: string; steps?: string[]; note?: string; tip?: string }[];
};

const TOPICS: Topic[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: 'fas fa-rocket',
    body: [
      {
        heading: 'First-time setup',
        steps: [
          'When you launch the app for the first time, a setup wizard runs you through organisation details, your admin name + password, and default ROI rates.',
          'After Finish you land on the Dashboard — pre-populated with zeros and ready for your first member.',
        ],
      },
      {
        heading: 'Where is my data?',
        steps: [
          'Everything is stored locally in a single SQLite file at: %APPDATA%\\in.eus.desktop\\eus.db',
          'Member photos go to %APPDATA%\\in.eus.desktop\\photos\\',
          'Both are included in the backup .zip from Settings → Data Backup.',
        ],
        tip: 'There is no cloud sync. The data lives only on this computer. Take regular backups to a USB drive or external location.',
      },
    ],
  },
  {
    id: 'members',
    title: 'Members',
    icon: 'fas fa-users',
    body: [
      {
        heading: 'Add a new member',
        steps: [
          'Sidebar → Members → click "Add New Member".',
          'Member ID auto-generates as <PREFIX>/MMYYYY/<Cat>/<seq> (e.g. EUS/052026/C/001). You can override it.',
          'Choose Category: A (Founder, ₹1000/mo), B (Investor, one-time), or C (Public, ₹100/mo).',
          'Initial Investment is required for Cat A and B. Cat C members start at 0 and pay monthly installments.',
          'Photo is optional. JPG/PNG/WebP, max 2 MB. Stored locally.',
        ],
      },
      {
        heading: 'Edit / Delete / Print Statement',
        steps: [
          'Each row has three icons on the right: 🖨️ Statement (PDF), ✏️ Edit, 🗑️ Delete.',
          'Click anywhere else on a member row to open their full profile (savings + loan history).',
          'Select multiple members via checkboxes for bulk delete.',
        ],
        note: 'Deleting a member cascades — all their savings, loans, and repayments are removed too. Cannot be undone (except by restoring a backup).',
      },
    ],
  },
  {
    id: 'transactions',
    title: 'Transactions (Savings)',
    icon: 'fas fa-rupee-sign',
    body: [
      {
        heading: 'Record a monthly installment',
        steps: [
          'Sidebar → Transactions → click "Record Installment".',
          'Pick a Cat A or Cat C member (Cat B has no monthly installments).',
          'Payment date defaults to today. Amount pre-fills from the member\'s monthly installment.',
          'If you record a date past the due-day + grace period, a penalty (5% by default) auto-applies. You can override it.',
          'Each installment generates a unique receipt number (RCPT-YYYYMMDDHHMMSS-XXXX).',
        ],
      },
      {
        heading: 'Filter and edit',
        steps: [
          'Use the Month + Member filters above the table.',
          'Edit pencil reopens the form with the original values; member cannot be changed (audit trail).',
        ],
      },
    ],
  },
  {
    id: 'loans',
    title: 'Member Loans',
    icon: 'fas fa-hand-holding-usd',
    body: [
      {
        heading: 'Disburse a loan',
        steps: [
          'Sidebar → Loans → "Disburse New Loan" tab.',
          'Pick a member. The app calculates max loan = 80% of (savings − any existing loan balance).',
          'Enter Loan Amount, Interest Rate (% per month), and Disbursement Date.',
          'Click "Disburse Loan". The loan appears in the Active Loans table below.',
        ],
      },
      {
        heading: 'Record a repayment',
        steps: [
          'Switch to "Record Repayment" tab.',
          'Pick the active loan. Interest is estimated as 1 month × current outstanding × rate.',
          'Enter Principal Amount and Interest Amount. Total reduces the outstanding atomically.',
          'When outstanding hits 0, the loan auto-closes.',
        ],
      },
    ],
  },
  {
    id: 'emi',
    title: 'Product EMI',
    icon: 'fas fa-mobile-alt',
    body: [
      {
        heading: 'Add a vendor and customer',
        steps: [
          'Product EMI → Vendors tab → "Add Vendor". Name is required; address is optional.',
          'Product EMI → Customers tab → "Add Customer". KYC fields (Aadhaar, PAN, income) are optional but useful.',
          'Customer code auto-generates as <PREFIX>/EMI/C/MMYYYY/NNN.',
        ],
      },
      {
        heading: 'Create an EMI loan',
        steps: [
          'Product EMI → EMI Loans tab → "Create EMI Loan".',
          'Pick the customer + vendor. Enter product details + price + downpayment + interest rate + tenure.',
          'The app live-computes financed amount, total interest (flat), total payable, and monthly EMI.',
          'Loan code generates as <PREFIX>/EMI/L/MMYYYY/NNN.',
        ],
      },
      {
        heading: 'Record an EMI payment',
        steps: [
          'Click a loan to open its profile.',
          '"Record Payment" pre-fills with the next due EMI\'s principal + interest breakdown.',
          'Penalty auto-fills based on payment date vs due date + grace period — editable.',
          'Total must equal Principal + Interest + Penalty. Save → schedule row turns green.',
        ],
      },
      {
        heading: 'Foreclose a loan',
        steps: [
          'On the loan profile, click "Foreclose".',
          'Customer pays the full remaining principal in one shot — no interest charged on the closing.',
          'Loan status switches to "Foreclosed" (separate from "Closed" so reports can distinguish).',
        ],
      },
    ],
  },
  {
    id: 'investments',
    title: 'Investments & External Loans',
    icon: 'fas fa-chart-line',
    body: [
      {
        heading: 'Portfolio',
        steps: [
          'Sidebar → Investments → Portfolio tab.',
          '"New Investment" — track stocks, business, SIP, personal loans (non-member), real estate, etc.',
          'Each investment has Principal + Expected ROI + Start Date + Maturity Date + Payout Frequency.',
          'On an Active investment, click "+ Add Return" to record dividends/payouts as they come in.',
          'Maturity Calendar (right side) lists investments maturing within 3 months.',
        ],
      },
      {
        heading: 'External (personal) loans',
        steps: [
          'Investments → External Loans tab.',
          '"New Borrower & Loan" — record loans the org has given to non-members.',
          'The app auto-generates a monthly "Interest Due" entry for each active loan on every page load.',
          'Open "Ledger & Payments" to see the running debit/credit log and record Interest Paid or Principal Paid.',
        ],
      },
    ],
  },
  {
    id: 'reports',
    title: 'Reports',
    icon: 'fas fa-chart-bar',
    body: [
      {
        heading: 'Five report tabs',
        steps: [
          'Maturity Report — every active member with projected payout based on category, term, and ROI.',
          'Collection Report — savings + penalty collected in a date range.',
          'Defaulter Report — active Cat A/C members who haven\'t paid for the selected month range.',
          'Interest Earned — loan-repayment interest in a date range.',
          'Monthly Sheet — this month\'s paid/late/pending status for every active member.',
        ],
        tip: 'Defaulter and Monthly Sheet use month_year (the month the installment is FOR), so a late payment recorded next month still counts for the original month.',
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: 'fas fa-cog',
    body: [
      {
        heading: 'System Parameters',
        steps: [
          'ROI %, penalty %, due day, grace days, loan eligibility %.',
          'Changes apply instantly — no restart needed.',
        ],
      },
      {
        heading: 'Organisation Profile',
        steps: [
          'Org name (English + native script), short code, tagline, contact info, logo URL.',
          'Member-code prefix lives here too — change it before adding members to keep IDs consistent.',
          'Logo URL: paste a public image URL or leave blank to show text initials in the sidebar.',
        ],
      },
      {
        heading: 'Security',
        steps: [
          'Change your administrator name (shown in top header).',
          'Change password — requires current password.',
        ],
      },
      {
        heading: 'Data Backup',
        steps: [
          'Click "Backup Now" → choose where to save a .zip.',
          'The zip contains the full SQLite database + all member photos.',
          'Take a backup weekly and copy it to a USB drive. Restore is manual for now (paste eus.db back).',
        ],
        tip: 'A backup taken while the app is running checkpoints the WAL first, so it captures live state.',
      },
    ],
  },
];

export default function Help() {
  const [active, setActive] = useState<string>(TOPICS[0].id);
  const topic = TOPICS.find((t) => t.id === active) || TOPICS[0];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Help &amp; User Guide</h2>
        <p className="text-sm text-gray-500 mt-1">
          Quick how-to for every feature. Hand this to a new admin so they can self-onboard.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left nav */}
        <nav className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 h-fit lg:sticky lg:top-4">
          <ul className="space-y-1">
            {TOPICS.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setActive(t.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 text-sm transition-colors ${
                    active === t.id
                      ? 'bg-[#1e5a48] text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <i className={`${t.icon} w-5 text-center ${active === t.id ? 'text-[#f7b05e]' : 'text-gray-400'}`}></i>
                  <span className="font-medium">{t.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Right content */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="w-10 h-10 rounded-full bg-[#1e5a48]/10 text-[#1e5a48] flex items-center justify-center">
              <i className={topic.icon}></i>
            </div>
            <h3 className="text-xl font-bold text-gray-800">{topic.title}</h3>
          </div>

          {topic.body.map((section, idx) => (
            <div key={idx} className="space-y-3">
              {section.heading && <h4 className="font-semibold text-gray-800">{section.heading}</h4>}
              {section.steps && (
                <ol className="space-y-2 text-sm text-gray-700 list-decimal ml-5">
                  {section.steps.map((s, i) => (
                    <li key={i} className="leading-relaxed">{s}</li>
                  ))}
                </ol>
              )}
              {section.tip && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800 flex gap-2">
                  <i className="fas fa-lightbulb mt-0.5"></i>
                  <span><strong>Tip:</strong> {section.tip}</span>
                </div>
              )}
              {section.note && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-800 flex gap-2">
                  <i className="fas fa-exclamation-triangle mt-0.5"></i>
                  <span><strong>Note:</strong> {section.note}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
