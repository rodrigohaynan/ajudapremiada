# Plano Supabase — Ajuda Premiada

A migração deve preservar a interface de `src/services/dataService.js`.

## Estrutura sugerida
- `profiles`: perfil vinculado a `auth.users`
- `campaigns`: dados gerais, proprietário, cidade, causa, preço, quantidade e regra
- `prizes`: múltiplos prêmios por campanha
- `campaign_numbers`: número, status, participante e expiração de reserva
- `participations`: vínculo usuário/campanha, valor e status
- `participation_numbers`: números vinculados à participação
- `payments`: referência, comprovante e confirmação
- `campaign_updates`: comunicados e resultado

## RLS
- campanhas publicadas: leitura pública
- rascunhos/edição: proprietário ou admin
- participações: participante lê as próprias; organizador lê as de suas campanhas
- comprovantes: somente participante, organizador envolvido e admin
- números: leitura pública; reserva somente por RPC/Edge Function transacional

## Reserva transacional
A reserva de números deve ser atômica no Postgres para impedir dupla seleção e permitir expiração automática.

## Storage
- `campaign-images`: imagens da campanha
- `payment-proofs`: privado
- `avatars`: público

## Auth
Trocar a implementação interna do `AuthContext` por Supabase Auth mantendo a interface `{ user, login, register, logout }`.
