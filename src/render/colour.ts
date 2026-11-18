import { Color3 } from '@babylonjs/core';

/** sRGB hex string to the linear colour PBR materials expect. */
export const linear = (hex: string): Color3 => Color3.FromHexString(hex).toLinearSpace();
