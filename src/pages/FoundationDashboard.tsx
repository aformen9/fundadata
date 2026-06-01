import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import type { Dispositivo, FichaNinez, FichaDia, HistorialSeguimiento, EstadoVinculo } from '../types';
import { BarChart, ProgressCircle, AgeSexDistribution } from '../components/CustomCharts';
import { Filter, FileDown, Eye, X, User, ShieldAlert, RefreshCw, Clock, CalendarDays, ClipboardList, TrendingDown, Bell, Users, Search } from 'lucide-react';

interface UnifiedRecord {
  dni: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string;
  sexo: string;
  barrio: string;
  vinculo_id: number;
  dispositivo_id: number;
  dispositivo_nombre: string;
  dispositivo_tipo: 'ninez' | 'dia';
  estado: EstadoVinculo;
  fecha_alta: string;
  fecha_baja: string | null;
  motivo_egreso: string | null;
  // Raw sheets
  ficha_ninez?: FichaNinez;
  ficha_dia?: FichaDia;
}

interface FdAttendanceRow {
  dni: string;
  nombre: string;
  apellido: string;
  dispositivo_id: number;
  dispositivo_nombre: string;
  faltasMes: number;
  consecutivasActuales: number;
}

interface FdCenterStat {
  presentesHoy: number;
  ausentesHoy: number;
  totalActivos: number;
  faltasCriticas: number;
}

