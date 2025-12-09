
import { AudioContextHandler } from "./AudioContext";
import { AssetLoader } from "./AssetLoader";
import { 
    FOOTSTEP_AUDIO_PATH, JUMPING_GRUNT_AUDIO_PATH, TRAP_ATTACK_AUDIO_PATH, 
    TURN_PAGE_AUDIO_PATH, SWING_WEAPON_AUDIO_PATH, STICK_HIT_AUDIO_PATH, 
    STICK_HIT_PERSON_AUDIO_PATH, BROKEN_STICK_AUDIO_PATH, UI_HOVER_AUDIO_PATH, 
    UI_CLICK_AUDIO_PATH, PILL_BOTTLE_AUDIO_PATH, HEALTH_SOLUTION_AUDIO_PATH
} from '../../constants';

export class OneShotManager {
    private assetLoader: AssetLoader;
    private pillBottleSource: AudioBufferSourceNode | null = null;
    private pillBottleStopTimer: ReturnType<typeof setTimeout> | null = null;
    private healthSolutionSource: AudioBufferSourceNode | null = null;
    private healthSolutionStopTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(assetLoader: AssetLoader) {
        this.assetLoader = assetLoader;
    }

    private playSimple(path: string, volumeScale: number = 1.0, pitchVariation: number = 0.0) {
        const buffer = this.assetLoader.getBuffer(path);
        if (!buffer) return;

        const ctxHandler = AudioContextHandler.getInstance();
        const vol = ctxHandler.getSFXMultiplier();
        if (vol <= 0) return;

        const ctx = ctxHandler.getCtx();
        if (ctx.state === 'suspended') ctx.resume();

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        
        if (pitchVariation > 0) {
            source.playbackRate.value = 1.0 + (Math.random() * pitchVariation * 2 - pitchVariation);
        }

        const gain = ctx.createGain();
        gain.gain.value = volumeScale * vol;

        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(0);
    }

    public playFootstep() {
        const buffer = this.assetLoader.getBuffer(FOOTSTEP_AUDIO_PATH);
        if (!buffer) return;

        const ctxHandler = AudioContextHandler.getInstance();
        const vol = ctxHandler.getSFXMultiplier();
        if (vol <= 0) return;

        const ctx = ctxHandler.getCtx();
        if (ctx.state === 'suspended') ctx.resume();

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = 0.9 + Math.random() * 0.2;

        const gain = ctx.createGain();
        gain.gain.value = (0.03 + Math.random() * 0.01) * vol;

        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(0);
    }

    public playLanding() {
        const buffer = this.assetLoader.getBuffer(FOOTSTEP_AUDIO_PATH);
        if (!buffer) return;

        const ctxHandler = AudioContextHandler.getInstance();
        const vol = ctxHandler.getSFXMultiplier();
        if (vol <= 0) return;
        const ctx = ctxHandler.getCtx();
        if (ctx.state === 'suspended') ctx.resume();

        const playImpact = (delay: number, volumeScale: number, rate: number) => {
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.playbackRate.value = rate; 
            const gain = ctx.createGain();
            gain.gain.value = 0.15 * volumeScale * vol; 
            source.connect(gain);
            gain.connect(ctx.destination);
            source.start(ctx.currentTime + delay);
        };

        playImpact(0, 1.0, 0.8);
        playImpact(0.08, 0.8, 0.85);
    }

    public playJumpGrunt() {
        this.playSimple(JUMPING_GRUNT_AUDIO_PATH, 0.4, 0.1);
    }

    public playTrapAttack() {
        this.playSimple(TRAP_ATTACK_AUDIO_PATH, 0.5, 0);
    }

    public playTurnPage() {
        this.playSimple(TURN_PAGE_AUDIO_PATH, 0.5, 0);
    }

