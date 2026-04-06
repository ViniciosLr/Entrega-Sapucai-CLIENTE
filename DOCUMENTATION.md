# Motobobot Client App - Documentação Técnica

## Visão Geral
O Motobobot Client App é um aplicativo React Native desenvolvido com Expo, TypeScript e Supabase para permitir que clientes solicitem entregas por motoboys, acompanhem pedidos em tempo real e se comuniquem com o suporte.

## Arquitetura do Sistema

### Tecnologias Utilizadas
- **React Native + Expo**: Framework principal para desenvolvimento mobile
- **TypeScript**: Tipagem estática para maior segurança e produtividade
- **Supabase**: Backend-as-a-Service para autenticação, banco de dados e realtime
- **Expo Router**: Sistema de navegação baseado em arquivos
- **Lucide React Native**: Biblioteca de ícones

### Estrutura de Pastas
```
app/
├── (tabs)/                 # Navegação principal em abas
│   ├── index.tsx          # Tela de pedidos ativos
│   ├── history.tsx        # Histórico de pedidos
│   ├── support.tsx        # Chat de suporte
│   └── profile.tsx        # Perfil do usuário
├── auth/                  # Telas de autenticação
│   ├── login.tsx         # Login
│   └── register.tsx      # Cadastro
├── order/                 # Telas relacionadas a pedidos
│   ├── create.tsx        # Criação de pedido
│   └── [id].tsx          # Detalhes do pedido
└── _layout.tsx           # Layout raiz com proteção de rotas

components/               # Componentes reutilizáveis
├── OrderCard.tsx        # Card de pedido
├── MessageBubble.tsx    # Bolha de mensagem do chat
└── LoadingSpinner.tsx   # Indicador de carregamento

contexts/
└── AuthContext.tsx      # Contexto de autenticação

hooks/                   # Hooks customizados
├── useAuth.ts          # Hook de autenticação
├── useOrders.ts        # Hook para gerenciar pedidos
├── useSupport.ts       # Hook para chat de suporte
└── useProfile.ts       # Hook para perfil do usuário

lib/
└── supabase.ts         # Configuração do cliente Supabase
```

## Estrutura do Banco de Dados

### Tabelas Principais

#### 1. auth.users (Supabase Auth)
Tabela nativa do Supabase para autenticação de usuários.

#### 2. user_profiles
Controle de roles e perfis de usuário.
```sql
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  role text NOT NULL CHECK (role IN ('cliente', 'admin', 'motoboy')),
  created_at timestamptz DEFAULT now()
);
```

#### 3. clientes
Dados específicos dos clientes.
```sql
CREATE TABLE clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) UNIQUE NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  address text,
  status text DEFAULT 'ativo' CHECK (status IN ('ativo', 'bloqueado')),
  created_at timestamptz DEFAULT now()
);
```

#### 4. pedidos
Tabela principal de pedidos.
```sql
CREATE TABLE pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES auth.users(id) NOT NULL,
  motoboy_id uuid REFERENCES auth.users(id),
  tipo_mercadoria text NOT NULL CHECK (tipo_mercadoria IN ('lanche', 'pizza', 'marmitex', 'documento', 'mercado', 'outro')),
  local_retirada jsonb NOT NULL,
  local_entrega jsonb NOT NULL,
  observacoes text DEFAULT '',
  valor_entrega decimal(10,2) NOT NULL DEFAULT 0.00,
  status text NOT NULL DEFAULT 'criado' CHECK (status IN ('criado', 'aceito', 'a_caminho_retirada', 'mercadoria_retirada', 'a_caminho_entrega', 'concluido', 'cancelado')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Campos JSONB:**
- `local_retirada`: `{ endereco, nome_local, observacoes }`
- `local_entrega`: `{ endereco, complemento }`

#### 5. motoboys
Dados dos motoboys.
```sql
CREATE TABLE motoboys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) UNIQUE NOT NULL,
  nome text NOT NULL,
  telefone text NOT NULL,
  tipo_veiculo text NOT NULL CHECK (tipo_veiculo IN ('moto', 'bicicleta', 'carro')),
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'ocupado')),
  localizacao_atual jsonb,
  created_at timestamptz DEFAULT now()
);
```

### Sistema de Chat de Suporte

#### 6. conversas_suporte
Controle de conversas de suporte.
```sql
CREATE TABLE conversas_suporte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES auth.users(id) NOT NULL,
  pedido_id uuid REFERENCES pedidos(id),
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'fechada')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### 7. mensagens_suporte
Mensagens do chat de suporte.
```sql
CREATE TABLE mensagens_suporte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid REFERENCES conversas_suporte(id) NOT NULL,
  cliente_id uuid REFERENCES auth.users(id) NOT NULL,
  admin_id uuid REFERENCES auth.users(id),
  pedido_id uuid REFERENCES pedidos(id),
  conteudo text NOT NULL,
  remetente text NOT NULL CHECK (remetente IN ('cliente', 'admin')),
  lido boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

## Relacionamentos

### Diagrama de Relacionamentos
```
auth.users (1) ←→ (1) user_profiles
auth.users (1) ←→ (1) clientes
auth.users (1) ←→ (1) motoboys
auth.users (1) ←→ (N) pedidos (cliente_id)
auth.users (1) ←→ (N) pedidos (motoboy_id)
auth.users (1) ←→ (N) conversas_suporte
auth.users (1) ←→ (N) mensagens_suporte (cliente_id)
auth.users (1) ←→ (N) mensagens_suporte (admin_id)
pedidos (1) ←→ (N) conversas_suporte
pedidos (1) ←→ (N) mensagens_suporte
conversas_suporte (1) ←→ (N) mensagens_suporte
```

## Segurança (Row Level Security)

### Políticas de Segurança

#### Pedidos
- **Clientes**: Podem ver e criar apenas seus próprios pedidos
- **Admins**: Podem ver e gerenciar todos os pedidos
- **Motoboys**: Podem ver apenas pedidos atribuídos a eles

#### Chat de Suporte
- **Clientes**: Podem ver apenas suas próprias conversas e mensagens
- **Admins**: Podem ver todas as conversas e mensagens
- **Motoboys**: Não têm acesso ao sistema de chat

#### Exemplos de Políticas RLS
```sql
-- Clientes podem ver seus próprios pedidos
CREATE POLICY "Clients can view their own orders"
  ON pedidos FOR SELECT TO authenticated
  USING (cliente_id = auth.uid());

