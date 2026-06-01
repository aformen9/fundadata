import React, { useEffect } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { ShieldAlert, LogOut, Clock, Loader2, MessageCircle } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'operador' | 'fundacion'>;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, role, loading, signOut } = useAuth();

  useEffect(() => {
    if (user && role === null) {
      supabase.from('user_roles').insert({
        user_id: user.id,
        role: 'pendiente',
        email: user.email,
        activo: false,
      }).then(() => {});
    }
  }, [user, role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-5">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-2 border-emerald-500/15 animate-ping" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-emerald-500 animate-spin" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-slate-300 font-semibold text-sm">Cargando FundaData</p>
          <p className="text-slate-500 text-xs mt-1 animate-pulse">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (role === null) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 text-center shadow-2xl animate-fadeIn">
          <div className="mx-auto w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mb-6">
            <Clock className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Rol Pendiente</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Tu cuenta fue creada correctamente. Comunicate con la Fundación para que te asignen un rol de operador y un centro de trabajo.
          </p>
          <a
            href={`https://wa.me/5493471570122?text=${encodeURIComponent(`Hola, me registré en FundaData con el correo ${user.email} y necesito que me asignen un centro de trabajo.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full mb-4 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-600 hover:to-teal-500 text-slate-950 font-black text-sm rounded-2xl transition-all duration-200 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            Contactar a soporte por WhatsApp
          </a>
          <button
            onClick={() => signOut()}
            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 font-semibold text-sm"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 text-center shadow-2xl animate-fadeIn">
          <div className="mx-auto w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mb-6">
            <ShieldAlert className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Acceso No Autorizado</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            No tenés los permisos necesarios para acceder a esta sección de la plataforma.
          </p>
          <button
            onClick={() => signOut()}
            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl transition-all flex items-center justify-center gap-2 font-semibold text-sm"
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