    public playSwingWeapon() {
        // Explicitly handle fallback inside SoundManager logic if needed, 
        // but here we just try to play if buffer exists.
        const buffer = this.assetLoader.getBuffer(SWING_WEAPON_AUDIO_PATH);
        if (!buffer) {
             this.playShoot(); // Fallback to synthetic
             return;
        }
        // Custom Swing logic with high pitch variance
        const ctxHandler = AudioContextHandler.getInstance();
        const vol = ctxHandler.getSFXMultiplier();
        if (vol <= 0) return;
        const ctx = ctxHandler.getCtx();
        
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = 0.9 + Math.random() * 0.2;
        const gain = ctx.createGain();
        gain.gain.value = 0.5 * vol; 
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(0);
    }

    public playStickHit() {
        // Custom logic: specific pitch variance
        const buffer = this.assetLoader.getBuffer(STICK_HIT_AUDIO_PATH);
        if (!buffer) return;
        
        const ctxHandler = AudioContextHandler.getInstance();
        const vol = ctxHandler.getSFXMultiplier();
        if (vol <= 0) return;
        const ctx = ctxHandler.getCtx();

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = 0.85 + Math.random() * 0.3;
        const gain = ctx.createGain();
        gain.gain.value = 0.7 * vol; 
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(0);
    }

    public playStickHitPerson() {
        const buffer = this.assetLoader.getBuffer(STICK_HIT_PERSON_AUDIO_PATH);
        if (!buffer) {
            this.playStickHit(); // Fallback
            return;
        }
        this.playSimple(STICK_HIT_PERSON_AUDIO_PATH, 0.75, 0.2);
    }

    public playBrokenStick() {
        const buffer = this.assetLoader.getBuffer(BROKEN_STICK_AUDIO_PATH);
        if (!buffer) {
            this.playSnap(); // Fallback
            return;
        }
        this.playSimple(BROKEN_STICK_AUDIO_PATH, 0.8, 0.2);
    }

    public playUIHover() {
        this.playSimple(UI_HOVER_AUDIO_PATH, 0.1, 0);
    }

    public playUIClick() {
        this.playSimple(UI_CLICK_AUDIO_PATH, 0.2, 0);
    }

    public playPillBottle() {
        // Louder: double previous volume
        this.playSimple(PILL_BOTTLE_AUDIO_PATH, 0.8, 0.05);
    }

    public startHealthSolutionHold(durationMs: number = 7000) {
        const buffer = this.assetLoader.getBuffer(HEALTH_SOLUTION_AUDIO_PATH);
        if (!buffer) return;

        const ctxHandler = AudioContextHandler.getInstance();
        const vol = ctxHandler.getSFXMultiplier();
        if (vol <= 0) return;

        const ctx = ctxHandler.getCtx();
        if (ctx.state === 'suspended') ctx.resume();

        // Stop previous
        this.stopHealthSolutionHold();

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const gain = ctx.createGain();
        gain.gain.value = 0.8 * vol;

        source.connect(gain);
        gain.connect(ctx.destination);

        const targetSeconds = durationMs / 1000;
        if (buffer.duration > 0) {
            source.playbackRate.value = buffer.duration / targetSeconds;
        }

        source.onended = () => {
            this.healthSolutionSource = null;
            if (this.healthSolutionStopTimer) {
                clearTimeout(this.healthSolutionStopTimer);
                this.healthSolutionStopTimer = null;
            }
        };

        source.start(0);
        source.stop(ctx.currentTime + targetSeconds);

        this.healthSolutionStopTimer = setTimeout(() => {
            this.healthSolutionSource = null;
            this.healthSolutionStopTimer = null;
        }, durationMs + 200);

        this.healthSolutionSource = source;
    }

    public stopHealthSolutionHold() {
        if (this.healthSolutionStopTimer) {
            clearTimeout(this.healthSolutionStopTimer);
            this.healthSolutionStopTimer = null;
        }
        if (this.healthSolutionSource) {
            try { this.healthSolutionSource.stop(); } catch {}
            this.healthSolutionSource = null;
        }
    }

