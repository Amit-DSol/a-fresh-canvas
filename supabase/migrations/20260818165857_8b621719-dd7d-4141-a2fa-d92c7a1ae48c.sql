CREATE TYPE public.app_role AS ENUM ('admin','coordinator','teacher','parent','student');
CREATE TYPE public.attendance_status AS ENUM ('present','absent','late','holiday');
CREATE TYPE public.guardian_relation AS ENUM ('mother','father','guardian');

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text DEFAULT ''::text NOT NULL,
    email text NOT NULL,
    phone text,
    avatar_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    password_set boolean DEFAULT false NOT NULL
);
CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.classes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    section text NOT NULL,
    academic_year text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.subjects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    class_id uuid NOT NULL,
    name text NOT NULL,
    code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.teachers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    employee_id text,
    is_coordinator boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.students (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    class_id uuid,
    roll_number text,
    admission_number text,
    date_of_birth date,
    gender text,
    address text,
    parent_profile_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT students_gender_check CHECK ((gender = ANY (ARRAY['Male'::text, 'Female'::text, 'Other'::text])))
);
CREATE TABLE public.student_guardians (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    parent_profile_id uuid NOT NULL,
    relation public.guardian_relation DEFAULT 'guardian'::public.guardian_relation NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    phone text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.teacher_classes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    teacher_id uuid NOT NULL,
    class_id uuid NOT NULL,
    is_class_teacher boolean DEFAULT false NOT NULL
);
CREATE TABLE public.teacher_subjects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    teacher_id uuid NOT NULL,
    class_id uuid NOT NULL,
    subject_id uuid NOT NULL
);
CREATE TABLE public.attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    class_id uuid NOT NULL,
    date date NOT NULL,
    status public.attendance_status NOT NULL,
    marked_by uuid,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.exams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    academic_year text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    starts_on date DEFAULT CURRENT_DATE,
    ends_on date DEFAULT CURRENT_DATE,
    results_declared boolean DEFAULT false NOT NULL
);
CREATE TABLE public.exam_classes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exam_id uuid NOT NULL,
    class_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.exam_dates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exam_id uuid NOT NULL,
    exam_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.exam_papers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exam_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    paper_date date NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    room text,
    max_marks numeric DEFAULT 100 NOT NULL,
    pass_marks numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    class_id uuid NOT NULL
);
CREATE TABLE public.marks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    marks_obtained numeric,
    grade text,
    remarks text,
    entered_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    exam_paper_id uuid NOT NULL
);
CREATE TABLE public.homework (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    class_id uuid NOT NULL,
    subject_id uuid,
    teacher_id uuid,
    description text NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    due_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.timetable (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    class_id uuid NOT NULL,
    subject_id uuid,
    teacher_id uuid,
    day_of_week integer NOT NULL,
    period_number integer NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    CONSTRAINT timetable_day_of_week_check CHECK (((day_of_week >= 1) AND (day_of_week <= 6))),
    CONSTRAINT timetable_period_number_check CHECK (((period_number >= 1) AND (period_number <= 9)))
);
CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    body text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    parent_message_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT messages_body_check CHECK ((char_length(body) <= 500))
);
CREATE TABLE public.notices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    target_roles text[] DEFAULT '{all}'::text[] NOT NULL,
    is_pinned boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notices_target_roles_valid CHECK (((array_length(target_roles, 1) >= 1) AND (target_roles <@ ARRAY['all'::text, 'admin'::text, 'coordinator'::text, 'teacher'::text, 'parent'::text, 'student'::text])))
);
CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_id uuid NOT NULL,
    title text,
    message text,
    is_read boolean DEFAULT false NOT NULL,
    action_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.school_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text DEFAULT 'My School'::text NOT NULL,
    logo_url text,
    address text,
    city text,
    board text,
    academic_year text DEFAULT '2025-26'::text NOT NULL,
    principal_name text,
    phone text,
    email text,
    primary_color text DEFAULT '#1E40AF'::text NOT NULL,
    onboarding_complete boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
