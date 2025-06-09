class GalaxyMap {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.controls = null;
    this.points = [];
    this.currentYear = 1992;
    this.isPlaying = false;
    this.animationFrameId = null;

    // Facteurs d'échelle pour les coordonnées
    this.distanceScale = 5; // Augmenter l'échelle des distances
    this.radiusScale = 2; // Augmenter l'échelle des rayons des planètes

    this.init();
    this.loadData();
  }

  init() {
    // Configuration du renderer
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000);
    document.body.appendChild(this.renderer.domElement);

    // Configuration de la caméra
    this.camera.position.z = 5;
    this.camera.position.y = 5;
    this.camera.position.x = 5;

    // Contrôles de la caméra
    this.controls = new THREE.OrbitControls(
      this.camera,
      this.renderer.domElement
    );
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // Grille de référence
    const gridHelper = new THREE.GridHelper(20, 20);
    this.scene.add(gridHelper);

    // Gestion du redimensionnement
    window.addEventListener("resize", () => this.onWindowResize(), false);

    // Gestion des contrôles
    this.setupControls();
  }

  setupControls() {
    const playPauseBtn = document.getElementById("play-pause");
    const timeline = document.getElementById("timeline");
    const yearDisplay = document.getElementById("year-display");
    const resetBtn = document.getElementById("reset");

    playPauseBtn.addEventListener("click", () => this.togglePlayPause());
    timeline.addEventListener("input", (e) => {
      this.currentYear = parseInt(e.target.value);
      yearDisplay.textContent = this.currentYear;
      this.updatePlanetsVisibility();
    });
    resetBtn.addEventListener("click", () => this.reset());
  }

  async loadData() {
    try {
      const response = await fetch("data.csv");
      const csvText = await response.text();

      const results = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
      });

      if (!results.data || !Array.isArray(results.data)) {
        console.error("CSV parsing failed:", results);
        throw new Error("Failed to parse CSV data");
      }

      console.log("Data loaded:", results.data);
      this.createPlanets(results.data);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }

  createPlanets(planets) {
    const geometry = new THREE.SphereGeometry(0.1, 16, 16);
    const material = new THREE.MeshPhongMaterial({
      shininess: 100,
      specular: 0x444444,
    });

    // Ajouter une lumière
    const light = new THREE.PointLight(0xffffff, 1, 100);
    light.position.set(10, 10, 10);
    this.scene.add(light);

    // Ajouter une lumière ambiante
    const ambientLight = new THREE.AmbientLight(0x404040);
    this.scene.add(ambientLight);

    // Trouver les valeurs min/max pour la normalisation
    const distances = planets.map((p) => p.sy_dist).filter((d) => d);
    const minDist = Math.min(...distances);
    const maxDist = Math.max(...distances);
    console.log("Distance range:", { min: minDist, max: maxDist });

    planets.forEach((planet) => {
      if (planet.ra && planet.dec && planet.sy_dist) {
        // Normaliser la distance
        const normalizedDist = (planet.sy_dist - minDist) / (maxDist - minDist);
        const scaledDist = normalizedDist * this.distanceScale;

        // Conversion des coordonnées sphériques en cartésiennes
        // RA est en heures (0-24), convertir en radians
        const raRad = (planet.ra * Math.PI) / 12;
        // Dec est en degrés (-90 à 90), convertir en radians
        const decRad = (planet.dec * Math.PI) / 180;

        const x = scaledDist * Math.cos(decRad) * Math.cos(raRad);
        const y = scaledDist * Math.cos(decRad) * Math.sin(raRad);
        const z = scaledDist * Math.sin(decRad);

        console.log("Planet position:", {
          name: planet.pl_name,
          x,
          y,
          z,
          ra: planet.ra,
          dec: planet.dec,
          dist: planet.sy_dist,
        });

        // Création du point
        const point = new THREE.Mesh(geometry, material.clone());
        point.position.set(x, y, z);

        // Taille basée sur le rayon de la planète
        const scale = planet.pl_radj
          ? Math.max(0.2, Math.min(3, planet.pl_radj * this.radiusScale) / 8)
          : 0.2;
        point.scale.set(scale, scale, scale);

        // Couleur basée sur la température
        const temp = planet.pl_eqt || planet.pl_insol || 0;
        const color = this.getTemperatureColor(temp);
        point.material.color.set(color);

        // Stockage des données de la planète
        point.userData = {
          discoveryYear: planet.disc_year || 1992,
          name: planet.pl_name || "Unknown",
          temperature: temp,
        };

        this.points.push(point);
        this.scene.add(point);
      }
    });

    console.log("Total points created:", this.points.length);
    // Ajustement de la caméra pour voir tous les points
    this.fitCameraToPoints();
  }

  getTemperatureColor(temp) {
    // Échelle de couleur du bleu (froid) au rouge (chaud)
    const normalizedTemp = Math.min(1, Math.max(0, temp / 2000));
    return new THREE.Color(normalizedTemp, 0.5, 1 - normalizedTemp);
  }

  fitCameraToPoints() {
    const box = new THREE.Box3().setFromObjects(this.points);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    console.log("Scene bounds:", {
      center: center,
      size: size,
    });

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));

    this.camera.position.z = cameraZ * 1.5;
    this.camera.lookAt(center);

    console.log("Camera position:", this.camera.position);
  }

  updatePlanetsVisibility() {
    this.points.forEach((point) => {
      point.visible = point.userData.discoveryYear <= this.currentYear;
    });
  }

  togglePlayPause() {
    this.isPlaying = !this.isPlaying;
    if (this.isPlaying) {
      this.animate();
    } else {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  reset() {
    this.currentYear = 1992;
    document.getElementById("timeline").value = this.currentYear;
    document.getElementById("year-display").textContent = this.currentYear;
    this.updatePlanetsVisibility();
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    if (this.isPlaying) {
      this.currentYear = Math.min(2024, this.currentYear + 0.025); // Ralenti 4x (0.1/4)
      document.getElementById("timeline").value = Math.floor(this.currentYear);
      document.getElementById("year-display").textContent = Math.floor(
        this.currentYear
      );
      this.updatePlanetsVisibility();
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// Initialisation de la visualisation
const galaxyMap = new GalaxyMap();
