import { formatCurrency, computeProjection } from '../utils.js?v=5';

// ============================================================================
// STRATEGIE PATRIMONIALE — Plan complet Sylvain
// ============================================================================

// ─── Timeline Data ──────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 'step-1',
    date: '2026',
    badge: 'Priorité absolue',
    badgeColor: 'red',
    num: '①',
    title: 'Démembrement de la maison',
    body: `Tu donnes la nue-propriété à Gaspard et Agathe (50/50) chez le notaire. Tu conserves l'usufruit à vie — tu continues d'habiter, de louer, de décider. À 43 ans, la NP vaut ~60% de 330 000 € = <strong class="text-amber-300">198 000 €</strong> transmis (99 000 €/enfant), dans l'abattement de 100 000 € → <strong class="text-emerald-400">zéro droit</strong>.`,
    details: [
      { icon: 'arrow', text: `<strong>Clause de report d'usufruit obligatoire</strong> : si tu vends, l'usufruit se reporte automatiquement sur le remploi. Sans elle, vente bloquée par le juge des tutelles (enfants mineurs).` },
      { icon: 'arrow', text: `À ton décès : usufruit éteint automatiquement. Pleine propriété restituée sans droits, sans formalité. La maison vaudra <strong class="text-amber-300">~430 000 €</strong> en 2055 (+1%/an) — toute la hausse leur appartient déjà.` },
      { icon: 'arrow', text: `Mettre à jour <strong>clause bénéficiaire Linxea</strong> en même temps.` },
      { icon: 'arrow', text: `Frais notaire : ~3 000–4 000 € sur livrets.` },
      { icon: 'arrow', text: `<strong>PEA nominatif administré</strong> : vérifier que les 20 Air Liquide sont bien en nominatif administré chez Trade Republic → prime de fidélité activée.` },
    ],
    kpis: [
      { label: 'Transmis maintenant', value: '198 000 €', color: 'amber' },
      { label: 'Droits de donation', value: '0 €', color: 'emerald' },
      { label: 'Valeur à ton décès', value: '~430 000 €', color: 'sky' },
    ],
    tags: [
      { text: '198k€ transmis · zéro droit', color: 'emerald' },
      { text: 'Notaire obligatoire', color: 'pink' },
      { text: 'Frais ~3-4k€', color: 'amber' },
    ],
    color: 'amber',
  },
  {
    id: 'step-2',
    date: 'Novembre 2026',
    badge: 'Crédit soldé · +650 €/mois libérés',
    badgeColor: 'sky',
    num: '②',
    title: 'Réallocation immédiate',
    body: `Le crédit s'arrête. 650 €/mois se libèrent. Réallocation sans forcer de don — pas assez de cash disponible pour un don Sarkozy significatif.`,
    bullets: [
      { text: '200 €/mois → Linxea Spirit 2 (avec apport initial de 500 €)', color: 'purple' },
      { text: '290 €/mois → Épargne liquide (objectif : constituer le don Sarkozy d\'ici 2030)', color: 'emerald' },
      { text: '60 €/mois → Bitcoin DCA (déjà en cours)', color: 'orange' },
    ],
    details: [
      { icon: 'arrow', text: `PEA 605 €/mois déjà lancé depuis mars 2026 — rien à changer.` },
      { icon: 'arrow', text: `<strong>Don Sarkozy reporté</strong> : pas assez de cash. Fenêtre de 15 ans → pas d'urgence.` },
    ],
    tags: [
      { text: 'Linxea démarre', color: 'purple' },
      { text: 'Don Sarkozy reporté à 2030', color: 'amber' },
    ],
    color: 'sky',
  },
  {
    id: 'step-3',
    date: '2027–2029',
    badge: 'Phase d\'accumulation · Rien à forcer',
    badgeColor: 'gray',
    num: '③',
    title: 'Tous les DCA tournent automatiquement',
    body: `PEA (605 €/mois), Linxea (200 €/mois), Bitcoin (~83 €/mois), CTO Round up (40 €/mois), PEE (2 500 €/an), CTO enfants (50 €/mois chacun). Tu accumules ~290 €/mois de cash libre.`,
    kpis: [
      { label: 'PEA fin 2029', value: '~50 000 €', color: 'emerald' },
      { label: 'Linxea fin 2029', value: '~8 000 €', color: 'purple' },
      { label: 'Cash libre accumulé', value: '~10 000 €', color: 'amber' },
      { label: 'Air Liquide', value: '24 actions', color: 'sky' },
    ],
    tags: [
      { text: 'Phase passive · laisser tourner', color: 'gray' },
    ],
    color: 'indigo',
  },
  {
    id: 'step-4',
    date: '2030',
    badge: '~10 000 € de cash libre',
    badgeColor: 'cyan',
    num: '④',
    title: 'Don Sarkozy — déclenchement du compteur',
    body: `Le don Sarkozy (art. 790 G CGI) = cash uniquement (jamais de titres). Plafond : 31 865 €/enfant. Tu verses ~4 500–5 000 €/enfant. Ce n'est pas le max, mais ça <strong class="text-cyan-300">déclenche le compteur des 15 ans</strong> — renouvellement possible dès 2045. Le solde (~27 000 €/enfant) se complète jusqu'en 2041. Cumulable avec l'abattement classique de 100 000 € (deux enveloppes séparées).`,
    details: [
      { icon: 'arrow', text: `Formulaire <strong>2735</strong> en ligne sur impots.gouv.fr — à déclarer dans le mois suivant le virement.` },
      { icon: 'arrow', text: `<strong>Pourquoi déclencher tôt ?</strong> Un premier don en 2030 permet un renouvellement dès 2045 — avant tes 62 ans. Attendre 2035 décale à 2050.` },
    ],
    tags: [
      { text: 'Compteur 15 ans déclenché', color: 'cyan' },
      { text: 'Formulaire 2735 en ligne', color: 'gray' },
      { text: 'Cash uniquement — jamais de titres', color: 'orange' },
    ],
    color: 'cyan',
  },
  {
    id: 'step-5',
    date: '2037–2040',
    badge: 'Héritage papa (~150 000 € cash)',
    badgeColor: 'pink',
    num: '⑤',
    title: 'Réinjection stratégique — tournant du plan',
    body: `150 000 € en cash. Répartition décidée. Chaque euro est fléché vers l'enveloppe la plus efficace fiscalement.`,
    bullets: [
      { text: '60 000 € → Linxea Spirit 2 (versement exceptionnel). Versé avant 70 ans → dans l\'enveloppe des 152 500 €/enfant. Surveiller : ne pas dépasser 305 000 € de capital total (2 × 152 500 €).', color: 'purple' },
      { text: '50 000 € → CTO perso (ETF World + Air Liquide, Schneider). Ces titres grossissent avec leurs plus-values latentes — purgées par donation en 2040-2041.', color: 'blue' },
      { text: '40 000 € → Livrets (tu passes de 25k€ à 65k€ — matelas de sécurité + qualité de vie).', color: 'emerald' },
    ],
    details: [
      { icon: 'arrow', text: `Don Sarkozy en cours de solde : compléter progressivement les ~27k€ restants/enfant.` },
    ],
    kpis: [
      { label: 'Linxea après injection', value: '~100 000 €+', color: 'purple' },
      { label: 'CTO perso', value: '~60 000 €', color: 'blue' },
      { label: 'Livrets sécurité', value: '65 000 €', color: 'emerald' },
    ],
    tags: [
      { text: '60k€ → Linxea', color: 'purple' },
      { text: '50k€ → CTO', color: 'blue' },
      { text: '40k€ → Livrets', color: 'emerald' },
    ],
    color: 'pink',
  },
  {
    id: 'step-6',
    date: '2040–2041',
    badge: 'Abattement 100k€ rechargé (15 ans après 2026)',
    badgeColor: 'emerald',
    num: '⑥',
    title: 'Donation de titres CTO → CTO enfants · Purge des plus-values',
    body: `Tu transfères des titres en nature depuis ton CTO perso vers les CTO de Gaspard (~27 ans) et Agathe (~25 ans). Tu ne vends pas. Résultat : zéro flat tax (30%) pour toi. Tes enfants reçoivent les titres à leur valeur du jour — leur nouvelle base fiscale. L'abattement rechargé couvre la transmission.`,
    details: [
      { icon: 'arrow', text: `<strong>Exemple</strong> : 50 000 € de titres achetés en 2038 valant 70 000 € en 2041 → si tu vends : 6 000 € de flat tax. Si tu donnes : <strong class="text-emerald-400">0 € de taxe</strong>, base fiscale des enfants = 70 000 €.` },
      { icon: 'arrow', text: `Don Sarkozy soldé : compléter le solde restant en cash depuis les livrets.` },
      { icon: 'arrow', text: `Acte notarié recommandé pour la donation de titres.` },
    ],
    tags: [
      { text: 'Purge plus-values CTO', color: 'blue' },
      { text: 'Abattement 100k€ rechargé', color: 'emerald' },
      { text: 'Don Sarkozy soldé', color: 'cyan' },
    ],
    color: 'blue',
  },
  {
    id: 'step-7',
    date: '2042',
    badge: 'Retraite · 2 640 €/mois',
    badgeColor: 'orange',
    num: '⑦',
    title: 'Mode croisière · PEA ~236 000 €',
    body: `Ton train de vie est couvert. Tu ne touches à rien. PEA continue de tourner — plafond versements atteint en 2046. Linxea ne se clôture jamais.`,
    details: [
      { icon: 'arrow', text: `<strong>Linxea</strong> : rachats partiels uniquement si besoin (abattement annuel 4 600 € sur les gains après 8 ans). <strong class="text-red-400">Ne jamais clôturer</strong> — tu perdrais les 152 500 €/enfant définitivement.` },
      { icon: 'arrow', text: `<strong>PEE</strong> : se liquide à la retraite → capital (~65 000 €) versé en épargne liquide.` },
      { icon: 'arrow', text: `<strong>Bitcoin</strong> : si valeur > 30-40k€, arbitrer vers Linxea (avant 70 ans) ou CTO. Sécuriser les accès (seed phrase) pour tes héritiers.` },
    ],
    kpis: [
      { label: 'PEA estimé 2042', value: '~236 000 €', color: 'emerald' },
      { label: 'Linxea estimé 2042', value: '~140 000 €', color: 'purple' },
      { label: 'PEE liquidé → épargne', value: '~65 000 €', color: 'amber' },
    ],
    tags: [
      { text: 'Rachats partiels Linxea si besoin', color: 'purple' },
      { text: 'Ne jamais clôturer Linxea', color: 'red' },
    ],
    color: 'orange',
  },
  {
    id: 'step-8',
    date: '2046',
    badge: 'PEA plafonné à 150 000 € en versements · Valeur ~338 000 €',
    badgeColor: 'emerald',
    num: '⑧',
    title: 'Redirection du DCA PEA → Linxea priorité',
    body: `Le PEA atteint son plafond de versements. Les titres continuent de fructifier mais tu ne peux plus verser. Les 605 €/mois se redirigent. Tu as 63 ans — il te reste 7 ans avant 70 ans pour alimenter Linxea avec l'abattement plein.`,
    details: [
      { icon: 'arrow', text: `<strong>Priorité 1 — Linxea</strong> : 605 €/mois jusqu'à 70 ans. Chaque euro versé avant 70 ans = dans les 152 500 €/enfant.` },
      { icon: 'arrow', text: `<strong>Priorité 2 — CTO perso</strong> : si Linxea approche 305 000 €, le solde va sur le CTO.` },
    ],
    kpis: [
      { label: 'PEA valeur 2046', value: '~338 000 €', color: 'emerald' },
      { label: 'PV latentes PEA', value: '~188 000 €', color: 'amber' },
      { label: 'Fenêtre Linxea restante', value: '7 ans', color: 'purple' },
    ],
    tags: [
      { text: '605 €/mois → Linxea', color: 'purple' },
      { text: 'Puis CTO si Linxea plein', color: 'blue' },
    ],
    color: 'emerald',
  },
  {
    id: 'step-9',
    date: 'Continu',
    badge: 'Mécanique automatique',
    badgeColor: 'sky',
    num: '⑨',
    title: 'Air Liquide — actions gratuites + prime de fidélité tous les 2 ans',
    body: `Tes 20 actions Air Liquide en nominatif administré grossissent seules. Attribution gratuite ~tous les 2 ans (1 pour 10) + prime de fidélité (+10% sur les actions reçues). Les nouvelles actions héritent de l'ancienneté et de la prime.`,
    kpis: [
      { label: 'Aujourd\'hui', value: '20 actions', color: 'sky' },
      { label: '2036', value: '30 actions', color: 'emerald' },
      { label: '2046', value: '49 actions', color: 'amber' },
      { label: '2056', value: '~79 actions', color: 'purple' },
    ],
    tags: [
      { text: 'Croissance sans versement', color: 'sky' },
      { text: 'Vérifier nominatif TR', color: 'amber' },
      { text: 'Transmettre en titres en 2040-2041', color: 'blue' },
    ],
    color: 'sky',
  },
  {
    id: 'step-10',
    date: 'À ton décès',
    badge: 'Bilan final',
    badgeColor: 'gray',
    num: '⑩',
    title: 'Ce que reçoivent tes enfants',
    body: `Chaque enveloppe joue son rôle avec sa propre fiscalité avantageuse.`,
    details: [
      { icon: 'arrow', text: `<strong class="text-amber-300">Maison</strong> : pleine propriété automatique (~430 000 €). Zéro droit — l'usufruit s'éteint.` },
      { icon: 'arrow', text: `<strong class="text-purple-300">Linxea Spirit 2</strong> : hors succession · 152 500 €/enfant · zéro droit dans l'abattement.` },
      { icon: 'arrow', text: `<strong class="text-cyan-300">Don Sarkozy soldé</strong> : 31 865 €/enfant · zéro droit.` },
      { icon: 'arrow', text: `<strong class="text-blue-300">Donation titres CTO 2040-2041</strong> : ~25-40k€/enfant · zéro droit · plus-values purgées.` },
      { icon: 'arrow', text: `<strong class="text-emerald-300">PEA</strong> : clôture automatique · titres sur CTO de succession · abattements rechargés disponibles.` },
      { icon: 'arrow', text: `<strong class="text-orange-300">Bitcoin</strong> : succession classique si non arbitré avant. Sécuriser les accès.` },
    ],
    color: 'rose',
  },
];

