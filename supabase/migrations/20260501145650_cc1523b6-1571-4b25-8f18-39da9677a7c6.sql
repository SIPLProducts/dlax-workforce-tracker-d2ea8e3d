ALTER TABLE public.contractors REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contractors;