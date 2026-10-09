# Roadmap e perguntas em aberto

## Fases

| Fase | O que entrega | Situação |
| --- | --- | --- |
| **0 · Desenho das telas (v0)** | Telas principais desenhadas pelo Bruno, com as regras de cada passo | feito |
| **0.2 · Protótipo navegável** | Todas as telas do fluxo principal ligadas entre si, grafo de passos, CAD simulado, publicação no GitHub Pages | feito, em revisão |
| **0.3 · Revisão com a equipe** | Bruno e Nelson percorrem o protótipo, respondem as perguntas abaixo e marcam o que muda | próximo |
| **1 · Primeiro corte com CAD de verdade** | Passo 1 no CATIA: ler seleção, criar o Product da subdivisão, importar pontos do Excel, contar chapas, gravar o projeto | a começar |
| **2 · Mecânica com CAD de verdade** | M1 (plano de fixação) e M2 (montar unidades) usando as macros existentes como base | — |
| **3 · Saídas** | M4: desenhos, listas de peças e folhas de cálculo geradas do 3D, no padrão de cada cliente | — |
| **4 · NX** | Adaptador NXOpen para os mesmos passos | — |
| **5 · Fechamento do processo** | Telas 8 a 12 e a segunda rodada da Simulação | — |

## Próximas tarefas

