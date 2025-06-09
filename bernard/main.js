// main.js avec aspect ratio dynamique et taille logique synchronisée

import GUI from "https://cdn.jsdelivr.net/npm/lil-gui@0.18/+esm";

if (!navigator.gpu) {
  alert("WebGPU n'est pas supporté par ce navigateur.");
  throw new Error("WebGPU non supporté");
}

const canvas = document.querySelector("canvas");
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const context = canvas.getContext("webgpu");

const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format, alphaMode: "opaque" });

const settings = {
  kappa: 0.01,
  beta: 0.01,
  stepsPerFrame: 1,
  aspectRatio: 2.0,
  baseResolution: 256,
};

const gui = new GUI();
gui.add(settings, "kappa", 0.0001, 0.1, 0.0001);
gui.add(settings, "beta", 0.0, 0.1, 0.001);
gui.add(settings, "stepsPerFrame", 1, 20, 1);
gui.add(settings, "aspectRatio", 2, 6.0, 0.01).onChange(() => {
  recreateBuffersAndPipeline();
});

gui.add(settings, "baseResolution", 64, 1024, 32).onChange(() => {
  recreateBuffersAndPipeline();
});

let temperatureBuffer, velocityBuffer, temperatureTexture;
let computeBindGroup, computePipeline, renderBindGroup, renderPipeline;
let sizeX, sizeY;

const uniformBuffer = device.createBuffer({
  size: 8,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

function recreateBuffersAndPipeline() {
  sizeX = settings.baseResolution;
  sizeY = Math.round(sizeX / settings.aspectRatio);

  canvas.width = sizeX;
  canvas.height = sizeY;
  canvas.style.width = `${window.innerWidth - 100}px`;
  canvas.style.height = `${(window.innerWidth - 100) / settings.aspectRatio}px`;

  temperatureBuffer = device.createBuffer({
    size: sizeX * sizeY * 4,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(temperatureBuffer.getMappedRange()).fill(0.5);
  temperatureBuffer.unmap();

  velocityBuffer = device.createBuffer({
    size: sizeX * sizeY * 8,
    usage: GPUBufferUsage.STORAGE,
  });

  temperatureTexture = device.createTexture({
    size: [sizeX, sizeY],
    format: "r32float",
    usage:
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const computeShaderCode = `
    struct Uniforms {
      kappa: f32,
      beta: f32,
    };
    @group(0) @binding(0) var<storage, read_write> temperature : array<f32>;
    @group(0) @binding(1) var<storage, read_write> velocity : array<vec2<f32>>;
    @group(0) @binding(2) var<uniform> uniforms : Uniforms;

    @compute @workgroup_size(8, 8)
    fn main(@builtin(global_invocation_id) id : vec3<u32>) {
      let sizeX = ${sizeX}u;
      let sizeY = ${sizeY}u;
      let x = id.x;
      let y = id.y;
      if (x >= sizeX || y >= sizeY) { return; }

      let idx = y * sizeX + x;

      if (y == 0u) {
        temperature[idx] = 1.0;
        return;
      }
      if (y == sizeY - 1u) {
        temperature[idx] = 0.0;
        return;
      }

      let xi = i32(x);
      let yi = i32(y);
      let sx = i32(sizeX);

      let left   = temperature[yi * sx + max(xi - 1, 0)];
      let right  = temperature[yi * sx + min(xi + 1, sx - 1)];
      let top    = temperature[max(yi - 1, 0) * sx + xi];
      let bottom = temperature[min(yi + 1, sx - 1) * sx + xi];
      let center = temperature[idx];

      let laplacian = left + right + top + bottom - 4.0 * center;
      temperature[idx] = center + uniforms.kappa * laplacian;

      let g = -1.0;
      let forceY = uniforms.beta * (center - 0.5) * g;
      velocity[idx].y += forceY * 0.1;
    }
  `;

  const computeModule = device.createShaderModule({ code: computeShaderCode });
  computePipeline = device.createComputePipeline({
    layout: "auto",
    compute: {
      module: computeModule,
      entryPoint: "main",
    },
  });

  computeBindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: temperatureBuffer } },
      { binding: 1, resource: { buffer: velocityBuffer } },
      { binding: 2, resource: { buffer: uniformBuffer } },
    ],
  });

  const renderShaderCode = `
    @vertex
    fn vs_main(@builtin(vertex_index) index: u32) -> @builtin(position) vec4<f32> {
      var pos = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
        vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0)
      );
      return vec4<f32>(pos[index], 0.0, 1.0);
    }

    @group(0) @binding(0) var temperatureTex: texture_2d<f32>;

    @fragment
    fn fs_main(@builtin(position) coord: vec4<f32>) -> @location(0) vec4<f32> {
      let t = textureLoad(temperatureTex, vec2<i32>(coord.xy), 0).r;
      return vec4<f32>(t, t * 0.5, 1.0 - t, 1.0);
    }
  `;

  const renderModule = device.createShaderModule({ code: renderShaderCode });
  renderPipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: renderModule,
      entryPoint: "vs_main",
    },
    fragment: {
      module: renderModule,
      entryPoint: "fs_main",
      targets: [{ format }],
    },
    primitive: { topology: "triangle-list" },
  });

  renderBindGroup = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: temperatureTexture.createView() }],
  });
}

function frame() {
  const uniformArray = new Float32Array([settings.kappa, settings.beta]);
  device.queue.writeBuffer(uniformBuffer, 0, uniformArray.buffer);

  const encoder = device.createCommandEncoder();

  for (let i = 0; i < settings.stepsPerFrame; i++) {
    const pass = encoder.beginComputePass();
    pass.setPipeline(computePipeline);
    pass.setBindGroup(0, computeBindGroup);
    pass.dispatchWorkgroups(Math.ceil(sizeX / 8), Math.ceil(sizeY / 8));
    pass.end();
  }

  encoder.copyBufferToTexture(
    {
      buffer: temperatureBuffer,
      bytesPerRow: sizeX * 4,
    },
    {
      texture: temperatureTexture,
    },
    [sizeX, sizeY]
  );

  const renderPass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        loadOp: "clear",
        storeOp: "store",
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
      },
    ],
  });

  renderPass.setPipeline(renderPipeline);
  renderPass.setBindGroup(0, renderBindGroup);
  renderPass.draw(6);
  renderPass.end();

  device.queue.submit([encoder.finish()]);
  requestAnimationFrame(frame);
}

recreateBuffersAndPipeline();
frame();
