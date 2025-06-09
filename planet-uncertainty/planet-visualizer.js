class PlanetVisualizer {
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
    this.planets = [];
    this.uncertaintyLines = [];
    this.uncertaintyEllipsoids = [];
    this.data = null;
    this.maxValues = {
      orbitalPeriod: 0,
      radius: 0,
      mass: 0,
    };
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredPlanet = null;
    this.tooltip = null;

    this.init();
  }

  init() {
    // Setup renderer
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000);
    document.body.appendChild(this.renderer.domElement);

    // Setup camera
    this.camera.position.set(5, 5, 5);
    this.camera.lookAt(0, 0, 0);

    // Setup controls
    this.controls = new THREE.OrbitControls(
      this.camera,
      this.renderer.domElement
    );
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(5, 5, 5);
    this.scene.add(pointLight);

    // Add axes helper
    this.axesHelper = new AxesHelper(this.scene, {
      xLabel: "Orbital Period",
      yLabel: "Planet Radius",
      zLabel: "Planet Mass",
      sizes: {
        x: 10,
        y: 10,
        z: 10,
      },
    });

    // Create UI
    this.createUI();

    // Setup event listeners
    window.addEventListener("resize", () => this.onWindowResize(), false);
    window.addEventListener(
      "mousemove",
      (event) => this.onMouseMove(event),
      false
    );
    window.addEventListener("click", (event) => this.onClick(event), false);

    // Create tooltip
    this.createTooltip();

    // Load data and start animation
    this.loadData().then(() => {
      this.animate();
    });
  }

  createUI() {
    // Create container
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.top = "10px";
    container.style.left = "10px";
    container.style.color = "white";
    container.style.fontFamily = "Arial, sans-serif";
    container.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    container.style.padding = "10px";
    container.style.borderRadius = "5px";

    // Create filters container
    const filters = document.createElement("div");
    filters.innerHTML = `
      <h3>Filters</h3>
      <div>
        <label>
          <input type="checkbox" id="showEllipsoids" checked>
          Show Uncertainty Ellipsoids
        </label>
      </div>
      <div>
        <label>
          <input type="checkbox" id="showLines" checked>
          Show Uncertainty Lines
        </label>
      </div>
      <div>
        <label>
          <input type="checkbox" id="showPlanets" checked>
          Show Planets
        </label>
      </div>
    `;
    container.appendChild(filters);
    document.body.appendChild(container);

    // Add event listeners for filters after elements are in the DOM
    const showEllipsoids = document.getElementById("showEllipsoids");
    const showLines = document.getElementById("showLines");
    const showPlanets = document.getElementById("showPlanets");

    if (showEllipsoids) {
      showEllipsoids.addEventListener("change", (e) => {
        this.uncertaintyEllipsoids.forEach((ellipsoid) => {
          ellipsoid.visible = e.target.checked;
        });
      });
    }

    if (showLines) {
      showLines.addEventListener("change", (e) => {
        this.uncertaintyLines.forEach((line) => {
          line.visible = e.target.checked;
        });
      });
    }

    if (showPlanets) {
      showPlanets.addEventListener("change", (e) => {
        this.planets.forEach((planet) => {
          planet.visible = e.target.checked;
        });
      });
    }
  }

  createTooltip() {
    this.tooltip = document.createElement("div");
    this.tooltip.style.position = "absolute";
    this.tooltip.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    this.tooltip.style.color = "white";
    this.tooltip.style.padding = "10px";
    this.tooltip.style.borderRadius = "5px";
    this.tooltip.style.fontFamily = "Arial, sans-serif";
    this.tooltip.style.pointerEvents = "none";
    this.tooltip.style.display = "none";
    document.body.appendChild(this.tooltip);
  }

  onMouseMove(event) {
    // Calculate mouse position in normalized device coordinates
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the picking ray with the camera and mouse position
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Calculate objects intersecting the picking ray
    const intersects = this.raycaster.intersectObjects(this.planets);

    if (intersects.length > 0) {
      const planet = intersects[0].object;
      const planetData = planet.userData;

      if (this.hoveredPlanet !== planet) {
        this.hoveredPlanet = planet;

        // Update tooltip content
        this.tooltip.innerHTML = `
          <strong>Planet Data:</strong><br>
          Orbital Period: ${planetData.pl_orbper?.toFixed(2)} days<br>
          Radius: ${planetData.pl_rade?.toFixed(2)} Earth radii<br>
          Mass: ${planetData.pl_bmasse?.toFixed(2)} Earth masses<br>
          <br>
          <strong>Uncertainties:</strong><br>
          Period: ±${planetData.pl_orbpererr1?.toFixed(2)} days<br>
          Radius: ±${planetData.pl_radeerr1?.toFixed(2)} Earth radii<br>
          Mass: ±${planetData.pl_bmasseerr1?.toFixed(2)} Earth masses
        `;

        this.tooltip.style.display = "block";
      }

      // Update tooltip position
      this.tooltip.style.left = event.clientX + 10 + "px";
      this.tooltip.style.top = event.clientY + 10 + "px";
    } else {
      this.hoveredPlanet = null;
      this.tooltip.style.display = "none";
    }
  }

  onClick(event) {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.planets);

    if (intersects.length > 0) {
      const planet = intersects[0].object;
      // Toggle ellipsoid visibility for clicked planet
      const ellipsoid = planet.userData.ellipsoid;
      if (ellipsoid) {
        ellipsoid.visible = !ellipsoid.visible;
      }
    }
  }

  createUncertaintyEllipsoid(planet, data) {
    const x = planet.position.x;
    const y = planet.position.y;
    const z = planet.position.z;

    // Calculate uncertainty scales
    const xError = this.normalizeValue(
      Math.abs(data.pl_orbpererr1 || 0),
      this.maxValues.orbitalPeriod
    );
    const yError = this.normalizeValue(
      Math.abs(data.pl_radeerr1 || 0),
      this.maxValues.radius
    );
    const zError = this.normalizeValue(
      Math.abs(data.pl_bmasseerr1 || 0),
      this.maxValues.mass
    );

    // Create ellipsoid geometry
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const material = new THREE.MeshPhongMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.2,
      wireframe: true,
    });

    const ellipsoid = new THREE.Mesh(geometry, material);
    ellipsoid.position.set(x, y, z);
    ellipsoid.scale.set(xError, yError, zError);

    this.scene.add(ellipsoid);
    this.uncertaintyEllipsoids.push(ellipsoid);
    planet.userData.ellipsoid = ellipsoid;
  }

  createPlanets() {
    // Clear existing objects
    this.planets.forEach((planet) => this.scene.remove(planet));
    this.uncertaintyLines.forEach((line) => this.scene.remove(line));
    this.uncertaintyEllipsoids.forEach((ellipsoid) =>
      this.scene.remove(ellipsoid)
    );
    this.planets = [];
    this.uncertaintyLines = [];
    this.uncertaintyEllipsoids = [];

    // Create new planets
    this.data.forEach((planet) => {
      // Create planet sphere
      const geometry = new THREE.SphereGeometry(0.1, 32, 32);
      const material = new THREE.MeshPhongMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.8,
      });
      const sphere = new THREE.Mesh(geometry, material);

      // Store planet data in userData
      sphere.userData = planet;

      // Position planet
      const x = this.normalizeValue(
        planet.pl_orbper,
        this.maxValues.orbitalPeriod
      );
      const y = this.normalizeValue(planet.pl_rade, this.maxValues.radius);
      const z = this.normalizeValue(planet.pl_bmasse, this.maxValues.mass);
      sphere.position.set(x, y, z);

      this.scene.add(sphere);
      this.planets.push(sphere);

      // Create uncertainty visualization
      this.createUncertaintyLines(sphere, planet);
      this.createUncertaintyEllipsoid(sphere, planet);
    });
  }

  createUncertaintyLines(planet, data) {
    const x = planet.position.x;
    const y = planet.position.y;
    const z = planet.position.z;

    // Create lines for each dimension's uncertainty
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.5,
    });

    // X-axis uncertainty (orbital period)
    if (data.pl_orbpererr1) {
      const xError = this.normalizeValue(
        Math.abs(data.pl_orbpererr1),
        this.maxValues.orbitalPeriod
      );
      const xGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x - xError, y, z),
        new THREE.Vector3(x + xError, y, z),
      ]);
      const xLine = new THREE.Line(xGeometry, lineMaterial);
      this.scene.add(xLine);
      this.uncertaintyLines.push(xLine);
    }

    // Y-axis uncertainty (radius)
    if (data.pl_radeerr1) {
      const yError = this.normalizeValue(
        Math.abs(data.pl_radeerr1),
        this.maxValues.radius
      );
      const yGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, y - yError, z),
        new THREE.Vector3(x, y + yError, z),
      ]);
      const yLine = new THREE.Line(yGeometry, lineMaterial);
      this.scene.add(yLine);
      this.uncertaintyLines.push(yLine);
    }

    // Z-axis uncertainty (mass)
    if (data.pl_bmasseerr1) {
      const zError = this.normalizeValue(
        Math.abs(data.pl_bmasseerr1),
        this.maxValues.mass
      );
      const zGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, y, z - zError),
        new THREE.Vector3(x, y, z + zError),
      ]);
      const zLine = new THREE.Line(zGeometry, lineMaterial);
      this.scene.add(zLine);
      this.uncertaintyLines.push(zLine);
    }
  }

  normalizeValue(value, max) {
    return (value / max) * 10; // Scale to fit in 10x10x10 space
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  async loadData() {
    try {
      console.log("Loading data...");

      // Add Papa Parse CDN script dynamically
      //   await new Promise((resolve, reject) => {
      //     const script = document.createElement('script');
      //     script.src = "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.0/papaparse.min.js";
      //     script.onload = resolve;
      //     script.onerror = reject;
      //     document.head.appendChild(script);
      //   });

      // Load and parse CSV data
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

      this.data = results.data
        .filter(
          (planet, i) =>
            !!planet.pl_orbper && !!planet.pl_rade && !!planet.pl_bmasse
        )
        .filter(
          (planet, i) =>
            !!planet.pl_bmasseerr1 &&
            !!planet.pl_orbpererr1 &&
            !!planet.pl_radeerr1
        )
        .filter((planet, i) => planet.pl_orbper <= 100);
      console.log("Number of planets:", this.data.length);

      // Calculate max values for normalization
      this.data.forEach((planet) => {
        // this.maxValues.orbitalPeriod = Math.max(
        //   this.maxValues.orbitalPeriod,
        //   planet.pl_orbper || 0
        // );
        this.maxValues.orbitalPeriod = 100;
        this.maxValues.radius = Math.max(
          this.maxValues.radius,
          planet.pl_rade || 0
        );
        this.maxValues.mass = Math.max(
          this.maxValues.mass,
          planet.pl_bmasse || 0
        );
      });

      console.log("Max values:", this.maxValues);

      // Create planets and uncertainty lines
      this.createPlanets();
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }
}

// Initialize the visualizer
const visualizer = new PlanetVisualizer();
