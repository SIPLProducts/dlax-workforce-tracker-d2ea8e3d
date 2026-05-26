DO $$
DECLARE
  rec RECORD;
  parsed jsonb;
  k text;
  v int;
  cat_name text;
  dept_name text;
  cat_id uuid;
  dept_id uuid;
  legacy_map jsonb := '{
    "civil_rod_bending":["CIVIL","Rod Bending"],
    "civil_shuttering":["CIVIL","Shuttering"],
    "civil_mason":["CIVIL","Mason"],
    "civil_scaffolders":["CIVIL","Scaffolders"],
    "civil_painters":["CIVIL","Painters"],
    "civil_helpers":["CIVIL","Helpers"],
    "mep_plumbers":["MEP","Plumbers"],
    "mep_carpenters":["MEP","Carpenters"],
    "mep_fitters":["MEP","Fitters"],
    "mep_welders":["MEP","Welders"],
    "mep_electricians":["MEP","Electricians"],
    "mep_helpers":["MEP","Helpers"],
    "nmr_mason":["NMR Man powers","Mason"],
    "nmr_mc":["NMR Man powers","M/C"],
    "nmr_fc":["NMR Man powers","F /C"]
  }'::jsonb;
  is_first boolean;
  free_remarks text;
BEGIN
  FOR rec IN
    SELECT * FROM public.daily_manpower
    WHERE remarks IS NOT NULL AND remarks ~ '^\s*\{'
  LOOP
    BEGIN
      parsed := rec.remarks::jsonb;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;
    free_remarks := COALESCE(parsed->>'_remarks', '');
    is_first := true;
    FOR k IN SELECT jsonb_object_keys(parsed) LOOP
      IF k = '_remarks' THEN CONTINUE; END IF;
      IF NOT (legacy_map ? k) THEN CONTINUE; END IF;
      BEGIN v := COALESCE((parsed->>k)::int, 0); EXCEPTION WHEN OTHERS THEN v := 0; END;
      IF v = 0 THEN CONTINUE; END IF;
      dept_name := legacy_map->k->>0;
      cat_name := legacy_map->k->>1;
      SELECT id INTO dept_id FROM public.departments WHERE name = dept_name LIMIT 1;
      SELECT id INTO cat_id FROM public.worker_categories WHERE name = cat_name LIMIT 1;
      IF dept_id IS NULL OR cat_id IS NULL THEN CONTINUE; END IF;

      IF is_first THEN
        UPDATE public.daily_manpower
          SET department_id = dept_id, category_id = cat_id, headcount = v,
              remarks = NULLIF(free_remarks, '')
          WHERE id = rec.id;
        is_first := false;
      ELSE
        INSERT INTO public.daily_manpower
          (project_id, entry_date, contractor_id, department_id, category_id,
           headcount, security_count, deficiency_manpower, remarks, weather_condition,
           status, created_by, submitted_by, sheet_id)
        VALUES
          (rec.project_id, rec.entry_date, rec.contractor_id, dept_id, cat_id,
           v, 0, 0, NULL, rec.weather_condition,
           rec.status, rec.created_by, rec.submitted_by, rec.sheet_id)
        ON CONFLICT (entry_date, project_id, contractor_id, department_id, category_id) DO NOTHING;
      END IF;
    END LOOP;
    IF is_first THEN
      UPDATE public.daily_manpower SET remarks = NULLIF(free_remarks, '') WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;