    public startPillBottleHold(durationMs: number = 7000) {
        const buffer = this.assetLoader.getBuffer(PILL_BOTTLE_AUDIO_PATH);
        if (!buffer) return;

        const ctxHandler = AudioContextHandler.getInstance();
        const vol = ctxHandler.getSFXMultiplier();
        if (vol <= 0) return;

        const ctx = ctxHandler.getCtx();
        if (ctx.state === 'suspended') ctx.resume();

        // Stop any previous hold sound
        this.stopPillBottleHold();

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const gain = ctx.createGain();
        // Louder: double previous volume
        gain.gain.value = 0.8 * vol;

        source.connect(gain);
        gain.connect(ctx.destination);

        const targetSeconds = durationMs / 1000;
        if (buffer.duration > 0) {
            source.playbackRate.value = buffer.duration / targetSeconds;
        }

        source.onended = () => {
            this.pillBottleSource = null;
            if (this.pillBottleStopTimer) {
                clearTimeout(this.pillBottleStopTimer);
                this.pillBottleStopTimer = null;
            }
        };

        source.start(0);
        source.stop(ctx.currentTime + targetSeconds);

        this.pillBottleStopTimer = setTimeout(() => {
            this.pillBottleSource = null;
            this.pillBottleStopTimer = null;
        }, durationMs + 200);

        this.pillBottleSource = source;
    }

    public stopPillBottleHold() {
        if (this.pillBottleStopTimer) {
            clearTimeout(this.pillBottleStopTimer);
            this.pillBottleStopTimer = null;
        }
        if (this.pillBottleSource) {
            try {
                this.pillBottleSource.stop();
            } catch {
                // already stopped
            }
            this.pillBottleSource = null;
        }
    }

    // --- SYNTHETIC SOUNDS (No Assets Required) ---

    public playShoot() {
        const ctxHandler = AudioContextHandler.getInstance();
        const vol = ctxHandler.getSFXMultiplier();
        if (vol <= 0) return;
        const ctx = ctxHandler.getCtx();
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2 * vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01 * vol, ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    }

    public playHit() {
        const ctxHandler = AudioContextHandler.getInstance();
        const vol = ctxHandler.getSFXMultiplier();
        if (vol <= 0) return;
        const ctx = ctxHandler.getCtx();
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const noiseBuffer = ctx.createBuffer(1, 44100 * 0.1, 44100);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < 44100 * 0.1; i++) output[i] = Math.random() * 2 - 1;
        
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const noiseGain = ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(60, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.15);
        
        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(1.0 * vol, ctx.currentTime);
        oscGain.gain.exponentialRampToValueAtTime(0.01 * vol, ctx.currentTime + 0.15);

        noiseGain.gain.setValueAtTime(0.6 * vol, ctx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.01 * vol, ctx.currentTime + 0.1);
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 250;

        osc.connect(oscGain);
        oscGain.connect(filter);
        noise.connect(noiseGain);
        noiseGain.connect(filter);
        filter.connect(ctx.destination);

