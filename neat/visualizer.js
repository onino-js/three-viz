function drawNetwork(ctx, genome, width, height) {
  ctx.clearRect(0, 0, width, height);
  if (!genome) return;

  const nodes = Array.from(genome.nodes.values());
  const nodePositions = new Map();
  const nodeRadius = 10;

  // Separate nodes by type
  const inputNodes = nodes.filter((n) => n.type === "input");
  const outputNodes = nodes.filter((n) => n.type === "output");
  const hiddenNodes = nodes.filter((n) => n.type === "hidden");

  // Calculate positions
  const xMargin = 50;
  const yMargin = 50;
  const availableWidth = width - 2 * xMargin;
  const availableHeight = height - 2 * yMargin;

  // Position input nodes
  inputNodes.forEach((node, i) => {
    const x = xMargin;
    const y = (availableHeight / (inputNodes.length + 1)) * (i + 1) + yMargin;
    nodePositions.set(node.id, { x, y });
  });

  // Position output nodes
  outputNodes.forEach((node, i) => {
    const x = width - xMargin;
    const y = (availableHeight / (outputNodes.length + 1)) * (i + 1) + yMargin;
    nodePositions.set(node.id, { x, y });
  });

  // Position hidden nodes
  hiddenNodes.forEach((node, i) => {
    // Simple positioning for now, could be improved with topological sort
    const x =
      Math.random() * (availableWidth / 2) + (xMargin + availableWidth / 4);
    const y = Math.random() * availableHeight + yMargin;
    nodePositions.set(node.id, { x, y });
  });

  // Draw connections
  ctx.lineWidth = 1;
  for (const conn of genome.connections.values()) {
    const pos1 = nodePositions.get(conn.inNode);
    const pos2 = nodePositions.get(conn.outNode);

    if (!pos1 || !pos2) continue;

    ctx.beginPath();
    if (conn.enabled) {
      const weight = conn.weight;
      ctx.strokeStyle =
        weight > 0
          ? `rgba(0, 150, 0, ${Math.abs(weight)})`
          : `rgba(150, 0, 0, ${Math.abs(weight)})`;
      ctx.lineWidth = Math.min(Math.abs(weight) * 2, 5);
    } else {
      ctx.strokeStyle = "#cccccc";
      ctx.lineWidth = 0.5;
    }

    // Draw recurrent connections as curves
    if (pos1.x >= pos2.x) {
      const ctrlX = (pos1.x + pos2.x) / 2 + 30 * (pos1.y > pos2.y ? -1 : 1);
      const ctrlY = (pos1.y + pos2.y) / 2 + 30 * (pos1.x > pos2.x ? 1 : -1);
      ctx.moveTo(pos1.x, pos1.y);
      ctx.quadraticCurveTo(ctrlX, ctrlY, pos2.x, pos2.y);
    } else {
      ctx.moveTo(pos1.x, pos1.y);
      ctx.lineTo(pos2.x, pos2.y);
    }
    ctx.stroke();
  }

  // Draw nodes
  for (const [id, pos] of nodePositions.entries()) {
    const node = genome.nodes.get(id);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, nodeRadius, 0, 2 * Math.PI);
    switch (node.type) {
      case "input":
        ctx.fillStyle = "#2a9d8f";
        break;
      case "output":
        ctx.fillStyle = "#e76f51";
        break;
      case "hidden":
        ctx.fillStyle = "#e9c46a";
        break;
    }
    ctx.fill();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw node ID
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(id, pos.x, pos.y);
  }
}
