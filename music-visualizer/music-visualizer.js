// Music visualization manager
class MusicVisualizer {
  constructor(scene) {
    this.scene = scene;
    this.spheres = [];
    this.data = [];
    this.currentTimeStep = 0;
    this.isPlaying = false;
    this.animationFrameId = null;
  }

  reset() {
    // Remove all spheres from the scene
    this.spheres.forEach((sphere) => {
      this.scene.remove(sphere);
    });
    this.spheres = [];
    this.data = [];
    this.currentTimeStep = 0;
    this.isPlaying = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  getMaxValue() {
    return 5; // Maximum value for axes scaling
  }
}

// Export the visualizer class
window.MusicVisualizer = MusicVisualizer;
