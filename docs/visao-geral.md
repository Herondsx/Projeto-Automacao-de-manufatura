# Visão geral

## O problema

Projetar uma linha de solda de carroceria (BIW) passa por três áreas que trocam informação o tempo todo:

| Área | O que faz | Exemplos de trabalho repetitivo hoje |
| --- | --- | --- |
| **Processo** | Planeja a linha: separa o produto, define estações, robôs, equipamentos, tempos, layout | Separar o produto em subconjuntos no CAD, contar chapas por ponto, conferir volumes e ciclos em planilha, renumerar estações em dezenas de arquivos |
| **Simulação** | Prova que funciona: acessos, distribuição dos pontos por robô, nuvem de pinças, validação | Montar o ambiente de estudo, redistribuir pontos sem acesso, gerar a nuvem de pinças para a Mecânica |
| **Mecânica** | Projeta dispositivos (fixação) e garras | Revisar o plano de fixação do cliente ponto a ponto, montar unidades de catálogo, calcular grampos, gerar desenhos, listas e folhas de cálculo |

Boa parte disso é feita à mão no **CATIA V5** ou no **Siemens NX**, com macros soltas, planilhas e muita conferência visual. Cada cliente (montadora) tem um padrão diferente de nomes, pastas, catálogos e planos de fixação.

## A proposta

Um programa que **conduz o projeto inteiro em passos**, comanda o CAD que já está aberto na máquina para fazer o trabalho repetitivo e confere sozinho o que hoje é conferido no olho.

O que já está desenhado está no [protótipo navegável](../prototipo/) e no [fluxo do projeto](fluxo.md).

## Princípios

Estas regras vieram da v0 do Bruno e valem para o programa todo:

1. **O programa não substitui o CAD.** Ele comanda o CATIA ou o NX que já está aberto. Todo passo de CAD tem três partes: instrução na tela, leitura da seleção e execução automática.
2. **O fluxo é um grafo.** Cada passo declara suas entradas, sua saída e de quais passos depende.
3. **Entrada que não chegou não trava o passo.** Ele roda com um valor de reserva e a saída fica **preliminar**, marcada para conferência. Quando a entrada chega, o programa avisa quais passos precisam ser conferidos de novo.
4. **O padrão do cliente é dado, não código.** Nomes de arquivo, pastas, tempos, normas, catálogo e leitura do plano de fixação vêm de um cadastro por cliente. Cliente novo é cadastro novo, sem mexer no programa.
5. **Tudo o que o programa propõe pode ser editado, e a edição fica registrada.** Quem mudou, quando e por quê.
6. **Versões de conceito e final.** Conceito é `C1`, `C2`…, final é `F1`, `F2`…. Passar de C para F exige aprovação registrada; mudança depois do F1 cria F2 e pede o motivo. O ideal é existir só o F1.
7. **Coordenadas sempre em milímetro inteiro.** O que vem do cliente com decimal é arredondado na entrada, e o valor original fica guardado.
8. **O usuário nunca escolhe onde salvar.** Cada documento tem a sua pasta na estrutura do projeto.
9. **Alerta avisa, trava impede.** Regras de boa prática geram alerta (o usuário decide e segue). Regras de segurança ou de cálculo reprovado travam a liberação.
10. **Revisão do cliente é parte do fluxo.** Plano de fixação, ergonomia, layout e dispositivo passam por aprovação (DR01, DR02, DR03), e cada comentário vira pendência com dono.

## O que já existe

- **v0**: protótipo de telas do Bruno ([`prototipo/original/telas-bruno-v0.html`](../prototipo/original/telas-bruno-v0.html)).
- **v0.2**: o mesmo desenho, reorganizado em um app estático com as telas ligadas entre si, todas as telas do fluxo principal desenhadas, simulação do CATIA/NX e as regras do grafo funcionando ([`prototipo/`](../prototipo/), [como é montado](prototipo.md)).

## O que ainda não existe

- Integração real com o CATIA e o NX (ver [integração com CAD](integracao-cad.md) e [arquitetura proposta](arquitetura.md)).
- As macros antigas que servem de base (citadas nas telas) ainda não estão no repositório. Ver [`src/catia/`](../src/catia/).
- Telas de fechamento do processo (segurança, ciclograma, fundação, grades, folha de instrução) e a segunda rodada da Simulação.
