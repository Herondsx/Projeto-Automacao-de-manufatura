/* Automação de Engenharia · dados de exemplo e cálculos compartilhados
   ---------------------------------------------------------------------------
   Tudo aqui é DADO DE EXEMPLO: um produto fictício de 6 peças, com pontos de solda gerados
   de forma determinística, para o protótipo ter números coerentes de ponta a ponta.

   AE.calc.* são as "saídas" de cada passo que outros passos consomem. Cada função:
   - lê a fatia da tela dona (AE.estado.t[id]) quando ela existe;
   - senão calcula um VALOR DE RESERVA a partir das entradas dela (regra do fluxo:
     entrada que não chegou não trava o passo, só deixa a saída preliminar). */
(function () {
  'use strict';
  const AE = window.AE;
  const { clone } = AE.util;
  const r1 = (v) => Math.round(v * 10) / 10;
  const pad = (n, k) => String(n).padStart(k, '0');
  /* pseudoaleatório determinístico (mesmo resultado em toda abertura) */
  const ruido = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

  /* ======================= clientes ======================= */
  const clientes = {
    Volkswagen: { sigla: 'VW', plano: 'vw', planoNome: 'RPS', catalogo: 'comau', espessura: 20, calco: 5, fabGrampo: 'Tünkers',
      nomeArquivo: '<nº dispositivo>_<posição 4 dígitos>_<revisão>_<DENOMINAÇÃO>', exemploArquivo: 'D-1310_0005_A00_CONSOLE' },
    'General Motors': { sigla: 'GM', plano: 'gm', planoNome: 'Datum', catalogo: 'naams', espessura: 20, calco: 5, fabGrampo: 'Tünkers',
      nomeArquivo: '<projeto>-<estação>-<unidade>-<detalhe>', exemploArquivo: 'PRJ-ST10-U01-003' },
    Stellantis: { sigla: 'STLA', plano: 'st', planoNome: 'pré-método', catalogo: 'comau', espessura: 20, calco: 5, fabGrampo: 'Tünkers',
      nomeArquivo: '<projeto>_<estação>_<posição>_<descrição>', exemploArquivo: 'PRJ_ST10_0005_CONSOLE' },
    Peugeot: { sigla: 'PSA', plano: 'st', planoNome: 'pré-método', catalogo: 'comau', espessura: 19, calco: 5, fabGrampo: 'SMC',
      nomeArquivo: '<projeto>_<estação>_<posição>_<descrição>', exemploArquivo: 'PRJ_ST10_0005_CONSOLE' },
    Ford: { sigla: 'FORD', plano: 'gm', planoNome: 'Datum', catalogo: 'naams', espessura: 20, calco: 5, fabGrampo: 'Tünkers',
      nomeArquivo: '<projeto>-<estação>-<unidade>-<detalhe>', exemploArquivo: 'PRJ-ST10-U01-003' },
    Outro: { sigla: '—', plano: 'vw', planoNome: 'a definir', catalogo: 'comau', espessura: 20, calco: 5, fabGrampo: 'Tünkers',
      nomeArquivo: 'padrão do programa', exemploArquivo: 'PRJ_ST10_U01_0005' },
  };

  /* estrutura de pastas padrão do programa (a do Bruno na v0) */
  const pastas = [
    { cod: '14.2.1_Layout', o: 'Layout, grades, calhas, armários, fundação' },
    { cod: '14.2.3_MTM', o: 'Estudo do operador' },
    { cod: '14.2.3.1_Ciclograma', o: 'Macro ciclo e ciclograma' },
    { cod: '14.2.10_Plano de Pontos', o: 'Um arquivo por estação', porEstacao: true },
    { cod: '14.2.14_Plano de Cola', o: 'Um arquivo por aplicador' },
    { cod: '14.2.23_Folha de Instrução', o: 'Uma folha por estação e por robô', porEstacao: true },
    { cod: '14.3_Mecânica', o: 'Dispositivos e garras: montagem, detalhes, listas, cálculos', porEstacao: true },
    { cod: '14.4_Simulação', o: 'Estudos, nuvem de pinças, vídeos' },
    { cod: '14.6_Ergonomia', o: 'Apresentação para aprovação' },
  ];

  /* ======================= produto de exemplo ======================= */
  /* geometria = os mesmos desenhos da v0 (vista simplificada do CAD) */
  const pecas = [
    { id: 'A', nome: 'Painel interno', d: 'M40 120 L250 96 L250 190 L40 214 Z', lx: 135, ly: 162, esp: 0.8 },
    { id: 'B', nome: 'Reforço da coluna', d: 'M258 95 L480 70 L480 164 L258 189 Z', lx: 362, ly: 136, esp: 1.2 },
    { id: 'C', nome: 'Longarina', d: 'M60 222 L250 198 L250 262 L60 286 Z', lx: 148, ly: 250, esp: 1.5 },
    { id: 'D', nome: 'Travessa', d: 'M258 197 L460 173 L460 237 L258 261 Z', lx: 352, ly: 224, esp: 1.2 },
    { id: 'E', nome: 'Suporte superior', d: 'M120 52 L230 40 L230 88 L120 100 Z', lx: 168, ly: 76, esp: 1.0 },
    { id: 'F', nome: 'Conjunto do para-lama (chega soldado)', d: 'M300 36 L410 24 L410 62 L300 74 Z', lx: 348, ly: 55, esp: 0.7 },
  ];
  /* cada junção gera `qtd` pontos ao longo do segmento de -> ate (coordenadas do desenho) */
  const juncoes = [
    { pecas: ['A', 'C'], qtd: 16, de: [66, 216], ate: [244, 195] },
    { pecas: ['A', 'E'], qtd: 8, de: [128, 104], ate: [224, 93] },
    { pecas: ['A', 'B'], qtd: 10, de: [254, 104], ate: [254, 184] },
    { pecas: ['B', 'D'], qtd: 14, de: [266, 192], ate: [452, 170], divergente: 9 },
    { pecas: ['C', 'D'], qtd: 6, de: [254, 206], ate: [254, 254] },
    { pecas: ['B', 'F'], qtd: 8, de: [306, 81], ate: [404, 70] },
    { pecas: ['A', 'B', 'E'], qtd: 2, de: [237, 93], ate: [245, 92] },
    { pecas: ['F'], qtd: 6, de: [312, 50], ate: [398, 40], interno: true }, // pontos de dentro do conjunto que já chega soldado
  ];
  const pontos = [];
  juncoes.forEach((j, ji) => {
    for (let k = 0; k < j.qtd; k++) {
      const t = j.qtd === 1 ? 0.5 : k / (j.qtd - 1);
      const sx = j.de[0] + (j.ate[0] - j.de[0]) * t, sy = j.de[1] + (j.ate[1] - j.de[1]) * t;
      const i = pontos.length;
      const geo = j.interno ? 2 : j.pecas.length;
      pontos.push({
        n: `P${pad(ji + 1, 4)}_${j.pecas.join('')}_${pad(k + 1, 3)}`,
        juncao: ji, pecas: j.pecas.slice(), interno: !!j.interno,
        /* coordenadas do carro em mm, como o cliente manda (com casas decimais) */
        xc: r1(620 + sx * 4.6 + ruido(i) * 0.9), yc: r1(-612 - sy * 0.21 - ruido(i + 7) * 0.9), zc: r1(1235 - sy * 3.05 + ruido(i + 3) * 0.9),
        chapasGeo: geo, chapasCliente: j.divergente === k ? geo + 1 : geo,
        sx: Math.round(sx * 10) / 10, sy: Math.round(sy * 10) / 10,
        geometria: k === 0 || k === j.qtd - 1, // as pontas de cada junção servem de ponto de geometria
      });
    }
  });
  /* conteúdo do produto além dos pontos (para a checagem de cobertura do passo 6.1) */
  const conteudo = [
    { id: 'solda', item: 'Pontos de solda', qtd: '64 pontos', equip: 'pinca', op: 'Soldar', exige: 'Pinça com fresa, e a operação de soldar' },
    { id: 'cola', item: 'Cordão de cola', qtd: '2,4 m', equip: 'cola', op: 'Passar cola', exige: 'Aplicador ou pedestal, bomba de cola, e a operação de passar cola' },
    { id: 'pino', item: 'Pinos (tucker)', qtd: '4 pinos', equip: 'pino', op: 'Aplicar pino', exige: 'Pistola de pinos com alimentador, e a operação de aplicar' },
    { id: 'furo', item: 'Furação', qtd: '2 furos', equip: 'furacao', op: 'Furar', exige: 'Equipamento de furação, e a operação de furar' },
    { id: 'mig', item: 'Solda MIG', qtd: '1 cordão de 80 mm', equip: 'mig', op: 'Soldar MIG', exige: 'Tocha com fonte, e a operação de soldar' },
  ];

  /* ======================= tempos de referência ======================= */
  /* usados quando o cliente não manda a tabela dele (regra do passo 2) */
  const tempos = [
    { id: 'solda', op: 'Ponto de solda a robô (fechar pinça, soldar, abrir)', seg: 2.4, un: 's por ponto' },
    { id: 'aproximacao', op: 'Movimento entre pontos (aproximação)', seg: 0.8, un: 's por ponto' },
    { id: 'trocaPinca', op: 'Troca de pinça no trocador automático', seg: 8.0, un: 's por troca' },
    { id: 'dispositivo', op: 'Fechar e abrir os grampos do dispositivo', seg: 4.0, un: 's por ciclo' },
    { id: 'transferencia', op: 'Transferência do produto entre estações', seg: 9.0, un: 's por ciclo' },
    { id: 'seguranca', op: 'Folga do robô para entrar e sair da zona', seg: 3.0, un: 's por ciclo' },
    { id: 'cargaManual', op: 'Carga manual de uma peça pelo operador (MTM)', seg: 6.5, un: 's por peça', mtm: true },
    { id: 'cola', op: 'Cordão de cola a robô', seg: 5.0, un: 's por metro' },
    { id: 'pino', op: 'Aplicação de pino (tucker)', seg: 3.5, un: 's por pino' },
  ];

  /* ======================= bibliotecas de exemplo ======================= */
  const robos = [
    { modelo: 'Robô de solda 210 kg · alcance 2700 mm', payload: 210, alcance: 2700 },
    { modelo: 'Robô de solda 165 kg · alcance 2650 mm', payload: 165, alcance: 2650 },
    { modelo: 'Robô de manuseio 300 kg · alcance 2500 mm', payload: 300, alcance: 2500 },
  ];
  const pincas = [
    { modelo: 'Pinça servo tipo X · braço 600 mm', tipo: 'X', forca: 4.5, peso: 95 },
    { modelo: 'Pinça servo tipo C · garganta 350 mm', tipo: 'C', forca: 5.5, peso: 88 },
    { modelo: 'Pinça servo tipo X longa · braço 900 mm', tipo: 'X', forca: 3.8, peso: 112 },
  ];

  AE.dados = { clientes, pastas, produto: { nome: 'Lateral dianteira (exemplo)', pecas, juncoes, pontos, conteudo }, tempos, robos, pincas };

  /* ======================= cálculos compartilhados ======================= */
  const C = AE.calc;
  const fat = (id) => AE.estado.t[id];

  /* Passo 0 → projeto, modelos e ciclo */
  C.projeto = () => {
    const s = AE.espiar('inicio') || {};
    const disp = Number(s.disp) || 85, turnos = Number(s.turnos) || 2, horas = Number(s.horas) || 7.54;
    const modelos = (s.modelos || []).map((m) => {
      const jph = Number(m.jph) || 0;
      const ciclo = jph > 0 ? (3600 / jph) * disp / 100 : 0;
      const diaCalc = jph * turnos * horas;
      const fecha = Math.abs(diaCalc - (Number(m.dia) || 0)) <= Math.max(1, (Number(m.dia) || 0) * 0.01);
      const adotado = m.adotado === '' || m.adotado == null ? ciclo : Number(m.adotado);
      return Object.assign({}, m, { jph, ciclo, diaCalc, fecha, adotadoEfetivo: adotado });
    });
    const validos = modelos.filter((m) => m.jph > 0);
    /* dimensiona pelo modelo mais exigente (menor ciclo). Em aberto: linha mista soma os volumes? */
    const cicloAlvo = validos.length ? Math.min(...validos.map((m) => m.adotadoEfetivo)) : 60;
    const cli = clientes[s.cliente] || clientes.Volkswagen;
    return Object.assign({}, s, { disp, turnos, horas, modelos, cicloAlvo, padrao: cli, cliente: s.cliente || 'Volkswagen', nome: s.nome || 'Linha de exemplo' });
  };

  /* Passo 1 → subdivisões e pontos com a estação de cada um */
  const SUBS_RESERVA = [
    { id: 1, st: 10, nome: 'Painel + longarina + suporte', pecas: ['A', 'C', 'E'] },
    { id: 2, st: 20, nome: 'Reforço + travessa', pecas: ['B', 'D'] },
  ];
  /* opts.proprio: a própria tela do Passo 1 quer ver o estado em edição (BY marcado, subdivisões parciais).
     Os outros passos usam a reserva enquanto não existir nenhuma subdivisão criada. */
  C.separacao = (opts = {}) => {
    const s = fat('separacao');
    const usaReserva = !(opts.proprio && s) && !(s && s.subs && s.subs.length);
    const subs = usaReserva ? SUBS_RESERVA : s.subs || [];
    const by = usaReserva ? ['F'] : s.by || [];
    const correcoes = (s && s.correcoes) || {};
    const stJuncao = subs.length ? Math.max(...subs.map((x) => x.st)) + 10 : 10;
    const lista = pontos.map((p) => {
      const c = correcoes[p.n] || {};
      const semBy = p.pecas.filter((x) => !by.includes(x));
      const foraDoCiclo = p.interno || semBy.length === 0;
      let sub = null, st = null, entre = false;
      if (!foraDoCiclo) {
        sub = subs.find((x) => semBy.every((pc) => x.pecas.includes(pc))) || null;
        if (sub) st = sub.st; else { entre = semBy.some((pc) => subs.some((x) => x.pecas.includes(pc))); st = stJuncao; }
      }
      if (c.st) st = c.st;
      return Object.assign({}, p, { x: Math.round(p.xc), y: Math.round(p.yc), z: Math.round(p.zc), by: foraDoCiclo, st, sub: sub ? sub.id : null, entre,
        chapas: c.chapas || p.chapasGeo, corrigido: !!(c.chapas || c.st) });
    });
    const soltas = pecas.filter((pc) => !by.includes(pc.id) && !subs.some((x) => x.pecas.includes(pc.id))).map((pc) => pc.id);
    return { subs, by, stJuncao, pontos: lista, soltas, reserva: usaReserva };
  };

  /* Passo 2 → tempos padrão do projeto */
  C.tempos = () => {
    const s = fat('tempos');
    const itens = s && s.itens && s.itens.length ? s.itens : tempos.map((t) => Object.assign({ fonte: 'referencia' }, t));
    const porId = {};
    itens.forEach((t) => (porId[t.id] = Number(t.seg) || 0));
    tempos.forEach((t) => { if (porId[t.id] == null) porId[t.id] = t.seg; });
    return { itens, porId };
  };

  /* Passo 4 → estações e robôs necessários */
  C.estacoes = () => {
    const pj = C.projeto(), sep = C.separacao(), tp = C.tempos().porId;
    const s = fat('estacoes') || {};
    const maxRobos = Number(s.maxRobos) || 4;
    const ajustes = s.ajustes || {};
    const ciclo = pj.cicloAlvo;
    const tPonto = tp.solda + tp.aproximacao;
    const base = {};
    sep.pontos.filter((p) => !p.by).forEach((p) => {
      const b = base[p.st] || (base[p.st] = { st: p.st, pontos: [], tipo: 'sub' });
      b.pontos.push(p);
    });
    const est = Object.values(base).sort((a, b) => a.st - b.st).map((b) => {
      const sub = sep.subs.find((x) => x.st === b.st);
      const manual = !!sub; // subconjunto: o operador carrega as peças
      const carga = manual ? sub.pecas.filter((pc) => !sep.by.includes(pc)).length * tp.cargaManual : 0;
      const disponivel = ciclo - tp.transferencia - tp.dispositivo - tp.seguranca - carga;
      const porRobo = Math.max(0, Math.floor(disponivel / tPonto));
      return { st: b.st, nome: sub ? sub.nome : 'Junção dos subconjuntos (geometria)', tipo: sub ? 'sub' : 'juncao', manual, carga, disponivel, porRobo, pontos: b.pontos };
    });
    /* estação que não fecha com o máximo de robôs: o que sobra vai para uma estação de respot */
    const final = [];
    let proxSt = (est.length ? Math.max(...est.map((e) => e.st)) : 0) + 10;
    est.forEach((e) => {
      const precisa = e.porRobo ? Math.ceil(e.pontos.length / e.porRobo) : Infinity;
      if (precisa <= maxRobos) { final.push(Object.assign(e, { robosCalc: precisa })); return; }
      const cabe = e.porRobo * maxRobos;
      const geo = e.pontos.filter((p) => p.geometria), resto = e.pontos.filter((p) => !p.geometria);
      const fica = geo.concat(resto.slice(0, Math.max(0, cabe - geo.length)));
      const sai = e.pontos.filter((p) => !fica.includes(p));
      final.push(Object.assign(e, { pontos: fica, robosCalc: maxRobos, dividida: true }));
      const disp = ciclo - tp.transferencia - tp.dispositivo - tp.seguranca;
      const por = Math.max(1, Math.floor(disp / tPonto));
      final.push({ st: proxSt, nome: `Respot de ST${e.st}`, tipo: 'respot', manual: false, carga: 0, disponivel: disp, porRobo: por, pontos: sai, robosCalc: Math.ceil(sai.length / por), origem: e.st });
      proxSt += 10;
    });
    final.forEach((e) => {
      const aj = ajustes['ST' + e.st];
      e.robos = aj && aj.robos != null ? Number(aj.robos) : e.robosCalc;
      e.nPontos = e.pontos.length;
      e.capacidade = e.robos * e.porRobo;
      e.ok = e.robos > 0 && e.capacidade >= e.nPontos && e.robos <= maxRobos;
      e.tempoSolda = e.robos ? Math.ceil(e.nPontos / e.robos) * tPonto : Infinity;
      e.tempoTotal = tp.transferencia + tp.dispositivo + tp.seguranca + e.carga + e.tempoSolda;
    });
    return { ciclo, maxRobos, tPonto, estacoes: final, totalRobos: final.reduce((a, e) => a + e.robos, 0), totalPontos: final.reduce((a, e) => a + e.nPontos, 0), reserva: !fat('estacoes') };
  };

  /* Passo 5 → equipamentos por estação. Fatia: {itens:[{id, st, tipo, modelo, qtd, origem, obs}]} */
  C.equipamentos = () => {
    const s = fat('equipamentos');
    if (s && s.itens && s.itens.length) return { itens: s.itens, reserva: false };
    const ee = C.estacoes(), pj = C.projeto();
    const exist = pj.tipoLinha === 'retooling';
    const itens = [];
    let n = 1;
    const add = (o) => itens.push(Object.assign({ id: 'E' + n++, qtd: 1, origem: exist && (o.tipo === 'pinca' || o.tipo === 'robo') ? 'existente' : 'nova', obs: '' }, o));
    ee.estacoes.forEach((e) => {
      add({ st: e.st, tipo: 'robo', modelo: robos[0].modelo, qtd: e.robos });
      add({ st: e.st, tipo: 'pinca', modelo: pincas[0].modelo, qtd: e.robos });
      add({ st: e.st, tipo: 'dispositivo', modelo: `Dispositivo de ${e.tipo === 'sub' ? 'subconjunto' : e.tipo === 'juncao' ? 'geometria' : 'respot'}` });
      if (e.manual) add({ st: e.st, tipo: 'operador', modelo: 'Posto do operador com cortina de luz' });
    });
    const st1 = ee.estacoes[0] ? ee.estacoes[0].st : 10, st2 = ee.estacoes[1] ? ee.estacoes[1].st : st1, stJ = ee.estacoes.find((e) => e.tipo === 'juncao');
    add({ st: st2, tipo: 'cola', modelo: 'Pedestal de cola com bomba' });
    add({ st: stJ ? stJ.st : st1, tipo: 'pino', modelo: 'Pistola de pinos com alimentador' });
    add({ st: st1, tipo: 'mig', modelo: 'Tocha MIG com fonte' });
    return { itens, reserva: true };
  };

  /* Passo 6.1 → cobertura do produto (o que o produto pede existe no processo?) */
  C.cobertura = () => {
    const eq = C.equipamentos().itens;
    return conteudo.map((c) => {
      const tem = eq.filter((i) => i.tipo === c.equip);
      return Object.assign({}, c, { coberto: tem.length > 0, onde: tem.map((i) => 'ST' + i.st).filter((v, i, a) => a.indexOf(v) === i) });
    });
  };

  /* Passo 6 → robôs, capacidade e macro ciclo */
  C.capacidade = () => {
    const ee = C.estacoes(), tp = C.tempos().porId;
    const sim = fat('simulacao');
    const robosL = [];
    const estacoes = ee.estacoes.map((e) => {
      const ids = Array.from({ length: e.robos }, (_, i) => `ST${e.st}-R${i + 1}`);
      const atrib = {};
      ids.forEach((id) => (atrib[id] = []));
      e.pontos.forEach((p, i) => {
        const daSim = sim && sim.distribuicao ? Object.keys(sim.distribuicao).find((r) => sim.distribuicao[r].includes(p.n)) : null;
        const alvo = daSim && atrib[daSim] ? daSim : ids[Math.floor(i / Math.max(1, Math.ceil(e.pontos.length / ids.length)))] || ids[ids.length - 1];
        if (alvo) atrib[alvo].push(p.n);
      });
      ids.forEach((id) => robosL.push({ id, st: e.st, cap: e.porRobo, pontos: atrib[id], ocup: e.porRobo ? atrib[id].length / e.porRobo : 1 }));
      const maxPts = ids.length ? Math.max(...ids.map((id) => atrib[id].length)) : e.nPontos;
      const blocos = [];
      let t = 0;
      const bl = (op, dur, tipo) => { blocos.push({ op, ini: t, dur, tipo }); t += dur; };
      bl('Transferência', tp.transferencia, 'transf');
      if (e.carga) bl('Carga manual', e.carga, 'manual');
      bl('Fechar grampos', tp.dispositivo / 2, 'disp');
      const iniSolda = t;
      ids.forEach((id) => blocos.push({ op: `${id}: ${atrib[id].length} pontos`, ini: iniSolda, dur: atrib[id].length * (tp.solda + tp.aproximacao), tipo: 'solda', robo: id }));
      t = iniSolda + maxPts * (tp.solda + tp.aproximacao);
      bl('Abrir grampos', tp.dispositivo / 2, 'disp');
      bl('Saída do robô da zona', tp.seguranca, 'seg');
      return { st: e.st, nome: e.nome, total: t, ok: t <= ee.ciclo, blocos, robos: ids };
    });
    return { ciclo: ee.ciclo, estacoes, robos: robosL };
  };

  /* Simulação → distribuição dos pontos e nuvem de pinças.
     Fatia: {distribuicao:{'ST10-R1':['P0001_AC_001',…]}, semAcesso:[nomes], nuvem:{entregue, versao}} */
  C.simulacao = () => {
    const s = fat('simulacao') || {};
    const cap = C.capacidade();
    const dist = {};
    cap.robos.forEach((r) => (dist[r.id] = r.pontos.slice()));
    return { distribuicao: s.distribuicao || dist, semAcesso: s.semAcesso || [], nuvem: s.nuvem || { entregue: false, versao: null }, reserva: !fat('simulacao') };
  };

  /* lista de estações para os seletores (Mecânica etc.) */
  C.listaEstacoes = () => C.estacoes().estacoes.map((e) => ({ st: e.st, rotulo: `ST${e.st} · ${e.nome}` }));

  AE.dados.clone = clone;
})();
