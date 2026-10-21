# NaMão

PWA de finanças pessoais em React e Vite: receitas e despesas, recorrências, orçamentos, metas, relatórios em PDF e chat com IA. O nome da marca está em revisão.

## Desenvolvimento

Instale as dependências com `npm ci`. Copie `.env.example` para `.env.local` e configure o Firebase. Use `npm run dev` para iniciar o front-end, `npm run lint` para análise estática e `npm run build` para gerar `dist`.

As funções em `api/` são executadas na Vercel; o Vite isolado não atende essas rotas. Configure as variáveis privadas no ambiente do servidor. Nunca use o prefixo `VITE_` em credenciais administrativas, tokens do Mercado Pago ou na chave Gemini.

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

## Verificação

Execute `node --test tests/navigation.test.mjs` para testar a memória de navegação. Para os testes no navegador, inicie o Vite com `VITE_LOCAL_TEST_MODE=true` e execute `node --test tests/navigation.e2e.mjs`. Eles precisam de Playwright e Microsoft Edge instalados. Use `PLAYWRIGHT_MODULE` caso o Playwright esteja fora do projeto e `TEST_ORIGIN` para um endereço diferente de `http://127.0.0.1:4173`.

Os testes no navegador criam perfis temporários e dados fictícios. O modo local desativa o backup em nuvem.
