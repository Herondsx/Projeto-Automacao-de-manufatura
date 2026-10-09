# Protótipo navegável: como é montado

O protótipo em [`prototipo/`](../prototipo/) é o desenho das telas e das regras do programa, para aprovação da equipe **antes** de programar a integração com o CATIA e o NX. É HTML, CSS e JavaScript puros, **sem build e sem framework**:

- abre direto do disco (duplo clique em `prototipo/index.html`) ou pelo GitHub Pages;
- usa scripts clássicos (não usa módulos ES), por isso funciona em `file://`;
- guarda o que foi preenchido no `localStorage` do navegador (chave `ae-prototipo-v1`), com exportar e importar em JSON pelo menu **Projeto ▾**.

```
prototipo/
├── index.html              casca: trilho, barra do app, console do CAD, balão, avisos
├── assets/css/app.css      visual (tokens e componentes) — base da v0 do Bruno
├── assets/js/core.js       núcleo: estado, grafo de passos, CAD simulado, moldura, rotas
├── assets/js/dados.js      dados de exemplo + AE.calc (saídas compartilhadas entre passos)
├── assets/js/telas/*.js    uma tela por arquivo
├── assets/js/app.js        ordem do trilho e passos "a fazer"
└── original/               a v0 do Bruno, guardada como referência
```

## Regras do fluxo que o núcleo implementa

Vêm da tela "Fluxo do projeto" da v0:

| Regra | Como aparece no protótipo |
| --- | --- |
| Cada passo declara suas entradas e de quais passos depende | `entradas: [{de: 'inicio', o: 'Tempo de ciclo'}]` em cada tela; faixa "O que esta tela recebe" no topo |
| Entrada que não chegou não trava o passo: roda com valor de reserva e a saída fica preliminar | `AE.calc.*` devolve um valor de reserva; concluir com entrada de reserva marca o passo como **preliminar** (losango amarelo) |
| Quando a entrada chega, avisar quais passos precisam ser conferidos de novo | Passo de origem concluído depois do dependente → dependente fica **conferir de novo** (círculo vermelho) e mostra uma faixa |
| Tudo o que o programa propõe pode ser editado, e a edição fica registrada | `ctx.registrar(texto)` → "Registro do projeto" no painel |
| O programa não substitui o CAD: comanda o CAD aberto | `ctx.cad({...})` → Console do CAD com a chamada para CATIA (COM) ou NX (NXOpen) |

Situação de um passo: `pendente` → `andamento` (algum dado salvo) → `concluido` ou `preliminar`. Alterar um passo concluído o devolve para `andamento` até ser concluído de novo.

## Contrato de uma tela

```js
(function () {
  'use strict';
  const AE = window.AE;
  const { $, $$, esc, fmt, mm } = AE.util;

  AE.tela({
    id: 'tempos',                 // rota #/tempos e chave da fatia em AE.estado.t
    sigla: '2',                   // número no trilho
    area: 'proc',                 // 'proc' | 'sim' | 'mec' | 'visao'
    rotulo: 'Passo 2',            // prefixo do título
    titulo: 'Tempos padrão',
    resumo: 'Frase curta do que a tela resolve.',
    tip: 'Texto do balão no trilho.',
    entradas: [{ de: 'inicio', o: 'Padrão do cliente' }],
    inicial: () => ({ ... }),     // fatia inicial (objeto NOVO a cada chamada)
    programador: `<h3>O que esta tela guarda</h3><ul>…</ul>`,
    render(ctx) { return `<div class="bloco">…</div>`; },  // HTML da coluna principal
    montar(el, ctx) { /* eventos e redesenhos parciais dentro de `el` */ },
  });
})();
```

### `ctx` (recebido por `render` e `montar`)

| Membro | Para quê |
| --- | --- |
| `ctx.s` | fatia da tela (`AE.estado.t[id]`), criada a partir de `inicial()` |
| `ctx.salvar()` | dado do projeto mudou: grava e marca o passo como "em andamento" |
| `ctx.salvarUI()` | só estado de tela (aba, item selecionado): grava sem mudar a situação |
| `ctx.redesenhar()` | refaz a tela inteira mantendo a rolagem |
| `ctx.avisa(texto, {tipo, acao})` | aviso no rodapé. `tipo`: `'ok'`, `'aviso'`, `'erro'`. `acao: {texto, fn}` vira um botão |
| `await ctx.perguntar({titulo, texto, campo, valor, tipo, ok, perigo})` | janela modal. Sem `campo` devolve `true`/`null`; com `campo` devolve o texto ou `null` |
| `await ctx.cad({titulo, catia, nx, macro, resultado}, botao)` | simula o comando no CAD: mostra o botão ocupado, registra no console, devolve `false` se o CAD estiver desconectado |
| `ctx.termos()` | `{nome, versao, product, part, desenho, macro}` do CAD escolhido (CATIA ou NX) |
| `ctx.concluir({registro, mensagem, preliminar})` | conclui o passo (preliminar automático se alguma entrada for de reserva) e oferece ir ao próximo |
| `ctx.registrar(texto)` | entrada no registro do projeto |
| `ctx.ir(id)` | navega para outra tela |
| `ctx.origem(id)` | `'tela'`, `'andamento'` ou `'reserva'`: de onde vem a entrada do passo `id` |

