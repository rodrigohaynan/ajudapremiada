# Fluxo manual e arte para Status (16/11/2026)

## Participação sem cadastro
1. Escolher números e informar nome completo, DDD, celular e e-mail.
2. Reserva inicial manual com duração de 30 minutos.
3. Enviar comprovante JPG, PNG, WEBP ou PDF (até 5 MB) antes do vencimento.
4. Após envio, o período de análise do comprovante dura até 72 horas (3 dias), e os números continuam bloqueados.
5. O organizador confere no extrato financeiro e escolhe Confirmar recebimento (números pagos) ou Rejeitar e liberar.
6. Sem envio a tempo ou após 72 horas sem confirmação, os números voltam a poder ser reservados.
7. Um link privado com token no fragmento do URL permite ao participante recuperar a reserva. Não compartilhar publicamente.

## Segurança
- Hash SHA-256 do token em private.manual_reservation_access.
- Arquivo privado no bucket manual-payment-proofs (limite de 5 MB).
- Só o backend usa credenciais de serviço, nunca o navegador.
- Organizadores autenticados recebem links temporários de visualização.
- Estados e números são atualizados por funções transacionais no Postgres.
- Comprovante enviado não significa Pix pago: somente revisão do organizador confirma.
- Recomenda-se adicionar proteção antirobôs e política de retenção de comprovantes em escala.

## Status WhatsApp
- PNG 1080 × 1920, foto, título, preço, números livres/reservados/pagos, QR Code e link.
- Até 160 números em grade; campanhas grandes mostram resumo e amostras legíveis.
- A imagem é um retrato do momento. Os números podem mudar depois.
- Compartilhamento abre o menu do aparelho, mas publicar no Status depende do próprio usuário.
- Para link clicável no Status, usar figurinha Link dentro do WhatsApp.

## Limites
Pix automático, webhook e conciliação automática ainda não foram implementados. Operações com premiações dependem de enquadramento e autorização legal aplicáveis. Reservas antigas podem conservar seu prazo anterior.