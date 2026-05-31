import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import type { Persona, FichaNinezObservaciones, FichaDiaObservaciones, EstadoVinculo } from '../types';
import { Search, UserPlus, Edit3, Save, ArrowLeft, ToggleLeft, ToggleRight, Info, AlertTriangle, CheckCircle, CalendarDays, Phone, TrendingDown, Bell, ClipboardList, Users } from 'lucide-react';

interface PersonaConDetalle {
  dni: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string;
  sexo: string;
  barrio: string;
  vinculo_id: number;
  estado: EstadoVinculo;
  fecha_alta: string;
  motivo_egreso: string | null;
  // Details from ficha
  escolarizado?: boolean;
  discapacidad?: boolean;
  referenciado_salud?: boolean;
  tiene_cud?: boolean;
  limitacion_permanente?: string;
  nivel_educativo?: string;
  situacion_habitacional?: string;
  observaciones?: string;
  consumo_activo?: boolean;
  violencia_familiar?: boolean;
  
  // Custom tracking properties
  ano_escolar?: string;
  condicion_actual?: string;
  consumo_sustancias?: string;
  consumo_contexto?: string;
  consumo_familiar?: string;
  violencia_detalle?: string;
  texto_libre?: string;
  // Tutor fields (ninez only)
  tutor_id?: number;
  tutor_nombre?: string;
  tutor_telefono?: string;
}

interface AttendanceDetailRow {
  dni: string;
  nombre: string;
  apellido: string;
  faltasMes: number;
  consecutivasActuales: number;
}

interface AttendanceStats {
  presentesHoy: number;
  ausentesHoy: number;
  porcentajeMes: number;
  faltasCriticas: number;
}

