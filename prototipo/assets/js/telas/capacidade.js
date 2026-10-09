/* Passo 6 · Capacidade e macro ciclo (Processo), com a 6.1 · Cobertura do produto
   Tela nova (passos "6" e "6.1" do fluxo da v0) + o bloco "Checagem de cobertura do produto" que estava
   na tela Fluxo da v0. Lê AE.calc.capacidade() (robôs, capacidade e blocos do macro ciclo) e
   AE.calc.cobertura() (conteúdo do produto × equipamentos).
   Escreve em outras fatias só por ação explícita do usuário, com registro:
   - "Mais um robô": AE.fatia('estacoes').ajustes;
   - "Incluir o que falta": AE.fatia('equipamentos').itens.
   Fatia própria: {saidas:{'ST10':'dupla'}, cobertura:{conferida, hora, faltavam}, macro:{versao, hora}}. */
(function () {
  'use strict';
  const AE = window.AE;
  const { $, $$, esc, fmt, clone, espera, hora } = AE.util;

  const BLOCO = {
    transf: ['Transferência', 'Transf.'], manual: ['Carga manual', 'Carga'], disp: ['Grampos', 'Grampos'],
    seg: ['Saída do robô da zona', 'Saída'], solda: ['Solda', ''],
  };
  /* saídas da regra "não dá o ciclo" (v0, passo 6) */
  const SAIDAS = [
    ['estacionaria', 'Pinça estacionária', 'A pinça fica fixa no chão e um robô de manuseio leva a peça até ela. Serve para peça pequena com muitos pontos: parte dos pontos sai dos robôs de solda da estação.', 'Precisa de robô de manuseio com garra (payload da Mecânica) e de espaço no layout.'],
    ['dupla', 'Garra dupla', 'A garra pega duas peças de uma vez, ou carrega a próxima enquanto a anterior é soldada. Tira tempo de carga e de transferência do ciclo.', 'Garra maior e mais pesada: confira o payload no Passo 5.'],
    ['garraPinca', 'Garra com pinça', 'O robô que segura a peça com a garra também leva uma pinça e solda enquanto manuseia. Ganha capacidade de solda sem mais um robô na estação.', 'Garra mais pesada e acesso mais difícil: a Simulação confirma.'],
    ['robo', 'Mais um robô', 'Mais um robô de solda na estação: os pontos se dividem por mais um e a solda termina antes.', 'Muda o Passo 4 (ajuste registrado) e a lista de equipamentos do Passo 5.'],
  ];
  const NOME_SAIDA = Object.fromEntries(SAIDAS.map((x) => [x[0], x[1]]));
  const modeloCob = (tipo) => ({
    pinca: AE.dados.pincas[0].modelo, cola: 'Pedestal de cola com bomba', pino: 'Pistola de pinos com alimentador',
    mig: 'Tocha MIG com fonte', furacao: 'Unidade de furação',
  })[tipo] || 'Equipamento a definir';
  const OPS_EXTRA = { cola: 'Passar cola', pino: 'Aplicar pino', mig: 'Soldar MIG', furacao: 'Furar' };
  const numId = (id) => parseInt(String(id).replace(/\D/g, ''), 10) || 0;
  let aoRedimensionar = null;

  const clsOcup = (o) => (o > 1 ? 'erro' : o >= 0.95 ? 'aviso' : '');
  const pct = (o) => (isFinite(o) ? Math.round(o * 100) + '%' : '—');

  /* estação que não dá o ciclo: fim do macro ciclo passa do ciclo ou algum robô acima da capacidade */
  function falhas(cap) {
    return cap.estacoes.filter((ce) => !ce.ok || cap.robos.some((r) => r.st === ce.st && r.ocup > 1));
  }
  /* calcula capacidade com um ajuste de robôs na fatia do Passo 4, sem gravar (efeito da opção) */
  function simularRobo(st, robos) {
    const t = AE.estado.t;
    const tinha = Object.prototype.hasOwnProperty.call(t, 'estacoes');
    const antes = t.estacoes;
    const f = clone(antes || { maxRobos: 4, ajustes: {}, geoPorJuncao: 2 });
    f.ajustes = f.ajustes || {};
    f.ajustes['ST' + st] = { robos };
    if (robos > (Number(f.maxRobos) || 4)) f.maxRobos = robos;
    t.estacoes = f;
    try { return AE.calc.capacidade(); } finally { if (tinha) t.estacoes = antes; else delete t.estacoes; }
  }
  /* estação proposta para um item do produto que não tem equipamento (suposição: ver "Em aberto") */
  function propoe(c, ests) {
    if (!ests.length) return null;
    const jn = ests.find((e) => e.tipo === 'juncao');
    if (c.equip === 'furacao' || c.equip === 'pino') return (jn || ests[ests.length - 1]).st;
    if (c.equip === 'cola') return (ests[1] || ests[0]).st;
    return ests[0].st;
  }

  /* ---------- gráfico de Gantt do macro ciclo de uma estação ---------- */
  function svgGantt(ce, ciclo, max, W, tPonto) {
    const estreito = W < 560;
    const lab = estreito ? 44 : 92, dir = 12, top = 26, alt = 20, vao = 6;
    const linhas = [{ id: 'seq', nome: estreito ? 'Seq.' : 'Sequência' }].concat(ce.robos.map((r) => ({ id: r, nome: r.replace(/^ST\d+-/, '') })));
    const plotW = W - lab - dir;
    const x = (t) => lab + (Math.min(t, max) / max) * plotW;
    const H = top + linhas.length * (alt + vao) + 18;
    const passo = max > 120 ? 20 : estreito && max > 60 ? 20 : 10;
    let g = '';
    for (let t = 0; t <= max; t += passo) g += `<line class="cp-grade" x1="${x(t)}" x2="${x(t)}" y1="${top - 4}" y2="${H - 18}"/><text class="cp-eixo" x="${x(t)}" y="${H - 5}" text-anchor="middle">${t}</text>`;
    const rot = linhas.map((l, i) => `<text class="${i ? 'cp-rob' : 'cp-seq'}" x="4" y="${top + i * (alt + vao) + 14}">${esc(l.nome)}</text>`).join('');
    const blocos = ce.blocos.filter((b) => b.dur > 0).map((b) => {
      const li = b.tipo === 'solda' ? Math.max(1, linhas.findIndex((l) => l.id === b.robo)) : 0;
      const y = top + li * (alt + vao);
      const fim = b.ini + b.dur;
      const a = x(b.ini), m = x(Math.min(fim, ciclo)), c = x(fim);
      const nPts = b.tipo === 'solda' ? Math.round(b.dur / tPonto) : 0;
      const tip = `ST${ce.st} · ${b.op}: de ${fmt(b.ini, 1)} s a ${fmt(fim, 1)} s (${fmt(b.dur, 1)} s)${fim > ciclo + 0.05 ? ` · passa do ciclo em ${fmt(fim - Math.max(b.ini, ciclo), 1)} s` : ''}`;
      let r = '';
      if (b.ini < ciclo) r += `<rect class="cp-f-${b.tipo}" x="${a + 1}" y="${y}" width="${Math.max(1, m - a - 2)}" height="${alt}" rx="2" data-tip="${esc(tip)}"/>`;
      if (fim > ciclo + 0.05) { const a2 = x(Math.max(b.ini, ciclo)); r += `<rect class="cp-f-estouro" x="${a2 + 1}" y="${y}" width="${Math.max(1, c - a2 - 2)}" height="${alt}" rx="2" data-tip="${esc(tip)}"/>`; }
      const txt = b.tipo === 'solda' ? `${nPts} pts` : BLOCO[b.tipo] ? BLOCO[b.tipo][1] : '';
      if (txt && c - a > txt.length * 7 + 8) r += `<text class="cp-blt" x="${a + 5}" y="${y + 14}">${esc(txt)}</text>`;
      return r;
    }).join('');
    const xc = x(ciclo);
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(`Macro ciclo da ST${ce.st}: termina em ${fmt(ce.total, 1)} s, ciclo de ${fmt(ciclo, 1)} s`)}">
      ${g}${rot}${blocos}
      <line class="cp-ciclo" x1="${xc}" x2="${xc}" y1="${top - 12}" y2="${H - 18}"/>
      <text class="cp-ciclo-txt" x="${xc - 4}" y="${top - 14}" text-anchor="end">ciclo ${fmt(ciclo, 1)} s</text></svg>`;
  }

  AE.tela({
    id: 'capacidade', sigla: '6', area: 'proc', rotulo: 'Passo 6', titulo: 'Capacidade e macro ciclo',
    resumo: 'Quantos pontos cada robô e cada estação pode soldar, o macro ciclo de cada estação e a checagem de cobertura do produto (6.1).',
    tip: 'Abre a tela de capacidade por robô, macro ciclo e cobertura do produto. Quem escolhe os pontos é a Simulação.',
    entradas: [
      { de: 'inicio', o: 'Tempo de ciclo' },
      { de: 'tempos', o: 'Tempos padrão' },
      { de: 'estacoes', o: 'Estações e robôs' },
      { de: 'equipamentos', o: 'Equipamentos por estação' },
    ],
    inicial: () => ({ saidas: {}, cobertura: { conferida: false, hora: '', faltavam: 0 }, macro: { versao: 0, hora: '' } }),
    programador: `
      <h3>O que esta tela guarda</h3>
      <ul>
        <li><code>saidas</code>: saída escolhida para estudar em cada estação que não dá o ciclo (<code>{'ST10': 'dupla'}</code>): <code>estacionaria</code>, <code>dupla</code>, <code>garraPinca</code>.</li>
        <li><code>cobertura</code>: quando a cobertura foi conferida com o produto do CAD e quantos itens faltavam.</li>
        <li><code>macro</code>: versão (C1, C2…) e hora do último macro ciclo salvo na pasta.</li>
        <li>Escreve em outras fatias só por ação do usuário, com registro: <code>estacoes.ajustes</code> ("mais um robô") e <code>equipamentos.itens</code> ("incluir o que falta").</li>
      </ul>
      <h3>Regras</h3>
      <ul>
        <li>Capacidade do robô = pontos por robô do Passo 4. Ocupação = pontos ÷ capacidade.</li>
        <li>Macro ciclo da estação: transferência → carga manual → fechar grampos → solda (robôs em paralelo) → abrir grampos → saída do robô da zona. Estoura quando o fim passa do ciclo.</li>
        <li><b>O Processo diz a quantidade; quem escolhe quais pontos é a Simulação.</b> A divisão por igual é só para dimensionar; se a Simulação já distribuiu, vale a distribuição dela.</li>
        <li>Equipamento ainda sem definição: calcula com o tempo padrão da tabela e marca como conceito.</li>
        <li>Não dá o ciclo: mostra as saídas, pinça estacionária, garra dupla, garra com pinça, mais um robô.</li>
        <li>Cobertura (6.1): tabela <code>conteúdo do produto → equipamento + operação</code>, por projeto, que aceita novas linhas. Roda depois da capacidade e a cada revisão do produto.</li>
        <li>Produto pede algo que não tem equipamento: aponta a estação e propõe o equipamento que falta.</li>
        <li><b>Item sem cobertura impede a liberação do processo.</b></li>
      </ul>
      <h3>Saída</h3>
      <ul>
        <li><code>AE.calc.capacidade()</code>: <code>robos[]</code> (<code>id, st, cap, pontos, ocup</code>) e <code>estacoes[]</code> com os <code>blocos</code> do macro ciclo. Lida pela Simulação (S2: quantos pontos cabem em cada robô; S3: macro ciclo como referência) e pelo ciclograma (Passo 9).</li>
        <li><code>AE.calc.cobertura()</code>: <code>{item, exige, coberto, onde}</code> de cada coisa que o produto contém.</li>
      </ul>
      <h3>Macros de base</h3>
      <ul><li>Nenhuma na v0: é cálculo. O macro ciclo vai para a pasta <code>14.2.3.1_Ciclograma</code>.</li></ul>
      <h3>Em aberto</h3>
      <ul>
        <li>Operações além da solda (cola, pino, MIG, furação) ainda não somam tempo no macro ciclo. Elas correm em série ou em paralelo com a solda? A tabela do Passo 2 tem cola e pino, mas não MIG e furação.</li>
        <li>Como o programa sabe em que estação o produto pede cada item? Suposição do protótipo: furação e pinos na estação de geometria, cola na segunda estação, MIG na primeira.</li>
        <li>Pinça estacionária, garra dupla e garra com pinça: que números mudam no cálculo (tempo de carga, pontos por robô)? Hoje ficam só registradas como "a estudar com a Simulação".</li>
        <li>"Tem o equipamento mas não tem a operação": quem cadastra a operação de cada equipamento em cada estação?</li>
      </ul>`,

    render(ctx) {
      const leg = [['transf', 'Transferência'], ['manual', 'Carga manual'], ['disp', 'Grampos (fechar e abrir)'], ['solda', 'Solda, uma faixa por robô'], ['seg', 'Saída do robô da zona'], ['estouro', 'Passa do ciclo']]
        .map(([k, n]) => `<span><i class="${k}"></i>${esc(n)}</span>`).join('') + '<span><i class="ciclo"></i>Linha do ciclo</span>';
      return `
      <div class="bloco">
        <blockquote class="cp-frase" data-tip="Regra da v0 para o Passo 6: a capacidade é quantidade; a escolha de quais pontos vão em cada robô é da Simulação (S2).">O Processo diz a quantidade; quem escolhe quais pontos é a Simulação.</blockquote>
        <p class="sub" style="margin-top:10px">Esta tela diz quantos pontos cabem em cada robô e em cada estação, e monta o macro ciclo. A divisão dos pontos entre os robôs abaixo serve só para dimensionar.</p>
        <div id="cp-origem"></div>
        <div id="cp-kpis" style="margin-top:12px"></div>
      </div>

      <div class="bloco">
        <h2>Capacidade por robô</h2>
        <p class="sub">Capacidade = quantos pontos o robô solda dentro do tempo disponível da estação (Passo 4). Ocupação = pontos ÷ capacidade.</p>
        <div class="rolagem"><table id="cp-tab">
          <thead><tr><th>Robô</th><th class="num">Capacidade</th><th class="num">Pontos</th><th>Ocupação</th><th>Situação</th></tr></thead>
          <tbody></tbody><tfoot></tfoot></table></div>
      </div>

      <div class="bloco">
        <h2>Macro ciclo</h2>
        <p class="sub">Uma faixa para a sequência da estação e uma por robô na solda. Os robôs soldam em paralelo; a estação termina quando o robô mais carregado termina. Passe o mouse num bloco para ver os tempos.</p>
        <div class="cp-leg">${leg}</div>
        <div id="cp-gantt"></div>
      </div>

      <div class="bloco" id="cp-saidas-bloco">
        <h2>Estação que não dá o ciclo</h2>
        <p class="sub">Regra do fluxo: quando a estação não dá o ciclo, o programa mostra as saídas. "Mais um robô" muda o Passo 4 na hora; as outras ficam registradas para a Simulação estudar.</p>
        <div id="cp-saidas"></div>
      </div>

      <div class="bloco" id="cp-cob-bloco">
        <h2>6.1 · Checagem de cobertura do produto <span class="exemplo">dados de exemplo</span></h2>
        <p class="sub">Tudo o que o produto pede tem de existir no processo: o equipamento e a operação. O programa confere sozinho e mostra o que falta.</p>
        <div class="cp-cob" id="cp-cob"></div>
        <div class="barra" style="margin-top:12px">
          <button class="btn" id="cp-cob-conf" data-tip="Lê de novo o que o produto contém (pontos, cordões de cola, pinos, furos) e compara com a lista de equipamentos e com as operações de cada estação.">Conferir cobertura <span class="cad-tag">CAD</span></button>
          <button class="btn leve" id="cp-cob-add" data-tip="Inclui na lista de equipamentos (Passo 5) o primeiro item que falta, na estação onde a operação acontece. O programa propõe a estação e você confirma.">Incluir o que falta</button>
        </div>
        <div id="cp-cob-nota"></div>
      </div>

      <div class="bloco">
        <h2>Checagem</h2>
        <p class="sub">O processo só é liberado com tudo coberto e com toda estação dando o ciclo (ou com uma saída escolhida).</p>
        <div class="checagem" id="cp-check"></div>
        <div class="barra fim" style="margin-top:14px">
          <button class="btn leve" id="cp-salvar" data-tip="Grava o macro ciclo de todas as estações como planilha na pasta 14.2.3.1_Ciclograma do projeto, com versão de conceito (C1, C2…).">Salvar macro ciclo na pasta</button>
          <button class="btn primario" id="cp-concluir" data-tip="Confere a cobertura e o ciclo de cada estação e, se estiver tudo certo, conclui o Passo 6. A capacidade por robô segue para a Simulação.">Concluir o Passo 6</button>
        </div>
      </div>`;
    },

    montar(el, ctx) {
      const s = ctx.s;
      s.saidas = s.saidas || {};
      s.cobertura = s.cobertura || { conferida: false, hora: '', faltavam: 0 };
      s.macro = s.macro || { versao: 0, hora: '' };
      AE.css('capacidade', `
        .cp-frase{margin:0;border-left:4px solid var(--l-sim);background:var(--painel2);border-radius:6px;padding:12px 16px;font-family:var(--f-titulo);font-size:22px;font-weight:600;letter-spacing:.02em;line-height:1.25}
        #cp-tab tr.cp-grupo td{background:var(--painel2);border-bottom:1px solid var(--linha2);padding:8px}
        #cp-tab tr.cp-grupo b{font-family:var(--f-titulo);font-size:16px;font-weight:600;margin-right:8px}
        #cp-tab tr.cp-grupo small{color:var(--suave);font-size:12.5px;margin-right:8px}
        #cp-tab td small{color:var(--fraco);font-size:12px;margin-left:4px}
        .cp-oc{display:flex;align-items:center;gap:8px;min-width:130px}
        .cp-oc .medidor{flex:1}
        .cp-oc span{font-family:var(--f-dado);font-size:12.5px;color:var(--suave);min-width:38px;text-align:right}
        .cp-leg{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12.5px;color:var(--suave);margin-bottom:10px}
        .cp-leg span{display:inline-flex;align-items:center;gap:6px}
        .cp-leg i{width:12px;height:12px;border-radius:2px;display:inline-block}
        .cp-leg i.transf{background:var(--azul)} .cp-leg i.manual{background:var(--laranja)} .cp-leg i.disp{background:var(--fraco)} .cp-leg i.seg{background:var(--suave)} .cp-leg i.solda{background:var(--l-sim)} .cp-leg i.estouro{background:var(--erro)}
        .cp-leg i.ciclo{width:2px;height:14px;border-radius:0;background:repeating-linear-gradient(var(--texto) 0 4px,transparent 4px 7px)}
        .cp-est + .cp-est{margin-top:14px}
        .cp-est h3{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;margin-bottom:6px}
        .cp-est h3 small{font-family:var(--f-texto);font-size:13px;font-weight:400;color:var(--suave)}
        .cp-est .cad{padding:6px 4px}
        .cp-est .cad text{font-size:11.5px}
        .cp-ops{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:13px;color:var(--suave);margin-top:6px}
        .cp-grade{stroke:var(--linha);stroke-width:1}
        .cp-eixo{fill:var(--fraco)!important;font-size:10.5px!important}
        .cp-seq{fill:var(--suave)!important}
        .cp-rob{fill:var(--texto)!important}
        .cp-blt{fill:#071222!important;font-size:11px!important;font-weight:500}
        .cp-ciclo{stroke:var(--texto);stroke-width:2;stroke-dasharray:5 4}
        .cp-ciclo-txt{fill:var(--texto)!important}
        .cp-f-transf{fill:var(--azul)} .cp-f-manual{fill:var(--laranja)} .cp-f-disp{fill:var(--fraco)} .cp-f-seg{fill:var(--suave)} .cp-f-solda{fill:var(--l-sim)} .cp-f-estouro{fill:var(--erro)}
        .cp-falha{display:flex;flex-direction:column;gap:10px;background:var(--fundo);border:1px solid var(--linha);border-left:4px solid var(--erro);border-radius:8px;padding:12px}
        .cp-falha + .cp-falha{margin-top:12px}
        .cp-falha > h3{font-family:var(--f-titulo);font-size:18px;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}
        .cp-falha .cartao{background:var(--painel)}
        .cp-saida p{margin:0;font-size:13.5px;color:var(--suave)}
        .cp-saida .cuidado{font-size:12.5px;color:var(--fraco)}
        .cp-saida .btn{align-self:flex-start;white-space:normal;text-align:left}
        .cp-efeito{font-size:13px;border-top:1px dashed var(--linha2);padding-top:6px}
        .cp-cob{display:flex;flex-direction:column;gap:6px}
        .cp-cob > div{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1.6fr) auto;gap:10px;align-items:center;font-size:14px;padding:8px 10px;background:var(--fundo);border:1px solid var(--linha);border-radius:6px}
        .cp-cob > div.falta{border-color:rgba(255,107,107,.55)}
        .cp-cob span{color:var(--suave);font-size:13px}
        .cp-cob small{display:block;color:var(--fraco);font-size:12px}
        .cp-cob .acoes{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;align-items:center}
        @media (max-width:640px){.cp-cob > div{grid-template-columns:minmax(0,1fr)}.cp-cob .acoes{justify-content:flex-start}.cp-frase{font-size:19px}}`);

      /* ---------- desenho ---------- */
      const origem = (cap) => {
        const simD = AE.estado.t.simulacao && AE.estado.t.simulacao.distribuicao;
        const eqConceito = ctx.origem('equipamentos') !== 'tela';
        $('#cp-origem', el).innerHTML = `<div class="barra">
          ${simD ? '<span class="pilula roxo" data-tip="A Simulação já distribuiu os pontos entre os robôs (S2). Os números abaixo usam a distribuição dela.">Pontos por robô: distribuição da Simulação</span>'
            : '<span class="pilula neutro" data-tip="A Simulação ainda não distribuiu os pontos. O programa divide por igual entre os robôs da estação, só para dimensionar.">Pontos por robô: divisão provisória, por igual</span>'}
          ${eqConceito ? '<span class="pilula aviso" data-tip="Regra do fluxo: equipamento ainda sem definição (Passo 5 não concluído). O macro ciclo usa os tempos padrão da tabela e fica como conceito.">Equipamentos sem definição: macro ciclo é conceito</span>' : '<span class="pilula ok">Equipamentos definidos no Passo 5</span>'}
          <span class="pilula info" data-tip="Ciclo de projeto do Passo 0 (modelo mais exigente).">Ciclo ${fmt(cap.ciclo, 1)} s</span></div>`;
      };

      const kpis = (cap) => {
        const capT = cap.robos.reduce((a, r) => a + r.cap, 0);
        const pts = cap.robos.reduce((a, r) => a + r.pontos.length, 0);
        const pior = cap.estacoes.slice().sort((a, b) => b.total / cap.ciclo - a.total / cap.ciclo)[0];
        const fl = falhas(cap).length;
        $('#cp-kpis', el).innerHTML = `<div class="kpis">
          <div class="kpi"><span>Robôs de solda</span><b>${cap.robos.length}</b><small>em ${cap.estacoes.length} estações · Passo 4</small></div>
          <div class="kpi"><span>Capacidade da linha</span><b>${capT}</b><small>pontos por ciclo, somando os robôs</small></div>
          <div class="kpi"><span>Pontos a soldar</span><b>${pts}</b><small>${capT ? `ocupação geral ${pct(pts / capT)}` : 'sem capacidade'}</small></div>
          <div class="kpi ${fl ? 'erro' : ''}"><span>Estação mais carregada</span><b>${pior ? 'ST' + pior.st : '—'}</b><small>${pior ? `${fmt(pior.total, 1)} s de ${fmt(cap.ciclo, 1)} s (${pct(pior.total / cap.ciclo)})` : 'sem estações'}</small></div>
        </div>`;
      };

      const tabela = (cap) => {
        const ee = AE.calc.estacoes();
        const tb = $('#cp-tab tbody', el);
        if (!cap.estacoes.length) {
          tb.innerHTML = '<tr><td colspan="5"><div class="vazio">Sem estações: o Passo 4 ainda não tem pontos no ciclo. Separe o produto no Passo 1.</div></td></tr>';
          $('#cp-tab tfoot', el).innerHTML = '';
          return;
        }
        tb.innerHTML = cap.estacoes.map((ce) => {
          const e = ee.estacoes.find((x) => x.st === ce.st) || {};
          const rs = cap.robos.filter((r) => r.st === ce.st);
          const capE = rs.reduce((a, r) => a + r.cap, 0), ptsE = rs.reduce((a, r) => a + r.pontos.length, 0);
          const falha = !ce.ok || rs.some((r) => r.ocup > 1);
          const cab = `<tr class="cp-grupo"><td colspan="5"><b>ST${ce.st}</b><small>${esc(ce.nome)}</small><small>${rs.length} robô${rs.length === 1 ? '' : 's'} × ${e.porRobo ?? '—'} pontos = ${capE} de capacidade · ${ptsE} pontos</small>
            ${falha ? `<span class="pilula erro" data-tip="${esc(`O macro ciclo da ST${ce.st} termina em ${fmt(ce.total, 1)} s e o ciclo é ${fmt(cap.ciclo, 1)} s. Veja as saídas mais abaixo.`)}">não dá o ciclo</span>` : `<span class="pilula ok" data-tip="${esc(`Termina em ${fmt(ce.total, 1)} s, dentro do ciclo de ${fmt(cap.ciclo, 1)} s.`)}">dá o ciclo</span>`}</td></tr>`;
          const linhas = rs.map((r) => {
            const sit = r.ocup > 1 ? ['erro', `acima em ${r.pontos.length - r.cap} ponto(s)`] : r.ocup >= 0.95 ? ['aviso', 'no limite'] : ['ok', `folga de ${r.cap - r.pontos.length} ponto(s)`];
            return `<tr><td class="mono">${esc(r.id)}</td><td class="num">${r.cap}</td><td class="num">${r.pontos.length}</td>
              <td><div class="cp-oc" data-tip="${esc(`${r.pontos.length} pontos ÷ ${r.cap} de capacidade.`)}"><div class="medidor ${clsOcup(r.ocup)}"><i style="width:${Math.min(100, r.ocup * 100)}%"></i></div><span>${pct(r.ocup)}</span></div></td>
              <td><span class="pilula ${sit[0]}" data-tip="${esc(sit[0] === 'aviso' ? 'Sem folga: a Simulação não tem margem para mover pontos para este robô.' : sit[0] === 'erro' ? 'O robô tem mais pontos do que cabe no tempo disponível.' : 'Cabe com folga.')}">${esc(sit[1])}</span></td></tr>`;
          }).join('');
          return cab + linhas;
        }).join('');
        const capT = cap.robos.reduce((a, r) => a + r.cap, 0), pts = cap.robos.reduce((a, r) => a + r.pontos.length, 0);
        $('#cp-tab tfoot', el).innerHTML = `<tr><td>Total · ${cap.robos.length} robôs</td><td class="num">${capT}</td><td class="num">${pts}</td><td colspan="2">${capT ? pct(pts / capT) + ' de ocupação geral' : ''}</td></tr>`;
      };

      const gantt = (cap) => {
        const box = $('#cp-gantt', el);
        if (!cap.estacoes.length) { box.innerHTML = '<div class="vazio">Sem estações para montar o macro ciclo.</div>'; return; }
        const tp = AE.calc.tempos().porId, tPonto = tp.solda + tp.aproximacao;
        const max = Math.max(cap.ciclo * 1.06, ...cap.estacoes.map((c) => c.total * 1.03));
        const W = Math.max(320, box.clientWidth - 10);
        const eq = AE.calc.equipamentos().itens;
        box.innerHTML = cap.estacoes.map((ce) => {
          const folga = cap.ciclo - ce.total;
          const ops = eq.filter((i) => Number(i.st) === ce.st && OPS_EXTRA[i.tipo]);
          const sd = s.saidas['ST' + ce.st];
          return `<div class="cp-est"><h3>ST${ce.st} <small>${esc(ce.nome)} · termina em ${fmt(ce.total, 1)} s</small>
            ${ce.ok ? `<span class="pilula ok">folga de ${fmt(folga, 1)} s</span>` : `<span class="pilula erro">estoura ${fmt(-folga, 1)} s</span>`}
            ${sd ? `<span class="pilula roxo" data-tip="Saída escolhida para estudar com a Simulação.">${esc(NOME_SAIDA[sd] || sd)}</span>` : ''}</h3>
            <div class="cad">${svgGantt(ce, cap.ciclo, max, W, tPonto)}</div>
            ${ops.length ? `<div class="cp-ops"><span>Outras operações nesta estação:</span>${ops.map((o) => `<span class="pilula aviso" data-tip="${esc(`${o.modelo}. O tempo desta operação ainda não entra no macro ciclo (em aberto: em série ou em paralelo com a solda).`)}">${esc(OPS_EXTRA[o.tipo])} · tempo a definir</span>`).join('')}</div>` : ''}</div>`;
        }).join('');
      };

      const saidas = (cap) => {
        const box = $('#cp-saidas', el);
        const fl = falhas(cap);
        const ee = AE.calc.estacoes();
        const cartoesInfo = SAIDAS.map(([k, n, o, c]) => `<div class="cartao cp-saida"><h3>${esc(n)}</h3><p>${esc(o)}</p><small class="cuidado">${esc(c)}</small></div>`).join('');
        if (!fl.length) {
          box.innerHTML = `<p class="nota ok">Todas as estações dão o ciclo. Nenhuma saída é necessária.</p>
            <details style="margin-top:10px"><summary style="cursor:pointer;color:var(--suave);font-size:14px">Ver as saídas da regra (para consulta)</summary>
              <div class="cartoes" style="margin-top:10px">${cartoesInfo}</div>
              <div class="barra" style="margin-top:10px"><span style="color:var(--fraco);font-size:13px">Para ver as saídas aplicadas, tire um robô de uma estação no Passo 4.</span>
              <button class="btn mini" data-ir="estacoes" data-tip="Abre o Passo 4, onde dá para ajustar os robôs de cada estação.">Abrir o Passo 4</button></div></details>`;
          return;
        }
        box.innerHTML = fl.map((ce) => {
          const e = ee.estacoes.find((x) => x.st === ce.st);
          const robos = e ? e.robos : ce.robos.length;
          const escolhida = s.saidas['ST' + ce.st];
          const sim = simularRobo(ce.st, robos + 1);
          const ce2 = sim.estacoes.find((x) => x.st === ce.st);
          const cards = SAIDAS.map(([k, n, o, c]) => {
            if (k === 'robo') {
              return `<div class="cartao cp-saida"><h3>${esc(n)}</h3><p>${esc(o)}</p><small class="cuidado">${esc(c)}</small>
                <div class="cp-efeito"><b>Efeito:</b> ${ce2 ? `ST${ce.st} com ${robos + 1} robôs termina em ${fmt(ce2.total, 1)} s ${ce2.ok ? '<span class="pilula ok">dá o ciclo</span>' : '<span class="pilula erro">ainda estoura</span>'}` : 'a estação muda de número no Passo 4; confira lá.'}</div>
                <button class="btn" data-maisrobo="${ce.st}" data-robos="${robos + 1}" data-tip="${esc(`Grava no Passo 4 o ajuste da ST${ce.st} para ${robos + 1} robôs. O Passo 4 volta a ficar em andamento e o ajuste fica registrado.`)}">Aplicar: ${robos + 1} robôs na ST${ce.st}</button></div>`;
            }
            const sel = escolhida === k;
            return `<div class="cartao cp-saida ${sel ? 'sel' : ''}"><h3>${esc(n)} ${sel ? '<span class="pilula roxo">escolhida</span>' : ''}</h3><p>${esc(o)}</p><small class="cuidado">${esc(c)}</small>
              ${sel ? `<button class="btn leve" data-saida="" data-st="${ce.st}" data-tip="Desfaz a escolha desta saída para a ST${ce.st}.">Desfazer escolha</button>`
                : `<button class="btn" data-saida="${k}" data-st="${ce.st}" data-tip="${esc(`Registra "${n}" como a saída a estudar na ST${ce.st}. A Simulação confirma; o macro ciclo fica como conceito até lá.`)}">Escolher para estudar</button>`}</div>`;
          }).join('');
          return `<div class="cp-falha"><h3>ST${ce.st} · ${esc(ce.nome)} <span class="pilula erro">termina em ${fmt(ce.total, 1)} s · ciclo ${fmt(cap.ciclo, 1)} s</span></h3>
            <div class="cartoes">${cards}</div></div>`;
        }).join('');
      };

      const cobertura = () => {
        const cob = AE.calc.cobertura();
        const ests = AE.calc.estacoes().estacoes;
        $('#cp-cob', el).innerHTML = cob.map((c) => {
          if (c.coberto) {
            return `<div><b style="font-weight:600">${esc(c.item)}<small>${esc(c.qtd)}</small></b><span>${esc(c.exige)}<small>Operação "${esc(c.op)}" em ${esc(c.onde.join(', '))}</small></span>
              <div class="acoes"><span class="pilula ok" data-tip="${esc(`Existe ${c.equip === 'pinca' ? 'pinça' : 'equipamento'} para este item em ${c.onde.join(', ')}.`)}">Coberto · ${esc(c.onde.join(', '))}</span></div></div>`;
          }
          const st = propoe(c, ests);
          return `<div class="falta"><b style="font-weight:600">${esc(c.item)}<small>${esc(c.qtd)}</small></b><span>${esc(c.exige)}<small>${st ? `Proposta: incluir na ST${st}` : 'Sem estações para propor'}</small></span>
            <div class="acoes"><span class="pilula erro" data-tip="O produto tem este item, mas o processo não tem o equipamento ou a operação. Enquanto estiver assim, o processo não é liberado.">Sem equipamento</span>
            ${st ? `<button class="btn mini" data-incluir="${esc(c.id)}" data-tip="${esc(`Inclui ${modeloCob(c.equip).toLowerCase()} na lista de equipamentos (Passo 5), na estação que você confirmar (proposta: ST${st}).`)}">Incluir</button>` : ''}</div></div>`;
        }).join('');
        const f = cob.filter((c) => !c.coberto).length;
        $('#cp-cob-nota', el).innerHTML = `<p class="nota ${f ? 'erro' : 'ok'}">${f ? `${f} item(ns) do produto sem equipamento no processo: o processo não é liberado até ficar tudo coberto.` : 'Tudo o que o produto pede existe no processo.'}
          ${s.cobertura.conferida ? ` Conferida com o produto do CAD às ${esc(s.cobertura.hora)}.` : ' Ainda não conferida com o produto aberto no CAD.'}</p>`;
        return cob;
      };

      const checagem = (cap) => {
        const cob = AE.calc.cobertura();
        const sem = cob.filter((c) => !c.coberto);
        const fl = falhas(cap);
        const semSaida = fl.filter((ce) => !s.saidas['ST' + ce.st]);
        const comSaida = fl.filter((ce) => s.saidas['ST' + ce.st]);
        const itens = [
          ['Existe estação com robôs', cap.estacoes.length > 0, 'Sem estações no Passo 4', 'erro'],
          ['Toda estação dá o ciclo', semSaida.length === 0, semSaida.map((c) => 'ST' + c.st).join(', ') + ' não dá o ciclo', 'erro'],
          ['Saídas a estudar com a Simulação', comSaida.length === 0, comSaida.map((c) => `ST${c.st}: ${NOME_SAIDA[s.saidas['ST' + c.st]]}`).join(', '), 'aviso'],
          ['Tudo o que o produto pede tem equipamento (6.1)', sem.length === 0, sem.map((c) => c.item).join(', ') + ' sem equipamento', 'erro'],
          ['Cobertura conferida com o produto do CAD', !!s.cobertura.conferida, 'Use "Conferir cobertura"', 'aviso'],
          ['Equipamentos definidos (Passo 5)', ctx.origem('equipamentos') === 'tela', 'Conceito: usa os tempos padrão', 'aviso'],
        ];
        $('#cp-check', el).innerHTML = itens.map((i) => `<div><span>${esc(i[0])}</span>${i[1] ? '<span class="pilula ok">Certo</span>' : `<span class="pilula ${i[3]}">${esc(i[2])}</span>`}</div>`).join('');
        return itens.filter((i) => !i[1] && i[3] === 'erro');
      };

      const desenha = () => {
        const cap = AE.calc.capacidade();
        origem(cap); kpis(cap); tabela(cap); gantt(cap); saidas(cap); cobertura(); checagem(cap);
        return cap;
      };
      desenha();

      if (aoRedimensionar) removeEventListener('resize', aoRedimensionar);
      let tmr, larg = innerWidth;
      aoRedimensionar = () => {
        if (!el.isConnected) { removeEventListener('resize', aoRedimensionar); aoRedimensionar = null; return; }
        if (innerWidth === larg) return;
        larg = innerWidth;
        clearTimeout(tmr);
        tmr = setTimeout(() => gantt(AE.calc.capacidade()), 150);
      };
      addEventListener('resize', aoRedimensionar);

      /* ---------- incluir equipamento que falta (6.1) ---------- */
      async function incluir(c) {
        const ests = AE.calc.estacoes().estacoes;
        if (!ests.length) { ctx.avisa('Não há estações para receber o equipamento: conclua o Passo 4 primeiro.', { tipo: 'erro' }); return; }
        const prop = propoe(c, ests);
        const v = await ctx.perguntar({
          titulo: `Incluir equipamento: ${c.item}`,
          texto: `O produto pede ${c.exige.charAt(0).toLowerCase() + c.exige.slice(1)}. Em qual estação? Estações: ${ests.map((e) => 'ST' + e.st).join(', ')}. Proposta do programa: ST${prop}.`,
          campo: 'Número da estação (ex.: ' + prop + ')', valor: String(prop), ok: 'Incluir na estação',
        });
        if (v == null) return;
        const st = parseInt(String(v).replace(/\D/g, ''), 10);
        if (!ests.some((e) => e.st === st)) {
          ctx.avisa(`"${v}" não é uma estação do Passo 4. Use uma destas: ${ests.map((e) => 'ST' + e.st).join(', ')}.`, { tipo: 'erro' });
          return;
        }
        /* materializa a lista do Passo 5 se ela ainda for a proposta automática */
        const fe = AE.fatia('equipamentos');
        const copiou = !(fe.itens && fe.itens.length);
        if (copiou) fe.itens = clone(AE.calc.equipamentos().itens);
        const id = 'E' + (Math.max(0, ...fe.itens.map((i) => numId(i.id))) + 1);
        const modelo = modeloCob(c.equip);
        fe.itens.push({ id, st, tipo: c.equip, modelo, qtd: 1, origem: 'nova', obs: 'Incluído pela cobertura do produto (Passo 6.1)', conferir: c.equip === 'pinca' ? !fe.homologados : false });
        AE.marcarAndamento('equipamentos');
        ctx.salvar();
        ctx.registrar(`Cobertura (6.1): ${modelo} incluído na ST${st} para "${c.item}" (${id} na lista do Passo 5${copiou ? ', proposta automática copiada para a lista' : ''})`);
        desenha();
        ctx.avisa(`${modelo} incluído na ST${st} e operação "${c.op}" marcada na estação. Confira a ocupação e conclua o Passo 5 de novo.`, {
          tipo: 'ok', acao: { texto: 'Abrir o Passo 5', fn: () => ctx.ir('equipamentos') },
        });
      }

      el.addEventListener('click', async (e) => {
        const bi = e.target.closest('[data-incluir]');
        if (bi) { const c = AE.calc.cobertura().find((x) => x.id === bi.dataset.incluir); if (c && !c.coberto) await incluir(c); return; }
        const bs = e.target.closest('[data-saida]');
        if (bs) {
          const chave = 'ST' + bs.dataset.st, k = bs.dataset.saida;
          if (k) { s.saidas[chave] = k; ctx.registrar(`${chave}: saída "${NOME_SAIDA[k]}" escolhida para estudar com a Simulação`); }
          else { const ant = s.saidas[chave]; delete s.saidas[chave]; ctx.registrar(`${chave}: escolha da saída "${NOME_SAIDA[ant] || ant}" desfeita`); }
          ctx.salvar(); desenha();
          ctx.avisa(k ? `${chave}: "${NOME_SAIDA[k]}" registrada. A Simulação confirma se resolve; até lá o macro ciclo da estação é conceito.` : `${chave}: escolha desfeita.`);
          return;
        }
        const bm = e.target.closest('[data-maisrobo]');
        if (bm) {
          const st = Number(bm.dataset.maisrobo), robos = Number(bm.dataset.robos);
          const fe = AE.fatia('estacoes');
          fe.ajustes = fe.ajustes || {};
          const antes = clone({ maxRobos: fe.maxRobos, ajustes: fe.ajustes });
          const subiu = robos > (Number(fe.maxRobos) || 4);
          if (subiu) fe.maxRobos = robos;
          const calc = AE.calc.estacoes().estacoes.find((x) => x.st === st);
          if (calc && calc.robosCalc === robos) delete fe.ajustes['ST' + st]; else fe.ajustes['ST' + st] = { robos };
          AE.marcarAndamento('estacoes');
          delete s.saidas['ST' + st];
          ctx.salvar();
          const txt = `ST${st}: mais um robô (agora ${robos}), aplicado no Passo 4 pela capacidade${subiu ? `; máximo por estação subiu para ${robos}` : ''}`;
          ctx.registrar(txt);
          const cap = desenha();
          const ok = !falhas(cap).some((x) => x.st === st);
          ctx.avisa(`${txt}. ${ok ? 'A estação passou a dar o ciclo.' : 'A estação ainda não dá o ciclo.'} Conclua o Passo 4 de novo.`, {
            tipo: ok ? 'ok' : 'aviso',
            acao: { texto: 'Desfazer', fn: () => { const f = AE.fatia('estacoes'); f.maxRobos = antes.maxRobos; f.ajustes = antes.ajustes; AE.marcarAndamento('estacoes'); ctx.salvar(); ctx.registrar(`Desfeito: ${txt}`); desenha(); } },
          });
          return;
        }
        const ir = e.target.closest('[data-ir]');
        if (ir) ctx.ir(ir.dataset.ir);
      });

      /* ---------- conferir cobertura ---------- */
      $('#cp-cob-conf', el).onclick = async (e) => {
        const t = ctx.termos();
        const ok = await ctx.cad({
          titulo: 'Ler o conteúdo do produto para a cobertura',
          catia: `Set sel = CATIA.ActiveDocument.Selection\nsel.Search "(Name=P*_*),all"            ' pontos de solda\nsel.Search "(Name=COLA*),all"             ' cordões de cola (curvas)\nsel.Search "(Name=PINO* + Name=FURO*),all" ' pinos e furos`,
          nx: `var pontos = workPart.Points.ToArray().Where(p => p.Name.StartsWith("P"));\nvar curvas = workPart.Curves.ToArray().Where(c => c.Name.StartsWith("COLA"));\n// pinos, furos e cordões MIG pelo atributo TIPO das features`,
          resultado: `Produto lido no ${t.nome}: pontos, cola, pinos, furos e MIG comparados com a lista de equipamentos.`,
        }, e.currentTarget);
        if (!ok) return;
        const cob = cobertura();
        const f = cob.filter((c) => !c.coberto).length;
        s.cobertura = { conferida: true, hora: hora(), faltavam: f };
        ctx.salvar();
        ctx.registrar(`Cobertura do produto conferida: ${f ? f + ' item(ns) sem equipamento (' + cob.filter((c) => !c.coberto).map((c) => c.item).join(', ') + ')' : 'tudo coberto'}`);
        desenha();
        ctx.avisa(f ? `Cobertura conferida: ${f} item do produto sem equipamento no processo.` : 'Cobertura conferida: tudo o que o produto pede existe no processo.', { tipo: f ? 'aviso' : 'ok' });
      };
      $('#cp-cob-add', el).onclick = async () => {
        const c = AE.calc.cobertura().find((x) => !x.coberto);
        if (!c) { ctx.avisa('Não falta nada: tudo o que o produto pede tem equipamento.'); return; }
        await incluir(c);
      };

      /* ---------- salvar macro ciclo ---------- */
      $('#cp-salvar', el).onclick = async (e) => {
        const cap = AE.calc.capacidade();
        if (!cap.estacoes.length) { ctx.avisa('Sem estações: não há macro ciclo para salvar.', { tipo: 'erro' }); return; }
        const b = e.currentTarget;
        b.setAttribute('aria-busy', 'true');
        await espera(600);
        b.removeAttribute('aria-busy');
        s.macro = { versao: (s.macro.versao || 0) + 1, hora: hora() };
        ctx.salvarUI();
        const arq = `14.2.3.1_Ciclograma/macro-ciclo_C${s.macro.versao}.xlsx`;
        ctx.registrar(`Macro ciclo salvo: ${arq} (${cap.estacoes.length} estações, ${cap.robos.length} robôs)`);
        ctx.avisa(`Macro ciclo salvo em ${arq}. Versão de conceito (C) até o processo ser liberado.`, { tipo: 'ok' });
      };

      /* ---------- concluir ---------- */
      $('#cp-concluir', el).onclick = () => {
        const cap = AE.calc.capacidade();
        const ruins = checagem(cap);
        if (ruins.length) {
          const cob = ruins.find((r) => r[0].includes('6.1'));
          if (cob) {
            ctx.avisa(`O processo não é liberado: ${cob[2]}. Use "Incluir o que falta" na checagem de cobertura (6.1).`, { tipo: 'erro' });
            $('#cp-cob-bloco', el).scrollIntoView({ block: 'start', behavior: 'smooth' });
          } else if (ruins[0][0] === 'Toda estação dá o ciclo') {
            ctx.avisa(`Ainda não dá para concluir: ${ruins[0][2]}. Aplique "mais um robô" ou escolha uma saída para estudar.`, { tipo: 'erro' });
            $('#cp-saidas-bloco', el).scrollIntoView({ block: 'start', behavior: 'smooth' });
          } else ctx.avisa(`Ainda não dá para concluir: ${ruins[0][2]}.`, { tipo: 'erro' });
          return;
        }
        const capT = cap.robos.reduce((a, r) => a + r.cap, 0), pts = cap.robos.reduce((a, r) => a + r.pontos.length, 0);
        const sds = Object.keys(s.saidas).filter((k) => s.saidas[k]);
        ctx.concluir({ registro: `Capacidade e macro ciclo: ${cap.robos.length} robôs, ${pts} pontos para ${capT} de capacidade; cobertura do produto completa${sds.length ? `; saídas a estudar: ${sds.map((k) => `${k} ${NOME_SAIDA[s.saidas[k]]}`).join(', ')}` : ''}` });
        desenha();
      };
    },
  });
})();
