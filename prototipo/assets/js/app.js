/* Automação de Engenharia · ordem do trilho e passos que ainda não têm tela.
   Para acrescentar uma tela: crie assets/js/telas/<id>.js, inclua o <script> no index.html
   e coloque o id no grupo certo abaixo. */
(function () {
  'use strict';
  const AE = window.AE;

  /* passos do fluxo que ainda não foram desenhados: aparecem no trilho, apagados */
  const aFazer = [
    ['seguranca', '8', 'proc', 'Lista de segurança', 'Lista de boas práticas preenchida a partir do layout e dos postos manuais. A análise de risco oficial é aprovada por outro departamento.'],
    ['ciclograma', '9', 'proc', 'Ciclograma', 'Ciclograma detalhado de cada estação, com os tempos reais dos robôs vindos da Simulação.'],
    ['fundacao', '10', 'proc', 'Fundação', 'Plano de fundação a partir do layout final e das cargas dos equipamentos.'],
    ['grades', '11', 'proc', 'Grades, calhas e armários', 'Planos de grade, calhas e armário, com as listas.'],
    ['instrucao', '12', 'proc', 'Folha de instrução e pacote final', 'Folhas de instrução, planos de pontos, cola e pinos, e a árvore do projeto.'],
    ['validacao', 'S3', 'sim', 'Validação e sequência', 'Segunda rodada da Simulação: folgas, trajetórias, sequência completa com colisão ligada, vídeos e entregas.'],
  ];
  aFazer.forEach(([id, sigla, area, titulo, tip]) => {
    if (!AE.telas[id]) AE.tela({ id, sigla, area, titulo, rotulo: (area === 'sim' ? 'Simulação ' : 'Passo ') + sigla, tip, aFazer: true, render: () => '' });
  });

  AE.iniciar([
    { grupo: 'Visão geral', area: '', ids: ['painel', 'fluxo'] },
    { grupo: 'Processo', area: 'proc', ids: ['inicio', 'separacao', 'tempos', 'ergonomia', 'estacoes', 'equipamentos', 'capacidade', 'layout'] },
    { grupo: 'Simulação', area: 'sim', ids: ['simulacao', 'validacao'] },
    { grupo: 'Mecânica', area: 'mec', ids: ['fixacao', 'unidades', 'conferir', 'saidas', 'outras'] },
    { grupo: 'Fechamento do processo', area: 'proc', ids: ['seguranca', 'ciclograma', 'fundacao', 'grades', 'instrucao'] },
  ]);
})();
