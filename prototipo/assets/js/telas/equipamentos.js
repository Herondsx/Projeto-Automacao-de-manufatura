/* Passo 5 · Equipamentos (Processo)
   Tela nova (passo "5" do fluxo da v0). Lista de equipamentos por estação, preliminar.
   Enquanto a fatia não tem itens, mostra a proposta automática de AE.calc.equipamentos() (a partir das
   estações do Passo 4); a primeira edição copia a proposta para a fatia.
   Fatia (contrato, lida por AE.calc.equipamentos e pela cobertura 6.1):
   {itens:[{id, st, tipo, modelo, qtd, origem:'nova'|'existente', obs, conferir}], homologados, fonte, garra:{[idRobô]: kg}}. */
(function () {
  'use strict';
  const AE = window.AE;
  const { $, $$, esc, fmt, clone, espera } = AE.util;

  const TIPOS = [
    ['robo', 'Robô', 'Robô industrial. O modelo vem da lista de homologados do cliente ou da biblioteca do programa.'],
    ['pinca', 'Pinça de solda', 'Pinça de solda a ponto levada pelo robô (ou fixa, na pinça estacionária).'],
    ['dispositivo', 'Dispositivo', 'Dispositivo de solda da estação (projeto da Mecânica).'],
    ['operador', 'Posto do operador', 'Posto de carga manual, com proteção (cortina de luz).'],
    ['cola', 'Cola', 'Aplicador ou pedestal de cola com bomba.'],
    ['pino', 'Pinos (tucker)', 'Pistola de pinos com alimentador.'],
    ['mig', 'Solda MIG', 'Tocha MIG com fonte.'],
    ['furacao', 'Furação', 'Equipamento de furação.'],
    ['mesa', 'Mesa', 'Mesa de apoio ou mesa giratória.'],
    ['grade', 'Grade', 'Grade de proteção da estação.'],
    ['outro', 'Outro', 'Qualquer outro equipamento: descreva no modelo.'],
  ];
  const NOME_TIPO = Object.fromEntries(TIPOS.map((t) => [t[0], t[1]]));
  const NOME_PLURAL = { robo: 'Robôs', pinca: 'Pinças', dispositivo: 'Dispositivos', operador: 'Postos manuais', cola: 'Cola', pino: 'Pinos', mig: 'MIG', furacao: 'Furação', mesa: 'Mesas', grade: 'Grades', outro: 'Outros' };
  const modeloPadrao = (tipo) => ({
    robo: AE.dados.robos[0].modelo, pinca: AE.dados.pincas[0].modelo, dispositivo: 'Dispositivo de solda',
    operador: 'Posto do operador com cortina de luz', cola: 'Pedestal de cola com bomba', pino: 'Pistola de pinos com alimentador',
    mig: 'Tocha MIG com fonte', furacao: 'Unidade de furação', mesa: 'Mesa giratória de 2 posições', grade: 'Módulo de grade de proteção', outro: '',
  })[tipo] || '';
  const daBiblioteca = (tipo) => tipo === 'robo' || tipo === 'pinca';
  const libRobo = (m) => AE.dados.robos.find((r) => r.modelo === m);
  const libPinca = (m) => AE.dados.pincas.find((p) => p.modelo === m);
  const numId = (id) => parseInt(String(id).replace(/\D/g, ''), 10) || 0;

  AE.tela({
    id: 'equipamentos', sigla: '5', area: 'proc', rotulo: 'Passo 5', titulo: 'Equipamentos',
    resumo: 'Lista de equipamentos por estação: robôs, pinças, dispositivos, postos manuais e o que o produto pede. Sai preliminar até a Mecânica devolver o payload.',
    tip: 'Abre a lista de equipamentos por estação: robôs, pinças, dispositivos e o que mais o produto pede.',
    entradas: [
      { de: 'inicio', o: 'Tipo de linha (nova ou retooling) e cliente' },
      { de: 'estacoes', o: 'Estações e robôs por estação' },
    ],
    inicial: () => ({ itens: [], homologados: false, fonte: '', garra: {}, pedidoPayload: '' }),
    programador: `
      <h3>O que esta tela guarda</h3>
      <ul>
        <li><code>itens[]</code>: <code>{id, st, tipo, modelo, qtd, origem, obs, conferir}</code>. <code>origem</code> é <code>nova</code> ou <code>existente</code>; <code>conferir</code> marca modelo da biblioteca do programa ainda não conferido com o cliente.</li>
        <li><code>homologados</code>: se a lista de fornecedores homologados do cliente foi importada. <code>fonte</code>: <code>cliente</code> ou <code>biblioteca</code>.</li>
        <li><code>garra</code>: peso da garra ou suporte de cada robô, em kg, devolvido pela Mecânica (<code>{E1: 35}</code>).</li>
      </ul>
      <h3>Regras</h3>
      <ul>
        <li>Enquanto não há itens gravados, a lista é a proposta automática a partir das estações do Passo 4, e acompanha o Passo 4. A primeira edição copia a proposta para a lista.</li>
        <li>Retooling: robôs e pinças entram como existentes (levantamento da linha).</li>
        <li>Sem lista de homologados: usa a biblioteca do programa e marca para conferir.</li>
        <li>Payload de cada robô = peso da pinça + peso da garra, e tem de caber na capacidade do robô.</li>
        <li>Peso da garra ainda não existe: lista preliminar, confirmada quando a Mecânica devolver o payload. O passo conclui como preliminar só por isso.</li>
        <li>Peso acima do robô: trocar o robô ou aliviar a garra (regra do M3 da Mecânica).</li>
        <li>Robôs na lista = robôs do Passo 4 em cada estação.</li>
        <li>Toda edição fica no registro do projeto.</li>
      </ul>
      <h3>Saída</h3>
      <ul>
        <li><code>AE.calc.equipamentos()</code>: <code>itens[]</code> por estação. Lida pela cobertura do produto (Passo 6.1), pelo layout (Passo 7) e pela Simulação (montar o ambiente, S1).</li>
      </ul>
      <h3>Macros de base</h3>
      <ul>
        <li><code>INSERT_PART</code>: inserir um componente da biblioteca na árvore.</li>
        <li><code>naams.xla</code>: biblioteca NAAMS (referência de catálogo).</li>
      </ul>
      <h3>Em aberto</h3>
      <ul>
        <li>Em que formato chega a lista de homologados do cliente (planilha, por fabricante, por tipo de equipamento)?</li>
        <li>O payload conta cabos e mangueiras (dress pack) além da pinça e da garra?</li>
        <li>Pinça reserva e trocador de pinças entram como itens desta lista?</li>
        <li>Mesa e grade são listadas aqui ou só no layout (Passos 7 e 11)?</li>
        <li>Suposição do protótipo: o peso da garra é digitado à mão quando a Mecânica devolve. No programa real ele viria do 3D da garra (M3).</li>
      </ul>`,

    render(ctx) {
      const t = ctx.termos();
      const opTipos = TIPOS.map(([v, n]) => `<option value="${v}">${esc(n)}</option>`).join('');
      return `
      <div class="bloco">
        <h2>Resumo</h2>
        <p class="sub">Quantidade de cada tipo de equipamento na linha, somando todas as estações.</p>
        <div id="eq-resumo"></div>
        <div id="eq-estado" style="margin-top:12px"></div>
      </div>

      <div class="bloco">
        <h2>De onde vêm os modelos</h2>
        <p class="sub">Robôs e pinças têm de ser de fornecedores homologados pelo cliente. Sem a lista do cliente, o programa usa a biblioteca dele e marca cada modelo para conferir.</p>
        <div id="eq-fonte"></div>
        <div class="barra" style="margin-top:12px">
          <button class="btn" id="eq-homolog" data-tip="Lê a lista de fornecedores homologados do cliente (planilha) e confere os robôs e pinças da lista com ela. Os itens deixam de ficar marcados para conferir.">Importar homologados do cliente</button>
          <button class="btn leve" id="eq-biblio" data-tip="Usa a biblioteca de robôs e pinças do programa. Os robôs e pinças ficam marcados para conferir com o cliente.">Usar biblioteca do programa</button>
        </div>
      </div>

      <div class="bloco">
        <h2>Lista por estação</h2>
        <p class="sub">Tudo pode ser editado: modelo, quantidade, origem e observação. Cada mudança fica registrada.</p>
        <div class="barra eq-add">
          <label class="campo">Estação<select id="eq-add-st"></select></label>
          <label class="campo">Tipo<select id="eq-add-tipo">${opTipos}</select></label>
          <button class="btn" id="eq-add" data-tip="Acrescenta um equipamento do tipo escolhido na estação escolhida, com o modelo padrão. Depois é só editar na tabela.">Adicionar item</button>
          <span class="eq-esp"></span>
          <button class="btn leve" id="eq-refazer" data-tip="Apaga a lista atual e volta à proposta automática a partir das estações e robôs do Passo 4. Pede confirmação. Use quando o Passo 4 mudar.">Refazer a partir das estações</button>
          <button class="btn" id="eq-cad" data-tip="Insere no ${esc(t.nome)} o modelo 3D de cada equipamento da biblioteca dentro do ${esc(t.product)} da sua estação, em posição provisória (o layout do Passo 7 corrige a posição).">Inserir no ${esc(t.nome)} <span class="cad-tag">CAD</span></button>
        </div>
        <div id="eq-aviso-lista"></div>
        <div class="rolagem"><table id="eq-tab">
          <thead><tr><th>Tipo</th><th>Modelo e observação</th><th class="num">Qtd</th><th>Origem</th><th>Situação</th><th>Estação</th></tr></thead>
          <tbody></tbody>
        </table></div>
      </div>

      <div class="bloco">
        <h2>Payload dos robôs</h2>
        <p class="sub">O robô tem de aguentar a pinça mais a garra (ou o suporte). O peso da pinça vem do catálogo; o peso da garra só existe quando a Mecânica modelar a garra (M3). Até lá a lista fica <b>preliminar</b>, só neste quesito.</p>
        <div id="eq-payload"></div>
        <div class="barra" style="margin-top:12px">
          <button class="btn leve" id="eq-pedir" data-tip="Registra o pedido do payload para a Mecânica, com a lista de robôs que estão aguardando o peso da garra.">Pedir payload à Mecânica</button>
          <span id="eq-pedido" style="color:var(--suave);font-size:13px"></span>
        </div>
      </div>

      <div class="bloco">
        <h2>Checagem</h2>
        <p class="sub">A lista conclui sem erros em vermelho. Sem o payload da Mecânica ela conclui como preliminar.</p>
        <div class="checagem" id="eq-check"></div>
        <div class="barra fim" style="margin-top:14px">
          <button class="btn primario" id="eq-concluir" data-tip="Confere a lista e conclui o Passo 5. Se faltar o peso de alguma garra, conclui como preliminar e avisa o que falta.">Concluir o Passo 5</button>
        </div>
      </div>`;
    },

    montar(el, ctx) {
      const s = ctx.s;
      s.itens = s.itens || [];
      s.garra = s.garra || {};
      AE.css('equipamentos', `
        .eq-add{margin-bottom:12px;align-items:flex-end}
        .eq-add .campo{min-width:150px}
        .eq-esp{flex:1}
        #eq-tab{min-width:720px}
        #eq-tab td{white-space:nowrap}
        #eq-tab select,#eq-tab input[type=text]{min-width:0}
        #eq-tab .eq-celmod{min-width:230px;width:45%}
        #eq-tab .eq-mod{width:100%}
        #eq-tab .eq-obs{width:100%;margin-top:4px;font-size:12.5px;padding:3px 7px;background:transparent;border-style:dashed}
        #eq-tab .eq-obs:focus{background:var(--fundo);border-style:solid}
        #eq-tab .eq-st{width:78px}
        #eq-tab .eq-tipo{width:136px}
        #eq-tab .eq-ori{width:98px}
        #eq-tab input.curto{width:58px}
        #eq-tab .eq-pils{display:flex;flex-wrap:wrap;gap:4px}
        #eq-tab .eq-acoes{display:flex;gap:6px;align-items:center}
        #eq-tab tr.eq-grupo td{background:var(--painel2);border-bottom:1px solid var(--linha2);padding:8px}
        #eq-tab tr.eq-grupo b{font-family:var(--f-titulo);font-size:16px;font-weight:600;letter-spacing:.02em;margin-right:8px}
        #eq-tab tr.eq-grupo small{color:var(--suave);font-size:12.5px;margin-right:8px}
        #eq-tab tr.eq-grupo .pilula{margin-right:6px}
        #eq-tab tr.proposta td{color:var(--suave)}
        .eq-pay{min-width:640px}
        .eq-pay td{white-space:nowrap}
        .eq-pay td.eq-rob{white-space:normal;min-width:150px}
        .eq-pay input{width:70px;text-align:right;font-family:var(--f-dado)}
        .eq-pay small{display:block;color:var(--fraco);font-size:12px;white-space:nowrap;font-family:var(--f-texto)}`);

      /* ---------- dados ---------- */
      const proposta = () => !(s.itens && s.itens.length);
      const lista = () => (proposta() ? AE.calc.equipamentos().itens : s.itens);
      const marcar = (i) => { i.conferir = daBiblioteca(i.tipo) ? !s.homologados : false; return i; };
      /* primeira edição: copia a proposta automática para a fatia */
      const materializar = () => {
        if (!proposta()) return false;
        s.itens = clone(AE.calc.equipamentos().itens).map(marcar);
        ctx.registrar(`Proposta automática copiada para a lista (${s.itens.length} itens). A partir daqui a lista não acompanha mais o Passo 4 sozinha.`);
        return true;
      };
      const proxId = () => 'E' + (Math.max(0, ...s.itens.map((i) => numId(i.id))) + 1);
      const estacoes = () => AE.calc.estacoes().estacoes;
      const robosPorSt = (itens) => {
        const m = {};
        itens.filter((i) => i.tipo === 'robo').forEach((i) => (m[i.st] = (m[i.st] || 0) + (Number(i.qtd) || 0)));
        return m;
      };

      /* ---------- desenho ---------- */
      const resumo = () => {
        const it = lista(), pj = AE.calc.projeto();
        const soma = {};
        it.forEach((i) => (soma[i.tipo] = (soma[i.tipo] || 0) + (Number(i.qtd) || 0)));
        const ordem = TIPOS.map((t) => t[0]).filter((k) => soma[k]);
        const exist = it.filter((i) => i.origem === 'existente').reduce((a, i) => a + (Number(i.qtd) || 0), 0);
        $('#eq-resumo', el).innerHTML = it.length
          ? `<div class="kpis">${ordem.map((k) => `<div class="kpi"><span>${esc(NOME_PLURAL[k] || k)}</span><b>${soma[k]}</b><small>${new Set(it.filter((i) => i.tipo === k).map((i) => i.st)).size} estação(ões)</small></div>`).join('')}</div>
             <p class="nota">${it.length} linhas na lista · ${exist ? `${exist} equipamento(s) existente(s), reaproveitado(s) da linha atual` : 'nenhum equipamento existente'} · linha ${pj.tipoLinha === 'retooling' ? '<b>retooling</b>' : 'nova'} para ${esc(pj.cliente)}</p>`
          : '<div class="vazio">A lista está vazia. Use "Adicionar item" ou "Refazer a partir das estações".</div>';
        const ests = estacoes();
        const rob = robosPorSt(it);
        const dif = ests.filter((e) => (rob[e.st] || 0) !== e.robos);
        const avisos = [];
        if (proposta()) avisos.push(`<p class="nota aviso"><b>Proposta automática a partir das estações</b> do Passo 4 <span class="exemplo">dados de exemplo</span><br>Ela acompanha o Passo 4 até a primeira edição; depois a lista é sua e o botão "Refazer a partir das estações" traz a proposta de novo.</p>`);
        else if (dif.length) avisos.push(`<div class="faixa-aviso"><span><b>Passo 4 mudou?</b> ${dif.map((e) => `ST${e.st} tem ${rob[e.st] || 0} robô(s) na lista e ${e.robos} no Passo 4`).join('; ')}. Ajuste a quantidade ou refaça a lista.</span>
          <button class="btn mini" data-refazer data-tip="Apaga a lista atual e volta à proposta automática a partir do Passo 4. Pede confirmação.">Refazer a partir das estações</button></div>`);
        if (pj.tipoLinha === 'retooling') avisos.push(`<p class="nota aviso">Retooling: robôs e pinças entram como <b>existentes</b> (levantamento da linha atual, Simulação S0). Mude para "nova" o que for comprado.</p>`);
        $('#eq-estado', el).innerHTML = avisos.join('');
      };

      const fonte = () => {
        const pj = AE.calc.projeto();
        $('#eq-fonte', el).innerHTML = s.homologados
          ? `<p class="nota ok">Lista de homologados de <b>${esc(pj.cliente)}</b> importada. Robôs e pinças conferidos com ela. <span class="exemplo">simulado</span></p>`
          : `<p class="nota aviso">${s.fonte === 'biblioteca' ? 'Usando a biblioteca do programa, por escolha.' : 'Sem lista de homologados do cliente: usando a biblioteca do programa (regra do fluxo).'} Robôs e pinças ficam marcados <b>conferir</b> até a lista de ${esc(pj.cliente)} chegar.</p>`;
      };

      const opcoesSt = (atual) => {
        const ests = AE.calc.listaEstacoes();
        const tem = ests.some((e) => e.st === Number(atual));
        return (tem ? '' : `<option value="${esc(atual)}" selected>ST${esc(atual)} (não existe)</option>`) +
          ests.map((e) => `<option value="${e.st}" ${e.st === Number(atual) ? 'selected' : ''}>ST${e.st}</option>`).join('');
      };
      const celModelo = (i) => {
        if (daBiblioteca(i.tipo)) {
          const lib = i.tipo === 'robo' ? AE.dados.robos : AE.dados.pincas;
          const fora = !lib.some((x) => x.modelo === i.modelo);
          return `<select class="eq-mod" data-k="modelo" data-id="${esc(i.id)}" aria-label="Modelo" data-tip="${esc(i.tipo === 'robo' ? 'Modelo do robô (biblioteca ou homologados). A capacidade de carga entra na conta do payload.' : 'Modelo da pinça. O peso entra na conta do payload do robô.')}">
            ${fora ? `<option selected>${esc(i.modelo)}</option>` : ''}${lib.map((x) => `<option ${x.modelo === i.modelo ? 'selected' : ''}>${esc(x.modelo)}</option>`).join('')}</select>`;
        }
        return `<input type="text" class="eq-mod" data-k="modelo" data-id="${esc(i.id)}" value="${esc(i.modelo)}" placeholder="descreva o equipamento" aria-label="Modelo">`;
      };

      const tabela = () => {
        const it = lista(), ests = estacoes(), rob = robosPorSt(it), prop = proposta();
        const sts = [...new Set(ests.map((e) => e.st).concat(it.map((i) => Number(i.st))))].sort((a, b) => a - b);
        const tb = $('#eq-tab tbody', el);
        if (!it.length) { tb.innerHTML = `<tr><td colspan="6"><div class="vazio">Nenhum equipamento. Use "Adicionar item" ou "Refazer a partir das estações".</div></td></tr>`; return; }
        tb.innerHTML = sts.map((st) => {
          const e = ests.find((x) => x.st === st);
          const doGrupo = it.filter((i) => Number(i.st) === st);
          const nRob = rob[st] || 0;
          const cab = e
            ? `<b>ST${st}</b><small>${esc(e.nome)} · Passo 4: ${e.robos} robô${e.robos === 1 ? '' : 's'}</small>${nRob !== e.robos ? `<span class="pilula erro" data-tip="${esc(`A lista tem ${nRob} robô(s) nesta estação e o Passo 4 pede ${e.robos}. Ajuste a quantidade ou use "Refazer a partir das estações".`)}">${nRob} robô(s) na lista</span>` : ''}${!doGrupo.some((i) => i.tipo === 'dispositivo') ? '<span class="pilula aviso" data-tip="Toda estação de solda precisa de um dispositivo.">sem dispositivo</span>' : ''}`
            : `<b>ST${st}</b><small>não existe mais no Passo 4</small><span class="pilula erro" data-tip="Esta estação não existe no Passo 4. Mude a estação dos itens ou remova-os.">estação não existe</span>`;
          const linhas = doGrupo.map((i) => {
            const pil = [];
            if (daBiblioteca(i.tipo)) pil.push(s.homologados ? '<span class="pilula ok" data-tip="Modelo conferido com a lista de homologados do cliente.">homologado</span>' : '<span class="pilula aviso" data-tip="Sem lista de homologados do cliente: o modelo vem da biblioteca do programa. Conferir com o cliente.">conferir</span>');
            if (!String(i.modelo || '').trim()) pil.push('<span class="pilula erro" data-tip="Descreva o equipamento no campo Modelo.">sem modelo</span>');
            if (String(i.obs || '').includes('6.1')) pil.push('<span class="pilula info" data-tip="Incluído pela checagem de cobertura do produto (Passo 6.1).">cobertura</span>');
            return `<tr class="${prop ? 'proposta' : ''}" data-linha="${esc(i.id)}">
              <td><select class="eq-tipo" data-k="tipo" data-id="${esc(i.id)}" aria-label="Tipo" data-tip="Tipo de equipamento. Ao trocar, o modelo volta ao padrão do tipo novo.">${TIPOS.map(([v, n]) => `<option value="${v}" ${v === i.tipo ? 'selected' : ''}>${esc(n)}</option>`).join('')}${NOME_TIPO[i.tipo] ? '' : `<option selected>${esc(i.tipo)}</option>`}</select></td>
              <td class="eq-celmod">${celModelo(i)}
                <input type="text" class="eq-obs" data-k="obs" data-id="${esc(i.id)}" value="${esc(i.obs)}" placeholder="observação" aria-label="Observação"></td>
              <td class="num"><input class="curto" type="number" min="1" step="1" data-k="qtd" data-id="${esc(i.id)}" value="${esc(i.qtd)}" aria-label="Quantidade"></td>
              <td><select class="eq-ori" data-k="origem" data-id="${esc(i.id)}" aria-label="Origem" data-tip="Nova: será comprada. Existente: reaproveitada da linha atual (retooling).">
                <option value="nova" ${i.origem !== 'existente' ? 'selected' : ''}>Nova</option><option value="existente" ${i.origem === 'existente' ? 'selected' : ''}>Existente</option></select></td>
              <td><div class="eq-pils">${pil.join('') || '<span class="pilula neutro">ok</span>'}</div></td>
              <td><div class="eq-acoes"><select class="eq-st" data-k="st" data-id="${esc(i.id)}" aria-label="Mover para a estação" data-tip="Estação onde o equipamento fica. Escolha outra para mover o item.">${opcoesSt(i.st)}</select>
                <button class="btn mini leve" data-rm="${esc(i.id)}" data-tip="Remove este equipamento da lista. Dá para desfazer pelo aviso.">Remover</button></div></td></tr>`;
          }).join('');
          return `<tr class="eq-grupo"><td colspan="6">${cab}</td></tr>${linhas || `<tr><td colspan="6"><div class="vazio">Nenhum equipamento nesta estação.</div></td></tr>`}`;
        }).join('');
        $('#eq-aviso-lista', el).innerHTML = prop ? '<p class="nota" style="margin:0 0 10px">Os valores em cinza são a proposta automática. Ao editar qualquer campo, a proposta vira a sua lista.</p>' : '';
      };

      const addSel = () => {
        const sel = $('#eq-add-st', el), atual = sel.value;
        sel.innerHTML = AE.calc.listaEstacoes().map((e) => `<option value="${e.st}" ${String(e.st) === atual ? 'selected' : ''}>${esc(e.rotulo)}</option>`).join('');
      };

      /* payload: uma linha por item de robô */
      const payloads = () => {
        const it = lista();
        return it.filter((i) => i.tipo === 'robo').map((r) => {
          const rl = libRobo(r.modelo);
          const pin = it.find((i) => i.tipo === 'pinca' && Number(i.st) === Number(r.st));
          const pl = pin ? libPinca(pin.modelo) : null;
          const g = s.garra[r.id];
          const temG = g !== undefined && g !== null && g !== '';
          const pesoP = pl ? pl.peso : pin ? null : 0;
          const total = temG && pesoP != null ? pesoP + Number(g) : null;
          let sit;
          if (!rl || pesoP == null) sit = ['neutro', 'conferir à mão', 'Modelo fora da biblioteca: o programa não sabe a capacidade do robô ou o peso da pinça.'];
          else if (!temG) sit = ['aviso', 'aguardando payload da Mecânica', 'Regra do fluxo: o peso da garra ainda não existe. A lista fica preliminar e é confirmada quando a Mecânica devolver o payload (M3).'];
          else if (total > rl.payload) sit = ['erro', `acima do robô em ${fmt(total - rl.payload, 0)} kg`, 'Peso acima do robô escolhido: troque o robô ou peça à Mecânica para aliviar a garra.'];
          else sit = ['ok', `cabe · sobra ${fmt(rl.payload - total, 0)} kg`, 'Pinça + garra dentro da capacidade de carga do robô.'];
          return { r, rl, pin, pl, g, temG, pesoP, total, sit };
        });
      };
      const payload = () => {
        const ps = payloads();
        $('#eq-payload', el).innerHTML = ps.length
          ? `<div class="rolagem"><table class="eq-pay"><thead><tr><th>ST</th><th>Robô e capacidade</th><th class="num">Pinça</th><th class="num" data-tip="Peso da garra ou do suporte, devolvido pela Mecânica (M3).">Garra</th><th class="num">Total</th><th>Situação</th></tr></thead><tbody>
            ${ps.map((p) => `<tr>
              <td class="mono">ST${esc(p.r.st)}</td>
              <td class="eq-rob">${esc(p.r.modelo.split(' · ')[0])}<small>${p.rl ? `aguenta ${p.rl.payload} kg` : 'capacidade desconhecida'} · ${p.r.qtd} robô(s) · ${esc(p.r.id)}</small></td>
              <td class="num">${p.pin ? (p.pl ? p.pl.peso + ' kg' : '?') : '0 kg'}<small>${p.pin ? (p.pl ? 'tipo ' + esc(p.pl.tipo) : 'fora da biblioteca') : 'sem pinça'}</small></td>
              <td class="num"><input type="number" min="0" step="1" data-garra="${esc(p.r.id)}" value="${p.temG ? esc(p.g) : ''}" placeholder="—" aria-label="Peso da garra em kg"
                data-tip="Peso da garra ou suporte deste robô, em kg, devolvido pela Mecânica (M3). Deixe vazio enquanto não chegar. Zero = robô só com a pinça."> kg</td>
              <td class="num">${p.total != null ? fmt(p.total, 0) + ' kg' : '—'}</td>
              <td><span class="pilula ${p.sit[0]}" data-tip="${esc(p.sit[2])}">${esc(p.sit[1])}</span></td></tr>`).join('')}
            </tbody></table></div>`
          : '<div class="vazio">Nenhum robô na lista: nada para conferir de payload.</div>';
        $('#eq-pedido', el).textContent = s.pedidoPayload ? `Pedido registrado às ${s.pedidoPayload}.` : '';
      };

      const checagem = () => {
        const it = lista(), ests = estacoes(), rob = robosPorSt(it), ps = payloads();
        const dif = ests.filter((e) => (rob[e.st] || 0) !== e.robos);
        const semDisp = ests.filter((e) => !it.some((i) => i.tipo === 'dispositivo' && Number(i.st) === e.st));
        const ruins = it.filter((i) => !String(i.modelo || '').trim() || !(Number(i.qtd) >= 1));
        const fora = [...new Set(it.filter((i) => !ests.some((e) => e.st === Number(i.st))).map((i) => 'ST' + i.st))];
        const acima = ps.filter((p) => p.sit[0] === 'erro');
        const falta = ps.filter((p) => p.sit[0] === 'aviso');
        const itens = [
          ['Robôs da lista = robôs do Passo 4', dif.length === 0, dif.map((e) => `ST${e.st}: ${rob[e.st] || 0} de ${e.robos}`).join(', '), 'erro'],
          ['Todo item tem modelo e quantidade', ruins.length === 0, `${ruins.length} item(ns) sem modelo ou com quantidade inválida`, 'erro'],
          ['Itens só em estações que existem', fora.length === 0, `${fora.join(', ')} não existe no Passo 4`, 'erro'],
          ['Toda estação tem dispositivo', semDisp.length === 0, semDisp.map((e) => 'ST' + e.st).join(', ') + ' sem dispositivo', 'aviso'],
          ['Fornecedores homologados do cliente', s.homologados, 'Biblioteca do programa: conferir', 'aviso'],
          ['Payload dentro da capacidade do robô', acima.length === 0, acima.map((p) => 'ST' + p.r.st).join(', ') + ' acima do robô', 'erro'],
          ['Payload da Mecânica recebido', falta.length === 0, `${falta.length} robô(s) aguardando: conclui como preliminar`, 'aviso'],
        ];
        $('#eq-check', el).innerHTML = itens.map((i) => `<div><span>${esc(i[0])}</span>${i[1] ? '<span class="pilula ok">Certo</span>' : `<span class="pilula ${i[3]}">${esc(i[2])}</span>`}</div>`).join('');
        return { erros: itens.filter((i) => !i[1] && i[3] === 'erro'), falta };
      };

      const desenha = () => {
        const f = document.activeElement && el.contains(document.activeElement) ? document.activeElement : null;
        const chave = f && (f.dataset.k ? `[data-k="${f.dataset.k}"][data-id="${f.dataset.id}"]` : f.dataset.garra ? `[data-garra="${f.dataset.garra}"]` : null);
        resumo(); fonte(); tabela(); addSel(); payload(); checagem();
        if (chave) { const n = $(chave, el); if (n) n.focus(); }
      };
      desenha();

      /* ---------- edição na tabela ---------- */
      $('#eq-tab', el).addEventListener('change', (e) => {
        const c = e.target.closest('[data-k]');
        if (!c) return;
        const k = c.dataset.k, id = c.dataset.id;
        materializar();
        const i = s.itens.find((x) => x.id === id);
        if (!i) { desenha(); return; }
        const antes = i[k];
        let v = c.value;
        if (k === 'qtd') {
          v = parseInt(v, 10);
          if (!(v >= 1)) { ctx.avisa('Quantidade: digite um número inteiro a partir de 1. Para tirar o item, use "Remover".', { tipo: 'erro' }); desenha(); return; }
        }
        if (k === 'st') v = Number(v);
        if (k === 'modelo' && !String(v).trim()) ctx.avisa('O item ficou sem modelo: descreva o equipamento antes de concluir.', { tipo: 'aviso' });
        i[k] = v;
        if (k === 'tipo') { i.modelo = modeloPadrao(v); marcar(i); }
        ctx.salvar();
        const nomes = { st: 'estação', tipo: 'tipo', modelo: 'modelo', qtd: 'quantidade', origem: 'origem', obs: 'observação' };
        if (k !== 'obs') ctx.registrar(`Equipamento ${i.id} (${NOME_TIPO[i.tipo] || i.tipo}, ST${i.st}): ${nomes[k]} ${k === 'st' ? 'ST' + antes : antes} → ${k === 'st' ? 'ST' + v : v}`);
        desenha();
      });

      el.addEventListener('change', (e) => {
        const g = e.target.closest('[data-garra]');
        if (!g) return;
        const id = g.dataset.garra, txt = g.value.trim();
        if (txt === '') {
          delete s.garra[id];
          ctx.salvar(); ctx.registrar(`Peso da garra do robô ${id} apagado: volta a aguardar a Mecânica`);
        } else {
          const v = Number(txt);
          if (!(v >= 0) || v > 2000) { ctx.avisa('Peso da garra: digite um número em kg (0 = sem garra). Deixe vazio enquanto a Mecânica não devolver.', { tipo: 'erro' }); g.value = s.garra[id] ?? ''; return; }
          s.garra[id] = Math.round(v);
          ctx.salvar(); ctx.registrar(`Peso da garra do robô ${id}: ${Math.round(v)} kg (devolvido pela Mecânica)`);
        }
        desenha();
      });

      el.addEventListener('click', async (e) => {
        const rm = e.target.closest('[data-rm]');
        if (rm) {
          materializar();
          const idx = s.itens.findIndex((x) => x.id === rm.dataset.rm);
          if (idx < 0) return;
          const [it] = s.itens.splice(idx, 1);
          ctx.salvar(); ctx.registrar(`Equipamento removido: ${it.id} (${NOME_TIPO[it.tipo] || it.tipo}, ${it.qtd}×, ST${it.st})`);
          desenha();
          ctx.avisa(`${NOME_TIPO[it.tipo] || it.tipo} removido da ST${it.st}.`, {
            acao: { texto: 'Desfazer', fn: () => { s.itens.splice(Math.min(idx, s.itens.length), 0, it); ctx.salvar(); ctx.registrar(`Remoção desfeita: ${it.id} de volta na ST${it.st}`); desenha(); } },
          });
          return;
        }
        if (e.target.closest('[data-refazer]')) refazer();
      });

      /* ---------- adicionar ---------- */
      $('#eq-add', el).onclick = () => {
        const st = Number($('#eq-add-st', el).value), tipo = $('#eq-add-tipo', el).value;
        if (!st) { ctx.avisa('Não há estações: conclua o Passo 4 primeiro (ou separe o produto no Passo 1).', { tipo: 'erro' }); return; }
        materializar();
        const pj = AE.calc.projeto();
        const it = marcar({ id: proxId(), st, tipo, modelo: modeloPadrao(tipo), qtd: 1, origem: pj.tipoLinha === 'retooling' && daBiblioteca(tipo) ? 'existente' : 'nova', obs: '' });
        s.itens.push(it);
        ctx.salvar(); ctx.registrar(`Equipamento incluído: ${it.id} (${NOME_TIPO[tipo]}, ST${st})`);
        desenha();
        ctx.avisa(`${NOME_TIPO[tipo]} incluído na ST${st}${tipo === 'outro' ? ': descreva o modelo na tabela' : ''}.`);
        const n = $(`[data-linha="${it.id}"] .eq-mod`, el);
        if (n) n.focus();
      };

      /* ---------- refazer ---------- */
      async function refazer() {
        if (proposta()) { ctx.avisa('A lista já é a proposta automática: ela acompanha o Passo 4.'); return; }
        const ok = await ctx.perguntar({
          titulo: 'Refazer a lista a partir das estações?',
          texto: `Apaga a lista atual (${s.itens.length} itens, inclusive o que foi editado ou incluído à mão) e volta à proposta automática a partir das estações e robôs do Passo 4. Os pesos de garra informados também são apagados.`,
          ok: 'Refazer a lista', perigo: true,
        });
        if (!ok) return;
        const n = s.itens.length;
        s.itens = []; s.garra = {};
        ctx.salvar(); ctx.registrar(`Lista de equipamentos refeita a partir das estações do Passo 4 (${n} itens antigos apagados)`);
        desenha();
        ctx.avisa('Lista refeita a partir das estações do Passo 4.', { tipo: 'ok' });
      }
      $('#eq-refazer', el).onclick = refazer;

      /* ---------- fonte dos modelos ---------- */
      $('#eq-homolog', el).onclick = async (e) => {
        const b = e.currentTarget, pj = AE.calc.projeto();
        b.setAttribute('aria-busy', 'true');
        await espera(700);
        b.removeAttribute('aria-busy');
        s.homologados = true; s.fonte = 'cliente';
        s.itens.forEach(marcar);
        ctx.salvar();
        const n = lista().filter((i) => daBiblioteca(i.tipo)).length;
        ctx.registrar(`Lista de homologados de ${pj.cliente} importada (simulado): ${AE.dados.robos.length} robôs e ${AE.dados.pincas.length} pinças. ${n} itens conferidos.`);
        desenha();
        ctx.avisa(`Homologados de ${pj.cliente} importados: ${n} robôs e pinças da lista conferidos.`, { tipo: 'ok' });
      };
      $('#eq-biblio', el).onclick = () => {
        s.homologados = false; s.fonte = 'biblioteca';
        s.itens.forEach(marcar);
        ctx.salvar(); ctx.registrar('Modelos de robô e pinça da biblioteca do programa: marcados para conferir com o cliente');
        desenha();
        ctx.avisa('Usando a biblioteca do programa. Robôs e pinças ficam marcados "conferir".', { tipo: 'aviso' });
      };

      /* ---------- payload ---------- */
      $('#eq-pedir', el).onclick = () => {
        const falta = payloads().filter((p) => p.sit[0] === 'aviso');
        if (!falta.length) { ctx.avisa('Nenhum robô aguardando: todos os pesos de garra já foram informados.'); return; }
        s.pedidoPayload = AE.util.hora();
        ctx.salvarUI();
        ctx.registrar(`Payload pedido à Mecânica para ${falta.map((p) => `${p.r.id} (ST${p.r.st})`).join(', ')}`);
        payload();
        ctx.avisa(`Pedido registrado: a Mecânica devolve o peso das garras no M3. Quando chegar, digite na coluna "Garra / suporte".`);
      };

      /* ---------- CAD ---------- */
      $('#eq-cad', el).onclick = async (e) => {
        const it = lista().filter((i) => daBiblioteca(i.tipo) || i.tipo === 'dispositivo');
        if (!it.length) { ctx.avisa('Nada para inserir: a lista não tem robôs, pinças nem dispositivos.', { tipo: 'erro' }); return; }
        const t = ctx.termos();
        const n = it.reduce((a, i) => a + (i.tipo === 'dispositivo' ? 1 : Number(i.qtd) || 0), 0);
        const sts = [...new Set(it.map((i) => 'ST' + i.st))];
        const ok = await ctx.cad({
          titulo: `Inserir ${n} equipamentos nas estações`,
          catia: `Set ests = CATIA.ActiveDocument.Product.Products\n' para cada item: robô, pinça e dispositivo da biblioteca\nests.Item("${sts[0]}").Products.AddComponentsFromFiles Array("<biblioteca>\\robo_solda_210kg.CATProduct"), "All"\n' posição provisória ao lado da estação; o layout do Passo 7 corrige`,
          nx: `var est = workPart.ComponentAssembly.RootComponent.FindObject("COMPONENT ${sts[0]} 1");\nworkPart.ComponentAssembly.AddComponent("<biblioteca>/robo_solda_210kg.prt", "MODEL", "${sts[0]}_R1", origem, orientacao, -1, out PartLoadStatus st);`,
          macro: 'INSERT_PART',
          resultado: `${n} componentes inseridos em ${sts.join(', ')} (posição provisória; ${it.filter((i) => i.tipo === 'dispositivo').length} dispositivo(s) como caixa envolvente até a Mecânica modelar).`,
        }, e.currentTarget);
        if (!ok) return;
        ctx.registrar(`Equipamentos inseridos no ${t.nome}: ${n} componentes em ${sts.join(', ')}`);
        ctx.avisa(`${n} equipamentos inseridos no ${t.nome}, em posição provisória.`, { tipo: 'ok' });
      };

      /* ---------- concluir ---------- */
      $('#eq-concluir', el).onclick = () => {
        const { erros, falta } = checagem();
        if (erros.length) {
          const r = erros[0];
          const como = {
            'Robôs da lista = robôs do Passo 4': 'Ajuste a quantidade de robôs na tabela ou use "Refazer a partir das estações".',
            'Todo item tem modelo e quantidade': 'Descreva o modelo e use quantidade a partir de 1.',
            'Itens só em estações que existem': 'Mude a estação desses itens ou remova-os.',
            'Payload dentro da capacidade do robô': 'Troque o modelo do robô por um de mais carga ou peça à Mecânica para aliviar a garra.',
          }[r[0]] || '';
          ctx.avisa(`Ainda não dá para concluir: ${r[2]}. ${como}`, { tipo: 'erro' });
          return;
        }
        if (!lista().length) { ctx.avisa('A lista está vazia: use "Refazer a partir das estações".', { tipo: 'erro' }); return; }
        if (materializar()) ctx.salvar();
        const n = s.itens.length;
        if (falta.length) {
          ctx.concluir({
            preliminar: true,
            registro: `Lista de equipamentos: ${n} itens. Payload da Mecânica pendente em ${falta.map((p) => 'ST' + p.r.st).join(', ')}`,
            mensagem: `Lista concluída como PRELIMINAR: falta o payload da Mecânica (${falta.map((p) => 'ST' + p.r.st).join(', ')}). Quando chegar, digite o peso da garra e conclua de novo.`,
          });
        } else {
          ctx.concluir({ registro: `Lista de equipamentos: ${n} itens, payload conferido${s.homologados ? ', homologados do cliente' : ', biblioteca do programa'}` });
        }
        desenha();
      };
    },
  });
})();
