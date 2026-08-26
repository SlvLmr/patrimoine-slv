# Tests des calculs financiers

Sans build ni dépendance — Node ≥ 20 suffit :

```
node --test tests/
```

Les tests vérifient des invariants du moteur de projection (`js/utils.js`) :
plafond PEA, taxation AV aux PS seuls, croissance épargne, transferts de
capital, amortissement de dette, DCA (overrides), parsing des montants.
Ils documentent le comportement ACTUEL — toute régression sur ces règles
fera échouer la suite.
