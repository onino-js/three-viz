class AxesHelper {
  constructor(scene, options = {}) {
    this.scene = scene;

    // Default options
    this.options = {
      xLabel: "X",
      yLabel: "Y",
      zLabel: "Z",
      showTicks: true,
      tickSize: 0.1,
      tickCount: 5,
      labelSize: 0.5,
      lineWidth: 2,
      sizes: {
        x: 5,
        y: 5,
        z: 5,
      },
      colors: {
        x: 0xff0000,
        y: 0x00ff00,
        z: 0x0000ff,
      },
    };

    // Merge provided options with defaults
    Object.assign(this.options, options);

    // Calculer la taille maximale pour la normalisation
    this.maxSize = Math.max(
      this.options.sizes.x,
      this.options.sizes.y,
      this.options.sizes.z
    );

    // Create axes group
    this.axes = new THREE.Group();
    this.createAxes();
    this.scene.add(this.axes);
  }

  createAxes() {
    // Create lines with normalized positions
    const xLine = this.createLine(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 0, 0),
      this.options.colors.x
    );
    const yLine = this.createLine(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1, 0),
      this.options.colors.y
    );
    const zLine = this.createLine(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 1),
      this.options.colors.z
    );

    // Scale the lines to match the max size
    xLine.scale.set(this.maxSize, 1, 1);
    yLine.scale.set(1, this.maxSize, 1);
    zLine.scale.set(1, 1, this.maxSize);

    this.axes.add(xLine);
    this.axes.add(yLine);
    this.axes.add(zLine);

    // Create labels
    const xLabel = this.createTextMesh(
      this.options.xLabel,
      this.options.colors.x
    );
    const yLabel = this.createTextMesh(
      this.options.yLabel,
      this.options.colors.y
    );
    const zLabel = this.createTextMesh(
      this.options.zLabel,
      this.options.colors.z
    );

    // Position labels with normalized positions
    xLabel.position.set(this.maxSize + this.options.labelSize, 0, 0);
    yLabel.position.set(0, this.maxSize + this.options.labelSize, 0);
    zLabel.position.set(0, 0, this.maxSize + this.options.labelSize);

    this.axes.add(xLabel);
    this.axes.add(yLabel);
    this.axes.add(zLabel);

    // Create tick marks if enabled
    if (this.options.showTicks) {
      this.createTickMarks();
    }
  }

  createLine(start, end, color) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({
      color: color,
      linewidth: this.options.lineWidth,
    });
    return new THREE.Line(geometry, material);
  }

  createTextMesh(text, color) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    // Augmenter la taille du canvas pour éviter le clipping
    canvas.width = 512;
    canvas.height = 512;

    // Mesurer la taille du texte
    context.font = "Bold 120px Arial";
    const metrics = context.measureText(text);
    const textWidth = metrics.width;
    const textHeight = 120; // Hauteur approximative pour Arial

    // Calculer le padding nécessaire
    const padding = 20;
    const totalWidth = textWidth + padding * 2;
    const totalHeight = textHeight + padding * 2;

    // Redimensionner le canvas si nécessaire
    if (totalWidth > canvas.width) canvas.width = totalWidth;
    if (totalHeight > canvas.height) canvas.height = totalHeight;

    // Redessiner le texte centré
    context.font = "Bold 120px Arial";
    context.fillStyle = "white";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    // Créer la texture avec de meilleurs paramètres
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;

    // Créer le sprite avec une meilleure échelle
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: color,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);

    // Ajuster l'échelle en fonction de la taille du texte
    const scale = this.options.labelSize * 2;
    sprite.scale.set(scale, scale, 1);

    return sprite;
  }

  createTickMarks() {
    // Create tick marks for each axis
    for (let i = 1; i <= this.options.tickCount; i++) {
      // Calculate normalized positions
      const xPos = (i * this.maxSize) / this.options.tickCount;
      const yPos = (i * this.maxSize) / this.options.tickCount;
      const zPos = (i * this.maxSize) / this.options.tickCount;

      // X-axis ticks
      const xTick = this.createLine(
        new THREE.Vector3(xPos, -this.options.tickSize, 0),
        new THREE.Vector3(xPos, this.options.tickSize, 0),
        this.options.colors.x
      );

      // Y-axis ticks
      const yTick = this.createLine(
        new THREE.Vector3(-this.options.tickSize, yPos, 0),
        new THREE.Vector3(this.options.tickSize, yPos, 0),
        this.options.colors.y
      );

      // Z-axis ticks
      const zTick = this.createLine(
        new THREE.Vector3(0, -this.options.tickSize, zPos),
        new THREE.Vector3(0, this.options.tickSize, zPos),
        this.options.colors.z
      );

      this.axes.add(xTick);
      this.axes.add(yTick);
      this.axes.add(zTick);
    }
  }

  updateSizes(newSizes) {
    this.options.sizes = { ...this.options.sizes, ...newSizes };
    // Recalculate max size
    this.maxSize = Math.max(
      this.options.sizes.x,
      this.options.sizes.y,
      this.options.sizes.z
    );
    this.scene.remove(this.axes);
    this.axes = new THREE.Group();
    this.createAxes();
    this.scene.add(this.axes);
  }

  updateLabels(newLabels) {
    this.options.xLabel = newLabels.xLabel || this.options.xLabel;
    this.options.yLabel = newLabels.yLabel || this.options.yLabel;
    this.options.zLabel = newLabels.zLabel || this.options.zLabel;

    // Remove old labels
    this.axes.children = this.axes.children.filter(
      (child) => !(child instanceof THREE.Sprite)
    );

    // Create new labels
    const xLabel = this.createTextMesh(
      this.options.xLabel,
      this.options.colors.x
    );
    const yLabel = this.createTextMesh(
      this.options.yLabel,
      this.options.colors.y
    );
    const zLabel = this.createTextMesh(
      this.options.zLabel,
      this.options.colors.z
    );

    // Position new labels
    xLabel.position.set(this.maxSize + this.options.labelSize, 0, 0);
    yLabel.position.set(0, this.maxSize + this.options.labelSize, 0);
    zLabel.position.set(0, 0, this.maxSize + this.options.labelSize);

    this.axes.add(xLabel);
    this.axes.add(yLabel);
    this.axes.add(zLabel);
  }

  toggleVisibility(visible) {
    this.axes.visible = visible;
  }
}

// Export the class
window.AxesHelper = AxesHelper;