-- Clientes podem ver suas próprias mensagens
CREATE POLICY "Clients can view messages from their conversations"
  ON mensagens_suporte FOR SELECT TO authenticated
  USING (cliente_id = auth.uid());
```

## Funcionalidades em Tempo Real

### Supabase Realtime
O sistema utiliza Supabase Realtime para atualizações em tempo real em:

1. **Status de Pedidos**: Atualizações automáticas quando o status muda
2. **Chat de Suporte**: Mensagens aparecem instantaneamente
3. **Localização do Motoboy**: Atualizações de posição (futuro)

### Implementação
```typescript
// Exemplo de listener para pedidos
const subscription = supabase
  .channel(`order_${orderId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'pedidos',
    filter: `id=eq.${orderId}`,
  }, (payload) => {
    // Atualizar estado local
  })
  .subscribe();
```

## Fluxo de Pedidos

### Estados do Pedido
1. **criado**: Pedido criado, aguardando motoboy
2. **aceito**: Motoboy aceitou o pedido
3. **a_caminho_retirada**: Motoboy indo buscar
4. **mercadoria_retirada**: Mercadoria coletada
5. **a_caminho_entrega**: Indo para entrega
6. **concluido**: Pedido entregue
7. **cancelado**: Pedido cancelado

### Regras de Negócio
- Cliente não escolhe motoboy (distribuição automática)
- Cancelamento permitido apenas antes da retirada
- Valor calculado automaticamente pelo sistema
- Atualizações em tempo real via Supabase

## Integração com Dashboard Admin

### Dados Compartilhados
- Mesmas tabelas do banco de dados
- Políticas RLS específicas para admins
- Realtime sincronizado entre plataformas

### Funcionalidades Admin
- Visualizar todos os pedidos
- Gerenciar motoboys
- Responder chat de suporte
- Controlar distribuição automática

## Manutenção e Escalabilidade

### Índices Recomendados
```sql
-- Performance para consultas frequentes
CREATE INDEX idx_pedidos_cliente_status ON pedidos(cliente_id, status);
CREATE INDEX idx_pedidos_created_at ON pedidos(created_at DESC);
CREATE INDEX idx_mensagens_conversa_created ON mensagens_suporte(conversa_id, created_at);
```

### Monitoramento
- Logs de erro via console
- Métricas de performance do Supabase
- Monitoramento de uso de realtime

### Backup e Recuperação
- Backup automático do Supabase
- Políticas de retenção de dados
- Procedimentos de recuperação de desastres

## Considerações de Performance

### Otimizações Implementadas
- Paginação em listas grandes
- Cache local de dados frequentes
- Lazy loading de componentes
- Otimização de queries com select específicos

### Limites e Quotas
- Supabase: Limite de conexões realtime
- Expo: Limites de build e publicação
- React Native: Gerenciamento de memória

## Deployment e Distribuição

### Desenvolvimento
```bash
npm run dev  # Expo development server
```

### Build de Produção
```bash
expo build:android  # Build Android
expo build:ios      # Build iOS
```

### Variáveis de Ambiente
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Troubleshooting

### Problemas Comuns
1. **Erro de autenticação**: Verificar configuração do Supabase
2. **Realtime não funciona**: Verificar políticas RLS
3. **Performance lenta**: Verificar índices do banco
4. **Build falha**: Verificar dependências e versões

### Logs e Debug
- Console do React Native Debugger
- Logs do Supabase Dashboard
- Crash reports do Expo

---

Esta documentação deve ser atualizada conforme novas funcionalidades são adicionadas ao sistema.