-- Script para generar Data Simulada (Mock Data) para FundaData
-- Este script inserta 8 beneficiarios aleatorios por cada dispositivo (80 en total).
-- Copiá y pegá esto en el SQL Editor de Supabase y dale a "Run".

DO $$
DECLARE
    d RECORD;
    i INT;
    v_dni TEXT;
    v_nombre TEXT;
    v_apellido TEXT;
    v_fecha_nac DATE;
    v_sexo TEXT;
    v_barrio TEXT;
    v_vinculo_id INT;
    nombres TEXT[] := ARRAY['Lucas', 'Martina', 'Mateo', 'Sofia', 'Benjamín', 'Valentina', 'Joaquín', 'Camila', 'Tomás', 'Julieta', 'Facundo', 'Lucía', 'Santino', 'Mía', 'Bautista', 'Florencia', 'Ignacio', 'Paula', 'Nicolás', 'Renata'];
    apellidos TEXT[] := ARRAY['García', 'Fernández', 'López', 'Martínez', 'González', 'Pérez', 'Rodríguez', 'Sánchez', 'Romero', 'Sosa', 'Álvarez', 'Torres', 'Ruiz', 'Ramírez', 'Flores', 'Benítez', 'Acosta', 'Medina', 'Herrera', 'Aguilar'];
    barrios TEXT[] := ARRAY['Centro', 'Norte', 'Sur', 'Oeste', 'Este', 'San Martín', 'Belgrano', 'Alberdi', 'Pueyrredón', 'General Paz'];
    sexos TEXT[] := ARRAY['Masculino', 'Femenino', 'Otro'];
    estados TEXT[] := ARRAY['activo', 'activo', 'activo', 'activo', 'egresado', 'inasistencia_prolongada'];
    v_estado TEXT;
    v_consumo BOOLEAN;
    v_violencia BOOLEAN;
    v_edad_min INT;
    v_edad_max INT;
BEGIN
    -- Iterar por cada dispositivo (centro) existente
    FOR d IN SELECT id, tipo FROM public.dispositivo LOOP
        
        -- El rango de edad depende del tipo de centro
        IF d.tipo = 'ninez' THEN
            v_edad_min := 3;
            v_edad_max := 15;
        ELSE
            v_edad_min := 18;
            v_edad_max := 75;
        END IF;

        -- Insertar 8 personas por centro
        FOR i IN 1..8 LOOP
            -- Generar datos aleatorios
            v_dni := (floor(random() * 40000000) + 10000000)::TEXT;
            v_nombre := nombres[floor(random() * array_length(nombres, 1)) + 1];
            v_apellido := apellidos[floor(random() * array_length(apellidos, 1)) + 1];
            v_fecha_nac := CURRENT_DATE - (floor(random() * (v_edad_max - v_edad_min + 1) + v_edad_min) || ' years')::INTERVAL - (floor(random() * 365) || ' days')::INTERVAL;
            v_sexo := sexos[floor(random() * array_length(sexos, 1)) + 1];
            v_barrio := barrios[floor(random() * array_length(barrios, 1)) + 1];
            v_estado := estados[floor(random() * array_length(estados, 1)) + 1];
            v_consumo := random() < 0.2; -- 20% de probabilidad
            v_violencia := random() < 0.15; -- 15% de probabilidad

            -- 1. Insertar Persona (ignorando si el DNI casualmente se repite)
            INSERT INTO public.persona (dni, nombre, apellido, fecha_nacimiento, sexo, barrio)
            VALUES (v_dni, v_nombre, v_apellido, v_fecha_nac, v_sexo, v_barrio)
            ON CONFLICT (dni) DO NOTHING;

            -- 2. Insertar Vinculo
            INSERT INTO public.vinculo (dni, dispositivo_id, estado, fecha_alta, motivo_egreso)
            VALUES (
                v_dni, 
                d.id, 
                v_estado, 
                CURRENT_DATE - (floor(random() * 365) || ' days')::INTERVAL,
                CASE WHEN v_estado = 'egresado' THEN 'Finalización de etapa o mudanza' ELSE NULL END
            ) RETURNING id INTO v_vinculo_id;

            -- 3. Insertar Fichas correspondientes
            IF d.tipo = 'ninez' THEN
                INSERT INTO public.ficha_ninez (vinculo_id, escolarizado, discapacidad, referenciado_salud, consumo_activo, violencia_familiar, observaciones)
                VALUES (
                    v_vinculo_id,
                    random() > 0.1, -- 90% están escolarizados
                    random() < 0.05, -- 5% tiene discapacidad
                    random() > 0.2, -- 80% referenciado a salud
                    v_consumo,
                    v_violencia,
                    '{}'
                );
            ELSE
                INSERT INTO public.ficha_dia (vinculo_id, tiene_cud, limitacion_permanente, nivel_educativo, situacion_habitacional, consumo_activo, violencia_familiar, observaciones)
                VALUES (
                    v_vinculo_id,
                    random() < 0.15,
                    CASE WHEN random() < 0.1 THEN 'Motriz' ELSE 'Ninguna' END,
                    CASE WHEN random() < 0.5 THEN 'Secundario Incompleto' ELSE 'Secundario Completo' END,
                    'Vivienda Familiar',
                    v_consumo,
                    v_violencia,
                    '{}'
                );
            END IF;
        END LOOP;
    END LOOP;
END $$;
