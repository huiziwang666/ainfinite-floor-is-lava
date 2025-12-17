export const GAME_CONSTANTS = {
  // 3D World Units
  LANE_WIDTH: 3.5,
  PLAYER_SPEED_Z: 0.2, // Base forward speed (visual only, world moves)
  JUMP_HEIGHT: 3.5,
  JUMP_DURATION: 0.7, // Seconds
  GRAVITY: 20,
  
  // Difficulty
  START_SPEED: 15, // Units per second world movement
  MAX_SPEED: 40,
  SPEED_INCREMENT: 0.5, // Per 5 seconds or score interval
  SPAWN_DISTANCE: -60, // Where obstacles spawn (negative Z)
  SPAWN_INTERVAL_BASE: 1.5, // Seconds

  // Controls
  LANE_CHANGE_COOLDOWN: 400, // ms
  JUMP_COOLDOWN: 800, // ms

  // Pose Detection Thresholds
  LEAN_THRESHOLD_LEFT: 0.60, // Camera right (mirror)
  LEAN_THRESHOLD_RIGHT: 0.40, // Camera left (mirror)
  JUMP_THRESHOLD_Y: 0.05, // Rise relative to baseline

  // Lives & Damage
  INVINCIBILITY_DURATION: 2000, // ms
};

export const COLORS = {
  LAVA_EMISSIVE: 0xff3300,
  LAVA_CORE: 0xff0000,
  
  TRACK_MAIN: 0x333333,
  TRACK_STRIPE: 0x555555,
  
  ROBOT_TEAL: 0x20B2AA,
  ROBOT_ORANGE: 0xffaa00,
  ROBOT_METAL: 0xeeeeee,
  
  SKY_MINECRAFT: 0x87CEEB, // Standard Sky Blue
  SKY_HORIZON: 0xCFEFFF, // Lighter horizon
};