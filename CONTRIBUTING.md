# Como contribuir

## Regras do repositório

- O repositório é **público**. Nunca suba arquivo de cliente: CAD (CATPart, prt, JT…), planilhas, PDFs, desenhos, listas de pendências. O `.gitignore` bloqueia os formatos mais comuns, mas a responsabilidade é de quem faz o commit.
- Trabalhe em uma branch (`feature/<nome>`, `fix/<nome>`, `docs/<nome>`) e abra um Pull Request para a `main`.
- Commits curtos e no imperativo: "Adiciona tela de tempos padrão", "Corrige cálculo do grampo".

## Mexer no protótipo

O protótipo é HTML, CSS e JavaScript puros, sem instalação.

1. Abra `prototipo/index.html` no navegador (duplo clique serve).
2. Edite o arquivo da tela em `prototipo/assets/js/telas/` e recarregue a página.
3. Para uma tela nova: copie o padrão de `telas/inicio.js`, inclua o `<script>` no `index.html` e o id no grupo certo em `assets/js/app.js`.
4. O contrato completo (estado, `ctx`, `AE.calc`, padrões de texto) está em [docs/prototipo.md](docs/prototipo.md).

Ao dar push na `main`, o GitHub Actions publica a pasta `prototipo/` no GitHub Pages.

## Sugerir uma mudança de tela (sem programar)

Abra uma *issue* com:

- a tela e o passo (ex.: "Mecânica 2 · Montar unidades");
- o que está errado ou faltando, no vocabulário do projeto;
- se possível, um print ou um desenho à mão.
