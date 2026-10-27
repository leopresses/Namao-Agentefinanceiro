# Correções de segurança — 27/10/2026

As alterações estão preparadas no código. Não representam confirmação de que as
configurações ou regras já estejam aplicadas em produção.

## Alterações

- Dependências atualizadas, com versões corrigidas de DOMPurify, busboy, gRPC e UUID.
- Administrador exige e-mail verificado. Configure `ADMIN_UID` no servidor para
  vincular o acesso a uma conta específica. Enquanto ele não estiver configurado,
  `ADMIN_EMAIL` só aceita uma identidade verificada do provedor Google.
- Webhook exige `MERCADOPAGO_WEBHOOK_SECRET`, assinatura válida e correspondência
  entre o identificador assinado na URL e o corpo. Sem segredo responde 503, sem
  consultar pagamentos ou conceder acesso. O checkout também recusa novas compras
  nessa situação. Mantém a deduplicação dos recibos.
- Chat e extração por voz compartilham um limitador por UID no Firestore:
  6 solicitações por minuto, 60 por hora, no máximo duas simultâneas, em todos os
  planos. Tentativas com falha continuam contando nesse limite de proteção.
  A cota mensal gratuita e a cota de voz continuam independentes.
- Backups são escritos por `/api/backup`. A API valida autenticação, PRO ativo,
  estrutura, tamanho (850 kB) e revisão dentro de uma transação. O UID vem do token.
  Regras negam gravações diretas no documento; o dono pode ler e excluir mesmo
  após expirar o plano. Restaurações inválidas são recusadas antes de substituir
  os dados locais. Backups legados e conflitos entre dispositivos são preservados.
- Vercel aplica CSP, proteção contra enquadramento, nosniff, política de referência,
  permissões e cache desativado nas APIs. Microfone e biometria continuam permitidos
  na própria origem. O código de tema saiu do script inline para um arquivo local.

## Aplicação em produção

1. Confirmar `MERCADOPAGO_WEBHOOK_SECRET` na Vercel com o segredo já gerado na
   integração do Mercado Pago. Não gerar um valor aleatório diferente. Caso esteja
   ausente, configurar antes da publicação: o webhook passará a recusar eventos.
2. Configurar `ADMIN_UID` com o UID da conta administradora no Firebase Authentication.
3. Publicar o backend e o frontend juntos. Publicar as novas `firestore.rules`
   imediatamente depois, no mesmo projeto Firebase usado pelo app.
   O app antigo que gravava diretamente precisará ser atualizado.
4. Conferir os cabeçalhos reais e testar login Google (popup/redirect), backup e
   restauração entre dispositivos com conta de teste, sem usar dados pessoais.
5. Homologar notificações assinadas do Mercado Pago com credenciais de teste;
   simulações locais não comprovam a integração externa.

O armazenamento financeiro local continua sem criptografia por senha. A biometria
é um bloqueio de tela. Criptografia com chave guardada junto aos dados não resolve
esse limite; uma implementação futura precisa definir senha/chave de recuperação,
migração dos dados e comportamento offline para evitar perda de acesso.

## Verificação local

`node --experimental-test-module-mocks --test tests/security.test.mjs tests/payments.test.mjs tests/chat.test.mjs tests/expenses.test.mjs tests/balance.test.mjs tests/navigation.test.mjs`

O teste `tests/security.e2e.mjs` usa um build separado em
`node_modules/.cache/namao-security-preview`, com `VITE_LOCAL_TEST_MODE=true`, e
servidor temporário com os cabeçalhos da Vercel. Esse build nunca deve ser publicado.
O build normal de produção usa `dist/` e não habilita o login de teste.