        osc.start();
        noise.start();
        osc.stop(ctx.currentTime + 0.2);
        noise.stop(ctx.currentTime + 0.2);
    }

    public playScan() {
        const ctxHandler = AudioContextHandler.getInstance();
        const vol = ctxHandler.getSFXMultiplier();
        if (vol <= 0) return;
        const ctx = ctxHandler.getCtx();
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.5);

        gain.gain.setValueAtTime(0.0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3 * vol, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001 * vol, ctx.currentTime + 1.0);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 1.0);
    }

    public playShardAwaken() {
        const ctxHandler = AudioContextHandler.getInstance();
        const vol = ctxHandler.getSFXMultiplier();
        if (vol <= 0) return;
        const ctx = ctxHandler.getCtx();
        if (ctx.state === 'suspended') ctx.resume();
        const now = ctx.currentTime;
        
        const rumbleOsc = ctx.createOscillator();
        const rumbleGain = ctx.createGain();
        rumbleOsc.type = 'sawtooth';
        rumbleOsc.frequency.setValueAtTime(50, now);
        rumbleOsc.frequency.linearRampToValueAtTime(20, now + 4);
        rumbleGain.gain.setValueAtTime(0.3 * vol, now);
        rumbleGain.gain.linearRampToValueAtTime(0.4 * vol, now + 1);
        rumbleGain.gain.exponentialRampToValueAtTime(0.01 * vol, now + 4);
        rumbleOsc.connect(rumbleGain).connect(ctx.destination);
        rumbleOsc.start(now);
        rumbleOsc.stop(now + 4.5);

        const noiseBuffer = ctx.createBuffer(1, 44100 * 3.0, 44100);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const noiseSrc = ctx.createBufferSource();
        noiseSrc.buffer = noiseBuffer;
        const noiseGain = ctx.createGain();
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(400, now);
        noiseFilter.frequency.linearRampToValueAtTime(100, now + 3);
        noiseGain.gain.setValueAtTime(0.0, now);
        noiseGain.gain.linearRampToValueAtTime(0.5 * vol, now + 0.5);
        noiseGain.gain.exponentialRampToValueAtTime(0.01 * vol, now + 3);
        noiseSrc.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);
        noiseSrc.start(now);
        noiseSrc.stop(now + 3);

        const alarmCount = 4;
        const alarmInterval = 0.8; 
        for(let i=0; i<alarmCount; i++) {
            const t = now + (i * alarmInterval);
            const alarmOsc = ctx.createOscillator();
            const alarmGain = ctx.createGain();
            alarmOsc.type = 'square'; 
            alarmOsc.frequency.setValueAtTime(800, t);
            alarmOsc.frequency.exponentialRampToValueAtTime(400, t + 0.4);
            alarmGain.gain.setValueAtTime(0, t);
            alarmGain.gain.linearRampToValueAtTime(0.2 * vol, t + 0.05);
            alarmGain.gain.exponentialRampToValueAtTime(0.001 * vol, t + 0.6);
            alarmOsc.connect(alarmGain).connect(ctx.destination);
            alarmOsc.start(t);
            alarmOsc.stop(t + 0.7);
        }
    }

    public playSnap() {
        const ctxHandler = AudioContextHandler.getInstance();
        const vol = ctxHandler.getSFXMultiplier();
        if (vol <= 0) return;
        const ctx = ctxHandler.getCtx();
        if (ctx.state === 'suspended') ctx.resume();
        const t = ctx.currentTime;

        const snapOsc = ctx.createOscillator();
        const snapGain = ctx.createGain();
        snapOsc.type = 'sawtooth';
        snapOsc.frequency.setValueAtTime(100, t);
        snapOsc.frequency.exponentialRampToValueAtTime(10, t + 0.1);

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 500;

        snapGain.gain.setValueAtTime(1.0 * vol, t);
        snapGain.gain.exponentialRampToValueAtTime(0.01 * vol, t + 0.1);

        snapOsc.connect(filter).connect(snapGain).connect(ctx.destination);
        snapOsc.start(t);
        snapOsc.stop(t + 0.15);

        setTimeout(() => {
            const thudOsc = ctx.createOscillator();
            const thudGain = ctx.createGain();
            thudOsc.frequency.setValueAtTime(50, ctx.currentTime);
            thudOsc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.3);
            thudGain.gain.setValueAtTime(0.8 * vol, ctx.currentTime);
            thudGain.gain.exponentialRampToValueAtTime(0.01 * vol, ctx.currentTime + 0.3);
            thudOsc.connect(thudGain).connect(ctx.destination);
            thudOsc.start();
            thudOsc.stop(ctx.currentTime + 0.3);
        }, 400); 
    }
}
