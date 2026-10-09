/* Mecânica 3 · Conferir alertas
   Porta da tela "conferir" da v0 do Bruno. Os alertas saem das unidades de Mecânica 2 (torre, grampo, ângulo),
   do acesso de parafuso e da nuvem de pinças da Simulação, mais as conferências fixas de exemplo da v0.
   Vermelho (trava) impede a liberação; amarelo (aviso) pode ser aceito com motivo e vira exceção.
   Saída: AE.espiar('conferir').excecoes = [{id, un, o, p, motivo, hora}] (lida por Mecânica 4). */
(function () {
  'use strict';
  const AE = window.AE;
  const { $, esc, fmt, hora } = AE.util;

  /* unidades: lista completa de AE.calc.unidades() (Mecânica 2) ou, sem ela, o resumo gravado na fatia */
  function unidades() {
    if (AE.calc.unidades) {
      const U = AE.calc.unidades();
      return {
        assin: U.assinatura, st: U.st, fonte: U.fonte,
        lista: U.lista.map((u) => ({ id: u.id, sig: u.sig, pts: u.pts, torre: u.torre.h, especial: u.torre.especial, nervura: u.torre.nervura, grampo: u.grampo ? u.grampo.tam : null,
          momento: u.momento, l1: u.l1, l2: u.l2, resultado: u.resultado, ang: u.ang, angPadrao: u.angPad, angMotivo: u.angMotivo, sent: u.sent, inc: u.inc })),
      };
    }
    const r = (AE.espiar('unidades') || {}).unidades || [];
    return { assin: r.map((u) => u.sig + u.torre + u.grampo + u.ang).join(';'), st: null, fonte: 'fatia', lista: r.map((u) => Object.assign({ l1: null, l2: null, angMotivo: '' }, u)) };
  }

  /* todas as conferências, com o estado de resolução gravado na fatia */
  function gerar(s) {
    const U = unidades(), L = U.lista;
    const nuvem = AE.calc.simulacao().nuvem || { entregue: false, versao: null };
    const todas = L.length ? (L.length > 1 ? `${L[0].id} a ${L[L.length - 1].id}` : L[0].id) : '—';
    const out = [];
    const add = (a) => out.push(a);
    L.forEach((u) => {
      if (u.torre > 700) add({ id: 'torre:' + u.sig, t: 'alerta', un: u.id, o: 'Altura da torre', p: `Torre ${u.especial ? 'especial ' : ''}de ${u.torre} mm, acima do limite de 700 mm.${u.nervura ? ' Nervura parafusada já incluída.' : ''}`, s: 'Subir a base do dispositivo em 100 mm ou aceitar com motivo.', acao: 'aceitar', btn: 'Aceitar com motivo' });
      if (u.resultado === 'reprovado') add({ id: 'grampo:' + u.sig, t: 'trava', un: u.id, o: 'Cálculo do grampo', p: `Momento no braço de ${fmt(u.momento, 2)} Nm, acima do limite${u.l2 ? ` de ${fmt(u.l2, 1)} Nm (ciclo de 2 s)` : ' do fabricante'}.`, s: 'Encurtar o braço, subir o tamanho do grampo ou separar a unidade (menor distância para agrupar), em Mecânica 2.', acao: 'ir', btn: 'Abrir Mecânica 2' });
      if (u.resultado === '2s') add({ id: 'grampo2s:' + u.sig, t: 'alerta', un: u.id, o: 'Cálculo do grampo', p: `Momento de ${fmt(u.momento, 2)} Nm passa do limite do ciclo de 1 s${u.l1 ? ` (${fmt(u.l1, 1)} Nm)` : ''} e fica dentro do de 2 s.`, s: 'Aceitar o grampo com ciclo de 2 s (com motivo) ou subir o tamanho em Mecânica 2.', acao: 'aceitar', btn: 'Aceitar com motivo' });
      if (u.grampo && u.ang !== u.angPadrao) add({ id: 'ang:' + u.sig, t: 'alerta', un: u.id, o: 'Ângulo do grampo', p: u.angMotivo || `Grampo a ${u.ang}°, diferente do padrão de ${u.angPadrao}°.`, s: 'Fica como exceção, com o motivo registrado.', acao: 'aceitar', btn: 'Aceitar exceção' });
    });
    /* acesso de parafuso: exemplo da v0, na primeira unidade com cantoneira intermediária */
    const ua = L.find((u) => u.sent >= 2) || L[0];
    if (ua) {
      const id = 'acesso:' + ua.sig, feito = s.res[id] && s.res[id].tipo === 'aplicada';
      add(feito
        ? { id, t: 'ok', un: ua.id, o: 'Acesso de parafuso', p: 'Furação invertida (rosca na torre, passante na cantoneira). Acesso de 74 mm livres.', resolvido: true }
        : { id, t: 'trava', un: ua.id, o: 'Acesso de parafuso', p: `Parafuso M8 da ${ua.sent >= 2 ? 'cantoneira intermediária' : 'cantoneira'} sem espaço para a chave Allen girar 60° (sobram 31 mm, mínimo 60).`, s: 'Inverter: rosca na torre e passante na cantoneira. Testado: libera o acesso.', acao: 'aplicar', btn: 'Aplicar inversão' });
    }
    /* nuvem de pinças */
    if (!nuvem.entregue) add({ id: 'nuvem', t: 'alerta', un: 'todas', o: 'Nuvem de pinças', p: 'A Simulação ainda não entregou a nuvem de pinças desta estação.', s: 'Unidades marcadas para conferência. Confira a colisão quando a nuvem chegar.', acao: 'sim', btn: 'Ver Simulação', fixo: true });
    else if (!s.colisao || s.colisao.versao !== nuvem.versao || s.colisao.assin !== U.assin) add({ id: 'nuvem', t: 'alerta', un: 'todas', o: 'Nuvem de pinças', p: s.colisao ? `Recebida a versão ${nuvem.versao}, mas a nuvem ou as unidades mudaram depois da última conferência de colisão.` : `Recebida a versão ${nuvem.versao}: colisão ainda não conferida.`, s: 'Conferir a colisão de cada unidade com o grampo aberto e fechado.', acao: 'colisao', btn: 'Conferir colisão', fixo: true });
    else add({ id: 'nuvem', t: 'ok', un: todas, o: 'Nuvem de pinças', p: `Versão ${nuvem.versao} conferida às ${s.colisao.hora}: nenhuma colisão com grampo aberto ou fechado.` });
    /* regras de apoio do plano de fixação */
    if (AE.origem('fixacao') !== 'reserva') {
      const fx = AE.espiar('fixacao') || { pontos: [] };
      const nAp = (fx.pontos || []).filter((p) => p.sit !== 'des' && (p.sit === 'apo' || /poio/.test(p.fun))).length;
      if (nAp < 3) add({ id: 'apoios', t: 'alerta', un: 'plano', o: 'Regras de apoio do plano de fixação', p: `Só ${nAp} apoio(s) ativos no plano: o mínimo é 3 por plano.`, s: 'Rever o plano em Mecânica 1 ou aceitar com motivo.', acao: 'aceitar', btn: 'Aceitar com motivo' });
      else add({ id: 'apoios', t: 'ok', un: 'plano', o: 'Regras de apoio do plano de fixação', p: `${nAp} apoios ativos (mínimo 3). As outras regras são conferidas em Mecânica 1.` });
    }
    /* conferências que passaram (exemplo da v0) */
    const temRep = L.some((u) => u.resultado === 'reprovado' || u.resultado === '2s');
    if (L.some((u) => u.grampo) && !temRep) add({ id: 'grampo-ok', t: 'ok', un: todas, o: 'Cálculo do grampo', p: 'Momento no braço dentro do limite do fabricante em todas as unidades com grampo.' });
    add({ id: 'face', t: 'ok', un: todas, o: 'Face de contato a 25 mm da fixação', p: 'Todos os apoios respeitam os 20 mm da cantoneira + 5 mm de folga.' });
    add({ id: 'furos', t: 'ok', un: todas, o: 'Furos passantes', p: 'Nenhum furo cego. Rosca útil ≥ 1,5 × diâmetro em todas as juntas.' });
    const guias = L.filter((u) => u.grampo && u.inc >= 10);
    if (guias.length) add({ id: 'guia', t: 'ok', un: guias.map((u) => u.id).join(', '), o: 'Guia do pisador', p: `Inclinação de ${guias.map((u) => u.inc + '°').join(', ')} (≥ 10°): guia acrescentada.` });
    add({ id: 'dist', t: 'ok', un: todas, o: 'Distâncias mínimas', p: 'Peças fixas ≥ 5 mm; unidades diferentes ≥ 10 mm; com movimento ≥ 10 mm.' });
    add({ id: 'entrada', t: 'ok', un: todas, o: 'Entrada e saída do produto', p: 'Produto entra e sai em linha reta com os grampos abertos.' });
    add({ id: 'flecha', t: 'ok', un: 'base', o: 'Flecha da base', p: 'Flecha parada de 0,4 mm, sem variação no ciclo: posição das unidades não muda.' });
    add({ id: 'furosbase', t: 'ok', un: 'base', o: 'Furos da base', p: 'Nenhum furo sobre parede de tubo ou solda. 6 furos de medição Ø10 a até 1000 mm.' });
    /* exceções aceitas */
    out.forEach((a) => {
      const r = s.res[a.id];
      if (a.t === 'alerta' && r && r.tipo === 'aceita') { a.t = 'excecao'; a.motivo = r.motivo; a.hora = r.hora; }
    });
    return { lista: out, U, nuvem };
  }

  AE.tela({
    id: 'conferir', sigla: 'M3', area: 'mec', rotulo: 'Mecânica 3', titulo: 'Conferir alertas',
    resumo: 'Tudo o que o programa conferiu sozinho. Vermelho trava; amarelo avisa e você decide.',
    tip: 'Abre a conferência das unidades: travas que impedem a liberação, avisos que você aceita com motivo, e a colisão com a nuvem de pinças.',
    entradas: [{ de: 'unidades', o: 'Unidades montadas' }, { de: 'simulacao', o: 'Nuvem de pinças' }],
    inicial: () => ({ res: {}, excecoes: [], conferido: null, colisao: null }),
    programador: `
      <h3>O que esta tela guarda</h3>
      <ul>
        <li><code>res</code>: a resolução de cada conferência, pela chave <code>tipo:pontos da unidade</code> (proposta aplicada ou aviso aceito com motivo, e a hora).</li>
        <li><code>excecoes</code>: os avisos aceitos que ainda existem, com o motivo. É o que vai para a Lista de exceções da Mecânica 4.</li>
        <li><code>colisao</code>: versão da nuvem e assinatura das unidades da última conferência de colisão.</li>
      </ul>
      <h3>Regras</h3>
      <ul>
        <li><code>trava</code>: impede a liberação. Hoje: face de contato a menos de 25 mm da fixação; cálculo do grampo reprovado; sem acesso de parafuso por nenhum lado; colisão com pinça.</li>
        <li><code>alerta</code>: só avisa. Hoje: torre acima de 700 mm; furo cego; ângulo fora do padrão; peça especial; nuvem de pinças não recebida; regras de apoio do plano de fixação; flecha da base variando no ciclo.</li>
        <li>Alerta aceito pelo usuário vira exceção com motivo e entra na lista de saídas.</li>
        <li>Trava de grampo só se resolve mudando a unidade em Mecânica 2: a conferência roda de novo sozinha.</li>
        <li>Nuvem nova da Simulação ou unidade alterada: a colisão precisa ser conferida de novo.</li>
      </ul>
      <h3>Acesso de parafuso</h3>
      <ul>
        <li>Atrás de cada cabeça: parafuso inteiro no início da rosca + chave Allen girando no mínimo 60° + 10 mm; nunca menos de 60 mm livres.</li>
        <li>Sem acesso: inverter rosca e passante e testar de novo; continuou sem: trava.</li>
      </ul>
      <h3>Saída</h3>
      <ul>
        <li>Unidades liberadas para desenhos (conclusão do passo).</li>
        <li><code>AE.espiar('conferir').excecoes</code> = <code>[{id, un, o, p, motivo, hora}]</code>, lida por Mecânica 4.</li>
      </ul>
      <h3>Macros de base</h3>
      <ul><li>Nenhuma macro antiga conhecida para as conferências. A colisão usa o Clash do CATIA (ou a análise de folga do NX).</li></ul>
      <h3>Em aberto</h3>
      <ul>
        <li>A trava de acesso de parafuso, a flecha e os furos da base são fixos de exemplo (como na v0). No programa real saem do 3D.</li>
        <li>Grampo aprovado só com ciclo de 2 s: é aviso (aceitar com motivo) ou trava? O protótipo trata como aviso.</li>
        <li>A colisão sempre dá "sem colisão" no protótipo. Como o resultado volta para a Simulação quando há colisão?</li>
      </ul>`,

    render(ctx) {
      const t = ctx.termos();
      return `
      <div id="cf-faixa"></div>
      <div class="bloco">
        <h2>Resumo</h2>
        <p class="sub" id="cf-sub"></p>
        <div class="barra entre">
          <div class="contagem" id="cf-cont"></div>
          <button class="btn" id="cf-rodar" data-tip="Roda de novo todas as conferências com o 3D atual: acesso de parafuso, cálculo do grampo, colisão com a nuvem de pinças, distâncias mínimas, entrada e saída do produto.">Conferir de novo <span class="cad-tag">${esc(t.nome)}</span></button>
        </div>
      </div>
      <div class="bloco">
        <h2>Conferências <span class="exemplo">dados de exemplo</span></h2>
        <p class="sub">Cada linha diz o que foi conferido, em qual unidade, e o que o programa propõe.</p>
        <div class="lista" id="cf-lista"></div>
      </div>
      <div class="duas">
        <div class="bloco">
          <h2>Nuvem de pinças</h2>
          <p class="sub">A colisão com as pinças só é conferida quando a Simulação entregou a nuvem.</p>
          <div class="checagem" id="cf-nuvem"></div>
          <div class="barra" style="margin-top:12px">
            <button class="btn" id="cf-colisao" data-tip="Importa o JT da nuvem de pinças entregue pela Simulação e confere a colisão de cada unidade, com o grampo aberto e fechado.">Conferir colisão <span class="cad-tag">${esc(t.nome)}</span></button>
          </div>
        </div>
        <div class="bloco">
          <h2>Regras de acesso de parafuso</h2>
          <p class="sub">Conferidas em cada parafuso das unidades.</p>
          <div class="leitura">
            <div><code>Atrás</code><span>Parafuso inteiro no início da rosca + chave Allen girando no mínimo 60° + 10 mm; nunca menos de 60 mm livres.</span></div>
            <div><code>Sem acesso</code><span>Inverter rosca e passante e testar de novo; continuou sem: trava.</span></div>
          </div>
        </div>
      </div>
      <div class="bloco">
        <h2>Lista de exceções</h2>
        <p class="sub">Avisos aceitos, com o motivo. Vão para a revisão do cliente junto com os desenhos (Mecânica 4).</p>
        <div id="cf-exc"></div>
      </div>
      <div class="bloco">
        <div class="barra entre">
          <span class="sub" style="margin:0;flex:1 1 280px">Só libera sem nenhuma trava vermelha. Avisos amarelos podem ficar, mas aparecem na lista de exceções com o motivo que você escrever.</span>
          <button class="btn primario" id="cf-liberar" data-tip="Só libera sem nenhuma trava vermelha. Avisos amarelos podem ficar, mas aparecem na lista de exceções com o motivo que você escrever.">Liberar unidades para desenhos</button>
        </div>
      </div>`;
    },

    montar(el, ctx) {
      const s = ctx.s, t = ctx.termos();
      s.res = s.res || {};
      AE.css('conferir', `
        .cf-al{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:start;background:var(--fundo);border:1px solid var(--linha);border-left:4px solid var(--aviso);border-radius:6px;padding:10px 12px}
        .cf-al.trava{border-left-color:var(--erro)} .cf-al.ok{border-left-color:var(--ok);opacity:.75} .cf-al.excecao{border-left-color:var(--roxo)}
        .cf-al .tipo{font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:600;padding-top:3px;min-width:66px;color:var(--aviso)}
        .cf-al.trava .tipo{color:var(--erro)} .cf-al.ok .tipo{color:var(--ok)} .cf-al.excecao .tipo{color:var(--roxo)}
        .cf-al p{margin:0;font-size:14px} .cf-al small{display:block;color:var(--suave);font-size:12.5px;margin-top:3px}
        .cf-al .acoes{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
        @media (max-width:560px){.cf-al{grid-template-columns:minmax(0,1fr)}.cf-al .acoes{justify-content:flex-start}}`);

      let G = gerar(s);
      const conta = () => {
        const c = { trava: 0, alerta: 0, excecao: 0, ok: 0 };
        G.lista.forEach((a) => c[a.t]++);
        return c;
      };
      const gravaExcecoes = () => {
        s.excecoes = G.lista.filter((a) => a.t === 'excecao').map((a) => ({ id: a.id, un: a.un, o: a.o, p: a.p, motivo: a.motivo, hora: a.hora }));
      };

      const resumo = () => {
        const c = conta(), un = AE.espiar('unidades') || {};
        $('#cf-cont', el).innerHTML = `<span class="pilula erro" data-tip="Impedem a liberação até serem resolvidas.">Travas: ${c.trava}</span>
          <span class="pilula aviso" data-tip="Só avisam. Aceite com motivo ou corrija.">Avisos: ${c.alerta}</span>
          <span class="pilula roxo" data-tip="Avisos aceitos com motivo. Vão para a lista de exceções.">Exceções aceitas: ${c.excecao}</span>
          <span class="pilula ok">Em ordem: ${c.ok}</span>`;
        $('#cf-sub', el).textContent = `${G.U.lista.length} unidade(s)${G.U.st ? ' da ST' + G.U.st : ''} conferidas${s.conferido ? `; última conferência no CAD às ${s.conferido.hora}` : ''}.`;
        const faixa = [];
        if (!G.U.lista.length) faixa.push('<div class="faixa-aviso"><span>Nenhuma unidade para conferir. Monte as unidades em Mecânica 2.</span><a class="btn mini" href="#/unidades" data-tip="Abre Mecânica 2 para montar as unidades.">Abrir Mecânica 2</a></div>');
        else if (!un.montado) faixa.push('<div class="faixa-aviso amarela"><span>As unidades ainda não foram montadas no CAD (Mecânica 2). As conferências abaixo usam o cálculo da tela, sem o 3D.</span><a class="btn mini" href="#/unidades" data-tip="Abre Mecânica 2 para montar as unidades no CAD.">Montar em Mecânica 2</a></div>');
        else if (s.conferido && s.conferido.assin !== G.U.assin) faixa.push('<div class="faixa-aviso amarela"><span>As unidades mudaram depois da última conferência no CAD. Use "Conferir de novo".</span></div>');
        $('#cf-faixa', el).innerHTML = faixa.join('');
      };

      const ROT = { trava: 'Trava', alerta: 'Aviso', excecao: 'Exceção', ok: 'OK' };
      const TIP = {
        aplicar: 'Aplica a solução proposta no 3D e confere de novo.',
        aceitar: 'Pede o motivo e transforma este aviso em exceção aceita. Ele aparece na lista de exceções das saídas.',
        ir: 'Abre Mecânica 2 para mudar a unidade. A conferência roda de novo sozinha quando você voltar.',
        colisao: 'Importa a nuvem de pinças entregue pela Simulação e confere a colisão de cada unidade com o grampo aberto e fechado.',
        sim: 'Abre a Simulação, que gera a nuvem de pinças.',
      };
      const lista = () => {
        const ordem = { trava: 0, alerta: 1, excecao: 2, ok: 3 };
        $('#cf-lista', el).innerHTML = G.lista.slice().sort((a, b) => ordem[a.t] - ordem[b.t]).map((a) => `<div class="cf-al ${a.t}">
          <span class="tipo">${ROT[a.t]}</span>
          <div><p><b style="font-weight:600">${esc(a.un)} · ${esc(a.o)}.</b> ${esc(a.p)}</p>
            ${a.t === 'excecao' ? `<small>Motivo: ${esc(a.motivo)} · ${esc(a.hora)}</small>` : a.s && a.t !== 'ok' ? `<small>Proposta: ${esc(a.s)}</small>` : ''}</div>
          <div class="acoes">${a.t === 'excecao' ? `<button class="btn mini leve" data-reabrir="${esc(a.id)}" data-tip="Desfaz a aceitação: o aviso volta a ficar pendente e sai da lista de exceções.">Reabrir</button>`
            : a.t === 'ok' && a.resolvido ? `<button class="btn mini leve" data-reabrir="${esc(a.id)}" data-tip="Desfaz a proposta aplicada (só no protótipo): a trava volta.">Desfazer</button>`
            : a.btn ? `<button class="btn mini ${a.t === 'trava' ? 'primario' : ''}" data-a="${esc(a.id)}" data-tip="${esc(TIP[a.acao] || '')}">${esc(a.btn)}</button>` : ''}</div></div>`).join('');
      };

      const nuvemBloco = () => {
        const n = G.nuvem;
        const conf = n.entregue && s.colisao && s.colisao.versao === n.versao && s.colisao.assin === G.U.assin;
        $('#cf-nuvem', el).innerHTML = `<div><span>Nuvem de pinças desta estação</span>${n.entregue
          ? `<span class="pilula ${conf ? 'ok' : 'info'}" data-tip="A Simulação entregou a nuvem (JT e CGR) com as pinças nos pontos.">Recebida · versão ${esc(n.versao)}${conf ? ' · sem colisão' : ''}</span>`
          : '<span class="pilula aviso" data-tip="Ainda não chegou. As unidades foram modeladas assim mesmo e estão marcadas para conferência. Quando a nuvem chegar, o programa confere e avisa onde há colisão.">Não recebida: unidades marcadas para conferência</span>'}</div>
          ${conf ? `<div><span>Última conferência de colisão</span><span class="pilula ok">${esc(s.colisao.hora)} · ${G.U.lista.length} unidades</span></div>` : ''}`;
      };

      const excecoes = () => {
        const ex = G.lista.filter((a) => a.t === 'excecao');
        $('#cf-exc', el).innerHTML = ex.length
          ? `<div class="rolagem"><table><thead><tr><th>Unidade</th><th>Conferência</th><th>O que foi aceito</th><th>Motivo</th><th>Hora</th></tr></thead><tbody>
              ${ex.map((a) => `<tr><td class="mono">${esc(a.un)}</td><td>${esc(a.o)}</td><td>${esc(a.p)}</td><td>${esc(a.motivo)}</td><td class="mono">${esc(a.hora)}</td></tr>`).join('')}</tbody></table></div>`
          : '<div class="vazio">Nenhuma exceção aceita ainda. Use "Aceitar com motivo" em um aviso amarelo.</div>';
      };

      const tudo = () => { G = gerar(s); gravaExcecoes(); resumo(); lista(); nuvemBloco(); excecoes(); };
      tudo();
      ctx.salvarUI();

      /* ---------- ações nas conferências ---------- */
      const colisao = async (botao) => {
        const n = AE.calc.simulacao().nuvem || {};
        if (!n.entregue) {
          ctx.avisa('A Simulação ainda não gerou a nuvem de pinças desta estação. As unidades seguem marcadas para conferência.', { tipo: 'aviso', acao: { texto: 'Ir para a Simulação', fn: () => ctx.ir('simulacao') } });
          return;
        }
        const nU = G.U.lista.length;
        const ok = await ctx.cad({
          titulo: `Conferir colisão com a nuvem de pinças ${n.versao}`,
          catia: `prd.Products.AddComponentsFromFiles Array(pasta & "\\nuvem_${n.versao}.jt"), "*": Set cl = prd.GetTechnologicalObject("Clashes").Add: cl.ComputationType = catClashComputationTypeBetweenTwo: cl.Compute  ' grampo aberto e fechado`,
          nx: `var b = workPart.AssemblyManager.CreateClearanceAnalysisBuilder(null); b.ClearanceBetween = ClearanceAnalysisBuilder.ClearanceBetweenEntity.Components; /* nuvem ${n.versao} × ${nU} unidades, aberto e fechado */ b.Commit();`,
          resultado: `Nuvem ${n.versao} × ${nU} unidades, grampo aberto e fechado: nenhuma colisão.`,
          ms: 900,
        }, botao);
        if (!ok) return;
        s.colisao = { versao: n.versao, assin: G.U.assin, hora: hora() };
        ctx.registrar(`Colisão conferida com a nuvem de pinças ${n.versao}: nenhuma colisão nas ${nU} unidades.`);
        ctx.salvar(); tudo();
        ctx.avisa(`Nuvem de pinças ${n.versao} conferida: nenhuma colisão nas ${nU} unidades, com o grampo aberto e fechado.`, { tipo: 'ok' });
      };
      $('#cf-colisao', el).onclick = (e) => colisao(e.currentTarget);
      $('#cf-lista', el).addEventListener('click', async (e) => {
        const r = e.target.closest('[data-reabrir]');
        if (r) {
          const a = G.lista.find((x) => x.id === r.dataset.reabrir);
          delete s.res[r.dataset.reabrir];
          ctx.registrar(`Conferência reaberta: ${a ? a.un + ' · ' + a.o : r.dataset.reabrir}.`); ctx.salvar(); tudo();
          ctx.avisa('Conferência reaberta: volta a ficar pendente.');
          return;
        }
        const b = e.target.closest('[data-a]'); if (!b) return;
        const a = G.lista.find((x) => x.id === b.dataset.a); if (!a) return;
        if (a.acao === 'ir') { ctx.ir('unidades'); return; }
        if (a.acao === 'sim') { ctx.ir('simulacao'); return; }
        if (a.acao === 'colisao') { colisao(b); return; }
        if (a.acao === 'aplicar') {
          const ok = await ctx.cad({
            titulo: `Inverter furação na ${a.un}`,
            catia: 'Set h = part.MainBody.Shapes.Item("Rosca_M8"): h.ThreadingMode = catSmoothHoleMode: Set h2 = torre.MainBody.Shapes.Item("Passante_M8"): h2.ThreadingMode = catThreadedHoleMode: part.Update',
            nx: 'var hb = workPart.Features.CreateHolePackageBuilder(furo); hb.Types = HolePackageBuilder.Types.ThreadedHole; /* rosca na torre, passante na cantoneira */ hb.Commit();',
            resultado: `${a.un}: rosca na torre e passante na cantoneira. Acesso de parafuso conferido: 74 mm livres.`,
          }, b);
          if (!ok) return;
          s.res[a.id] = { tipo: 'aplicada', hora: hora() };
          ctx.registrar(`${a.un}: furação invertida para liberar o acesso de parafuso (74 mm livres).`);
          ctx.salvar(); tudo();
          ctx.avisa(`Inversão aplicada no 3D da ${a.un}. Acesso de parafuso conferido: 74 mm livres.`, { tipo: 'ok' });
          return;
        }
        if (a.acao === 'aceitar') {
          const mot = await ctx.perguntar({ titulo: `Aceitar: ${a.un} · ${a.o}`, texto: `${a.p} O aviso vira exceção e entra na lista de exceções, com o motivo, para a revisão do cliente.`, campo: 'Motivo', ok: 'Aceitar com este motivo' });
          if (!mot) return;
          s.res[a.id] = { tipo: 'aceita', motivo: mot, hora: hora() };
          ctx.registrar(`Exceção aceita: ${a.un} · ${a.o}. Motivo: ${mot}`);
          ctx.salvar(); tudo();
          ctx.avisa('Exceção registrada com motivo. Entra na lista de exceções das saídas.', { tipo: 'ok' });
        }
      });

      $('#cf-rodar', el).onclick = async (e) => {
        G = gerar(s);
        const c = conta();
        const ok = await ctx.cad({
          titulo: 'Conferir de novo todas as unidades',
          catia: 'For Each u In prd.Products: ConfereAcessoParafuso u: ConfereGrampo u: ConfereDistancias u: Next: Set cl = prd.GetTechnologicalObject("Clashes").Add: cl.Compute',
          nx: 'foreach (var c in workPart.ComponentAssembly.RootComponent.GetChildren()) { ConfereAcessoParafuso(c); ConfereGrampo(c); ConfereDistancias(c); }',
          resultado: `Conferências refeitas: ${c.trava} trava(s), ${c.alerta} aviso(s), ${c.excecao} exceção(ões) aceita(s), ${c.ok} em ordem.`,
        }, e.currentTarget);
        if (!ok) return;
        s.conferido = { hora: hora(), assin: G.U.assin };
        ctx.salvarUI(); tudo();
        ctx.avisa(`Conferências refeitas: ${c.trava} trava(s), ${c.alerta} aviso(s), ${c.ok} em ordem.`, { tipo: c.trava ? 'aviso' : 'ok' });
      };

      $('#cf-liberar', el).onclick = async () => {
        tudo();
        if (!G.U.lista.length) { ctx.avisa('Não há unidades para liberar. Monte as unidades em Mecânica 2.', { tipo: 'erro' }); return; }
        const tr = G.lista.filter((a) => a.t === 'trava');
        if (tr.length) { ctx.avisa(`Ainda há ${tr.length} trava(s): ${tr.map((a) => a.un + ' · ' + a.o).join('; ')}. Resolva antes de liberar.`, { tipo: 'erro' }); return; }
        const pend = G.lista.filter((a) => a.t === 'alerta' && a.acao === 'aceitar');
        if (pend.length) {
          const mot = await ctx.perguntar({ titulo: `${pend.length} aviso(s) sem motivo`, texto: `${pend.map((a) => a.un + ' · ' + a.o).join('; ')}. Para liberar, escreva o motivo: eles entram na lista de exceções.`, campo: 'Motivo (vale para todos)', ok: 'Aceitar e liberar' });
          if (!mot) return;
          pend.forEach((a) => (s.res[a.id] = { tipo: 'aceita', motivo: mot, hora: hora() }));
          ctx.registrar(`${pend.length} aviso(s) aceito(s) na liberação. Motivo: ${mot}`);
          tudo();
        }
        const semNuvem = !G.nuvem.entregue;
        const nEx = G.lista.filter((a) => a.t === 'excecao').length;
        ctx.salvar();
        ctx.concluir({
          registro: `Mecânica 3: ${G.U.lista.length} unidades liberadas para desenhos, ${nEx} exceção(ões)${semNuvem ? ', sem nuvem de pinças' : ''}`,
          mensagem: `Unidades liberadas para desenhos e listas, com ${nEx} exceção(ões).${semNuvem ? ' A nuvem de pinças não chegou: as unidades seguem marcadas para conferência (preliminar).' : ''} Próximo: Mecânica 4.`,
        });
      };
    },
  });
})();
