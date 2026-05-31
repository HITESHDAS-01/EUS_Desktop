import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { locale } from '@/config/branding';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeFormatDate(
  dateInput: string | Date | null | undefined,
  formatStr = 'dd MMM yyyy',
) {
  if (!dateInput) return 'N/A';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return format(date, formatStr);
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat(locale.currencyLocale, {
    style: 'currency',
    currency: locale.currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// EUS maturity / payout rules — port of eus/src/lib/utils.ts
// ---------------------------------------------------------------------------
type MaturityCategory = 'A' | 'B' | 'C' | string;
type MaturityStatus = 'active' | 'matured' | 'inactive' | 'withdrawn' | 'closed' | string;

export function calculateMaturityAmount(
  category: MaturityCategory,
  initialInvestment: number,
  totalSavings: number,
  roi: number,
  status: MaturityStatus = 'active',
) {
  const earlyExit = status === 'inactive' || status === 'withdrawn' || status === 'closed';
  if (category === 'A') return totalSavings;
  if (category === 'B') {
    if (earlyExit) return initialInvestment;
    return initialInvestment * (1 + roi / 100);
  }
  if (category === 'C') {
    if (earlyExit) return totalSavings;
    return totalSavings * (1 + roi / 100);
  }
  return 0;
}
