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
