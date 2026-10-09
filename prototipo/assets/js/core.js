/* Automação de Engenharia · núcleo do protótipo
   ---------------------------------------------------------------------------
   Sem build e sem framework: scripts clássicos, para abrir direto do disco (file://)
   ou pelo GitHub Pages. Cada tela fica em assets/js/telas/<id>.js e se registra com
   AE.tela({...}). O contrato completo está em docs/prototipo.md.

   O que este arquivo faz:
   - guarda o estado do projeto no navegador (localStorage), com exportar/importar;
   - controla a situação de cada passo (pendente, em andamento, concluído, preliminar,
     desatualizado) a partir do grafo de entradas declarado por cada tela;
   - simula a conversa com o CAD (CATIA ou NX) e registra cada comando no console;
   - desenha a moldura da tela (título, entradas, rodapé, coluna do programador);
   - balão "o que executa", avisos, janela de pergunta e rotas por #/id. */
(function () {
  'use strict';
  const AE = (window.AE = window.AE || {});

  /* ======================= utilidades ======================= */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC[c]);
  const mm = (v) => Math.round(Number(v) || 0); // coordenada: sempre milímetro inteiro
  const fmt = (v, casas = 1) =>
    Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const hora = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  AE.util = { $, $$, esc, mm, fmt, clone, espera, hora };

  /* estilos próprios de uma tela, injetados uma única vez */
  const cssFeitos = new Set();
  AE.css = (id, texto) => {
    if (cssFeitos.has(id)) return;
    cssFeitos.add(id);
    const st = document.createElement('style');
    st.dataset.tela = id;
    st.textContent = texto;
    document.head.appendChild(st);
  };

  /* ======================= eventos ======================= */
  const ouvintes = {};
  AE.on = (ev, fn) => (ouvintes[ev] = ouvintes[ev] || []).push(fn);
  AE.emitir = (ev, d) => (ouvintes[ev] || []).forEach((fn) => { try { fn(d); } catch (e) { console.error(e); } });

  /* ======================= registro de telas ======================= */
  AE.telas = {};
  AE.tela = (def) => {
    def.entradas = def.entradas || [];
    AE.telas[def.id] = def;
  };
  AE.calc = AE.calc || {};

  /* ======================= estado ======================= */
  const CHAVE = 'ae-prototipo-v1';
  const novoEstado = () => ({
    versao: 1, seq: 0,
    cad: { sistema: 'catia', conectado: true },
    ui: { prog: true },
    passos: {}, t: {}, historico: [], cadLog: [],
  });
  function lerSalvo() {
    try {
      const s = localStorage.getItem(CHAVE);
      if (s) {
        const e = JSON.parse(s);
        if (e && e.versao === 1 && e.t && e.passos) return Object.assign(novoEstado(), e);
      }
    } catch (_) { /* navegador sem armazenamento: segue só na memória */ }
    return novoEstado();
  }
  AE.estado = lerSalvo();
  AE.salvar = () => {
    try { localStorage.setItem(CHAVE, JSON.stringify(AE.estado)); } catch (_) { /* idem */ }
    AE.emitir('mudou');
  };
  AE.resetar = () => {
    try { localStorage.removeItem(CHAVE); } catch (_) {}
    AE.estado = novoEstado();
    AE.emitir('mudou');
  };

  /* fatia da tela: dados que só ela grava. Criada a partir de def.inicial() na primeira vez. */
  AE.fatia = (id) => {
    const e = AE.estado;
    if (!e.t[id]) {
      const d = AE.telas[id];
      e.t[id] = d && d.inicial ? d.inicial() : {};
    }
    return e.t[id];
  };
  /* lê a fatia de outra tela sem criá-la (devolve o valor inicial se ainda não existe) */
  AE.espiar = (id) => {
    if (AE.estado.t[id]) return AE.estado.t[id];
    const d = AE.telas[id];
    return d && d.inicial ? d.inicial() : null;
  };
  AE.temFatia = (id) => !!AE.estado.t[id];

  AE.registrar = (texto, tela) => {
    AE.estado.historico.unshift({ hora: hora(), tela: tela || AE.atual || '', texto });
    AE.estado.historico.length = Math.min(AE.estado.historico.length, 200);
  };

  /* ======================= situação dos passos ======================= */
  const CONCLUIDOS = ['concluido', 'preliminar'];
  AE.passo = (id) => AE.estado.passos[id] || { status: 'pendente' };
  AE.concluido = (id) => CONCLUIDOS.includes(AE.passo(id).status);
  /* de onde vem a entrada fornecida pelo passo `id`:
     'tela' = passo concluído; 'andamento' = valor parcial; 'reserva' = nada ainda (usa o padrão) */
  AE.origem = (id) => {
    if (AE.concluido(id)) return 'tela';
    if (AE.passo(id).status === 'andamento') return 'andamento';
    return 'reserva';
  };
  /* passos de entrada que mudaram depois que `id` foi concluído */
  AE.desatualizado = (id) => {
    if (!AE.concluido(id)) return [];
    const p = AE.passo(id);
    const deps = [...new Set((AE.telas[id]?.entradas || []).map((x) => x.de))];
    return deps.filter((d) => AE.concluido(d) && AE.passo(d).seq > p.seq);
  };
  AE.statusVisivel = (id) => {
    const d = AE.telas[id];
    if (!d || d.aFazer) return 'afazer';
    if (AE.desatualizado(id).length) return 'desatualizado';
    return AE.passo(id).status;
  };
  AE.marcarAndamento = (id) => {
    const p = AE.passo(id);
    if (p.status === 'pendente') AE.estado.passos[id] = { status: 'andamento' };
    else if (CONCLUIDOS.includes(p.status)) {
      AE.estado.passos[id] = Object.assign({}, p, { status: 'andamento', alterado: true });
      AE.registrar('Alterado depois de concluído: precisa concluir de novo para avisar os passos seguintes.', id);
    }
  };
  AE.concluir = (id, opts = {}) => {
    const def = AE.telas[id];
    const faltam = (def.entradas || []).filter((x) => AE.origem(x.de) !== 'tela');
    const preliminar = opts.preliminar != null ? opts.preliminar : faltam.length > 0;
    AE.estado.seq += 1;
    AE.estado.passos[id] = { status: preliminar ? 'preliminar' : 'concluido', seq: AE.estado.seq, hora: hora() };
    AE.registrar(
      (opts.registro || `${def.rotulo} concluído`) + (preliminar ? ' · saída PRELIMINAR (entradas de reserva)' : ''), id);
    AE.salvar();
    const prox = proximo(id);
    AE.avisa(
      opts.mensagem ||
        `${def.rotulo} · ${def.titulo} ${preliminar ? 'concluído como PRELIMINAR: alguma entrada ainda usa o valor de reserva.' : 'concluído.'}`,
      { tipo: preliminar ? 'aviso' : 'ok', acao: prox && !opts.semProximo ? { texto: `Ir para ${AE.telas[prox].rotulo}`, fn: () => AE.ir(prox) } : null });
    return preliminar;
  };

  /* ======================= CAD simulado ======================= */
  const TERMOS = {
    catia: { nome: 'CATIA', versao: 'CATIA V5', product: 'Product', part: 'CATPart', desenho: 'CATDrawing', macro: 'macro (VBA/CATScript via COM)' },
    nx: { nome: 'NX', versao: 'Siemens NX', product: 'Assembly', part: 'part (.prt)', desenho: 'Drawing (.prt)', macro: 'journal NXOpen (C#/Python)' },
  };
  AE.termos = () => TERMOS[AE.estado.cad.sistema] || TERMOS.catia;
  function logCad(acao, erro) {
    const sis = AE.estado.cad.sistema;
    AE.estado.cadLog.unshift({
      hora: hora(), sistema: TERMOS[sis].nome, titulo: acao.titulo || 'Comando',
      codigo: erro ? '' : acao[sis] || (sis === 'nx' ? '// equivalente em NXOpen: a definir' : '// a definir'),
      macro: acao.macro || '', resultado: erro ? `${TERMOS[sis].nome} desconectado: comando não enviado.` : acao.resultado || '',
      erro: !!erro, tela: AE.atual,
    });
    AE.estado.cadLog.length = Math.min(AE.estado.cadLog.length, 80);
    naoVistos += 1;
    AE.salvar();
  }
  let naoVistos = 0;
  /* acao: {titulo, catia, nx, macro, resultado, ms}. Devolve true se "executou". */
  AE.cad = async (acao, botao) => {
    const t = AE.termos();
    if (!AE.estado.cad.conectado) {
      logCad(acao, true);
      AE.avisa(`${t.nome} desconectado. Clique em "${t.nome} desconectado" na barra de cima para conectar.`, { tipo: 'erro' });
      return false;
    }
    if (botao) botao.setAttribute('aria-busy', 'true');
    const pil = $('#conexao');
    if (pil) pil.classList.add('ocupado');
    await espera(acao.ms || 550);
    if (botao) botao.removeAttribute('aria-busy');
    if (pil) pil.classList.remove('ocupado');
    logCad(acao, false);
    return true;
  };

  /* ======================= balão, aviso, pergunta ======================= */
  let balao, aviso, tAviso;
  function mostraBalao(el) {
    const tit = el.dataset.tipTitulo || (el.matches('button,a,select,input,.btn') ? 'O que executa' : 'O que significa');
    balao.innerHTML = '<b>' + esc(tit) + '</b>' + esc(el.dataset.tip);
    balao.hidden = false;
    const r = el.getBoundingClientRect(), b = balao.getBoundingClientRect();
    const x = Math.min(Math.max(8, r.left), innerWidth - b.width - 8);
    let y = r.bottom + 8;
    if (y + b.height > innerHeight - 8) y = r.top - b.height - 8;
    balao.style.left = x + 'px';
    balao.style.top = Math.max(8, y) + 'px';
  }
  AE.avisa = (texto, opts = {}) => {
    if (typeof opts === 'string') opts = { tipo: opts };
    aviso.className = opts.tipo || '';
    aviso.innerHTML = '<span>' + esc(texto) + '</span>';
    if (opts.acao) {
      const b = document.createElement('button');
      b.className = 'btn mini primario';
      b.style.cssText = 'color:var(--acao-texto);font-size:13px;padding:3px 9px;white-space:nowrap';
      b.textContent = opts.acao.texto;
      b.onclick = () => { aviso.hidden = true; opts.acao.fn(); };
      aviso.appendChild(b);
    }
    const x = document.createElement('button');
    x.setAttribute('aria-label', 'Fechar aviso');
    x.textContent = '×';
    x.onclick = () => (aviso.hidden = true);
    aviso.appendChild(x);
    aviso.hidden = false;
    clearTimeout(tAviso);
    tAviso = setTimeout(() => (aviso.hidden = true), opts.acao ? 8000 : 4800);
  };
  /* janela de pergunta. Sem `campo`: confirmação (true/null). Com `campo`: devolve o texto ou null. */
  AE.perguntar = (o) => new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'janela';
    const campo = o.campo
      ? `<label class="campo">${esc(o.campo)}${o.tipo === 'textarea'
          ? `<textarea name="v" ${o.obrigatorio === false ? '' : 'required'}>${esc(o.valor || '')}</textarea>`
          : `<input name="v" type="${o.tipo || 'text'}" value="${esc(o.valor == null ? '' : o.valor)}" ${o.obrigatorio === false ? '' : 'required'} ${o.extra || ''}>`}</label>`
      : '';
    d.innerHTML = `<form method="dialog"><h2>${esc(o.titulo || 'Confirmar')}</h2>${o.texto ? `<p>${esc(o.texto)}</p>` : ''}${campo}
      <div class="barra" style="flex-direction:row-reverse"><button class="btn ${o.perigo ? 'perigo' : 'primario'}" value="sim">${esc(o.ok || 'Confirmar')}</button>
      <button class="btn leve" value="nao" formnovalidate>${esc(o.cancelar || 'Cancelar')}</button></div></form>`;
    document.body.appendChild(d);
    const inp = $('[name=v]', d);
    d.addEventListener('close', () => {
      const ok = d.returnValue === 'sim';
      const v = inp ? inp.value.trim() : true;
      d.remove();
      resolve(ok ? v : null);
    });
    d.showModal();
    if (inp) { inp.focus(); if (inp.select) inp.select(); }
  });

  /* ======================= navegação ======================= */
  let ORDEM = []; // [{grupo, area, ids}]
  const lista = () => ORDEM.flatMap((g) => g.ids);
  const navegaveis = () => lista().filter((id) => AE.telas[id] && !AE.telas[id].aFazer);
  function proximo(id) { const l = navegaveis(); const i = l.indexOf(id); return i >= 0 && i < l.length - 1 ? l[i + 1] : null; }
  function anterior(id) { const l = navegaveis(); const i = l.indexOf(id); return i > 0 ? l[i - 1] : null; }
  AE.ir = (id) => {
    if (location.hash === '#/' + id) AE.abrir(id);
    else location.hash = '#/' + id;
  };
  function rotaAtual() {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    return AE.telas[h] && !AE.telas[h].aFazer ? h : 'painel';
  }

  /* ======================= moldura e contexto ======================= */
  const NOME_AREA = { proc: 'Processo', sim: 'Simulação', mec: 'Mecânica', visao: 'Visão geral' };
  const COR_AREA = { proc: 'var(--azul)', sim: 'var(--l-sim)', mec: 'var(--acao)', visao: 'var(--suave)' };
  const TXT_STATUS = {
    pendente: ['neutro', 'Pendente'], andamento: ['info', 'Em andamento'], concluido: ['ok', 'Concluído'],
    preliminar: ['aviso', 'Concluído · preliminar'], desatualizado: ['erro', 'Conferir de novo'], afazer: ['neutro', 'A fazer'],
  };
  AE.pilulaStatus = (id) => {
    const s = AE.statusVisivel(id), [c, t] = TXT_STATUS[s] || TXT_STATUS.pendente;
    const tips = {
      pendente: 'Ninguém mexeu neste passo ainda. Os passos seguintes usam o valor de reserva dele.',
      andamento: 'Já tem dados preenchidos, mas o passo não foi concluído. Os passos seguintes usam o que já existe, como preliminar.',
      concluido: 'Concluído com todas as entradas recebidas.',
      preliminar: 'Concluído, mas alguma entrada ainda usa o valor de reserva. A saída vale como conceito, para conferência.',
      desatualizado: 'Uma entrada mudou depois que este passo foi concluído. Confira e conclua de novo.',
      afazer: 'Tela ainda não desenhada.',
    };
    return `<span class="pilula ${c}" data-tip="${esc(tips[s] || '')}">${t}</span>`;
  };
  function htmlEntradas(def) {
    if (!def.entradas.length) return '';
    const ORI = {
      tela: ['concluido', 'Recebido'],
      andamento: ['andamento', 'Parcial: o passo ainda não foi concluído'],
      reserva: ['preliminar', 'Não chegou: usando o valor de reserva'],
    };
    let prelim = 0;
    const lis = def.entradas.map((x) => {
      const o = AE.origem(x.de), dd = AE.telas[x.de];
      if (o !== 'tela') prelim++;
      return `<li><span class="st ${ORI[o][0]}" aria-hidden="true"></span><span>${esc(x.o)}
        <small><a href="#/${esc(x.de)}">${esc(dd ? dd.rotulo + ' · ' + dd.titulo : x.de)}</a> · ${ORI[o][1]}</small></span></li>`;
    }).join('');
    return `<section class="entradas" aria-label="Entradas desta tela"><h2>O que esta tela recebe
      ${prelim ? `<span class="pilula aviso" data-tip="Regra do fluxo: entrada que não chegou não trava o passo. Ele roda com o valor de reserva e a saída fica preliminar, marcada para conferência.">${prelim} entrada${prelim > 1 ? 's' : ''} provisória${prelim > 1 ? 's' : ''} · saída preliminar</span>` : '<span class="pilula ok">Todas as entradas recebidas</span>'}</h2><ul>${lis}</ul></section>`;
  }
  function htmlDesatualizado(def) {
    const ds = AE.desatualizado(def.id);
    if (!ds.length) return '';
    const nomes = ds.map((d) => AE.telas[d].rotulo + ' · ' + AE.telas[d].titulo).join(', ');
    return `<div class="faixa-aviso" role="alert"><span><b>Entrada mudou:</b> ${esc(nomes)} foi concluído de novo depois deste passo. Confira os valores abaixo.</span>
      <button class="btn mini" data-reconferir data-tip="Confirma que você conferiu este passo com as entradas novas. Ele volta a ficar concluído e avisa os passos seguintes.">Conferido, concluir de novo</button></div>`;
  }
  function htmlProg(def) {
    const deps = def.entradas.length
      ? `<h3>Entradas (grafo)</h3><ul>${def.entradas.map((x) => `<li><code>${esc(x.de)}</code> → ${esc(x.o)}</li>`).join('')}</ul>` : '';
    const fat = AE.estado.t[def.id];
    return `<h2>Para o programador</h2>${def.programador || ''}${deps}
      <details><summary>Dados desta tela (JSON)</summary><pre>${esc(fat ? JSON.stringify(fat, null, 2) : 'Ainda não há dados gravados. A tela mostra os valores iniciais de exemplo.')}</pre></details>`;
  }

  function criarCtx(def) {
    const id = def.id;
    const ctx = {
      id, def, e: AE.estado,
      get s() { return AE.fatia(id); },
      util: AE.util, calc: AE.calc, dados: AE.dados,
      termos: AE.termos,
      /* salvar(): dado do projeto mudou (o passo vira "em andamento").
         salvarUI(): só estado de tela (aba aberta, item selecionado), sem mudar a situação do passo. */
      salvar: () => { AE.marcarAndamento(id); AE.salvar(); },
      salvarUI: () => AE.salvar(),
      redesenhar: () => { const y = scrollY; AE.abrir(id, true); scrollTo(0, y); },
      avisa: AE.avisa, perguntar: AE.perguntar, ir: AE.ir,
      registrar: (t) => { AE.registrar(t, id); AE.salvar(); },
      cad: (acao, botao) => AE.cad(acao, botao),
      concluir: (opts) => AE.concluir(id, opts),
      origem: AE.origem, concluido: AE.concluido,
      proximo: () => proximo(id),
    };
    return ctx;
  }

  AE.atual = null;
  AE.abrir = (id, mesmo) => {
    const def = AE.telas[id];
    if (!def) return AE.abrir('painel');
    AE.atual = id;
    const main = $('#conteudo');
    const ctx = criarCtx(def);
    const prog = AE.estado.ui.prog && def.programador !== false;
    const area = def.area || 'visao';
    const ant = anterior(id), prox = proximo(id);
    main.innerHTML = `<section class="tela-sec" data-tela="${esc(id)}">
      <header class="topo"><div><h1><span class="area" style="color:${COR_AREA[area]}">${NOME_AREA[area]}</span>${esc(def.rotulo ? def.rotulo + ' · ' : '')}${esc(def.titulo)}</h1><p>${esc(def.resumo || '')}</p></div>
        <div class="barra" id="topo-status">${def.semStatus ? '' : AE.pilulaStatus(id)}</div></header>
      <div class="tela ${prog ? '' : 'sem-prog'}"><div class="coluna">
        <div id="moldura-entradas">${htmlEntradas(def)}</div>
        <div id="moldura-desat">${htmlDesatualizado(def)}</div>
        <div class="corpo-tela coluna"></div>
        ${def.semRodape ? '' : `<nav class="rodape-passo" aria-label="Navegar entre passos"><div class="nav">
          ${ant ? `<a class="btn leve" href="#/${ant}">← ${esc(AE.telas[ant].rotulo || AE.telas[ant].titulo)}</a>` : ''}
          ${prox ? `<a class="btn leve" href="#/${prox}">${esc(AE.telas[prox].rotulo || AE.telas[prox].titulo)} →</a>` : ''}</div>
          <a class="btn leve mini" href="#/fluxo" data-tip="Mostra onde este passo fica no fluxo do projeto inteiro.">Ver no fluxo</a></nav>`}
      </div>${prog ? `<aside class="prog" id="prog">${htmlProg(def)}</aside>` : ''}</div></section>`;
    const corpo = $('.corpo-tela', main);
    try {
      corpo.innerHTML = def.render(ctx);
      if (def.montar) def.montar(corpo, ctx);
    } catch (err) {
      console.error(err);
      corpo.innerHTML = `<div class="faixa-aviso"><span>Erro ao montar esta tela: ${esc(err.message)}</span></div>`;
    }
    atualizarTrilho();
    /* no celular o trilho vira uma faixa única: traz o passo atual para o meio */
    const cur = $('#trilho [aria-current="page"]');
    if (cur && matchMedia('(max-width:820px)').matches) requestAnimationFrame(() => {
      const tr = $('#trilho'), a = cur.getBoundingClientRect(), t = tr.getBoundingClientRect();
      tr.scrollLeft += a.left + a.width / 2 - (t.left + tr.clientWidth / 2);
    });
    document.title = `${def.rotulo ? def.rotulo + ' · ' : ''}${def.titulo} · Automação de Engenharia`;
    if (!mesmo) { scrollTo(0, 0); main.focus({ preventScroll: true }); }
  };
  function atualizarMoldura() {
    const def = AE.telas[AE.atual];
    if (!def) return;
    const st = $('#topo-status');
    if (st && !def.semStatus) st.innerHTML = AE.pilulaStatus(def.id);
    const en = $('#moldura-entradas');
    if (en) en.innerHTML = htmlEntradas(def);
    const de = $('#moldura-desat');
    if (de) de.innerHTML = htmlDesatualizado(def);
    const pg = $('#prog');
    if (pg) {
      const aberto = $('details', pg)?.open;
      pg.innerHTML = htmlProg(def);
      if (aberto) $('details', pg).open = true;
    }
  }

  /* ======================= trilho e barra do app ======================= */
  function atualizarTrilho() {
    $$('#trilho [data-id]').forEach((a) => {
      const id = a.dataset.id;
      a.querySelector('.st').className = 'st ' + AE.statusVisivel(id);
      if (id === AE.atual) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const ids = navegaveis().filter((id) => AE.telas[id].area !== 'visao');
    const c = ids.filter((id) => AE.passo(id).status === 'concluido').length;
    const p = ids.filter((id) => AE.passo(id).status === 'preliminar').length;
    const pg = $('#progresso');
    if (pg) {
      pg.innerHTML = `<span>${c + p} de ${ids.length} passos concluídos${p ? ` · ${p} preliminar${p > 1 ? 'es' : ''}` : ''}</span>
        <div class="barra-prog"><i style="width:${(c / ids.length) * 100}%;background:var(--ok)"></i><i style="width:${(p / ids.length) * 100}%;background:var(--aviso)"></i></div>`;
    }
    const pj = AE.calc.projeto ? AE.calc.projeto() : null;
    const cp = $('#chip-projeto');
    if (cp && pj) cp.innerHTML = `<b title="${esc(pj.nome)}">${esc(pj.nome)}</b><span>${esc(pj.cliente)}</span>`;
    const t = AE.termos(), cx = $('#conexao');
    if (cx) {
      cx.className = 'conexao ' + (AE.estado.cad.conectado ? 'on' : 'off');
      cx.textContent = t.nome + (AE.estado.cad.conectado ? ' conectado' : ' desconectado');
    }
    $$('#seg-cad button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.cad === AE.estado.cad.sistema));
    const bp = $('#bt-prog');
    if (bp) bp.setAttribute('aria-pressed', AE.estado.ui.prog);
    const bc = $('#bt-console .badge');
    if (bc) { bc.textContent = naoVistos; bc.hidden = !naoVistos || !$('#console').hidden; }
    desenhaConsole();
  }
  function desenhaConsole() {
    const ol = $('#console-lista');
    if (!ol || $('#console').hidden) return;
    const L = AE.estado.cadLog;
    ol.innerHTML = L.length
      ? L.map((c) => `<li class="${c.erro ? 'erro' : ''}"><span class="hora">${esc(c.hora)} · ${esc(c.sistema)}${c.tela && AE.telas[c.tela] ? ' · ' + esc(AE.telas[c.tela].rotulo || AE.telas[c.tela].titulo) : ''}</span>
        <div><b>${esc(c.titulo)}</b>${c.macro ? ` <small>Macro de base: ${esc(c.macro)}</small>` : ''}</div>
        ${c.codigo ? `<code>${esc(c.codigo)}</code>` : ''}${c.resultado ? `<small>→ ${esc(c.resultado)}</small>` : ''}</li>`).join('')
      : '<li style="border:0;padding:0"><div class="vazio">Nenhum comando enviado ainda. Use um botão de CAD em qualquer tela.</div></li>';
  }

  function montarTrilho() {
    const nav = $('#trilho');
    nav.innerHTML = `<a class="marca" href="#/painel">AUTOMAÇÃO DE ENGENHARIA<small>Protótipo navegável das telas · v0.2</small></a>
      <div class="progresso-geral" id="progresso"></div>` +
      ORDEM.map((g) => `<div class="grupo ${g.area || ''}">${esc(g.grupo)}</div><div class="passos">` +
        g.ids.filter((id) => AE.telas[id]).map((id) => {
          const d = AE.telas[id];
          return d.aFazer
            ? `<span class="passo afazer" data-id="${id}" tabindex="0" data-tip="${esc('A fazer: ' + (d.tip || d.resumo || ''))}" data-tip-titulo="Ainda não desenhada"><span class="n">${esc(d.sigla)}</span><span class="t">${esc(d.titulo)}</span><span class="st"></span></span>`
            : `<a class="passo" data-id="${id}" href="#/${id}" data-tip="${esc(d.tip || d.resumo || '')}" data-tip-titulo="O que esta tela faz"><span class="n">${esc(d.sigla)}</span><span class="t">${esc(d.titulo)}</span><span class="st"></span></a>`;
        }).join('') + '</div>').join('') +
      `<div class="legenda-st" aria-label="Legenda da situação dos passos">
        <span><i class="st pendente"></i>pendente</span><span><i class="st andamento"></i>em andamento</span>
        <span><i class="st concluido"></i>concluído</span><span><i class="st preliminar"></i>preliminar</span>
        <span><i class="st desatualizado"></i>conferir de novo</span></div>`;
  }

  function montarBarraApp() {
    $('#seg-cad').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-cad]');
      if (!b || b.dataset.cad === AE.estado.cad.sistema) return;
      AE.estado.cad.sistema = b.dataset.cad;
      AE.salvar();
      AE.avisa(`Agora o programa conversa com o ${AE.termos().versao}. Os textos e comandos das telas mudam junto.`);
      AE.abrir(AE.atual, true);
    });
    $('#conexao').addEventListener('click', () => {
      AE.estado.cad.conectado = !AE.estado.cad.conectado;
      AE.salvar();
      AE.avisa(AE.estado.cad.conectado ? `${AE.termos().nome} conectado. Os botões de CAD voltaram a funcionar.` : `Simulando ${AE.termos().nome} fechado: os botões de CAD passam a recusar o comando.`, { tipo: AE.estado.cad.conectado ? 'ok' : 'aviso' });
      AE.abrir(AE.atual, true);
    });
    $('#bt-console').addEventListener('click', () => {
      const c = $('#console');
      c.hidden = !c.hidden;
      if (!c.hidden) naoVistos = 0;
      atualizarTrilho();
    });
    $('#console-fechar').addEventListener('click', () => { $('#console').hidden = true; atualizarTrilho(); });
    $('#console-limpar').addEventListener('click', () => { AE.estado.cadLog = []; AE.salvar(); });
    $('#bt-prog').addEventListener('click', () => { AE.estado.ui.prog = !AE.estado.ui.prog; AE.salvar(); AE.abrir(AE.atual, true); });
    const menu = $('#menu-lista'), bm = $('#bt-menu');
    bm.addEventListener('click', () => { menu.hidden = !menu.hidden; bm.setAttribute('aria-expanded', !menu.hidden); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.menu')) { menu.hidden = true; bm.setAttribute('aria-expanded', 'false'); } });
    menu.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-m]');
      if (!b) return;
      menu.hidden = true;
      if (b.dataset.m === 'exportar') exportar();
      if (b.dataset.m === 'importar') $('#arquivo-importar').click();
      if (b.dataset.m === 'reiniciar') {
        const ok = await AE.perguntar({ titulo: 'Reiniciar a demonstração?', texto: 'Apaga tudo o que foi preenchido neste navegador e volta aos dados de exemplo.', ok: 'Reiniciar', perigo: true });
        if (ok) { AE.resetar(); AE.ir('painel'); AE.avisa('Demonstração reiniciada com os dados de exemplo.'); }
      }
      if (b.dataset.m === 'tour') AE.ir('painel');
    });
    $('#arquivo-importar').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const est = JSON.parse(r.result);
          if (!est || est.versao !== 1 || !est.t) throw new Error('arquivo não é um projeto deste protótipo');
          AE.estado = Object.assign(novoEstado(), est);
          AE.salvar();
          AE.abrir(rotaAtual(), true);
          AE.avisa('Projeto importado.', { tipo: 'ok' });
        } catch (err) { AE.avisa('Não foi possível importar: ' + err.message, { tipo: 'erro' }); }
        e.target.value = '';
      };
      r.readAsText(f);
    });
  }
  function exportar() {
    const pj = AE.calc.projeto ? AE.calc.projeto() : { nome: 'projeto' };
    const blob = new Blob([JSON.stringify(AE.estado, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'projeto-' + String(pj.nome || 'projeto').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    AE.avisa('Projeto exportado como JSON. Dá para importar de volta em outro navegador.', { tipo: 'ok' });
  }

  /* ======================= início ======================= */
  AE.iniciar = (ordem) => {
    ORDEM = ordem;
    balao = $('#balao');
    aviso = $('#aviso');
    document.addEventListener('mouseover', (e) => { const el = e.target.closest('[data-tip]'); if (el && el.dataset.tip) mostraBalao(el); });
    document.addEventListener('mouseout', (e) => { if (e.target.closest('[data-tip]')) balao.hidden = true; });
    document.addEventListener('focusin', (e) => { const el = e.target.closest('[data-tip]'); if (el && el.dataset.tip) mostraBalao(el); else balao.hidden = true; });
    document.addEventListener('focusout', () => (balao.hidden = true));
    addEventListener('scroll', () => (balao.hidden = true), true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { $('#console').hidden = true; $('#menu-lista').hidden = true; balao.hidden = true; atualizarTrilho(); }
    });
    /* botões com data-run (estilo da v0): só mostram o aviso do que foi executado */
    document.addEventListener('click', (e) => { const el = e.target.closest('[data-run]'); if (el) AE.avisa(el.dataset.run); });
    /* faixa "entrada mudou": concluir de novo */
    document.addEventListener('click', (e) => { if (e.target.closest('[data-reconferir]') && AE.atual) AE.concluir(AE.atual, { semProximo: true }); });
    montarTrilho();
    montarBarraApp();
    AE.on('mudou', () => { atualizarTrilho(); atualizarMoldura(); });
    /* compatibilidade com os links da v0 (#separacao, #fixacao…) */
    if (/^#[a-z]/.test(location.hash)) location.replace('#/' + location.hash.slice(1));
    addEventListener('hashchange', () => AE.abrir(rotaAtual()));
    AE.abrir(rotaAtual());
  };
})();
