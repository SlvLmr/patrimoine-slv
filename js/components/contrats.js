import { formatCurrencyCents, openModal, inputField, selectField, getFormData, confirmModal, showToast, showModalError, conseilCardHtml } from '../utils.js?v=20260809m';
import { createChart } from '../charts/chart-config.js';

// ============================================================
// CATALOGUE DES DOMAINES DE PROTECTION (radar + pédagogie)
// ============================================================
const DOMAINES = [
  {
    id: 'sante', label: 'Santé', emoji: '🩺', defaultOn: true,
    quoi: "Le remboursement de tes frais de soins : ce que la Sécu et ta mutuelle paient quand tu te soignes (consultations, lunettes, dents, hôpital).",
    frontiere: "La Santé rembourse des factures de soins. Quand un problème de santé t'empêche de travailler, c'est la Prévoyance qui prend le relais pour remplacer ton revenu.",
    postes: [
      { id: 'mutuelle', label: 'Mutuelle / complémentaire santé',
        cQuoi: "Elle rembourse ce que la Sécurité sociale ne prend pas en charge : consultations, pharmacie, lunettes, dents, hôpital.",
        pourquoi: "Sans mutuelle, une hospitalisation ou des soins dentaires lourds peuvent coûter plusieurs milliers d'euros de ta poche.",
        criteres: ["Hospitalisation remboursée à 200 % de la base Sécu ou plus", "Forfaits optique / dentaire / audio en euros réels (pas en %)", "Prise en charge des dépassements d'honoraires"] },
      { id: 'surcomplementaire', label: 'Surcomplémentaire',
        cQuoi: "Une deuxième couche de remboursement qui vient renforcer la mutuelle sur les postes où elle est faible.",
        pourquoi: "Utile si tu as de gros besoins récurrents (orthodontie des enfants, lunettes fortes corrections, spécialistes en secteur 2).",
        criteres: ["Ne payer que si un poste précis est réellement insuffisant", "Vérifier qu'elle ne fait pas doublon avec la mutuelle"] },
      { id: 'hospitalisation', label: 'Hospitalisation',
        cQuoi: "La partie de la couverture santé dédiée aux séjours à l'hôpital : frais de séjour, chirurgien, anesthésiste, chambre particulière.",
        pourquoi: "C'est le poste où les restes à charge peuvent être les plus violents : un dépassement d'honoraires de chirurgien se compte en centaines d'euros.",
        criteres: ["Chambre particulière incluse (≥ 60 €/nuit)", "Dépassements d'honoraires couverts (OPTAM et hors OPTAM)", "Pas de limite de durée"] },
    ]
  },
  {
    id: 'prevoyance', label: 'Prévoyance', emoji: '🛡️', defaultOn: true,
    quoi: "Le maintien des revenus du foyer si la vie bascule : arrêt de travail long, invalidité, décès d'un parent.",
    frontiere: "Différente de la Santé (qui rembourse des soins) et de l'Emprunteur (qui ne protège que le crédit immobilier) : ici on protège le train de vie de la famille.",
    postes: [
      { id: 'itt', label: 'Arrêt de travail (ITT)',
        cQuoi: "Un revenu de remplacement si tu ne peux plus travailler temporairement (maladie, accident). ITT = incapacité temporaire totale.",
        pourquoi: "La Sécu ne verse qu'environ 50 % du salaire plafonné. Un arrêt de 6 mois sans prévoyance, c'est un budget familial qui s'effondre.",
        criteres: ["Maintien d'au moins 80 % du revenu net", "Franchise courte (15-30 jours)", "Durée d'indemnisation jusqu'à 3 ans (relais invalidité)"] },
      { id: 'invalidite', label: 'Invalidité (IPT / IPP)',
        cQuoi: "Une rente si tu gardes des séquelles durables qui réduisent ou empêchent ton travail. IPT = totale, IPP = partielle.",
        pourquoi: "C'est le risque financier le plus lourd d'une vie active : des dizaines d'années de revenus perdus si rien n'est prévu.",
        criteres: ["Rente jusqu'à la retraite (pas un capital unique trop faible)", "Couverture dès 33 % d'invalidité", "Barème professionnel plutôt que fonctionnel"] },
      { id: 'deces', label: 'Décès (capital / rente conjoint)',
        cQuoi: "Un capital ou une rente versés à tes proches si tu décèdes, pour maintenir leur niveau de vie.",
        pourquoi: "Le foyer perd un revenu entier du jour au lendemain, alors que le crédit et les charges continuent.",
        criteres: ["Capital ≥ 2 à 3 ans de revenus", "Contrat employeur pris en compte dans le calcul", "Bénéficiaires à jour (clause bénéficiaire)"] },
      { id: 'rente-education', label: 'Rente éducation',
        cQuoi: "Une rente versée à chaque enfant jusqu'à la fin de ses études si un parent décède.",
        pourquoi: "Elle sécurise les études des enfants quoi qu'il arrive, sans dépendre de la gestion d'un capital.",
        criteres: ["Rente par enfant jusqu'à 25 ans si études", "Montant qui couvre au moins les frais de scolarité et de vie étudiante"] },
    ]
  },
  {
    id: 'emprunteur', label: 'Emprunteur', emoji: '🏦', defaultOn: true,
    quoi: "L'assurance de ton crédit immobilier : elle solde ou paie les mensualités si l'assuré décède ou ne peut plus travailler.",
    frontiere: "Elle protège le crédit, pas le quotidien : les courses, l'école et les factures restent à charge du foyer — c'est le rôle de la Prévoyance.",
    postes: [
      { id: 'deces-ptia', label: 'Décès / PTIA',
        cQuoi: "L'assurance du crédit immobilier : elle rembourse le capital restant dû si l'assuré décède ou perd totalement son autonomie (PTIA).",
        pourquoi: "Sans elle, le conjoint survivant doit continuer à payer le crédit seul — ou vendre la maison.",
        criteres: ["100 % du capital couvert", "Exclusions limitées (sports, dos, psy)"] },
      { id: 'itt-emprunteur', label: 'Arrêt de travail / invalidité (crédit)',
        cQuoi: "La prise en charge des mensualités du crédit si tu es en arrêt de travail ou en invalidité.",
        pourquoi: "C'est ce qui empêche un pépin de santé de se transformer en défaut de paiement sur la maison.",
        criteres: ["Franchise ≤ 90 jours", "Indemnisation forfaitaire (mensualité payée) plutôt qu'indemnitaire", "Options dos / psy rachetées si métier à risque"] },
      { id: 'quotites', label: 'Quotités',
        cQuoi: "La répartition de la couverture entre co-emprunteurs : 50/50, 100/100…",
        pourquoi: "En 50/50, si l'un décède, l'autre doit encore payer la moitié du crédit. En 100/100, le crédit est soldé en entier.",
        criteres: ["100/100 recommandé si un seul revenu ne suffit pas à payer le crédit", "Cohérence avec les revenus de chacun"] },
    ]
  },
  {
    id: 'gav', label: 'Accidents de la vie', emoji: '🤕', defaultOn: true,
    quoi: "L'indemnisation de TES propres blessures quand il n'y a pas de responsable : chute, bricolage, sport, brûlure, accident médical.",
    frontiere: "C'est le miroir de la Resp. civile : la RC paie les dommages que tu causes aux autres ; la GAV t'indemnise toi, quand personne d'autre n'est en cause.",
    postes: [
      { id: 'seuil', label: "Seuil d'intervention",
        cQuoi: "Le pourcentage d'invalidité à partir duquel la GAV (Garantie Accidents de la Vie) t'indemnise après un accident domestique, de sport, médical…",
        pourquoi: "Un contrat qui n'intervient qu'à partir de 30 % d'invalidité ne couvrira jamais la plupart des accidents réels (une main abîmée ≈ 20 %).",
        criteres: ["Seuil ≤ 5 % = très bon, 10 % = correct, 30 % = insuffisant"] },
      { id: 'plafond', label: "Plafond d'indemnisation",
        cQuoi: "Le montant maximum que la GAV peut verser pour un accident grave.",
        pourquoi: "Un accident très grave (tétraplégie) représente des millions d'euros de préjudice sur une vie.",
        criteres: ["Plafond ≥ 1 M€ par victime", "Indemnisation en droit commun (tous les préjudices)"] },
      { id: 'famille', label: 'Personnes couvertes',
        cQuoi: "Qui est protégé par le contrat : toi seul, le couple, ou toute la famille enfants compris.",
        pourquoi: "Les enfants sont les premières victimes d'accidents de la vie courante.",
        criteres: ["Formule famille incluant tous les enfants", "Pas de limite d'âge basse pour les enfants"] },
    ]
  },
  {
    id: 'rc', label: 'Resp. civile', emoji: '🤝', defaultOn: true,
    quoi: "Les dommages que toi, tes enfants ou tes animaux causez involontairement aux autres : elle paie à ta place.",
    frontiere: "Elle ne couvre jamais tes propres blessures ni tes propres biens — pour ça, voir Accidents de la vie (ton corps) et Habitation / Matériel (tes affaires).",
    postes: [
      { id: 'rc-vie-privee', label: 'RC vie privée',
        cQuoi: "Elle paie les dommages que tu causes involontairement à autrui : dégât chez un voisin, accident de vélo, casse chez des amis.",
        pourquoi: "Blesser quelqu'un, même sans le vouloir, peut coûter des centaines de milliers d'euros de dommages et intérêts.",
        criteres: ["Plafond ≥ 5 M€ pour les dommages corporels", "Incluse en général dans la MRH — vérifier qu'elle existe bien"] },
      { id: 'rc-enfants', label: 'RC enfants / famille',
        cQuoi: "L'extension de la RC aux actes de tes enfants (et des personnes dont tu réponds).",
        pourquoi: "Les parents sont civilement responsables des bêtises de leurs enfants — balle dans une baie vitrée comme accident de trottinette.",
        criteres: ["Tous les enfants du foyer couverts, y compris en garde alternée", "Activités sportives et scolaires incluses"] },
      { id: 'rc-animaux', label: 'RC animaux',
        cQuoi: "La couverture des dommages causés par tes animaux domestiques.",
        pourquoi: "Une morsure de chien ou un accident causé par un chat qui traverse engagent ta responsabilité.",
        criteres: ["Animaux déclarés au contrat MRH", "Chiens de catégorie : assurance spécifique obligatoire"] },
    ]
  },
  {
    id: 'habitation', label: 'Habitation', emoji: '🏠', defaultOn: true,
    quoi: "La protection du logement et de tout ce qu'il contient contre les sinistres : incendie, dégât des eaux, tempête, vol par effraction.",
    frontiere: "Ton mobilier est bien couvert ici… mais uniquement lors d'un sinistre au domicile. Le téléphone qui tombe, le PC volé dans le train ou la panne d'un appareil relèvent de la rubrique Matériel.",
    postes: [
      { id: 'incendie-dde', label: 'Incendie / dégât des eaux',
        cQuoi: "Le cœur de la MRH (multirisque habitation) : reconstruction et réparation après incendie, fuite, tempête, catastrophe naturelle.",
        pourquoi: "C'est ton actif principal (350 000 € de maison) : une couverture au rabais ici est le pire faux calcul.",
        criteres: ["Capital mobilier suffisant (inventaire réaliste)", "Valeur de reconstruction du bâti illimitée ou élevée", "Franchises raisonnables (≤ 300 €)"] },
      { id: 'vol', label: 'Vol / vandalisme',
        cQuoi: "L'indemnisation en cas de cambriolage ou de dégradations volontaires.",
        pourquoi: "Au-delà des objets, un cambriolage impose souvent porte, serrures et fenêtres à remplacer.",
        criteres: ["Exigences de protection réalistes (serrures, alarme) que tu respectes vraiment", "Plafonds spécifiques bijoux / objets de valeur connus"] },
      { id: 'valeur-a-neuf', label: 'Rééquipement à neuf',
        cQuoi: "Le remboursement des biens au prix du neuf, sans déduire la vétusté.",
        pourquoi: "Sans cette option, ton canapé de 8 ans est remboursé une misère alors qu'il faut bien en racheter un neuf.",
        criteres: ["Rééquipement à neuf sur le mobilier", "Vétusté plafonnée sur le bâti"] },
      { id: 'annexes', label: 'Annexes / extérieurs',
        cQuoi: "La couverture du jardin, des clôtures, de l'abri, de la piscine, des panneaux solaires…",
        pourquoi: "Souvent exclus par défaut, ce sont pourtant les premiers touchés par les tempêtes.",
        criteres: ["Dépendances et aménagements extérieurs déclarés", "Tempête/grêle incluant les extérieurs"] },
    ]
  },
  {
    id: 'juridique', label: 'Juridique', emoji: '⚖️', defaultOn: true,
    quoi: "Ton soutien en cas de litige : conseils juridiques et prise en charge des frais d'avocat (voisinage, travail, consommation, administration).",
    frontiere: "À ne pas confondre avec la Resp. civile : la RC paie quand tu as causé un dommage ; la protection juridique finance ta défense (ou ton recours) dans un conflit.",
    postes: [
      { id: 'pj-incluse', label: 'PJ incluse (MRH / carte bancaire)',
        cQuoi: "La protection juridique de base souvent glissée dans la MRH ou la carte bancaire : conseils et prise en charge limitée de litiges.",
        pourquoi: "Elle dépanne pour un litige de consommation simple, mais ses plafonds sont vite atteints.",
        criteres: ["Savoir qu'elle existe et ce qu'elle couvre", "Plafond de frais d'avocat par litige"] },
      { id: 'pj-autonome', label: 'PJ autonome',
        cQuoi: "Un contrat de protection juridique dédié, plus large : travail, voisinage, famille, consommation, administration.",
        pourquoi: "Un litige prud'hommes ou un conflit de voisinage coûte facilement 3 000 à 10 000 € de frais d'avocat.",
        criteres: ["Domaines couverts larges (travail inclus)", "Plafond ≥ 20 000 € par litige", "Seuil d'intervention bas (≤ 300 €)"] },
      { id: 'pj-domaines', label: 'Domaines couverts',
        cQuoi: "La liste des types de litiges réellement pris en charge par tes protections juridiques cumulées.",
        pourquoi: "Beaucoup de PJ excluent justement les litiges les plus probables : travail, divorce, construction.",
        criteres: ["Consommation, voisinage, travail, e-commerce couverts", "Délais de carence connus"] },
    ]
  },
  {
    id: 'enfants', label: 'Enfants', emoji: '🧒', defaultOn: true,
    quoi: "Une vue transversale sur la protection de tes enfants : accident, santé spécifique (orthodontie, psy…), avenir financier si un parent disparaît.",
    frontiere: "Ces garanties vivent dans d'autres contrats (GAV, mutuelle, prévoyance, scolaire) : la rubrique vérifie qu'aucun enfant ne passe entre les mailles, sans contrat dédié à souscrire.",
    postes: [
      { id: 'individuelle-accident', label: 'Individuelle accident',
        cQuoi: "Une indemnisation pour ton enfant s'il se blesse, même sans responsable identifié (chute seul au parc, sport).",
        pourquoi: "La RC ne joue que si quelqu'un d'autre est responsable. Quand l'enfant se blesse seul — le cas le plus courant — il faut une individuelle accident (souvent via la GAV ou l'assurance scolaire).",
        criteres: ["Couverture 24h/24, toute l'année (pas seulement à l'école)", "Invalidité indemnisée dès un seuil bas"] },
      { id: 'rente-education-enfant', label: 'Rente éducation',
        cQuoi: "La rente versée à l'enfant si un parent décède (voir aussi Prévoyance).",
        pourquoi: "C'est la protection financière la plus directe des études de tes enfants.",
        criteres: ["Prévue au contrat prévoyance (perso ou employeur)", "Montant croissant avec l'âge de l'enfant"] },
      { id: 'sante-enfants', label: 'Santé des enfants',
        cQuoi: "Les postes santé propres aux enfants : orthodontie, lunettes, orthophonie, psy.",
        pourquoi: "L'orthodontie, c'est souvent 600 à 1 200 € par semestre, très mal remboursés par la Sécu après 16 ans.",
        criteres: ["Forfait orthodontie ≥ 300 €/semestre", "Séances de psy / orthophonie prises en charge"] },
    ]
  },
  {
    id: 'scolaire', label: 'Scolaire', emoji: '🎒', defaultOn: true,
    quoi: "La couverture de l'enfant à l'école, sur le trajet et en activité : sa responsabilité (RC) et ses propres blessures.",
    frontiere: "Souvent en doublon : la RC familiale de la MRH et une GAV famille couvrent déjà l'essentiel. La rubrique sert d'abord à vérifier ça avant de payer une assurance scolaire.",
    postes: [
      { id: 'rc-scolaire', label: 'RC scolaire',
        cQuoi: "La responsabilité civile de l'enfant pour les dommages qu'il cause à l'école.",
        pourquoi: "Exigée pour les activités facultatives (sorties, cantine). Souvent déjà couverte par la RC familiale de la MRH.",
        criteres: ["Vérifier le doublon avec la RC familiale avant de payer une assurance scolaire"] },
      { id: 'accident-scolaire', label: 'Individuelle accident scolaire',
        cQuoi: "L'indemnisation de l'enfant s'il se blesse à l'école ou sur le trajet.",
        pourquoi: "C'est la partie réellement utile de l'assurance scolaire — la RC seule ne protège pas ton enfant lui-même.",
        criteres: ["Capital invalidité significatif", "Frais dentaires / optique cassés en récré couverts"] },
      { id: 'extrascolaire', label: 'Extrascolaire (24h/24)',
        cQuoi: "L'extension de la couverture accident à toute la vie de l'enfant : sport, vacances, maison.",
        pourquoi: "La plupart des accidents d'enfants ont lieu hors de l'école. L'option 24h/24 coûte quelques euros de plus.",
        criteres: ["Formule extrascolaire retenue", "Pas de doublon avec une GAV famille déjà en place"] },
    ]
  },
  {
    id: 'materiel', label: 'Matériel', emoji: '📱', defaultOn: true,
    quoi: "Tes objets et appareils pris un par un, dans les cas que la MRH ne couvre pas : casse accidentelle, panne, vol hors du domicile, objets de valeur au-delà des plafonds.",
    frontiere: "Complément direct de l'Habitation, qui couvre tes biens lors d'un sinistre à la maison. Un score moyen ici n'oblige pas à s'assurer plus : ces assurances sont souvent chères pour le risque réel, et le porter soi-même est parfois le bon choix.",
    postes: [
      { id: 'multimedia', label: 'Multimédia / électroménager',
        cQuoi: "Les extensions de garantie et assurances casse/panne des gros équipements de la maison.",
        pourquoi: "Souvent chères par rapport au risque réel — à réserver aux équipements coûteux et fragiles.",
        criteres: ["Comparer le cumul des primes au prix de rachat de l'appareil", "Vérifier la garantie légale de 2 ans avant de payer"] },
      { id: 'nomades', label: 'Objets nomades (téléphone, PC)',
        cQuoi: "L'assurance casse / vol des appareils qui sortent de la maison.",
        pourquoi: "C'est le doublon le plus fréquent : opérateur + banque + MRH couvrent parfois trois fois le même téléphone.",
        criteres: ["Un seul contrat pour ce risque", "Vol à l'arraché et oxydation inclus", "Franchise raisonnable"] },
      { id: 'objets-valeur', label: 'Objets de valeur',
        cQuoi: "Bijoux, montres, instruments, vélos haut de gamme… déclarés spécifiquement à la MRH.",
        pourquoi: "Au-delà d'un plafond (souvent bas), la MRH ne rembourse pas ce qui n'a pas été déclaré.",
        criteres: ["Inventaire et factures/photos conservés", "Plafond objets précieux adapté à ce que tu possèdes"] },
    ]
  },
  {
    id: 'auto', label: 'Auto / moto', emoji: '🚗', defaultOn: false,
    quoi: "La couverture du véhicule, de ses occupants et surtout du conducteur — le grand oublié des formules de base.",
    frontiere: "Sur la route, seule l'assurance auto joue : ni la RC vie privée ni la MRH ne couvrent un accident de voiture.",
    postes: [
      { id: 'formule', label: 'Formule (tiers → tous risques)',
        cQuoi: "Le niveau de couverture du véhicule : tiers (obligatoire, dommages aux autres), intermédiaire, tous risques (tes propres dommages aussi).",
        pourquoi: "Le bon choix dépend de la valeur du véhicule : tous risques pour un véhicule récent, tiers étendu pour un ancien.",
        criteres: ["Tous risques si véhicule < 8 ans ou > 8 000 €", "Valeur de remplacement à neuf les premières années"] },
      { id: 'conducteur', label: 'Garantie du conducteur',
        cQuoi: "L'indemnisation de TES propres blessures quand tu es responsable de l'accident (les passagers, eux, sont toujours couverts).",
        pourquoi: "C'est l'oubli n°1 : sans elle, le conducteur responsable blessé n'est indemnisé par personne.",
        criteres: ["Plafond ≥ 1 M€", "Seuil d'invalidité bas (≤ 5 %)", "Incluse quel que soit le niveau de formule"] },
      { id: 'assistance', label: 'Assistance 0 km',
        cQuoi: "Le dépannage-remorquage même en bas de chez toi (sans option, l'assistance ne joue qu'à plus de 50 km).",
        pourquoi: "La majorité des pannes ont lieu près du domicile.",
        criteres: ["0 km inclus", "Véhicule de remplacement prévu"] },
    ]
  },
  {
    id: 'mobilite', label: 'Mobilité douce', emoji: '🚲', defaultOn: false,
    quoi: "Vélos, trottinettes et engins électriques : la RC obligatoire des engins motorisés, le vol et la casse.",
    frontiere: "Rubrique à part car la RC de ta MRH ne couvre PAS les engins à moteur électrique, et le vol de vélo dans la rue est presque toujours exclu de la MRH.",
    postes: [
      { id: 'rc-edpm', label: 'RC trottinette / EDPM',
        cQuoi: "L'assurance responsabilité civile obligatoire pour les engins électriques (trottinette, gyroroue…). La RC de la MRH ne les couvre PAS.",
        pourquoi: "Rouler non assuré en trottinette électrique est illégal et t'expose personnellement en cas d'accident corporel causé à autrui.",
        criteres: ["Contrat EDPM spécifique si tu possèdes un engin électrique"] },
      { id: 'vol-velo', label: 'Vol de vélo',
        cQuoi: "La couverture du vol du vélo, au domicile et surtout à l'extérieur.",
        pourquoi: "La MRH couvre souvent le vélo volé dans le garage, presque jamais dans la rue.",
        criteres: ["Vol hors domicile inclus", "Antivol homologué exigé — vérifier le tien", "Valeur du vélo déclarée"] },
      { id: 'casse-velo', label: 'Casse / dommages',
        cQuoi: "La réparation du vélo ou de l'engin après une chute ou un accident.",
        pourquoi: "Pertinent surtout pour les vélos électriques et haut de gamme.",
        criteres: ["Utile si valeur > 1 000 €", "Vétusté appliquée à vérifier"] },
    ]
  },
  {
    id: 'voyage', label: 'Voyage', emoji: '✈️', defaultOn: true,
    quoi: "Les gros pépins loin de chez toi : rapatriement, frais médicaux à l'étranger, annulation de voyage.",
    frontiere: "Ta carte bancaire (Visa Premier, Gold…) couvre souvent déjà l'essentiel : la rubrique sert d'abord à le savoir, pour ne pas payer deux fois la même garantie.",
    postes: [
      { id: 'rapatriement', label: 'Assistance rapatriement',
        cQuoi: "L'organisation et la prise en charge de ton retour médicalisé en cas de gros pépin à l'étranger.",
        pourquoi: "Un rapatriement sanitaire coûte de 10 000 à 100 000 € selon la destination.",
        criteres: ["Incluse via carte bancaire (Visa Premier / Gold) ou contrat dédié", "Numéro d'assistance 24h/24 noté quelque part d'accessible"] },
      { id: 'frais-medicaux', label: "Frais médicaux à l'étranger",
        cQuoi: "Le remboursement des soins reçus hors de France, où la Sécu rembourse peu ou pas.",
        pourquoi: "Une appendicite aux États-Unis, c'est 30 000 à 50 000 $.",
        criteres: ["Plafond ≥ 150 000 € (1 M€ pour USA/Canada/Asie)", "Avance des frais d'hospitalisation"] },
      { id: 'annulation', label: 'Annulation',
        cQuoi: "Le remboursement du voyage si tu dois annuler (maladie, accident, événement familial).",
        pourquoi: "Pertinent pour les gros voyages payés longtemps à l'avance.",
        criteres: ["Motifs d'annulation larges", "Souvent déjà incluse via la carte bancaire ayant payé le voyage"] },
      { id: 'carte-bancaire', label: 'Couvertures carte bancaire',
        cQuoi: "Les assurances voyage automatiques de ta carte (Visa Premier, Gold Mastercard…) quand le voyage est payé avec.",
        pourquoi: "Beaucoup paient des assurances voyage en doublon de ce que leur carte couvre déjà gratuitement.",
        criteres: ["Connaître les garanties exactes de ta carte", "Payer les voyages avec la bonne carte", "Vérifier la durée max de séjour (souvent 90 jours)"] },
    ]
  },
  {
    id: 'numerique', label: 'Vie numérique', emoji: '💻', defaultOn: false,
    quoi: "Les risques en ligne : usurpation d'identité, fraude bancaire, cyberharcèlement (notamment des enfants).",
    frontiere: "La loi (remboursement des fraudes bancaires) et tes contrats existants (PJ, options MRH) couvrent déjà beaucoup : vérifier avant d'acheter une assurance dédiée.",
    postes: [
      { id: 'usurpation', label: "Usurpation d'identité",
        cQuoi: "L'accompagnement (juridique et technique) si quelqu'un utilise ton identité pour ouvrir des comptes ou contracter des crédits.",
        pourquoi: "Des mois de démarches pour prouver que ce n'est pas toi — un accompagnement change tout.",
        criteres: ["Souvent inclus dans une PJ ou une option MRH — vérifier avant d'acheter"] },
      { id: 'fraude-bancaire', label: 'Fraude bancaire',
        cQuoi: "La protection contre les débits frauduleux et le phishing.",
        pourquoi: "La loi oblige déjà la banque à rembourser la plupart des fraudes — les assurances dédiées sont rarement utiles.",
        criteres: ["Connaître ses droits légaux (remboursement sous 1 jour ouvré)", "Ne payer une option que pour ce que la loi ne couvre pas"] },
      { id: 'cyberharcelement', label: 'Cyberharcèlement / e-réputation',
        cQuoi: "Aide juridique et technique pour faire retirer des contenus et poursuivre en cas de harcèlement en ligne (notamment des enfants).",
        pourquoi: "Face au harcèlement scolaire en ligne, savoir vers qui se tourner immédiatement est précieux.",
        criteres: ["Accompagnement psychologique inclus", "Suppression de contenus prise en charge"] },
    ]
  },
];

