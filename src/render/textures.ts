import { DynamicTexture, Texture, type Scene } from '@babylonjs/core';
import { COLOURS, CROWD, SURFACE_LOOK } from '../config/graphics';
import { TABLE } from '../config/table';
import { createRng } from '../math/random';

const ASSET_ROOT = `${import.meta.env.BASE_URL}assets/`;
export const assetUrl = (path: string): string => ASSET_ROOT + path;

const TEXTURE_SEED = 20261117;
const FULL_TURN = Math.PI * 2;

export function loadTexture(scene: Scene, file: string, tiling: number, anisotropy: number): Texture {
  const t = new Texture(assetUrl(`textures/${file}`), scene, false, false);
  t.uScale = tiling;
  t.vScale = tiling;
  t.anisotropicFilteringLevel = anisotropy;
  return t;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Painted table top: flat colour with real wood grain showing through the paint, plus the white
 * edge lines and centre line at regulation widths. Texture v runs along the table length.
 */
export async function createTableTopTexture(scene: Scene, anisotropy: number): Promise<DynamicTexture> {
  const w = SURFACE_LOOK.tableTextureWidth;
  const h = SURFACE_LOOK.tableTextureHeight;
  const tex = new DynamicTexture('tableTop', { width: w, height: h }, scene, true);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = COLOURS.tableTop;
  ctx.fillRect(0, 0, w, h);
  const grain = await loadImage(assetUrl('textures/fine_grained_wood_col_1k.jpg'));
  if (grain) {
    ctx.save();
    ctx.globalAlpha = SURFACE_LOOK.grainOpacity;
    ctx.globalCompositeOperation = 'luminosity';
    for (let y = 0; y < h; y += w) ctx.drawImage(grain, 0, y, w, w);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 1 - SURFACE_LOOK.grainOpacity / 2;
    ctx.globalCompositeOperation = 'color';
    ctx.fillStyle = COLOURS.tableTop;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  const line = (TABLE.lineWidth / TABLE.width) * w;
  const lineV = (TABLE.lineWidth / TABLE.length) * h;
  const centre = Math.max(1, (TABLE.centreLineWidth / TABLE.width) * w);
  ctx.fillStyle = COLOURS.tableLine;
  ctx.fillRect(0, 0, line, h);
  ctx.fillRect(w - line, 0, line, h);
  ctx.fillRect(0, 0, w, lineV);
  ctx.fillRect(0, h - lineV, w, lineV);
  ctx.fillRect((w - centre) / 2, 0, centre, h);
  tex.update();
  tex.anisotropicFilteringLevel = anisotropy;
  return tex;
}

/** A strip of softly blurred spectators: heads and shoulders in muted colours on darkness. */
export function createCrowdTexture(scene: Scene, seed: number): DynamicTexture {
  const { textureWidth: w, textureHeight: h } = CROWD;
  const tex = new DynamicTexture(`crowd${seed}`, { width: w, height: h }, scene, true);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  const rng = createRng(TEXTURE_SEED + seed);
  ctx.fillStyle = COLOURS.stand;
  ctx.fillRect(0, 0, w, h);
  ctx.filter = `blur(${CROWD.blurPixels}px)`;
  const slot = w / CROWD.peoplePerRow;
  for (let i = 0; i < CROWD.peoplePerRow; i++) {
    if (rng.chance(1 / 9)) continue;
    const x = (i + rng.range(0.3, 0.7)) * slot;
    const hue = rng.pick(CROWD.hues) + rng.range(-10, 10);
    const light = rng.range(22, 52) * CROWD.brightness * 2;
    const headY = h * rng.range(0.24, 0.36);
    const headR = slot * rng.range(0.24, 0.3);
    ctx.fillStyle = `hsl(${hue} ${rng.range(25, 60)}% ${light}%)`;
    ctx.beginPath();
    ctx.ellipse(x, h * 0.9, slot * 0.5, h * 0.48, 0, 0, FULL_TURN);
    ctx.fill();
    ctx.fillStyle = `hsl(${rng.range(16, 34)} ${rng.range(25, 50)}% ${rng.range(28, 62)}%)`;
    ctx.beginPath();
    ctx.arc(x, headY, headR, 0, FULL_TURN);
    ctx.fill();
    ctx.fillStyle = `hsl(${rng.range(15, 45)} 30% ${rng.range(6, 30)}%)`;
    ctx.beginPath();
    ctx.arc(x, headY - headR * 0.35, headR * 0.95, Math.PI, FULL_TURN);
    ctx.fill();
  }
  ctx.filter = 'none';
  tex.update();
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  return tex;
}

/** Text banner for the court surrounds. */
export function createBannerTexture(scene: Scene, text: string, width: number, height: number): DynamicTexture {
  const tex = new DynamicTexture(`banner-${text}`, { width, height }, scene, true);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = COLOURS.barrier;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = COLOURS.barrierText;
  ctx.font = `800 ${Math.round(height * 0.52)}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Drawn upside down because box-face UVs run top-to-bottom in the right-handed scene.
  ctx.translate(0, height);
  ctx.scale(1, -1);
  ctx.fillText(text, width / 2, height * 0.54);
  tex.update();
  return tex;
}

/** Net mesh: a fine grid with transparent holes. */
export function createNetTexture(scene: Scene, size: number, cells: number): DynamicTexture {
  const tex = new DynamicTexture('net', { width: size, height: size }, scene, true);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = COLOURS.netTape;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(1, size / cells / 5);
  const step = size / cells;
  for (let i = 0; i <= cells; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0); ctx.lineTo(i * step, size);
    ctx.moveTo(0, i * step); ctx.lineTo(size, i * step);
    ctx.stroke();
  }
  tex.update();
  tex.hasAlpha = true;
  return tex;
}

/** Small maker's mark so the ball's spin is visible. */
export function createBallTexture(scene: Scene, size: number): DynamicTexture {
  const tex = new DynamicTexture('ball', { width: size * 2, height: size }, scene, true);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = COLOURS.ball;
  ctx.fillRect(0, 0, size * 2, size);
  ctx.fillStyle = COLOURS.ballMark;
  ctx.font = `800 ${Math.round(size * 0.16)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const u of [0.25, 0.75]) {
    ctx.fillText('LUMEN', size * 2 * u, size * 0.44);
    ctx.fillText('\u2605\u2605\u2605', size * 2 * u, size * 0.6);
  }
  tex.update();
  return tex;
}
