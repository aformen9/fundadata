import React, { useEffect, useState } from 'react';
import { supabase, createSecondaryClient } from '../supabaseClient';
import type { Dispositivo, UserRole } from '../types';
import { UserPlus, UserCheck, UserX, Shield, AlertCircle, CheckCircle2 } from 'lucide-react';

interface OperatorWithDevice extends UserRole {
  email?: string;
  activo?: boolean;
  dispositivo_nombre?: string;
}

export const AdminPanel: React.FC = () => {
  const [devices, setDevices] = useState<Dispositivo[]>([]);
  const [operators, setOperators] = useState<OperatorWithDevice[]>([]);
  const [loading, setLoading] = useState(true);

  // Operator Creation Form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedDevice, setSelectedDevice] = useState('');
  
  // Feedback messages
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch devices
      const { data: devData, error: devError } = await supabase
        .from('dispositivo')
        .select('*');

      if (devError) throw devError;
      setDevices(devData || []);

      // 2. Fetch all user roles (except ourselves, but for simplicity show operators)
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role', 'operador');

      if (rolesError) throw rolesError;

      // Join device names
      const operatorsList: OperatorWithDevice[] = (rolesData || []).map((r) => {
        const d = devData?.find((dev) => dev.id === r.dispositivo_id);
        return {
          ...r,
          dispositivo_nombre: d ? d.nombre : 'Sin Asignar',
        };
      });

      setOperators(operatorsList);
    } catch (e: any) {
      console.error(e);
      setErrorMsg('Error al cargar datos del panel: ' + (e.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    if (!email || !password || !selectedDevice) {
      setErrorMsg('Complete todos los campos obligatorios para registrar al operador.');
      setSubmitting(false);
      return;
    }

    try {
      // 1. Initialize secondary isolated Supabase client to prevent logging the current admin out
      const secondary = createSecondaryClient();

      // 2. Sign up the operator
      const { data: authData, error: authError } = await secondary.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('No se pudo registrar al usuario en Supabase Auth.');
      }

      // 3. Associate roles and device inside user_roles (with email and active tracking)
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: 'operador',
          dispositivo_id: parseInt(selectedDevice),
          email: email, // Store email for display
          activo: true, // Activated by default
        });

      if (roleError) {
        // Cleanup created auth user if role assignment fails
        // (Usually handled manually, but let's notify the user)
        throw new Error('Cuenta de autenticación creada, pero falló la asignación de rol: ' + roleError.message);
      }

      setSuccessMsg(`Operador registrado con éxito: ${email}`);
      setEmail('');
      setPassword('');
      setSelectedDevice('');
      await loadData();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error al crear operador: ' + (err.message || ''));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (op: OperatorWithDevice) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const newActiveState = !op.activo;

    try {
      const { error } = await supabase
        .from('user_roles')
        .update({
          activo: newActiveState,
        })
        .eq('id', op.id);

      if (error) throw error;

      setSuccessMsg(`El operador ${op.email} ha sido ${newActiveState ? 'activado' : 'desactivado'} con éxito.`);
      await loadData();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error al actualizar estado del operador: ' + (err.message || ''));
    }
  };

  const handleReassignDevice = async (op: OperatorWithDevice, deviceIdString: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const devId = deviceIdString ? parseInt(deviceIdString) : null;

    try {
      const { error } = await supabase
        .from('user_roles')
        .update({
          dispositivo_id: devId,
        })
        .eq('id', op.id);

      if (error) throw error;

      setSuccessMsg(`Operador ${op.email} reasignado correctamente.`);
      await loadData();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error al reasignar centro: ' + (err.message || ''));
    }
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <Shield className="w-8 h-8 text-emerald-400" />
          Administración de Operadores
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Crea nuevas cuentas de operadores, asígnales sus centros de salud comunitaria y gestiona su estado.
        </p>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/25 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm text-red-400 font-medium">{errorMsg}</div>
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-400 font-medium">{successMsg}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left col: Operator Register Form */}
        <div className="lg:col-span-1">
          <form
            onSubmit={handleCreateOperator}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-5"
          >
            <h3 className="font-bold text-white text-lg flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-400" />
              Nuevo Operador
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  placeholder="operador@fundadata.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">
                  Contraseña Temporal
                </label>
                <input
                  type="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">
                  Dispositivo Asignado
                </label>
                <select
                  required
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition"
                >
                  <option value="">Seleccione un centro...</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre} ({d.tipo === 'ninez' ? 'Niñez' : 'Día'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-600 hover:to-teal-500 text-slate-950 font-bold text-sm rounded-xl transition duration-150 flex items-center justify-center gap-1.5"
            >
              {submitting ? 'Registrando...' : 'Crear Operador'}
            </button>
          </form>
        </div>

        {/* Right col: Table of operators */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-800 bg-slate-900/50">
              <h3 className="font-bold text-white text-base">Operadores Registrados</h3>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500 animate-pulse">Cargando operadores...</div>
            ) : operators.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">No hay operadores registrados en el sistema.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950/60 uppercase font-bold text-slate-500 border-b border-slate-850">
                    <tr>
                      <th className="p-4">Email</th>
                      <th className="p-4">Centro Asignado</th>
                      <th className="p-4 text-center">Estado</th>
                      <th className="p-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {operators.map((op) => (
                      <tr key={op.id} className="hover:bg-slate-850/40 transition">
                        <td className="p-4 font-bold text-white">{op.email || 'operador_sin_email'}</td>
                        <td className="p-4">
                          <select
                            value={op.dispositivo_id || ''}
                            onChange={(e) => handleReassignDevice(op, e.target.value)}
                            className="bg-slate-950 border border-slate-850 rounded-lg text-xs text-white focus:outline-none p-1.5 max-w-[180px]"
                          >
                            <option value="">Sin Asignar</option>
                            {devices.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.nombre}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                            op.activo !== false
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                              : 'bg-red-500/10 text-red-500 border border-red-500/10'
                          }`}>
                            {op.activo !== false ? 'Activo' : 'Desactivado'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleToggleActive(op)}
                            className={`p-1.5 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1 ml-auto ${
                              op.activo !== false
                                ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                            }`}
                          >
                            {op.activo !== false ? (
                              <>
                                <UserX className="w-3.5 h-3.5" />
                                Desactivar
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                Activar
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
