/* Mecânica 1 · Revisão do plano de fixação
   Porta da tela "fixacao" da v0 do Bruno. O plano do cliente (RPS, pré-método ou Datum) é lido pelo nome
   do ponto, cada ponto recebe uma situação e um comentário, o programa sugere apoios pelas quatro regras,
   gera o documento de retorno (C1 → C2…), registra a aprovação (F1) e libera os pontos para a modelagem.
   Saída lida por Mecânica 2 e Mecânica 5: AE.espiar('fixacao').pontos = [{nome, fun, x, y, z, sit, com, novo, sug}]. */
(function () {
  'use strict';
  const AE = window.AE;
  const { $, $$, esc, mm, clone, hora } = AE.util;

  /* ---------- leitura do nome do ponto, por tipo de plano (vem do cadastro do cliente) ---------- */
  const TIPOS = { vw: 'Volkswagen · RPS', st: 'Stellantis · pré-método', gm: 'General Motors · Datum' };
  const LEITURAS = {
    vw: [['H', 'Furo: recebe piloto (pino)'], ['F maiúscula', 'Apoio e pisador'], ['f minúscula', 'Apenas apoio'], ['x y z', 'Direção que o ponto trava']],
    st: [['Hp', 'Furo primário: piloto principal'], ['Lp', 'Furo secundário: segundo piloto'], ['S', 'Fixação: apoio e pisador']],
    gm: [['Pino 4 dir.', 'Furo principal: trava em quatro direções'], ['Pino 2 dir.', 'Furo secundário: trava em duas direções'], ['Rest / Clamp', 'Apoio e pisador'], ['Rest', 'Apenas apoio']],
  };
  const NOMES = {
    vw: ['RPS 1 Hxy', 'RPS 2 Hx', 'RPS 3 Fz', 'RPS 4 Fz', 'RPS 5 Fz', 'RPS 6 fz', 'RPS 7 fz', 'RPS 8 Fy'],
    st: ['Hp1', 'Lp1', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
    gm: ['A1 4-way', 'A2 2-way', 'B1 R/C', 'B2 R/C', 'B3 R/C', 'B4 Rest', 'B5 Rest', 'C1 R/C'],
  };
  /* ponto que o cliente acrescenta quando manda uma versão nova (simulação) */
  const NOVO_CLIENTE = { vw: ['RPS 9 Fz', 'Apoio e pisador'], st: ['S7', 'Apoio e pisador'], gm: ['B6 R/C', 'Apoio e pisador'] };
  const FUN = { pri: 'Furo primário · piloto', sec: 'Furo secundário · piloto', ap: 'Apoio e pisador', so: 'Apenas apoio' };
  const F_BASE = [FUN.pri, FUN.sec, FUN.ap, FUN.ap, FUN.ap, FUN.so, FUN.so, FUN.ap];
  const FUNCOES = { vw: F_BASE, gm: F_BASE, st: F_BASE.map((f) => (f === FUN.so ? FUN.ap : f)) };
  const SITS = { pen: 'Sem revisão', ok: 'OK', des: 'Desconsiderar', apo: 'Apenas apoio', add: 'Adicionar', red: 'Redefinir', alt: 'Alt. coord.' };
  const SIT_TXT = {
    pen: 'Ainda não revisado.', ok: 'Fica como o cliente pediu.', des: 'Não será usado nesta estação.', apo: 'Fica só o apoio, sem pisador.',
    add: 'Ponto novo, que o plano não tinha.', red: 'Muda a função do ponto.', alt: 'Mesma função, em outra posição.',
  };
  /* peça de exemplo: X, Y, Z do carro em mm (o cliente manda com decimal; a entrada arredonda) */
  const BASE = [[1180, -640, 760], [2105, -655, 842], [1180, -610, 455], [1760, -622, 470], [2150, -648, 512], [1330, -641, 905], [1360, -650, 820], [1840, -630, 520]];
  const dec = (i, k) => Math.round(Math.sin(i * 3.1 + k * 1.7) * 4) / 10; // casa decimal do cliente (±0,4)
  /* limites das regras de apoio (a validar com o Bruno) */
  const R_PILOTO = 200, R_SOLDA = 100;

  const f1 = (v) => String(v).replace('.', ',');
  const xyz = (p) => `${p.x} / ${p.y} / ${p.z}`;
  const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const P = (p) => [p.x, p.y, p.z];
  const ehApoio = (p) => p.sit === 'apo' || /poio/.test(p.fun);
  const ehPiloto = (p) => p.sit !== 'apo' && /piloto/.test(p.fun);
  const pendente = (p) => p.sit === 'pen' || (p.sug && !p.aceito);
  const precisaCom = (p) => !['ok', 'pen'].includes(p.sit);

  function planoNovo(tipo, st) {
    const ests = AE.calc.listaEstacoes();
    const k = Math.max(0, ests.findIndex((e) => e.st === st));
    const desl = [k * 25, -k * 15];
    const pontos = BASE.map((b, i) => {
      const cli = [b[0] + desl[0] + dec(i, 0), b[1] + dec(i, 1), b[2] + desl[1] + dec(i, 2)];
      return { nome: NOMES[tipo][i], fun: FUNCOES[tipo][i], x: mm(cli[0]), y: mm(cli[1]), z: mm(cli[2]), cli: cli.map((v) => Math.round(v * 10) / 10), sit: 'pen', com: '', novo: false, sug: false };
    });
    return {
      lidoCom: tipo, pontos, desl, n: 1, estado: 'recebida', versao: 'C1', docGerado: false, aprovado: false, aprovacao: null,
      snap: null, sel: -1, lido3D: null, liberado: null,
      reg: [`${hora()} · C1 recebida do cliente (${TIPOS[tipo]}): ${pontos.length} pontos, coordenadas arredondadas para mm inteiro (valores originais guardados)`],
    };
  }
  const CAMPOS_PLANO = ['lidoCom', 'pontos', 'desl', 'n', 'estado', 'versao', 'docGerado', 'aprovado', 'aprovacao', 'snap', 'sel', 'lido3D', 'liberado', 'reg'];

  /* geometria de referência da peça de exemplo: centro de gravidade e pontos de solda da junção */
  const geo = (s) => {
    const [dx, dz] = s.desl || [0, 0];
    return { cg: [1690 + dx, -635, 640 + dz], solda: [560, 620, 680].map((z) => [1990 + dx, -632, z + dz]) };
  };
  /* posição no desenho (vista lateral X × Z) */
  const tela = (s, x, z) => {
    const [dx, dz] = s.desl || [0, 0];
    return [Math.max(14, Math.min(506, Math.round(50 + (x - dx - 1150) * 0.4))), Math.max(14, Math.min(316, Math.round(262 - (z - dz - 420) * 0.4)))];
  };

  /* casco convexo (X × Z) e ponto dentro dele */
  function casco(pts) {
    const a = pts.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    if (a.length < 3) return a;
    const cr = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
    const lo = [], hi = [];
    a.forEach((p) => { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); });
    a.slice().reverse().forEach((p) => { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); });
    return lo.slice(0, -1).concat(hi.slice(0, -1));
  }
  function dentro(h, q) {
    if (h.length < 3) return false;
    for (let i = 0; i < h.length; i++) {
      const o = h[i], p = h[(i + 1) % h.length];
      if ((p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]) < 0) return false;
    }
    return true;
  }

  /* as quatro regras de apoio (só alertam, não travam) */
  function regras(s) {
    const ativos = s.pontos.filter((p) => p.sit !== 'des');
    const apoios = ativos.filter(ehApoio), pilotos = ativos.filter(ehPiloto);
    const g = geo(s);
    const longe = pilotos.filter((pl) => !apoios.some((a) => d3(P(a), P(pl)) <= R_PILOTO));
    const soldaOk = g.solda.some((sp) => apoios.some((a) => d3(P(a), sp) <= R_SOLDA));
    const cgOk = dentro(casco(apoios.map((a) => [a.x, a.z])), [g.cg[0], g.cg[2]]);
    return { ativos, apoios, pilotos, longe, soldaOk, minimo: apoios.length >= 3, cgOk, g };
  }

  function checagem(s) {
    const r = regras(s);
    const pend = s.pontos.filter(pendente).length;
    const semCom = s.pontos.filter((p) => precisaCom(p) && !String(p.com || '').trim()).length;
    const pri = r.pilotos.some((p) => p.fun.startsWith('Furo primário')), sec = r.pilotos.some((p) => p.fun.startsWith('Furo secundário'));
    return [
      { t: 'Todos os pontos foram revisados', ok: pend === 0, falha: `${pend} sem revisão`, trava: true, como: 'Escolha a situação de cada ponto na tabela (ou "Marcar pendentes como OK"). Ponto sugerido precisa ser aceito ou descartado.' },
      { t: 'Todo ponto alterado tem comentário', ok: semCom === 0, falha: `${semCom} sem comentário`, trava: true, como: 'Escreva o comentário para o cliente em cada ponto que não está como OK.' },
      { t: 'A peça continua com furo primário e secundário', ok: pri && sec, falha: 'Falta piloto', trava: true, como: 'Um furo primário e um secundário precisam continuar ativos: volte a situação de um deles para OK.' },
      { t: 'Alerta: apoio perto dos pilotos', ok: !r.longe.length, falha: `${r.longe.map((p) => p.nome).join(', ')} sem apoio a até ${R_PILOTO} mm` },
      { t: 'Alerta: apoio perto da solda, na junção das peças', ok: r.soldaOk, falha: 'Junção sem apoio' },
      { t: 'Alerta: mínimo de 3 apoios no plano', ok: r.minimo, falha: `Só ${r.apoios.length} apoio(s)` },
      { t: 'Alerta: centro de gravidade dentro dos apoios', ok: r.cgOk, falha: 'Peça pode tombar' },
      { t: 'Documento de retorno gerado', ok: s.docGerado, falha: 'Falta gerar' },
      { t: 'Aprovação do cliente registrada', ok: s.aprovado, falha: 'Aguardando cliente' },
    ];
  }

  const rotuloVersao = (s) => {
    if (s.estado === 'aprovada') return `F1 · aprovada pelo cliente (era C${s.n})`;
    if (s.estado === 'enviada') return `C${s.n} · enviada ao cliente`;
    if (s.estado === 'revisao' && s.snap) return `C${s.n + 1} · em revisão (alterada depois da C${s.n})`;
    return `C${s.n} · recebida do cliente${s.estado === 'revisao' ? ' · em revisão' : ''}`;
  };
  const codVersao = (s) => (s.estado === 'aprovada' ? 'F1' : s.estado === 'revisao' && s.snap ? 'C' + (s.n + 1) : 'C' + s.n);

  AE.tela({
    id: 'fixacao', sigla: 'M1', area: 'mec', rotulo: 'Mecânica 1', titulo: 'Revisão do plano de fixação',
    resumo: 'Conferir, ponto por ponto, onde o dispositivo vai apoiar, prender e localizar a peça. Só depois disso se modela.',
    tip: 'Abre a revisão do plano de fixação: ler os pontos do cliente, dar a situação de cada um, sugerir apoios, devolver ao cliente e liberar para a modelagem.',
    entradas: [{ de: 'inicio', o: 'Cliente: tipo de plano de fixação' }, { de: 'separacao', o: 'Produto em 3D e estações' }],
    inicial: () => {
      const pj = AE.calc.projeto(), ests = AE.calc.listaEstacoes();
      const tipo = (pj.padrao && pj.padrao.plano) || 'vw', st = ests.length ? ests[0].st : 10;
      return Object.assign({ tipo: null, st, outras: {} }, planoNovo(tipo, st));
    },
    programador: `
      <h3>O que esta tela guarda</h3>
      <ul>
        <li>Um <code>ponto de fixação</code> único por estação: nome, função, X, Y, Z, situação, comentário e origem (cliente, criado aqui ou sugerido). O valor com decimal que o cliente mandou fica em <code>cli</code>.</li>
        <li>A <code>versão</code> do plano (C1, C2… e F1 quando aprovado), o retrato da última versão enviada (<code>snap</code>) e o registro de cada mudança.</li>
        <li>A <code>aprovação</code>: quem, quando, qual versão.</li>
        <li>O plano das outras estações fica guardado em <code>outras</code> enquanto você trabalha em uma.</li>
      </ul>
      <h3>Regras</h3>
      <ul>
        <li>A leitura do nome é uma tabela por cliente. Cliente novo é uma tabela nova, sem mexer no código. O tipo de plano começa pelo padrão do cliente do Passo 0.</li>
        <li>Toda coordenada é em milímetro inteiro, sem casa depois da vírgula. A que vem do cliente com decimal é arredondada na entrada, e o valor original fica guardado no registro. Vale para o programa todo.</li>
        <li>Ponto novo nasce de um clique no CAD: o programa lê a posição, arredonda e cria o ponto.</li>
        <li>Regras de apoio: perto dos pilotos (até ${R_PILOTO} mm); perto da solda, de preferência na junção das peças (até ${R_SOLDA} mm); mínimo de 3 por plano; centro de gravidade dentro dos apoios (casco convexo dos apoios na vista X × Z).</li>
        <li>As quatro regras de apoio só geram alerta. Não travam nada: o usuário decide e segue.</li>
        <li>Situação diferente de OK exige comentário.</li>
        <li>Ponto do cliente nunca é apagado, só marcado.</li>
        <li>Sem aprovação, a Mecânica pode modelar, mas tudo fica preliminar.</li>
        <li>Cliente mandou versão nova: o programa compara e reabre só os pontos que mudaram.</li>
        <li>O mesmo ciclo de revisão vale para o dispositivo pronto: o cliente revisa, devolve comentários e aprova.</li>
      </ul>
      <h3>Saída</h3>
      <ul>
        <li>Documento de retorno, no padrão do cliente, na pasta <code>14.3_Mecânica/ST…/Plano de fixação</code>.</li>
        <li>Lista de unidades a modelar, uma por ponto aprovado: <code>AE.espiar('fixacao').pontos</code> = <code>[{nome, fun, x, y, z, sit, com, novo, sug}]</code> e <code>.st</code>. Mecânica 2 lê os apoios; Mecânica 5 lê os furos de piloto.</li>
      </ul>
      <h3>Macros de base</h3>
      <ul><li><code>Cordenadas</code> e <code>WritePoints2Excel</code>: ler nome e coordenadas dos pontos.</li></ul>
      <h3>Em aberto</h3>
      <ul>
        <li>As distâncias das regras (${R_PILOTO} mm do piloto, ${R_SOLDA} mm da solda) foram supostas: qual é o valor do Bruno e do Nelson?</li>
        <li>"Mínimo de 3 apoios em cada plano": o protótipo conta os apoios do plano principal. Precisa contar por direção (3-2-1)?</li>
        <li>O centro de gravidade e a junção da peça são de exemplo. No programa real eles vêm do 3D (massa e CG da peça, curvas de junção).</li>
        <li>O passo é concluído por estação ou só quando todas as estações tiverem o plano liberado?</li>
        <li>Quem do cliente pode aprovar (cargo, área)? O protótipo só guarda o texto digitado.</li>
      </ul>`,

    render(ctx) {
      const s = ctx.s, t = ctx.termos();
      return `
      <div id="fx-faixa"></div>
      <div class="bloco">
        <h2>Plano recebido</h2>
        <p class="sub">Cada cliente escreve o plano de um jeito. O programa lê o nome do ponto e entende a função dele.</p>
        <div class="campos">
          <label class="campo">Cliente e tipo de plano<select id="fx-tipo" data-tip="Troca a regra de leitura do nome dos pontos. A regra vem do padrão do cliente, não fica escrita no código. Trocar relê o plano."></select></label>
          <label class="campo">Estação<select id="fx-est" data-tip="Cada estação tem o seu plano de fixação. Trocar guarda o plano desta estação e abre o da outra."></select></label>
          <label class="campo">Versão do plano<input type="text" id="fx-ver" readonly data-tip="C1, C2… são versões de conceito. Vira F1 quando a aprovação do cliente é registrada."></label>
        </div>
        <h3 class="rotulo-sec">Como o programa lê o nome do ponto</h3>
        <div class="leitura" id="fx-leitura"></div>
        <div class="barra" style="margin-top:14px">
          <button class="btn" id="fx-imp" data-tip="Abre o arquivo do plano de fixação enviado pelo cliente (planilha, desenho ou 3D) e monta a tabela de pontos. Se a versão já foi enviada, importa a versão nova do cliente e reabre só os pontos que mudaram.">Importar plano do cliente</button>
          <button class="btn" id="fx-ler" data-tip="Lê os pontos de fixação que estão dentro do 3D do produto aberto no ${esc(t.nome)}: nome e coordenadas X, Y, Z, e confere com a tabela.">Ler pontos do 3D <span class="cad-tag">${esc(t.nome)}</span></button>
          <button class="btn leve" id="fx-comp" data-tip="Compara esta versão do plano com a anterior e mostra só os pontos que entraram, saíram ou mudaram de coordenada.">Comparar com a versão anterior</button>
        </div>
        <div id="fx-comp-res"></div>
      </div>

      <div class="instrucao">
        <div><strong>Revise cada ponto e escolha a situação</strong><span>Clique no ponto no desenho ou na linha da tabela. Tudo o que não for "OK" precisa de um comentário para o cliente.</span></div>
        <button class="btn" id="fx-okall" data-tip="Marca como OK todos os pontos que ainda estão sem revisão. Os que você já marcou não mudam.">Marcar pendentes como OK</button>
      </div>

      <div class="duas">
        <div class="bloco">
          <h2>Peça com os pontos <span class="exemplo">desenho de exemplo</span></h2>
          <p class="sub">A cor do ponto é a situação dele. O tracejado é a junção das peças (× = solda) e ⊕ é o centro de gravidade.</p>
          <div class="cad"><span class="rotulo">vista do ${esc(t.nome)} · X × Z</span><div id="fx-svg"></div></div>
          <div class="contagem" id="fx-cont" style="margin-top:12px"></div>
        </div>
        <div class="bloco">
          <h2>Ponto selecionado</h2>
          <p class="sub">Os dados do ponto e, abaixo, o que significa cada situação.</p>
          <div id="fx-det"></div>
          <div class="leitura fx-legenda" style="margin-top:14px;font-size:13.5px">
            ${Object.keys(SITS).filter((k) => k !== 'pen').map((k) => `<div><code class="fx-s-${k}">${SITS[k]}</code><span>${SIT_TXT[k]}</span></div>`).join('')}
          </div>
        </div>
      </div>

      <div class="bloco">
        <h2>Pontos do plano <span class="exemplo">dados de exemplo</span></h2>
        <p class="sub">Uma linha por ponto. A situação e o comentário vão para o documento de retorno.</p>
        <div class="barra" style="margin-bottom:12px">
          <button class="btn" id="fx-add" data-tip="Pede para você clicar na peça, no ${esc(t.nome)}, onde quer o ponto. O programa lê a posição, arredonda para milímetro inteiro (nunca fica número quebrado), cria o ponto no 3D e a linha na tabela.">Adicionar ponto <span class="cad-tag">${esc(t.nome)}</span></button>
          <button class="btn" id="fx-sug" data-tip="O programa propõe apoios seguindo quatro regras: perto dos pilotos, perto da solda (de preferência na junção das peças), no mínimo 3 apoios em cada plano, e centro de gravidade da peça dentro dos apoios. Você aceita ou descarta cada um.">Sugerir pontos</button>
          <button class="btn leve" id="fx-rm" data-tip="Remove o ponto selecionado, se ele foi criado aqui. Ponto que veio do cliente não é apagado: use Desconsiderar.">Remover ponto criado</button>
        </div>
        <div class="rolagem"><table id="fx-tab">
          <thead><tr><th>Ponto</th><th>Função lida</th><th class="num">X / Y / Z (mm)</th><th>Situação</th><th>Comentário para o cliente</th></tr></thead>
          <tbody></tbody>
        </table></div>
      </div>

      <div class="bloco">
        <h2>Checagem e retorno ao cliente</h2>
        <p class="sub">A modelagem do dispositivo só é liberada como final com a aprovação registrada. As linhas de alerta avisam, mas não travam.</p>
        <div class="checagem" id="fx-check"></div>
        <div class="barra fim" style="margin-top:14px">
          <button class="btn" id="fx-doc" data-tip="Monta o documento de retorno no padrão do cliente: a imagem da peça com os pontos coloridos e a tabela com situação e comentário. Salva na pasta do projeto, como versão nova.">Gerar documento de retorno</button>
          <button class="btn" id="fx-apr" data-tip="Registra que o cliente aprovou esta versão: quem aprovou e em que data. A partir daqui o plano vira final (F1).">Registrar aprovação do cliente</button>
          <button class="btn primario" id="fx-lib" data-tip="Envia os pontos aprovados para a modelagem. Cada ponto vira o pedido de uma unidade: apoio com pisador e grampo, apenas apoio, ou piloto. Sem aprovação do cliente, vai como preliminar.">Liberar para a modelagem</button>
        </div>
        <h3 class="rotulo-sec">Registro do plano</h3>
        <div class="registro" id="fx-reg"></div>
      </div>`;
    },

    montar(el, ctx) {
      const s = ctx.s, t = ctx.termos();
      AE.css('fixacao', `
        .fx-marc{cursor:pointer;stroke:#070F1C;stroke-width:2}
        .fx-marc.sel{stroke:var(--texto);stroke-width:3}
        .fx-marc:focus{outline:none;stroke:var(--azul);stroke-width:3}
        .fx-s-ok{fill:var(--ok);color:var(--ok)} .fx-s-des{fill:var(--erro);color:var(--erro)} .fx-s-apo{fill:var(--azul);color:var(--azul)}
        .fx-s-add{fill:var(--acao);color:var(--acao)} .fx-s-red{fill:var(--laranja);color:var(--laranja)} .fx-s-alt{fill:var(--roxo);color:var(--roxo)} .fx-s-pen{fill:var(--fraco);color:var(--suave)}
        .fx-legenda code{min-width:112px}
        #fx-tab td{white-space:nowrap}
        #fx-tab select{min-width:132px}
        #fx-tab input.fx-com{min-width:190px}
        #fx-tab input.fx-com.falta{border-color:var(--aviso)}
        #fx-det .leitura code{min-width:84px}
        #fx-det .fx-xyz{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:8px}
        .fx-dif td:first-child{font-family:var(--f-dado);font-size:13px}
        .fx-svg-txt{font-size:12.5px}
        @media (max-width:520px){.fx-legenda code{min-width:96px}}`);

      const tipoEf = () => s.tipo || (AE.calc.projeto().padrao || {}).plano || 'vw';
      const addReg = (txt) => { s.reg.unshift(`${hora()} · ${txt}`); s.reg.length = Math.min(s.reg.length, 40); };
      const sync = () => { s.docGerado = s.estado === 'enviada' || s.estado === 'aprovada'; s.aprovado = s.estado === 'aprovada'; s.versao = codVersao(s); };
      /* plano alterado: depois do envio vira uma versão nova de conceito */
      const mudou = () => {
        if (s.estado === 'enviada' || s.estado === 'aprovada') {
          addReg(`Plano alterado depois do envio da ${s.estado === 'aprovada' ? 'F1' : 'C' + s.n}: nova versão de conceito, precisa gerar o documento de novo`);
          ctx.registrar(`Plano de fixação ST${s.st} alterado depois do envio ao cliente: volta a ser conceito.`);
          s.estado = 'revisao'; s.aprovacao = null;
        } else if (s.estado === 'recebida') s.estado = 'revisao';
        sync(); ctx.salvar();
      };
      const sel = () => s.pontos[s.sel];
      const revisado = () => s.pontos.some((p) => p.sit !== 'pen' || p.novo);

      /* ---------- partes da tela ---------- */
      const cabecalho = () => {
        const pj = AE.calc.projeto(), cliT = pj.padrao.plano;
        $('#fx-tipo', el).innerHTML = Object.keys(TIPOS).map((k) => `<option value="${k}" ${k === s.lidoCom ? 'selected' : ''}>${TIPOS[k]}${k === cliT ? ' (padrão do cliente)' : ''}</option>`).join('');
        const ests = AE.calc.listaEstacoes();
        const temSt = ests.some((e) => e.st === s.st);
        $('#fx-est', el).innerHTML = (temSt ? '' : `<option value="${s.st}" selected>ST${s.st} · não existe mais no Passo 4</option>`) +
          ests.map((e) => `<option value="${e.st}" ${e.st === s.st ? 'selected' : ''}>${esc(e.rotulo)}</option>`).join('');
        $('#fx-ver', el).value = rotuloVersao(s);
        $('#fx-leitura', el).innerHTML = LEITURAS[s.lidoCom].map((l) => `<div><code>${esc(l[0])}</code><span>${esc(l[1])}</span></div>`).join('') +
          (s.lido3D ? `<p class="nota ok">Pontos conferidos com o 3D às ${esc(s.lido3D)}.</p>` : '');
        const ef = tipoEf();
        $('#fx-faixa', el).innerHTML = ef !== s.lidoCom
          ? `<div class="faixa-aviso amarela"><span>O cliente do projeto (${esc(pj.cliente)}) usa plano <b>${esc(TIPOS[ef])}</b>, mas este plano foi lido como <b>${esc(TIPOS[s.lidoCom])}</b>.</span>
             <button class="btn mini" id="fx-reler" data-tip="Lê o plano de novo com a regra do cliente do projeto. As revisões feitas neste plano são apagadas.">Ler com a regra do cliente</button></div>` : '';
      };

      const desenho = () => {
        const r = regras(s), g = r.g;
        const [cgx, cgy] = tela(s, g.cg[0], g.cg[2]);
        const sp = g.solda.map((p) => tela(s, p[0], p[2]));
        const ja = tela(s, g.solda[0][0], g.solda[0][2] - 40), jb = tela(s, g.solda[0][0], g.solda[2][2] + 40);
        /* rótulos: tenta direita, esquerda, acima e abaixo, sem bater em outro rótulo ou marcador */
        const pos = s.pontos.map((p) => tela(s, p.x, p.z));
        const caixas = pos.map(([x, y]) => [x - 10, y - 10, x + 10, y + 10]);
        const bate = (b) => b[0] < 4 || b[2] > 516 || b[1] < 4 || b[3] > 326 || caixas.some((c) => b[0] < c[2] && b[2] > c[0] && b[1] < c[3] && b[3] > c[1]);
        const rot = pos.map(([x, y], i) => {
          const w = s.pontos[i].nome.length * 7.4 + 2;
          const op = [[x + 13, y + 4, 'start', [x + 12, y - 7, x + 13 + w, y + 6]], [x - 13, y + 4, 'end', [x - 13 - w, y - 7, x - 12, y + 6]],
            [x, y - 14, 'middle', [x - w / 2, y - 25, x + w / 2, y - 11]], [x, y + 23, 'middle', [x - w / 2, y + 12, x + w / 2, y + 26]]];
          const o = (x > 400 ? [op[1], op[0], op[2], op[3]] : op).find((c) => !bate(c[3])) || op[x > 400 ? 1 : 0];
          caixas.push(o[3]);
          return o;
        });
        const marc = s.pontos.map((p, i) => {
          const [x, y] = pos[i], [tx, ty, an] = rot[i];
          return `<circle class="fx-marc fx-s-${p.sit} ${i === s.sel ? 'sel' : ''}" data-i="${i}" cx="${x}" cy="${y}" r="9" tabindex="0" role="button" aria-label="Ponto ${esc(p.nome)}: ${SITS[p.sit]}"><title>${esc(p.nome)} · ${SITS[p.sit]}</title></circle>
            <text class="fx-svg-txt" x="${tx}" y="${ty}" text-anchor="${an}">${esc(p.nome)}</text>`;
        }).join('');
        $('#fx-svg', el).innerHTML = `<svg viewBox="0 0 520 330" role="img" aria-label="Peça de exemplo com os pontos de fixação coloridos pela situação">
          <rect width="520" height="330" style="fill:var(--cad)"/>
          <path d="M30 60 L490 36 L500 236 L300 280 L40 296 Z" style="fill:#1B3156;stroke:#3A5C92" stroke-width="1.5"/>
          <path d="M105 150 L195 144 L198 200 L108 206 Z" style="fill:var(--cad);stroke:#3A5C92" stroke-width="1.2"/>
          <line x1="${ja[0]}" y1="${ja[1]}" x2="${jb[0]}" y2="${jb[1]}" style="stroke:var(--l-sim)" stroke-width="1.5" stroke-dasharray="6 4"/>
          ${sp.map(([x, y]) => `<path d="M${x - 4} ${y - 4} L${x + 4} ${y + 4} M${x + 4} ${y - 4} L${x - 4} ${y + 4}" style="stroke:var(--l-sim)" stroke-width="1.6"/>`).join('')}
          <text class="fx-svg-txt" x="${ja[0] + 8}" y="${jb[1] - 8}" style="fill:var(--l-sim)">junção</text>
          <circle cx="${cgx}" cy="${cgy}" r="7" style="fill:none;stroke:${r.cgOk ? 'var(--suave)' : 'var(--aviso)'}" stroke-width="1.5"/>
          <path d="M${cgx - 10} ${cgy} L${cgx + 10} ${cgy} M${cgx} ${cgy - 10} L${cgx} ${cgy + 10}" style="stroke:${r.cgOk ? 'var(--suave)' : 'var(--aviso)'}" stroke-width="1.2"/>
          <text class="fx-svg-txt" x="${cgx + 11}" y="${cgy + 16}">CG</text>
          ${marc}</svg>`;
        const cont = {};
        s.pontos.forEach((p) => (cont[p.sit] = (cont[p.sit] || 0) + 1));
        $('#fx-cont', el).innerHTML = Object.keys(SITS).filter((k) => cont[k]).map((k) => `<span class="pilula fx-s-${k}" style="fill:none" data-tip="${esc(SIT_TXT[k])}">${SITS[k]}: ${cont[k]}</span>`).join('');
      };

      const opcoesFun = (atual) => Object.values(FUN).map((f) => `<option ${f === atual ? 'selected' : ''}>${f}</option>`).join('');
      const detalhe = () => {
        const p = sel(), d = $('#fx-det', el);
        if (!p) { d.className = 'vazio'; d.innerHTML = 'Clique em um ponto no desenho ou em uma linha da tabela.'; return; }
        d.className = '';
        const vira = p.sit === 'des' ? 'Nada. O ponto não é usado.' : p.sit === 'apo' || p.fun === FUN.so ? 'Unidade só de apoio (Mecânica 2)'
          : /piloto/.test(p.fun) ? 'Unidade de piloto com pino retrátil (Mecânica 5)' : 'Unidade de apoio, pisador e grampo (Mecânica 2)';
        const cli = p.cli && (p.cli[0] !== p.x || p.cli[1] !== p.y || p.cli[2] !== p.z) ? `<div><code>Do cliente</code><span style="font-family:var(--f-dado);font-size:13px">${p.cli.map(f1).join(' / ')} <small style="color:var(--fraco)">(arredondado na entrada)</small></span></div>` : '';
        const orig = p.orig ? `<div><code>Antes</code><span style="font-family:var(--f-dado);font-size:13px">${p.orig.join(' / ')} mm</span></div>` : '';
        const editaXYZ = p.sit === 'alt' || p.novo;
        d.innerHTML = `<div class="leitura">
            <div><code>Nome</code><span>${esc(p.nome)}</span></div>
            <div><code>Função</code><span>${esc(p.fun)}${p.funOrig ? ` <small style="color:var(--fraco)">(era ${esc(p.funOrig)})</small>` : ''}</span></div>
            <div><code>X Y Z</code><span style="font-family:var(--f-dado);font-size:13px">${xyz(p)} mm</span></div>${cli}${orig}
            <div><code>Origem</code><span>${p.sug ? 'Sugerido pelo programa' + (p.aceito ? ' · aceito' : ' · aguardando aceitar ou descartar') : p.novo ? 'Criado nesta revisão' : 'Plano do cliente'}</span></div>
            <div><code>Situação</code><span class="fx-s-${p.sit}">${SITS[p.sit]}</span></div>
            <div><code>Vai virar</code><span>${vira}</span></div></div>
          ${p.sit === 'red' || p.novo ? `<label class="campo" style="margin-top:10px">${p.novo ? 'Função do ponto' : 'Nova função (Redefinir)'}<select id="fx-fun" data-tip="Muda a função deste ponto. A unidade que ele vira na modelagem muda junto.">${opcoesFun(p.fun)}</select></label>` : ''}
          ${editaXYZ ? `<div class="fx-xyz">${['x', 'y', 'z'].map((k) => `<label class="campo">${k.toUpperCase()} (mm)<input type="number" step="1" data-xyz="${k}" value="${p[k]}" data-tip="Nova coordenada. O programa arredonda para milímetro inteiro."></label>`).join('')}</div>
            <div class="barra" style="margin-top:8px"><button class="btn mini" id="fx-pegar" data-tip="Pede para você clicar a nova posição na peça, no ${esc(t.nome)}. O programa lê, arredonda para mm inteiro e move o ponto no 3D.">Pegar posição no ${esc(t.nome)}</button></div>` : ''}
          ${p.sug && !p.aceito ? `<div class="barra" style="margin-top:10px"><span class="sub" style="margin:0;flex:1 1 100%">${esc(p.com)}</span>
            <button class="btn mini primario" id="fx-aceitar" data-tip="Aceita a sugestão: cria o ponto no 3D do ${esc(t.nome)} e ele entra no plano como Adicionar.">Aceitar sugestão</button>
            <button class="btn mini perigo" id="fx-descartar" data-tip="Descarta a sugestão: o ponto sai da tabela e do desenho.">Descartar</button></div>` : ''}`;
      };

      const tabela = () => {
        $('#fx-tab tbody', el).innerHTML = s.pontos.map((p, i) => {
          const falta = precisaCom(p) && !String(p.com || '').trim();
          return `<tr data-i="${i}" class="clicavel ${i === s.sel ? 'sel' : ''}">
            <td class="mono"><span class="fx-s-${p.sit}" aria-hidden="true">●</span> ${esc(p.nome)}</td>
            <td>${esc(p.fun)}${p.sug ? ` <span class="pilula ${p.aceito ? 'ok' : 'aviso'}" style="font-size:11px">${p.aceito ? 'sugerido · aceito' : 'sugerido'}</span>` : p.novo ? ' <span class="exemplo" style="margin-left:4px">criado aqui</span>' : ''}</td>
            <td class="num">${xyz(p)}</td>
            <td><select data-sit="${i}" aria-label="Situação do ponto ${esc(p.nome)}">${Object.keys(SITS).map((k) => `<option value="${k}" ${k === p.sit ? 'selected' : ''}>${SITS[k]}</option>`).join('')}</select></td>
            <td><input type="text" class="fx-com ${falta ? 'falta' : ''}" data-com="${i}" value="${esc(p.com)}" placeholder="${falta ? 'obrigatório' : ''}" aria-label="Comentário do ponto ${esc(p.nome)}"></td></tr>`;
        }).join('');
      };

      const check = () => {
        const it = checagem(s);
        $('#fx-check', el).innerHTML = it.map((i) => `<div><span>${esc(i.t)}</span>${i.ok ? '<span class="pilula ok">Certo</span>' : `<span class="pilula ${i.trava ? 'erro' : 'aviso'}" ${i.como ? `data-tip="${esc(i.como)}"` : ''}>${esc(i.falha)}</span>`}</div>`).join('');
        $('#fx-reg', el).innerHTML = s.reg.length ? s.reg.map((r) => `<span>${esc(r)}</span>`).join('') : '<span>Nada registrado ainda.</span>';
        $('#fx-ver', el).value = rotuloVersao(s);
        return it;
      };

      let comparando = false;
      const comparacao = () => {
        const c = $('#fx-comp-res', el);
        if (!comparando) { c.innerHTML = ''; return; }
        if (!s.snap) {
          c.innerHTML = `<p class="nota">Esta é a primeira versão (C${s.n}). Não há versão anterior para comparar. O retrato da versão é guardado quando você gera o documento de retorno.</p>`;
          return;
        }
        const antes = {}; s.snap.pontos.forEach((p) => (antes[p.nome] = p));
        const agora = {}; s.pontos.forEach((p) => (agora[p.nome] = p));
        const linhas = [];
        s.pontos.forEach((p) => {
          const a = antes[p.nome];
          if (!a) { linhas.push([p.nome, '<span class="pilula ok">Entrou</span>', '—', `${xyz(p)} · ${esc(p.fun)}`]); return; }
          const mud = [];
          if (a.x !== p.x || a.y !== p.y || a.z !== p.z) mud.push(`coordenada ${xyz(a)} → ${xyz(p)}`);
          if (a.fun !== p.fun) mud.push(`função ${esc(a.fun)} → ${esc(p.fun)}`);
          if (a.sit !== p.sit) mud.push(`situação ${SITS[a.sit]} → ${SITS[p.sit]}`);
          if (mud.length) linhas.push([p.nome, '<span class="pilula aviso">Mudou</span>', `${xyz(a)}`, mud.join('; ')]);
        });
        s.snap.pontos.forEach((a) => { if (!agora[a.nome]) linhas.push([a.nome, '<span class="pilula erro">Saiu</span>', `${xyz(a)}`, '—']); });
        c.innerHTML = `<h3 class="rotulo-sec">Diferenças entre a ${esc(s.snap.versao)} enviada e a versão atual (${esc(codVersao(s))})</h3>` + (linhas.length
          ? `<div class="rolagem"><table class="fx-dif"><thead><tr><th>Ponto</th><th>O quê</th><th class="num">Antes (X / Y / Z)</th><th>Agora</th></tr></thead><tbody>${linhas.map((l) => `<tr><td>${esc(l[0])}</td><td>${l[1]}</td><td class="num">${l[2]}</td><td>${l[3]}</td></tr>`).join('')}</tbody></table></div>`
          : `<p class="nota ok">Nenhuma diferença desde a ${esc(s.snap.versao)}.</p>`);
      };

      const tudo = () => { sync(); cabecalho(); desenho(); detalhe(); tabela(); check(); comparacao(); };
      tudo();

      /* ---------- seleção ---------- */
      const seleciona = (i) => { s.sel = i; ctx.salvarUI(); desenho(); detalhe(); tabela(); };
      $('#fx-svg', el).addEventListener('click', (e) => { const m = e.target.closest('.fx-marc'); if (m) seleciona(+m.dataset.i); });
      $('#fx-svg', el).addEventListener('keydown', (e) => { const m = e.target.closest('.fx-marc'); if (m && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); seleciona(+m.dataset.i); } });
      $('#fx-tab', el).addEventListener('click', (e) => { if (e.target.closest('select,input')) return; const tr = e.target.closest('tr[data-i]'); if (tr) seleciona(+tr.dataset.i); });

      /* ---------- situação e comentário ---------- */
      $('#fx-tab', el).addEventListener('change', (e) => {
        const tg = e.target;
        if (tg.dataset.sit) {
          const i = +tg.dataset.sit, p = s.pontos[i], antes = p.sit;
          p.sit = tg.value; s.sel = i;
          if (p.sit === 'alt' && !p.orig && !p.novo) p.orig = [p.x, p.y, p.z];
          if (antes === 'red' && p.sit !== 'red' && p.funOrig) { p.fun = p.funOrig; delete p.funOrig; }
          if (p.sug && p.sit === 'pen') p.sit = 'add';
          mudou(); tudo();
          if (precisaCom(p) && !p.com) ctx.avisa(`Situação "${SITS[p.sit]}" pede um comentário para o cliente.`);
          if (p.sit === 'red') ctx.avisa('Escolha a nova função do ponto no quadro "Ponto selecionado".');
          if (p.sit === 'alt') ctx.avisa('Informe a nova posição no quadro "Ponto selecionado" ou pegue no CAD.');
        }
        if (tg.dataset.com) { s.pontos[+tg.dataset.com].com = tg.value.trim(); mudou(); tabela(); check(); }
      });
      $('#fx-okall', el).onclick = () => {
        const n = s.pontos.filter((p) => p.sit === 'pen').length;
        if (!n) { ctx.avisa('Não há ponto sem revisão.'); return; }
        s.pontos.forEach((p) => { if (p.sit === 'pen') p.sit = 'ok'; });
        addReg(`${n} ponto(s) marcados como OK de uma vez`); mudou(); tudo();
        ctx.avisa(`${n} ponto(s) marcados como OK.`, { tipo: 'ok' });
      };

      /* ---------- quadro do ponto selecionado ---------- */
      $('#fx-det', el).addEventListener('change', (e) => {
        const p = sel(); if (!p) return;
        if (e.target.id === 'fx-fun') {
          if (!p.novo && !p.funOrig) p.funOrig = p.fun;
          p.fun = e.target.value; addReg(`${p.nome}: função ${p.funOrig ? 'redefinida' : 'escolhida'} → ${p.fun}`); mudou(); tudo();
        }
        const k = e.target.dataset.xyz;
        if (k) {
          const v = parseFloat(String(e.target.value).replace(',', '.'));
          if (!Number.isFinite(v)) { ctx.avisa('Digite um número em milímetro.', { tipo: 'erro' }); e.target.value = p[k]; return; }
          if (!p.novo && !p.orig) p.orig = [p.x, p.y, p.z];
          p[k] = mm(v);
          if (v !== p[k]) ctx.avisa(`${k.toUpperCase()} arredondado para ${p[k]} mm (milímetro inteiro).`);
          addReg(`${p.nome}: coordenada alterada para ${xyz(p)}`); mudou(); tudo();
        }
      });
      $('#fx-det', el).addEventListener('click', async (e) => {
        const p = sel(); if (!p) return;
        const b = e.target.closest('button'); if (!b) return;
        if (b.id === 'fx-pegar') {
          const lido = [p.x + 12.3, p.y - 0.4, p.z - 8.6];
          const ok = await ctx.cad({
            titulo: `Pegar nova posição de ${p.nome}`,
            catia: `sel.IndicateOrSelectElement3D(win, "Clique a nova posição de ${p.nome}", filtro, False, True, False, pos) → pt.X.Value = Round(pos(0)): pt.Y.Value = Round(pos(1)): pt.Z.Value = Round(pos(2)): part.Update`,
            nx: `ufs.Ui.SpecifyScreenPosition("Clique a nova posição de ${p.nome}", …) → ponto.SetCoordinates(new Point3d(Math.Round(x), Math.Round(y), Math.Round(z)))`,
            macro: 'Cordenadas', resultado: `Posição lida ${lido.map((v) => f1(Math.round(v * 10) / 10)).join(' / ')} → ${lido.map(mm).join(' / ')} mm`,
          }, b);
          if (!ok) return;
          if (!p.novo && !p.orig) p.orig = [p.x, p.y, p.z];
          [p.x, p.y, p.z] = lido.map(mm);
          addReg(`${p.nome}: nova posição pega no ${t.nome}, ${xyz(p)} (arredondada)`); mudou(); tudo();
          ctx.avisa(`${p.nome} movido para ${xyz(p)} mm, já arredondado para milímetro inteiro.`, { tipo: 'ok' });
        }
        if (b.id === 'fx-aceitar') {
          const ok = await ctx.cad({
            titulo: `Criar ponto sugerido ${p.nome}`,
            catia: `Set pt = hsf.AddNewPointCoord(${p.x}, ${p.y}, ${p.z}): pt.Name = "${p.nome}": geoSet.AppendHybridShape pt: part.Update`,
            nx: `var pt = workPart.Points.CreatePoint(new Point3d(${p.x}, ${p.y}, ${p.z})); pt.SetName("${p.nome}"); pt.SetVisibility(SmartObject.VisibilityOption.Visible);`,
            macro: 'Cordenadas', resultado: `${p.nome} criado no 3D em ${xyz(p)} mm`,
          }, b);
          if (!ok) return;
          p.aceito = true; p.sit = 'add';
          addReg(`Sugestão ${p.nome} aceita (${p.com})`); ctx.registrar(`Plano de fixação: sugestão ${p.nome} aceita.`); mudou(); tudo();
          ctx.avisa(`${p.nome} aceito e criado no 3D. Entra no plano como "Adicionar".`, { tipo: 'ok' });
        }
        if (b.id === 'fx-descartar') {
          s.pontos.splice(s.sel, 1); s.sel = -1; addReg(`Sugestão ${p.nome} descartada`); mudou(); tudo();
          ctx.avisa(`Sugestão ${p.nome} descartada.`);
        }
      });

      /* ---------- plano: tipo, estação, importar, ler, comparar ---------- */
      const relerCom = async (tipo, porque) => {
        if (revisado()) {
          const ok = await ctx.perguntar({ titulo: 'Ler o plano de novo?', texto: `${porque} As situações, comentários e pontos criados neste plano serão apagados.`, ok: 'Ler de novo', perigo: true });
          if (!ok) { cabecalho(); return false; }
        }
        Object.assign(s, planoNovo(tipo, s.st));
        ctx.registrar(`Plano de fixação ST${s.st} lido como ${TIPOS[tipo]}.`); ctx.salvar(); comparando = false; tudo();
        ctx.avisa(`Plano lido com a regra ${TIPOS[tipo]}: ${s.pontos.length} pontos.`, { tipo: 'ok' });
        return true;
      };
      $('#fx-tipo', el).onchange = async (e) => {
        const v = e.target.value;
        if (await relerCom(v, `A regra de leitura muda para ${TIPOS[v]}.`)) { s.tipo = v === AE.calc.projeto().padrao.plano ? null : v; ctx.salvar(); cabecalho(); }
      };
      el.addEventListener('click', async (e) => { if (e.target.closest('#fx-reler')) { if (await relerCom(tipoEf(), 'O plano é lido com a regra do cliente do projeto.')) { s.tipo = null; ctx.salvar(); } } });
      $('#fx-est', el).onchange = (e) => {
        const novo = +e.target.value; if (novo === s.st) return;
        const guarda = {}; CAMPOS_PLANO.forEach((k) => (guarda[k] = s[k]));
        s.outras['ST' + s.st] = clone(guarda);
        const ant = s.st;
        Object.assign(s, s.outras['ST' + novo] || planoNovo(tipoEf(), novo));
        delete s.outras['ST' + novo];
        s.st = novo; comparando = false;
        ctx.salvar(); tudo();
        ctx.avisa(`Plano da ST${ant} guardado. Aberto o plano da ST${novo}.`);
      };
      $('#fx-imp', el).onclick = async (e) => {
        const b = e.currentTarget;
        if (!s.snap) { await relerCom(s.lidoCom, 'Importar o plano do cliente de novo.'); return; }
        const ok = await ctx.perguntar({ titulo: 'Importar versão nova do cliente?', texto: `O programa importa a versão nova, compara com a ${s.snap.versao} enviada e reabre só os pontos que mudaram. Os outros mantêm a situação e o comentário.`, ok: 'Importar versão nova' });
        if (!ok) return;
        b.setAttribute('aria-busy', 'true'); await AE.util.espera(500); b.removeAttribute('aria-busy');
        /* simulação da resposta do cliente: move o 1º apoio com pisador e acrescenta um ponto */
        const [nm, fn] = NOVO_CLIENTE[s.lidoCom];
        const alvo = s.pontos.find((p) => !p.novo && p.fun === FUN.ap);
        const reabertos = [];
        if (alvo) { alvo.cli = [alvo.x + 15.3, alvo.y, alvo.z - 0.2]; alvo.x = mm(alvo.cli[0]); alvo.z = mm(alvo.cli[2]); alvo.sit = 'pen'; reabertos.push(alvo.nome); }
        if (!s.pontos.some((p) => p.nome === nm)) {
          const [dx, dz] = s.desl;
          const cli = [1525.4 + dx, -628.3, 470.2 + dz];
          s.pontos.push({ nome: nm, fun: fn, x: mm(cli[0]), y: mm(cli[1]), z: mm(cli[2]), cli, sit: 'pen', com: '', novo: false, sug: false });
          reabertos.push(nm);
        }
        s.n += 1; s.estado = 'recebida'; s.aprovacao = null; s.sel = -1;
        addReg(`C${s.n} recebida do cliente: ${reabertos.length} ponto(s) reabertos (${reabertos.join(', ')}); os outros mantêm a revisão`);
        ctx.registrar(`Plano de fixação ST${s.st}: versão C${s.n} do cliente importada, ${reabertos.length} ponto(s) reabertos.`);
        sync(); ctx.salvar(); comparando = true; tudo();
        ctx.avisa(`Versão C${s.n} importada. ${reabertos.length} ponto(s) mudaram e voltaram para "Sem revisão". Veja a comparação abaixo dos botões.`, { tipo: 'aviso' });
      };
      $('#fx-ler', el).onclick = async (e) => {
        const alt = s.pontos.filter((p) => p.orig && !p.novo).length;
        const ok = await ctx.cad({
          titulo: 'Ler pontos de fixação do 3D',
          catia: `Set sel = CATIA.ActiveDocument.Selection: sel.Search "Name=${s.lidoCom === 'vw' ? 'RPS*' : s.lidoCom === 'st' ? 'S*;Hp*;Lp*' : 'A*;B*;C*'},all": For i = 1 To sel.Count: sel.Item(i).Value.GetCoordinates c: …`,
          nx: 'foreach (Point p in workPart.Points) { if (Regex.IsMatch(p.Name, padrao)) { Point3d c = p.Coordinates; … } }',
          macro: 'Cordenadas, WritePoints2Excel',
          resultado: `${s.pontos.filter((p) => !p.sug || p.aceito).length} pontos lidos do 3D (nome e X, Y, Z). Coordenadas conferem com o plano.${alt ? ` ${alt} ponto(s) com coordenada alterada nesta revisão: o 3D é atualizado ao liberar.` : ''}`,
        }, e.currentTarget);
        if (!ok) return;
        s.lido3D = hora(); addReg(`Pontos lidos do 3D do ${t.nome} e conferidos com a tabela`); ctx.salvarUI(); cabecalho(); check();
        ctx.avisa(`Pontos lidos do 3D. Coordenadas conferem com o plano${alt ? `; ${alt} ponto(s) alterados aqui ainda não estão no 3D` : ''}.`, { tipo: 'ok' });
      };
      $('#fx-comp', el).onclick = () => {
        comparando = !comparando; comparacao();
        if (comparando && !s.snap) ctx.avisa('Esta é a primeira versão. Não há versão anterior para comparar.');
      };

      /* ---------- adicionar, sugerir, remover ---------- */
      $('#fx-add', el).onclick = async (e) => {
        const k = s.pontos.filter((p) => p.novo && !p.sug).length;
        const [dx, dz] = s.desl;
        const lido = [2010.4 - k * 95.3 + dx, -647.2, 705.6 + k * 48.7 + dz];
        const pos = lido.map(mm);
        const ok = await ctx.cad({
          titulo: 'Adicionar ponto de fixação',
          catia: `sel.IndicateOrSelectElement3D(win, "Clique na peça onde quer o ponto", Array("Face"), False, True, False, pos) → hsf.AddNewPointCoord(Round(pos(0)), Round(pos(1)), Round(pos(2)))`,
          nx: 'ufs.Ui.SpecifyScreenPosition("Clique na peça onde quer o ponto", …) → workPart.Points.CreatePoint(new Point3d(Math.Round(x), Math.Round(y), Math.Round(z)))',
          macro: 'Cordenadas',
          resultado: `Clique lido em ${lido.map((v) => f1(Math.round(v * 10) / 10)).join(' / ')} → ponto criado em ${pos.join(' / ')} mm`,
        }, e.currentTarget);
        if (!ok) return;
        const nome = 'Novo ' + (k + 1);
        s.pontos.push({ nome, fun: FUN.ap, x: pos[0], y: pos[1], z: pos[2], sit: 'add', com: '', novo: true, sug: false });
        s.sel = s.pontos.length - 1; addReg(`${nome} criado com clique no ${t.nome}: ${pos.join(' / ')} mm`); mudou(); tudo();
        ctx.avisa(`Ponto criado onde você clicou no ${t.nome}: ${pos.join(' / ')} mm, já arredondado para milímetro inteiro. Escreva o comentário para o cliente.`, { tipo: 'ok' });
      };
      $('#fx-sug', el).onclick = () => {
        const novos = [];
        for (let volta = 0; volta < 4; volta++) {
          const r = regras(s), g = r.g;
          let pos = null, motivo = '';
          if (r.longe.length) {
            const pl = r.longe[0]; pos = [pl.x - 30, pl.y + 3, pl.z - 92]; motivo = `Apoio perto do piloto ${pl.nome} (regra: apoio a até ${R_PILOTO} mm do piloto)`;
          } else if (!r.soldaOk) {
            const sp = g.solda[1]; pos = [sp[0] - 45, sp[1], sp[2]]; motivo = 'Apoio perto da solda, na junção das peças';
          } else if (!r.minimo) {
            pos = [g.cg[0] + (volta % 2 ? 220 : -220), g.cg[1], g.cg[2] - 120]; motivo = 'Mínimo de 3 apoios no plano';
          } else if (!r.cgOk) {
            const mx = r.apoios.reduce((a, p) => a + p.x, 0) / r.apoios.length, mz = r.apoios.reduce((a, p) => a + p.z, 0) / r.apoios.length;
            pos = [g.cg[0] + (g.cg[0] - mx) * 1.5, g.cg[1], g.cg[2] + (g.cg[2] - mz) * 1.5]; motivo = 'Centro de gravidade dentro dos apoios';
          }
          if (!pos) break;
          const n = s.pontos.filter((p) => p.sug).length + 1;
          const p = { nome: 'Sugerido ' + n, fun: FUN.so, x: mm(pos[0]), y: mm(pos[1]), z: mm(pos[2]), sit: 'add', com: motivo, novo: true, sug: true, aceito: false };
          s.pontos.push(p); novos.push(p);
        }
        if (!novos.length) { ctx.avisa('As quatro regras de apoio já estão atendidas. Nada a sugerir.', { tipo: 'ok' }); return; }
        s.sel = s.pontos.indexOf(novos[0]);
        addReg(`${novos.length} ponto(s) sugerido(s): ${novos.map((p) => p.com).join('; ')}`); mudou(); tudo();
        ctx.avisa(`${novos.length} ponto(s) sugerido(s): ${novos.map((p) => p.com.toLowerCase()).join('; ')}. Aceite ou descarte cada um no quadro "Ponto selecionado".`);
      };
      $('#fx-rm', el).onclick = () => {
        const p = sel();
        if (!p) { ctx.avisa('Selecione um ponto no desenho ou na tabela.'); return; }
        if (!p.novo) { ctx.avisa('Este ponto veio do cliente e não pode ser apagado. Use a situação "Desconsiderar".', { tipo: 'erro' }); return; }
        s.pontos.splice(s.sel, 1); s.sel = -1; addReg(`${p.nome} removido (criado nesta revisão)`); mudou(); tudo();
        ctx.avisa(`${p.nome} removido.`);
      };

      /* ---------- retorno ao cliente, aprovação e liberação ---------- */
      const travas = () => checagem(s).filter((i) => i.trava && !i.ok);
      $('#fx-doc', el).onclick = async (e) => {
        if (s.estado === 'aprovada') { ctx.avisa('A versão F1 já está aprovada. Altere o plano se precisar de uma versão nova.'); return; }
        const tr = travas();
        if (tr.length) { ctx.avisa(`Ainda não dá para gerar: ${tr[0].t.toLowerCase()} (${tr[0].falha}). ${tr[0].como}`, { tipo: 'erro' }); return; }
        const mesma = s.estado === 'enviada';
        const v = mesma ? s.n : s.n + 1;
        const pasta = `14.3_Mecânica/ST${s.st}/Plano de fixação`;
        const ok = await ctx.cad({
          titulo: `Documento de retorno C${v}`,
          catia: `CATIA.ActiveWindow.ActiveViewer.Reframe: CATIA.ActiveWindow.ActiveViewer.CaptureToFile catCaptureFormatJPEG, pasta & "\\ST${s.st}_fixacao_C${v}.jpg"`,
          nx: `theUfSession.Disp.CreateImage(pasta + "\\\\ST${s.st}_fixacao_C${v}.png", UFDisp.ImageFormat.Png, UFDisp.BackgroundColor.White)`,
          macro: 'WritePoints2Excel',
          resultado: `Imagem com os pontos coloridos + tabela (situação e comentário) salvas em ${pasta}, versão C${v}`,
        }, e.currentTarget);
        if (!ok) return;
        s.n = v; s.estado = 'enviada';
        s.snap = { versao: 'C' + v, hora: hora(), pontos: clone(s.pontos.map((p) => ({ nome: p.nome, fun: p.fun, x: p.x, y: p.y, z: p.z, sit: p.sit }))) };
        addReg(`Documento de retorno gerado · versão C${v} · salvo em ${pasta}`);
        ctx.registrar(`Plano de fixação ST${s.st}: documento de retorno C${v} gerado e salvo em ${pasta}.`);
        sync(); ctx.salvar(); tudo();
        ctx.avisa(`Documento de retorno C${v} gerado no padrão do cliente e salvo em ${pasta}.`, { tipo: 'ok' });
      };
      $('#fx-apr', el).onclick = async () => {
        if (s.estado === 'aprovada') { ctx.avisa(`Aprovação já registrada: ${s.aprovacao ? s.aprovacao.quem + ' em ' + s.aprovacao.data : 'F1'}.`); return; }
        if (s.estado !== 'enviada') { ctx.avisa('Gere e envie o documento de retorno antes de registrar a aprovação. Se o plano mudou depois do envio, gere de novo.', { tipo: 'erro' }); return; }
        const quem = await ctx.perguntar({ titulo: `Aprovação da C${s.n}`, texto: 'Quem do cliente aprovou esta versão? Fica no registro junto com a data.', campo: 'Quem aprovou (nome e área do cliente)', ok: 'Registrar aprovação' });
        if (!quem) return;
        const data = new Date().toLocaleDateString('pt-BR');
        s.estado = 'aprovada'; s.aprovacao = { quem, data, versao: 'C' + s.n };
        addReg(`Aprovação do cliente registrada · C${s.n} virou F1 · por ${quem} em ${data}`);
        ctx.registrar(`Plano de fixação ST${s.st}: C${s.n} aprovada por ${quem} em ${data}. Versão final F1.`);
        sync(); ctx.salvar(); tudo();
        ctx.avisa('Aprovação registrada. O plano de fixação agora é a versão final F1.', { tipo: 'ok' });
      };
      $('#fx-lib', el).onclick = () => {
        const tr = travas();
        if (tr.length) { ctx.avisa(`Antes de liberar: ${tr[0].t.toLowerCase()} (${tr[0].falha}). ${tr[0].como}`, { tipo: 'erro' }); return; }
        const usados = s.pontos.filter((p) => p.sit !== 'des');
        const n = usados.length, nPil = usados.filter(ehPiloto).length;
        s.liberado = { versao: codVersao(s), n, hora: hora(), final: s.aprovado };
        addReg(`${n} ponto(s) liberados para a modelagem (${s.aprovado ? 'F1, final' : codVersao(s) + ', preliminar'})`);
        ctx.salvar(); check();
        const detalhe = `${n - nPil} apoio(s) vão para Mecânica 2 e ${nPil} piloto(s) para Mecânica 5`;
        if (s.aprovado) {
          ctx.concluir({ registro: `Plano de fixação ST${s.st} (F1) liberado: ${n} unidades a modelar`, mensagem: `${n} unidades enviadas para a modelagem como finais: ${detalhe}.` });
        } else {
          ctx.concluir({ preliminar: true, registro: `Plano de fixação ST${s.st} (${codVersao(s)}) liberado sem aprovação do cliente: ${n} unidades a modelar`, mensagem: `${n} unidades enviadas para a modelagem como preliminares: falta a aprovação do cliente. ${detalhe}.` });
        }
      };
    },
  });
})();
