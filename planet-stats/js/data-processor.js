class DataProcessor {
  static async processData(columnsContent, dataContent) {
    const columns = this.extractColumnNames(columnsContent);
    const data = await this.parseCSV(dataContent);

    return {
      metadata: {
        columns: columns,
        totalRecords: data.length,
      },
      data: data,
    };
  }

  static extractColumnNames(columnsContent) {
    const columns = {};
    const lines = columnsContent.split("\n");

    lines.forEach((line) => {
      if (line.startsWith("# COLUMN")) {
        const match = line.match(/# COLUMN (\w+): (.+)/);
        if (match) {
          columns[match[1]] = match[2].trim();
        }
      }
    });

    return columns;
  }

  static async parseCSV(csvContent) {
    const lines = csvContent.split("\n");
    const headers = lines[0].split(",");

    return lines.slice(1).map((line) => {
      const values = line.split(",");
      const row = {};

      headers.forEach((header, index) => {
        const value = values[index];
        // Conversion des valeurs numériques
        if (!isNaN(value) && value !== "") {
          row[header] = parseFloat(value);
        } else {
          row[header] = value;
        }
      });

      return row;
    });
  }
}

// Fonction pour charger et traiter les données
async function loadAndProcessData() {
  try {
    const [columnsResponse, dataResponse] = await Promise.all([
      fetch("./columns.csv"),
      fetch("./data.csv"),
    ]);

    const columnsContent = await columnsResponse.text();
    const dataContent = await dataResponse.text();

    const processedData = await DataProcessor.processData(
      columnsContent,
      dataContent
    );

    // Sauvegarder les données traitées
    localStorage.setItem("processedData", JSON.stringify(processedData));

    return processedData;
  } catch (error) {
    console.error("Error processing data:", error);
    throw error;
  }
}
