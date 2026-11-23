# Ajude e Ganhe

MVP front-end para criação, descoberta e acompanhamento de campanhas com causas, números e prêmios.

## O que já existe

- Home responsiva e identidade visual própria
- Exploração de campanhas com busca, filtros por categoria e cidade
- Página pública da campanha
- Grade de números disponíveis, selecionados e preenchidos
- Registro de participação e instrução de Pix
- Cadastro, login e recuperação de senha com Supabase Auth
- Reserva de números sem cadastro, envio de comprovante Pix e conferência pelo organizador
- Arte para Status do WhatsApp e miniatura de compartilhamento (edge function `campaign-og`)
- Área do usuário com participações e campanhas criadas
- Assistente de criação em 4 etapas
- Definição de prêmio, quantidade de números, valor, cidade, regra/data de sorteio, Pix e textos personalizados
- Dados no Supabase (Postgres, Storage e Edge Functions); sem as variáveis `VITE_SUPABASE_*`, usa `localStorage` para prototipação
- Configuração SPA pronta para Netlify

## Rodando localmente

```bash
npm install
npm run dev
```

Build de produção:

```bash
npm run build
```

## Netlify

O `netlify.toml` já contém:

- `npm run build`
- publicação da pasta `dist`
- redirect de SPA para `index.html`

## Funções do Supabase

As funções em `supabase/functions` não são publicadas pelo Netlify. Após alterá-las, publique com a CLI do Supabase:

```bash
supabase functions deploy guest-reserve-numbers
supabase functions deploy manual-payment-proof
supabase functions deploy mercado-pago-oauth
```

O domínio oficial é `https://ajudeeganhe.com.br` (definido em `src/config.js` e nas listas de origens das funções).

## Preparação para Supabase

A UI não acessa `localStorage` diretamente. O acesso a campanhas e participações passa por:

`src/services/dataService.js`

A autenticação está isolada em:

`src/context/AuthContext.jsx`

Na próxima fase, a sugestão é implementar:

1. `profiles`
2. `campaigns`
3. `campaign_prizes` (caso haja múltiplos prêmios)
4. `campaign_numbers`
5. `participations`
6. `payments`
7. `campaign_updates`
8. Supabase Auth
9. Storage para imagens e comprovantes
10. RLS por organizador/participante/admin

O arquivo `.env.example` já reserva as variáveis futuras.

## Observação de produto/compliance

Este MVP não custodia pagamentos, não processa Pix e não executa sorteios. Ele registra a intenção/participação localmente e exibe as regras e a chave informadas pelo organizador. Antes de uma operação pública real, devem ser validados os requisitos jurídicos, regulatórios, tributários, de proteção de dados e de autorização aplicáveis ao modelo de campanha/sorteio no Brasil.
