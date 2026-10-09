/* Mecânica 2 · Montar unidades
   Porta da tela "unidades" da v0 do Bruno. As unidades são CALCULADAS a partir dos apoios aprovados em
   Mecânica 1 (AE.espiar('fixacao').pontos): apoios a até "Distância para agrupar" ficam na mesma unidade,
   com um grampo só. Torre pela altura do ponto, sentidos de ajuste pela inclinação, grampo pelo momento.
   Saída: s.unidades (resumo) e AE.calc.unidades() (lista completa, com a lista de peças) para M3, M4 e M5. */
(function () {
  'use strict';
  const AE = window.AE;
  const { $, $$, esc, fmt, hora } = AE.util;

  const ruido = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
  /* inclinação do produto no ponto: de exemplo, determinística (no programa real vem da normal da superfície no 3D) */
  const incl = (p) => Math.round(ruido(p.x * 0.021 + p.z * 0.0126) * 20);
  const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const r1 = (v) => Math.round(v * 10) / 10;
  const pad = (n, k) => String(n).padStart(k, '0');
  const soApoio = (p) => p.sit === 'apo' || p.fun === 'Apenas apoio';
  const ehPiloto = (p) => p.sit !== 'apo' && /piloto/.test(p.fun);

  /* reserva: pontos de exemplo da v0 (nomes do pré-método) quando o plano de fixação ainda não chegou */
  const EXEMPLO = [['Hp1', 'Furo primário · piloto', 1180, -640, 760], ['Lp1', 'Furo secundário · piloto', 2105, -655, 842], ['S1', 'Apoio e pisador', 1180, -610, 455],
    ['S2', 'Apoio e pisador', 1760, -622, 470], ['S3', 'Apoio e pisador', 2150, -648, 512], ['S4', 'Apoio e pisador', 1330, -641, 905],
    ['S5', 'Apoio e pisador', 1360, -650, 820], ['S6', 'Apoio e pisador', 1840, -630, 520]]
    .map(([nome, fun, x, y, z]) => ({ nome, fun, x, y, z, sit: 'ok', com: '', novo: false, sug: false }));

  const TORRES = {
    macarico: { nome: 'Comau cortada a maçarico', min: 250, max: 450, tip: 'A mais recente (250 a 450 mm).' },
    antiga: { nome: 'Comau coluna antiga', min: 100, max: 500, tip: 'Algumas plantas ainda usam (100 a 500 mm).' },
    naams: { nome: 'NAAMS (riser)', min: 100, max: 600, tip: 'Alturas de catálogo NAAMS de exemplo (100 a 600 mm).' },
  };
  /* limite de momento no braço (Nm), ciclo de 1 s e de 2 s. Tünkers = tabela da v0; SMC = exemplo */
  const LIM = {
    tunkers: { 1: { 40: 2.2, 50: 4.5, 63: 6.0, 80: 8.0 }, 2: { 40: 3.3, 50: 6.7, 63: 9.0, 80: 11.2 } },
    smc: { 1: { 40: 2.0, 50: 4.0, 63: 5.6, 80: 7.4 }, 2: { 40: 3.0, 50: 6.0, 63: 8.4, 80: 10.6 } },
  };
  const MODELOS = {
    AP1: { nome: 'AP1 · Apoio e pisador, 1 sentido', sent: 1, grampos: 1 },
    AP2: { nome: 'AP2 · Apoio e pisador, 2 sentidos, com guia', sent: 2, grampos: 1, guia: true },
    AB1: { nome: 'AB1 · Só apoio, 1 sentido', sent: 1, grampos: 0 },
    AB2: { nome: 'AB2 · Só apoio, 2 sentidos', sent: 2, grampos: 0 },
    APD: { nome: 'APD · Apoio e pisador, 2 grampos', sent: 1, grampos: 2 },
    APL: { nome: 'APL · Apoio e pisador, grampo lateral', sent: 1, grampos: 1 },
    APT: { nome: 'APT · Apoio, pisador e 3º sentido', sent: 3, grampos: 1, guia: true },
    APB: { nome: 'APB · Apoio e pisador em torre baixa', sent: 1, grampos: 1 },
  };

  /* parâmetros efetivos: o que o usuário escolheu, senão o padrão do cliente */
  function params(s) {
    const pd = AE.calc.projeto().padrao || {};
    return {
      cat: s.cat || pd.catalogo || 'comau', torre: s.torre || 'macarico', esp: Number(s.esp || pd.espessura || 20), calco: Number(s.calco || pd.calco || 5),
      ang: Number(s.ang) || 105, fab: s.fab || pd.fabGrampo || 'Tünkers', dist: Number(s.dist) || 120, zBase: Number(s.zBase) || 0, padrao: pd,
    };
  }
  const tabelaFab = (fab) => (/SMC/.test(fab) ? LIM.smc : LIM.tunkers);
  const descGrampo = (fab, tam, ang) => (/SMC/.test(fab) ? `SMC grampo pneumático Ø${tam} · ${ang}°` : /Outro/.test(fab) ? `Grampo Ø${tam} (outro fabricante) · ${ang}°` : `Tünkers V ${tam}.1 A40 T12 · ${ang}°`);

  /* nome do arquivo no padrão do cliente, com posição de 4 dígitos e revisão A00 */
  function nomeArquivo(pd, st, ui, pos, den) {
    const tpl = String(pd.nomeArquivo || '');
    const D = den.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 26);
    if (!/</.test(tpl)) return `PRJ_ST${st}_U${pad(ui, 2)}_${pad(pos, 4)}_A00`;
    return tpl.replace(/<n[ºo°] dispositivo>/i, `DSP-ST${st}U${pad(ui, 2)}`).replace(/<posi[cç][aã]o[^>]*>/i, pad(pos, 4)).replace(/<revis[aã]o>/i, 'A00')
      .replace(/<denomina[cç][aã]o>/i, D).replace(/<descri[cç][aã]o>/i, D).replace(/<projeto>/i, 'PRJ').replace(/<esta[cç][aã]o>/i, `ST${st}`)
      .replace(/<unidade>/i, `U${pad(ui, 2)}`).replace(/<detalhe>/i, pad(pos, 4));
  }

  /* de onde vêm os pontos */
  function entrada() {
    const o = AE.origem('fixacao');
    if (o !== 'reserva') {
      const fx = AE.espiar('fixacao') || {};
      const pts = (fx.pontos || []).filter((p) => p.sit !== 'des' && (o === 'tela' || p.sit !== 'pen') && !(p.sug && !p.aceito));
      if (pts.some((p) => !ehPiloto(p))) {
        return { todos: fx.pontos, usados: pts, st: fx.st, fonte: o, versao: fx.versao || '', pendentes: (fx.pontos || []).filter((p) => p.sit === 'pen' || (p.sug && !p.aceito)) };
      }
    }
    const ests = AE.calc.listaEstacoes();
    return { todos: EXEMPLO, usados: EXEMPLO, st: ests.length ? ests[0].st : 10, fonte: 'exemplo', versao: '', pendentes: [] };
  }

  /* agrupamento: apoios a até `dist` (distância 3D) ficam juntos (ligação simples) */
  function agrupar(apoios, dist) {
    const pai = apoios.map((_, i) => i);
    const raiz = (i) => (pai[i] === i ? i : (pai[i] = raiz(pai[i])));
    for (let i = 0; i < apoios.length; i++) for (let j = i + 1; j < apoios.length; j++) if (d3(apoios[i], apoios[j]) <= dist) pai[raiz(i)] = raiz(j);
    const g = {};
    apoios.forEach((p, i) => (g[raiz(i)] = g[raiz(i)] || []).push(p));
    return Object.values(g).sort((a, b) => Math.min(...a.map((p) => p.x)) - Math.min(...b.map((p) => p.x)));
  }

  function torreDe(P, zTop, tr) {
    const T = TORRES[P.cat === 'naams' ? 'naams' : P.torre] || TORRES.macarico;
    const H = zTop - P.zBase, need = H - 50; // ponto a no máximo 50 mm acima do topo da torre
    let h = null, especial = false, motivo = '';
    for (let c = T.min; c <= T.max; c += 50) if (c >= need) { h = c; break; }
    if (h == null) { especial = true; h = Math.ceil(need / 10) * 10; motivo = `acima do catálogo (${T.max} mm)`; }
    else if (h > H) { especial = true; h = Math.max(40, Math.floor((H - 25) / 10) * 10); motivo = `abaixo do catálogo (${T.min} mm)`; }
    if (tr === 'especial' && !especial) { especial = true; h = Math.ceil((need + 25) / 10) * 10; motivo = 'troca do usuário'; }
    return { h, especial, nervura: especial && h > 400, alta: h > 700, tipo: T, need: Math.round(need), H: Math.round(H), motivo };
  }

  function calcular(s) {
    const P = params(s), E = entrada(), pd = P.padrao;
    const ativos = E.usados;
    const apoios = ativos.filter((p) => !ehPiloto(p));
    const grupos = agrupar(apoios, P.dist);
    const lista = grupos.map((g, gi) => {
      const ui = gi + 1, id = 'U' + ui;
      const pts = g.map((p) => p.nome), sig = pts.slice().sort().join('+');
      const tr = (s.trocas || {})[sig] || {};
      const tp = tr.pecas || {};
      const pis = g.filter((p) => !soApoio(p));
      const inc = Math.max(...g.map(incl));
      const modeloAuto = pis.length ? (inc >= 10 ? 'AP2' : 'AP1') : inc >= 10 ? 'AB2' : 'AB1';
      const modelo = tr.modelo && MODELOS[tr.modelo] ? tr.modelo : modeloAuto;
      const M = MODELOS[modelo];
      const sent = M.sent, nGr = M.grampos, nPis = nGr ? Math.max(pis.length, 1) : 0, guia = !!M.guia && nGr > 0;
      const torre = torreDe(P, Math.max(...g.map((p) => p.z)), tp[1] && /especial/i.test(tp[1]) ? 'especial' : null);
      if (modelo === 'APB' && !torre.especial) { torre.h = Math.max(40, Math.floor((torre.H - 25) / 10) * 10); torre.especial = true; torre.motivo = 'torre baixa (modelo APB)'; torre.nervura = torre.h > 400; torre.alta = torre.h > 700; }
      const spread = g.length > 1 ? Math.max(...g.flatMap((a) => g.map((b) => d3(a, b)))) : 0;
      /* grampo */
      const tamTroca = tp[738] && (tp[738].match(/(?:V |Ø)(\d+)/) || [])[1];
      const tam = Number(tamTroca) || 63;
      const angPad = P.ang;
      const angProp = nGr && inc >= 15 && angPad < 120 ? 120 : angPad;
      const ex = (s.angulos || {})[sig];
      const ang = ex ? Number(ex.ang) : angProp;
      const angMotivo = ex ? (Number(ex.ang) !== angPad ? ex.motivo : '') : angProp !== angPad ? `Com ${angPad}° o produto (inclinação de ${inc}°) colide com o pisador na saída. O programa propôs ${angProp}°.` : '';
      const peso = r1(1.4 + 0.9 * nPis + (sent >= 2 ? 0.4 : 0) + (guia ? 0.3 : 0) + (tam >= 80 ? 0.5 : tam <= 50 ? -0.3 : 0));
      const dist = Math.round(80 + spread / 2 + (inc >= 10 ? 25 : 0));
      const tab = tabelaFab(P.fab);
      const pesoGr = nGr ? peso / nGr : 0;
      const momento = nGr ? (pesoGr * 9.81 * dist) / 1000 : 0;
      const l1 = tab[1][tam], l2 = tab[2][tam];
      const resultado = !nGr ? 'sem' : momento <= l1 ? 'ok' : momento <= l2 ? '2s' : 'reprovado';
      const grampo = nGr ? { tam, qtd: nGr, fab: P.fab, desc: descGrampo(P.fab, tam, ang) } : null;

      /* lista de peças no formato da lista do dispositivo */
      const arq = (pos, den) => nomeArquivo(pd, E.st, ui, pos, den);
      const pecas = [];
      const add = (o) => pecas.push(Object.assign({ trocada: false, opcoes: null }, o, { arquivo: arq(o.pos, o.den) }));
      const T = torre.tipo;
      const torreDen = torre.especial ? `Console especial · ${torre.h} mm${torre.nervura ? ' · nervura parafusada' : ''}` : `Console ${T.nome} · ${torre.h} mm`;
      add({ pos: 1, den: torreDen, qtd: 1, mat: 'ABNT 1015', bruto: torre.especial || P.torre === 'macarico' || P.cat === 'naams' ? `BL ${P.esp}×${torre.especial ? 220 : 180}×${torre.h}` : 'coluna de catálogo',
        origem: torre.especial ? 'especial' : 'catálogo', opcoes: [torreDen, 'Torre especial (desenhar)'] });
      const wA = 90 + (inc >= 10 ? 28 : 0), lA = 120 + (g.length > 1 ? 20 : 0);
      add({ pos: 3, den: 'Bloco de contorno do apoio', qtd: g.length, mat: 'ABNT 1045', bruto: `BL ${P.esp}×${wA}×${lA}`, origem: 'construída', opcoes: ['Bloco de contorno do apoio', 'Bloco de catálogo L 70×70 (usinar contorno)', 'Peça especial (desenhar)'] });
      if (nPis) add({ pos: 5, den: 'Bloco de contorno do pisador', qtd: nPis, mat: 'ABNT 1045', bruto: `BL ${P.esp}×70×120`, origem: 'construída', opcoes: ['Bloco de contorno do pisador', 'Bloco de catálogo T 50×100 (usinar contorno)', 'Peça especial (desenhar)'] });
      add({ pos: 7, den: 'Cantoneira L 90×90 · 4 furos', qtd: 1, mat: 'ABNT 1015', bruto: `BL ${P.esp}×90×90`, origem: 'catálogo', opcoes: ['Cantoneira L 90×90 · 4 furos', 'Cantoneira L 70×70 · 3 furos', 'Cantoneira larga 50 mm · 2 pinos + 4 M8'] });
      if (sent >= 2) add({ pos: 9, den: 'Cantoneira intermediária (2º sentido)', qtd: 1, mat: 'ABNT 1015', bruto: `BL ${P.esp}×70×110`, origem: 'construída' });
      if (guia) add({ pos: 11, den: 'Guia do pisador (inclinação ≥ 10°)', qtd: 1, mat: 'ABNT 1045', bruto: `BL ${P.esp}×40×90`, origem: 'construída' });
      if (sent >= 3) add({ pos: 13, den: 'Bloco de ajuste do 3º sentido', qtd: 1, mat: 'ABNT 1045', bruto: `BL ${P.esp}×60×80`, origem: 'construída' });
      const calcoDen = (c) => `Pacote de calços 65×20 · ${c} mm`;
      add({ pos: 299, den: calcoDen(P.calco), qtd: 2 * sent + (nPis ? 2 : 0), mat: 'aço (catálogo)', bruto: '—', origem: 'catálogo', opcoes: [5, 8, 10].map(calcoDen) });
      if (grampo) add({ pos: 738, den: grampo.desc, qtd: nGr, mat: '—', bruto: '—', origem: 'catálogo', opcoes: [63, 50, 80].map((t) => descGrampo(P.fab, t, ang)) });
      add({ pos: 905, den: 'Placa de identificação', qtd: 1, mat: 'alumínio', bruto: 'BL 2×40×80', origem: 'construída' });
      /* trocas do usuário (ficam roxas e registradas) */
      pecas.forEach((pc) => {
        const v = tp[pc.pos];
        if (v == null || !pc.opcoes) return;
        if (v === pc.den) return;
        pc.trocada = true;
        if (pc.pos === 738) { pc.den = v; return; }
        if (pc.pos === 1) { pc.den = v; pc.origem = 'especial'; return; }
        pc.den = v;
        if (/especial/i.test(v)) pc.origem = 'especial';
        else if (/catálogo|Cantoneira L|Pacote/.test(v)) pc.origem = 'catálogo';
        pc.arquivo = arq(pc.pos, v);
      });
      return {
        id, ui, sig, pts, pontos: g, inc, sent, modelo, modeloAuto, torre, grampo, nPis, guia, spread: Math.round(spread),
        peso, pesoGr: r1(pesoGr), dist, momento, l1, l2, resultado, momentoOk: resultado !== 'reprovado', ang, angPad, angProp, angMotivo, pecas,
      };
    });
    const pilotos = E.todos.filter((p) => ehPiloto(p) && p.sit !== 'des' && !(p.sug && !p.aceito));
    const fora = E.todos.filter((p) => p.sit === 'des');
    return { lista, pilotos, fora, pendentes: E.pendentes, st: E.st, fonte: E.fonte, versao: E.versao, P, nApoios: apoios.length };
  }
  const resumo = (c) => c.lista.map((u) => ({
    id: u.id, sig: u.sig, pts: u.pts, torre: u.torre.h, torreEspecial: u.torre.especial, grampo: u.grampo ? u.grampo.tam : null, peso: u.peso, dist: u.dist,
    momento: r1(u.momento * 10) / 10, ang: u.ang, angPadrao: u.angPad, momentoOk: u.momentoOk, resultado: u.resultado, sent: u.sent, inc: u.inc, modelo: u.modelo,
  }));
  const assinatura = (c) => c.lista.map((u) => `${u.sig}|${u.torre.h}|${u.grampo ? u.grampo.tam : 0}|${u.ang}|${u.modelo}|${u.pecas.filter((p) => p.trocada).length}`).join(';') + `#${c.P.cat}${c.P.esp}${c.P.calco}${c.P.fab}`;

  /* saída compartilhada: lista completa das unidades (com a lista de peças), para M3, M4 e M5 */
  AE.calc.unidades = () => {
    const c = calcular(AE.espiar('unidades') || {});
    return Object.assign(c, { assinatura: assinatura(c) });
  };

  const inicialFatia = () => ({ cat: null, torre: 'macarico', esp: null, calco: null, ang: 105, fab: null, dist: 120, zBase: 100, trocas: {}, angulos: {}, sel: null, montado: null, refeito: {}, unidades: [] });

  AE.tela({
    id: 'unidades', sigla: 'M2', area: 'mec', rotulo: 'Mecânica 2', titulo: 'Montar unidades',
    resumo: 'O programa agrupa os pontos aprovados e monta cada unidade de catálogo. Você confere e troca o que quiser.',
    tip: 'Abre a montagem das unidades: agrupar os apoios aprovados, escolher torre, grampo e peças de catálogo, e criar tudo no CAD.',
    entradas: [{ de: 'fixacao', o: 'Pontos aprovados do plano de fixação' }, { de: 'simulacao', o: 'Nuvem de pinças' }],
    inicial: () => { const s = inicialFatia(); s.unidades = resumo(calcular(s)); return s; },
    programador: `
      <h3>O que esta tela guarda</h3>
      <ul>
        <li>Os parâmetros do projeto (catálogo, torre, espessura, calço, ângulo, fabricante, distância para agrupar, altura da base). <code>null</code> = segue o padrão do cliente.</li>
        <li>As <code>trocas</code> do usuário por unidade (modelo e peças), e as exceções de <code>angulos</code> com motivo. A chave da unidade é a lista dos pontos (<code>sig</code>), para sobreviver a um reagrupamento.</li>
        <li><code>montado</code>: quando e com que assinatura as unidades foram criadas no CAD.</li>
      </ul>
      <h3>Regras</h3>
      <ul>
        <li>Agrupar apoios a até 120 mm (distância 3D, editável). Um grampo leva todos. Pilotos vão para Mecânica 5; desconsiderados ficam de fora.</li>
        <li>Inclinação do produto abaixo de 10°: 1 sentido. A partir de 10°: 2 sentidos (cantoneira a mais). Piloto que apoia: 3.</li>
        <li>Apoio: bruto de catálogo + 3 a 5 mm por lado usinado; corte na altura, espessura inteira; face de contato a no mínimo 25 mm da fixação.</li>
        <li>Torre: altura de catálogo, ponto a no máximo 50 mm do topo; acima de 700 mm alerta; especial acima de 400 leva nervura.</li>
        <li>Grampo: 63 em dispositivo; momento = peso × 9,81 × distância ≤ tabela do fabricante (ciclo de 1 s; até o limite de 2 s é aprovado só com ciclo de 2 s).</li>
        <li>Ângulo padrão do grampo para todos; onde o produto não sai em linha reta (inclinação ≥ 15°) o programa propõe 120° e vira exceção com motivo.</li>
        <li>Tudo trocável; a troca fica registrada e o programa adapta as peças vizinhas.</li>
        <li>Lista de peças: posições ímpares para peças fabricadas; 299 calços; 738 grampo; 905 placa. Material ABNT 1045 nos blocos de contato e ABNT 1015 no console. Bruto "BL espessura × largura × comprimento".</li>
      </ul>
      <h3>Saída</h3>
      <ul>
        <li><code>AE.espiar('unidades').unidades</code> = <code>[{id, sig, pts, torre, grampo, peso, dist, ang, momentoOk, resultado, sent, inc}]</code>.</li>
        <li><code>AE.calc.unidades()</code>: lista completa (pontos, torre, grampo, cálculo, lista de peças com nome de arquivo), pilotos e desconsiderados. Lida por Mecânica 3, 4 e 5.</li>
      </ul>
      <h3>Macros de base</h3>
      <ul><li><code>Create_Clamping_area</code> (conceito: criar apoio e trimar); <code>INSERT_PART</code>, <code>naams.xla</code> (biblioteca NAAMS).</li></ul>
      <h3>Em aberto</h3>
      <ul>
        <li>"Altura da base" (Z do topo da placa base no zero carro) foi acrescentada para calcular a torre: de onde vem no projeto real (project book, altura de trabalho)?</li>
        <li>Peso em movimento e distância do CG são estimados aqui (por pisador e pela abertura do grupo). No programa real vêm do 3D.</li>
        <li>Tabela da SMC e alturas NAAMS são de exemplo. Precisamos das tabelas reais.</li>
        <li>Os 8 modelos de partida (AP1, AP2…) são nomes supostos. Quais são as 8 montagens do Bruno?</li>
        <li>Qtd do pacote de calços: suposto 2 por sentido de ajuste + 2 no pisador. Confere?</li>
      </ul>`,

    render(ctx) {
      const t = ctx.termos();
      return `
      <div class="bloco">
        <h2>Parâmetros deste projeto</h2>
        <p class="sub">Vêm da tela Novo projeto e do padrão do cliente. Nada disto fica fixo no código. Mudou aqui, as unidades são refeitas na hora.</p>
        <div class="campos" id="un-par"></div>
      </div>
      <div class="instrucao">
        <div><strong id="un-ins-tit">Unidades</strong><span id="un-ins">Clique em uma unidade para ver as peças. Troque o modelo ou uma peça; o programa refaz o resto.</span></div>
        <button class="btn primario" id="un-montar" data-tip="Agrupa os pontos aprovados pela distância, escolhe o modelo de unidade da biblioteca e as peças de catálogo, cria tudo no ${esc(t.nome)} vinculado ao produto e roda as conferências.">Montar unidades <span class="cad-tag">${esc(t.nome)}</span></button>
      </div>
      <div class="bloco">
        <h2>Unidades desta estação <span class="exemplo">dados de exemplo</span></h2>
        <p class="sub" id="un-fonte"></p>
        <div class="cartoes" id="un-lista"></div>
        <div id="un-outros" style="margin-top:12px"></div>
      </div>
      <div class="bloco">
        <h2 id="un-titulo">Unidade</h2>
        <p class="sub">Escolha o modelo, o ângulo do grampo e troque qualquer peça. A troca fica roxa e registrada.</p>
        <div class="campos" id="un-escolhas"></div>
        <div class="duas" style="margin-top:6px">
          <div><h3 class="rotulo-sec">Esboço da unidade</h3><div class="cad" id="un-esboco"></div></div>
          <div><h3 class="rotulo-sec">Cálculo da torre e do grampo</h3>
            <p class="sub" style="margin-bottom:8px">O programa lê peso e centro de gravidade do 3D e confere contra a tabela do fabricante.</p>
            <div class="calc" id="un-calc"></div></div>
        </div>
        <h3 class="rotulo-sec">Lista de peças da unidade</h3>
        <div class="rolagem"><table id="un-pecas"><thead><tr><th class="num">Pos.</th><th>Denominação</th><th class="num">Qtd</th><th>Material</th><th>Bruto</th><th>Origem</th><th>Nome do arquivo</th></tr></thead><tbody></tbody></table></div>
        <div class="barra" style="margin-top:12px">
          <button class="btn" id="un-refazer" data-tip="Refaz a unidade com as peças atuais: recria o 3D no ${esc(t.nome)}, mantém o vínculo com o produto e roda as conferências de novo.">Refazer no ${esc(t.nome)} <span class="cad-tag">${esc(t.nome)}</span></button>
          <button class="btn leve" id="un-desfazer" data-tip="Volta esta unidade ao que o programa propôs: desfaz as trocas de modelo, de peças e a exceção de ângulo.">Voltar ao proposto</button>
        </div>
      </div>
      <div class="bloco">
        <h2>Concluir</h2>
        <p class="sub">As unidades seguem para a conferência de alertas (Mecânica 3). Sem a nuvem de pinças da Simulação, elas ficam marcadas para conferência.</p>
        <div class="checagem" id="un-check"></div>
        <div class="barra fim" style="margin-top:12px">
          <button class="btn primario" id="un-concluir" data-tip="Confere se as unidades foram montadas no CAD com os parâmetros atuais e conclui a Mecânica 2. Em seguida, abra a conferência de alertas.">Concluir montagem</button>
        </div>
      </div>`;
    },

    montar(el, ctx) {
      const s = ctx.s, t = ctx.termos();
      s.trocas = s.trocas || {}; s.angulos = s.angulos || {}; s.refeito = s.refeito || {};
      AE.css('unidades', `
        .un-card .pts{font-family:var(--f-dado);font-size:12px;color:var(--acao);word-break:break-word}
        .un-card h3 .pilula{font-size:11px}
        #un-pecas td{white-space:nowrap}
        #un-pecas tr.troc td{color:var(--roxo)}
        #un-pecas tr.troc td:first-child{box-shadow:inset 3px 0 0 var(--roxo)}
        #un-pecas select{max-width:260px;font-size:13px}
        #un-pecas .arq{font-family:var(--f-dado);font-size:12px;color:var(--suave)}
        .un-origem{font-size:11.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--suave)}
        .un-origem.especial{color:var(--aviso)}
        .un-tag{font-family:var(--f-dado);font-size:12px;border:1px solid var(--linha2);border-radius:4px;padding:1px 6px;color:var(--suave)}
        #un-esboco text{font-size:11px}`);

      let C = calcular(s);
      const P = () => C.P;
      const atual = () => C.lista.find((u) => u.sig === s.sel) || C.lista[0] || null;
      const grava = () => { s.unidades = resumo(C); };
      const recalcular = () => { C = calcular(s); grava(); };
      grava(); ctx.salvarUI();

      /* ---------- parâmetros ---------- */
      const parametros = () => {
        const p = P(), pd = p.padrao, naams = p.cat === 'naams';
        const op = (v, txt, atualV, cli) => `<option value="${esc(v)}" ${String(v) === String(atualV) ? 'selected' : ''}>${esc(txt)}${cli ? ' (padrão do cliente)' : ''}</option>`;
        $('#un-par', el).innerHTML = `
          <label class="campo">Catálogo de peças<select data-par="cat" data-tip="GM e Ford usam NAAMS; os demais partem do padrão Comau. O usuário pode trocar.">
            ${op('comau', 'Comau', p.cat, pd.catalogo === 'comau')}${op('naams', 'NAAMS (GM e Ford)', p.cat, pd.catalogo === 'naams')}</select></label>
          <label class="campo">Tipo de torre Comau<select data-par="torre" ${naams ? 'disabled' : ''} data-tip="A cortada a maçarico é a mais recente (250 a 450 mm). Algumas plantas ainda usam a coluna antiga (100 a 500 mm). Com NAAMS, a torre é o riser do catálogo NAAMS.">
            ${op('macarico', 'Cortada a maçarico · 250 a 450', p.torre)}${op('antiga', 'Coluna antiga · 100 a 500', p.torre)}</select></label>
          <label class="campo">Espessura das peças<select data-par="esp" data-tip="20 mm é o padrão. Algumas montadoras usam 19 mm; muda só a espessura, pino Ø8 e M8 continuam.">
            ${op(20, '20 mm', p.esp, pd.espessura === 20)}${op(19, '19 mm', p.esp, pd.espessura === 19)}</select></label>
          <label class="campo">Calço nominal<select data-par="calco" data-tip="5 mm é o mais comum. Há montadora que pede 8 ou 10 mm.">
            ${[5, 8, 10].map((c) => op(c, c + ' mm', p.calco, pd.calco === c)).join('')}</select></label>
          <label class="campo">Ângulo padrão do grampo<select data-par="ang" data-tip="Todo grampo nasce com este ângulo. Só muda onde o produto não entra e sai em linha reta; aí vira exceção, com o motivo.">
            ${[105, 90, 120].map((a) => op(a, a + '°', p.ang)).join('')}</select></label>
          <label class="campo">Fabricante do grampo<select data-par="fab" data-tip="Vem da lista de homologados do cliente. O programa tem a tabela de cálculo da Tünkers e da SMC; outro fabricante é calculado como Tünkers.">
            ${['Tünkers', 'SMC', 'Outro (calcula como Tünkers)'].map((f) => op(f, f, p.fab, pd.fabGrampo === f)).join('')}</select></label>
          <label class="campo">Distância para agrupar apoios (mm)<input type="number" data-par="dist" min="20" max="1000" step="10" value="${p.dist}" data-tip="Apoios a até esta distância um do outro (3D) ficam na mesma unidade, com um grampo só. Mude e veja as unidades se reagruparem."></label>
          <label class="campo">Altura da base (Z do topo da placa, mm)<input type="number" data-par="zBase" step="10" value="${p.zBase}" data-tip="Z do topo da placa base no zero carro. A altura da torre sai do Z do ponto menos esta altura (ponto a no máximo 50 mm acima do topo da torre)."></label>`;
        if (naams) $('#un-par', el).insertAdjacentHTML('beforeend', '<p class="nota" style="grid-column:1/-1">Catálogo NAAMS: a torre é o riser NAAMS (100 a 600 mm). O tipo de torre Comau não se aplica.</p>');
      };

      /* ---------- cartões ---------- */
      const pil = (u) => u.torre.alta ? ['aviso', 'Torre alta'] : u.resultado === 'reprovado' ? ['erro', 'Grampo reprovado'] : u.resultado === '2s' ? ['aviso', 'Só com ciclo de 2 s'] : u.resultado === 'sem' ? ['info', 'Só apoio'] : ['ok', 'Grampo OK'];
      const cartoes = () => {
        const n = C.lista.length;
        $('#un-ins-tit', el).textContent = n ? `Os ${C.nApoios} apoios aprovados viraram ${n} unidade${n > 1 ? 's' : ''}` : 'Nenhum apoio para montar';
        const fonte = C.fonte === 'exemplo'
          ? 'O plano de fixação ainda não chegou (Mecânica 1 sem revisão): usando os pontos de exemplo da v0 (S1 a S6). As unidades ficam preliminares.'
          : C.fonte === 'andamento'
            ? `Usando os pontos já revisados do plano da ST${C.st} (${esc(C.versao)}). O plano ainda não foi liberado: unidades preliminares.`
            : `Pontos liberados do plano de fixação da ST${C.st} (${esc(C.versao)}).`;
        $('#un-fonte', el).innerHTML = `${fonte} O número de sentidos de ajuste vem da inclinação do produto no ponto.`;
        $('#un-lista', el).innerHTML = n ? C.lista.map((u) => {
          const [c, tx] = pil(u), sel = atual() && atual().sig === u.sig;
          return `<div class="cartao clicavel un-card ${sel ? 'sel' : ''}" data-sig="${esc(u.sig)}" tabindex="0" role="button" aria-pressed="${sel}"
            data-tip="${esc(`Unidade ${u.id}: ${u.pts.length} ponto(s), inclinação do produto ${u.inc}°, ${u.sent} sentido(s) de ajuste, torre ${u.torre.h} mm.`)}" data-tip-titulo="Unidade">
            <h3>${u.id}<span class="pilula ${c}">${tx}</span></h3>
            <span class="pts">${u.pts.map(esc).join(' + ')}</span>
            <small>${u.inc}° → ${u.sent} sentido${u.sent > 1 ? 's' : ''} de ajuste · torre ${u.torre.h} mm${u.torre.especial ? ' especial' : ''} · ${u.grampo ? (u.nPis > 1 ? `grampo leva ${u.nPis} pisadores` : '1 pisador') : 'sem grampo'}${u.grampo && u.ang !== u.angPad ? ` · ${u.ang}° (exceção)` : ''}</small>
            <small><span class="un-tag">${esc(u.modelo)}</span>${u.pecas.some((p) => p.trocada) || (s.trocas[u.sig] || {}).modelo ? ' <span class="pilula roxo" style="font-size:11px">com troca</span>' : ''}</small></div>`;
        }).join('') : '<div class="vazio">Nenhum apoio aprovado no plano de fixação desta estação. Revise os pontos em Mecânica 1: só os apoios (com ou sem pisador) viram unidade aqui.</div>';
        const outros = [];
        if (C.pilotos.length) outros.push(`<div class="item"><span class="tag">Pilotos</span><div>${C.pilotos.map((p) => `<b style="font-weight:600">${esc(p.nome)}</b> · ${esc(p.fun)}`).join('<br>')}<small>Furos de piloto não viram unidade aqui: vão para Mecânica 5 (piloto com pino retrátil).</small></div><a class="btn mini leve" href="#/outras" data-tip="Abre Mecânica 5, onde cada furo de piloto vira uma unidade de pino retrátil.">Mecânica 5 →</a></div>`);
        if (C.fora.length) outros.push(`<div class="item"><span class="tag" style="color:var(--erro)">Fora</span><div>${C.fora.map((p) => esc(p.nome)).join(', ')}<small>Marcados como "Desconsiderar" no plano de fixação: não viram unidade.</small></div><span></span></div>`);
        if (C.pendentes.length) outros.push(`<div class="item"><span class="tag" style="color:var(--aviso)">Sem revisão</span><div>${C.pendentes.map((p) => esc(p.nome)).join(', ')}<small>Ainda sem situação no plano de fixação: entram aqui quando forem revisados.</small></div><a class="btn mini leve" href="#/fixacao" data-tip="Abre Mecânica 1 para revisar estes pontos.">Mecânica 1 →</a></div>`);
        $('#un-outros', el).innerHTML = outros.length ? `<div class="lista">${outros.join('')}</div>` : '';
      };

      /* ---------- unidade selecionada ---------- */
      const detalhe = () => {
        const u = atual();
        if (!u) {
          $('#un-titulo', el).textContent = 'Unidade';
          $('#un-escolhas', el).innerHTML = '';
          $('#un-pecas tbody', el).innerHTML = '<tr><td colspan="7"><div class="vazio">Sem unidade para mostrar.</div></td></tr>';
          $('#un-esboco', el).innerHTML = ''; $('#un-calc', el).innerHTML = '';
          return;
        }
        $('#un-titulo', el).textContent = `Unidade ${u.id} · pontos ${u.pts.join(', ')}`;
        const tr = s.trocas[u.sig] || {};
        $('#un-escolhas', el).innerHTML = `
          <label class="campo">Modelo da unidade (biblioteca: 8 montagens de partida)<select id="un-modelo" data-tip="Troca o modelo inteiro desta unidade. O programa refaz as peças, os sentidos de ajuste e o grampo. A troca fica registrada.">
            ${Object.keys(MODELOS).map((k) => `<option value="${k}" ${k === u.modelo ? 'selected' : ''}>${esc(MODELOS[k].nome)}${k === u.modeloAuto ? ' (proposto)' : ''}</option>`).join('')}</select></label>
          ${u.grampo ? `<label class="campo">Ângulo deste grampo<select id="un-ang" data-tip="Ângulo de abertura do grampo desta unidade. Diferente do padrão vira exceção e pede o motivo.">
            ${[...new Set([90, 105, 120, 135, u.ang])].sort((a, b) => a - b).map((a) => `<option value="${a}" ${a === u.ang ? 'selected' : ''}>${a}°${a === u.angPad ? ' (padrão)' : a === u.angProp ? ' (proposto)' : ''}</option>`).join('')}</select></label>` : ''}
          ${u.angMotivo && u.grampo && u.ang !== u.angPad ? `<p class="nota aviso" style="grid-column:1/-1">Exceção de ângulo: ${esc(u.angMotivo)}</p>` : ''}
          ${tr.modelo ? `<p class="nota" style="grid-column:1/-1;border-left-color:var(--roxo)">Modelo trocado pelo usuário (proposto: ${esc(MODELOS[u.modeloAuto].nome)}).</p>` : ''}`;
        $('#un-pecas tbody', el).innerHTML = u.pecas.map((pc) => `<tr class="${pc.trocada ? 'troc' : ''}">
          <td class="num">${pc.pos}</td>
          <td>${pc.opcoes ? `<select data-pos="${pc.pos}" aria-label="Peça da posição ${pc.pos}" data-tip="Troca só esta peça. O programa adapta as vizinhas (furação, calços, altura) e refaz o cálculo do grampo.">
              ${[...new Set([pc.den, ...pc.opcoes])].map((o) => `<option ${o === pc.den ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>` : esc(pc.den)}</td>
          <td class="num">${pc.qtd}</td><td>${esc(pc.mat)}</td><td class="mono">${esc(pc.bruto)}</td>
          <td><span class="un-origem ${pc.origem === 'especial' ? 'especial' : ''}">${esc(pc.origem)}</span></td>
          <td class="arq">${esc(pc.arquivo)}</td></tr>`).join('');
        esboco(u); calculo(u);
      };

      const esboco = (u) => {
        const th = Math.round(70 + Math.max(0, Math.min(1, (u.torre.h - 100) / 660)) * 80), ty = 200 - th;
        const ang = (u.inc * Math.PI) / 180, dy = Math.round(Math.tan(ang) * 50);
        const gy = ty + 36, gh = Math.max(24, Math.min(46, 198 - gy));
        const esp = u.torre.especial;
        $('#un-esboco', el).innerHTML = `<span class="rotulo">esboço · ${esc(u.id)}</span><svg viewBox="0 0 300 230" role="img" aria-label="Esboço da unidade ${esc(u.id)}: torre de ${u.torre.h} mm${u.grampo ? ', grampo e pisador' : ', só apoio'}">
          <rect width="300" height="230" style="fill:var(--cad)"/>
          <rect x="20" y="200" width="260" height="14" style="fill:#1B3156;stroke:#3A5C92"/>
          <rect x="55" y="190" width="40" height="10" style="fill:#1B3156;stroke:#3A5C92"/>
          <rect x="60" y="${ty}" width="30" height="${th}" style="fill:#1B3156;stroke:${esp ? 'var(--aviso)' : '#3A5C92'}" ${esp ? 'stroke-dasharray="5 3"' : ''}/>
          ${u.torre.nervura ? `<path d="M90 ${ty + 30} L90 ${196} L${116} ${196} Z" style="fill:none;stroke:var(--aviso)"/>` : ''}
          <rect x="90" y="${ty + 12}" width="38" height="20" style="fill:#1B3156;stroke:var(--azul)"/>
          ${u.sent >= 2 ? `<rect x="92" y="${ty + 34}" width="24" height="14" style="fill:#1B3156;stroke:var(--azul)" stroke-dasharray="3 2"/><text x="120" y="${ty + 45}">2º sentido</text>` : ''}
          <rect x="128" y="${ty + 16}" width="5" height="12" style="fill:var(--aviso)"/>
          <rect x="133" y="${ty + 14}" width="40" height="16" style="fill:#1B3156;stroke:var(--ok)"/>
          <path d="M115 ${ty + 12 + dy} L225 ${ty + 12 - dy}" style="stroke:var(--roxo);fill:none" stroke-width="2.5"/>
          ${u.grampo ? `<rect x="180" y="${gy}" width="46" height="${gh}" rx="3" style="fill:#16294A;stroke:var(--l-sim)"/>
            <path d="M203 ${gy} L203 ${ty - 2} L196 ${ty - 2}" style="stroke:var(--l-sim);fill:none" stroke-width="5"/>
            <rect x="160" y="${ty - 8 - Math.max(0, -dy)}" width="36" height="8" style="fill:#1B3156;stroke:var(--ok)"/>
            ${u.guia ? `<rect x="198" y="${ty - 20}" width="6" height="18" style="fill:none;stroke:var(--ok)" stroke-dasharray="2 2"/>` : ''}
            <text x="230" y="${gy + 18}">grampo</text><text x="230" y="${gy + 32}">${u.ang}°</text><text x="160" y="${ty - 14}">pisador</text>` : `<text x="180" y="${ty + 48}">sem grampo</text>`}
          <text x="24" y="${ty - 6}">torre ${u.torre.h}</text><text x="92" y="${ty + 8}">cantoneira</text><text x="134" y="${ty + 44}">apoio</text>
          <text x="228" y="${ty + 10 - dy}">produto ${u.inc}°</text>
        </svg>`;
      };

      const calculo = (u) => {
        const p = P(), T = u.torre;
        const linhas = [
          ['Ponto mais alto acima da base', `${T.H} mm`],
          ['Torre necessária (ponto a até 50 mm do topo)', `≥ ${T.need} mm`],
          [`Torre escolhida · ${T.especial ? 'especial, ' + (T.motivo || '') : 'catálogo ' + T.tipo.nome}`, `${T.h} mm`],
        ];
        if (T.nervura) linhas.push(['Especial acima de 400 mm', 'leva nervura']);
        if (T.alta) linhas.push(['Acima de 700 mm', '<span style="color:var(--aviso)">alerta</span>']);
        if (u.grampo) {
          linhas.push(['Grampo', `${esc(u.grampo.fab.replace(' (calcula como Tünkers)', ''))} tam. ${u.grampo.tam}${u.grampo.qtd > 1 ? ' × ' + u.grampo.qtd : ''}`]);
          linhas.push([`Peso em movimento (braço + ${u.nPis > 1 ? u.nPis + ' pisadores' : 'pisador'} + calços)`, `${fmt(u.pesoGr, 1)} kg`]);
          linhas.push(['Centro de gravidade ao eixo de giro', `${u.dist} mm`]);
          linhas.push(['Momento = peso × 9,81 × distância', `${fmt(u.momento, 2)} Nm`]);
          linhas.push([`Limite ${/SMC/.test(p.fab) ? 'SMC' : 'Tünkers'}, ciclo 1 s / 2 s`, `${fmt(u.l1, 1)} / ${fmt(u.l2, 1)} Nm`]);
          const cor = u.resultado === 'ok' ? 'var(--ok)' : u.resultado === '2s' ? 'var(--aviso)' : 'var(--erro)';
          const txt = u.resultado === 'ok' ? 'Aprovado' : u.resultado === '2s' ? 'Aprovado só com ciclo de 2 s' : 'Reprovado: encurtar braço ou subir tamanho';
          linhas.push(['Resultado', `<span style="color:${cor}">${txt}</span>`]);
        } else linhas.push(['Grampo', 'unidade só de apoio: sem grampo, nada a calcular']);
        $('#un-calc', el).innerHTML = linhas.map(([a, b], i) => `<span ${i === linhas.length - 1 ? 'class="total"' : ''}>${esc(a)}</span><b ${i === linhas.length - 1 ? 'class="total"' : ''}>${b}</b>`).join('');
      };

      const checagem = () => {
        const ass = assinatura(C);
        const montadoOk = !!(s.montado && s.montado.assin === ass);
        const rep = C.lista.filter((u) => u.resultado === 'reprovado');
        const itens = [
          ['Há unidades para montar', C.lista.length > 0, 'Nenhum apoio aprovado', 'erro'],
          ['Unidades montadas no CAD com os parâmetros atuais', montadoOk, s.montado ? 'Mudou depois de montar: monte de novo' : 'Falta montar', 'erro'],
          ['Cálculo do grampo aprovado em todas', rep.length === 0, rep.map((u) => u.id).join(', ') + ' reprovado (trava em Mecânica 3)', 'aviso'],
          ['Plano de fixação liberado', C.fonte === 'tela', C.fonte === 'exemplo' ? 'Usando pontos de exemplo' : 'Plano ainda em revisão', 'aviso'],
          ['Nuvem de pinças da Simulação', AE.calc.simulacao().nuvem.entregue, 'Não chegou: unidades marcadas para conferência', 'aviso'],
        ];
        $('#un-check', el).innerHTML = itens.map((i) => `<div><span>${esc(i[0])}</span>${i[1] ? '<span class="pilula ok">Certo</span>' : `<span class="pilula ${i[3]}">${esc(i[2])}</span>`}</div>`).join('');
        return itens;
      };

      const tudo = () => { recalcular(); parametros(); cartoes(); detalhe(); checagem(); };
      tudo();

      /* ---------- eventos: parâmetros ---------- */
      const mudaPar = (k, v) => {
        const p = P();
        if (k === 'dist') {
          const n = Number(v);
          if (!(n >= 20 && n <= 1000)) { ctx.avisa('Distância para agrupar: use um valor entre 20 e 1000 mm.', { tipo: 'erro' }); return; }
          s.dist = n;
        } else if (k === 'zBase') {
          const n = Number(v);
          if (!Number.isFinite(n)) { ctx.avisa('Altura da base: digite um número em mm.', { tipo: 'erro' }); return; }
          s.zBase = Math.round(n);
        } else if (k === 'ang') {
          s.ang = Number(v);
          const ex = Object.keys(s.angulos).length;
          ctx.avisa(`Ângulo padrão ${s.ang}° aplicado a todos os grampos.${ex ? ` ${ex} unidade(s) continuam como exceção.` : ''}`);
        } else {
          const pd = p.padrao, cli = { cat: pd.catalogo, esp: pd.espessura, calco: pd.calco, fab: pd.fabGrampo }[k];
          const val = k === 'esp' || k === 'calco' ? Number(v) : v;
          s[k] = k === 'torre' ? val : val === cli ? null : val;
        }
        ctx.salvar(); tudo();
      };
      $('#un-par', el).addEventListener('change', (e) => { const k = e.target.dataset.par; if (k) mudaPar(k, e.target.value); });
      $('#un-par', el).addEventListener('input', (e) => {
        if (e.target.dataset.par !== 'dist') return;
        const n = Number(e.target.value);
        if (n >= 20 && n <= 1000) { s.dist = n; ctx.salvar(); recalcular(); cartoes(); detalhe(); checagem(); }
      });

      /* ---------- eventos: unidades ---------- */
      const escolhe = (sig) => { s.sel = sig; ctx.salvarUI(); cartoes(); detalhe(); };
      $('#un-lista', el).addEventListener('click', (e) => { const c = e.target.closest('[data-sig]'); if (c) escolhe(c.dataset.sig); });
      $('#un-lista', el).addEventListener('keydown', (e) => { const c = e.target.closest('[data-sig]'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); escolhe(c.dataset.sig); } });
      $('#un-escolhas', el).addEventListener('change', async (e) => {
        const u = atual(); if (!u) return;
        const tr = (s.trocas[u.sig] = s.trocas[u.sig] || {});
        if (e.target.id === 'un-modelo') {
          const v = e.target.value;
          if (v === u.modeloAuto) delete tr.modelo; else tr.modelo = v;
          ctx.registrar(`${u.id} (${u.pts.join(', ')}): modelo trocado para ${MODELOS[v].nome}.`);
          ctx.salvar(); tudo();
          ctx.avisa(`Modelo da ${u.id} trocado. Peças, sentidos e grampo refeitos; troca registrada.`);
        }
        if (e.target.id === 'un-ang') {
          const a = Number(e.target.value);
          if (a === u.angProp) { delete s.angulos[u.sig]; ctx.registrar(`${u.id}: grampo volta ao ângulo ${a === u.angPad ? 'padrão' : 'proposto pelo programa'} (${a}°).`); }
          else if (a === u.angPad) { s.angulos[u.sig] = { ang: a, motivo: '' }; ctx.registrar(`${u.id}: grampo no ângulo padrão ${a}° (proposta de ${u.angProp}° recusada).`); }
          else {
            const sug = a === u.angProp ? `Com o padrão de ${u.angPad}° o produto colide com o pisador na saída.` : '';
            const mot = await ctx.perguntar({ titulo: `Ângulo de ${a}° na ${u.id}`, texto: `O padrão do projeto é ${u.angPad}°. Ângulo diferente vira exceção: escreva o motivo (vai para a lista de exceções).`, campo: 'Motivo', valor: (s.angulos[u.sig] || {}).motivo || sug, ok: 'Registrar exceção' });
            if (mot == null) { detalhe(); return; }
            s.angulos[u.sig] = { ang: a, motivo: mot };
            ctx.registrar(`${u.id}: grampo a ${a}° (exceção). Motivo: ${mot}`);
          }
          ctx.salvar(); tudo();
        }
      });
      $('#un-pecas', el).addEventListener('change', (e) => {
        const pos = e.target.dataset.pos, u = atual(); if (!pos || !u) return;
        const tr = (s.trocas[u.sig] = s.trocas[u.sig] || {});
        tr.pecas = tr.pecas || {};
        const pc = u.pecas.find((x) => String(x.pos) === pos);
        const orig = pc && pc.opcoes ? pc.opcoes[0] : '';
        if (e.target.value === orig) delete tr.pecas[pos]; else tr.pecas[pos] = e.target.value;
        ctx.registrar(`${u.id}: peça pos. ${pos} trocada para "${e.target.value}".`);
        ctx.salvar(); tudo();
        ctx.avisa(`Peça pos. ${pos} trocada. Furação, calços e cálculo do grampo refeitos; troca registrada.`);
      });
      $('#un-desfazer', el).onclick = () => {
        const u = atual(); if (!u) { ctx.avisa('Selecione uma unidade.'); return; }
        if (!s.trocas[u.sig] && !s.angulos[u.sig]) { ctx.avisa(`A ${u.id} já está como o programa propôs.`); return; }
        delete s.trocas[u.sig]; delete s.angulos[u.sig];
        ctx.registrar(`${u.id}: trocas desfeitas, volta ao proposto pelo programa.`); ctx.salvar(); tudo();
        ctx.avisa(`${u.id} voltou ao que o programa propôs.`);
      };
      $('#un-refazer', el).onclick = async (e) => {
        const u = atual(); if (!u) { ctx.avisa('Selecione uma unidade.'); return; }
        const ok = await ctx.cad({
          titulo: `Refazer unidade ${u.id}`,
          catia: `Set u = prd.Products.Item("${u.id}"): u.ReplaceComponent …: For Each pc In pecas: hsf.AddNewSplit(face, plano, 1)…: Next: prd.Update`,
          nx: `var comp = workPart.ComponentAssembly.RootComponent.FindObject("COMPONENT ${u.id} 1"); comp.Suppress(); …; workPart.ComponentAssembly.AddComponent(arquivo, "MODEL", "${u.id}", origem, matriz, -1, out _); theSession.UpdateManager.DoUpdate(marca);`,
          macro: 'Create_Clamping_area, INSERT_PART',
          resultado: `Unidade ${u.id} refeita no CAD com vínculo ao produto: ${u.pecas.length} posições, torre ${u.torre.h} mm. Conferências rodadas: veja Mecânica 3.`,
        }, e.currentTarget);
        if (!ok) return;
        s.refeito[u.sig] = hora();
        if (s.montado) s.montado.assin = assinatura(C);
        ctx.registrar(`${u.id} refeita no ${t.nome}.`); ctx.salvar(); checagem();
        ctx.avisa(`Unidade ${u.id} refeita no ${t.nome} com vínculo ao produto. Conferências rodadas: veja Mecânica 3.`, { tipo: 'ok', acao: { texto: 'Ver alertas', fn: () => ctx.ir('conferir') } });
      };

      /* ---------- montar e concluir ---------- */
      $('#un-montar', el).onclick = async (e) => {
        if (!C.lista.length) { ctx.avisa('Não há apoio aprovado para montar. Revise os pontos em Mecânica 1.', { tipo: 'erro' }); return; }
        const al = C.lista.filter((u) => u.torre.alta).length + C.lista.filter((u) => u.resultado !== 'ok' && u.resultado !== 'sem').length + C.lista.filter((u) => u.grampo && u.ang !== u.angPad).length;
        const nat = C.P.cat === 'naams';
        const ok = await ctx.cad({
          titulo: `Montar ${C.lista.length} unidades da ST${C.st}`,
          catia: `Set prd = CATIA.ActiveDocument.Product: For Each u In unidades: Set c = prd.Products.AddNewComponent("Product", u.Id): c.Products.AddComponentsFromFiles Array(${nat ? 'naams' : 'comau'}(u.Torre), …), "*": hsf.AddNewSplit(bloco, faceProduto, 1)…: Next: prd.Update`,
          nx: `foreach (var u in unidades) { var c = workPart.ComponentAssembly.AddComponent(biblioteca[u.Modelo], "MODEL", u.Id, u.Origem, u.Matriz, -1, out _); /* blocos: TrimBody pela face do produto */ }`,
          macro: nat ? 'Create_Clamping_area, INSERT_PART, naams.xla' : 'Create_Clamping_area, INSERT_PART',
          resultado: `${C.lista.length} unidades montadas no CAD a partir de ${C.nApoios} pontos aprovados. ${al} alerta(s) gerado(s).`,
          ms: 900,
        }, e.currentTarget);
        if (!ok) return;
        s.montado = { hora: hora(), assin: assinatura(C), n: C.lista.length };
        ctx.registrar(`${C.lista.length} unidades montadas no ${t.nome} (ST${C.st}), ${al} alerta(s).`);
        ctx.salvar(); checagem();
        ctx.avisa(`${C.lista.length} unidades montadas no ${t.nome} a partir de ${C.nApoios} pontos aprovados. ${al} alerta(s) gerado(s).`, { tipo: 'ok', acao: { texto: 'Conferir alertas (M3)', fn: () => ctx.ir('conferir') } });
      };
      $('#un-concluir', el).onclick = () => {
        const it = checagem();
        if (!it[0][1]) { ctx.avisa('Não há unidades: revise os apoios em Mecânica 1.', { tipo: 'erro' }); return; }
        if (!it[1][1]) { ctx.avisa(s.montado ? 'Os parâmetros ou as trocas mudaram depois da montagem: use "Montar unidades" de novo para o 3D ficar igual à tela.' : 'Use "Montar unidades" antes de concluir: o 3D das unidades precisa existir no CAD.', { tipo: 'erro' }); return; }
        const rep = C.lista.filter((u) => u.resultado === 'reprovado');
        ctx.concluir({
          registro: `Mecânica 2: ${C.lista.length} unidades montadas (ST${C.st})${rep.length ? `, ${rep.length} com grampo reprovado` : ''}`,
          mensagem: `${C.lista.length} unidades concluídas.${rep.length ? ` ${rep.map((u) => u.id).join(', ')} com grampo reprovado: vira trava na conferência.` : ''} Próximo: conferir alertas.`,
        });
      };
    },
  });
})();
