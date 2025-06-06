const fs = require("fs");
const { parse } = require("csv-parse/sync");

// Fonction pour extraire les noms de colonnes du fichier columns.csv
function extractColumnNames(columnsContent) {
  const lines = columnsContent.split("\n");
  const columnNames = {};

  lines.forEach((line) => {
    if (line.startsWith("# COLUMN")) {
      const match = line.match(/# COLUMN (\w+):\s+(.+)/);
      if (match) {
        const [, columnId, description] = match;
        columnNames[columnId] = description.trim();
      }
    }
  });

  return columnNames;
}

// Fonction pour lire et traiter les données
async function processData() {
  try {
    // Lire les fichiers
    const columnsContent = fs.readFileSync(
      "./planet-stats/columns.csv",
      "utf8"
    );
    const dataContent = fs.readFileSync("./planet-stats/data.csv", "utf8");

    // Extraire les noms de colonnes
    const columnNames = extractColumnNames(columnsContent);

    // Parser les données CSV
    const records = parse(dataContent, {
      columns: true,
      skip_empty_lines: true,
    });

    // Créer le résultat final avec les descriptions des colonnes
    const result = {
      metadata: {
        columns: columnNames,
        totalRecords: records.length,
      },
      data: records,
    };

    // Sauvegarder le résultat en JSON
    fs.writeFileSync("./processed-data.json", JSON.stringify(result, null, 2));

    console.log(
      `Traitement terminé. ${records.length} enregistrements traités.`
    );
    console.log("Fichier JSON créé : processed-data.json");
  } catch (error) {
    console.error("Erreur lors du traitement des données:", error);
  }
}

// Exécuter le traitement
processData();
