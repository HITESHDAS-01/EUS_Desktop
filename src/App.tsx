import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import Login from '@/pages/Login';
import AdminShell from '@/pages/AdminShell';
import Members from '@/pages/Members';

function Gate() {
  const { mode } = useAuth();

  if (mode === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }
  if (mode !== 'logged-in') {
    return <Login />;
  }
  return (
    <Routes>
      <Route element={<AdminShell />}>
        <Route path="/members" element={<Members />} />
        <Route path="*" element={<Navigate to="/members" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
