const { NEAT } = require("./neat.js");

// XOR problem data
const XOR_INPUTS = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
];

const XOR_OUTPUTS = [[0], [1], [1], [0]];

const POPULATION_SIZE = 150;
const MAX_GENERATIONS = 500;
const ACTIVATION_CYCLES = 2; // Number of times to activate the network, for recurrent connections

// Create a new NEAT instance
const neat = new NEAT(POPULATION_SIZE, 2, 1);

let bestGenome = null;

function run() {
  console.log("Starting NEAT for XOR problem (with recurrent evaluation)...");

  for (let gen = 0; gen < MAX_GENERATIONS; gen++) {
    let maxFitness = -1;

    for (const genome of neat.population) {
      const network = genome.createNetwork(ACTIVATION_CYCLES);
      let error = 0;

      for (let i = 0; i < XOR_INPUTS.length; i++) {
        const output = network(XOR_INPUTS[i]);
        error += Math.pow(output[0] - XOR_OUTPUTS[i][0], 2);
      }

      // The fitness is the inverse of the mean squared error.
      // 4 is the max possible error sum, so we start from there.
      genome.fitness = Math.pow(4 - error, 2);

      if (genome.fitness > maxFitness) {
        maxFitness = genome.fitness;
        bestGenome = genome;
      }
    }

    console.log(`Generation: ${gen}, Best Fitness: ${maxFitness.toFixed(3)}`);

    // Check for a solution
    if (maxFitness > 15.9) {
      // A near-perfect score
      console.log("\nSolution found!");
      break;
    }

    // Evolve to the next generation
    neat.evolve();
  }

  // Display the best genome's network and its performance
  if (bestGenome) {
    console.log("\nBest Genome found:");
    console.log(`Fitness: ${bestGenome.fitness.toFixed(3)}`);
    console.log(
      `Nodes: ${bestGenome.nodes.size} | Connections: ${bestGenome.connections.size}`
    );

    const bestNetwork = bestGenome.createNetwork(ACTIVATION_CYCLES);
    console.log("\n--- Testing the best network ---");
    for (let i = 0; i < XOR_INPUTS.length; i++) {
      const output = bestNetwork(XOR_INPUTS[i]);
      console.log(
        `Input: [${XOR_INPUTS[i].join(", ")}] -> Output: ${output[0].toFixed(
          5
        )} (Expected: ${XOR_OUTPUTS[i][0]})`
      );
    }
  }
}

run();
