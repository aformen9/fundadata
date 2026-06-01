import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router';
import { Heart, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, Users, MessageCircle } from 'lucide-react';

const TWILIO_WA_URL = `https://wa.me/14155238886?text=${encodeURIComponent('join music-report')}`;

export const Login: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showTutorPanel, setShowTutorPanel] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping" />
            <div className="absolute inset-0 rounded-full border-2 border-t-emerald-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          </div>
          <p className="text-slate-400 text-sm animate-pulse">Iniciando aplicación...</p>
        </div>
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    if (!email || !password) { setErrorMsg('Por favor complete todos los campos.'); setLoading(false); return; }
    if (password.length < 6) { setErrorMsg('La contraseña debe tener al menos 6 caracteres.'); setLoading(false); return; }

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user && data.session === null) {
          setSuccessMsg('Registro exitoso. Revisa tu correo para confirmar la cuenta o intentá iniciar sesión.');
          setEmail(''); setPassword(''); setIsSignUp(false);
        } else if (data.user && data.session) {
          setSuccessMsg('Registro exitoso e inicio de sesión automático.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocurrió un error inesperado. Inténtelo nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center relative overflow-hidden px-4">

      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="animate-blob absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/8 blur-[100px]" />
        <div className="animate-blob-delay absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-teal-400/6 blur-[100px]" />
        <div className="animate-blob absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-emerald-600/4 blur-[120px]" style={{ animationDelay: '4s' }} />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Logo + Title */}
      <div className="relative z-10 text-center mb-8 animate-fadeIn">
        <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/30 mb-5 glow-emerald">
          <Heart className="w-8 h-8 text-slate-950" strokeWidth={2.5} />
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight">
          Funda<span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Data</span>
        </h1>
        <p className="mt-2 text-slate-400 text-sm font-medium">Fundación de Salud Comunitaria</p>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md animate-fadeIn" style={{ animationDelay: '0.1s' }}>
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl shadow-black/40">

          {/* Tabs */}
          <div className="flex bg-slate-950/60 rounded-2xl p-1 mb-7 gap-1">
            {[{ label: 'Iniciar Sesión', value: false }, { label: 'Registrarse', value: true }].map(({ label, value }) => (
              <button
                key={label}
                type="button"
                onClick={() => { setIsSignUp(value); setErrorMsg(null); setSuccessMsg(null); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  isSignUp === value
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-lg'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-950/80 border border-slate-700/60 text-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-sm transition-all placeholder-slate-600"
                  placeholder="usuario@ejemplo.com"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3.5 bg-slate-950/80 border border-slate-700/60 text-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-sm transition-all placeholder-slate-600"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {errorMsg && (
              <div className="animate-slideDown flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/25 rounded-2xl">
                <AlertCircle className="w-4.5 h-4.5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300 font-medium leading-relaxed">{errorMsg}</p>
              </div>
            )}

            {/* Success */}
            {successMsg && (
              <div className="animate-slideDown flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-sm text-emerald-300 font-medium leading-relaxed">{successMsg}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl font-bold text-sm text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-500 hover:to-teal-400 transition-all duration-200 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                  Cargando...
                </>
              ) : isSignUp ? 'Crear Cuenta' : 'Ingresar'}
            </button>
          </form>

        </div>

        {/* Soy tutor button */}
        <button
          type="button"
          onClick={() => setShowTutorPanel(v => !v)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-slate-700/50 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/40 transition-all text-sm font-semibold"
        >
          <Users className="w-4 h-4" />
          {showTutorPanel ? 'Cerrar' : 'Soy tutor'}
        </button>
      </div>

      {/* Tutor panel */}
      {showTutorPanel && (
        <div className="relative z-10 w-full max-w-2xl mt-4 px-4 animate-fadeIn">
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-2xl shadow-black/40">
            <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-slate-700/40 gap-0">
              {/* Left: QR */}
              <div className="flex-1 flex flex-col items-center gap-4 px-4 py-4 sm:py-2">
                <p className="text-sm text-slate-300 text-center leading-relaxed">
                  Si tu número <span className="text-emerald-400 font-semibold">no se encuentra registrado</span>, escanee el siguiente QR:
                </p>
                <div className="w-44 h-44 rounded-2xl border border-slate-700/50 bg-white p-2 flex items-center justify-center">
                  <QRCodeSVG value={TWILIO_WA_URL} size={160} />
                </div>
              </div>

              {/* Right: Support */}
              <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 py-4 sm:py-2">
                <p className="text-sm text-slate-300 text-center leading-relaxed">
                  Si su número <span className="text-emerald-400 font-semibold">ya está registrado</span> y tiene alguna consulta:
                </p>
                <a
                  href="https://wa.me/5493471570122"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 py-3 px-6 rounded-2xl font-bold text-sm text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-500 hover:to-teal-400 transition-all duration-200 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40"
                >
                  <MessageCircle className="w-4 h-4" />
                  Contactar a soporte
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="relative z-10 text-center text-xs text-slate-600 mt-6">
        © 2026 FundaData · Salud Comunitaria
      </p>
    </div>
  );
};