const TYPES_CONTRAT = [
  { value: 'mrh', label: 'Habitation (MRH)', color: '#fb923c' },
  { value: 'auto', label: 'Auto / moto', color: '#60a5fa' },
  { value: 'sante', label: 'Santé / mutuelle', color: '#34d399' },
  { value: 'prevoyance', label: 'Prévoyance', color: '#c084fc' },
  { value: 'emprunteur', label: 'Emprunteur', color: '#f472b6' },
  { value: 'gav', label: 'Accidents de la vie (GAV)', color: '#f87171' },
  { value: 'pj', label: 'Protection juridique', color: '#fbbf24' },
  { value: 'scolaire', label: 'Scolaire', color: '#22d3ee' },
  { value: 'materiel', label: 'Matériel / équipement', color: '#a3e635' },
  { value: 'voyage', label: 'Voyage / carte bancaire', color: '#818cf8' },
  { value: 'autre', label: 'Autre', color: '#9ca3af' },
];

// Situations de sinistre par type de contrat (pour l'encart « En cas de besoin »)
const SINISTRE_PAR_TYPE = {
  mrh: "J'ai un dégât des eaux, un incendie ou un cambriolage",
  auto: "J'ai un accident ou une panne de voiture",
  sante: "Je suis hospitalisé ou j'ai de gros frais de santé",
  prevoyance: "Je suis en arrêt de travail · invalidité · décès",
  emprunteur: "Je ne peux plus payer mon crédit (arrêt, invalidité)",
  gav: "Je me suis blessé (maison, bricolage, sport)",
  pj: "J'ai un litige et besoin de conseils ou d'un avocat",
  scolaire: "Mon enfant s'est blessé (école, activités)",
  materiel: "Mon appareil est cassé, en panne ou volé",
  voyage: "J'ai un pépin en voyage · rapatriement",
  autre: 'Sinistre',
};

