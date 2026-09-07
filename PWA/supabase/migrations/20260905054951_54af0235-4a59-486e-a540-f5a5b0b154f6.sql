ALTER TABLE public.ml_predictions
  ADD COLUMN IF NOT EXISTS prediction_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'utc')::date);

DELETE FROM public.ml_predictions a
USING public.ml_predictions b
WHERE a.ctid < b.ctid
  AND a.device_id = b.device_id
  AND a.prediction_type = b.prediction_type
  AND a.model_version = b.model_version
  AND a.target_date IS NOT DISTINCT FROM b.target_date;

CREATE UNIQUE INDEX IF NOT EXISTS ml_predictions_upsert_key
  ON public.ml_predictions (device_id, prediction_type, model_version, target_date)
  WHERE target_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ml_predictions_device_created
  ON public.ml_predictions (device_id, created_at DESC);