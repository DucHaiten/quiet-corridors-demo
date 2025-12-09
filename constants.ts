
export const MAP_SIZE = 500; // 500x500 maze
export const CELL_SIZE = 6; // Reduced to 6 for narrow, claustrophobic corridors
export const WALL_HEIGHT = 6;
export const PLAYER_HEIGHT = 1.6;
export const PLAYER_HEIGHT_CROUCH = 0.9; // New: Height when crouching

// GRAPHICS OPTIMIZATION CONSTANTS
export const CULL_DIST_SMALL = 30; // Items, Papers (Meters)
export const CULL_DIST_MEDIUM = 45; // Traps, Statues
export const CULL_DIST_LARGE = 60; // Walls

// MOVEMENT TUNING
// Reduced walk speed by 30% (55 -> 38.5)
export const PLAYER_SPEED = 38.5; 
// Adjusted multiplier to reduce run speed by ~20% total (Old run: 93.5, New run target: ~75)
export const RUN_SPEED_MULTI = 1.95; 
export const CROUCH_SPEED_MULTI = 0.6; // New: 60% speed when crouching

export const DASH_SPEED = 80; // Reduced from 90 to 80
export const DASH_DURATION = 80; // Reduced from 150 to 80 to cut distance in half

export const GRAVITY = 80; // Higher gravity for snappier jumps at high speed
export const JUMP_FORCE = 25;

// Enemies
export const ENEMY_SPEED = 18.0; // Scaled up for faster player
export const ENEMY_SPAWN_RATE = 4000; 
export const MAX_ENEMIES = 15;
export const ENEMY_MAX_HP = 100;

// Combat
export const BULLET_SPEED = 100;
export const WEAPON_DAMAGE = 35;
export const PLAYER_MAX_HP = 100;
export const WEAPON_REACH = 4.0; // INCREASED: 4.0m reach to match visual offset (Camera Stacking)

// Statue Constants
export const STATUE_COUNT = 8; // Increased to 8 (adds 3 more roaming angels)
export const STATUE_SPEED = 11.0; // Reduced from 15.0 to 11.0
export const STATUE_KILL_DIST = 1.5;
export const FOG_VISIBILITY_DIST = 40; // Matched to CULL_DIST_MEDIUM for seamless hiding

// Distribution Rules
export const STATUE_SAFE_ZONE_RADIUS = 100; // 100m radius safety for the random roamer
export const STATUE_MIN_SPACING = 70; // Statues must be far apart (Reduced to 70 to fit 5)

// Trap Constants
export const TRAP_MODEL_PATH = '/model/risen_claws_trap.glb';
export const TRAP_COUNT = 30; // Add 5 more hand traps for denser encounters
export const TRAP_MIN_SPACING = 50; // Increased from 30 to 50 to ensure even spread with fewer traps
export const TRAP_SAFE_ZONE_RADIUS = 50; // Radius around spawn where no traps will appear
export const TRAP_TRIGGER_DIST = 1.8; // Reduced to 1.8 to allow wall-hugging
export const TRAP_MAX_HP = 4;
export const TRAP_COOLDOWN_MS = 30000; // 30 seconds

// Paper Story Item
export const PAPER_MODEL_PATH = '/model/crumpled_paper.glb';
export const STICK_MODEL_PATH = '/model/a_stick.glb';
export const SONAR_MODEL_PATH = '/model/sonar_device.glb';
export const MAKAROV_MODEL_PATH = '/model/Makarov_PM.glb';
export const GLOCK17_MODEL_PATH = '/model/Combat_Master_Glock-17.glb';
export const PILL_BOTTLE_MODEL_PATH = '/model/Pill_Bottle.glb';
export const HEALTH_SOLUTION_MODEL_PATH = '/model/Health_Solution.glb';
export const DEAD_BODY_MODEL_PATH = '/model/dead_body_1.glb';
export const CZ88_MODEL_PATH = '/model/CZ-88.glb';

