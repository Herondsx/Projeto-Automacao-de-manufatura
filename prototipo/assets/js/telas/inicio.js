/* Passo 0 · Novo projeto (Processo)
   Tela de referência do padrão: fatia própria (inicial), render() com o HTML, montar() com os eventos
   e redesenhos parciais. Saída consumida pelos outros passos via AE.calc.projeto(). */
(function () {
  'use strict';
  const AE = window.AE;
  const { $, $$, esc, fmt } = AE.util;

  AE.tela({
    id: 'inicio', sigla: '0', area: 'proc', rotulo: 'Passo 0', titulo: 'Novo projeto',
    resumo: 'Tudo o que o programa precisa saber antes de qualquer cálculo: cliente, volumes, turnos, layout de partida e pastas.',
    tip: 'Abre a tela onde o projeto é criado: cliente, volumes, turnos, layout de partida e pastas.',
    entradas: [],
    inicial: () => ({
      cliente: 'Volkswagen', nome: 'Linha de exemplo', tipoLinha: 'nova', layoutBase: 'codesigner', layoutCarregado: false,
      turnos: 2, horas: 7.54, disp: 85,
      modelos: [
        { nome: 'Modelo A', jph: 54, dia: 814, adotado: '', motivo: '' },
        { nome: 'Modelo B', jph: 4, dia: 50, adotado: '', motivo: '' },
      ],
      pastas: { modo: 'padrao', extras: [], replicado: false, criadas: false },
    }),
    programador: `
      <h3>O que esta tela guarda</h3>
      <ul>
        <li>Um registro de <code>projeto</code> com cliente, tipo de linha, turnos, horas e disponibilidade.</li>
        <li>Uma lista de <code>modelos</code>, cada um com volume e ciclo (e o motivo, se o ciclo adotado for menor).</li>
        <li>A <code>estrutura de pastas</code> e a pasta de destino de cada tipo de documento.</li>
      </ul>
      <h3>Regras</h3>
      <ul>
        <li>Ciclo calculado = (3600 ÷ carros por hora) × disponibilidade.</li>
        <li>Conferência: carros/hora × turnos × horas tem de bater com carros/dia (tolerância de 1%).</li>
        <li>O ciclo adotado pode ser menor que o calculado, mas pede um motivo.</li>
        <li>O projeto só é criado sem nenhuma conferência em vermelho.</li>
        <li>O padrão do cliente (tempos, normas, nomes, catálogo, plano de fixação) é carregado de um cadastro, nunca fixo no código.</li>
        <li>Os passos seguintes dimensionam pelo <b>menor ciclo adotado</b> (o modelo mais exigente).</li>
      </ul>
      <h3>Em aberto</h3>
      <ul><li>Linha mista: o ciclo deve sair da soma dos volumes dos modelos? Hoje o protótipo usa o modelo mais exigente.</li></ul>
      <h3>Saída</h3>
      <ul><li><code>AE.calc.projeto()</code>: cliente, padrão do cliente, turnos, horas, disponibilidade, modelos com ciclo e <code>cicloAlvo</code>.</li></ul>
      <h3>Macros de base</h3>
      <ul><li>Nenhuma. Esta tela é só cadastro e cálculo.</li></ul>`,

    render(ctx) {
      const s = ctx.s, d = AE.dados;
      const cli = Object.keys(d.clientes).map((c) => `<option ${c === s.cliente ? 'selected' : ''}>${esc(c)}</option>`).join('');
      const seg = (nome, val, ops) => ops.map(([v, t, tip]) => `<button data-${nome}="${v}" aria-pressed="${v === val}" data-tip="${esc(tip)}">${t}</button>`).join('');
      return `
      <div class="bloco">
        <h2>Dados do projeto</h2>
        <p class="sub">O cliente escolhido carrega o padrão dele: nomes de arquivo, pastas, tempos, normas, catálogo e tipo de plano de fixação.</p>
        <div class="campos">
          <label class="campo">Cliente (montadora)<select id="i-cliente">${cli}</select></label>
          <label class="campo">Nome do projeto<input type="text" id="i-nome" value="${esc(s.nome)}"></label>
          <label class="campo">Turnos por dia<input type="number" id="i-turnos" value="${esc(s.turnos)}" min="1" max="4"></label>
          <label class="campo">Horas por turno<input type="number" id="i-horas" value="${esc(s.horas)}" step="0.01" min="1"></label>
          <label class="campo">Disponibilidade da linha (%)<input type="number" id="i-disp" value="${esc(s.disp)}" min="50" max="100"></label>
          <div class="campo">Tipo de linha
            <div class="seg" id="seg-linha">${seg('linha', s.tipoLinha, [
              ['nova', 'Nova', 'Linha nova: nenhum equipamento existente. O programa propõe tudo do zero.'],
              ['retooling', 'Retooling', 'Retooling: a linha já existe. O programa pede o levantamento da linha atual (Simulação S0) e marca robôs e pinças como existentes.']])}</div></div>
        </div>
        <div id="i-padrao"></div>
      </div>

      <div class="bloco">
        <h2>Layout de partida</h2>
        <p class="sub">De onde o programa começa a desenhar a linha.</p>
        <div class="barra">
          <div class="seg" id="seg-layout" style="flex:1;min-width:240px">${seg('layout', s.layoutBase, [
            ['retooling', 'Linha existente', 'Usa o layout da linha existente como base.'],
            ['codesigner', 'Codesigner', 'Usa o layout de vendas (codesigner) como base. O programa valida se ele atende o ciclo.'],
            ['zero', 'Do zero', 'Começa sem layout. O programa sugere estações e posições ao longo do projeto.']])}</div>
          <button class="btn" id="i-carregar" data-tip="Abre a janela de arquivos para escolher o DWG do layout. O programa lê os blocos e as posições dos equipamentos.">Carregar layout</button>
        </div>
        <p class="nota ${s.layoutCarregado ? 'ok' : ''}" id="i-layout-nota">${s.layoutBase === 'zero' ? 'Sem layout de partida: o programa sugere as estações no Passo 4 (regra "se não receber").' : s.layoutCarregado ? 'Layout carregado: 6 estações e 9 robôs encontrados no DWG. Usado como referência no Passo 7.' : 'Nenhum DWG carregado ainda. O Passo 7 desenha o layout preliminar e atualiza quando o arquivo chegar.'}</p>
      </div>

      <div class="bloco">
        <h2>Modelos de carro na linha <span class="exemplo">dados de exemplo</span></h2>
        <p class="sub">Cada modelo tem o seu volume. O tempo de ciclo é calculado por modelo.</p>
        <div class="rolagem"><table id="tab-modelos">
          <thead><tr><th>Modelo</th><th class="num">Carros/hora</th><th class="num">Carros/dia</th><th class="num">Ciclo calculado</th><th class="num">Ciclo adotado</th><th>Conferência</th><th></th></tr></thead>
          <tbody></tbody>
        </table></div>
        <div class="barra" style="margin-top:12px">
          <button class="btn" id="add-modelo" data-tip="Acrescenta uma linha na tabela para mais um modelo de carro.">Adicionar modelo</button>
          <span style="color:var(--suave);font-size:13px">Ciclo calculado = (3600 ÷ carros por hora) × disponibilidade</span>
        </div>
        <div id="i-ciclo" style="margin-top:12px"></div>
      </div>

      <div class="bloco">
        <h2>Pastas do projeto</h2>
        <p class="sub">Cada documento tem pasta certa. O usuário nunca escolhe onde salvar.</p>
        <div class="barra" style="margin-bottom:12px">
          <button class="btn" data-pasta="padrao" data-tip="Aplica a estrutura de pastas padrão do programa a este projeto.">Usar padrão do programa</button>
          <button class="btn" data-pasta="cliente" data-tip="Abre o editor para montar a estrutura deste cliente. Ela fica salva para os próximos projetos do mesmo cliente.">Criar estrutura do cliente</button>
          <button class="btn leve" data-pasta="nova" data-tip="Cria uma pasta nova no projeto. Pode ser usada a qualquer momento, não só no início.">Nova pasta</button>
          <button class="btn leve" data-pasta="replicar" data-tip="Pega as subpastas que você montou em uma estação e cria as mesmas em todas as outras.">Replicar para todas as estações</button>
        </div>
        <div class="arvore" id="i-arvore"></div>
      </div>

      <div class="bloco">
        <h2>Checagem</h2>
        <p class="sub">O projeto só é criado sem nenhum item em vermelho.</p>
        <div class="checagem" id="i-check"></div>
        <div class="barra fim" style="margin-top:14px">
          <button class="btn leve" id="i-rascunho" data-tip="Guarda o que foi preenchido sem criar o projeto. Dá para voltar depois.">Salvar rascunho</button>
          <button class="btn primario" id="i-criar" data-tip="Confere se todos os campos estão preenchidos e se os volumes fecham. Se estiver tudo certo, cria o projeto, cria as pastas e abre o Passo 1.">Criar projeto e avançar</button>
        </div>
      </div>`;
    },

    montar(el, ctx) {
      const s = ctx.s;
      AE.css('inicio', `
        .arvore{font-family:var(--f-dado);font-size:13px;display:flex;flex-direction:column;gap:3px}
        .arvore div{display:flex;flex-wrap:wrap;gap:4px 10px;justify-content:space-between;padding:5px 8px;border-radius:5px;background:var(--fundo);border:1px solid var(--linha)}
        .arvore span{color:var(--suave);font-family:var(--f-texto);font-size:12.5px}
        .arvore .filho{margin-left:22px}
        .arvore .extra{border-color:var(--roxo)}`);

      const padrao = () => {
        const c = AE.dados.clientes[s.cliente] || AE.dados.clientes.Outro;
        $('#i-padrao', el).innerHTML = `<h3 class="rotulo-sec">Padrão carregado do cadastro do cliente</h3>
          <div class="leitura">
            <div><code>Plano</code><span>Plano de fixação tipo <b>${esc(c.planoNome)}</b>: a regra de leitura dos nomes de ponto (Mecânica 1) vem daqui.</span></div>
            <div><code>Catálogo</code><span>${c.catalogo === 'naams' ? 'NAAMS (padrão GM e Ford)' : 'Comau (padrão)'} · peças de ${c.espessura} mm · calço nominal ${c.calco} mm · grampos ${esc(c.fabGrampo)}</span></div>
            <div><code>Arquivos</code><span><span style="font-family:var(--f-dado);font-size:12.5px">${esc(c.nomeArquivo)}</span><br><small style="color:var(--fraco)">ex.: ${esc(c.exemploArquivo)}</small></span></div>
          </div>`;
      };

      const modelos = () => {
        const pj = AE.calc.projeto();
        $('#tab-modelos tbody', el).innerHTML = pj.modelos.map((m, i) => {
          const menor = m.adotado !== '' && m.adotado != null && Number(m.adotado) < m.ciclo - 0.05;
          return `<tr>
            <td><input type="text" data-m="nome" data-i="${i}" value="${esc(m.nome)}" aria-label="Nome do modelo"></td>
            <td class="num"><input class="curto" type="number" min="0" data-m="jph" data-i="${i}" value="${esc(m.jph)}" aria-label="Carros por hora"></td>
            <td class="num"><input class="curto" type="number" min="0" data-m="dia" data-i="${i}" value="${esc(m.dia)}" aria-label="Carros por dia"></td>
            <td class="num">${m.ciclo ? fmt(m.ciclo, 1) + ' s' : '—'}</td>
            <td class="num"><input class="curto" type="number" min="0" step="0.1" data-m="adotado" data-i="${i}" value="${esc(m.adotado)}" placeholder="${m.ciclo ? fmt(m.ciclo, 1) : ''}" aria-label="Ciclo adotado"
              data-tip="Deixe em branco para usar o calculado. Se digitar um valor menor, o programa pede o motivo, por exemplo: esta linha precisa empurrar a seguinte."></td>
            <td>${m.fecha ? '<span class="pilula ok">Volumes fecham</span>' : `<span class="pilula erro" data-tip="${esc(`Com ${fmt(pj.turnos, 0)} turnos de ${fmt(pj.horas, 2)} h, ${m.jph} carros por hora dão ${fmt(m.diaCalc, 0)} carros por dia, e não ${m.dia}. Corrija um dos dois valores.`)}">Não fecha: ${fmt(m.diaCalc, 0)}/dia</span>`}
              ${menor ? `<span class="pilula roxo" data-tip="${esc('Motivo registrado: ' + (m.motivo || '—'))}">Ciclo reduzido</span>` : ''}</td>
            <td><button class="btn mini leve" data-rm="${i}" data-tip="Remove este modelo da linha.">Remover</button></td></tr>`;
        }).join('');
        const alvo = pj.modelos.filter((m) => m.jph > 0).sort((a, b) => a.adotadoEfetivo - b.adotadoEfetivo)[0];
        $('#i-ciclo', el).innerHTML = alvo
          ? `<div class="kpis"><div class="kpi"><span>Ciclo de projeto (modelo mais exigente)</span><b>${fmt(pj.cicloAlvo, 1)} s</b><small>${esc(alvo.nome)} · usado nos Passos 4 e 6</small></div>
             <div class="kpi"><span>Tempo disponível por dia</span><b>${fmt(pj.turnos * pj.horas, 2)} h</b><small>${fmt(pj.turnos, 0)} turno(s) × ${fmt(pj.horas, 2)} h</small></div>
             <div class="kpi"><span>Volume total</span><b>${fmt(pj.modelos.reduce((a, m) => a + (Number(m.dia) || 0), 0), 0)}</b><small>carros por dia, todos os modelos</small></div></div>`
          : '<div class="vazio">Informe os carros por hora de pelo menos um modelo.</div>';
      };

      const arvore = () => {
        const ests = AE.calc.listaEstacoes();
        const linhas = AE.dados.pastas.map((p) => {
          let h = `<div>${esc(p.cod)} <span>${esc(p.o)}</span></div>`;
          if (p.porEstacao && ests.length) {
            h += `<div class="filho">ST${ests[0].st} <span>modelo que você monta</span></div>`;
            if (ests.length > 1) h += `<div class="filho">${ests.slice(1).map((e) => 'ST' + e.st).join(' · ')} <span>${s.pastas.replicado ? 'replicadas pelo programa' : 'aguardando "Replicar para todas as estações"'}</span></div>`;
          }
          return h;
        }).join('');
        const extras = s.pastas.extras.map((x) => `<div class="extra">${esc(x)} <span>criada neste projeto</span></div>`).join('');
        $('#i-arvore', el).innerHTML = `<div style="border-style:dashed"><span>Estrutura: ${s.pastas.modo === 'cliente' ? 'do cliente ' + esc(s.cliente) : 'padrão do programa'}${s.pastas.criadas ? ' · pastas criadas no servidor' : ' · ainda não criadas (são criadas junto com o projeto)'}</span></div>` + linhas + extras;
      };

      const checagem = () => {
        const pj = AE.calc.projeto();
        const ruim = pj.modelos.filter((m) => !m.fecha);
        const semMotivo = pj.modelos.filter((m) => m.adotado !== '' && m.adotado != null && Number(m.adotado) < m.ciclo - 0.05 && !m.motivo);
        const itens = [
          ['Nome do projeto preenchido', !!String(s.nome).trim(), 'Falta o nome', 'erro'],
          ['Pelo menos um modelo com volume', pj.modelos.some((m) => m.jph > 0), 'Nenhum modelo', 'erro'],
          ['Volumes fecham (carros/hora × turnos × horas = carros/dia)', ruim.length === 0, ruim.map((m) => m.nome).join(', ') + ' não fecha', 'erro'],
          ['Ciclo reduzido tem motivo', semMotivo.length === 0, semMotivo.length + ' sem motivo', 'erro'],
          ['Layout de partida definido', s.layoutBase === 'zero' || s.layoutCarregado, 'DWG não carregado: layout fica preliminar', 'aviso'],
        ];
        $('#i-check', el).innerHTML = itens.map((i) => `<div><span>${esc(i[0])}</span>${i[1] ? '<span class="pilula ok">Certo</span>' : `<span class="pilula ${i[3]}">${esc(i[2])}</span>`}</div>`).join('');
        return itens.filter((i) => !i[1] && i[3] === 'erro');
      };

      const tudo = () => { padrao(); modelos(); arvore(); checagem(); };
      tudo();

      /* dados gerais */
      $('#i-cliente', el).onchange = (e) => { s.cliente = e.target.value; ctx.salvar(); padrao(); arvore(); ctx.avisa(`Padrão do cliente ${s.cliente} carregado: plano de fixação, catálogo, nomes de arquivo e pastas.`); };
      $('#i-nome', el).oninput = (e) => { s.nome = e.target.value; ctx.salvar(); checagem(); };
      ['turnos', 'horas', 'disp'].forEach((k) => ($('#i-' + k, el).oninput = (e) => { s[k] = parseFloat(e.target.value) || 0; ctx.salvar(); modelos(); checagem(); }));
      $('#seg-linha', el).onclick = (e) => {
        const b = e.target.closest('[data-linha]'); if (!b) return;
        s.tipoLinha = b.dataset.linha; ctx.salvar();
        $$('#seg-linha button', el).forEach((x) => x.setAttribute('aria-pressed', x === b));
        if (s.tipoLinha === 'retooling') ctx.avisa('Retooling: robôs e pinças entram como existentes na lista de equipamentos, e a Simulação faz o levantamento da linha atual (S0).');
      };
      $('#seg-layout', el).onclick = (e) => {
        const b = e.target.closest('[data-layout]'); if (!b) return;
        s.layoutBase = b.dataset.layout; if (s.layoutBase === 'zero') s.layoutCarregado = false;
        ctx.salvar(); ctx.redesenhar();
      };
      $('#i-carregar', el).onclick = async (e) => {
        if (s.layoutBase === 'zero') { ctx.avisa('Layout "do zero" não usa DWG de partida. Escolha "Linha existente" ou "Codesigner" para carregar um arquivo.'); return; }
        const b = e.currentTarget; b.setAttribute('aria-busy', 'true');
        await AE.util.espera(700); b.removeAttribute('aria-busy');
        s.layoutCarregado = true; ctx.salvar(); ctx.registrar('Layout de partida carregado do DWG: 6 estações e 9 robôs.');
        ctx.avisa('Layout carregado: 6 estações e 9 robôs encontrados no DWG.', { tipo: 'ok' }); ctx.redesenhar();
      };

      /* modelos */
      const tab = $('#tab-modelos', el);
      tab.addEventListener('change', async (e) => {
        const t = e.target, i = +t.dataset.i, k = t.dataset.m; if (!k) return;
        const m = s.modelos[i];
        if (k === 'nome') m.nome = t.value;
        else if (k === 'adotado') {
          if (t.value === '') { m.adotado = ''; m.motivo = ''; }
          else {
            const v = parseFloat(t.value), calc = AE.calc.projeto().modelos[i].ciclo;
            if (v < calc - 0.05) {
              const mot = await ctx.perguntar({ titulo: 'Ciclo menor que o calculado', texto: `O ciclo calculado de ${m.nome} é ${fmt(calc, 1)} s. Para adotar ${fmt(v, 1)} s, registre o motivo.`, campo: 'Motivo', valor: m.motivo, ok: 'Registrar motivo' });
              if (mot == null) { t.value = m.adotado; return; }
              m.motivo = mot; ctx.registrar(`Ciclo de ${m.nome} reduzido para ${fmt(v, 1)} s. Motivo: ${mot}`);
            } else m.motivo = '';
            m.adotado = v;
          }
        } else m[k] = t.value === '' ? 0 : parseFloat(t.value);
        ctx.salvar(); modelos(); checagem();
      });
      tab.addEventListener('click', (e) => {
        const b = e.target.closest('[data-rm]'); if (!b) return;
        if (s.modelos.length === 1) { ctx.avisa('A linha precisa de pelo menos um modelo.'); return; }
        const m = s.modelos.splice(+b.dataset.rm, 1)[0]; ctx.salvar(); modelos(); checagem(); ctx.avisa(`${m.nome} removido da linha.`);
      });
      $('#add-modelo', el).onclick = () => {
        const pj = AE.calc.projeto();
        s.modelos.push({ nome: 'Modelo ' + String.fromCharCode(65 + s.modelos.length), jph: 30, dia: Math.round(30 * pj.turnos * pj.horas), adotado: '', motivo: '' });
        ctx.salvar(); modelos(); checagem();
      };

      /* pastas */
      el.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-pasta]'); if (!b) return;
        const a = b.dataset.pasta;
        if (a === 'padrao') { s.pastas.modo = 'padrao'; ctx.avisa(`Estrutura padrão aplicada: ${AE.dados.pastas.length} pastas.`); }
        if (a === 'cliente') { s.pastas.modo = 'cliente'; ctx.avisa(`Editor aberto. A estrutura fica salva para os próximos projetos de ${s.cliente}.`); }
        if (a === 'nova') {
          const n = await ctx.perguntar({ titulo: 'Nova pasta', texto: 'Nome da pasta, no padrão do projeto.', campo: 'Nome', valor: '14.2.30_' });
          if (!n) return; s.pastas.extras.push(n); ctx.avisa(`Pasta "${n}" criada.`);
        }
        if (a === 'replicar') { s.pastas.replicado = true; ctx.avisa(`Modelo da ST${AE.calc.listaEstacoes()[0].st} replicado para as outras estações.`); }
        ctx.salvar(); arvore();
      });

      /* concluir */
      $('#i-rascunho', el).onclick = () => { ctx.salvar(); ctx.avisa('Rascunho salvo neste navegador.'); };
      $('#i-criar', el).onclick = () => {
        const ruins = checagem();
        if (ruins.length) { ctx.avisa('Não foi possível criar: ' + ruins[0][0].toLowerCase() + ' (' + ruins[0][2] + ').', { tipo: 'erro' }); return; }
        s.pastas.criadas = true;
        ctx.concluir({ registro: `Projeto "${s.nome}" criado para ${s.cliente}, ${s.pastas.extras.length + AE.dados.pastas.length} pastas`, mensagem: 'Projeto criado e pastas criadas. Próximo: separar o produto em subdivisões.' });
        arvore();
      };
    },
  });
})();
