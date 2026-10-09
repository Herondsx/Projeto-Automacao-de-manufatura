/* Passo 2 · Tempos padrão (Processo)
   Tela nova: na v0 só existia o botão desativado ("tabela de tempos padrão do projeto"). A especificação
   vem do passo '2' do fluxo da v0: entradas = tabela de tempos do cliente e tempos do operador (MTM);
   se não receber = usa a referência do programa (editável por projeto) e o posto sem MTM fica pendente;
   entrega = tabela de tempos do projeto. Saída: AE.calc.tempos() lê esta fatia. */
(function () {
  'use strict';
  const AE = window.AE;
  const { $, esc, fmt, hora, espera } = AE.util;

  const OBRIG = ['solda', 'aproximacao', 'trocaPinca', 'dispositivo', 'transferencia', 'seguranca', 'cargaManual', 'cola', 'pino'];
  /* planilha de tempos do cliente (simulada). O que não consta nela fica com a referência do programa. */
  const PLANILHA_CLIENTE = { solda: 2.6, aproximacao: 0.9, trocaPinca: 9.5, dispositivo: 3.5, transferencia: 8.0, seguranca: 3.0, cargaManual: 7.0, cola: 4.5 };
  const FONTE = {
    cliente: ['info', 'Cliente', 'Valor da tabela de tempos do cliente.'],
    referencia: ['neutro', 'Referência', 'Valor de referência do programa: cliente sem tabela, ou item que não consta na tabela dele.'],
    editado: ['roxo', 'Editado', 'Editado neste projeto.'],
    mtm: ['ok', 'MTM', 'Vem do estudo MTM dos postos manuais: o maior tempo de carga por peça.'],
  };
  const TIPO_EST = { sub: 'Subconjunto · posto manual', juncao: 'Junção (geometria)', respot: 'Respot' };

  const CSS = `
    #tp-tab td:first-child{min-width:220px;white-space:normal}
    #tp-tab .dif{font-family:var(--f-dado);font-size:13px}
    .tp-sim{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;background:var(--fundo);border:1px solid var(--linha);border-radius:8px;padding:10px 12px;margin:12px 0}
    .tp-sim label{flex:1;min-width:220px}
    .tp-sim b{font-family:var(--f-dado);font-size:18px;font-weight:500;min-width:64px}
    .tp-seta{color:var(--acao);font-family:var(--f-dado)}
    .tp-mudou{color:var(--acao);font-weight:600}`;

  AE.tela({
    id: 'tempos', sigla: '2', area: 'proc', rotulo: 'Passo 2', titulo: 'Tempos padrão',
    resumo: 'A tabela de tempos do projeto (do cliente ou a referência do programa) e o tempo do operador em cada posto manual.',
    tip: 'Abre a tabela de tempos padrão do projeto: de onde vêm, o que foi editado, o MTM dos postos manuais e o efeito no número de robôs.',
    entradas: [
      { de: 'inicio', o: 'Cliente: tabela de tempos do padrão dele' },
      { de: 'separacao', o: 'Subdivisões com posto manual (MTM)' },
    ],
    inicial: () => ({ itens: [], fonteTabela: null, mtm: {}, registro: [] }),
    programador: `
      <h3>O que esta tela guarda</h3>
      <ul>
        <li><code>itens</code>: <code>{id, op, seg, un, fonte}</code> para os 9 tempos obrigatórios (<code>solda</code>, <code>aproximacao</code>, <code>trocaPinca</code>, <code>dispositivo</code>, <code>transferencia</code>, <code>seguranca</code>, <code>cargaManual</code>, <code>cola</code>, <code>pino</code>). A edição guarda também <code>motivo</code> e <code>base</code> (valor e fonte de antes).</li>
        <li><code>fonte</code> de cada item: <code>cliente</code>, <code>referencia</code>, <code>editado</code> ou <code>mtm</code>.</li>
        <li><code>fonteTabela</code>: <code>cliente</code> ou <code>referencia</code> (vazio enquanto não foi escolhida).</li>
        <li><code>mtm</code>: <code>{'ST10': {seg, feito}}</code>, tempo de carga por peça medido no estudo do operador.</li>
        <li><code>registro</code>: mudanças feitas nesta tela.</li>
      </ul>
      <h3>Regras</h3>
      <ul>
        <li>Cliente com tabela: valem os tempos dele. O que não consta na tabela dele fica com a referência.</li>
        <li>Cliente sem tabela: usa a tabela de referência do programa, editável por projeto.</li>
        <li>Toda edição pede o motivo e fica registrada. Dá para voltar ao valor de referência em cada linha.</li>
        <li>MTM não preenchido: o posto manual fica sem tempo próprio e aparece como pendente. Não trava o passo.</li>
        <li>Tempo por ponto = solda + aproximação. Pontos por robô = tempo livre da estação ÷ tempo por ponto (mesma conta do Passo 4).</li>
      </ul>
      <h3>Saída</h3>
      <ul>
        <li><code>AE.calc.tempos()</code>: <code>itens</code> e <code>porId</code>. Lida pelo Passo 4 (estações e robôs) e pelo Passo 6 (capacidade e macro ciclo).</li>
        <li>Enquanto a fatia não tem itens, <code>AE.calc.tempos()</code> devolve a referência (valor de reserva).</li>
      </ul>
      <h3>Macros de base</h3>
      <ul><li>Nenhuma na v0. A importação lê a planilha do cliente (Excel), sem passar pelo CAD.</li></ul>
      <h3>Em aberto</h3>
      <ul>
        <li>Formato da planilha de tempos de cada cliente (colunas, unidades). O protótipo supõe uma linha por operação, em segundos.</li>
        <li>O Passo 4 usa um único tempo de carga por peça para todos os postos. Deveria usar o MTM de cada posto? Hoje "Levar o MTM para a tabela" grava o pior caso.</li>
        <li>O MTM é guardado pelo número da estação (ST10). Se o número mudar no Passo 1, o estudo se perde: guardar pelo id interno da subdivisão?</li>
        <li>O tempo de solda muda com a espessura e com 3 chapas? Hoje é um valor só por ponto.</li>
        <li>Os valores da "planilha do cliente" são de exemplo.</li>
      </ul>`,

    render() {
      return `
      <div class="bloco">
        <h2>De onde vêm os tempos</h2>
        <p class="sub">Regra: o cliente que tem tabela de tempos manda a dele. Cliente sem tabela usa a referência do programa, editável neste projeto.</p>
        <div id="tp-origem"></div>
      </div>

      <div class="bloco">
        <h2>Tempos do projeto <span class="exemplo">dados de exemplo</span></h2>
        <p class="sub">Digite o valor novo na coluna Tempo. Toda edição pede o motivo e fica registrada.</p>
        <div class="rolagem"><table id="tp-tab">
          <thead><tr><th>Operação</th><th class="num">Tempo (s)</th><th>Unidade</th><th>Fonte</th><th class="num">Diferença da referência</th><th></th></tr></thead>
          <tbody></tbody></table></div>
        <div id="tp-reg"></div>
      </div>

      <div class="bloco">
        <h2>Postos manuais: tempo do operador (MTM)</h2>
        <p class="sub">Cada subdivisão é carregada por um operador. O tempo de carga sai do estudo MTM do posto. Sem MTM, o posto fica pendente e usa a estimativa da tabela.</p>
        <div id="tp-mtm"></div>
      </div>

      <div class="bloco">
        <h2>Efeito nos próximos passos</h2>
        <p class="sub">Com os tempos atuais: quantos pontos cada robô solda dentro do ciclo e quantos robôs cada estação pede. É a mesma conta do Passo 4.</p>
        <div class="tp-sim">
          <label class="campo" for="tp-sim">E se o tempo de solda por ponto fosse…
            <input type="range" id="tp-sim" min="1.5" max="4" step="0.1" data-tip="Arraste para ver, sem gravar nada, como o número de robôs muda com outro tempo de solda.">
          </label>
          <b id="tp-sim-v" aria-live="polite"></b>
          <div class="barra">
            <button class="btn" data-acao="sim-aplicar" data-tip="Grava o tempo de solda simulado na tabela do projeto. Pede o motivo e registra a edição.">Aplicar este tempo</button>
            <button class="btn leve" data-acao="sim-reset" data-tip="Volta a simulação para o tempo de solda que está na tabela.">Voltar ao tempo atual</button>
          </div>
        </div>
        <div id="tp-efeito"></div>
      </div>

      <div class="bloco">
        <h2>Checagem</h2>
        <p class="sub">O passo só é concluído sem nenhum item em vermelho. Amarelo avisa, mas não trava.</p>
        <div class="checagem" id="tp-check"></div>
        <div class="barra fim" style="margin-top:14px">
          <button class="btn primario" data-acao="concluir" data-tip="Confere a checagem e grava a tabela de tempos do projeto. Os Passos 4 e 6 passam a usar estes tempos.">Concluir e avançar</button>
        </div>
      </div>`;
    },

    montar(el, ctx) {
      const s = ctx.s;
      if (!Array.isArray(s.itens)) s.itens = [];
      if (!s.mtm) s.mtm = {};
      if (!Array.isArray(s.registro)) s.registro = [];
      AE.css('tempos', CSS);

      const REF = {};
      AE.dados.tempos.forEach((t) => (REF[t.id] = t));
      const nomeOp = (id) => (REF[id] ? REF[id].op : id);
      const reg = (texto) => { s.registro.unshift({ hora: hora(), texto }); s.registro.length = Math.min(s.registro.length, 60); ctx.registrar(texto); };
      const s1 = (v) => fmt(v, 1);
      let sim = null; // tempo de solda simulado (só na tela, não grava)

      /* fatia sem itens = ainda na reserva. Na primeira mudança, a referência vira a tabela do projeto. */
      const garantir = () => {
        if (!s.itens.length) s.itens = AE.dados.tempos.map((t) => ({ id: t.id, op: t.op, seg: t.seg, un: t.un, fonte: 'referencia' }));
        if (!s.fonteTabela) s.fonteTabela = 'referencia';
      };
      const item = (id) => s.itens.find((i) => i.id === id);
      /* estações calculadas com tempos diferentes, sem gravar (troca a fatia só durante a conta) */
      function estacoesCom(over) {
        const T = AE.estado.t, orig = T.tempos;
        const itens = AE.calc.tempos().itens.map((i) => Object.assign({}, i, over[i.id] != null ? { seg: over[i.id] } : {}));
        T.tempos = Object.assign({}, orig || {}, { itens });
        try { return AE.calc.estacoes(); } finally { if (orig === undefined) delete T.tempos; else T.tempos = orig; }
      }
      function postos() {
        const sep = AE.calc.separacao();
        return {
          reserva: sep.reserva,
          lista: sep.subs.slice().sort((a, b) => a.st - b.st)
            .map((sub) => ({ sub, key: 'ST' + sub.st, pecas: sub.pecas.filter((pc) => !sep.by.includes(pc)) }))
            .filter((x) => x.pecas.length),
        };
      }
      const maiorMtm = () => {
        const f = Object.entries(s.mtm).filter(([, m]) => m && m.feito);
        if (!f.length) return null;
        return f.reduce((a, [k, m]) => (m.seg > a.seg ? { seg: m.seg, st: k } : a), { seg: -1, st: '' });
      };

      /* ---------- origem ---------- */
      function origem() {
        const pj = AE.calc.projeto();
        const f = s.fonteTabela;
        const semCliente = s.itens.filter((i) => i.semCliente).map((i) => nomeOp(i.id));
        const nCli = s.itens.filter((i) => i.fonte === 'cliente').length;
        $('#tp-origem', el).innerHTML = `
          <div class="cartoes">
            <div class="cartao ${f === 'cliente' ? 'sel' : ''}">
              <h3>Tabela do cliente ${f === 'cliente' ? '<span class="pilula ok">em uso</span>' : ''}</h3>
              <small>Planilha de tempos padrão de ${esc(pj.cliente)} (<code>Tempos_padrao_${esc(pj.padrao.sigla)}.xlsx</code>) <span class="exemplo">exemplo</span>. O que não constar nela fica com a referência.</small>
              <div class="barra"><button class="btn ${f ? '' : 'primario'}" data-acao="importar" data-tip="Lê a planilha de tempos que o cliente mandou e preenche a tabela do projeto. Itens que não constam nela ficam com a referência do programa.">Importar tabela do cliente</button></div>
            </div>
            <div class="cartao ${f === 'referencia' ? 'sel' : ''}">
              <h3>Referência do programa ${f === 'referencia' ? '<span class="pilula ok">em uso</span>' : ''}</h3>
              <small>Os ${AE.dados.tempos.length} tempos de referência do programa, para cliente que não manda tabela. Editáveis neste projeto, com motivo.</small>
              <div class="barra"><button class="btn" data-acao="referencia" data-tip="Usa a tabela de referência do programa como tabela deste projeto. Dá para editar cada valor depois, com motivo.">Usar referência do programa</button></div>
            </div>
          </div>
          ${!f ? '<div class="faixa-aviso amarela" style="margin-top:12px"><span><b>Origem ainda não escolhida.</b> Até lá, os passos seguintes usam a referência do programa como valor de reserva.</span></div>'
            : f === 'cliente' ? `<p class="nota ok">${nCli} de ${OBRIG.length} tempos vieram da tabela de ${esc(pj.cliente)}.${semCliente.length ? ` Não constam na tabela dele e ficaram com a referência: ${esc(semCliente.join(', '))}.` : ''}</p>`
            : '<p class="nota">Tabela de referência do programa adotada para este projeto.</p>'}`;
      }

      /* ---------- tabela ---------- */
      function tabela() {
        const itens = AE.calc.tempos().itens;
        $('#tp-tab tbody', el).innerHTML = itens.map((i) => {
          const r = REF[i.id] ? REF[i.id].seg : i.seg;
          const dif = (Number(i.seg) || 0) - r;
          const [fc, ft, ftip] = FONTE[i.fonte] || FONTE.referencia;
          const tipF = i.fonte === 'editado'
            ? `Editado neste projeto${i.base ? ` (antes: ${s1(i.base.seg)} s, ${(FONTE[i.base.fonte] || FONTE.referencia)[1].toLowerCase()})` : ''}. Motivo: ${i.motivo || '—'}`
            : i.fonte === 'mtm' ? `${ftip} ${i.motivo || ''}` : ftip;
          const difTxt = Math.abs(dif) < 0.005 ? '<span style="color:var(--fraco)">igual</span>'
            : `<span class="dif" style="color:${dif > 0 ? 'var(--aviso)' : 'var(--azul)'}" data-tip="${esc(`${dif > 0 ? 'Mais lento' : 'Mais rápido'} que a referência do programa (${s1(r)} s).`)}">${dif > 0 ? '+' : '−'}${s1(Math.abs(dif))} s (${dif > 0 ? '+' : '−'}${Math.round(Math.abs(dif) / r * 100)}%)</span>`;
          const bts = [];
          if (i.fonte === 'editado' && i.base && i.base.fonte === 'cliente') bts.push(`<button class="btn mini leve" data-acao="desfazer" data-id="${i.id}" data-tip="${esc(`Volta ao valor da tabela do cliente (${s1(i.base.seg)} s) e registra.`)}">Voltar ao cliente</button>`);
          if (Math.abs(dif) >= 0.005) bts.push(`<button class="btn mini leve" data-acao="ref" data-id="${i.id}" data-tip="${esc(`Volta este tempo ao valor de referência do programa (${s1(r)} s) e registra a mudança.`)}">Voltar à referência</button>`);
          return `<tr>
            <td>${esc(i.op)}${i.semCliente ? ' <span class="pilula neutro" data-tip="Não consta na tabela do cliente: ficou com a referência do programa.">não consta no cliente</span>' : ''}</td>
            <td class="num"><input class="curto" type="number" min="0.1" step="0.1" data-id="${i.id}" value="${esc(i.seg)}" aria-label="${esc('Tempo: ' + i.op)}" data-tip="Digite o tempo novo em segundos. O programa pede o motivo antes de gravar."></td>
            <td style="white-space:nowrap">${esc(i.un)}</td>
            <td><span class="pilula ${fc}" data-tip="${esc(tipF)}">${ft}</span></td>
            <td class="num">${difTxt}</td>
            <td><div class="barra">${bts.join('')}</div></td></tr>`;
        }).join('');
        $('#tp-reg', el).innerHTML = s.registro.length
          ? `<h3 class="rotulo-sec">Registro desta tabela</h3><div class="registro">${s.registro.slice(0, 10).map((r) => `<span>${esc(r.hora)} · ${esc(r.texto)}</span>`).join('')}</div>` : '';
      }

      /* ---------- MTM ---------- */
      function mtm() {
        const tp = AE.calc.tempos().porId;
        const P = postos();
        const mx = maiorMtm();
        const cm = item('cargaManual');
        const linhas = P.lista.map(({ sub, key, pecas }) => {
          const m = s.mtm[key];
          const feito = m && m.feito;
          const est = pecas.length * tp.cargaManual;
          return `<tr>
            <td><b>ST${sub.st}</b><br><small style="color:var(--suave)">${esc(sub.nome)}</small></td>
            <td>${esc(pecas.join(', '))} <small style="color:var(--fraco)">(${pecas.length})</small></td>
            <td class="num" data-tip="${esc(`${pecas.length} peça(s) × ${s1(tp.cargaManual)} s da tabela (carga manual por peça).`)}">${s1(est)} s</td>
            <td class="num"><input class="curto" type="number" min="0.5" max="60" step="0.1" data-mtm="${key}" value="${m && m.seg != null ? esc(m.seg) : ''}" placeholder="${s1(tp.cargaManual)}" aria-label="${esc(`MTM por peça da ST${sub.st}`)}" data-tip="Tempo de carga por peça medido no estudo MTM deste posto, em segundos."></td>
            <td class="num">${feito ? `${s1(m.seg * pecas.length)} s` : '—'}</td>
            <td>${feito ? `<span class="pilula ok" data-tip="${esc(`Estudo MTM registrado às ${m.hora || '—'}.`)}">MTM feito</span>` : '<span class="pilula aviso" data-tip="MTM não preenchido: o posto fica sem tempo próprio e usa a estimativa da tabela. Aparece como pendente (regra da v0).">Pendente</span>'}</td>
            <td><div class="barra"><button class="btn mini ${feito ? 'leve' : ''}" data-acao="mtm" data-st="${key}" data-tip="${esc(`Grava o tempo digitado como estudo MTM da ST${sub.st}.`)}">${feito ? 'Atualizar' : 'Registrar MTM'}</button>
              ${feito ? `<button class="btn mini leve" data-acao="mtm-apagar" data-st="${key}" data-tip="Apaga o estudo MTM deste posto. Ele volta a ficar pendente.">Apagar</button>` : ''}</div></td></tr>`;
        }).join('');
        const desat = mx && cm && cm.fonte === 'mtm' && Math.abs(cm.seg - mx.seg) > 0.001;
        $('#tp-mtm', el).innerHTML = `
          ${P.reserva ? '<p class="nota aviso" style="margin:0 0 10px">Subdivisões de reserva: o Passo 1 ainda não criou as dele. Quando criar, confira os postos de novo.</p>' : ''}
          ${P.lista.length ? `<div class="rolagem"><table>
            <thead><tr><th>Posto</th><th>Peças carregadas</th><th class="num">Estimativa pela tabela</th><th class="num">MTM por peça (s)</th><th class="num">Carga do posto</th><th>Situação</th><th></th></tr></thead>
            <tbody>${linhas}</tbody></table></div>
            <div class="barra" style="margin-top:12px">
              <button class="btn" data-acao="mtm-tabela" data-tip="Grava na tabela, como tempo de carga manual por peça, o maior tempo medido nos estudos MTM (pior posto). É esse valor que o Passo 4 usa.">Levar o MTM para a tabela</button>
              <span style="color:var(--suave);font-size:13px">${mx ? `Maior MTM por peça: <b>${s1(mx.seg)} s</b> (${esc(mx.st)}). Na tabela: ${s1(tp.cargaManual)} s.` : 'Nenhum estudo MTM registrado ainda.'}</span>
            </div>
            ${desat ? `<p class="nota aviso">A tabela usa ${s1(cm.seg)} s, mas o maior MTM agora é ${s1(mx.seg)} s. Leve o MTM para a tabela de novo.</p>` : ''}`
            : '<div class="vazio">Nenhum posto manual: todas as subdivisões são de peças BY. Confira a separação no Passo 1.</div>'}`;
      }

      /* ---------- efeito ---------- */
      function efeito() {
        const tp = AE.calc.tempos().porId;
        const ee = AE.calc.estacoes();
        const v = sim == null ? tp.solda : sim;
        const ativo = Math.abs(v - tp.solda) > 0.001;
        const es = ativo ? estacoesCom({ solda: v }) : null;
        $('#tp-sim', el).value = v;
        $('#tp-sim-v', el).textContent = `${s1(v)} s`;
        const porSt = {};
        if (es) es.estacoes.forEach((e) => (porSt[e.st] = e));
        const sts = [...new Set(ee.estacoes.map((e) => e.st).concat(es ? es.estacoes.map((e) => e.st) : []))].sort((a, b) => a - b);
        const daAgora = {};
        ee.estacoes.forEach((e) => (daAgora[e.st] = e));
        const seta = (a, b, fmtF = (x) => x) => (es && a !== b ? `${a == null ? '—' : fmtF(a)} <span class="tp-seta">→ ${b == null ? '—' : fmtF(b)}</span>` : a == null ? '—' : fmtF(a));
        const linhas = sts.map((st) => {
          const a = daAgora[st], b = porSt[st];
          const e = a || b;
          const situ = (x) => !x ? '' : !x.porRobo ? '<span class="pilula erro" data-tip="O tempo livre da estação não dá nem para um ponto por robô.">não cabe no ciclo</span>'
            : x.dividida ? `<span class="pilula aviso" data-tip="${esc(`Com o máximo de ${ee.maxRobos} robôs não fecha: o que sobra vai para uma estação de respot.`)}">dividida · respot</span>`
            : '<span class="pilula ok">fecha</span>';
          return `<tr><td><b>ST${st}</b> <small style="color:var(--suave)">${esc(e.nome)}</small></td><td>${esc(TIPO_EST[e.tipo] || e.tipo)}</td>
            <td class="num">${seta(a ? a.nPontos : null, b ? b.nPontos : null)}</td>
            <td class="num">${seta(a ? a.disponivel : null, b ? b.disponivel : null, (x) => s1(x) + ' s')}</td>
            <td class="num">${seta(a ? a.porRobo : null, b ? b.porRobo : null)}</td>
            <td class="num">${seta(a ? a.robosCalc : null, b ? b.robosCalc : null)}</td>
            <td>${es ? situ(b) : situ(a)}</td></tr>`;
        }).join('');
        const tPonto = tp.solda + tp.aproximacao;
        $('#tp-efeito', el).innerHTML = `
          <div class="kpis">
            <div class="kpi" data-tip="Menor ciclo adotado no Passo 0 (modelo mais exigente)."><span>Ciclo de projeto</span><b>${s1(ee.ciclo)} s</b><small>do Passo 0</small></div>
            <div class="kpi" data-tip="Solda + aproximação: o tempo que cada ponto ocupa o robô."><span>Tempo por ponto</span><b>${es ? `${s1(tPonto)} <span class="tp-seta">→ ${s1(es.tPonto)}</span>` : s1(tPonto)} s</b><small>solda ${s1(tp.solda)} + aproximação ${s1(tp.aproximacao)}</small></div>
            <div class="kpi ${es && es.totalRobos > ee.totalRobos ? 'aviso' : ''}" data-tip="Soma dos robôs de solda calculados em todas as estações."><span>Robôs de solda</span><b>${es ? `${ee.totalRobos} <span class="tp-seta">→ ${es.totalRobos}</span>` : ee.totalRobos}</b><small>máximo ${ee.maxRobos} por estação</small></div>
            <div class="kpi" data-tip="Estações com solda, incluindo junção e respot."><span>Estações</span><b>${es ? `${ee.estacoes.length} <span class="tp-seta">→ ${es.estacoes.length}</span>` : ee.estacoes.length}</b><small>${ee.estacoes.map((e) => 'ST' + e.st).join(' · ')}</small></div>
          </div>
          ${es ? `<p class="nota aviso">Simulação com solda de ${s1(v)} s por ponto. Nada foi gravado: use "Aplicar este tempo" para levar à tabela.</p>` : ''}
          <div class="rolagem" style="margin-top:12px"><table>
            <thead><tr><th>Estação</th><th>Tipo</th><th class="num">Pontos</th><th class="num">Tempo livre p/ soldar</th><th class="num">Pontos por robô</th><th class="num">Robôs</th><th>Situação</th></tr></thead>
            <tbody>${linhas || '<tr><td colspan="7"><div class="vazio">Sem pontos no ciclo: confira o Passo 1.</div></td></tr>'}</tbody></table></div>
          <p class="nota">Tempo livre = ciclo − transferência − grampos − folga de segurança − carga manual. ${AE.passo('estacoes').status === 'pendente' ? 'O Passo 4 ainda não foi feito: aqui aparece a conta dele com os valores de reserva.' : ''}</p>`;
      }

      /* ---------- checagem ---------- */
      function checar() {
        const T = AE.calc.tempos();
        const faltam = OBRIG.filter((id) => !(Number(T.porId[id]) > 0) || !T.itens.some((i) => i.id === id));
        const eds = T.itens.filter((i) => i.fonte === 'editado');
        const semMot = eds.filter((i) => !i.motivo);
        const P = postos();
        const pend = P.lista.filter((x) => !(s.mtm[x.key] && s.mtm[x.key].feito));
        const ee = AE.calc.estacoes();
        const ruins = ee.estacoes.filter((e) => e.dividida || !e.porRobo);
        const itens = [
          { t: 'Origem da tabela escolhida (cliente ou referência)', ok: !!s.fonteTabela, falha: 'Escolha a origem no primeiro quadro', nivel: 'erro' },
          { t: `Os ${OBRIG.length} tempos obrigatórios têm valor maior que zero`, ok: !faltam.length, falha: 'Falta: ' + faltam.map(nomeOp).join(', '), nivel: 'erro' },
          { t: 'Toda edição tem motivo registrado', ok: !semMot.length, falha: `${semMot.length} sem motivo`, nivel: 'erro', okTxt: eds.length ? `${eds.length} edição(ões) com motivo` : 'Nenhuma edição' },
          { t: 'Postos manuais com estudo MTM', ok: !pend.length, falha: `${pend.length} pendente(s): ${pend.map((x) => x.key).join(', ')} · não trava`, nivel: 'aviso', okTxt: P.lista.length ? `${P.lista.length} de ${P.lista.length}` : 'Nenhum posto manual' },
          { t: 'Estações fecham o ciclo com estes tempos', ok: !ruins.length, falha: `${ruins.map((e) => 'ST' + e.st).join(', ')} não fecha · ver Passo 4`, nivel: 'aviso', okTxt: 'Todas fecham' },
        ];
        $('#tp-check', el).innerHTML = itens.map((i) => `<div><span>${esc(i.t)}</span>${i.ok ? `<span class="pilula ok">${esc(i.okTxt || 'Certo')}</span>` : `<span class="pilula ${i.nivel}">${esc(i.falha)}</span>`}</div>`).join('');
        return { ruins: itens.filter((i) => !i.ok && i.nivel === 'erro'), pend, P, eds };
      }

      const tudo = () => { origem(); tabela(); mtm(); efeito(); checar(); };
      tudo();

      /* ---------- edição de um tempo (com motivo) ---------- */
      async function editar(id, v, inp) {
        const atual = AE.calc.tempos().itens.find((i) => i.id === id);
        if (!atual) return;
        if (!(v > 0) || v > 600) { ctx.avisa('O tempo precisa ser maior que zero (e até 600 s). Digite em segundos, por exemplo 2,4.', { tipo: 'erro' }); if (inp) inp.value = atual.seg; return false; }
        if (Math.abs(v - atual.seg) < 0.001) return false;
        const antes = AE.calc.estacoes().totalRobos, depois = estacoesCom({ [id]: v }).totalRobos;
        const mot = await ctx.perguntar({
          titulo: `Mudar o tempo: ${atual.op}`,
          texto: `De ${s1(atual.seg)} para ${s1(v)} (${atual.un}). ${antes === depois ? `O número de robôs de solda não muda (${antes}).` : `Com este valor, o projeto passa de ${antes} para ${depois} robôs de solda.`}`,
          campo: 'Motivo da mudança', ok: 'Registrar mudança',
        });
        if (mot == null) { if (inp) inp.value = atual.seg; return false; }
        const veioDaReserva = !s.itens.length;
        garantir();
        const i = item(id);
        if (!i.base || i.fonte !== 'editado') i.base = { seg: i.seg, fonte: i.fonte };
        i.seg = Math.round(v * 100) / 100; i.fonte = 'editado'; i.motivo = mot;
        reg(`${i.op}: ${s1(i.base.seg)} → ${s1(i.seg)} s. Motivo: ${mot}`);
        ctx.salvar(); tudo();
        ctx.avisa(`Tempo gravado e registrado.${veioDaReserva ? ' A referência do programa foi adotada como base da tabela.' : ''}`, { tipo: 'ok' });
        return true;
      }

      el.addEventListener('change', async (e) => {
        const t = e.target;
        if (t.matches('#tp-tab input[data-id]')) { await editar(t.dataset.id, parseFloat(t.value), t); return; }
      });
      el.addEventListener('input', (e) => {
        if (e.target.id === 'tp-sim') { sim = parseFloat(e.target.value); efeito(); }
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.matches('input[data-mtm]')) { e.preventDefault(); el.querySelector(`[data-acao="mtm"][data-st="${e.target.dataset.mtm}"]`)?.click(); }
      });

      el.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-acao]');
        if (!b) return;
        const a = b.dataset.acao;
        const pj = AE.calc.projeto();

        if (a === 'importar') {
          const eds = s.itens.filter((i) => i.fonte === 'editado' || i.fonte === 'mtm').length;
          if (eds) {
            const ok = await ctx.perguntar({ titulo: 'Importar a tabela do cliente?', texto: `A tabela do cliente substitui a atual e apaga ${eds} edição(ões) feitas neste projeto. As edições continuam no registro.`, ok: 'Importar e substituir', perigo: true });
            if (!ok) return;
          }
          b.setAttribute('aria-busy', 'true');
          await espera(650);
          b.removeAttribute('aria-busy');
          s.itens = AE.dados.tempos.map((t) => PLANILHA_CLIENTE[t.id] != null
            ? { id: t.id, op: t.op, seg: PLANILHA_CLIENTE[t.id], un: t.un, fonte: 'cliente' }
            : { id: t.id, op: t.op, seg: t.seg, un: t.un, fonte: 'referencia', semCliente: true });
          s.fonteTabela = 'cliente';
          const n = s.itens.filter((i) => i.fonte === 'cliente').length;
          const mud = s.itens.filter((i) => i.fonte === 'cliente' && Math.abs(i.seg - REF[i.id].seg) > 0.001).length;
          reg(`Tabela de tempos de ${pj.cliente} importada: ${n} tempos do cliente (${mud} diferentes da referência), ${OBRIG.length - n} ficaram com a referência.`);
          ctx.salvar(); sim = null; tudo();
          ctx.avisa(`Tabela de ${pj.cliente} lida: ${n} tempos vieram do cliente, ${mud} diferentes da referência. Veja o efeito no número de robôs abaixo.`, { tipo: 'ok' });
          return;
        }
        if (a === 'referencia') {
          const eds = s.itens.filter((i) => i.fonte !== 'referencia').length;
          if (s.fonteTabela === 'referencia' && !eds) { ctx.avisa('A referência do programa já é a tabela deste projeto.'); return; }
          if (eds) {
            const ok = await ctx.perguntar({ titulo: 'Usar a referência do programa?', texto: `A tabela volta aos ${OBRIG.length} valores de referência e ${eds} valor(es) do cliente ou editados deixam de valer. Tudo continua no registro.`, ok: 'Usar a referência', perigo: true });
            if (!ok) return;
          }
          s.itens = AE.dados.tempos.map((t) => ({ id: t.id, op: t.op, seg: t.seg, un: t.un, fonte: 'referencia' }));
          s.fonteTabela = 'referencia';
          reg('Tabela de referência do programa adotada para este projeto.');
          ctx.salvar(); sim = null; tudo();
          ctx.avisa('Referência do programa adotada. Edite o que for preciso: cada mudança pede o motivo.', { tipo: 'ok' });
          return;
        }
        if (a === 'ref' || a === 'desfazer') {
          const id = b.dataset.id;
          const atual = AE.calc.tempos().itens.find((i) => i.id === id);
          if (!atual) return;
          const r = REF[id].seg;
          if (a === 'ref' && (atual.fonte === 'cliente' || (atual.base && atual.base.fonte === 'cliente'))) {
            const ok = await ctx.perguntar({ titulo: 'Usar a referência no lugar do cliente?', texto: `${atual.op}: a tabela do cliente pede ${s1(atual.fonte === 'cliente' ? atual.seg : atual.base.seg)} s. Usar a referência do programa (${s1(r)} s) mesmo assim? A troca fica registrada.`, ok: 'Usar a referência' });
            if (!ok) return;
          }
          garantir();
          const i = item(id);
          const de = i.seg;
          if (a === 'desfazer' && i.base) { i.seg = i.base.seg; i.fonte = i.base.fonte; }
          else { i.seg = r; i.fonte = 'referencia'; }
          delete i.motivo; delete i.base;
          reg(`${i.op}: ${s1(de)} → ${s1(i.seg)} s (${a === 'desfazer' ? 'voltou ao valor do cliente' : 'voltou ao valor de referência'}).`);
          ctx.salvar(); tudo();
          ctx.avisa(`${i.op}: ${a === 'desfazer' ? 'voltou ao valor do cliente' : 'voltou ao valor de referência'} (${s1(i.seg)} s).`, { tipo: 'ok' });
          return;
        }
        if (a === 'mtm') {
          const key = b.dataset.st;
          const inp = el.querySelector(`input[data-mtm="${key}"]`);
          const v = parseFloat(inp && inp.value);
          if (!(v > 0) || v > 60) { ctx.avisa(`Digite o tempo de carga por peça da ${key} em segundos (maior que zero e até 60), depois registre.`, { tipo: 'erro' }); inp && inp.focus(); return; }
          const P = postos().lista.find((x) => x.key === key);
          s.mtm[key] = { seg: Math.round(v * 10) / 10, feito: true, pecas: P ? P.pecas.length : null, hora: hora() };
          reg(`MTM da ${key}: ${s1(v)} s por peça${P ? ` × ${P.pecas.length} peça(s) = ${s1(v * P.pecas.length)} s de carga` : ''}.`);
          ctx.salvar(); tudo();
          ctx.avisa(`Estudo MTM da ${key} registrado. Para o Passo 4 usar este valor, use "Levar o MTM para a tabela".`, { tipo: 'ok' });
          return;
        }
        if (a === 'mtm-apagar') {
          const key = b.dataset.st;
          delete s.mtm[key];
          reg(`MTM da ${key} apagado: o posto volta a ficar pendente.`);
          ctx.salvar(); tudo();
          ctx.avisa(`MTM da ${key} apagado. O posto aparece como pendente.`);
          return;
        }
        if (a === 'mtm-tabela') {
          const mx = maiorMtm();
          if (!mx) { ctx.avisa('Registre o estudo MTM de pelo menos um posto antes de levar para a tabela.', { tipo: 'aviso' }); return; }
          garantir();
          const i = item('cargaManual');
          if (i.fonte === 'mtm' && Math.abs(i.seg - mx.seg) < 0.001) { ctx.avisa('A tabela já usa o maior tempo do MTM.'); return; }
          const de = i.seg;
          i.base = { seg: i.seg, fonte: i.fonte };
          i.seg = mx.seg; i.fonte = 'mtm'; i.motivo = `Estudo MTM: maior tempo por peça (${mx.st}).`;
          reg(`Carga manual por peça: ${s1(de)} → ${s1(mx.seg)} s, do estudo MTM (${mx.st}, pior posto).`);
          ctx.salvar(); tudo();
          ctx.avisa(`Tabela atualizada: carga manual de ${s1(mx.seg)} s por peça, vinda do MTM da ${mx.st}.`, { tipo: 'ok' });
          return;
        }
        if (a === 'sim-reset') { sim = null; efeito(); return; }
        if (a === 'sim-aplicar') {
          const tp = AE.calc.tempos().porId;
          if (sim == null || Math.abs(sim - tp.solda) < 0.001) { ctx.avisa('Arraste o controle para outro tempo de solda antes de aplicar.'); return; }
          const ok = await editar('solda', sim, null);
          if (ok) { sim = null; efeito(); }
          return;
        }
        if (a === 'concluir') {
          const c = checar();
          if (c.ruins.length) { ctx.avisa(`Não foi possível concluir: ${c.ruins[0].t.toLowerCase()} (${c.ruins[0].falha}).`, { tipo: 'erro' }); return; }
          const T = AE.calc.tempos();
          const feitos = c.P.lista.length - c.pend.length;
          ctx.concluir({
            registro: `Tempos padrão do projeto definidos (${s.fonteTabela === 'cliente' ? 'tabela do cliente' : 'referência do programa'}): solda ${s1(T.porId.solda)} s/ponto, ${c.eds.length} edição(ões), MTM em ${feitos} de ${c.P.lista.length} posto(s)`,
            mensagem: `Tempos padrão gravados.${c.pend.length ? ` ${c.pend.length} posto(s) sem MTM ficam pendentes.` : ''} Próximo: operador e ergonomia.`,
          });
        }
      });
    },
  });
})();
