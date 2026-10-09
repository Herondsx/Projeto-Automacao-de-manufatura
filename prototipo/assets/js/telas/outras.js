/* Mecânica 5 · Outras unidades e garras
   Na v0 era o botão "A fazer: piloto com pino retrátil, basculante, unidade linear, garra".
   Do fluxo (passo M3): "Payload, lista de materiais, sequência de abertura e fechamento. Payload volta ao Processo e à Simulação."
   Lê: AE.espiar('fixacao').pontos (furos de piloto) e AE.calc.equipamentos() (robôs).
   Grava o payload da garra na fatia de equipamentos (garra[idDoRobô]), que o Passo 5 já usa. */
(function () {
  'use strict';
  const AE = window.AE;
  const { $, $$, esc, fmt, mm } = AE.util;

  const ABAS = [
    ['piloto', 'Piloto com pino retrátil'],
    ['basculante', 'Basculante'],
    ['linear', 'Unidade linear'],
    ['garra', 'Garra de robô'],
    ['sequencia', 'Sequência'],
  ];
  const G = 9.81, PRESSAO = 0.6; // MPa (6 bar), pressão de rede usada nas contas de exemplo
  const forcaCil = (d) => PRESSAO * Math.PI * (d / 2) ** 2; // N

  const SEQ_PADRAO = [
    'Operador carrega as peças no dispositivo',
    'Avançar pinos de piloto',
    'Fechar grampos do grupo 1 (geometria)',
    'Fechar grampos do grupo 2',
    'Robôs soldam',
    'Abrir grampos dos grupos 2 e 1',
    'Recuar pinos de piloto',
    'Retirar o produto (robô de manuseio ou transportador)',
  ];

  const pilotosDaFixacao = () => {
    const fx = AE.espiar('fixacao') || { pontos: [] };
    return (fx.pontos || []).filter((p) => /piloto/i.test(p.fun) && p.sit !== 'des').map((p) => ({
      nome: p.nome, fun: p.fun, x: mm(p.x), y: mm(p.y), z: mm(p.z), sit: p.sit,
      primario: /prim/i.test(p.fun),
    }));
  };
  const robosLista = () => AE.calc.equipamentos().itens.filter((i) => i.tipo === 'robo');
  const capRobo = (modelo) => { const r = AE.dados.robos.find((x) => x.modelo === modelo); return r ? r.payload : null; };

  AE.tela({
    id: 'outras', sigla: 'M5', area: 'mec', rotulo: 'Mecânica 5', titulo: 'Outras unidades e garras',
    resumo: 'Unidades que não são apoio com grampo: piloto com pino retrátil, basculante, unidade linear e a garra do robô. Daqui sai o payload que volta ao Processo e à Simulação.',
    tip: 'Abre a tela das outras unidades: pilotos com pino retrátil, basculantes, unidades lineares e garras de robô, com o payload e a sequência de abertura e fechamento.',
    entradas: [{ de: 'fixacao', o: 'Furos de piloto aprovados' }, { de: 'equipamentos', o: 'Robôs que levam garra' }],
    inicial: () => ({
      aba: 'piloto',
      pilotos: {},
      basculante: { angulo: 90, massa: 12, cg: 150, cil: 50, braco: 60, montado: false },
      linear: { curso: 150, carga: 25, cil: 32, guia: 'Guia linear dupla com batente regulável', montado: false },
      garra: {
        pecas: [{ nome: 'Painel interno (A)', kg: 3.2 }, { nome: 'Longarina (C)', kg: 4.1 }],
        estrutura: 38, ventosas: 6, grampos: 4, trocador: 6, robo: '', enviado: null,
      },
      sequencia: SEQ_PADRAO.slice(),
      reg: [],
    }),
    programador: `
      <h3>O que esta tela guarda</h3>
      <ul>
        <li><code>pilotos</code>: por furo de piloto, diâmetro, tipo de pino, curso e se já foi montado no CAD.</li>
        <li><code>basculante</code>, <code>linear</code>: parâmetros e resultado da conta de força.</li>
        <li><code>garra</code>: peças manuseadas, estrutura, componentes, robô escolhido e o payload enviado.</li>
        <li><code>sequencia</code>: ordem de abertura e fechamento da estação.</li>
      </ul>
      <h3>Regras</h3>
      <ul>
        <li>Um piloto por furo de piloto aprovado em Mecânica 1. Desconsiderado não vira unidade.</li>
        <li>Furo primário: pino cilíndrico, trava em 4 direções. Furo secundário: pino losango (achatado), trava em 2 direções, orientado pela linha entre os dois furos.</li>
        <li>Pino retrátil quando o produto sai por um caminho que cruza o pino; pino fixo quando o produto sai para cima, livre.</li>
        <li>Conta de cilindro: força = pressão × área (6 bar de exemplo). Basculante: momento do cilindro ≥ 2 × momento do peso.</li>
        <li>Payload da garra = peças + estrutura + ventosas + grampos + trocador, e precisa caber em 80% da capacidade do robô (margem de exemplo).</li>
        <li>O payload enviado é gravado no Passo 5, no robô escolhido. Robô só com pinça recebe 0 kg de garra.</li>
      </ul>
      <h3>Saída</h3>
      <ul>
        <li><code>AE.espiar('outras').garra.enviado</code> = <code>{kg, robo, hora}</code> e <code>AE.fatia('equipamentos').garra[idDoRobô]</code>.</li>
        <li><code>AE.espiar('outras').sequencia</code>: sequência para a Simulação (S4) e para a folha de instrução.</li>
      </ul>
      <h3>Macros de base</h3>
      <ul><li><code>INSERT_PART</code> (inserir componentes de catálogo). As demais montagens ainda não têm macro.</li></ul>
      <h3>Em aberto</h3>
      <ul>
        <li>Diâmetros padrão de pino e curso por cliente: vêm do padrão do cliente? (valores aqui são de exemplo)</li>
        <li>Margem de 80% da capacidade do robô: qual regra a equipe usa? Considera inércia e o cabo (dress pack)?</li>
        <li>Basculante e unidade linear: existe biblioteca de modelos de partida como a das torres?</li>
        <li>A sequência de abertura e fechamento sai daqui ou da Simulação (S4)?</li>
      </ul>`,

    render(ctx) {
      const s = ctx.s;
      return `
      <div class="abas" role="tablist" id="ou-abas">${ABAS.map(([k, t]) => `<button role="tab" data-aba="${k}" aria-selected="${s.aba === k}">${t}</button>`).join('')}</div>
      <div id="ou-corpo" class="coluna"></div>
      <div class="bloco">
        <h2>Checagem</h2>
        <p class="sub">O passo conclui com os pilotos montados e o payload enviado. Sem a aprovação do plano de fixação, fica preliminar.</p>
        <div class="checagem" id="ou-check"></div>
        <div class="barra fim" style="margin-top:14px">
          <button class="btn primario" id="ou-concluir" data-tip="Confere os itens acima e conclui a Mecânica 5: pilotos, garra, payload enviado e sequência.">Concluir Mecânica 5</button>
        </div>
        <div class="registro" id="ou-reg"></div>
      </div>`;
    },

    montar(el, ctx) {
      const s = ctx.s, T = ctx.termos();
      AE.css('outras', `
        .ou-esq{background:var(--cad);border:1px solid var(--linha);border-radius:6px}
        .ou-esq svg{display:block;width:100%;height:auto}
        .ou-esq text{font-family:var(--f-dado);font-size:11px;fill:var(--suave)}
        .ou-pino{transition:transform .35s}
        .ou-recuado .ou-pino{transform:translateY(46px)}
        .ou-seq li{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:8px;align-items:center;background:var(--fundo);border:1px solid var(--linha);border-radius:6px;padding:6px 8px;font-size:14px}
        .ou-seq{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
        .ou-seq .n{font-family:var(--f-dado);color:var(--fraco);font-size:12px}
        .ou-seq input{padding:4px 7px}`);

      const reg = (t) => { s.reg.unshift(`${AE.util.hora()} · ${t}`); s.reg.length = Math.min(s.reg.length, 30); ctx.registrar(t); };

      /* ---------------- piloto ---------------- */
      const parPiloto = (p) => {
        const d = s.pilotos[p.nome] || (s.pilotos[p.nome] = { diam: 16, retratil: true, curso: 40, montado: false });
        return d;
      };
      const htmlPiloto = () => {
        const pil = pilotosDaFixacao();
        const origem = ctx.origem('fixacao');
        if (!pil.length) return `<div class="bloco"><h2>Pilotos com pino retrátil</h2><div class="vazio">O plano de fixação não tem furo de piloto ativo. Abra <a href="#/fixacao">Mecânica 1</a> e confira os pontos com função "Furo primário · piloto" ou "Furo secundário · piloto".</div></div>`;
        const linhas = pil.map((p) => {
          const d = parPiloto(p);
          const pinoTxt = p.primario ? 'cilíndrico · trava 4 direções' : 'losango · trava 2 direções';
          return `<tr data-p="${esc(p.nome)}">
            <td class="mono">${esc(p.nome)}</td>
            <td>${esc(p.fun)}<small style="display:block;color:var(--fraco)">${p.x} / ${p.y} / ${p.z} mm</small></td>
            <td>${pinoTxt}</td>
            <td class="num"><input class="curto" type="number" min="6" max="40" step="1" data-k="diam" value="${esc(d.diam)}" aria-label="Diâmetro do furo" data-tip="Diâmetro do furo do produto, em mm. O pino sai com tolerância h7 (exemplo)."></td>
            <td><select data-k="retratil" aria-label="Tipo de pino" data-tip="Retrátil quando o produto sai por um caminho que cruza o pino. Fixo quando o produto sai para cima, livre.">
              <option value="1" ${d.retratil ? 'selected' : ''}>retrátil</option><option value="0" ${d.retratil ? '' : 'selected'}>fixo</option></select></td>
            <td class="num"><input class="curto" type="number" min="10" max="150" step="5" data-k="curso" value="${esc(d.curso)}" ${d.retratil ? '' : 'disabled'} aria-label="Curso do pino" data-tip="Curso de recuo do pino, em mm. Precisa passar a espessura das chapas + folga para o produto sair."></td>
            <td>${p.sit === 'pen' ? '<span class="pilula aviso" data-tip="Ponto ainda sem revisão em Mecânica 1: a unidade sai preliminar.">plano sem revisão</span>' : d.montado ? '<span class="pilula ok">montado no CAD</span>' : '<span class="pilula neutro">a montar</span>'}</td>
            <td><button class="btn mini" data-montar="${esc(p.nome)}" data-tip="Insere no ${T.nome} a unidade de piloto deste furo (console, bloco do pino, pino, cilindro de recuo, sensor), já posicionada no furo e vinculada ao produto.">Montar no CAD</button></td></tr>`;
        }).join('');
        const sel = pil[0], d0 = parPiloto(sel);
        return `
        <div class="bloco">
          <h2>Pilotos com pino retrátil <span class="exemplo">dados de exemplo</span></h2>
          <p class="sub">Um piloto por furo aprovado no plano de fixação${origem === 'tela' ? '' : ' (o plano ainda não foi concluído: os pilotos saem preliminares)'}. Os apoios do mesmo plano viram unidades em <a href="#/unidades">Mecânica 2</a>.</p>
          <div class="rolagem"><table id="ou-tab-pil"><thead><tr><th>Furo</th><th>Função</th><th>Pino</th><th class="num">Ø furo</th><th>Tipo</th><th class="num">Curso</th><th>Situação</th><th></th></tr></thead><tbody>${linhas}</tbody></table></div>
          <div class="barra" style="margin-top:12px"><button class="btn" id="ou-montar-todos" data-tip="Monta no ${T.nome} as unidades de todos os furos de piloto que ainda não foram montados.">Montar todos no CAD</button></div>
        </div>
        <div class="duas">
          <div class="bloco">
            <h2>Esquema · ${esc(sel.nome)}</h2>
            <p class="sub">Vista lateral simplificada. Use o botão para ver o pino recuar.</p>
            <div class="ou-esq" id="ou-esq-pil"><svg viewBox="0 0 300 200" role="img" aria-label="Esquema do piloto com pino retrátil">
              <rect x="20" y="176" width="260" height="12" fill="#1B3156" stroke="#3A5C92"/>
              <rect x="120" y="70" width="60" height="106" fill="#1B3156" stroke="#3A5C92"/>
              <rect x="128" y="120" width="44" height="50" rx="3" fill="#16294A" stroke="#4FD1C5"/>
              <g class="ou-pino"><rect x="143" y="38" width="14" height="34" fill="#F2B636"/><path d="M143 38 L150 28 L157 38 Z" fill="#F2B636"/></g>
              <path d="M40 58 L140 58 M160 58 L260 58" stroke="#B592FF" stroke-width="3"/>
              <text x="186" y="52">produto</text><text x="186" y="96">bloco do pino</text><text x="186" y="146">cilindro</text><text x="40" y="38">pino Ø${esc(d0.diam)}</text>
            </svg></div>
            <div class="barra" style="margin-top:10px"><button class="btn leve" id="ou-recuo" data-tip="Mostra o pino recuando o curso escolhido, como no fim do ciclo, para o produto sair.">Simular recuo</button></div>
          </div>
          <div class="bloco">
            <h2>Peças da unidade de piloto</h2>
            <p class="sub">Mesma estrutura de lista das unidades de apoio: posição, denominação, material e bruto.</p>
            <div class="rolagem"><table><thead><tr><th class="num">Pos.</th><th>Denominação</th><th>Material / bruto</th><th>Origem</th></tr></thead><tbody>
              <tr><td class="num">5</td><td>Console</td><td>ABNT 1015 · BL 30×120×${d0.retratil ? 260 : 220}</td><td>construída</td></tr>
              <tr><td class="num">7</td><td>Bloco do pino</td><td>ABNT 1045 · BL 25×60×80</td><td>construída</td></tr>
              <tr><td class="num">—</td><td>Pino ${sel.primario ? 'cilíndrico' : 'losango'} Ø${esc(d0.diam)} h7</td><td>comprado</td><td>catálogo</td></tr>
              ${d0.retratil ? `<tr><td class="num">—</td><td>Cilindro de recuo · curso ${esc(d0.curso)} mm</td><td>comprado</td><td>catálogo</td></tr>` : ''}
              <tr><td class="num">—</td><td>Sensor indutivo de presença</td><td>comprado</td><td>catálogo</td></tr>
              <tr><td class="num">905</td><td>Placa de identificação</td><td>—</td><td>norma</td></tr>
            </tbody></table></div>
          </div>
        </div>`;
      };

      /* ---------------- basculante ---------------- */
      const htmlBasc = () => {
        const b = s.basculante;
        const mPeso = b.massa * G * b.cg / 1000, F = forcaCil(b.cil), mCil = F * b.braco / 1000, ok = mCil >= 2 * mPeso;
        return `
        <div class="duas">
          <div class="bloco">
            <h2>Basculante <span class="exemplo">dados de exemplo</span></h2>
            <p class="sub">Unidade que gira para sair do caminho do produto na carga e na descarga (ex.: grampo que atrapalha a entrada).</p>
            <div class="campos">
              <label class="campo">Ângulo de giro (°)<input type="number" data-b="angulo" min="15" max="180" value="${esc(b.angulo)}"></label>
              <label class="campo">Massa que gira (kg)<input type="number" data-b="massa" min="1" step="0.5" value="${esc(b.massa)}"></label>
              <label class="campo">CG até o eixo (mm)<input type="number" data-b="cg" min="10" value="${esc(b.cg)}"></label>
              <label class="campo">Cilindro Ø (mm)<select data-b="cil">${[32, 40, 50, 63, 80].map((d) => `<option ${d === Number(b.cil) ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
              <label class="campo">Braço de alavanca do cilindro (mm)<input type="number" data-b="braco" min="20" value="${esc(b.braco)}"></label>
            </div>
            <div class="calc" style="margin-top:14px">
              <span>Momento do peso = massa × 9,81 × CG</span><b>${fmt(mPeso, 1)} Nm</b>
              <span>Força do cilindro a 6 bar = pressão × área</span><b>${fmt(F, 0)} N</b>
              <span>Momento do cilindro = força × braço</span><b>${fmt(mCil, 1)} Nm</b>
              <span class="total">Resultado (precisa ≥ 2 × peso)</span><b class="total" style="color:${ok ? 'var(--ok)' : 'var(--erro)'}">${ok ? 'Aprovado' : 'Reprovado: suba o cilindro ou o braço'}</b>
            </div>
            <div class="barra" style="margin-top:12px"><button class="btn" data-montar-un="basculante" data-tip="Insere no ${T.nome} o basculante com os parâmetros acima, vinculado ao produto, e confere o giro contra o produto.">Montar no CAD</button>
              ${b.montado ? '<span class="pilula ok">montado</span>' : ''}</div>
          </div>
          <div class="bloco">
            <h2>Esquema</h2>
            <div class="ou-esq"><svg viewBox="0 0 300 200" role="img" aria-label="Esquema do basculante">
              <rect x="20" y="176" width="260" height="12" fill="#1B3156" stroke="#3A5C92"/>
              <rect x="60" y="110" width="40" height="66" fill="#1B3156" stroke="#3A5C92"/><circle cx="80" cy="110" r="7" fill="#F2B636"/>
              <path d="M80 110 L${80 + 150 * Math.cos(-Math.PI / 2 + (b.angulo * Math.PI) / 180 / 2)} ${110 + 150 * Math.sin(-Math.PI / 2 + (b.angulo * Math.PI) / 180 / 2) * 0.6}" stroke="#4FD1C5" stroke-width="6"/>
              <path d="M80 110 L230 110" stroke="#4FD1C5" stroke-width="2" stroke-dasharray="5 4"/>
              <path d="M150 110 A70 70 0 0 0 ${80 + 70 * Math.cos(-(b.angulo * Math.PI) / 180 / 2)} ${110 - 70 * Math.sin((b.angulo * Math.PI) / 180 / 2) * 0.6}" fill="none" stroke="#B592FF" stroke-width="1.5"/>
              <text x="160" y="104">fechado</text><text x="120" y="40">aberto ${esc(b.angulo)}°</text><text x="30" y="160">eixo</text>
            </svg></div>
          </div>
        </div>`;
      };

      /* ---------------- linear ---------------- */
      const htmlLinear = () => {
        const l = s.linear;
        const atrito = 0.1 * l.carga * G, F = forcaCil(l.cil), ok = F >= 3 * atrito;
        return `
        <div class="duas">
          <div class="bloco">
            <h2>Unidade linear <span class="exemplo">dados de exemplo</span></h2>
            <p class="sub">Unidade que avança e recua em linha reta (ex.: apoio que entra depois da carga, ou piloto que entra na horizontal).</p>
            <div class="campos">
              <label class="campo">Curso (mm)<input type="number" data-l="curso" min="10" step="5" value="${esc(l.curso)}"></label>
              <label class="campo">Carga movida (kg)<input type="number" data-l="carga" min="1" value="${esc(l.carga)}"></label>
              <label class="campo">Cilindro Ø (mm)<select data-l="cil">${[25, 32, 40, 50, 63].map((d) => `<option ${d === Number(l.cil) ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
              <label class="campo">Guia<input type="text" data-l="guia" value="${esc(l.guia)}"></label>
            </div>
            <div class="calc" style="margin-top:14px">
              <span>Atrito na guia = 0,1 × carga × 9,81</span><b>${fmt(atrito, 0)} N</b>
              <span>Força do cilindro a 6 bar</span><b>${fmt(F, 0)} N</b>
              <span class="total">Resultado (precisa ≥ 3 × atrito)</span><b class="total" style="color:${ok ? 'var(--ok)' : 'var(--erro)'}">${ok ? 'Aprovado' : 'Reprovado: suba o cilindro'}</b>
            </div>
            <p class="nota">Leva batente regulável e sensor de fim de curso nos dois lados (regra de exemplo, a validar com o Bruno).</p>
            <div class="barra" style="margin-top:12px"><button class="btn" data-montar-un="linear" data-tip="Insere no ${T.nome} a unidade linear com o curso escolhido, vinculada ao produto.">Montar no CAD</button>
              ${l.montado ? '<span class="pilula ok">montada</span>' : ''}</div>
          </div>
          <div class="bloco">
            <h2>Esquema</h2>
            <div class="ou-esq"><svg viewBox="0 0 300 200" role="img" aria-label="Esquema da unidade linear">
              <rect x="20" y="176" width="260" height="12" fill="#1B3156" stroke="#3A5C92"/>
              <rect x="30" y="140" width="240" height="14" fill="#16294A" stroke="#3A5C92"/>
              <rect x="${50 + Math.min(150, l.curso / 2)}" y="100" width="60" height="40" fill="#1B3156" stroke="#4FD1C5"/>
              <rect x="50" y="100" width="60" height="40" fill="none" stroke="#4FD1C5" stroke-dasharray="4 4"/>
              <path d="M80 92 L${80 + Math.min(150, l.curso / 2)} 92" stroke="#F2B636" stroke-width="2" marker-end="url(#ou-seta)"/>
              <defs><marker id="ou-seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#F2B636"/></marker></defs>
              <text x="80" y="84">curso ${esc(l.curso)} mm</text><text x="40" y="170">guia</text>
            </svg></div>
          </div>
        </div>`;
      };

      /* ---------------- garra ---------------- */
      const payloadGarra = () => {
        const g = s.garra;
        const pecas = g.pecas.reduce((a, p) => a + (Number(p.kg) || 0), 0);
        const comp = g.ventosas * 0.25 + g.grampos * 1.8;
        return { pecas, comp, total: pecas + Number(g.estrutura || 0) + comp + Number(g.trocador || 0) };
      };
      const htmlGarra = () => {
        const g = s.garra, rob = robosLista(), pg = payloadGarra();
        if (!g.robo && rob.length) g.robo = rob[0].id;
        const r = rob.find((x) => x.id === g.robo);
        const cap = r ? capRobo(r.modelo) : null, lim = cap ? cap * 0.8 : null;
        const ok = lim != null && pg.total <= lim;
        const semValor = rob.filter((x) => { const eq = AE.espiar('equipamentos') || {}; const v = (eq.garra || {})[x.id]; return v === undefined || v === null || v === ''; });
        return `
        <div class="bloco">
          <h2>Garra de robô <span class="exemplo">dados de exemplo</span></h2>
          <p class="sub">Garra que o robô usa para manusear peças (ou garra com pinça). O peso total é o payload que volta ao Processo (Passo 5) e à Simulação.</p>
          <h3 class="rotulo-sec">Peças que a garra carrega</h3>
          <div class="rolagem"><table id="ou-tab-pecas"><thead><tr><th>Peça</th><th class="num">Massa (kg)</th><th></th></tr></thead><tbody>
            ${g.pecas.map((p, i) => `<tr><td><input type="text" data-pc="nome" data-i="${i}" value="${esc(p.nome)}" aria-label="Nome da peça"></td>
              <td class="num"><input class="curto" type="number" min="0" step="0.1" data-pc="kg" data-i="${i}" value="${esc(p.kg)}" aria-label="Massa da peça"></td>
              <td><button class="btn mini leve" data-rm-pc="${i}" data-tip="Tira esta peça da garra.">Remover</button></td></tr>`).join('')}
          </tbody></table></div>
          <div class="barra" style="margin-top:8px"><button class="btn mini" id="ou-add-pc" data-tip="Acrescenta uma peça manuseada pela garra.">Adicionar peça</button>
            <button class="btn mini leve" id="ou-ler-massa" data-tip="Lê a massa das peças no 3D do produto aberto no ${T.nome} (análise de massa), em vez de digitar.">Ler massas do 3D</button></div>
          <h3 class="rotulo-sec">Garra</h3>
          <div class="campos">
            <label class="campo">Estrutura (kg)<input type="number" data-g="estrutura" min="0" value="${esc(g.estrutura)}"></label>
            <label class="campo">Ventosas (0,25 kg cada)<input type="number" data-g="ventosas" min="0" value="${esc(g.ventosas)}"></label>
            <label class="campo">Grampos (1,8 kg cada)<input type="number" data-g="grampos" min="0" value="${esc(g.grampos)}"></label>
            <label class="campo">Trocador de ferramenta (kg)<input type="number" data-g="trocador" min="0" value="${esc(g.trocador)}"></label>
            <label class="campo">Robô que leva a garra<select data-g="robo">${rob.map((x) => `<option value="${esc(x.id)}" ${x.id === g.robo ? 'selected' : ''}>ST${esc(x.st)} · ${esc(x.modelo.split(' · ')[0])} (${esc(x.id)})</option>`).join('')}</select></label>
          </div>
          <div class="calc" style="margin-top:14px">
            <span>Peças</span><b>${fmt(pg.pecas, 1)} kg</b>
            <span>Estrutura + componentes + trocador</span><b>${fmt(pg.total - pg.pecas, 1)} kg</b>
            <span class="total">Payload da garra</span><b class="total">${fmt(pg.total, 1)} kg</b>
            <span>Capacidade do robô (80% de margem)</span><b>${cap ? `${cap} kg (${fmt(lim, 0)} kg)` : 'desconhecida'}</b>
            <span>Resultado</span><b style="color:${ok ? 'var(--ok)' : 'var(--erro)'}">${lim == null ? 'Robô fora da biblioteca: confira à mão' : ok ? 'Cabe no robô' : 'Acima do robô: alivie a garra ou troque o robô no Passo 5'}</b>
          </div>
          <div class="barra" style="margin-top:12px">
            <button class="btn" id="ou-montar-garra" data-tip="Monta a garra no ${T.nome}: estrutura, ventosas e grampos nas posições das peças, vinculada ao produto.">Montar garra no CAD</button>
            <button class="btn primario" id="ou-enviar" data-tip="Grava o peso da garra no robô escolhido do Passo 5 e avisa o Processo e a Simulação. O Passo 5 deixa de ser preliminar nesse quesito.">Enviar payload ao Processo e à Simulação</button>
            ${semValor.length ? `<button class="btn leve" id="ou-so-pinca" data-tip="Os robôs de solda que não levam garra recebem 0 kg de garra (só a pinça). Assim o Passo 5 sabe que não falta payload para eles.">Robôs só com pinça: 0 kg (${semValor.length})</button>` : ''}
          </div>
          ${g.enviado ? `<p class="nota ok">Payload enviado às ${esc(g.enviado.hora)}: ${fmt(g.enviado.kg, 1)} kg no robô ${esc(g.enviado.robo)}. Confira em <a href="#/equipamentos">Passo 5</a>.</p>` : ''}
        </div>`;
      };

      /* ---------------- sequência ---------------- */
      const htmlSeq = () => `
        <div class="bloco">
          <h2>Sequência de abertura e fechamento</h2>
          <p class="sub">Ordem em que o dispositivo trabalha no ciclo. Vai para a Simulação validar a sequência completa (S4) e para a folha de instrução.</p>
          <ol class="ou-seq" id="ou-seq">${s.sequencia.map((t, i) => `<li><span class="n">${i + 1}</span><input type="text" data-seq="${i}" value="${esc(t)}" aria-label="Passo ${i + 1} da sequência">
            <span class="barra" style="flex-wrap:nowrap"><button class="btn mini leve" data-sobe="${i}" aria-label="Subir" data-tip="Sobe este passo na sequência." ${i ? '' : 'disabled'}>↑</button><button class="btn mini leve" data-desce="${i}" aria-label="Descer" data-tip="Desce este passo na sequência." ${i < s.sequencia.length - 1 ? '' : 'disabled'}>↓</button><button class="btn mini leve" data-rm-seq="${i}" aria-label="Remover" data-tip="Remove este passo da sequência.">×</button></span></li>`).join('')}</ol>
          <div class="barra" style="margin-top:10px"><button class="btn mini" id="ou-add-seq" data-tip="Acrescenta um passo no fim da sequência.">Adicionar passo</button>
            <button class="btn mini leve" id="ou-seq-padrao" data-tip="Volta para a sequência padrão de exemplo.">Voltar ao padrão</button></div>
        </div>`;

      const corpo = () => {
        const f = { piloto: htmlPiloto, basculante: htmlBasc, linear: htmlLinear, garra: htmlGarra, sequencia: htmlSeq }[s.aba] || htmlPiloto;
        $('#ou-corpo', el).innerHTML = f();
        $$('#ou-abas button', el).forEach((b) => b.setAttribute('aria-selected', b.dataset.aba === s.aba));
      };

      const itens = () => {
        const pil = pilotosDaFixacao();
        const montados = pil.filter((p) => (s.pilotos[p.nome] || {}).montado).length;
        const pg = payloadGarra();
        return [
          ['Pilotos montados no CAD', pil.length > 0 && montados === pil.length, pil.length ? `${montados} de ${pil.length}` : 'nenhum piloto no plano', 'aviso'],
          ['Payload da garra enviado ao Processo', !!s.garra.enviado && Math.abs(s.garra.enviado.kg - pg.total) < 0.05, s.garra.enviado ? 'garra mudou depois do envio' : 'não enviado', 'erro'],
          ['Sequência de abertura e fechamento definida', s.sequencia.filter((t) => t.trim()).length >= 3, 'sequência curta demais', 'erro'],
          ['Plano de fixação aprovado (F1)', !!(AE.espiar('fixacao') || {}).aprovado, 'plano em conceito: sai preliminar', 'aviso'],
        ];
      };
      const checagem = () => {
        $('#ou-check', el).innerHTML = itens().map((i) => `<div><span>${esc(i[0])}</span>${i[1] ? '<span class="pilula ok">Certo</span>' : `<span class="pilula ${i[3]}">${esc(i[2])}</span>`}</div>`).join('');
        $('#ou-reg', el).innerHTML = s.reg.slice(0, 8).map((r) => `<span>${esc(r)}</span>`).join('');
      };
      const tudo = () => { corpo(); checagem(); };
      tudo();

      /* abas */
      $('#ou-abas', el).addEventListener('click', (e) => { const b = e.target.closest('[data-aba]'); if (!b) return; s.aba = b.dataset.aba; ctx.salvarUI(); tudo(); });

      /* eventos do corpo (delegação) */
      const cx = $('#ou-corpo', el);
      cx.addEventListener('change', (e) => {
        const t = e.target;
        const tr = t.closest('tr[data-p]');
        if (tr && t.dataset.k) {
          const d = s.pilotos[tr.dataset.p];
          d[t.dataset.k] = t.dataset.k === 'retratil' ? t.value === '1' : Number(t.value) || 0;
          d.montado = false; ctx.salvar(); tudo(); return;
        }
        if (t.dataset.b) { s.basculante[t.dataset.b] = Number(t.value) || 0; s.basculante.montado = false; ctx.salvar(); tudo(); return; }
        if (t.dataset.l) { s.linear[t.dataset.l] = t.dataset.l === 'guia' ? t.value : Number(t.value) || 0; s.linear.montado = false; ctx.salvar(); tudo(); return; }
        if (t.dataset.pc) { const p = s.garra.pecas[+t.dataset.i]; p[t.dataset.pc] = t.dataset.pc === 'kg' ? Number(t.value) || 0 : t.value; ctx.salvar(); tudo(); return; }
        if (t.dataset.g) { s.garra[t.dataset.g] = t.dataset.g === 'robo' ? t.value : Number(t.value) || 0; ctx.salvar(); tudo(); return; }
        if (t.dataset.seq != null) { s.sequencia[+t.dataset.seq] = t.value; ctx.salvar(); checagem(); }
      });
      cx.addEventListener('click', async (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.montar) {
          const p = pilotosDaFixacao().find((x) => x.nome === b.dataset.montar); if (!p) return;
          const d = parPiloto(p);
          const ok = await ctx.cad({ titulo: `Montar piloto ${p.nome}`, macro: 'INSERT_PART',
            catia: `prod.Products.AddComponentsFromFiles(Array("UNIDADE_PILOTO_${d.retratil ? 'RETRATIL' : 'FIXO'}.CATProduct"), "All")  ' posiciona em ${p.x}, ${p.y}, ${p.z}`,
            nx: `workPart.ComponentAssembly.AddComponent("unidade_piloto_${d.retratil ? 'retratil' : 'fixo'}.prt", "MODEL", "${p.nome}", new Point3d(${p.x}, ${p.y}, ${p.z}), orientacao, -1, out status)`,
            resultado: `Unidade de piloto ${p.primario ? 'cilíndrico' : 'losango'} Ø${d.diam} criada no furo ${p.nome}` }, b);
          if (!ok) return;
          d.montado = true; reg(`Piloto ${p.nome} montado no CAD (Ø${d.diam}, ${d.retratil ? 'retrátil, curso ' + d.curso + ' mm' : 'fixo'})`); ctx.salvar(); tudo();
          ctx.avisa(`Unidade de piloto montada no furo ${p.nome}.`, { tipo: 'ok' });
          return;
        }
        if (b.id === 'ou-montar-todos') {
          const falta = pilotosDaFixacao().filter((p) => !parPiloto(p).montado);
          if (!falta.length) { ctx.avisa('Todos os pilotos já estão montados.'); return; }
          const ok = await ctx.cad({ titulo: `Montar ${falta.length} piloto(s)`, macro: 'INSERT_PART', catia: 'prod.Products.AddComponentsFromFiles(...)  \' uma unidade por furo', nx: 'workPart.ComponentAssembly.AddComponent(...)  // uma unidade por furo', resultado: falta.map((p) => p.nome).join(', ') }, b);
          if (!ok) return;
          falta.forEach((p) => (parPiloto(p).montado = true)); reg(`${falta.length} piloto(s) montados no CAD`); ctx.salvar(); tudo();
          ctx.avisa(`${falta.length} unidade(s) de piloto montadas.`, { tipo: 'ok' });
          return;
        }
        if (b.id === 'ou-recuo') { const esq = $('#ou-esq-pil', el); esq.classList.toggle('ou-recuado'); b.textContent = esq.classList.contains('ou-recuado') ? 'Simular avanço' : 'Simular recuo'; return; }
        if (b.dataset.montarUn) {
          const k = b.dataset.montarUn, nome = k === 'basculante' ? 'basculante' : 'unidade linear';
          const ok = await ctx.cad({ titulo: `Montar ${nome}`, macro: 'INSERT_PART', catia: `prod.Products.AddComponentsFromFiles(Array("${k.toUpperCase()}.CATProduct"), "All")`, nx: `workPart.ComponentAssembly.AddComponent("${k}.prt", ...)`, resultado: `${nome} inserido e vinculado ao produto` }, b);
          if (!ok) return;
          s[k].montado = true; reg(`${nome[0].toUpperCase() + nome.slice(1)} montado no CAD`); ctx.salvar(); tudo();
          return;
        }
        if (b.dataset.rmPc != null) { s.garra.pecas.splice(+b.dataset.rmPc, 1); ctx.salvar(); tudo(); return; }
        if (b.id === 'ou-add-pc') { s.garra.pecas.push({ nome: 'Peça ' + (s.garra.pecas.length + 1), kg: 1 }); ctx.salvar(); tudo(); return; }
        if (b.id === 'ou-ler-massa') {
          const ok = await ctx.cad({ titulo: 'Ler massa das peças', catia: 'Set inert = prod.GetTechnologicalObject("Inertia"): inert.Mass  \' por peça', nx: 'workPart.MeasureManager.NewMassProperties(...).Mass', resultado: s.garra.pecas.map((p) => `${p.nome}: ${fmt(p.kg, 1)} kg`).join('; ') }, b);
          if (ok) ctx.avisa('Massas lidas do 3D. Os valores da tabela conferem com o modelo.', { tipo: 'ok' });
          return;
        }
        if (b.id === 'ou-montar-garra') {
          const ok = await ctx.cad({ titulo: 'Montar garra', macro: 'INSERT_PART', catia: 'prod.Products.AddComponentsFromFiles(Array("GARRA_BASE.CATProduct"), "All")  \' + ventosas e grampos', nx: 'workPart.ComponentAssembly.AddComponent("garra_base.prt", ...)', resultado: `Garra com ${s.garra.ventosas} ventosas e ${s.garra.grampos} grampos` }, b);
          if (ok) { reg('Garra montada no CAD'); ctx.salvar(); ctx.avisa('Garra montada no CAD, vinculada às peças.', { tipo: 'ok' }); }
          return;
        }
        if (b.id === 'ou-enviar') {
          const r = robosLista().find((x) => x.id === s.garra.robo);
          if (!r) { ctx.avisa('Escolha o robô que leva a garra. Se não houver robô na lista, inclua um no Passo 5.', { tipo: 'erro' }); return; }
          const kg = Math.round(payloadGarra().total * 10) / 10;
          const eq = AE.fatia('equipamentos');
          eq.garra = eq.garra || {};
          eq.garra[r.id] = kg;
          AE.marcarAndamento('equipamentos');
          s.garra.enviado = { kg, robo: r.id, hora: AE.util.hora() };
          reg(`Payload da garra enviado: ${fmt(kg, 1)} kg no robô ${r.id} (ST${r.st})`);
          ctx.salvar(); tudo();
          ctx.avisa(`Payload de ${fmt(kg, 1)} kg gravado no robô ${r.id} (Passo 5). A Simulação recebe o mesmo valor.`, { tipo: 'ok', acao: { texto: 'Ver no Passo 5', fn: () => ctx.ir('equipamentos') } });
          return;
        }
        if (b.id === 'ou-so-pinca') {
          const eq = AE.fatia('equipamentos'); eq.garra = eq.garra || {};
          const alvo = robosLista().filter((x) => eq.garra[x.id] === undefined || eq.garra[x.id] === null || eq.garra[x.id] === '');
          alvo.forEach((x) => (eq.garra[x.id] = 0));
          AE.marcarAndamento('equipamentos');
          reg(`Robôs só com pinça informados (0 kg de garra): ${alvo.map((x) => x.id).join(', ')}`);
          ctx.salvar(); tudo();
          ctx.avisa(`${alvo.length} robô(s) marcados como "só pinça" no Passo 5.`, { tipo: 'ok' });
          return;
        }
        if (b.dataset.sobe != null || b.dataset.desce != null) {
          const i = +(b.dataset.sobe != null ? b.dataset.sobe : b.dataset.desce), j = b.dataset.sobe != null ? i - 1 : i + 1;
          if (j < 0 || j >= s.sequencia.length) return;
          [s.sequencia[i], s.sequencia[j]] = [s.sequencia[j], s.sequencia[i]]; ctx.salvar(); tudo(); return;
        }
        if (b.dataset.rmSeq != null) { s.sequencia.splice(+b.dataset.rmSeq, 1); ctx.salvar(); tudo(); return; }
        if (b.id === 'ou-add-seq') { s.sequencia.push('Novo passo'); ctx.salvar(); tudo(); const ins = $$('#ou-seq input', el); if (ins.length) ins[ins.length - 1].select(); return; }
        if (b.id === 'ou-seq-padrao') { s.sequencia = SEQ_PADRAO.slice(); reg('Sequência voltou ao padrão'); ctx.salvar(); tudo(); }
      });

      $('#ou-concluir', el).onclick = () => {
        const falha = itens().filter((i) => !i[1] && i[3] === 'erro');
        if (falha.length) { ctx.avisa('Ainda não dá para concluir: ' + falha[0][0].toLowerCase() + ' (' + falha[0][2] + ').', { tipo: 'erro' }); return; }
        const aviso = itens().filter((i) => !i[1]);
        ctx.concluir({
          registro: `Outras unidades: ${pilotosDaFixacao().length} piloto(s), payload ${fmt(payloadGarra().total, 1)} kg enviado`,
          preliminar: aviso.length ? true : undefined,
          mensagem: aviso.length ? `Mecânica 5 concluída como PRELIMINAR: ${aviso.map((i) => i[2]).join('; ')}.` : 'Mecânica 5 concluída: pilotos montados, payload enviado e sequência definida.',
        });
        checagem();
      };
    },
  });
})();
