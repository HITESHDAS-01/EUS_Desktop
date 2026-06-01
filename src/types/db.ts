export type MemberProfile = {
  full_name: string | null;
  phone: string | null;
  photo_url: string | null;
  address: string | null;
  father_husband_name: string | null;
  gender: string | null;
  date_of_birth: string | null;
  aadhaar_vid: string | null;
  nominee_name: string | null;
};

export type MemberRow = {
  id: string;
  member_code: string | null;
  category: 'A' | 'B' | 'C';
  status: string;
  join_date: string;
  initial_investment: number | null;
  monthly_installment: number | null;
  chosen_term_months: number | null;
  loan_interest_rate: number | null;
  profiles: MemberProfile | null;
};

export type MemberInput = {
  member_code: string | null;
  full_name: string;
  phone: string | null;
  photo_url: string | null;
  address: string | null;
  father_husband_name: string | null;
  gender: string | null;
  date_of_birth: string | null;
  aadhaar_vid: string | null;
  nominee_name: string | null;
  category: 'A' | 'B' | 'C';
  status: string | null;
  join_date: string;
  initial_investment: number;
  monthly_installment: number | null;
  chosen_term_months: number | null;
  loan_interest_rate: number | null;
};

export type SavingsRow = {
  id: string;
  member_id: string;
  amount: number;
  penalty: number;
  payment_date: string;
  due_date: string;
  month_year: string;
  receipt_number: string;
  member_code: string | null;
  member_full_name: string | null;
  member_photo_url: string | null;
  member_category: string | null;
};

export type SavingsInput = {
  member_id: string;
  amount: number;
  penalty: number;
  payment_date: string;
  due_date: string;
  month_year: string;
};

export type SavingsUpdate = {
  amount: number;
  penalty: number;
  payment_date: string;
  due_date: string;
  month_year: string;
};

export type LoanRow = {
  id: string;
  member_id: string;
  principal_amount: number;
  interest_rate: number;
  remaining_principal: number;
  status: string;
  disbursed_date: string;
  member_code: string | null;
  member_full_name: string | null;
  member_photo_url: string | null;
};

export type LoanInput = {
  member_id: string;
  principal_amount: number;
  interest_rate: number;
  disbursed_date: string;
};

export type RepaymentRow = {
  id: string;
  loan_id: string;
  amount_paid: number;
  principal_portion: number;
  interest_portion: number;
  payment_date: string;
  receipt_number: string;
};

export type RepaymentInput = {
  loan_id: string;
  principal_portion: number;
  interest_portion: number;
  payment_date: string;
};

export type RepaymentReportRow = RepaymentRow & {
  member_code: string | null;
  member_full_name: string | null;
  member_photo_url: string | null;
};

export type DashboardAlertRow = {
  id: string;
  member_code: string | null;
  full_name: string | null;
  phone: string | null;
  maturity_date: string | null;
  months_remaining: number | null;
  projected_amount: number | null;
};

export type RecentTxRow = {
  member_code: string | null;
  created_at: string;
  amount: number;
  penalty: number;
};

export type DashboardStats = {
  total_treasury: number;
  active_loans: number;
  total_members: number;
  current_month_collection: number;
  total_penalty_collected: number;
  total_interest_earned: number;
  matured_members_count: number;
  pending_installments: number;
  recent_tx: RecentTxRow[];
  overdue: DashboardAlertRow[];
  maturing: DashboardAlertRow[];
};

export type AdminProfile = {
  full_name: string | null;
};

export type StatementBundle = {
  member: MemberRow;
  savings: SavingsRow[];
  loans: LoanRow[];
  repayments: RepaymentRow[];
};

// =========================================================================
// EMI
// =========================================================================

export type Vendor = {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
};

export type VendorInput = { name: string; address: string | null };

export type EmiCustomer = {
  id: string;
  customer_code: string | null;
  full_name: string;
  phone: string | null;
  address: string | null;
  father_husband_name: string | null;
  date_of_birth: string | null;
  aadhaar_vid: string | null;
  pan_number: string | null;
  occupation: string | null;
  monthly_income: number | null;
  nominee_name: string | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
};

export type EmiCustomerInput = Omit<EmiCustomer, 'id' | 'customer_code' | 'created_at'>;

export type EmiLoanStatus = 'active' | 'closed' | 'defaulted' | 'foreclosed';

