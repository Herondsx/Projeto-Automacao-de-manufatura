/* Passo 7 · Layout (Processo)
   Tela nova, especificada pelo passo "7" do fluxo da v0: desenho do prédio e zero predial (Cliente),
   posição dos robôs (Simulação), padrão de grade e de painéis (Cliente), equipamentos (Passo 5).
   A planta é gerada de AE.calc.estacoes() e AE.calc.equipamentos(). Armários e pedestal de cola são
   arrastáveis (mouse, toque e teclado) e os comprimentos de cabo e mangueira são recalculados ao vivo.
   Toda medida da planta está em mm inteiro, a partir do zero predial. */
(function () {
  'use strict';
  const AE = window.AE;
  const { $, $$, esc, fmt, mm } = AE.util;

  /* ======================= parâmetros de EXEMPLO =======================
     Vêm do desenho do prédio e do padrão do cliente quando existirem. */
  const PILAR_X = 12000, PILAR_Y = 24000, PILAR = 600; // grade de pilares do prédio
  const Y_LINHA = 13000;     // eixo da linha de transporte, medido do zero predial
  const X_INICIO = 4000;     // grade da primeira célula
  const ROBO_Y = 1900;       // base do robô a 1,9 m do eixo da linha
  const ROBO_PASSO = 2600;   // distância entre robôs do mesmo lado
  const AFAST = 800;         // afastamento da grade além do alcance, no layout proposto
  const MODULO = 1000;       // módulo do painel de grade
  const VAO = 1500;          // passagem entre células
  const CORR_SERV = 2000, FAIXA = 2500, CORR_PRINC = 3500;
  const ARM_L = 900, ARM_P = 700, ARM_GAP = 100; // armário do robô (painel elétrico)
  const CABOS = [7, 15, 20]; // comprimentos padrão do cabo robô → armário, em metros
  const FOLGA_CABO = 1500;   // subida no robô + descida no armário
  const MANG_MAX = 12;       // mangueira de cola, em metros
  const FOLGA_MANG = 1000;
  const PASSAGEM = 600;      // meia largura da faixa de retirada do robô (1,2 m)
  /* altura da grade × distância mínima entre a grade e o alcance do robô: EXEMPLO, não é a norma */
  const NORMA = [{ h: 1400, d: 1100 }, { h: 1800, d: 800 }, { h: 2200, d: 400 }];
  /* deslocamento que a Simulação "devolve" para cada robô (mm, de 50 em 50), pela ordem dos robôs */
  const DESL_SIM = [[50, 0], [0, -50], [50, 50], [-50, 0], [-100, 50], [0, 100], [50, -50], [-50, 0], [100, 0], [0, -100]];

  const Y = (y) => -y; // planta com Y para cima; SVG com Y para baixo
  const ret = (cx, cy, w, h) => ({ x1: cx - w / 2, x2: cx + w / 2, y1: cy - h / 2, y2: cy + h / 2 });
  const cruza = (a, b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
  const metros = (v) => fmt(v, 1) + ' m';
  const coord = (x, y) => `X ${mm(x).toLocaleString('pt-BR')} · Y ${mm(y).toLocaleString('pt-BR')}`;
  const letraLinha = (j) => String.fromCharCode(65 + j);
  const alcanceDe = (modelo) => {
    const r = AE.dados.robos.find((x) => x.modelo === modelo);
    if (r) return r.alcance;
    const m = /alcance\s*(\d+)/i.exec(modelo || '');
    return m ? Number(m[1]) : 2700;
  };
  const minimaDe = (h) => (NORMA.find((n) => n.h === Number(h)) || NORMA[1]).d;

  /* ======================= geometria e conferências ======================= */
  function calcular(s) {
    const ee = AE.calc.estacoes().estacoes, eq = AE.calc.equipamentos().itens;
    const desl = (s.sim && s.sim.desloc) || {};
    const cel = [];
    let xEsq = X_INICIO;
    ee.forEach((e) => {
      const its = eq.filter((i) => Number(i.st) === Number(e.st));
      const rIts = its.filter((i) => i.tipo === 'robo');
      const nR = Math.max(0, rIts.length ? rIts.reduce((a, i) => a + (Number(i.qtd) || 0), 0) : Number(e.robos) || 0);
      const alc = alcanceDe(rIts[0] && rIts[0].modelo);
      const nTop = Math.ceil(nR / 2), nBot = Math.floor(nR / 2);
      const offs = [];
      for (let k = 0; k < nR; k++) {
        const top = k % 2 === 0, j = Math.floor(k / 2), n = top ? nTop : nBot;
        offs.push({ k, top, ox: (j - (n - 1) / 2) * ROBO_PASSO, oy: top ? ROBO_Y : -ROBO_Y });
      }
      const raio = nR ? alc : 1500;
      const minOx = offs.length ? Math.min(...offs.map((o) => o.ox)) : 0;
      const maxOx = offs.length ? Math.max(...offs.map((o) => o.ox)) : 0;
      const ny = nR ? ROBO_Y + alc : 1500;
      const cx = xEsq + AFAST + raio - minOx;
      /* grade proposta: alcance + afastamento, arredondada para fora no módulo do painel de grade */
      const f0 = { x1: xEsq, x2: Math.ceil((cx + maxOx + raio + AFAST) / MODULO) * MODULO,
        y1: Math.floor((Y_LINHA - ny - AFAST) / MODULO) * MODULO, y2: Math.ceil((Y_LINHA + ny + AFAST) / MODULO) * MODULO };
      const g = s.grades['ST' + e.st] || {};
      const extra = Math.max(0, Number(g.extra) || 0);
      const f = { x1: f0.x1 - extra, x2: f0.x2 + extra, y1: f0.y1 - extra, y2: f0.y2 + extra };
      const robos = offs.map((o) => {
        const id = `ST${e.st}-R${o.k + 1}`;
        const d = desl[id] || [0, 0];
        return { id, curto: 'R' + (o.k + 1), st: e.st, top: o.top, alc, x: cx + o.ox + d[0], y: Y_LINHA + o.oy + d[1], x0: cx + o.ox, y0: Y_LINHA + o.oy, d };
      });
      const manual = !!e.manual || its.some((i) => i.tipo === 'operador');
      cel.push({ st: e.st, nome: e.nome, cx, f0, f, extra, robos, manual, its,
        altura: g.altura ? Number(g.altura) : Number(s.alturaPadrao) || 1800, alturaPropria: !!g.altura });
      xEsq = Math.ceil((f0.x2 + VAO) / MODULO) * MODULO;
    });
    const P = { cel, vazio: !cel.length };
    if (P.vazio) return P;

    P.yServ1 = Math.max(...cel.map((c) => c.f0.y2));
    P.yServ2 = P.yServ1 + CORR_SERV;
    P.yPr2 = Math.min(...cel.map((c) => c.f0.y1)) - FAIXA;
    P.yPr1 = P.yPr2 - CORR_PRINC;
    P.xIni = X_INICIO - 2500;
    P.xFim = Math.max(...cel.map((c) => c.f.x2)) + 2500;
    P.colsMax = Math.max(PILAR_X * 3, Math.ceil(Math.max(...cel.map((c) => c.f.x2)) / PILAR_X) * PILAR_X);
    P.xMax = Math.max(P.colsMax, P.xFim);
    P.pilares = [];
    for (let i = 0; i * PILAR_X <= P.colsMax; i++) {
      for (let j = 0; j * PILAR_Y <= PILAR_Y; j++) P.pilares.push({ nome: `${letraLinha(j)}${i + 1}`, x: i * PILAR_X, y: j * PILAR_Y, r: ret(i * PILAR_X, j * PILAR_Y, PILAR, PILAR) });
    }

    /* postos do operador (fora da grade, com cortina de luz) e equipamentos fixos */
    cel.forEach((c) => {
      if (c.manual) c.posto = { x1: c.cx - 700, x2: c.cx + 700, y1: c.f.y1 - 1400, y2: c.f.y1 - 200 };
      c.pinos = c.its.some((i) => i.tipo === 'pino');
      c.mig = c.its.some((i) => i.tipo === 'mig');
    });

    /* armários dos robôs (um por robô, lado a lado), arrastáveis por estação */
    P.grupos = [];
    P.armarios = [];
    cel.forEach((c) => {
      const n = c.robos.length;
      if (!n) return;
      const W = n * ARM_L + (n - 1) * ARM_GAP;
      const salvo = s.paineis['ST' + c.st];
      const pos = salvo || { x: c.cx, y: P.yServ2 + 300 + ARM_P / 2 };
      const g = { chave: 'ST' + c.st, st: c.st, x: pos.x, y: pos.y, W, movido: !!salvo, arms: [], r: ret(pos.x, pos.y, W, ARM_P) };
      c.robos.forEach((r, k) => {
        const ax = pos.x - W / 2 + ARM_L / 2 + k * (ARM_L + ARM_GAP), ay = pos.y;
        const L = Math.abs(r.x - ax) + Math.abs(r.y - ay) + FOLGA_CABO;
        const m = L / 1000;
        const a = { id: r.id, robo: r, x: ax, y: ay, r: ret(ax, ay, ARM_L, ARM_P), m, pad: CABOS.find((v) => v >= m) || null };
        g.arms.push(a);
        P.armarios.push(a);
      });
      P.grupos.push(g);
    });

    /* cola: bomba fixa na faixa de serviço (troca de tambor pelo corredor) e pedestal arrastável */
    P.colas = AE.calc.equipamentos().itens.filter((i) => i.tipo === 'cola').map((i) => {
      const c = cel.find((x) => Number(x.st) === Number(i.st));
      if (!c) return null;
      const bomba = { x: c.f0.x2 - 1000, y: (P.yPr2 + c.f0.y1) / 2 };
      bomba.r = ret(bomba.x, bomba.y, 1000, 800);
      const base = c.robos.filter((r) => !r.top).sort((a, b) => b.x0 - a.x0)[0] || c.robos.slice().sort((a, b) => b.x0 - a.x0)[0];
      const def = base ? { x: base.x0 + 1500, y: base.y0 } : { x: c.cx + 2500, y: Y_LINHA };
      const salvo = s.cola[i.id];
      const pos = salvo || def;
      const L = Math.abs(bomba.x - pos.x) + Math.abs(bomba.y - pos.y) + FOLGA_MANG;
      let perto = null, dist = Infinity;
      c.robos.forEach((r) => { const d = Math.hypot(r.x - pos.x, r.y - pos.y); if (d < dist) { dist = d; perto = r; } });
      return { chave: i.id, st: c.st, modelo: i.modelo, bomba, x: pos.x, y: pos.y, movido: !!salvo, m: L / 1000, ok: L / 1000 <= MANG_MAX,
        perto, dist, alcanca: !!perto && dist <= perto.alc, r: ret(pos.x, pos.y, 900, 900) };
    }).filter(Boolean);

    /* grades: menor distância entre o alcance de um robô e a grade da célula */
    cel.forEach((c) => {
      let menor = null;
      c.robos.forEach((r) => {
        [['esquerdo', r.x - r.alc - c.f.x1], ['direito', c.f.x2 - (r.x + r.alc)], ['de baixo', r.y - r.alc - c.f.y1], ['de cima', c.f.y2 - (r.y + r.alc)]]
          .forEach(([lado, d]) => { if (!menor || d < menor.d) menor = { d: mm(d), lado, robo: r.curto }; });
      });
      c.dist = menor;
      c.minima = minimaDe(c.altura);
      c.gradeOk = !menor || menor.d >= c.minima;
      const res = menor ? NORMA.find((n) => n.d <= menor.d) : null;
      c.resolve = res ? res.h : null;
      c.falta = menor ? Math.max(0, c.minima - menor.d) : 0;
    });

    /* obstáculos para a retirada de robô e para os armários */
    P.obst = [];
    cel.forEach((c) => { if (c.posto) P.obst.push({ nome: `posto do operador da ST${c.st}`, r: c.posto }); });
    P.colas.forEach((k) => { P.obst.push({ nome: `bomba de cola da ST${k.st}`, r: k.bomba.r }); P.obst.push({ nome: `pedestal de cola da ST${k.st}`, r: k.r }); });
    P.armarios.forEach((a) => P.obst.push({ nome: `armário do ${a.id}`, r: a.r }));
    P.pilares.forEach((p) => P.obst.push({ nome: `pilar ${p.nome}`, r: p.r }));

    /* plano de retirada: cada robô sai pela grade do seu lado até o corredor mais perto */
    P.retiradas = [];
    cel.forEach((c) => c.robos.forEach((r) => {
      const alvo = r.top ? P.yServ1 + CORR_SERV / 2 : P.yPr1 + CORR_PRINC / 2;
      const borda = r.top ? c.f.y2 : c.f.y1;
      const bate = (x) => {
        const faixa = r.top ? { x1: x - PASSAGEM, x2: x + PASSAGEM, y1: borda, y2: alvo } : { x1: x - PASSAGEM, x2: x + PASSAGEM, y1: alvo, y2: borda };
        return P.obst.find((o) => cruza(o.r, faixa));
      };
      const b = bate(r.x);
      let out = { robo: r, st: c.st, ok: true, x: r.x, borda, pts: [[r.x, r.y], [r.x, alvo]] };
      if (b) {
        const cands = [b.r.x1 - PASSAGEM - 100, b.r.x2 + PASSAGEM + 100].sort((p, q) => Math.abs(p - r.x) - Math.abs(q - r.x));
        const x2 = cands.find((x) => x > c.f.x1 + PASSAGEM && x < c.f.x2 - PASSAGEM && !bate(x));
        out = x2 != null ? { robo: r, st: c.st, ok: true, x: x2, borda, desvio: b.nome, pts: [[r.x, r.y], [x2, r.y], [x2, alvo]] }
          : { robo: r, st: c.st, ok: false, x: r.x, borda, bloq: b.nome, pts: [[r.x, r.y], [r.x, alvo]] };
      }
      P.retiradas.push(out);
    }));

    /* conferências dos itens arrastáveis */
    P.grupos.forEach((g) => {
      g.probs = [];
      if (g.arms.some((a) => !a.pad)) g.probs.push('cabo acima de 20 m');
      const pil = P.pilares.find((p) => g.arms.some((a) => cruza(a.r, p.r)));
      if (pil) g.probs.push(`em cima do pilar ${pil.nome}`);
      const den = cel.find((c) => g.arms.some((a) => cruza(a.r, c.f)));
      if (den) g.probs.push(`dentro da grade da ST${den.st}`);
    });
    P.colas.forEach((k) => {
      k.probs = [];
      if (!k.ok) k.probs.push('mangueira acima de 12 m');
      if (!k.alcanca) k.probs.push('fora do alcance dos robôs da estação');
      const pil = P.pilares.find((p) => cruza(k.r, p.r));
      if (pil) k.probs.push(`em cima do pilar ${pil.nome}`);
    });
    return P;
  }

  /* ======================= desenho (SVG) ======================= */
  const linha = (pts) => pts.map((p) => `${mm(p[0])},${mm(Y(p[1]))}`).join(' ');
  const rectSvg = (r, attrs) => `<rect x="${mm(r.x1)}" y="${mm(Y(r.y2))}" width="${mm(r.x2 - r.x1)}" height="${mm(r.y2 - r.y1)}" ${attrs}/>`;

  function svgFixo(P) {
    const vx1 = -2600, vx2 = P.xMax + 1200;
    let h = '';
    /* eixos do prédio e pilares */
    for (let i = 0; i * PILAR_X <= P.colsMax; i++) {
      const x = i * PILAR_X;
      h += `<line class="ly-eixo" x1="${x}" y1="${Y(PILAR_Y + 1200)}" x2="${x}" y2="${Y(-1200)}"/><text x="${x}" y="${Y(PILAR_Y + 1500)}" text-anchor="middle" class="ly-eixo-t">${i + 1}</text>`;
    }
    for (let j = 0; j * PILAR_Y <= PILAR_Y; j++) {
      const y = j * PILAR_Y;
      h += `<line class="ly-eixo" x1="${vx1 + 900}" y1="${Y(y)}" x2="${vx2 - 300}" y2="${Y(y)}"/><text x="${vx1 + 500}" y="${Y(y) + 180}" text-anchor="middle" class="ly-eixo-t">${letraLinha(j)}</text>`;
    }
    P.pilares.forEach((p) => (h += rectSvg(p.r, 'class="ly-pilar"')));
    /* zero predial */
    h += `<g class="ly-zero"><circle cx="0" cy="0" r="420"/><line x1="-700" y1="0" x2="700" y2="0"/><line x1="0" y1="-700" x2="0" y2="700"/></g>
      <text x="600" y="${Y(-1000)}" class="ly-t b">Zero predial (A1)</text>`;
    /* corredores */
    const cs = { x1: P.xIni, x2: P.xFim, y1: P.yServ1, y2: P.yServ2 }, cp = { x1: P.xIni, x2: P.xFim, y1: P.yPr1, y2: P.yPr2 };
    h += rectSvg(cs, 'class="ly-corr"') + `<text x="${P.xIni + 300}" y="${Y(P.yServ1 + CORR_SERV / 2) + 170}" class="ly-t">Corredor de serviço</text>`;
    h += rectSvg(cp, 'class="ly-corr"') + `<text x="${P.xIni + 300}" y="${Y(P.yPr1 + CORR_PRINC / 2) + 170}" class="ly-t">Corredor principal (empilhadeira e retirada de robô)</text>`;
    /* linha de transporte */
    h += `<line class="ly-transp" x1="${P.xIni}" y1="${Y(Y_LINHA)}" x2="${P.xFim}" y2="${Y(Y_LINHA)}" marker-end="url(#ly-seta-t)"/>`;
    /* células */
    P.cel.forEach((c) => {
      const cor = c.gradeOk ? 'ok' : 'erro';
      h += rectSvg(c.f, `class="ly-grade ${cor}"`);
      h += `<text x="${c.f.x1 + 300}" y="${Y(c.f.y2) + 650}" class="ly-t b">ST${c.st}</text><text x="${c.f.x1 + 300}" y="${Y(c.f.y2) + 1200}" class="ly-t ${c.gradeOk ? '' : 'erro'}">grade ${c.altura}</text>`;
      c.robos.forEach((r) => (h += `<circle class="ly-alc" cx="${mm(r.x)}" cy="${mm(Y(r.y))}" r="${r.alc}"/>`));
      h += rectSvg(ret(c.cx, Y_LINHA, 3600, 1400), 'class="ly-disp"') + `<text x="${mm(c.cx)}" y="${Y(Y_LINHA) + 170}" text-anchor="middle" class="ly-t">dispositivo</text>`;
      c.robos.forEach((r) => {
        if (r.d[0] || r.d[1]) h += `<circle class="ly-robo0" cx="${mm(r.x0)}" cy="${mm(Y(r.y0))}" r="450"/>`;
        h += `<circle class="ly-robo" cx="${mm(r.x)}" cy="${mm(Y(r.y))}" r="480"/><text x="${mm(r.x)}" y="${mm(Y(r.y)) + 160}" text-anchor="middle" class="ly-t esc">${r.curto}</text>`;
      });
      if (c.posto) {
        h += rectSvg(c.posto, 'class="ly-posto"') + `<text x="${c.cx}" y="${Y((c.posto.y1 + c.posto.y2) / 2) + 160}" text-anchor="middle" class="ly-t peq">operador</text>`;
        h += `<line class="ly-cortina" x1="${c.cx - 700}" y1="${Y(c.f.y1)}" x2="${c.cx + 700}" y2="${Y(c.f.y1)}"/>`;
      }
      if (c.pinos) h += rectSvg(ret(c.f.x2 - 900, c.f.y2 - 900, 700, 700), 'class="ly-equip"') + `<text x="${c.f.x2 - 1400}" y="${Y(c.f.y2 - 900) + 160}" text-anchor="end" class="ly-t peq">pinos</text>`;
      if (c.mig) h += rectSvg(ret(c.f.x2 - 900, c.f.y1 + 900, 700, 700), 'class="ly-equip"') + `<text x="${c.f.x2 - 1400}" y="${Y(c.f.y1 + 900) + 160}" text-anchor="end" class="ly-t peq">MIG</text>`;
    });
    P.colas.forEach((k) => (h += rectSvg(k.bomba.r, 'class="ly-bomba"') + `<text x="${k.bomba.x}" y="${Y(k.bomba.y) + 150}" text-anchor="middle" class="ly-t peq">bomba</text>`));
    /* escala */
    const ex = P.colsMax - 5600, ey = -1500;
    h += `<g class="ly-escala"><line x1="${ex}" y1="${Y(ey)}" x2="${ex + 5000}" y2="${Y(ey)}"/><line x1="${ex}" y1="${Y(ey) - 250}" x2="${ex}" y2="${Y(ey) + 250}"/>
      <line x1="${ex + 2500}" y1="${Y(ey) - 150}" x2="${ex + 2500}" y2="${Y(ey) + 150}"/><line x1="${ex + 5000}" y1="${Y(ey) - 250}" x2="${ex + 5000}" y2="${Y(ey) + 250}"/></g>
      <text x="${ex}" y="${Y(ey) - 400}" class="ly-t">0</text><text x="${ex + 5000}" y="${Y(ey) - 400}" text-anchor="end" class="ly-t">5 m</text>`;
    return h;
  }

  function svgLigacoes(P, s) {
    let h = '';
    P.armarios.forEach((a) => (h += `<polyline class="ly-cabo ${a.pad ? '' : 'erro'}" points="${linha([[a.robo.x, a.robo.y], [a.robo.x, a.y], [a.x, a.y]])}"/>`));
    P.colas.forEach((k) => (h += `<polyline class="ly-mang ${k.ok ? '' : 'erro'}" points="${linha([[k.bomba.x, k.bomba.y], [k.bomba.x, k.y], [k.x, k.y]])}"/>`));
    if (s.retirada && s.verRetirada) {
      P.retiradas.forEach((r) => {
        h += `<polyline class="ly-ret ${r.ok ? '' : 'erro'}" points="${linha(r.pts)}" marker-end="url(#ly-seta-r)"/>`;
        h += `<line class="ly-porta ${r.ok ? '' : 'erro'}" x1="${mm(r.x - PASSAGEM)}" y1="${Y(r.borda)}" x2="${mm(r.x + PASSAGEM)}" y2="${Y(r.borda)}"/>`;
      });
    }
    return h;
  }

  function svgArrastaveis(P) {
    let h = '';
    P.grupos.forEach((g) => {
      const arms = g.arms.map((a, k) => `<rect class="arm" x="${-g.W / 2 + k * (ARM_L + ARM_GAP)}" y="${-ARM_P / 2}" width="${ARM_L}" height="${ARM_P}"/>`).join('');
      h += `<g class="ly-arr ly-arm ${g.probs.length ? 'alerta' : ''}" data-arr="painel" data-k="${g.chave}" tabindex="0" role="button" transform="translate(${mm(g.x)},${mm(Y(g.y))})"
        aria-label="${esc(`Armários dos robôs da ST${g.st}. Arraste, ou use as setas do teclado para mover.`)}" data-tip="${esc(`Armários (painéis elétricos) dos robôs da ST${g.st}. Arraste para mover; os cabos são recalculados na hora. Pelo teclado: setas movem 500 mm, Shift + setas 100 mm.`)}" data-tip-titulo="Item arrastável">
        <rect class="ly-hit" x="${-g.W / 2 - 200}" y="${-ARM_P / 2 - 200}" width="${g.W + 400}" height="${ARM_P + 400}"/>${arms}
        <text x="0" y="${-ARM_P / 2 - 300}" text-anchor="middle" class="ly-t b peq">armários ST${g.st}</text></g>`;
    });
    P.colas.forEach((k) => {
      h += `<g class="ly-arr ly-ped ${k.probs.length ? 'alerta' : ''}" data-arr="cola" data-k="${esc(k.chave)}" tabindex="0" role="button" transform="translate(${mm(k.x)},${mm(Y(k.y))})"
        aria-label="${esc(`Pedestal de cola da ST${k.st}. Arraste, ou use as setas do teclado para mover.`)}" data-tip="${esc(`Pedestal de cola da ST${k.st}. Arraste para mover; a mangueira (até ${MANG_MAX} m) e o alcance do robô são conferidos na hora. Pelo teclado: setas movem 500 mm, Shift + setas 100 mm.`)}" data-tip-titulo="Item arrastável">
        <circle class="ly-hit" r="700"/><circle class="ped" r="450"/><text x="0" y="-650" text-anchor="middle" class="ly-t b peq">cola</text></g>`;
    });
    return h;
  }

  function svgPlanta(P, s) {
    const vx1 = -2600, vx2 = P.xMax + 1200, vy1 = -2600, vy2 = PILAR_Y + 2400;
    return `<svg id="ly-svg" viewBox="${vx1} ${-vy2} ${vx2 - vx1} ${vy2 - vy1}" role="img" aria-label="Planta da linha vista de cima: pilares do prédio, células com robôs, grades, armários, cola e corredores">
      <defs>
        <marker id="ly-seta-t" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" style="fill:var(--suave)"/></marker>
        <marker id="ly-seta-r" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L10 5L0 10z" style="fill:var(--l-sim)"/></marker>
      </defs>
      <g id="ly-fixo">${svgFixo(P)}</g><g id="ly-lig">${svgLigacoes(P, s)}</g><g id="ly-arr">${svgArrastaveis(P)}</g></svg>`;
  }

  /* ======================= tela ======================= */
  AE.tela({
    id: 'layout', sigla: '7', area: 'proc', rotulo: 'Passo 7', titulo: 'Layout',
    resumo: 'A linha dentro do prédio: células, robôs, grades, armários e cola. O programa confere cabos, mangueira, grade e retirada de robô enquanto você mexe.',
    tip: 'Abre a planta da linha no prédio: robôs, grades, armários, cola, cabos e o plano de retirada de robô. Sai o DWG para o cliente aprovar.',
    entradas: [
      { de: 'inicio', o: 'Layout de partida (DWG) e cliente' },
      { de: 'estacoes', o: 'Estações e robôs' },
      { de: 'equipamentos', o: 'Equipamentos por estação' },
      { de: 'simulacao', o: 'Posição dos robôs validada' },
    ],
    inicial: () => ({ alturaPadrao: 1800, grades: {}, paineis: {}, cola: {}, sim: null, retirada: null, verRetirada: true, dwg: null, aprovacao: null }),
    programador: `
      <h3>O que esta tela guarda</h3>
      <ul>
        <li><code>alturaPadrao</code> da grade e, por estação, <code>grades['ST10'] = {altura, extra}</code> (altura própria e afastamento a mais, em mm).</li>
        <li>Posição dos itens movidos: <code>paineis['ST10'] = {x, y}</code> (centro do conjunto de armários) e <code>cola[idEquip] = {x, y}</code> (pedestal), em mm inteiro do zero predial. Item não movido fica na posição proposta.</li>
        <li><code>sim</code>: deslocamento de cada robô lido da Simulação (<code>desloc['ST10-R1'] = [dx, dy]</code>) e o número de sequência da conclusão dela.</li>
        <li><code>retirada</code> (plano gerado), <code>dwg</code> (<code>versao</code> C1, C2… ou F1, F2…; <code>desatualizado</code>) e <code>aprovacao</code> (<code>quem</code>, <code>quando</code>, <code>versao</code>).</li>
      </ul>
      <h3>Regras</h3>
      <ul>
        <li>Planta gerada das estações (Passo 4) e dos equipamentos (Passo 5): uma célula por estação, robôs dos dois lados do dispositivo, posto do operador na frente das estações manuais.</li>
        <li>Grade proposta = alcance do robô + 800 mm, arredondada para fora no módulo de 1000 mm. A conferência mede a menor distância entre o alcance de cada robô e a grade.</li>
        <li>Distância abaixo da mínima da altura escolhida: mostra a menor altura de grade que resolve, ou pede para afastar a grade.</li>
        <li>Cabo robô → armário: percurso em L + 1,5 m, escolhido entre 7, 15 e 20 m (o menor que atende). Acima de 20 m: alerta pedindo para mover o armário.</li>
        <li>Mangueira de cola: percurso em L da bomba ao pedestal + 1 m, até 12 m. O pedestal tem de ficar ao alcance de um robô da estação.</li>
        <li>Armário não pode ficar dentro de grade nem em cima de pilar.</li>
        <li>Retirada de robô: faixa de 1,2 m da base do robô até o corredor do seu lado, passando por um painel de grade removível. Se algo bloqueia, tenta desviar dentro da célula; se não der, trava.</li>
        <li>Sem as posições da Simulação o layout é preliminar. Quando ela conclui, "Atualizar posições" desloca os robôs e refaz as conferências.</li>
        <li>Qualquer mudança depois de exportar deixa o DWG desatualizado. Versão C até a aprovação do cliente; depois dela, F1, e cada nova exportação vira F2… com motivo.</li>
      </ul>
      <h3>Saída</h3>
      <ul>
        <li>A fatia <code>layout</code> (acima). Ainda não existe <code>AE.calc.layout()</code>: os Passos 8, 10 e 11 (a fazer) vão ler daqui as grades, os armários e a posição final dos robôs.</li>
        <li>DWG em <code>14.2.1_Layout</code>, com camadas de pilares, grade, armários, cabos e retirada.</li>
      </ul>
      <h3>Macros de base</h3>
      <ul><li>Nenhuma na v0 para o layout. A rotina de exportação para DWG está a definir.</li></ul>
      <h3>Em aberto</h3>
      <ul>
        <li>A tabela altura da grade × distância mínima é de EXEMPLO (1400 → 1100, 1800 → 800, 2200 → 400 mm). Tem de vir da norma adotada (ex.: ISO 13857) ou do padrão do cliente, e na norma ela depende também da altura da zona de perigo.</li>
        <li>O alcance é o círculo cheio do catálogo do robô. Se o cliente aceita limitar a zona por software de segurança do robô, a distância passa a ser medida da zona limitada?</li>
        <li>Supus a bomba de cola fixa junto ao corredor e os 12 m medidos da bomba até o pedestal. Na lista de equipamentos eles estão juntos ("Pedestal de cola com bomba"). Os 12 m valem para qual trecho?</li>
        <li>Cabo em L + 1,5 m: qual é a regra real do percurso (calha por cima, descida no armário)?</li>
        <li>Armários: um por robô, lado a lado, atrás do corredor de serviço. Existe padrão de painel por estação (PLC, controle de solda)?</li>
        <li>Pilares em 12 × 24 m, zero predial no pilar A1, corredores de 2 m e 3,5 m e passagem de retirada de 1,2 m são exemplo. Devem vir do DWG do prédio e do padrão do cliente.</li>
        <li>O layout é desenhado no CATIA ou no NX e exportado em DWG, ou o time desenha no AutoCAD? Isso muda a rotina de exportação.</li>
      </ul>`,

    render(ctx) {
      const s = ctx.s, t = ctx.termos(), pj = AE.calc.projeto();
      const P = calcular(s);
      if (P.vazio) {
        return `<div class="bloco"><h2>Planta da linha</h2><div class="vazio">Ainda não há nenhuma estação para desenhar. Defina as estações no <a href="#/estacoes">Passo 4</a> (ou separe o produto no <a href="#/separacao">Passo 1</a>) e volte aqui.</div></div>`;
      }
      const alturas = NORMA.map((n) => `<option value="${n.h}" ${Number(s.alturaPadrao) === n.h ? 'selected' : ''}>${n.h} mm</option>`).join('');
      return `
      <div id="ly-faixa"></div>

      <div class="bloco">
        <h2>Planta da linha <span class="exemplo">dados de exemplo</span></h2>
        <p class="sub">Vista de cima, com as medidas a partir do zero predial. Arraste os <b>armários</b> (roxo) e o <b>pedestal de cola</b> (laranja): cabos e mangueira são recalculados na hora.</p>
        <div class="leitura ly-base" style="margin-bottom:12px">
          <div><code>Prédio</code><span>${pj.layoutCarregado ? `Pilares e zero predial lidos do DWG de partida (${pj.layoutBase === 'retooling' ? 'linha existente' : 'codesigner'}), Passo 0.` : 'DWG do prédio ainda não carregado no Passo 0: pilares em grade de 12 × 24 m e zero predial no pilar A1, de exemplo.'}</span></div>
          <div><code>Robôs</code><span id="ly-base-robos"></span></div>
          <div><code>Grade</code><span>Padrão de ${esc(pj.cliente)}: altura escolhida abaixo, painéis de ${MODULO} mm.</span></div>
        </div>
        <div class="barra" style="margin-bottom:10px">
          <button class="btn" id="ly-sim" data-tip="Lê as posições dos robôs validadas na Simulação, desloca cada robô na planta e refaz as conferências de grade, cabo e retirada.">Atualizar posições da Simulação</button>
          <button class="btn" id="ly-ret" data-tip="Traça o caminho de retirada de cada robô até o corredor, marca o painel de grade removível e confere se algo bloqueia a passagem.">${s.retirada ? (s.verRetirada ? 'Esconder retirada' : 'Mostrar retirada') : 'Gerar plano de retirada'}</button>
          <button class="btn leve" id="ly-repor" data-tip="Devolve os armários e o pedestal de cola para a posição que o programa propôs.">Voltar à posição proposta</button>
        </div>
        <div class="ly-planta" id="ly-planta">${svgPlanta(P, s)}</div>
        <div class="ly-leg">
          <span><i class="robo"></i>Robô e alcance</span><span><i class="grade"></i>Grade (vermelha: abaixo da distância)</span>
          <span><i class="arm"></i>Armários, arrastáveis</span><span><i class="cabo"></i>Cabo do robô</span>
          <span><i class="ped"></i>Cola: pedestal arrastável, bomba e mangueira</span><span><i class="posto"></i>Operador e cortina de luz</span>
          <span><i class="ret"></i>Retirada de robô</span><span><i class="pilar"></i>Pilar</span>
        </div>
        <p class="nota" id="ly-sel">Arraste um item ou selecione com Tab e mova com as setas (Shift = 100 mm).</p>
      </div>

      <div class="bloco">
        <h2>Cabos e mangueira</h2>
        <p class="sub">Percurso em L, medido na planta. Cabo do robô: o menor entre 7, 15 e 20 m que atende. Mangueira de cola: até ${MANG_MAX} m.</p>
        <div id="ly-kpis"></div>
        <div class="rolagem alta" style="margin-top:12px"><table id="ly-cabos">
          <thead><tr><th>Ligação</th><th class="num">Percurso</th><th>Padrão</th><th>Situação</th></tr></thead><tbody></tbody></table></div>
      </div>

      <div class="bloco">
        <h2>Grades</h2>
        <p class="sub">Para cada altura de grade existe uma distância mínima até o alcance do robô. Abaixo dela, o programa mostra a altura que resolve.</p>
        <div class="ly-grade-topo">
          <label class="campo">Altura padrão da grade (padrão do cliente)<select id="ly-altura" data-tip="Altura de grade usada em todas as estações que não têm altura própria.">${alturas}</select></label>
          <div>
            <h3 class="rotulo-sec" style="margin-top:0">Distância mínima por altura <span class="exemplo">exemplo</span></h3>
            <div class="calc">${NORMA.map((n) => `<span>Grade de ${n.h} mm</span><b>${n.d} mm</b>`).join('')}</div>
          </div>
        </div>
        <p class="nota aviso">Valores de exemplo. A tabela real vem da norma adotada (ex.: ISO 13857) ou do padrão do cliente.</p>
        <div class="rolagem" style="margin-top:12px"><table id="ly-grades">
          <thead><tr><th>Estação</th><th>Altura da grade</th><th class="num">Menor distância</th><th class="num">Mínima</th><th>Situação</th></tr></thead><tbody></tbody></table></div>
      </div>

      <div class="bloco">
        <h2>Entrega e aprovação</h2>
        <p class="sub">O layout sai em DWG, com grades, painéis e o plano de retirada de robô. O desenho é montado em um ${esc(t.desenho)} do ${esc(t.nome)} e exportado. O cliente aprova o layout.</p>
        <div class="leitura" id="ly-entrega"></div>
        <div class="barra" style="margin-top:12px">
          <button class="btn" id="ly-dwg" data-tip="Monta o desenho do layout (pilares, grades, armários, cabos e retirada, em camadas) e salva o DWG na pasta 14.2.1_Layout como versão nova.">Exportar DWG</button>
          <button class="btn" id="ly-aprov" data-tip="Registra que o cliente aprovou a versão exportada: quem aprovou e quando. A versão passa de conceito (C) para final (F1).">Registrar aprovação do cliente</button>
        </div>
      </div>

      <div class="bloco">
        <h2>Checagem</h2>
        <p class="sub">O passo só é concluído sem nenhum item em vermelho, com o plano de retirada gerado e o DWG exportado.</p>
        <div class="checagem" id="ly-check"></div>
        <div class="barra fim" style="margin-top:14px">
          <button class="btn primario" id="ly-concluir" data-tip="Confere tudo de novo. Se não houver item em vermelho, conclui o Passo 7 e entrega o layout para os passos seguintes.">Concluir layout</button>
        </div>
      </div>`;
    },

    montar(el, ctx) {
      const s = ctx.s;
      AE.css('layout', `
        .ly-planta{background:var(--cad);border:1px solid var(--linha);border-radius:6px;overflow-x:auto;position:relative}
        .ly-planta svg{display:block;width:100%;min-width:760px;height:auto;user-select:none;-webkit-user-select:none}
        .ly-planta svg text{font-family:var(--f-dado);font-size:560px;fill:var(--suave);pointer-events:none}
        .ly-planta svg text.b{fill:var(--texto)} .ly-planta svg text.peq{font-size:470px} .ly-planta svg text.erro{fill:var(--erro)}
        .ly-planta svg text.esc{fill:var(--fundo);font-weight:500;font-size:470px}
        .ly-planta svg text.ly-eixo-t{fill:var(--fraco);font-size:620px}
        .ly-grade-topo{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px 28px;align-items:start}
        .ly-eixo{stroke:var(--linha);stroke-width:30;stroke-dasharray:400 260}
        .ly-pilar{fill:var(--linha2);stroke:var(--suave);stroke-width:30}
        .ly-zero circle{fill:none;stroke:var(--acao);stroke-width:60} .ly-zero line{stroke:var(--acao);stroke-width:50}
        .ly-corr{fill:rgba(148,168,198,.06);stroke:var(--linha2);stroke-width:30;stroke-dasharray:300 200}
        .ly-transp{stroke:var(--suave);stroke-width:110;stroke-dasharray:700 300}
        .ly-grade{fill:none;stroke-width:90} .ly-grade.ok{stroke:var(--aviso)} .ly-grade.erro{stroke:var(--erro);stroke-width:130}
        .ly-alc{fill:rgba(90,169,255,.05);stroke:var(--azul);stroke-width:30;stroke-dasharray:180 140;opacity:.75}
        .ly-disp{fill:var(--painel2);stroke:var(--linha2);stroke-width:40}
        .ly-robo{fill:var(--azul)} .ly-robo0{fill:none;stroke:var(--suave);stroke-width:30;stroke-dasharray:80 80}
        .ly-posto{fill:rgba(61,214,140,.12);stroke:var(--ok);stroke-width:40}
        .ly-cortina{stroke:var(--ok);stroke-width:150}
        .ly-equip{fill:none;stroke:var(--l-sim);stroke-width:50}
        .ly-bomba{fill:rgba(255,159,90,.15);stroke:var(--laranja);stroke-width:50}
        .ly-cabo{fill:none;stroke:var(--roxo);stroke-width:45;opacity:.7} .ly-cabo.erro{stroke:var(--erro);stroke-width:80;opacity:1}
        .ly-mang{fill:none;stroke:var(--laranja);stroke-width:70;stroke-dasharray:220 120} .ly-mang.erro{stroke:var(--erro)}
        .ly-ret{fill:none;stroke:var(--l-sim);stroke-width:110;stroke-dasharray:380 200} .ly-ret.erro{stroke:var(--erro)}
        .ly-porta{stroke:var(--l-sim);stroke-width:200} .ly-porta.erro{stroke:var(--erro)}
        .ly-escala line{stroke:var(--texto);stroke-width:50}
        .ly-arr{cursor:grab;touch-action:none;outline:none}
        .ly-arr.arrastando{cursor:grabbing}
        .ly-arr .ly-hit{fill:transparent;stroke:none}
        .ly-arr:focus-visible .ly-hit,.ly-arr.arrastando .ly-hit{stroke:var(--azul);stroke-width:60;stroke-dasharray:160 100}
        .ly-arm rect.arm{fill:rgba(181,146,255,.28);stroke:var(--roxo);stroke-width:50}
        .ly-ped .ped{fill:rgba(255,159,90,.35);stroke:var(--laranja);stroke-width:60}
        .ly-arr.alerta rect.arm,.ly-arr.alerta .ped{stroke:var(--erro);stroke-width:110}
        .ly-leg{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12.5px;color:var(--suave);margin-top:10px}
        .ly-leg span{display:inline-flex;align-items:center;gap:6px}
        .ly-leg i{display:inline-block;width:16px;height:10px;border-radius:2px;border:2px solid}
        .ly-leg i.robo{background:var(--azul);border-color:var(--azul);border-radius:50%;width:10px}
        .ly-leg i.grade{border-color:var(--aviso)} .ly-leg i.arm{border-color:var(--roxo);background:rgba(181,146,255,.28)}
        .ly-leg i.cabo{border:0;height:2px;background:var(--roxo)} .ly-leg i.ped{border-color:var(--laranja);border-radius:50%;width:10px}
        .ly-leg i.posto{border-color:var(--ok)} .ly-leg i.ret{border:0;height:3px;background:var(--l-sim)} .ly-leg i.pilar{background:var(--linha2);border-color:var(--suave);width:10px}
        .ly-base span{color:var(--suave);font-size:13.5px}
        #ly-grades td,#ly-cabos td{white-space:nowrap}
        #ly-grades td.acoes{white-space:normal}
        #ly-grades .barra{gap:6px;margin-top:4px}`);

      let P = calcular(s);
      if (P.vazio) return;
      const svgEl = () => $('#ly-svg', el);

      /* ---------- partes da tela ---------- */
      const faixa = () => {
        const o = ctx.origem('simulacao'), pz = AE.passo('simulacao');
        const aplicada = s.sim && s.sim.seq != null && s.sim.seq === pz.seq;
        let h;
        if (o !== 'tela') {
          h = `<div class="faixa-aviso amarela"><span><b>Layout preliminar.</b> As posições dos robôs ainda não vieram da Simulação: o programa desenhou com as posições padrão (robô a ${fmt(ROBO_Y / 1000, 1)} m da linha, ${fmt(ROBO_PASSO / 1000, 1)} m entre robôs). Quando a Simulação concluir, use "Atualizar posições da Simulação".</span>
            ${AE.telas.simulacao && !AE.telas.simulacao.aFazer ? '<a class="btn mini" href="#/simulacao" data-tip="Abre a tela da Simulação, onde os acessos e a distribuição dos pontos são feitos.">Abrir a Simulação</a>' : ''}</div>`;
        } else if (!aplicada) {
          h = `<div class="faixa-aviso amarela"><span><b>A Simulação ${s.sim ? 'foi concluída de novo' : 'concluiu'}.</b> As posições validadas dos robôs ainda não foram aplicadas nesta planta.</span>
            <button class="btn mini primario" data-acao="sim" data-tip="Lê as posições dos robôs validadas na Simulação e refaz as conferências.">Atualizar posições agora</button></div>`;
        } else {
          h = `<div class="faixa-aviso verde"><span>Posições dos robôs da Simulação aplicadas às ${esc(s.sim.hora)}. As conferências abaixo já usam essas posições.</span></div>`;
        }
        $('#ly-faixa', el).innerHTML = h;
        const nMov = P.cel.reduce((a, c) => a + c.robos.filter((r) => r.d[0] || r.d[1]).length, 0);
        $('#ly-base-robos', el).textContent = s.sim
          ? `Posições da Simulação: ${nMov} robô${nMov === 1 ? '' : 's'} deslocado${nMov === 1 ? '' : 's'} (o círculo tracejado mostra a posição proposta).`
          : 'Posição padrão do programa: robôs dos dois lados do dispositivo. Fica preliminar até a Simulação devolver as posições.';
      };

      const cabos = () => {
        const linhas = P.armarios.map((a) => `<tr><td>${esc(a.id)} → armário</td><td class="num">${metros(a.m)}</td><td>${a.pad ? `cabo de ${a.pad} m` : '—'}</td>
          <td>${a.pad ? `<span class="pilula ok">Atende</span>` : `<span class="pilula erro" data-tip="Nenhum cabo padrão chega. Arraste os armários da ST${a.robo.st} para mais perto do robô.">Acima de 20 m: mova o armário</span>`}</td></tr>`);
        P.colas.forEach((k) => {
          linhas.push(`<tr><td>Mangueira de cola ST${k.st} (bomba → pedestal)</td><td class="num">${metros(k.m)}</td><td>até ${MANG_MAX} m</td>
            <td>${k.ok ? '<span class="pilula ok">Atende</span>' : '<span class="pilula erro" data-tip="Arraste o pedestal de cola para mais perto da bomba.">Acima de 12 m: mova o pedestal</span>'}</td></tr>`);
          linhas.push(`<tr><td>Pedestal de cola ST${k.st} ao alcance</td><td class="num">${k.perto ? metros(k.dist / 1000) : '—'}</td><td>${k.perto ? `${esc(k.perto.id)} alcança ${metros(k.perto.alc / 1000)}` : 'sem robô'}</td>
            <td>${k.alcanca ? '<span class="pilula ok">Ao alcance</span>' : '<span class="pilula erro" data-tip="Nenhum robô da estação chega ao pedestal. Arraste o pedestal para dentro do alcance (círculo azul).">Fora do alcance</span>'}</td></tr>`);
        });
        $('#ly-cabos tbody', el).innerHTML = linhas.join('') || '<tr><td colspan="4"><div class="vazio">Nenhum robô na lista de equipamentos.</div></td></tr>';
        const cont = CABOS.map((c) => [c, P.armarios.filter((a) => a.pad === c).length]).filter((x) => x[1]);
        const fora = P.armarios.filter((a) => !a.pad).length;
        const maior = P.armarios.reduce((m, a) => Math.max(m, a.m), 0);
        const mang = P.colas.reduce((m, k) => Math.max(m, k.m), 0);
        $('#ly-kpis', el).innerHTML = `<div class="kpis">
          <div class="kpi ${fora ? 'erro' : 'ok'}"><span>Maior percurso de cabo</span><b>${metros(maior)}</b><small>${fora ? fora + ' acima de 20 m' : 'todos dentro de 20 m'}</small></div>
          <div class="kpi"><span>Cabos por comprimento</span><b>${cont.map((x) => x[1] + '×' + x[0]).join(' ') || '—'}</b><small>quantidade × metros, para a lista de compra</small></div>
          ${P.colas.length ? `<div class="kpi ${P.colas.every((k) => k.ok) ? 'ok' : 'erro'}"><span>Mangueira de cola</span><b>${metros(mang)}</b><small>limite ${MANG_MAX} m</small></div>` : ''}</div>`;
      };

      const grades = () => {
        $('#ly-grades tbody', el).innerHTML = P.cel.map((c) => {
          const ops = `<option value="" ${c.alturaPropria ? '' : 'selected'}>Padrão (${esc(s.alturaPadrao)})</option>` + NORMA.map((n) => `<option value="${n.h}" ${c.alturaPropria && c.altura === n.h ? 'selected' : ''}>${n.h} mm</option>`).join('');
          const dist = c.dist ? `${c.dist.d} mm<br><small style="color:var(--fraco)">${esc(c.dist.robo)}, lado ${esc(c.dist.lado)}</small>` : '—';
          let sit;
          if (!c.dist) sit = '<span class="pilula neutro">Sem robô</span>';
          else if (c.gradeOk) sit = `<span class="pilula ok">Atende</span>${c.extra ? ` <span class="pilula roxo" data-tip="A grade desta estação foi afastada além da posição proposta.">+${c.extra} mm</span>` : ''}`;
          else sit = `<span class="pilula erro" data-tip="${esc(`Faltam ${c.falta} mm entre o alcance do ${c.dist.robo} e a grade (lado ${c.dist.lado}).`)}">Faltam ${c.falta} mm</span>`;
          const acoes = !c.dist || c.gradeOk
            ? (c.extra || c.alturaPropria ? `<div class="barra"><button class="btn mini leve" data-padrao="${c.st}" data-tip="Volta esta estação para a altura padrão e para a posição de grade proposta.">Voltar ao padrão</button></div>` : '')
            : `<div class="barra">${c.resolve && c.resolve !== c.altura ? `<button class="btn mini primario" data-usar="${c.st}" data-h="${c.resolve}" data-tip="${esc(`A grade de ${c.resolve} mm pede no mínimo ${minimaDe(c.resolve)} mm, e a distância medida é ${c.dist.d} mm. Troca a altura da grade desta estação.`)}">Usar grade de ${c.resolve} mm</button>` : '<span class="pilula aviso">Nenhuma altura da tabela resolve</span>'}
               <button class="btn mini" data-afastar="${c.st}" data-tip="Afasta a grade desta estação 100 mm para fora, nos quatro lados. A célula fica maior.">Afastar 100 mm</button></div>`;
          return `<tr><td><b>ST${c.st}</b></td><td><select data-altura="${c.st}" aria-label="Altura da grade da ST${c.st}" data-tip="Altura da grade só desta estação.">${ops}</select></td>
            <td class="num">${dist}</td><td class="num">${c.dist ? c.minima + ' mm' : '—'}</td><td class="acoes">${sit}${acoes}</td></tr>`;
        }).join('');
      };

      const entrega = () => {
        const d = s.dwg, a = s.aprovacao;
        const retTxt = !s.retirada ? 'Ainda não gerado.'
          : P.retiradas.every((r) => r.ok) ? `Gerado: ${P.retiradas.length} robôs com caminho livre até o corredor${P.retiradas.some((r) => r.desvio) ? ' (alguns com desvio dentro da célula)' : ''}.`
          : `Gerado, com ${P.retiradas.filter((r) => !r.ok).length} robô(s) bloqueado(s).`;
        $('#ly-entrega', el).innerHTML = `
          <div><code>DWG</code><span>${d ? `Versão <b>${esc(d.versao)}</b> exportada às ${esc(d.hora)}${d.desatualizado ? ' · <span class="pilula aviso">desatualizado: o layout mudou depois</span>' : ''}` : 'Ainda não exportado.'}</span></div>
          <div><code>Retirada</code><span>${esc(retTxt)}</span></div>
          <div><code>Cliente</code><span>${a ? `Aprovado por <b>${esc(a.quem)}</b> em ${esc(a.quando)} (versão ${esc(a.versao)})` : 'Aguardando aprovação. Sem ela o layout fica como conceito (C).'}</span></div>`;
      };

      const checagem = () => {
        const pj = AE.calc.projeto(), oSim = ctx.origem('simulacao');
        const simOk = oSim === 'tela' && s.sim && s.sim.seq === AE.passo('simulacao').seq;
        const forasCabo = P.armarios.filter((a) => !a.pad);
        const gruposMal = P.grupos.filter((g) => g.probs.some((p) => !p.startsWith('cabo')));
        const colasMal = P.colas.filter((k) => k.probs.length);
        const gradesMal = P.cel.filter((c) => !c.gradeOk);
        const retMal = s.retirada ? P.retiradas.filter((r) => !r.ok) : [];
        const itens = [
          ['Desenho do prédio e zero predial', pj.layoutCarregado, 'aviso', 'DWG do prédio não carregado no Passo 0: pilares de exemplo'],
          ['Posição dos robôs validada pela Simulação', simOk, 'aviso', oSim === 'tela' ? 'Simulação concluída: clique em "Atualizar posições da Simulação"' : 'Simulação ainda não concluída: layout preliminar'],
          ['Cabos dentro de 7, 15 ou 20 m', !forasCabo.length, 'erro', `${forasCabo.map((a) => a.id).join(', ')} acima de 20 m: arraste os armários para mais perto`],
          ['Armários fora da grade e dos pilares', !gruposMal.length, 'erro', gruposMal.map((g) => `armários ST${g.st} ${g.probs.filter((p) => !p.startsWith('cabo')).join(' e ')}`).join('; ')],
          ['Cola: mangueira até 12 m e pedestal ao alcance', !colasMal.length, 'erro', colasMal.map((k) => `ST${k.st}: ${k.probs.join(' e ')}`).join('; ')],
          ['Grade na distância mínima em todas as estações', !gradesMal.length, 'erro', gradesMal.map((c) => `ST${c.st} (use ${c.resolve ? 'grade de ' + c.resolve + ' mm' : 'afastar a grade'})`).join(', ')],
          ['Plano de retirada de robô', !!s.retirada && !retMal.length, s.retirada ? 'erro' : 'aviso', s.retirada ? retMal.map((r) => `${r.robo.id} bloqueado por ${r.bloq}`).join('; ') : 'Ainda não gerado: use "Gerar plano de retirada"'],
          ['DWG exportado e atualizado', !!s.dwg && !s.dwg.desatualizado, 'aviso', s.dwg ? 'O layout mudou depois da exportação: exporte de novo' : 'Ainda não exportado'],
          ['Aprovação do cliente', !!s.aprovacao, 'aviso', 'Aguardando: o layout fica como conceito (C)'],
        ];
        $('#ly-check', el).innerHTML = itens.map((i) => `<div><span>${esc(i[0])}</span>${i[1] ? '<span class="pilula ok">Certo</span>' : `<span class="pilula ${i[2]}" style="white-space:normal">${esc(i[3])}</span>`}</div>`).join('');
        return itens;
      };

      const rotuloRet = () => { $('#ly-ret', el).textContent = s.retirada ? (s.verRetirada ? 'Esconder retirada' : 'Mostrar retirada') : 'Gerar plano de retirada'; };

      /* redesenho completo das partes (depois de uma ação) */
      const tudo = () => {
        P = calcular(s);
        $('#ly-planta', el).innerHTML = svgPlanta(P, s);
        faixa(); cabos(); grades(); entrega(); checagem(); rotuloRet();
      };
      /* redesenho leve, durante o arraste */
      const aoVivo = () => {
        P = calcular(s);
        $('#ly-lig', el).innerHTML = svgLigacoes(P, s);
        P.grupos.forEach((g) => { const n = $(`.ly-arr[data-arr="painel"][data-k="${g.chave}"]`, el); if (n) n.classList.toggle('alerta', g.probs.length > 0); });
        P.colas.forEach((k) => { const n = $(`.ly-arr[data-arr="cola"][data-k="${CSS.escape(k.chave)}"]`, el); if (n) n.classList.toggle('alerta', k.probs.length > 0); });
        cabos();
      };
      const mudou = () => { if (s.dwg) s.dwg.desatualizado = true; ctx.salvar(); };
      faixa(); cabos(); grades(); entrega(); checagem();

      /* ---------- arrastar (mouse, toque e teclado) ---------- */
      const posDe = (tipo, k) => {
        if (tipo === 'painel') { const g = P.grupos.find((x) => x.chave === k); return g ? { x: g.x, y: g.y } : null; }
        const c = P.colas.find((x) => x.chave === k); return c ? { x: c.x, y: c.y } : null;
      };
      const gravaPos = (tipo, k, p) => { const alvo = tipo === 'painel' ? s.paineis : s.cola; alvo[k] = { x: mm(p.x), y: mm(p.y) }; };
      const descreve = (tipo, k) => {
        if (tipo === 'painel') {
          const g = P.grupos.find((x) => x.chave === k); if (!g) return '';
          return `Armários da ST${g.st} em ${coord(g.x, g.y)} · maior cabo ${metros(Math.max(...g.arms.map((a) => a.m)))}${g.probs.length ? ' · ' + g.probs.join(', ') : ''}`;
        }
        const c = P.colas.find((x) => x.chave === k); if (!c) return '';
        return `Pedestal de cola da ST${c.st} em ${coord(c.x, c.y)} · mangueira ${metros(c.m)}${c.probs.length ? ' · ' + c.probs.join(', ') : ''}`;
      };
      const pontoSvg = (e) => {
        const sv = svgEl(), pt = sv.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const p = pt.matrixTransform(sv.getScreenCTM().inverse());
        return { x: p.x, y: -p.y };
      };
      const fimMover = (tipo, k, de) => {
        const p = posDe(tipo, k);
        if (!p || (Math.round(p.x) === Math.round(de.x) && Math.round(p.y) === Math.round(de.y))) return;
        mudou();
        ctx.registrar((tipo === 'painel' ? 'Movidos: ' : 'Movido: ') + descreve(tipo, k));
        P = calcular(s);
        grades(); entrega(); checagem();
        const it = tipo === 'painel' ? P.grupos.find((x) => x.chave === k) : P.colas.find((x) => x.chave === k);
        if (it && it.probs.length) ctx.avisa(`${tipo === 'painel' ? 'Armários da ST' + it.st : 'Pedestal de cola da ST' + it.st}: ${it.probs.join(' e ')}. Mova para outro lugar.`, { tipo: 'erro' });
      };

      let arr = null, quadro = 0;
      const planta = $('#ly-planta', el);
      planta.addEventListener('pointerdown', (e) => {
        const g = e.target.closest('.ly-arr'); if (!g || e.button > 0) return;
        e.preventDefault();
        const tipo = g.dataset.arr, k = g.dataset.k, ini = posDe(tipo, k); if (!ini) return;
        arr = { g, tipo, k, ini, p0: pontoSvg(e), id: e.pointerId };
        g.setPointerCapture(e.pointerId);
        g.classList.add('arrastando');
        g.focus({ preventScroll: true });
      });
      planta.addEventListener('pointermove', (e) => {
        if (!arr || e.pointerId !== arr.id) return;
        const p = pontoSvg(e);
        const nx = Math.round((arr.ini.x + p.x - arr.p0.x) / 100) * 100, ny = Math.round((arr.ini.y + p.y - arr.p0.y) / 100) * 100;
        gravaPos(arr.tipo, arr.k, { x: nx, y: ny });
        arr.g.setAttribute('transform', `translate(${nx},${Y(ny)})`);
        if (!quadro) quadro = requestAnimationFrame(() => { quadro = 0; if (!arr) return; aoVivo(); $('#ly-sel', el).textContent = descreve(arr.tipo, arr.k); });
      });
      const soltar = (e) => {
        if (!arr || (e && e.pointerId !== arr.id)) return;
        const a = arr; arr = null;
        a.g.classList.remove('arrastando');
        try { a.g.releasePointerCapture(a.id); } catch (_) { /* já solto */ }
        aoVivo();
        $('#ly-sel', el).textContent = descreve(a.tipo, a.k);
        fimMover(a.tipo, a.k, a.ini);
      };
      planta.addEventListener('pointerup', soltar);
      planta.addEventListener('pointercancel', soltar);

      let tTecla = null, iniTecla = null;
      planta.addEventListener('keydown', (e) => {
        const g = e.target.closest('.ly-arr'); if (!g) return;
        const passo = e.shiftKey ? 100 : 500;
        const d = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, passo], ArrowDown: [0, -passo] }[e.key];
        if (!d) return;
        e.preventDefault();
        const tipo = g.dataset.arr, k = g.dataset.k, p = posDe(tipo, k); if (!p) return;
        if (!iniTecla) iniTecla = { tipo, k, de: p };
        const nv = { x: p.x + d[0], y: p.y + d[1] };
        gravaPos(tipo, k, nv);
        g.setAttribute('transform', `translate(${mm(nv.x)},${Y(mm(nv.y))})`);
        aoVivo();
        $('#ly-sel', el).textContent = descreve(tipo, k);
        clearTimeout(tTecla);
        tTecla = setTimeout(() => { const t0 = iniTecla; iniTecla = null; if (t0) fimMover(t0.tipo, t0.k, t0.de); }, 900);
      });
      planta.addEventListener('focusin', (e) => { const g = e.target.closest('.ly-arr'); if (g) $('#ly-sel', el).textContent = descreve(g.dataset.arr, g.dataset.k); });

      /* ---------- botões da planta ---------- */
      const atualizarSim = async () => {
        if (ctx.origem('simulacao') !== 'tela') {
          ctx.avisa('A Simulação ainda não concluiu a posição dos robôs. O layout continua preliminar com as posições padrão.', { tipo: 'aviso',
            acao: AE.telas.simulacao && !AE.telas.simulacao.aFazer ? { texto: 'Abrir a Simulação', fn: () => ctx.ir('simulacao') } : null });
          return;
        }
        const movidos = (AE.espiar('simulacao') || {}).movidos || {};
        const desloc = {};
        let i = 0, maior = 0;
        P.cel.forEach((c) => c.robos.forEach((r) => {
          const d = DESL_SIM[i++ % DESL_SIM.length].slice();
          const mv = Number(movidos[r.id]) || 0; // "robô não alcança": a Simulação moveu o robô em direção à linha
          if (mv) d[1] += r.top ? -mv : mv;
          desloc[r.id] = d;
          maior = Math.max(maior, Math.abs(d[0]), Math.abs(d[1]));
        }));
        s.sim = { seq: AE.passo('simulacao').seq, hora: AE.util.hora(), desloc };
        mudou();
        ctx.registrar(`Posições dos robôs atualizadas pela Simulação: ${Object.keys(desloc).length} robôs, maior deslocamento ${maior} mm. Layout deixou de ser preliminar.`);
        tudo();
        const ruins = P.cel.filter((c) => !c.gradeOk);
        ctx.avisa(ruins.length ? `Posições aplicadas. Com os robôs nas posições da Simulação, a grade da ${ruins.map((c) => 'ST' + c.st).join(' e da ')} ficou abaixo da distância mínima: veja a tabela de grades.` : 'Posições da Simulação aplicadas. Grades, cabos e retirada conferidos de novo.', { tipo: ruins.length ? 'aviso' : 'ok' });
      };
      $('#ly-sim', el).onclick = atualizarSim;
      $('#ly-faixa', el).addEventListener('click', (e) => { if (e.target.closest('[data-acao="sim"]')) atualizarSim(); });

      $('#ly-ret', el).onclick = () => {
        if (!s.retirada) {
          s.retirada = { hora: AE.util.hora() };
          s.verRetirada = true;
          mudou();
          tudo();
          const bloq = P.retiradas.filter((r) => !r.ok), desv = P.retiradas.filter((r) => r.desvio);
          ctx.registrar(`Plano de retirada gerado: ${P.retiradas.length} robôs${desv.length ? `, ${desv.length} com desvio` : ''}${bloq.length ? `, ${bloq.length} bloqueado(s)` : ''}.`);
          ctx.avisa(bloq.length ? `Plano de retirada gerado, mas ${bloq.map((r) => r.robo.id + ' está bloqueado por ' + r.bloq).join('; ')}. Mova o item que bloqueia.`
            : `Plano de retirada gerado: cada robô tem caminho livre até o corredor.${desv.length ? ' ' + desv.map((r) => r.robo.id + ' desvia do ' + r.desvio).join('; ') + '.' : ''}`, { tipo: bloq.length ? 'erro' : 'ok' });
        } else {
          s.verRetirada = !s.verRetirada;
          ctx.salvarUI();
          $('#ly-lig', el).innerHTML = svgLigacoes(P, s);
          rotuloRet();
        }
      };

      $('#ly-repor', el).onclick = async () => {
        const n = Object.keys(s.paineis).length + Object.keys(s.cola).length;
        if (!n) { ctx.avisa('Os armários e o pedestal de cola já estão na posição proposta.'); return; }
        const ok = await ctx.perguntar({ titulo: 'Voltar à posição proposta?', texto: `${n} item(ns) movido(s) voltam para onde o programa propôs. Os cabos e a mangueira são recalculados.`, ok: 'Voltar' });
        if (!ok) return;
        s.paineis = {}; s.cola = {};
        mudou();
        ctx.registrar(`Armários e pedestal de cola voltaram à posição proposta (${n} item(ns)).`);
        tudo();
        ctx.avisa('Itens de volta à posição proposta.', { tipo: 'ok' });
      };

      /* ---------- grades ---------- */
      $('#ly-altura', el).onchange = (e) => {
        s.alturaPadrao = Number(e.target.value);
        mudou();
        ctx.registrar(`Altura padrão da grade alterada para ${s.alturaPadrao} mm.`);
        tudo();
        const ruins = P.cel.filter((c) => !c.gradeOk);
        if (ruins.length) ctx.avisa(`Com grade de ${s.alturaPadrao} mm, ${ruins.map((c) => 'ST' + c.st).join(', ')} fica${ruins.length > 1 ? 'm' : ''} abaixo da distância mínima de ${minimaDe(s.alturaPadrao)} mm.`, { tipo: 'aviso' });
      };
      const tabG = $('#ly-grades', el);
      tabG.addEventListener('change', (e) => {
        const sel = e.target.closest('[data-altura]'); if (!sel) return;
        const k = 'ST' + sel.dataset.altura, g = s.grades[k] || (s.grades[k] = {});
        if (sel.value) g.altura = Number(sel.value); else delete g.altura;
        mudou();
        ctx.registrar(`Grade da ${k}: ${sel.value ? 'altura própria de ' + sel.value + ' mm' : 'volta à altura padrão'}.`);
        tudo();
      });
      tabG.addEventListener('click', (e) => {
        const bu = e.target.closest('[data-usar]'), ba = e.target.closest('[data-afastar]'), bp = e.target.closest('[data-padrao]');
        if (bu) {
          const k = 'ST' + bu.dataset.usar; (s.grades[k] = s.grades[k] || {}).altura = Number(bu.dataset.h);
          mudou(); ctx.registrar(`Grade da ${k} trocada para ${bu.dataset.h} mm para atender a distância mínima.`); tudo();
          ctx.avisa(`Grade da ${k} agora tem ${bu.dataset.h} mm.`, { tipo: 'ok' });
        } else if (ba) {
          const k = 'ST' + ba.dataset.afastar, g = s.grades[k] || (s.grades[k] = {});
          g.extra = (Number(g.extra) || 0) + 100;
          mudou(); ctx.registrar(`Grade da ${k} afastada 100 mm (total +${g.extra} mm).`); tudo();
          const c = P.cel.find((x) => 'ST' + x.st === k);
          ctx.avisa(c && c.gradeOk ? `Grade da ${k} afastada: agora atende.` : `Grade da ${k} afastada 100 mm. Ainda faltam ${c ? c.falta : '?'} mm.`, { tipo: c && c.gradeOk ? 'ok' : 'aviso' });
        } else if (bp) {
          const k = 'ST' + bp.dataset.padrao; delete s.grades[k];
          mudou(); ctx.registrar(`Grade da ${k} voltou ao padrão.`); tudo();
        }
      });

      /* ---------- entrega ---------- */
      $('#ly-dwg', el).onclick = async (e) => {
        const b = e.currentTarget, t = ctx.termos(), pj = AE.calc.projeto();
        let versao, motivo = '';
        if (s.aprovacao) {
          const nF = (s.dwg && /^F(\d+)$/.test(s.dwg.versao) ? Number(s.dwg.versao.slice(1)) : 1) + 1;
          motivo = await ctx.perguntar({ titulo: `Exportar a versão F${nF}?`, texto: 'O layout já foi aprovado pelo cliente. Uma exportação nova cria uma versão final nova e precisa do motivo.', campo: 'Motivo da mudança', ok: `Exportar F${nF}` });
          if (!motivo) return;
          versao = 'F' + nF;
        } else {
          const nC = s.dwg && /^C(\d+)$/.test(s.dwg.versao) ? Number(s.dwg.versao.slice(1)) + 1 : 1;
          versao = 'C' + nC;
        }
        const nome = `Layout_${String(pj.nome || 'projeto').replace(/[^\w-]+/g, '_')}_${versao}.dwg`;
        const ok = await ctx.cad({
          titulo: `Exportar layout em DWG (${versao})`,
          catia: `Set doc = CATIA.Documents.Add("Drawing")   ' folha do layout, origem no zero predial\nSet vista = doc.Sheets.ActiveSheet.Views.Add("Layout")\n' camadas: PILARES, GRADE, ARMARIOS, CABOS, RETIRADA (geradas da planta)\ndoc.ExportData pasta & "\\14.2.1_Layout\\${nome}", "dwg"`,
          nx: `var dxf = theSession.DexManager.CreateDxfdwgCreator();\ndxf.ExportFrom = DxfdwgCreator.ExportFromOption.Drawing;\ndxf.OutputFileType = DxfdwgCreator.OutputFileTypeOption.Dwg;\ndxf.OutputFile = pasta + @"\\14.2.1_Layout\\${nome}";\ndxf.Commit(); dxf.Destroy();`,
          macro: 'Nenhuma na v0: rotina de exportação a definir',
          resultado: `${nome} salvo em 14.2.1_Layout: ${P.cel.length} células, ${P.armarios.length} armários, ${s.retirada ? 'com' : 'sem'} plano de retirada.`,
        }, b);
        if (!ok) return;
        s.dwg = { versao, hora: AE.util.hora(), arquivo: nome, desatualizado: false };
        ctx.salvar();
        ctx.registrar(`Layout exportado em DWG, versão ${versao}${motivo ? '. Motivo: ' + motivo : ''}.`);
        entrega(); checagem();
        ctx.avisa(`${nome} salvo na pasta 14.2.1_Layout. ${t.nome === 'NX' ? 'Exportado do Drawing do NX.' : 'Exportado do CATDrawing.'}`, { tipo: 'ok' });
      };
      $('#ly-aprov', el).onclick = async () => {
        if (!s.dwg) { ctx.avisa('Exporte o DWG antes: a aprovação do cliente vale para uma versão do arquivo.', { tipo: 'aviso' }); return; }
        if (s.dwg.desatualizado) { ctx.avisa('O layout mudou depois da última exportação. Exporte de novo para o cliente aprovar a versão certa.', { tipo: 'aviso' }); return; }
        if (s.aprovacao && s.aprovacao.versao === s.dwg.versao) { ctx.avisa(`A versão ${s.dwg.versao} já está aprovada por ${s.aprovacao.quem}.`); return; }
        const quem = await ctx.perguntar({ titulo: 'Aprovação do cliente', texto: `Versão ${s.dwg.versao} do layout. Informe quem aprovou no cliente (área ou cargo). A data e a hora são registradas agora.`, campo: 'Quem aprovou', valor: 'Engenharia de manufatura do cliente', ok: 'Registrar aprovação' });
        if (!quem) return;
        const de = s.dwg.versao;
        if (/^C/.test(de)) s.dwg.versao = 'F1';
        s.aprovacao = { quem, quando: `${new Date().toLocaleDateString('pt-BR')} ${AE.util.hora()}`, versao: s.dwg.versao };
        ctx.salvar();
        ctx.registrar(`Layout aprovado pelo cliente (${quem}): versão ${de}${de !== s.dwg.versao ? ' vira ' + s.dwg.versao : ''}.`);
        entrega(); checagem();
        ctx.avisa(`Aprovação registrada. O layout agora é a versão final ${s.dwg.versao}.`, { tipo: 'ok' });
      };

      /* ---------- concluir ---------- */
      $('#ly-concluir', el).onclick = () => {
        P = calcular(s);
        const itens = checagem();
        const ruim = itens.find((i) => !i[1] && i[2] === 'erro');
        if (ruim) { ctx.avisa(`Não dá para concluir: ${ruim[0].toLowerCase()} (${ruim[3]}).`, { tipo: 'erro' }); return; }
        if (!s.retirada) { ctx.avisa('Gere o plano de retirada de robô antes de concluir: ele faz parte da entrega.', { tipo: 'erro' }); return; }
        if (!s.dwg || s.dwg.desatualizado) { ctx.avisa(s.dwg ? 'O layout mudou depois da exportação. Exporte o DWG de novo antes de concluir.' : 'Exporte o DWG antes de concluir: ele é a entrega deste passo.', { tipo: 'erro' }); return; }
        const nR = P.armarios.length;
        ctx.concluir({
          registro: `Layout concluído: ${P.cel.length} estações, ${nR} robôs, DWG ${s.dwg.versao}${s.aprovacao ? ` aprovado (${s.aprovacao.quem})` : ', conceito aguardando aprovação do cliente'}`,
        });
      };
    },
  });
})();
