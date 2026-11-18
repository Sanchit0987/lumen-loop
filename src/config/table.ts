/** Regulation table, net and arena dimensions in metres. Origin is the table centre on the floor. */
export const TABLE = {
  length: 2.74,
  width: 1.525,
  /** Height of the playing surface above the floor. */
  surfaceHeight: 0.76,
  thickness: 0.025,
  lineWidth: 0.02,
  centreLineWidth: 0.003,
  legInset: 0.35,
  legSize: 0.06,
  apronDrop: 0.07,
} as const;

export const NET = {
  height: 0.1525,
  overhang: 0.1525,
  thickness: 0.012,
  postRadius: 0.012,
  tapeHeight: 0.015,
} as const;

export const ARENA = {
  floorHalfSize: 14,
  courtHalfWidth: 3.6,
  courtHalfLength: 6.2,
  barrierHeight: 0.75,
  barrierThickness: 0.06,
  wallHeight: 11,
  standRows: 7,
  standRowDepth: 0.85,
  standRowRise: 0.5,
  standGap: 1.6,
  lightRigHeight: 7.2,
} as const;

export const TABLE_HALF_LENGTH = TABLE.length / 2;
export const TABLE_HALF_WIDTH = TABLE.width / 2;
export const NET_HALF_WIDTH = TABLE_HALF_WIDTH + NET.overhang;
export const NET_TOP = TABLE.surfaceHeight + NET.height;
