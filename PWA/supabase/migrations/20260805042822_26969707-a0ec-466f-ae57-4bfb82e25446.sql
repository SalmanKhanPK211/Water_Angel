CREATE TABLE public.ml_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  prediction_type text NOT NULL,
  model_version text NOT NULL DEFAULT 'v1',
  target_time timestamptz,
  target_date date,
  predicted_value numeric,
  confidence numeric,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ml_predictions_device_type ON public.ml_predictions (device_id, prediction_type, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ml_predictions TO authenticated;
GRANT ALL ON public.ml_predictions TO service_role;

ALTER TABLE public.ml_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins can read predictions"
  ON public.ml_predictions FOR SELECT TO authenticated
  USING (is_admin() OR EXISTS (SELECT 1 FROM public.devices d WHERE d.id = ml_predictions.device_id AND d.user_id = auth.uid()));

CREATE POLICY "Owners and admins can insert predictions"
  ON public.ml_predictions FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR EXISTS (SELECT 1 FROM public.devices d WHERE d.id = ml_predictions.device_id AND d.user_id = auth.uid()));

CREATE POLICY "Owners and admins can update predictions"
  ON public.ml_predictions FOR UPDATE TO authenticated
  USING (is_admin() OR EXISTS (SELECT 1 FROM public.devices d WHERE d.id = ml_predictions.device_id AND d.user_id = auth.uid()))
  WITH CHECK (is_admin() OR EXISTS (SELECT 1 FROM public.devices d WHERE d.id = ml_predictions.device_id AND d.user_id = auth.uid()));

CREATE POLICY "Owners and admins can delete predictions"
  ON public.ml_predictions FOR DELETE TO authenticated
  USING (is_admin() OR EXISTS (SELECT 1 FROM public.devices d WHERE d.id = ml_predictions.device_id AND d.user_id = auth.uid()));