# Simulação do fluxo de pagamento — NaMão

Data: 21/10/2026.

## Resultado

Passaram **19 cenários de checkout/webhook** e **5 fluxos no navegador** após as correções locais. A suíte unitária completa passou com 35 testes, e lint e build também passaram.

Não houve cobrança, criação de pagamento no Mercado Pago nem alteração de contas ou assinaturas reais durante a simulação. As evidências deste relatório foram obtidas localmente; a validação externa no ambiente de testes do Mercado Pago continua pendente.

## Método e alcance

Os testes executam os handlers reais de `api/checkout.js` e `api/webhook.js`. Mercado Pago, validação de login e Firestore são substituídos por implementações de teste em memória. No navegador temporário, a tela do provedor é simulada e o retorno chama o webhook isolado. A interface do app é a implementação real em desenvolvimento.

| Cenário | Resultado |
| --- | --- |
| Plano mensal | Preço definido no servidor: R$ 9,90; aprovação concede 30 dias. |
| Plano anual | Preço definido no servidor: R$ 89,00; aprovação concede 365 dias. |
| Renovação com acesso vigente | Período somado ao vencimento existente. |
| Pendente ou em processamento | Acesso PRO não concedido. |
| Recusado ou cancelado | Acesso PRO não concedido. |
| Notificação repetida imediatamente | Período não duplicado. |
| Notificação antiga após outra compra | Período não duplicado após a correção. |
| Último pagamento da versão anterior | Recibo de compatibilidade preserva a deduplicação após a compra seguinte. |
| Valor incorreto, ausente ou moeda inválida | Pagamento recusado pelo processamento local. |
| Referência inválida ou assinatura incorreta | Conta não alterada. |
| Usuário sem autenticação ou plano desconhecido | Checkout recusado. |
| Falha de provedor | Handler retorna falha e não concede acesso. |
| Retorno `payment=success` sem aprovação no banco | Interface não concede PRO. |
| Retorno no celular | Mensal aprovado, anual aprovado, pendente e recusado verificados. |

## Falhas reproduzidas e corrigidas localmente

1. **Repetição de pagamento antigo:** antes, apenas `lastPaymentId` era conferido. A sequência pagamento A, pagamento B, notificação repetida de A podia acrescentar mais 30 dias. Agora `paymentReceipts/{id}` registra cada pagamento na mesma transação que altera o acesso. Também é preservado o último ID conhecido da versão anterior.
2. **Valor ausente ou não numérico:** `NaN` escapava da comparação de valor. A validação agora exige número finito, positivo e igual ao preço do plano em centavos.
3. **Confirmação oculta no localhost:** no React StrictMode, a consulta de acesso podia ser cancelada depois de o retorno já ter sido marcado como tratado. O retorno agora só é marcado como concluído quando o aviso é exibido, e consultas canceladas não encerram a tentativa seguinte.

As regras atuais do Firestore negam acesso do cliente à nova coleção de recibos. O backend continua usando o Admin SDK.

## O que falta para confirmar a integração externa

Não há `MERCADOPAGO_ACCESS_TOKEN` de teste, `MERCADOPAGO_WEBHOOK_SECRET` nem credencial administrativa Firebase configurados no ambiente local. Portanto, estes resultados não confirmam a configuração atual da conta do Mercado Pago, aceitação de cartões de teste, chegada de notificações pela internet ou persistência em um Firestore de homologação.

Para fechar a validação de ponta a ponta, configurar vendedor/comprador de teste, credenciais e webhook em um ambiente isolado; realizar uma compra de teste mensal e uma anual; confirmar o webhook e o vencimento no banco de homologação. Não usar cobrança ou contas de clientes reais nesse teste.

A migração dos recibos consegue preservar o último pagamento conhecido de cada usuário. Reconstruir recibos de pagamentos históricos anteriores exige consultar o histórico do provedor; não é possível deduzir todos eles a partir do documento atual do usuário.

## Repetir os testes

- Backend: `npm run test:payments`.
- Navegador: iniciar o Vite em modo local de teste e executar `npm run test:payments:e2e`.
- Usar Node.js 24 com suporte ao mock experimental de módulos, Playwright e Microsoft Edge. `PLAYWRIGHT_MODULE` permite usar o Playwright fora do projeto; `TEST_ORIGIN` define a origem local.

Referência para a etapa externa: [compras de teste do Checkout Pro](https://www.mercadopago.com.br/developers/en/docs/checkout-pro-preferences/integration-test/test-purchases?scope=prod).
