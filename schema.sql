-- Execute this in the Supabase SQL Editor

-- Table: solicitacoes
CREATE TABLE solicitacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  moto TEXT NOT NULL,
  endereco_origem TEXT NOT NULL,
  lat_long_origem TEXT, -- Coordinates GPS (Optional if not captured)
  endereco_destino TEXT NOT NULL,
  travada BOOLEAN NOT NULL DEFAULT false,
  acompanhantes INTEGER DEFAULT 0,
  agendamento_data DATE,
  agendamento_hora TIME,
  valor_cobrado NUMERIC DEFAULT 0,
  forma_pagamento TEXT, -- 'pix', 'cartao', 'dinheiro'
  recebedor TEXT, -- 'Recebedor 1', 'Recebedor 2'
  status TEXT DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: financeiro
CREATE TABLE financeiro (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_gasto TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  km_rodado NUMERIC,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  nota_fiscal_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: manutencao
CREATE TABLE manutencao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_desgaste TEXT NOT NULL,
  valor NUMERIC DEFAULT 0,
  veiculo TEXT, -- 'Fiesta', 'Ruby', etc.
  data_troca DATE NOT NULL,
  proxima_revisao DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) - Basic setup
ALTER TABLE solicitacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous inserts" ON solicitacoes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all access to authenticated on solicitacoes" ON solicitacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE financeiro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to authenticated on financeiro" ON financeiro FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE manutencao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to authenticated on manutencao" ON manutencao FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: push_subscriptions
CREATE TABLE push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT UNIQUE NOT NULL,
  subscription JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous inserts" ON push_subscriptions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all access to authenticated on push_subscriptions" ON push_subscriptions FOR ALL TO authenticated USING (true) WITH CHECK (true);
