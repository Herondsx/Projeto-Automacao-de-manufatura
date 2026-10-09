/* Passo 4 · Necessidade de estações (Processo)
   Tela nova (passo "4" do fluxo da v0). O cálculo está em AE.calc.estacoes() (dados.js): esta tela
   explica a conta, mostra o tempo de cada estação contra o ciclo e deixa ajustar o máximo de robôs
   por estação e os robôs de cada estação (ajuste à mão, registrado).
   Fatia (contrato, lida por AE.calc.estacoes): {maxRobos, ajustes:{'ST10':{robos}}, geoPorJuncao}. */
(function () {
  'use strict';
  const AE = window.AE;
  const { $, $$, esc, fmt, clone } = AE.util;

  const TIPO = {
    sub: ['Subconjunto', 'info', 'Estação de subconjunto: o operador carrega as peças da subdivisão do Passo 1 e os robôs soldam.'],
    juncao: ['Junção', 'roxo', 'Estação de junção (geometria): junta os subconjuntos. Os pontos de geometria ficam nela.'],
    respot: ['Respot', 'neutro', 'Estação de respot: recebe os pontos que não couberam na estação de origem. Os pontos de geometria nunca saem da origem.'],
  };
  /* partes do tempo de uma estação, na ordem do gráfico */
  const PARTES = [
    ['transf', 'Transferência', 'Transferência do produto entre estações (Passo 2).'],
    ['carga', 'Carga manual', 'Carga das peças pelo operador: peças da subdivisão × tempo MTM de carga (Passo 2).'],
    ['disp', 'Grampos', 'Fechar e abrir os grampos do dispositivo (Passo 2).'],
    ['seg', 'Folga do robô', 'Folga do robô para entrar e sair da zona (Passo 2).'],
    ['solda', 'Solda', 'Pontos do robô mais carregado × tempo por ponto (solda + aproximação).'],
  ];
  const MAX_INPUT = 12;
  let aoRedimensionar = null;

  const ocupacao = (e) => (e.capacidade > 0 ? e.nPontos / e.capacidade : e.nPontos ? Infinity : 0);
  const clsOcup = (o) => (o > 1 ? 'erro' : o >= 0.95 ? 'aviso' : '');
  const pctTxt = (o) => (isFinite(o) ? Math.round(o * 100) + '%' : '—');
  const geoDe = (e) => e.pontos.filter((p) => p.geometria).length;
  const nomePeca = (id) => { const p = AE.dados.produto.pecas.find((x) => x.id === id); return p ? `${id} · ${p.nome}` : id; };
  /* robôs mínimos para a estação caber no ciclo (Infinity se nem um ponto cabe) */
  const robosNecessarios = (e) => (e.porRobo >= 1 ? Math.ceil(e.nPontos / e.porRobo) : Infinity);

  function situacao(e, ee) {
    if (e.robos > ee.maxRobos)
      return { ok: false, cls: 'erro', txt: 'Acima do máximo', tip: `A estação está com ${e.robos} robôs e o máximo por estação é ${ee.maxRobos}. Use as opções do cartão "Estação que não dá o ciclo".` };
    if (e.porRobo < 1)
      return { ok: false, cls: 'erro', txt: 'Não fecha', tip: `O tempo disponível (${fmt(e.disponivel, 1)} s) não cabe nem um ponto (${fmt(ee.tPonto, 1)} s). Diminua a carga manual ou reveja o ciclo.` };
    if (!e.ok)
      return { ok: false, cls: 'erro', txt: 'Não fecha', tip: `${e.nPontos} pontos para uma capacidade de ${e.capacidade} (${e.robos} robôs × ${e.porRobo} pontos). Faltam ${e.nPontos - e.capacidade} pontos.` };
    if (e.dividida)
      return { ok: true, cls: 'info', txt: 'Fecha · gerou respot', tip: `Com o máximo de ${ee.maxRobos} robôs não cabiam todos os pontos. Os pontos de geometria ficaram aqui e o que sobrou foi para a estação de respot.` };
    return { ok: true, cls: 'ok', txt: 'Fecha', tip: `Cabe no ciclo: ${e.nPontos} pontos para uma capacidade de ${e.capacidade}.` };
  }

  /* calcula AE.calc.estacoes() com uma fatia alterada, sem gravar nada (para mostrar o efeito de uma opção) */
  function simular(mudar) {
    const t = AE.estado.t;
    const tinha = Object.prototype.hasOwnProperty.call(t, 'estacoes');
    const antes = t.estacoes;
    const copia = clone(antes || { maxRobos: 4, ajustes: {}, geoPorJuncao: 2 });
    copia.ajustes = copia.ajustes || {};
    mudar(copia);
    t.estacoes = copia;
    try { return AE.calc.estacoes(); } finally { if (tinha) t.estacoes = antes; else delete t.estacoes; }
  }

  /* ---------- gráfico: tempo de cada estação contra o ciclo ---------- */
  function svgBarras(ee, tp, W) {
    const est = ee.estacoes;
    const estreito = W < 560;
    const lab = estreito ? 62 : 110, dir = estreito ? 70 : 96, top = 34, alt = 24, vao = 16;
    const totais = est.map((e) => (isFinite(e.tempoTotal) ? e.tempoTotal : ee.ciclo * 1.3));
    const max = Math.max(ee.ciclo * 1.12, ...totais) * 1.02;
    const plotW = W - lab - dir;
    const x = (t) => lab + (Math.min(t, max) / max) * plotW;
    const H = top + est.length * (alt + vao) + 22;
    const passo = max > 120 ? 20 : estreito && max > 70 ? 20 : 10;
    let g = '';
    for (let t = 0; t <= max; t += passo) {
      g += `<line class="es-grade" x1="${x(t)}" x2="${x(t)}" y1="${top - 6}" y2="${H - 20}"/><text class="es-eixo" x="${x(t)}" y="${H - 6}" text-anchor="middle">${t}</text>`;
    }
    const linhas = est.map((e, i) => {
      const y = top + i * (alt + vao);
      const partes = { transf: tp.transferencia, carga: e.carga, disp: tp.dispositivo, seg: tp.seguranca, solda: isFinite(e.tempoSolda) ? e.tempoSolda : 0 };
      let ini = 0, r = '';
      PARTES.forEach(([k, nome]) => {
        const dur = partes[k];
        if (!dur) return;
        const fim = ini + dur;
        const tip = k === 'solda'
          ? `Solda: ${Math.ceil(e.nPontos / Math.max(1, e.robos))} pontos no robô mais carregado × ${fmt(ee.tPonto, 1)} s = ${fmt(dur, 1)} s`
          : `${nome}: ${fmt(dur, 1)} s`;
        const a = x(ini), b = x(Math.min(fim, ee.ciclo)), c = x(fim);
        if (ini < ee.ciclo) r += `<rect class="es-f-${k}" x="${a + 1}" y="${y}" width="${Math.max(0, b - a - 2)}" height="${alt}" rx="2" data-tip="${esc(`ST${e.st} · ${tip}`)}"/>`;
        if (fim > ee.ciclo) {
          const a2 = x(Math.max(ini, ee.ciclo));
          r += `<rect class="es-f-estouro" x="${a2 + 1}" y="${y}" width="${Math.max(0, c - a2 - 2)}" height="${alt}" rx="2" data-tip="${esc(`ST${e.st} · ${nome} passa do ciclo: estoura ${fmt(fim - Math.max(ini, ee.ciclo), 1)} s`)}"/>`;
        }
        ini = fim;
      });
      const total = isFinite(e.tempoTotal) ? `${fmt(e.tempoTotal, 1)} s` : 'sem robô';
      const estoura = isFinite(e.tempoTotal) && e.tempoTotal > ee.ciclo + 0.05;
      return `<g><text class="es-st" x="6" y="${y + 11}">ST${e.st}</text><text class="es-eixo" x="6" y="${y + 24}">${e.robos} robô${e.robos === 1 ? '' : 's'}</text>${r}
        <text class="es-total" x="${W - 6}" y="${y + 11}" text-anchor="end">${total}</text>
        <text class="${estoura ? 'es-estouro-txt' : 'es-eixo'}" x="${W - 6}" y="${y + 24}" text-anchor="end">${estoura ? `+${fmt(e.tempoTotal - ee.ciclo, 1)} s` : isFinite(e.tempoTotal) ? `folga ${fmt(ee.ciclo - e.tempoTotal, 1)} s` : ''}</text></g>`;
    }).join('');
    const xc = x(ee.ciclo);
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Tempo de cada estação comparado com o ciclo de ${fmt(ee.ciclo, 1)} segundos">
      ${g}${linhas}
      <line class="es-ciclo" x1="${xc}" x2="${xc}" y1="${top - 14}" y2="${H - 20}"/>
      <text class="es-ciclo-txt" x="${xc - 4}" y="${top - 18}" text-anchor="end">ciclo ${fmt(ee.ciclo, 1)} s</text>
    </svg>`;
  }

  /* ---------- diagrama: ordem de montagem ---------- */
  function quebra(txt, n) {
    const ps = String(txt).split(' '), out = [];
    let l = '';
    ps.forEach((p) => { if ((l + ' ' + p).trim().length > n && l) { out.push(l); l = p; } else l = (l + ' ' + p).trim(); });
    if (l) out.push(l);
    if (out.length > 2) { out.length = 2; out[1] = out[1].slice(0, Math.max(1, n - 1)) + '…'; }
    return out;
  }
  function entradasExtras(sep) {
    /* peças que entram direto numa estação: BY (chega soldado) e peças soltas */
    const mapa = {};
    const add = (pc, rotulo) => {
      const sts = sep.pontos.filter((p) => !p.by && p.st != null && p.pecas.includes(pc)).map((p) => p.st);
      if (!sts.length) return;
      const st = Math.min(...sts);
      (mapa[st] = mapa[st] || []).push(rotulo);
    };
    sep.by.forEach((pc) => add(pc, [`+ ${pc} chega soldado (BY)`, `+ ${pc} (BY)`]));
    sep.soltas.forEach((pc) => add(pc, [`+ peça solta ${pc}`, `+ solta ${pc}`]));
    return mapa;
  }
  function svgOrdem(ee, sep, W) {
    const est = ee.estacoes;
    if (!est.length) return '';
    const subs = est.filter((e) => e.tipo === 'sub');
    const juncs = est.filter((e) => e.tipo === 'juncao');
    const resp = est.filter((e) => e.tipo === 'respot');
    const respDe = (st) => resp.filter((r) => r.origem === st);
    const extras = entradasExtras(sep);
    /* níveis: subconjuntos → respot deles → junção → respot da junção → próxima junção… */
    const niveis = [];
    const nSub = subs.length;
    if (nSub) niveis.push({ nos: subs.map((e, j) => ({ e, j })), slots: nSub });
    const rs = [];
    subs.forEach((e, j) => respDe(e.st).forEach((r) => rs.push({ e: r, j })));
    if (rs.length) niveis.push({ nos: rs, slots: nSub });
    juncs.forEach((jn) => {
      niveis.push({ nos: [{ e: jn, j: 0 }], slots: 1 });
      const rj = respDe(jn.st);
      if (rj.length) niveis.push({ nos: rj.map((r, j) => ({ e: r, j })), slots: rj.length });
    });
    const colocados = new Set(niveis.flatMap((n) => n.nos.map((x) => x.e.st)));
    const sobra = est.filter((e) => !colocados.has(e.st));
    if (sobra.length) niveis.push({ nos: sobra.map((e, j) => ({ e, j })), slots: sobra.length });

    const horizontal = W >= 640;
    const pad = 12, maxSlots = Math.max(...niveis.map((n) => n.slots));
    const linhasExtra = Math.max(0, ...est.map((e) => (extras[e.st] || []).length));
    let boxW, boxH = 78 + linhasExtra * 15, H, pos = {};
    if (horizontal) {
      const colW = (W - pad * 2) / niveis.length;
      boxW = Math.min(230, colW - 44);
      const slotH = boxH + 22;
      H = pad * 2 + maxSlots * slotH;
      niveis.forEach((n, i) => {
        const cx = pad + colW * i + (colW - boxW) / 2;
        n.nos.forEach(({ e, j }) => {
          const yc = n.slots === maxSlots ? pad + slotH * (j + 0.5) : H / 2 + (j - (n.slots - 1) / 2) * slotH;
          pos[e.st] = { x: cx, y: yc - boxH / 2 };
        });
      });
    } else {
      const gapX = 12;
      boxW = Math.min(300, (W - pad * 2 - (maxSlots - 1) * gapX) / maxSlots);
      const rowH = boxH + 40;
      H = pad * 2 + niveis.length * rowH - 40;
      niveis.forEach((n, i) => {
        const y = pad + rowH * i;
        const largura = n.slots * boxW + (n.slots - 1) * gapX;
        const x0 = (W - largura) / 2;
        n.nos.forEach(({ e, j }) => { pos[e.st] = { x: x0 + j * (boxW + gapX), y }; });
      });
    }
    const chars = Math.max(10, Math.floor((boxW - 18) / 6.9));
    const cabeMono = (txt, px) => txt.length * px <= boxW - 18; // texto em fonte mono cabe na caixa?
    const ABREV = { sub: 'Sub.', juncao: 'Junção', respot: 'Respot' };
    /* ligações */
    const lig = [];
    subs.forEach((s) => {
      let fim = s;
      respDe(s.st).forEach((r) => { lig.push([fim, r]); fim = r; });
      if (juncs[0]) lig.push([fim, juncs[0]]);
    });
    juncs.forEach((jn, i) => {
      let fim = jn;
      respDe(jn.st).forEach((r) => { lig.push([fim, r]); fim = r; });
      if (juncs[i + 1]) lig.push([fim, juncs[i + 1]]);
    });
    const caminhos = lig.map(([a, b]) => {
      const pa = pos[a.st], pb = pos[b.st];
      if (!pa || !pb) return '';
      if (horizontal) {
        const x1 = pa.x + boxW, y1 = pa.y + boxH / 2, x2 = pb.x - 4, y2 = pb.y + boxH / 2, m = (x1 + x2) / 2;
        return `<path class="es-lig" d="M${x1} ${y1} C${m} ${y1} ${m} ${y2} ${x2} ${y2}" marker-end="url(#es-seta)"/>`;
      }
      const x1 = pa.x + boxW / 2, y1 = pa.y + boxH, x2 = pb.x + boxW / 2, y2 = pb.y - 4, m = (y1 + y2) / 2;
      return `<path class="es-lig" d="M${x1} ${y1} C${x1} ${m} ${x2} ${m} ${x2} ${y2}" marker-end="url(#es-seta)"/>`;
    }).join('');
    const caixas = est.map((e) => {
      const p = pos[e.st];
      if (!p) return '';
      const sit = situacao(e, ee);
      const nome = quebra(e.nome, chars);
      const ex = extras[e.st] || [];
      const tip = `ST${e.st} · ${e.nome}: ${TIPO[e.tipo][0].toLowerCase()}, ${e.robos} robôs, ${e.nPontos} pontos (${geoDe(e)} de geometria). ${sit.txt}.`;
      return `<g data-tip="${esc(tip)}">
        <rect class="es-caixa es-c-${e.tipo} ${sit.ok ? '' : 'es-c-falha'}" x="${p.x}" y="${p.y}" width="${boxW}" height="${boxH}" rx="7"/>
        <text class="es-cx-tit" x="${p.x + 9}" y="${p.y + 19}">${esc(cabeMono(`ST${e.st} · ${TIPO[e.tipo][0]}`, 8) ? `ST${e.st} · ${TIPO[e.tipo][0]}` : `ST${e.st} · ${ABREV[e.tipo]}`)}</text>
        ${nome.map((l, k) => `<text class="es-cx-nome" x="${p.x + 9}" y="${p.y + 36 + k * 14}">${esc(l)}</text>`).join('')}
        <text class="es-cx-num" x="${p.x + 9}" y="${p.y + 70}">${esc(cabeMono(`${e.robos} robôs · ${e.nPontos} pontos`, 7.3) ? `${e.robos} robô${e.robos === 1 ? '' : 's'} · ${e.nPontos} pontos` : `${e.robos} rob. · ${e.nPontos} pts`)}</text>
        ${ex.map((l, k) => `<text class="es-cx-by" x="${p.x + 9}" y="${p.y + 86 + k * 15}">${esc(cabeMono(l[0], 7) ? l[0] : l[1])}</text>`).join('')}
      </g>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Ordem de montagem: subconjuntos, junção e respot">
      <defs><marker id="es-seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="es-seta-p" d="M0 0L10 5L0 10z"/></marker></defs>
      ${caminhos}${caixas}</svg>`;
  }

  AE.tela({
    id: 'estacoes', sigla: '4', area: 'proc', rotulo: 'Passo 4', titulo: 'Necessidade de estações',
    resumo: 'Quantas estações e quantos robôs o ciclo exige, com a ordem de montagem. O programa propõe; você pode ajustar, e o ajuste fica registrado.',
    tip: 'Abre a tela que calcula quantas estações e quantos robôs o ciclo exige, e a ordem de montagem.',
    entradas: [
      { de: 'inicio', o: 'Tempo de ciclo do modelo mais exigente' },
      { de: 'separacao', o: 'Subdivisões e pontos de cada uma' },
      { de: 'tempos', o: 'Tempo por ponto e tempos fixos do ciclo' },
    ],
    inicial: () => ({ maxRobos: 4, ajustes: {}, geoPorJuncao: 2, sel: null }),
    programador: `
      <h3>O que esta tela guarda</h3>
      <ul>
        <li><code>maxRobos</code>: máximo de robôs por estação (padrão 4).</li>
        <li><code>ajustes</code>: robôs ajustados à mão, por estação: <code>{'ST10': {robos: 3}}</code>. Vale no lugar do calculado.</li>
        <li><code>geoPorJuncao</code>: pontos de geometria por junção quando ninguém definiu (regra de reserva: 2).</li>
        <li><code>sel</code>: estação aberta na conta (só tela).</li>
      </ul>
      <h3>Regras</h3>
      <ul>
        <li>Dimensiona pelo <b>menor ciclo adotado</b> do Passo 0 (modelo mais exigente).</li>
        <li>Tempo disponível = ciclo − transferência − grampos (fechar e abrir) − folga do robô − carga manual (peças da subdivisão × tempo MTM).</li>
        <li>Pontos por robô = disponível ÷ (solda + aproximação), arredondado para baixo.</li>
        <li>Robôs = pontos da estação ÷ pontos por robô, arredondado para cima.</li>
        <li>Passou do máximo de robôs: a estação fica com o máximo e com <b>todos</b> os pontos de geometria; o que sobra vai para uma estação de respot (próximo número, de 10 em 10).</li>
        <li>Pontos de geometria não definidos: usa o mínimo de 2 por junção.</li>
        <li>Sem estações definidas: o programa sugere a quantidade.</li>
        <li>Estações que não dão o ciclo: mostra as opções, mais robôs ou mais estações.</li>
        <li>Ajuste à mão fica registrado. O passo só conclui sem estação "não fecha".</li>
      </ul>
      <h3>Saída</h3>
      <ul>
        <li><code>AE.calc.estacoes()</code>: <code>ciclo</code>, <code>maxRobos</code>, <code>tPonto</code>, <code>estacoes[]</code> com robôs, pontos, capacidade e <code>ok</code>. Lida pelos Passos 5 (equipamentos), 6 (capacidade e macro ciclo), 7 (layout), pela Simulação e pela Mecânica.</li>
        <li><code>AE.calc.listaEstacoes()</code>: lista para os seletores das outras telas.</li>
      </ul>
      <h3>Macros de base</h3>
      <ul>
        <li><code>Part_2_Product</code> e <code>CreateAllCatPart</code> (do Passo 1): criar o Product de cada estação.</li>
        <li><code>RENAME_STATION_FIAT</code>: renomear por estação.</li>
      </ul>
      <h3>Em aberto</h3>
      <ul>
        <li>Quem define os pontos de geometria (usuário ou fabricante) e como entram? O protótipo usa as pontas de cada junção (2 por junção); <code>geoPorJuncao</code> é guardado, mas o cálculo ainda não lê esse número.</li>
        <li>Linha mista: dimensionar pelo modelo mais exigente (como agora) ou pelo volume somado dos modelos?</li>
        <li>Estação de respot que também passa do máximo: gera outro respot? Hoje ela aparece como "não fecha".</li>
        <li>Toda estação de subconjunto tem carga manual de todas as peças? Peça que chega por transportador não deveria contar o MTM.</li>
        <li>O tempo de transferência é o mesmo para todas as estações?</li>
        <li>Estações já definidas pelo cliente ou por vendas: como entram (número e conteúdo) para o programa comparar com o cálculo?</li>
      </ul>`,

    render(ctx) {
      const t = ctx.termos();
      const legenda = PARTES.map(([k, nome, tip]) => `<span data-tip="${esc(tip)}"><i class="${k}"></i>${esc(nome)}</span>`).join('') +
        '<span data-tip="Parte do tempo que passa da linha do ciclo."><i class="estouro"></i>Passa do ciclo</span><span data-tip="Tempo de ciclo do modelo mais exigente (Passo 0)."><i class="ciclo"></i>Linha do ciclo</span>';
      return `
      <div class="bloco">
        <h2>Quanto o ciclo permite</h2>
        <p class="sub">O programa parte do ciclo do modelo mais exigente, tira os tempos fixos de cada estação e vê quantos pontos cabem em cada robô.</p>
        <div id="es-kpis"></div>
        <h3 class="rotulo-sec">Regras aplicadas agora</h3>
        <div class="leitura" id="es-regras"></div>
      </div>

      <div class="bloco">
        <h2>Estações calculadas</h2>
        <p class="sub">Clique numa linha para ver a conta da estação. Os robôs podem ser ajustados à mão: o ajuste fica registrado e vale no lugar do calculado.</p>
        <div class="barra es-ctrl">
          <label class="campo es-max">Máximo de robôs por estação
            <input type="number" id="es-max" min="1" max="${MAX_INPUT}" step="1" data-tip="Quantos robôs cabem numa estação. Estação que precisar de mais fica com o máximo e o que sobra vai para uma estação de respot."></label>
          <button class="btn leve" id="es-voltar" data-tip="Apaga todos os ajustes de robôs feitos à mão e volta aos robôs calculados pelo programa. O máximo de robôs por estação não muda.">Voltar ao calculado</button>
          <button class="btn" id="es-cad" data-tip="Cria no ${esc(t.nome)} um ${esc(t.product)} para cada estação (ST10, ST20…), com as peças e os pontos de cada uma, na ordem de montagem.">Criar as estações no ${esc(t.nome)} <span class="cad-tag">CAD</span></button>
        </div>
        <div class="rolagem"><table id="es-tab">
          <thead><tr><th>ST</th><th>Estação</th><th class="num">Pontos</th><th class="num" data-tip="Ciclo menos os tempos fixos e a carga manual.">Tempo p/ soldar</th><th class="num" data-tip="Pontos que um robô solda no tempo disponível.">Pts/robô</th><th class="num">Robôs</th><th>Ocupação</th><th>Situação</th></tr></thead>
          <tbody></tbody><tfoot></tfoot>
        </table></div>
        <div id="es-orfaos"></div>
        <div id="es-conta"></div>
      </div>

      <div class="bloco">
        <h2>Tempo de cada estação contra o ciclo</h2>
        <p class="sub">Cada barra soma o que a estação gasta em um ciclo. O que sobra até a linha do ciclo é folga; o que passa dela aparece em vermelho.</p>
        <div class="cad es-graf" id="es-barras"></div>
        <div class="es-leg">${legenda}</div>
      </div>

      <div class="bloco" id="es-opcoes-bloco">
        <h2>Estação que não dá o ciclo</h2>
        <p class="sub">Regra do fluxo: quando uma estação não dá o ciclo, o programa mostra as opções, <b>mais robôs</b> ou <b>mais estações</b>, e o efeito de cada uma antes de aplicar.</p>
        <div id="es-opcoes"></div>
      </div>

      <div class="bloco">
        <h2>Ordem de montagem</h2>
        <p class="sub">Os subconjuntos são montados em paralelo e se juntam na estação de geometria. O respot vem logo depois da estação de origem.</p>
        <div class="cad es-graf" id="es-ordem"></div>
      </div>

      <div class="bloco">
        <h2>Checagem</h2>
        <p class="sub">O passo só conclui quando todas as estações dão o ciclo.</p>
        <div class="checagem" id="es-check"></div>
        <div class="barra fim" style="margin-top:14px">
          <button class="btn primario" id="es-concluir" data-tip="Confere se todas as estações dão o ciclo e, se sim, conclui o Passo 4: a quantidade de estações e de robôs passa para os Passos 5, 6 e 7.">Concluir o Passo 4</button>
        </div>
      </div>`;
    },

    montar(el, ctx) {
      const s = ctx.s;
      s.ajustes = s.ajustes || {};
      AE.css('estacoes', `
        .es-ctrl{margin-bottom:12px;align-items:flex-end}
        .es-max{max-width:220px}
        .es-max input{max-width:110px}
        #es-tab td small{display:block;color:var(--fraco);font-size:12px}
        #es-tab td.num small{display:inline;margin-left:4px}
        #es-tab .es-rob{display:flex;flex-direction:column;align-items:flex-end;gap:3px}
        #es-tab .es-tipo{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;margin-top:5px;font-size:12.5px;color:var(--suave)}
        #es-tab td:nth-child(2){min-width:180px}
        @media (max-width:640px){#es-tab td:nth-child(2){min-width:150px}}
        #es-tab .es-rob input{width:64px}
        #es-tab .es-rob .btn{padding:2px 7px;font-size:12px}
        #es-tab tr.ajustado td.num input{border-color:var(--roxo)}
        .es-oc{display:flex;align-items:center;gap:8px;min-width:120px}
        .es-oc .medidor{flex:1}
        .es-oc span{font-family:var(--f-dado);font-size:12.5px;color:var(--suave);min-width:38px;text-align:right}
        #es-conta{margin-top:14px}
        #es-conta .calc{max-width:560px}
        .es-graf{padding:8px 4px}
        .es-graf text{font-size:12px}
        .es-grade{stroke:var(--linha);stroke-width:1}
        .es-eixo{fill:var(--fraco)!important;font-size:11px!important}
        .es-st{fill:var(--texto)!important;font-weight:500}
        .es-total{fill:var(--texto)!important}
        .es-estouro-txt{fill:var(--erro)!important;font-size:11.5px!important}
        .es-ciclo{stroke:var(--texto);stroke-width:2;stroke-dasharray:5 4}
        .es-ciclo-txt{fill:var(--texto)!important}
        .es-f-transf{fill:var(--azul)} .es-f-carga{fill:var(--laranja)} .es-f-disp{fill:var(--fraco)} .es-f-seg{fill:var(--suave)} .es-f-solda{fill:var(--l-sim)} .es-f-estouro{fill:var(--erro)}
        .es-leg{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12.5px;color:var(--suave);margin-top:10px}
        .es-leg span{display:inline-flex;align-items:center;gap:6px}
        .es-leg i{width:12px;height:12px;border-radius:2px;display:inline-block}
        .es-leg i.transf{background:var(--azul)} .es-leg i.carga{background:var(--laranja)} .es-leg i.disp{background:var(--fraco)} .es-leg i.seg{background:var(--suave)} .es-leg i.solda{background:var(--l-sim)} .es-leg i.estouro{background:var(--erro)}
        .es-leg i.ciclo{width:2px;height:14px;border-radius:0;background:repeating-linear-gradient(var(--texto) 0 4px,transparent 4px 7px)}
        .es-caixa{fill:var(--painel);stroke-width:2}
        .es-c-sub{stroke:var(--azul)} .es-c-juncao{stroke:var(--roxo)} .es-c-respot{stroke:var(--suave);stroke-dasharray:6 4}
        .es-c-falha{stroke:var(--erro)!important;stroke-dasharray:none}
        .es-cx-tit{fill:var(--texto)!important;font-size:13px!important;font-weight:500}
        .es-cx-nome{fill:var(--suave)!important;font-size:12px!important;font-family:var(--f-texto)!important}
        .es-cx-num{fill:var(--l-sim)!important;font-size:12px!important}
        .es-cx-by{fill:var(--acao)!important;font-size:11.5px!important}
        .es-lig{fill:none;stroke:var(--suave);stroke-width:2}
        .es-seta-p{fill:var(--suave)}
        .es-falha{display:flex;flex-direction:column;gap:10px;background:var(--fundo);border:1px solid var(--linha);border-left:4px solid var(--erro);border-radius:8px;padding:12px}
        .es-falha + .es-falha{margin-top:12px}
        .es-falha > h3{font-family:var(--f-titulo);font-size:18px;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}
        .es-falha .cartao{background:var(--painel)}
        .es-falha .cartao p{margin:0;font-size:13.5px;color:var(--suave)}
        .es-efeito{font-size:13px;border-top:1px dashed var(--linha2);padding-top:6px;color:var(--texto)}
        .es-efeito b{font-weight:600}
        .es-falha .cartao .btn{align-self:flex-start;white-space:normal;text-align:left}`);

      const tp = () => AE.calc.tempos().porId;

      /* ---------- desenho por partes ---------- */
      const kpis = (ee) => {
        const pj = AE.calc.projeto(), sep = AE.calc.separacao(), t = tp();
        const alvo = pj.modelos.filter((m) => m.jph > 0).sort((a, b) => a.adotadoEfetivo - b.adotadoEfetivo)[0];
        const nBy = sep.pontos.filter((p) => p.by).length;
        const cont = (k) => ee.estacoes.filter((e) => e.tipo === k).length;
        const falhas = ee.estacoes.filter((e) => !situacao(e, ee).ok).length;
        $('#es-kpis', el).innerHTML = `<div class="kpis">
          <div class="kpi"><span>Ciclo de projeto</span><b>${fmt(ee.ciclo, 1)} s</b><small>${alvo ? esc(alvo.nome) + ' · ' : ''}Passo 0</small></div>
          <div class="kpi"><span>Tempo por ponto</span><b>${fmt(ee.tPonto, 1)} s</b><small>solda ${fmt(t.solda, 1)} + aproximação ${fmt(t.aproximacao, 1)} · Passo 2</small></div>
          <div class="kpi ${falhas ? 'erro' : ''}"><span>Estações</span><b>${ee.estacoes.length}</b><small>${cont('sub')} subconjunto · ${cont('juncao')} junção · ${cont('respot')} respot</small></div>
          <div class="kpi"><span>Robôs</span><b>${ee.totalRobos}</b><small>máximo de ${ee.maxRobos} por estação</small></div>
          <div class="kpi"><span>Pontos no ciclo</span><b>${ee.totalPontos}</b><small>${nBy ? `fora os ${nBy} do BY (chegam soldados)` : 'nenhum ponto de BY'}</small></div>
        </div>`;
        const geo = ee.estacoes.reduce((a, e) => a + geoDe(e), 0);
        const lay = pj.layoutBase !== 'zero' && pj.layoutCarregado;
        $('#es-regras', el).innerHTML = `
          <div><code>Geometria</code><span>Pontos de geometria não definidos: usa o mínimo de ${esc(s.geoPorJuncao || 2)} por junção (as pontas de cada junção). <b>${geo}</b> pontos de geometria nesta linha; eles nunca vão para o respot.</span></div>
          <div><code>Estações</code><span>${lay ? 'Layout de partida carregado no Passo 0: compare a quantidade de estações e robôs abaixo com a do DWG.' : 'Sem estações definidas pelo cliente ou por vendas: o programa sugere a quantidade.'}</span></div>
          <div><code>Ciclo</code><span>${falhas ? `<b style="color:var(--erro)">${falhas} estação${falhas > 1 ? 'ões' : ''} não dá${falhas > 1 ? 'o' : ''} o ciclo</b>: veja as opções (mais robôs ou mais estações) mais abaixo.` : 'Todas as estações dão o ciclo com os robôs atuais.'}</span></div>`;
      };

      const tabela = (ee) => {
        const sep = AE.calc.separacao();
        if (!ee.estacoes.length) {
          $('#es-tab tbody', el).innerHTML = `<tr><td colspan="8"><div class="vazio">Nenhum ponto no ciclo: todos os pontos estão em peças que chegam soldadas (BY) ou o produto ainda não tem subdivisões. Volte ao Passo 1 para separar o produto.</div></td></tr>`;
          $('#es-tab tfoot', el).innerHTML = '';
          return;
        }
        if (!ee.estacoes.some((e) => e.st === s.sel)) s.sel = (ee.estacoes.find((e) => !situacao(e, ee).ok) || ee.estacoes[0]).st;
        $('#es-tab tbody', el).innerHTML = ee.estacoes.map((e) => {
          const sit = situacao(e, ee), o = ocupacao(e), aj = s.ajustes['ST' + e.st];
          const sub = sep.subs.find((x) => x.st === e.st);
          const pecas = sub ? sub.pecas.filter((p) => !sep.by.includes(p)) : [];
          const nPecas = pecas.length;
          const detalhe = e.tipo === 'respot' ? `pontos que sobraram da ST${e.origem}` : sub ? `peças ${pecas.join(', ')}` : 'recebe os subconjuntos';
          return `<tr class="clicavel ${e.st === s.sel ? 'sel' : ''} ${aj ? 'ajustado' : ''}" data-st="${e.st}" data-tip="Clique para ver a conta da ST${e.st}.">
            <td class="mono">ST${e.st}</td>
            <td>${esc(e.nome)}<small>${esc(detalhe)}</small>
              <div class="es-tipo"><span class="pilula ${TIPO[e.tipo][1]}" data-tip="${esc(TIPO[e.tipo][2])}">${TIPO[e.tipo][0]}</span>
              <span data-tip="${esc(e.manual ? 'Estação manual: o operador carrega as peças. O tempo de carga (MTM do Passo 2) sai do tempo disponível para soldar.' : 'Estação automática: sem carga manual.')}">${e.manual ? `carga manual: ${nPecas} peça${nPecas === 1 ? '' : 's'}, ${fmt(e.carga, 1)} s` : 'sem carga manual'}</span></div></td>
            <td class="num">${e.nPontos}<small>(${geoDe(e)} geo)</small></td>
            <td class="num">${fmt(e.disponivel, 1)} s</td>
            <td class="num">${e.porRobo}</td>
            <td class="num"><div class="es-rob">
              <input type="number" min="1" max="${MAX_INPUT}" step="1" value="${e.robos}" data-robos="${e.st}" aria-label="Robôs da ST${e.st}"
                data-tip="${esc(`Robôs da ST${e.st}. Calculado: ${e.robosCalc}. Digite outro número para ajustar à mão; o ajuste fica registrado.`)}">
              ${aj ? `<button class="btn mini leve" data-volta="${e.st}" data-tip="${esc(`Apaga o ajuste à mão da ST${e.st} e volta aos ${e.robosCalc} robôs calculados.`)}">calc. ${e.robosCalc}</button>` : `<small>calc.</small>`}
            </div></td>
            <td><div class="es-oc" data-tip="${esc(`Pontos da estação ÷ capacidade dos robôs (${e.robos} × ${e.porRobo} = ${e.capacidade}).`)}"><div class="medidor ${clsOcup(o)}"><i style="width:${Math.min(100, isFinite(o) ? o * 100 : 100)}%"></i></div><span>${pctTxt(o)}</span></div></td>
            <td><span class="pilula ${sit.cls}" data-tip="${esc(sit.tip)}">${sit.txt}</span>${aj ? ' <span class="pilula roxo" data-tip="Robôs ajustados à mão. O ajuste está no registro do projeto.">à mão</span>' : ''}</td>
          </tr>`;
        }).join('');
        $('#es-tab tfoot', el).innerHTML = `<tr><td colspan="2">Total</td><td class="num">${ee.totalPontos}</td><td></td><td></td><td class="num">${ee.totalRobos}</td><td colspan="2"></td></tr>`;
        /* ajustes de estações que não existem mais (o respot sumiu ao mudar o máximo, por exemplo) */
        const sts = ee.estacoes.map((e) => 'ST' + e.st);
        const orf = Object.keys(s.ajustes).filter((k) => !sts.includes(k));
        $('#es-orfaos', el).innerHTML = orf.length
          ? `<div class="faixa-aviso amarela" style="margin-top:10px"><span>Ajuste guardado para ${orf.map(esc).join(', ')}, que não existe mais no cálculo. Ele não tem efeito.</span>
             <button class="btn mini" id="es-orf" data-tip="Apaga os ajustes de estações que não existem mais no cálculo.">Descartar ajuste antigo</button></div>` : '';
      };

      const conta = (ee) => {
        const e = ee.estacoes.find((x) => x.st === s.sel);
        if (!e) { $('#es-conta', el).innerHTML = ''; return; }
        const t = tp(), nPecas = e.manual ? Math.round(e.carga / (t.cargaManual || 1)) : 0;
        const resp = ee.estacoes.filter((r) => r.tipo === 'respot' && r.origem === e.st);
        const precisaria = e.porRobo >= 1 ? Math.ceil((e.nPontos + resp.reduce((a, r) => a + r.nPontos, 0)) / e.porRobo) : null;
        const aj = s.ajustes['ST' + e.st];
        $('#es-conta', el).innerHTML = `<h3 class="rotulo-sec">Conta da ST${e.st} · ${esc(e.nome)}</h3>
          <div class="calc">
            <span>Ciclo de projeto (Passo 0)</span><b>${fmt(ee.ciclo, 1)} s</b>
            <span>− Transferência entre estações</span><b>${fmt(t.transferencia, 1)} s</b>
            <span>− Fechar e abrir os grampos</span><b>${fmt(t.dispositivo, 1)} s</b>
            <span>− Folga do robô (entrar e sair da zona)</span><b>${fmt(t.seguranca, 1)} s</b>
            <span>− Carga manual${e.manual ? `: ${nPecas} peça${nPecas === 1 ? '' : 's'} × ${fmt(t.cargaManual, 1)} s (MTM)` : ' (estação automática)'}</span><b>${fmt(e.carga, 1)} s</b>
            <span class="total">= Tempo disponível para soldar</span><b class="total">${fmt(e.disponivel, 1)} s</b>
            <span>÷ Tempo por ponto (solda + aproximação)</span><b>${fmt(ee.tPonto, 1)} s</b>
            <span class="total">= Pontos por robô (arredonda para baixo)</span><b class="total">${e.porRobo}</b>
            <span>Pontos da estação (${geoDe(e)} de geometria)</span><b>${e.nPontos}</b>
            <span class="total">Robôs calculados = ${e.porRobo >= 1 ? `${e.nPontos} ÷ ${e.porRobo}, para cima` : 'nem um ponto cabe'}${e.dividida ? ' (limitado ao máximo)' : ''}</span><b class="total">${e.robosCalc}</b>
            ${aj ? `<span>Ajustado à mão</span><b style="color:var(--roxo)">${e.robos}</b>` : ''}
          </div>
          ${e.dividida && precisaria ? `<p class="nota">Precisaria de ${precisaria} robôs e o máximo é ${ee.maxRobos}: a ST${e.st} ficou com os ${geoDe(e)} pontos de geometria e mais o que cabe; ${resp.map((r) => `${r.nPontos} pontos foram para a ST${r.st} (respot)`).join(', ')}.</p>` : ''}
          ${e.tipo === 'respot' ? `<p class="nota">Estação de respot: não tem carga manual. Recebe só os pontos que não couberam na ST${e.origem}.</p>` : ''}`;
      };

      const barras = (ee) => {
        const box = $('#es-barras', el);
        box.innerHTML = ee.estacoes.length ? svgBarras(ee, tp(), Math.max(320, box.clientWidth - 8)) : '<div class="vazio">Sem estações para desenhar.</div>';
      };

      const opcoes = (ee) => {
        const falhas = ee.estacoes.filter((e) => !situacao(e, ee).ok);
        const box = $('#es-opcoes', el);
        if (!falhas.length) {
          box.innerHTML = `<p class="nota ok">Todas as estações dão o ciclo. Nada a escolher aqui.</p>
            <div class="vazio" style="margin-top:10px">Para ver as opções da regra funcionando, diminua os robôs de uma estação na tabela acima (por exemplo, a ST${ee.estacoes[0] ? ee.estacoes[0].st : 10} com um robô a menos).</div>`;
          return;
        }
        box.innerHTML = falhas.map((e) => {
          const sit = situacao(e, ee);
          const nec = robosNecessarios(e);
          const cards = [];
          /* opção A: mais robôs */
          if (isFinite(nec)) {
            const alvo = Math.max(nec, e.robos);
            const sobeMax = alvo > ee.maxRobos;
            const res = simular((f) => { f.ajustes['ST' + e.st] = { robos: alvo }; if (alvo > f.maxRobos) f.maxRobos = alvo; });
            const e2 = res.estacoes.find((x) => x.st === e.st);
            const fecha = res.estacoes.every((x) => situacao(x, res).ok);
            const txtBt = alvo > e.robos ? `Aplicar: ${alvo} robôs na ST${e.st} (+${alvo - e.robos})` : `Aplicar: máximo de ${alvo} robôs por estação`;
            cards.push(`<div class="cartao"><h3>Mais robôs</h3>
              <p>${alvo > e.robos ? `Põe ${alvo - e.robos} robô${alvo - e.robos > 1 ? 's' : ''} a mais na ST${e.st}: os pontos se dividem por mais robôs e a solda termina antes.` : `A estação já tem os robôs que precisa, mas passa do máximo de ${ee.maxRobos}. Sobe o máximo por estação para ${alvo}.`}
              ${sobeMax && alvo > e.robos ? ` O máximo por estação sobe para ${alvo}.` : ''}${alvo > 6 ? ' Atenção: mais de 6 robôs numa estação é difícil de acomodar no layout.' : ''}</p>
              <div class="es-efeito"><b>Efeito:</b> ${e2 ? `ST${e.st} com ${e2.robos} robôs, capacidade ${e2.capacidade} para ${e2.nPontos} pontos (${pctTxt(ocupacao(e2))}).` : ''} Linha: ${res.estacoes.length} estações, ${res.totalRobos} robôs. ${fecha ? '<span class="pilula ok">tudo fecha</span>' : '<span class="pilula erro">ainda há estação que não fecha</span>'}</div>
              <button class="btn" data-op="robo" data-st="${e.st}" data-alvo="${alvo}" data-tip="${esc(`Grava o ajuste da ST${e.st} para ${alvo} robôs${sobeMax ? ` e sobe o máximo por estação para ${alvo}` : ''}. Fica registrado.`)}">${txtBt}</button></div>`);
          }
          /* opção B: mais estações (respot) */
          if (e.tipo !== 'respot' && e.porRobo >= 1 && isFinite(nec) && nec > 1) {
            const novoMax = Math.max(1, Math.min(ee.maxRobos, e.robos, nec - 1));
            const res = simular((f) => { f.maxRobos = novoMax; delete f.ajustes['ST' + e.st]; });
            const e2 = res.estacoes.find((x) => x.st === e.st);
            const novas = res.estacoes.filter((x) => !ee.estacoes.some((y) => y.st === x.st));
            const fecha = res.estacoes.every((x) => situacao(x, res).ok);
            cards.push(`<div class="cartao"><h3>Mais estações</h3>
              <p>Limita a estação a ${novoMax} robô${novoMax > 1 ? 's' : ''} (o máximo por estação passa a ${novoMax}, para todas). Os pontos de geometria ficam na ST${e.st} e o que sobra vai para uma estação de respot.</p>
              <div class="es-efeito"><b>Efeito:</b> ${e2 ? `ST${e.st} fica com ${e2.robos} robôs e ${e2.nPontos} pontos (${geoDe(e2)} de geometria).` : ''}
                ${novas.length ? ` Nova${novas.length > 1 ? 's' : ''}: ${novas.map((n) => `ST${n.st} (${TIPO[n.tipo][0].toLowerCase()}, ${n.nPontos} pontos, ${n.robos} robô${n.robos > 1 ? 's' : ''})`).join(', ')}.` : ''}
                Linha: ${res.estacoes.length} estações, ${res.totalRobos} robôs. ${fecha ? '<span class="pilula ok">tudo fecha</span>' : '<span class="pilula erro">ainda há estação que não fecha</span>'}</div>
              <button class="btn" data-op="estacao" data-st="${e.st}" data-max="${novoMax}" data-tip="${esc(`Muda o máximo de robôs por estação para ${novoMax} e apaga o ajuste à mão da ST${e.st}, para o programa gerar a estação de respot. Fica registrado.`)}">Aplicar: máximo de ${novoMax} e respot</button></div>`);
          }
          /* sem tempo nem para um ponto */
          if (e.porRobo < 1) {
            cards.push(`<div class="cartao"><h3>Menos tempo fixo ou ciclo maior</h3>
              <p>O tempo disponível (${fmt(e.disponivel, 1)} s) não cabe nem um ponto (${fmt(ee.tPonto, 1)} s). Mais robôs ou mais estações não resolvem: é preciso tirar carga manual da estação (por exemplo, peça pré-montada ou mais um operador) ou rever o ciclo.</p>
              <div class="barra"><button class="btn" data-ir="tempos" data-tip="Abre o Passo 2 para rever os tempos fixos e o tempo de carga manual (MTM).">Rever tempos (Passo 2)</button>
              <button class="btn leve" data-ir="inicio" data-tip="Abre o Passo 0 para rever os volumes e o ciclo adotado.">Rever ciclo (Passo 0)</button></div></div>`);
          }
          return `<div class="es-falha"><h3>ST${e.st} · ${esc(e.nome)} <span class="pilula erro">${sit.txt}</span></h3>
            <small style="color:var(--suave)">${esc(sit.tip)}</small>
            <div class="cartoes">${cards.join('') || '<div class="vazio">Nenhuma opção automática para esta estação. Ajuste os robôs à mão na tabela.</div>'}</div></div>`;
        }).join('');
      };

      const ordem = (ee) => {
        const box = $('#es-ordem', el);
        box.innerHTML = ee.estacoes.length ? svgOrdem(ee, AE.calc.separacao(), Math.max(320, box.clientWidth - 8)) : '<div class="vazio">Sem estações: separe o produto no Passo 1.</div>';
      };

      const checagem = (ee) => {
        const falhas = ee.estacoes.filter((e) => !situacao(e, ee).ok);
        const acima = ee.estacoes.filter((e) => e.robos > ee.maxRobos);
        const nAj = Object.keys(s.ajustes).filter((k) => ee.estacoes.some((e) => 'ST' + e.st === k)).length;
        const itens = [
          ['Existe pelo menos uma estação com pontos', ee.estacoes.length > 0, 'Nenhuma estação: separe o produto no Passo 1', 'erro'],
          ['Toda estação dá o ciclo', falhas.length === 0, falhas.map((e) => 'ST' + e.st).join(', ') + ' não fecha', 'erro'],
          [`Robôs por estação dentro do máximo (${ee.maxRobos})`, acima.length === 0, acima.map((e) => 'ST' + e.st).join(', ') + ' acima do máximo', 'erro'],
          ['Pontos de geometria definidos', false, `Usando o mínimo de ${s.geoPorJuncao || 2} por junção`, 'aviso'],
          ['Ajustes à mão registrados', true, '', ''],
        ];
        $('#es-check', el).innerHTML = itens.map((i, k) => `<div><span>${esc(i[0])}</span>${k === 4
          ? `<span class="pilula ${nAj ? 'roxo' : 'neutro'}" data-tip="Ajustes de robôs feitos à mão. Cada um está no registro do projeto.">${nAj ? nAj + ' ajuste' + (nAj > 1 ? 's' : '') + ' à mão' : 'nenhum ajuste'}</span>`
          : i[1] ? '<span class="pilula ok">Certo</span>' : `<span class="pilula ${i[3]}">${esc(i[2])}</span>`}</div>`).join('');
        return itens.filter((i) => !i[1] && i[3] === 'erro');
      };

      const desenha = () => {
        const ee = AE.calc.estacoes();
        const foco = document.activeElement && el.contains(document.activeElement) && document.activeElement.dataset.robos;
        $('#es-max', el).value = ee.maxRobos;
        kpis(ee); tabela(ee); conta(ee); barras(ee); opcoes(ee); ordem(ee); checagem(ee);
        if (foco) { const i = $(`[data-robos="${foco}"]`, el); if (i) i.focus(); }
        return ee;
      };
      desenha();

      /* gráficos acompanham a largura (texto legível no celular) */
      if (aoRedimensionar) removeEventListener('resize', aoRedimensionar);
      let tmr, larg = innerWidth;
      aoRedimensionar = () => {
        if (!el.isConnected) { removeEventListener('resize', aoRedimensionar); aoRedimensionar = null; return; }
        if (innerWidth === larg) return;
        larg = innerWidth;
        clearTimeout(tmr);
        tmr = setTimeout(() => { const ee = AE.calc.estacoes(); barras(ee); ordem(ee); }, 150);
      };
      addEventListener('resize', aoRedimensionar);

      /* guarda um retrato da fatia para o "Desfazer" do aviso */
      const retrato = () => clone({ maxRobos: s.maxRobos, ajustes: s.ajustes });
      const desfazer = (antes, texto) => ({
        texto: 'Desfazer',
        fn: () => {
          s.maxRobos = antes.maxRobos; s.ajustes = antes.ajustes;
          ctx.salvar(); ctx.registrar('Desfeito: ' + texto); desenha();
          ctx.avisa('Desfeito. Voltou ao que estava antes.');
        },
      });

      /* máximo de robôs */
      $('#es-max', el).addEventListener('change', (e) => {
        const v = parseInt(e.target.value, 10);
        if (!(v >= 1 && v <= MAX_INPUT)) {
          ctx.avisa(`O máximo de robôs por estação tem de ser um número inteiro de 1 a ${MAX_INPUT}.`, { tipo: 'erro' });
          e.target.value = AE.calc.estacoes().maxRobos;
          return;
        }
        if (v === Number(s.maxRobos)) return;
        const antes = retrato(), de = s.maxRobos;
        s.maxRobos = v;
        ctx.salvar();
        const txt = `Máximo de robôs por estação: ${de} → ${v}`;
        ctx.registrar(txt);
        const ee = desenha();
        ctx.avisa(`${txt}. Agora são ${ee.estacoes.length} estações e ${ee.totalRobos} robôs.`, { acao: desfazer(antes, txt) });
      });

      /* robôs por estação (ajuste à mão) */
      el.addEventListener('change', (e) => {
        const inp = e.target.closest('[data-robos]');
        if (!inp) return;
        const st = Number(inp.dataset.robos), chave = 'ST' + st;
        const est = AE.calc.estacoes().estacoes.find((x) => x.st === st);
        if (!est) return;
        const v = parseInt(inp.value, 10);
        if (!(v >= 1 && v <= MAX_INPUT)) {
          ctx.avisa(`Robôs da ST${st}: digite um número inteiro de 1 a ${MAX_INPUT}. Para tirar a estação, mude a separação no Passo 1.`, { tipo: 'erro' });
          inp.value = est.robos;
          return;
        }
        if (v === est.robos) return;
        const antes = retrato();
        if (v === est.robosCalc) delete s.ajustes[chave]; else s.ajustes[chave] = { robos: v };
        ctx.salvar();
        const txt = `ST${st}: robôs ${est.robos} → ${v} (calculado ${est.robosCalc})${v === est.robosCalc ? ', voltou ao calculado' : ', ajuste à mão'}`;
        ctx.registrar(txt);
        s.sel = st;
        const ee = desenha();
        const novo = ee.estacoes.find((x) => x.st === st);
        const sit = novo ? situacao(novo, ee) : null;
        ctx.avisa(sit && !sit.ok ? `ST${st} com ${v} robôs não dá o ciclo. Veja as opções no cartão "Estação que não dá o ciclo".` : `${txt}.`, { tipo: sit && !sit.ok ? 'aviso' : '', acao: desfazer(antes, txt) });
      });

      el.addEventListener('click', async (e) => {
        /* voltar uma estação ao calculado */
        const bv = e.target.closest('[data-volta]');
        if (bv) {
          const st = Number(bv.dataset.volta), antes = retrato();
          delete s.ajustes['ST' + st];
          ctx.salvar();
          const txt = `ST${st}: ajuste à mão apagado, voltou ao calculado`;
          ctx.registrar(txt); desenha();
          ctx.avisa(txt + '.', { acao: desfazer(antes, txt) });
          return;
        }
        /* aplicar uma opção da regra */
        const bo = e.target.closest('[data-op]');
        if (bo) {
          const st = Number(bo.dataset.st), antes = retrato();
          let txt;
          if (bo.dataset.op === 'robo') {
            const alvo = Number(bo.dataset.alvo);
            const est = AE.calc.estacoes().estacoes.find((x) => x.st === st);
            const subiu = alvo > Number(s.maxRobos);
            if (subiu) s.maxRobos = alvo;
            if (est && alvo === est.robosCalc && !subiu) delete s.ajustes['ST' + st]; else s.ajustes['ST' + st] = { robos: alvo };
            txt = `Opção "mais robôs" aplicada: ST${st} com ${alvo} robôs${subiu ? `, máximo por estação subiu para ${alvo}` : ''}`;
          } else {
            const novoMax = Number(bo.dataset.max);
            s.maxRobos = novoMax;
            delete s.ajustes['ST' + st];
            txt = `Opção "mais estações" aplicada: máximo de ${novoMax} robôs por estação, ST${st} gera respot`;
          }
          ctx.salvar(); ctx.registrar(txt);
          s.sel = st;
          const ee = desenha();
          const falhas = ee.estacoes.filter((x) => !situacao(x, ee).ok).length;
          ctx.avisa(`${txt}. Agora: ${ee.estacoes.length} estações, ${ee.totalRobos} robôs${falhas ? `, ${falhas} ainda não fecha` : ', todas fecham'}.`, { tipo: falhas ? 'aviso' : 'ok', acao: desfazer(antes, txt) });
          return;
        }
        const bi = e.target.closest('[data-ir]');
        if (bi) { ctx.ir(bi.dataset.ir); return; }
        if (e.target.closest('#es-orf')) {
          const sts = AE.calc.estacoes().estacoes.map((x) => 'ST' + x.st);
          const fora = Object.keys(s.ajustes).filter((k) => !sts.includes(k));
          fora.forEach((k) => delete s.ajustes[k]);
          ctx.salvar(); ctx.registrar(`Ajustes antigos descartados: ${fora.join(', ')}`); desenha();
          ctx.avisa('Ajustes antigos descartados.');
          return;
        }
        /* selecionar linha para ver a conta */
        const tr = e.target.closest('#es-tab tbody tr[data-st]');
        if (tr && !e.target.closest('input,button')) {
          s.sel = Number(tr.dataset.st);
          ctx.salvarUI();
          $$('#es-tab tbody tr', el).forEach((x) => x.classList.toggle('sel', x === tr));
          conta(AE.calc.estacoes());
        }
      });

      /* voltar tudo ao calculado */
      $('#es-voltar', el).onclick = () => {
        const n = Object.keys(s.ajustes).length;
        if (!n) { ctx.avisa('Nenhum ajuste à mão: os robôs já são os calculados.'); return; }
        const antes = retrato();
        s.ajustes = {};
        ctx.salvar();
        const txt = `Robôs voltaram ao calculado (${n} ajuste${n > 1 ? 's' : ''} à mão apagado${n > 1 ? 's' : ''})`;
        ctx.registrar(txt);
        const ee = desenha();
        ctx.avisa(`${txt}. Agora: ${ee.estacoes.length} estações, ${ee.totalRobos} robôs.`, { acao: desfazer(antes, txt) });
      };

      /* criar as estações no CAD */
      $('#es-cad', el).onclick = async (e) => {
        const ee = AE.calc.estacoes(), t = ctx.termos();
        if (!ee.estacoes.length) { ctx.avisa('Não há estações para criar: separe o produto no Passo 1.', { tipo: 'erro' }); return; }
        const sts = ee.estacoes.map((x) => 'ST' + x.st);
        const ok = await ctx.cad({
          titulo: `Criar ${sts.length} estações na árvore do ${t.product}`,
          catia: `Set raiz = CATIA.ActiveDocument.Product\nFor Each st In Array(${sts.map((x) => '"' + x + '"').join(', ')})\n  Set est = raiz.Products.AddNewComponent("Product", st)\n  est.PartNumber = st\nNext\n' peças e pontos de cada subdivisão movidos para dentro da sua ST`,
          nx: `var b = workPart.AssemblyManager.CreateNewComponentBuilder();\nforeach (var st in new[] { ${sts.map((x) => '"' + x + '"').join(', ')} }) {\n  b.NewComponentName = st; b.Commit();\n}\nb.Destroy(); // peças e pontos movidos para a ST de cada subdivisão`,
          macro: 'Part_2_Product · RENAME_STATION_FIAT',
          resultado: `${sts.length} ${t.product}s criados (${sts.join(', ')}), com ${ee.totalPontos} pontos distribuídos. O respot recebe só os pontos.`,
        }, e.currentTarget);
        if (!ok) return;
        ctx.registrar(`Estações criadas no ${t.nome}: ${sts.join(', ')}`);
        ctx.avisa(`${sts.length} estações criadas no ${t.nome}, na ordem de montagem.`, { tipo: 'ok' });
      };

      /* concluir */
      $('#es-concluir', el).onclick = () => {
        const ee = AE.calc.estacoes();
        const ruins = checagem(ee);
        if (ruins.length) {
          const r = ruins[0];
          ctx.avisa(`Ainda não dá para concluir: ${r[2]}. ${r[0] === 'Toda estação dá o ciclo' || r[0].startsWith('Robôs') ? 'Use as opções do cartão "Estação que não dá o ciclo" ou ajuste os robôs na tabela.' : ''}`, { tipo: 'erro' });
          const ob = $('#es-opcoes-bloco', el);
          if (ob && ruins.some((x) => x[0] !== 'Existe pelo menos uma estação com pontos')) ob.scrollIntoView({ block: 'start', behavior: 'smooth' });
          return;
        }
        const nAj = Object.keys(s.ajustes).length;
        ctx.concluir({ registro: `Necessidade de estações: ${ee.estacoes.length} estações e ${ee.totalRobos} robôs (máximo ${ee.maxRobos} por estação${nAj ? `, ${nAj} ajuste${nAj > 1 ? 's' : ''} à mão` : ''})` });
      };
    },
  });
})();