ALTER TABLE ONLY public.classes ADD CONSTRAINT classes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.subjects ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.teachers ADD CONSTRAINT teachers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.teachers ADD CONSTRAINT teachers_profile_id_key UNIQUE (profile_id);
ALTER TABLE ONLY public.students ADD CONSTRAINT students_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.students ADD CONSTRAINT students_profile_id_key UNIQUE (profile_id);
ALTER TABLE ONLY public.student_guardians ADD CONSTRAINT student_guardians_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.student_guardians ADD CONSTRAINT student_guardians_student_id_parent_profile_id_key UNIQUE (student_id, parent_profile_id);
ALTER TABLE ONLY public.student_guardians ADD CONSTRAINT student_guardians_student_id_relation_key UNIQUE (student_id, relation);
ALTER TABLE ONLY public.teacher_classes ADD CONSTRAINT teacher_classes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.teacher_classes ADD CONSTRAINT teacher_classes_teacher_id_class_id_key UNIQUE (teacher_id, class_id);
ALTER TABLE ONLY public.teacher_subjects ADD CONSTRAINT teacher_subjects_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.teacher_subjects ADD CONSTRAINT teacher_subjects_teacher_id_class_id_subject_id_key UNIQUE (teacher_id, class_id, subject_id);
ALTER TABLE ONLY public.attendance ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.attendance ADD CONSTRAINT attendance_student_id_date_key UNIQUE (student_id, date);
ALTER TABLE ONLY public.exams ADD CONSTRAINT exams_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.exam_classes ADD CONSTRAINT exam_classes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.exam_classes ADD CONSTRAINT exam_classes_exam_id_class_id_key UNIQUE (exam_id, class_id);
ALTER TABLE ONLY public.exam_dates ADD CONSTRAINT exam_dates_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.exam_dates ADD CONSTRAINT exam_dates_exam_id_exam_date_key UNIQUE (exam_id, exam_date);
ALTER TABLE ONLY public.exam_papers ADD CONSTRAINT exam_papers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.exam_papers ADD CONSTRAINT exam_papers_exam_class_date_key UNIQUE (exam_id, class_id, paper_date);
ALTER TABLE ONLY public.marks ADD CONSTRAINT marks_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.marks ADD CONSTRAINT marks_paper_student_unique UNIQUE (exam_paper_id, student_id);
ALTER TABLE ONLY public.homework ADD CONSTRAINT homework_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.timetable ADD CONSTRAINT timetable_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.timetable ADD CONSTRAINT timetable_class_id_day_of_week_period_number_key UNIQUE (class_id, day_of_week, period_number);
ALTER TABLE ONLY public.messages ADD CONSTRAINT messages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.notices ADD CONSTRAINT notices_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.school_settings ADD CONSTRAINT school_settings_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX teacher_classes_one_ct_per_class ON public.teacher_classes USING btree (class_id) WHERE (is_class_teacher = true);

