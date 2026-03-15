import { formatCurrency } from '../utils.js?v=5';

// ============================================================================
// STRATEGIE PATRIMONIALE — Plan complet Sylvain
// ============================================================================

// ─── Timeline Data ──────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 'step-1',
    date: 'Mars 2026',
    badge: 'Action urgente',
    badgeColor: 'red',
    num: '①',
    title: 'Démembrement de la maison chez le notaire',
    body: `Tu donnes la nue-propriété à Gaspard et Agathe (50/50). Tu conserves l'usufruit à vie : tu continues d'habiter, louer, décider. À 42 ans, la nue-propriété vaut ~60 % de la valeur = <strong class="text-amber-300">198 000 €</strong> transmis (99 000 € par enfant), pile dans l'abattement de 100 000 € → <strong class="text-emerald-400">zéro droit de donation</strong>. Seuls les frais de notaire (~3-4 k€) sont à payer.`,
    details: [
      { icon: 'arrow', text: `<strong>Clause de report d'usufruit</strong> à demander au notaire : si tu vends la maison un jour, l'usufruit se reporte automatiquement sur le remploi (nouveau bien ou cash). Sans cette clause, la vente nécessite l'accord du juge des tutelles (enfants mineurs) et peut bloquer.` },
      { icon: 'arrow', text: `À ton décès : l'usufruit s'éteint automatiquement, tes enfants récupèrent la pleine propriété sans droits, sans formalité. La maison vaudra <strong class="text-amber-300">~515 000 €</strong> en 2055 à +1,5 %/an — toute la plus-value leur appartient déjà.` },
      { icon: 'arrow', text: `Mettre à jour la <strong>clause bénéficiaire Linxea</strong> en même temps chez le notaire.` },
    ],
    tags: [
      { text: '198k€ transmis · zéro droit', color: 'emerald' },
      { text: 'Frais notaire ~3-4k€ sur livrets', color: 'amber' },
      { text: 'Notaire obligatoire', color: 'pink' },
    ],
    color: 'amber',
  },
  {
    id: 'step-2',
    date: 'Mars 2026',
    badge: 'Déjà enclenché',
    badgeColor: 'emerald',
    num: '②',
    title: 'PEA — DCA 605 €/mois lancé',
    body: `ETF S&P 500 (450 €) + STOXX 600 (120 €) + Emerging (35 €) = 605 €/mois. Les actions existantes (~5 140 € versés) restent en place sans versements supplémentaires. Le plafond de 150 000 € en versements sera atteint en 2046 — tu as 20 ans devant toi.`,
    kpis: [
      { label: 'Versé aujourd\'hui', value: '~5 870 €', color: 'emerald' },
      { label: 'Valeur 2042 (retraite)', value: '~227 000 €', color: 'sky' },
      { label: 'Plafond versements atteint', value: '~2046', color: 'amber' },
    ],
    details: [
      { icon: 'arrow', text: `Le PEA est <strong class="text-red-400">intransmissible de ton vivant</strong>. À ton décès il se clôture, les titres passent sur un CTO de succession et intègrent la succession classique.` },
      { icon: 'arrow', text: `<strong>Ne pas toucher au PEA avant la retraite</strong> — les retraits avant 5 ans entraînent la clôture, après 5 ans ils sont possibles mais bloquent les nouveaux versements.` },
    ],
    tags: [
      { text: 'DCA automatique · rien à faire', color: 'emerald' },
    ],
    color: 'emerald',
  },
  {
    id: 'step-3',
    date: 'Novembre 2026',
    badge: 'Crédit soldé · +650 €/mois libérés',
    badgeColor: 'sky',
    num: '③',
    title: 'Réallocation du crédit libéré',
    body: `Le crédit s'arrête. 650 €/mois se libèrent. On réalloue immédiatement sans forcer de don (pas assez de cash disponible).`,
    bullets: [
      { text: '200 €/mois → Linxea Spirit 2 (démarre ici)', color: 'purple' },
      { text: '60 €/mois → Bitcoin (déjà en cours)', color: 'orange' },
      { text: '290 €/mois → Épargne liquide (objectif : constituer le don Sarkozy d\'ici 2030)', color: 'emerald' },
    ],
    details: [
      { icon: 'arrow', text: `Le don Sarkozy est reporté — pas assez de cash pour un montant significatif. La fenêtre de 15 ans court jusqu'en 2041 environ, il n'y a aucune urgence.` },
    ],
    tags: [
      { text: 'Linxea démarre', color: 'purple' },
      { text: 'Don Sarkozy reporté à 2030', color: 'amber' },
    ],
    color: 'sky',
  },
  {
    id: 'step-4',
    date: '2027–2029',
    badge: 'Phase d\'accumulation',
    badgeColor: 'gray',
    num: '④',
    title: 'Tous les DCA tournent · rien à forcer',
    body: `PEA (605 €/mois), Linxea (200 €/mois), Bitcoin (60 €/mois), CTO enfants (50 €/mois chacun). Tu accumules ~290 €/mois de cash libre → ~10 000 € en 3 ans pour amorcer le don Sarkozy.`,
    kpis: [
      { label: 'PEA fin 2029', value: '~50 000 €', color: 'emerald' },
      { label: 'Linxea fin 2029', value: '~8 000 €', color: 'purple' },
      { label: 'Cash libre accumulé', value: '~10 000 €', color: 'amber' },
    ],
    tags: [
      { text: 'Phase passive · laisser tourner', color: 'gray' },
    ],
    color: 'indigo',
  },
  {
    id: 'step-5',
    date: '2030',
    badge: '~10 000 € de cash libre',
    badgeColor: 'cyan',
    num: '⑤',
    title: 'Don Sarkozy — déclenchement du compteur',
    body: `Le don Sarkozy (art. 790 G CGI) = don de cash uniquement (pas de titres). Plafond : 31 865 € par enfant. Tu verses ~4 500–5 000 € par enfant — ce n'est pas le plafond max, mais ça <strong class="text-cyan-300">déclenche le compteur des 15 ans</strong>. Le solde (~27 000 € par enfant) reste utilisable jusqu'en 2045. Ce mécanisme est cumulable avec l'abattement classique de 100 000 € — ce sont deux enveloppes séparées.`,
    details: [
      { icon: 'arrow', text: `Formulaire <strong>2735</strong> en ligne sur impots.gouv.fr — à déclarer dans le mois suivant le virement.` },
      { icon: 'arrow', text: `<strong>Cash uniquement</strong> : virement bancaire, chèque — jamais de titres dans ce mécanisme.` },
      { icon: 'arrow', text: `Pourquoi ne pas attendre d'avoir tout le cash ? Déclencher tôt le compteur permet un renouvellement dès 2045, avant tes 62 ans. Si tu attends 2035, le renouvellement n'arrive qu'en 2050.` },
    ],
    tags: [
      { text: 'Compteur 15 ans déclenché', color: 'cyan' },
      { text: 'Formulaire 2735 en ligne', color: 'gray' },
    ],
    color: 'cyan',
  },
  {
    id: 'step-6',
    date: '2037–2040',
    badge: 'Héritage papa (~150 000 € cash)',
    badgeColor: 'pink',
    num: '⑥',
    title: 'Réinjection stratégique de l\'héritage',
    body: `C'est le <strong class="text-pink-300">tournant du plan</strong>. 150 000 € en cash. Répartition décidée :`,
    bullets: [
      { text: '60 000 € → Linxea Spirit 2 (versement exceptionnel). Versé avant tes 70 ans → pleinement dans l\'enveloppe des 152 500 €/enfant au décès. Vérifier que le total du contrat ne dépasse pas 305 000 € (2 × 152 500 €).', color: 'purple' },
      { text: '50 000 € → CTO perso (ETF World + renforcement Air Liquide, Schneider). Ces titres grossissent avec des plus-values latentes que tu purgeras par donation vers les CTO des enfants en 2040-2041.', color: 'blue' },
      { text: '40 000 € → livrets (tu passes de 25k€ à 65k€ — matelas de sécurité + qualité de vie).', color: 'emerald' },
    ],
    details: [
      { icon: 'arrow', text: `Don Sarkozy solde : compléter les ~27k€ restants par enfant avec le cash des livrets progressivement.` },
    ],
    kpis: [
      { label: 'Linxea après injection', value: '~100 000 €+', color: 'purple' },
      { label: 'CTO perso', value: '~50 000 €', color: 'blue' },
      { label: 'Livrets sécurité', value: '65 000 €', color: 'emerald' },
    ],
    tags: [
      { text: '60k€ Linxea', color: 'purple' },
      { text: '50k€ CTO perso', color: 'blue' },
      { text: '40k€ livrets', color: 'emerald' },
    ],
    color: 'pink',
  },
  {
    id: 'step-7',
    date: '2040–2041',
    badge: 'Abattement 100k€ rechargé (15 ans après 2025)',
    badgeColor: 'emerald',
    num: '⑦',
    title: 'Donation de titres CTO → CTO enfants · Purge des plus-values',
    body: `Tu transfères des titres depuis ton CTO perso vers les CTO de Gaspard (~27 ans) et Agathe (~25 ans). Tu ne vends pas — tu <strong class="text-blue-300">transfères en nature</strong>. Résultat : zéro flat tax (30 %) pour toi sur les plus-values accumulées. Tes enfants reçoivent les titres à leur valeur du jour, qui devient leur nouvelle base de calcul fiscale. L'abattement de 100 000 € rechargé couvre la transmission.`,
    details: [
      { icon: 'arrow', text: `<strong>Exemple concret</strong> : tu as acheté 50 000 € de titres en 2038, ils valent 70 000 € en 2041. Si tu vends : 20 000 € de plus-value taxés à 30 % = 6 000 € perdus. Si tu donnes les titres : <strong class="text-emerald-400">zéro taxe</strong>, tes enfants héritent de 70 000 € avec 70 000 € comme base.` },
      { icon: 'arrow', text: `Don Sarkozy soldé : compléter le solde restant (~27k€/enfant) en cash depuis les livrets.` },
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
    id: 'step-8',
    date: '2042',
    badge: 'Retraite à taux plein · 2 640 €/mois',
    badgeColor: 'orange',
    num: '⑧',
    title: 'Mode croisière · PEA à ~227 000 €',
    body: `Ton train de vie est couvert par la retraite. Tu ne touches à rien sauf si besoin ponctuel. Le PEA continue de tourner — le plafond de 150 000 € en versements n'est pas encore atteint (il le sera en 2046).`,
    details: [
      { icon: 'arrow', text: `<strong>Linxea</strong> : rachats partiels uniquement si besoin (abattement annuel 4 600 € sur les gains, après 8 ans de contrat). <strong class="text-red-400">Ne jamais clôturer</strong> — la clôture fait disparaître les 152 500 € d'abattement par enfant.` },
      { icon: 'arrow', text: `<strong>PEA</strong> : laisse tourner jusqu'en 2046, puis redirection des versements vers Linxea (priorité, tu as encore jusqu'à 70 ans) puis CTO.` },
      { icon: 'arrow', text: `<strong>Bitcoin</strong> : si valeur > 30-40k€, arbitrer vers Linxea ou CTO avant tes 70 ans pour l'intégrer dans les enveloppes fiscalisées. Sécuriser les accès (seed phrase) pour tes héritiers.` },
    ],
    tags: [
      { text: 'Rachats partiels Linxea si besoin', color: 'purple' },
      { text: 'Ne jamais clôturer Linxea', color: 'red' },
    ],
    color: 'orange',
  },
  {
    id: 'step-9',
    date: '2046',
    badge: 'PEA plafonné à 150 000 € en versements',
    badgeColor: 'emerald',
    num: '⑨',
    title: 'Redirection du DCA PEA → Linxea puis CTO',
    body: `Le PEA atteint son plafond de versements (~327 000 € de valeur à ce moment). Tu ne peux plus verser mais les titres continuent de fructifier. Les 605 €/mois se redirigent.`,
    details: [
      { icon: 'arrow', text: `<strong>Priorité 1 — Linxea</strong> : tu as 63 ans en 2046, il te reste 7 ans avant 70 ans. Chaque euro versé avant 70 ans reste dans l'enveloppe des 152 500 €/enfant au décès. <strong class="text-purple-300">C'est la fenêtre fiscale la plus précieuse.</strong>` },
      { icon: 'arrow', text: `<strong>Priorité 2 — CTO perso</strong> : une fois Linxea bien garni (ou si tu approches 305 000 € de capital), le solde va sur le CTO pour alimenter le réservoir de donations de titres futures.` },
    ],
    kpis: [
      { label: 'PEA valeur 2046', value: '~327 000 €', color: 'emerald' },
      { label: 'Plus-values latentes PEA', value: '~177 000 €', color: 'amber' },
      { label: 'Fenêtre Linxea restante', value: '7 ans (avant 70 ans)', color: 'purple' },
    ],
    tags: [
      { text: '605€/mois → Linxea priorité', color: 'purple' },
      { text: 'Puis CTO si Linxea plein', color: 'blue' },
    ],
    color: 'emerald',
  },
  {
    id: 'step-10',
    date: 'À ton décès',
    badge: '',
    badgeColor: 'gray',
    num: '⑩',
    title: 'Ce que reçoivent tes enfants — bilan final',
    body: `Tout converge ici. Chaque enveloppe joue son rôle, chacune avec sa propre fiscalité avantageuse.`,
    details: [
      { icon: 'arrow', text: `<strong class="text-amber-300">Maison</strong> : pleine propriété restituée automatiquement (~515 000 € en 2055). Zéro droit — l'usufruit s'éteint, il ne se transmet pas.` },
      { icon: 'arrow', text: `<strong class="text-purple-300">Linxea Spirit 2</strong> : capital versé au bénéficiaire hors succession, abattement 152 500 €/enfant. Zéro droit dans cet abattement.` },
      { icon: 'arrow', text: `<strong class="text-emerald-300">PEA</strong> : clôture automatique, titres transférés sur CTO de succession → intègre l'actif successoral. Les abattements rechargés (100k€/enfant) couvrent une partie.` },
      { icon: 'arrow', text: `<strong class="text-blue-300">CTO perso résiduel</strong> : intègre la succession, couvert par les abattements disponibles.` },
      { icon: 'arrow', text: `<strong class="text-teal-300">Livrets</strong> : intègrent la succession.` },
    ],
    color: 'rose',
  },
];

