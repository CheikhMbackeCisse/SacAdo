// Décodage défensif des entités HTML restées littérales dans un texte importé
// (ex. "d&rsquo;activités", "&#8211;") — voir maj-26-09/PROMPT §3. Couvre les
// entités nommées les plus courantes en français + toute entité numérique
// (décimale ou hexadécimale). Utilisé par les scripts d'import ET par la
// correction ponctuelle du catalogue existant.
const ENTITES_NOMMEES = {
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  amp: "&", nbsp: " ", eacute: "é", egrave: "è", ecirc: "ê", euml: "ë",
  agrave: "à", acirc: "â", ccedil: "ç", ocirc: "ô", ucirc: "û", ugrave: "ù",
  icirc: "î", iuml: "ï", hellip: "…", deg: "°", mdash: "—", ndash: "–",
  quot: '"', apos: "'", lt: "<", gt: ">",
};

export function decoderEntitesHtml(texte) {
  if (!texte) return texte;
  return texte
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, nom) => ENTITES_NOMMEES[nom] ?? m);
}
