CREATE POLICY "Parent read child via guardian" ON public.students
FOR SELECT TO authenticated
USING (public.is_parent_of_student(auth.uid(), id));