const BILAN_ROWS = [
  { mechanism: 'Nue-propriété maison', detail: 'Abattement 100k€ consommé · gel de valeur à 330k€', perChild: '99 000 €', when: '2026', droits: 'Zéro', color: 'amber' },
  { mechanism: 'Extinction usufruit maison', detail: 'Pleine propriété auto · +130k€ de hausse incluse', perChild: '~215 000 €', when: 'Décès', droits: 'Zéro', color: 'amber' },
  { mechanism: 'Maison — total', detail: '', perChild: '~314 000 €', when: '—', droits: 'Zéro', color: 'amber', bold: true },
  { mechanism: 'Don Sarkozy (progressif)', detail: 'Cash uniquement · art. 790G CGI · 2030 → 2041', perChild: '31 865 €', when: '2030–2041', droits: 'Zéro', color: 'cyan' },
  { mechanism: 'Donation titres CTO', detail: 'Abattement 100k€ rechargé · transfert en nature · purge PV', perChild: '~25–40 000 €', when: '2040–2041', droits: 'Zéro', color: 'blue' },
  { mechanism: 'Assurance vie Linxea Spirit 2', detail: '200€/mois + 60k€ héritage · versements avant 70 ans · hors succession', perChild: '152 500 € max', when: 'Décès', droits: 'Zéro', color: 'purple' },
  { mechanism: 'PEA + reste succession', detail: '~338k€ en 2046 · abattements rechargés disponibles', perChild: 'Variable', when: 'Décès', droits: 'Partiel', color: 'emerald' },
  { mechanism: 'CTO Gaspard / Agathe (leur DCA)', detail: '50€/mois ETF depuis 2026 · leur capital propre', perChild: '~35–45 000 €', when: 'Continu', droits: 'Leur capital', color: 'sky' },
  { mechanism: 'Total transmis sans droits / enfant', detail: '', perChild: '~565 000 – 580 000 €', when: 'Sur 30 ans', droits: 'Quasi zéro droits', color: 'emerald', bold: true, highlight: true },
];

