# Patrimoine SLV — Simulateur Patrimonial

Simulateur patrimonial complet en français, entièrement côté client (aucun serveur requis).

## Fonctionnalités

- **Tableau de bord** : vue d'ensemble du patrimoine net, actifs vs passifs, graphiques de répartition
- **Gestion des actifs** : immobilier, placements financiers (AV, PEA, CTO, PER, Crypto), épargne (Livret A, LDDS, etc.)
- **Gestion des passifs** : emprunts immobiliers et crédits avec suivi du taux d'endettement
- **Revenus & Dépenses** : suivi mensuel des entrées/sorties avec calcul de la capacité d'épargne
- **Projection patrimoniale** : simulation sur 1 à 50 ans avec rendements personnalisables, inflation et amortissement des emprunts
- **Estimation fiscale** : calcul de l'impôt sur le revenu (barème progressif, quotient familial, décote, PFU)
- **Import/Export JSON** : sauvegarde et restauration des données
- **Responsive** : interface adaptée mobile, tablette et desktop

## Stack technique

- HTML5 + Tailwind CSS (CDN)
- JavaScript vanilla (ES Modules)
- Chart.js pour les graphiques
- localStorage pour la persistance des données
- Aucun build tool requis

## Utilisation

Ouvrir `index.html` dans un navigateur moderne, ou servir les fichiers avec un serveur HTTP local :

```bash
npx serve .
# ou
python3 -m http.server 8000
```

## Structure du projet

```
├── index.html                  # Point d'entrée
├── css/custom.css              # Styles personnalisés
├── data/tax-brackets.json      # Barème IR 2025
└── js/
    ├── app.js                  # Routeur et initialisation
    ├── store.js                # Couche données (localStorage)
    ├── utils.js                # Helpers (formatage, modals, projection, fiscalité)
    ├── charts/chart-config.js  # Configuration Chart.js
    └── components/
        ├── dashboard.js        # Tableau de bord
        ├── actifs.js           # Gestion des actifs
        ├── passifs.js          # Gestion des passifs
        ├── revenus-depenses.js # Revenus et dépenses
        ├── projection.js       # Projection patrimoniale
        └── fiscalite.js        # Estimation fiscale
```
