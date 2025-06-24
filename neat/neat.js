/**
 * @fileoverview This file contains the implementation of the NEAT (NeuroEvolution of Augmenting Topologies) algorithm.
 */

/**
 * Represents a node in the neural network.
 */
class NodeGene {
  /**
   * @param {number} id
   * @param {('input'|'output'|'hidden')} type
   */
  constructor(id, type) {
    this.id = id;
    this.type = type;
  }
}

/**
 * Represents a connection between two nodes.
 */
class ConnectionGene {
  /**
   * @param {number} inNode
   * @param {number} outNode
   * @param {number} weight
   * @param {boolean} enabled
   * @param {number} innovation
   */
  constructor(inNode, outNode, weight, enabled, innovation) {
    this.inNode = inNode;
    this.outNode = outNode;
    this.weight = weight;
    this.enabled = enabled;
    this.innovation = innovation;
  }

  disable() {
    this.enabled = false;
  }
}

/**
 * Represents a genome, which is a blueprint for a neural network.
 */
class Genome {
  /**
   * @param {Map<number, NodeGene>} nodes
   * @param {Map<number, ConnectionGene>} connections
   */
  constructor(nodes, connections) {
    this.nodes = nodes || new Map();
    this.connections = connections || new Map();
    this.fitness = 0;
  }

  /**
   * Mutates the genome by adding a new connection between two existing nodes.
   * @param {NEAT} neat
   */
  addConnectionMutation(neat) {
    const nodeIds = Array.from(this.nodes.keys());
    let node1Id = nodeIds[Math.floor(Math.random() * nodeIds.length)];
    let node2Id = nodeIds[Math.floor(Math.random() * nodeIds.length)];

    const node1 = this.nodes.get(node1Id);
    const node2 = this.nodes.get(node2Id);

    // --- Connection validation rules ---

    // Rule: The destination of a connection cannot be an input node.
    if (node2.type === "input") {
      return;
    }

    // Rule: Nodes cannot connect to themselves.
    if (node1Id === node2Id) {
      return;
    }

    // Optional: Swap direction to encourage feed-forward networks
    // (e.g., from output to hidden becomes hidden to output)
    if (node1.type === "output" && node2.type === "hidden") {
      [node1Id, node2Id] = [node2Id, node1Id];
    }

    // Check if connection already exists
    for (const conn of this.connections.values()) {
      if (
        (conn.inNode === node1Id && conn.outNode === node2Id) ||
        (conn.inNode === node2Id && conn.outNode === node1Id)
      ) {
        return; // Connection already exists
      }
    }

    const innovation = neat.getInnovationNumber(node1Id, node2Id);
    const newConnection = new ConnectionGene(
      node1Id,
      node2Id,
      Math.random() * 2 - 1,
      true,
      innovation
    );
    this.connections.set(innovation, newConnection);
  }

  /**
   * Mutates the genome by adding a new node on an existing connection.
   * @param {NEAT} neat
   */
  addNodeMutation(neat) {
    if (this.nodes.size >= neat.maxNodes) {
      return; // Do not add a node if the limit is reached
    }

    if (this.connections.size === 0) {
      return;
    }

    const connectionsAsArray = Array.from(this.connections.values());
    const randomConnection =
      connectionsAsArray[Math.floor(Math.random() * connectionsAsArray.length)];

    randomConnection.disable();

    const oldWeight = randomConnection.weight;
    const inNodeId = randomConnection.inNode;
    const outNodeId = randomConnection.outNode;

    const newNodeId = neat.getNextNodeId();
    const newNode = new NodeGene(newNodeId, "hidden");
    this.nodes.set(newNodeId, newNode);

    const innovation1 = neat.getInnovationNumber(inNodeId, newNodeId);
    const newConnection1 = new ConnectionGene(
      inNodeId,
      newNodeId,
      1,
      true,
      innovation1
    );

    const innovation2 = neat.getInnovationNumber(newNodeId, outNodeId);
    const newConnection2 = new ConnectionGene(
      newNodeId,
      outNodeId,
      oldWeight,
      true,
      innovation2
    );

    this.connections.set(innovation1, newConnection1);
    this.connections.set(innovation2, newConnection2);
  }

