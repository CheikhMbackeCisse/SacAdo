import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { EDITEUR } from "@/lib/legal";
import { TAUX_TVA, numeroFacture } from "@/lib/factures/config";
import type { DonneesFacture } from "@/lib/factures/data";

// lib/format.ts (formatPrice) utilise l'espace fine insécable de
// Intl/toLocaleString("fr-FR") pour séparer les milliers — glyphe absent des
// polices de base (Helvetica) intégrées par @react-pdf/renderer, ce qui
// l'affiche comme un caractère cassé ("1/500" au lieu de "1 500"). On formate
// donc les montants ici avec une espace normale, réservé au PDF.
function formatPrice(amount: number): string {
  const entier = Math.round(amount);
  return `${Math.abs(entier).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA`;
}

// SacAdo — Facture PDF (MODULE_FACTURES.md §2). Sobre, noir sur blanc, aucune
// couleur superflue. Le taux de TVA (lib/factures/config.ts) est null en v1 :
// dès qu'il sera renseigné, la ligne HT/TVA/TTC apparaît automatiquement, sans
// toucher à cette mise en page.

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: "#000000", fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  entiteNom: { fontSize: 14, fontWeight: 700 },
  entiteLigne: { fontSize: 9, color: "#333333" },
  factureTitre: { fontSize: 16, fontWeight: 700, textAlign: "right" },
  factureLigne: { fontSize: 9, textAlign: "right", color: "#333333" },
  section: { marginBottom: 16 },
  sectionTitre: { fontSize: 9, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", color: "#555555" },
  table: { marginTop: 8, borderTop: "1pt solid #000000" },
  tr: { flexDirection: "row", borderBottom: "0.5pt solid #cccccc", paddingVertical: 5 },
  trTete: { flexDirection: "row", borderBottom: "1pt solid #000000", paddingVertical: 5, fontWeight: 700 },
  colArticle: { width: "46%" },
  colQte: { width: "12%", textAlign: "right" },
  colPu: { width: "21%", textAlign: "right" },
  colTotal: { width: "21%", textAlign: "right" },
  varianteLabel: { fontSize: 8, color: "#666666" },
  totaux: { marginTop: 12, alignItems: "flex-end" },
  totalLigne: { flexDirection: "row", justifyContent: "space-between", width: 200, marginBottom: 2 },
  totalLibelle: { color: "#333333" },
  totalGeneral: { flexDirection: "row", justifyContent: "space-between", width: 200, marginTop: 4, paddingTop: 4, borderTop: "1pt solid #000000", fontWeight: 700, fontSize: 12 },
  code: { marginTop: 28, padding: 10, border: "1pt solid #000000" },
  codeTitre: { fontSize: 9, fontWeight: 700, marginBottom: 2 },
  codeValeur: { fontSize: 18, fontWeight: 700, letterSpacing: 4 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: "#666666", textAlign: "center" },
});

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Africa/Dakar",
  });
}

const LIBELLE_PAIEMENT: Record<string, string> = {
  wave: "Wave (payé en ligne)",
  livraison: "À la livraison",
};

export function FactureDocument({ donnees }: { donnees: DonneesFacture }) {
  const { commande, lignes } = donnees;
  const totalHT = lignes.reduce((s, l) => s + l.sousTotal, 0);
  const tva = TAUX_TVA != null ? Math.round(totalHT * TAUX_TVA) : 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.entiteNom}>{EDITEUR.raisonSociale}</Text>
            <Text style={styles.entiteLigne}>{EDITEUR.formeJuridique}</Text>
            {EDITEUR.ninea && <Text style={styles.entiteLigne}>NINEA : {EDITEUR.ninea}</Text>}
            {EDITEUR.rccm && <Text style={styles.entiteLigne}>RCCM : {EDITEUR.rccm}</Text>}
            <Text style={styles.entiteLigne}>{EDITEUR.localisation}</Text>
            <Text style={styles.entiteLigne}>{EDITEUR.telephone} · {EDITEUR.email}</Text>
          </View>
          <View>
            <Text style={styles.factureTitre}>FACTURE</Text>
            <Text style={styles.factureLigne}>N° {numeroFacture(donnees.factureId)}</Text>
            <Text style={styles.factureLigne}>Commande #{commande.id}</Text>
            <Text style={styles.factureLigne}>Date : {formatDate(donnees.dateEmission)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitre}>Client</Text>
          <Text>{donnees.clientNom}</Text>
          <Text style={styles.entiteLigne}>{donnees.clientTelephone}</Text>
          <Text style={styles.entiteLigne}>
            {commande.localite_nom ?? ""}
            {commande.adresse ? ` — ${commande.adresse}` : ""}
          </Text>
        </View>

        <View style={styles.table}>
          <View style={styles.trTete}>
            <Text style={styles.colArticle}>Article</Text>
            <Text style={styles.colQte}>Qté</Text>
            <Text style={styles.colPu}>Prix unitaire</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          {lignes.map((ligne, i) => (
            <View key={i} style={styles.tr}>
              <View style={styles.colArticle}>
                <Text>{ligne.produitNom}</Text>
                {ligne.varianteLabel && <Text style={styles.varianteLabel}>{ligne.varianteLabel}</Text>}
              </View>
              <Text style={styles.colQte}>{ligne.quantite}</Text>
              <Text style={styles.colPu}>{formatPrice(ligne.prixUnitaire)}</Text>
              <Text style={styles.colTotal}>{formatPrice(ligne.sousTotal)}</Text>
            </View>
          ))}
          <View style={styles.tr}>
            <View style={styles.colArticle}>
              <Text>Livraison</Text>
            </View>
            <Text style={styles.colQte} />
            <Text style={styles.colPu} />
            <Text style={styles.colTotal}>
              {commande.frais_livraison_a_confirmer ? "À confirmer" : formatPrice(commande.frais_livraison)}
            </Text>
          </View>
        </View>

        <View style={styles.totaux}>
          {TAUX_TVA != null ? (
            <>
              <View style={styles.totalLigne}>
                <Text style={styles.totalLibelle}>Total HT</Text>
                <Text>{formatPrice(totalHT)}</Text>
              </View>
              <View style={styles.totalLigne}>
                <Text style={styles.totalLibelle}>TVA ({Math.round(TAUX_TVA * 100)}%)</Text>
                <Text>{formatPrice(tva)}</Text>
              </View>
            </>
          ) : null}
          <View style={styles.totalGeneral}>
            <Text>Total TTC</Text>
            <Text>{formatPrice(commande.total)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitre}>Paiement</Text>
          <Text>{LIBELLE_PAIEMENT[commande.mode_paiement] ?? commande.mode_paiement}</Text>
        </View>

        <View style={styles.code}>
          <Text style={styles.codeTitre}>Code de confirmation à présenter à la réception</Text>
          <Text style={styles.codeValeur}>{donnees.codeConfirmation}</Text>
        </View>

        <Text style={styles.footer}>
          Merci de présenter cette facture (sur votre téléphone ou imprimée) et votre code de
          confirmation au livreur lors de la réception.
        </Text>
      </Page>
    </Document>
  );
}
