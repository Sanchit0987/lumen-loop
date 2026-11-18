import type { Vec3 } from '../math/vec3';
import type { PlayerIndex } from '../physics/types';
import type { PointReason } from '../rules/referee';

export type SimEvent =
  | { type: 'hit'; player: PlayerIndex; point: Vec3; speed: number; power: number; topspin: number; sidespin: number; serve: boolean; legal: boolean }
  | { type: 'bounce'; point: Vec3; speed: number; side: PlayerIndex }
  | { type: 'net'; point: Vec3; speed: number }
  | { type: 'floor'; point: Vec3; speed: number }
  | { type: 'edge'; point: Vec3; speed: number }
  | { type: 'toss'; player: PlayerIndex }
  | { type: 'serveReady'; server: PlayerIndex }
  | { type: 'let' }
  | {
      type: 'point'; winner: PlayerIndex; reason: PointReason; strokes: number;
      gameWonBy: PlayerIndex | null; matchWonBy: PlayerIndex | null;
    };
