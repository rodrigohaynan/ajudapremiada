# Mercado Pago e compartilhamento de campanhas

## Conexão Mercado Pago
A interface **Minha conta → Minhas campanhas → Conectar Mercado Pago** usa o fluxo OAuth:
- Frontend invoca Supabase Edge Function `mercado-pago-oauth` com sessão válida.
- O backend verifica a sessão Supabase, gera um `state` aleatório com validade de 10 minutos e redireciona para autorização oficial do Mercado Pago.
- O callback troca o código por tokens e os salva exclusivamente no schema `private` do Supabase (não no navegador).
- `payment_connections` exibe apenas o identificador público da conta vinculada; desconectar apaga o vínculo e tokens locais.

Configure as seguintes **secrets de Edge Functions no Supabase** (nunca no Vite ou no GitHub):
- `MP_CLIENT_ID`: ID da aplicação Mercado Pago no modelo Marketplace.
- `MP_CLIENT_SECRET`: segredo da mesma aplicação.
- `MP_REDIRECT_URI`: `https://bejboiqybndhgutbadde.supabase.co/functions/v1/mercado-pago-oauth`

Cadastre essa mesma URL, **idêntica**, como URI de redirecionamento na aplicação do Mercado Pago.

**Limitação atual:** esta entrega implementa a vinculação OAuth, não gera Pix dinâmico nem baixa automática. A cobrança continua no Pix manual até a aprovação comercial/regulatória, integração de cobranças e webhooks e configuração de credenciais. Não publique que o Pix automático funciona antes de testar toda a conciliação. O token é armazenado em tabela privada e uma solução de renovação periódica ainda será necessária.

## Edição da campanha
Organizadores podem alterar título, causa, descrição, prêmios, regra, chave Pix e foto; quantidade de números e preço são preservados após criação para não comprometer o estoque/reservas. O URL da campanha mantém o mesmo slug.

O enquadramento da capa aceita `contain` (mostrar foto inteira, recomendado) e `cover` (cortar). A foto original cortada de campanhas antigas deve ser reenviada; não é possível restaurar informação já removida da imagem convertida.

## Compartilhamento social
A função `netlify/edge-functions/campaign-og.ts` injeta `og:title`, `og:description`, `og:image` e tags Twitter no HTML de `/campanha/:slug` usando os dados públicos do Supabase. O botão Compartilhar inclui um parâmetro de versão para evitar cache da miniatura depois das edições.

Valide as tags com o depurador de compartilhamento e enviando um link no WhatsApp. A miniatura precisa ser uma URL de imagem pública HTTPS.

## Critérios de ativação
A atividade de sorteio precisa da autorização legal aplicável e aprovação explícita do provedor antes de criar cobranças reais. O modo doação sem sorteio também requer aprovação do caso de uso pelo provedor.