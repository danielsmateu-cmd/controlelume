-- Tabela base para Fichas Técnicas (FTs)
CREATE TABLE IF NOT EXISTS public.fts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ft_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    variation TEXT,
    production_time TEXT,
    sale_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela para os materiais de cada FT
CREATE TABLE IF NOT EXISTS public.ft_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ft_id UUID NOT NULL REFERENCES public.fts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    value NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela para os custos diretos em R$ de cada FT
CREATE TABLE IF NOT EXISTS public.ft_direct_costs_rs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ft_id UUID NOT NULL REFERENCES public.fts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    value NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela para os custos diretos em % de cada FT
CREATE TABLE IF NOT EXISTS public.ft_direct_costs_percent (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ft_id UUID NOT NULL REFERENCES public.fts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela para armazenar Modelos Fixos de Custo (independentes de uma FT específica)
CREATE TABLE IF NOT EXISTS public.ft_cost_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    direct_costs_rs JSONB DEFAULT '[]'::jsonb,
    direct_costs_percent JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.fts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ft_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ft_direct_costs_rs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ft_direct_costs_percent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ft_cost_models ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for the NextJS/Vite standard implementation (Public access)
-- Note: Se o seu app tem Auth ativado, troque 'anon' por 'authenticated'
CREATE POLICY "Enable read access for all users" ON public.fts FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.fts FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.fts FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.fts FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON public.ft_materials FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.ft_materials FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.ft_materials FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.ft_materials FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON public.ft_direct_costs_rs FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.ft_direct_costs_rs FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.ft_direct_costs_rs FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.ft_direct_costs_rs FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON public.ft_direct_costs_percent FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.ft_direct_costs_percent FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.ft_direct_costs_percent FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.ft_direct_costs_percent FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON public.ft_cost_models FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.ft_cost_models FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.ft_cost_models FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.ft_cost_models FOR DELETE USING (true);
