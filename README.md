# Cap — suivi personnel

Application discrète de suivi d'abstinence : jours tenus, craquages (avec
sous-catégories) et rapports avec ta compagne, sur un calendrier continu,
avec compteur de série en cours et statistiques.

## Fonctionnalités

- Compteur de **série en cours** et **meilleure série**, calculé en jours
  depuis le dernier craquage (un rapport avec ta compagne ne casse pas la
  série par défaut — réglable).
- Saisie rapide en un tap pour la journée en cours (craquage sans
  stimulation / avec lecture érotique / avec porno / rapport avec ta
  compagne) — un second tap sur le même bouton annule la saisie.
- Calendrier continu, navigable sans limite de mois, coloré par type de
  journée.
- Édition ou suppression de n'importe quel jour passé, avec une note
  privée optionnelle (contexte, déclencheur...).
- Statistiques : jours suivis, taux de jours tenus, répartition des
  craquages par type.
- Historique complet, modifiable.
- **Code d'accès à 4 chiffres** pour verrouiller l'ouverture de l'app.
- Nom et icône volontairement neutres (« Cap ») pour rester discret sur
  l'écran d'accueil.
- Export / import JSON (sauvegarde manuelle).
- Installable en PWA, fonctionne hors-ligne.
- Mode sombre.

## Confidentialité — important

- Aucun serveur : tout reste en `localStorage`, dans ce navigateur
  uniquement.
- Le **code d'accès à 4 chiffres est un simple frein visuel**, pas un
  vrai chiffrement. Quelqu'un qui ouvrirait les outils de développement
  du navigateur pourrait techniquement lire les données stockées. C'est
  suffisant pour décourager un coup d'œil rapide sur ton téléphone, pas
  pour une confidentialité forte.
- Pense à exporter une sauvegarde de temps en temps (bouton ⇩) : vider
  les données du navigateur efface tout.
- Si tu veux renforcer la discrétion, tu peux renommer l'app après
  installation sur l'écran d'accueil de ton téléphone (appui long sur
  l'icône → renommer, selon l'OS), ou changer le nom dans
  `manifest.webmanifest` avant de déployer.

## Déploiement sur GitHub Pages

1. Créez un nouveau dépôt GitHub (idéalement privé, vu le sujet — Réglages
   du dépôt → visibilité).
2. **Déposez tous les fichiers en une seule fois**, en conservant la
   structure ci-dessous. Le plus fiable est d'utiliser Git en ligne de
   commande plutôt que de créer les fichiers un par un dans l'interface
   web de GitHub (créer/coller fichier par fichier peut mélanger le
   contenu entre fichiers si le presse-papier n'est pas resynchronisé à
   chaque copier-coller) :
   ```bash
   git init
   git add .
   git commit -m "Première version de Cap"
   git branch -M main
   git remote add origin https://github.com/<votre-utilisateur>/<votre-repo>.git
   git push -u origin main
   ```
   Si vous préférez l'interface web, utilisez **« Add file » → « Upload
   files »** et glissez-déposez tous les fichiers et le dossier `icons/`
   d'un coup (pas un par un), pour que chaque fichier garde bien son nom
   et son contenu d'origine.
3. Structure attendue :
   ```
   cap/
   ├── index.html
   ├── style.css
   ├── app.js
   ├── manifest.webmanifest
   ├── sw.js
   ├── icons/
   │   ├── icon.svg
   │   ├── icon-192.png
   │   ├── icon-512.png
   │   └── icon-maskable-512.png
   └── README.md
   ```
4. **Settings → Pages → Build and deployment → Source** : `Deploy from a
   branch`, branche `main`, dossier `/ (root)`.
5. L'application sera disponible à :
   `https://<votre-utilisateur>.github.io/<votre-repo>/`
6. Sur votre téléphone, ouvrez ce lien puis « Ajouter à l'écran
   d'accueil » pour l'installer comme une app.
7. Ouvrez l'app, allez dans **Réglages → Définir le code**, et fixez la
   **date de début du suivi** (par défaut, aujourd'hui).

## Comment fonctionne le calcul

- La **série en cours** compte les jours depuis le dernier craquage
  enregistré (ou depuis la date de début du suivi, si aucun craquage
  n'a encore été noté).
- Un **rapport avec ta compagne** est enregistré comme une catégorie à
  part et n'interrompt pas la série par défaut. Tu peux changer ce
  comportement dans Réglages si tu préfères qu'il la remette à zéro
  aussi.
- La **meilleure série** est recalculée à partir de l'historique complet
  à chaque changement — elle prend le plus grand écart entre deux
  craquages (ou entre le début du suivi et le premier craquage).
- Le calendrier n'a pas de limite de mois affichables : les mois futurs
  et passés sont simplement affichés à la demande.

## Idées d'améliorations futures

- Rappels/notifications à heure fixe pour encourager une saisie
  régulière (nécessiterait des notifications push, donc un petit
  backend).
- Graphique d'évolution de la fréquence des craquages dans le temps.
- Identification de motifs à partir des notes (heure, jour de la
  semaine, contexte) pour repérer des déclencheurs récurrents.
- Verrouillage biométrique (empreinte/Face ID) si l'app est empaquetée
  nativement plutôt qu'en PWA.
