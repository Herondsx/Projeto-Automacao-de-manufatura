# Integração com o CAD (CATIA V5 e NX)

O programa **comanda o CAD aberto na máquina**. No protótipo isso é simulado: cada botão de CAD chama `AE.cad({...})`, que só registra no **Console do CAD** a chamada que o programa real faria (troque entre CATIA e NX na barra de cima para ver as duas).

## Como cada lado é automatizado

| | CATIA V5 | Siemens NX |
| --- | --- | --- |
| API | Automação **COM** (a mesma usada por VBA e CATScript) | **NXOpen** (.NET, C++, Java, Python) |
| De onde o código roda | De fora do CATIA (outro processo pega o `CATIA.Application` aberto) ou como macro dentro dele | Normalmente **dentro** do NX (journal ou DLL carregada pelo NX). Para comandar de fora, um "agente" carregado no NX recebe os pedidos |
| Selecionar no CAD | `CATIA.ActiveDocument.Selection` (`SelectElement2/3`, `Count`, `Item(i)`) | `UI.GetUI().SelectionManager` (`SelectTaggedObject(s)`) |
| Montagem | `Product.Products.AddNewComponent`, `AddComponentsFromFiles` | `ComponentAssembly.AddComponent`, `CreateNewComponent` |
| Desenho | `DrawingDocument.Sheets`, `DrawingViews` | `Drawings.DraftingDrawingSheet`, `BaseView` |
| Medidas e massa | `SPAWorkbench.GetMeasurable`, `Analyze.Mass` / `Inertia` | `MeasureManager`, `MeasureBodies` |

## Macros antigas de base

As telas da v0 citam macros que já existem na equipe e servem de ponto de partida. **Elas ainda não estão no repositório**: o próximo passo é reunir os arquivos em [`src/catia/macros-legado/`](../src/catia/) e descrever cada uma.

| Macro | Usada em | O que faz (pela v0) |
| --- | --- | --- |
| `Part_2_Product`, `CreateAllCatPart` | Passo 1 | Criar o Product da subdivisão e mover as peças |
| `RENAME_STATION_FIAT` | Passo 1 | Renomear por estação |
| `Cordenadas`, `WritePoints2Excel` | Passo 1, M1 | Ler nome e coordenadas de pontos e gravar no Excel |
| `960_WeldSpotsAddPart` | Passo 1 | Ligar ponto de solda à peça (referência) |
| `Create_Clamping_area` | M2 | Criar o apoio e trimar (conceito) |
| `INSERT_PART`, `naams.xla` | M2 | Inserir peça de catálogo; biblioteca NAAMS |
| `09_Pomigliano_965_DraftingGen` | M4 | Gerar folhas de desenho |
| `10_Balloon` | M4 | Balões por posição |
| `21_AUTO_ALL_VIEWS` | M4 | Vistas automáticas |
| `jlr_grid_100` | M4 | Grade de coordenadas na vista |
| `Symmetry_Instance`, `Mirror_an_ZX_all` | M4 | Lado simétrico |
| `conversao_corte_a_macarico` | M4 | Folha de contornos para oxicorte |
| `LP_rev4`, `BOM_CATIA-LISTA-PREL` | M4 | Lista de peças |

Pelos nomes, várias foram feitas para clientes específicos (FIAT, Pomigliano, JLR). Parte do trabalho é tirar o que é do cliente de dentro do código e passar para o cadastro do cliente (princípio 4 da [visão geral](visao-geral.md)).

## Equivalência no NX

Para cada macro do CATIA, o NX precisa de um equivalente em NXOpen. A primeira versão do programa pode começar só com o CATIA, desde que o código já nasça com a separação abaixo:

```
Tela / regra do projeto  →  serviço do programa  →  adaptador de CAD  →  CATIA (COM) ou NX (NXOpen)
```

As regras (agrupar apoios a 120 mm, contar chapas, calcular grampo…) ficam no serviço e não sabem qual CAD está do outro lado. Só o adaptador conhece o CATIA ou o NX. Ver [arquitetura proposta](arquitetura.md).
