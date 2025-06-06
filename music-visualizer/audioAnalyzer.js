class AudioAnalyzer {
  constructor(scene, audioContext) {
    this.scene = scene;
    this.audioContext = audioContext;
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);

    // Configuration
    this.numBands = 32;
    this.scrollSpeed = 0.5;
    this.layerSpacing = 0.5;
    this.historyLength = 20;
    this.currentZ = 0;
    this.lastLayerTime = 0;
    this.layers = [];
    this.currentLayer = null;
    this.isStarted = false;

    // Surface configuration
    this.surfaceSpacing = 0.5;
    this.surfaceLength = 20;
    this.surfacePoints = [];
    this.surfaceLines = [];
    this.lastSurfacePointTime = 0;

    // Audio source
    this.audioSource = null;
    this.audioBuffer = null;
    this.isPlaying = false;

    // Create initial layer
    this.createNewLayer(0);
  }

  async loadAudio(url) {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error("Error loading audio:", error);
    }
  }

  play() {
    if (this.audioBuffer && !this.isPlaying) {
      this.audioSource = this.audioContext.createBufferSource();
      this.audioSource.buffer = this.audioBuffer;
      this.connectSource(this.audioSource);
      this.audioSource.start();
      this.isPlaying = true;
    }
  }

  pause() {
    if (this.audioSource && this.isPlaying) {
      this.audioSource.stop();
      this.audioSource = null;
      this.isPlaying = false;
    }
  }

  connectSource(source) {
    source.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
  }

  createNewLayer(zPosition) {
    const layer = {
      spheres: [],
      z: zPosition,
      created: Date.now(),
    };

    // Create spheres for this layer
    for (let i = 0; i < this.numBands; i++) {
      const geometry = new THREE.SphereGeometry(0.2, 16, 16); // Increased sphere size
      const material = new THREE.MeshPhongMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.9, // Increased opacity
        shininess: 100, // Added shininess
      });
      const sphere = new THREE.Mesh(geometry, material);

      // Position initiale
      const x = this.getFrequencyPosition(i);
      sphere.position.set(x, 0, zPosition);

      layer.spheres.push(sphere);
      this.scene.add(sphere);
    }

    this.layers.push(layer);
    this.currentLayer = layer;
    return layer;
  }

  createSurfacePoint(zPosition) {
    const point = {
      positions: new Array(this.numBands).fill().map(() => new THREE.Vector3()),
      z: zPosition,
      created: Date.now(),
    };

    // Initialize positions
    for (let i = 0; i < this.numBands; i++) {
      const x = this.getFrequencyPosition(i);
      point.positions[i].set(x, 0, zPosition);
    }

    this.surfacePoints.push(point);

    // Create lines if we have more than one point
    if (this.surfacePoints.length > 1) {
      const prevPoint = this.surfacePoints[this.surfacePoints.length - 2];

      // Create horizontal lines (between frequencies)
      for (let i = 0; i < this.numBands - 1; i++) {
        const geometry = new THREE.BufferGeometry().setFromPoints([
          point.positions[i],
          point.positions[i + 1],
        ]);
        const material = new THREE.LineBasicMaterial({
          color: 0x00ffff,
          transparent: true,
          opacity: 0.8,
          linewidth: 3,
        });
        const line = new THREE.Line(geometry, material);
        this.surfaceLines.push(line);
        this.scene.add(line);
      }

      // Create vertical lines (between time points)
      for (let i = 0; i < this.numBands; i++) {
        const geometry = new THREE.BufferGeometry().setFromPoints([
          prevPoint.positions[i],
          point.positions[i],
        ]);
        const material = new THREE.LineBasicMaterial({
          color: 0x00ffff,
          transparent: true,
          opacity: 0.8,
          linewidth: 3,
        });
        const line = new THREE.Line(geometry, material);
        this.surfaceLines.push(line);
        this.scene.add(line);
      }
    }

    return point;
  }

  start() {
    this.isStarted = true;
    this.lastLayerTime = performance.now();
    this.lastSurfacePointTime = performance.now();
  }

  update(time) {
    if (!this.isStarted) return;

    // Get frequency data
    this.analyser.getByteFrequencyData(this.dataArray);
    const bands = this.calculateFrequencyBands();

    // Move forward
    this.currentZ += this.scrollSpeed * (1 / 60);

    // Create new surface point if enough time has passed
    const timeSinceLastSurfacePoint = (time - this.lastSurfacePointTime) / 1000;
    if (timeSinceLastSurfacePoint >= this.surfaceSpacing) {
      this.createSurfacePoint(this.currentZ);
      this.lastSurfacePointTime = time;

      // Update all surface points and lines
      this.surfacePoints.forEach((point, index) => {
        point.positions.forEach((pos, i) => {
          const value = bands[i];
          const x = this.getFrequencyPosition(i);
          const y = (value / 255) * 3;
          pos.set(x, y, point.z);
        });
      });

      // Update line colors and positions
      this.surfaceLines.forEach((line, index) => {
        const positions = line.geometry.attributes.position;
        positions.needsUpdate = true;

        // Update line color based on average amplitude of its endpoints
        const startPos = new THREE.Vector3().fromBufferAttribute(positions, 0);
        const endPos = new THREE.Vector3().fromBufferAttribute(positions, 1);
        const avgY = (startPos.y + endPos.y) / 2;
        const intensity = Math.min(avgY / 3, 1);

        // Create a color gradient from blue to cyan to white
        const hue = 0.5 + intensity * 0.1; // Start from cyan (0.5) and move slightly towards blue
        const saturation = 1 - intensity * 0.5; // Decrease saturation as intensity increases
        const lightness = 0.5 + intensity * 0.5; // Increase lightness with intensity

        line.material.color.setHSL(hue, saturation, lightness);
        line.material.opacity = 0.3 + intensity * 0.7;
      });
    }
  }

  calculateFrequencyBands() {
    const bands = new Array(this.numBands).fill(0);
    const minFreq = 20; // 20 Hz
    const maxFreq = 20000; // 20 kHz
    const logMin = Math.log(minFreq);
    const logMax = Math.log(maxFreq);
    const logStep = (logMax - logMin) / this.numBands;

    for (let i = 0; i < this.numBands; i++) {
      const startFreq = Math.exp(logMin + i * logStep);
      const endFreq = Math.exp(logMin + (i + 1) * logStep);

      // Find corresponding indices in the frequency data
      const startIndex = Math.floor(
        (startFreq * this.bufferLength) / this.audioContext.sampleRate
      );
      const endIndex = Math.floor(
        (endFreq * this.bufferLength) / this.audioContext.sampleRate
      );

      // Calculate average amplitude for this band
      let sum = 0;
      let count = 0;
      for (let j = startIndex; j < endIndex && j < this.bufferLength; j++) {
        sum += this.dataArray[j];
        count++;
      }
      bands[i] = count > 0 ? sum / count : 0;
    }

    return bands;
  }

  getFrequencyPosition(bandIndex) {
    // Convert band index to logarithmic frequency position
    const minFreq = 20; // 20 Hz
    const maxFreq = 20000; // 20 kHz
    const logMin = Math.log(minFreq);
    const logMax = Math.log(maxFreq);
    const logStep = (logMax - logMin) / this.numBands;

    const freq = Math.exp(logMin + bandIndex * logStep);
    return (bandIndex / this.numBands) * 10 - 5; // Scale to -5 to 5 range
  }

  getMesh() {
    const group = new THREE.Group();
    this.layers.forEach((layer) => {
      layer.spheres.forEach((sphere) => {
        group.add(sphere);
      });
    });
    return group;
  }
}
