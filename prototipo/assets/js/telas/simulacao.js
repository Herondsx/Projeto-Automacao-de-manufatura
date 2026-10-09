/* Simulação · Ambiente, acessos e distribuição (S0, S1 e S2)
   Tela nova, especificada pelos passos S0, S1 e S2 do fluxo da v0. A Simulação é quem define
   quais pontos vão em cada robô: a distribuição gravada aqui volta para a capacidade (Passo 6)
   via AE.calc.capacidade(), e a nuvem de pinças vai para a Mecânica (conferir colisão).
   Fatia (contrato, lida por AE.calc.simulacao()):
   {aba, distribuicao:{'ST10-R1':[pontos]} (só depois da 1ª mudança), semAcesso:[pendentes],
    resolvidos:{ponto: acao}, nuvem:{entregue, versao}, estudos:[…]} */
(function () {
  'use strict';
  const AE = window.AE;
  const { $, $$, esc, fmt } = AE.util;

  /* ======================= regras e valores de EXEMPLO ======================= */
  const LIMITE_PLC = 6;                       // pinças por PLC (exemplo; vem do padrão de automação do cliente)
  const PINCA_NOVA = 'Pinça servo tipo C · garganta 350 mm';
  const forcaReq = (ch) => Math.round((3.2 + (Math.max(2, Number(ch) || 2) - 2) * 1.0) * 10) / 10; // kN, exemplo
  /* verificação determinística: os pontos de 3 chapas (A+B+E) e 1 da junção C+D ficam sem acesso */
  const SEM_ACESSO = (p) => p.pecas.length >= 3 || /_CD_003$/.test(p.n);
  const SEM_NENHUM = (p) => /_ABE_002$/.test(p.n); // nenhum robô da estação chega com a pinça atual
  const ALCANCE = { ponto: /_BD_014$/, falta: 80 }; // robô não alcança por 80 mm
  const ACOES = { redistribuir: 'Redistribuído', 'pinca-nova': 'Pinça nova', 'troca-pinca': 'Troca de pinça' };

  const softSim = () => (AE.termos().nome === 'NX' ? 'Process Simulate' : 'DELMIA');
  const hash = (txt) => { let h = 5381; for (let i = 0; i < txt.length; i++) h = ((h << 5) + h + txt.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const kn = (v) => (v == null ? 'não informada' : fmt(v, 1) + ' kN');
  const seg = (v) => fmt(v, 1) + ' s';

  /* ======================= leitura das entradas ======================= */
  function ler(s) {
    const pj = AE.calc.projeto(), sep = AE.calc.separacao(), ee = AE.calc.estacoes(), cap = AE.calc.capacidade();
    const eq = AE.calc.equipamentos().itens, tp = AE.calc.tempos().porId;
    const porNome = {};
    sep.pontos.forEach((p) => (porNome[p.n] = p));
    const robos = cap.robos.map((r) => {
      const e = ee.estacoes.find((x) => x.st === r.st) || {};
      const pIt = eq.find((i) => i.tipo === 'pinca' && Number(i.st) === Number(r.st));
      const rIt = eq.find((i) => i.tipo === 'robo' && Number(i.st) === Number(r.st));
      const nova = s.pincasNovas[r.id];
      const modelo = nova ? nova.modelo : pIt ? pIt.modelo : 'Pinça não definida';
      const lib = AE.dados.pincas.find((x) => x.modelo === modelo);
      const forca = nova ? (nova.forca == null || nova.forca === '' ? null : Number(nova.forca)) : lib ? lib.forca : null;
      const troca = (s.trocas[r.id] || []).filter((n) => r.pontos.includes(n));
      const tempo = r.pontos.length * ee.tPonto + (troca.length ? 2 * tp.trocaPinca : 0);
      return { id: r.id, st: r.st, cap: r.cap, pontos: r.pontos, pinca: modelo, forca, origem: nova ? 'nova' : pIt ? pIt.origem : 'nova',
        nova: !!nova, troca, tempo, disp: e.disponivel, roboModelo: rIt ? rIt.modelo : 'Robô não definido' };
    });
    const dono = {};
    robos.forEach((r) => r.pontos.forEach((n) => (dono[n] = r.id)));
    const roboDe = (id) => robos.find((r) => r.id === id);
    const M = { pj, sep, ee, tp, eq, porNome, robos, dono, roboDe };
    M.estudos = propostos(M, s);
    M.assinatura = hash(JSON.stringify(robos.map((r) => [r.id, r.pinca, r.troca, r.pontos])));
    return M;
  }

  /* um estudo por PLC e zona; zona com mais pinças que o limite do PLC vira mais de um estudo */
  function propostos(M, s) {
    const lim = Math.max(1, Number(s.limitePlc) || LIMITE_PLC);
    const out = [];
    let plc = 1, carga = 0;
    M.ee.estacoes.forEach((e) => {
      const rs = M.robos.filter((r) => r.st === e.st);
      const pincas = rs.flatMap((r) => [`${r.id}|${r.pinca}`].concat(r.troca.length ? [`${r.id}|troca|${PINCA_NOVA}`] : []));
      if (!pincas.length) return;
      const partes = Math.ceil(pincas.length / lim);
      const resto = pincas.slice();
      let parte = 0;
      while (resto.length) {
        if (carga > 0 && carga + Math.min(resto.length, lim) > lim) { plc++; carga = 0; }
        const take = resto.splice(0, Math.min(lim - carga, resto.length));
        parte++;
        const robosE = [...new Set(take.map((x) => x.split('|')[0]))];
        const modelos = robosE.map((id) => M.roboDe(id).roboModelo);
        out.push({ id: `PLC${plc}-ST${e.st}${partes > 1 ? '-' + parte : ''}`, plc, zona: 'ST' + e.st, st: e.st, robos: robosE, pincas: take.length,
          equip: take, assinatura: hash(take.join(';') + modelos.join(';')) });
        carga += take.length;
      }
    });
    return out;
  }

  function situacaoEstudo(est, s) {
    const m = (s.estudos || []).find((x) => x.id === est.id);
    if (!m) return { st: 'amontar', m };
    return { st: m.assinatura === est.assinatura ? 'ok' : 'mudou', m };
  }
  function foraBiblioteca(M, s) {
    const libR = AE.dados.robos.map((r) => r.modelo), libP = AE.dados.pincas.map((p) => p.modelo);
    const extra = s.biblioteca || [];
    const fora = [];
    M.robos.forEach((r) => {
      if (!libR.includes(r.roboModelo) && !extra.includes(r.roboModelo) && !fora.some((f) => f.modelo === r.roboModelo)) fora.push({ tipo: 'robô', modelo: r.roboModelo });
      if (!libP.includes(r.pinca) && !extra.includes(r.pinca) && !fora.some((f) => f.modelo === r.pinca)) fora.push({ tipo: 'pinça', modelo: r.pinca });
    });
    return fora;
  }
  /* robôs da mesma estação que podem receber o ponto */
  function candidatos(M, nome, de) {
    const p = M.porNome[nome], r0 = M.roboDe(de);
    if (!p || !r0) return [];
    const req = forcaReq(p.chapas);
    return M.robos.filter((r) => r.st === r0.st && r.id !== de).map((r) => {
      let motivo = '';
      if (r.forca != null && r.forca < req) motivo = `pinça ${r.origem === 'existente' ? 'existente ' : ''}sem força (${kn(r.forca)} < ${kn(req)})`;
      else if (r.pontos.length >= r.cap) motivo = `cheio (${r.pontos.length}/${r.cap})`;
      return { r, ok: !motivo, motivo, alerta: r.forca == null };
    });
  }

  /* ======================= tela ======================= */
  AE.tela({
    id: 'simulacao', sigla: 'S', area: 'sim', rotulo: 'Simulação', titulo: 'Ambiente, acessos e distribuição',
    resumo: 'Primeira rodada da Simulação: levantamento da linha (retooling), estudos por PLC e zona, acesso de cada ponto, quais pontos vão em cada robô e a nuvem de pinças para a Mecânica.',
    tip: 'Abre a primeira rodada da Simulação: monta os estudos, confere o acesso de cada ponto, distribui os pontos entre os robôs e gera a nuvem de pinças.',
    entradas: [
      { de: 'separacao', o: 'Produto com os pontos' },
      { de: 'capacidade', o: 'Quantos pontos cabem em cada robô' },
      { de: 'equipamentos', o: 'Pinças e robôs disponíveis' },
    ],
    inicial: () => ({
      aba: null, semAcesso: [], resolvidos: {}, nuvem: { entregue: false, versao: null }, estudos: [],
      limitePlc: LIMITE_PLC, verificado: null, alcance: null, movidos: {}, pincasNovas: {}, trocas: {},
      biblioteca: [], levantamento: null, devolucoes: [], stSel: null,
    }),
    programador: `
      <h3>O que esta tela guarda</h3>
      <ul>
        <li><code>distribuicao</code>: <code>{'ST10-R1': [pontos]}</code>. Só é gravada na primeira mudança feita pelo usuário; antes disso a distribuição vem da capacidade do Passo 6 (reserva).</li>
        <li><code>semAcesso</code>: pontos sem acesso <b>ainda pendentes</b>. Ao resolver, o ponto sai daqui e entra em <code>resolvidos[ponto]</code> = <code>'redistribuir:ST30-R1'</code>, <code>'pinca-nova'</code> ou <code>'troca-pinca'</code>.</li>
        <li><code>nuvem</code>: <code>{entregue, versao: 'C1', hora, assinatura}</code>. A assinatura mostra quando a distribuição mudou depois da nuvem.</li>
        <li><code>estudos</code>: cada estudo montado, com <code>id</code> (PLC e zona), robôs, pinças, <code>versao</code> e assinatura dos equipamentos.</li>
        <li>Também: <code>limitePlc</code>, <code>verificado</code> (hora, pontos marcados, de qual robô), <code>alcance</code>, <code>movidos</code> (mm por robô), <code>pincasNovas</code>, <code>trocas</code>, <code>biblioteca</code>, <code>levantamento</code>, <code>devolucoes</code>.</li>
      </ul>
      <h3>Regras</h3>
      <ul>
        <li>S0 só no retooling. Linha nova: o passo é pulado.</li>
        <li>S1: um estudo por PLC e zona (cada estação cercada é uma zona). Zona com mais pinças que o limite do PLC é dividida em mais de um estudo. Equipamento fora da biblioteca precisa do 3D carregado; ele passa a fazer parte da biblioteca.</li>
        <li>Cada equipamento novo ou revisado (pinça nova, troca de pinça) muda a assinatura do estudo e pede uma versão nova (C2, C3…).</li>
        <li>S2, ponto sem acesso: 1º redistribuir para outro robô da mesma estação com capacidade; 2º pinça nova; 3º troca de pinça (soma 2 trocas por ciclo ao tempo do robô). Pular a ordem fica registrado como exceção.</li>
        <li>Robô não alcança: move o robô de 50 em 50 mm até alcançar. O deslocamento vai para o layout (Passo 7).</li>
        <li>Força da pinça nova não informada: segue e deixa um alerta. Pinça sem força suficiente para o ponto: impede o ponto nessa pinça.</li>
        <li>Pontos que não cabem na quantidade do Processo: devolve ao Processo com o motivo.</li>
        <li>A Simulação é quem define quais pontos vão em cada robô.</li>
      </ul>
      <h3>Saída</h3>
      <ul>
        <li><code>AE.calc.simulacao()</code> → <code>{distribuicao, semAcesso, nuvem}</code>. A capacidade do Passo 6 (<code>AE.calc.capacidade()</code>) já usa esta distribuição.</li>
        <li><code>nuvem</code> é lida pela Mecânica para conferir colisão das unidades. <code>movidos</code> é lido pelo Layout (Passo 7) ao atualizar as posições.</li>
      </ul>
      <h3>Macros de base</h3>
      <ul><li>Nenhuma na v0 para a Simulação. As chamadas no console são do ${'DELMIA V5'} (com CATIA) e do Process Simulate (com NX).</li></ul>
      <h3>Em aberto</h3>
      <ul>
        <li>Qual software de simulação o time usa: Process Simulate (Tecnomatix) ou DELMIA? O protótipo mostra DELMIA quando o CAD é CATIA e Process Simulate quando é NX, mas isso é suposição.</li>
        <li>Limite de pinças por PLC (6) e força necessária por número de chapas (3,2 kN para 2 chapas + 1 kN por chapa a mais) são de exemplo. De onde vêm os valores reais?</li>
        <li>Os pontos sem acesso e o robô que não alcança (80 mm) são marcados de forma fixa, para demonstração.</li>
        <li>Troca de pinça: contei 2 trocas por ciclo (pegar a pinça especial e devolver). Está certo?</li>
        <li>Pinça nova e troca de pinça mudam a lista de equipamentos: o Passo 5 deve ser atualizado automaticamente ou o Processo confirma?</li>
        <li>A versão do estudo é por estudo (PLC e zona) ou uma só para a Simulação inteira?</li>
      </ul>`,

    render(ctx) {
      const s = ctx.s, pj = AE.calc.projeto();
      if (!s.aba) s.aba = pj.tipoLinha === 'retooling' ? 's0' : 's1';
      const abas = [['s0', 'S0 · Levantamento', 'Levantamento da linha existente. Só no retooling.'], ['s1', 'S1 · Ambiente', 'Monta um estudo por PLC e zona, com produto, robôs e pinças.'],
        ['s2', 'S2 · Acessos e distribuição', 'Confere o acesso de cada ponto e define quais pontos vão em cada robô.'], ['nuvem', 'Nuvem de pinças', 'Gera a nuvem de pinças (JT e CGR) que a Mecânica usa para conferir colisão.']];
      return `
      <div class="bloco">
        <div class="abas" role="tablist" id="sm-abas">${abas.map(([v, t, tip]) => `<button role="tab" data-aba="${v}" aria-selected="${s.aba === v}" data-tip="${esc(tip)}"><span class="sm-dot" data-dot="${v}"></span>${t}</button>`).join('')}</div>
      </div>
      <div id="sm-painel" class="coluna"></div>
      <div class="bloco">
        <h2>Checagem</h2>
        <p class="sub">O passo só é concluído sem nenhum item em vermelho. A saída (distribuição e nuvem) vai para a Mecânica e volta para a capacidade do Passo 6.</p>
        <div class="checagem" id="sm-check"></div>
        <div class="barra fim" style="margin-top:14px">
          <button class="btn primario" id="sm-concluir" data-tip="Confere S0, S1, S2 e a nuvem. Se não houver item em vermelho, conclui a primeira rodada da Simulação e entrega a distribuição e a nuvem para a Mecânica.">Concluir Simulação (S0 a S2)</button>
        </div>
      </div>`;
    },

    montar(el, ctx) {
      const s = ctx.s;
      AE.css('simulacao', `
        .sm-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px;background:var(--linha2);vertical-align:middle}
        .sm-dot.ok{background:var(--ok)} .sm-dot.aviso{background:var(--aviso)} .sm-dot.erro{background:var(--erro)}
        .sm-ponto{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;background:var(--fundo);border:1px solid var(--linha);border-left:4px solid var(--erro);border-radius:6px;padding:10px 12px}
        .sm-ponto.ok{border-left-color:var(--ok)}
        .sm-ponto h3{font-family:var(--f-dado);font-size:14px;font-weight:500;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}
        .sm-ponto p{margin:0;font-size:13.5px;color:var(--suave)}
        .sm-op{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:10px;align-items:center;border-top:1px dashed var(--linha);padding-top:8px}
        .sm-op .n{font-family:var(--f-dado);color:var(--acao);font-size:15px;text-align:center}
        .sm-op small{display:block;color:var(--suave);font-size:12.5px}
        .sm-op .barra{justify-content:flex-end}
        .sm-op select{max-width:200px}
        .sm-op.fora .n{color:var(--fraco)}
        .sm-rob td{vertical-align:middle}
        .sm-rob .medidor{min-width:90px}
        .sm-rob small{color:var(--fraco);display:block;font-size:12px}
        #sm-pts td{white-space:nowrap}
        #sm-pts select{min-width:120px}
        .sm-est-sit{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
        @media (max-width:640px){.sm-op{grid-template-columns:24px minmax(0,1fr)}.sm-op .barra{grid-column:1/-1;justify-content:flex-start}}`);

      let M = ler(s);

      /* ---------- utilidades de distribuição ---------- */
      const distAtual = () => { const d = {}; AE.calc.capacidade().robos.forEach((r) => (d[r.id] = r.pontos.slice())); return d; };
      const moverPonto = (nome, para) => {
        /* primeira mudança: a distribuição sai da reserva (capacidade) e passa a ser da Simulação */
        if (!s.distribuicao) s.distribuicao = AE.util.clone(AE.calc.simulacao().distribuicao);
        const d = distAtual();
        Object.keys(d).forEach((r) => (d[r] = d[r].filter((x) => x !== nome)));
        (d[para] = d[para] || []).push(nome);
        s.distribuicao = d;
      };
      const pendAlcance = () => s.alcance && !s.alcance.ok;
      const acimaCap = () => M.robos.filter((r) => r.pontos.length > r.cap || r.tempo > r.disp + 1e-6);
      const nuvemAtual = () => s.nuvem && s.nuvem.entregue && s.nuvem.assinatura === M.assinatura;
      const estudosOk = () => M.estudos.every((e) => situacaoEstudo(e, s).st === 'ok');
      const irAba = (a) => { s.aba = a; ctx.salvarUI(); desenhar(); };

      /* ---------- S0 ---------- */
      const painelS0 = () => {
        if (M.pj.tipoLinha !== 'retooling') {
          return `<div class="bloco"><h2>S0 · Levantamento da linha existente</h2>
            <div class="faixa-aviso verde"><span><b>Pulado: linha nova.</b> Não há linha existente para levantar. Este passo só existe no retooling.</span>
            <a class="btn mini leve" href="#/inicio" data-tip="Abre o Passo 0, onde o tipo de linha (nova ou retooling) é escolhido.">Mudar no Passo 0</a></div>
            <p class="sub" style="margin:12px 0 0">Precisa receber: linha atual (robôs, pinças, programas), do cliente. Entrega: relatório do estado da linha.</p></div>`;
        }
        const ex = M.eq.filter((i) => (i.tipo === 'robo' || i.tipo === 'pinca') && i.origem === 'existente');
        const L = s.levantamento;
        return `<div class="bloco"><h2>S0 · Levantamento da linha existente</h2>
          <p class="sub">Retooling: antes de montar o ambiente, a Simulação traz a linha atual (robôs, pinças e programas) e faz o relatório do estado da linha.</p>
          ${ex.length ? `<div class="rolagem"><table><thead><tr><th>Estação</th><th>Equipamento</th><th class="num">Qtd</th><th>Levantamento</th></tr></thead><tbody>
            ${ex.map((i) => `<tr><td>ST${esc(i.st)}</td><td>${esc(i.modelo)}</td><td class="num">${esc(i.qtd)}</td><td>${L ? '<span class="pilula ok">Conferido na linha</span>' : '<span class="pilula neutro">A levantar</span>'}</td></tr>`).join('')}</tbody></table></div>`
            : '<div class="vazio">Nenhum robô ou pinça marcado como existente na lista de equipamentos (Passo 5).</div>'}
          <div class="barra" style="margin-top:12px">
            <button class="btn" data-acao="levantar" data-tip="Importa os programas e as posições dos robôs existentes para o ${esc(softSim())} e confere cada equipamento da lista com a linha real.">Importar levantamento da linha</button>
            <button class="btn ${L && !L.relatorio ? 'primario' : ''}" data-acao="relatorio" data-tip="Gera o relatório do estado da linha (o que existe, o que é reaproveitado e o que precisa de reforma) e salva em 14.4_Simulação.">Gerar relatório do estado da linha</button>
          </div>
          <p class="nota ${L && L.relatorio ? 'ok' : ''}">${L ? `Levantamento importado às ${esc(L.hora)}.${L.relatorio ? ' Relatório gerado.' : ' Falta o relatório.'}` : 'Ainda não levantado. Se o cliente não mandou a linha atual, este passo fica pendente.'}</p></div>`;
      };

      /* ---------- S1 ---------- */
      const painelS1 = () => {
        const fora = foraBiblioteca(M, s);
        const oriEq = ctx.origem('equipamentos'), oriSep = ctx.origem('separacao');
        const linhas = M.estudos.map((e) => {
          const sit = situacaoEstudo(e, s);
          const pil = sit.st === 'ok' ? `<span class="pilula ok">Montado · ${esc(sit.m.versao)}</span>`
            : sit.st === 'mudou' ? `<span class="pilula aviso" data-tip="Um equipamento deste estudo foi trocado ou revisado (pinça nova, troca de pinça, outro modelo). Monte de novo: vira uma versão nova.">Equipamento mudou · era ${esc(sit.m.versao)}</span>`
            : '<span class="pilula neutro">A montar</span>';
          return `<tr><td><b>${esc(e.id)}</b></td><td>PLC ${e.plc}</td><td>${esc(e.zona)}</td><td>${e.robos.map(esc).join(', ')}</td><td class="num">${e.pincas}</td>
            <td><div class="sm-est-sit">${pil}<button class="btn mini" data-acao="montar" data-id="${esc(e.id)}" data-tip="Monta o estudo no ${esc(softSim())}: produto da ${esc(e.zona)} na posição de montagem, robôs, pinças e dispositivo, tudo dentro da zona de segurança.">${sit.st === 'amontar' ? 'Montar estudo' : sit.st === 'mudou' ? 'Montar de novo' : 'Remontar'}</button></div></td></tr>`;
        }).join('');
        return `<div class="bloco"><h2>S1 · Montar o ambiente <span class="exemplo">dados de exemplo</span></h2>
          <p class="sub">Um estudo por PLC e zona de segurança, no ${esc(softSim())}. Quando a zona tem mais pinças que o limite do PLC, ela vira mais de um estudo.</p>
          ${oriEq !== 'tela' ? '<p class="nota aviso">Os equipamentos do Passo 5 ainda não foram concluídos: o estudo começa com o produto e os equipamentos de reserva. Quando o Passo 5 concluir, os estudos com equipamento diferente pedem versão nova.</p>' : ''}
          ${oriSep !== 'tela' ? '<p class="nota aviso">O produto separado (Passo 1) ainda não foi concluído: os pontos usados aqui são os de reserva.</p>' : ''}
          <div class="campos" style="margin:12px 0">
            <label class="campo">Limite de pinças por PLC <input type="number" id="sm-lim" min="1" max="20" value="${esc(s.limitePlc)}" data-tip="Quantas pinças um PLC controla. Vem do padrão de automação do cliente (o valor aqui é exemplo)."></label>
            <div class="kpi"><span>Estudos propostos</span><b>${M.estudos.length}</b><small>${new Set(M.estudos.map((e) => e.plc)).size} PLC(s)</small></div>
          </div>
          <div class="rolagem"><table><thead><tr><th>Estudo</th><th>PLC</th><th>Zona</th><th>Robôs</th><th class="num">Pinças</th><th>Situação</th></tr></thead><tbody>${linhas || '<tr><td colspan="6"><div class="vazio">Nenhuma estação com robô. Defina as estações no Passo 4.</div></td></tr>'}</tbody></table></div>
          <div class="barra" style="margin-top:12px">
            <button class="btn primario" data-acao="montar-todos" data-tip="Monta, um por um, todos os estudos que ainda não estão montados ou cujo equipamento mudou.">Montar todos os estudos</button>
          </div>
          <h3 class="rotulo-sec">Biblioteca de robôs e pinças</h3>
          ${fora.length ? `<div class="lista">${fora.map((f) => `<div class="item"><span class="pilula aviso">fora da biblioteca</span><span>${esc(f.modelo)}<small>${esc(f.tipo)} da lista de equipamentos</small></span>
              <button class="btn mini" data-acao="biblioteca" data-modelo="${esc(f.modelo)}" data-tip="Abre o 3D do fornecedor, converte e grava na biblioteca do programa. A partir daí o equipamento pode entrar nos estudos.">Carregar 3D e incluir</button></div>`).join('')}</div>`
            : `<p class="nota ok">Todos os robôs e pinças da lista estão na biblioteca${(s.biblioteca || []).length ? ` (${s.biblioteca.length} incluído(s) neste projeto)` : ''}.</p>`}</div>`;
      };

      /* ---------- S2 ---------- */
      const htmlPendente = (nome) => {
        const p = M.porNome[nome], de = M.dono[nome], r0 = M.roboDe(de);
        if (!p || !r0) return '';
        const req = forcaReq(p.chapas);
        const nenhum = s.verificado && (s.verificado.semNenhum || []).includes(nome);
        const cands = nenhum ? [] : candidatos(M, nome, de);
        const okC = cands.filter((c) => c.ok);
        const temTroca = r0.troca.length > 0;
        const tempoTroca = r0.tempo + (temTroca ? 0 : 2 * M.tp.trocaPinca);
        return `<div class="sm-ponto"><h3>${esc(nome)} <span class="pilula erro">Sem acesso</span><span class="chip proc">${esc(de)}</span></h3>
          <p>${esc(p.chapas)} chapas (${p.pecas.map(esc).join(' + ')}) · precisa de ${kn(req)} · pinça atual: ${esc(r0.pinca)}${nenhum ? ' · nenhum robô da estação acessa com a pinça atual' : ''}</p>
          <div class="sm-op ${okC.length ? '' : 'fora'}"><span class="n">1º</span><div>Redistribuir para outro robô da ST${r0.st}
              <small>${okC.length ? `Robôs com capacidade e força: ${okC.map((c) => c.r.id + ' (' + c.r.pontos.length + '/' + c.r.cap + ')').join(', ')}.` : nenhum ? 'Não resolve: nenhum robô da estação chega a este ponto com a pinça atual.' : cands.length ? 'Nenhum robô livre: ' + cands.map((c) => c.r.id + ' ' + c.motivo).join('; ') + '.' : 'A estação só tem este robô.'}</small></div>
            <div class="barra">${okC.length ? `<select data-alvo="${esc(nome)}" aria-label="Robô que recebe o ponto">${okC.map((c) => `<option value="${esc(c.r.id)}">${esc(c.r.id)}${c.alerta ? ' (força não informada)' : ''}</option>`).join('')}</select>
              <button class="btn mini primario" data-acao="redistribuir" data-ponto="${esc(nome)}" data-tip="Passa o ponto para o robô escolhido, no estudo e na distribuição. É a primeira opção da regra.">Redistribuir</button>` : ''}</div></div>
          <div class="sm-op"><span class="n">2º</span><div>Pinça nova no ${esc(de)}
              <small>${s.pincasNovas[de] ? `Já testada neste robô: ${esc(s.pincasNovas[de].modelo)}, força ${kn(s.pincasNovas[de].forca)}.` : `Testa a ${esc(PINCA_NOVA)} no robô. A pinça nova entra na lista de equipamentos.`}</small></div>
            <div class="barra"><button class="btn mini" data-acao="pinca-nova" data-ponto="${esc(nome)}" data-tip="Testa uma pinça nova neste robô para alcançar o ponto. Pede a força máxima do fabricante; sem ela, segue com alerta.">Pinça nova</button></div></div>
          <div class="sm-op"><span class="n">3º</span><div>Troca de pinça no ${esc(de)}
              <small>Soma 2 trocas por ciclo (${seg(2 * M.tp.trocaPinca)}): tempo do robô ${seg(tempoTroca)} para ${seg(r0.disp)} disponíveis${tempoTroca > r0.disp ? ', não cabe no ciclo' : ''}.</small></div>
            <div class="barra"><button class="btn mini" data-acao="troca-pinca" data-ponto="${esc(nome)}" data-tip="Inclui um trocador e uma segunda pinça neste robô só para este ponto. Soma o tempo de troca ao ciclo do robô.">Troca de pinça</button></div></div>
        </div>`;
      };
      const htmlResolvido = (nome) => {
        const a = s.resolvidos[nome] || '';
        const [tipo, alvo] = a.split(':');
        return `<div class="sm-ponto ok"><h3>${esc(nome)} <span class="pilula ok">${esc(ACOES[tipo] || a)}${alvo ? ' → ' + esc(alvo) : ''}</span>
          <button class="btn mini leve" data-acao="desfazer" data-ponto="${esc(nome)}" data-tip="Desfaz a solução deste ponto: ele volta para a lista de pontos sem acesso.">Desfazer</button></h3></div>`;
      };
      const painelS2 = () => {
        const ests = M.ee.estacoes.filter((e) => M.robos.some((r) => r.st === e.st));
        if (!ests.length) return '<div class="bloco"><h2>S2 · Acessos e distribuição</h2><div class="vazio">Nenhum robô para distribuir. Defina as estações (Passo 4) e a capacidade (Passo 6).</div></div>';
        if (!ests.some((e) => e.st === s.stSel)) s.stSel = ests[0].st;
        const v = s.verificado;
        const resolvidosVer = v ? (v.marcados || []).filter((n) => s.resolvidos[n] && M.dono[n]) : [];
        const pend = (s.semAcesso || []).filter((n) => M.dono[n]);
        const acima = acimaCap();
        const alertasForca = M.robos.filter((r) => r.forca == null);
        const rs = M.robos.filter((r) => r.st === s.stSel);
        const pts = rs.flatMap((r) => r.pontos.map((n) => ({ n, r })));
        const al = s.alcance;
        return `
        <div class="bloco"><h2>S2 · Acessos <span class="exemplo">dados de exemplo</span></h2>
          <p class="sub">A verificação confere, no estudo, se a pinça de cada robô chega em cada ponto sem colidir. Para cada ponto sem acesso a regra tem uma ordem: 1º redistribuir, 2º pinça nova, 3º troca de pinça.</p>
          <div class="kpis">
            <div class="kpi"><span>Pontos no ciclo</span><b>${Object.keys(M.dono).length}</b><small>em ${M.robos.length} robôs</small></div>
            <div class="kpi ${pend.length ? 'erro' : v ? 'ok' : ''}"><span>Sem acesso pendentes</span><b>${v ? pend.length : '—'}</b><small>${v ? `${resolvidosVer.length} resolvido(s)` : 'verificação não rodada'}</small></div>
            <div class="kpi ${pendAlcance() ? 'erro' : al ? 'ok' : ''}"><span>Robô não alcança</span><b>${al ? (al.ok ? 0 : 1) : '—'}</b><small>${al ? (al.ok ? `${esc(al.robo)} movido ${al.movido} mm` : `${esc(al.robo)}: faltam ${al.falta - al.movido} mm`) : 'verificação não rodada'}</small></div>
            <div class="kpi ${acima.length ? 'erro' : 'ok'}"><span>Robôs acima da capacidade</span><b>${acima.length}</b><small>pontos ou tempo</small></div>
          </div>
          <div class="barra" style="margin-top:12px">
            <button class="btn primario" data-acao="verificar" data-tip="Roda a verificação de acesso e alcance de todos os pontos no ${esc(softSim())} e marca os pontos sem acesso e os robôs que não alcançam.">${v ? 'Rodar verificação de novo' : 'Rodar verificação de acesso'}</button>
            <span class="sub" style="margin:0">${v ? `Última verificação às ${esc(v.hora)}.` : 'Ainda não rodada.'}</span>
          </div>
          ${alertasForca.length ? `<p class="nota aviso">Alerta: força não informada na pinça de ${alertasForca.map((r) => esc(r.id)).join(', ')}. O programa seguiu; verifique com o fabricante.</p>` : ''}
          ${al && !al.ok ? `<h3 class="rotulo-sec">Robô não alcança</h3>
            <div class="sm-ponto"><h3>${esc(al.ponto)} <span class="pilula erro">Fora do alcance</span><span class="chip proc">${esc(al.robo)}</span></h3>
              <p>Faltam ${al.falta - al.movido} mm. Regra: move o robô de 50 em 50 mm em direção ao ponto até alcançar. O deslocamento vai para o layout (Passo 7).</p>
              <div class="barra"><button class="btn mini primario" data-acao="mover-robo" data-tip="Move o robô 50 mm em direção ao ponto no estudo e confere o alcance de novo.">Mover o robô 50 mm</button><span class="sub" style="margin:0">Movido até agora: ${al.movido} mm</span></div></div>` : ''}
          ${al && al.ok ? `<p class="nota ok">${esc(al.robo)} foi movido ${al.movido} mm e agora alcança ${esc(al.ponto)}.</p>` : ''}
          ${v ? `<h3 class="rotulo-sec">Pontos sem acesso</h3><div class="lista">${pend.map(htmlPendente).join('')}${resolvidosVer.map(htmlResolvido).join('')}</div>
            ${!pend.length && !resolvidosVer.length ? '<div class="vazio">Nenhum ponto sem acesso.</div>' : ''}`
            : '<div class="vazio" style="margin-top:12px">Rode a verificação para ver os pontos sem acesso. Os estudos do S1 precisam estar montados.</div>'}
        </div>

        <div class="bloco"><h2>Distribuição dos pontos</h2>
          <p class="sub">Quantos pontos o Processo disse que cabem em cada robô (Passo 6) e quais pontos a Simulação colocou em cada um. ${s.distribuicao ? 'A distribuição já foi alterada aqui e volta para o Passo 6.' : 'Ainda é a proposta do Passo 6 (reserva): mude um ponto de robô para a Simulação assumir.'}</p>
          <div class="abas" id="sm-st" role="tablist" aria-label="Estação">${ests.map((e) => `<button role="tab" data-st="${e.st}" aria-selected="${e.st === s.stSel}" data-tip="${esc('Mostra os robôs e os pontos da ST' + e.st + '.')}">ST${e.st}${M.robos.some((r) => r.st === e.st && (r.pontos.length > r.cap || r.tempo > r.disp)) ? ' ⚠' : ''}</button>`).join('')}</div>
          <div class="rolagem" style="margin-top:12px"><table class="sm-rob"><thead><tr><th>Robô</th><th>Pinça</th><th>Pontos × capacidade</th><th>Tempo × disponível</th><th>Situação</th></tr></thead><tbody>
            ${rs.map((r) => {
              const oc = r.cap ? r.pontos.length / r.cap : 1, cls = oc > 1 ? 'erro' : oc > 0.9 ? 'aviso' : '';
              const tOk = r.tempo <= r.disp + 1e-6;
              return `<tr><td><b>${esc(r.id)}</b></td><td>${esc(r.pinca)}<small>força ${kn(r.forca)}${r.nova ? ' · pinça nova' : ''}${r.troca.length ? ' · + troca de pinça' : ''}</small></td>
                <td><div class="medidor ${cls}" data-tip="${esc(`${r.pontos.length} pontos para ${r.cap} que cabem no ciclo (Passo 6).`)}"><i style="width:${Math.min(100, oc * 100)}%"></i></div><small>${r.pontos.length} de ${r.cap}</small></td>
                <td>${seg(r.tempo)}<small>de ${seg(r.disp)}${r.troca.length ? ' · inclui 2 trocas' : ''}</small></td>
                <td>${r.pontos.length > r.cap ? `<span class="pilula erro">${r.pontos.length - r.cap} ponto(s) a mais</span>` : !tOk ? '<span class="pilula erro">Não cabe no ciclo</span>' : '<span class="pilula ok">Cabe</span>'}</td></tr>`;
            }).join('')}</tbody></table></div>
          ${acima.length ? `<div class="faixa-aviso" style="margin-top:12px"><span><b>Não cabe na quantidade do Processo:</b> ${acima.map((r) => `${esc(r.id)} (${r.pontos.length}/${r.cap} pontos, ${seg(r.tempo)} de ${seg(r.disp)})`).join('; ')}. Mova pontos para um robô com folga ou devolva ao Processo.</span></div>` : ''}
          <h3 class="rotulo-sec">Pontos da ST${esc(s.stSel)} (${pts.length})</h3>
          <div class="rolagem alta"><table id="sm-pts"><thead><tr><th>Ponto</th><th class="num">Chapas</th><th class="num">Força nec.</th><th>Acesso</th><th>Robô</th></tr></thead><tbody>
            ${pts.map(({ n, r }) => {
              const p = M.porNome[n] || { chapas: 2 }, req = forcaReq(p.chapas);
              const pendente = pend.includes(n), res = s.resolvidos[n];
              const ops = rs.map((x) => {
                const semForca = x.forca != null && x.forca < req;
                return `<option value="${esc(x.id)}" ${x.id === r.id ? 'selected' : ''} ${semForca ? 'disabled' : ''}>${esc(x.id)}${semForca ? ' (sem força)' : x.id !== r.id && x.pontos.length >= x.cap ? ' (cheio)' : ''}</option>`;
              }).join('');
              return `<tr><td class="mono">${esc(n)}</td><td class="num">${esc(p.chapas)}</td><td class="num">${fmt(req, 1)} kN</td>
                <td>${pendente ? '<span class="pilula erro">Sem acesso</span>' : res ? `<span class="pilula ok">${esc(ACOES[res.split(':')[0]] || res)}</span>` : v ? '<span class="pilula ok">OK</span>' : '<span class="pilula neutro">Não verificado</span>'}</td>
                <td><select data-mover="${esc(n)}" aria-label="${esc('Robô do ponto ' + n)}" ${pendente ? 'disabled data-tip="Ponto sem acesso: resolva pelo quadro de pontos sem acesso, na ordem da regra."' : 'data-tip="Passa este ponto para outro robô da mesma estação. Pinça sem força suficiente fica bloqueada."'}>${ops}</select></td></tr>`;
            }).join('')}</tbody></table></div>
          <div class="barra" style="margin-top:12px">
            <button class="btn ${acima.length ? 'primario' : ''}" data-acao="devolver" data-tip="Devolve ao Processo (Passo 6) o que não coube, com o motivo escrito. Fica no registro do projeto.">Devolver ao Processo com o motivo</button>
            ${s.distribuicao ? '<button class="btn leve" data-acao="refazer" data-tip="Apaga a distribuição feita aqui e volta para a proposta do Passo 6. Desfaz as redistribuições.">Voltar à proposta do Passo 6</button>' : ''}
          </div>
          ${(s.devolucoes || []).length ? `<div class="registro">${s.devolucoes.slice(-4).reverse().map((d) => `<span>${esc(d.hora)} · devolvido ao Processo: ${esc(d.motivo)}</span>`).join('')}</div>` : ''}
        </div>`;
      };

      /* ---------- Nuvem ---------- */
      const painelNuvem = () => {
        const n = s.nuvem || {};
        const atual = nuvemAtual();
        const pend = (s.semAcesso || []).filter((x) => M.dono[x]);
        const temConf = AE.telas.conferir && !AE.telas.conferir.aFazer;
        return `<div class="bloco"><h2>Nuvem de pinças <span class="exemplo">dados de exemplo</span></h2>
          <p class="sub">A nuvem é a pinça desenhada em cada ponto de solda, na posição em que o robô vai soldar. Sai em JT (visualização leve) e CGR (para abrir no CATIA). A Mecânica (M3, conferir alertas) importa a nuvem e confere a colisão de cada unidade do dispositivo, com o grampo aberto e fechado.</p>
          ${n.entregue ? (atual ? `<div class="faixa-aviso verde"><span>Nuvem <b>${esc(n.versao)}</b> entregue às ${esc(n.hora || '')}: ${esc(n.pontos || 0)} posições de pinça.</span>${temConf ? '<a class="btn mini" href="#/conferir" data-tip="Abre a tela da Mecânica onde a nuvem é importada e a colisão é conferida.">Ver na Mecânica</a>' : ''}</div>`
              : `<div class="faixa-aviso amarela"><span>A distribuição ou as pinças mudaram depois da nuvem <b>${esc(n.versao)}</b>. Gere de novo: vira a próxima versão e a Mecânica confere outra vez.</span></div>`)
            : '<div class="faixa-aviso amarela"><span>Nuvem ainda não gerada. Enquanto ela não chega, a Mecânica modela assim mesmo e marca as unidades para conferência.</span></div>'}
          <div class="rolagem" style="margin-top:12px"><table><thead><tr><th>Robô</th><th>Pinça</th><th class="num">Posições</th><th>Formato</th></tr></thead><tbody>
            ${M.robos.map((r) => `<tr><td>${esc(r.id)}</td><td>${esc(r.pinca)}${r.troca.length ? `<br><small style="color:var(--suave)">+ ${esc(PINCA_NOVA)} (troca) em ${r.troca.length} ponto(s)</small>` : ''}</td><td class="num">${r.pontos.filter((x) => !pend.includes(x)).length}</td><td>JT · CGR</td></tr>`).join('')}
          </tbody></table></div>
          ${pend.length ? `<p class="nota aviso">${pend.length} ponto(s) sem acesso ficam fora da nuvem até serem resolvidos no S2.</p>` : ''}
          <div class="barra" style="margin-top:12px">
            <button class="btn primario" data-acao="nuvem" data-tip="Coloca a pinça de cada robô em cada ponto dele, exporta em JT e CGR para 14.4_Simulação e entrega à Mecânica como versão nova (C1, C2…).">Gerar nuvem de pinças (JT e CGR)</button>
          </div></div>`;
      };

      /* ---------- checagem ---------- */
      const checagem = () => {
        const retool = M.pj.tipoLinha === 'retooling';
        const L = s.levantamento;
        const nEst = M.estudos.length, nOk = M.estudos.filter((e) => situacaoEstudo(e, s).st === 'ok').length;
        const fora = foraBiblioteca(M, s);
        const pend = (s.semAcesso || []).filter((n) => M.dono[n]);
        const acima = acimaCap();
        const semForca = M.robos.filter((r) => r.forca == null);
        const itens = [
          ['S0 · Levantamento da linha', !retool || !!(L && L.relatorio), 'erro', retool ? (L ? 'Falta gerar o relatório do estado da linha' : 'Importe o levantamento da linha (aba S0)') : '', !retool ? 'Pulado: linha nova' : ''],
          ['S1 · Equipamentos na biblioteca', !fora.length, 'erro', `${fora.length} fora da biblioteca: carregue o 3D (aba S1)`],
          ['S1 · Estudos montados e atualizados', nEst > 0 && nOk === nEst, 'erro', `${nOk} de ${nEst} montados: use "Montar todos os estudos" (aba S1)`],
          ['S2 · Verificação de acesso rodada', !!s.verificado, 'erro', 'Rode a verificação de acesso (aba S2)'],
          ['S2 · Pontos sem acesso resolvidos', !!s.verificado && !pend.length, 'erro', s.verificado ? `${pend.length} pendente(s): resolva na ordem da regra (aba S2)` : 'Depende da verificação'],
          ['S2 · Robôs alcançam todos os pontos', !!s.verificado && !pendAlcance(), 'erro', s.verificado ? 'Mova o robô de 50 em 50 mm (aba S2)' : 'Depende da verificação'],
          ['S2 · Pontos cabem na quantidade do Processo', !acima.length, 'erro', `${acima.map((r) => r.id).join(', ')}: mova pontos ou devolva ao Processo`],
          ['S2 · Força das pinças informada', !semForca.length, 'aviso', `Alerta: ${semForca.map((r) => r.id).join(', ')} sem força informada (segue, verificar depois)`],
          ['Nuvem de pinças entregue e atualizada', nuvemAtual(), 'erro', s.nuvem && s.nuvem.entregue ? 'A distribuição mudou: gere a nuvem de novo' : 'Gere a nuvem de pinças (aba Nuvem)'],
        ];
        $('#sm-check', el).innerHTML = itens.map((i) => `<div><span>${esc(i[0])}</span>${i[1] ? `<span class="pilula ok">${esc(i[4] || 'Certo')}</span>` : `<span class="pilula ${i[2]}" style="white-space:normal">${esc(i[3])}</span>`}</div>`).join('');
        /* bolinhas das abas */
        const dot = (ok, parcial) => (ok ? 'ok' : parcial ? 'aviso' : '');
        const marca = { s0: dot(itens[0][1], !!L), s1: dot(itens[1][1] && itens[2][1], nOk > 0), s2: dot(itens[4][1] && itens[5][1] && itens[6][1], !!s.verificado), nuvem: dot(itens[8][1], s.nuvem && s.nuvem.entregue) };
        $$('[data-dot]', el).forEach((d) => (d.className = 'sm-dot ' + (marca[d.dataset.dot] || '')));
        return itens;
      };

      const desenhar = () => {
        M = ler(s);
        $$('#sm-abas [data-aba]', el).forEach((b) => b.setAttribute('aria-selected', b.dataset.aba === s.aba));
        const f = { s0: painelS0, s1: painelS1, s2: painelS2, nuvem: painelNuvem }[s.aba] || painelS1;
        $('#sm-painel', el).innerHTML = f();
        checagem();
      };
      desenhar();

      /* ---------- ações ---------- */
      $('#sm-abas', el).onclick = (e) => { const b = e.target.closest('[data-aba]'); if (b) irAba(b.dataset.aba); };

      const montarEstudo = async (est, botao) => {
        const fora = foraBiblioteca(M, s).filter((f) => est.robos.some((id) => { const r = M.roboDe(id); return r && (r.pinca === f.modelo || r.roboModelo === f.modelo); }));
        if (fora.length) { ctx.avisa(`O estudo ${est.id} usa ${fora[0].modelo}, que está fora da biblioteca. Carregue o 3D primeiro.`, { tipo: 'erro' }); return false; }
        const sit = situacaoEstudo(est, s);
        const versao = sit.m ? 'C' + (Number(String(sit.m.versao).slice(1)) + 1) : 'C1';
        const lista = est.robos.map((r) => `"${r}"`).join(', ');
        const ok = await ctx.cad({
          titulo: `Montar estudo ${est.id} (${versao}) no ${softSim()}`,
          catia: `' DELMIA V5 (Robotics), pela automação COM do CATIA\nSet proc = CATIA.Documents.Add("Process")\nproc.GetItem("ProcessDocument").AddProduct produto${est.zona}  ' produto na posição de montagem\nFor Each r In Array(${lista}) : proc.GetItem("ResourcesList").AddResource biblioteca & r & ".CATProduct" : Next\nproc.SaveAs pasta & "\\14.4_Simulação\\${est.id}_${versao}.CATProcess"`,
          nx: `// Process Simulate (Tecnomatix .NET API)\nvar doc = TxApplication.ActiveDocument;\nvar est = doc.OperationRoot.CreateCompoundOperation(new TxCompoundOperationCreationData("${est.id}"));\nforeach (var r in new[]{ ${lista} })\n  doc.PhysicalRoot.InsertComponent(new TxInsertComponentCreationData(r, biblioteca + r + ".cojt"));\n// produto da ${est.zona} na posição de montagem, zona de segurança do PLC ${est.plc}`,
          macro: 'Nenhuma na v0',
          resultado: `Estudo ${est.id} ${versao}: ${est.robos.length} robô(s), ${est.pincas} pinça(s), produto e dispositivo da ${est.zona}.`,
        }, botao);
        if (!ok) return false;
        s.estudos = (s.estudos || []).filter((x) => x.id !== est.id);
        s.estudos.push({ id: est.id, plc: est.plc, zona: est.zona, robos: est.robos, pincas: est.pincas, versao, hora: AE.util.hora(), assinatura: est.assinatura });
        ctx.salvar();
        ctx.registrar(`Estudo ${est.id} montado, versão ${versao} (${est.robos.length} robôs, ${est.pincas} pinças).`);
        return true;
      };

      const resolver = (nome, acao) => {
        s.resolvidos[nome] = acao;
        s.semAcesso = (s.semAcesso || []).filter((x) => x !== nome);
      };
      /* a regra tem ordem: quem pula a 1ª opção registra o motivo */
      const excecaoOrdem = async (nome, opcao) => {
        const de = M.dono[nome];
        const nenhum = s.verificado && (s.verificado.semNenhum || []).includes(nome);
        const livres = nenhum ? [] : candidatos(M, nome, de).filter((c) => c.ok);
        const antes = [];
        if (livres.length) antes.push('redistribuir (' + livres.map((c) => c.r.id).join(', ') + ' tem capacidade)');
        if (opcao === 3 && !s.pincasNovas[de]) antes.push('pinça nova');
        if (!antes.length) return '';
        const mot = await ctx.perguntar({ titulo: 'Fora da ordem da regra', texto: `A regra pede tentar antes: ${antes.join(' e ')}. Para seguir assim mesmo, escreva o motivo. Fica registrado como exceção.`, campo: 'Motivo', ok: 'Seguir com exceção' });
        return mot == null ? null : mot;
      };

      el.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-acao]'); if (!b || !el.contains(b)) return;
        const a = b.dataset.acao;

        if (a === 'levantar') {
          const ok = await ctx.cad({
            titulo: `Importar levantamento da linha existente no ${softSim()}`,
            catia: `' DELMIA V5: upload dos programas dos robôs existentes\nFor Each r In robosExistentes : r.ImportRobotProgram pastaLinha & "\\" & r.Name : Next`,
            nx: `// Process Simulate: upload dos programas existentes\nforeach (var r in robosExistentes) TxOlpControllerUtilities.Upload(r, pastaLinha + r.Name);`,
            macro: 'Nenhuma na v0', resultado: 'Programas e posições da linha atual importados; equipamentos conferidos com a lista.',
          }, b);
          if (!ok) return;
          s.levantamento = { hora: AE.util.hora(), relatorio: false };
          ctx.salvar(); ctx.registrar('S0: levantamento da linha existente importado.'); desenhar();
          ctx.avisa('Levantamento importado. Falta gerar o relatório do estado da linha.', { tipo: 'ok' });
        }
        if (a === 'relatorio') {
          if (!s.levantamento) { ctx.avisa('Importe o levantamento da linha antes: o relatório é feito em cima dele.', { tipo: 'aviso' }); return; }
          s.levantamento.relatorio = true; s.levantamento.horaRel = AE.util.hora();
          ctx.salvar(); ctx.registrar('S0: relatório do estado da linha gerado em 14.4_Simulação.'); desenhar();
          ctx.avisa('Relatório do estado da linha salvo em 14.4_Simulação.', { tipo: 'ok' });
        }

        if (a === 'montar') {
          const est = M.estudos.find((x) => x.id === b.dataset.id); if (!est) return;
          if (await montarEstudo(est, b)) { desenhar(); ctx.avisa(`Estudo ${est.id} montado.`, { tipo: 'ok' }); }
        }
        if (a === 'montar-todos') {
          const falta = M.estudos.filter((x) => situacaoEstudo(x, s).st !== 'ok');
          if (!falta.length) { ctx.avisa('Todos os estudos já estão montados e atualizados.'); return; }
          let n = 0;
          for (const est of falta) { if (!(await montarEstudo(est, b))) break; n++; }
          desenhar();
          if (n) ctx.avisa(`${n} estudo(s) montado(s). Próximo: rodar a verificação de acesso (S2).`, { tipo: 'ok', acao: { texto: 'Ir para S2', fn: () => irAba('s2') } });
        }
        if (a === 'biblioteca') {
          const modelo = b.dataset.modelo;
          const ok = await ctx.cad({
            titulo: `Incluir na biblioteca: ${modelo}`,
            catia: `Set doc = CATIA.Documents.Open(arquivoDoFornecedor)  ' STEP ou CATPart\ndoc.SaveAs biblioteca & "\\${modelo.replace(/[^\w]+/g, '_')}.CATProduct"`,
            nx: `// Process Simulate: converte o 3D do fornecedor para a biblioteca (.cojt)\nTxApplication.ActiveDocument.PhysicalRoot.InsertComponent(new TxInsertComponentCreationData("${modelo.replace(/"/g, '')}", arquivoDoFornecedor));`,
            macro: 'Nenhuma na v0', resultado: `${modelo} gravado na biblioteca do programa.`,
          }, b);
          if (!ok) return;
          s.biblioteca = (s.biblioteca || []).concat(modelo);
          ctx.salvar(); ctx.registrar(`Biblioteca: ${modelo} incluído a partir do 3D do fornecedor.`); desenhar();
        }

        if (a === 'verificar') {
          if (!M.estudos.length) { ctx.avisa('Não há robôs para verificar. Defina as estações (Passo 4).', { tipo: 'aviso' }); return; }
          if (!estudosOk()) { ctx.avisa('A verificação roda dentro dos estudos. Monte os estudos do S1 primeiro.', { tipo: 'aviso', acao: { texto: 'Ir para S1', fn: () => irAba('s1') } }); return; }
          const ok = await ctx.cad({
            titulo: `Verificar acesso e alcance dos pontos no ${softSim()}`,
            catia: `' DELMIA V5: alcance e colisão da pinça em cada ponto (tag)\nFor Each tag In tagGroup.Tags\n  ok = robo.GetReachability(tag)   ' + colisão pinça × produto × dispositivo\nNext`,
            nx: `// Process Simulate\nforeach (TxWeldLocationOperation loc in op.Children) {\n  var sol = robot.CalcInverseSolutions(new TxRobotInverseData(loc.AbsoluteLocation));\n  acesso[loc.Name] = sol.Count > 0 && !colisao.Check(pinca, loc);\n}`,
            macro: 'Nenhuma na v0', resultado: 'Acesso e alcance conferidos em todos os pontos.', ms: 900,
          }, b);
          if (!ok) return;
          M = ler(s);
          const marcados = Object.keys(M.dono).filter((n) => M.porNome[n] && SEM_ACESSO(M.porNome[n]));
          const pend = marcados.filter((n) => !s.resolvidos[n]);
          const de = {};
          pend.forEach((n) => (de[n] = M.dono[n]));
          s.semAcesso = pend;
          s.verificado = { hora: AE.util.hora(), marcados, semNenhum: marcados.filter((n) => SEM_NENHUM(M.porNome[n])), de };
          const pa = Object.keys(M.dono).find((n) => ALCANCE.ponto.test(n));
          if (pa && !(s.alcance && s.alcance.ponto === pa && s.alcance.ok)) {
            const robo = M.dono[pa];
            const movido = Number(s.movidos[robo]) || 0;
            s.alcance = { ponto: pa, robo, falta: ALCANCE.falta, movido, ok: movido >= ALCANCE.falta };
          }
          ctx.salvar();
          ctx.registrar(`S2: verificação de acesso. ${pend.length} ponto(s) sem acesso${s.alcance && !s.alcance.ok ? `, ${s.alcance.robo} não alcança ${s.alcance.ponto}` : ''}.`);
          desenhar();
          ctx.avisa(pend.length ? `${pend.length} ponto(s) sem acesso. Resolva cada um na ordem da regra: 1º redistribuir, 2º pinça nova, 3º troca de pinça.` : 'Todos os pontos com acesso.', { tipo: pend.length ? 'aviso' : 'ok' });
        }

        if (a === 'redistribuir') {
          const nome = b.dataset.ponto, sel = $(`select[data-alvo="${CSS.escape(nome)}"]`, el);
          const alvo = sel && sel.value; if (!alvo) return;
          const ok = await ctx.cad({
            titulo: `Passar ${nome} para ${alvo}`,
            catia: `' DELMIA V5: tira o ponto da tarefa de um robô e põe na do outro\ntarefa${M.dono[nome].replace(/\W/g, '')}.RemoveTag "${nome}" : tarefa${alvo.replace(/\W/g, '')}.AddTag "${nome}"`,
            nx: `// Process Simulate: move a operação de solda para o programa do outro robô\nvar loc = doc.GetObjectsByName("${nome}")[0]; programa["${alvo}"].AddOperation(loc);`,
            macro: 'Nenhuma na v0', resultado: `${nome} agora é soldado pelo ${alvo}, com acesso.`,
          }, b);
          if (!ok) return;
          const de = M.dono[nome];
          moverPonto(nome, alvo);
          resolver(nome, 'redistribuir:' + alvo);
          ctx.salvar(); ctx.registrar(`Ponto sem acesso ${nome}: redistribuído de ${de} para ${alvo} (1ª opção da regra).`); desenhar();
          ctx.avisa(`${nome} passou para o ${alvo}.`, { tipo: 'ok' });
        }
        if (a === 'pinca-nova') {
          const nome = b.dataset.ponto, de = M.dono[nome], p = M.porNome[nome];
          const exc = await excecaoOrdem(nome, 2); if (exc === null) return;
          let forca = s.pincasNovas[de] ? s.pincasNovas[de].forca : undefined;
          if (forca === undefined) {
            const v = await ctx.perguntar({ titulo: `Pinça nova no ${de}`, texto: `O ${de} passa a usar a ${PINCA_NOVA}. Informe a força máxima do fabricante. Se ainda não veio, deixe em branco: o programa segue e deixa um alerta.`, campo: 'Força máxima (kN)', tipo: 'number', obrigatorio: false, extra: 'step="0.1" min="0"', ok: 'Testar pinça nova' });
            if (v === null) return;
            forca = v === '' ? null : Number(v);
          }
          const req = Math.max(...M.roboDe(de).pontos.concat(nome).map((n) => forcaReq((M.porNome[n] || p).chapas)));
          if (forca != null && forca < req) { ctx.avisa(`Com ${kn(forca)} a pinça nova não fecha todos os pontos do ${de} (o mais exigente pede ${kn(req)}). Escolha outra pinça ou use a troca de pinça.`, { tipo: 'erro' }); return; }
          const ok = await ctx.cad({
            titulo: `Testar pinça nova no ${de}`,
            catia: `' DELMIA V5: troca a ferramenta do robô e testa o ponto\nrobo${de.replace(/\W/g, '')}.SetTool biblioteca & "\\Pinca_C_350.CATProduct"\nok = robo${de.replace(/\W/g, '')}.GetReachability(tag("${nome}"))`,
            nx: `// Process Simulate: monta a pinça nova no robô e testa o ponto\nrobot.MountTool(doc.GetObjectsByName("Pinca_C_350")[0]);\nvar sol = robot.CalcInverseSolutions(new TxRobotInverseData(loc["${nome}"].AbsoluteLocation));`,
            macro: 'Nenhuma na v0', resultado: `${nome} com acesso usando a ${PINCA_NOVA}.`,
          }, b);
          if (!ok) return;
          s.pincasNovas[de] = { modelo: PINCA_NOVA, forca };
          resolver(nome, 'pinca-nova');
          ctx.salvar();
          ctx.registrar(`Ponto sem acesso ${nome}: pinça nova no ${de} (${PINCA_NOVA}, força ${kn(forca)})${forca == null ? ' · ALERTA: força não informada, verificar com o fabricante' : ''}${exc ? ' · EXCEÇÃO à ordem da regra: ' + exc : ''}.`);
          desenhar();
          ctx.avisa(`Pinça nova no ${de}. Ela precisa entrar na lista de equipamentos do Passo 5, e o estudo da estação pede versão nova.`, { tipo: forca == null ? 'aviso' : 'ok',
            acao: AE.telas.equipamentos && !AE.telas.equipamentos.aFazer ? { texto: 'Abrir Passo 5', fn: () => ctx.ir('equipamentos') } : null });
        }
        if (a === 'troca-pinca') {
          const nome = b.dataset.ponto, de = M.dono[nome], r0 = M.roboDe(de);
          const exc = await excecaoOrdem(nome, 3); if (exc === null) return;
          const ok = await ctx.cad({
            titulo: `Incluir troca de pinça no ${de}`,
            catia: `' DELMIA V5: trocador de ferramenta + segunda pinça só para o ponto\nrobo${de.replace(/\W/g, '')}.AddToolChange "Pinca_C_350", tag("${nome}")`,
            nx: `// Process Simulate: operação de troca de ferramenta antes do ponto\nprograma["${de}"].InsertToolChange(doc.GetObjectsByName("Pinca_C_350")[0], loc["${nome}"]);`,
            macro: 'Nenhuma na v0', resultado: `${nome} soldado com a segunda pinça; 2 trocas por ciclo no ${de}.`,
          }, b);
          if (!ok) return;
          (s.trocas[de] = s.trocas[de] || []).push(nome);
          resolver(nome, 'troca-pinca');
          ctx.salvar();
          M = ler(s);
          const r1 = M.roboDe(de);
          ctx.registrar(`Ponto sem acesso ${nome}: troca de pinça no ${de} (+${seg(2 * M.tp.trocaPinca)} por ciclo)${exc ? ' · EXCEÇÃO à ordem da regra: ' + exc : ''}.`);
          desenhar();
          const cabe = r1 && r1.tempo <= r1.disp + 1e-6;
          ctx.avisa(cabe ? `Troca de pinça incluída no ${de}. Tempo do robô: ${seg(r1.tempo)} de ${seg(r1.disp)}.` : `Troca de pinça incluída, mas o ${de} passa para ${seg(r1 ? r1.tempo : 0)} e não cabe nos ${seg(r0.disp)} disponíveis. Mova pontos ou devolva ao Processo.`, { tipo: cabe ? 'ok' : 'aviso' });
        }
        if (a === 'desfazer') {
          const nome = b.dataset.ponto, acao = s.resolvidos[nome] || '';
          const orig = s.verificado && s.verificado.de ? s.verificado.de[nome] : null;
          if (acao.startsWith('redistribuir') && orig && M.roboDe(orig)) moverPonto(nome, orig);
          if (acao === 'troca-pinca') Object.keys(s.trocas).forEach((r) => (s.trocas[r] = s.trocas[r].filter((x) => x !== nome)));
          if (acao === 'pinca-nova') {
            const r = M.dono[nome];
            const outros = Object.keys(s.resolvidos).filter((x) => x !== nome && s.resolvidos[x] === 'pinca-nova' && M.dono[x] === r);
            if (!outros.length) delete s.pincasNovas[r];
          }
          delete s.resolvidos[nome];
          if (!s.semAcesso.includes(nome)) s.semAcesso.push(nome);
          if (s.verificado && s.verificado.de && !s.verificado.de[nome]) s.verificado.de[nome] = M.dono[nome];
          ctx.salvar(); ctx.registrar(`Solução do ponto ${nome} desfeita (${acao}). Volta a ficar sem acesso.`); desenhar();
        }
        if (a === 'mover-robo') {
          const al = s.alcance; if (!al || al.ok) return;
          const ok = await ctx.cad({
            titulo: `Mover ${al.robo} 50 mm em direção a ${al.ponto}`,
            catia: `' DELMIA V5: desloca a base do robô 50 mm\nDim m(11): robo.Position.GetComponents m\nm(10) = m(10) + 50   ' em mm, em direção ao ponto\nrobo.Position.SetComponents m`,
            nx: `// Process Simulate: desloca a base do robô 50 mm\nvar t = robot.AbsoluteLocation;\nt.Translation = new TxVector(t.Translation.X, t.Translation.Y + 50, t.Translation.Z);\nrobot.AbsoluteLocation = t;`,
            macro: 'Nenhuma na v0', resultado: `${al.robo} deslocado 50 mm.`,
          }, b);
          if (!ok) return;
          al.movido += 50;
          s.movidos[al.robo] = (Number(s.movidos[al.robo]) || 0) + 50;
          al.ok = al.movido >= al.falta;
          ctx.salvar();
          ctx.registrar(al.ok ? `${al.robo} movido ${al.movido} mm (de 50 em 50): agora alcança ${al.ponto}. O layout precisa ser atualizado.` : `${al.robo} movido 50 mm (total ${al.movido} mm); ainda não alcança ${al.ponto}.`);
          desenhar();
          ctx.avisa(al.ok ? `${al.robo} alcança ${al.ponto} com ${al.movido} mm de deslocamento. O Passo 7 (Layout) usa esse deslocamento ao atualizar as posições.` : `Ainda faltam ${al.falta - al.movido} mm. Mova mais 50 mm.`, { tipo: al.ok ? 'ok' : 'aviso' });
        }
        if (a === 'devolver') {
          const acima = acimaCap();
          const sug = acima.length ? `Não cabe na quantidade do Processo: ${acima.map((r) => `${r.id} com ${r.pontos.length} pontos para ${r.cap} (${seg(r.tempo)} de ${seg(r.disp)})`).join('; ')}.` : '';
          const mot = await ctx.perguntar({ titulo: 'Devolver ao Processo', texto: 'Escreva o motivo. O Processo (Passo 6) recebe a devolução no registro do projeto e decide: mais um robô, outra estação, ou outra divisão dos pontos.', campo: 'Motivo', tipo: 'textarea', valor: sug, ok: 'Devolver ao Processo' });
          if (!mot) return;
          s.devolucoes = (s.devolucoes || []).concat({ hora: AE.util.hora(), motivo: mot });
          ctx.salvar(); ctx.registrar(`Devolvido ao Processo: ${mot}`); desenhar();
          ctx.avisa('Devolução registrada para o Processo.', { tipo: 'ok', acao: AE.telas.capacidade && !AE.telas.capacidade.aFazer ? { texto: 'Abrir Passo 6', fn: () => ctx.ir('capacidade') } : null });
        }
        if (a === 'refazer') {
          const ok = await ctx.perguntar({ titulo: 'Voltar à proposta do Passo 6?', texto: 'Apaga a distribuição feita aqui. Os pontos redistribuídos voltam a ficar sem acesso. Rode a verificação de novo depois.', ok: 'Voltar à proposta', perigo: true });
          if (!ok) return;
          delete s.distribuicao;
          Object.keys(s.resolvidos).forEach((n) => { if (String(s.resolvidos[n]).startsWith('redistribuir')) { delete s.resolvidos[n]; if (!s.semAcesso.includes(n)) s.semAcesso.push(n); } });
          ctx.salvar(); ctx.registrar('Distribuição da Simulação apagada: volta para a proposta do Passo 6.'); desenhar();
        }

        if (a === 'nuvem') {
          if (!s.verificado) { ctx.avisa('Rode a verificação de acesso antes (S2): a nuvem só tem os pontos com acesso.', { tipo: 'aviso', acao: { texto: 'Ir para S2', fn: () => irAba('s2') } }); return; }
          const pend = (s.semAcesso || []).filter((x) => M.dono[x]);
          if (pend.length) {
            const seguir = await ctx.perguntar({ titulo: 'Há pontos sem acesso', texto: `${pend.length} ponto(s) sem acesso ficam fora da nuvem. Gerar assim mesmo? A Mecânica recebe uma nuvem incompleta.`, ok: 'Gerar assim mesmo' });
            if (!seguir) return;
          }
          const n = s.nuvem && s.nuvem.versao ? Number(String(s.nuvem.versao).slice(1)) + 1 : 1;
          const versao = 'C' + n;
          const posicoes = M.robos.reduce((t, r) => t + r.pontos.filter((x) => !pend.includes(x)).length, 0);
          const ok = await ctx.cad({
            titulo: `Gerar nuvem de pinças ${versao} (JT e CGR)`,
            catia: `' uma instância da pinça em cada ponto, na posição de solda\nFor Each tag In tagsComAcesso\n  Set inst = nuvem.Products.AddComponentsFromFiles(Array(pincaDoRobo(tag)), "All")\n  inst.Position.SetComponents matrizDoPonto(tag)\nNext\nnuvem.Parent.ExportData pasta & "\\14.4_Simulação\\Nuvem_${versao}.cgr", "cgr"`,
            nx: `// Process Simulate: pinça em cada ponto e exporta\nforeach (var loc in locaisComAcesso) { var g = pinca[loc.Robo].Duplicate(); g.AbsoluteLocation = loc.AbsoluteLocation; nuvem.Add(g); }\nTxJtExporter.Export(nuvem, pasta + @"\\14.4_Simulação\\Nuvem_${versao}.jt");`,
            macro: 'Nenhuma na v0', resultado: `Nuvem_${versao}.jt e Nuvem_${versao}.cgr: ${posicoes} posições de pinça em 14.4_Simulação.`, ms: 900,
          }, b);
          if (!ok) return;
          s.nuvem = { entregue: true, versao, hora: AE.util.hora(), assinatura: M.assinatura, pontos: posicoes };
          ctx.salvar();
          ctx.registrar(`Nuvem de pinças ${versao} entregue à Mecânica (JT e CGR, ${posicoes} posições)${pend.length ? `, sem ${pend.length} ponto(s) sem acesso` : ''}.`);
          desenhar();
          ctx.avisa(`Nuvem ${versao} entregue. A Mecânica usa a nuvem para conferir a colisão das unidades.`, { tipo: 'ok',
            acao: AE.telas.conferir && !AE.telas.conferir.aFazer ? { texto: 'Ver na Mecânica', fn: () => ctx.ir('conferir') } : null });
        }
      });

      el.addEventListener('change', async (e) => {
        const t = e.target;
        if (t.id === 'sm-lim') {
          const v = Math.round(Number(t.value));
          if (!(v >= 1)) { ctx.avisa('O limite de pinças por PLC precisa ser 1 ou mais.', { tipo: 'erro' }); t.value = s.limitePlc; return; }
          s.limitePlc = v; ctx.salvar(); ctx.registrar(`Limite de pinças por PLC: ${v}.`); desenhar();
          ctx.avisa(`Com ${v} pinças por PLC saem ${M.estudos.length} estudo(s).`);
          return;
        }
        if (t.matches('select[data-mover]')) {
          const nome = t.dataset.mover, de = M.dono[nome], para = t.value;
          if (!de || de === para) return;
          const ok = await ctx.cad({
            titulo: `Passar ${nome} de ${de} para ${para}`,
            catia: `' DELMIA V5\ntarefa${de.replace(/\W/g, '')}.RemoveTag "${nome}" : tarefa${para.replace(/\W/g, '')}.AddTag "${nome}"`,
            nx: `// Process Simulate\nprograma["${para}"].AddOperation(doc.GetObjectsByName("${nome}")[0]);`,
            macro: 'Nenhuma na v0', resultado: `${nome} agora é do ${para}.`,
          });
          if (!ok) { t.value = de; return; }
          moverPonto(nome, para);
          ctx.salvar(); ctx.registrar(`Distribuição: ${nome} passou de ${de} para ${para}.`);
          desenhar();
          const r = M.roboDe(para);
          if (r && (r.pontos.length > r.cap || r.tempo > r.disp)) ctx.avisa(`${para} ficou com ${r.pontos.length} pontos para ${r.cap}. Mova outro ponto para fora ou devolva ao Processo.`, { tipo: 'aviso' });
          return;
        }
      });
      $('#sm-painel', el).addEventListener('click', (e) => {
        const b = e.target.closest('#sm-st [data-st]'); if (!b) return;
        s.stSel = Number(b.dataset.st); ctx.salvarUI(); desenhar();
      });

      /* ---------- concluir ---------- */
      $('#sm-concluir', el).onclick = () => {
        M = ler(s);
        const itens = checagem();
        const ruim = itens.find((i) => !i[1] && i[2] === 'erro');
        if (ruim) {
          const aba = /^S0/.test(ruim[0]) ? 's0' : /^S1/.test(ruim[0]) ? 's1' : /^S2/.test(ruim[0]) ? 's2' : 'nuvem';
          ctx.avisa(`Não dá para concluir: ${ruim[0]} (${ruim[3]}).`, { tipo: 'erro', acao: s.aba !== aba ? { texto: 'Abrir a aba', fn: () => irAba(aba) } : null });
          return;
        }
        const nRes = Object.keys(s.resolvidos).filter((n) => M.dono[n]).length;
        const alertas = M.robos.filter((r) => r.forca == null).length;
        ctx.concluir({
          registro: `Simulação S0–S2: ${Object.keys(M.dono).length} pontos distribuídos em ${M.robos.length} robôs, ${M.estudos.length} estudo(s), ${nRes} ponto(s) sem acesso resolvido(s), nuvem ${s.nuvem.versao} entregue à Mecânica${alertas ? `, ${alertas} alerta(s) de força não informada` : ''}`,
        });
      };
    },
  });
})();
