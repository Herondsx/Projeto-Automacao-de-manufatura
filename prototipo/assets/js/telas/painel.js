/* Painel inicial: o que é o protótipo, como usar, e o mapa de todas as telas com a situação de cada uma. */
(function () {
  'use strict';
  const AE = window.AE;
  const { esc, fmt } = AE.util;

  AE.tela({
    id: 'painel', sigla: '◎', area: 'visao', rotulo: '', titulo: 'Painel do projeto',
    resumo: 'O que é este protótipo, como usar, e onde o projeto está agora.',
    tip: 'Página inicial: como usar o protótipo e a situação de cada passo.',
    semStatus: true, semRodape: true,
    programador: `
      <h3>Como o protótipo é montado</h3>
      <ul>
        <li>HTML, CSS e JavaScript puros, sem build. Abre direto do disco ou pelo GitHub Pages.</li>
        <li>Uma tela por arquivo em <code>assets/js/telas/</code>, registrada com <code>AE.tela({...})</code>.</li>
        <li>Estado em <code>localStorage</code> (chave <code>ae-prototipo-v1</code>). Exportar e importar em JSON pelo menu Projeto.</li>
        <li>Cada tela declara de quais passos depende (<code>entradas</code>). Com isso o núcleo sabe o que é preliminar e o que precisa ser conferido de novo.</li>
        <li>Os botões de CAD chamam <code>AE.cad({...})</code>, que só registra no console a chamada que o programa real faria.</li>
      </ul>
      <h3>O que NÃO é</h3>
      <ul><li>Não é o programa. É o desenho das telas e das regras, para aprovar com a equipe antes de programar a integração com o CATIA e o NX.</li></ul>`,
    render() {
      const pj = AE.calc.projeto(), ee = AE.calc.estacoes(), sep = AE.calc.separacao();
      const ids = Object.values(AE.telas).filter((d) => d.area && d.area !== 'visao' && !d.aFazer);
      const conc = ids.filter((d) => AE.concluido(d.id)).length;
      const hist = AE.estado.historico.slice(0, 12);
      const ordemAreas = [['proc', 'Processo · planeja a linha'], ['sim', 'Simulação · prova que funciona'], ['mec', 'Mecânica · projeta dispositivos e garras']];
      const mapa = ordemAreas.map(([a, nome]) => {
        const telas = Object.values(AE.telas).filter((d) => d.area === a);
        return `<h3 class="rotulo-sec">${esc(nome)}</h3><div class="mapa">${telas.map((d) => `
          <a class="${a} ${d.aFazer ? 'afazer' : ''}" href="${d.aFazer ? '#/fluxo' : '#/' + d.id}" data-tip="${esc(d.aFazer ? 'Ainda não desenhada. Veja o que ela vai fazer no fluxo do projeto.' : d.tip || d.resumo || '')}" data-tip-titulo="${d.aFazer ? 'A fazer' : 'Abrir tela'}">
            <span class="linha1"><b>${esc(d.titulo)}</b><span>${esc(d.sigla)}</span></span>
            <small>${esc(d.resumo || d.tip || '')}</small>
            <span>${d.aFazer ? '<span class="pilula neutro">A fazer</span>' : AE.pilulaStatus(d.id)}</span></a>`).join('')}</div>`;
      }).join('');
      return `
      <div class="bloco boas-vindas">
        <div>
          <h2>Protótipo das telas do programa de engenharia</h2>
          <p class="sub">Este é o desenho do programa que vai automatizar a engenharia de linhas de solda de carroceria, comandando o <b>CATIA</b> ou o <b>NX</b> que já está aberto na máquina. O caminho é Processo → Simulação → Mecânica, com idas e voltas até fechar. Nada aqui conversa com um CAD de verdade: os botões simulam o que o programa faria.</p>
          <h3 class="rotulo-sec">Como usar</h3>
          <ol>
            <li><b>Passe o mouse</b> (ou dê Tab) em qualquer botão para ver o que ele executa.</li>
            <li><b>Comece pelo Passo 0</b> e siga o trilho da esquerda. Cada tela mostra no topo <b>o que ela recebe</b> dos outros passos.</li>
            <li>Pode pular passos: o programa usa um <b>valor de reserva</b> e marca a saída como <b>preliminar</b> (losango amarelo). Quando o passo de origem for concluído, quem depende dele avisa para <b>conferir de novo</b> (círculo vermelho).</li>
            <li>Os botões de CAD mandam o comando para o <b>Console do CAD</b> (barra de cima). Lá aparece a chamada da API e a macro antiga que serve de base. Troque entre CATIA e NX para ver a diferença.</li>
            <li>A coluna <b>Para o programador</b> traz as regras e os dados gravados de cada tela.</li>
            <li>Tudo fica salvo <b>neste navegador</b>. Use o menu <b>Projeto ▾</b> para exportar, importar ou reiniciar.</li>
          </ol>
        </div>
        <div class="coluna" style="gap:12px">
          <a class="btn primario" href="#/inicio" data-tip="Abre a tela onde o projeto é criado: cliente, volumes, turnos, layout de partida e pastas.">Começar pelo Passo 0 · Novo projeto</a>
          <a class="btn" href="#/fluxo" data-tip="Abre o fluxograma do projeto inteiro: o que entra em cada passo, o que fazer quando a informação não chega, e onde há revisão.">Ver o fluxo do projeto inteiro</a>
          <a class="btn" href="#/fixacao" data-tip="Vai direto para a parte da Mecânica: revisão do plano de fixação, montagem das unidades, alertas e desenhos.">Ir direto para a Mecânica</a>
          <div class="kpis" style="margin-top:6px">
            <div class="kpi"><span>Passos concluídos</span><b>${conc}/${ids.length}</b></div>
            <div class="kpi"><span>Ciclo de projeto</span><b>${fmt(pj.cicloAlvo, 1)} s</b><small>modelo mais exigente</small></div>
          </div>
        </div>
      </div>

      <div class="bloco">
        <h2>Onde o projeto está <span class="exemplo">dados de exemplo</span></h2>
        <p class="sub">Números que atravessam as telas. Mude o volume no Passo 0 ou as subdivisões no Passo 1 e veja estes valores mudarem.</p>
        <div class="kpis">
          <div class="kpi"><span>Projeto</span><b style="font-size:17px;font-family:var(--f-texto)">${esc(pj.nome)}</b><small>${esc(pj.cliente)} · linha ${pj.tipoLinha === 'retooling' ? 'retooling' : 'nova'}</small></div>
          <div class="kpi"><span>Pontos de solda no ciclo</span><b>${sep.pontos.filter((p) => !p.by).length}</b><small>${sep.pontos.filter((p) => p.by).length} dentro de BY, fora do ciclo</small></div>
          <div class="kpi"><span>Estações</span><b>${ee.estacoes.length}</b><small>${ee.estacoes.map((e) => 'ST' + e.st).join(' · ')}</small></div>
          <div class="kpi"><span>Robôs de solda</span><b>${ee.totalRobos}</b><small>máximo ${ee.maxRobos} por estação</small></div>
        </div>
      </div>

      <div class="bloco">
        <h2>Mapa do programa</h2>
        <p class="sub">Todas as telas, pela área dona. As apagadas ainda vão ser desenhadas; o que elas fazem já está no fluxo.</p>
        ${mapa}
      </div>

      <div class="bloco">
        <h2>Registro do projeto</h2>
        <p class="sub">Tudo o que foi concluído, alterado ou aceito como exceção fica registrado com a hora.</p>
        ${hist.length ? `<div class="registro">${hist.map((h) => `<span>${esc(h.hora)} · ${esc(AE.telas[h.tela] ? AE.telas[h.tela].rotulo || AE.telas[h.tela].titulo : '—')} · ${esc(h.texto)}</span>`).join('')}</div>` : '<div class="vazio">Nada registrado ainda. Comece pelo Passo 0.</div>'}
      </div>`;
    },
  });
})();