const BILAN_ROWS = [
  { mechanism: 'Nue-propriété maison (2026)', detail: 'Abattement 100k€ consommé · gel de la valeur à 330k€', perChild: '99 000 €', when: '2026', droits: 'Zéro', color: 'amber' },
  { mechanism: 'Extinction usufruit maison (décès)', detail: 'Pleine propriété automatique · +185k€ de hausse incluse', perChild: '~257 000 €', when: 'Décès', droits: 'Zéro', color: 'amber' },
  { mechanism: 'Maison — total', detail: '', perChild: '~356 000 €', when: '—', droits: 'Zéro', color: 'amber', bold: true },
  { mechanism: 'Don Sarkozy (progressif)', detail: 'Cash uniquement · art. 790G CGI · 2030 → 2041', perChild: '31 865 €', when: '2030–2041', droits: 'Zéro', color: 'cyan' },
  { mechanism: 'Donation titres CTO (purge PV)', detail: 'Abattement 100k€ rechargé · transfert en nature', perChild: '~25–40 000 €', when: '2040–2041', droits: 'Zéro', color: 'blue' },
  { mechanism: 'Assurance vie Linxea Spirit 2', detail: '200€/mois + 60k€ héritage · versements avant 70 ans', perChild: '152 500 € max', when: 'Décès', droits: 'Zéro', color: 'purple' },
  { mechanism: 'PEA + reste succession', detail: '~327k€ en 2046 · abattements rechargés partiellement', perChild: 'Variable', when: 'Décès', droits: 'Partiel', color: 'emerald' },
  { mechanism: 'CTO enfants (leur DCA propre)', detail: '50€/mois ETF depuis 2026 · leur capital personnel', perChild: '~35–45 000 €', when: 'Continu', droits: 'Leur capital', color: 'sky' },
  { mechanism: 'Total transmis sans droits / enfant', detail: '', perChild: '~565 000 – 580 000 €', when: 'Sur 30 ans', droits: 'Quasi zéro droits', color: 'emerald', bold: true, highlight: true },
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

// ============================================================================
// RENDER
// ============================================================================

export function render() {
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
            <p class="text-gray-500 text-sm">Sylvain · 42 ans · Plan patrimonial complet — Mars 2026</p>
          </div>
        </div>
      </div>

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
        <p class="text-xs text-gray-400 leading-relaxed"><strong class="text-orange-400">Bitcoin</strong> — DCA 60 €/mois · hors stratégie · imprévisible. Si valeur > 30-40k€ : arbitrer vers Linxea (avant 70 ans) ou CTO. <strong class="text-orange-300">Sécuriser absolument les accès (seed phrase)</strong> dans un endroit connu de tes enfants.</p>
      </div>

      <!-- ═══ DISCLAIMER ═══ -->
      <div class="p-3 rounded-xl bg-dark-800/30 border border-dark-400/20">
        <p class="text-[11px] text-gray-600">Document de planification patrimoniale — Mars 2026. Ne constitue pas un conseil juridique ou fiscal. Consulte un notaire et/ou un CGP pour valider chaque action.</p>
      </div>
    </div>
  `;
}

// ============================================================================
// MOUNT
// ============================================================================

export function mount() {
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
