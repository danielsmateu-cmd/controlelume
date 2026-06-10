-- Migration: Adiciona campo de data de entrega nos orçamentos
-- Execute este SQL no painel do Supabase > SQL Editor

ALTER TABLE budgets 
ADD COLUMN IF NOT EXISTS delivery_date DATE;

-- Comentário: Campo usado para registrar a data prevista de entrega do pedido
-- ao aprovar (status = 'Aprovado') ou faturar (status = 'Faturado') um orçamento.
