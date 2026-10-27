# NaMão

PWA de finanças pessoais em React e Vite: receitas e despesas, recorrências, orçamentos, metas, relatórios em PDF e chat com IA.

## Desenvolvimento

Instale as dependências com `npm ci`. Copie `.env.example` para `.env.local` e configure o Firebase. Use `npm run dev` para iniciar o front-end, `npm run lint` para análise estática e `npm run build` para gerar `dist`.

As funções em `api/` são executadas na Vercel. No desenvolvimento, o Vite encaminha `/api` para `APP_ORIGIN` (por padrão, o app publicado), preservando a autenticação Google. Configure as variáveis privadas no ambiente do servidor. Nunca use o prefixo `VITE_` em credenciais administrativas, tokens do Mercado Pago ou na chave Gemini.

Com `VITE_LOCAL_TEST_MODE=true`, o usuário de teste pode conversar com a IA no localhost usando `GEMINI_API_KEY` do `.env.local`. Essa rota existe apenas no servidor de desenvolvimento, aceita somente a mesma origem local e não acessa contas nem cotas de produção. A chave permanece no servidor; respostas são geradas pelo mesmo módulo usado em produção. Os dados locais do perfil de teste são enviados ao Gemini para responder à pergunta.

## Arquitetura e dados

- `src/pages`: telas; `src/App.jsx`: rotas e proteção por Firebase Authentication.
- `src/services/db.js`: lançamentos, metas e limites no IndexedDB.
- `src/services/chatDb.js`: conversas no localStorage.
- `src/services/accountScope.js`: separação dos dados locais por UID. Dados antigos com dono conhecido são migrados; dados sem dono identificado têm recuperação explícita em Configurações.
- `src/hooks/useAutoSync.js`: backup automático PRO em `users/{uid}/private/backup` no Firestore. A revisão do backup é conferida em uma transação antes de gravar; conflitos exigem uma decisão em Configurações.
- `api/`: IA, extração por voz, conta, administração, checkout e webhook do Mercado Pago.
- `firestore.rules`: regras de acesso aos dados e bloqueio de alterações de privilégios pelo cliente.

## Navegação

`NavigationProvider` preserva filtros e rolagem por entrada do histórico durante a sessão do app. O dashboard guarda o mês escolhido; os relatórios guardam mês e modo de filtro. A restauração aguarda autenticação, carregamento da tela e leitura dos dados locais. Uma nova abertura do app começa no mês atual.

`useGoBack` volta à página anterior conhecida pelo app e usa uma rota interna quando a tela foi aberta por link direto. Salvar despesas e metas segue esse mesmo retorno; editar uma despesa pelo detalhamento volta ao detalhamento atualizado, e o próximo retorno recupera a lista na posição anterior.

## Lançamentos

A busca por descrição ignora acentos e maiúsculas e combina categoria e situação dentro do mês selecionado. Os filtros são preservados no retorno à lista e não alteram os totais dos cartões do mês.

O Saldo do Mês mostra receitas menos despesas pagas e pendentes. Uma despesa pendente já reduz o saldo ao ser cadastrada; marcá-la como paga diminui apenas Despesas a Pagar, sem descontar duas vezes. Despesas planejadas aparecem separadas em Com as planejadas. Os relatórios mantêm o saldo realizado (receitas menos pagas) e o previsto com planejadas; o contexto da IA identifica os três conceitos.

Os menus de novo lançamento usam o mês da tela inicial ou do relatório, com o dia atual limitado ao último dia desse mês. Datas informadas explicitamente no formulário ou no lançamento por voz têm prioridade.

Ao editar uma recorrência, escolha entre somente esta, esta e próximas ou todas. Valor, descrição e categoria são aplicados ao alcance escolhido; data e situação mudam apenas na parcela aberta. As próximas são determinadas pela data original, antes da edição. A atualização é gravada em uma única operação no IndexedDB. A exclusão de recorrências oferece os mesmos alcances, incluindo aviso sobre parcelas já pagas.

## Verificação

Execute `node --experimental-test-module-mocks --test tests/*.test.mjs` para testar navegação, IA, busca, datas, recorrências e pagamentos. Para os testes no navegador, inicie o Vite com `VITE_LOCAL_TEST_MODE=true` e execute `node --test tests/navigation.e2e.mjs tests/expenses.e2e.mjs`. Eles precisam de Playwright e Microsoft Edge instalados. Use `PLAYWRIGHT_MODULE` caso o Playwright esteja fora do projeto e `TEST_ORIGIN` para um endereço diferente de `http://127.0.0.1:4173`.

Os testes no navegador criam perfis temporários e dados fictícios. O modo local desativa o backup em nuvem.

`tests/chat.test.mjs` cobre validação, respostas sem pontuação, repetição limitada e isolamento do modo local. `tests/chat.e2e.mjs` verifica resposta, erro, cancelamento e tempo limite no navegador. O teste que chama o Gemini de verdade fica desativado por padrão; ative-o com `RUN_LIVE_AI=true` e uma chave de desenvolvimento configurada. Ele usa somente dados fictícios.

## Simulação de pagamentos

`npm run test:payments` executa os handlers reais de checkout e webhook com Mercado Pago, autenticação e Firestore substituídos por implementações isoladas de teste. `npm run test:payments:e2e` verifica o fluxo no navegador, incluindo o retorno e a atualização visual do plano. O segundo comando precisa do Vite local, Playwright e Microsoft Edge; aceita `PLAYWRIGHT_MODULE` e `TEST_ORIGIN`. Ambos usam o suporte experimental de mocks de módulos do Node.js 24. Nenhuma cobrança ou conta real é alterada, e esses testes não comprovam a entrega de notificações externas pelo Mercado Pago.

O webhook registra cada pagamento em `paymentReceipts/{id}` na mesma transação que libera o PRO, impedindo novas extensões por notificações repetidas após outras compras. A coleção usa a negação padrão das regras do Firestore e só é acessada pelo backend Admin. Na migração, o último pagamento conhecido da versão anterior também ganha um recibo; pagamentos históricos anteriores a esse último não podem ser reconstituídos automaticamente sem consultar o histórico do provedor.