  /**
   * Creates a new genome by crossing over with another genome.
   * @param {Genome} otherParent
   * @returns {Genome}
   */
  crossover(otherParent) {
    const parent1 = this.fitness >= otherParent.fitness ? this : otherParent;
    const parent2 = this.fitness >= otherParent.fitness ? otherParent : this;

    const childNodes = new Map();
    const childConnections = new Map();

    // Inherit nodes from the fitter parent
    for (const [nodeId, node] of parent1.nodes) {
      childNodes.set(nodeId, new NodeGene(node.id, node.type));
    }

    // Inherit connections
    for (const [innov, conn1] of parent1.connections) {
      const conn2 = parent2.connections.get(innov);
      if (conn2) {
        // Matching gene
        const childConn = Math.random() < 0.5 ? conn1 : conn2;
        childConnections.set(
          innov,
          new ConnectionGene(
            childConn.inNode,
            childConn.outNode,
            childConn.weight,
            childConn.enabled,
            childConn.innovation
          )
        );

        // If a connection is disabled in either parent, it has a chance to be disabled in the child.
        if (!conn1.enabled || !conn2.enabled) {
          if (Math.random() < 0.75) {
            childConnections.get(innov).disable();
          }
        }
      } else {
        // Disjoint or excess gene from parent1
        childConnections.set(
          innov,
          new ConnectionGene(
            conn1.inNode,
            conn1.outNode,
            conn1.weight,
            conn1.enabled,
            conn1.innovation
          )
        );
      }
    }

    const child = new Genome(childNodes, childConnections);
    return child;
  }

  /**
   * Mutates the weights of the connections in the genome.
   * There's a `perturb_chance` to slightly change the weight,
   * and a `new_weight_chance` to assign a completely new weight.
   * @param {number} [perturb_chance=0.9]
   * @param {number} [new_weight_chance=0.1]
   */
  mutateWeights(perturb_chance = 0.9, new_weight_chance = 0.1) {
    for (const conn of this.connections.values()) {
      if (Math.random() < perturb_chance) {
        // 90% chance to perturb the weight by a small amount
        conn.weight += (Math.random() * 2 - 1) * 0.1; // Perturb by up to +/- 10%
      } else {
        // 10% chance to assign a new random weight
        conn.weight = Math.random() * 4 - 2; // New weight between -2 and 2
      }
    }
  }

  /**
   * Creates a neural network from the genome. Allows for recurrent connections.
   * @param {number} [activation_cycles=3] - The number of cycles to activate the network for recurrent connections.
   * @returns {function(number[]): number[]}
   */
  createNetwork(activation_cycles = 3) {
    const allNodes = Array.from(this.nodes.values());
    const inputNodes = allNodes.filter((n) => n.type === "input");
    const outputNodes = allNodes.filter((n) => n.type === "output");
    const nonInputNodes = allNodes.filter((n) => n.type !== "input");

    return (inputs) => {
      if (inputs.length !== inputNodes.length) {
        throw new Error("Incorrect number of inputs.");
      }

      let nodeValues = new Map();

      // Initialize all node values to 0
      for (const node of allNodes) {
        nodeValues.set(node.id, 0);
      }

      // Set input values from the function arguments
      inputNodes.forEach((node, index) => {
        nodeValues.set(node.id, inputs[index]);
      });

      // Activate the network for a number of cycles to allow recurrent signals to propagate.
      for (let i = 0; i < activation_cycles; i++) {
        const valuesToUpdate = new Map();

        // For each non-input node, calculate its next activation value based on the current nodeValues
        for (const node of nonInputNodes) {
          let sum = 0;
          for (const conn of this.connections.values()) {
            if (conn.outNode === node.id && conn.enabled) {
              sum += (nodeValues.get(conn.inNode) || 0) * conn.weight;
            }
          }
          valuesToUpdate.set(node.id, this.sigmoid(sum));
        }

        // After calculating all new values, update the main map
        for (const [nodeId, value] of valuesToUpdate.entries()) {
          nodeValues.set(nodeId, value);
        }
      }

      // Get output values after the final cycle
      const outputs = outputNodes.map((node) => nodeValues.get(node.id));
      return outputs;
    };
  }