ALTER TABLE ONLY public.subjects ADD CONSTRAINT subjects_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.teachers ADD CONSTRAINT teachers_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.students ADD CONSTRAINT students_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.students ADD CONSTRAINT students_parent_profile_id_fkey FOREIGN KEY (parent_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.students ADD CONSTRAINT students_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_guardians ADD CONSTRAINT student_guardians_parent_profile_id_fkey FOREIGN KEY (parent_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_guardians ADD CONSTRAINT student_guardians_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.teacher_classes ADD CONSTRAINT teacher_classes_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.teacher_classes ADD CONSTRAINT teacher_classes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.teacher_subjects ADD CONSTRAINT teacher_subjects_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.teacher_subjects ADD CONSTRAINT teacher_subjects_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.teacher_subjects ADD CONSTRAINT teacher_subjects_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.attendance ADD CONSTRAINT attendance_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.attendance ADD CONSTRAINT attendance_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.attendance ADD CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exams ADD CONSTRAINT exams_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.exam_classes ADD CONSTRAINT exam_classes_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_classes ADD CONSTRAINT exam_classes_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_dates ADD CONSTRAINT exam_dates_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_papers ADD CONSTRAINT exam_papers_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_papers ADD CONSTRAINT exam_papers_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_papers ADD CONSTRAINT exam_papers_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.marks ADD CONSTRAINT marks_entered_by_fkey FOREIGN KEY (entered_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.marks ADD CONSTRAINT marks_exam_paper_id_fkey FOREIGN KEY (exam_paper_id) REFERENCES public.exam_papers(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.marks ADD CONSTRAINT marks_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.homework ADD CONSTRAINT homework_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.homework ADD CONSTRAINT homework_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.homework ADD CONSTRAINT homework_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.timetable ADD CONSTRAINT timetable_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.timetable ADD CONSTRAINT timetable_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.timetable ADD CONSTRAINT timetable_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.messages ADD CONSTRAINT messages_parent_message_id_fkey FOREIGN KEY (parent_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.messages ADD CONSTRAINT messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.notices ADD CONSTRAINT notices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE FUNCTION public.current_user_role() RETURNS public.app_role
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid()
  ORDER BY CASE role
    WHEN 'admin' THEN 1 WHEN 'coordinator' THEN 2 WHEN 'teacher' THEN 3
    WHEN 'parent' THEN 4 WHEN 'student' THEN 5 END
  LIMIT 1
$$;
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN coalesce(auth.role(),'') <> 'service_role' AND auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) END
$$;
CREATE FUNCTION public.is_admin_or_coordinator(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN coalesce(auth.role(),'') <> 'service_role' AND auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','coordinator')) END
$$;
CREATE FUNCTION public.is_class_teacher_of(_user_id uuid, _class_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN coalesce(auth.role(),'') <> 'service_role' AND auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE EXISTS (
    SELECT 1 FROM public.teacher_classes tc
    JOIN public.teachers t ON t.id = tc.teacher_id
    WHERE t.profile_id = _user_id AND tc.class_id = _class_id AND tc.is_class_teacher = true
  ) END
$$;
CREATE FUNCTION public.is_own_student(_user_id uuid, _student_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN coalesce(auth.role(),'') <> 'service_role' AND auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE EXISTS (SELECT 1 FROM public.students s WHERE s.id = _student_id AND s.profile_id = _user_id) END
$$;
CREATE FUNCTION public.is_parent_of_student(_user_id uuid, _student_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN coalesce(auth.role(),'') <> 'service_role' AND auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE (EXISTS (SELECT 1 FROM public.students s WHERE s.id = _student_id AND s.parent_profile_id = _user_id)
     OR EXISTS (SELECT 1 FROM public.student_guardians sg WHERE sg.student_id = _student_id AND sg.parent_profile_id = _user_id)) END
$$;
CREATE FUNCTION public.my_children_ids(_user_id uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.id FROM public.students s
  WHERE s.parent_profile_id = _user_id
    AND (coalesce(auth.role(),'') = 'service_role' OR auth.uid() IS NULL OR _user_id = auth.uid())
  UNION
  SELECT sg.student_id FROM public.student_guardians sg
  WHERE sg.parent_profile_id = _user_id
    AND (coalesce(auth.role(),'') = 'service_role' OR auth.uid() IS NULL OR _user_id = auth.uid())
$$;
CREATE FUNCTION public.parent_child_class_id(_user_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.class_id FROM public.students s
  WHERE s.parent_profile_id = _user_id
    AND (coalesce(auth.role(),'') = 'service_role' OR auth.uid() IS NULL OR _user_id = auth.uid())
  UNION
  SELECT s.class_id FROM public.students s
  JOIN public.student_guardians sg ON sg.student_id = s.id
  WHERE sg.parent_profile_id = _user_id
    AND (coalesce(auth.role(),'') = 'service_role' OR auth.uid() IS NULL OR _user_id = auth.uid())
  LIMIT 1
$$;
CREATE FUNCTION public.parent_of_class(_user_id uuid, _class_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN coalesce(auth.role(),'') <> 'service_role' AND auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE EXISTS (
    SELECT 1 FROM public.students s
    LEFT JOIN public.student_guardians sg ON sg.student_id = s.id
    WHERE s.class_id = _class_id AND (s.parent_profile_id = _user_id OR sg.parent_profile_id = _user_id)
  ) END
$$;
CREATE FUNCTION public.student_class_id(_user_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT class_id FROM public.students
  WHERE profile_id = _user_id
    AND (coalesce(auth.role(),'') = 'service_role' OR auth.uid() IS NULL OR _user_id = auth.uid())
  LIMIT 1
$$;
CREATE FUNCTION public.teacher_profile_id(_teacher_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT profile_id FROM public.teachers WHERE id = _teacher_id
$$;
CREATE FUNCTION public.teacher_teaches_class(_user_id uuid, _class_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN coalesce(auth.role(),'') <> 'service_role' AND auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE EXISTS (
    SELECT 1 FROM public.teacher_classes tc
    JOIN public.teachers t ON t.id = tc.teacher_id
    WHERE t.profile_id = _user_id AND tc.class_id = _class_id
  ) END
$$;
CREATE FUNCTION public.teacher_teaches_subject(_user_id uuid, _class_id uuid, _subject_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN coalesce(auth.role(),'') <> 'service_role' AND auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE EXISTS (
    SELECT 1 FROM public.teacher_subjects ts
    JOIN public.teachers t ON t.id = ts.teacher_id
    WHERE t.profile_id = _user_id AND ts.class_id = _class_id AND ts.subject_id = _subject_id
  ) END
$$;
CREATE FUNCTION public.user_in_class(_user_id uuid, _class_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN coalesce(auth.role(),'') <> 'service_role' AND auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE EXISTS (
    SELECT 1 FROM public.students s
    LEFT JOIN public.student_guardians sg ON sg.student_id = s.id
    WHERE s.class_id = _class_id
      AND (s.profile_id = _user_id OR s.parent_profile_id = _user_id OR sg.parent_profile_id = _user_id)
  ) END
$$;
CREATE FUNCTION public.user_in_exam(_user_id uuid, _exam_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN coalesce(auth.role(),'') <> 'service_role' AND auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE EXISTS (
    SELECT 1 FROM public.exam_classes ec
    WHERE ec.exam_id = _exam_id
      AND (public.teacher_teaches_class(_user_id, ec.class_id)
        OR ec.class_id = public.student_class_id(_user_id)
        OR public.parent_of_class(_user_id, ec.class_id))
  ) END
$$;
CREATE FUNCTION public.user_sees_teacher(_user_id uuid, _teacher_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN coalesce(auth.role(),'') <> 'service_role' AND auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE EXISTS (
    SELECT 1 FROM public.teacher_classes tc
    JOIN public.students s ON s.class_id = tc.class_id
    LEFT JOIN public.student_guardians sg ON sg.student_id = s.id
    WHERE tc.teacher_id = _teacher_id
      AND (s.profile_id = _user_id OR s.parent_profile_id = _user_id OR sg.parent_profile_id = _user_id)
  ) END
$$;
CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE FUNCTION public.validate_exam_paper_date() RETURNS trigger
    LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.exam_dates d
    WHERE d.exam_id = NEW.exam_id AND d.exam_date = NEW.paper_date
  ) THEN
    RAISE EXCEPTION 'paper_date % is not one of the exam term''s selected dates', NEW.paper_date;
  END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_role public.app_role;
  v_is_first BOOLEAN;
  v_full_name TEXT;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO v_is_first;
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  IF v_is_first THEN v_role := 'admin'; ELSE v_role := 'student'; END IF;
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, v_full_name, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  IF v_is_first AND NOT EXISTS (SELECT 1 FROM public.school_settings) THEN
    INSERT INTO public.school_settings (name) VALUES ('My School');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_exam_paper_date BEFORE INSERT OR UPDATE ON public.exam_papers FOR EACH ROW EXECUTE FUNCTION public.validate_exam_paper_date();
CREATE TRIGGER trg_exam_papers_updated BEFORE UPDATE ON public.exam_papers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_marks_updated BEFORE UPDATE ON public.marks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_school_settings_updated BEFORE UPDATE ON public.school_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_student_guardians_updated BEFORE UPDATE ON public.student_guardians FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teachers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_guardians TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_classes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_subjects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_classes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_dates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_papers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homework TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timetable TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_settings TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.classes TO service_role;
GRANT ALL ON public.subjects TO service_role;
GRANT ALL ON public.teachers TO service_role;
GRANT ALL ON public.students TO service_role;
GRANT ALL ON public.student_guardians TO service_role;
GRANT ALL ON public.teacher_classes TO service_role;
GRANT ALL ON public.teacher_subjects TO service_role;
GRANT ALL ON public.attendance TO service_role;
GRANT ALL ON public.exams TO service_role;
GRANT ALL ON public.exam_classes TO service_role;
GRANT ALL ON public.exam_dates TO service_role;
GRANT ALL ON public.exam_papers TO service_role;
GRANT ALL ON public.marks TO service_role;
GRANT ALL ON public.homework TO service_role;
GRANT ALL ON public.timetable TO service_role;
GRANT ALL ON public.messages TO service_role;
GRANT ALL ON public.notices TO service_role;
GRANT ALL ON public.notifications TO service_role;
GRANT ALL ON public.school_settings TO service_role;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.touch_updated_at() TO service_role;
REVOKE ALL ON FUNCTION public.validate_exam_paper_date() FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_exam_paper_date() TO service_role;

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage profiles" ON public.profiles TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));
CREATE POLICY "Admin/coordinator read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Teachers read profiles of students in their classes" ON public.profiles FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM public.students s WHERE ((s.profile_id = profiles.id) AND public.teacher_teaches_class(auth.uid(), s.class_id)))));
CREATE POLICY "Parents read their child profile" ON public.profiles FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM public.students s WHERE ((s.profile_id = profiles.id) AND (s.parent_profile_id = auth.uid())))));
CREATE POLICY "Parent read child profile via guardian" ON public.profiles FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM (public.students s JOIN public.student_guardians sg ON ((sg.student_id = s.id))) WHERE ((s.profile_id = profiles.id) AND (sg.parent_profile_id = auth.uid())))));
CREATE POLICY "Admin read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Admin/coord manage classes" ON public.classes TO authenticated USING (public.is_admin_or_coordinator(auth.uid())) WITH CHECK (public.is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Scoped read classes" ON public.classes FOR SELECT TO authenticated USING ((public.is_admin_or_coordinator(auth.uid()) OR public.teacher_teaches_class(auth.uid(), id) OR (EXISTS ( SELECT 1 FROM (public.teacher_subjects ts JOIN public.teachers t ON ((t.id = ts.teacher_id))) WHERE ((t.profile_id = auth.uid()) AND (ts.class_id = classes.id)))) OR public.user_in_class(auth.uid(), id)));
CREATE POLICY "Admin/coord manage subjects" ON public.subjects TO authenticated USING (public.is_admin_or_coordinator(auth.uid())) WITH CHECK (public.is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Scoped read subjects" ON public.subjects FOR SELECT TO authenticated USING ((public.is_admin_or_coordinator(auth.uid()) OR public.teacher_teaches_class(auth.uid(), class_id) OR (EXISTS ( SELECT 1 FROM (public.teacher_subjects ts JOIN public.teachers t ON ((t.id = ts.teacher_id))) WHERE ((t.profile_id = auth.uid()) AND (ts.class_id = subjects.class_id)))) OR public.user_in_class(auth.uid(), class_id)));
CREATE POLICY "Admin/coord manage teachers" ON public.teachers TO authenticated USING (public.is_admin_or_coordinator(auth.uid())) WITH CHECK (public.is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Scoped read teachers" ON public.teachers FOR SELECT TO authenticated USING ((public.is_admin_or_coordinator(auth.uid()) OR (profile_id = auth.uid()) OR public.user_sees_teacher(auth.uid(), id)));
CREATE POLICY "Admin/coord manage students" ON public.students TO authenticated USING (public.is_admin_or_coordinator(auth.uid())) WITH CHECK (public.is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Admin/coord read all students" ON public.students FOR SELECT TO authenticated USING (public.is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Class teacher manage students" ON public.students TO authenticated USING (public.is_class_teacher_of(auth.uid(), class_id)) WITH CHECK (public.is_class_teacher_of(auth.uid(), class_id));
CREATE POLICY "Teacher read students in their classes" ON public.students FOR SELECT TO authenticated USING (public.teacher_teaches_class(auth.uid(), class_id));
CREATE POLICY "Student read own row" ON public.students FOR SELECT TO authenticated USING ((profile_id = auth.uid()));
CREATE POLICY "Parent read own child" ON public.students FOR SELECT TO authenticated USING ((parent_profile_id = auth.uid()));
CREATE POLICY "Parent read child via guardian" ON public.students FOR SELECT TO authenticated USING (public.is_parent_of_student(auth.uid(), id));
CREATE POLICY "Admin/coord manage guardians" ON public.student_guardians TO authenticated USING (public.is_admin_or_coordinator(auth.uid())) WITH CHECK (public.is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Class teacher manage guardians" ON public.student_guardians TO authenticated USING ((EXISTS ( SELECT 1 FROM public.students s WHERE ((s.id = student_guardians.student_id) AND public.is_class_teacher_of(auth.uid(), s.class_id))))) WITH CHECK ((EXISTS ( SELECT 1 FROM public.students s WHERE ((s.id = student_guardians.student_id) AND public.is_class_teacher_of(auth.uid(), s.class_id)))));
CREATE POLICY "Class teacher read guardians of class" ON public.student_guardians FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM public.students s WHERE ((s.id = student_guardians.student_id) AND public.is_class_teacher_of(auth.uid(), s.class_id)))));
CREATE POLICY "Parent read own guardian row" ON public.student_guardians FOR SELECT TO authenticated USING ((parent_profile_id = auth.uid()));
CREATE POLICY "Admin/coord manage teacher_classes" ON public.teacher_classes TO authenticated USING (public.is_admin_or_coordinator(auth.uid())) WITH CHECK (public.is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Scoped read teacher_classes" ON public.teacher_classes FOR SELECT TO authenticated USING ((public.is_admin_or_coordinator(auth.uid()) OR (EXISTS ( SELECT 1 FROM public.teachers t WHERE ((t.id = teacher_classes.teacher_id) AND (t.profile_id = auth.uid())))) OR public.user_in_class(auth.uid(), class_id)));
CREATE POLICY "Admin/coord manage teacher_subjects" ON public.teacher_subjects TO authenticated USING (public.is_admin_or_coordinator(auth.uid())) WITH CHECK (public.is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Scoped read teacher_subjects" ON public.teacher_subjects FOR SELECT TO authenticated USING ((public.is_admin_or_coordinator(auth.uid()) OR (EXISTS ( SELECT 1 FROM public.teachers t WHERE ((t.id = teacher_subjects.teacher_id) AND (t.profile_id = auth.uid())))) OR public.user_in_class(auth.uid(), class_id)));
CREATE POLICY "Admin/coord read all attendance" ON public.attendance FOR SELECT TO authenticated USING (public.is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Admin/coord delete attendance" ON public.attendance FOR DELETE TO authenticated USING (public.is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Teacher/coord/admin write attendance" ON public.attendance FOR INSERT TO authenticated WITH CHECK ((public.is_admin_or_coordinator(auth.uid()) OR public.teacher_teaches_class(auth.uid(), class_id)));
CREATE POLICY "Teacher/coord/admin update attendance" ON public.attendance FOR UPDATE TO authenticated USING ((public.is_admin_or_coordinator(auth.uid()) OR public.teacher_teaches_class(auth.uid(), class_id))) WITH CHECK ((public.is_admin_or_coordinator(auth.uid()) OR public.teacher_teaches_class(auth.uid(), class_id)));
CREATE POLICY "Teacher read class attendance" ON public.attendance FOR SELECT TO authenticated USING (public.teacher_teaches_class(auth.uid(), class_id));
CREATE POLICY "Student read own attendance" ON public.attendance FOR SELECT TO authenticated USING (public.is_own_student(auth.uid(), student_id));
CREATE POLICY "Parent read child attendance" ON public.attendance FOR SELECT TO authenticated USING (public.is_parent_of_student(auth.uid(), student_id));
CREATE POLICY "Admin/coord manage exams" ON public.exams TO authenticated USING (public.is_admin_or_coordinator(auth.uid())) WITH CHECK (public.is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Admin/coord read exams" ON public.exams FOR SELECT TO authenticated USING (public.is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Class members read exams" ON public.exams FOR SELECT TO authenticated USING (public.user_in_exam(auth.uid(), id));
CREATE POLICY "Admin/coord manage exam_classes" ON public.exam_classes TO authenticated USING (public.is_admin_or_coordinator(auth.uid())) WITH CHECK (public.is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Class members read exam_classes" ON public.exam_classes FOR SELECT TO authenticated USING (public.user_in_exam(auth.uid(), exam_id));
CREATE POLICY "Admin/coord manage exam_dates" ON public.exam_dates TO authenticated USING (public.is_admin_or_coordinator(auth.uid())) WITH CHECK (public.is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Class members read exam_dates" ON public.exam_dates FOR SELECT TO authenticated USING (public.user_in_exam(auth.uid(), exam_id));
CREATE POLICY "Admin/coord manage exam_papers" ON public.exam_papers TO authenticated USING (public.is_admin_or_coordinator(auth.uid())) WITH CHECK (public.is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Admin/coord read exam_papers" ON public.exam_papers FOR SELECT TO authenticated USING (public.is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Class teacher manage exam_papers" ON public.exam_papers TO authenticated USING (public.is_class_teacher_of(auth.uid(), class_id)) WITH CHECK (public.is_class_teacher_of(auth.uid(), class_id));
CREATE POLICY "Class member read exam_papers" ON public.exam_papers FOR SELECT TO authenticated USING ((public.teacher_teaches_class(auth.uid(), class_id) OR (class_id = public.student_class_id(auth.uid())) OR public.parent_of_class(auth.uid(), class_id)));
CREATE POLICY "Admin/coord manage marks" ON public.marks TO authenticated USING (public.is_admin_or_coordinator(auth.uid())) WITH CHECK (public.is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Admin/coord read marks" ON public.marks FOR SELECT TO authenticated USING (public.is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Class teacher manage marks" ON public.marks TO authenticated USING ((EXISTS ( SELECT 1 FROM (public.exam_papers p JOIN public.exams e ON ((e.id = p.exam_id))) WHERE ((p.id = marks.exam_paper_id) AND public.is_class_teacher_of(auth.uid(), p.class_id) AND (e.results_declared = false))))) WITH CHECK ((EXISTS ( SELECT 1 FROM (public.exam_papers p JOIN public.exams e ON ((e.id = p.exam_id))) WHERE ((p.id = marks.exam_paper_id) AND public.is_class_teacher_of(auth.uid(), p.class_id) AND (e.results_declared = false)))));
CREATE POLICY "Class teacher read marks" ON public.marks FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM public.exam_papers p WHERE ((p.id = marks.exam_paper_id) AND public.is_class_teacher_of(auth.uid(), p.class_id)))));
CREATE POLICY "Subject teacher manage own marks" ON public.marks TO authenticated USING ((EXISTS ( SELECT 1 FROM (public.exam_papers p JOIN public.exams e ON ((e.id = p.exam_id))) WHERE ((p.id = marks.exam_paper_id) AND public.teacher_teaches_subject(auth.uid(), p.class_id, p.subject_id) AND (e.results_declared = false))))) WITH CHECK ((EXISTS ( SELECT 1 FROM (public.exam_papers p JOIN public.exams e ON ((e.id = p.exam_id))) WHERE ((p.id = marks.exam_paper_id) AND public.teacher_teaches_subject(auth.uid(), p.class_id, p.subject_id) AND (e.results_declared = false)))));
CREATE POLICY "Subject teacher read own marks" ON public.marks FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM public.exam_papers p WHERE ((p.id = marks.exam_paper_id) AND public.teacher_teaches_subject(auth.uid(), p.class_id, p.subject_id)))));
CREATE POLICY "Student read own marks if declared" ON public.marks FOR SELECT TO authenticated USING ((public.is_own_student(auth.uid(), student_id) AND (EXISTS ( SELECT 1 FROM (public.exam_papers p JOIN public.exams e ON ((e.id = p.exam_id))) WHERE ((p.id = marks.exam_paper_id) AND e.results_declared)))));
CREATE POLICY "Parent read child marks if declared" ON public.marks FOR SELECT TO authenticated USING ((public.is_parent_of_student(auth.uid(), student_id) AND (EXISTS ( SELECT 1 FROM (public.exam_papers p JOIN public.exams e ON ((e.id = p.exam_id))) WHERE ((p.id = marks.exam_paper_id) AND e.results_declared)))));
CREATE POLICY "Admin/coord read all homework" ON public.homework FOR SELECT TO authenticated USING (public.is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Teacher/coord/admin insert homework" ON public.homework FOR INSERT TO authenticated WITH CHECK ((public.is_admin_or_coordinator(auth.uid()) OR public.teacher_teaches_class(auth.uid(), class_id)));
CREATE POLICY "Teacher/coord/admin update homework" ON public.homework FOR UPDATE TO authenticated USING ((public.is_admin_or_coordinator(auth.uid()) OR public.teacher_teaches_class(auth.uid(), class_id)));
CREATE POLICY "Teacher/coord/admin delete homework" ON public.homework FOR DELETE TO authenticated USING ((public.is_admin_or_coordinator(auth.uid()) OR public.teacher_teaches_class(auth.uid(), class_id)));
CREATE POLICY "Teacher read class homework" ON public.homework FOR SELECT TO authenticated USING (public.teacher_teaches_class(auth.uid(), class_id));
CREATE POLICY "Student read class homework" ON public.homework FOR SELECT TO authenticated USING ((class_id = public.student_class_id(auth.uid())));
CREATE POLICY "Parent read child class homework" ON public.homework FOR SELECT TO authenticated USING ((class_id = public.parent_child_class_id(auth.uid())));
CREATE POLICY "Admin/coord manage timetable" ON public.timetable TO authenticated USING (public.is_admin_or_coordinator(auth.uid())) WITH CHECK (public.is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Scoped read timetable" ON public.timetable FOR SELECT TO authenticated USING ((public.is_admin_or_coordinator(auth.uid()) OR (EXISTS ( SELECT 1 FROM public.teachers t WHERE ((t.id = timetable.teacher_id) AND (t.profile_id = auth.uid())))) OR public.teacher_teaches_class(auth.uid(), class_id) OR public.user_in_class(auth.uid(), class_id)));
CREATE POLICY "Sender sends messages" ON public.messages FOR INSERT TO authenticated WITH CHECK ((sender_id = auth.uid()));
CREATE POLICY "Sender deletes own messages" ON public.messages FOR DELETE TO authenticated USING ((sender_id = auth.uid()));
CREATE POLICY "Recipient marks read" ON public.messages FOR UPDATE TO authenticated USING ((recipient_id = auth.uid())) WITH CHECK ((recipient_id = auth.uid()));
CREATE POLICY "Sender/recipient read messages" ON public.messages FOR SELECT TO authenticated USING (((sender_id = auth.uid()) OR (recipient_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));
CREATE POLICY "Admin/coord manage notices" ON public.notices TO authenticated USING (public.is_admin_or_coordinator(auth.uid())) WITH CHECK (public.is_admin_or_coordinator(auth.uid()));
CREATE POLICY "Scoped read notices" ON public.notices FOR SELECT TO authenticated USING ((public.is_admin_or_coordinator(auth.uid()) OR ('all'::text = ANY (target_roles)) OR (EXISTS ( SELECT 1 FROM public.user_roles ur WHERE ((ur.user_id = auth.uid()) AND ((ur.role)::text = ANY (notices.target_roles)))))));
CREATE POLICY "Admins and self create notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK ((public.is_admin_or_coordinator(auth.uid()) OR (recipient_id = auth.uid())));
CREATE POLICY "Recipient reads own notifications" ON public.notifications FOR SELECT TO authenticated USING ((recipient_id = auth.uid()));
CREATE POLICY "Recipient updates own notifications" ON public.notifications FOR UPDATE TO authenticated USING ((recipient_id = auth.uid())) WITH CHECK ((recipient_id = auth.uid()));
CREATE POLICY "Admins manage school settings" ON public.school_settings TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "School settings readable by admin/coordinator" ON public.school_settings FOR SELECT TO authenticated USING (public.is_admin_or_coordinator(auth.uid()));