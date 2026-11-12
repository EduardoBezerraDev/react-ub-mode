# react-ub-mode

**Engenharia Front-end disciplinada para React & TypeScript — combinando Agent Skill, Plugins para IDEs/Agentes, Atomic Design obrigatório e Quality Gates determinísticos baseados na AST do TypeScript.**

*Read in English: [README.md](./README.md)*

---

## O que é o `react-ub-mode`?

O `react-ub-mode` traz a disciplina e o fluxo de trabalho do [unclebob/ub-mode](https://github.com/unclebob/ub-mode) para projetos **React + TypeScript** (Vite/SPA, Next.js App Router, Remix ou bibliotecas de componentes).

Em vez de depender apenas de prompts ou linters genéricos de estilo, ele une:
1. **Regras comportamentais de engenharia** ([`SKILL.md`](./SKILL.md) + [`plugin/rules/AGENTS.md`](./plugin/rules/AGENTS.md))
2. **CLI determinístico via AST do TypeScript** (`react-ub`) com equivalentes ao `crapper`, `dryer`, `mutator` e um `react-audit` especializado em React (incluindo verificação automática de **Atomic Design**).

---

## Início Rápido (60 segundos)

### Passo 1 — Configurar na sua máquina (apenas 1 vez)

```bash
git clone <url-do-repo> react-ub-mode
cd react-ub-mode
npm install
npm run setup:global
```

O que o `npm run setup:global` faz automaticamente:
- Compila o CLI (`dist/cli.js`) e registra o comando global **`react-ub`** (`npm link`)
- Instala a skill + plugin no **Antigravity** (`~/.gemini/config/skills/` e `~/.gemini/config/plugins/`)
- Instala a skill global no **VS Code Copilot** (`~/.copilot/skills/`), **Codex**, **Claude Code**, **Cursor** e **OpenCode**
- Salva o prompt compacto do **ChatGPT** em `~/.react-ub-mode/chatgpt-custom-instructions.md` e **já copia para sua área de transferência**

### Passo 2 — Inicializar qualquer projeto React (1 comando por repositório)

```bash
cd /caminho/do/seu-projeto-react
react-ub init
```

O que o `react-ub init` faz de forma idempotente:
- Cria as pastas faltantes do **Atomic Design** (`src/atoms`, `src/molecules`, `src/organisms`, `src/templates`, `src/pages` — ou `components/...` em projetos Next.js com `app/`)
- Configura o **VS Code Copilot** no projeto (`.github/instructions/react-ub-mode.instructions.md` + `.github/skills/react-ub-mode/SKILL.md`)
- Configura o **Antigravity / `.agents/`** no projeto (`.agents/skills/` + `.agents/plugins/`)
- Adiciona os scripts `ub:gate`, `ub:audit` e `ub:mutate` no `package.json`

### Passo 3 — Rodar os Quality Gates

```bash
# Gere a cobertura de testes do projeto (Vitest ou Jest) para o Crapper usar dados reais
npx vitest run --coverage

# Execute todos os quality gates
npm run ub:gate
```

---

## Como usar em cada plataforma

### Antigravity
O `npm run setup:global` (ou `react-ub install --target antigravity --plugin`) instala:
- `~/.gemini/config/skills/react-ub-mode/SKILL.md` (invocável via `/react-ub-mode`)
- `~/.gemini/config/plugins/react-ub-mode/` (`plugin.json`, `rules/AGENTS.md` e `hooks.json` com hook `SessionStart` para projetos React)

Em repositórios de equipe, o `react-ub init` também configura `.agents/skills/` e `.agents/plugins/` para todo o time.

### VS Code (GitHub Copilot)
Ao rodar `react-ub init` (ou `react-ub install --target copilot`) dentro do projeto React:
- `.github/instructions/react-ub-mode.instructions.md` com `applyTo: "**/*.{ts,tsx,js,jsx}"` — carregado automaticamente pelo Copilot Chat e Copilot Agent sempre que você editar arquivos React/TS
- `.github/skills/react-ub-mode/SKILL.md` — skill local do projeto
- `~/.copilot/skills/react-ub-mode/SKILL.md` — skill global do Copilot

> **Dica:** mantenha habilitada a configuração `github.copilot.chat.codeGeneration.useInstructionFiles` no VS Code (já vem ativa por padrão).

### ChatGPT (Web, Desktop, Projetos, Custom GPTs e Codex)

1. **Custom Instructions do ChatGPT** (cabe no limite de 1.500 caracteres — [1.341 chars](./chatgpt/CUSTOM_INSTRUCTIONS.md)):
   ```bash
   react-ub prompt --compact | pbcopy
   ```
   Abra o ChatGPT → **Configurações → Personalização → Instruções Personalizadas** e cole (`Cmd+V` / `Ctrl+V`).

2. **Projetos do ChatGPT ou Custom GPTs** (guia completo):
   ```bash
   react-ub prompt | pbcopy
   ```
   Você também pode anexar o arquivo [`SKILL.md`](./SKILL.md) como *Knowledge* do Projeto ou Custom GPT, ou gerar o arquivo `react-ub-mode-chatgpt.md` na pasta atual com:
   ```bash
   react-ub install --target chatgpt
   ```

3. **OpenAI Codex CLI**:
   ```bash
   react-ub install --target codex
   ```

### Claude Code, Cursor e OpenCode

```bash
react-ub install --target claude
react-ub install --target cursor
react-ub install --target opencode
```

---

## Disciplina em 3 Fases

Toda alteração em código React/TypeScript segue este ciclo:

### 1. First Make it Work
- **Laziness Protocol**: fonte única de verdade para estado, valores derivados e schemas; menor edição que resolve o problema visível ao usuário.
- **Foundational Thinking**: modele estado assíncrono/UI com uniões discriminadas (`{ status: 'idle' | 'loading' | 'error' | 'success' }`) em vez de múltiplas flags booleanas (`isLoading && isError`); derive valores no render; evite race conditions com `AbortController` ou IDs de requisição.
- **TDD orientado a comportamento**: escreva o teste falhando com queries acessíveis (`getByRole`, `getByLabelText`, `getByText`) e `userEvent` antes de alterar o componente.
- **Redesign From First Principles & Subtract Before You Add**: prefira composição (`children`, slots) em vez de empilhar props booleanas (`isCompactV2`); remova `useEffect`s desnecessários antes de adicionar novos hooks.
- **Boundary & Type System Discipline**: valide dados externos (`fetch`, `JSON.parse`, `localStorage`, parâmetros de URL) uma única vez na fronteira; mantenha lógica de domínio em funções TypeScript puras; nunca silencie erros com `any`, `@ts-ignore` ou `eslint-disable`.
- **Idempotência (StrictMode) e Colocação de Estado**: todo `useEffect` com listener/timer/subscription deve retornar cleanup; mantenha `'use client'` nas folhas; nunca acesse `window`/`document` diretamente durante o render.

### 2. Then Make it Right
- **Fix Root Causes**: reproduza com teste falhando; não mascare transições inválidas com `?.` ou `if (!data) return null`.
- **Crapper (`CRAP < 10`)**: mantenha componentes, hooks e funções abaixo de CRAP 10 extraindo helpers puros, dividindo subcomponentes ou cobrindo branches com testes.
- **Dryer (`similarity < 0.8`)**: extraia comportamento com estado duplicado para custom hooks, UI repetida para `atoms/`/`molecules/` e regras puras para helpers.
- **Mutator**: cubra módulos descobertos, elimine mutantes sobreviventes, remova testes sem asserções ou acoplados a detalhes internos (`querySelector`, `innerHTML`) e apague código morto.
- **React Audit**: passe em todas as regras de Atomic Design, boundaries, tipos, hooks, acessibilidade, XSS e SSR.

### 3. Follow Practice
- **Keep a Log**: registre ações tomadas, motivos e métricas (`CRAP`, `Dryer`, `Mutator`, `React Audit`) antes e depois.
- **Guard the Context Window**: mantenha o contexto enxuto delegando explorações extensas e guardando apenas resumos acionáveis.
- **Worktree Cleanup & Commits pequenos**: explique *por quê*, *o que mudou* e *como foi provado*.

---

## Arquitetura Atomic Design Obrigatória

O `react-ub-mode` impõe a hierarquia em 5 camadas com **dependências estritamente descendentes**:

```text
pages/ (ou app/**/page.tsx)
  └──▶ templates/
         └──▶ organisms/
                └──▶ molecules/
                       └──▶ atoms/
```

| Camada | Responsabilidade | Pode importar de | Regras de Pureza |
| :--- | :--- | :--- | :--- |
| **`atoms/`** | Primitivas visuais puras (`Button`, `Input`, `Badge`, `Icon`) | Apenas libs de UI/utils externos | Proibido `fetch()`, `useEffect` e imports de roteamento (`next/navigation`, `react-router-dom`) |
| **`molecules/`** | Grupos coesos de átomos (`FormField`, `SearchBar`, `StatTile`) | `atoms/` | Apenas estado efêmero de UI; proibido importar camadas acima |
| **`organisms/`** | Seções completas de interface (`Header`, `CheckoutForm`, `UserTable`) | `atoms/`, `molecules/` | Coordena estado/callbacks da seção; proibido importar `templates/` ou `pages/` |
| **`templates/`** | Esqueletos de página e slots (`DashboardLayout`) | `atoms/`, `molecules/`, `organisms/` | Compõe layout via `children`/slots; proibido `fetch()` |
| **`pages/`** *(ou `app/**/page.tsx`)* | Orquestradores de rota | Todas as camadas inferiores | Conecta dados validados na fronteira, hooks de feature e templates/organisms |

---

## Referência Completa do CLI (`react-ub`)

### Comandos

| Comando | Função | Flags principais |
| :--- | :--- | :--- |
| `react-ub setup` | Instala globalmente para Antigravity, Copilot, Codex, Claude, Cursor, OpenCode e ChatGPT | `--copy`, `--json` |
| `react-ub init [dir]` | Configura pastas Atomic Design, `.github/`, `.agents/` e scripts do `package.json` | `--chatgpt`, `--json` |
| `react-ub gate [caminho]` | Executa `crapper`, `dryer`, `react-audit` e `mutator` juntos | `--strict`, `--mutate`, `--max-crap <n>`, `--threshold <n>`, `--coverage <arq>`, `--test-cmd <cmd>`, `--max-mutants <n>`, `--min-score <n>`, `--json` |
| `react-ub crapper [caminho]` | Calcula complexidade ciclomática + cobertura + CRAP por função/componente | `--max-crap <n>` (padrão `10`), `--coverage <arq>`, `--json` |
| `react-ub dryer [caminho]` | Detecta clones estruturais via AST preservando hooks React e tags HTML | `--threshold <n>` (padrão `0.8`), `--json` |
| `react-ub react-audit [caminho]` | Audita Atomic Design, boundaries, tipos, hooks, a11y, XSS e SSR | `--strict` (falha também em warnings), `--json` |
| `react-ub mutator [caminho]` | Audita qualidade comportamental de testes e executa mutação AST em sandbox | `--run`, `--test-cmd <cmd>` (padrão `"npm test"`), `--max-mutants <n>` (padrão `50`), `--min-score <n>` (padrão `80`), `--json` |
| `react-ub install` | Instala skill/plugin para um alvo específico | `--target antigravity\|copilot\|vscode\|chatgpt\|codex\|claude\|cursor\|opencode\|local\|all`, `--plugin`, `--local`, `--json` |
| `react-ub prompt` | Imprime o prompt pronto na saída padrão | `--compact` (`<= 1500` chars para Custom Instructions do ChatGPT) |

### Formatos de Cobertura Aceitos (`crapper`)
1. `coverage/coverage-final.json` (mapa de statements Istanbul/Vitest — precisão linha a linha por unidade)
2. `coverage/lcov.info` (LCOV — precisão linha a linha por unidade)
3. `coverage/coverage-summary.json` (resumo Istanbul — percentual por arquivo)

### Catálogo de Regras do `react-audit`

| Rule ID | Severidade padrão | O que detecta |
| :--- | :--- | :--- |
| `atomic-dependency-direction` | `error` | Import para camada superior no Atomic Design (`atoms -> molecules`, `templates -> pages`, etc.) |
| `atomic-atom-impurity` | `error` | `fetch()`, `useEffect` ou imports de roteamento dentro de `atoms/` |
| `atomic-template-impurity` | `warning` | `fetch()` direto dentro de `templates/` |
| `atomic-unclassified-component` | `warning` | Componente React fora de `atoms/`, `molecules/`, `organisms/`, `templates/`, `pages/` ou `app/**/page.*` |
| `type-compiler-silence` | `error` | `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `eslint-disable` |
| `type-any-usage` | `error` | Uso explícito de `any` ou `as any` |
| `boundary-unparsed-data` | `warning` | `JSON.parse()`, `.json()`, `localStorage.getItem()`, `sessionStorage.getItem()` sem validação em função `parse*`/`safeParse`/`validate*` |
| `effect-derived-state` | `warning` | `setState` síncrono dentro de `useEffect` sem efeito colateral assíncrono/subscription |
| `effect-missing-cleanup` | `warning` | `addEventListener`, `setInterval`, `setTimeout`, `subscribe` ou `observe` em `useEffect` sem retorno de cleanup |
| `jsx-index-key` | `error` | Índice de array usado como `key={idx}` dentro de `.map()` |
| `a11y-clickable-non-semantic` | `warning` | `<div onClick>` ou `<span onClick>` sem `role` e `tabIndex`/`onKeyDown` |
| `a11y-missing-alt` | `error` | `<img>` sem atributo `alt` (e sem `{...props}`) |
| `security-dangerous-html` | `error` | `dangerouslySetInnerHTML` sem chamada de sanitização (`sanitize*`) |
| `ssr-unsafe-global` | `warning` | Acesso direto a `window`, `document`, `localStorage` ou `sessionStorage` durante o render |
| `component-oversized` | `warning` | Componente React com mais de 150 linhas |
| `component-prop-bloat` | `warning` | Componente React recebendo mais de 8 props desestruturadas |

---

## Exemplo para CI / GitHub Actions

```yaml
name: React UB-Mode Quality Gate
on: [pull_request, push]

jobs:
  ub-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npx vitest run --coverage
      - run: npx react-ub gate src --strict
```

---

## Contribuição e Licença

Veja [CONTRIBUTING.md](./CONTRIBUTING.md). Distribuído sob a licença [MIT](./LICENSE).
