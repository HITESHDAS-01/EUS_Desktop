import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { SettingsProvider } from '@/lib/SettingsContext';
import Login from '@/pages/Login';
import AdminShell from '@/pages/AdminShell';
import AdminHome from '@/pages/admin/AdminHome';
import Members from '@/pages/admin/Members';
import MemberProfile from '@/pages/admin/MemberProfile';
import Transactions from '@/pages/admin/Transactions';
import Loans from '@/pages/admin/Loans';
import Settings from '@/pages/admin/Settings';
import Reports from '@/pages/admin/Reports';
import ProductEmi from '@/pages/admin/ProductEmi';
import EmiCustomerProfile from '@/pages/admin/emi/EmiCustomerProfile';
import EmiLoanProfile from '@/pages/admin/emi/EmiLoanProfile';

function Gate() {
  const { mode } = useAuth();
  if (mode === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        <i className="fas fa-spinner fa-spin text-2xl text-[#1e5a48]"></i>
      </div>
    );
  }
  if (mode !== 'logged-in') return <Login />;

  return (
    <Routes>
      <Route path="/admin" element={<AdminShell />}>
        <Route index element={<AdminHome />} />
        <Route path="members" element={<Members />} />
        <Route path="members/:id" element={<MemberProfile />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="loans" element={<Loans />} />
        <Route path="reports" element={<Reports />} />
        <Route path="emi" element={<ProductEmi />} />
        <Route path="emi/customers/:id" element={<EmiCustomerProfile />} />
        <Route path="emi/loans/:id" element={<EmiLoanProfile />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </SettingsProvider>
  );
}
