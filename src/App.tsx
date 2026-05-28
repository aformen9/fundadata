import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { OperatorDashboard } from './pages/OperatorDashboard';
import { FoundationDashboard } from './pages/FoundationDashboard';
import { AdminPanel } from './pages/AdminPanel';

// Component that switches between Operator and Foundation dashboard depending on user role
const DashboardSelector: React.FC = () => {
  const { role } = useAuth();

  if (role === 'fundacion') {
    return <FoundationDashboard />;
  }

  if (role === 'operador') {
    return <OperatorDashboard />;
  }

  return null;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<Login />} />

          {/* Core App Layout (Protected) */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <DashboardSelector />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Admin Panel (Protected, Foundation only) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['fundacion']}>
                <Layout>
                  <AdminPanel />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
