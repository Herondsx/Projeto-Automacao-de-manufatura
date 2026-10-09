/* Visão geral · Fluxo do projeto
   Porta da tela FLUXO da v0 do Bruno, com todo o conteúdo dele (fases, laços, revisões).
   O que muda aqui: cada passo mostra a situação da tela que o implementa e leva até ela,
   o passo atual do projeto fica destacado e a cobertura do produto vem do Passo 6.1 (só leitura).
   Esta tela não tem saída: só lê AE.telas, a situação dos passos e AE.calc. */
(function () {
  'use strict';
  const AE = window.AE;
  const { $, $$, esc } = AE.util;

  /* ======================= dados de domínio (v0) =======================
     cada passo: [área, número, título, entradas[[o quê, quem fornece]], se não receber[[situação, o que o programa faz]], entrega, revisão] */
  const FASES = [
    ['A · Abertura', [
      ['proc', '0', 'Novo projeto',
        [['Cliente, nome do projeto, linha nova ou retooling', 'Usuário'], ['Carros por hora e por dia, de cada modelo', 'Cliente'], ['Turnos, horas por turno, disponibilidade', 'Cliente'], ['Layout de partida', 'Cliente ou vendas'], ['Padrão do cliente: pastas, nomes, normas', 'Cadastro do cliente']],
        [['Sem layout de partida', 'começa do zero e o programa sugere as estações'], ['Cliente sem estrutura de pastas cadastrada', 'usa a estrutura padrão do programa'], ['Volumes não fecham', 'não cria o projeto e mostra a conta']],
        'Projeto criado, pastas criadas, tempo de ciclo por modelo.', '']]],
    ['B · Processo, primeira passada', [
      ['proc', '1', 'Separação do produto',
        [['Produto em 3D', 'Cliente'], ['Lista de pontos: planilha, 3D ou desenho 2D', 'Cliente'], ['Número de chapas por ponto', 'Cliente'], ['O que já chega soldado (BY)', 'Usuário']],
        [['Sem planilha de pontos', 'lê os pontos direto do 3D ou do desenho 2D'], ['Sem número de chapas', 'conta pela geometria e avisa onde há mais de 2'], ['Sem número definitivo de estação', 'numera de 10 em 10 e troca depois, com registro']],
        'Subdivisões (um Product cada) com os pontos ligados às peças.', 'Produto revisado pelo cliente reabre este passo.'],
      ['proc', '2', 'Tempos padrão',
        [['Tabela de tempos do cliente', 'Cliente'], ['Tempos do operador (MTM)', 'Usuário']],
        [['Cliente não tem tabela', 'usa a tabela de referência do programa, editável por projeto'], ['MTM não preenchido', 'o posto manual fica sem tempo e aparece como pendente']],
        'Tabela de tempos do projeto.', ''],
      ['proc', '3', 'Operador e ergonomia',
        [['Modelo 3D do operador do projeto', 'Cliente'], ['Posição do operador e lado da base', 'Usuário, no CAD']],
        [['Projeto sem modelo de operador', 'usa o operador de referência, de 173 cm'], ['Alcance em zona amarela ou vermelha', 'pergunta se pode ajustar a posição'], ['Item de manutenção acima de 1800 mm', 'pede plataforma']],
        'Postos manuais conferidos e apresentação de ergonomia.', 'Ergonomia é apresentada ao cliente para aprovação.'],
      ['proc', '4', 'Necessidade de estações',
        [['Pontos de geometria', 'Usuário ou fabricante'], ['Estações já definidas, se houver', 'Cliente ou vendas'], ['Subdivisões e tempos', 'Passos 1 e 2']],
        [['Pontos de geometria não definidos', 'usa o mínimo de 2 por junção'], ['Sem estações definidas', 'o programa sugere a quantidade'], ['Estações definidas não dão o ciclo', 'mostra as opções: mais robôs ou mais estações']],
        'Quantidade de estações e de robôs, com a ordem de montagem.', ''],
      ['proc', '5', 'Equipamentos',
        [['Fornecedores homologados', 'Cliente'], ['Peso das garras (payload)', 'Mecânica'], ['Pinças existentes, no retooling', 'Levantamento da linha']],
        [['Peso da garra ainda não existe', 'lista preliminar, confirmada quando a Mecânica devolver o payload'], ['Sem lista de homologados', 'usa a biblioteca do programa e marca para conferir']],
        'Lista de equipamentos por estação, preliminar.', ''],
      ['proc', '6', 'Capacidade por robô e macro ciclo',
        [['Tempo de ciclo de cada modelo', 'Passo 0'], ['Estações, robôs e tempos padrão', 'Passos 2, 4 e 5']],
        [['Equipamento ainda sem definição', 'calcula com o tempo padrão da tabela e marca como conceito'], ['Não dá o ciclo', 'mostra as saídas: pinça estacionária, garra dupla, garra com pinça, mais um robô']],
        'Quantos pontos cada robô e cada estação pode soldar, e o macro ciclo. O Processo diz a quantidade; quem escolhe quais pontos é a Simulação.', ''],
      ['proc', '6.1', 'Cobertura do produto',
        [['Tudo o que o produto contém: pontos, cola, pinos, furos, MIG', 'Passo 1'], ['Lista de equipamentos e operações', 'Passos 5 e 6']],
        [['Produto pede algo que não tem equipamento', 'aponta a estação e propõe o equipamento que falta'], ['Tem o equipamento mas não tem a operação', 'aponta a operação que falta no macro ciclo']],
        'Processo conferido: nada do produto ficou sem dono.', 'Roda de novo a cada revisão do produto.'],
      ['proc', '7', 'Layout',
        [['Desenho do prédio e zero predial', 'Cliente'], ['Posição dos robôs', 'Simulação'], ['Padrão de grade e de painéis', 'Cliente'], ['Equipamentos', 'Passo 5']],
        [['Posições da Simulação ainda não vieram', 'desenha o layout preliminar e atualiza quando chegarem'], ['Mangueira de cola acima de 12 m ou cabo fora de 7, 15 ou 20 m', 'avisa e pede para mover o equipamento'], ['Distância da grade abaixo da norma', 'mostra a altura de grade que resolve']],
        'Layout em DWG, com grades, painéis e plano de retirada de robô.', 'Layout é aprovado pelo cliente.'],
      ['proc', '8', 'Lista de segurança',
        [['Layout', 'Passo 7'], ['Postos manuais', 'Passo 3']],
        [['Item da lista sem resposta', 'fica pendente e aparece no resumo']],
        'Lista de boas práticas preenchida.', 'A análise de risco oficial é aprovada por outro departamento.']]],
    ['C · Simulação, primeira rodada', [
      ['sim', 'S0', 'Levantamento da linha existente',
        [['Linha atual: robôs, pinças, programas', 'Cliente']],
        [['Linha nova', 'este passo é pulado']],
        'Relatório do estado da linha (só no retooling).', ''],
      ['sim', 'S1', 'Montar o ambiente',
        [['Produto com os pontos, na posição definida', 'Processo, passos 1 e 3'], ['Equipamentos e layout, conforme forem ficando prontos', 'Processo, passos 5 e 7'], ['Biblioteca de robôs e pinças', 'Programa']],
        [['Equipamentos ainda não definidos', 'começa só com o produto e vai inserindo os equipamentos conforme chegam'], ['Equipamento fora da biblioteca', 'usuário carrega o 3D e ele passa a fazer parte da biblioteca'], ['Mais pinças que o limite do PLC', 'divide em mais de um estudo']],
        'Um estudo por PLC e zona, com tudo dentro da zona de segurança.', 'Cada equipamento novo ou revisado gera uma versão nova do estudo.'],
      ['sim', 'S2', 'Acessos e distribuição dos pontos',
        [['Quantos pontos cabem em cada robô e estação', 'Processo, passo 6'], ['Pinças disponíveis', 'Biblioteca e fornecedores'], ['Força máxima de cada pinça', 'Fabricante da pinça']],
        [['Ponto sem acesso', '1º redistribuir, 2º pinça nova, 3º troca de pinça'], ['Robô não alcança', 'move o robô de 50 em 50 mm'], ['Força da pinça nova não informada', 'segue e deixa um alerta para verificar depois'], ['Pinça existente sem força suficiente', 'impede o ponto nessa pinça'], ['Pontos não cabem na quantidade do Processo', 'devolve ao Processo com o motivo']],
        'Distribuição dos pontos (quais pontos em cada robô) e nuvem de pinças (JT e CGR), para a Mecânica modelar o 3D.', 'A Simulação é quem define quais pontos vão em cada robô.']]],
    ['D · Mecânica', [
      ['mec', 'M1', 'Revisão do plano de fixação',
        [['Plano de fixação: RPS, Datum, PCM, PLP ou pré-método', 'Cliente'], ['Produto em 3D da estação', 'Processo, passo 1']],
        [['Cliente não enviou o plano', 'o usuário monta a proposta com a ajuda de "Sugerir pontos" e envia para aprovação'], ['Cliente ainda não respondeu', 'a modelagem começa, mas fica preliminar']],
        'Pontos aprovados e lista de unidades a modelar.', 'Cliente revisa e aprova, ponto por ponto.'],
      ['mec', 'M2', 'Montar unidades e 3D do dispositivo',
        [['Pontos aprovados', 'M1'], ['Nuvem de pinças', 'Simulação, S2'], ['Padrão de construção (project book)', 'Cliente'], ['Biblioteca de unidades', 'Programa']],
        [['Nuvem de pinças não chegou', 'modela assim mesmo e marca tudo para conferência'], ['Chegou nuvem nova', 'mostra as unidades que colidem com as pinças']],
        'Dispositivo e garras em 3D, ligados ao 2D.', ''],
      ['mec', 'M3', 'Peso, listas e sequência',
        [['3D do dispositivo e das garras', 'M2']],
        [['Peso acima do robô escolhido', 'avisa o Processo para trocar o robô ou aliviar a garra']],
        'Payload, lista de materiais, sequência de abertura e fechamento.', 'Payload volta ao Processo e à Simulação.'],
      ['mec', 'M4', 'Revisões de projeto do dispositivo',
        [['3D, listas e sequência', 'M2 e M3'], ['Resultado da simulação', 'Simulação, segunda rodada']],
        [['Cliente devolveu comentários', 'cada comentário vira uma pendência ligada à unidade'], ['Simulação achou colisão', 'a unidade volta para ajuste']],
        'Dispositivo liberado para detalhar e fabricar.', 'Cliente revisa o dispositivo em três etapas: DR01, DR02 e DR03.']]],
    ['E · Simulação, segunda rodada', [
      ['sim', 'S3', 'Validação',
        [['3D de dispositivos e garras', 'Mecânica, M2'], ['Payload', 'Mecânica, M3'], ['Macro ciclo', 'Processo, passo 6']],
        [['Folga menor que a tabela', 'registra na folha de problemas e avisa a Mecânica'], ['Tempo do robô estoura o ciclo', 'avisa o Processo']],
        'Folgas, trajetórias, áreas de interferência e segurança do robô conferidas.', ''],
      ['sim', 'S4', 'Sequência completa da estação',
        [['Ciclograma', 'Processo, passo 9'], ['Sequência de abertura e fechamento', 'Mecânica, M3']],
        [['Sequência não bate com o ciclograma', 'avisa na hora o Processo ou a Mecânica'], ['Dispositivo ou garra mudou', 'a sequência precisa ser validada de novo']],
        'Vídeos e sequência validada com colisão ligada.', 'Só depois disso o dispositivo é liberado para fabricação.'],
      ['sim', 'S5', 'Entregas da Simulação',
        [['Tudo o que foi validado', 'S3 e S4']],
        [['Entrega faltando', 'aparece na lista de conferência da etapa']],
        'Pacote de entregas da Simulação.', 'Cliente revisa em três etapas: DR01, DR02 e DR03.']]],
    ['F · Fechamento do Processo', [
      ['proc', '9', 'Ciclograma',
        [['Tempos reais dos robôs', 'Simulação, S3'], ['Sequência do dispositivo', 'Mecânica, M3']],
        [['Tempos reais ainda não vieram', 'mantém o macro ciclo como referência'], ['Não dá o ciclo', 'gera alerta e mostra as opções']],
        'Ciclograma detalhado de cada estação.', ''],
      ['proc', '10', 'Fundação',
        [['Layout final', 'Passo 7'], ['Cargas dos equipamentos', 'Fabricantes']],
        [['Carga não informada', 'usa a do catálogo e marca para conferir']],
        'Plano de fundação.', ''],
      ['proc', '11', 'Grades, calhas e armários',
        [['Layout final', 'Passo 7'], ['Padrão de grade', 'Cliente'], ['O que passa em cada calha', 'Passo 5']],
        [['Vão que não fecha com módulo padrão', 'usa módulo especial só na sobra']],
        'Planos de grade, calhas e armário, com as listas.', ''],
      ['proc', '12', 'Folha de instrução e pacote final',
        [['3D final', 'Mecânica e Simulação'], ['Ciclograma', 'Passo 9']],
        [['Imagem automática não ficou boa', 'o usuário troca a imagem']],
        'Folhas de instrução, planos de pontos, cola e pinos, e a árvore do projeto.', 'Pacote entregue ao cliente.']]],
  ];

  /* os 4 laços entre as áreas: [número, título, o que vai, ida/volta, situação agora] */
  const LACOS = [
    ['1', 'Processo → Simulação', 'Produto separado, ergonomia, posição do produto e tempo macro (macro ciclo)', 'ida', () => {
      const ok = AE.concluido('capacidade');
      return ok ? ['ok', 'Macro ciclo entregue', 'O Passo 6 foi concluído: a Simulação já tem a quantidade de pontos por robô.']
        : ['neutro', 'Ainda não', 'O Passo 6 (capacidade e macro ciclo) ainda não foi concluído. A Simulação trabalha com o valor de reserva.'];
    }],
    ['2', 'Simulação → Mecânica', 'Acessos, distribuição dos pontos e a nuvem de pinças, para a Mecânica modelar o 3D', 'ida', () => {
      const n = AE.calc.simulacao().nuvem || {};
      return n.entregue ? ['ok', `Nuvem ${n.versao || ''} entregue`, 'A Simulação gerou a nuvem de pinças. A Mecânica usa para conferir colisão das unidades.']
        : ['neutro', 'Nuvem não entregue', 'A nuvem de pinças ainda não foi gerada na tela da Simulação (aba Nuvem de pinças).'];
    }],
    ['3', 'Mecânica → Simulação', 'Dispositivos e garras concluídos, para validar', 'volta', () => {
      const ok = AE.concluido('unidades');
      return ok ? ['ok', 'Dispositivos entregues', 'A Mecânica concluiu a montagem das unidades. A segunda rodada da Simulação pode validar.']
        : ['neutro', 'Ainda não', 'A montagem das unidades (M2) ainda não foi concluída.'];
    }],
    ['4', 'Simulação → Processo', 'Tudo validado. O Processo faz os desenhos construtivos e de instalação', 'volta', () => {
      const d = AE.telas.validacao;
      if (!d || d.aFazer) return ['neutro', 'Tela a fazer', 'A tela de validação (segunda rodada da Simulação) ainda não foi desenhada.'];
      return AE.concluido('validacao') ? ['ok', 'Validado', 'A segunda rodada da Simulação foi concluída.'] : ['neutro', 'Ainda não', 'A validação ainda não foi concluída.'];
    }],
  ];

  /* quando chega uma revisão: [o que chegou, o que o programa faz, quem trata, tela onde acontece] */
  const REVISOES = [
    ['Produto novo do cliente', 'Registra a mudança, compara as superfícies no 3D e compara pontos de solda, cola e pinos. Depois roda a cobertura de novo', 'Processo', 'separacao'],
    ['Plano de fixação novo', 'Reabre só os pontos que mudaram e pede nova aprovação', 'Mecânica', 'fixacao'],
    ['Nuvem de pinças nova', 'Mostra as unidades do dispositivo que passaram a colidir', 'Mecânica', 'conferir'],
    ['Layout alterado', 'Confere cabos, mangueiras, grades e avisa a Simulação', 'Processo', 'layout'],
    ['Troca de número de estação', 'Atualiza todos os documentos e guarda o registro', 'Todos', 'separacao'],
    ['Comentário do cliente em revisão', 'Vira pendência com dono e prazo, até ser fechada', 'Quem recebeu', null],
  ];

  /* qual tela do protótipo implementa cada passo do fluxo (a primeira é a principal) */
  const TELAS = {
    '0': ['inicio'], '1': ['separacao'], '2': ['tempos'], '3': ['ergonomia'], '4': ['estacoes'], '5': ['equipamentos'],
    '6': ['capacidade'], '6.1': ['capacidade'], '7': ['layout'], '8': ['seguranca'],
    '9': ['ciclograma'], '10': ['fundacao'], '11': ['grades'], '12': ['instrucao'],
    S0: ['simulacao'], S1: ['simulacao'], S2: ['simulacao'], S3: ['validacao'], S4: ['validacao'], S5: ['validacao'],
    M1: ['fixacao'], M2: ['unidades', 'conferir'], M3: ['saidas', 'outras'], M4: ['fixacao'],
  };
  const NOTAS = {
    '6.1': 'A checagem de cobertura mora na tela do Passo 6 (Capacidade), em um bloco próprio. O resumo dela está mais abaixo nesta página.',
    S0: () => AE.calc.projeto().tipoLinha === 'retooling'
      ? 'Este projeto é retooling: o levantamento da linha existente é obrigatório (aba S0 da tela da Simulação).'
      : 'Este projeto é linha nova: o S0 é pulado. A aba S0 da tela da Simulação mostra isso.',
    S1: 'S0, S1 e S2 ficam na mesma tela da Simulação, uma aba por passo.',
    S2: 'S0, S1 e S2 ficam na mesma tela da Simulação, uma aba por passo. A distribuição gravada lá volta para a capacidade do Passo 6.',
    M2: 'No protótipo este passo virou duas telas: montar as unidades e conferir os alertas (colisão com a nuvem de pinças, grampo, parafusos).',
    M3: 'No protótipo, peso, listas e sequência saem da tela de desenhos e listas; as unidades especiais (piloto retrátil, basculante, garra) ficam em "outras unidades".',
    M4: 'As revisões DR01, DR02 e DR03 do dispositivo reaproveitam o ciclo de revisão da M1: o cliente revisa, devolve comentários ponto a ponto e aprova, com quem e quando. Por isso este passo abre a tela da M1.',
  };
  const AREA = { proc: 'Processo', sim: 'Simulação', mec: 'Mecânica' };
  const ORI_ST = { tela: 'concluido', andamento: 'andamento', reserva: 'preliminar' };
  const ORI_TXT = { tela: 'recebido', andamento: 'parcial', reserva: 'valor de reserva' };

  const navegavel = (id) => !!(AE.telas[id] && !AE.telas[id].aFazer);
  const feito = (id) => ['concluido', 'preliminar'].includes(AE.statusVisivel(id));
  const nomeTela = (id) => { const d = AE.telas[id]; return d ? (d.rotulo ? d.rotulo + ' · ' : '') + d.titulo : id; };
  const todosNos = () => FASES.flatMap((f) => f[1]);
  /* passo atual = o primeiro do fluxo cuja tela existe e ainda não foi concluída (ou precisa ser conferida de novo) */
  function passoAtual() {
    for (const p of todosNos()) {
      const ids = (TELAS[p[1]] || []).filter(navegavel);
      const pend = ids.find((id) => !feito(id));
      if (pend) return { n: p[1], titulo: p[2], area: p[0], id: pend };
    }
    return null;
  }

  function htmlTelasDoNo(n) {
    const ids = TELAS[n] || [];
    if (!ids.length) return '';
    return ids.map((id) => navegavel(id)
      ? `<div class="fx-tela"><a class="btn mini" href="#/${esc(id)}" data-tip="${esc('Abre a tela ' + nomeTela(id) + ', onde este passo é feito.')}">Abrir tela</a><span>${esc(nomeTela(id))}</span>${AE.pilulaStatus(id)}</div>`
      : `<div class="fx-tela"><span class="pilula neutro" data-tip="Esta tela ainda não foi desenhada no protótipo. O que ela vai fazer está descrito acima.">Tela a fazer</span><span>${esc(nomeTela(id))}</span></div>`).join('');
  }
  function htmlEntradasDeclaradas(n) {
    const id = (TELAS[n] || [])[0];
    if (!navegavel(id)) return '';
    const ent = AE.telas[id].entradas || [];
    if (!ent.length) return '';
    return `<div><h4>No protótipo, a tela recebe</h4><ul class="fx-ent">${ent.map((x) => {
      const o = AE.origem(x.de), d = AE.telas[x.de];
      return `<li><span class="st ${ORI_ST[o]}" aria-hidden="true"></span><span>${esc(x.o)} <small>· ${esc(d ? d.rotulo || d.titulo : x.de)} · ${ORI_TXT[o]}</small></span></li>`;
    }).join('')}</ul></div>`;
  }
  function htmlNo(p, atual) {
    const [area, n, titulo, recebe, falta, entrega, revisao] = p;
    const principal = (TELAS[n] || [])[0];
    const nota = typeof NOTAS[n] === 'function' ? NOTAS[n]() : NOTAS[n];
    const pulado = n === 'S0' && AE.calc.projeto().tipoLinha !== 'retooling';
    const ehAtual = atual && atual.n === n;
    return `<details class="fx-no ${area}${ehAtual ? ' atual' : ''}" data-n="${esc(n)}" data-area="${area}">
      <summary><span class="num">${esc(n)}</span><strong>${esc(titulo)}</strong>
        <span class="chip ${area}">${AREA[area]}</span>${revisao ? '<span class="chip rev" data-tip="Alguém de fora (normalmente o cliente) precisa aprovar a entrega deste passo.">Revisão</span>' : ''}
        ${ehAtual ? '<span class="pilula info" data-tip="Primeiro passo do fluxo cuja tela ainda não foi concluída. É por aqui que o projeto continua.">Passo atual</span>' : ''}
        ${pulado ? '<span class="pilula neutro" data-tip="Linha nova: não há linha existente para levantar. Este passo é pulado.">Pulado: linha nova</span>' : ''}
        ${principal ? AE.pilulaStatus(principal) : ''}</summary>
      <div class="fx-corpo">
        <div><h4>Precisa receber</h4><ul>${recebe.map((e) => `<li>${esc(e[0])} <small>· ${esc(e[1])}</small></li>`).join('')}</ul></div>
        <div class="fx-falta"><h4>Se não receber</h4><ul>${falta.map((e) => `<li>${esc(e[0])}: <span>${esc(e[1])}.</span></li>`).join('')}</ul></div>
        <div><h4>Entrega</h4><p>${esc(entrega)}</p>${revisao ? `<h4 style="margin-top:10px">Revisão</h4><p class="fx-rev">${esc(revisao)}</p>` : ''}</div>
        <div class="fx-pe">
          ${htmlTelasDoNo(n)}
          ${nota ? `<p class="nota">${esc(nota)}</p>` : ''}
          ${htmlEntradasDeclaradas(n)}
        </div>
      </div></details>`;
  }

  AE.tela({
    id: 'fluxo', sigla: '≡', area: 'visao', rotulo: '', titulo: 'Fluxo do projeto',
    resumo: 'O caminho inteiro: o que entra em cada passo, o que o programa faz quando a informação não chega, e onde há revisão.',
    tip: 'Abre o fluxograma do projeto inteiro: o que entra em cada passo, o que fazer quando a informação não chega, e onde há revisão com o cliente.',
    semStatus: true, semRodape: true,
    entradas: [],
    inicial: () => ({ area: 'tudo' }),
    programador: `
      <h3>O que esta tela guarda</h3>
      <ul><li>Só o filtro de área escolhido (<code>area</code>), como estado de tela. Nenhum dado do projeto.</li></ul>
      <h3>O fluxo é um grafo</h3>
      <ul>
        <li>Cada passo declara suas <code>entradas</code>, sua <code>saída</code> e de quais passos depende.</li>
        <li>Toda saída tem estado: conceito (<code>C1</code>, <code>C2</code>…) ou final (<code>F1</code>).</li>
        <li>Entrada que não chegou não trava o passo. Ele roda com o valor de reserva e a saída fica preliminar, marcada "para conferência".</li>
        <li>Quando a entrada chega, o programa avisa quais passos precisam ser conferidos de novo.</li>
      </ul>
      <h3>Como o protótipo implementa o grafo</h3>
      <ul>
        <li>Cada tela declara <code>entradas: [{de, o}]</code>. O núcleo mostra isso no topo da tela, na faixa "O que esta tela recebe".</li>
        <li><code>AE.origem(id)</code> diz de onde vem cada entrada: <code>tela</code> (passo concluído), <code>andamento</code> (parcial) ou <code>reserva</code> (nada ainda; <code>AE.calc.*</code> devolve o valor de reserva).</li>
        <li>Concluir com alguma entrada que não seja <code>tela</code> grava o passo como <b>preliminar</b> (losango amarelo).</li>
        <li>Cada conclusão ganha um número de sequência. Se um passo de origem for concluído depois do dependente, o dependente fica <b>conferir de novo</b> (círculo vermelho) e mostra a faixa "Entrada mudou".</li>
        <li>Alterar um passo concluído o devolve para "em andamento" e fica no registro.</li>
        <li>O mapa passo → tela fica neste arquivo (<code>TELAS</code>). O passo atual é o primeiro do fluxo cuja tela existe e não está concluída nem preliminar.</li>
      </ul>
      <h3>Revisões</h3>
      <ul>
        <li>Todo arquivo, recebido ou gerado, tem <code>versão</code> e data.</li>
        <li>Nome da versão: conceito é <code>C1</code>, <code>C2</code>, <code>C3</code>… Final é <code>F1</code>, <code>F2</code>… O ideal é existir só o <code>F1</code>.</li>
        <li>Passar de C para F exige a aprovação registrada. Mudança depois do F1 cria F2 e pede o motivo.</li>
        <li>Nova versão gera uma lista de diferenças: o que entrou, saiu e mudou de lugar.</li>
        <li>Passo com revisão de fora só vira final com a aprovação registrada: quem aprovou e quando.</li>
      </ul>
      <h3>Cobertura do produto</h3>
      <ul>
        <li>Tabela <code>conteúdo do produto → equipamento + operação</code>, por projeto, e que aceita novas linhas.</li>
        <li>Roda sozinha depois da capacidade por robô e a cada revisão do produto.</li>
        <li>Item sem cobertura impede a liberação do processo.</li>
        <li>No protótipo ela mora no Passo 6.1 (tela da capacidade). Aqui é só leitura de <code>AE.calc.cobertura()</code>.</li>
      </ul>
      <h3>Saída</h3>
      <ul><li>Nenhuma. Tela de leitura: usa <code>AE.telas</code>, <code>AE.statusVisivel</code>, <code>AE.origem</code>, <code>AE.calc.cobertura()</code>, <code>AE.calc.simulacao()</code> e <code>AE.calc.projeto()</code>.</li></ul>
      <h3>Macros de base</h3>
      <ul><li>Nenhuma. Esta tela não conversa com o CAD.</li></ul>
      <h3>Em aberto</h3>
      <ul>
        <li>Numeração da Mecânica: no trilho da v0, M3 era "Conferir alertas" e M4 "Desenhos e listas"; no fluxo da v0, M3 é "Peso, listas e sequência" e M4 "Revisões DR01–DR03". Qual vale?</li>
        <li>Os laços (payload da M3 volta ao Passo 5, posição dos robôs da Simulação volta ao Passo 7) criam ciclos no grafo. Hoje o protótipo só declara as entradas da primeira passada. Como numerar cada giro (C1 → C2) e quais passos marcar para conferir de novo?</li>
        <li>O Passo 8 (lista de segurança) vem antes ou depois da primeira rodada da Simulação? Ele depende do layout, que depende da posição dos robôs.</li>
      </ul>`,

    render(ctx) {
      const s = ctx.s;
      const atual = passoAtual();
      const ids = Object.values(AE.telas).filter((d) => d.area && d.area !== 'visao' && !d.aFazer).map((d) => d.id);
      const cont = (st) => ids.filter((id) => AE.statusVisivel(id) === st).length;
      const aFazer = Object.values(AE.telas).filter((d) => d.aFazer).length;
      const seg = [['tudo', 'Tudo', 'Mostra os passos de todas as áreas.'], ['proc', 'Processo', 'Mostra só os passos do Processo (planeja a linha).'],
        ['sim', 'Simulação', 'Mostra só os passos da Simulação (prova que funciona).'], ['mec', 'Mecânica', 'Mostra só os passos da Mecânica (dispositivos e garras).']]
        .map(([v, t, tip]) => `<button data-area="${v}" aria-pressed="${s.area === v}" data-tip="${esc(tip)}">${t}</button>`).join('');
      return `
      <div class="bloco">
        <h2>Onde o projeto está</h2>
        <p class="sub">O passo atual é o primeiro do fluxo cuja tela ainda não foi concluída. Os números contam só as telas que já existem no protótipo.</p>
        <div class="fx-onde">
          ${atual ? `<div class="instrucao"><div><strong>${esc(atual.n)} · ${esc(atual.titulo)}</strong><span>${AREA[atual.area]} · tela ${esc(nomeTela(atual.id))}</span></div>
            <div class="barra">${AE.pilulaStatus(atual.id)}
              <button class="btn leve" id="fx-mostrar" data-tip="Abre este passo no fluxo abaixo e leva a página até ele.">Mostrar no fluxo</button>
              <a class="btn primario" href="#/${esc(atual.id)}" data-tip="${esc('Abre a tela ' + nomeTela(atual.id) + ' para continuar o projeto.')}">Continuar por aqui</a></div></div>`
          : '<div class="faixa-aviso verde"><span>Todas as telas desenhadas estão concluídas. Os passos que faltam ainda não têm tela no protótipo.</span></div>'}
          <div class="kpis">
            <div class="kpi ok"><span>Concluídos</span><b>${cont('concluido')}</b><small>de ${ids.length} telas de passo</small></div>
            <div class="kpi aviso"><span>Preliminares</span><b>${cont('preliminar')}</b><small>concluídos com entrada de reserva</small></div>
            <div class="kpi ${cont('desatualizado') ? 'erro' : ''}"><span>Conferir de novo</span><b>${cont('desatualizado')}</b><small>uma entrada mudou depois</small></div>
            <div class="kpi"><span>Telas a fazer</span><b>${aFazer}</b><small>passos ainda sem tela</small></div>
          </div>
        </div>
      </div>

      <div class="bloco">
        <h2>Como ler</h2>
        <p class="sub">Cada caixa é um passo. Clique para abrir. A cor da borda mostra de quem é o passo; a pílula mostra a situação da tela que faz esse passo.</p>
        <div class="faixas">
          <span><span class="chip proc">Processo</span> planeja a linha</span>
          <span><span class="chip sim">Simulação</span> prova que funciona</span>
          <span><span class="chip mec">Mecânica</span> projeta dispositivos e garras</span>
          <span><span class="chip rev">Revisão</span> alguém de fora precisa aprovar</span>
        </div>
        <div class="faixas" style="margin-top:10px">
          <span class="pilula neutro" data-tip="Ninguém mexeu neste passo ainda. Os passos seguintes usam o valor de reserva dele.">Pendente</span>
          <span class="pilula info" data-tip="Já tem dados preenchidos, mas não foi concluído.">Em andamento</span>
          <span class="pilula ok" data-tip="Concluído com todas as entradas recebidas.">Concluído</span>
          <span class="pilula aviso" data-tip="Concluído, mas alguma entrada ainda usa o valor de reserva. Vale como conceito.">Concluído · preliminar</span>
          <span class="pilula erro" data-tip="Uma entrada mudou depois que o passo foi concluído. Confira e conclua de novo.">Conferir de novo</span>
          <span class="pilula neutro" data-tip="O passo existe no fluxo, mas a tela ainda não foi desenhada.">A fazer</span>
        </div>
      </div>

      <div class="bloco">
        <h2>Os laços do fluxo</h2>
        <p class="sub">O projeto não anda em linha reta. Ele vai e volta entre as três áreas até fechar.</p>
        <div class="fx-lacos"><svg viewBox="0 0 720 210" role="img" aria-label="Processo envia para Simulação, que envia para Mecânica, que devolve para Simulação, que devolve para Processo">
          <defs><marker id="fx-seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" style="fill:var(--suave)"/></marker></defs>
          <rect class="cx proc" x="10" y="70" width="170" height="70" rx="8"/><rect class="cx sim" x="275" y="70" width="170" height="70" rx="8"/><rect class="cx mec" x="540" y="70" width="170" height="70" rx="8"/>
          <g class="tt" text-anchor="middle"><text x="95" y="113">PROCESSO</text><text x="360" y="113">SIMULAÇÃO</text><text x="625" y="113">MECÂNICA</text></g>
          <g class="arco" marker-end="url(#fx-seta)"><path d="M120 68 C150 20 300 20 335 66"/><path d="M385 68 C420 20 570 20 600 66"/><path d="M600 142 C570 190 420 190 385 144"/><path d="M335 142 C300 190 150 190 120 144"/></g>
          <g class="nl" text-anchor="middle"><text x="228" y="26">1</text><text x="493" y="26">2</text><text x="493" y="198">3</text><text x="228" y="198">4</text></g>
        </svg></div>
        <div class="fx-linhas" id="fx-lacos"></div>
        <p class="sub" style="margin:12px 0 0">Se a validação achar problema (colisão, ponto sem acesso, ciclo que não fecha), o trabalho volta para a área anterior e o laço gira de novo. Cada giro gera uma versão, e o programa mostra o que mudou desde a anterior.</p>
      </div>

      <div class="bloco">
        <h2>Os passos, do começo ao fim</h2>
        <p class="sub">Para cada passo: o que precisa receber, o que o programa faz quando não recebe, o que entrega e quem revisa. Embaixo, a tela do protótipo que faz o passo.</p>
        <div class="barra entre fx-ferr">
          <div class="seg" id="fx-area" role="group" aria-label="Filtrar os passos por área">${seg}</div>
          <div class="barra">
            <button class="btn" id="fx-todos" data-tip="Abre ou fecha todos os passos de uma vez, para ler o fluxo inteiro ou só os títulos.">Abrir tudo</button>
            <button class="btn primario" id="fx-prox" data-tip="Anda pelo fluxo um passo por vez: fecha o passo atual, abre o próximo e leva a tela até ele.">Percorrer o fluxo</button>
          </div>
        </div>
      </div>
      <div id="fx-fases" class="coluna" style="gap:6px"></div>

      <div class="bloco">
        <h2>Checagem de cobertura do produto <span class="exemplo">dados de exemplo</span></h2>
        <p class="sub">Tudo o que o produto pede tem de existir no processo: o equipamento e a operação. A checagem agora é feita no Passo 6.1; aqui aparece só o resultado.</p>
        <div id="fx-cob"></div>
      </div>

      <div class="bloco">
        <h2>Quando chega uma revisão</h2>
        <p class="sub">Nada é refeito do zero. O programa compara a versão nova com a anterior e mostra só o que mudou.</p>
        <div class="fx-linhas rev">${REVISOES.map((r) => `<div><b>${esc(r[0])}</b><span class="d">${esc(r[1])}</span><span class="pilula neutro" data-tip="Quem trata esta revisão.">${esc(r[2])}</span>
          ${r[3] && navegavel(r[3]) ? `<a class="btn mini leve" href="#/${r[3]}" data-tip="${esc('Abre a tela ' + nomeTela(r[3]) + ', onde esta revisão é tratada.')}">Abrir tela</a>` : '<span></span>'}</div>`).join('')}</div>
      </div>`;
    },

    montar(el, ctx) {
      const s = ctx.s;
      AE.css('fluxo', `
        .fx-onde{display:flex;flex-direction:column;gap:12px}
        .fx-lacos svg{display:block;width:100%;height:auto;max-width:760px;margin:0 auto 10px}
        .fx-lacos .cx{fill:var(--painel2);stroke-width:2}
        .fx-lacos .cx.proc{stroke:var(--azul)} .fx-lacos .cx.sim{stroke:var(--l-sim)} .fx-lacos .cx.mec{stroke:var(--acao)}
        .fx-lacos .tt text{font-family:var(--f-titulo);font-size:22px;fill:var(--texto)}
        .fx-lacos .arco path{fill:none;stroke:var(--suave);stroke-width:2}
        .fx-lacos .nl text{fill:var(--acao);font-family:var(--f-dado);font-size:15px}
        .fx-linhas{display:flex;flex-direction:column;gap:6px}
        .fx-linhas>div{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1.6fr) auto auto;gap:10px;align-items:center;font-size:14px;padding:6px 8px;background:var(--fundo);border:1px solid var(--linha);border-radius:6px}
        .fx-linhas b{font-weight:600}
        .fx-linhas .d{color:var(--suave);font-size:13px}
        .fx-ferr{margin-top:4px}
        .fx-ferr .seg{min-width:min(100%,380px)}
        #fx-fases .fase{margin:14px 0 4px}
        .fx-lista{display:flex;flex-direction:column}
        .fx-no{background:var(--painel);border:1px solid var(--linha);border-left:4px solid var(--linha2);border-radius:8px;min-width:0;scroll-margin-top:90px}
        .fx-no.proc{border-left-color:var(--azul)} .fx-no.sim{border-left-color:var(--l-sim)} .fx-no.mec{border-left-color:var(--acao)}
        .fx-no.atual{box-shadow:0 0 0 2px var(--azul)}
        .fx-no.ativo{outline:2px solid var(--acao);outline-offset:2px}
        .fx-no summary{list-style:none;cursor:pointer;display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;padding:11px 14px}
        .fx-no summary::-webkit-details-marker{display:none}
        .fx-no summary::before{content:"";width:0;height:0;border-left:6px solid var(--fraco);border-top:5px solid transparent;border-bottom:5px solid transparent;transition:transform .15s}
        .fx-no[open] summary::before{transform:rotate(90deg)}
        .fx-no summary .num{font-family:var(--f-dado);color:var(--fraco);min-width:30px}
        .fx-no summary strong{font-family:var(--f-titulo);font-size:18px;font-weight:600;letter-spacing:.02em;flex:1;min-width:160px}
        .fx-corpo{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;padding:4px 14px 14px}
        .fx-no h4{margin:0 0 5px;font-size:11.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--fraco);font-weight:500;font-family:var(--f-texto)}
        .fx-no ul{margin:0;padding-left:16px;display:flex;flex-direction:column;gap:4px;font-size:14px}
        .fx-no li small{color:var(--fraco)}
        .fx-falta li{color:var(--aviso)} .fx-falta li span{color:var(--suave)}
        .fx-no p{margin:0;font-size:14px;color:var(--suave)}
        .fx-no p.fx-rev{color:var(--roxo)}
        .fx-no p.nota{margin:0}
        .fx-pe{grid-column:1/-1;border-top:1px dashed var(--linha2);padding-top:10px;display:flex;flex-direction:column;gap:8px}
        .fx-tela{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center;font-size:14px}
        .fx-ent{list-style:none;padding:0!important}
        .fx-ent li{display:flex;gap:8px;align-items:baseline}
        .fx-ent .st{transform:translateY(1px)}
        .fx-liga{display:flex;align-items:center;padding:0 0 0 22px;height:16px}
        .fx-liga::before{content:"";width:2px;height:16px;background:var(--linha2)}
        .fx-cob-res{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between;margin-top:12px}
        @media (max-width:640px){.fx-linhas>div{grid-template-columns:minmax(0,1fr);gap:5px}.fx-linhas>div>*{justify-self:start}}`);

      const reduzido = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
      let abertos = new Set();
      let noAtual = -1;
      const atual = passoAtual();
      if (atual) abertos.add(atual.n); else abertos.add('0');

      /* laços com a situação de agora */
      $('#fx-lacos', el).innerHTML = LACOS.map(([n, tit, o, iv, sit]) => {
        const [c, t, tip] = sit();
        return `<div><b>${n} · ${esc(tit)}</b><span class="d">${esc(o)}</span>
          <span class="pilula ${iv === 'ida' ? 'neutro' : 'aviso'}" data-tip="${iv === 'ida' ? 'O trabalho segue para a próxima área.' : 'O trabalho volta para a área anterior, para validar ou fechar.'}">${iv}</span>
          <span class="pilula ${c}" data-tip="${esc(tip)}">${esc(t)}</span></div>`;
      }).join('');

      /* fases filtradas por área */
      const visiveis = () => $$('#fx-fases .fx-no', el);
      const rotuloTodos = () => {
        const b = $('#fx-todos', el), ns = visiveis();
        b.textContent = ns.length && ns.every((n) => n.open) ? 'Fechar tudo' : 'Abrir tudo';
      };
      const fases = () => {
        const html = FASES.map((f) => {
          const ps = f[1].filter((p) => s.area === 'tudo' || p[0] === s.area);
          if (!ps.length) return '';
          return `<h2 class="fase">${esc(f[0])}</h2><div class="fx-lista">${ps.map((p, i) => (i ? '<div class="fx-liga" aria-hidden="true"></div>' : '') + htmlNo(p, atual)).join('')}</div>`;
        }).join('');
        $('#fx-fases', el).innerHTML = html || '<div class="vazio">Nenhum passo nesta área.</div>';
        visiveis().forEach((n) => { if (abertos.has(n.dataset.n)) n.open = true; });
        noAtual = -1;
        $('#fx-prox', el).textContent = 'Percorrer o fluxo';
        rotuloTodos();
      };
      fases();

      /* cobertura (somente leitura do Passo 6.1) */
      const cob = AE.calc.cobertura();
      const faltam = cob.filter((c) => !c.coberto);
      const capOk = navegavel('capacidade');
      const oriEq = AE.origem('equipamentos');
      $('#fx-cob', el).innerHTML = `<div class="fx-linhas">${cob.map((c) => `<div><b>${esc(c.item)}</b><span class="d">${esc(c.exige)}</span>
          <span class="d">${esc(c.qtd || '')}</span>
          ${c.coberto ? `<span class="pilula ok" data-tip="${esc('Equipamento encontrado em ' + c.onde.join(', ') + '.')}">Coberto · ${esc(c.onde.join(', '))}</span>`
            : '<span class="pilula erro" data-tip="O produto tem este item, mas o processo não tem o equipamento ou a operação. Enquanto estiver assim, o processo não é liberado.">Sem equipamento</span>'}</div>`).join('')}</div>
        <div class="fx-cob-res">
          <span>${faltam.length ? `<span class="pilula erro">${faltam.length} item${faltam.length > 1 ? 's' : ''} sem dono no processo</span>` : '<span class="pilula ok">Nada do produto ficou sem dono</span>'}
            ${oriEq !== 'tela' ? ' <span class="pilula aviso" data-tip="A lista de equipamentos (Passo 5) ainda não foi concluída. A cobertura usa a lista de reserva e vale como conceito.">Equipamentos ainda de reserva</span>' : ''}</span>
          ${capOk ? '<a class="btn" href="#/capacidade" data-tip="Abre o Passo 6 (Capacidade), onde fica a checagem de cobertura completa, com o botão para incluir o que falta.">Abrir o Passo 6.1</a>'
            : '<span class="pilula neutro" data-tip="A tela da capacidade ainda não existe no protótipo.">Passo 6.1: tela a fazer</span>'}
        </div>`;

      /* filtro por área */
      $('#fx-area', el).onclick = (e) => {
        const b = e.target.closest('[data-area]'); if (!b) return;
        s.area = b.dataset.area; ctx.salvarUI();
        $$('#fx-area button', el).forEach((x) => x.setAttribute('aria-pressed', x === b));
        fases();
      };
      /* abrir e fechar */
      el.addEventListener('toggle', (e) => {
        const n = e.target.closest && e.target.closest('.fx-no'); if (!n) return;
        if (n.open) abertos.add(n.dataset.n); else abertos.delete(n.dataset.n);
        rotuloTodos();
      }, true);
      $('#fx-todos', el).onclick = () => {
        const ns = visiveis(), abrir = ns.some((n) => !n.open);
        ns.forEach((n) => (n.open = abrir));
        rotuloTodos();
      };
      /* percorrer um a um */
      $('#fx-prox', el).onclick = () => {
        const ns = visiveis(); if (!ns.length) return;
        ns.forEach((n) => { n.open = false; n.classList.remove('ativo'); });
        noAtual = (noAtual + 1) % ns.length;
        const n = ns[noAtual];
        n.open = true; n.classList.add('ativo');
        n.scrollIntoView({ block: 'center', behavior: reduzido() ? 'auto' : 'smooth' });
        $('#fx-prox', el).textContent = noAtual === ns.length - 1 ? 'Voltar ao início' : 'Próximo passo';
      };
      /* ir ao passo atual */
      const btMostrar = $('#fx-mostrar', el);
      if (btMostrar) btMostrar.onclick = () => {
        let n = $(`#fx-fases .fx-no[data-n="${atual.n}"]`, el);
        if (!n) { // filtrado para outra área: volta para "tudo"
          s.area = 'tudo'; ctx.salvarUI();
          $$('#fx-area button', el).forEach((x) => x.setAttribute('aria-pressed', x.dataset.area === 'tudo'));
          fases();
          n = $(`#fx-fases .fx-no[data-n="${atual.n}"]`, el);
        }
        if (!n) return;
        n.open = true;
        n.scrollIntoView({ block: 'start', behavior: reduzido() ? 'auto' : 'smooth' });
      };
    },
  });
})();
