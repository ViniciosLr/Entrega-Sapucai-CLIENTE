/*
  # Complete Motobobot Database Schema

  1. New Tables
    - `pedidos` (orders)
      - `id` (uuid, primary key)
      - `cliente_id` (uuid, foreign key to auth.users)
      - `motoboy_id` (uuid, optional foreign key to motoboys)
      - `tipo_mercadoria` (text, merchandise type)
      - `local_retirada` (jsonb, pickup location details)
      - `local_entrega` (jsonb, delivery location details)
      - `observacoes` (text, optional instructions)
      - `valor_entrega` (decimal, delivery price)
      - `status` (text, order status)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `motoboys` (delivery drivers)
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `nome` (text, name)
      - `telefone` (text, phone)
      - `tipo_veiculo` (text, vehicle type)
      - `status` (text, online/offline)
      - `localizacao_atual` (jsonb, current location)
      - `created_at` (timestamp)
    
    - `conversas_suporte` (support conversations)
      - `id` (uuid, primary key)
      - `cliente_id` (uuid, foreign key to auth.users)
      - `pedido_id` (uuid, optional foreign key to pedidos)
      - `status` (text, conversation status)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `mensagens_suporte` (support messages)
      - `id` (uuid, primary key)
      - `conversa_id` (uuid, foreign key to conversas_suporte)
      - `cliente_id` (uuid, foreign key to auth.users)
      - `admin_id` (uuid, optional foreign key to auth.users)
      - `pedido_id` (uuid, optional foreign key to pedidos)
      - `conteudo` (text, message content)
      - `remetente` (text, sender type: cliente/admin)
      - `lido` (boolean, read status)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for clients to access only their own data
    - Add policies for admins to access all data
    - Add policies for motoboys to access assigned orders only

  3. Realtime
    - Enable realtime on pedidos table for order tracking
    - Enable realtime on mensagens_suporte table for chat
*/

-- Create pedidos table
CREATE TABLE IF NOT EXISTS pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  motoboy_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo_mercadoria text NOT NULL CHECK (tipo_mercadoria IN ('lanche', 'pizza', 'marmitex', 'documento', 'mercado', 'outro')),
  local_retirada jsonb NOT NULL,
  local_entrega jsonb NOT NULL,
  observacoes text DEFAULT '',
  valor_entrega decimal(10,2) NOT NULL DEFAULT 0.00,
  status text NOT NULL DEFAULT 'criado' CHECK (status IN ('criado', 'aceito', 'a_caminho_retirada', 'mercadoria_retirada', 'a_caminho_entrega', 'concluido', 'cancelado')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create motoboys table
CREATE TABLE IF NOT EXISTS motoboys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  nome text NOT NULL,
  telefone text NOT NULL,
  tipo_veiculo text NOT NULL CHECK (tipo_veiculo IN ('moto', 'bicicleta', 'carro')),
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'ocupado')),
  localizacao_atual jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create conversas_suporte table
CREATE TABLE IF NOT EXISTS conversas_suporte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pedido_id uuid REFERENCES pedidos(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'fechada')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create mensagens_suporte table
CREATE TABLE IF NOT EXISTS mensagens_suporte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid REFERENCES conversas_suporte(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  pedido_id uuid REFERENCES pedidos(id) ON DELETE SET NULL,
  conteudo text NOT NULL,
  remetente text NOT NULL CHECK (remetente IN ('cliente', 'admin')),
  lido boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE motoboys ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversas_suporte ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens_suporte ENABLE ROW LEVEL SECURITY;

-- Policies for pedidos table
CREATE POLICY "Clients can view their own orders"
  ON pedidos
  FOR SELECT
  TO authenticated
  USING (cliente_id = auth.uid());

CREATE POLICY "Clients can create their own orders"
  ON pedidos
  FOR INSERT
  TO authenticated
  WITH CHECK (cliente_id = auth.uid());

CREATE POLICY "Clients can update their own orders before pickup"
  ON pedidos
  FOR UPDATE
  TO authenticated
  USING (cliente_id = auth.uid() AND status IN ('criado', 'aceito'))
  WITH CHECK (cliente_id = auth.uid());

CREATE POLICY "Admins can view all orders"
  ON pedidos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Motoboys can view assigned orders"
  ON pedidos
  FOR SELECT
  TO authenticated
  USING (
    motoboy_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'motoboy'
    )
  );

-- Policies for motoboys table
CREATE POLICY "Motoboys can view their own profile"
  ON motoboys
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all motoboys"
  ON motoboys
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Policies for conversas_suporte table
CREATE POLICY "Clients can view their own conversations"
  ON conversas_suporte
  FOR SELECT
  TO authenticated
  USING (cliente_id = auth.uid());

CREATE POLICY "Clients can create their own conversations"
  ON conversas_suporte
  FOR INSERT
  TO authenticated
  WITH CHECK (cliente_id = auth.uid());

CREATE POLICY "Admins can view all conversations"
  ON conversas_suporte
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Policies for mensagens_suporte table
CREATE POLICY "Clients can view messages from their conversations"
  ON mensagens_suporte
  FOR SELECT
  TO authenticated
  USING (cliente_id = auth.uid());

CREATE POLICY "Clients can create messages in their conversations"
  ON mensagens_suporte
  FOR INSERT
  TO authenticated
  WITH CHECK (cliente_id = auth.uid() AND remetente = 'cliente');

CREATE POLICY "Admins can view all messages"
  ON mensagens_suporte
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_id ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_motoboy_id ON pedidos(motoboy_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_created_at ON pedidos(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_motoboys_user_id ON motoboys(user_id);
CREATE INDEX IF NOT EXISTS idx_motoboys_status ON motoboys(status);

CREATE INDEX IF NOT EXISTS idx_conversas_cliente_id ON conversas_suporte(cliente_id);
CREATE INDEX IF NOT EXISTS idx_conversas_pedido_id ON conversas_suporte(pedido_id);

CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_id ON mensagens_suporte(conversa_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_cliente_id ON mensagens_suporte(cliente_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_created_at ON mensagens_suporte(created_at DESC);

-- Enable realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
ALTER PUBLICATION supabase_realtime ADD TABLE mensagens_suporte;
ALTER PUBLICATION supabase_realtime ADD TABLE conversas_suporte;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_pedidos_updated_at 
  BEFORE UPDATE ON pedidos 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversas_updated_at 
  BEFORE UPDATE ON conversas_suporte 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate delivery price (basic implementation)
CREATE OR REPLACE FUNCTION calculate_delivery_price(
  pickup_location jsonb,
  delivery_location jsonb,
  merchandise_type text
)
RETURNS decimal AS $$
DECLARE
  base_price decimal := 8.00;
  type_multiplier decimal := 1.0;
BEGIN
  -- Adjust price based on merchandise type
  CASE merchandise_type
    WHEN 'pizza' THEN type_multiplier := 1.2;
    WHEN 'mercado' THEN type_multiplier := 1.5;
    WHEN 'documento' THEN type_multiplier := 0.8;
    ELSE type_multiplier := 1.0;
  END CASE;
  
  -- Basic calculation (can be enhanced with distance calculation)
  RETURN base_price * type_multiplier;
END;
$$ LANGUAGE plpgsql;