// Audio Paths & Settings
export const ANGEL_AUDIO_PATH = '/sounds/angel_cry.mp3';
export const MENU_BGM_PATH = '/sounds/menu_bgm.mp3';
export const MENU_BGM_2_PATH = '/sounds/menu_bgm_2.mp3';
export const LEVEL_1_BGM_PATH = '/sounds/map_1.mp3'; // New BGM for Level 1
export const FOOTSTEP_AUDIO_PATH = '/sounds/main_footstep.mp3'; // New Footstep Sound
export const PILL_BOTTLE_AUDIO_PATH = '/sounds/Pill_Bottle.mp3';
export const HEALTH_SOLUTION_AUDIO_PATH = '/sounds/Health_Solution.mp3';
export const UI_HOVER_AUDIO_PATH = '/sounds/beep_sound_mouse_pointer.mp3';
export const UI_CLICK_AUDIO_PATH = '/sounds/select_button_ui.mp3';
export const BREATHING_AUDIO_PATH = '/sounds/main_breathing.mp3'; // Breathing Sound
export const JUMPING_GRUNT_AUDIO_PATH = '/sounds/jumping_grunt.mp3'; // Jumping Grunt Sound
export const TRAP_DIGGING_AUDIO_PATH = '/sounds/risen_claws_trap_digging.mp3'; // Trap Digging Sound
export const TRAP_ATTACK_AUDIO_PATH = '/sounds/risen_claws_trap_attack.mp3'; // Trap Attack Sound
export const TRAP_SCREAM_AUDIO_PATH = '/sounds/risen_claws_trap_screaming.mp3'; // Trap Screaming Sound
export const TURN_PAGE_AUDIO_PATH = '/sounds/turn_page.mp3'; // Turn Page Sound
export const SWING_WEAPON_AUDIO_PATH = '/sounds/swing_weapon.mp3'; // Swing Weapon Sound
export const STICK_HIT_AUDIO_PATH = '/sounds/stick_hit_things.mp3'; // Stick Hit Object Sound
export const STICK_HIT_PERSON_AUDIO_PATH = '/sounds/wooden_stick_hit_person.mp3'; // Stick Hit Person/Monster Sound
export const BROKEN_STICK_AUDIO_PATH = '/sounds/broken_wooden_stick.mp3'; // Broken Stick Sound
export const HEART_BEAT_AUDIO_PATH = '/sounds/heart_beat.mp3'; // Heart Beat Sound
export const ANGEL_RIG_AUDIO_PATH = '/sounds/the_angle_rig_sound.mp3'; // The Angel Rig Sound

export const ANGEL_CRY_MAX_DIST = 30.0; // Increased by 50% (from 20.0 to 30.0)
export const TRAP_AUDIO_MAX_DIST = 15.0; // Increased by 50% (from 10.0 to 15.0) - Sound starts playing at this distance
export const TRAP_AUDIO_MIN_DIST = 5.0; // Sound stops playing when closer than this (keeps digging sound off when too close)

// Footstep Intervals (ms)
// Slower speed means slower cadence
export const FOOTSTEP_INTERVAL_WALK = 600; 
export const FOOTSTEP_INTERVAL_RUN = 350;

// Stamina & Movement Constants
export const PLAYER_MAX_STAMINA = 100;
export const STAMINA_REGEN_RATE = 15;
export const STAMINA_COST_DASH = 20;
export const STAMINA_COST_JUMP = 10;
export const STAMINA_COST_RUN_PER_SEC = 15;

// Stamina Cooldowns
export const STAMINA_REGEN_DELAY_NORMAL = 1000; // 1 second delay normally before regen starts
export const STAMINA_EXHAUSTION_DURATION = 10000; // Increased to 10 seconds lockout penalty

// Interaction
export const INTERACTION_DISTANCE = 4.0; 

// Consumables
export const PILL_USE_DURATION_MS = 7000;

// Tactical Simulation Palette
export const COLORS = {
  sky: '#020617',      
  ground: '#1e293b',   
  wall: '#334155',     
  exit: '#facc15',     
  enemy: '#dc2626',    
  bullet: '#fbbf24',
  teamA: '#0ea5e9',    
  teamB: '#f43f5e',    
  shard: '#ef4444'     
};
