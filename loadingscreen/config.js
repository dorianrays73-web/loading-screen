/*
 * Configuration du loading screen.
 * Modifie uniquement ce fichier pour personnaliser l'écran.
 */
var CONFIG = {
  // Durée de chaque monde avant la bascule (ms)
  slayerDuration: 11000,
  demonDuration: 9000,

  // Personnages : PNG détourés (fond transparent), placés dans le dossier images/
  // Un seul à la fois, un différent à chaque retour dans le monde.
  // color / effect : Souffle du personnage (couleur de la barre et du contour lumineux)
  // height : taille à l'écran en fraction de la hauteur (0.8 = 80 %)
  // x : position horizontale (0 = gauche, 1 = droite), lift : décollage du sol (personnage en lévitation)
  characters: {
    slayer: [
      { src: "images/muichiro.png", color: "#9fe3dc", effect: "mist", height: 0.82 },
      { src: "images/rengoku.png", color: "#ff6a1f", effect: "flame", height: 0.84 },
      { src: "images/mitsuri.png", color: "#ff7eb8", effect: "love", height: 0.8 }
    ],
    demon: [
      { src: "images/akaza.png", height: 0.78 },
      { src: "images/douma.png", height: 0.84 },
      { src: "images/rui.png", height: 0.6, x: 0.26, lift: 0.1 }
    ]
  },

  // Musique par monde (fondu enchaîné à chaque bascule). Laisse "" pour aucune.
  // Avec une seule musique, elle joue en continu sur les deux mondes.
  // Le volume respecte le réglage du joueur dans GMod.
  music: {
    slayer: "music/infinity_train.mp3",
    demon: ""
  },
  musicVolume: 0.45,

  // Couleur de la lame dans le monde des démons
  demonColor: "#d1102e",

  // Couleurs des Souffles, une par passage dans le monde des Pourfendeurs
  // effect : flame (braises) | mist (brume dense) | love (pétales roses) | none (lucioles)
  breathingStyles: [
    { color: "#3fa9f5", effect: "water" },
    { color: "#ff6a1f", effect: "flame" },
    { color: "#ffd23f", effect: "thunder" },
    { color: "#9fe3dc", effect: "mist" },
    { color: "#b57cff", effect: "none" },
    { color: "#ff3b2a", effect: "sun" }
  ]
};
