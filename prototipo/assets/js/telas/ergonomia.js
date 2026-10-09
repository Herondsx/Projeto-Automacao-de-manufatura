/* Passo 3 · Operador e ergonomia (Processo)
   Tela nova: na v0 só existia o botão desativado ("posto do operador, ergonomia e acessos de manutenção").
   A especificação vem do passo '3' do fluxo da v0: entradas = modelo 3D do operador (cliente) e posição do
   operador e lado da base (usuário, no CAD); se não receber = operador de referência de 173 cm; alcance em
   zona amarela ou vermelha pergunta se pode ajustar a posição; manutenção acima de 1800 mm pede plataforma;
   entrega = postos manuais conferidos e apresentação de ergonomia, aprovada pelo cliente. */
(function () {
  'use strict';
  const AE = window.AE;
  const { $, esc, fmt, hora } = AE.util;

  const REF_ALTURA = 173; // cm
  /* LIMITES DE EXEMPLO (operador de 173 cm). Precisam vir da norma de ergonomia do cliente. */
  const LIM = { verde: { h: [800, 1300], d: 450 }, amarela: { h: [600, 1500], d: 650 } };
  const PLATAFORMA = 1800; // mm
  /* posição proposta de cada peça: altura de carga (h) e distância da frente do corpo até a peça (d), em mm */
  const PADRAO_PECA = { A: { h: 1050, d: 350 }, B: { h: 1120, d: 380 }, C: { h: 950, d: 580 }, D: { h: 720, d: 520 }, E: { h: 1560, d: 420 }, F: { h: 1000, d: 400 } };
  const MANUT = [
    { id: 'M1', item: 'Válvula do grampo pneumático', altura: 1950, posto: 0 },
    { id: 'M2', item: 'Painel de válvulas da pinça', altura: 1600, posto: 1 },
    { id: 'M3', item: 'Fresa de capas da pinça', altura: 1150, posto: 0 },
    { id: 'M4', item: 'Regulador de ar do pedestal de cola', altura: 1850, posto: 1 },
  ];
  const ZONA = { verde: ['ok', 'Zona verde', 'var(--ok)'], amarela: ['aviso', 'Zona amarela', 'var(--aviso)'], vermelha: ['erro', 'Zona vermelha', 'var(--erro)'] };

  const CSS = `
    .eg-vista svg{max-height:470px}
    .eg-vista text{font-size:11px}
    .eg-vista text.eg-peca-txt{font-size:12px;fill:var(--texto)}
    .eg-vista text.eg-zona-txt{font-size:10.5px;font-weight:500}
    .eg-par{display:flex;gap:8px;align-items:center}
    .eg-par input[type=range]{flex:1;min-width:0}
    .eg-par input[type=number]{width:92px;flex:none;text-align:right;font-family:var(--f-dado)}
    .eg-pecas{display:flex;flex-wrap:wrap;gap:6px}
    .eg-pecas button{display:inline-flex;align-items:center;gap:6px;background:var(--fundo);border:1px solid var(--linha2);border-radius:99px;padding:5px 12px;cursor:pointer;color:var(--suave);font-size:14px}
    .eg-pecas button[aria-pressed="true"]{border-color:var(--acao);color:var(--texto);font-weight:600;background:var(--painel2)}
    .eg-pecas i{width:9px;height:9px;border-radius:50%;display:inline-block}
    .eg-zona{display:flex;flex-direction:column;gap:8px;background:var(--fundo);border:1px solid var(--linha);border-left:4px solid var(--linha2);border-radius:6px;padding:10px 12px;margin-top:12px;font-size:13.5px;color:var(--suave)}
    .eg-zona.verde{border-left-color:var(--ok)} .eg-zona.amarela{border-left-color:var(--aviso)} .eg-zona.vermelha{border-left-color:var(--erro)}
    .eg-zona b{color:var(--texto);font-weight:600}
    #eg-manut td input.curto{width:96px}
    #eg-abas .badge{margin-left:6px}`;

  AE.tela({
    id: 'ergonomia', sigla: '3', area: 'proc', rotulo: 'Passo 3', titulo: 'Operador e ergonomia',
    resumo: 'Conferir o alcance do operador em cada posto manual, os acessos de manutenção e gerar a apresentação de ergonomia para o cliente aprovar.',
    tip: 'Abre a conferência dos postos manuais: operador, zonas de alcance, manutenção acima de 1800 mm e apresentação de ergonomia.',
    entradas: [
      { de: 'inicio', o: 'Cliente: manequim do padrão dele' },
      { de: 'separacao', o: 'Subdivisões com posto manual' },
    ],
    inicial: () => ({
      operador: { tipo: 'referencia', altura: REF_ALTURA },
      postos: {}, posto: null, peca: null,
      manutencao: MANUT.map((m) => Object.assign({ plataforma: false }, m)), proxManut: MANUT.length + 1,
      versoes: [], aprovacao: null, registro: [],
    }),
    programador: `
      <h3>O que esta tela guarda</h3>
      <ul>
        <li><code>operador</code>: <code>{tipo: 'referencia' | 'cliente', altura}</code>, altura em cm.</li>
        <li><code>postos</code>: por id interno da subdivisão, <code>{lado, lido, pecas: {A: {h, d, ajustado, aceito}}}</code>. <code>h</code> = altura de carga e <code>d</code> = distância da frente do corpo até a peça, em mm inteiros.</li>
        <li><code>manutencao</code>: itens com altura de acesso (mm) e <code>plataforma</code>.</li>
        <li><code>versoes</code> da apresentação (C1, C2… F1) e <code>aprovacao</code> <code>{quem, data, versao}</code>.</li>
      </ul>
      <h3>Regras</h3>
      <ul>
        <li>Projeto sem modelo de operador: usa o operador de referência, de 173 cm.</li>
        <li>As zonas de alcance acompanham a altura do operador (fator = altura ÷ 173).</li>
        <li>Alcance em zona amarela ou vermelha: o programa pergunta se pode ajustar a posição e propõe a posição verde mais próxima. Manter fora da verde pede justificativa.</li>
        <li>Item de manutenção acima de 1800 mm: pede plataforma.</li>
        <li>Versão: conceito C1, C2…; aprovada pelo cliente vira F1. Mudança depois do F1 cria F2 e pede o motivo.</li>
        <li>Sem aprovação o passo pode ser concluído, mas a apresentação fica registrada como conceito.</li>
      </ul>
      <h3>Saída</h3>
      <ul>
        <li>Fatia <code>ergonomia</code>: postos conferidos, plataformas e versão da apresentação. Vai para a Simulação junto com o produto separado (ida Processo → Simulação), para a lista de segurança (Passo 8) e para a Mecânica quando uma altura de carga muda o dispositivo.</li>
        <li>Ainda não existe <code>AE.calc.ergonomia()</code>: quem precisar lê com <code>AE.espiar('ergonomia')</code>.</li>
        <li>Arquivo gerado: <code>14.6_Ergonomia/ERGO_C1.pptx</code> (C2, F1…).</li>
      </ul>
      <h3>Macros de base</h3>
      <ul><li>Nenhuma na v0. No CATIA o manequim é do Human Builder; no NX, do Human Modeling.</li></ul>
      <h3>Em aberto</h3>
      <ul>
        <li><b>Os limites das zonas são de exemplo</b> (verde: 800 a 1300 mm de altura e até 450 mm de distância; amarela: 600 a 1500 mm e até 650 mm). Precisam vir da norma de ergonomia do cliente.</li>
        <li>Conferir com um operador só (173 cm) ou com dois percentis (o mais baixo e o mais alto)?</li>
        <li>O peso da peça muda o limite da zona? Hoje não entra.</li>
        <li>"Lado da base": o protótipo trata como o lado do dispositivo em que o operador fica (esquerdo ou direito). Confirmar.</li>
        <li>Itens de manutenção: vêm da lista de equipamentos (Passo 5) ou o usuário cadastra aqui? Hoje são exemplo.</li>
        <li>F2 (mudança depois do F1) precisa de nova aprovação do cliente? O protótipo supõe que sim.</li>
      </ul>`,

    render() {
      return `
      <div class="bloco">
        <h2>Operador do projeto</h2>
        <p class="sub">O cliente manda o manequim do padrão dele. Sem manequim, o programa usa o operador de referência de 173 cm.</p>
        <div id="eg-op"></div>
      </div>

      <div class="bloco">
        <h2>Postos manuais <span class="exemplo">dados de exemplo</span></h2>
        <p class="sub">Um posto por subdivisão: o operador carrega as peças no dispositivo. A altura de carga e a distância até cada peça dizem a zona de alcance.</p>
        <div id="eg-postos"></div>
      </div>

      <div class="bloco">
        <h2>Itens de manutenção <span class="exemplo">dados de exemplo</span></h2>
        <p class="sub">Altura de acesso medida do piso. Acima de ${PLATAFORMA} mm, o programa pede plataforma.</p>
        <div id="eg-manut"></div>
      </div>

      <div class="bloco">
        <h2>Apresentação de ergonomia</h2>
        <p class="sub">Vai para a pasta 14.6_Ergonomia e é apresentada ao cliente para aprovação. Conceito: C1, C2…; aprovada: F1.</p>
        <div id="eg-apres"></div>
      </div>

      <div class="bloco">
        <h2>Checagem</h2>
        <p class="sub">O passo só é concluído sem nenhum item em vermelho. Sem a aprovação do cliente ele conclui, mas como conceito.</p>
        <div class="checagem" id="eg-check"></div>
        <div class="barra fim" style="margin-top:14px">
          <button class="btn primario" data-acao="concluir" data-tip="Confere a checagem e grava os postos conferidos e a apresentação. Sem aprovação do cliente, registra como conceito.">Concluir e avançar</button>
        </div>
      </div>`;
    },

    montar(el, ctx) {
      const s = ctx.s;
      if (!s.operador) s.operador = { tipo: 'referencia', altura: REF_ALTURA };
      ['manutencao', 'versoes', 'registro'].forEach((k) => { if (!Array.isArray(s[k])) s[k] = []; });
      if (!s.postos) s.postos = {};
      AE.css('ergonomia', CSS);

      const PECA = {};
      AE.dados.produto.pecas.forEach((p) => (PECA[p.id] = p));
      const nomeP = (id) => (PECA[id] ? PECA[id].nome : id);
      const reg = (texto) => { s.registro.unshift({ hora: hora(), texto }); s.registro.length = Math.min(s.registro.length, 60); ctx.registrar(texto); };
      const k = () => (Number(s.operador.altura) || REF_ALTURA) / REF_ALTURA;
      const r10 = (v) => Math.round(v / 10) * 10;
      const lim = () => {
        const f = k();
        return {
          verde: { h: [r10(LIM.verde.h[0] * f), r10(LIM.verde.h[1] * f)], d: r10(LIM.verde.d * f) },
          amarela: { h: [r10(LIM.amarela.h[0] * f), r10(LIM.amarela.h[1] * f)], d: r10(LIM.amarela.d * f) },
        };
      };
      const zona = (h, d) => {
        const L = lim();
        if (h >= L.verde.h[0] && h <= L.verde.h[1] && d <= L.verde.d) return 'verde';
        if (h >= L.amarela.h[0] && h <= L.amarela.h[1] && d <= L.amarela.d) return 'amarela';
        return 'vermelha';
      };
      const verdeMaisProxima = (pp) => { const L = lim().verde; return { h: Math.min(Math.max(pp.h, L.h[0]), L.h[1]), d: Math.min(pp.d, L.d) }; };
      const estado = (pp) => {
        const z = zona(pp.h, pp.d);
        if (z === 'verde') return { z, cls: 'ok', txt: pp.ajustado ? 'Ajustada para a verde' : 'Na zona verde', ok: true };
        if (pp.aceito) return { z, cls: 'aviso', txt: 'Mantida com justificativa', ok: true };
        return { z, cls: 'erro', txt: 'Pendente: ajustar ou justificar', ok: false };
      };
      const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
      const br = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '');

      /* postos manuais = subdivisões do Passo 1 com peças que não são BY */
      function postos() {
        const sep = AE.calc.separacao();
        const lista = sep.subs.slice().sort((a, b) => a.st - b.st)
          .map((sub) => ({ sub, pecas: sub.pecas.filter((pc) => !sep.by.includes(pc)) }))
          .filter((x) => x.pecas.length);
        lista.forEach(({ sub, pecas }) => {
          const P = (s.postos[sub.id] = s.postos[sub.id] || { lado: 'esq', lido: null, pecas: {} });
          if (!P.pecas) P.pecas = {};
          pecas.forEach((pc) => { if (!P.pecas[pc]) P.pecas[pc] = Object.assign({}, PADRAO_PECA[pc] || { h: 1000, d: 400 }); });
        });
        return { reserva: sep.reserva, lista };
      }
      const pendenciasPosto = (x) => x.pecas.filter((pc) => !estado(s.postos[x.sub.id].pecas[pc]).ok).length;
      const atual = () => {
        const L = postos().lista;
        if (!L.length) return null;
        let x = L.find((p) => p.sub.id === s.posto);
        if (!x) { x = L[0]; s.posto = x.sub.id; }
        if (!x.pecas.includes(s.peca)) s.peca = x.pecas[0];
        return x;
      };
      const assinatura = () => JSON.stringify({ op: s.operador, p: postos().lista.map((x) => [x.sub.st, s.postos[x.sub.id]]), m: s.manutencao.map((m) => [m.id, m.altura, m.plataforma]) });
      const ultima = () => s.versoes[s.versoes.length - 1] || null;

      /* ---------- operador ---------- */
      function operador() {
        const t = AE.termos(), o = s.operador, H = (Number(o.altura) || REF_ALTURA) * 10;
        const cli = o.tipo === 'cliente';
        const L = lim();
        $('#eg-op', el).innerHTML = `
          <div class="cartoes">
            <div class="cartao ${!cli ? 'sel' : ''}">
              <h3>Operador de referência ${!cli ? '<span class="pilula ok">em uso</span>' : ''}</h3>
              <small>${REF_ALTURA} cm de altura. Usado quando o cliente não manda o manequim (regra "se não receber").</small>
              <div class="barra"><button class="btn" data-acao="op-ref" data-tip="Volta a conferir os postos com o operador de referência do programa, de 173 cm.">Usar a referência de 173 cm</button></div>
            </div>
            <div class="cartao ${cli ? 'sel' : ''}">
              <h3>Manequim do cliente ${cli ? '<span class="pilula ok">em uso</span>' : ''}</h3>
              <small>${cli ? `Manequim do cliente com ${fmt(o.altura, 0)} cm, inserido no ${esc(t.nome)}${o.hora ? ` às ${esc(o.hora)}` : ''}.` : `Insere no ${esc(t.nome)} o manequim que o cliente mandou (${t.nome === 'CATIA' ? 'Human Builder' : 'Human Modeling'}) e lê a estatura dele.`}</small>
              <div class="barra"><button class="btn ${cli ? '' : 'primario'}" data-acao="op-cliente" data-tip="Insere no CAD o manequim que o cliente mandou e lê a estatura. As zonas de alcance passam a seguir a altura dele.">Inserir manequim do cliente</button></div>
            </div>
          </div>
          <div class="kpis" style="margin-top:12px">
            <div class="kpi" data-tip="Altura total do operador usada na conferência."><span>Altura</span><b>${fmt(o.altura, 0)} cm</b><small>${cli ? 'manequim do cliente' : 'referência do programa'}</small></div>
            <div class="kpi" data-tip="Altura do ombro: cerca de 82% da altura total."><span>Ombro</span><b>${Math.round(H * 0.818)} mm</b><small>do piso</small></div>
            <div class="kpi" data-tip="Comprimento do braço até a mão: cerca de 44% da altura total."><span>Alcance do braço</span><b>${Math.round(H * 0.44)} mm</b><small>do ombro até a mão</small></div>
            <div class="kpi" data-tip="Faixa de altura de carga e distância máxima da zona verde, com os limites de exemplo proporcionais à altura do operador."><span>Zona verde</span><b style="font-size:17px">${L.verde.h[0]}–${L.verde.h[1]}</b><small>mm de altura · até ${L.verde.d} mm de distância</small></div>
          </div>`;
      }

      /* ---------- vista lateral do posto (SVG) ---------- */
      function vista(x) {
        const P = s.postos[x.sub.id];
        const S = 0.145, CH = 322, W = 340;
        const esq = P.lado !== 'dir';
        const x0 = 100;
        const X = (d) => (esq ? x0 + d * S : W - x0 - d * S);
        const Y = (h) => CH - h * S;
        const rect = (d1, d2, h1, h2, attrs) => { const a = X(d1), b = X(d2); return `<rect x="${Math.min(a, b).toFixed(1)}" y="${Y(h2).toFixed(1)}" width="${Math.abs(b - a).toFixed(1)}" height="${((h2 - h1) * S).toFixed(1)}" ${attrs}></rect>`; };
        const fim = esq ? 'end' : 'start', ini = esq ? 'start' : 'end';
        const L = lim();
        const H = (Number(s.operador.altura) || REF_ALTURA) * 10;
        const pcs = x.pecas.map((pc) => Object.assign({ id: pc }, P.pecas[pc]));
        const sel = pcs.find((p) => p.id === s.peca) || pcs[0];
        /* zonas */
        let g = rect(0, 1050, 200, 2000, 'fill="var(--erro)" fill-opacity=".08" stroke="var(--erro)" stroke-opacity=".5" stroke-dasharray="4 4"');
        g += rect(0, L.amarela.d, L.amarela.h[0], L.amarela.h[1], 'fill="var(--aviso)" fill-opacity=".14" stroke="var(--aviso)" stroke-opacity=".7" stroke-dasharray="4 4"');
        g += rect(0, L.verde.d, L.verde.h[0], L.verde.h[1], 'fill="var(--ok)" fill-opacity=".2" stroke="var(--ok)" stroke-opacity=".8"');
        g += `<text class="eg-zona-txt" x="${X(1040)}" y="${Y(2000) + 13}" text-anchor="${fim}" style="fill:var(--erro)">vermelha</text>
          <text class="eg-zona-txt" x="${X(L.amarela.d - 8)}" y="${Y(L.amarela.h[1]) + 13}" text-anchor="${fim}" style="fill:var(--aviso)">amarela</text>
          <text class="eg-zona-txt" x="${X(L.verde.d - 8)}" y="${Y(L.verde.h[1]) + 13}" text-anchor="${fim}" style="fill:var(--ok)">verde</text>`;
        /* régua e linha de 1800 mm */
        const xr = X(-600);
        g += `<line x1="${xr}" y1="${Y(0)}" x2="${xr}" y2="${Y(2100)}" stroke="var(--linha2)"></line>`;
        [500, 1000, 1500, 2000].forEach((h) => { g += `<line x1="${xr}" y1="${Y(h)}" x2="${X(-560)}" y2="${Y(h)}" stroke="var(--linha2)"></line><text x="${X(-540)}" y="${Y(h) + 4}" text-anchor="${ini}">${h}</text>`; });
        g += `<line x1="${X(-600)}" y1="${Y(PLATAFORMA)}" x2="${X(1050)}" y2="${Y(PLATAFORMA)}" stroke="var(--roxo)" stroke-dasharray="6 4"></line>
          <text x="${X(-20)}" y="${Y(PLATAFORMA) - 5}" text-anchor="${ini}" style="fill:var(--roxo)">${PLATAFORMA} mm · acima, manutenção pede plataforma</text>`;
        /* dispositivo: base e apoios de cada peça */
        const dMin = Math.min(...pcs.map((p) => p.d)), dMax = Math.max(...pcs.map((p) => p.d));
        const base = Math.max(200, Math.min(650, Math.min(...pcs.map((p) => p.h)) - 150));
        g += rect(Math.max(60, dMin - 90), dMax + 140, 0, base, 'fill="#1B3156" stroke="#3A5C92" stroke-width="1.2"');
        g += `<text x="${X(dMax + 130)}" y="${Y(base / 2) + 4}" text-anchor="${fim}">dispositivo</text>`;
        pcs.forEach((p) => { if (p.h - 20 > base) g += rect(p.d - 12, p.d + 12, base, p.h - 20, 'fill="#24406E" stroke="#3A5C92"'); });
        /* peças */
        pcs.forEach((p) => {
          const z = zona(p.h, p.d), cor = ZONA[z][2], eh = p.id === sel.id;
          g += rect(p.d - 45, p.d + 45, p.h - 20, p.h + 20, `fill="${eh ? 'var(--acao)' : cor}" fill-opacity="${eh ? '.55' : '.35'}" stroke="${eh ? 'var(--acao)' : cor}" stroke-width="${eh ? 2.2 : 1.2}" data-peca="${p.id}" style="cursor:pointer" data-tip="${esc(`${p.id} · ${nomeP(p.id)} · altura de carga ${p.h} mm · distância ${p.d} mm · ${ZONA[z][1].toLowerCase()}`)}" data-tip-titulo="Peça no dispositivo"`);
          g += `<text class="eg-peca-txt" x="${X(p.d)}" y="${Y(p.h + 30)}" text-anchor="middle">${p.id}</text>`;
        });
        /* operador */
        const hq = 0.53 * H, ho = 0.818 * H, rc = 0.065 * H;
        const corpo = 'fill="var(--painel2)" stroke="var(--suave)" stroke-width="1.2"';
        g += `<line x1="${X(-140)}" y1="${Y(hq)}" x2="${X(-150)}" y2="${Y(0)}" stroke="var(--suave)" stroke-width="9" stroke-linecap="round"></line>
          <line x1="${X(-80)}" y1="${Y(hq)}" x2="${X(-60)}" y2="${Y(0)}" stroke="var(--suave)" stroke-width="9" stroke-linecap="round"></line>`;
        g += rect(-200, -20, hq - 20, ho + 30, `${corpo} rx="6"`);
        g += `<circle cx="${X(-110)}" cy="${Y(H - rc)}" r="${(rc * S).toFixed(1)}" ${corpo}></circle>`;
        /* braço até a peça escolhida (cinemática simples de dois segmentos) */
        const a = 0.186 * H, b = 0.254 * H;
        const sx = -100, sy = ho, tx = sel.d, ty = sel.h;
        const dist = Math.hypot(tx - sx, ty - sy);
        const zSel = zona(sel.h, sel.d), corBraco = ZONA[zSel][2];
        const th = Math.atan2(ty - sy, tx - sx);
        let braco;
        if (dist >= a + b - 1) {
          const ex = sx + (a + b) * Math.cos(th), ey = sy + (a + b) * Math.sin(th);
          braco = `<line x1="${X(sx)}" y1="${Y(sy)}" x2="${X(ex)}" y2="${Y(ey)}" stroke="${corBraco}" stroke-width="6" stroke-linecap="round"></line>
            <line x1="${X(ex)}" y1="${Y(ey)}" x2="${X(tx)}" y2="${Y(ty)}" stroke="${corBraco}" stroke-width="1.5" stroke-dasharray="3 3"></line>
            <text x="${X((ex + tx) / 2)}" y="${Y((ey + ty) / 2) - 6}" text-anchor="middle" style="fill:var(--erro)">não alcança</text>`;
        } else {
          const D = Math.max(dist, Math.abs(a - b) + 1);
          const A = Math.acos(Math.min(1, Math.max(-1, (a * a + D * D - b * b) / (2 * a * D))));
          const ex = sx + a * Math.cos(th - A), ey = sy + a * Math.sin(th - A);
          braco = `<polyline points="${X(sx)},${Y(sy)} ${X(ex)},${Y(ey)} ${X(tx)},${Y(ty)}" fill="none" stroke="${corBraco}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></polyline>`;
        }
        g += braco;
        /* cotas da peça escolhida */
        g += `<line x1="${X(0)}" y1="${Y(sel.h) + 28}" x2="${X(sel.d)}" y2="${Y(sel.h) + 28}" stroke="var(--acao)" stroke-dasharray="2 3"></line>
          <text x="${X(sel.d / 2)}" y="${Y(sel.h) + 41}" text-anchor="middle" style="fill:var(--acao)">${sel.d} mm</text>
          <text x="${X(sel.d + 55)}" y="${Y(sel.h) + 4}" text-anchor="${ini}" style="fill:var(--acao)">${sel.h} mm</text>`;
        g += `<line x1="0" y1="${Y(0)}" x2="${W}" y2="${Y(0)}" stroke="var(--linha2)" stroke-width="1.5"></line>`;
        return `<div class="cad eg-vista"><span class="rotulo">vista lateral · ST${x.sub.st} · base ${esq ? 'à esquerda' : 'à direita'}</span>
          <svg viewBox="0 0 ${W} 330" role="img" aria-label="${esc(`Vista lateral do posto ST${x.sub.st}: operador, dispositivo e zonas de alcance`)}"><rect width="${W}" height="330" fill="var(--cad)"></rect>${g}</svg></div>`;
      }

      /* ---------- postos ---------- */
      function zonaBox(x) {
        const pp = s.postos[x.sub.id].pecas[s.peca];
        const e = estado(pp), L = lim();
        const alvo = verdeMaisProxima(pp);
        return `<div class="eg-zona ${e.z}">
          <span><span class="pilula ${ZONA[e.z][0]}">${ZONA[e.z][1]}</span> <span class="pilula ${e.cls}" data-tip="${esc(pp.aceito ? 'Justificativa: ' + pp.aceito.motivo : pp.ajustado ? `Posição ajustada pelo programa: antes ${pp.ajustado.de.h} mm de altura e ${pp.ajustado.de.d} mm de distância.` : 'Situação desta peça na conferência.')}">${esc(e.txt)}</span></span>
          <span>${e.z === 'verde' ? `<b>${esc(s.peca)}</b> é carregada sem esforço: altura entre ${L.verde.h[0]} e ${L.verde.h[1]} mm, até ${L.verde.d} mm de distância.`
            : `<b>${esc(s.peca)}</b> está na zona ${e.z}${pp.h < L.verde.h[0] ? ': baixa demais' : pp.h > L.verde.h[1] ? ': alta demais' : ''}${pp.d > L.verde.d ? `${pp.h < L.verde.h[0] || pp.h > L.verde.h[1] ? ' e' : ':'} longe demais` : ''}. A posição verde mais próxima é ${alvo.h} mm de altura e ${alvo.d} mm de distância.`}</span>
          ${e.z !== 'verde' ? `<div class="barra">
            <button class="btn primario" data-acao="ajustar" data-tip="Pergunta se pode mover a peça para a posição verde mais próxima. Confirmando, reposiciona o ponto de pega e o manequim no CAD e avisa que a altura do dispositivo muda.">Ajustar posição</button>
            <button class="btn leve" data-acao="manter" data-tip="Mantém a peça onde está e pede a justificativa (por exemplo: o produto não permite outra posição). Fica registrado e vai na apresentação.">Manter e justificar</button></div>` : ''}
        </div>`;
      }
      function resumoPosto(x) {
        const P = s.postos[x.sub.id];
        return `<div class="rolagem" style="margin-top:12px"><table>
          <thead><tr><th>Peça</th><th class="num">Altura de carga</th><th class="num">Distância</th><th>Zona</th><th>Situação</th></tr></thead>
          <tbody>${x.pecas.map((pc) => { const pp = P.pecas[pc], e = estado(pp); return `<tr class="clicavel ${pc === s.peca ? 'sel' : ''}" data-peca="${pc}">
            <td><b>${esc(pc)}</b> <small style="color:var(--suave)">${esc(nomeP(pc))}</small></td><td class="num">${pp.h} mm</td><td class="num">${pp.d} mm</td>
            <td><span class="pilula ${ZONA[e.z][0]}">${ZONA[e.z][1]}</span></td>
            <td><span class="pilula ${e.cls}" ${pp.aceito ? `data-tip="${esc('Justificativa: ' + pp.aceito.motivo)}"` : ''}>${esc(e.txt)}</span></td></tr>`; }).join('')}</tbody></table></div>`;
      }
      function desenhaPostos() {
        const t = AE.termos();
        const PL = postos();
        const x = atual();
        const box = $('#eg-postos', el);
        if (!x) { box.innerHTML = '<div class="vazio">Nenhum posto manual: todas as subdivisões são de peças BY. Confira a separação no Passo 1.</div>'; return; }
        const P = s.postos[x.sub.id];
        const pp = P.pecas[s.peca];
        box.innerHTML = `
          ${PL.reserva ? '<p class="nota aviso" style="margin:0 0 12px">Subdivisões de reserva: o Passo 1 ainda não criou as dele. Quando criar, confira os postos de novo.</p>' : ''}
          <div class="abas" id="eg-abas" role="tablist" aria-label="Postos manuais">${PL.lista.map((p) => { const n = pendenciasPosto(p); return `<button role="tab" aria-selected="${p.sub.id === x.sub.id}" data-posto="${p.sub.id}" data-tip="${esc(`Abre o posto da ST${p.sub.st}: ${p.sub.nome}.`)}">ST${p.sub.st} · ${p.pecas.length} peça${p.pecas.length > 1 ? 's' : ''}${n ? `<span class="badge" aria-label="${n} pendência(s)">${n}</span>` : ''}</button>`; }).join('')}</div>
          <div class="duas" style="margin-top:12px">
            <div id="eg-vista">${vista(x)}</div>
            <div>
              <h3 class="rotulo-sec" style="margin-top:0">ST${x.sub.st} · ${esc(x.sub.nome)}</h3>
              <div class="eg-pecas" role="group" aria-label="Peça para conferir" id="eg-chips">${chips(x)}</div>
              <div class="campos" style="margin-top:12px;grid-template-columns:minmax(0,1fr)">
                <label class="campo">Altura de carga (mm, do piso)
                  <span class="eg-par"><input type="range" id="eg-h" min="400" max="2000" step="10" value="${pp.h}" data-tip="Arraste para mudar a altura em que o operador carrega esta peça."><input type="number" id="eg-hn" min="400" max="2000" step="10" value="${pp.h}" aria-label="Altura de carga em mm"></span></label>
                <label class="campo">Distância até a peça (mm, da frente do corpo)
                  <span class="eg-par"><input type="range" id="eg-d" min="100" max="1000" step="10" value="${pp.d}" data-tip="Arraste para mudar a distância horizontal entre a frente do corpo do operador e a peça."><input type="number" id="eg-dn" min="100" max="1000" step="10" value="${pp.d}" aria-label="Distância em mm"></span></label>
                <div class="campo">Lado da base
                  <div class="seg" id="eg-lado">
                    <button data-lado="esq" aria-pressed="${P.lado !== 'dir'}" data-tip="O operador fica do lado esquerdo da base do dispositivo.">Esquerdo</button>
                    <button data-lado="dir" aria-pressed="${P.lado === 'dir'}" data-tip="O operador fica do lado direito da base do dispositivo.">Direito</button></div></div>
              </div>
              <div id="eg-zona">${zonaBox(x)}</div>
              <div class="barra" style="margin-top:12px">
                <button class="btn" data-acao="ler-pos" data-tip="Lê no ${esc(t.nome)} onde o usuário posicionou o operador, o lado da base e os pontos de pega de cada peça deste posto.">Ler posição do CAD</button>
                <span style="color:var(--suave);font-size:13px">${P.lido ? `Lida do ${esc(P.lido.sistema)} às ${esc(P.lido.hora)}.` : 'Posição proposta pelo programa (ainda não lida do CAD).'}</span>
              </div>
            </div>
          </div>
          <div id="eg-resumo">${resumoPosto(x)}</div>`;
      }
      function chips(x) {
        const P = s.postos[x.sub.id];
        return x.pecas.map((pc) => { const z = zona(P.pecas[pc].h, P.pecas[pc].d); return `<button data-peca="${pc}" aria-pressed="${pc === s.peca}" data-tip="${esc(`${pc} · ${nomeP(pc)}: ${ZONA[z][1].toLowerCase()}. Clique para conferir esta peça.`)}"><i style="background:${ZONA[z][2]}"></i>${esc(pc)}</button>`; }).join('');
      }
      /* redesenho parcial enquanto arrasta (não refaz os controles) */
      function parcial() {
        const x = atual(); if (!x) return;
        $('#eg-vista', el).innerHTML = vista(x);
        $('#eg-zona', el).innerHTML = zonaBox(x);
        $('#eg-resumo', el).innerHTML = resumoPosto(x);
        $('#eg-chips', el).innerHTML = chips(x);
        $$abas();
        apres(); checar();
      }
      function $$abas() {
        const PL = postos();
        el.querySelectorAll('#eg-abas [data-posto]').forEach((bt) => {
          const p = PL.lista.find((q) => q.sub.id === +bt.dataset.posto);
          if (!p) return;
          const n = pendenciasPosto(p);
          let bd = bt.querySelector('.badge');
          if (n && !bd) { bd = document.createElement('span'); bd.className = 'badge'; bt.appendChild(bd); }
          if (bd) { if (n) bd.textContent = n; else bd.remove(); }
        });
      }

      /* ---------- manutenção ---------- */
      function manut() {
        const PL = postos().lista;
        const onde = (m) => { const p = PL[m.posto]; return p ? 'ST' + p.sub.st : '—'; };
        $('#eg-manut', el).innerHTML = `
          ${s.manutencao.length ? `<div class="rolagem"><table id="eg-manut-tab">
            <thead><tr><th>Item</th><th>Posto</th><th class="num">Altura de acesso</th><th>Situação</th><th></th></tr></thead>
            <tbody>${s.manutencao.map((m) => {
              const alto = m.altura > PLATAFORMA;
              const sit = alto ? (m.plataforma ? '<span class="pilula ok" data-tip="Plataforma incluída no layout para este acesso.">Plataforma incluída</span>' : `<span class="pilula erro" data-tip="Acima de ${PLATAFORMA} mm o mantenedor não alcança do piso: o programa pede plataforma.">Pede plataforma</span>`)
                : `<span class="pilula ok" data-tip="Até ${PLATAFORMA} mm, alcançado do piso.">Alcança do piso</span>${m.plataforma ? ' <span class="pilula neutro" data-tip="Tem plataforma, mas o acesso já não passa de 1800 mm.">plataforma sobrando</span>' : ''}`;
              const bt = alto && !m.plataforma
                ? `<button class="btn mini primario" data-acao="plat" data-id="${esc(m.id)}" data-tip="Inclui uma plataforma de acesso para este item e registra no projeto. Ela entra na lista do layout.">Incluir plataforma</button>`
                : m.plataforma ? `<button class="btn mini leve" data-acao="plat-tirar" data-id="${esc(m.id)}" data-tip="Retira a plataforma deste item e registra.">Retirar plataforma</button>` : '';
              return `<tr><td>${esc(m.item)}</td><td>${onde(m)}</td>
                <td class="num"><input class="curto" type="number" min="0" max="4000" step="10" data-alt="${esc(m.id)}" value="${esc(m.altura)}" aria-label="${esc('Altura de acesso: ' + m.item)}" data-tip="Altura do ponto de acesso, medida do piso, em mm."> mm</td>
                <td>${sit}</td><td><div class="barra">${bt}<button class="btn mini leve" data-acao="manut-rm" data-id="${esc(m.id)}" data-tip="Tira este item da lista de manutenção e registra.">Remover</button></div></td></tr>`;
            }).join('')}</tbody></table></div>` : '<div class="vazio">Nenhum item de manutenção cadastrado. Use "Adicionar item".</div>'}
          <div class="barra" style="margin-top:12px">
            <button class="btn" data-acao="manut-add" data-tip="Cadastra um item que precisa de acesso de manutenção (nome e altura do piso). Acima de 1800 mm, pede plataforma.">Adicionar item</button>
            <span style="color:var(--suave);font-size:13px">${s.manutencao.filter((m) => m.altura > PLATAFORMA && !m.plataforma).length ? `${s.manutencao.filter((m) => m.altura > PLATAFORMA && !m.plataforma).length} item(ns) acima de ${PLATAFORMA} mm sem plataforma.` : 'Todos os acessos resolvidos.'}</span>
          </div>`;
      }

      /* ---------- apresentação ---------- */
      function apres() {
        const u = ultima();
        const atualOk = u && u.assin === assinatura();
        const aprovada = u && u.aprovada;
        $('#eg-apres', el).innerHTML = `
          <div class="kpis">
            <div class="kpi ${u ? (aprovada ? 'ok' : '') : ''}"><span>Versão atual</span><b>${u ? esc(u.v) : '—'}</b><small>${u ? `ERGO_${esc(u.v)}.pptx` : 'nenhuma gerada'}</small></div>
            <div class="kpi ${aprovada ? 'ok' : u ? 'aviso' : ''}"><span>Situação</span><b style="font-size:17px;font-family:var(--f-texto)">${!u ? 'Não gerada' : aprovada ? 'Aprovada' : u.v[0] === 'C' ? 'Conceito' : 'Aguarda aprovação'}</b><small>${aprovada ? `por ${esc(u.aprovada.quem)} em ${esc(br(u.aprovada.data))}` : u ? 'falta a aprovação do cliente' : 'gere a C1'}</small></div>
          </div>
          ${u && !atualOk ? `<p class="nota aviso">Os dados mudaram depois da ${esc(u.v)}: gere a apresentação de novo para o cliente ver a versão atual.</p>` : ''}
          ${s.versoes.length ? `<h3 class="rotulo-sec">Versões</h3><div class="lista">${s.versoes.slice().reverse().map((v) => `<div class="item"><span class="tag">${esc(v.v)}</span>
              <div>${esc(v.resumo)}<small>${esc(br(v.data))} ${esc(v.hora || '')}${v.de ? ` · ${esc(v.de)} virou ${esc(v.v)}` : ''}${v.motivo ? ` · motivo: ${esc(v.motivo)}` : ''}</small></div>
              ${v.aprovada ? `<span class="pilula ok" data-tip="${esc(`Aprovada por ${v.aprovada.quem} em ${br(v.aprovada.data)}.`)}">aprovada</span>` : v.v[0] === 'C' ? '<span class="pilula neutro" data-tip="Versão de conceito: vira F1 quando o cliente aprovar.">conceito</span>' : '<span class="pilula aviso" data-tip="Versão final revisada depois do F1: aguarda a aprovação do cliente.">aguarda aprovação</span>'}</div>`).join('')}</div>` : ''}
          <div class="barra" style="margin-top:12px">
            <button class="btn ${!u || !atualOk ? 'primario' : ''}" data-acao="gerar" data-tip="Captura a vista de cada posto no CAD e monta a apresentação de ergonomia (postos, zonas, justificativas e plataformas) na pasta 14.6_Ergonomia. Antes do F1 gera C1, C2…; depois do F1 pede o motivo e gera F2.">Gerar apresentação de ergonomia</button>
            <button class="btn" data-acao="aprovar" data-tip="Registra quem aprovou pelo cliente e quando. A versão de conceito vira final (C2 vira F1).">Registrar aprovação do cliente</button>
          </div>`;
      }

      /* ---------- checagem ---------- */
      function checar() {
        const PL = postos().lista;
        const pend = PL.reduce((a, x) => a + pendenciasPosto(x), 0);
        const lidos = PL.filter((x) => s.postos[x.sub.id].lido).length;
        const semPlat = s.manutencao.filter((m) => m.altura > PLATAFORMA && !m.plataforma);
        const u = ultima();
        const cli = s.operador.tipo === 'cliente';
        const itens = [
          { t: 'Operador do projeto definido', ok: true, okCls: cli ? 'ok' : 'aviso', okTxt: cli ? `Manequim do cliente · ${fmt(s.operador.altura, 0)} cm` : 'Referência de 173 cm (cliente não mandou manequim)' },
          { t: 'Posição do operador lida do CAD em todos os postos', ok: lidos === PL.length, falha: `${PL.length - lidos} posto(s) com a posição proposta pelo programa · não trava`, nivel: 'aviso' },
          { t: 'Alcances na zona verde ou justificados', ok: pend === 0, falha: `${pend} peça(s) em zona amarela ou vermelha sem decisão`, nivel: 'erro', alvo: '#eg-postos' },
          { t: `Itens de manutenção acima de ${PLATAFORMA} mm com plataforma`, ok: !semPlat.length, falha: `${semPlat.length} item(ns) sem plataforma`, nivel: 'erro', alvo: '#eg-manut' },
          { t: 'Apresentação de ergonomia gerada com os dados atuais', ok: !!u && u.assin === assinatura(), falha: u ? `A ${u.v} não mostra os dados atuais: gere de novo` : 'Nenhuma apresentação gerada', nivel: 'erro', alvo: '#eg-apres' },
          { t: 'Aprovação do cliente registrada', ok: !!(u && u.aprovada), falha: 'Sem aprovação: conclui como conceito', nivel: 'aviso', alvo: '#eg-apres' },
        ];
        $('#eg-check', el).innerHTML = itens.map((i) => `<div><span>${esc(i.t)}</span><span class="barra">${i.ok ? `<span class="pilula ${i.okCls || 'ok'}">${esc(i.okTxt || 'Certo')}</span>` : `<span class="pilula ${i.nivel}">${esc(i.falha)}</span>${i.alvo ? `<button class="btn mini leve" data-ir="${i.alvo}" data-tip="Leva até o quadro onde este item se resolve.">Ver</button>` : ''}`}</span></div>`).join('');
        return { ruins: itens.filter((i) => !i.ok && i.nivel === 'erro'), u, PL };
      }

      const tudo = () => { operador(); desenhaPostos(); manut(); apres(); checar(); };
      tudo();

      /* ---------- edição da posição (arrastar e digitar) ---------- */
      let arrasto = null;
      function mudaPos(campo, v) {
        const x = atual(); if (!x) return;
        const pp = s.postos[x.sub.id].pecas[s.peca];
        if (!arrasto) arrasto = { pc: s.peca, st: x.sub.st, h: pp.h, d: pp.d };
        pp[campo] = Math.round(v);
        pp.aceito = null; pp.ajustado = null;
        const r = $('#eg-' + campo, el), n = $('#eg-' + campo + 'n', el);
        if (r) r.value = pp[campo];
        if (n) n.value = pp[campo];
        parcial();
      }
      function fechaArrasto() {
        if (!arrasto) return;
        const x = atual(); const pp = s.postos[x.sub.id].pecas[arrasto.pc];
        if (pp.h !== arrasto.h || pp.d !== arrasto.d) reg(`ST${arrasto.st} · peça ${arrasto.pc}: altura ${arrasto.h} → ${pp.h} mm, distância ${arrasto.d} → ${pp.d} mm (${ZONA[zona(pp.h, pp.d)][1].toLowerCase()}).`);
        arrasto = null;
        ctx.salvar();
      }
      el.addEventListener('input', (e) => {
        const id = e.target.id;
        if (id === 'eg-h' || id === 'eg-d') mudaPos(id.slice(3), +e.target.value);
      });
      el.addEventListener('change', (e) => {
        const t = e.target, id = t.id;
        if (id === 'eg-h' || id === 'eg-d') { fechaArrasto(); return; }
        if (id === 'eg-hn' || id === 'eg-dn') {
          const campo = id.slice(3, 4), [mn, mx] = campo === 'h' ? [400, 2000] : [100, 1000];
          const v = parseFloat(t.value);
          if (!(v >= mn && v <= mx)) { ctx.avisa(`Use um valor entre ${mn} e ${mx} mm.`, { tipo: 'erro' }); const x = atual(); t.value = s.postos[x.sub.id].pecas[s.peca][campo]; return; }
          mudaPos(campo, v); fechaArrasto(); return;
        }
        if (t.dataset.alt) {
          const m = s.manutencao.find((q) => q.id === t.dataset.alt);
          const v = Math.round(parseFloat(t.value));
          if (!m) return;
          if (!(v > 0 && v <= 4000)) { ctx.avisa('Altura de acesso em mm, entre 1 e 4000.', { tipo: 'erro' }); t.value = m.altura; return; }
          const de = m.altura; m.altura = v;
          reg(`Manutenção · ${m.item}: altura de acesso ${de} → ${v} mm.`);
          ctx.salvar(); manut(); apres(); checar();
          if (v > PLATAFORMA && !m.plataforma) ctx.avisa(`${m.item} ficou a ${v} mm: acima de ${PLATAFORMA} mm pede plataforma.`, { tipo: 'aviso' });
        }
      });

      el.addEventListener('click', async (e) => {
        const ir = e.target.closest('[data-ir]');
        if (ir) { $(ir.dataset.ir, el)?.closest('.bloco')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
        const tp = e.target.closest('[data-posto]');
        if (tp) { s.posto = +tp.dataset.posto; s.peca = null; ctx.salvarUI(); desenhaPostos(); return; }
        const pc = e.target.closest('[data-peca]');
        if (pc) { s.peca = pc.dataset.peca; ctx.salvarUI(); desenhaPostos(); return; }
        const ld = e.target.closest('[data-lado]');
        if (ld) {
          const x = atual(); if (!x) return;
          const P = s.postos[x.sub.id];
          if (P.lado === ld.dataset.lado) return;
          P.lado = ld.dataset.lado;
          reg(`ST${x.sub.st}: operador do lado ${P.lado === 'dir' ? 'direito' : 'esquerdo'} da base.`);
          ctx.salvar(); desenhaPostos(); apres(); checar();
          return;
        }
        const b = e.target.closest('[data-acao]');
        if (!b) return;
        const a = b.dataset.acao, t = AE.termos();

        if (a === 'op-ref') {
          if (s.operador.tipo === 'referencia') { ctx.avisa('O operador de referência de 173 cm já está em uso.'); return; }
          s.operador = { tipo: 'referencia', altura: REF_ALTURA };
          reg('Operador de referência (173 cm) adotado.');
          ctx.salvar(); tudo();
          ctx.avisa('Zonas de alcance refeitas com o operador de referência de 173 cm.', { tipo: 'ok' });
          return;
        }
        if (a === 'op-cliente') {
          if (!(await ctx.cad({
            titulo: 'Inserir manequim do cliente',
            catia: 'CATIA.StartWorkbench "SWKHumanModelingWorkbench"   \' Human Builder\nSet man = HumanFactory.InsertManikin(raiz, "OPERADOR", arquivoDoCliente)\nestatura = man.Anthropometry.GetVariable("stature").Value',
            nx: 'var hb = workPart.HumanModels.CreateHumanBuilder(null);   // Human Modeling\nhb.LoadFromFile(arquivoDoCliente);\nvar man = (HumanModel)hb.Commit();\nvar estatura = man.Stature;',
            resultado: 'Manequim do cliente inserido como OPERADOR. Estatura lida para conferência.',
          }, b))) return;
          const v = await ctx.perguntar({ titulo: 'Estatura do manequim do cliente', texto: `Confira a estatura lida do manequim no ${t.nome}, em centímetros. As zonas de alcance passam a seguir esta altura.`, campo: 'Estatura (cm)', tipo: 'number', valor: s.operador.tipo === 'cliente' ? s.operador.altura : 175, extra: 'min="140" max="210" step="1"', ok: 'Usar este manequim' });
          if (v == null) return;
          const n = Math.round(Number(v));
          if (!(n >= 140 && n <= 210)) { ctx.avisa('Estatura fora do esperado: use um valor entre 140 e 210 cm.', { tipo: 'erro' }); return; }
          s.operador = { tipo: 'cliente', altura: n, hora: hora() };
          reg(`Manequim do cliente inserido no ${t.nome}: ${n} cm.`);
          ctx.salvar(); tudo();
          ctx.avisa(`Manequim do cliente com ${n} cm em uso. As zonas de alcance foram refeitas: confira os postos.`, { tipo: 'ok' });
          return;
        }
        if (a === 'ler-pos') {
          const x = atual(); if (!x) return;
          const P = s.postos[x.sub.id];
          if (!(await ctx.cad({
            titulo: `Ler posição do operador · ST${x.sub.st}`,
            catia: 'Set man = raiz.Products.Item("OPERADOR")\nman.Position.GetComponents pos   \' onde o operador está\nFor Each pega In pontosDePega : pega.GetCoordinates xyz : Next\nlado = man.ReferenceProduct.UserRefProperties.Item("LADO_BASE").Value',
            nx: 'var man = workPart.HumanModels.FindObject("OPERADOR");\nvar pos = man.Position;   // onde o operador está\nforeach (var pega in pontosDePega) xyz.Add(pega.Coordinates);\nvar lado = man.GetStringUserAttribute("LADO_BASE", -1);',
            resultado: `Operador lido: lado ${P.lado === 'dir' ? 'direito' : 'esquerdo'} da base, ${x.pecas.length} ponto(s) de pega (${x.pecas.join(', ')}).`,
          }, b))) return;
          P.lido = { hora: hora(), sistema: t.nome };
          reg(`ST${x.sub.st}: posição do operador e pontos de pega lidos do ${t.nome}.`);
          ctx.salvar(); desenhaPostos(); apres(); checar();
          ctx.avisa(`Posição do operador da ST${x.sub.st} lida do ${t.nome}.`, { tipo: 'ok' });
          return;
        }
        if (a === 'ajustar') {
          const x = atual(); if (!x) return;
          const pp = s.postos[x.sub.id].pecas[s.peca], z = zona(pp.h, pp.d);
          if (z === 'verde') { ctx.avisa('Esta peça já está na zona verde.'); return; }
          const alvo = verdeMaisProxima(pp);
          const ok = await ctx.perguntar({
            titulo: `Pode ajustar a posição da peça ${s.peca}?`,
            texto: `A peça está na zona ${z}. A posição verde mais próxima é: altura de carga ${pp.h} → ${alvo.h} mm e distância ${pp.d} → ${alvo.d} mm. Isso muda o dispositivo da ST${x.sub.st}: a Mecânica recebe o pedido.`,
            ok: 'Ajustar posição',
          });
          if (!ok) return;
          if (!(await ctx.cad({
            titulo: `Ajustar ponto de pega · ST${x.sub.st} · ${s.peca}`,
            catia: `Set man = raiz.Products.Item("OPERADOR")\n' Human Builder: alcança o novo ponto de pega por cinemática inversa\nman.Posture.ReachTo pega_${s.peca}, ${alvo.d}, ${alvo.h}\nman.Analysis.ReachEnvelope.Update`,
            nx: `var man = workPart.HumanModels.FindObject("OPERADOR");\nman.ReachTo(pega_${s.peca}, new Point3d(${alvo.d}, 0, ${alvo.h}));   // cinemática inversa\nman.UpdateReachZone();`,
            resultado: `Ponto de pega de ${s.peca} movido para ${alvo.h} mm de altura e ${alvo.d} mm de distância: zona verde.`,
          }, b))) return;
          pp.ajustado = { de: { h: pp.h, d: pp.d }, hora: hora() };
          pp.h = alvo.h; pp.d = alvo.d; pp.aceito = null;
          reg(`ST${x.sub.st} · peça ${s.peca}: posição ajustada para a zona verde (${pp.ajustado.de.h} → ${alvo.h} mm de altura, ${pp.ajustado.de.d} → ${alvo.d} mm de distância). Pedido de mudança no dispositivo.`);
          ctx.salvar(); desenhaPostos(); apres(); checar();
          ctx.avisa(`Peça ${s.peca} ajustada para a zona verde. A mudança no dispositivo da ST${x.sub.st} ficou registrada.`, { tipo: 'ok' });
          return;
        }
        if (a === 'manter') {
          const x = atual(); if (!x) return;
          const pp = s.postos[x.sub.id].pecas[s.peca], z = zona(pp.h, pp.d);
          const mot = await ctx.perguntar({ titulo: `Manter ${s.peca} na zona ${z}?`, texto: 'Explique por que a posição não pode mudar. A justificativa vai na apresentação para o cliente.', campo: 'Justificativa', tipo: 'textarea', ok: 'Manter e registrar' });
          if (mot == null) return;
          if (!mot) { ctx.avisa('Escreva a justificativa para manter a peça fora da zona verde.', { tipo: 'erro' }); return; }
          pp.aceito = { motivo: mot, hora: hora() };
          reg(`ST${x.sub.st} · peça ${s.peca} mantida na zona ${z} (${pp.h} mm, ${pp.d} mm). Justificativa: ${mot}`);
          ctx.salvar(); desenhaPostos(); apres(); checar();
          ctx.avisa(`Peça ${s.peca} mantida na zona ${z}, com justificativa registrada.`, { tipo: 'ok' });
          return;
        }
        if (a === 'plat' || a === 'plat-tirar') {
          const m = s.manutencao.find((q) => q.id === b.dataset.id); if (!m) return;
          m.plataforma = a === 'plat';
          reg(`Manutenção · ${m.item} (${m.altura} mm): plataforma ${m.plataforma ? 'incluída' : 'retirada'}.`);
          ctx.salvar(); manut(); apres(); checar();
          ctx.avisa(m.plataforma ? `Plataforma incluída para ${m.item}. Ela entra na lista do layout (Passo 7).` : `Plataforma de ${m.item} retirada.`, { tipo: m.plataforma ? 'ok' : 'aviso' });
          return;
        }
        if (a === 'manut-rm') {
          const m = s.manutencao.find((q) => q.id === b.dataset.id); if (!m) return;
          const ok = await ctx.perguntar({ titulo: 'Remover item de manutenção?', texto: `${m.item} (${m.altura} mm) sai da lista. Fica no registro.`, ok: 'Remover', perigo: true });
          if (!ok) return;
          s.manutencao = s.manutencao.filter((q) => q !== m);
          reg(`Manutenção · ${m.item} removido da lista.`);
          ctx.salvar(); manut(); apres(); checar();
          return;
        }
        if (a === 'manut-add') {
          const nome = await ctx.perguntar({ titulo: 'Novo item de manutenção', texto: 'O que precisa de acesso? Exemplo: unidade de conservação de ar.', campo: 'Item', ok: 'Continuar' });
          if (!nome) return;
          const alt = await ctx.perguntar({ titulo: `Altura de acesso: ${nome}`, texto: 'Altura do ponto de acesso, medida do piso, em mm.', campo: 'Altura (mm)', tipo: 'number', extra: 'min="1" max="4000" step="10"', ok: 'Adicionar' });
          if (alt == null) return;
          const v = Math.round(Number(alt));
          if (!(v > 0 && v <= 4000)) { ctx.avisa('Altura de acesso em mm, entre 1 e 4000. Nada foi adicionado.', { tipo: 'erro' }); return; }
          const id = 'M' + (s.proxManut || s.manutencao.length + 1);
          s.proxManut = (s.proxManut || s.manutencao.length + 1) + 1;
          s.manutencao.push({ id, item: nome, altura: v, posto: 0, plataforma: false });
          reg(`Manutenção · ${nome} cadastrado a ${v} mm.`);
          ctx.salvar(); manut(); apres(); checar();
          ctx.avisa(v > PLATAFORMA ? `${nome} está a ${v} mm: acima de ${PLATAFORMA} mm pede plataforma.` : `${nome} cadastrado.`, { tipo: v > PLATAFORMA ? 'aviso' : 'ok' });
          return;
        }
        if (a === 'gerar') {
          const c = checar();
          const u = c.u, ass = assinatura();
          if (u && u.assin === ass) { ctx.avisa(`A ${u.v} já mostra os dados atuais. Não é preciso gerar outra versão.`); return; }
          const pendPos = c.PL.reduce((acc, x) => acc + pendenciasPosto(x), 0);
          const pendPlat = s.manutencao.filter((m) => m.altura > PLATAFORMA && !m.plataforma).length;
          if (pendPos + pendPlat) {
            const ok = await ctx.perguntar({ titulo: 'Gerar com pendências?', texto: `Há ${pendPos} peça(s) fora da zona verde sem decisão e ${pendPlat} acesso(s) sem plataforma. Elas aparecem em vermelho na apresentação.`, ok: 'Gerar mesmo assim' });
            if (!ok) return;
          }
          const temF = s.versoes.some((v) => v.v[0] === 'F');
          const nC = s.versoes.filter((v) => v.v[0] === 'C').length, nF = s.versoes.filter((v) => v.v[0] === 'F').length;
          let motivo = null, nova;
          if (temF) {
            motivo = await ctx.perguntar({ titulo: 'Mudança depois da versão final', texto: `A apresentação já tem versão final (F${nF}). Mudança depois do F1 cria F${nF + 1} e pede o motivo.`, campo: 'Motivo da revisão', ok: `Gerar F${nF + 1}` });
            if (motivo == null) return;
            if (!motivo) { ctx.avisa('Escreva o motivo da revisão.', { tipo: 'erro' }); return; }
            nova = 'F' + (nF + 1);
          } else nova = 'C' + (nC + 1);
          const npecas = c.PL.reduce((acc, x) => acc + x.pecas.length, 0);
          if (!(await ctx.cad({
            titulo: `Gerar apresentação de ergonomia ${nova}`,
            catia: `For Each posto In postosManuais\n  CATIA.ActiveWindow.ActiveViewer.Reframe\n  CATIA.ActiveWindow.ActiveViewer.CaptureToFile catCaptureFormatJPEG, pasta & "\\ERGO_" & posto & ".jpg"\nNext\n' monta ERGO_${nova}.pptx com as imagens e a tabela de alcances`,
            nx: `foreach (var posto in postosManuais) {\n  workPart.ModelingViews.WorkView.Fit();\n  theUfSession.Disp.CreateImage(pasta + "\\\\ERGO_" + posto + ".png", UFDisp.ImageFormat.Png, UFDisp.BackgroundColor.White);\n}\n// monta ERGO_${nova}.pptx com as imagens e a tabela de alcances`,
            resultado: `ERGO_${nova}.pptx gerado em 14.6_Ergonomia: ${c.PL.length} posto(s), ${npecas} peça(s), ${s.manutencao.length} item(ns) de manutenção.`,
          }, b))) return;
          s.versoes.push({ v: nova, hora: hora(), data: hojeISO(), assin: ass, motivo, aprovada: null,
            resumo: `${c.PL.length} posto(s), ${npecas} peça(s), ${s.manutencao.length} item(ns) de manutenção${pendPos + pendPlat ? ` · ${pendPos + pendPlat} pendência(s)` : ''} · operador ${fmt(s.operador.altura, 0)} cm` });
          reg(`Apresentação de ergonomia ${nova} gerada (ERGO_${nova}.pptx)${motivo ? `. Motivo: ${motivo}` : ''}.`);
          ctx.salvar(); apres(); checar();
          ctx.avisa(`Apresentação ${nova} gerada em 14.6_Ergonomia. Apresente ao cliente e registre a aprovação.`, { tipo: 'ok' });
          return;
        }
        if (a === 'aprovar') {
          const u = ultima();
          if (!u) { ctx.avisa('Gere a apresentação de ergonomia antes de registrar a aprovação.', { tipo: 'aviso' }); return; }
          if (u.aprovada) { ctx.avisa(`A ${u.v} já está aprovada por ${u.aprovada.quem} em ${br(u.aprovada.data)}.`); return; }
          if (u.assin !== assinatura()) { ctx.avisa(`Os dados mudaram depois da ${u.v}. Gere a apresentação de novo antes de registrar a aprovação.`, { tipo: 'aviso' }); return; }
          const quem = await ctx.perguntar({ titulo: `Aprovação da ${u.v}`, texto: 'Quem aprovou a apresentação de ergonomia pelo cliente?', campo: 'Quem aprovou (nome ou função)', ok: 'Continuar' });
          if (!quem) return;
          const data = await ctx.perguntar({ titulo: `Aprovação da ${u.v}`, texto: 'Em que data o cliente aprovou?', campo: 'Data da aprovação', tipo: 'date', valor: hojeISO(), ok: 'Registrar aprovação' });
          if (!data) return;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) { ctx.avisa('Data inválida. Use o seletor de data.', { tipo: 'erro' }); return; }
          let txt;
          if (u.v[0] === 'C') {
            const nF = s.versoes.filter((v) => v.v[0] === 'F').length;
            const nova = 'F' + (nF + 1);
            s.versoes.push({ v: nova, de: u.v, hora: hora(), data, assin: u.assin, resumo: u.resumo, aprovada: { quem, data } });
            txt = `Aprovação do cliente registrada: ${u.v} virou ${nova} (${quem}, ${br(data)}).`;
            s.aprovacao = { quem, data, versao: nova };
          } else {
            u.aprovada = { quem, data };
            txt = `Aprovação do cliente registrada para a ${u.v} (${quem}, ${br(data)}).`;
            s.aprovacao = { quem, data, versao: u.v };
          }
          reg(txt);
          ctx.salvar(); apres(); checar();
          ctx.avisa(`${txt} A ergonomia agora é versão final.`, { tipo: 'ok' });
          return;
        }
        if (a === 'concluir') {
          const c = checar();
          if (c.ruins.length) { ctx.avisa(`Não foi possível concluir: ${c.ruins[0].t.toLowerCase()} (${c.ruins[0].falha}).`, { tipo: 'erro' }); return; }
          const u = c.u;
          const aprov = u.aprovada;
          ctx.concluir({
            registro: aprov
              ? `Ergonomia concluída: ${c.PL.length} posto(s) conferido(s), apresentação ${u.v} aprovada por ${aprov.quem} em ${br(aprov.data)}`
              : `Ergonomia concluída: ${c.PL.length} posto(s) conferido(s), apresentação ${u.v} como CONCEITO (sem aprovação do cliente)`,
            mensagem: aprov ? `Ergonomia concluída com a ${u.v} aprovada. Próximo: necessidade de estações.` : `Ergonomia concluída como conceito (${u.v} sem aprovação). Registre a aprovação quando o cliente responder.`,
          });
        }
      });
    },
  });
})();