export const FoundationDashboard: React.FC = () => {
  const [records, setRecords] = useState<UnifiedRecord[]>([]);
  const [devices, setDevices] = useState<Dispositivo[]>([]);
  const [loading, setLoading] = useState(true);

  // Main view tabs
  const [fdViewMode, setFdViewMode] = useState<'dashboard' | 'asistencia'>('dashboard');

  // Filters
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [selectedBarrio, setSelectedBarrio] = useState<string>('');
  const [selectedEstado, setSelectedEstado] = useState<string>('activo'); // default show active
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Selected for Modal Detail
  const [detailRecord, setDetailRecord] = useState<UnifiedRecord | null>(null);
  const [detailHistory, setDetailHistory] = useState<HistorialSeguimiento[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Stats
  const [deviceStats, setDeviceStats] = useState<{ label: string; value: number }[]>([]);
  const [ageSexStats, setAgeSexStats] = useState<any[]>([]);
  const [kpis, setKpis] = useState({
    totalActive: 0,
    pctSchooled: 0,
    pctCud: 0,
    pctConsumo: 0,
    pctViolencia: 0,
  });

  // Attendance states
  const [fdAttendanceRows, setFdAttendanceRows] = useState<FdAttendanceRow[]>([]);
  const [fdCenterStats, setFdCenterStats] = useState<Record<number, FdCenterStat>>({});
  const [fdAttendanceGlobal, setFdAttendanceGlobal] = useState<{ presentesHoy: number; ausentesHoy: number; porcentajeMes: number; faltasCriticas: number } | null>(null);
  const [loadingFdAttendance, setLoadingFdAttendance] = useState(false);
  const [fdAttFilter, setFdAttFilter] = useState('');
  const [fdAttMinFaltas, setFdAttMinFaltas] = useState('');
  const [fdAttMinConsec, setFdAttMinConsec] = useState('');
  const [fdAttDevice, setFdAttDevice] = useState('');

  const calculateAge = (birthDateString: string) => {
    const birthDate = new Date(birthDateString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch devices
      const { data: devData, error: devError } = await supabase
        .from('dispositivo')
        .select('*');

      if (devError) throw devError;
      setDevices(devData || []);

      // 2. Fetch all vinculos (including persona)
      const { data: vinculos, error: vError } = await supabase
        .from('vinculo')
        .select(`
          id, dni, dispositivo_id, estado, fecha_alta, fecha_baja, motivo_egreso,
          persona (dni, nombre, apellido, fecha_nacimiento, sexo, barrio),
          dispositivo (id, nombre, tipo)
        `);

      if (vError) throw vError;

      // 3. Fetch sheets in parallel to assemble full records
      const { data: nSheets } = await supabase.from('ficha_ninez').select('*');
      const { data: dSheets } = await supabase.from('ficha_dia').select('*');

      const nMap = new Map<number, FichaNinez>();
      const dMap = new Map<number, FichaDia>();

      (nSheets || []).forEach((s) => nMap.set(s.vinculo_id, s));
      (dSheets || []).forEach((s) => dMap.set(s.vinculo_id, s));

      const unified: UnifiedRecord[] = (vinculos || [])
        .map((v: any) => {
          const p = v.persona;
          const dev = v.dispositivo;
          if (!p || !dev) return null;

          return {
            dni: p.dni,
            nombre: p.nombre,
            apellido: p.apellido,
            fecha_nacimiento: p.fecha_nacimiento,
            sexo: p.sexo,
            barrio: p.barrio,
            vinculo_id: v.id,
            dispositivo_id: v.dispositivo_id,
            dispositivo_nombre: dev.nombre,
            dispositivo_tipo: dev.tipo,
            estado: v.estado,
            fecha_alta: v.fecha_alta,
            fecha_baja: v.fecha_baja,
            motivo_egreso: v.motivo_egreso,
            ficha_ninez: nMap.get(v.id),
            ficha_dia: dMap.get(v.id),
          };
        })
        .filter((r) => r !== null) as UnifiedRecord[];

      setRecords(unified);
      computeStats(unified, devData || []);
    } catch (err) {
      console.error('Error loading foundation data:', err);
    } finally {
      setLoading(false);
    }
  };

  const computeStats = (data: UnifiedRecord[], devList: Dispositivo[]) => {
    const active = data.filter((r) => r.estado === 'activo');
    const totalActive = active.length;

    // 1. Device distribution
    const deviceMap = new Map<number, number>();
    devList.forEach((d) => deviceMap.set(d.id, 0));
    active.forEach((r) => {
      deviceMap.set(r.dispositivo_id, (deviceMap.get(r.dispositivo_id) || 0) + 1);
    });

    const activeByDevice = devList.map((d) => ({
      label: d.nombre,
      value: deviceMap.get(d.id) || 0,
    }));
    setDeviceStats(activeByDevice);

    // 2. Sex & Age ranges
    const ranges = [
      { min: 0, max: 5, label: '0-5' },
      { min: 6, max: 12, label: '6-12' },
      { min: 13, max: 17, label: '13-17' },
      { min: 18, max: 35, label: '18-35' },
      { min: 36, max: 60, label: '36-60' },
      { min: 61, max: 150, label: '60+' },
    ];

    const ageMap = ranges.map((r) => ({
      range: r.label,
      masculino: 0,
      femenino: 0,
      otro: 0,
    }));

    active.forEach((r) => {
      const age = calculateAge(r.fecha_nacimiento);
      const sex = r.sexo.toLowerCase();
      const rangeIndex = ranges.findIndex((rng) => age >= rng.min && age <= rng.max);

      if (rangeIndex !== -1) {
        if (sex === 'masculino') {
          ageMap[rangeIndex].masculino++;
        } else if (sex === 'femenino') {
          ageMap[rangeIndex].femenino++;
        } else {
          ageMap[rangeIndex].otro++;
        }
      }
    });
    setAgeSexStats(ageMap);

    // 3. KPI Metrics percentages
    const activeNinez = active.filter((r) => r.dispositivo_tipo === 'ninez');
    const schooledNinez = activeNinez.filter((r) => r.ficha_ninez?.escolarizado).length;
    const pctSchooled = activeNinez.length > 0 ? (schooledNinez / activeNinez.length) * 100 : 0;

    const activeDia = active.filter((r) => r.dispositivo_tipo === 'dia');
    const cudDia = activeDia.filter((r) => r.ficha_dia?.tiene_cud).length;
    const pctCud = activeDia.length > 0 ? (cudDia / activeDia.length) * 100 : 0;

    // Vulnerabilities
    const totalConsumo = active.filter((r) => {
      if (r.dispositivo_tipo === 'ninez') return r.ficha_ninez?.consumo_activo;
      return r.ficha_dia?.consumo_activo;
    }).length;
    const pctConsumo = totalActive > 0 ? (totalConsumo / totalActive) * 100 : 0;

    const totalViolencia = active.filter((r) => {
      if (r.dispositivo_tipo === 'ninez') return r.ficha_ninez?.violencia_familiar;
      return r.ficha_dia?.violencia_familiar;
    }).length;
    const pctViolencia = totalActive > 0 ? (totalViolencia / totalActive) * 100 : 0;

    setKpis({
      totalActive,
      pctSchooled,
      pctCud,
      pctConsumo,
      pctViolencia,
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadAttendanceFoundation = async () => {
    if (records.length === 0) return;
    setLoadingFdAttendance(true);
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.substring(0, 7) + '-01';

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const [{ data: monthAttendance }, { data: recentAttendance }] = await Promise.all([
      supabase.from('registro_asistencia').select('dni, dispositivo_id, fecha, presente')
        .gte('fecha', monthStart).lte('fecha', today).order('fecha', { ascending: false }),
      supabase.from('registro_asistencia').select('dni, dispositivo_id, fecha, presente')
        .gte('fecha', thirtyDaysAgo).lte('fecha', today).order('fecha', { ascending: false }),
    ]);

    const byPersonDevice: Record<string, { fecha: string; presente: boolean }[]> = {};
    for (const r of (monthAttendance || [])) {
      const key = `${r.dni}:${r.dispositivo_id}`;
      if (!byPersonDevice[key]) byPersonDevice[key] = [];
      byPersonDevice[key].push({ fecha: r.fecha, presente: r.presente });
    }

    const byPersonDeviceRecent: Record<string, { fecha: string; presente: boolean }[]> = {};
    for (const r of (recentAttendance || [])) {
      const key = `${r.dni}:${r.dispositivo_id}`;
      if (!byPersonDeviceRecent[key]) byPersonDeviceRecent[key] = [];
      byPersonDeviceRecent[key].push({ fecha: r.fecha, presente: r.presente });
    }

    const activeRecords = records.filter(r => r.estado === 'activo');
    const centerStatsMap: Record<number, FdCenterStat> = {};
    devices.forEach(d => { centerStatsMap[d.id] = { presentesHoy: 0, ausentesHoy: 0, totalActivos: 0, faltasCriticas: 0 }; });

    let globalTotalReg = 0, globalTotalPres = 0, globalCriticas = 0;
    const todayRecords = (monthAttendance || []).filter(r => r.fecha === today);
    const globalPresentesHoy = todayRecords.filter(r => r.presente).length;
    const globalAusentesHoy = todayRecords.filter(r => !r.presente).length;

    const rows: FdAttendanceRow[] = activeRecords.map(person => {
      const key = `${person.dni}:${person.dispositivo_id}`;
      const personRecords = byPersonDevice[key] || [];
      const faltasMes = personRecords.filter(r => !r.presente).length;
      const recentSorted = [...(byPersonDeviceRecent[key] || [])].sort((a, b) => b.fecha.localeCompare(a.fecha));
      let consecutivas = 0;
      for (const r of recentSorted) { if (!r.presente) consecutivas++; else break; }

      globalTotalReg += personRecords.length;
      globalTotalPres += personRecords.filter(r => r.presente).length;
      if (centerStatsMap[person.dispositivo_id]) {
        centerStatsMap[person.dispositivo_id].totalActivos++;
        const todayRec = personRecords.find(r => r.fecha === today);
        if (todayRec) {
          if (todayRec.presente) centerStatsMap[person.dispositivo_id].presentesHoy++;
          else centerStatsMap[person.dispositivo_id].ausentesHoy++;
        }
        if (consecutivas >= 2) { centerStatsMap[person.dispositivo_id].faltasCriticas++; globalCriticas++; }
      }

      return { dni: person.dni, nombre: person.nombre, apellido: person.apellido, dispositivo_id: person.dispositivo_id, dispositivo_nombre: person.dispositivo_nombre, faltasMes, consecutivasActuales: consecutivas };
    });

    const porcentajeMes = globalTotalReg > 0 ? Math.round((globalTotalPres / globalTotalReg) * 100) : 0;
    setFdAttendanceGlobal({ presentesHoy: globalPresentesHoy, ausentesHoy: globalAusentesHoy, porcentajeMes, faltasCriticas: globalCriticas });
    setFdCenterStats(centerStatsMap);
    setFdAttendanceRows(rows);
    setLoadingFdAttendance(false);
  };

  useEffect(() => {
    if (fdViewMode === 'asistencia' && records.length > 0) {
      loadAttendanceFoundation();
    }
  }, [fdViewMode, records.length]);

  // Filter records
  const filteredRecords = records.filter((r) => {
    if (selectedDevice && r.dispositivo_id !== parseInt(selectedDevice)) return false;
    if (selectedEstado && r.estado !== selectedEstado) return false;
    if (selectedDate && r.fecha_alta !== selectedDate) return false;
    if (selectedBarrio && !r.barrio.toLowerCase().includes(selectedBarrio.toLowerCase())) return false;
    return true;
  });

  // Extract unique neighborhoods from records for autocomplete/suggestions if needed,
  // or simply let the user type in. A text input is easier and flexible.

  // Fetch changes history for details modal
  const fetchPersonHistory = async (vinculoId: number) => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('historial_seguimiento')
        .select(`
          id, vinculo_id, timestamp, campo_modificado, valor_anterior, valor_nuevo, user_id
        `)
        .eq('vinculo_id', vinculoId)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // Join/Fetch user emails for display
      const historyWithEmails = [...(data || [])];
      // Since supabase anon key might not let us join auth.users easily without helper trigger,
      // we'll fall back to showing operator UUID or placeholder email if we can't join.
      setDetailHistory(historyWithEmails);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenDetail = (r: UnifiedRecord) => {
    setDetailRecord(r);
    fetchPersonHistory(r.vinculo_id);
  };

  // CSV Exporter
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;

    // Headers
    const headers = [
      'DNI',
      'Nombre',
      'Apellido',
      'Fecha Nacimiento',
      'Sexo',
      'Barrio',
      'Dispositivo',
      'Tipo Dispositivo',
      'Estado Vínculo',
      'Fecha Alta',
      'Fecha Baja',
      'Motivo Egreso',
      'Escolarizado/Tiene CUD',
      'Consumo Activo',
      'Violencia Familiar',
    ];

    const rows = filteredRecords.map((r) => {
      const isNinez = r.dispositivo_tipo === 'ninez';
      const specField = isNinez
        ? r.ficha_ninez?.escolarizado
          ? 'Sí'
          : 'No'
        : r.ficha_dia?.tiene_cud
        ? 'Tiene CUD'
        : 'No tiene CUD';

      const consumo = isNinez
        ? r.ficha_ninez?.consumo_activo
          ? 'Sí'
          : 'No'
        : r.ficha_dia?.consumo_activo
        ? 'Sí'
        : 'No';

      const violencia = isNinez
        ? r.ficha_ninez?.violencia_familiar
          ? 'Sí'
          : 'No'
        : r.ficha_dia?.violencia_familiar
        ? 'Sí'
        : 'No';

      return [
        `"${r.dni}"`,
        `"${r.nombre}"`,
        `"${r.apellido}"`,
        `"${r.fecha_nacimiento}"`,
        `"${r.sexo}"`,
        `"${r.barrio}"`,
        `"${r.dispositivo_nombre}"`,
        `"${r.dispositivo_tipo}"`,
        `"${r.estado}"`,
        `"${r.fecha_alta}"`,
        `"${r.fecha_baja || ''}"`,
        `"${r.motivo_egreso || ''}"`,
        `"${specField}"`,
        `"${consumo}"`,
        `"${violencia}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `FundaData_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to parse extended observations
  const renderExtendedObservations = (record: UnifiedRecord) => {
    let obs: any = {};
    try {
      const rawObs =
        record.dispositivo_tipo === 'ninez'
          ? record.ficha_ninez?.observaciones
          : record.ficha_dia?.observaciones;
      obs = JSON.parse(rawObs || '{}');
    } catch (e) {}

    return (
      <div className="space-y-4">
        {record.dispositivo_tipo === 'ninez' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Educación</span>
              <p className="text-sm font-semibold text-slate-200">
                Escolarizado: {record.ficha_ninez?.escolarizado ? 'Sí' : 'No'}
                {obs.ano_escolar && ` (${obs.ano_escolar})`}
              </p>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Salud & Cuidado</span>
              <p className="text-sm font-semibold text-slate-200">
                Discapacidad: {record.ficha_ninez?.discapacidad ? 'Sí' : 'No'}
              </p>
              <p className="text-sm font-semibold text-slate-200 mt-1">
                Referenciado Salud: {record.ficha_ninez?.referenciado_salud ? 'Sí' : 'No'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Salud & CUD</span>
              <p className="text-sm font-semibold text-slate-200">
                CUD: {record.ficha_dia?.tiene_cud ? 'Sí' : 'No'}
              </p>
              <p className="text-sm font-semibold text-slate-200 mt-1">
                Limitación: {record.ficha_dia?.limitacion_permanente || 'Ninguna'}
              </p>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Social & Educativo</span>
              <p className="text-sm font-semibold text-slate-200">
                Nivel Educativo: {record.ficha_dia?.nivel_educativo || 'Sin dato'}
              </p>
              <p className="text-sm font-semibold text-slate-200 mt-1">
                Habitación: {record.ficha_dia?.situacion_habitacional || 'Sin dato'}
              </p>
              {obs.condicion_actual && (
                <p className="text-xs text-slate-400 mt-2 italic">
                  Diagnóstico: {obs.condicion_actual}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Vulnerability indicators */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
          <span className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Indicadores Sensibles</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-slate-400 font-semibold block">Consumo Activo: {record.ficha_ninez?.consumo_activo || record.ficha_dia?.consumo_activo ? 'Sí 🔴' : 'No 🟢'}</span>
              {(obs.consumo_sustancias || obs.consumo_contexto || obs.consumo_familiar) && (
                <div className="text-[11px] text-slate-400 mt-1 space-y-0.5 bg-slate-900 p-2 rounded border border-slate-800">
                  {obs.consumo_sustancias && <div>• Sustancias: {obs.consumo_sustancias}</div>}
                  {obs.consumo_contexto && <div>• Contexto: {obs.consumo_contexto}</div>}
                  {obs.consumo_familiar && <div>• Familiar: {obs.consumo_familiar}</div>}
                </div>
              )}
            </div>
            <div>
              <span className="text-xs text-slate-400 font-semibold block">Violencia Familiar: {record.ficha_ninez?.violencia_familiar || record.ficha_dia?.violencia_familiar ? 'Sí 🔴' : 'No 🟢'}</span>
              {obs.violencia_detalle && (
                <div className="text-[11px] text-slate-400 mt-1 bg-slate-900 p-2 rounded border border-slate-800">
                  {obs.violencia_detalle}
                </div>
              )}
            </div>
          </div>
        </div>

        {obs.texto_libre && (
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <span className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Observaciones Generales</span>
            <p className="text-xs text-slate-300 italic whitespace-pre-wrap">{obs.texto_libre}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest mb-1">Vista General</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Dashboard Central</h1>
          <p className="text-slate-500 text-sm mt-1">Indicadores de impacto y gestión de dispositivos comunitarios.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Tab navigation */}
          <div className="flex gap-1 bg-slate-900/80 border border-slate-800/60 rounded-xl p-1">
            <button
              onClick={() => setFdViewMode('dashboard')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                fdViewMode === 'dashboard' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              Dashboard
            </button>
            <button
              onClick={() => setFdViewMode('asistencia')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                fdViewMode === 'asistencia' ? 'bg-sky-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              Asistencia
            </button>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900/80 border border-slate-800/60 text-slate-400 hover:text-white rounded-2xl text-sm font-bold transition-all hover:bg-slate-800"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Recargar
          </button>
        </div>
      </div>

      {fdViewMode === 'dashboard' && loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1,2,3,4,5].map((n) => (
            <div key={n} className="h-24 bg-slate-900/60 border border-slate-800/60 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : fdViewMode === 'dashboard' ? (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Total activos — big hero card */}
            <div className="bg-gradient-to-br from-emerald-500/15 to-teal-400/5 border border-emerald-500/25 rounded-2xl p-5 flex flex-col justify-between card-hover relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl" />
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Activos Totales</p>
              <div className="text-5xl font-black text-white mt-1 leading-none">{kpis.totalActive}</div>
              <p className="text-xs text-slate-500 mt-2">personas en todos los centros</p>
            </div>
            <ProgressCircle percentage={kpis.pctSchooled} label="% Escolarizados" />
            <ProgressCircle percentage={kpis.pctCud} label="% con CUD (Día)" colorClass="indigo" />
            <ProgressCircle percentage={kpis.pctConsumo} label="% Consumo Declarado" colorClass="red" />
            <ProgressCircle percentage={kpis.pctViolencia} label="% Violencia Familiar" colorClass="amber" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900/80 border border-slate-800/60 rounded-3xl p-6 shadow-xl card-hover">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-black text-white">Personas Activas por Centro</h3>
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Activos</span>
              </div>
              <BarChart data={deviceStats} />
            </div>
            <div className="bg-slate-900/80 border border-slate-800/60 rounded-3xl p-6 shadow-xl card-hover">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-black text-white">Distribución por Sexo y Edad</h3>
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Activos</span>
              </div>
              <AgeSexDistribution data={ageSexStats} />
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900/80 border border-slate-800/60 rounded-3xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                  <Filter className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-black text-white text-sm">Registros Centralizados</h3>
                  <p className="text-[10px] text-slate-500">{filteredRecords.length} de {records.length} registros</p>
                </div>
              </div>
              <button
                onClick={handleExportCSV}
                disabled={filteredRecords.length === 0}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800/60 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800 rounded-2xl text-xs font-bold transition disabled:opacity-40"
              >
                <FileDown className="w-4 h-4" />
                Exportar CSV
              </button>
            </div>

            {/* Filters */}
            <div className="px-6 py-4 border-b border-slate-800/60 bg-slate-950/30 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Centro</label>
                <select
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900/80 border border-slate-700/60 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
                >
                  <option value="">Todos los centros</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre} ({d.tipo === 'ninez' ? 'Niñez' : 'Día'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Barrio</label>
                <input
                  type="text"
                  placeholder="Escribí un barrio..."
                  value={selectedBarrio}
                  onChange={(e) => setSelectedBarrio(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900/80 border border-slate-700/60 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition placeholder-slate-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Estado</label>
                <select
                  value={selectedEstado}
                  onChange={(e) => setSelectedEstado(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900/80 border border-slate-700/60 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
                >
                  <option value="">Todos los estados</option>
                  <option value="activo">Activo</option>
                  <option value="egresado">Egresado</option>
                  <option value="inasistencia_prolongada">Inasistencia Prolongada</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fecha de Alta</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900/80 border border-slate-700/60 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950/60 border-b border-slate-800/60">
                  <tr>
                    {['DNI','Nombre Completo','Centro','Barrio','Alta','Estado',''].map((h, i) => (
                      <th key={i} className={`px-5 py-3.5 text-[10px] font-black text-slate-500 uppercase tracking-wider ${i === 6 ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-slate-500 text-sm">
                        No se encontraron registros con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r) => (
                      <tr key={r.vinculo_id} className="hover:bg-slate-800/30 transition-colors group">
                        <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-400">{r.dni}</td>
                        <td className="px-5 py-3.5 font-bold text-white">{r.apellido}, {r.nombre}</td>
                        <td className="px-5 py-3.5">
                          <span className="text-slate-300 text-xs">{r.dispositivo_nombre.replace('Centro de ','').replace('Centro de Día ','')}</span>
                          <span className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                            r.dispositivo_tipo === 'ninez' ? 'bg-amber-500/10 text-amber-400' : 'bg-indigo-500/10 text-indigo-400'
                          }`}>
                            {r.dispositivo_tipo === 'ninez' ? 'Niñez' : 'Día'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-400 text-xs">{r.barrio}</td>
                        <td className="px-5 py-3.5 text-slate-500 text-xs">{r.fecha_alta}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                            r.estado === 'activo'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                              : r.estado === 'egresado'
                              ? 'bg-slate-800/60 text-slate-400 border border-slate-700/60'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/15'
                          }`}>
                            <span className={`w-1 h-1 rounded-full ${
                              r.estado === 'activo' ? 'bg-emerald-400' : r.estado === 'egresado' ? 'bg-slate-500' : 'bg-amber-400'
                            }`} />
                            {r.estado}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => handleOpenDetail(r)}
                            className="p-2 bg-slate-800/60 hover:bg-emerald-500 hover:text-slate-950 text-slate-400 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            title="Ver ficha"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 border-t border-slate-800/60 text-[10px] text-slate-600 font-semibold text-right">
              {filteredRecords.length} de {records.length} registros
            </div>
          </div>
        </>
      ) : null}

      {/* ASISTENCIA VIEW */}
      {fdViewMode === 'asistencia' && (
        <div className="space-y-6">
          {/* Global KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="bg-slate-900/80 border border-emerald-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-400 uppercase">Presentes hoy</span>
              </div>
              <p className="text-3xl font-black text-emerald-400">{fdAttendanceGlobal?.presentesHoy ?? '—'}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">todos los centros</p>
            </div>
            <div className="bg-slate-900/80 border border-red-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-xs font-bold text-slate-400 uppercase">Ausentes hoy</span>
              </div>
              <p className="text-3xl font-black text-red-400">{fdAttendanceGlobal?.ausentesHoy ?? '—'}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">todos los centros</p>
            </div>
            <div className="bg-slate-900/80 border border-sky-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <ClipboardList className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold text-slate-400 uppercase">Asistencia mes</span>
              </div>
              <p className="text-3xl font-black text-sky-400">{fdAttendanceGlobal ? `${fdAttendanceGlobal.porcentajeMes}%` : '—'}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">promedio global</p>
            </div>
            <div className="bg-slate-900/80 border border-orange-500/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Bell className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-bold text-slate-400 uppercase">Faltas críticas</span>
              </div>
              <p className="text-3xl font-black text-orange-400">{fdAttendanceGlobal?.faltasCriticas ?? '—'}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">2+ días seguidos</p>
            </div>
          </div>

          {/* Per-center breakdown */}
          {devices.filter(d => d.tipo === 'ninez').length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-white mb-3">Faltas críticas por centro</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {devices.filter(d => d.tipo === 'ninez').map(dev => {
                  const stat = fdCenterStats[dev.id];
                  const criticas = stat?.faltasCriticas ?? 0;
                  return (
                    <div key={dev.id} className={`bg-slate-900/80 border rounded-2xl p-4 ${criticas > 0 ? 'border-orange-500/30' : 'border-slate-800/60'}`}>
                      <p className="text-xs font-bold text-slate-400 truncate mb-1">{dev.nombre}</p>
                      <div className="flex items-end justify-between">
                        <div>
                          <span className={`text-2xl font-black ${criticas > 0 ? 'text-orange-400' : 'text-slate-400'}`}>{criticas}</span>
                          <span className="text-xs text-slate-500 ml-1">críticas</span>
                        </div>
                        <div className="text-right text-[11px] text-slate-500">
                          <div>{stat?.totalActivos ?? 0} activos</div>
                          <div>{stat?.ausentesHoy ?? 0} ausentes hoy</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por nombre o DNI..."
                value={fdAttFilter}
                onChange={(e) => setFdAttFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40 placeholder-slate-600"
              />
            </div>
            <select
              value={fdAttDevice}
              onChange={(e) => setFdAttDevice(e.target.value)}
              className="px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            >
              <option value="">Todos los centros</option>
              {devices.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
            <input
              type="number"
              placeholder="Faltas mes ≥"
              value={fdAttMinFaltas}
              onChange={(e) => setFdAttMinFaltas(e.target.value)}
              className="w-36 px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40 placeholder-slate-600"
              min={0}
            />
            <input
              type="number"
              placeholder="Consecutivas ≥"
              value={fdAttMinConsec}
              onChange={(e) => setFdAttMinConsec(e.target.value)}
              className="w-36 px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40 placeholder-slate-600"
              min={0}
            />
          </div>

          {/* Table */}
          {loadingFdAttendance ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(n => <div key={n} className="h-14 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 text-xs uppercase">
                    <th className="text-left px-4 py-3 font-bold">Nombre</th>
                    <th className="text-left px-4 py-3 font-bold">DNI</th>
                    <th className="text-left px-4 py-3 font-bold">Centro</th>
                    <th className="text-center px-4 py-3 font-bold">Faltas mes</th>
                    <th className="text-center px-4 py-3 font-bold">Consecutivas</th>
                    <th className="text-center px-4 py-3 font-bold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {fdAttendanceRows
                    .filter(row => {
                      const q = fdAttFilter.toLowerCase();
                      const matchQ = !q || `${row.nombre} ${row.apellido}`.toLowerCase().includes(q) || row.dni.includes(q);
                      const matchDev = !fdAttDevice || row.dispositivo_id === parseInt(fdAttDevice);
                      const matchFaltas = !fdAttMinFaltas || row.faltasMes >= parseInt(fdAttMinFaltas);
                      const matchConsec = !fdAttMinConsec || row.consecutivasActuales >= parseInt(fdAttMinConsec);
                      return matchQ && matchDev && matchFaltas && matchConsec;
                    })
                    .map(row => {
                      const isCritical = row.consecutivasActuales >= 2;
                      return (
                        <tr key={`${row.dni}-${row.dispositivo_id}`} className={`transition-colors ${isCritical ? 'bg-orange-500/5 hover:bg-orange-500/10' : 'bg-slate-900/60 hover:bg-slate-800/60'}`}>
                          <td className="px-4 py-3 font-semibold text-white flex items-center gap-2">
                            {isCritical && <span className="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.7)] shrink-0" />}
                            {row.nombre} {row.apellido}
                          </td>
                          <td className="px-4 py-3 text-slate-400 font-mono">{row.dni}</td>
                          <td className="px-4 py-3 text-slate-300 text-xs max-w-xs truncate">{row.dispositivo_nombre.replace('Centro de Niñez ', '').replace('Centro de Día ', '')}</td>
                          <td className="px-4 py-3 text-center font-bold text-slate-300">{row.faltasMes}</td>
                          <td className={`px-4 py-3 text-center font-black ${isCritical ? 'text-orange-400' : 'text-slate-300'}`}>{row.consecutivasActuales}</td>
                          <td className="px-4 py-3 text-center">
                            {isCritical ? (
                              <span className="text-[10px] px-2 py-1 bg-orange-500/15 text-orange-400 border border-orange-500/20 rounded-lg font-bold uppercase">Crítico</span>
                            ) : row.consecutivasActuales === 1 ? (
                              <span className="text-[10px] px-2 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/15 rounded-lg font-bold uppercase">Atención</span>
                            ) : (
                              <span className="text-[10px] px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 rounded-lg font-bold uppercase">Regular</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {fdAttendanceRows.filter(row => {
                const q = fdAttFilter.toLowerCase();
                const matchQ = !q || `${row.nombre} ${row.apellido}`.toLowerCase().includes(q) || row.dni.includes(q);
                const matchDev = !fdAttDevice || row.dispositivo_id === parseInt(fdAttDevice);
                const matchFaltas = !fdAttMinFaltas || row.faltasMes >= parseInt(fdAttMinFaltas);
                const matchConsec = !fdAttMinConsec || row.consecutivasActuales >= parseInt(fdAttMinConsec);
                return matchQ && matchDev && matchFaltas && matchConsec;
              }).length === 0 && (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No hay registros que coincidan con los filtros.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {detailRecord && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-4xl max-h-[88vh] bg-slate-900/95 border border-slate-700/60 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className={`p-5 border-b border-slate-800/60 flex items-center justify-between ${
              detailRecord.dispositivo_tipo === 'ninez'
                ? 'bg-gradient-to-r from-amber-500/8 to-transparent'
                : 'bg-gradient-to-r from-indigo-500/8 to-transparent'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  detailRecord.dispositivo_tipo === 'ninez'
                    ? 'bg-amber-500/15 border border-amber-500/20 text-amber-400'
                    : 'bg-indigo-500/15 border border-indigo-500/20 text-indigo-400'
                }`}>
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base">
                    {detailRecord.nombre} {detailRecord.apellido}
                  </h3>
                  <span className="text-xs text-slate-400">DNI {detailRecord.dni} · {detailRecord.dispositivo_nombre}</span>
                </div>
              </div>
              <button
                onClick={() => { setDetailRecord(null); setDetailHistory([]); }}
                className="p-2 hover:bg-slate-800/60 text-slate-400 hover:text-white rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left col: Details */}
                <div className="lg:col-span-2 space-y-6">
                  {/* General summary */}
                  <div className="bg-slate-950/40 p-4 border border-slate-800 rounded-xl space-y-3">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Detalles Generales</h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 font-semibold block">Sexo:</span>
                        <span className="text-slate-200">{detailRecord.sexo}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block">Edad / Nacimiento:</span>
                        <span className="text-slate-200">
                          {calculateAge(detailRecord.fecha_nacimiento)} años ({detailRecord.fecha_nacimiento})
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block">Barrio de Residencia:</span>
                        <span className="text-slate-200">{detailRecord.barrio}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block">Dispositivo Actual:</span>
                        <span className="text-slate-200">{detailRecord.dispositivo_nombre}</span>
                      </div>
                    </div>
                  </div>

                  {/* Specific Form Fields */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Ficha Técnica</h4>
                    {renderExtendedObservations(detailRecord)}
                  </div>

                  {/* Egreso panel if egresado */}
                  {detailRecord.estado === 'egresado' && (
                    <div className="bg-amber-500/10 border border-amber-500/25 p-4 rounded-xl flex items-start gap-3">
                      <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="block text-xs font-bold text-amber-400">Beneficiario Egresado</span>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          Motivo: {detailRecord.motivo_egreso || 'No especificado'}
                        </p>
                        <span className="text-[10px] text-slate-500 block mt-1">Baja: {detailRecord.fecha_baja}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right col: Follow-up changes history */}
                <div className="lg:col-span-1 border-t lg:border-t-0 lg:border-l border-slate-800 pt-6 lg:pt-0 lg:pl-6 space-y-4">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    Historial de Cambios
                  </h4>

                  {loadingHistory ? (
                    <div className="py-8 text-center text-xs text-slate-500 animate-pulse">Cargando bitácora de seguimiento...</div>
                  ) : detailHistory.length === 0 ? (
                    <div className="p-4 bg-slate-950/50 text-center rounded-xl text-xs text-slate-500">
                      No se registran modificaciones ni traslados previos para este vínculo.
                    </div>
                  ) : (
                    <div className="relative border-l border-slate-800 pl-4 ml-1 space-y-4 max-h-[450px] overflow-y-auto pr-1">
                      {detailHistory.map((item) => (
                        <div key={item.id} className="relative text-xs space-y-1">
                          {/* Dot marker */}
                          <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-900 shadow"></div>
                          
                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>{new Date(item.timestamp).toLocaleString()}</span>
                          </div>
                          
                          <p className="font-semibold text-slate-300">
                            Modificó: <code className="text-teal-400 bg-slate-950/50 px-1 rounded text-[10px]">{item.campo_modificado}</code>
                          </p>
                          
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 flex-wrap bg-slate-950/30 p-1.5 rounded border border-slate-850">
                            <span className="line-through text-red-400/80">{item.valor_anterior || 'vacío'}</span>
                            <span>→</span>
                            <span className="text-emerald-400 font-medium">{item.valor_nuevo || 'vacío'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800/60 bg-slate-950/40 flex justify-end">
              <button
                onClick={() => { setDetailRecord(null); setDetailHistory([]); }}
                className="px-5 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-bold rounded-2xl text-xs transition"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
