# Referências de projetos reais

Arquivos de projetos reais de clientes **não entram neste repositório**, que é público. Eles ficam guardados fora do git (com o Heron ou no servidor do projeto) e servem só para aprender a estrutura. Aqui fica o que foi aprendido com cada um, sem números de peça, nomes ou dados do cliente.

## Unidade de fixação de referência (projeto de 2014)

Um pacote completo de **uma unidade de fixação** ("ponto de aperto 01") de um dispositivo de solda real, no padrão de uma montadora alemã, feito por um fornecedor de dispositivos no Brasil.

### O que o pacote tem

| Pasta | Conteúdo |
| --- | --- |
| Modelos 3D (`_BM`) | Um CATPart por peça (consoles, blocos de contorno, pacote de calços, grampo, parafusos e pinos de norma) e o CATProduct da unidade |
| Desenhos (`_BZ`) | CATDrawing da unidade, folhas em PDF, desenho de contornos para oxicorte (DWG e PDF) e a lista de material em PDF |
| Modelos para usinagem (`_NCM`) | Cópia dos blocos de contorno para o CAM |
| Lista de peças (`.stkl`) | Lista de peças do meio de produção em formato da montadora |

### O que aprendemos (e já está no protótipo)

- **Nome de arquivo**: `<nº do dispositivo>_<posição com 4 dígitos>_<revisão>_<DENOMINAÇÃO>`, com revisão começando em `A00`. Vira o padrão "nome de arquivo" do cadastro do cliente (tela Passo 0 e Mecânica 2).
- **Posições da lista de peças**: peças fabricadas em posições ímpares (1, 3, 5…), pacote de calços na 299, grampo na 738, placa de identificação na 905. Peças de norma (parafusos ISO 4762, pinos ISO 8734) entram como itens de norma.
- **Estrutura de uma unidade simples**: console (torre) + bloco de contorno do apoio + bloco de contorno do pisador + 2 pacotes de calços 65×20 + grampo Tünkers V 63.1, braço A40, ângulo de abertura 105° + placa de identificação.
- **Materiais e bruto**: blocos de contato em ABNT 1045, console em ABNT 1015; bruto no formato `BL 19×118×140` (espessura × largura × comprimento), marcado para oxicorte quando for o caso.
- **Desenho**: vistas com as linhas de grade do carro (de 100 em 100 mm) e as coordenadas dos pontos de contato em mm inteiro (no formato `X = 1450`, `Y = -300`, `Z = -200`). Lado esquerdo e lado direito com números de dispositivo próprios (simetria).
- **Lista de material**: número da posição, quantidade por lado, denominação, norma, matéria-prima, dimensão do bruto, fabricante e código do item comprado.

Essas convenções aparecem no protótipo como **dados de exemplo**: os números mostrados nas telas são inventados.

## Planilhas de pendências de cliente

Listas de pendências (open issues) recebidas de clientes também ficam fora do repositório. Quando o programa tiver a tela de pendências de revisão (DR01–DR03), o formato delas será a referência.