  /**
   * Sigmoid activation function.
   * @param {number} x
   * @returns {number}
   */
  sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
  }
}

/**
 * Represents a species in the NEAT algorithm.
 */
class Species {
  /**
   * @param {Genome} representative
   */
  constructor(representative) {
    this.representative = representative;
    this.members = [representative];
    this.adjustedFitness = 0;
    this.maxFitnessLastGen = 0;
    this.generationsSinceImprovement = 0;
  }

  /**
   * Adds a member to the species and updates the representative if the new member is a better fit.
   * @param {Genome} member
   */
  addMember(member) {
    if (member.fitness > this.representative.fitness) {
      // A simple way to update representative, could be more sophisticated
      // this.representative = member;
    }
    this.members.push(member);
  }

  /**
   * Calculates the adjusted fitness of the species.
   */
  calculateAdjustedFitness() {
    this.adjustedFitness =
      this.members.reduce((sum, member) => sum + member.fitness, 0) /
      this.members.length;
  }

  /**
   * Clears the members of the species for the next generation.
   */
  clear() {
    this.members = [];
  }
}

/**
 * The main NEAT algorithm class.
 */
class NEAT {
  /**
   * @param {number} populationSize
   * @param {number} inputNodes
   * @param {number} outputNodes
   * @param {number} [maxNodes=50]
   */
  constructor(populationSize, inputNodes, outputNodes, maxNodes = 50) {
    this.populationSize = populationSize;
    this.inputNodes = inputNodes;
    this.outputNodes = outputNodes;
    this.maxNodes = maxNodes;
    this.population = [];
    this.innovationHistory = new Map();
    this.nodeId = 0;
    this.innovationNumber = 0;

    // Speciation parameters
    this.c1 = 1.0;
    this.c2 = 1.0;
    this.c3 = 0.5;
    this.compatibilityThreshold = 3.0;
    this.stagnationThreshold = 20;
    this.species = [];

    this.reset();
  }

  /**
   * Gets the next available node ID.
   * @returns {number}
   */
  getNextNodeId() {
    return this.nodeId++;
  }

  /**
   * Resets the NEAT algorithm to its initial state.
   */
  reset() {
    this.nodeId = 0;
    this.innovationNumber = 0;
    this.population = [];

    // Create the initial population
    for (let i = 0; i < this.populationSize; i++) {
      const genome = new Genome();
      const inputNodes = new Map();
      const outputNodes = new Map();

      // Create input nodes
      for (let j = 0; j < this.inputNodes; j++) {
        const node = new NodeGene(this.nodeId++, "input");
        inputNodes.set(node.id, node);
        genome.nodes.set(node.id, node);
      }

      // Create output nodes
      for (let j = 0; j < this.outputNodes; j++) {
        const node = new NodeGene(this.nodeId++, "output");
        outputNodes.set(node.id, node);
        genome.nodes.set(node.id, node);
      }

      // Create initial connections
      for (const inputNode of inputNodes.values()) {
        for (const outputNode of outputNodes.values()) {
          const innovation = this.getInnovationNumber(
            inputNode.id,
            outputNode.id
          );
          const connection = new ConnectionGene(
            inputNode.id,
            outputNode.id,
            Math.random() * 2 - 1,
            true,
            innovation
          );
          genome.connections.set(innovation, connection);
        }
      }
      this.population.push(genome);
    }
  }

