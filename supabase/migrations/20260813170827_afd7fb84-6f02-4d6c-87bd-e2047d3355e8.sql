-- 1. SECURITY DEFINER helpers: not callable by signed-out visitors
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
REVOKE EXECUTE ON FUNCTION public.teacher_profile_id(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.teacher_teaches_class(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.teacher_teaches_subject(uuid, uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_in_class(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_in_exam(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_sees_teacher(uuid, uuid) FROM anon, PUBLIC;

-- Trigger-only functions must not be callable by any API role
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_exam_paper_date() FROM anon, authenticated, PUBLIC;

-- 2. messages: sender may delete their own message
DROP POLICY IF EXISTS "Sender deletes own messages" ON public.messages;
CREATE POLICY "Sender deletes own messages"
  ON public.messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- 3. notices: validate target_roles contents
ALTER TABLE public.notices DROP CONSTRAINT IF EXISTS notices_target_roles_valid;
UPDATE public.notices SET target_roles = '{all}'::text[]
WHERE target_roles IS NULL OR array_length(target_roles, 1) IS NULL;
ALTER TABLE public.notices
  ADD CONSTRAINT notices_target_roles_valid CHECK (
    array_length(target_roles, 1) >= 1
    AND target_roles <@ ARRAY['all','admin','coordinator','teacher','parent','student']::text[]
  );

-- 4. notifications: explicit, scoped INSERT policy
DROP POLICY IF EXISTS "Admins and self create notifications" ON public.notifications;
CREATE POLICY "Admins and self create notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_coordinator(auth.uid())
    OR recipient_id = auth.uid()
  );