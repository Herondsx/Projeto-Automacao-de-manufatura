/* Passo 1 · Separação do produto (Processo)
   Portada da "TELA 1" da v0 do Bruno: indicar o que chega soldado (BY), separar o produto em
   subdivisões (um Product/Assembly cada), importar e relacionar os pontos às peças e numerar as estações.
   Saída para os outros passos: AE.calc.separacao() lê esta fatia ({subs, by, correcoes, …}).
   Esta tela usa AE.calc.separacao({proprio:true}) para ver o estado em edição (sem a reserva). */
(function () {
  'use strict';
  const AE = window.AE;
  const { $, esc, fmt, hora } = AE.util;

  /* cor de cada subdivisão no desenho (tokens do tema) */
  const CORES = ['var(--azul)', 'var(--roxo)', 'var(--l-sim)', 'var(--laranja)', 'var(--ok)', 'var(--acao)'];
  const ABAS = [
    { rot: '1.1 Indicar BY', tip: 'Marcar os subconjuntos que já chegam soldados de fora (BY).' },
    { rot: '1.2 Separar o produto', tip: 'Selecionar no CAD as peças de cada subdivisão.' },
    { rot: '1.3 Pontos e chapas', tip: 'Ligar cada ponto de solda às chapas que ele une.' },
    { rot: '1.4 Numerar estações', tip: 'Dar número de estação a cada subdivisão.' },
  ];
  const INSTR = (aba, t) => [
    [`No ${t.nome}: clique nas peças que já chegam soldadas`, `Depois volte aqui e use "Marcar como BY". Neste protótipo, o desenho abaixo faz o papel do ${t.nome}: clique nas peças.`],
    [`No ${t.nome}: selecione as peças de uma subdivisão`, `Depois use "Criar subdivisão": o programa cria um ${t.product} com elas. Repita até não sobrar nenhuma peça solta.`],
    ['Confira os pontos que o programa ligou às peças', 'Importe a lista, use "Relacionar pontos às peças" e, onde houver divergência, decida qual valor vale em "Corrigir um ponto".'],
    ['Confira os números das estações', `O programa numerou de 10 em 10. Troque quando o número definitivo for definido: o ${t.nome} e os documentos mudam juntos.`],
  ][aba];
  /* origens da lista de pontos: as três viram a mesma tabela */
  const ORIGENS = {
    excel: { nome: 'Planilha Excel do cliente', curto: 'da planilha do cliente', chapas: true,
      tip: 'Lê a planilha de pontos que o cliente mandou (nome, X, Y, Z e número de chapas) e cria os pontos no 3D.' },
    '3d': { nome: 'Pontos do 3D', curto: 'do 3D', chapas: false,
      tip: 'Lê os pontos que já estão dentro do 3D do cliente. Não traz o número de chapas: o programa conta pela geometria.' },
    '2d': { nome: 'Desenho 2D', curto: 'do desenho 2D', chapas: false,
      tip: 'Lê a tabela de pontos do desenho 2D. Não traz o número de chapas: o programa conta pela geometria.' },
  };
  /* situação de um ponto: [classe da pílula, texto, cor no desenho] */
  const SIT = {
    aguarda: ['neutro', 'Aguardando relacionar', 'azul'],
    by: ['neutro', 'BY · fora do ciclo', 'fraco'],
    interno: ['aviso', 'Dentro de conjunto sem BY', 'laranja'],
    diverg: ['erro', 'Divergência', 'erro'],
    semsub: ['aviso', 'Peça sem subdivisão', 'laranja'],
    tres: ['aviso', 'Mais de 2 chapas', 'aviso'],
    juncao: ['roxo', 'Junção', 'roxo'],
    ok: ['ok', 'Conferido', 'ok'],
  };
  const ALERTAS = ['diverg', 'tres', 'interno', 'semsub'];

  const CSS = `
    .sp-peca{fill:#1B3156;stroke:#3A5C92;stroke-width:1.5;transition:fill .12s}
    .sp-selecionavel .sp-peca:not(.by):not(.feita){cursor:pointer}
    .sp-selecionavel .sp-peca:not(.by):not(.feita):hover{fill:#24406E}
    .sp-peca.feita{fill-opacity:.2;stroke-width:2}
    .sp-peca.by{fill:#16202F;stroke:#55657F;stroke-dasharray:5 4}
    .sp-peca.sel{fill:#3A3413;stroke:var(--acao);stroke-width:2.5}
    .cad text.sp-letra{font-size:15px;fill:var(--texto);font-weight:500}
    .cad text.sp-tag{font-size:11px;fill:var(--acao)}
    .cad text.sp-dica{font-size:12px;fill:var(--fraco)}
    .sp-pt{stroke:var(--cad);stroke-width:.8;pointer-events:none}
    .sp-pt.azul{fill:var(--azul)} .sp-pt.fraco{fill:var(--fraco)} .sp-pt.laranja{fill:var(--laranja)} .sp-pt.erro{fill:var(--erro)}
    .sp-pt.aviso{fill:var(--aviso)} .sp-pt.roxo{fill:var(--roxo)} .sp-pt.ok{fill:var(--ok)}
    .sp-hit{fill:transparent;cursor:pointer}
    .sp-anel{fill:none;stroke:var(--texto);stroke-width:1.5;pointer-events:none}
    .sp-legenda{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;color:var(--suave);margin-top:8px}
    .sp-legenda span{display:inline-flex;align-items:center;gap:5px}
    .sp-legenda i{display:inline-block;width:9px;height:9px;border-radius:50%}
    .sp-juncao{border:1px solid var(--linha2);border-left:4px solid var(--roxo);border-radius:6px;padding:10px 12px;background:rgba(181,146,255,.06);font-size:13.5px;color:var(--suave);margin-top:12px;display:flex;flex-direction:column;gap:6px}
    .sp-juncao b{color:var(--texto);font-weight:600}
    .sp-juncao ul{margin:0;padding-left:18px}
    .sp-editor{margin-top:12px;border:1px solid var(--acao);border-radius:8px;padding:12px;background:var(--fundo);display:flex;flex-direction:column;gap:10px}
    .sp-editor h3{font-family:var(--f-dado);font-size:15px;font-weight:500}
    .sp-filtros{margin-bottom:10px}
    .sp-filtros button[aria-pressed="true"]{background:var(--painel2);color:var(--texto);border-color:var(--acao);font-weight:600}
    #sp-abas .badge{margin-left:6px}
    .sp-chips{display:flex;flex-wrap:wrap;gap:6px}
    .sp-chips span{font-family:var(--f-dado);font-size:12.5px;border:1px solid var(--acao);color:var(--acao);border-radius:4px;padding:1px 7px}
    .sp-item-cor{border-left-width:4px}
    #sp-tab td{white-space:nowrap}
    #sp-tab td.mono{font-size:12.5px}`;

  AE.tela({
    id: 'separacao', sigla: '1', area: 'proc', rotulo: 'Passo 1', titulo: 'Separação do produto',
    resumo: 'Dividir o produto em subdivisões e ligar cada ponto de solda às suas peças.',
    tip: 'Abre a separação do produto: o que chega soldado (BY), as subdivisões, os pontos ligados às peças e o número de cada estação.',
    entradas: [{ de: 'inicio', o: 'Padrão do cliente: numeração de estações e nomes' }],
    inicial: () => ({
      aba: 0, sel: [], by: [], byGrupos: [], subs: [], proxId: 1,
      importado: false, origemPontos: null, relacionado: false, correcoes: {}, registro: [],
      origemEscolhida: 'excel', filtro: 'todos', ponto: null, lido: null,
    }),
    programador: `
      <h3>O que esta tela guarda</h3>
      <ul>
        <li><code>by</code>: peças que chegam soldadas (lista que os outros passos leem). <code>byGrupos</code>: cada grupo marcado junto vira uma peça única.</li>
        <li><code>subs</code>: subdivisões <code>{id, st, nome, pecas}</code>. O <code>id</code> é interno e fixo; <code>st</code> é o número que o usuário vê.</li>
        <li><code>importado</code>, <code>origemPontos</code> (<code>excel</code>, <code>3d</code> ou <code>2d</code>) e <code>relacionado</code>.</li>
        <li><code>correcoes</code>: <code>{[ponto]: {chapas, st}}</code>, o que o usuário decidiu por cima do programa.</li>
        <li><code>registro</code>: trocas de número de estação e correções de ponto feitas nesta tela.</li>
      </ul>
      <h3>Como a tela conversa com o CAD</h3>
      <ul>
        <li>O programa não substitui o CATIA ou o NX. Ele comanda o CAD que já está aberto.</li>
        <li>Todo passo de CAD tem três partes: instrução na tela, leitura da seleção, execução automática.</li>
      </ul>
      <h3>Regras</h3>
      <ul>
        <li>A estação tem um <code>id</code> interno fixo. O número que o usuário vê é só um atributo, e pode mudar.</li>
        <li>Numeração provisória de 10 em 10.</li>
        <li>Mais de 2 chapas no ponto gera alerta com a quantidade (informativo, não trava).</li>
        <li>Chapas: o programa conta pela geometria. Se a lista do cliente diz outro número, é divergência e o usuário decide qual vale. Sem número do cliente (origem 3D ou 2D), vale a geometria.</li>
        <li>Coordenadas sempre em milímetro inteiro. As do cliente são arredondadas ao importar; o valor original fica guardado.</li>
        <li>Ponto de BY fica fora do ciclo, mas continua no 3D.</li>
        <li>Ponto que une peças de subdivisões diferentes vai para a estação de junção: a primeira dezena depois da última subdivisão.</li>
        <li>Tudo o que o programa propõe pode ser editado, e a edição fica registrada.</li>
        <li>Concluir só com a checagem sem vermelho. Itens azuis são informação.</li>
      </ul>
      <h3>Saída</h3>
      <ul>
        <li><code>AE.calc.separacao()</code>: <code>subs</code>, <code>by</code>, <code>stJuncao</code>, <code>pontos</code> (x, y, z inteiros, <code>st</code>, <code>by</code>, <code>chapas</code>, <code>chapasCliente</code>, <code>entre</code>, <code>geometria</code>) e <code>soltas</code>. Lida pelos Passos 2, 3 e 4 e, a partir deles, pela Simulação.</li>
        <li>Enquanto esta tela não cria nenhuma subdivisão, os outros passos usam a reserva (2 subdivisões de exemplo, F como BY).</li>
      </ul>
      <h3>Macros de base</h3>
      <ul>
        <li><code>Part_2_Product</code> e <code>CreateAllCatPart</code>: criar o Product.</li>
        <li><code>RENAME_STATION_FIAT</code>: renomear por estação.</li>
        <li><code>Cordenadas</code> e <code>WritePoints2Excel</code>: ler coordenadas.</li>
        <li><code>960_WeldSpotsAddPart</code>: ligar ponto a peça (só referência).</li>
      </ul>
      <h3>Em aberto</h3>
      <ul>
        <li>Com 3 ou mais subdivisões, a junção é uma estação só (como o protótipo faz) ou uma por par de subconjuntos?</li>
        <li>O desenho 2D do cliente traz o número de chapas por ponto? O protótipo supõe que só a planilha traz.</li>
        <li>Tolerância para ligar ponto à peça e contar chapa sobreposta: o protótipo supõe 0,5 mm.</li>
        <li>Conjunto que chega soldado e não é marcado como BY: os pontos de dentro entram no ciclo? Hoje a checagem exige marcar BY.</li>
        <li>A v0 previa marcar um ponto avulso como BY. O formato atual só tem BY por peça.</li>
        <li>Arredondamento: meio milímetro sobe (Math.round). Confirmar com o padrão do cliente.</li>
      </ul>`,

    render() {
      return `
      <div class="abas" role="tablist" id="sp-abas" aria-label="Etapas da separação"></div>
      <div class="instrucao" id="sp-ins"></div>
      <div class="duas">
        <div class="bloco">
          <h2>Produto <span class="exemplo">desenho de exemplo</span></h2>
          <p class="sub" id="sp-cad-sub"></p>
          <div class="cad" id="sp-cad"></div>
          <div class="sp-legenda" id="sp-legenda"></div>
          <div class="barra" id="sp-acoes" style="margin-top:12px"></div>
        </div>
        <div class="bloco" id="sp-lado"></div>
      </div>
      <div class="bloco" id="sp-pontos" hidden></div>
      <div class="bloco">
        <h2>Checagem</h2>
        <p class="sub">O passo só é concluído sem nenhum item em vermelho. Itens azuis são informação.</p>
        <div class="checagem" id="sp-check"></div>
        <div class="barra fim" style="margin-top:14px">
          <button class="btn" data-acao="conferir" data-tip="Roda as verificações de novo com os dados atuais da tela.">Conferir de novo</button>
          <button class="btn primario" data-acao="concluir" data-tip="Só libera com a checagem sem vermelho. Grava a separação e oferece abrir o Passo 2, tempos padrão.">Concluir e avançar</button>
        </div>
      </div>`;
    },

    montar(el, ctx) {
      const s = ctx.s;
      /* fatias gravadas por versões anteriores podem não ter todos os campos */
      ['sel', 'by', 'byGrupos', 'subs', 'registro'].forEach((k) => { if (!Array.isArray(s[k])) s[k] = []; });
      if (!s.correcoes) s.correcoes = {};
      if (s.by.length && !s.byGrupos.length) s.byGrupos = [{ id: 1, pecas: s.by.slice() }];
      if (!ORIGENS[s.origemEscolhida]) s.origemEscolhida = 'excel';
      if (s.importado && !ORIGENS[s.origemPontos]) s.origemPontos = s.origemEscolhida;
      AE.css('separacao', CSS);

      const PECA = {};
      AE.dados.produto.pecas.forEach((p) => (PECA[p.id] = p));
      const nomeP = (id) => (PECA[id] ? PECA[id].nome : id);
      const listaNomes = (ids) => ids.map((id) => `${id} · ${nomeP(id)}`).join(', ');
      const nomeCurto = (ids) => ids.map((id, i) => { const w = nomeP(id).split(' ')[0]; return i ? w.toLowerCase() : w; }).join(' + ');
      const corSub = (sub) => CORES[Math.max(0, s.subs.findIndex((x) => x.id === sub.id)) % CORES.length];
      const reg = (tipo, texto) => { s.registro.unshift({ hora: hora(), tipo, texto }); s.registro.length = Math.min(s.registro.length, 60); };
      const slug = (t) => String(t).normalize('NFD').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').toUpperCase().slice(0, 24);

      /* ---------- análise: situação de cada ponto e checagem ---------- */
      let R;
      function analisar() {
        const sp = AE.calc.separacao({ proprio: true });
        const comChapas = s.origemPontos === 'excel';
        const pts = sp.pontos.map((p) => {
          const c = s.correcoes[p.n] || {};
          const div = comChapas && p.chapasGeo !== p.chapasCliente && !c.chapas;
          const solta = p.pecas.some((pc) => sp.soltas.includes(pc));
          let sit;
          if (p.interno) sit = p.pecas.every((pc) => sp.by.includes(pc)) ? 'by' : 'interno';
          else if (!s.relacionado) sit = 'aguarda';
          else if (p.by) sit = 'by';
          else if (div) sit = 'diverg';
          else if (solta) sit = 'semsub';
          else if (p.chapas > 2) sit = 'tres';
          else if (p.entre) sit = 'juncao';
          else sit = 'ok';
          const est = s.relacionado && !p.by && !solta ? p.st : null;
          return Object.assign({}, p, { sit, div, solta, est, stMovido: !!c.st, chapasCli: comChapas ? p.chapasCliente : null });
        });
        const conta = (f) => pts.filter(f).length;
        const subDe = (pc) => sp.subs.find((x) => x.pecas.includes(pc));
        const pares = {};
        pts.filter((p) => s.relacionado && p.entre && !p.by && !p.solta).forEach((p) => {
          const sts = [...new Set(p.pecas.filter((pc) => !sp.by.includes(pc)).map(subDe).filter(Boolean).map((x) => x.st))].sort((a, b) => a - b);
          const k = sts.map((x) => 'ST' + x).join(' × ');
          const o = (pares[k] = pares[k] || { n: 0, juncoes: [] });
          o.n++;
          const j = p.pecas.join(' + ');
          if (!o.juncoes.includes(j)) o.juncoes.push(j);
        });
        const sts = sp.subs.map((x) => x.st);
        /* conjuntos que chegam soldados: o 3D já mostra que são um conjunto (há pontos dentro deles) */
        const conjSemBy = [...new Set(pts.filter((p) => p.sit === 'interno').flatMap((p) => p.pecas))];
        const r = {
          conjSemBy,
          sp, pts, pares, comChapas,
          total: pts.length,
          noCiclo: conta((p) => !p.by),
          nBy: conta((p) => p.sit === 'by'),
          internosSemBy: conta((p) => p.sit === 'interno'),
          diverg: conta((p) => p.sit === 'diverg'),
          tres: conta((p) => s.relacionado && !p.by && p.chapas > 2),
          juncao: conta((p) => s.relacionado && !p.by && p.entre && !p.solta),
          semsub: conta((p) => p.sit === 'semsub'),
          alertas: conta((p) => ALERTAS.includes(p.sit)),
          stsUnicas: new Set(sts).size === sts.length,
        };
        const ptsDe = (sub) => pts.filter((p) => p.est === sub.st && !p.entre).length;
        r.ptsDe = ptsDe;
        r.checks = [
          { t: 'Conjuntos que chegam soldados estão marcados como BY', ok: r.internosSemBy === 0, nivel: 'erro', aba: 0,
            falha: s.importado ? `${r.internosSemBy} pontos dentro de ${conjSemBy.join(', ')}, que não está marcado como BY` : `${conjSemBy.join(', ')} é conjunto soldado e não está marcado como BY` },
          { t: 'Nenhuma peça ficou fora de uma subdivisão', ok: sp.soltas.length === 0, nivel: 'erro', aba: 1,
            falha: `${sp.soltas.length} peça(s) solta(s): ${sp.soltas.join(', ')}` },
          { t: 'Lista de pontos importada', ok: s.importado, nivel: 'erro', aba: 2, falha: 'Falta importar' },
          { t: 'Todo ponto está ligado a peças', ok: s.relacionado, nivel: 'erro', aba: 2, falha: s.importado ? 'Falta relacionar' : 'Falta importar e relacionar' },
          { t: 'Chapas informadas batem com a geometria', ok: s.relacionado && r.diverg === 0, nivel: 'erro', aba: 2,
            falha: s.relacionado ? `${r.diverg} divergência(s) sem decisão` : 'Falta relacionar',
            okTxt: s.relacionado && !r.comChapas ? 'Sem número do cliente: vale a geometria' : 'Certo' },
          { t: 'Toda subdivisão tem número de estação, sem repetir', ok: sp.subs.length > 0 && r.stsUnicas, nivel: 'erro', aba: 3,
            falha: sp.subs.length ? 'Número repetido' : 'Nenhuma subdivisão' },
          { t: 'Pontos com mais de 2 chapas', info: true, aba: 2,
            txt: s.relacionado ? (r.tres ? `${r.tres} ponto(s) com 3 chapas · alerta informativo` : 'Nenhum') : 'Aparece depois de relacionar' },
          { t: 'Pontos entre subdivisões (vão para a estação de junção)', info: true, aba: 2,
            txt: s.relacionado ? (r.juncao ? `${r.juncao} pontos vão para a ST${sp.stJuncao} (junção)` : 'Nenhum') : 'Aparece depois de relacionar' },
        ];
        r.ruins = r.checks.filter((c) => !c.info && !c.ok);
        return r;
      }

      /* ---------- abas e faixa de instrução ---------- */
      function abas() {
        const pend = [0, 1, 2, 3].map((a) => R.ruins.filter((c) => c.aba === a).length);
        $('#sp-abas', el).innerHTML = ABAS.map((a, i) => `<button role="tab" aria-selected="${s.aba === i}" data-acao="aba" data-aba="${i}" data-tip="${esc(a.tip)}">${esc(a.rot)}${pend[i] ? `<span class="badge" aria-label="${pend[i]} pendência(s)">${pend[i]}</span>` : ''}</button>`).join('');
      }
      const passoPil = (ok, txt, tip) => `<span class="pilula ${ok ? 'ok' : 'neutro'}" data-tip="${esc(tip)}">${esc(txt)}</span>`;
      function instr() {
        const t = AE.termos();
        const [tit, txt] = INSTR(s.aba, t);
        let dir = '';
        if (s.aba <= 1) dir = `<button class="btn" data-acao="ler" data-tip="Pergunta ao ${t.nome} quais peças estão selecionadas agora e mostra a lista ao lado. É a mesma leitura que as macros antigas fazem.">Ler seleção do CAD</button>`;
        else if (s.aba === 2) dir = `<div class="barra">${passoPil(s.importado, '1 · Importar', 'A lista de pontos já foi importada?')}${passoPil(s.relacionado, '2 · Relacionar', 'Os pontos já foram ligados às peças pela geometria?')}${passoPil(s.relacionado && R.diverg === 0, R.diverg ? `3 · Divergências: ${R.diverg}` : '3 · Divergências', 'Pontos em que a geometria e a lista do cliente discordam no número de chapas.')}</div>`;
        else dir = `<span class="pilula roxo" data-tip="Estação criada pelo programa para os pontos que unem subdivisões diferentes: a primeira dezena depois da última subdivisão. Muda sozinha quando o número de uma subdivisão muda.">Junção: ST${R.sp.stJuncao}</span>`;
        $('#sp-ins', el).innerHTML = `<div><strong>${esc(tit)}</strong><span>${esc(txt)}</span></div>${dir}`;
      }

      /* ---------- desenho do produto ---------- */
      function svg() {
        const sp = R.sp, sel = new Set(s.sel), selecionavel = s.aba <= 1;
        const partes = AE.dados.produto.pecas.map((pc) => {
          const sub = sp.subs.find((x) => x.pecas.includes(pc.id));
          const by = sp.by.includes(pc.id);
          let cls = 'sp-peca', estilo = '', tag = '', estado;
          if (by) { cls += ' by'; tag = 'BY'; estado = 'BY: chega soldada, vira uma peça única'; }
          else if (sub) { const c = corSub(sub); estilo = ` style="fill:${c};stroke:${c}"`; cls += ' feita'; tag = 'ST' + sub.st; estado = `na ST${sub.st} · ${sub.nome}`; }
          else if (sel.has(pc.id)) { cls += ' sel'; estado = 'selecionada'; }
          else estado = 'solta (ainda sem subdivisão)';
          const tip = `${pc.id} · ${pc.nome} · chapa de ${fmt(pc.esp, 1)} mm · ${estado}`;
          return `<path class="${cls}"${estilo} d="${pc.d}" data-peca="${pc.id}" data-tip="${esc(tip)}" data-tip-titulo="Peça"></path>
            <text class="sp-letra" x="${pc.lx}" y="${pc.ly}">${pc.id}</text>${tag ? `<text class="sp-tag" x="${pc.lx + 15}" y="${pc.ly}">${esc(tag)}</text>` : ''}`;
        }).join('');
        let pts = '';
        if (s.importado) {
          pts = R.pts.map((p) => {
            const cor = SIT[p.sit][2];
            const anel = s.ponto === p.n ? `<circle class="sp-anel" cx="${p.sx}" cy="${p.sy}" r="6.5"></circle>` : '';
            const hit = selecionavel ? '' : `<circle class="sp-hit" cx="${p.sx}" cy="${p.sy}" r="6" data-pt="${esc(p.n)}" data-tip-titulo="Ponto de solda" data-tip="${esc(tipPonto(p))}"></circle>`;
            return `<circle class="sp-pt ${cor}" cx="${p.sx}" cy="${p.sy}" r="3"></circle>${anel}${hit}`;
          }).join('');
        }
        const dica = !s.importado ? `<text class="sp-dica" x="260" y="318" text-anchor="middle">Os pontos aparecem depois de importar a lista (aba 1.3)</text>` : '';
        $('#sp-cad', el).innerHTML = `<span class="rotulo">vista do ${esc(AE.termos().nome)}</span>
          <svg viewBox="0 0 520 330" class="${selecionavel ? 'sp-selecionavel' : ''}" role="img" aria-label="Produto de exemplo com seis peças e os pontos de solda">
            <rect width="520" height="330" fill="var(--cad)"></rect>${partes}${pts}${dica}</svg>`;
        $('#sp-cad-sub', el).textContent = selecionavel
          ? 'Clique nas peças para selecionar (ficam em amarelo). BY fica tracejado; cada subdivisão ganha uma cor.'
          : s.importado ? 'Clique num ponto para abrir a correção dele. Passe o mouse para ver nome, peças e coordenadas.' : 'Cada subdivisão tem uma cor. BY fica tracejado.';
        const leg = s.importado ? [['ok', 'conferido'], ['roxo', 'junção (entre subdivisões)'], ['aviso', 'mais de 2 chapas'], ['erro', 'divergência'], ['laranja', 'peça sem subdivisão ou conjunto sem BY'], ['fraco', 'BY · fora do ciclo'], ['azul', 'aguardando relacionar']]
          .filter(([c]) => R.pts.some((p) => SIT[p.sit][2] === c)) : [];
        $('#sp-legenda', el).innerHTML = leg.map(([c, t]) => `<span><i style="background:var(--${c})"></i>${esc(t)}</span>`).join('');
      }
      function tipPonto(p) {
        const ori = s.origemPontos ? (ORIGENS[s.origemPontos] || ORIGENS.excel).curto : '';
        return `${p.n} · peças ${p.pecas.join(' + ')} · X ${p.x} · Y ${p.y} · Z ${p.z} mm (valor ${ori}: ${fmt(p.xc, 1)} / ${fmt(p.yc, 1)} / ${fmt(p.zc, 1)}) · ${SIT[p.sit][1]}${p.est ? ' · ST' + p.est : ''}`;
      }

      /* ---------- botões sob o desenho ---------- */
      function acoes() {
        const t = AE.termos();
        const lim = `<button class="btn leve" data-acao="limpar" data-tip="Tira a seleção de todas as peças.">Limpar seleção</button>`;
        const chips = s.sel.length ? `<span class="sp-chips" data-tip="Peças selecionadas agora no desenho.">${s.sel.map((id) => `<span>${esc(id)}</span>`).join('')}</span>` : '';
        let h = '';
        if (s.aba === 0) h = `<button class="btn primario" data-acao="by" data-tip="Marca as peças selecionadas como BY. Elas viram uma peça única, e os pontos de dentro delas saem do cálculo de ciclo, mas continuam no 3D.">Marcar como BY</button>${lim}${chips}`;
        else if (s.aba === 1) h = `<button class="btn primario" data-acao="sub" data-tip="Cria um ${t.product} no ${t.nome} com as peças selecionadas, move as peças para dentro dele e separa junto os pontos que pertencem a esse conjunto.">Criar subdivisão</button>${lim}${chips}`;
        else if (s.aba === 2) h = s.importado ? '' : `<button class="btn" data-acao="ir-import" data-tip="Leva até o quadro de importação da lista de pontos, logo abaixo.">Importar a lista de pontos ↓</button>`;
        else h = `<button class="btn leve" data-acao="aba" data-aba="1" data-tip="Volta para a aba 1.2 para criar ou desfazer subdivisões.">Mudar subdivisões (1.2)</button>`;
        $('#sp-acoes', el).innerHTML = h;
      }

      /* ---------- coluna ao lado do desenho ---------- */
      function blocoSelecao() {
        const t = AE.termos();
        const atual = s.sel.slice().sort().join(',');
        const mudou = s.lido && s.lido.pecas.slice().sort().join(',') !== atual;
        return `<h3 class="rotulo-sec">Seleção lida do ${esc(t.nome)}</h3>${s.lido
          ? `${s.lido.pecas.length ? `<div class="leitura">${s.lido.pecas.map((id) => `<div><code>${esc(id)}</code><span>${esc(nomeP(id))} <small style="color:var(--fraco)">· chapa ${fmt(PECA[id].esp, 1)} mm</small></span></div>`).join('')}</div>` : '<div class="vazio">A leitura voltou vazia: nada estava selecionado.</div>'}
             <p class="nota ${mudou ? 'aviso' : ''}">Lida às ${esc(s.lido.hora)} no ${esc(s.lido.sistema)}.${mudou ? ' A seleção mudou depois da leitura: leia de novo para conferir.' : ''}</p>`
          : `<div class="vazio">Nada lido ainda. Clique nas peças no desenho (ele faz o papel do ${esc(t.nome)}) e use "Ler seleção do CAD".</div>`}`;
      }
      function caixaJuncao() {
        const sp = R.sp;
        if (sp.subs.length < 2) return `<div class="sp-juncao"><span><span class="pilula roxo">Estação de junção</span></span><span>Quando houver duas ou mais subdivisões, os pontos que unem peças de subdivisões diferentes vão para uma estação de junção, criada pelo programa depois da última subdivisão.</span></div>`;
        const pares = Object.entries(R.pares);
        return `<div class="sp-juncao"><span><span class="pilula roxo" data-tip="Estação criada pelo programa: a primeira dezena depois da última subdivisão.">ST${sp.stJuncao} · junção</span></span>
          <span>Ponto que une peças de subdivisões diferentes não pode ser soldado em nenhuma das duas: as peças só se encontram depois. Esses pontos vão para a <b>ST${sp.stJuncao}</b>, que recebe os subconjuntos prontos (estação de geometria).</span>
          ${s.relacionado
            ? pares.length ? `<ul>${pares.map(([k, o]) => `<li><b>${esc(k)}</b>: ${o.n} pontos (${esc(o.juncoes.join(', '))})</li>`).join('')}</ul>` : '<span>Nenhum ponto une subdivisões diferentes.</span>'
            : '<span>Relacione os pontos às peças (aba 1.3) para ver quantos vão para a junção.</span>'}</div>`;
      }
      function lado() {
        const t = AE.termos(), sp = R.sp;
        let h = '';
        if (s.aba === 0) {
          h = `<h2>Peças que chegam soldadas (BY)</h2>
            <p class="sub">Cada grupo BY vira uma peça única. Os pontos de dentro saem do cálculo de ciclo, mas continuam no 3D.</p>
            <div class="lista">${s.byGrupos.length ? s.byGrupos.map((g, i) => {
              const dentro = s.importado ? R.pts.filter((p) => p.pecas.every((pc) => g.pecas.includes(pc))).length : null;
              return `<div class="item"><span class="tag">BY ${i + 1}</span><div>${esc(listaNomes(g.pecas))}<small>${dentro == null ? 'Os pontos de dentro saem do ciclo quando a lista for importada.' : `${dentro} ponto(s) de dentro · fora do ciclo, continuam no 3D`}</small></div>
                <button class="btn mini leve" data-acao="desfazer-by" data-g="${g.id}" data-tip="Desfaz este BY no ${esc(t.nome)}: as peças voltam a ser peças comuns e os pontos de dentro voltam a contar no ciclo.">Desfazer BY</button></div>`;
            }).join('') : '<div class="vazio">Nenhuma peça marcada como BY. Selecione no desenho as peças que chegam soldadas de fora e use "Marcar como BY".</div>'}</div>
            ${R.conjSemBy.length ? `<p class="nota aviso">O 3D mostra que ${esc(listaNomes(R.conjSemBy))} é um conjunto que já chega soldado${s.importado ? ` (${R.internosSemBy} pontos de dentro)` : ''}. Selecione e marque como BY.</p>` : ''}
            ${blocoSelecao()}`;
        } else if (s.aba === 1) {
          const subs = sp.subs.slice().sort((a, b) => a.st - b.st);
          h = `<h2>Subdivisões criadas</h2>
            <p class="sub">Cada uma vira um ${esc(t.product)} no ${esc(t.nome)} e uma estação provisória, numerada de 10 em 10.</p>
            <div class="lista">${subs.length ? subs.map((x) => `<div class="item sp-item-cor" style="border-left-color:${corSub(x)}"><span class="tag">ST${x.st}</span>
                <div>${esc(x.nome)}<small>Peças ${esc(x.pecas.join(' + '))} · id interno ${x.id}${s.relacionado ? ` · ${R.ptsDe(x)} pontos` : ''}</small></div>
                <div class="barra"><span class="pilula ok" data-tip="${esc(`${t.product} ST${x.st} criado no ${t.nome}, com as peças dentro.`)}">${esc(t.product)} criado</span>
                <button class="btn mini leve" data-acao="rm-sub" data-id="${x.id}" data-tip="Desfaz esta subdivisão no ${esc(t.nome)}: as peças voltam para a raiz e ficam soltas.">Desfazer</button></div></div>`).join('')
              : '<div class="vazio">Nenhuma subdivisão ainda. Selecione peças no desenho e use "Criar subdivisão".</div>'}</div>
            <p class="nota ${sp.soltas.length ? 'aviso' : 'ok'}">${sp.soltas.length ? `Peças soltas: ${esc(listaNomes(sp.soltas))}.` : 'Nenhuma peça solta.'}</p>
            ${caixaJuncao()}${blocoSelecao()}`;
        } else if (s.aba === 2) {
          const kp = (rot, v, sm, cls, tip) => `<div class="kpi ${cls || ''}" data-tip="${esc(tip)}"><span>${rot}</span><b>${v}</b><small>${sm}</small></div>`;
          h = `<h2>Resumo dos pontos</h2>
            <p class="sub">${s.importado ? `Lista importada ${esc((ORIGENS[s.origemPontos] || ORIGENS.excel).curto)}.` : 'Nenhuma lista importada ainda.'}</p>
            ${s.importado ? `<div class="kpis">
              ${kp('Importados', R.total, (ORIGENS[s.origemPontos] || ORIGENS.excel).nome, '', 'Total de pontos lidos da origem escolhida.')}
              ${kp('No ciclo', R.noCiclo, 'entram na conta de estações', '', 'Pontos que serão soldados na linha. Os de BY ficam fora.')}
              ${kp('BY', R.nBy, 'fora do ciclo, no 3D', '', 'Pontos de dentro de conjuntos que chegam soldados.')}
              ${kp('Junção', s.relacionado ? R.juncao : '—', s.relacionado ? `vão para a ST${sp.stJuncao}` : 'depois de relacionar', '', 'Pontos que unem subdivisões diferentes.')}
              ${kp('Alertas', s.relacionado || R.internosSemBy ? R.alertas : '—', R.diverg ? `${R.diverg} divergência(s)` : 'divergências e 3 chapas', R.diverg ? 'erro' : R.alertas ? 'aviso' : 'ok', 'Divergências de chapas, pontos com mais de 2 chapas e pontos de peça sem subdivisão.')}
              </div>
              <p class="nota">${R.total} coordenadas vieram com casas decimais e foram arredondadas para milímetro inteiro (maior diferença ${fmt(Math.max(...R.pts.map((p) => Math.max(Math.abs(p.x - p.xc), Math.abs(p.y - p.yc), Math.abs(p.z - p.zc)))), 1)} mm). O valor original fica guardado e aparece no balão de cada ponto.</p>`
            : '<div class="vazio">Escolha a origem no quadro "Pontos de solda" abaixo e use "Importar lista de pontos".</div>'}
            ${caixaJuncao()}`;
        } else {
          const subs = sp.subs.slice().sort((a, b) => a.st - b.st);
          const pj = AE.calc.projeto();
          const trocas = s.registro.filter((r) => r.tipo === 'troca');
          h = `<h2>Estações provisórias</h2>
            <p class="sub">O número é só um atributo: o id interno de cada subdivisão não muda quando o número muda.</p>
            <div class="lista">${subs.length ? subs.map((x) => `<div class="item sp-item-cor" style="border-left-color:${corSub(x)}"><span class="tag">ST${x.st}</span><div>${esc(x.nome)}<small>id interno ${x.id} · peças ${esc(x.pecas.join(' + '))}${s.relacionado ? ` · ${R.ptsDe(x)} pontos` : ''}</small></div><span class="pilula neutro" data-tip="Numerada pelo programa ou trocada pelo usuário. A troca fica no registro abaixo.">subdivisão</span></div>`).join('')
              + (subs.length > 1 ? `<div class="item sp-item-cor" style="border-left-color:var(--roxo)"><span class="tag">ST${sp.stJuncao}</span><div>Junção dos subconjuntos (geometria)<small>criada pelo programa${s.relacionado ? ` · ${R.juncao} pontos` : ''}</small></div><span class="pilula roxo" data-tip="Não tem número próprio: é sempre a primeira dezena depois da última subdivisão.">automática</span></div>` : '')
              : '<div class="vazio">Nenhuma subdivisão para numerar. Crie as subdivisões na aba 1.2.</div>'}</div>
            ${subs.length ? `<div class="barra" style="margin-top:12px">
              <label class="campo" style="flex:1;min-width:180px">Subdivisão<select id="sp-renum-sel">${subs.map((x) => `<option value="${x.id}">ST${x.st} · ${esc(x.nome)}</option>`).join('')}</select></label>
              <button class="btn" data-acao="renum" style="align-self:flex-end" data-tip="Troca o número da estação escolhida. O programa atualiza o número em todos os arquivos e documentos que o usam e guarda o registro da troca.">Trocar número da estação</button></div>` : ''}
            <p class="nota">Nomes de arquivo no padrão ${esc(pj.cliente)}: <code>${esc(pj.padrao.nomeArquivo)}</code></p>
            <h3 class="rotulo-sec">Registro das trocas</h3>
            ${trocas.length ? `<div class="registro">${trocas.map((r) => `<span>${esc(r.hora)} · ${esc(r.texto)}</span>`).join('')}</div>` : '<div class="vazio">Nenhuma troca de número ainda.</div>'}`;
        }
        $('#sp-lado', el).innerHTML = h;
      }

      /* ---------- tabela de pontos (aba 1.3) ---------- */
      function filtros() {
        const sp = R.sp;
        const f = [['todos', 'Todos', R.total], ['alertas', 'Alertas', R.alertas], ['by', 'BY', R.nBy]];
        if (s.relacionado) {
          sp.subs.slice().sort((a, b) => a.st - b.st).forEach((x) => f.push(['st:' + x.st, 'ST' + x.st, R.pts.filter((p) => p.est === x.st).length]));
          if (!sp.subs.some((x) => x.st === sp.stJuncao)) f.push(['st:' + sp.stJuncao, `ST${sp.stJuncao} junção`, R.pts.filter((p) => p.est === sp.stJuncao).length]);
          const sem = R.pts.filter((p) => !p.by && !p.est).length;
          if (sem) f.push(['sem', 'Sem estação', sem]);
        }
        if (!f.some(([k]) => k === s.filtro)) s.filtro = 'todos';
        return f;
      }
      const filtrar = (p) => {
        const k = s.filtro;
        if (k === 'alertas') return ALERTAS.includes(p.sit);
        if (k === 'by') return p.sit === 'by';
        if (k === 'sem') return !p.by && !p.est;
        if (k.startsWith('st:')) return p.est === +k.slice(3);
        return true;
      };
      function pontos() {
        const bloco = $('#sp-pontos', el);
        bloco.hidden = s.aba !== 2;
        if (s.aba !== 2) return;
        const origem = s.origemEscolhida;
        const fs = filtros();
        const lista = R.pts.filter(filtrar);
        const corrs = s.registro.filter((r) => r.tipo === 'correcao');
        const linhas = lista.map((p) => {
          const [pc, ptxt] = SIT[p.sit];
          const est = p.est ? (p.entre && !p.stMovido ? `<span class="pilula roxo" data-tip="${esc(`Une peças de subdivisões diferentes (${p.pecas.join(' + ')}): só pode ser soldado depois que os subconjuntos se encontram, na estação de junção.`)}">ST${p.est} · junção</span>` : `ST${p.est}${p.stMovido ? ' <span class="pilula roxo" data-tip="Estação escolhida pelo usuário em Corrigir um ponto.">movido</span>' : ''}`) : '—';
          const tipSit = {
            aguarda: 'O ponto foi importado, mas ainda não foi ligado às peças. Use "Relacionar pontos às peças".',
            by: 'Ponto que já vem soldado. Fica fora da distribuição e do ciclo, mas continua no 3D identificado como BY.',
            interno: `Este ponto fica dentro do conjunto ${p.pecas.join(' + ')}, que chega soldado. Marque o conjunto como BY na aba 1.1.`,
            diverg: `A geometria mostra ${p.chapasGeo} chapas neste ponto, e a lista do cliente diz ${p.chapasCliente}. Decida qual valor vale em "Corrigir um ponto".`,
            semsub: 'Este ponto une peças que ainda não estão em nenhuma subdivisão. Crie a subdivisão na aba 1.2.',
            tres: `O programa encontrou ${p.chapas} chapas sobrepostas neste ponto. Alerta informativo.`,
            juncao: `Une subdivisões diferentes: vai para a ST${p.est}, estação de junção.`,
            ok: 'Ponto ligado às peças, chapas conferidas.',
          }[p.sit];
          const ori = (ORIGENS[s.origemPontos] || ORIGENS.excel).curto;
          const coord = (eixo, v, vc) => `<td class="num" data-tip="${esc(`${eixo} ${ori}: ${fmt(vc, 1)} mm. Arredondado para ${v} mm.`)}">${v}</td>`;
          return `<tr class="clicavel ${s.ponto === p.n ? 'sel' : ''}" data-pt="${esc(p.n)}">
            <td class="mono">${esc(p.n)}</td>${coord('X', p.x, p.xc)}${coord('Y', p.y, p.yc)}${coord('Z', p.z, p.zc)}
            <td>${s.relacionado || p.interno ? esc(p.pecas.join(' + ')) : '—'}</td>
            <td class="num">${s.relacionado || p.interno ? p.chapasGeo : '—'}</td>
            <td class="num" ${p.chapasCli == null ? 'data-tip="A origem escolhida não traz o número de chapas: o programa conta pela geometria (regra &quot;se não receber&quot;)."' : ''}>${p.chapasCli == null ? '—' : p.chapasCli}</td>
            <td>${est}</td>
            <td><span class="pilula ${pc}" data-tip="${esc(tipSit)}">${esc(p.sit === 'tres' ? `${p.chapas} chapas` : ptxt)}</span>${s.correcoes[p.n] && s.correcoes[p.n].chapas ? ` <span class="pilula roxo" data-tip="${esc(`Valor decidido pelo usuário: ${s.correcoes[p.n].chapas} chapas.`)}">corrigido</span>` : ''}</td></tr>`;
        }).join('');
        bloco.innerHTML = `
          <h2>Pontos de solda <span class="exemplo">dados de exemplo</span></h2>
          <p class="sub">O programa conta as chapas pela geometria e compara com o que o cliente informou. As três origens viram a mesma tabela.</p>
          <div class="campo" style="margin-bottom:10px">Origem da lista
            <div class="seg" id="sp-origem">${Object.entries(ORIGENS).map(([k, o]) => `<button data-origem="${k}" aria-pressed="${origem === k}" data-tip="${esc(o.tip)}">${esc(o.nome)}</button>`).join('')}</div></div>
          <div class="barra" style="margin-bottom:12px">
            <button class="btn ${s.importado ? '' : 'primario'}" data-acao="importar" data-tip="Lê a lista de pontos da origem escolhida (planilha Excel do cliente, pontos dentro do 3D ou desenho 2D). As três viram a mesma tabela, com as coordenadas arredondadas para milímetro inteiro.">${s.importado ? 'Importar de novo' : 'Importar lista de pontos'}</button>
            <button class="btn ${s.importado && !s.relacionado ? 'primario' : ''}" data-acao="relacionar" data-tip="Para cada ponto, olha no 3D quais chapas estão sobrepostas naquela posição, conta quantas são e liga o ponto a essas peças.">Relacionar pontos às peças</button>
            <button class="btn leve" data-acao="corrigir" data-tip="Abre o ponto para edição: decidir quantas chapas valem ou mover o ponto de estação. A correção fica registrada.">Corrigir um ponto</button>
          </div>
          ${s.importado ? `
          <div class="abas sp-filtros" id="sp-filtros" role="group" aria-label="Filtrar pontos">${fs.map(([k, rot, n]) => `<button data-filtro="${esc(k)}" aria-pressed="${s.filtro === k}" data-tip="Mostra só os pontos deste grupo na tabela.">${esc(rot)} · ${n}</button>`).join('')}</div>
          <div class="rolagem alta"><table id="sp-tab">
            <thead><tr><th>Ponto</th><th class="num">X</th><th class="num">Y</th><th class="num">Z</th><th>Peças</th><th class="num">Chapas (3D)</th><th class="num">Chapas (cliente)</th><th>Estação</th><th>Situação</th></tr></thead>
            <tbody>${linhas || '<tr><td colspan="9"><div class="vazio">Nenhum ponto neste filtro.</div></td></tr>'}</tbody></table></div>
          <p class="nota">Clique numa linha (ou num ponto do desenho) para corrigir. Passe o mouse nas coordenadas para ver o valor original.</p>
          <div id="sp-editor"></div>`
          : `<div class="vazio">Nenhuma lista de pontos ainda. Escolha a origem acima e use "Importar lista de pontos".</div>`}
          ${corrs.length ? `<h3 class="rotulo-sec">Correções registradas</h3><div class="registro">${corrs.map((r) => `<span>${esc(r.hora)} · ${esc(r.texto)}</span>`).join('')}</div>` : ''}`;
        editor();
      }
      function editor() {
        const box = $('#sp-editor', el);
        if (!box) return;
        const p = s.ponto && R.pts.find((x) => x.n === s.ponto);
        if (!p) { box.innerHTML = ''; return; }
        const c = s.correcoes[p.n] || {};
        if (!s.relacionado) {
          box.innerHTML = `<div class="sp-editor"><div class="barra entre"><h3>${esc(p.n)}</h3><button class="btn mini leve" data-acao="fechar-editor" data-tip="Fecha a correção deste ponto.">Fechar</button></div>
            <div class="vazio">Relacione os pontos às peças primeiro: a correção compara as chapas da geometria com as do cliente.</div></div>`;
          return;
        }
        if (p.by) {
          box.innerHTML = `<div class="sp-editor"><div class="barra entre"><h3>${esc(p.n)}</h3><button class="btn mini leve" data-acao="fechar-editor" data-tip="Fecha a correção deste ponto.">Fechar</button></div>
            <p class="sub" style="margin:0">Ponto de BY: fica fora do ciclo e não tem estação. Para mudar, desfaça o BY na aba 1.1.</p></div>`;
          return;
        }
        const atual = c.chapas || p.chapasGeo;
        const sp = R.sp;
        const opcoes = sp.subs.slice().sort((a, b) => a.st - b.st).map((x) => [x.st, `ST${x.st} · ${x.nome}`]);
        if (!opcoes.some(([v]) => v === sp.stJuncao)) opcoes.push([sp.stJuncao, `ST${sp.stJuncao} · junção`]);
        box.innerHTML = `<div class="sp-editor">
          <div class="barra entre"><h3>Corrigir ${esc(p.n)}</h3><button class="btn mini leve" data-acao="fechar-editor" data-tip="Fecha a correção deste ponto sem mudar nada.">Fechar</button></div>
          <p class="sub" style="margin:0">Peças ${esc(p.pecas.join(' + '))} · X ${p.x} · Y ${p.y} · Z ${p.z} mm · <span class="pilula ${SIT[p.sit][0]}">${esc(SIT[p.sit][1])}</span></p>
          <div class="campos">
            <div class="campo">Número de chapas que vale (agora: ${atual})
              <div class="barra">
                <button class="btn mini ${c.chapas === p.chapasGeo ? 'primario' : ''}" data-acao="chapas" data-v="${p.chapasGeo}" data-tip="Grava que vale o número contado na geometria do 3D. A decisão fica registrada.">Vale a geometria (${p.chapasGeo})</button>
                ${p.chapasCli != null && p.chapasCli !== p.chapasGeo ? `<button class="btn mini ${c.chapas === p.chapasCli ? 'primario' : ''}" data-acao="chapas" data-v="${p.chapasCli}" data-tip="Grava que vale o número da lista do cliente. A decisão fica registrada.">Vale o cliente (${p.chapasCli})</button>` : ''}
                <button class="btn mini leve" data-acao="chapas-outro" data-tip="Pede outro número de chapas (de 1 a 5) e grava como decisão do usuário.">Outro valor…</button>
              </div></div>
            <label class="campo">Estação do ponto
              <select id="sp-st-ponto" data-tip="Move o ponto para outra estação. Automática segue a regra do programa (subdivisão das peças ou junção).">
                <option value="">Automática (regra do programa)</option>
                ${opcoes.map(([v, r]) => `<option value="${v}" ${c.st === v ? 'selected' : ''}>${esc(r)}</option>`).join('')}
              </select></label>
          </div>
          ${c.chapas || c.st ? `<div class="barra"><button class="btn mini perigo" data-acao="desfazer-correcao" data-tip="Apaga as decisões tomadas para este ponto: volta a valer o que o programa calculou.">Desfazer correção</button></div>` : ''}
        </div>`;
      }

      /* ---------- checagem ---------- */
      function checagem() {
        $('#sp-check', el).innerHTML = R.checks.map((c) => {
          let pil;
          if (c.info) pil = `<span class="pilula info">${esc(c.txt)}</span>`;
          else if (c.ok) pil = `<span class="pilula ok">${esc(c.okTxt || 'Certo')}</span>`;
          else pil = `<span class="pilula ${c.nivel}">${esc(c.falha)}</span><button class="btn mini leve" data-acao="aba" data-aba="${c.aba}" data-tip="Abre a aba ${esc(ABAS[c.aba].rot)} para resolver este item.">Resolver</button>`;
          return `<div><span>${esc(c.t)}</span><span class="barra">${pil}</span></div>`;
        }).join('');
      }

      function pinta() { R = analisar(); abas(); instr(); svg(); acoes(); lado(); pontos(); checagem(); }
      pinta();

      /* ---------- ações ---------- */
      const PROX_ST = () => (s.subs.length ? Math.ceil((Math.max(...s.subs.map((x) => x.st)) + 1) / 10) * 10 : 10);
      const acoesCad = {
        async ler(b) {
          const t = AE.termos(), ids = s.sel.slice().sort();
          if (!(await ctx.cad({
            titulo: 'Ler a seleção do CAD',
            catia: 'Set sel = CATIA.ActiveDocument.Selection\nFor i = 1 To sel.Count\n  nomes(i) = sel.Item(i).LeafProduct.PartNumber\nNext',
            nx: 'var sm = UI.GetUI().SelectionManager;\nfor (int i = 0; i < sm.GetNumSelectedObjects(); i++)\n  comps.Add((Component)sm.GetSelectedTaggedObject(i));',
            resultado: ids.length ? `${ids.length} peça(s) selecionada(s): ${ids.join(', ')}` : 'Nenhuma peça selecionada.',
          }, b))) return;
          s.lido = { hora: hora(), sistema: t.nome, pecas: ids };
          ctx.salvarUI(); lado(); acoes();
          ctx.avisa(ids.length ? `Seleção lida do ${t.nome}: ${listaNomes(ids)}.` : `Nada selecionado no ${t.nome}. Clique nas peças no desenho e leia de novo.`, { tipo: ids.length ? 'ok' : 'aviso' });
        },
        async by(b) {
          const t = AE.termos();
          if (!s.sel.length) { ctx.avisa('Selecione primeiro, no desenho, as peças que chegam soldadas.', { tipo: 'aviso' }); return; }
          const ids = s.sel.slice().sort();
          const gid = Math.max(0, ...s.byGrupos.map((g) => g.id)) + 1;
          if (!(await ctx.cad({
            titulo: `Marcar como BY: ${ids.join(', ')}`,
            catia: `Set by = raiz.Products.AddNewComponent("Product", "BY_${String(gid).padStart(2, '0')}")\n' move as peças selecionadas para dentro do BY (Recortar / Colar)\nby.ReferenceProduct.UserRefProperties.CreateString "BY", "SIM"`,
            nx: `var by = workPart.ComponentAssembly.AddComponent(...); // componente BY_${String(gid).padStart(2, '0')}\nworkPart.ComponentAssembly.RestructureComponents(selecionadas, by, true, out erros);\nby.SetUserAttribute("BY", -1, "SIM", Update.Option.Now);`,
            resultado: `Peças ${ids.join(', ')} unidas no BY_${String(gid).padStart(2, '0')}. Os pontos de dentro ficam no 3D, fora do ciclo.`,
          }, b))) return;
          s.byGrupos.push({ id: gid, pecas: ids });
          s.by = [...new Set(s.byGrupos.flatMap((g) => g.pecas))];
          s.sel = []; s.lido = null;
          ctx.registrar(`Marcado como BY: ${ids.join(', ')}. Os pontos de dentro saem do cálculo de ciclo.`);
          ctx.salvar(); pinta();
          ctx.avisa(`Marcado como BY: ${listaNomes(ids)}. Viram uma peça única no ${t.nome}; os pontos de dentro saem do cálculo de ciclo, mas continuam no 3D.`, { tipo: 'ok' });
        },
        async 'desfazer-by'(b) {
          const g = s.byGrupos.find((x) => x.id === +b.dataset.g);
          if (!g) return;
          const nome = 'BY_' + String(g.id).padStart(2, '0');
          if (!(await ctx.cad({
            titulo: `Desfazer ${nome}`,
            catia: `Set by = raiz.Products.Item("${nome}")\n' devolve as peças para a raiz e apaga o Product vazio\nraiz.Products.Remove "${nome}"`,
            nx: `workPart.ComponentAssembly.RestructureComponents(pecasDoBy, raiz, true, out erros);\nby.DeleteUserAttribute(NXObject.AttributeType.String, "BY", true, Update.Option.Now);`,
            resultado: `${nome} desfeito: ${g.pecas.join(', ')} voltaram a ser peças comuns.`,
          }, b))) return;
          s.byGrupos = s.byGrupos.filter((x) => x !== g);
          s.by = [...new Set(s.byGrupos.flatMap((x) => x.pecas))];
          ctx.registrar(`BY desfeito: ${g.pecas.join(', ')} voltaram a contar no ciclo.`);
          ctx.salvar(); pinta();
          ctx.avisa(`BY desfeito: ${listaNomes(g.pecas)} voltaram a ser peças comuns. Coloque-as numa subdivisão (aba 1.2).`);
        },
        async sub(b) {
          const t = AE.termos();
          if (!s.sel.length) { ctx.avisa('Selecione no desenho as peças desta subdivisão.', { tipo: 'aviso' }); return; }
          const ids = s.sel.slice().sort();
          const st = PROX_ST(), id = s.proxId || 1;
          const sugestao = nomeCurto(ids);
          const nome = await ctx.perguntar({
            titulo: `Criar subdivisão com ${ids.join(' + ')}`,
            texto: `O programa cria um ${t.product} no ${t.nome} com estas peças e dá a estação provisória ST${st}. O nome é opcional.`,
            campo: 'Nome da subdivisão (opcional)', valor: sugestao, obrigatorio: false, ok: 'Criar subdivisão',
          });
          if (nome == null) return;
          const nomeFinal = nome || sugestao;
          const prod = `ST${st}_${slug(nomeFinal)}`;
          if (!(await ctx.cad({
            titulo: `Criar subdivisão ST${st}`,
            catia: `Set sub = raiz.Products.AddNewComponent("Product", "${prod}")\nCATIA.ActiveDocument.Selection.Cut\nsel.Add sub : sel.Paste   ' move as peças ${ids.join(', ')} para dentro\n' CreateAllCatPart: cria o CATPart de cada peça que ainda não tem`,
            nx: `var b = workPart.AssemblyManager.CreateNewComponentBuilder();\nb.NewComponentName = "${prod}";\nvar sub = (Component)b.Commit();\nworkPart.ComponentAssembly.RestructureComponents(selecionadas, sub, true, out erros);`,
            macro: 'Part_2_Product, CreateAllCatPart',
            resultado: `${t.product} ${prod} criado com as peças ${ids.join(', ')}. Pontos dessas peças separados junto.`,
          }, b))) return;
          s.subs.push({ id, st, nome: nomeFinal, pecas: ids });
          s.proxId = id + 1;
          s.sel = []; s.lido = null;
          ctx.registrar(`Subdivisão ST${st} (id interno ${id}) criada com ${ids.join(', ')}: ${nomeFinal}.`);
          ctx.salvar(); pinta();
          const soltas = R.sp.soltas;
          ctx.avisa(`${t.product} criado no ${t.nome} com ${ids.join(', ')}. Estação provisória ST${st}.${soltas.length ? ` Ainda falta${soltas.length > 1 ? 'm' : ''} ${soltas.length} peça(s) solta(s): ${soltas.join(', ')}.` : ' Nenhuma peça solta: siga para a aba 1.3.'}`, { tipo: 'ok' });
        },
        async 'rm-sub'(b) {
          const t = AE.termos();
          const x = s.subs.find((k) => k.id === +b.dataset.id);
          if (!x) return;
          const ok = await ctx.perguntar({ titulo: `Desfazer a ST${x.st}?`, texto: `O ${t.product} da ST${x.st} é desfeito no ${t.nome}: as peças ${x.pecas.join(', ')} voltam para a raiz e ficam soltas. O id interno ${x.id} não é reaproveitado.`, ok: 'Desfazer subdivisão', perigo: true });
          if (!ok) return;
          if (!(await ctx.cad({
            titulo: `Desfazer subdivisão ST${x.st}`,
            catia: `Set sub = raiz.Products.Item("ST${x.st}_${slug(x.nome)}")\n' move as peças de volta para a raiz e apaga o Product vazio\nraiz.Products.Remove sub.Name`,
            nx: `workPart.ComponentAssembly.RestructureComponents(pecasDaSub, raiz, true, out erros);\ntheSession.UpdateManager.AddToDeleteList(sub);`,
            resultado: `ST${x.st} desfeita: ${x.pecas.join(', ')} voltaram para a raiz.`,
          }, b))) return;
          s.subs = s.subs.filter((k) => k !== x);
          let limpos = 0;
          Object.keys(s.correcoes).forEach((n) => {
            const c = s.correcoes[n];
            if (c.st === x.st) { delete c.st; limpos++; if (!c.chapas) delete s.correcoes[n]; }
          });
          ctx.registrar(`Subdivisão ST${x.st} (id interno ${x.id}) desfeita. Peças soltas: ${x.pecas.join(', ')}.${limpos ? ` ${limpos} ponto(s) movidos para ela voltaram à regra automática.` : ''}`);
          ctx.salvar(); pinta();
          ctx.avisa(`ST${x.st} desfeita. As peças ${x.pecas.join(', ')} estão soltas de novo.`);
        },
        async importar(b) {
          const o = ORIGENS[s.origemEscolhida] ? s.origemEscolhida : 'excel', O = ORIGENS[o];
          const nCorr = Object.keys(s.correcoes).length;
          if (s.importado) {
            const ok = await ctx.perguntar({ titulo: 'Importar a lista de novo?', texto: `A lista atual (${(ORIGENS[s.origemPontos] || ORIGENS.excel).curto}) é substituída pela ${O.curto}. As ligações às peças são refeitas${nCorr ? ` e as ${nCorr} correção(ões) de ponto são apagadas` : ''}.`, ok: 'Importar de novo', perigo: !!nCorr });
            if (!ok) return;
          }
          const n = AE.dados.produto.pontos.length;
          const cad = {
            excel: {
              catia: `Set xl = GetObject(, "Excel.Application")   ' planilha do cliente aberta\nSet hb = part.HybridBodies.Add() : hb.Name = "PONTOS_SOLDA"\nFor cada linha: Set pt = hsf.AddNewPointCoord(x, y, z) : hb.AppendHybridShape pt\npart.Update`,
              nx: `// lê a planilha do cliente (Excel) e cria um ponto por linha\nvar pt = workPart.Points.CreatePoint(new Point3d(x, y, z));\npt.SetVisibility(SmartObject.VisibilityOption.Visible);\npt.SetName(nomeDoPonto);`,
              macro: 'WritePoints2Excel (formato da tabela)',
            },
            '3d': {
              catia: 'Set hb = part.HybridBodies.Item("PONTOS_SOLDA")\nFor Each sh In hb.HybridShapes\n  sh.GetCoordinates coords   \' X, Y, Z com casas decimais\nNext\n\' grava a tabela no formato padrão (WritePoints2Excel)',
              nx: 'foreach (Point p in workPart.Points)\n  lista.Add(p.Name, p.Coordinates);   // X, Y, Z com casas decimais',
              macro: 'Cordenadas, WritePoints2Excel',
            },
            '2d': {
              catia: 'Set folha = CATIA.ActiveDocument.Sheets.ActiveSheet\nSet tab = folha.Views.ActiveView.Tables.Item(1)\nFor i = 2 To tab.NumberOfRows\n  x = tab.GetCellString(i, 2) : y = tab.GetCellString(i, 3) : z = tab.GetCellString(i, 4)\nNext',
              nx: 'foreach (var tab in workPart.Annotations.Tables)\n  // lê as células da tabela de pontos do desenho (nome, X, Y, Z)\n  lerTabela(tab);',
              macro: 'Cordenadas',
            },
          }[o];
          if (!(await ctx.cad(Object.assign({ titulo: `Importar lista de pontos: ${O.nome}`, resultado: `${n} pontos lidos ${O.curto}. Coordenadas arredondadas para milímetro inteiro; valor original guardado.` }, cad), b))) return;
          s.importado = true; s.origemPontos = o; s.relacionado = false; s.correcoes = {}; s.ponto = null; s.filtro = 'todos';
          ctx.registrar(`Lista de pontos importada ${O.curto}: ${n} pontos, coordenadas arredondadas para mm inteiro.${O.chapas ? '' : ' Sem número de chapas: o programa conta pela geometria.'}`);
          ctx.salvar(); pinta();
          ctx.avisa(`${n} pontos importados ${O.curto}. Coordenadas arredondadas para milímetro inteiro.${O.chapas ? '' : ' Esta origem não traz o número de chapas: vale a geometria.'} Agora use "Relacionar pontos às peças".`, { tipo: 'ok' });
        },
        async relacionar(b) {
          if (!s.importado) { ctx.avisa('Importe a lista de pontos primeiro: escolha a origem e use "Importar lista de pontos".', { tipo: 'aviso' }); return; }
          const sp = AE.calc.separacao({ proprio: true });
          const tres = sp.pontos.filter((p) => !p.by && p.chapasGeo > 2).length;
          const div = s.origemPontos === 'excel' ? sp.pontos.filter((p) => !p.by && p.chapasGeo !== p.chapasCliente).length : 0;
          if (!(await ctx.cad({
            titulo: 'Relacionar pontos às peças',
            catia: 'Set med = CATIA.ActiveDocument.GetWorkbench("SPAWorkbench")\nFor Each pt In pontos : For Each peca In pecas\n  d = med.GetMeasurable(refPonto).GetMinimumDistance(refPeca)\n  If d < 0.5 Then liga pt a peca   \' conta as chapas sobrepostas\nNext : Next',
            nx: 'var mm = workPart.MeasureManager;\nforeach (var pt in pontos) foreach (var corpo in corpos) {\n  var d = mm.NewDistance(unidade, MeasureManager.MeasureType.Minimum, pt, corpo);\n  if (d.Value < 0.5) ligar(pt, corpo);   // conta as chapas sobrepostas\n}',
            macro: '960_WeldSpotsAddPart (só referência)',
            resultado: `${sp.pontos.length} pontos ligados às peças. ${tres} com 3 chapas${s.origemPontos === 'excel' ? `, ${div} divergência(s) com a lista do cliente` : ''}.`,
          }, b))) return;
          s.relacionado = true; s.ponto = null;
          ctx.registrar(`Pontos relacionados às peças pela geometria: ${tres} com 3 chapas${s.origemPontos === 'excel' ? `, ${div} divergência(s) com o cliente` : ''}.`);
          ctx.salvar(); pinta();
          ctx.avisa(`Pontos ligados às peças pela geometria. ${tres} ponto(s) de 3 chapas${div ? ` e ${div} divergência(s) com a lista do cliente: decida em "Corrigir um ponto"` : ''}.`, { tipo: div ? 'aviso' : 'ok' });
        },
        async renum(b) {
          const t = AE.termos();
          const selEl = $('#sp-renum-sel', el);
          const x = selEl && s.subs.find((k) => k.id === +selEl.value);
          if (!x) { ctx.avisa('Crie uma subdivisão antes de trocar o número.', { tipo: 'aviso' }); return; }
          const v = await ctx.perguntar({ titulo: `Trocar o número da ST${x.st}`, texto: `${x.nome} (id interno ${x.id}). Digite só o número novo, por exemplo 110. O id interno não muda.`, campo: 'Número novo da estação', valor: '', extra: 'inputmode="numeric" pattern="[0-9]{1,4}" autocomplete="off"', ok: 'Trocar número' });
          if (v == null) return;
          if (!/^\d{1,4}$/.test(v) || +v === 0) { ctx.avisa('Use só números inteiros, de 1 a 9999 (ex.: 110). Nada foi trocado.', { tipo: 'erro' }); return; }
          const novo = +v, antigo = x.st;
          if (novo === antigo) { ctx.avisa(`A estação já é a ST${antigo}. Nada foi trocado.`); return; }
          const outra = s.subs.find((k) => k !== x && k.st === novo);
          if (outra) { ctx.avisa(`A ST${novo} já é de "${outra.nome}". Escolha outro número.`, { tipo: 'erro' }); return; }
          const docs = x.pecas.length + 3;
          if (!(await ctx.cad({
            titulo: `Trocar ST${antigo} por ST${novo}`,
            catia: `For Each doc In documentosDaEstacao\n  doc.Product.PartNumber = Replace(doc.Product.PartNumber, "ST${antigo}", "ST${novo}")\nNext\n' atributo ESTACAO = ${novo} (id interno ${x.id} não muda)`,
            nx: `foreach (var c in componentesDaEstacao) {\n  c.SetUserAttribute("ESTACAO", -1, "${novo}", Update.Option.Now);\n  renomear(c, "ST${antigo}", "ST${novo}");   // id interno ${x.id} não muda\n}`,
            macro: 'RENAME_STATION_FIAT',
            resultado: `ST${antigo} → ST${novo} em ${docs} documentos (1 ${t.product}, ${x.pecas.length} ${t.part}, plano de pontos e folha de instrução).`,
          }, b))) return;
          x.st = novo;
          Object.values(s.correcoes).forEach((c) => { if (c.st === antigo) c.st = novo; });
          const txt = `ST${antigo} → ST${novo} · atualizado em ${docs} documentos`;
          reg('troca', txt);
          ctx.registrar(`${txt} (id interno ${x.id}).`);
          ctx.salvar(); pinta();
          ctx.avisa(`Estação ${antigo} agora é ${novo}. O número foi trocado em ${docs} documentos e a troca ficou registrada.`, { tipo: 'ok' });
        },
      };

      async function marcarChapas(v) {
        const p = R.pts.find((x) => x.n === s.ponto);
        if (!p) return;
        const c = (s.correcoes[p.n] = s.correcoes[p.n] || {});
        c.chapas = v;
        const quem = v === p.chapasGeo ? 'vale a geometria' : p.chapasCli === v ? 'vale o cliente' : 'valor do usuário';
        const txt = `${p.n}: ${v} chapas (${quem}) · geometria ${p.chapasGeo}${p.chapasCli != null ? `, cliente ${p.chapasCli}` : ''}`;
        reg('correcao', txt);
        ctx.registrar(`Ponto corrigido: ${txt}.`);
        ctx.salvar(); pinta();
        ctx.avisa(`${p.n}: vale ${v} chapas. Decisão registrada.${v > 2 ? ' Fica o alerta informativo de mais de 2 chapas.' : ''}`, { tipo: 'ok' });
      }

      el.addEventListener('click', async (e) => {
        /* peça no desenho */
        const pc = e.target.closest('[data-peca]');
        if (pc && s.aba <= 1) {
          const id = pc.dataset.peca;
          const sub = s.subs.find((x) => x.pecas.includes(id));
          if (s.by.includes(id)) { ctx.avisa(`A peça ${id} é BY. Para mudar, use "Desfazer BY" na aba 1.1.`); return; }
          if (sub) { ctx.avisa(`A peça ${id} já está na ST${sub.st}. Para mudar, desfaça a subdivisão na aba 1.2.`); return; }
          s.sel = s.sel.includes(id) ? s.sel.filter((x) => x !== id) : s.sel.concat(id);
          ctx.salvarUI(); svg(); acoes(); if (s.lido) lado();
          return;
        }
        /* ponto no desenho ou linha da tabela */
        const pt = e.target.closest('[data-pt]');
        if (pt && s.aba === 2) {
          s.ponto = s.ponto === pt.dataset.pt ? null : pt.dataset.pt;
          ctx.salvarUI();
          if (s.ponto && !R.pts.filter(filtrar).some((p) => p.n === s.ponto)) s.filtro = 'todos';
          svg(); pontos();
          if (s.ponto && pt.tagName !== 'TR') $('#sp-editor', el)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          return;
        }
        if (pt && s.aba === 3) { s.aba = 2; s.ponto = pt.dataset.pt; ctx.salvarUI(); pinta(); return; }
        /* filtro e origem */
        const fb = e.target.closest('[data-filtro]');
        if (fb) { s.filtro = fb.dataset.filtro; ctx.salvarUI(); pontos(); return; }
        const ob = e.target.closest('[data-origem]');
        if (ob) {
          s.origemEscolhida = ob.dataset.origem; ctx.salvarUI(); pontos();
          if (s.importado && s.origemEscolhida !== s.origemPontos) ctx.avisa(`Origem trocada para "${ORIGENS[s.origemEscolhida].nome}". Use "Importar de novo" para ler a lista desta origem.`);
          return;
        }
        const b = e.target.closest('[data-acao]');
        if (!b) return;
        const a = b.dataset.acao;
        if (a === 'aba') {
          s.aba = +b.dataset.aba; ctx.salvarUI(); pinta();
          if (!b.closest('#sp-abas')) $('#sp-abas', el).scrollIntoView({ block: 'start', behavior: 'smooth' });
          return;
        }
        if (a === 'limpar') { s.sel = []; ctx.salvarUI(); svg(); acoes(); lado(); return; }
        if (a === 'ir-import') { $('#sp-pontos', el).scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
        if (a === 'fechar-editor') { s.ponto = null; ctx.salvarUI(); svg(); pontos(); return; }
        if (a === 'corrigir') {
          if (!s.importado) { ctx.avisa('Importe e relacione os pontos antes de corrigir.', { tipo: 'aviso' }); return; }
          if (!s.relacionado) { ctx.avisa('Relacione os pontos às peças primeiro: a correção compara a geometria com a lista do cliente.', { tipo: 'aviso' }); return; }
          if (!s.ponto) {
            const d = R.pts.find((p) => p.sit === 'diverg');
            if (!d) { ctx.avisa('Edição liberada. Clique no ponto que quer corrigir (na tabela ou no desenho).'); return; }
            s.ponto = d.n; s.filtro = 'alertas'; ctx.salvarUI(); svg(); pontos();
            ctx.avisa(`Aberto o primeiro ponto com divergência: ${d.n}.`);
          }
          $('#sp-editor', el)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          return;
        }
        if (a === 'chapas') { marcarChapas(+b.dataset.v); return; }
        if (a === 'chapas-outro') {
          const v = await ctx.perguntar({ titulo: `Chapas no ponto ${s.ponto}`, texto: 'Quantas chapas este ponto une? Use um número inteiro de 1 a 5.', campo: 'Número de chapas', tipo: 'number', extra: 'min="1" max="5" step="1"', ok: 'Gravar' });
          if (v == null) return;
          const n = Number(v);
          if (!Number.isInteger(n) || n < 1 || n > 5) { ctx.avisa('Use um número inteiro de 1 a 5. Nada foi gravado.', { tipo: 'erro' }); return; }
          marcarChapas(n); return;
        }
        if (a === 'desfazer-correcao') {
          const n = s.ponto; if (!n || !s.correcoes[n]) return;
          delete s.correcoes[n];
          reg('correcao', `${n}: correção desfeita, volta a valer o cálculo do programa`);
          ctx.registrar(`Correção do ponto ${n} desfeita.`);
          ctx.salvar(); pinta();
          ctx.avisa(`Correção de ${n} desfeita.`); return;
        }
        if (a === 'conferir') { pinta(); ctx.avisa(R.ruins.length ? `Checagem refeita: ${R.ruins.length} item(ns) em vermelho.` : 'Checagem refeita: tudo certo.', { tipo: R.ruins.length ? 'aviso' : 'ok' }); return; }
        if (a === 'concluir') {
          pinta();
          if (R.ruins.length) {
            const r = R.ruins[0];
            ctx.avisa(`Ainda há ${R.ruins.length} item(ns) pendente(s). Primeiro: ${r.t.toLowerCase()} (${r.falha}). Use "Resolver" na checagem.`, { tipo: 'erro' });
            return;
          }
          const sp = R.sp;
          ctx.concluir({
            registro: `Separação concluída: ${sp.subs.length} subdivisões (${sp.subs.map((x) => 'ST' + x.st).join(', ')}), ${R.noCiclo} pontos no ciclo, ${R.nBy} em BY, ${R.juncao} na junção ST${sp.stJuncao}`,
            mensagem: `Separação gravada: ${sp.subs.length} subdivisões e ${R.noCiclo} pontos no ciclo. Próximo: tempos padrão.`,
          });
          return;
        }
        if (acoesCad[a]) await acoesCad[a](b);
      });

      el.addEventListener('change', (e) => {
        if (e.target.id !== 'sp-st-ponto') return;
        const p = R.pts.find((x) => x.n === s.ponto);
        if (!p) return;
        const v = e.target.value;
        const c = (s.correcoes[p.n] = s.correcoes[p.n] || {});
        if (v === '') delete c.st; else c.st = +v;
        if (!c.st && !c.chapas) delete s.correcoes[p.n];
        const txt = v === '' ? `${p.n}: estação volta à regra automática` : `${p.n}: movido para a ST${v}`;
        reg('correcao', txt);
        ctx.registrar(`Ponto corrigido: ${txt}.`);
        ctx.salvar(); pinta();
        ctx.avisa(`${txt}. Correção registrada.`, { tipo: 'ok' });
      });
    },
  });
})();