Também existem `AE.css(id, texto)` (CSS próprio da tela, injetado uma vez), `AE.espiar(id)` (fatia de outra tela sem criá-la) e `AE.util` (`$`, `$$`, `esc`, `fmt`, `mm`, `clone`, `espera`, `hora`).

### Saídas compartilhadas (`AE.calc`)

Cada função lê a fatia da tela dona quando existe; se não existe, calcula o valor de reserva.

| Função | Dono | Devolve |
| --- | --- | --- |
| `projeto()` | `inicio` | cliente, `padrao` do cliente, turnos, horas, disp, `modelos[]` com `ciclo`, `cicloAlvo` (menor ciclo adotado) |
| `separacao()` | `separacao` | `subs[]` `{id, st, nome, pecas}`, `by[]`, `pontos[]` (com `x,y,z` inteiros, `st`, `by`, `chapas`, `chapasCliente`, `entre`, `geometria`), `soltas[]` |
| `tempos()` | `tempos` | `itens[]` e `porId` (`solda`, `aproximacao`, `trocaPinca`, `dispositivo`, `transferencia`, `seguranca`, `cargaManual`, `cola`, `pino`) |
| `estacoes()` | `estacoes` | `ciclo`, `maxRobos`, `tPonto`, `estacoes[]` `{st, nome, tipo, manual, carga, disponivel, porRobo, pontos, nPontos, robos, robosCalc, capacidade, ok, tempoTotal}`, `totalRobos` |
| `equipamentos()` | `equipamentos` | `itens[]` `{id, st, tipo, modelo, qtd, origem, obs}`. `tipo`: `robo`, `pinca`, `dispositivo`, `operador`, `cola`, `pino`, `mig`, `furacao`… |
| `cobertura()` | `capacidade` | conteúdo do produto × equipamentos: `{item, exige, coberto, onde}` |
| `capacidade()` | `capacidade` | `robos[]` `{id, st, cap, pontos, ocup}`, `estacoes[]` com `blocos` do macro ciclo |
| `simulacao()` | `simulacao` | `distribuicao` `{robo: [pontos]}`, `semAcesso[]`, `nuvem {entregue, versao}` |
| `unidades()` | `unidades` (definida em `telas/unidades.js`) | `lista[]` de unidades com `pecas` (pos., denominação, material, bruto, origem, arquivo), `pilotos[]`, `fora[]`, `assinatura` (muda quando alguma unidade muda) |
| `listaEstacoes()` | — | `[{st, rotulo}]` para seletores |

Fatias que outras telas leem (o formato tem de ser mantido):

- `separacao`: `{subs:[{id, st, nome, pecas}], by:['F'], correcoes:{[ponto]: {chapas, st}}, …}`
- `tempos`: `{itens:[{id, op, seg, un, fonte}]}`
- `estacoes`: `{maxRobos, ajustes:{'ST10': {robos}}}`
- `equipamentos`: `{itens:[…]}`
- `simulacao`: `{distribuicao, semAcesso, nuvem:{entregue, versao}}`

## Padrões de texto e de interface

- Português do Brasil, frases curtas, no vocabulário de quem projeta. Sigla nova tem explicação no balão.
- **Todo botão tem `data-tip`** dizendo o que ele executa (é a ideia central da v0). Elemento que não é botão usa `data-tip` para dizer o que significa.
- Botão que conversaria com o CAD usa `ctx.cad(...)` com a chamada do CATIA **e** do NX e, quando existir, a macro antiga de base.
- Dado inventado leva a etiqueta `<span class="exemplo">dados de exemplo</span>`.
- Coordenadas sempre em milímetro inteiro (`mm()`).
- Todo texto vindo do usuário passa por `esc()` antes de entrar no HTML.
- Classes prontas: `bloco`, `sub`, `campos`, `campo`, `seg`, `btn` (`primario`, `leve`, `mini`, `perigo`), `barra`, `rolagem`, `pilula` (`ok`, `aviso`, `erro`, `neutro`, `info`, `roxo`), `exemplo`, `chip`, `instrucao`, `abas`, `duas`, `cad`, `kpis`/`kpi`, `cartoes`/`cartao`, `lista`/`item`, `checagem`, `registro`, `leitura`, `calc`, `medidor`, `nota`, `faixa-aviso`, `vazio`, `rotulo-sec`.
