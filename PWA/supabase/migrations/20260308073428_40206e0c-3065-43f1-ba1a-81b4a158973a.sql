
-- Create sensor_data table
CREATE TABLE public.sensor_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  water_level NUMERIC NOT NULL,
  tds_value NUMERIC NOT NULL,
  pump_status TEXT NOT NULL DEFAULT 'OFF',
  pump_mode TEXT NOT NULL DEFAULT 'AUTO',
  pump_runtime NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sensor_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sensor data" ON public.sensor_data
  FOR SELECT USING (true);

CREATE POLICY "Service can insert sensor data" ON public.sensor_data
  FOR INSERT WITH CHECK (true);

-- Create alerts table
CREATE TABLE public.alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL,
  alert_message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read alerts" ON public.alerts
  FOR SELECT USING (true);

CREATE POLICY "Service can insert alerts" ON public.alerts
  FOR INSERT WITH CHECK (true);

-- Create pump_settings table
CREATE TABLE public.pump_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pump_mode TEXT NOT NULL DEFAULT 'AUTO',
  upper_threshold NUMERIC NOT NULL DEFAULT 90,
  lower_threshold NUMERIC NOT NULL DEFAULT 35,
  critical_threshold NUMERIC NOT NULL DEFAULT 25,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pump_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pump settings" ON public.pump_settings
  FOR SELECT USING (true);

CREATE POLICY "Anyone can update pump settings" ON public.pump_settings
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can insert pump settings" ON public.pump_settings
  FOR INSERT WITH CHECK (true);

-- Insert default pump settings
INSERT INTO public.pump_settings (pump_mode, upper_threshold, lower_threshold, critical_threshold)
VALUES ('AUTO', 90, 35, 25);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  low_water_alerts BOOLEAN DEFAULT true,
  high_tds_alerts BOOLEAN DEFAULT true,
  pump_status_alerts BOOLEAN DEFAULT true,
  anomaly_alerts BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pump_settings_updated_at
  BEFORE UPDATE ON public.pump_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.sensor_data;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pump_settings;