// Un vrai numéro de téléphone ? Sinon la consigne part en sous-ligne grise, jamais en gros cyan.
const isTelReel = (t) => /^[+0-9][0-9 .()/-]{5,19}$/.test(String(t || '').trim());
const normTxt = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// ---- state helpers ----
let selectedDomaineId = null;

function getContrats(store) { return store.get('contrats') || []; }

function getConfig(store) {
  const cfg = store.get('protectionConfig') || {};
  const actifs = { ...Object.fromEntries(DOMAINES.map(d => [d.id, d.defaultOn])), ...(cfg.actifs || {}) };
  // horsScope : postes marqués « non concerné » (clé "domId::posteId"), retirés de la pondération des notes
  return { actifs, horsScope: cfg.horsScope || {} };
}

function getBilan(store) { return store.get('protectionBilan') || null; }

function scoreColor(note) {
  if (note === null || note === undefined) return '#4b5563';
  if (note < 1.5) return '#f87171';
  if (note < 3) return '#fbbf24';
  if (note < 4) return '#a3e635';
  return '#34d399';
}

function scoreLabel(note) {
  if (note === null || note === undefined) return 'Non évalué';
  if (note < 1) return 'Non couvert';
  if (note < 2) return 'Trace';
  if (note < 3) return 'Insuffisant';
  if (note < 4) return 'Correct';
  if (note < 5) return 'Bon';
  return 'Optimal';
}

// Score d'un domaine : bilan global prioritaire, sinon calcul depuis les garanties des contrats.
// Les postes marqués « non concerné » sont retirés de la pondération.
function computeDomaineData(store, domId) {
  const bilan = getBilan(store);
  const horsScope = getConfig(store).horsScope;
  const estExclu = (posteId) => !!horsScope[domId + '::' + posteId];
  if (bilan?.scores?.[domId]) {
    const s = bilan.scores[domId];
    const postes = (s.postes || []).map(p => ({
      poste: p.poste, label: p.label || p.poste, note: Number(p.note), resume: p.resume || '', contrat: p.contrat || '', exclu: estExclu(p.poste)
    }));
    // La note du bilan fait foi, sauf si des postes sont exclus : repondération sur la moyenne des postes restants
    let note = Number(s.note);
    if (postes.some(p => p.exclu)) {
      const retenues = postes.filter(p => !p.exclu && !isNaN(p.note)).map(p => p.note);
      note = retenues.length ? Math.round((retenues.reduce((a, b) => a + b, 0) / retenues.length) * 2) / 2 : null;
    }
    return { note, resume: s.resume || '', postes, source: 'bilan' };
  }
  // Fallback : agréger les garanties des contrats analysés individuellement
  const postes = [];
  for (const c of getContrats(store)) {
    for (const g of (c.garanties || [])) {
      if (g.domaine === domId) postes.push({ poste: g.poste, label: g.label || g.poste, note: Number(g.note), resume: g.resume || '', contrat: c.nom || c.assureur || '', exclu: estExclu(g.poste) });
    }
  }
  if (postes.length === 0) return { note: null, resume: '', postes: [], source: 'aucun' };
  const retenus = postes.filter(p => !p.exclu);
  const note = retenus.length ? Math.max(...retenus.map(p => p.note || 0)) : null;
  return { note, resume: '', postes, source: 'contrats' };
}

function findPedagogie(domId, posteIdOrLabel) {
  const dom = DOMAINES.find(d => d.id === domId);
  if (!dom) return null;
  const key = (posteIdOrLabel || '').toLowerCase();
  return dom.postes.find(p => p.id === posteIdOrLabel)
    || dom.postes.find(p => key && (p.label.toLowerCase().includes(key) || key.includes(p.id)))
    || null;
}

// ============================================================
// PROMPTS D'ANALYSE (à copier dans claude.ai)
// ============================================================
function catalogueForPrompt() {
  return DOMAINES.map(d => `- ${d.id} (${d.label}) : postes ${d.postes.map(p => p.id).join(', ')}`).join('\n');
}

function buildPromptContrat() {
  return `Tu es un expert en assurance et protection du particulier en France. J'ai joint un ou plusieurs documents d'assurance (conditions particulières, tableaux de garanties, avis d'échéance, synthèse multi-contrats). Je suis un particulier profane : analyse ces documents POUR MOI et réponds UNIQUEMENT avec un bloc JSON valide, sans texte avant ni après.

MÉTHODE OBLIGATOIRE, dans cet ordre :
1. INVENTAIRE : identifie d'abord TOUS les contrats distincts mentionnés dans les documents. Comptent comme contrats à part entière : les contrats collectifs d'entreprise payés sur la fiche de paie (mutuelle, prévoyance), les garanties gratuites (assurances d'une carte bancaire), les contrats sans numéro ou sans prime visibles, et chaque contrat listé dans une synthèse multi-contrats.
2. RESTITUTION : renvoie { "contrats": [ {...}, {...} ] } avec EXACTEMENT une fiche par contrat inventorié — si les documents mentionnent 5 contrats, le tableau contient 5 fiches, jamais moins. Ne fusionne JAMAIS plusieurs contrats en une seule fiche : chacun garde son propre numéro, sa propre prime, sa propre échéance et son propre téléphone. N'omets aucun contrat sous prétexte qu'il est gratuit, collectif ou incomplet. S'il n'y a réellement qu'un seul contrat, renvoie l'objet seul (sans tableau).

Domaines et postes autorisés (utilise exactement ces identifiants) :
${catalogueForPrompt()}

Points de vigilance PAR TYPE de contrat (applique ceux du type détecté) :
- Habitation (MRH) : valeur à neuf ou vétusté ? franchises ? plafonds mobilier/objets de valeur ? exclusions (piscine, dépendances, espèces) ? délais de déclaration ?
- GAV : seuil d'invalidité déclencheur (1 %, 5 %, 30 % ?), plafond, QUI est couvert (conjoint souvent exclu), exclusions (véhicule, travail, dos).
- Santé/mutuelle : hospitalisation en % BR, dépassements d'honoraires, optique/dentaire/orthodontie en euros réels, soins à l'étranger.
- Prévoyance : capital décès, rente éducation, taux de maintien de salaire (ITT), rente invalidité — si un montant n'est pas dans le document, note null et dis où le trouver.
- Protection juridique : domaines couverts ET exclus (travail ? construction ?), plafond de frais d'avocat, seuil d'intervention, délais de carence.
- Carte bancaire : conditions d'activation (part du voyage payée avec la carte), durée max de séjour, plafonds.
- Auto : formule, garantie du conducteur (l'oubli n°1), assistance 0 km, valeur de remplacement.
- Scolaire : extrascolaire 24h/24 ou école seulement ? doublon probable avec RC familiale et GAV.

Barème de notation (note chaque poste de 0 à 5) :
0 = non couvert · 1 = trace (couverture par ricochet, plafonds symboliques) · 2 = insuffisant (plafonds bas, franchises élevées, membres du foyer exclus) · 3 = correct (standard du marché) · 4 = bon (plafonds élevés, franchises faibles, toute la famille) · 5 = optimal.

Règles :
- Tutoie le lecteur, français courant, zéro jargon non expliqué. Chaque "resume" fait 1 à 2 phrases avec les chiffres réels du contrat (plafonds, franchises, taux).
- Les champs d'identité sont COURTS, jamais des phrases : "nom" ≤ 40 caractères (ex. "MRH maison"), "assureur" = le nom seul (ex. "ACM"), "numContrat"/"numClient"/"echeance"/"telephone" = la valeur seule ou null si absente du document. N'écris JAMAIS d'explication du type "sans numéro dans ce document" dans un champ : mets null.
- Ne note que les postes réellement traités par CE contrat. Si un chiffre est illisible, mets null et signale-le dans "resume".
- Extrais tous les numéros utiles (gestion, sinistre, assistance 24h/24).

Format de réponse EXACT :
{
  "nom": "nom court du contrat",
  "type": "mrh|auto|sante|prevoyance|emprunteur|gav|pj|scolaire|materiel|voyage|autre",
  "assureur": "nom de l'assureur",
  "numContrat": "numéro de contrat",
  "numClient": "numéro client ou de sociétaire",
  "prime": 123.45,
  "primePeriode": "mois|an",
  "echeance": "date d'échéance ou date anniversaire",
  "telephone": "téléphone gestion du contrat",
  "telAssistance": "téléphone assistance/sinistre 24h/24",
  "resume": "2 phrases : ce que couvre ce contrat, pour qui",
  "pointsForts": ["point fort 1", "point fort 2"],
  "pointsFaibles": ["point faible 1", "point faible 2"],
  "garanties": [
    { "domaine": "id domaine", "poste": "id poste", "label": "libellé lisible", "note": 3, "resume": "explication personnalisée avec les chiffres du contrat", "plafond": "plafond si pertinent", "franchise": "franchise si pertinente" }
  ],
  "numerosUtiles": [ { "situation": "Dégât des eaux", "tel": "01 23 45 67 89", "disponibilite": "24h/24" } ]
}`;
}

