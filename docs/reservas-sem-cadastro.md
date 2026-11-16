# Reserva de números sem cadastro (15/11/2026)

## Experiência do participante

- Escolhe números na página pública da campanha
- Preenche apenas **Nome completo**, **DDD**, **Celular** e **E-mail**
- Clica em **Reservar números sem cadastro**, sem criar senha ou conta
- Recebe confirmação de *reserva pendente de pagamento*, que expira após 5 minutos
- Visualiza dados Pix manuais somente após a reserva
- Encontra um convite **opcional** para criar conta depois da confirmação da reserva

O cadastro opcional não é requisito para participar. Reservas anônimas **não são automaticamente vinculadas** a contas criadas posteriormente; futura vinculação deverá exigir verificação do endereço de e-mail/telefone.

## Implementação

- Alteração no Supabase: a coluna `participations.user_id` agora aceita `NULL` para convidados.
- Informações pessoais ficam em `private.guest_contacts`, sem acesso do usuário anônimo via API pública.
- Função protegida `reserve_guest_campaign_numbers` valida contato, concorre com as reservas existentes usando bloqueio de linhas e insere todos os registros atomicamente.
- O endpoint público `guest-reserve-numbers` realiza validações e usa a chave do servidor apenas no backend.
- Um limite por impressão de origem restringe a quantidade de tentativas, sem gravar IP em texto puro.
- As regras originais da reserva autenticada permanecem em funcionamento.
- O status inicial continua `pending_payment`; o sistema **não confirma pagamentos automaticamente** com o Pix manual.

## Segurança e operação

A função pública pode ser alvo de automação; os limites atuais são uma primeira camada, não substituem CAPTCHA/Turnstile, verificação de contato e monitoramento de abusos antes de ampliar o volume de campanhas.

É necessário um processo administrativo seguro para comprovar e confirmar pagamentos manuais antes de definir números como pagos. A reserva não confirma a participação definitiva.

A ativação de sorteios remunerados depende do enquadramento e das autorizações legais aplicáveis, além da aceitação do gateway.
