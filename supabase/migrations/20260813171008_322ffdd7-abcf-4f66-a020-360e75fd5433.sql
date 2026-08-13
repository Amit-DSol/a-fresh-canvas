-- Guard: helpers only answer for the calling user (service role/system unaffected)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN coalesce(auth.role(),'') <> 'service_role' AND auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) END
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_coordinator(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN coalesce(auth.role(),'') <> 'service_role' AND auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','coordinator')) END
$$;

CREATE OR REPLACE FUNCTION public.is_class_teacher_of(_user_id uuid, _class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN coalesce(auth.role(),'') <> 'service_role' AND auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE EXISTS (
    SELECT 1 FROM public.teacher_classes tc
    JOIN public.teachers t ON t.id = tc.teacher_id
    WHERE t.profile_id = _user_id AND tc.class_id = _class_id AND tc.is_class_teacher = true
  ) END
$$;

CREATE OR REPLACE FUNCTION public.is_own_student(_user_id uuid, _student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN coalesce(auth.role(),'') <> 'service_role' AND auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE EXISTS (SELECT 1 FROM public.students s WHERE s.id = _student_id AND s.profile_id = _user_id) END
$$;

CREATE OR REPLACE FUNCTION public.is_parent_of_student(_user_id uuid, _student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN coalesce(auth.role(),'') <> 'service_role' AND auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE (EXISTS (SELECT 1 FROM public.students s WHERE s.id = _student_id AND s.parent_profile_id = _user_id)
     OR EXISTS (SELECT 1 FROM public.student_guardians sg WHERE sg.student_id = _student_id AND sg.parent_profile_id = _user_id)) END
$$;

CREATE OR REPLACE FUNCTION public.my_children_ids(_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id FROM public.students s
  WHERE s.parent_profile_id = _user_id
    AND (coalesce(auth.role(),'') = 'service_role' OR auth.uid() IS NULL OR _user_id = auth.uid())
  UNION
  SELECT sg.student_id FROM public.student_guardians sg
  WHERE sg.parent_profile_id = _user_id
    AND (coalesce(auth.role(),'') = 'service_role' OR auth.uid() IS NULL OR _user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.parent_child_class_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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

CREATE OR REPLACE FUNCTION public.parent_of_class(_user_id uuid, _class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN coalesce(auth.role(),'') <> 'service_role' AND auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE EXISTS (
    SELECT 1 FROM public.students s
    LEFT JOIN public.student_guardians sg ON sg.student_id = s.id
    WHERE s.class_id = _class_id AND (s.parent_profile_id = _user_id OR sg.parent_profile_id = _user_id)
  ) END
$$;

CREATE OR REPLACE FUNCTION public.student_class_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT class_id FROM public.students
  WHERE profile_id = _user_id
    AND (coalesce(auth.role(),'') = 'service_role' OR auth.uid() IS NULL OR _user_id = auth.uid())
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.teacher_teaches_class(_user_id uuid, _class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN coalesce(auth.role(),'') <> 'service_role' AND auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE EXISTS (
    SELECT 1 FROM public.teacher_classes tc
    JOIN public.teachers t ON t.id = tc.teacher_id
    WHERE t.profile_id = _user_id AND tc.class_id = _class_id
  ) END
$$;

CREATE OR REPLACE FUNCTION public.teacher_teaches_subject(_user_id uuid, _class_id uuid, _subject_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN coalesce(auth.role(),'') <> 'service_role' AND auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE EXISTS (
    SELECT 1 FROM public.teacher_subjects ts
    JOIN public.teachers t ON t.id = ts.teacher_id
    WHERE t.profile_id = _user_id AND ts.class_id = _class_id AND ts.subject_id = _subject_id
  ) END
$$;

CREATE OR REPLACE FUNCTION public.user_in_class(_user_id uuid, _class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN coalesce(auth.role(),'') <> 'service_role' AND auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE EXISTS (
    SELECT 1 FROM public.students s
    LEFT JOIN public.student_guardians sg ON sg.student_id = s.id
    WHERE s.class_id = _class_id
      AND (s.profile_id = _user_id OR s.parent_profile_id = _user_id OR sg.parent_profile_id = _user_id)
  ) END
$$;

CREATE OR REPLACE FUNCTION public.user_in_exam(_user_id uuid, _exam_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN coalesce(auth.role(),'') <> 'service_role' AND auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE EXISTS (
    SELECT 1 FROM public.exam_classes ec
    WHERE ec.exam_id = _exam_id
      AND (public.teacher_teaches_class(_user_id, ec.class_id)
        OR ec.class_id = public.student_class_id(_user_id)
        OR public.parent_of_class(_user_id, ec.class_id))
  ) END
$$;

CREATE OR REPLACE FUNCTION public.user_sees_teacher(_user_id uuid, _teacher_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN coalesce(auth.role(),'') <> 'service_role' AND auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE EXISTS (
    SELECT 1 FROM public.teacher_classes tc
    JOIN public.students s ON s.class_id = tc.class_id
    LEFT JOIN public.student_guardians sg ON sg.student_id = s.id
    WHERE tc.teacher_id = _teacher_id
      AND (s.profile_id = _user_id OR s.parent_profile_id = _user_id OR sg.parent_profile_id = _user_id)
  ) END
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_coordinator(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_class_teacher_of(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_own_student(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_parent_of_student(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_children_ids(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.parent_child_class_id(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.parent_of_class(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.student_class_id(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.teacher_teaches_class(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.teacher_teaches_subject(uuid, uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_in_class(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_in_exam(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_sees_teacher(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.teacher_profile_id(uuid) FROM anon, PUBLIC;