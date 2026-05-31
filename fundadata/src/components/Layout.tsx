import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Heart, Building2, LayoutDashboard, Settings, ChevronDown } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

function getInitials(email: string) {
  return email ? email.slice(0, 2).toUpperCase() : 'U';
}

function getAvatarColor(email: string) {
  const colors = [
    'from-emerald-500 to-teal-400',
    'from-violet-500 to-purple-400',
    'from-amber-500 to-orange-400',
    'from-sky-500 to-blue-400',
    'from-rose-500 to-pink-400',
  ];
  const idx = email.charCodeAt(0) % colors.length;
  return colors[idx];
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, role, dispositivoNombre, signOut } = useAuth();
  const location = useLocation();
  const initials = getInitials(user?.email || '');
  const avatarGradient = getAvatarColor(user?.email || '');

  const handleLogout = async () => {
    if (window.confirm('¿Seguro que desea cerrar sesión?')) {
      await signOut();
    }
  };

  const navLinks = role === 'fundacion' ? [
    { to: '/', icon: <LayoutDashboard className="w-4 h-4" />, label: 'Dashboard' },
    { to: '/admin', icon: <Settings className="w-4 h-4" />, label: 'Operadores' },
  ] : [];

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-40 glass border-b border-slate-800/60 shadow-xl shadow-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative w-9 h-9">
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Heart className="w-4.5 h-4.5 text-slate-950" strokeWidth={2.5} />
              </div>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-black text-lg bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent tracking-tight">
                FundaData
              </span>
              <span className="hidden sm:block text-[10px] text-emerald-400/70 font-semibold uppercase tracking-widest -mt-0.5">
                Salud Comunitaria
              </span>
            </div>
          </div>

          {/* Nav links (foundation only) */}
          {navLinks.length > 0 && (
            <div className="hidden md:flex items-center gap-1 bg-slate-900/60 border border-slate-800/60 rounded-xl p-1">
              {navLinks.map(({ to, icon, label }) => {
                const active = location.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all duration-150 ${
                      active
                        ? 'bg-gradient-to-r from-emerald-500/20 to-teal-400/10 text-emerald-400 border border-emerald-500/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    {icon}
                    {label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Right side: user info + logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Role badge */}
            <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
              role === 'fundacion'
                ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}>
              <Building2 className="w-3 h-3" />
              {role === 'fundacion' ? 'Admin' : dispositivoNombre || 'Operador'}
            </div>

            {/* Avatar + email */}
            <div className="hidden md:flex items-center gap-2.5 bg-slate-900/60 border border-slate-800/60 rounded-xl px-3 py-1.5">
              <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-[10px] font-black text-slate-950 shrink-0`}>
                {initials}
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-semibold text-slate-200 truncate max-w-[140px]">{user?.email}</span>
                <span className="text-[10px] text-slate-500">{role === 'fundacion' ? 'Administrador' : 'Operador'}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
            </div>

            {/* Mobile nav (foundation) */}
            {navLinks.length > 0 && (
              <div className="flex md:hidden items-center gap-1">
                {navLinks.map(({ to, icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`p-2 rounded-xl transition-all ${
                      location.pathname === to
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    {icon}
                  </Link>
                ))}
              </div>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/60 text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/25 transition-all duration-200"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Main ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8 animate-fadeIn">
        {children}
      </main>

      {/* ── Footer ── */}
      <footer className="py-5 border-t border-slate-900 text-center">
        <p className="text-[11px] text-slate-600 font-medium">
          © 2026 FundaData · Panel de Gestión e Impacto en Salud Comunitaria
        </p>
      </footer>
    </div>
  );
};