- [ ] Bruno e Nelson: percorrer o [protótipo](https://herondsx.github.io/Projeto-Automacao-de-manufatura/) do Passo 0 até a Mecânica 5 e anotar o que muda (uma *issue* por tela).
- [ ] Responder as perguntas em aberto abaixo (pode ser direto neste arquivo, marcando a caixa e escrevendo a resposta).
- [ ] Reunir as macros antigas em [`src/catia/macros-legado/`](../src/catia/macros-legado/), sem dados de cliente.
- [ ] Decidir a arquitetura (ver [arquitetura proposta](arquitetura.md)) e registrar a decisão.
- [ ] Definir a licença do repositório.
- [ ] Montar o primeiro cadastro de cliente (padrão de nomes, pastas, catálogo, leitura do plano de fixação) como arquivo de dados.

## Perguntas em aberto

Levantadas tela a tela durante a montagem do protótipo. Onde o protótipo precisou supor alguma coisa, a suposição está escrita na pergunta. Os números usados nas telas são **dados de exemplo**.

### Fluxo do projeto

- [ ] Numeração da Mecânica: no trilho da v0, M3 era "Conferir alertas" e M4 "Desenhos e listas"; no fluxo da v0, M3 é "Peso, listas e sequência" e M4 "Revisões DR01–DR03". Qual vale?
- [ ] Os laços (payload da M3 volta ao Passo 5, posição dos robôs da Simulação volta ao Passo 7) criam ciclos no grafo. Hoje o protótipo só declara as entradas da primeira passada. Como numerar cada giro (C1 → C2) e quais passos marcar para conferir de novo?
- [ ] O Passo 8 (lista de segurança) vem antes ou depois da primeira rodada da Simulação? Ele depende do layout, que depende da posição dos robôs.

### Passo 0 · Novo projeto

- [ ] Linha mista: o ciclo deve sair da soma dos volumes dos modelos? Hoje o protótipo usa o modelo mais exigente.

### Passo 1 · Separação do produto

- [ ] Com 3 ou mais subdivisões, a junção é uma estação só (como o protótipo faz) ou uma por par de subconjuntos?
- [ ] O desenho 2D do cliente traz o número de chapas por ponto? O protótipo supõe que só a planilha traz.
- [ ] Tolerância para ligar ponto à peça e contar chapa sobreposta: o protótipo supõe 0,5 mm.
- [ ] Conjunto que chega soldado e não é marcado como BY: os pontos de dentro entram no ciclo? Hoje a checagem exige marcar BY.
- [ ] A v0 previa marcar um ponto avulso como BY. O formato atual só tem BY por peça.
- [ ] Arredondamento: meio milímetro sobe (Math.round). Confirmar com o padrão do cliente.

### Passo 2 · Tempos padrão

- [ ] Formato da planilha de tempos de cada cliente (colunas, unidades). O protótipo supõe uma linha por operação, em segundos.
- [ ] O Passo 4 usa um único tempo de carga por peça para todos os postos. Deveria usar o MTM de cada posto? Hoje "Levar o MTM para a tabela" grava o pior caso.
- [ ] O MTM é guardado pelo número da estação (ST10). Se o número mudar no Passo 1, o estudo se perde: guardar pelo id interno da subdivisão?
- [ ] O tempo de solda muda com a espessura e com 3 chapas? Hoje é um valor só por ponto.
- [ ] Os valores da "planilha do cliente" são de exemplo.

### Passo 3 · Operador e ergonomia

- [ ] Os limites das zonas são de exemplo (verde: 800 a 1300 mm de altura e até 450 mm de distância; amarela: 600 a 1500 mm e até 650 mm). Precisam vir da norma de ergonomia do cliente.
- [ ] Conferir com um operador só (173 cm) ou com dois percentis (o mais baixo e o mais alto)?
- [ ] O peso da peça muda o limite da zona? Hoje não entra.
- [ ] "Lado da base": o protótipo trata como o lado do dispositivo em que o operador fica (esquerdo ou direito). Confirmar.
- [ ] Itens de manutenção: vêm da lista de equipamentos (Passo 5) ou o usuário cadastra aqui? Hoje são exemplo.
- [ ] F2 (mudança depois do F1) precisa de nova aprovação do cliente? O protótipo supõe que sim.

### Passo 4 · Necessidade de estações

- [ ] Quem define os pontos de geometria (usuário ou fabricante) e como entram? O protótipo usa as pontas de cada junção (2 por junção); geoPorJuncao é guardado, mas o cálculo ainda não lê esse número.
- [ ] Linha mista: dimensionar pelo modelo mais exigente (como agora) ou pelo volume somado dos modelos?
- [ ] Estação de respot que também passa do máximo: gera outro respot? Hoje ela aparece como "não fecha".
- [ ] Toda estação de subconjunto tem carga manual de todas as peças? Peça que chega por transportador não deveria contar o MTM.
- [ ] O tempo de transferência é o mesmo para todas as estações?
- [ ] Estações já definidas pelo cliente ou por vendas: como entram (número e conteúdo) para o programa comparar com o cálculo?

### Passo 5 · Equipamentos

- [ ] Em que formato chega a lista de homologados do cliente (planilha, por fabricante, por tipo de equipamento)?
- [ ] O payload conta cabos e mangueiras (dress pack) além da pinça e da garra?
- [ ] Pinça reserva e trocador de pinças entram como itens desta lista?
- [ ] Mesa e grade são listadas aqui ou só no layout (Passos 7 e 11)?
- [ ] Suposição do protótipo: o peso da garra é digitado à mão quando a Mecânica devolve. No programa real ele viria do 3D da garra (M3).

### Passo 6 · Capacidade e macro ciclo

- [ ] Operações além da solda (cola, pino, MIG, furação) ainda não somam tempo no macro ciclo. Elas correm em série ou em paralelo com a solda? A tabela do Passo 2 tem cola e pino, mas não MIG e furação.
- [ ] Como o programa sabe em que estação o produto pede cada item? Suposição do protótipo: furação e pinos na estação de geometria, cola na segunda estação, MIG na primeira.
- [ ] Pinça estacionária, garra dupla e garra com pinça: que números mudam no cálculo (tempo de carga, pontos por robô)? Hoje ficam só registradas como "a estudar com a Simulação".
- [ ] "Tem o equipamento mas não tem a operação": quem cadastra a operação de cada equipamento em cada estação?

### Passo 7 · Layout

- [ ] A tabela altura da grade × distância mínima é de EXEMPLO (1400 → 1100, 1800 → 800, 2200 → 400 mm). Tem de vir da norma adotada (ex.: ISO 13857) ou do padrão do cliente, e na norma ela depende também da altura da zona de perigo.
- [ ] O alcance é o círculo cheio do catálogo do robô. Se o cliente aceita limitar a zona por software de segurança do robô, a distância passa a ser medida da zona limitada?
- [ ] Supus a bomba de cola fixa junto ao corredor e os 12 m medidos da bomba até o pedestal. Na lista de equipamentos eles estão juntos ("Pedestal de cola com bomba"). Os 12 m valem para qual trecho?
- [ ] Cabo em L + 1,5 m: qual é a regra real do percurso (calha por cima, descida no armário)?
- [ ] Armários: um por robô, lado a lado, atrás do corredor de serviço. Existe padrão de painel por estação (PLC, controle de solda)?
- [ ] Pilares em 12 × 24 m, zero predial no pilar A1, corredores de 2 m e 3,5 m e passagem de retirada de 1,2 m são exemplo. Devem vir do DWG do prédio e do padrão do cliente.
- [ ] O layout é desenhado no CATIA ou no NX e exportado em DWG, ou o time desenha no AutoCAD? Isso muda a rotina de exportação.

### Simulação · Ambiente, acessos e distribuição

- [ ] Qual software de simulação o time usa: Process Simulate (Tecnomatix) ou DELMIA? O protótipo mostra DELMIA quando o CAD é CATIA e Process Simulate quando é NX, mas isso é suposição.
- [ ] Limite de pinças por PLC (6) e força necessária por número de chapas (3,2 kN para 2 chapas + 1 kN por chapa a mais) são de exemplo. De onde vêm os valores reais?
- [ ] Os pontos sem acesso e o robô que não alcança (80 mm) são marcados de forma fixa, para demonstração.
- [ ] Troca de pinça: contei 2 trocas por ciclo (pegar a pinça especial e devolver). Está certo?
- [ ] Pinça nova e troca de pinça mudam a lista de equipamentos: o Passo 5 deve ser atualizado automaticamente ou o Processo confirma?
- [ ] A versão do estudo é por estudo (PLC e zona) ou uma só para a Simulação inteira?

### Mecânica 1 · Revisão do plano de fixação

- [ ] As distâncias das regras (200 mm do piloto, 100 mm da solda) foram supostas: qual é o valor do Bruno e do Nelson?
- [ ] "Mínimo de 3 apoios em cada plano": o protótipo conta os apoios do plano principal. Precisa contar por direção (3-2-1)?
- [ ] O centro de gravidade e a junção da peça são de exemplo. No programa real eles vêm do 3D (massa e CG da peça, curvas de junção).
- [ ] O passo é concluído por estação ou só quando todas as estações tiverem o plano liberado?
- [ ] Quem do cliente pode aprovar (cargo, área)? O protótipo só guarda o texto digitado.

### Mecânica 2 · Montar unidades

- [ ] "Altura da base" (Z do topo da placa base no zero carro) foi acrescentada para calcular a torre: de onde vem no projeto real (project book, altura de trabalho)?
- [ ] Peso em movimento e distância do CG são estimados aqui (por pisador e pela abertura do grupo). No programa real vêm do 3D.
- [ ] Tabela da SMC e alturas NAAMS são de exemplo. Precisamos das tabelas reais.
- [ ] Os 8 modelos de partida (AP1, AP2…) são nomes supostos. Quais são as 8 montagens do Bruno?
- [ ] Qtd do pacote de calços: suposto 2 por sentido de ajuste + 2 no pisador. Confere?

### Mecânica 3 · Conferir alertas

- [ ] A trava de acesso de parafuso, a flecha e os furos da base são fixos de exemplo (como na v0). No programa real saem do 3D.
- [ ] Grampo aprovado só com ciclo de 2 s: é aviso (aceitar com motivo) ou trava? O protótipo trata como aviso.
- [ ] A colisão sempre dá "sem colisão" no protótipo. Como o resultado volta para a Simulação quando há colisão?

### Mecânica 4 · Desenhos e listas

- [ ] Coluna "lado simétrico": o protótipo supõe posição par para a peça espelhada (1 → 2, 3 → 4) e a mesma posição para as de catálogo. É assim nas listas reais?
- [ ] DR01 e DR02 só ficam registradas aqui; os comentários do cliente deveriam virar pendências ligadas à unidade (fluxo M4 da v0).
- [ ] Folha de cálculo dos grampos, pacote da base, tabela de calços e lista de exceções não têm macro antiga: são novas.

### Mecânica 5 · Outras unidades e garras

- [ ] Diâmetros padrão de pino e curso por cliente: vêm do padrão do cliente? (valores aqui são de exemplo)
- [ ] Margem de 80% da capacidade do robô: qual regra a equipe usa? Considera inércia e o cabo (dress pack)?
- [ ] Basculante e unidade linear: existe biblioteca de modelos de partida como a das torres?
- [ ] A sequência de abertura e fechamento sai daqui ou da Simulação (S4)?
