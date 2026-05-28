import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Dispositivo, FichaNinez, FichaDia, HistorialSeguimiento, EstadoVinculo } from '../types';
import { BarChart, ProgressCircle, AgeSexDistribution } from '../components/CustomCharts';
import { Filter, FileDown, Eye, X, User, ShieldAlert, RefreshCw, Clock } from 'lucide-react';

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

export const FoundationDashboard: React.FC = () => {
  const [records, setRecords] = useState<UnifiedRecord[]>([]);
  const [devices, setDevices] = useState<Dispositivo[]>([]);
  const [loading, setLoading] = useState(true);

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
    <div className="space-y-8">
      {/* Dashboard Title & Quick Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Dashboard Central</h1>
          <p className="text-slate-400 text-sm mt-1">
            Fundación de Salud Comunitaria • Indicadores de Impacto y Gestión de Dispositivos.
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-sm font-semibold transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Recargar
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-28 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse"></div>
          ))}
        </div>
      ) : (
        <>
          {/* Key KPI Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-gradient-to-br from-emerald-500/10 to-teal-400/5 border border-emerald-500/20 rounded-2xl p-5 shadow-sm">
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Activos Totales</span>
              <div className="text-4xl font-black text-white mt-2">{kpis.totalActive}</div>
              <p className="text-xs text-slate-500 mt-1">En todos los centros</p>
            </div>
            <ProgressCircle percentage={kpis.pctSchooled} label="% Escolarizados" />
            <ProgressCircle percentage={kpis.pctCud} label="% con CUD (Día)" colorClass="indigo" />
            <ProgressCircle percentage={kpis.pctConsumo} label="% Consumo Declarado" colorClass="red" />
            <ProgressCircle percentage={kpis.pctViolencia} label="% Violencia Familiar" colorClass="amber" />
          </div>

          {/* Visual Analytics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Active per Center */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-white mb-4">Personas Activas por Dispositivo</h3>
              <BarChart data={deviceStats} />
            </div>

            {/* Chart 2: Age / Sex distribution */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-white mb-4">Distribución por Sexo y Rango Etario</h3>
              <AgeSexDistribution data={ageSexStats} />
            </div>
          </div>

          {/* Centralized Table & Filtering */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            {/* Filter Bar Header */}
            <div className="p-5 border-b border-slate-800 bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Registros Centralizados</h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExportCSV}
                  disabled={filteredRecords.length === 0}
                  className="px-4 py-2.5 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <FileDown className="w-4 h-4" />
                  Exportar CSV
                </button>
              </div>
            </div>

            {/* Interactive Filters Grid */}
            <div className="p-4 bg-slate-900/25 border-b border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Centro</label>
                <select
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Barrio</label>
                <input
                  type="text"
                  placeholder="Filtrar por barrio..."
                  value={selectedBarrio}
                  onChange={(e) => setSelectedBarrio(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Estado</label>
                <select
                  value={selectedEstado}
                  onChange={(e) => setSelectedEstado(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Todos los estados</option>
                  <option value="activo">Activo</option>
                  <option value="egresado">Egresado</option>
                  <option value="inasistencia_prolongada">Inasistencia Prolongada</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha de Alta</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Table Area */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950/60 uppercase font-bold text-slate-500 border-b border-slate-850">
                  <tr>
                    <th className="p-4">DNI</th>
                    <th className="p-4">Nombre Completo</th>
                    <th className="p-4">Dispositivo</th>
                    <th className="p-4">Barrio</th>
                    <th className="p-4">Fecha Alta</th>
                    <th className="p-4 text-center">Estado</th>
                    <th className="p-4 text-right">Ficha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">
                        No se encontraron registros coincidentes con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r) => (
                      <tr key={r.vinculo_id} className="hover:bg-slate-850/40 transition">
                        <td className="p-4 font-mono font-semibold text-slate-300">{r.dni}</td>
                        <td className="p-4 font-bold text-white">
                          {r.apellido}, {r.nombre}
                        </td>
                        <td className="p-4 text-slate-300">
                          {r.dispositivo_nombre}
                          <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                            r.dispositivo_tipo === 'ninez'
                              ? 'bg-amber-500/10 text-amber-500'
                              : 'bg-indigo-500/10 text-indigo-400'
                          }`}>
                            {r.dispositivo_tipo === 'ninez' ? 'Niñez' : 'Día'}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400">{r.barrio}</td>
                        <td className="p-4 text-slate-400">{r.fecha_alta}</td>
                        <td className="p-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                            r.estado === 'activo'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                              : r.estado === 'egresado'
                              ? 'bg-slate-800 text-slate-400 border border-slate-700'
                              : 'bg-amber-500/10 text-amber-500 border border-amber-500/10'
                          }`}>
                            {r.estado}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleOpenDetail(r)}
                            className="p-1.5 bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-300 rounded-lg transition"
                            title="Ver ficha completa"
                          >
                            <Eye className="w-4.5 h-4.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary Count Footer */}
            <div className="p-4 bg-slate-950/20 border-t border-slate-800 text-xs text-slate-500 text-right">
              Mostrando {filteredRecords.length} de {records.length} registros totales.
            </div>
          </div>
        </>
      )}

      {/* DETAIL MODAL PLANEL */}
      {detailRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-4xl max-h-[85vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-850">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-400">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">
                    {detailRecord.nombre} {detailRecord.apellido}
                  </h3>
                  <span className="text-xs text-slate-400">Ficha Completa de Beneficiario • DNI: {detailRecord.dni}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setDetailRecord(null);
                  setDetailHistory([]);
                }}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition"
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
            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
              <button
                onClick={() => {
                  setDetailRecord(null);
                  setDetailHistory([]);
                }}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold rounded-xl text-xs transition"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
