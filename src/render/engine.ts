import { Engine, WebGPUEngine, type AbstractEngine } from '@babylonjs/core';

export type RendererKind = 'webgpu' | 'webgl2';

export interface EngineHandle {
  engine: AbstractEngine;
  kind: RendererKind;
  canvas: HTMLCanvasElement;
}

async function webgpuAvailable(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    return (await gpu.requestAdapter()) !== null;
  } catch {
    return false;
  }
}

/** Creates a WebGPU engine when an adapter exists, otherwise (or on failure) a WebGL2 engine. */
export async function createEngine(canvas: HTMLCanvasElement, prefer: RendererKind | null): Promise<EngineHandle> {
  if (prefer !== 'webgl2' && (await webgpuAvailable())) {
    try {
      const engine = new WebGPUEngine(canvas, { antialias: true, stencil: false, adaptToDeviceRatio: false });
      await engine.initAsync();
      return { engine, kind: 'webgpu', canvas };
    } catch (error) {
      console.warn('WebGPU initialisation failed, falling back to WebGL2.', error);
      // A canvas that handed out a WebGPU context cannot create a WebGL one, so swap it.
      const fresh = canvas.cloneNode(false) as HTMLCanvasElement;
      canvas.replaceWith(fresh);
      canvas = fresh;
    }
  }
  const engine = new Engine(canvas, true, { stencil: false, powerPreference: 'high-performance', adaptToDeviceRatio: false });
  return { engine, kind: 'webgl2', canvas };
}
