document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Elements ---
  const canvas = document.getElementById("neat-canvas");
  const ctx = canvas.getContext("2d");
  const startBtn = document.getElementById("start-btn");
  const stopBtn = document.getElementById("stop-btn");
  const resetBtn = document.getElementById("reset-btn");
  const maxNodesInput = document.getElementById("max-nodes-input");
  const generationInfo = document.getElementById("generation-info");
  const fitnessInfo = document.getElementById("fitness-info");
  const nodesInfo = document.getElementById("nodes-info");
  const connectionsInfo = document.getElementById("connections-info");
  const xorResults = document.getElementById("xor-results");

  // --- NEAT Configuration ---
  const POPULATION_SIZE = 150;
  const ACTIVATION_CYCLES = 3;
  const XOR_INPUTS = [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ];
  const XOR_OUTPUTS = [[0], [1], [1], [0]];

  let neat;
  let simulationState = {
    isRunning: false,
    animationFrameId: null,
    generation: 0,
  };

  function initializeNeat() {
    const maxNodes = parseInt(maxNodesInput.value, 10);
    neat = new NEAT(POPULATION_SIZE, 2, 1, maxNodes);
    simulationState.generation = 0;
    updateUI(null);
    drawNetwork(ctx, null, canvas.width, canvas.height);
  }

  function updateUI(bestGenome) {
    generationInfo.textContent = simulationState.generation;
    if (bestGenome) {
      fitnessInfo.textContent = bestGenome.fitness.toFixed(4);
      nodesInfo.textContent = bestGenome.nodes.size;
      connectionsInfo.textContent = bestGenome.connections.size;

      const network = bestGenome.createNetwork(ACTIVATION_CYCLES);
      let resultsText = "";
      for (let i = 0; i < XOR_INPUTS.length; i++) {
        const output = network(XOR_INPUTS[i]);
        resultsText += `[${XOR_INPUTS[i].join(", ")}] -> ${output[0].toFixed(
          3
        )} (exp: ${XOR_OUTPUTS[i][0]})\n`;
      }
      xorResults.textContent = resultsText;
    } else {
      fitnessInfo.textContent = "N/A";
      nodesInfo.textContent = "0";
      connectionsInfo.textContent = "0";
      xorResults.textContent = "En attente de la simulation...";
    }
  }

  function simulationLoop() {
    if (!simulationState.isRunning) return;

    // --- Fitness Calculation ---
    let bestGenome = null;
    let maxFitness = -1;

    for (const genome of neat.population) {
      const network = genome.createNetwork(ACTIVATION_CYCLES);
      let error = 0;
      for (let i = 0; i < XOR_INPUTS.length; i++) {
        const output = network(XOR_INPUTS[i]);
        error += Math.pow(output[0] - XOR_OUTPUTS[i][0], 2);
      }
      genome.fitness = Math.pow(4 - error, 2);

      if (genome.fitness > maxFitness) {
        maxFitness = genome.fitness;
        bestGenome = genome;
      }
    }

    // --- Evolution & UI Update ---
    neat.evolve();
    simulationState.generation++;

    updateUI(bestGenome);
    drawNetwork(ctx, bestGenome, canvas.width, canvas.height);

    // Check for a solution
    if (maxFitness >= 15.9) {
      console.log("Solution found!");
      stopSimulation();
    } else {
      simulationState.animationFrameId = requestAnimationFrame(simulationLoop);
    }
  }

  function startSimulation() {
    if (simulationState.isRunning) return;
    simulationState.isRunning = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    maxNodesInput.disabled = true;
    simulationLoop();
  }

  function stopSimulation() {
    simulationState.isRunning = false;
    if (simulationState.animationFrameId) {
      cancelAnimationFrame(simulationState.animationFrameId);
    }
    startBtn.disabled = false;
    stopBtn.disabled = true;
    maxNodesInput.disabled = false;
  }

  function resetSimulation() {
    stopSimulation();
    initializeNeat();
  }

  // --- Event Listeners ---
  startBtn.addEventListener("click", startSimulation);
  stopBtn.addEventListener("click", stopSimulation);
  resetBtn.addEventListener("click", resetSimulation);

  // --- Initial State ---
  initializeNeat();
});
