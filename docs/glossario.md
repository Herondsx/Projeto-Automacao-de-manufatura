# Glossário

Termos usados nas telas e nos documentos. Quando um termo depende do cliente, o padrão de cada cliente manda.

| Termo | Significado |
| --- | --- |
| **BIW** (Body in White) | Carroceria soldada, antes da pintura. |
| **BY** | Subconjunto que já chega soldado de fora da linha. Vira uma peça única; os pontos de dentro saem do cálculo de ciclo, mas continuam no 3D. |
| **Subdivisão** | Grupo de peças soldadas juntas; vira um Product (CATIA) ou Assembly (NX) e uma estação provisória. |
| **ST10, ST20…** | Número da estação. Provisório de 10 em 10 até ser definido. O programa guarda um id interno fixo; o número é só um atributo. |
| **Estação de geometria (geo)** | Onde as peças são posicionadas e recebem os pontos que fixam a geometria. |
| **Respot** | Estação que completa os pontos que não couberam no ciclo da estação anterior. |
| **Ponto de geometria** | Ponto de solda que fixa a posição relativa das peças. Sem definição do cliente, o protótipo usa o mínimo de 2 por junção. |
| **Chapas** | Quantidade de chapas sobrepostas no ponto de solda. Mais de 2 gera alerta. |
| **JPH** | Carros por hora (jobs per hour). |
| **Tempo de ciclo** | Tempo por carro em cada estação: (3600 ÷ carros por hora) × disponibilidade. |
| **Disponibilidade** | Percentual do tempo em que a linha produz (descontadas paradas). |
| **Retooling** | Reaproveitar uma linha existente para um produto novo. |
| **Codesigner** | Layout feito na fase de vendas, usado como ponto de partida. |
| **MTM** | Método de tempos predeterminados para o trabalho do operador. |
| **Macro ciclo** | Sequência de operações de uma estação contra o tempo de ciclo. |
| **Ciclograma** | Macro ciclo detalhado com os tempos reais dos robôs. |
| **Pinça (X ou C)** | Ferramenta de solda a ponto no robô. O formato (X ou C) define o acesso. |
| **Nuvem de pinças** | Envelope de todas as posições das pinças, entregue pela Simulação para a Mecânica conferir colisão. Formatos JT e CGR. |
| **PLC / zona** | Controlador e área de segurança. Um estudo de simulação por PLC e zona. |
| **Payload** | Peso que o robô carrega (pinça ou garra + peça). |
| **Plano de fixação** | Pontos onde o dispositivo apoia, prende e localiza a peça. Nome muda por cliente: **RPS** (VW), **Datum** (GM), **pré-método** (Stellantis), PCM, PLP. |
| **Hp / Lp** | Furo primário / secundário (pré-método): onde entram os pilotos. |
| **Piloto (pino)** | Pino que localiza a peça pelo furo. 4 direções no furo primário, 2 no secundário. |
| **Apoio** | Bloco onde a peça encosta. |
| **Pisador** | Bloco que prende a peça contra o apoio, levado pelo braço do grampo. |
| **Grampo** | Atuador (pneumático) que fecha o pisador. Ex.: Tünkers V 63.1 (tamanho 63), braço A40, ângulo de abertura 105°. |
| **Torre / console** | Peça que sobe da base do dispositivo até a altura do ponto. |
| **Cantoneira** | Peça em L que liga a torre ao apoio e dá o sentido de ajuste. |
| **Calço / pacote de calços** | Lâminas para ajustar a posição (ex.: pacote 65×20). Tabela de calços = *shims book*. |
| **Bloco de contorno** | Apoio ou pisador com a face usinada no formato do produto ("face matematizada para fresar"). |
| **Bruto** | Medida da matéria-prima antes da usinagem. Notação `BL espessura × largura × comprimento` (ex.: `BL 19×118×140`). |
| **ABNT 1045 / 1015** | Aços usados nas peças do dispositivo (1045 em blocos de contato, 1015 em consoles, no exemplo de referência). |
| **NAAMS** | Padrão norte-americano de componentes de dispositivo (GM, Ford). |
| **Catálogo Comau** | Padrão de componentes usado como base para os demais clientes. |
| **Unidade** | Conjunto montado em um ponto de fixação: torre, cantoneira, calços, apoio, grampo, pisador. |
| **DR01, DR02, DR03** | Revisões de projeto do dispositivo com o cliente. |
| **C1, C2… / F1, F2…** | Versão de conceito / versão final. Passar de C para F exige aprovação registrada. |
| **ART** | Anotação de Responsabilidade Técnica, assinada pelo engenheiro responsável (cálculo da base). |
| **Flecha** | Deformação da base do dispositivo sob carga. |
| **Zero carro / grade** | Sistema de coordenadas do veículo; as linhas de grade (ex.: de 100 em 100 mm) aparecem nos desenhos. |
| **Zero predial** | Origem de coordenadas do prédio, usada no layout. |
| **Tucker** | Pino soldado (stud) aplicado por pistola. |
| **MIG** | Solda a arco com arame (cordão). |
| **Oxicorte** | Corte a maçarico da chapa grossa. Peças cortadas saem na folha de contornos. |
| **JT / CGR / DWG / DXF** | Formatos de arquivo: visualização 3D leve (JT, CGR), desenho 2D (DWG, DXF). |