  /**
   * Gets the innovation number for a new connection.
   * @param {number} inNode
   * @param {number} outNode
   * @returns {number}
   */
  getInnovationNumber(inNode, outNode) {
    const key = `${inNode}-${outNode}`;
    if (this.innovationHistory.has(key)) {
      return this.innovationHistory.get(key);
    }
    this.innovationHistory.set(key, this.innovationNumber);
    return this.innovationNumber++;
  }

  /**
   * Calculates the genomic distance between two genomes.
   * @param {Genome} genome1
   * @param {Genome} genome2
   * @returns {number}
   */
  distance(genome1, genome2) {
    let excess = 0;
    let disjoint = 0;
    let weightDifference = 0;
    let matching = 0;

    const innovs1 = new Set(genome1.connections.keys());
    const innovs2 = new Set(genome2.connections.keys());
    const maxInnov = Math.max(...Array.from(innovs1), ...Array.from(innovs2));

    for (let i = 0; i <= maxInnov; i++) {
      const conn1 = genome1.connections.get(i);
      const conn2 = genome2.connections.get(i);

      if (conn1 && conn2) {
        matching++;
        weightDifference += Math.abs(conn1.weight - conn2.weight);
      } else if (conn1) {
        if (i > Math.max(...Array.from(innovs2))) excess++;
        else disjoint++;
      } else if (conn2) {
        if (i > Math.max(...Array.from(innovs1))) excess++;
        else disjoint++;
      }
    }

    const N = Math.max(genome1.connections.size, genome2.connections.size);
    const normN = N < 20 ? 1 : N;

    const distance =
      (this.c1 * excess) / normN +
      (this.c2 * disjoint) / normN +
      this.c3 * (matching > 0 ? weightDifference / matching : 0);
    return distance;
  }

