# Siemens NX

Código que conversa com o NX por NXOpen.

No NX o código normalmente roda **dentro** do programa (journal ou DLL). A proposta em [docs/arquitetura.md](../../docs/arquitetura.md) é um pequeno agente carregado no NX que recebe os pedidos do programa por um canal local.

Para cada ação de CAD do protótipo existe a chamada equivalente em NXOpen no **Console do CAD** (troque para NX na barra de cima do protótipo). Esses trechos são o ponto de partida do adaptador.

A fazer:

- Confirmar a versão do NX usada pela equipe e as linguagens NXOpen liberadas (.NET, Python).
- Reunir journals que a equipe já usa, se existirem, em `journals-legado/`.
