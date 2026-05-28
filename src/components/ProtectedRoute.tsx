import React from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, LogOut, Clock } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'operador' | 'fundacion'>;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, role, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-emerald-500 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
        </div>
        <p className="mt-4 text-slate-400 font-medium animate-pulse">Cargando perfil de FundaData...</p>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated but no role assigned yet (pending registration status)
  if (role === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-xl backdrop-blur-sm">
          <div className="mx-auto w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-6">
            <Clock className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Rol Pendiente de Asignación</h2>
          <p className="text-slate-400 mb-8 leading-relaxed">
            Tu cuenta ha sido creada correctamente. Comunícate con la Fundación para que se te asigne un rol de operador y un dispositivo (centro) de trabajo.
          </p>
          <div className="space-y-4">
            <div className="text-xs text-slate-500 border border-slate-800 rounded-lg p-3 bg-slate-950/50">
              <span className="block font-semibold text-slate-400 mb-1">User ID para la Fundación:</span>
              <code className="break-all font-mono text-emerald-400">{user.id}</code>
            </div>
            <button
              onClick={() => signOut()}
              className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl transition duration-200 flex items-center justify-center gap-2 font-medium"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated but does not have permission for this route
  if (allowedRoles && !allowedRoles.includes(role)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-xl">
          <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Acceso No Autorizado</h2>
          <p className="text-slate-400 mb-8 leading-relaxed">
            No tienes los permisos necesarios para acceder a esta sección de la plataforma.
          </p>
          <button
            onClick={() => signOut()}
            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl transition duration-200 flex items-center justify-center gap-2 font-medium"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión o Cambiar Cuenta
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