  /**
   * Runs the NEAT algorithm for one generation.
   */
  evolve() {
    // 1. Check for stagnation and update species stats
    for (const s of this.species) {
      const maxFitnessThisGen = Math.max(...s.members.map((m) => m.fitness));
      if (maxFitnessThisGen > s.maxFitnessLastGen) {
        s.maxFitnessLastGen = maxFitnessThisGen;
        s.generationsSinceImprovement = 0;
      } else {
        s.generationsSinceImprovement++;
      }
    }

    // Remove stagnant species, but always keep the best one
    const sortedSpecies = this.species.sort(
      (a, b) => b.maxFitnessLastGen - a.maxFitnessLastGen
    );
    this.species = sortedSpecies
      .slice(0, 1) // Keep the very best species
      .concat(
        sortedSpecies
          .slice(1)
          .filter(
            (s) => s.generationsSinceImprovement < this.stagnationThreshold
          )
      );

    // 2. Speciate the current population
    // Clear members of each species, and choose a new random representative
    for (const s of this.species) {
      s.clear();
    }

    for (const genome of this.population) {
      let foundSpecies = false;
      for (const s of this.species) {
        if (
          this.distance(genome, s.representative) < this.compatibilityThreshold
        ) {
          s.addMember(genome);
          foundSpecies = true;
          break;
        }
      }
      if (!foundSpecies) {
        this.species.push(new Species(genome));
      }
    }

    // Remove empty species before selecting new representatives
    this.species = this.species.filter((s) => s.members.length > 0);

    // Update representative to a random member from the last generation's members.
    // A better approach would be to set the member closest to the previous representative.
    for (const s of this.species) {
      s.representative =
        s.members[Math.floor(Math.random() * s.members.length)];
    }

    // 3. Reproduce (Selection, Crossover, Mutation)

    // Calculate adjusted fitness for each species
    for (const s of this.species) {
      s.calculateAdjustedFitness();
    }

    // Calculate total adjusted fitness
    const totalAdjustedFitness = this.species.reduce(
      (sum, s) => sum + s.adjustedFitness,
      0
    );

    const nextPopulation = [];

    // --- Elitism: Keep the best genome of the entire population ---
    let bestGenome = null;
    let maxFitness = -1;
    for (const g of this.population) {
      if (g.fitness > maxFitness) {
        maxFitness = g.fitness;
        bestGenome = g;
      }
    }
    if (bestGenome) {
      nextPopulation.push(bestGenome);
    }
    // ----------------------------------------------------------------

    for (const s of this.species) {
      s.members.sort((a, b) => b.fitness - a.fitness); // Sort by fitness

      // Note: Elitism per species was removed in favor of global elitism.
      // We can calculate offspring count for the remaining population size.
      const offspringCount = Math.floor(
        (s.adjustedFitness / totalAdjustedFitness) *
          (this.populationSize - nextPopulation.length) // Account for elite genomes
      );

      // Select parents from the top half of the species
      const breedingPool = s.members.slice(0, Math.ceil(s.members.length / 2));

      for (let i = 0; i < offspringCount; i++) {
        let parent1, parent2;

        if (breedingPool.length > 0) {
          parent1 =
            breedingPool[Math.floor(Math.random() * breedingPool.length)];
          parent2 =
            breedingPool[Math.floor(Math.random() * breedingPool.length)];
        } else {
          // Failsafe if breeding pool is empty
          parent1 = s.members[Math.floor(Math.random() * s.members.length)];
          parent2 = s.members[Math.floor(Math.random() * s.members.length)];
        }

        let child;
        if (parent1.fitness >= parent2.fitness) {
          child = parent1.crossover(parent2);
        } else {
          child = parent2.crossover(parent1);
        }

        // Apply mutations
        if (Math.random() < 0.5) {
          // Chance to mutate weights
          child.mutateWeights();
        }
        if (Math.random() < 0.003) {
          // Chance to add a new connection
          child.addConnectionMutation(this);
        }
        if (Math.random() < 0.003) {
          // Chance to add a new node
          child.addNodeMutation(this);
        }

        nextPopulation.push(child);
      }
    }

    // Replace old population with the new one
    this.population = nextPopulation;

    // Ensure population size is maintained
    while (this.population.length < this.populationSize) {
      // Add new random genomes if population is too small
      // This can happen if totalAdjustedFitness is 0 or very low
      // A better approach would be to breed from the best species
      const bestSpecies = this.species.sort(
        (a, b) => b.adjustedFitness - a.adjustedFitness
      )[0];
      if (bestSpecies && bestSpecies.members.length > 0) {
        let parent1 =
          bestSpecies.members[
            Math.floor(Math.random() * bestSpecies.members.length)
          ];
        let parent2 =
          bestSpecies.members[
            Math.floor(Math.random() * bestSpecies.members.length)
          ];
        let child = parent1.crossover(parent2);
        child.addConnectionMutation(this);
        this.population.push(child);
      } else {
        // Failsafe, create a completely new genome
        this.population.push(this._createBaseGenome());
      }
    }
  }

  /**
   * Creates a base genome with input and output nodes and full initial connectivity.
   * @private
   * @returns {Genome}
   */
  _createBaseGenome() {
    const genome = new Genome();
    const inputNodes = new Map();
    const outputNodes = new Map();

    // Create input nodes
    for (let j = 0; j < this.inputNodes; j++) {
      const node = new NodeGene(this.getNextNodeId(), "input");
      inputNodes.set(node.id, node);
      genome.nodes.set(node.id, node);
    }

    // Create output nodes
    for (let j = 0; j < this.outputNodes; j++) {
      const node = new NodeGene(this.getNextNodeId(), "output");
      outputNodes.set(node.id, node);
      genome.nodes.set(node.id, node);
    }

    // Create initial connections
    for (const inputNode of inputNodes.values()) {
      for (const outputNode of outputNodes.values()) {
        const innovation = this.getInnovationNumber(
          inputNode.id,
          outputNode.id
        );
        const connection = new ConnectionGene(
          inputNode.id,
          outputNode.id,
          Math.random() * 2 - 1,
          true,
          innovation
        );
        genome.connections.set(innovation, connection);
      }
    }
    return genome;
  }
}

// module.exports = { NEAT, Genome, NodeGene, ConnectionGene, Species };