function buildPromptBilan(store) {
  const cfg = getConfig(store);
  const domainesActifs = DOMAINES.filter(d => cfg.actifs[d.id]);
  const contrats = getContrats(store).map(c => ({
    nom: c.nom, type: c.type, assureur: c.assureur, prime: c.prime, primePeriode: c.primePeriode,
    resume: c.resume, pointsForts: c.pointsForts, pointsFaibles: c.pointsFaibles, garanties: c.garanties
  }));
  return `Tu es un expert en assurance et protection du particulier en France. Voici, au format JSON, l'ensemble des contrats de mon foyer déjà analysés un par un. Fais le BILAN GLOBAL CROISÉ de ma protection et réponds UNIQUEMENT avec un bloc JSON valide, sans texte avant ni après.

Mes contrats :
${JSON.stringify(contrats, null, 1)}

Domaines à évaluer (utilise exactement ces identifiants) :
${domainesActifs.map(d => `- ${d.id} (${d.label}) : postes ${d.postes.map(p => p.id).join(', ')}`).join('\n')}

Barème : 0 = non couvert · 1 = trace · 2 = insuffisant · 3 = correct · 4 = bon · 5 = optimal (couverture complète, cohérente entre contrats, sans trou ni doublon coûteux).

Règles :
- Croise les contrats entre eux : détecte les DOUBLONS (même risque payé deux fois) et les TROUS de couverture.
- Tutoie le lecteur, français courant. Chaque "resume" fait 1 à 2 phrases concrètes.
- Note chaque domaine ET chaque poste de chaque domaine (tous les postes listés, même à 0 si rien ne les couvre).
- Les recommandations sont concrètes : quoi faire, auprès de qui, ordre de grandeur de prix annuel. priorite : 1 = urgent (trou grave), 2 = important, 3 = optimisation.
- EN PLUS des trous et doublons : pour CHAQUE domaine noté entre 3 et 4,5, ajoute une recommandation priorite 3 dont le titre commence par « Passer de X à 5 — » (X = note actuelle) expliquant précisément ce qui manque pour une couverture optimale : quelle garantie relever, quel plafond viser, quelle option ajouter, et l'ordre de grandeur du coût.
- Pour "urgences" : construis un GUIDE RÉFLEXE de 10 à 15 situations très concrètes, formulées à la première personne (« J'ai un dégât des eaux », « On m'a volé mon téléphone », « Mon enfant s'est blessé à l'école », « J'ai un accident de voiture », « Je suis hospitalisé »…), couvrant TOUS les risques assurés par mes contrats. Pour chacune : "contact" = qui contacter en premier ; "tel" = UNIQUEMENT un vrai numéro de téléphone présent dans les documents (sinon null — n'invente jamais de numéro et ne mets JAMAIS de phrase dans ce champ) ; "note" = le n° de contrat à rappeler + le premier réflexe en quelques mots (déposer plainte d'abord, déclarer sous 5 jours, où trouver le numéro s'il manque…). Si un risque courant n'est couvert par aucun contrat, ajoute quand même la situation avec contact "Non couvert" et le bon réflexe gratuit (conciliateur, service public…).

Format de réponse EXACT :
{
  "synthese": "3 phrases max : l'état global de ma protection",
  "scores": {
    "id_domaine": {
      "note": 3.5,
      "resume": "1-2 phrases sur ce domaine",
      "postes": [ { "poste": "id poste", "label": "libellé lisible", "note": 3, "resume": "explication personnalisée", "contrat": "nom du contrat source ou vide" } ]
    }
  },
  "recos": [ { "domaine": "id domaine", "priorite": 1, "titre": "titre court", "texte": "quoi faire concrètement", "prix": "ordre de grandeur €/an" } ],
  "doublons": [ { "titre": "titre court", "texte": "quels contrats se recouvrent et quoi résilier/ajuster" } ],
  "urgences": [ { "situation": "J'ai un dégât des eaux", "contact": "assureur — contrat concerné", "tel": "01 23 45 67 89 ou null", "note": "contrat n° … · déclarer sous 5 jours ouvrés" } ]
}`;
}

