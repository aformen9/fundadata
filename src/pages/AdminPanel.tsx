import React, { useEffect, useState } from 'react';
import { supabase, createSecondaryClient } from '../supabaseClient';
import type { Dispositivo, UserRole } from '../types';
import { UserPlus, UserCheck, UserX, Shield, AlertCircle, CheckCircle2, Building2 } from 'lucide-react';

interface OperatorWithDevice extends UserRole {
  email?: string;
  activo?: boolean;
  dispositivo_nombre?: string;
}

function getInitials(email: string) {
  return email ? email.slice(0, 2).toUpperCase() : '??';
}
function getAvatarGradient(email: string) {
  const g = ['from-emerald-500 to-teal-400','from-violet-500 to-purple-400','from-amber-500 to-orange-400','from-sky-500 to-blue-400','from-rose-500 to-pink-400'];
  return g[(email.charCodeAt(0) || 0) % g.length];
}

export const AdminPanel: React.FC = () => {
  const [devices, setDevices] = useState<Dispositivo[]>([]);
  const [operators, setOperators] = useState<OperatorWithDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedDevice, setSelectedDevice] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: devData, error: devError } = await supabase.from('dispositivo').select('*');
      if (devError) throw devError;
      setDevices(devData || []);

      const { data: rolesData, error: rolesError } = await supabase.from('user_roles').select('*').eq('role', 'operador');
      if (rolesError) throw rolesError;

      const operatorsList: OperatorWithDevice[] = (rolesData || []).map((r) => {
        const d = devData?.find((dev) => dev.id === r.dispositivo_id);
        return { ...r, dispositivo_nombre: d ? d.nombre : 'Sin Asignar' };
      });
      setOperators(operatorsList);
    } catch (e: any) {
      setErrorMsg('Error al cargar datos: ' + (e.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreateOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg(null); setSuccessMsg(null); setSubmitting(true);

    if (!email || !password || !selectedDevice) {
      setErrorMsg('Complete todos los campos.'); setSubmitting(false); return;
    }

    try {
      const secondary = createSecondaryClient();
      const { data: authData, error: authError } = await secondary.auth.signUp({ email, password });
      if (authError) throw authError;
      if (!authData.user) throw new Error('No se pudo registrar el usuario.');

      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: authData.user.id,
        role: 'operador',
        dispositivo_id: parseInt(selectedDevice),
        email,
        activo: true,
      });
      if (roleError) throw new Error('Auth creada, pero falló la asignación de rol: ' + roleError.message);

      setSuccessMsg(`Operador registrado con éxito: ${email}`);
      setEmail(''); setPassword(''); setSelectedDevice('');
      await loadData();
    } catch (err: any) {
      setErrorMsg('Error: ' + (err.message || ''));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (op: OperatorWithDevice) => {
    setErrorMsg(null); setSuccessMsg(null);
    try {
      const { error } = await supabase.from('user_roles').update({ activo: !op.activo }).eq('id', op.id);
      if (error) throw error;
      setSuccessMsg(`Operador ${op.email} ${!op.activo ? 'activado' : 'desactivado'}.`);
      await loadData();
    } catch (err: any) {
      setErrorMsg('Error: ' + (err.message || ''));
    }
  };

  const handleReassignDevice = async (op: OperatorWithDevice, deviceIdString: string) => {
    setErrorMsg(null); setSuccessMsg(null);
    try {
      const devId = deviceIdString ? parseInt(deviceIdString) : null;
      const { error } = await supabase.from('user_roles').update({ dispositivo_id: devId }).eq('id', op.id);
      if (error) throw error;
      setSuccessMsg(`Operador ${op.email} reasignado.`);
      await loadData();
    } catch (err: any) {
      setErrorMsg('Error: ' + (err.message || ''));
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-violet-500/15 border border-violet-500/25 rounded-2xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Administración de Operadores</h1>
            <p className="text-slate-500 text-sm">Gestioná los accesos al sistema por centro comunitario.</p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="animate-slideDown flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/25 rounded-2xl">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300 font-medium">{errorMsg}</p>
        </div>
      )}
      {successMsg && (
        <div className="animate-slideDown flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-300 font-medium">{successMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Create operator form ── */}
        <div className="lg:col-span-1">
          <form
            onSubmit={handleCreateOperator}
            className="bg-slate-900/80 border border-slate-800/60 rounded-3xl p-6 space-y-5 shadow-xl"
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 bg-emerald-500/15 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="font-black text-white text-base">Nuevo Operador</h3>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Correo Electrónico</label>
              <input
                type="email" required placeholder="operador@fundadata.org" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950/80 border border-slate-700/60 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition placeholder-slate-600"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Contraseña Temporal</label>
              <input
                type="password" required placeholder="Mínimo 6 caracteres" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950/80 border border-slate-700/60 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition placeholder-slate-600"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Centro Asignado</label>
              <select
                required value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950/80 border border-slate-700/60 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition"
              >
                <option value="">Seleccione un centro...</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre} ({d.tipo === 'ninez' ? 'Niñez' : 'Día'})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit" disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-600 hover:to-teal-500 text-slate-950 font-black text-sm rounded-2xl transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              {submitting ? 'Creando...' : 'Crear Operador'}
            </button>
          </form>
        </div>

        {/* ── Operators table ── */}
        <div className="lg:col-span-2">
          <div className="bg-slate-900/80 border border-slate-800/60 rounded-3xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800/60 flex items-center justify-between">
              <h3 className="font-black text-white">Operadores Registrados</h3>
              <span className="text-xs text-slate-500 font-semibold">{operators.length} total</span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500 text-sm animate-pulse">Cargando operadores...</div>
            ) : operators.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Building2 className="w-6 h-6 text-slate-600" />
                </div>
                <p className="text-slate-500 text-sm">No hay operadores registrados aún.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {operators.map((op) => (
                  <div key={op.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-800/30 transition-colors">
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getAvatarGradient(op.email || '')} flex items-center justify-center text-[11px] font-black text-slate-950 shrink-0`}>
                      {getInitials(op.email || '')}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{op.email || 'sin email'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          op.activo !== false
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                            : 'bg-red-500/10 text-red-400 border border-red-500/15'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${op.activo !== false ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          {op.activo !== false ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                    </div>

                    {/* Device select */}
                    <select
                      value={op.dispositivo_id || ''}
                      onChange={(e) => handleReassignDevice(op, e.target.value)}
                      className="hidden sm:block bg-slate-950/60 border border-slate-800/60 rounded-xl text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 py-1.5 px-2 max-w-[160px]"
                    >
                      <option value="">Sin Asignar</option>
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>{d.nombre}</option>
                      ))}
                    </select>

                    {/* Toggle button */}
                    <button
                      onClick={() => handleToggleActive(op)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        op.activo !== false
                          ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                      }`}
                    >
                      {op.activo !== false
                        ? <><UserX className="w-3.5 h-3.5" /> Desactivar</>
                        : <><UserCheck className="w-3.5 h-3.5" /> Activar</>
                      }
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
