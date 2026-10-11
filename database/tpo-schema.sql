-- Additive schema. Does not alter, update, or delete existing student records.
-- Apply only after backup/restore validation and staging verification.
BEGIN;
CREATE TABLE IF NOT EXISTS public.tpo_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  template text NOT NULL CHECK (template IN ('SE', 'AE_ABA')),
  deadline timestamptz NOT NULL,
  is_open boolean NOT NULL DEFAULT true,
  gap_before_label text NOT NULL CHECK (length(gap_before_label) BETWEEN 1 AND 120),
  gap_during_label text NOT NULL CHECK (length(gap_during_label) BETWEEN 1 AND 120),
  diploma_allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.tpo_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.tpo_opportunities(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  details jsonb NOT NULL CHECK (jsonb_typeof(details) = 'object'),
  status text NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Needs Correction', 'Verified')),
  correction_note text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  reviewed_by_department text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, student_id)
);
CREATE INDEX IF NOT EXISTS tpo_applications_student_idx ON public.tpo_applications(student_id);
CREATE INDEX IF NOT EXISTS tpo_applications_review_idx ON public.tpo_applications(opportunity_id, status);
ALTER TABLE public.tpo_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tpo_applications ENABLE ROW LEVEL SECURITY;
-- Access is through the authenticated server API, never directly from the browser.
REVOKE ALL ON public.tpo_opportunities, public.tpo_applications FROM anon, authenticated;
COMMIT;
