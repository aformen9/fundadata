import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const TWILIO_WHATSAPP_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM')!; // e.g. whatsapp:+14155238886

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (_req) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Find children absent both today and yesterday, with a tutor registered and no notification sent today
    const { data: candidates, error } = await supabase.rpc('get_consecutive_absences', {
      p_today: today,
      p_yesterday: yesterday,
    });

    if (error) throw error;

    const results: { dni: string; enviado: boolean; error?: string }[] = [];

    for (const row of (candidates || []) as any[]) {
      const mensaje = `Hola ${row.tutor_nombre}, queremos informarle que ${row.nombre} ${row.apellido} lleva 2 días seguidos sin asistir al centro. Por favor comuníquese con nosotros. — FundaData`;

      let enviado = false;
      let errorMsg: string | undefined;

      try {
        const twilioRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              From: TWILIO_WHATSAPP_FROM,
              To: `whatsapp:${row.telefono}`,
              Body: mensaje,
            }).toString(),
          }
        );

        if (twilioRes.ok) {
          enviado = true;
        } else {
          const errBody = await twilioRes.text();
          errorMsg = `Twilio error ${twilioRes.status}: ${errBody}`;
        }
      } catch (e: any) {
        errorMsg = e.message;
      }

      await supabase.from('notificacion_log').insert({
        dni: row.dni,
        dispositivo_id: row.dispositivo_id,
        fecha_envio: today,
        mensaje,
        enviado,
        error_msg: errorMsg ?? null,
      });

      results.push({ dni: row.dni, enviado, error: errorMsg });
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
