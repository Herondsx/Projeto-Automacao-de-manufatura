# CATIA V5

Código que conversa com o CATIA V5 por automação COM.

```
src/catia/
├── macros-legado/   macros que a equipe já usa (VBA, CATScript), como referência
└── ...              adaptador do programa (a criar, ver docs/arquitetura.md)
```

## Macros legadas a reunir

As telas do protótipo citam estas macros como base. Elas ainda **não** estão aqui:

`Part_2_Product`, `CreateAllCatPart`, `RENAME_STATION_FIAT`, `Cordenadas`, `WritePoints2Excel`, `960_WeldSpotsAddPart`, `Create_Clamping_area`, `INSERT_PART`, `naams.xla`, `09_Pomigliano_965_DraftingGen`, `10_Balloon`, `21_AUTO_ALL_VIEWS`, `jlr_grid_100`, `Symmetry_Instance`, `Mirror_an_ZX_all`, `conversao_corte_a_macarico`, `LP_rev4`, `BOM_CATIA-LISTA-PREL`.

Ao trazer uma macro:

1. Coloque o arquivo em `macros-legado/` (um arquivo por macro, `.bas`, `.CATScript` ou `.catvba` exportado em texto).
2. Tire dados de cliente que estejam escritos no código (nomes de projeto, caminhos de servidor, números de peça).
3. Acrescente uma linha na tabela de [docs/integracao-cad.md](../../docs/integracao-cad.md) com o que ela faz, o que lê e o que grava.
