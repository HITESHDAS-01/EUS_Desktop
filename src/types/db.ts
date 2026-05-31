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
};
