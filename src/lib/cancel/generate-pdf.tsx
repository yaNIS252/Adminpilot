import "server-only";

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

/**
 * Rendu PDF de la lettre de résiliation.
 *
 * `@react-pdf/renderer` plutôt que Puppeteer : un Chromium headless ne tient
 * pas dans une fonction serverless Vercel sans contorsions (taille du binaire,
 * démarrage à froid). Ici le rendu est pur JavaScript.
 *
 * La mise en page suit la lettre administrative française : expéditeur à
 * gauche, destinataire à droite, lieu et date, objet, corps, signature.
 */

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 64,
    fontSize: 11,
    fontFamily: "Helvetica",
    lineHeight: 1.5,
    color: "#111",
  },
  header: { flexDirection: "row", justifyContent: "space-between" },
  block: { maxWidth: 220 },
  right: { maxWidth: 220, textAlign: "right" },
  place: { marginTop: 36, textAlign: "right" },
  subject: { marginTop: 32, fontFamily: "Helvetica-Bold" },
  body: { marginTop: 24 },
  paragraph: { marginBottom: 12 },
  signature: { marginTop: 40, textAlign: "right" },
});

export type LetterData = {
  sender: { name: string; address: string[] };
  recipient: { name: string; address: string[] };
  place: string;
  date: string;
  subject: string;
  /** Corps rédigé par le modèle, paragraphes séparés par des lignes vides. */
  body: string;
};

function Letter({ data }: { data: LetterData }) {
  const paragraphs = data.body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.block}>
            <Text>{data.sender.name}</Text>
            {data.sender.address.map((line, i) => (
              <Text key={i}>{line}</Text>
            ))}
          </View>
          <View style={styles.right}>
            <Text>{data.recipient.name}</Text>
            {data.recipient.address.map((line, i) => (
              <Text key={i}>{line}</Text>
            ))}
          </View>
        </View>

        <Text style={styles.place}>
          {data.place}, le {data.date}
        </Text>

        <Text style={styles.subject}>Objet : {data.subject}</Text>

        <View style={styles.body}>
          {paragraphs.map((paragraph, i) => (
            <Text key={i} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
        </View>

        <Text style={styles.signature}>{data.sender.name}</Text>
      </Page>
    </Document>
  );
}

export function renderLetterPdf(data: LetterData): Promise<Buffer> {
  return renderToBuffer(<Letter data={data} />);
}
