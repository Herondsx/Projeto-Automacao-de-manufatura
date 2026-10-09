/* Mecânica 4 · Desenhos e listas
   Porta da tela "saidas" da v0 do Bruno: as 9 saídas do módulo, geradas do 3D, na pasta certa do projeto,
   com versão (C1, C2… e F1 só com a aprovação do dispositivo pelo cliente, DR03).
   Lê: AE.calc.unidades() (lista de peças, de Mecânica 2), AE.espiar('conferir').excecoes, AE.espiar('fixacao').
   Saída marcada "desatualizada" quando o dispositivo muda depois de gerada. */
(function () {
  'use strict';
  const AE = window.AE;
  const { $, $$, esc, fmt, hora, espera } = AE.util;

  const XL = 'Set xl = CreateObject("Excel.Application"): Set wb = xl.Workbooks.Add';
  const SAIDAS = [
    { id: 'montagem', nome: 'Folha de montagem', o: 'Perspectiva com o produto, balões por posição e lista de fixadores.', sub: 'Montagem', macro: '09_Pomigliano_965_DraftingGen, 10_Balloon',
      catia: 'Set dr = CATIA.Documents.Add("Drawing"): Set v = dr.Sheets.Item(1).Views.Add("Montagem"): v.GenerativeBehavior.Document = prd: v.GenerativeBehavior.DefineIsometricView 1,0,0,0,1,0: v.GenerativeBehavior.Update  \' + balões por posição',
      nx: 'var b = workPart.DraftingViews.CreateBaseViewBuilder(null); b.SelectModelView.SelectedView = workPart.ModelingViews.FindObject("Isometric"); b.Commit(); /* balões: workPart.Annotations.IdSymbols.CreateIdSymbolBuilder */' },
    { id: 'vistas', nome: 'Vistas no zero carro', o: 'Grade de 200 em 200 mm com a posição de cada unidade.', sub: 'Montagem', macro: '21_AUTO_ALL_VIEWS, jlr_grid_100',
      catia: 'For Each d In Array("Frente","Topo","Lado"): Set v = folha.Views.Add(d): v.GenerativeBehavior.Document = prd: …: Next: DesenhaGrade v, 200  \' coordenadas do carro',
      nx: 'foreach (var dir in new[]{"Front","Top","Right"}) { var pb = workPart.DraftingViews.CreateProjectedViewBuilder(baseView); …; pb.Commit(); } /* grade de 200 mm no zero carro */' },
    { id: 'detalhes', nome: 'Detalhe das peças', o: '4 por folha A0, 1:1, com linhas de grade, furação e quadro. O lado simétrico é espelhado.', sub: 'Detalhes', macro: '09_Pomigliano_965_DraftingGen, jlr_grid_100, Symmetry_Instance, Mirror_an_ZX_all',
      catia: 'For Each pc In pecasConstruidas: Set f = dr.Sheets.Add("Pos " & pc.Pos): f.PaperSize = catPaperA0: f.Scale = 1: …: Next: Mirror_an_ZX_all  \' lado simétrico',
      nx: 'foreach (var pc in pecasConstruidas) { var sb = workPart.DraftingDrawingSheets.DrawingSheetBuilder(null); sb.Height = 841; sb.Length = 1189; sb.ScaleNumerator = 1; sb.Commit(); } /* espelho: MirrorBody pelo plano ZX */' },
    { id: 'corte', nome: 'Contornos de corte', o: 'Bruto das peças fora de catálogo, 1:1, para oxicorte.', sub: 'Corte', macro: 'conversao_corte_a_macarico',
      catia: 'For Each pc In pecasCortadas: Set v = folha.Views.Add(pc.Nome): v.GenerativeBehavior.Document = pc: …: Next: dr.ExportData pasta & "\\contornos.dxf", "dxf"',
      nx: 'var dx = theSession.DexManager.CreateDxfdwgCreator(); dx.ExportData = DxfdwgCreator.ExportDataOption.Drawing; dx.OutputFile = pasta + "\\\\contornos.dxf"; dx.Commit();' },
    { id: 'lista', nome: 'Lista de peças', o: 'Item, padrão de origem, bruto, material, tratamento; lado simétrico em coluna própria.', sub: 'Listas', macro: 'LP_rev4, BOM_CATIA-LISTA-PREL',
      catia: 'prd.ExtractBOM catFileTypeTXT, pasta & "\\lista_pecas.txt": ' + XL + ': \' preenche Pos., Denominação, Material, Bruto, Qtd e lado simétrico',
      nx: 'var pl = workPart.Annotations.PartsLists.CreatePartsListBuilder(null); pl.Commit(); /* exporta para Excel: Pos., Denominação, Material, Bruto, Qtd, simétrico */' },
    { id: 'grampos', nome: 'Folha de cálculo dos grampos', o: 'Peso, distância, momento e limite de cada grampo.', sub: 'Cálculos', macro: '',
      catia: XL + ': For Each u In unidades: u.Analyze.Mass …: \' peso, distância, momento e limite (tabela do fabricante)', nx: 'foreach (var u in unidades) { var mp = workPart.MeasureManager.NewMassProperties(…); /* momento = peso × 9,81 × distância */ }' },
    { id: 'base', nome: 'Pacote de cálculo da base', o: 'Geometria simplificada, massa e CG de cada unidade, casos de carga. Para o engenheiro assinar a ART.', sub: 'Cálculos', macro: '',
      catia: 'For Each u In unidades: Set a = u.Analyze: m = a.Mass: a.GetGravityCenter cg: …: Next: prd.ExportData pasta & "\\base_simplificada.stp", "stp"',
      nx: 'foreach (var u in unidades) { var mp = workPart.MeasureManager.NewMassProperties(massUnits, 0.99, corpos); var cg = mp.Centroid; } /* exporta STEP simplificado */' },
    { id: 'calcos', nome: 'Tabela de calços', o: 'Calço em X, Y e Z por ponto (shims book).', sub: 'Listas', macro: '',
      catia: XL + ': For Each p In pontosFixacao: p.GetCoordinates c: …: Next  \' calço nominal em X, Y e Z por ponto', nx: 'foreach (Point p in pontosFixacao) { Point3d c = p.Coordinates; … } /* shims book */' },
    { id: 'excecoes', nome: 'Lista de exceções', o: 'Alertas aceitos, com motivo, para a revisão do cliente.', sub: 'Listas', macro: '',
      catia: XL + ': \' uma linha por exceção aceita em Mecânica 3: unidade, conferência, motivo, hora', nx: '/* planilha gerada pelo programa: exceções aceitas em Mecânica 3 */' },
  ];
  const DRS = ['DR01', 'DR02', 'DR03'];

  const estacao = () => {
    if (AE.origem('fixacao') !== 'reserva') { const fx = AE.espiar('fixacao'); if (fx && fx.st) return fx.st; }
    if (AE.calc.unidades) return AE.calc.unidades().st;
    const l = AE.calc.listaEstacoes(); return l.length ? l[0].st : 10;
  };
  /* assinatura do que as saídas desenham: unidades, exceções e versão do plano */
  const assinatura = () => {
    const u = AE.calc.unidades ? AE.calc.unidades().assinatura : JSON.stringify((AE.espiar('unidades') || {}).unidades || []);
    const ex = ((AE.espiar('conferir') || {}).excecoes || []).map((e) => e.id + e.motivo).join(',');
    const fx = AE.origem('fixacao') !== 'reserva' ? (AE.espiar('fixacao') || {}).versao || '' : '';
    return `${u}|${ex}|${fx}`;
  };

  AE.tela({
    id: 'saidas', sigla: 'M4', area: 'mec', rotulo: 'Mecânica 4', titulo: 'Desenhos e listas',
    resumo: 'Tudo é gerado do 3D, na pasta certa do projeto, com versão.',
    tip: 'Abre as saídas da Mecânica: folhas de montagem, detalhes, contornos, listas e cálculos, geradas do 3D com versão.',
    entradas: [{ de: 'conferir', o: 'Unidades liberadas' }, { de: 'fixacao', o: 'Versão aprovada do plano' }],
    inicial: () => ({ rev: 1, revAssin: null, feitas: {}, drs: {}, aprovado: false, previa: 'lista', reg: [] }),
    programador: `
      <h3>O que esta tela guarda</h3>
      <ul>
        <li>Cada saída gerada: versão, hora e a <code>assinatura</code> do dispositivo no momento em que foi gerada.</li>
        <li>A revisão de conceito (<code>rev</code> → C1, C2…), as revisões do cliente (DR01, DR02) e a aprovação DR03 (quem e quando).</li>
      </ul>
      <h3>Regras</h3>
      <ul>
        <li>Toda saída nasce do 3D; nada é desenhado à mão. Produto novo: as saídas ficam marcadas "desatualizadas".</li>
        <li>Pasta de destino vem da estrutura do projeto (<code>14.3_Mecânica/ST…/</code>); o usuário nunca escolhe onde salvar.</li>
        <li>Bruto na lista: medida de catálogo com sobremetal, ou "BL espessura × largura × comprimento" para peça cortada.</li>
        <li>Material e tratamento vêm da lista de materiais do projeto.</li>
        <li>Versão C1, C2… no quadro de todas as folhas; F1 só com aprovação registrada (DR03). Gerar de novo depois de o dispositivo mudar abre a próxima versão de conceito.</li>
        <li>Simetria: desenha-se um lado; o outro é espelhado, com número de dispositivo próprio.</li>
      </ul>
      <h3>Saída</h3>
      <ul>
        <li>Os arquivos nas pastas do projeto e o passo concluído. Mecânica 4 não tem fatia lida por outro passo.</li>
      </ul>
      <h3>Macros de base</h3>
      <ul>
        <li><code>09_Pomigliano_965_DraftingGen</code>, <code>10_Balloon</code>, <code>21_AUTO_ALL_VIEWS</code>: folhas, balões e vistas.</li>
        <li><code>jlr_grid_100</code>: grade de coordenadas na vista.</li>
        <li><code>Symmetry_Instance</code>, <code>Mirror_an_ZX_all</code>: lado simétrico.</li>
        <li><code>conversao_corte_a_macarico</code>: folha de contornos.</li>
        <li><code>LP_rev4</code>, <code>BOM_CATIA-LISTA-PREL</code>: lista de peças.</li>
      </ul>
      <h3>Em aberto</h3>
      <ul>
        <li>Coluna "lado simétrico": o protótipo supõe posição par para a peça espelhada (1 → 2, 3 → 4) e a mesma posição para as de catálogo. É assim nas listas reais?</li>
        <li>DR01 e DR02 só ficam registradas aqui; os comentários do cliente deveriam virar pendências ligadas à unidade (fluxo M4 da v0).</li>
        <li>Folha de cálculo dos grampos, pacote da base, tabela de calços e lista de exceções não têm macro antiga: são novas.</li>
      </ul>`,

    render(ctx) {
      const t = ctx.termos();
      return `
      <div id="sd-faixa"></div>
      <div class="bloco">
        <div class="barra entre"><h2>Saídas do módulo <span class="exemplo">dados de exemplo</span></h2><span id="sd-ver"></span></div>
        <p class="sub" id="sd-pasta"></p>
        <div class="sd-grade" id="sd-lista"></div>
        <div id="sd-prog" style="margin-top:12px"></div>
        <div class="barra" style="margin-top:14px">
          <button class="btn primario" id="sd-todas" data-tip="Gera todas as saídas em sequência, do 3D atual, e salva cada uma na sua pasta do projeto como versão nova.">Gerar todas <span class="cad-tag">${esc(t.nome)}</span></button>
          <button class="btn leve" id="sd-abrir" data-tip="Abre a pasta do projeto onde as saídas desta estação foram salvas.">Abrir pasta</button>
        </div>
      </div>
      <div class="bloco">
        <h2>Prévia</h2>
        <p class="sub">O que vai dentro das duas listas, com os dados atuais do dispositivo.</p>
        <div class="abas" role="tablist" id="sd-abas">
          <button role="tab" data-p="lista" data-tip="Mostra a lista de peças de todas as unidades: posição, denominação, material, bruto, quantidade e o lado simétrico.">Lista de peças</button>
          <button role="tab" data-p="excecoes" data-tip="Mostra os avisos aceitos com motivo em Mecânica 3.">Lista de exceções</button>
        </div>
        <div id="sd-previa" style="margin-top:12px"></div>
      </div>
      <div class="bloco">
        <h2>Como o detalhe de cada peça sai</h2>
        <p class="sub">Igual aos desenhos reais que servem de referência.</p>
        <div class="leitura">
          <div><code>Grade</code><span>Duas vistas, cada uma com as linhas da grade do carro que passam pela peça; a peça é cotada a partir delas.</span></div>
          <div><code>Face</code><span>Nota "face matematizada para fresar", com o número da peça do produto, a data da revisão e a espessura da chapa.</span></div>
          <div><code>Furos</code><span>Pinos H7 e parafusos, com tolerância: ±0,2 nos passantes, ±0,02 nos pinos. Furos de pino pintados.</span></div>
          <div><code>Quadro</code><span>Posição, dispositivo, material e tratamento (da lista de materiais), bruto, acabamento por triângulos, escala, folha.</span></div>
          <div><code>Simetria</code><span>Desenha-se um lado; o outro é espelhado, com número de dispositivo próprio.</span></div>
        </div>
      </div>
      <div class="bloco">
        <h2>Revisão do cliente e conclusão</h2>
        <p class="sub">O cliente revisa o dispositivo em três etapas: DR01, DR02 e DR03. A versão só vira F1 com a aprovação DR03.</p>
        <div class="checagem" id="sd-check"></div>
        <div class="barra fim" style="margin-top:14px">
          <button class="btn" id="sd-dr" data-tip="Registra a próxima revisão do cliente. DR01 e DR02 guardam os comentários; DR03 é a aprovação do dispositivo e faz a versão virar F1.">Registrar revisão</button>
          <button class="btn primario" id="sd-concluir" data-tip="Confere se as 9 saídas foram geradas com o dispositivo atual e conclui a Mecânica 4.">Concluir desenhos e listas</button>
        </div>
        <h3 class="rotulo-sec">Registro</h3>
        <div class="registro" id="sd-reg"></div>
      </div>`;
    },

    montar(el, ctx) {
      const s = ctx.s, t = ctx.termos();
      s.feitas = s.feitas || {}; s.drs = s.drs || {}; s.reg = s.reg || [];
      AE.css('saidas', `
        .sd-grade{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
        .sd-s{background:var(--fundo);border:1px solid var(--linha);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:6px;min-width:0}
        .sd-s h3{font-family:var(--f-titulo);font-size:16px;font-weight:600;margin:0}
        .sd-s small{color:var(--suave);font-size:12.5px;flex:1}
        .sd-s .pasta{font-family:var(--f-dado);font-size:11.5px;color:var(--fraco);word-break:break-word}
        .sd-s .macro{font-family:var(--f-dado);font-size:11.5px;color:var(--l-sim);word-break:break-word}
        .sd-s.feita{border-color:var(--ok)} .sd-s.desat{border-color:var(--aviso)} .sd-s.agora{border-color:var(--azul);box-shadow:inset 0 0 0 1px var(--azul)}
        .sd-s .pilula{font-size:11px}
        #sd-previa td{white-space:nowrap}
        #sd-previa td.quebra{white-space:normal;min-width:180px}`);

      const versao = () => (s.aprovado ? 'F1' : 'C' + s.rev);
      const pasta = (sd) => `14.3_Mecânica/ST${estacao()}/${sd ? sd.sub : ''}`.replace(/\/$/, '');
      const addReg = (x) => { s.reg.unshift(`${hora()} · ${x}`); s.reg.length = Math.min(s.reg.length, 60); };
      const situacao = (sd, cur) => { const f = s.feitas[sd.id]; return !f ? 'nao' : f.assin !== cur ? 'desat' : 'ok'; };
      let gerando = null;

      const lista = () => {
        const cur = assinatura();
        $('#sd-ver', el).innerHTML = `<span class="pilula ${s.aprovado ? 'ok' : 'neutro'}" data-tip="${s.aprovado ? 'Versão final: o cliente aprovou o dispositivo (DR03).' : 'Versão de conceito. Vira F1 quando o cliente aprovar o dispositivo (DR03).'}">Versão ${versao()}</span>`;
        $('#sd-pasta', el).innerHTML = `Destino: <code>${esc(pasta())}</code>. Clique em "Gerar" em uma, ou gere todas de uma vez.`;
        $('#sd-lista', el).innerHTML = SAIDAS.map((sd) => {
          const st = situacao(sd, cur), f = s.feitas[sd.id];
          const pil = st === 'ok' ? `<span class="pilula ok">Gerada · ${esc(f.versao)} · ${esc(f.hora)}</span>` : st === 'desat' ? `<span class="pilula aviso" data-tip="O dispositivo (unidades, exceções ou plano de fixação) mudou depois que esta saída foi gerada.">Desatualizada · era ${esc(f.versao)}</span>` : '<span class="pilula neutro">Não gerada</span>';
          return `<div class="sd-s ${st === 'ok' ? 'feita' : st === 'desat' ? 'desat' : ''} ${gerando === sd.id ? 'agora' : ''}">
            <h3>${esc(sd.nome)}</h3><small>${esc(sd.o)}</small>
            <span class="pasta">${esc(pasta(sd))}</span>
            <span class="macro">${sd.macro ? 'macro de base: ' + esc(sd.macro) : 'nova, sem macro de base'}</span>
            <div class="barra entre">${pil}<button class="btn mini ${st === 'ok' ? 'leve' : ''}" data-s="${sd.id}" data-tip="${esc(`Gera esta saída do 3D atual e salva em ${pasta(sd)}, como versão ${st === 'desat' && !s.aprovado ? 'C' + (s.rev + (s.revAssin !== cur ? 1 : 0)) : versao()}.`)}">${st === 'ok' ? 'Gerar de novo' : 'Gerar'}</button></div></div>`;
        }).join('');
        const desat = SAIDAS.filter((sd) => situacao(sd, cur) === 'desat');
        $('#sd-faixa', el).innerHTML = desat.length
          ? `<div class="faixa-aviso amarela"><span><b>Dispositivo mudou:</b> ${desat.length} saída(s) desatualizada(s) (${esc(desat.map((d) => d.nome).join(', '))}). Gere de novo: a versão passa para a próxima de conceito.</span>
             <button class="btn mini" id="sd-desat" data-tip="Gera de novo só as saídas desatualizadas, em sequência.">Gerar as desatualizadas</button></div>` : '';
      };

      const previa = () => {
        $$('#sd-abas button', el).forEach((b) => b.setAttribute('aria-selected', b.dataset.p === s.previa));
        const box = $('#sd-previa', el);
        if (s.previa === 'excecoes') {
          const ex = (AE.espiar('conferir') || {}).excecoes || [];
          box.innerHTML = ex.length
            ? `<div class="rolagem"><table><thead><tr><th>Unidade</th><th>Conferência</th><th>O que foi aceito</th><th>Motivo</th><th>Hora</th></tr></thead><tbody>
                ${ex.map((e) => `<tr><td class="mono">${esc(e.un)}</td><td>${esc(e.o)}</td><td class="quebra">${esc(e.p)}</td><td class="quebra">${esc(e.motivo)}</td><td class="mono">${esc(e.hora)}</td></tr>`).join('')}</tbody></table></div>`
            : '<div class="vazio">Nenhuma exceção aceita em Mecânica 3. A lista de exceções sai vazia (só com o cabeçalho).</div>';
          return;
        }
        const U = AE.calc.unidades ? AE.calc.unidades() : null;
        if (!U || !U.lista.length) { box.innerHTML = '<div class="vazio">Nenhuma unidade montada. Monte as unidades em Mecânica 2 para ver a lista de peças.</div>'; return; }
        const linhas = U.lista.flatMap((u) => u.pecas.map((pc) => {
          const fab = pc.origem !== 'catálogo' && pc.pos < 299;
          return `<tr${pc.trocada ? ' style="color:var(--roxo)"' : ''}><td class="mono">${esc(u.id)}</td><td class="num">${pc.pos}</td><td>${esc(pc.den)}</td><td>${esc(pc.mat)}</td><td class="mono">${esc(pc.bruto)}</td><td class="num">${pc.qtd}</td>
            <td class="mono">${fab ? `pos. ${pc.pos + 1} · ${pc.qtd}× (espelhada)` : `mesma pos. · ${pc.qtd}×`}</td></tr>`;
        })).join('');
        const tot = U.lista.reduce((a, u) => a + u.pecas.reduce((b, p) => b + p.qtd, 0), 0);
        box.innerHTML = `<div class="rolagem alta"><table><thead><tr><th>Unid.</th><th class="num">Pos.</th><th>Denominação</th><th>Material</th><th>Bruto</th><th class="num">Qtd</th><th>Lado simétrico</th></tr></thead>
          <tbody>${linhas}</tbody><tfoot><tr><td colspan="5">${U.lista.length} unidade(s) · ST${esc(U.st)}</td><td class="num">${tot}</td><td>espelho com nº de dispositivo próprio</td></tr></tfoot></table></div>
          <p class="nota">Material e bruto saem de Mecânica 2. Peças trocadas pelo usuário aparecem em roxo.</p>`;
      };

      const check = () => {
        const cur = assinatura();
        const ok = SAIDAS.filter((sd) => situacao(sd, cur) === 'ok').length;
        const prox = DRS.find((d) => !s.drs[d]);
        const itens = [
          ['As 9 saídas geradas com o dispositivo atual', ok === SAIDAS.length, `${ok} de ${SAIDAS.length}`, 'erro'],
          ['Unidades liberadas em Mecânica 3', AE.concluido('conferir'), 'Ainda não liberadas: saídas preliminares', 'aviso'],
          ['Plano de fixação aprovado (F1)', !!(AE.espiar('fixacao') || {}).aprovado, 'Plano ainda em conceito', 'aviso'],
          ...DRS.map((d) => [d === 'DR03' ? 'DR03 · aprovação do dispositivo pelo cliente' : `${d} · revisão do cliente`, !!s.drs[d],
            d === prox ? 'Próxima' : 'Aguardando', 'neutro', s.drs[d] ? (s.drs[d].quem ? `${s.drs[d].quem} · ${s.drs[d].data}` : `${s.drs[d].hora}${s.drs[d].coment ? ' · ' + s.drs[d].coment : ''}`) : '']),
        ];
        $('#sd-check', el).innerHTML = itens.map((i) => `<div><span>${esc(i[0])}${i[4] ? ` <small style="color:var(--fraco)">(${esc(i[4])})</small>` : ''}</span>${i[1] ? '<span class="pilula ok">Certo</span>' : `<span class="pilula ${i[3]}">${esc(i[2])}</span>`}</div>`).join('');
        const b = $('#sd-dr', el);
        b.textContent = prox === 'DR03' ? 'Registrar aprovação DR03' : prox ? `Registrar revisão ${prox}` : 'DR03 registrada';
        $('#sd-reg', el).innerHTML = s.reg.length ? s.reg.map((r) => `<span>${esc(r)}</span>`).join('') : '<span>Nenhuma saída gerada nesta versão.</span>';
        return { ok, cur };
      };

      const tudo = () => { lista(); previa(); check(); };
      tudo();

      /* ---------- gerar ---------- */
      /* dispositivo mudou depois de gerar: a primeira saída gerada de novo abre a próxima versão de conceito */
      const abreVersao = (cur) => {
        const tem = Object.keys(s.feitas).length > 0;
        if (tem && s.revAssin && s.revAssin !== cur) {
          s.rev += 1;
          if (s.aprovado) { s.aprovado = false; delete s.drs.DR03; addReg('Dispositivo mudou depois da F1: volta a ser conceito, precisa de nova aprovação DR03'); }
          addReg(`Dispositivo mudou: saídas passam para a versão C${s.rev}`);
          ctx.registrar(`Mecânica 4: dispositivo mudou, saídas passam para C${s.rev}.`);
        }
        s.revAssin = cur;
      };
      const gerar = async (sd, botao, ms) => {
        const cur = assinatura();
        const ok = await ctx.cad({ titulo: `${sd.nome} · ${pasta(sd)}`, catia: sd.catia, nx: sd.nx, macro: sd.macro, resultado: `${sd.nome} gerada do 3D e salva em ${pasta(sd)}`, ms }, botao);
        if (!ok) return false;
        abreVersao(cur);
        s.feitas[sd.id] = { versao: versao(), hora: hora(), assin: cur };
        addReg(`${sd.nome} · ${versao()} · salva em ${pasta(sd)}`);
        return true;
      };
      const emSequencia = async (lista1, botao) => {
        if (gerando) { ctx.avisa('Já há uma geração em andamento. Aguarde terminar.'); return; }
        if (!AE.estado.cad.conectado) { await ctx.cad({ titulo: 'Gerar saídas' }); return; }
        botao.setAttribute('aria-busy', 'true');
        let n = 0;
        for (const sd of lista1) {
          gerando = sd.id; lista();
          $('#sd-prog', el).innerHTML = `<div class="barra entre" style="font-size:13.5px;color:var(--suave)"><span>Gerando ${n + 1} de ${lista1.length}: ${esc(sd.nome)}…</span><span>${Math.round((n / lista1.length) * 100)}%</span></div>
            <div class="medidor" style="margin-top:6px"><i style="width:${(n / lista1.length) * 100}%"></i></div>`;
          const ok = await gerar(sd, null, 320);
          if (!ok) { gerando = null; botao.removeAttribute('aria-busy'); ctx.salvar(); tudo(); $('#sd-prog', el).innerHTML = `<p class="nota erro">Parou em "${esc(sd.nome)}": o ${esc(t.nome)} está desconectado. ${n} de ${lista1.length} geradas.</p>`; return; }
          n++;
        }
        gerando = null; botao.removeAttribute('aria-busy');
        $('#sd-prog', el).innerHTML = `<div class="barra entre" style="font-size:13.5px;color:var(--suave)"><span>${n} de ${lista1.length} geradas · versão ${versao()}</span><span>100%</span></div><div class="medidor" style="margin-top:6px"><i style="width:100%"></i></div>`;
        ctx.registrar(`Mecânica 4: ${n} saída(s) geradas do 3D, versão ${versao()}, em ${pasta()}.`);
        ctx.salvar(); tudo();
        ctx.avisa(`${n} saída(s) geradas do 3D atual e salvas nas pastas do projeto, versão ${versao()}.`, { tipo: 'ok' });
      };
      $('#sd-lista', el).addEventListener('click', async (e) => {
        const b = e.target.closest('[data-s]'); if (!b) return;
        if (gerando) { ctx.avisa('Aguarde a geração em andamento terminar.'); return; }
        const sd = SAIDAS.find((x) => x.id === b.dataset.s);
        if (!(await gerar(sd, b))) return;
        ctx.salvar(); tudo();
        ctx.avisa(`${sd.nome} gerada e salva em ${pasta(sd)}, versão ${versao()}.`, { tipo: 'ok' });
      });
      $('#sd-todas', el).onclick = (e) => emSequencia(SAIDAS, e.currentTarget);
      el.addEventListener('click', (e) => {
        const b = e.target.closest('#sd-desat'); if (!b) return;
        const cur = assinatura();
        emSequencia(SAIDAS.filter((sd) => situacao(sd, cur) === 'desat'), b);
      });
      $('#sd-abrir', el).onclick = () => {
        const n = Object.keys(s.feitas).length;
        ctx.avisa(n ? `Pasta ${pasta()} aberta: ${n} saída(s) salvas nas subpastas Montagem, Detalhes, Corte, Listas e Cálculos.` : `Pasta ${pasta()} aberta. Ainda está vazia: gere as saídas primeiro.`);
      };
      $('#sd-abas', el).addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (!b) return; s.previa = b.dataset.p; ctx.salvarUI(); previa(); });

      /* ---------- revisões do cliente e conclusão ---------- */
      $('#sd-dr', el).onclick = async () => {
        const prox = DRS.find((d) => !s.drs[d]);
        if (!prox) { ctx.avisa(`DR03 já registrada: ${s.drs.DR03.quem} em ${s.drs.DR03.data}. A versão é F1.`); return; }
        const { ok, cur } = check();
        if (prox === 'DR03') {
          if (ok < SAIDAS.length) { ctx.avisa(`Para a aprovação DR03, as 9 saídas precisam estar geradas com o dispositivo atual (${ok} de 9). Use "Gerar todas".`, { tipo: 'erro' }); return; }
          const quem = await ctx.perguntar({ titulo: 'Aprovação do dispositivo (DR03)', texto: `O cliente aprovou o dispositivo na versão C${s.rev}? A partir daqui a versão vira F1 no quadro de todas as folhas.`, campo: 'Quem aprovou (nome e área do cliente)', ok: 'Registrar aprovação' });
          if (!quem) return;
          const data = new Date().toLocaleDateString('pt-BR');
          s.drs.DR03 = { quem, data, versao: 'C' + s.rev }; s.aprovado = true;
          Object.keys(s.feitas).forEach((k) => { if (s.feitas[k].assin === cur) s.feitas[k].versao = 'F1'; });
          addReg(`DR03: dispositivo aprovado por ${quem} em ${data} · C${s.rev} virou F1 no quadro de todas as folhas`);
          ctx.registrar(`Mecânica 4: dispositivo aprovado pelo cliente (DR03) por ${quem} em ${data}. Versão F1.`);
          ctx.salvar(); tudo();
          ctx.avisa('Aprovação DR03 registrada. As saídas agora são a versão final F1.', { tipo: 'ok' });
          return;
        }
        if (!ok) { ctx.avisa(`Gere as saídas antes de mandar para a revisão ${prox} do cliente.`, { tipo: 'erro' }); return; }
        const com = await ctx.perguntar({ titulo: `Revisão ${prox} do cliente`, texto: 'Resumo dos comentários do cliente nesta revisão (pode deixar em branco se não houve comentário).', campo: 'Comentários', tipo: 'textarea', obrigatorio: false, ok: `Registrar ${prox}` });
        if (com == null) return;
        s.drs[prox] = { hora: hora(), coment: com, versao: 'C' + s.rev };
        addReg(`${prox}: revisão do cliente registrada na C${s.rev}${com ? ' · ' + com : ' · sem comentários'}`);
        ctx.registrar(`Mecânica 4: revisão ${prox} do cliente registrada (C${s.rev}).`);
        ctx.salvar(); tudo();
        ctx.avisa(`Revisão ${prox} registrada.${prox === 'DR02' ? ' A próxima é a aprovação DR03.' : ''}`, { tipo: 'ok' });
      };
      $('#sd-concluir', el).onclick = () => {
        const { ok, cur } = check();
        if (ok < SAIDAS.length) {
          const falta = SAIDAS.filter((sd) => situacao(sd, cur) !== 'ok').map((sd) => sd.nome);
          ctx.avisa(`Faltam ${falta.length} saída(s) geradas com o dispositivo atual: ${falta.join(', ')}. Use "Gerar todas".`, { tipo: 'erro' });
          return;
        }
        ctx.concluir({
          registro: `Mecânica 4: 9 saídas geradas, versão ${versao()}, em ${pasta()}`,
          mensagem: s.aprovado ? 'Desenhos e listas concluídos na versão final F1.' : `Desenhos e listas concluídos na versão de conceito C${s.rev}. Vira F1 quando o cliente aprovar o dispositivo (DR03).`,
        });
      };
    },
  });
})();