function parseColleJSON(text) {
  let t = (text || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  return JSON.parse(t);
}

// Conseils exportés pour la page « Le conseiller »
export function getConseilsContrats(store) {
  const bilan = store.get('protectionBilan') || null;
  const recos = (bilan?.recos || []).map(r => ({ prio: r.priorite || 3, titre: r.titre, texte: r.texte + (r.prix ? ` (${r.prix})` : '') }));
  const doublons = (bilan?.doublons || []).map(d => ({ prio: 2, titre: `Doublon : ${d.titre}`, texte: d.texte }));
  const out = [...recos, ...doublons].sort((a, b) => a.prio - b.prio);
  if (out.length === 0) {
    const hasContrats = (store.get('contrats') || []).length > 0;
    out.push({ prio: 3,
      titre: hasContrats ? 'Lance le bilan global de protection' : "Analyse tes contrats d'assurance",
      texte: hasContrats
        ? "Tes contrats sont importés mais le bilan croisé n'a pas encore été fait : il détecte les doublons, les trous de couverture et génère tes recommandations."
        : "Dépose tes contrats via l'assistant de la page Contrats & garanties pour obtenir ton radar de protection et des recommandations personnalisées." });
  }
  return out;
}

// ============================================================
// RENDER
// ============================================================
function pastilles(note) {
  const n = Math.round(Number(note) || 0);
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="inline-block w-2 h-2 rounded-full ${i <= n ? '' : 'opacity-20'}" style="background:${scoreColor(note)}"></span>`;
  }
  return `<span class="inline-flex items-center gap-0.5">${html}</span>`;
}

function copyBtn(value, title = 'Copier') {
  if (!value) return '';
  return `<button data-copy="${String(value).replace(/"/g, '&quot;')}" title="${title}" class="text-gray-600 hover:text-cyan-400 transition p-0.5 rounded align-middle">
    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"/></svg>
  </button>`;
}

export function render(store) {
  const contrats = getContrats(store);
  const cfg = getConfig(store);
  const bilan = getBilan(store);
  const domainesActifs = DOMAINES.filter(d => cfg.actifs[d.id]);
  const domData = Object.fromEntries(domainesActifs.map(d => [d.id, computeDomaineData(store, d.id)]));
  if (selectedDomaineId && !cfg.actifs[selectedDomaineId]) selectedDomaineId = null;
  const hasData = contrats.length > 0 || !!bilan;

  // Recos priorisées (bandeau haut)
  const recos = (bilan?.recos || []).slice().sort((a, b) => (a.priorite || 3) - (b.priorite || 3));
  const doublons = bilan?.doublons || [];

  // Total primes annuelles
  const totalPrimes = contrats.reduce((s, c) => {
    const p = Number(c.prime) || 0;
    return s + (c.primePeriode === 'mois' ? p * 12 : p);
  }, 0);

  const prioColor = (p) => p === 1 ? { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', dot: '#f87171' }
    : p === 2 ? { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', dot: '#fbbf24' }
    : { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', dot: '#60a5fa' };

  // ---- Fiche domaine sélectionné ----
  const ficheDomaine = () => {
    if (!selectedDomaineId) return '';
    const dom = DOMAINES.find(d => d.id === selectedDomaineId);
    const data = domData[selectedDomaineId];
    if (!dom || !data) return '';
    const domRecos = recos.filter(r => r.domaine === dom.id);
    // Postes évalués + postes du catalogue non évalués (à 0/non évalué)
    const evaluatedIds = new Set(data.postes.map(p => p.poste));
    const postesAffiches = [
      ...data.postes,
      ...dom.postes.filter(p => !evaluatedIds.has(p.id) && ![...evaluatedIds].some(e => findPedagogie(dom.id, e) === p))
        .map(p => ({ poste: p.id, label: p.label, note: null, resume: '', contrat: '', exclu: !!cfg.horsScope[dom.id + '::' + p.id] }))
    ];
    const nbExclus = postesAffiches.filter(p => p.exclu).length;
    return `
    <div class="card-dark rounded-xl overflow-hidden" id="fiche-domaine">
      <div class="px-4 sm:px-5 py-4 border-b border-dark-400/30 flex flex-wrap items-center gap-3">
        <span class="text-2xl">${dom.emoji}</span>
        <div class="flex-1 min-w-[180px]">
          <div class="flex items-center gap-2">
            <h3 class="text-base font-bold text-gray-100">${dom.label}</h3>
            <span class="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style="background:${scoreColor(data.note)}22;color:${scoreColor(data.note)}">${scoreLabel(data.note)}</span>
          </div>
          <div class="flex items-center gap-2 mt-1.5">
            <div class="flex-1 max-w-[220px] h-1.5 rounded-full bg-dark-600/70 overflow-hidden">
              <div class="h-full rounded-full" style="width:${((data.note || 0) / 5) * 100}%;background:${scoreColor(data.note)}"></div>
            </div>
            <span class="text-sm font-bold" style="color:${scoreColor(data.note)}">${data.note !== null ? data.note.toFixed(1).replace('.', ',') + '/5' : '—'}</span>
          </div>
          ${nbExclus > 0 ? `<p class="text-[9px] text-gray-600 mt-1">note repondérée — ${nbExclus} poste${nbExclus > 1 ? 's' : ''} non concerné${nbExclus > 1 ? 's' : ''} exclu${nbExclus > 1 ? 's' : ''}</p>` : ''}
        </div>
        <button id="fiche-close" class="text-gray-600 hover:text-gray-300 transition text-lg px-1">&times;</button>
      </div>
      ${dom.quoi ? `
      <details class="mx-4 sm:mx-5 mt-3 rounded-lg bg-indigo-500/5 border border-indigo-500/15 group/rub">
        <summary class="px-3 py-2 cursor-pointer select-none text-[11px] text-indigo-300/90 flex items-center gap-1.5" style="list-style:none">
          ℹ️ Comprendre cette rubrique
          <svg class="w-2.5 h-2.5 transition-transform group-open/rub:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
        </summary>
        <div class="px-3 pb-2.5 space-y-1.5 text-xs leading-relaxed">
          <p><span class="font-semibold text-indigo-300">🎯 Ce que mesure cette rubrique :</span> <span class="text-gray-300">${dom.quoi}</span></p>
          ${dom.frontiere ? `<p><span class="font-semibold text-indigo-300">↔ À ne pas confondre :</span> <span class="text-gray-400">${dom.frontiere}</span></p>` : ''}
        </div>
      </details>` : ''}
      ${data.resume ? `<p class="px-4 sm:px-5 pt-3 text-xs text-gray-400 leading-relaxed">${data.resume}</p>` : ''}
      <div class="p-4 sm:p-5 space-y-1.5">
        ${postesAffiches.map((p, i) => {
          const ped = findPedagogie(dom.id, p.poste) || findPedagogie(dom.id, p.label);
          const noteTxt = p.note !== null && p.note !== undefined && !isNaN(p.note) ? Math.round(p.note) + '/5' : 'non évalué';
          return `
        <div class="rounded-lg bg-dark-800/40 border border-dark-400/15 ${p.exclu ? 'opacity-50' : ''}">
          <button data-poste-toggle="${i}" class="w-full flex items-center gap-2.5 px-3 py-2.5 text-left">
            <span class="flex-1 min-w-0 text-[13px] text-gray-200 truncate">${p.label || p.poste}</span>
            ${p.exclu
              ? `<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-dark-600/70 text-gray-500 uppercase tracking-wide flex-shrink-0">non concerné</span>`
              : `${pastilles(p.note)}<span class="text-xs font-bold flex-shrink-0 w-[4.5rem] text-right" style="color:${scoreColor(p.note)}">${noteTxt}</span>`}
            <svg data-poste-chevron="${i}" class="w-3 h-3 text-gray-600 transition-transform flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div data-poste-panel="${i}" class="hidden px-3 pb-3 space-y-2">
            ${p.resume ? `<p class="text-xs text-gray-400 leading-relaxed">${p.resume}</p>` : ''}
            ${p.contrat ? `<p class="text-[10px] text-gray-500">🏷 Couvert par : <span class="text-gray-400">${p.contrat}</span></p>` : ''}
            ${ped ? `
            <div class="rounded-lg bg-cyan-500/5 border border-cyan-500/15 p-3 space-y-2 text-xs leading-relaxed">
              <p><span class="font-semibold text-cyan-300">C'est quoi ?</span> <span class="text-gray-300">${ped.cQuoi}</span></p>
              <p><span class="font-semibold text-cyan-300">Pourquoi c'est important ?</span> <span class="text-gray-300">${ped.pourquoi}</span></p>
              <div><span class="font-semibold text-cyan-300">Ce qu'il faut regarder :</span>
                <ul class="mt-1 space-y-0.5">${ped.criteres.map(c => `<li class="flex gap-1.5 text-gray-300"><span class="text-cyan-500/60">•</span><span>${c}</span></li>`).join('')}</ul>
              </div>
            </div>` : ''}
            <button data-poste-exclure="${dom.id}::${p.poste}" class="text-[11px] transition ${p.exclu ? 'text-cyan-400 hover:text-cyan-300' : 'text-gray-600 hover:text-gray-400'}">
              ${p.exclu ? "↩ Finalement concerné — réintégrer ce poste dans la note" : "🚫 Pas concerné (pas d'animaux, pas de vélo…) — exclure de la note"}
            </button>
          </div>
        </div>`;
        }).join('')}
        <p class="text-[10px] text-gray-600 pt-1">Clique sur un poste pour l'explication complète — et marque-le « non concerné » s'il ne s'applique pas à ta situation : la note du domaine se repondère automatiquement.</p>
        ${domRecos.map(r => `
        <div class="relative">
          ${conseilCardHtml({
            prio: r.priorite || 3,
            titre: r.titre,
            texte: r.texte + (r.prix ? ` (${r.prix})` : '')
          }, { extraClass: 'pr-8' })}
          <button data-dismiss-reco="${r.titre.replace(/"/g, '&quot;')}" title="Supprimer ce conseil" class="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded text-gray-600 hover:text-accent-red hover:bg-dark-600/60 transition text-xs">✕</button>
        </div>`).join('')}
      </div>
    </div>`;
  };

  // ---- Assistant d'analyse (repliable une fois les données en place) ----
  const assistant = `
    <details class="card-dark rounded-xl overflow-hidden group/asst" ${!hasData ? 'open' : ''}>
      <summary class="flex items-center justify-between px-4 sm:px-5 py-3 cursor-pointer select-none hover:bg-dark-700/30 transition" style="list-style:none">
        <div class="flex items-center gap-2">
          <span class="text-base">🧭</span>
          <h3 class="text-sm font-bold text-gray-100">Analyser ou mettre à jour mes contrats</h3>
          ${bilan?.date ? `<span class="text-[10px] text-gray-600">· dernier bilan : ${bilan.date}</span>` : ''}
        </div>
        <svg class="w-3.5 h-3.5 text-gray-600 transition-transform group-open/asst:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
      </summary>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 px-3 pb-3">
      <div class="rounded-xl bg-dark-800/40 border border-dark-400/15 p-4 sm:p-5">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-lg">📄</span>
          <h3 class="text-sm font-bold text-gray-100">Analyser un contrat</h3>
        </div>
        <ol class="text-xs text-gray-400 space-y-1.5 mb-3 leading-relaxed">
          <li><span class="text-cyan-400 font-semibold">1.</span> Copie le prompt d'analyse ci-dessous</li>
          <li><span class="text-cyan-400 font-semibold">2.</span> Ouvre <a href="https://claude.ai/new" target="_blank" rel="noopener" class="text-cyan-400 underline hover:text-cyan-300">claude.ai</a>, colle le prompt et <b class="text-gray-300">glisse le ou les PDF</b> (conditions particulières, tableaux de garanties — plusieurs contrats possibles d'un coup), envoie</li>
          <li><span class="text-cyan-400 font-semibold">3.</span> Copie la réponse et importe-la ici</li>
        </ol>
        <p class="text-[10px] text-gray-600 mb-3 leading-relaxed">💡 Nouveau contrat ou renouvellement : mêmes gestes, même prompt — un contrat déjà connu est mis à jour, un nouveau s'ajoute. Termine toujours par un bilan global.</p>
        <div class="flex flex-wrap gap-2">
          <button id="btn-copy-prompt-contrat" class="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 text-xs rounded-lg hover:bg-cyan-500/30 transition font-medium">📋 Copier le prompt d'analyse</button>
          <button id="btn-import-contrat" class="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-lg hover:bg-emerald-500/30 transition font-medium">📥 Coller le résultat</button>
          <button id="btn-add-contrat-manuel" class="px-3 py-1.5 bg-dark-600/60 border border-dark-400/40 text-gray-400 text-xs rounded-lg hover:bg-dark-600 hover:text-gray-200 transition">+ Saisie manuelle</button>
          ${hasData ? `<button id="btn-reset-protection" class="px-3 py-1.5 text-xs rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition ml-auto">♻ Tout réinitialiser</button>` : ''}
        </div>
      </div>
      <div class="rounded-xl bg-dark-800/40 border border-dark-400/15 p-4 sm:p-5 ${contrats.length === 0 ? 'opacity-50' : ''}">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-lg">🕸️</span>
          <h3 class="text-sm font-bold text-gray-100">Bilan global &amp; radar</h3>
        </div>
        <p class="text-xs text-gray-400 mb-3 leading-relaxed">Quand tes contrats sont importés, lance le bilan croisé : il remplit le radar, détecte les <b class="text-gray-300">doublons</b> et les <b class="text-gray-300">trous de couverture</b>, et génère les recommandations. À relancer après chaque ajout ou mise à jour de contrat.</p>
        <div class="flex flex-wrap gap-2">
          <button id="btn-copy-prompt-bilan" class="px-3 py-1.5 bg-purple-500/20 text-purple-400 text-xs rounded-lg hover:bg-purple-500/30 transition font-medium" ${contrats.length === 0 ? 'disabled' : ''}>📋 Copier le prompt de bilan</button>
          <button id="btn-import-bilan" class="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-lg hover:bg-emerald-500/30 transition font-medium" ${contrats.length === 0 ? 'disabled' : ''}>📥 Coller le bilan</button>
        </div>
      </div>
      </div>
    </details>`;

  // ---- Tableau contrats (compact : 1 ligne par contrat, troncature + survol) ----
  const esc = (v) => String(v ?? '').replace(/"/g, '&quot;');
  const tableau = contrats.length > 0 ? `
    <div class="card-dark rounded-xl overflow-hidden">
      <div class="px-4 sm:px-5 py-3 border-b border-dark-400/30 flex items-center gap-2">
        <h3 class="text-sm font-bold text-gray-100">Mes contrats</h3>
        <span class="text-[10px] text-gray-600">${contrats.length}</span>
        <span class="ml-auto text-xs text-gray-500">Total primes : <span class="text-gray-200 font-semibold">${formatCurrencyCents(totalPrimes)}/an</span></span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-xs table-fixed min-w-[640px]">
          <thead class="bg-dark-800/50 text-gray-500 text-[10px] uppercase tracking-wide">
            <tr>
              <th class="px-3 py-2 text-left w-[24%]">Contrat</th>
              <th class="px-3 py-2 text-left w-[15%]">Assureur</th>
              <th class="px-3 py-2 text-left w-[21%]">Références</th>
              <th class="px-3 py-2 text-right w-[11%]">Prime</th>
              <th class="px-3 py-2 text-left w-[11%]">Échéance</th>
              <th class="px-3 py-2 text-left w-[14%]">Téléphone</th>
              <th class="px-2 py-2 w-[4%]"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-dark-400/15">
            ${contrats.map(c => {
              const t = TYPES_CONTRAT.find(x => x.value === c.type) || TYPES_CONTRAT[TYPES_CONTRAT.length - 1];
              const prime = Number(c.prime) || 0;
              return `
            <tr class="hover:bg-dark-600/20 transition cursor-pointer contrat-row" data-contrat-id="${c.id}">
              <td class="px-3 py-2">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${t.color}"></span>
                  <div class="min-w-0">
                    <p class="text-gray-200 font-medium truncate" title="${esc(c.nom)}">${c.nom || '(sans nom)'}</p>
                    <p class="text-[10px] text-gray-600 truncate">${t.label}</p>
                  </div>
                </div>
              </td>
              <td class="px-3 py-2 text-gray-300 truncate" title="${esc(c.assureur)}">${c.assureur || '—'}</td>
              <td class="px-3 py-2">
                <div class="flex items-center gap-1 min-w-0">
                  <span class="text-gray-300 truncate" title="${esc(c.numContrat)}">${c.numContrat || '—'}</span>
                  ${copyBtn(c.numContrat)}
                </div>
                ${c.numClient ? `<div class="flex items-center gap-1 min-w-0"><span class="text-[10px] text-gray-600 truncate" title="Client ${esc(c.numClient)}">client ${c.numClient}</span> ${copyBtn(c.numClient)}</div>` : ''}
              </td>
              <td class="px-3 py-2 text-right text-gray-200 whitespace-nowrap">${prime > 0 ? formatCurrencyCents(prime) + '/' + (c.primePeriode === 'mois' ? 'm' : 'an') : '—'}</td>
              <td class="px-3 py-2 text-gray-400 truncate" title="${esc(c.echeance)}">${c.echeance || '—'}</td>
              <td class="px-3 py-2 truncate">${c.telephone ? `<a href="tel:${c.telephone.replace(/\s/g, '')}" class="text-gray-300 hover:text-cyan-400 whitespace-nowrap">${c.telephone}</a>` : '—'}</td>
              <td class="px-2 py-2 text-right">
                <button data-del-contrat="${c.id}" class="text-gray-600 hover:text-accent-red transition px-1" title="Supprimer">✕</button>
              </td>
            </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <p class="px-4 py-1.5 text-[10px] text-gray-600 border-t border-dark-400/15">Clique sur une ligne pour voir ou corriger la fiche · survole une cellule tronquée pour lire le texte complet</p>
    </div>` : '';

  // ---- Encart urgences : qui appeler, par type de sinistre ----
  const urgencesBilan = bilan?.urgences || [];
  const urgencesContrats = contrats.filter(c => c.telAssistance || c.telephone);
  // Depuis les contrats : un numéro par situation (assistance sinistre en priorité)
  const telsVus = new Set(urgencesBilan.map(u => (u.tel || '').replace(/\s/g, '')));
  const situationsVues = new Set(urgencesBilan.map(u => normTxt(u.situation)));
  const urgencesDepuisContrats = urgencesContrats.map(c => ({
    situation: SINISTRE_PAR_TYPE[c.type] || `${c.nom || 'Sinistre'}`,
    contact: [c.assureur, c.nom].filter(Boolean).join(' — '),
    tel: c.telAssistance || c.telephone,
    note: c.numContrat ? `contrat ${c.numContrat}` : '',
    _edit: 'c' + c.id,
  })).filter(u => u.tel && !telsVus.has(u.tel.replace(/\s/g, '')) && !situationsVues.has(normTxt(u.situation)));
  const urgencesSinistre = [...urgencesBilan.map((u, i) => ({ ...u, _edit: 'b' + i })), ...urgencesDepuisContrats];
  const urgences = hasData ? `
    <div class="card-dark rounded-xl overflow-hidden">
      <div class="px-4 sm:px-5 py-3 border-b border-dark-400/30 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span class="text-base">🆘</span>
        <h3 class="text-sm font-bold text-gray-100">En cas de besoin</h3>
        <input id="urg-search" type="search" placeholder="incendie, vol, hôpital…" class="ml-auto w-36 sm:w-48 bg-dark-800/70 border border-dark-400/30 rounded-lg px-2.5 py-1 text-[11px] text-gray-300 placeholder-gray-600 focus:outline-none focus:border-cyan-500/40">
        <div class="flex gap-1">
          <button data-urg-tab="sinistre" class="urg-tab px-2.5 py-1 text-[11px] rounded-lg bg-cyan-500/20 text-cyan-400 font-medium transition">Par sinistre</button>
          <button data-urg-tab="contrat" class="urg-tab px-2.5 py-1 text-[11px] rounded-lg text-gray-500 hover:text-gray-300 transition">Par contrat</button>
        </div>
      </div>
      <div id="urg-panel-sinistre" class="px-4 sm:px-5 py-2 grid grid-cols-1 md:grid-cols-2 gap-x-10">
        ${urgencesSinistre.map(u => {
          const telOk = isTelReel(u.tel);
          const sousLigne = [u.contact, u.note, !telOk && u.tel ? u.tel : ''].filter(Boolean).join(' · ');
          return `
        <div class="urg-row flex items-center gap-3 py-2 border-b border-dark-400/10">
          <div class="flex-1 min-w-0">
            <p class="text-xs text-gray-200">${u.situation}</p>
            ${sousLigne ? `<p class="text-[10px] text-gray-600 leading-snug">${sousLigne}</p>` : ''}
          </div>
          ${telOk ? `<a href="tel:${u.tel.replace(/\s/g, '')}" class="text-xs font-semibold text-cyan-400/90 hover:text-cyan-300 whitespace-nowrap">${u.tel}</a>${copyBtn(u.tel)}` : ''}
          <button data-urg-edit="${u._edit}" title="Modifier cette ligne (numéro, consigne…)" class="text-gray-700 hover:text-cyan-400 transition text-[11px] px-0.5 flex-shrink-0">✎</button>
        </div>`;
        }).join('')}
        <p id="urg-vide" class="hidden text-[11px] text-gray-600 py-2 md:col-span-2">Aucune situation ne correspond à ta recherche.</p>
        ${urgencesSinistre.length === 0 ? `<p class="text-[11px] text-gray-600 py-2 md:col-span-2">Renseigne les téléphones de tes contrats (ou lance le bilan global) : chaque situation affichera ici qui appeler, avec le bon numéro et la référence du contrat.</p>` : ''}
      </div>
      <div id="urg-panel-contrat" class="hidden p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
        ${urgencesContrats.length > 0 ? urgencesContrats.map(c => `
        <div class="rounded-lg bg-dark-800/50 border border-dark-400/20 px-3 py-2.5">
          <p class="text-xs text-gray-200 font-medium">${c.nom || c.assureur}</p>
          <p class="text-[10px] text-gray-500 mt-0.5">Contrat ${c.numContrat || '—'} ${copyBtn(c.numContrat)} · Client ${c.numClient || '—'} ${copyBtn(c.numClient)}</p>
          <div class="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
            ${c.telephone ? `<span class="text-[11px] text-gray-400">Gestion : <a href="tel:${c.telephone.replace(/\s/g, '')}" class="text-cyan-400 font-semibold hover:text-cyan-300">${c.telephone}</a></span>` : ''}
            ${c.telAssistance ? `<span class="text-[11px] text-gray-400">Assistance : <a href="tel:${c.telAssistance.replace(/\s/g, '')}" class="text-cyan-400 font-semibold hover:text-cyan-300">${c.telAssistance}</a></span>` : ''}
          </div>
        </div>`).join('') : `<p class="text-[11px] text-gray-600 sm:col-span-2">Aucun téléphone enregistré sur tes contrats pour l'instant.</p>`}
      </div>
      <p class="px-4 sm:px-5 py-1.5 text-[10px] text-gray-600 border-t border-dark-400/15">Guide réflexe généré depuis tes contrats — il se met à jour à chaque import et à chaque nouveau bilan global.</p>
    </div>` : '';

  // ---- Bandeau haut compact : synthèse + carrousels conseils / doublons ----
  const fleche = (dir, nom) => `<button data-car-${dir}="${nom}" class="w-6 h-6 flex items-center justify-center rounded-lg border border-dark-400/30 text-gray-500 hover:text-gray-200 hover:bg-dark-600/60 transition text-sm leading-none">${dir === 'prev' ? '‹' : '›'}</button>`;
  const colSynthese = bilan?.synthese ? `
    <div class="card-dark rounded-xl p-4 flex flex-col">
      <p class="text-[10px] uppercase tracking-widest font-semibold text-gray-500 mb-2">📋 Synthèse</p>
      <p class="text-[11px] text-gray-300 leading-relaxed">${bilan.synthese}</p>
    </div>` : '';
  const colConseils = recos.length > 0 ? `
    <div class="card-dark rounded-xl p-4 flex flex-col">
      <div class="flex items-center justify-between mb-2">
        <p class="text-[10px] uppercase tracking-widest font-semibold text-gray-500">💡 Conseils</p>
        <div class="flex items-center gap-1.5">
          <span class="text-[10px] text-gray-600 tabular-nums" data-car-count="recos">1/${recos.length}</span>
          ${recos.length > 1 ? fleche('prev', 'recos') + fleche('next', 'recos') : ''}
        </div>
      </div>
      <div class="flex-1">
        ${recos.map((r, i) => `
        <div data-car-item="recos" class="relative h-full ${i > 0 ? 'hidden' : ''}">
          ${conseilCardHtml(
            { prio: r.priorite || 3, titre: r.titre, texte: r.texte + (r.prix ? ` (${r.prix})` : '') },
            { tag: 'button', attrs: `data-goto-domaine="${r.domaine}"`, extraClass: 'w-full h-full hover:border-dark-300/40 hover:bg-dark-700/60 transition-all pr-8' }
          )}
          <button data-dismiss-reco="${r.titre.replace(/"/g, '&quot;')}" title="Supprimer ce conseil" class="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded text-gray-600 hover:text-accent-red hover:bg-dark-600/60 transition text-xs">✕</button>
        </div>`).join('')}
      </div>
    </div>` : '';
  const colDoublons = doublons.length > 0 ? `
    <div class="card-dark rounded-xl p-4 flex flex-col">
      <div class="flex items-center justify-between mb-2">
        <p class="text-[10px] uppercase tracking-widest font-semibold text-purple-400">🔁 Doublon${doublons.length > 1 ? 's' : ''} détecté${doublons.length > 1 ? 's' : ''}</p>
        <div class="flex items-center gap-1.5">
          <span class="text-[10px] text-gray-600 tabular-nums" data-car-count="doublons">1/${doublons.length}</span>
          ${doublons.length > 1 ? fleche('prev', 'doublons') + fleche('next', 'doublons') : ''}
        </div>
      </div>
      <div class="flex-1">
        ${doublons.map((d, i) => `
        <div data-car-item="doublons" class="relative h-full rounded-xl bg-purple-500/10 border border-purple-500/25 px-3.5 py-3 ${i > 0 ? 'hidden' : ''}">
          <p class="text-xs font-semibold text-gray-200 pr-6">${d.titre}</p>
          <p class="text-[11px] text-gray-400 leading-relaxed mt-1">${d.texte}</p>
          <button data-dismiss-doublon="${d.titre.replace(/"/g, '&quot;')}" title="Supprimer" class="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded text-gray-600 hover:text-accent-red hover:bg-dark-600/60 transition text-xs">✕</button>
        </div>`).join('')}
      </div>
    </div>` : '';
  const colonnesHaut = [colSynthese, colConseils, colDoublons].filter(Boolean);
  const bandeauHaut = colonnesHaut.length > 0 ? `
      <div class="grid grid-cols-1 ${colonnesHaut.length > 1 ? 'lg:grid-cols-' + colonnesHaut.length : ''} gap-3 items-stretch">${colonnesHaut.join('')}</div>` : '';

  return `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 class="text-xl sm:text-2xl font-bold text-gray-100 flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
              </svg>
            </div>
            Contrats &amp; garanties
          </h2>
          <p class="text-gray-500 text-sm mt-1">Ta protection sur tous les fronts, expliquée simplement</p>
        </div>
        <button id="btn-config-domaines" class="px-3 py-1.5 bg-dark-600/60 border border-dark-400/40 text-gray-400 text-xs rounded-lg hover:bg-dark-600 hover:text-gray-200 transition self-start sm:self-auto">⚙️ Personnaliser les domaines</button>
      </div>

      ${bandeauHaut}

      ${hasData ? `
      <div class="card-dark rounded-xl p-4 sm:p-5">
        <div class="flex flex-col lg:flex-row gap-4 items-center">
          <div class="w-full lg:w-1/2" style="height:340px"><canvas id="protection-radar"></canvas></div>
          <div class="w-full lg:w-1/2 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            ${domainesActifs.map(d => {
              const data = domData[d.id];
              const active = selectedDomaineId === d.id;
              return `
            <button data-select-domaine="${d.id}" title="${(d.quoi || '').replace(/"/g, '&quot;')}" class="text-left rounded-lg px-2.5 py-2 border transition ${active ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-dark-400/20 bg-dark-800/40 hover:bg-dark-600/40'}">
              <p class="text-[11px] text-gray-300 truncate">${d.emoji} ${d.label}</p>
              <div class="flex items-center gap-1.5 mt-1">
                <div class="flex-1 h-1 rounded-full bg-dark-600/70 overflow-hidden"><div class="h-full rounded-full" style="width:${((data.note || 0) / 5) * 100}%;background:${scoreColor(data.note)}"></div></div>
                <span class="text-[10px] font-bold" style="color:${scoreColor(data.note)}">${data.note !== null ? Number(data.note).toFixed(1).replace('.', ',') : '—'}</span>
              </div>
            </button>`;
            }).join('')}
          </div>
        </div>
        <p class="text-[10px] text-gray-600 mt-2 text-center">Clique sur un domaine (radar ou pastille) pour ouvrir le détail poste par poste</p>
      </div>

      ${ficheDomaine()}
      ` : `
      <div class="card-dark rounded-xl p-8 text-center space-y-3">
        <p class="text-3xl">🕸️</p>
        <h3 class="text-base font-bold text-gray-100">Cartographie ta protection en 3 gestes</h3>
        <p class="text-sm text-gray-400 max-w-xl mx-auto leading-relaxed">Copie le prompt d'analyse, glisse le PDF d'un contrat dans claude.ai, colle le résultat ici. Horizon construit ton radar de protection, t'explique chaque garantie en français courant et te dit quoi améliorer. Aucun jargon à déchiffrer.</p>
      </div>`}

      ${assistant}
      ${tableau}
      ${urgences}
    </div>
  `;
}

// ============================================================
// MOUNT
// ============================================================
export function mount(store, navigate) {
  const cfg = getConfig(store);
  const domainesActifs = DOMAINES.filter(d => cfg.actifs[d.id]);

  // ---- Radar chart ----
  const bilanOuContrats = getContrats(store).length > 0 || !!getBilan(store);
  if (bilanOuContrats && document.getElementById('protection-radar')) {
    const scores = domainesActifs.map(d => {
      const data = computeDomaineData(store, d.id);
      return data.note === null ? 0 : data.note;
    });
    const pointColors = domainesActifs.map((d, i) => scoreColor(scores[i]));
    createChart('protection-radar', {
      type: 'radar',
      data: {
        labels: domainesActifs.map(d => d.label),
        datasets: [{
          label: 'Couverture',
          data: scores,
          backgroundColor: 'rgba(52, 211, 153, 0.12)',
          borderColor: 'rgba(52, 211, 153, 0.7)',
          borderWidth: 2,
          pointBackgroundColor: pointColors,
          pointBorderColor: pointColors,
          pointRadius: 4,
          pointHoverRadius: 6,
        }]
      },
      options: {
        interaction: { intersect: true, mode: 'nearest' },
        scales: {
          r: {
            min: 0, max: 5,
            ticks: { stepSize: 1, color: '#7a7a88', backdropColor: 'transparent', font: { size: 9 } },
            grid: { color: 'rgba(72, 72, 82, 0.35)' },
            angleLines: { color: 'rgba(72, 72, 82, 0.35)' },
            pointLabels: { color: '#e5e7eb', font: { size: 10, family: 'Inter' } }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const d = domainesActifs[ctx.dataIndex];
                const data = computeDomaineData(store, d.id);
                const lines = [` ${Number(ctx.raw).toFixed(1).replace('.', ',')}/5 — ${scoreLabel(data.note)}`];
                data.postes.slice(0, 3).forEach(p => lines.push(` • ${p.label || p.poste} : ${p.note !== null && !isNaN(p.note) ? Math.round(p.note) + '/5' : '—'}`));
                return lines;
              }
            }
          }
        },
        onClick: (evt, elements) => {
          if (elements && elements.length > 0) {
            const d = domainesActifs[elements[0].index];
            if (d) { selectedDomaineId = selectedDomaineId === d.id ? null : d.id; navigate('contrats'); }
          }
        }
      }
    });
  }

  // ---- Sélection de domaine (pastilles + recos) ----
  document.querySelectorAll('[data-select-domaine]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.selectDomaine;
      selectedDomaineId = selectedDomaineId === id ? null : id;
      navigate('contrats');
    });
  });
  // Réinitialisation globale : repartir de zéro (contrats + bilan + radar)
  document.getElementById('btn-reset-protection')?.addEventListener('click', () => {
    const nb = (store.get('contrats') || []).length;
    confirmModal('Tout réinitialiser ?', `Les ${nb} contrat${nb > 1 ? 's' : ''}, le bilan, le radar et les recommandations seront effacés. Tu repartiras d'une page vierge pour ré-importer proprement.`, () => {
      store.set('contrats', []);
      store.set('protectionBilan', null);
      showToast('Page réinitialisée — tu peux ré-importer tes contrats', 'success', 3500);
      navigate('contrats');
    }, { okLabel: 'Tout effacer' });
  });

  // Supprimer un conseil ou un doublon (réapparaîtra si un prochain bilan le régénère)
  document.querySelectorAll('[data-dismiss-reco]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const bilanNow = store.get('protectionBilan');
      if (!bilanNow) return;
      confirmModal('Supprimer ce conseil ?', 'Il disparaîtra aussi du Conseiller Horizon. Un prochain bilan global pourra le régénérer.', () => {
        bilanNow.recos = (bilanNow.recos || []).filter(r => r.titre !== btn.dataset.dismissReco);
        store.set('protectionBilan', bilanNow);
        showToast('Conseil supprimé', 'success', 2000);
        navigate('contrats');
      });
    });
  });
  document.querySelectorAll('[data-dismiss-doublon]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const bilanNow = store.get('protectionBilan');
      if (!bilanNow) return;
      confirmModal('Supprimer ce doublon signalé ?', 'Un prochain bilan global pourra le régénérer.', () => {
        bilanNow.doublons = (bilanNow.doublons || []).filter(d => d.titre !== btn.dataset.dismissDoublon);
        store.set('protectionBilan', bilanNow);
        showToast('Doublon supprimé', 'success', 2000);
        navigate('contrats');
      });
    });
  });

  document.querySelectorAll('[data-goto-domaine]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedDomaineId = btn.dataset.gotoDomaine;
      navigate('contrats');
      setTimeout(() => document.getElementById('fiche-domaine')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    });
  });
  document.getElementById('fiche-close')?.addEventListener('click', () => {
    selectedDomaineId = null;
    navigate('contrats');
  });

  // ---- Postes (dépliants) ----
  document.querySelectorAll('[data-poste-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.posteToggle;
      const panel = document.querySelector(`[data-poste-panel="${key}"]`);
      const chevron = document.querySelector(`[data-poste-chevron="${key}"]`);
      if (panel) panel.classList.toggle('hidden');
      if (chevron) chevron.style.transform = panel && !panel.classList.contains('hidden') ? 'rotate(180deg)' : '';
    });
  });

  // ---- « Non concerné » : exclure / réintégrer un poste de la pondération ----
  document.querySelectorAll('[data-poste-exclure]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cle = btn.dataset.posteExclure;
      const cfgNow = getConfig(store);
      const horsScope = { ...cfgNow.horsScope };
      const exclure = !horsScope[cle];
      if (exclure) horsScope[cle] = true; else delete horsScope[cle];
      store.set('protectionConfig', { actifs: cfgNow.actifs, horsScope });
      showToast(exclure ? 'Poste exclu de la note ✓' : 'Poste réintégré dans la note ✓', 'success', 2000);
      navigate('contrats');
    });
  });

  // ---- Copie (numéros, téléphones) ----
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = btn.dataset.copy;
      navigator.clipboard?.writeText(val).then(() => {
        btn.classList.add('text-emerald-400');
        setTimeout(() => btn.classList.remove('text-emerald-400'), 900);
      });
    });
  });

  // ---- Onglets urgences ----
  document.querySelectorAll('.urg-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const which = tab.dataset.urgTab;
      document.getElementById('urg-panel-sinistre')?.classList.toggle('hidden', which !== 'sinistre');
      document.getElementById('urg-panel-contrat')?.classList.toggle('hidden', which !== 'contrat');
      document.querySelectorAll('.urg-tab').forEach(t => {
        const on = t.dataset.urgTab === which;
        t.classList.toggle('bg-cyan-500/20', on);
        t.classList.toggle('text-cyan-400', on);
        t.classList.toggle('font-medium', on);
        t.classList.toggle('text-gray-500', !on);
      });
    });
  });

  // ---- Carrousels conseils / doublons (bandeau haut) ----
  ['recos', 'doublons'].forEach(nom => {
    const items = Array.from(document.querySelectorAll(`[data-car-item="${nom}"]`));
    if (items.length <= 1) return;
    let idx = 0;
    const compteur = document.querySelector(`[data-car-count="${nom}"]`);
    const montre = () => {
      items.forEach((el, i) => el.classList.toggle('hidden', i !== idx));
      if (compteur) compteur.textContent = `${idx + 1}/${items.length}`;
    };
    document.querySelector(`[data-car-prev="${nom}"]`)?.addEventListener('click', () => { idx = (idx - 1 + items.length) % items.length; montre(); });
    document.querySelector(`[data-car-next="${nom}"]`)?.addEventListener('click', () => { idx = (idx + 1) % items.length; montre(); });
  });

  // ---- Édition d'une ligne du guide réflexe ----
  document.querySelectorAll('[data-urg-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.urgEdit;
      let entree = null;
      if (key.startsWith('b')) {
        entree = (store.get('protectionBilan')?.urgences || [])[Number(key.slice(1))];
      } else {
        const c = getContrats(store).find(x => x.id === key.slice(1));
        if (c) entree = {
          situation: SINISTRE_PAR_TYPE[c.type] || c.nom || 'Sinistre',
          contact: [c.assureur, c.nom].filter(Boolean).join(' — '),
          tel: c.telAssistance || c.telephone || '',
          note: c.numContrat ? `contrat ${c.numContrat}` : '',
        };
      }
      if (!entree) return;
      const esc2 = (v) => String(v ?? '').replace(/"/g, '&quot;');
      const telActuel = isTelReel(entree.tel) ? entree.tel : '';
      // Une consigne logée dans le champ tel bascule dans la consigne, pour ne rien perdre
      const noteActuelle = [entree.note, !telActuel && entree.tel ? entree.tel : ''].filter(Boolean).join(' · ');
      const body = `
        <div class="space-y-3">
          <div><label class="block text-xs text-gray-400 mb-1">Situation</label>
            <input id="urg-e-situation" type="text" value="${esc2(entree.situation)}" class="w-full px-3 py-2 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 text-sm focus:ring-2 focus:ring-cyan-500/40"></div>
          <div><label class="block text-xs text-gray-400 mb-1">Qui contacter</label>
            <input id="urg-e-contact" type="text" value="${esc2(entree.contact)}" class="w-full px-3 py-2 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 text-sm focus:ring-2 focus:ring-cyan-500/40"></div>
          <div><label class="block text-xs text-gray-400 mb-1">Numéro de téléphone</label>
            <input id="urg-e-tel" type="tel" inputmode="tel" value="${esc2(telActuel)}" placeholder="01 23 45 67 89" class="w-full px-3 py-2 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 text-sm focus:ring-2 focus:ring-cyan-500/40"></div>
          <div><label class="block text-xs text-gray-400 mb-1">Consigne / n° de contrat</label>
            <input id="urg-e-note" type="text" value="${esc2(noteActuelle)}" class="w-full px-3 py-2 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 text-sm focus:ring-2 focus:ring-cyan-500/40"></div>
          <p class="text-[10px] text-gray-600">Tes modifications sont conservées, y compris quand un nouveau bilan est importé.</p>
        </div>`;
      openModal('Modifier cette ligne', body, () => {
        const val = (id) => document.getElementById(id)?.value.trim() || '';
        const maj = { situation: val('urg-e-situation'), contact: val('urg-e-contact'), tel: val('urg-e-tel'), note: val('urg-e-note'), manuel: true };
        if (!maj.situation) { showModalError('La situation ne peut pas être vide.'); return false; }
        if (maj.tel && !isTelReel(maj.tel)) { showModalError('Le champ numéro doit contenir un numéro de téléphone (les consignes vont dans le champ consigne).'); return false; }
        const bilanNow = store.get('protectionBilan') || {};
        bilanNow.urgences = bilanNow.urgences || [];
        if (key.startsWith('b')) bilanNow.urgences[Number(key.slice(1))] = maj;
        else bilanNow.urgences.push(maj);
        store.set('protectionBilan', bilanNow);
        showToast('Ligne mise à jour ✓', 'success', 2000);
        navigate('contrats');
      });
    });
  });

  // ---- Recherche dans le guide réflexe ----
  const urgSearch = document.getElementById('urg-search');
  urgSearch?.addEventListener('input', () => {
    const q = urgSearch.value.trim().toLowerCase();
    let visibles = 0;
    document.querySelectorAll('#urg-panel-sinistre .urg-row').forEach(row => {
      const ok = !q || row.textContent.toLowerCase().includes(q);
      row.classList.toggle('hidden', !ok);
      if (ok) visibles++;
    });
    document.getElementById('urg-vide')?.classList.toggle('hidden', visibles > 0 || !q);
  });

  // ---- Copier les prompts ----
  const copyPrompt = (btn, text) => {
    navigator.clipboard?.writeText(text).then(() => {
      const old = btn.textContent;
      btn.textContent = '✓ Copié ! Ouvre claude.ai';
      setTimeout(() => { btn.textContent = old; }, 2500);
    });
  };
  document.getElementById('btn-copy-prompt-contrat')?.addEventListener('click', (e) => copyPrompt(e.currentTarget, buildPromptContrat()));
  document.getElementById('btn-copy-prompt-bilan')?.addEventListener('click', (e) => copyPrompt(e.currentTarget, buildPromptBilan(store)));

  // ---- Import résultat contrat ----
  document.getElementById('btn-import-contrat')?.addEventListener('click', () => {
    const body = `
      <p class="text-xs text-gray-400 mb-2">Colle ici la réponse complète de claude.ai (le bloc JSON) :</p>
      <textarea id="import-json" rows="10" class="w-full px-3 py-2 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 text-xs font-mono focus:ring-2 focus:ring-emerald-500/40" placeholder='{ "nom": "...", ... }'></textarea>
      <div id="import-preview" class="mt-2 text-xs"></div>
    `;
    // Upsert : un contrat déjà connu (même n° de contrat, ou même nom + assureur)
    // est MIS À JOUR au lieu d'être dupliqué
    const upsertContrat = (liste, data) => {
      data.garanties = Array.isArray(data.garanties) ? data.garanties : [];
      const norm = (v) => (v || '').toString().trim().toLowerCase();
      const existant = liste.find(c =>
        (norm(c.numContrat) && norm(c.numContrat) === norm(data.numContrat)) ||
        (norm(c.nom) && norm(c.nom) === norm(data.nom) && norm(c.assureur) === norm(data.assureur))
      );
      if (existant) { Object.assign(existant, data, { id: existant.id }); return 'maj'; }
      data.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      liste.push(data);
      return 'ajout';
    };
    const modal = openModal('Importer l\'analyse', body, () => {
      const ta = document.getElementById('import-json');
      try {
        const data = parseColleJSON(ta.value);
        const items = Array.isArray(data.contrats) ? data.contrats : [data];
        const valides = items.filter(c => c && (c.nom || c.assureur));
        if (valides.length === 0) throw new Error('nom/assureur manquants');
        const contrats = getContrats(store);
        let nbAjout = 0, nbMaj = 0;
        valides.forEach(c => { upsertContrat(contrats, c) === 'maj' ? nbMaj++ : nbAjout++; });
        store.set('contrats', contrats);
        const parts = [];
        if (nbAjout > 0) parts.push(`${nbAjout} contrat${nbAjout > 1 ? 's' : ''} ajouté${nbAjout > 1 ? 's' : ''}`);
        if (nbMaj > 0) parts.push(`${nbMaj} mis à jour`);
        showToast(parts.join(' · ') + ' ✓ — pense à relancer le bilan global', 'success', 4000);
        navigate('contrats');
      } catch (err) {
        showModalError('Impossible de lire ce bloc : vérifie que tu as bien collé la réponse JSON complète de claude.ai. (' + err.message + ')');
        return false;
      }
    });
    // Aperçu live
    modal.querySelector('#import-json')?.addEventListener('input', (e) => {
      const prev = modal.querySelector('#import-preview');
      try {
        const d = parseColleJSON(e.target.value);
        const items = Array.isArray(d.contrats) ? d.contrats : [d];
        prev.innerHTML = `<div class="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-emerald-300">✓ ${items.length} contrat${items.length > 1 ? 's' : ''} détecté${items.length > 1 ? 's' : ''} : ${items.map(c => `<b>${c.nom || c.assureur || '?'}</b>`).join(', ')} — ${items.reduce((n, c) => n + ((c.garanties || []).length), 0)} garantie(s)</div>`;
      } catch { prev.innerHTML = e.target.value.trim() ? '<p class="text-gray-600">En attente d\'un bloc JSON valide…</p>' : ''; }
    });
  });

  // ---- Import bilan global ----
  document.getElementById('btn-import-bilan')?.addEventListener('click', () => {
    const body = `
      <p class="text-xs text-gray-400 mb-2">Colle ici la réponse complète de claude.ai (le bloc JSON du bilan) :</p>
      <textarea id="import-bilan-json" rows="10" class="w-full px-3 py-2 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 text-xs font-mono focus:ring-2 focus:ring-purple-500/40" placeholder='{ "synthese": "...", "scores": { ... } }'></textarea>
      <div id="import-bilan-preview" class="mt-2 text-xs"></div>
    `;
    const modal = openModal('Importer le bilan global', body, () => {
      const ta = document.getElementById('import-bilan-json');
      try {
        const data = parseColleJSON(ta.value);
        if (!data.scores) throw new Error('scores manquants');
        data.date = new Date().toLocaleDateString('fr-FR');
        // Les lignes du guide réflexe éditées à la main survivent au nouveau bilan :
        // numéro reporté sur la ligne équivalente, lignes sans équivalent conservées.
        const manuels = (store.get('protectionBilan')?.urgences || []).filter(u => u.manuel);
        if (manuels.length) {
          data.urgences = Array.isArray(data.urgences) ? data.urgences : [];
          manuels.forEach(m => {
            const cible = data.urgences.find(u => normTxt(u.situation) === normTxt(m.situation) ||
              (normTxt(u.contact) && normTxt(u.contact) === normTxt(m.contact)));
            if (cible) {
              if (!isTelReel(cible.tel) && isTelReel(m.tel)) { cible.tel = m.tel; cible.manuel = true; }
            } else {
              data.urgences.push(m);
            }
          });
        }
        store.set('protectionBilan', data);
        selectedDomaineId = null;
        showToast('Bilan de protection importé ✓', 'success', 3000);
        navigate('contrats');
      } catch (err) {
        showModalError('Impossible de lire ce bloc : vérifie que tu as bien collé la réponse JSON complète. (' + err.message + ')');
        return false;
      }
    });
    modal.querySelector('#import-bilan-json')?.addEventListener('input', (e) => {
      const prev = modal.querySelector('#import-bilan-preview');
      try {
        const d = parseColleJSON(e.target.value);
        const n = Object.keys(d.scores || {}).length;
        prev.innerHTML = `<div class="rounded-lg bg-purple-500/10 border border-purple-500/30 px-3 py-2 text-purple-300">✓ Bilan : ${n} domaine(s) noté(s), ${(d.recos || []).length} reco(s), ${(d.doublons || []).length} doublon(s)</div>`;
      } catch { prev.innerHTML = e.target.value.trim() ? '<p class="text-gray-600">En attente d\'un bloc JSON valide…</p>' : ''; }
    });
  });

  // ---- CRUD manuel contrat ----
  const openContratModal = (existing = null) => {
    const body = `
      ${inputField('nom', 'Nom du contrat', existing?.nom || '', 'text', 'placeholder="Ex: MRH maison"')}
      ${selectField('type', 'Type', TYPES_CONTRAT, existing?.type || 'autre')}
      ${inputField('assureur', 'Assureur', existing?.assureur || '', 'text', 'placeholder="Ex: Groupama"')}
      <div class="grid grid-cols-2 gap-2">
        <div>${inputField('numContrat', 'N° contrat', existing?.numContrat || '')}</div>
        <div>${inputField('numClient', 'N° client', existing?.numClient || '')}</div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>${inputField('prime', 'Prime (€)', existing?.prime || '', 'number', 'step="0.01"')}</div>
        <div>${selectField('primePeriode', 'Période', [{ value: 'an', label: 'Par an' }, { value: 'mois', label: 'Par mois' }], existing?.primePeriode || 'an')}</div>
      </div>
      ${inputField('echeance', 'Échéance / date anniversaire', existing?.echeance || '', 'text', 'placeholder="Ex: 1er janvier"')}
      <div class="grid grid-cols-2 gap-2">
        <div>${inputField('telephone', 'Tél. gestion', existing?.telephone || '')}</div>
        <div>${inputField('telAssistance', 'Tél. assistance 24h/24', existing?.telAssistance || '')}</div>
      </div>
    `;
    openModal(existing ? 'Modifier le contrat' : 'Ajouter un contrat', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      const contrats = getContrats(store);
      if (existing) {
        const c = contrats.find(x => x.id === existing.id);
        if (c) Object.assign(c, data);
      } else {
        data.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        data.garanties = [];
        contrats.push(data);
      }
      store.set('contrats', contrats);
      navigate('contrats');
    });
  };
  document.getElementById('btn-add-contrat-manuel')?.addEventListener('click', () => openContratModal());
  document.querySelectorAll('.contrat-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('a')) return;
      const c = getContrats(store).find(x => x.id === row.dataset.contratId);
      if (c) openContratModal(c);
    });
  });
  document.querySelectorAll('[data-del-contrat]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const c = getContrats(store).find(x => x.id === btn.dataset.delContrat);
      if (c) confirmModal(`Supprimer le contrat « ${c.nom || c.assureur} » ?`, 'Ses garanties disparaîtront du radar au prochain bilan.', () => {
        store.set('contrats', getContrats(store).filter(x => x.id !== btn.dataset.delContrat));
        showToast('Contrat supprimé', 'success', 2500);
        navigate('contrats');
      });
    });
  });

  // ---- Personnaliser les domaines ----
  document.getElementById('btn-config-domaines')?.addEventListener('click', () => {
    const cfgNow = getConfig(store);
    const body = `
      <p class="text-xs text-gray-400 mb-3">Coche les domaines qui te concernent : les autres disparaissent du radar et des recommandations. Chaque utilisateur a sa propre configuration.</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        ${DOMAINES.map(d => `
        <label class="flex items-start gap-2 cursor-pointer rounded-lg border border-dark-400/30 bg-dark-800 px-3 py-2 hover:border-cyan-500/40 transition has-[:checked]:border-cyan-500/50 has-[:checked]:bg-cyan-500/5">
          <input type="checkbox" name="dom-${d.id}" ${cfgNow.actifs[d.id] ? 'checked' : ''} class="w-3.5 h-3.5 mt-0.5 rounded border-dark-400 bg-dark-900 text-cyan-500 focus:ring-cyan-500/40">
          <span class="min-w-0">
            <span class="block text-xs text-gray-200">${d.emoji} ${d.label}</span>
            ${d.quoi ? `<span class="block text-[10px] text-gray-600 leading-snug mt-0.5">${d.quoi}</span>` : ''}
          </span>
        </label>`).join('')}
      </div>
    `;
    openModal('Personnaliser les domaines', body, () => {
      const actifs = {};
      DOMAINES.forEach(d => {
        const cb = document.querySelector(`#modal-body input[name="dom-${d.id}"]`);
        actifs[d.id] = cb ? cb.checked : d.defaultOn;
      });
      store.set('protectionConfig', { actifs, horsScope: getConfig(store).horsScope });
      navigate('contrats');
    });
  });
}