// ─── Horizontal Timeline Data ─────────────────────────────────────────────

const TIMELINE_EVENTS = [
  { year: 2026, label: 'Démembrement', icon: '🏠', color: 'amber', stepId: 'step-1' },
  { year: 2026, label: 'Crédit soldé', icon: '💰', color: 'sky', stepId: 'step-2', offset: true },
  { year: 2030, label: 'Don Sarkozy', icon: '🎁', color: 'cyan', stepId: 'step-4' },
  { year: 2037, label: 'Héritage', icon: '📨', color: 'pink', stepId: 'step-5' },
  { year: 2040, label: 'Donation CTO', icon: '📊', color: 'blue', stepId: 'step-6' },
  { year: 2042, label: 'Retraite', icon: '☀️', color: 'orange', stepId: 'step-7' },
  { year: 2046, label: 'PEA plafonné', icon: '📈', color: 'emerald', stepId: 'step-8' },
];

// ─── Render helpers ─────────────────────────────────────────────────────────

function colorClasses(color) {
  const map = {
    red:     { dot: 'bg-red-500',     bg: 'bg-red-500/5',     border: 'border-red-500/20',     text: 'text-red-400',     badge: 'bg-red-500/15 text-red-400 border-red-500/20' },
    amber:   { dot: 'bg-amber-500',   bg: 'bg-amber-500/5',   border: 'border-amber-500/20',   text: 'text-amber-400',   badge: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
    emerald: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-400', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
    green:   { dot: 'bg-emerald-500', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-400', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
    sky:     { dot: 'bg-sky-500',     bg: 'bg-sky-500/5',     border: 'border-sky-500/20',     text: 'text-sky-400',     badge: 'bg-sky-500/15 text-sky-400 border-sky-500/20' },
    blue:    { dot: 'bg-blue-500',    bg: 'bg-blue-500/5',    border: 'border-blue-500/20',    text: 'text-blue-400',    badge: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
    cyan:    { dot: 'bg-cyan-500',    bg: 'bg-cyan-500/5',    border: 'border-cyan-500/20',    text: 'text-cyan-400',    badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20' },
    purple:  { dot: 'bg-purple-500',  bg: 'bg-purple-500/5',  border: 'border-purple-500/20',  text: 'text-purple-400',  badge: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
    pink:    { dot: 'bg-pink-500',    bg: 'bg-pink-500/5',    border: 'border-pink-500/20',    text: 'text-pink-400',    badge: 'bg-pink-500/15 text-pink-400 border-pink-500/20' },
    orange:  { dot: 'bg-orange-500',  bg: 'bg-orange-500/5',  border: 'border-orange-500/20',  text: 'text-orange-400',  badge: 'bg-orange-500/15 text-orange-400 border-orange-500/20' },
    indigo:  { dot: 'bg-indigo-500',  bg: 'bg-indigo-500/5',  border: 'border-indigo-500/20',  text: 'text-indigo-400',  badge: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20' },
    rose:    { dot: 'bg-rose-500',    bg: 'bg-rose-500/5',    border: 'border-rose-500/20',    text: 'text-rose-400',    badge: 'bg-rose-500/15 text-rose-400 border-rose-500/20' },
    teal:    { dot: 'bg-teal-500',    bg: 'bg-teal-500/5',    border: 'border-teal-500/20',    text: 'text-teal-400',    badge: 'bg-teal-500/15 text-teal-400 border-teal-500/20' },
    gray:    { dot: 'bg-gray-500',    bg: 'bg-gray-800/30',   border: 'border-gray-700/30',    text: 'text-gray-400',    badge: 'bg-gray-700/40 text-gray-400 border-gray-600/30' },
  };
  return map[color] || map.gray;
}

function renderTag(tag) {
  const c = colorClasses(tag.color);
  return `<span class="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium border ${c.badge}">${tag.text}</span>`;
}

function renderKpi(kpi) {
  const c = colorClasses(kpi.color);
  return `<div class="rounded-xl p-3 ${c.bg} border ${c.border} text-center min-w-[120px]">
    <p class="text-[10px] text-gray-500 uppercase tracking-wider">${kpi.label}</p>
    <p class="text-base font-bold ${c.text} mt-0.5">${kpi.value}</p>
  </div>`;
}

function renderDetail(d) {
  return `<div class="flex items-start gap-2.5 mt-2">
    <svg class="w-3.5 h-3.5 text-gray-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
    <p class="text-xs text-gray-400 leading-relaxed">${d.text}</p>
  </div>`;
}

function renderBullet(b) {
  const c = colorClasses(b.color);
  return `<div class="flex items-start gap-2.5 mt-1.5">
    <div class="w-2 h-2 rounded-full ${c.dot} mt-1 shrink-0"></div>
    <p class="text-xs text-gray-300 leading-relaxed">${b.text}</p>
  </div>`;
}

function renderStep(step, index, total) {
  const c = colorClasses(step.color);
  const isLast = index === total - 1;

  return `
    <div class="relative flex gap-4 strat-step" data-step="${step.id}">
      <!-- Timeline line -->
      <div class="flex flex-col items-center shrink-0">
        <div class="w-10 h-10 rounded-xl ${c.bg} border-2 ${c.border} flex items-center justify-center text-lg font-bold ${c.text} z-10 strat-step-dot">
          ${step.num}
        </div>
        ${!isLast ? `<div class="w-0.5 flex-1 bg-gradient-to-b from-gray-700 to-transparent mt-1"></div>` : ''}
      </div>

      <!-- Content -->
      <div class="flex-1 pb-8 ${isLast ? '' : ''}">
        <!-- Date + Badge row -->
        <div class="flex flex-wrap items-center gap-2 mb-2">
          <span class="text-sm font-bold ${c.text}">${step.date}</span>
          ${step.badge ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${colorClasses(step.badgeColor).badge}">${step.badge}</span>` : ''}
        </div>

        <!-- Card -->
        <div class="card-dark rounded-xl border ${c.border} overflow-hidden strat-card">
          <div class="p-5">
            <h3 class="text-base font-bold text-gray-100 mb-3">${step.title}</h3>
            <p class="text-sm text-gray-400 leading-relaxed">${step.body}</p>

            ${step.bullets ? `<div class="mt-3">${step.bullets.map(renderBullet).join('')}</div>` : ''}

            ${step.kpis ? `<div class="flex flex-wrap gap-2.5 mt-4">${step.kpis.map(renderKpi).join('')}</div>` : ''}

            ${step.details ? `
              <div class="mt-4 pt-3 border-t border-dark-400/20">
                ${step.details.map(renderDetail).join('')}
              </div>
            ` : ''}
          </div>

          ${step.tags ? `
            <div class="px-5 py-3 bg-dark-800/40 border-t border-dark-400/10 flex flex-wrap gap-2">
              ${step.tags.map(renderTag).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    </div>`;
}

function renderHorizontalTimeline() {
  const startYear = 2026;
  const endYear = 2050;
  const totalSpan = endYear - startYear;

  const events = TIMELINE_EVENTS.map(e => {
    const pct = ((e.year - startYear) / totalSpan) * 100;
    const c = colorClasses(e.color);
    return { ...e, pct, c };
  });

  // Year markers every 5 years
  const yearMarkers = [];
  for (let y = 2026; y <= 2050; y += 5) {
    yearMarkers.push({ year: y, pct: ((y - startYear) / totalSpan) * 100 });
  }

  return `
    <div class="card-dark rounded-xl border border-gray-700/30 overflow-hidden">
      <div class="px-5 py-3 border-b border-gray-700/20">
        <h3 class="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
          <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/></svg>
          Timeline — 30 ans de stratégie
        </h3>
      </div>
      <div class="px-5 pt-14 pb-6 overflow-x-auto">
        <div class="relative min-w-[600px]" style="height: 80px;">
          <!-- Base line -->
          <div class="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-700/50 -translate-y-1/2"></div>

          <!-- Year markers -->
          ${yearMarkers.map(m => `
            <div class="absolute -translate-x-1/2" style="left: ${m.pct}%; top: 50%; transform: translate(-50%, -50%);">
              <div class="w-1.5 h-1.5 rounded-full bg-gray-600"></div>
              <span class="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] text-gray-600 whitespace-nowrap">${m.year}</span>
            </div>
          `).join('')}

          <!-- Events -->
          ${events.map((e, i) => {
            const above = i % 2 === 0;
            return `
              <button class="strat-timeline-btn absolute -translate-x-1/2 group cursor-pointer" style="left: ${e.pct}%; top: 50%; transform: translate(-50%, -50%);" data-target="${e.stepId}">
                <!-- Dot -->
                <div class="w-4 h-4 rounded-full ${e.c.dot} border-2 border-gray-900 z-20 relative transition group-hover:scale-150 group-hover:ring-2 group-hover:ring-white/20"></div>
                <!-- Label -->
                <div class="absolute ${above ? 'bottom-6' : 'top-6'} left-1/2 -translate-x-1/2 flex flex-col items-center whitespace-nowrap">
                  <span class="text-sm mb-0.5">${e.icon}</span>
                  <span class="text-[10px] font-semibold ${e.c.text}">${e.year}</span>
                  <span class="text-[9px] text-gray-500">${e.label}</span>
                </div>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

// ─── Projection Widget ────────────────────────────────────────────────────

function renderProjectionWidget(store) {
  const snapshots = computeProjection(store);
  if (!snapshots || snapshots.length === 0) return '';
  const params = store.get('parametres');
  const years = params.projectionYears || 30;
  const ageFinAnnee = params.ageFinAnnee || 43;
  const currentYear = new Date().getFullYear();
  const nbEnfants = 2;
  const abattementParEnfant = 100000;

  // Separate AV from other placements
  const getAV = (snap) => {
    if (!snap.placementDetail) return 0;
    return snap.placementDetail['Assurance Vie'] || 0;
  };
  const getPlacementsHorsAV = (snap) => {
    if (!snap.placementDetail) return 0;
    let total = 0;
    for (const [k, v] of Object.entries(snap.placementDetail)) {
      if (k !== 'Assurance Vie') total += v;
    }
    return total;
  };

  // Pre-compute snapshots data as JSON for JS access
  const snapshotsData = snapshots.map((snap, i) => ({
    year: snap.calendarYear,
    age: snap.age,
    offset: i,
    immobilier: snap.immobilier,
    placementsHorsAV: getPlacementsHorsAV(snap),
    assuranceVie: getAV(snap),
    epargne: snap.epargne,
    patrimoineNet: snap.patrimoineNet
  }));

  const first = snapshotsData[0];

  return `
    <div class="card-dark rounded-xl border border-sky-500/15 overflow-hidden" id="strat-projection-widget">
      <div class="px-5 py-4 flex items-center justify-between">
        <h3 class="text-base font-bold text-gray-200 flex items-center gap-2">
          <svg class="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
          Projection dans le temps
        </h3>
        <div class="text-right">
          <span class="text-sky-400 font-bold text-sm" id="strat-proj-year-label">Fin ${first.year} (+0 an)</span>
          <span class="text-gray-500 text-xs ml-1.5" id="strat-proj-age-label">${first.age} ans</span>
        </div>
      </div>

      <!-- Slider -->
      <div class="px-5 pb-2">
        <input type="range" id="strat-proj-slider" min="0" max="${snapshots.length - 1}" value="0" step="1"
          class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-sky-500"
          style="background: linear-gradient(to right, #0ea5e9 0%, #0ea5e9 0%, #374151 0%, #374151 100%);">
        <div class="flex justify-between text-[10px] text-gray-600 mt-1">
          <span>${currentYear}</span>
          <span>+10 ans</span>
          <span>+20 ans</span>
          <span>+${years} ans</span>
        </div>
      </div>

      <!-- Value cards -->
      <div class="px-5 pb-4 grid grid-cols-2 sm:grid-cols-5 gap-2" id="strat-proj-cards">
        <div class="card-dark rounded-lg border border-amber-500/15 p-3 text-center">
          <p class="text-[10px] text-gray-500 uppercase tracking-wider">Immobilier</p>
          <p class="text-lg font-bold text-amber-400 mt-1" id="strat-proj-immo">${formatCurrency(first.immobilier)}</p>
          <p class="text-[10px] text-emerald-400 mt-0.5" id="strat-proj-immo-delta">—</p>
        </div>
        <div class="card-dark rounded-lg border border-blue-500/15 p-3 text-center">
          <p class="text-[10px] text-gray-500 uppercase tracking-wider">Placements (hors AV)</p>
          <p class="text-lg font-bold text-blue-400 mt-1" id="strat-proj-plac">${formatCurrency(first.placementsHorsAV)}</p>
          <p class="text-[10px] text-emerald-400 mt-0.5" id="strat-proj-plac-delta">—</p>
        </div>
        <div class="card-dark rounded-lg border border-purple-500/15 p-3 text-center">
          <p class="text-[10px] text-gray-500 uppercase tracking-wider">Assurance Vie</p>
          <p class="text-lg font-bold text-purple-400 mt-1" id="strat-proj-av">${formatCurrency(first.assuranceVie)}</p>
          <p class="text-[10px] text-emerald-400 mt-0.5" id="strat-proj-av-delta">—</p>
        </div>
        <div class="card-dark rounded-lg border border-emerald-500/15 p-3 text-center">
          <p class="text-[10px] text-gray-500 uppercase tracking-wider">Épargne</p>
          <p class="text-lg font-bold text-emerald-400 mt-1" id="strat-proj-epar">${formatCurrency(first.epargne)}</p>
          <p class="text-[10px] text-emerald-400 mt-0.5" id="strat-proj-epar-delta">—</p>
        </div>
        <div class="card-dark rounded-lg border border-gray-500/15 p-3 text-center col-span-2 sm:col-span-1">
          <p class="text-[10px] text-gray-500 uppercase tracking-wider">Patrimoine net</p>
          <p class="text-lg font-bold text-gray-100 mt-1" id="strat-proj-net">${formatCurrency(first.patrimoineNet)}</p>
          <p class="text-[10px] text-emerald-400 mt-0.5" id="strat-proj-net-delta">—</p>
        </div>
      </div>

      <!-- Succession comparison -->
      <div class="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-3" id="strat-proj-succession">
        <div class="card-dark rounded-xl border border-red-500/15 p-4">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg class="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </div>
            <div>
              <p class="text-sm font-bold text-gray-200">Sans optimisation</p>
              <p class="text-[10px] text-gray-500">Droits de succession bruts</p>
            </div>
          </div>
          <p class="text-2xl font-bold text-red-400" id="strat-proj-droits-bruts">0 €</p>
          <p class="text-[10px] text-gray-500 mt-1" id="strat-proj-droits-detail">${nbEnfants} enfants — abattement ${formatCurrency(abattementParEnfant)} chacun</p>
        </div>
        <div class="card-dark rounded-xl border border-emerald-500/15 p-4">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            </div>
            <div>
              <p class="text-sm font-bold text-gray-200">Avec votre stratégie</p>
              <p class="text-[10px] text-gray-500">Droits après donations planifiées</p>
            </div>
          </div>
          <p class="text-2xl font-bold text-emerald-400" id="strat-proj-droits-opti">0 €</p>
          <p class="text-[10px] text-gray-500 mt-1">Ajoute des donations pour réduire les droits</p>
        </div>
      </div>
    </div>
    <script type="module">
      window.__stratProjData = ${JSON.stringify(snapshotsData)};
    </script>
  `;
}

// ============================================================================
// RENDER
// ============================================================================

export function render(store) {
  return `
    <div class="max-w-4xl mx-auto space-y-8">

      <!-- ═══ HEADER ═══ -->
      <div>
        <div class="flex items-center gap-3 mb-2">
          <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-pink-500/20 flex items-center justify-center">
            <svg class="w-5.5 h-5.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
          </div>
          <div>
            <h2 class="text-2xl font-bold text-gray-100">Stratégie</h2>
            <p class="text-gray-500 text-sm">Sylvain · 43 ans · Plan patrimonial complet — 2026</p>
          </div>
        </div>
      </div>

      <!-- ═══ HORIZONTAL TIMELINE ═══ -->
      ${renderHorizontalTimeline()}

      <!-- ═══ PROJECTION WIDGET ═══ -->
      ${store ? renderProjectionWidget(store) : ''}

      <!-- ═══ PRINCIPE DIRECTEUR ═══ -->
      <div class="card-dark rounded-xl p-5 border border-amber-500/15 bg-gradient-to-r from-amber-500/5 to-transparent">
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
            <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div>
            <h3 class="text-sm font-bold text-amber-300 uppercase tracking-wider mb-1">Principe directeur</h3>
            <p class="text-sm text-gray-300 leading-relaxed">Tu ne liquides rien, tu ne forces rien. Chaque enveloppe a son rôle : le <strong class="text-emerald-400">PEA</strong> grossit pour ta retraite, <strong class="text-purple-400">Linxea</strong> transmet hors succession, le <strong class="text-blue-400">CTO</strong> purge les plus-values par donation, la <strong class="text-amber-400">maison</strong> est le levier principal. Les dons se font quand tu as le cash — pas avant.</p>
          </div>
        </div>
      </div>

      <!-- ═══ NAVIGATION RAPIDE ═══ -->
      <div class="flex flex-wrap gap-2" id="strat-nav">
        ${STEPS.map(s => {
          const c = colorClasses(s.color);
          return `<button class="strat-nav-btn px-3 py-1.5 rounded-lg text-xs font-medium border transition hover:scale-105 ${c.badge}" data-target="${s.id}">
            <span class="mr-1">${s.num}</span>${s.date}
          </button>`;
        }).join('')}
      </div>

      <!-- ═══ TIMELINE ═══ -->
      <div class="relative">
        ${STEPS.map((s, i) => renderStep(s, i, STEPS.length)).join('')}
      </div>

      <!-- ═══ BILAN TRANSMISSION ═══ -->
      <div class="card-dark rounded-xl overflow-hidden border border-emerald-500/15">
        <div class="p-5 bg-gradient-to-r from-emerald-500/5 to-transparent">
          <h3 class="text-lg font-bold text-gray-100 flex items-center gap-2">
            <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Bilan de transmission — par enfant
          </h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-dark-400/30 text-gray-500 text-[10px] uppercase tracking-wider">
                <th class="text-left py-3 px-4 font-medium">Mécanisme</th>
                <th class="text-right py-3 px-4 font-medium">Par enfant</th>
                <th class="text-center py-3 px-4 font-medium">Quand</th>
                <th class="text-center py-3 px-4 font-medium">Droits</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dark-400/10">
              ${BILAN_ROWS.map(row => {
                const c = colorClasses(row.color);
                const isBold = row.bold;
                const isHighlight = row.highlight;
                return `<tr class="${isHighlight ? 'bg-gradient-to-r from-emerald-500/10 to-transparent' : 'hover:bg-dark-600/20'} transition">
                  <td class="py-3 px-4">
                    <div class="flex items-center gap-2">
                      <div class="w-2 h-2 rounded-full ${c.dot} shrink-0"></div>
                      <div>
                        <p class="${isBold ? 'font-bold text-gray-100' : 'text-gray-300'} text-sm">${row.mechanism}</p>
                        ${row.detail ? `<p class="text-[10px] text-gray-600 mt-0.5">${row.detail}</p>` : ''}
                      </div>
                    </div>
                  </td>
                  <td class="py-3 px-4 text-right ${isBold ? 'font-bold ' + c.text : 'text-gray-200'} text-sm whitespace-nowrap">${row.perChild}</td>
                  <td class="py-3 px-4 text-center text-gray-500 text-xs">${row.when}</td>
                  <td class="py-3 px-4 text-center">
                    <span class="px-2 py-0.5 rounded text-[10px] font-medium ${
                      row.droits === 'Zéro' ? 'bg-emerald-500/10 text-emerald-400' :
                      row.droits === 'Partiel' ? 'bg-amber-500/10 text-amber-400' :
                      row.droits === 'Leur capital' ? 'bg-sky-500/10 text-sky-400' :
                      row.droits.includes('zéro') ? 'bg-emerald-500/15 text-emerald-300 font-bold' :
                      'bg-gray-700/40 text-gray-400'
                    }">${row.droits}</span>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- ═══ BITCOIN NOTE ═══ -->
      <div class="card-dark rounded-xl p-4 border border-orange-500/10 flex items-start gap-3">
        <div class="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
          <svg class="w-3.5 h-3.5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <p class="text-xs text-gray-400 leading-relaxed"><strong class="text-orange-400">Bitcoin</strong> — ~1 000 €/an · spéculatif · hors stratégie. Si valeur > 30-40k€ : arbitrer vers Linxea (avant 70 ans) ou CTO. <strong class="text-orange-300">Sécuriser absolument les accès (seed phrase)</strong> dans un endroit connu de tes enfants.</p>
      </div>

      <!-- ═══ REGLE D'OR ═══ -->
      <div class="card-dark rounded-xl p-4 border border-red-500/15 bg-gradient-to-r from-red-500/5 to-transparent flex items-start gap-3">
        <div class="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
          <svg class="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
        </div>
        <p class="text-xs text-gray-300 leading-relaxed"><strong class="text-red-400">Règle d'or</strong> — Ne jamais clôturer Linxea Spirit 2. Rachats partiels uniquement. La clôture fait disparaître <strong class="text-red-300">305 000 € d'abattements successoraux</strong> définitivement.</p>
      </div>

      <!-- ═══ DISCLAIMER ═══ -->
      <div class="p-3 rounded-xl bg-dark-800/30 border border-dark-400/20">
        <p class="text-[11px] text-gray-600">Document de planification patrimoniale — 2026. Ne constitue pas un conseil juridique ou fiscal. Consulte un notaire et/ou un CGP pour valider chaque action.</p>
      </div>
    </div>
  `;
}

// ============================================================================
// MOUNT
// ============================================================================

export function mount(store) {
  // ─── Projection slider ───
  const slider = document.getElementById('strat-proj-slider');
  const data = window.__stratProjData;
  if (slider && data && data.length > 0) {
    const currentYear = new Date().getFullYear();
    const nbEnfants = 2;
    const abattementParEnfant = 100000;
    // AV abattement per child for succession (hors succession up to 152500/child)
    const avAbattementParEnfant = 152500;
    const first = data[0];

    // French succession tax brackets (per child share after abattement)
    function computeDroitsSuccession(baseImposableParEnfant) {
      if (baseImposableParEnfant <= 0) return 0;
      const tranches = [
        { max: 8072, taux: 0.05 },
        { max: 12109, taux: 0.10 },
        { max: 15932, taux: 0.15 },
        { max: 552324, taux: 0.20 },
        { max: 902838, taux: 0.30 },
        { max: 1805677, taux: 0.40 },
        { max: Infinity, taux: 0.45 }
      ];
      let droits = 0;
      let prev = 0;
      for (const t of tranches) {
        if (baseImposableParEnfant <= prev) break;
        const taxable = Math.min(baseImposableParEnfant, t.max) - prev;
        if (taxable > 0) droits += taxable * t.taux;
        prev = t.max;
      }
      return droits;
    }

    function fmtCur(v) {
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
    }

    function fmtDelta(v) {
      return (v >= 0 ? '+' : '') + fmtCur(v);
    }

    function updateProjection(index) {
      const snap = data[index];
      const offset = index;
      const yearLabel = document.getElementById('strat-proj-year-label');
      const ageLabel = document.getElementById('strat-proj-age-label');
      yearLabel.textContent = `Fin ${snap.year} (+${offset} an${offset > 1 ? 's' : ''})`;
      ageLabel.textContent = `${snap.age} ans`;

      // Update slider track gradient
      const pct = (index / (data.length - 1)) * 100;
      slider.style.background = `linear-gradient(to right, #0ea5e9 0%, #0ea5e9 ${pct}%, #374151 ${pct}%, #374151 100%)`;

      // Values
      document.getElementById('strat-proj-immo').textContent = fmtCur(snap.immobilier);
      document.getElementById('strat-proj-plac').textContent = fmtCur(snap.placementsHorsAV);
      document.getElementById('strat-proj-av').textContent = fmtCur(snap.assuranceVie);
      document.getElementById('strat-proj-epar').textContent = fmtCur(snap.epargne);
      document.getElementById('strat-proj-net').textContent = fmtCur(snap.patrimoineNet);

      // Deltas
      const setDelta = (id, val) => {
        const el = document.getElementById(id);
        if (val === 0) { el.textContent = '—'; el.className = 'text-[10px] text-gray-600 mt-0.5'; }
        else {
          el.textContent = fmtDelta(val);
          el.className = `text-[10px] ${val >= 0 ? 'text-emerald-400' : 'text-red-400'} mt-0.5`;
        }
      };
      setDelta('strat-proj-immo-delta', snap.immobilier - first.immobilier);
      setDelta('strat-proj-plac-delta', snap.placementsHorsAV - first.placementsHorsAV);
      setDelta('strat-proj-av-delta', snap.assuranceVie - first.assuranceVie);
      setDelta('strat-proj-epar-delta', snap.epargne - first.epargne);
      setDelta('strat-proj-net-delta', snap.patrimoineNet - first.patrimoineNet);

      // Succession — Sans optimisation
      // Full patrimoine net enters succession, minus AV (hors succession up to abattement)
      const patrimoineSuccession = snap.patrimoineNet;
      const partParEnfant = patrimoineSuccession / nbEnfants;
      const baseImposableParEnfant = Math.max(0, partParEnfant - abattementParEnfant);
      const droitsBruts = Math.round(computeDroitsSuccession(baseImposableParEnfant) * nbEnfants);
      document.getElementById('strat-proj-droits-bruts').textContent = fmtCur(droitsBruts);

      // Succession — Avec stratégie
      // AV is hors succession (152500/enfant), maison démembrée (NP transmise = exclue),
      // Donations consommées (don Sarkozy 31865/enfant + abattement 100k rechargé)
      const avHorsSuccession = Math.min(snap.assuranceVie, avAbattementParEnfant * nbEnfants);
      // Nue-propriété maison transmise en 2026 (~198k exclue de la succession)
      const npTransmise = 198000;
      // Don Sarkozy cumulé (progressif, jusqu'à 31865/enfant)
      const yearsElapsed = snap.year - currentYear;
      const donSarkozyParEnfant = yearsElapsed >= 4 ? Math.min(31865, 5000 + Math.min(26865, (yearsElapsed - 4) * 2500)) : 0;
      const donSarkozyTotal = donSarkozyParEnfant * nbEnfants;
      // Abattement rechargé en 2040 (15 ans après 2026) — donation titres CTO ~35k/enfant
      const donTitresCTO = (yearsElapsed >= 14) ? 35000 * nbEnfants : 0;

      const patrimoineOpti = Math.max(0, snap.patrimoineNet - avHorsSuccession - npTransmise - donSarkozyTotal - donTitresCTO);
      const partParEnfantOpti = patrimoineOpti / nbEnfants;
      // Abattement 100k rechargé if 15+ years since 2026
      const abattementDispo = (yearsElapsed >= 14) ? abattementParEnfant : 0;
      const baseImposableOpti = Math.max(0, partParEnfantOpti - abattementDispo);
      const droitsOpti = Math.round(computeDroitsSuccession(baseImposableOpti) * nbEnfants);
      document.getElementById('strat-proj-droits-opti').textContent = fmtCur(droitsOpti);
    }

    slider.addEventListener('input', () => updateProjection(parseInt(slider.value)));
    updateProjection(0);
  }

  // ─── Navigation rapide: scroll to step on click ───
  document.querySelectorAll('.strat-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.querySelector(`[data-step="${btn.dataset.target}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Flash effect
        const card = target.querySelector('.strat-card');
        if (card) {
          card.classList.add('ring-2', 'ring-amber-500/40');
          setTimeout(() => card.classList.remove('ring-2', 'ring-amber-500/40'), 1500);
        }
      }
    });
  });

  // ─── Horizontal timeline: click event to scroll to step ───
  document.querySelectorAll('.strat-timeline-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.querySelector(`[data-step="${btn.dataset.target}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const card = target.querySelector('.strat-card');
        if (card) {
          card.classList.add('ring-2', 'ring-amber-500/40');
          setTimeout(() => card.classList.remove('ring-2', 'ring-amber-500/40'), 1500);
        }
      }
    });
  });

  // ─── Intersection observer: highlight active nav ───
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const stepId = entry.target.dataset.step;
        document.querySelectorAll('.strat-nav-btn').forEach(btn => {
          btn.classList.toggle('ring-2', btn.dataset.target === stepId);
          btn.classList.toggle('ring-white/20', btn.dataset.target === stepId);
          btn.classList.toggle('scale-105', btn.dataset.target === stepId);
        });
      }
    });
  }, { threshold: 0.3, rootMargin: '-80px 0px -40% 0px' });

  document.querySelectorAll('.strat-step').forEach(el => observer.observe(el));
}