export const OperatorDashboard: React.FC = () => {
  const { user, dispositivoId, dispositivoNombre } = useAuth();
  const [dispositivoTipo, setDispositivoTipo] = useState<'ninez' | 'dia' | null>(null);

  // States
  const [activePeople, setActivePeople] = useState<PersonaConDetalle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchDni, setSearchDni] = useState('');
  const [foundPersona, setFoundPersona] = useState<Persona | null>(null);
  const [dniSearched, setDniSearched] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [existingActiveVinculo, setExistingActiveVinculo] = useState<any | null>(null);

  // Form states
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'edit' | 'asistencia'>('list');
  const [selectedPerson, setSelectedPerson] = useState<PersonaConDetalle | null>(null);
  
  // General form inputs
  const [formDni, setFormDni] = useState('');
  const [formNombre, setFormNombre] = useState('');
  const [formApellido, setFormApellido] = useState('');
  const [formFechaNac, setFormFechaNac] = useState('');
  const [formSexo, setFormSexo] = useState('');
  const [formBarrio, setFormBarrio] = useState('');
  
  // Vinculo form inputs
  const [formEstado, setFormEstado] = useState<EstadoVinculo>('activo');
  const [formMotivoEgreso, setFormMotivoEgreso] = useState('');

  // Ninez form inputs
  const [formNinezEscolarizado, setFormNinezEscolarizado] = useState(false);
  const [formNinezAnoEscolar, setFormNinezAnoEscolar] = useState('');
  const [formNinezDiscapacidad, setFormNinezDiscapacidad] = useState(false);
  const [formNinezReferenciadoSalud, setFormNinezReferenciadoSalud] = useState(false);

  // Dia form inputs
  const [formDiaTieneCud, setFormDiaTieneCud] = useState(false);
  const [formDiaLimitacion, setFormDiaLimitacion] = useState('ninguna');
  const [formDiaNivelEducativo, setFormDiaNivelEducativo] = useState('');
  const [formDiaSituacionHab, setFormDiaSituacionHab] = useState('');
  const [formDiaCondicionActual, setFormDiaCondicionActual] = useState('');

  // Common sensitive switches
  const [formConsumoActivo, setFormConsumoActivo] = useState(false);
  const [formConsumoSustancias, setFormConsumoSustancias] = useState('');
  const [formConsumoContexto, setFormConsumoContexto] = useState('');
  const [formConsumoFamiliar, setFormConsumoFamiliar] = useState('');

  const [formViolenciaFamiliar, setFormViolenciaFamiliar] = useState(false);
  const [formViolenciaDetalle, setFormViolenciaDetalle] = useState('');
  const [formTextoLibre, setFormTextoLibre] = useState('');

  // Tutor form states (ninez only)
  const [formTutorNombre, setFormTutorNombre] = useState('');
  const [formTutorTelefono, setFormTutorTelefono] = useState('');
  const [existingTutorId, setExistingTutorId] = useState<number | null>(null);

  // Attendance states
  const [attendanceSubTab, setAttendanceSubTab] = useState<'marcar' | 'seguimiento'>('marcar');
  const [todayAttendanceMap, setTodayAttendanceMap] = useState<Record<string, boolean>>({});
  const [attendanceAlreadySaved, setAttendanceAlreadySaved] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [attendanceFilter, setAttendanceFilter] = useState('');
  const [attendanceMinFaltas, setAttendanceMinFaltas] = useState('');
  const [attendanceMinConsecutive, setAttendanceMinConsecutive] = useState('');
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats | null>(null);
  const [attendanceDetailRows, setAttendanceDetailRows] = useState<AttendanceDetailRow[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // Message notifications
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch Dispositivo type
  useEffect(() => {
    const fetchDispositivoType = async () => {
      if (!dispositivoId) return;
      const { data, error } = await supabase
        .from('dispositivo')
        .select('tipo')
        .eq('id', dispositivoId)
        .single();
      
      if (!error && data) {
        setDispositivoTipo(data.tipo as 'ninez' | 'dia');
      }
    };
    fetchDispositivoType();
  }, [dispositivoId]);

  // Load center list
  const loadActivePeople = async () => {
    if (!dispositivoId) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Fetch active vinculos for the current device
      const { data: vinculos, error: vError } = await supabase
        .from('vinculo')
        .select(`
          id, dni, estado, fecha_alta, motivo_egreso,
          persona (dni, nombre, apellido, fecha_nacimiento, sexo, barrio)
        `)
        .eq('dispositivo_id', dispositivoId)
        .eq('estado', 'activo');

      if (vError) throw vError;

      const results: PersonaConDetalle[] = [];

      for (const v of (vinculos || [])) {
        const p = v.persona as any;
        if (!p) continue;

        let details: any = {};
        if (dispositivoTipo === 'ninez') {
          const { data: fn } = await supabase
            .from('ficha_ninez')
            .select('*')
            .eq('vinculo_id', v.id)
            .maybeSingle();
          if (fn) {
            let obs: FichaNinezObservaciones = {};
            try {
              obs = JSON.parse(fn.observaciones || '{}');
            } catch (e) {}
            details = {
              escolarizado: fn.escolarizado,
              discapacidad: fn.discapacidad,
              referenciado_salud: fn.referenciado_salud,
              consumo_activo: fn.consumo_activo,
              violencia_familiar: fn.violencia_familiar,
              observaciones: fn.observaciones,
              ...obs
            };
          }
          const { data: tutorData } = await supabase
            .from('tutor')
            .select('id, nombre, telefono')
            .eq('dni_nino', p.dni)
            .maybeSingle();
          if (tutorData) {
            details.tutor_id = tutorData.id;
            details.tutor_nombre = tutorData.nombre;
            details.tutor_telefono = tutorData.telefono;
          }
        } else if (dispositivoTipo === 'dia') {
          const { data: fd } = await supabase
            .from('ficha_dia')
            .select('*')
            .eq('vinculo_id', v.id)
            .maybeSingle();
          if (fd) {
            let obs: FichaDiaObservaciones = {};
            try {
              obs = JSON.parse(fd.observaciones || '{}');
            } catch (e) {}
            details = {
              tiene_cud: fd.tiene_cud,
              limitacion_permanente: fd.limitacion_permanente,
              nivel_educativo: fd.nivel_educativo,
              situacion_habitacional: fd.situacion_habitacional,
              consumo_activo: fd.consumo_activo,
              violencia_familiar: fd.violencia_familiar,
              observaciones: fd.observaciones,
              ...obs
            };
          }
        }

        results.push({
          dni: p.dni,
          nombre: p.nombre,
          apellido: p.apellido,
          fecha_nacimiento: p.fecha_nacimiento,
          sexo: p.sexo,
          barrio: p.barrio,
          vinculo_id: v.id,
          estado: v.estado,
          fecha_alta: v.fecha_alta,
          motivo_egreso: v.motivo_egreso,
          ...details
        });
      }

      setActivePeople(results);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error al cargar la lista de personas: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dispositivoId && dispositivoTipo) {
      loadActivePeople();
    }
  }, [dispositivoId, dispositivoTipo]);

  useEffect(() => {
    if (viewMode === 'asistencia' && dispositivoId && activePeople.length > 0) {
      loadTodayAttendance();
      loadAttendanceStats();
    }
  }, [viewMode, activePeople.length]);

  // Search DNI
  const handleSearchDni = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchDni) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setFoundPersona(null);
    setExistingActiveVinculo(null);
    setDniSearched(false);
    setIsLinking(false);

    try {
      // 1. Search persona table
      const { data: pData, error: pError } = await supabase
        .from('persona')
        .select('*')
        .eq('dni', searchDni)
        .maybeSingle();

      if (pError) throw pError;

      if (pData) {
        setFoundPersona(pData);
        // 2. Check if person has active vinculos in ANY center
        const { data: vData, error: vError } = await supabase
          .from('vinculo')
          .select('id, dispositivo_id, estado, dispositivo(nombre)')
          .eq('dni', searchDni)
          .eq('estado', 'activo')
          .maybeSingle();

        if (vError) throw vError;

        if (vData) {
          setExistingActiveVinculo(vData);
        }
      } else {
        // DNI does not exist, open registration form
        setFormDni(searchDni);
        setFormNombre('');
        setFormApellido('');
        setFormFechaNac('');
        setFormSexo('');
        setFormBarrio('');
        setFormEstado('activo');
        setFormMotivoEgreso('');

        // Reset niñez
        setFormNinezEscolarizado(false);
        setFormNinezAnoEscolar('');
        setFormNinezDiscapacidad(false);
        setFormNinezReferenciadoSalud(false);

        // Reset día
        setFormDiaTieneCud(false);
        setFormDiaLimitacion('ninguna');
        setFormDiaNivelEducativo('');
        setFormDiaSituacionHab('');
        setFormDiaCondicionActual('');

        // Reset sensitive
        setFormConsumoActivo(false);
        setFormConsumoSustancias('');
        setFormConsumoContexto('');
        setFormConsumoFamiliar('');
        setFormViolenciaFamiliar(false);
        setFormViolenciaDetalle('');
        setFormTextoLibre('');

        // Reset tutor
        setFormTutorNombre('');
        setFormTutorTelefono('');
        setExistingTutorId(null);

        setViewMode('create');
      }
      setDniSearched(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error en la búsqueda: ' + (err.message || ''));
    }
  };

  // Link persona to center
  const handleLinkToCenter = async () => {
    if (!foundPersona || !dispositivoId) return;
    setIsLinking(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // 1. Create a new active link
      const { data: newV, error: vError } = await supabase
        .from('vinculo')
        .insert({
          dni: foundPersona.dni,
          dispositivo_id: dispositivoId,
          estado: 'activo',
          fecha_alta: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      if (vError) throw vError;

      // 2. Create corresponding empty sheet
      if (dispositivoTipo === 'ninez') {
        const { error: fnError } = await supabase
          .from('ficha_ninez')
          .insert({
            vinculo_id: newV.id,
            escolarizado: false,
            discapacidad: false,
            referenciado_salud: false,
            consumo_activo: false,
            violencia_familiar: false,
            observaciones: '{}'
          });
        if (fnError) throw fnError;
      } else {
        const { error: fdError } = await supabase
          .from('ficha_dia')
          .insert({
            vinculo_id: newV.id,
            tiene_cud: false,
            limitacion_permanente: 'ninguna',
            nivel_educativo: '',
            situacion_habitacional: '',
            consumo_activo: false,
            violencia_familiar: false,
            observaciones: '{}'
          });
        if (fdError) throw fdError;
      }

      setSuccessMsg(`Vínculo creado con éxito para ${foundPersona.nombre} ${foundPersona.apellido}.`);
      setFoundPersona(null);
      setDniSearched(false);
      setSearchDni('');
      await loadActivePeople();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error al vincular: ' + (err.message || ''));
    } finally {
      setIsLinking(false);
    }
  };

  // Select a person to edit
  const handleSelectToEdit = (p: PersonaConDetalle) => {
    setSelectedPerson(p);
    
    // Set general info
    setFormDni(p.dni);
    setFormNombre(p.nombre);
    setFormApellido(p.apellido);
    setFormFechaNac(p.fecha_nacimiento);
    setFormSexo(p.sexo);
    setFormBarrio(p.barrio);
    setFormEstado(p.estado);
    setFormMotivoEgreso(p.motivo_egreso || '');

    // Set specific sheet fields
    if (dispositivoTipo === 'ninez') {
      setFormNinezEscolarizado(p.escolarizado || false);
      setFormNinezAnoEscolar(p.ano_escolar || '');
      setFormNinezDiscapacidad(p.discapacidad || false);
      setFormNinezReferenciadoSalud(p.referenciado_salud || false);
    } else {
      setFormDiaTieneCud(p.tiene_cud || false);
      setFormDiaLimitacion(p.limitacion_permanente || 'ninguna');
      setFormDiaNivelEducativo(p.nivel_educativo || '');
      setFormDiaSituacionHab(p.situacion_habitacional || '');
      setFormDiaCondicionActual(p.condicion_actual || '');
    }

    // Set sensitive fields
    setFormConsumoActivo(p.consumo_activo || false);
    setFormConsumoSustancias(p.consumo_sustancias || '');
    setFormConsumoContexto(p.consumo_contexto || '');
    setFormConsumoFamiliar(p.consumo_familiar || '');

    setFormViolenciaFamiliar(p.violencia_familiar || false);
    setFormViolenciaDetalle(p.violencia_detalle || '');
    setFormTextoLibre(p.texto_libre || '');

    // Set tutor fields (ninez only)
    setFormTutorNombre(p.tutor_nombre || '');
    setFormTutorTelefono(p.tutor_telefono || '');
    setExistingTutorId(p.tutor_id || null);

    setViewMode('edit');
  };

  // Insert Tracking Log
  const logTracking = async (vinculoId: number, field: string, oldVal: any, newVal: any) => {
    const stringOld = oldVal === null || oldVal === undefined ? '' : String(oldVal);
    const stringNew = newVal === null || newVal === undefined ? '' : String(newVal);

    if (stringOld === stringNew) return; // No change

    await supabase.from('historial_seguimiento').insert({
      vinculo_id: vinculoId,
      campo_modificado: field,
      valor_anterior: stringOld,
      valor_nuevo: stringNew,
      user_id: user?.id
    });
  };

  // Attendance: load today's records
  const loadTodayAttendance = async () => {
    if (!dispositivoId) return;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('registro_asistencia')
      .select('dni, presente')
      .eq('dispositivo_id', dispositivoId)
      .eq('fecha', today);
    const map: Record<string, boolean> = {};
    for (const r of (data || [])) map[r.dni] = r.presente;
    setTodayAttendanceMap(map);
    setAttendanceAlreadySaved(Object.keys(map).length > 0);
  };

  // Attendance: compute KPIs and per-person stats
  const loadAttendanceStats = async () => {
    if (!dispositivoId || activePeople.length === 0) return;
    setLoadingAttendance(true);
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.substring(0, 7) + '-01';

    const { data: monthRecords } = await supabase
      .from('registro_asistencia')
      .select('dni, fecha, presente')
      .eq('dispositivo_id', dispositivoId)
      .gte('fecha', monthStart)
      .lte('fecha', today)
      .order('fecha', { ascending: false });

    const byPerson: Record<string, { fecha: string; presente: boolean }[]> = {};
    for (const r of (monthRecords || [])) {
      if (!byPerson[r.dni]) byPerson[r.dni] = [];
      byPerson[r.dni].push({ fecha: r.fecha, presente: r.presente });
    }

    let totalRegistros = 0;
    let totalPresentes = 0;
    let faltasCriticas = 0;
    const todayRecords = (monthRecords || []).filter(r => r.fecha === today);
    const presentesHoy = todayRecords.filter(r => r.presente).length;
    const ausentesHoy = todayRecords.filter(r => !r.presente).length;

    const rows: AttendanceDetailRow[] = activePeople.map(person => {
      const records = byPerson[person.dni] || [];
      const faltasMes = records.filter(r => !r.presente).length;
      totalRegistros += records.length;
      totalPresentes += records.filter(r => r.presente).length;
      const sorted = [...records].sort((a, b) => b.fecha.localeCompare(a.fecha));
      let consecutivas = 0;
      for (const r of sorted) {
        if (!r.presente) consecutivas++;
        else break;
      }
      if (consecutivas >= 2) faltasCriticas++;
      return { dni: person.dni, nombre: person.nombre, apellido: person.apellido, faltasMes, consecutivasActuales: consecutivas };
    });

    const porcentajeMes = totalRegistros > 0 ? Math.round((totalPresentes / totalRegistros) * 100) : 0;
    setAttendanceStats({ presentesHoy, ausentesHoy, porcentajeMes, faltasCriticas });
    setAttendanceDetailRows(rows);
    setLoadingAttendance(false);
  };

  // Attendance: save today's records
  const handleSaveAttendance = async () => {
    if (!dispositivoId || savingAttendance || activePeople.length === 0) return;
    setSavingAttendance(true);
    setErrorMsg(null);
    const today = new Date().toISOString().split('T')[0];
    const records = activePeople.map(p => ({
      dni: p.dni,
      dispositivo_id: dispositivoId,
      fecha: today,
      presente: todayAttendanceMap[p.dni] ?? true,
      registrado_por: user?.id
    }));
    const { error } = await supabase
      .from('registro_asistencia')
      .upsert(records, { onConflict: 'dni,dispositivo_id,fecha' });
    if (error) {
      setErrorMsg('Error al guardar asistencia: ' + error.message);
    } else {
      setSuccessMsg('Asistencia del día guardada correctamente.');
      setAttendanceAlreadySaved(true);
      loadAttendanceStats();
    }
    setSavingAttendance(false);
  };

  // Submit form (create or update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    // Validation
    if (!formDni || !formNombre || !formApellido || !formFechaNac || !formSexo || !formBarrio) {
      setErrorMsg('Por favor complete todos los campos obligatorios.');
      setSubmitting(false);
      return;
    }

    if (formEstado === 'egresado' && !formMotivoEgreso) {
      setErrorMsg('Debe especificar un motivo de egreso al egresar a un beneficiario.');
      setSubmitting(false);
      return;
    }

    try {
      if (viewMode === 'create') {
        // 1. Insert persona
        const { error: pError } = await supabase
          .from('persona')
          .insert({
            dni: formDni,
            nombre: formNombre,
            apellido: formApellido,
            fecha_nacimiento: formFechaNac,
            sexo: formSexo,
            barrio: formBarrio
          });
        
        if (pError) throw pError;

        // 2. Insert vinculo
        const { data: newV, error: vError } = await supabase
          .from('vinculo')
          .insert({
            dni: formDni,
            dispositivo_id: dispositivoId,
            estado: 'activo',
            fecha_alta: new Date().toISOString().split('T')[0]
          })
          .select()
          .single();

        if (vError) throw vError;

        // 3. Insert specific sheet
        if (dispositivoTipo === 'ninez') {
          const obsJson: FichaNinezObservaciones = {
            ano_escolar: formNinezEscolarizado ? formNinezAnoEscolar : undefined,
            consumo_sustancias: formConsumoActivo ? formConsumoSustancias : undefined,
            consumo_contexto: formConsumoActivo ? formConsumoContexto : undefined,
            consumo_familiar: formConsumoActivo ? formConsumoFamiliar : undefined,
            violencia_detalle: formViolenciaFamiliar ? formViolenciaDetalle : undefined,
            texto_libre: formTextoLibre || undefined
          };

          const { error: fnError } = await supabase
            .from('ficha_ninez')
            .insert({
              vinculo_id: newV.id,
              escolarizado: formNinezEscolarizado,
              discapacidad: formNinezDiscapacidad,
              referenciado_salud: formNinezReferenciadoSalud,
              consumo_activo: formConsumoActivo,
              violencia_familiar: formViolenciaFamiliar,
              observaciones: JSON.stringify(obsJson)
            });

          if (fnError) throw fnError;

          // 4. Insert tutor if provided
          if (formTutorNombre && formTutorTelefono) {
            await supabase.from('tutor').insert({ nombre: formTutorNombre, telefono: formTutorTelefono, dni_nino: formDni });
          }
        } else {
          const obsJson: FichaDiaObservaciones = {
            condicion_actual: formDiaCondicionActual || undefined,
            consumo_sustancias: formConsumoActivo ? formConsumoSustancias : undefined,
            consumo_contexto: formConsumoActivo ? formConsumoContexto : undefined,
            consumo_familiar: formConsumoActivo ? formConsumoFamiliar : undefined,
            violencia_detalle: formViolenciaFamiliar ? formViolenciaDetalle : undefined,
            texto_libre: formTextoLibre || undefined
          };

          const { error: fdError } = await supabase
            .from('ficha_dia')
            .insert({
              vinculo_id: newV.id,
              tiene_cud: formDiaTieneCud,
              limitacion_permanente: formDiaLimitacion,
              nivel_educativo: formDiaNivelEducativo,
              situacion_habitacional: formDiaSituacionHab,
              consumo_activo: formConsumoActivo,
              violencia_familiar: formViolenciaFamiliar,
              observaciones: JSON.stringify(obsJson)
            });

          if (fdError) throw fdError;
        }

        setSuccessMsg(`Registro exitoso para ${formNombre} ${formApellido}.`);
      } else if (viewMode === 'edit' && selectedPerson) {
        const vId = selectedPerson.vinculo_id;

        // 1. Update Persona fields & track changes
        const { error: pError } = await supabase
          .from('persona')
          .update({
            nombre: formNombre,
            apellido: formApellido,
            fecha_nacimiento: formFechaNac,
            sexo: formSexo,
            barrio: formBarrio
          })
          .eq('dni', formDni);

        if (pError) throw pError;

        await logTracking(vId, 'persona.nombre', selectedPerson.nombre, formNombre);
        await logTracking(vId, 'persona.apellido', selectedPerson.apellido, formApellido);
        await logTracking(vId, 'persona.fecha_nacimiento', selectedPerson.fecha_nacimiento, formFechaNac);
        await logTracking(vId, 'persona.sexo', selectedPerson.sexo, formSexo);
        await logTracking(vId, 'persona.barrio', selectedPerson.barrio, formBarrio);

        // 2. Update Vinculo fields & track changes
        const isEgresando = formEstado === 'egresado' && selectedPerson.estado !== 'egresado';
        const vinculoUpdates: any = {
          estado: formEstado,
          motivo_egreso: formEstado === 'egresado' ? formMotivoEgreso : null,
          fecha_baja: isEgresando ? new Date().toISOString().split('T')[0] : selectedPerson.estado === 'egresado' && formEstado !== 'egresado' ? null : selectedPerson.motivo_egreso // logic for cleanups
        };

        const { error: vError } = await supabase
          .from('vinculo')
          .update(vinculoUpdates)
          .eq('id', vId);

        if (vError) throw vError;

        await logTracking(vId, 'vinculo.estado', selectedPerson.estado, formEstado);
        await logTracking(vId, 'vinculo.motivo_egreso', selectedPerson.motivo_egreso, vinculoUpdates.motivo_egreso);

        // 3. Update specific sheet & track changes
        if (dispositivoTipo === 'ninez') {
          const obsJson: FichaNinezObservaciones = {
            ano_escolar: formNinezEscolarizado ? formNinezAnoEscolar : undefined,
            consumo_sustancias: formConsumoActivo ? formConsumoSustancias : undefined,
            consumo_contexto: formConsumoActivo ? formConsumoContexto : undefined,
            consumo_familiar: formConsumoActivo ? formConsumoFamiliar : undefined,
            violencia_detalle: formViolenciaFamiliar ? formViolenciaDetalle : undefined,
            texto_libre: formTextoLibre || undefined
          };

          const { error: fnError } = await supabase
            .from('ficha_ninez')
            .update({
              escolarizado: formNinezEscolarizado,
              discapacidad: formNinezDiscapacidad,
              referenciado_salud: formNinezReferenciadoSalud,
              consumo_activo: formConsumoActivo,
              violencia_familiar: formViolenciaFamiliar,
              observaciones: JSON.stringify(obsJson)
            })
            .eq('vinculo_id', vId);

          if (fnError) throw fnError;

          // Logging sheet changes
          await logTracking(vId, 'ficha.escolarizado', selectedPerson.escolarizado, formNinezEscolarizado);
          await logTracking(vId, 'ficha.ano_escolar', (selectedPerson as any).ano_escolar, obsJson.ano_escolar);
          await logTracking(vId, 'ficha.discapacidad', selectedPerson.discapacidad, formNinezDiscapacidad);
          await logTracking(vId, 'ficha.referenciado_salud', selectedPerson.referenciado_salud, formNinezReferenciadoSalud);
          await logTracking(vId, 'ficha.consumo_activo', selectedPerson.consumo_activo, formConsumoActivo);
          await logTracking(vId, 'ficha.consumo_sustancias', (selectedPerson as any).consumo_sustancias, obsJson.consumo_sustancias);
          await logTracking(vId, 'ficha.consumo_contexto', (selectedPerson as any).consumo_contexto, obsJson.consumo_contexto);
          await logTracking(vId, 'ficha.consumo_familiar', (selectedPerson as any).consumo_familiar, obsJson.consumo_familiar);
          await logTracking(vId, 'ficha.violencia_familiar', selectedPerson.violencia_familiar, formViolenciaFamiliar);
          await logTracking(vId, 'ficha.violencia_detalle', (selectedPerson as any).violencia_detalle, obsJson.violencia_detalle);
          await logTracking(vId, 'ficha.observaciones_libres', (selectedPerson as any).texto_libre, obsJson.texto_libre);

          // Save tutor
          if (formTutorNombre && formTutorTelefono) {
            if (existingTutorId) {
              await supabase.from('tutor').update({ nombre: formTutorNombre, telefono: formTutorTelefono }).eq('id', existingTutorId);
            } else {
              await supabase.from('tutor').insert({ nombre: formTutorNombre, telefono: formTutorTelefono, dni_nino: formDni });
            }
          }

        } else {
          const obsJson: FichaDiaObservaciones = {
            condicion_actual: formDiaCondicionActual || undefined,
            consumo_sustancias: formConsumoActivo ? formConsumoSustancias : undefined,
            consumo_contexto: formConsumoActivo ? formConsumoContexto : undefined,
            consumo_familiar: formConsumoActivo ? formConsumoFamiliar : undefined,
            violencia_detalle: formViolenciaFamiliar ? formViolenciaDetalle : undefined,
            texto_libre: formTextoLibre || undefined
          };

          const { error: fdError } = await supabase
            .from('ficha_dia')
            .update({
              tiene_cud: formDiaTieneCud,
              limitacion_permanente: formDiaLimitacion,
              nivel_educativo: formDiaNivelEducativo,
              situacion_habitacional: formDiaSituacionHab,
              consumo_activo: formConsumoActivo,
              violencia_familiar: formViolenciaFamiliar,
              observaciones: JSON.stringify(obsJson)
            })
            .eq('vinculo_id', vId);

          if (fdError) throw fdError;

          // Logging sheet changes
          await logTracking(vId, 'ficha.tiene_cud', selectedPerson.tiene_cud, formDiaTieneCud);
          await logTracking(vId, 'ficha.limitacion_permanente', selectedPerson.limitacion_permanente, formDiaLimitacion);
          await logTracking(vId, 'ficha.nivel_educativo', selectedPerson.nivel_educativo, formDiaNivelEducativo);
          await logTracking(vId, 'ficha.situacion_habitacional', selectedPerson.situacion_habitacional, formDiaSituacionHab);
          await logTracking(vId, 'ficha.condicion_actual', (selectedPerson as any).condicion_actual, obsJson.condicion_actual);
          await logTracking(vId, 'ficha.consumo_activo', selectedPerson.consumo_activo, formConsumoActivo);
          await logTracking(vId, 'ficha.consumo_sustancias', (selectedPerson as any).consumo_sustancias, obsJson.consumo_sustancias);
          await logTracking(vId, 'ficha.consumo_contexto', (selectedPerson as any).consumo_contexto, obsJson.consumo_contexto);
          await logTracking(vId, 'ficha.consumo_familiar', (selectedPerson as any).consumo_familiar, obsJson.consumo_familiar);
          await logTracking(vId, 'ficha.violencia_familiar', selectedPerson.violencia_familiar, formViolenciaFamiliar);
          await logTracking(vId, 'ficha.violencia_detalle', (selectedPerson as any).violencia_detalle, obsJson.violencia_detalle);
          await logTracking(vId, 'ficha.observaciones_libres', (selectedPerson as any).texto_libre, obsJson.texto_libre);
        }

        setSuccessMsg(`Modificación guardada y auditada correctamente para ${formNombre} ${formApellido}.`);
      }

      // Return to list & refresh
      setViewMode('list');
      setSelectedPerson(null);
      setSearchDni('');
      setDniSearched(false);
      await loadActivePeople();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error al guardar datos: ' + (err.message || ''));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Center Banner Header */}
      <div className="relative bg-gradient-to-r from-emerald-900/40 via-slate-900 to-slate-900 border border-slate-800/60 rounded-3xl p-8 shadow-xl overflow-hidden">
        {/* Decorative background shapes */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-slate-900/50 to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-[10px] px-2.5 py-1 rounded-lg uppercase font-black tracking-widest ${
                dispositivoTipo === 'ninez'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                  : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
              }`}>
                {dispositivoTipo === 'ninez' ? 'Centro de Niñez' : 'Centro de Día'}
              </span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              {dispositivoNombre}
            </h1>
            <p className="text-slate-400 text-sm mt-1.5 font-medium">
              Panel Operativo • Búsqueda, registro y actualización de fichas.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Tab navigation */}
            {(viewMode === 'list' || viewMode === 'asistencia') && (
              <div className="flex gap-1 bg-slate-950/60 border border-slate-700/40 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    viewMode === 'list'
                      ? 'bg-emerald-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Beneficiarios
                </button>
                <button
                  onClick={() => { setViewMode('asistencia'); setAttendanceSubTab('marcar'); }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    viewMode === 'asistencia'
                      ? 'bg-sky-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CalendarDays className="w-4 h-4" />
                  Asistencia
                </button>
              </div>
            )}
            {viewMode === 'list' && (
              <button
                onClick={() => {
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  setDniSearched(false);
                  setSearchDni('');
                  setFoundPersona(null);
                  const el = document.getElementById('dni-search-input');
                  if (el) el.focus();
                }}
                className="group px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                <UserPlus className="w-5 h-5 transition-transform group-hover:scale-110" />
                Nuevo Beneficiario
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/25 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm text-red-400 font-medium">{errorMsg}</div>
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-400 font-medium">{successMsg}</div>
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <div className="space-y-6">
          {/* Search DNI Card before registering */}
          <div className="bg-slate-900/80 border border-slate-800/60 rounded-3xl p-6 shadow-xl card-hover">
            <h2 className="text-sm font-black text-white mb-4 uppercase tracking-wider">Buscar por DNI</h2>
            <form onSubmit={handleSearchDni} className="relative flex items-center">
              <Search className="absolute left-4 w-5 h-5 text-emerald-500" />
              <input
                id="dni-search-input"
                type="number"
                placeholder="Ingresá el DNI para buscar o registrar..."
                value={searchDni}
                onChange={(e) => setSearchDni(e.target.value)}
                className="w-full pl-12 pr-32 py-4 bg-slate-950/80 border border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-white rounded-2xl text-base transition-all placeholder-slate-600 shadow-inner"
              />
              <button
                type="submit"
                className="absolute right-2 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors text-sm"
              >
                Buscar
              </button>
            </form>

            {/* DNI Search Results */}
            {dniSearched && foundPersona && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Persona encontrada en base de datos</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {foundPersona.nombre} {foundPersona.apellido} • DNI: {foundPersona.dni}
                    </p>
                  </div>
                </div>

                {existingActiveVinculo ? (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400 flex gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Esta persona ya tiene un vínculo <strong>activo</strong> en el centro:{' '}
                      <strong>{existingActiveVinculo.dispositivo?.nombre}</strong>. No es posible vincularla a este centro mientras tenga un vínculo activo en otro.
                    </span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleLinkToCenter}
                      disabled={isLinking}
                      className="px-4 py-2 bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold text-xs rounded-lg transition duration-150 disabled:opacity-50"
                    >
                      {isLinking ? 'Vinculando...' : 'Vincular a este centro'}
                    </button>
                    <button
                      onClick={() => {
                        // Open registration editing form directly
                        const mockDetailedPersona: PersonaConDetalle = {
                          ...foundPersona,
                          vinculo_id: 0, // Mock id for insertion
                          estado: 'activo',
                          fecha_alta: new Date().toISOString().split('T')[0],
                          motivo_egreso: null
                        };
                        handleSelectToEdit(mockDetailedPersona);
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
                    >
                      Ver / Completar Ficha
                    </button>
                  </div>
                )}
              </div>
            )}

            {dniSearched && !foundPersona && (
              <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-xs text-emerald-400 flex gap-2">
                <Info className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                <span>El DNI no está registrado en el sistema. Abriendo formulario de registro nuevo...</span>
              </div>
            )}
          </div>

          {/* Active Beneficiaries List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Lista de Beneficiarios Activos
                <span className="text-xs bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                  {activePeople.length}
                </span>
              </h2>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-20 bg-slate-900 border border-slate-800 rounded-xl animate-pulse"></div>
                ))}
              </div>
            ) : activePeople.length === 0 ? (
              <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-500 text-sm">
                No hay beneficiarios activos registrados en este centro.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {activePeople.map((person) => {
                  const hasVulnerability = person.consumo_activo || person.violencia_familiar;
                  const initials = `${person.nombre[0] || ''}${person.apellido[0] || ''}`.toUpperCase();
                  const colors = ['from-emerald-500 to-teal-400','from-violet-500 to-purple-400','from-amber-500 to-orange-400','from-sky-500 to-blue-400','from-rose-500 to-pink-400'];
                  const grad = colors[(person.dni.charCodeAt(0) || 0) % colors.length];

                  return (
                    <div
                      key={person.vinculo_id}
                      className="group p-5 bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800/60 hover:border-emerald-500/30 rounded-3xl shadow-lg flex items-center justify-between gap-4 transition-all duration-200 cursor-default"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Avatar */}
                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center text-sm font-black text-slate-950 shrink-0 shadow-inner`}>
                          {initials}
                        </div>
                        
                        <div className="min-w-0">
                          <h3 className="font-bold text-white text-base truncate flex items-center gap-2">
                            {person.nombre} {person.apellido}
                            {hasVulnerability && (
                              <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" title="Indicadores de vulnerabilidad presentes" />
                            )}
                          </h3>
                          <p className="text-[11px] text-slate-400 mt-0.5 font-medium flex items-center gap-1.5">
                            <span className="font-mono text-slate-300">{person.dni}</span>
                            <span>•</span>
                            <span className="truncate">{person.barrio}</span>
                          </p>
                          <div className="mt-2.5 flex items-center gap-2">
                            <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase ${
                              person.estado === 'activo'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/15'
                            }`}>
                              {person.estado}
                            </span>
                            <span className="text-[10px] text-slate-500 font-semibold">
                              Alta: {person.fecha_alta}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSelectToEdit(person)}
                        className="p-3 bg-slate-800/60 hover:bg-emerald-500 hover:text-slate-950 text-slate-400 rounded-2xl transition-all duration-200 opacity-0 group-hover:opacity-100 shrink-0"
                        title="Ver / Editar Ficha"
                      >
                        <Edit3 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE & EDIT FORM VIEW */}
      {(viewMode === 'create' || viewMode === 'edit') && (
        <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-slate-850 border-b border-slate-800 px-5 py-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setViewMode('list');
                setSelectedPerson(null);
              }}
              className="text-slate-400 hover:text-white flex items-center gap-1 text-sm font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </button>
            <h2 className="text-base font-bold text-white">
              {viewMode === 'create' ? 'Nuevo Registro' : 'Editar Ficha y Estado'}
            </h2>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-600 hover:to-teal-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Guardar
            </button>
          </div>

          <div className="p-5 space-y-6">
            {/* Section 1: Datos Personales (Siempre Obligatorios) */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                1. Datos Personales
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">
                    DNI <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    disabled={viewMode === 'edit'} // PK cannot be updated
                    value={formDni}
                    onChange={(e) => setFormDni(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="Ingrese el DNI"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">
                    Sexo <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formSexo}
                    onChange={(e) => setFormSexo(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base"
                  >
                    <option value="">Seleccione sexo...</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formNombre}
                    onChange={(e) => setFormNombre(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base"
                    placeholder="Nombre"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">
                    Apellido <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formApellido}
                    onChange={(e) => setFormApellido(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base"
                    placeholder="Apellido"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">
                    Fecha de Nacimiento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formFechaNac}
                    onChange={(e) => setFormFechaNac(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">
                    Barrio <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formBarrio}
                    onChange={(e) => setFormBarrio(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base"
                    placeholder="Barrio de residencia"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Vínculo & Estado Seguimiento */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                2. Vínculo y Estado del Beneficiario
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">
                    Estado del Vínculo
                  </label>
                  <select
                    value={formEstado}
                    onChange={(e) => setFormEstado(e.target.value as EstadoVinculo)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base"
                  >
                    <option value="activo">Activo</option>
                    <option value="egresado">Egresado</option>
                    <option value="inasistencia_prolongada">Inasistencia Prolongada</option>
                  </select>
                </div>

                {formEstado === 'egresado' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">
                      Motivo de Egreso <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      value={formMotivoEgreso}
                      onChange={(e) => setFormMotivoEgreso(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base h-20 resize-none"
                      placeholder="Indique detalladamente el motivo de egreso del centro..."
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Ficha Específica (Niñez o Día) */}
            {dispositivoTipo === 'ninez' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                  3. Ficha de Niñez
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Escolarizado */}
                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <span className="block text-sm font-bold text-white">Escolarizado</span>
                      <span className="text-xs text-slate-400">¿Asiste a la escuela?</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormNinezEscolarizado(!formNinezEscolarizado)}
                      className="text-slate-400 hover:text-white focus:outline-none"
                    >
                      {formNinezEscolarizado ? (
                        <ToggleRight className="w-12 h-12 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="w-12 h-12 text-slate-600" />
                      )}
                    </button>
                  </div>

                  {/* Año Escolar (Conditional) */}
                  {formNinezEscolarizado && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5 animate-fadeIn">
                        Año Escolar <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required={formNinezEscolarizado}
                        value={formNinezAnoEscolar}
                        onChange={(e) => setFormNinezAnoEscolar(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base animate-fadeIn"
                        placeholder="Ej. 3er grado, 1er año"
                      />
                    </div>
                  )}

                  {/* Discapacidad */}
                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <span className="block text-sm font-bold text-white">Discapacidad</span>
                      <span className="text-xs text-slate-400">¿Tiene discapacidad declarada?</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormNinezDiscapacidad(!formNinezDiscapacidad)}
                      className="text-slate-400 hover:text-white focus:outline-none"
                    >
                      {formNinezDiscapacidad ? (
                        <ToggleRight className="w-12 h-12 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="w-12 h-12 text-slate-600" />
                      )}
                    </button>
                  </div>

                  {/* Referenciado Salud */}
                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <span className="block text-sm font-bold text-white">Referenciado Salud</span>
                      <span className="text-xs text-slate-400">¿Tiene derivación a centro de salud?</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormNinezReferenciadoSalud(!formNinezReferenciadoSalud)}
                      className="text-slate-400 hover:text-white focus:outline-none"
                    >
                      {formNinezReferenciadoSalud ? (
                        <ToggleRight className="w-12 h-12 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="w-12 h-12 text-slate-600" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {dispositivoTipo === 'dia' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                  3. Ficha de Adulto (Centro de Día)
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* CUD */}
                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <span className="block text-sm font-bold text-white">Tiene CUD</span>
                      <span className="text-xs text-slate-400">Certificado Único de Discapacidad</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormDiaTieneCud(!formDiaTieneCud)}
                      className="text-slate-400 hover:text-white focus:outline-none"
                    >
                      {formDiaTieneCud ? (
                        <ToggleRight className="w-12 h-12 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="w-12 h-12 text-slate-600" />
                      )}
                    </button>
                  </div>

                  {/* Limitación Permanente */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">
                      Limitación Permanente
                    </label>
                    <select
                      value={formDiaLimitacion}
                      onChange={(e) => setFormDiaLimitacion(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base"
                    >
                      <option value="ninguna">Ninguna</option>
                      <option value="auditiva">Auditiva</option>
                      <option value="visual">Visual</option>
                      <option value="motriz">Motriz</option>
                      <option value="intelectual">Intelectual</option>
                    </select>
                  </div>

                  {/* Nivel Educativo */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">
                      Nivel Educativo
                    </label>
                    <input
                      type="text"
                      value={formDiaNivelEducativo}
                      onChange={(e) => setFormDiaNivelEducativo(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base"
                      placeholder="Ej. Secundario completo, Primario incompleto"
                    />
                  </div>

                  {/* Situación Habitacional */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">
                      Situación Habitacional
                    </label>
                    <input
                      type="text"
                      value={formDiaSituacionHab}
                      onChange={(e) => setFormDiaSituacionHab(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base"
                      placeholder="Ej. Casa alquilada, Situación de calle, Hogar"
                    />
                  </div>

                  {/* Condición Actual */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">
                      Condición Actual / Diagnóstico / Situación
                    </label>
                    <textarea
                      value={formDiaCondicionActual}
                      onChange={(e) => setFormDiaCondicionActual(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base h-20 resize-none"
                      placeholder="Especifique la condición de salud o social principal del beneficiario..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Section 4: Datos de Vulnerabilidad y Sensibles (Escondidos por Defecto) */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                4. Indicadores de Vulnerabilidad (Sensible)
              </h3>

              <div className="space-y-4">
                {/* Consumo Activo Toggle */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-sm font-bold text-white">Consumo Activo Declarado</span>
                      <span className="text-xs text-slate-400">¿El beneficiario experimenta consumo problemático de sustancias?</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormConsumoActivo(!formConsumoActivo)}
                      className="text-slate-400 hover:text-white focus:outline-none"
                    >
                      {formConsumoActivo ? (
                        <ToggleRight className="w-12 h-12 text-red-500" />
                      ) : (
                        <ToggleLeft className="w-12 h-12 text-slate-600" />
                      )}
                    </button>
                  </div>

                  {/* Conditional Block Consumo (Appears ONLY if consumo is True) */}
                  {formConsumoActivo && (
                    <div className="mt-4 grid grid-cols-1 gap-3 animate-fadeIn border-t border-slate-800 pt-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">
                          Sustancias de Consumo
                        </label>
                        <input
                          type="text"
                          value={formConsumoSustancias}
                          onChange={(e) => setFormConsumoSustancias(e.target.value)}
                          className="w-full px-3.5 py-2 bg-slate-900 border border-slate-850 rounded-lg text-white focus:outline-none text-sm"
                          placeholder="Ej. Alcohol, paco, psicofármacos..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">
                          Contexto del Consumo
                        </label>
                        <input
                          type="text"
                          value={formConsumoContexto}
                          onChange={(e) => setFormConsumoContexto(e.target.value)}
                          className="w-full px-3.5 py-2 bg-slate-900 border border-slate-850 rounded-lg text-white focus:outline-none text-sm"
                          placeholder="Ej. Situación de calle, abandono escolar..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">
                          Consumo Familiar
                        </label>
                        <input
                          type="text"
                          value={formConsumoFamiliar}
                          onChange={(e) => setFormConsumoFamiliar(e.target.value)}
                          className="w-full px-3.5 py-2 bg-slate-900 border border-slate-850 rounded-lg text-white focus:outline-none text-sm"
                          placeholder="Ej. Padre con alcoholismo, sin consumo familiar..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Violencia Familiar Toggle */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-sm font-bold text-white">Violencia Familiar</span>
                      <span className="text-xs text-slate-400">¿Existen antecedentes o indicadores de violencia intrafamiliar?</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormViolenciaFamiliar(!formViolenciaFamiliar)}
                      className="text-slate-400 hover:text-white focus:outline-none"
                    >
                      {formViolenciaFamiliar ? (
                        <ToggleRight className="w-12 h-12 text-red-500" />
                      ) : (
                        <ToggleLeft className="w-12 h-12 text-slate-600" />
                      )}
                    </button>
                  </div>

                  {/* Conditional Block Violencia (Appears ONLY if violencia is True) */}
                  {formViolenciaFamiliar && (
                    <div className="mt-4 animate-fadeIn border-t border-slate-800 pt-4">
                      <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">
                        Detalle / Observaciones del contexto de violencia
                      </label>
                      <textarea
                        value={formViolenciaDetalle}
                        onChange={(e) => setFormViolenciaDetalle(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-850 rounded-lg text-white focus:outline-none text-sm h-20 resize-none"
                        placeholder="Describa brevemente sin comprometer la identidad si no es necesario..."
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 5: Observaciones Generales */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                5. Observaciones Adicionales y Notas de Campo
              </h3>
              <div>
                <textarea
                  value={formTextoLibre}
                  onChange={(e) => setFormTextoLibre(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base h-24 resize-none"
                  placeholder="Ingrese aquí notas adicionales de seguimiento, observaciones clínicas o de acompañamiento social..."
                />
              </div>
            </div>

            {/* Section 6: Referente / Tutor (ninez only) */}
            {dispositivoTipo === 'ninez' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                  6. Referente / Tutor
                </h3>
                <p className="text-xs text-slate-500">Datos de contacto del responsable del niño/a. Se utilizarán para enviar avisos automáticos ante inasistencias reiteradas.</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Nombre del Tutor/Referente</label>
                    <input
                      type="text"
                      value={formTutorNombre}
                      onChange={(e) => setFormTutorNombre(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-base"
                      placeholder="Ej. María González"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> WhatsApp (con código de país)
                    </label>
                    <input
                      type="tel"
                      value={formTutorTelefono}
                      onChange={(e) => setFormTutorTelefono(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-base"
                      placeholder="+5491112345678"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Form Footer */}
          <div className="bg-slate-950 border-t border-slate-800 px-5 py-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setViewMode('list');
                setSelectedPerson(null);
              }}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-600 hover:to-teal-500 text-slate-950 font-bold rounded-xl text-sm transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : 'Guardar Ficha'}
            </button>
          </div>
        </form>
      )}

      {/* ASISTENCIA VIEW */}
      {viewMode === 'asistencia' && (
        <div className="space-y-5">
          {/* Sub-tab switcher */}
          <div className="flex gap-1 bg-slate-900/80 border border-slate-800/60 rounded-2xl p-1.5 w-fit">
            <button
              onClick={() => setAttendanceSubTab('marcar')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                attendanceSubTab === 'marcar'
                  ? 'bg-sky-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              Marcar hoy
            </button>
            <button
              onClick={() => { setAttendanceSubTab('seguimiento'); loadAttendanceStats(); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                attendanceSubTab === 'seguimiento'
                  ? 'bg-sky-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              Seguimiento
            </button>
          </div>

          {/* MARCAR HOY */}
          {attendanceSubTab === 'marcar' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">Asistencia del día</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    {attendanceAlreadySaved && <span className="ml-2 text-emerald-400 font-semibold">• Ya guardada</span>}
                  </p>
                </div>
                <button
                  onClick={handleSaveAttendance}
                  disabled={savingAttendance || activePeople.length === 0}
                  className="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-400 hover:from-sky-400 hover:to-blue-300 text-slate-950 font-bold text-sm rounded-xl flex items-center gap-2 disabled:opacity-50 transition-all"
                >
                  <Save className="w-4 h-4" />
                  {savingAttendance ? 'Guardando...' : attendanceAlreadySaved ? 'Actualizar' : 'Guardar asistencia'}
                </button>
              </div>

              {activePeople.length === 0 ? (
                <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-500 text-sm">
                  No hay beneficiarios activos en este centro.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {activePeople.map((person) => {
                    const isPresente = todayAttendanceMap[person.dni] ?? true;
                    const initials = `${person.nombre[0] || ''}${person.apellido[0] || ''}`.toUpperCase();
                    return (
                      <div
                        key={person.dni}
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                          isPresente
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : 'bg-red-500/5 border-red-500/20'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-slate-950 ${isPresente ? 'bg-emerald-400' : 'bg-red-400'}`}>
                            {initials}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{person.nombre} {person.apellido}</p>
                            <p className="text-[11px] text-slate-400 font-mono">{person.dni}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTodayAttendanceMap(prev => ({ ...prev, [person.dni]: !(prev[person.dni] ?? true) }))}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            isPresente
                              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                              : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                          }`}
                        >
                          {isPresente ? (
                            <><ToggleRight className="w-4 h-4" /> Presente</>
                          ) : (
                            <><ToggleLeft className="w-4 h-4" /> Ausente</>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SEGUIMIENTO */}
          {attendanceSubTab === 'seguimiento' && (
            <div className="space-y-5">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="bg-slate-900/80 border border-emerald-500/20 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-400 uppercase">Presentes hoy</span>
                  </div>
                  <p className="text-3xl font-black text-emerald-400">{attendanceStats?.presentesHoy ?? '—'}</p>
                </div>
                <div className="bg-slate-900/80 border border-red-500/20 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="w-4 h-4 text-red-400" />
                    <span className="text-xs font-bold text-slate-400 uppercase">Ausentes hoy</span>
                  </div>
                  <p className="text-3xl font-black text-red-400">{attendanceStats?.ausentesHoy ?? '—'}</p>
                </div>
                <div className="bg-slate-900/80 border border-sky-500/20 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ClipboardList className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-bold text-slate-400 uppercase">Asistencia mes</span>
                  </div>
                  <p className="text-3xl font-black text-sky-400">{attendanceStats ? `${attendanceStats.porcentajeMes}%` : '—'}</p>
                </div>
                <div className="bg-slate-900/80 border border-orange-500/30 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Bell className="w-4 h-4 text-orange-400" />
                    <span className="text-xs font-bold text-slate-400 uppercase">Faltas críticas</span>
                  </div>
                  <p className="text-3xl font-black text-orange-400">{attendanceStats?.faltasCriticas ?? '—'}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">2+ días seguidos</p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o DNI..."
                    value={attendanceFilter}
                    onChange={(e) => setAttendanceFilter(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40 placeholder-slate-600"
                  />
                </div>
                <input
                  type="number"
                  placeholder="Faltas mes ≥"
                  value={attendanceMinFaltas}
                  onChange={(e) => setAttendanceMinFaltas(e.target.value)}
                  className="w-36 px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40 placeholder-slate-600"
                  min={0}
                />
                <input
                  type="number"
                  placeholder="Consecutivas ≥"
                  value={attendanceMinConsecutive}
                  onChange={(e) => setAttendanceMinConsecutive(e.target.value)}
                  className="w-36 px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40 placeholder-slate-600"
                  min={0}
                />
              </div>

              {/* Table */}
              {loadingAttendance ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(n => <div key={n} className="h-14 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />)}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 text-xs uppercase">
                        <th className="text-left px-4 py-3 font-bold">Nombre</th>
                        <th className="text-left px-4 py-3 font-bold">DNI</th>
                        <th className="text-center px-4 py-3 font-bold">Faltas mes</th>
                        <th className="text-center px-4 py-3 font-bold">Consecutivas</th>
                        <th className="text-center px-4 py-3 font-bold">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {attendanceDetailRows
                        .filter(row => {
                          const q = attendanceFilter.toLowerCase();
                          const matchQ = !q || `${row.nombre} ${row.apellido}`.toLowerCase().includes(q) || row.dni.includes(q);
                          const matchFaltas = !attendanceMinFaltas || row.faltasMes >= parseInt(attendanceMinFaltas);
                          const matchConsec = !attendanceMinConsecutive || row.consecutivasActuales >= parseInt(attendanceMinConsecutive);
                          return matchQ && matchFaltas && matchConsec;
                        })
                        .map(row => {
                          const isCritical = row.consecutivasActuales >= 2;
                          return (
                            <tr key={row.dni} className={`transition-colors ${isCritical ? 'bg-orange-500/5 hover:bg-orange-500/10' : 'bg-slate-900/60 hover:bg-slate-800/60'}`}>
                              <td className="px-4 py-3 font-semibold text-white flex items-center gap-2">
                                {isCritical && <span className="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.7)]" />}
                                {row.nombre} {row.apellido}
                              </td>
                              <td className="px-4 py-3 text-slate-400 font-mono">{row.dni}</td>
                              <td className="px-4 py-3 text-center font-bold text-slate-300">{row.faltasMes}</td>
                              <td className={`px-4 py-3 text-center font-black ${isCritical ? 'text-orange-400' : 'text-slate-300'}`}>
                                {row.consecutivasActuales}
                              </td>
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
                  {attendanceDetailRows.filter(row => {
                    const q = attendanceFilter.toLowerCase();
                    const matchQ = !q || `${row.nombre} ${row.apellido}`.toLowerCase().includes(q) || row.dni.includes(q);
                    const matchFaltas = !attendanceMinFaltas || row.faltasMes >= parseInt(attendanceMinFaltas);
                    const matchConsec = !attendanceMinConsecutive || row.consecutivasActuales >= parseInt(attendanceMinConsecutive);
                    return matchQ && matchFaltas && matchConsec;
                  }).length === 0 && (
                    <div className="p-8 text-center text-slate-500 text-sm">
                      No hay registros que coincidan con los filtros.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