export type EmiLoan = {
  id: string;
  loan_code: string | null;
  customer_id: string;
  vendor_id: string;
  product_name: string;
  product_category: string | null;
  product_price: number;
  downpayment: number;
  financed_amount: number;
  interest_rate: number;
  tenure_months: number;
  emi_amount: number;
  total_payable: number;
  total_interest: number;
  vendor_paid_amount: number;
  vendor_paid_date: string;
  vendor_invoice_number: string | null;
  disbursed_date: string;
  first_emi_date: string;
  remaining_principal: number;
  status: EmiLoanStatus;
  notes: string | null;
  created_at: string;
  customer_code: string | null;
  customer_name: string | null;
  vendor_name: string | null;
};

export type EmiLoanInput = {
  customer_id: string;
  vendor_id: string;
  product_name: string;
  product_category: string | null;
  product_price: number;
  downpayment: number;
  interest_rate: number;
  tenure_months: number;
  disbursed_date: string;
  first_emi_date: string;
  vendor_invoice_number: string | null;
  notes: string | null;
};

export type EmiLoanUpdate = { status: EmiLoanStatus; notes: string | null };

export type EmiPayment = {
  id: string;
  loan_id: string;
  amount_paid: number;
  principal_portion: number;
  interest_portion: number;
  penalty_portion: number;
  payment_date: string;
  due_date: string;
  month_year: string;
  receipt_number: string;
  payment_method: string | null;
  notes: string | null;
};

export type EmiPaymentInput = Omit<EmiPayment, 'id' | 'receipt_number'>;

export type EmiLoanBundle = {
  loan: EmiLoan;
  customer: EmiCustomer;
  vendor: Vendor;
  payments: EmiPayment[];
};

export type EmiOverdueRow = {
  loan_id: string;
  loan_code: string | null;
  customer_name: string | null;
  customer_code: string | null;
  product_name: string;
  emi_amount: number;
  unpaid_count: number;
  overdue_amount: number;
  earliest_due_date: string;
  days_overdue: number;
};

export type EmiPaymentRecent = {
  id: string;
  loan_id: string;
  amount_paid: number;
  payment_date: string;
  receipt_number: string;
  loan_code: string | null;
  product_name: string | null;
  customer_name: string | null;
};

export type EmiDashboardStats = {
  total_disbursed: number;
  outstanding: number;
  total_collected: number;
  active_count: number;
  closed_count: number;
  foreclosed_count: number;
  defaulted_count: number;
  expected_emi_this_month: number;
  collected_this_month: number;
  overdue: EmiOverdueRow[];
  recent_payments: EmiPaymentRecent[];
};

// =========================================================================
// Investments + External Loans
// =========================================================================

export type ExtInvestment = {
  id: string;
  name: string;
  type: string;
  principal_amount: number;
  expected_roi: number | null;
  start_date: string;
  maturity_date: string | null;
  payout_frequency: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  total_returns: number;
};

export type ExtInvestmentInput = {
  name: string;
  type: string;
  principal_amount: number;
  expected_roi: number | null;
  start_date: string;
  maturity_date: string | null;
  payout_frequency: string | null;
  notes: string | null;
};

export type InvestmentReturn = {
  id: string;
  investment_id: string;
  amount: number;
  return_date: string;
  description: string | null;
  created_at: string;
};

export type InvestmentReturnInput = {
  investment_id: string;
  amount: number;
  return_date: string;
  description: string | null;
};

export type ExtLoan = {
  id: string;
  borrower_name: string;
  phone: string | null;
  address: string | null;
  id_proof: string | null;
  principal_amount: number;
  interest_rate: number;
  start_date: string;
  status: string;
  created_at: string;
};

export type ExtLoanInput = {
  borrower_name: string;
  phone: string | null;
  address: string | null;
  id_proof: string | null;
  principal_amount: number;
  interest_rate: number;
  start_date: string;
};

export type ExtLoanEditInput = {
  borrower_name: string;
  phone: string | null;
  address: string | null;
  id_proof: string | null;
  interest_rate: number;
  status: string;
};

export type ExtLoanTxn = {
  id: string;
  loan_id: string;
  type: string;
  amount: number;
  txn_date: string;
  receipt_number: string | null;
  notes: string | null;
  created_at: string;
};

export type ExtLoanPaymentInput = {
  loan_id: string;
  type: 'Interest Paid' | 'Principal Paid';
  amount: number;
  txn_date: string;
  notes: string | null;
};
