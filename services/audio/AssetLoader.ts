
import { AudioContextHandler } from "./AudioContext";
import { 
    ANGEL_AUDIO_PATH, FOOTSTEP_AUDIO_PATH, UI_HOVER_AUDIO_PATH, UI_CLICK_AUDIO_PATH,
    BREATHING_AUDIO_PATH, JUMPING_GRUNT_AUDIO_PATH, TRAP_DIGGING_AUDIO_PATH,
    TRAP_ATTACK_AUDIO_PATH, TRAP_SCREAM_AUDIO_PATH, TURN_PAGE_AUDIO_PATH,
    SWING_WEAPON_AUDIO_PATH, STICK_HIT_AUDIO_PATH, STICK_HIT_PERSON_AUDIO_PATH,
    BROKEN_STICK_AUDIO_PATH, HEART_BEAT_AUDIO_PATH, ANGEL_RIG_AUDIO_PATH,
    PILL_BOTTLE_AUDIO_PATH, HEALTH_SOLUTION_AUDIO_PATH
} from '../../constants';

export class AssetLoader {
    private buffers: Map<string, AudioBuffer> = new Map();

    constructor() {
        if (typeof window !== 'undefined') {
            this.preloadAll();
        }
    }

    private async loadBuffer(path: string): Promise<void> {
        try {
            const ctx = AudioContextHandler.getInstance().getCtx();
            const res = await fetch(path);
            if (res.ok) {
                const ab = await res.arrayBuffer();
                const decoded = await ctx.decodeAudioData(ab);
                this.buffers.set(path, decoded);
            }
        } catch (err) {
            console.warn(`Failed to load sound: ${path}`, err);
        }
    }

    public getBuffer(path: string): AudioBuffer | undefined {
        return this.buffers.get(path);
    }

    // Explicitly load a buffer if needed (e.g. BGM) and return it
    public async fetchAndDecode(path: string): Promise<AudioBuffer> {
        // Check cache first
        if (this.buffers.has(path)) return this.buffers.get(path)!;

        const ctx = AudioContextHandler.getInstance().getCtx();
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Failed to fetch ${path}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        this.buffers.set(path, audioBuffer);
        return audioBuffer;
    }

    private preloadAll() {
        const paths = [
            ANGEL_AUDIO_PATH, FOOTSTEP_AUDIO_PATH, UI_HOVER_AUDIO_PATH, UI_CLICK_AUDIO_PATH,
            BREATHING_AUDIO_PATH, JUMPING_GRUNT_AUDIO_PATH, TRAP_DIGGING_AUDIO_PATH,
            TRAP_ATTACK_AUDIO_PATH, TRAP_SCREAM_AUDIO_PATH, TURN_PAGE_AUDIO_PATH,
            SWING_WEAPON_AUDIO_PATH, STICK_HIT_AUDIO_PATH, STICK_HIT_PERSON_AUDIO_PATH,
            BROKEN_STICK_AUDIO_PATH, HEART_BEAT_AUDIO_PATH, ANGEL_RIG_AUDIO_PATH,
            PILL_BOTTLE_AUDIO_PATH, HEALTH_SOLUTION_AUDIO_PATH
        ];
        paths.forEach(p => this.loadBuffer(p));
    }
}
