import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Heart, Building2, LayoutDashboard, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, role, dispositivoNombre, signOut } = useAuth();
  const location = useLocation();

  const handleLogout = async () => {
    if (window.confirm('¿Seguro que desea cerrar sesión?')) {
      await signOut();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Glassmorphic Navigation Bar */}
      <nav className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/10">
              <Heart className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <span className="font-extrabold text-xl bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent tracking-tight">
                FundaData
              </span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest bg-emerald-500/15 text-emerald-400 rounded-full border border-emerald-500/20">
                Salud Comunitaria
              </span>
            </div>
          </div>

          {/* Quick Info & Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden md:flex flex-col items-end text-right">
              <span className="text-sm font-semibold text-slate-200">
                {user?.email}
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                {role === 'fundacion' ? (
                  <>
                    <Building2 className="w-3 h-3 text-emerald-400" />
                    Fundación (Administrador)
                  </>
                ) : (
                  <>
                    <Building2 className="w-3 h-3 text-teal-400" />
                    Operador • {dispositivoNombre}
                  </>
                )}
              </span>
            </div>

            {/* Mobile role badge */}
            <div className="md:hidden px-2 py-1 text-xs rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-300">
              {role === 'fundacion' ? 'Admin' : dispositivoNombre || 'Operador'}
            </div>

            {role === 'fundacion' && (
              <div className="flex items-center gap-1 border-l border-slate-800 pl-3">
                <Link
                  to="/"
                  className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold ${
                    location.pathname === '/'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                  title="Dashboard Central"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden lg:inline">Dashboard</span>
                </Link>
                <Link
                  to="/admin"
                  className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold ${
                    location.pathname === '/admin'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                  title="Administrar Operadores"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden lg:inline">Operadores</span>
                </Link>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-red-500/15 hover:border-red-500/30 text-slate-400 hover:text-red-400 transition-all duration-200"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-900 bg-slate-950/80 text-center text-xs text-slate-500">
        <p>© 2026 FundaData. Panel de Gestión e Impacto en Salud Comunitaria.</p>
      </footer>
    </div>
  );
};
