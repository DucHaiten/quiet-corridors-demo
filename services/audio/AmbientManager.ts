
import { AudioContextHandler } from "./AudioContext";
import { AssetLoader } from "./AssetLoader";
import { ANGEL_AUDIO_PATH, BREATHING_AUDIO_PATH, TRAP_DIGGING_AUDIO_PATH, TRAP_SCREAM_AUDIO_PATH, HEART_BEAT_AUDIO_PATH, ANGEL_RIG_AUDIO_PATH } from '../../constants';

export class AmbientManager {
    private assetLoader: AssetLoader;

    // --- ANGEL STATE ---
    private angelSource: AudioBufferSourceNode | null = null;
    private angelGain: GainNode | null = null;
    private isAngelPlaying: boolean = false;
    private deathCryInterval: any = null;
    private isDeathSequence: boolean = false;

    // --- ANGEL RIG PRESENCE STATE ---
    private angelRigSource: AudioBufferSourceNode | null = null;
    private angelRigGain: GainNode | null = null;
    private isAngelRigPlaying: boolean = false;

    // --- HEART BEAT STATE ---
    private heartBeatSource: AudioBufferSourceNode | null = null;
    private heartBeatGain: GainNode | null = null;
    private isHeartBeatPlaying: boolean = false;

    // --- BREATHING STATE ---
    private breathingSource: AudioBufferSourceNode | null = null;
    private breathingGain: GainNode | null = null;
    private isBreathingPlaying: boolean = false;

    // --- TRAP STATE ---
    private trapDiggingSource: AudioBufferSourceNode | null = null;
    private trapDiggingGain: GainNode | null = null;
    private trapDiggingPanner: StereoPannerNode | null = null;
    private isTrapDiggingPlaying: boolean = false;

    private trapScreamSource: AudioBufferSourceNode | null = null;
    private trapScreamGain: GainNode | null = null;
    private isTrapScreamPlaying: boolean = false;

    constructor(assetLoader: AssetLoader) {
        this.assetLoader = assetLoader;
    }

    // === ANGEL LOGIC ===
    public updateAngelCry(volume: number) {
        const ctxHandler = AudioContextHandler.getInstance();
        const ctx = ctxHandler.getCtx();
        if (ctx.state === 'suspended') ctx.resume();

        const buffer = this.assetLoader.getBuffer(ANGEL_AUDIO_PATH);
        if (!buffer) return;

        const sfxVol = ctxHandler.getSFXMultiplier();
        if (sfxVol <= 0) {
            if (this.isAngelPlaying && this.angelGain) {
                 this.angelGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
            }
            return;
        }

        const targetVol = Math.max(0, volume) * sfxVol;

        if (targetVol > 0.01) {
            if (!this.isAngelPlaying) {
                this.angelSource = ctx.createBufferSource();
                this.angelSource.buffer = buffer;
                this.angelSource.loop = true;

                this.angelGain = ctx.createGain();
                this.angelGain.gain.setValueAtTime(0, ctx.currentTime); 

                this.angelSource.connect(this.angelGain);
                this.angelGain.connect(ctx.destination);
                
                this.angelSource.start(0);
                this.isAngelPlaying = true;
            }

            if (this.angelGain) {
                this.angelGain.gain.setTargetAtTime(targetVol, ctx.currentTime, 0.1);
            }

        } else {
            if (this.isAngelPlaying && this.angelGain) {
                 this.angelGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
            }
        }
    }

    public stopAngelCry() {
        if (this.isDeathSequence) return;
        if (this.angelSource) {
            try { this.angelSource.stop(); } catch(e) {}
            this.angelSource.disconnect();
            this.angelSource = null;
        }
        this.isAngelPlaying = false;
        this.angelGain = null;
    }

    public playAngelDeathCry() {
        this.isDeathSequence = true;
        if (!this.isAngelPlaying) {
             this.updateAngelCry(1.0);
        }
        
        const ctx = AudioContextHandler.getInstance().getCtx();
        let startTime = ctx.currentTime;
        
        if (this.deathCryInterval) clearInterval(this.deathCryInterval);
        
        this.deathCryInterval = setInterval(() => {
             if (!this.isAngelPlaying && this.isDeathSequence) {
                  this.updateAngelCry(1.0); 
             }
             if (!this.isAngelPlaying) return;

             const elapsed = AudioContextHandler.getInstance().getCtx().currentTime - startTime;
             const vol = 1.0 + (elapsed * 0.2); // Slower ramp
             const target = Math.min(3.0, vol); // Cap at 3.0 (300%) instead of 10.0
             this.updateAngelCry(target);
        }, 100);
    }

    // === ANGEL RIG PRESENCE LOGIC ===
    public async updateAngelRigSound(volume: number) {
        const ctxHandler = AudioContextHandler.getInstance();
        const ctx = ctxHandler.getCtx();
        if (ctx.state === 'suspended') ctx.resume();

        let buffer = this.assetLoader.getBuffer(ANGEL_RIG_AUDIO_PATH);
        // Lazy load
        if (!buffer) {
            try {
                buffer = await this.assetLoader.fetchAndDecode(ANGEL_RIG_AUDIO_PATH);
            } catch (e) { return; }
        }
        if (!buffer) return;

        const sfxVol = ctxHandler.getSFXMultiplier();
        if (sfxVol <= 0) {
            this.stopAngelRigSound();
            return;
        }

        const targetVol = Math.max(0, volume) * sfxVol; // Allow volume > 1 for intense moments

        if (targetVol > 0.01) {
            if (!this.isAngelRigPlaying) {
                this.angelRigSource = ctx.createBufferSource();
                this.angelRigSource.buffer = buffer;
                this.angelRigSource.loop = true;

                this.angelRigGain = ctx.createGain();
                this.angelRigGain.gain.setValueAtTime(0, ctx.currentTime);

                this.angelRigSource.connect(this.angelRigGain);
                this.angelRigGain.connect(ctx.destination);
                
                this.angelRigSource.start(0);
                this.isAngelRigPlaying = true;
            }

            if (this.angelRigGain) {
                this.angelRigGain.gain.setTargetAtTime(targetVol, ctx.currentTime, 0.2);
            }
        } else {
            if (this.isAngelRigPlaying && this.angelRigGain) {
                 this.angelRigGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
                 if (this.angelRigGain.gain.value < 0.001) {
                     this.stopAngelRigSound();
                 }
            }
        }
    }

    public stopAngelRigSound() {
        if (!this.isAngelRigPlaying) return;
        if (this.angelRigSource) {
            try { this.angelRigSource.stop(); } catch(e) {}
            this.angelRigSource.disconnect();
            this.angelRigSource = null;
        }
        if (this.angelRigGain) {
            this.angelRigGain.disconnect();
            this.angelRigGain = null;
        }
        this.isAngelRigPlaying = false;
    }

    // === HEART BEAT LOGIC ===
    public async updateHeartBeat(volume: number, rate: number) {
        const ctxHandler = AudioContextHandler.getInstance();
        const ctx = ctxHandler.getCtx();
        if (ctx.state === 'suspended') ctx.resume();

        let buffer = this.assetLoader.getBuffer(HEART_BEAT_AUDIO_PATH);
        
        // Lazy load if missing
        if (!buffer) {
            try {
                buffer = await this.assetLoader.fetchAndDecode(HEART_BEAT_AUDIO_PATH);
            } catch (e) {
                return; // Failed to load
            }
        }
        if (!buffer) return;

        const sfxVol = ctxHandler.getSFXMultiplier();
        if (sfxVol <= 0) {
            this.stopHeartBeat();
            return;
        }

        const targetVol = Math.max(0, volume) * sfxVol; // Allow volume > 1 for intense fear moments

        // Start if volume > 0.01 and not playing
        if (targetVol > 0.01) {
            if (!this.isHeartBeatPlaying) {
                this.heartBeatSource = ctx.createBufferSource();
                this.heartBeatSource.buffer = buffer;
                this.heartBeatSource.loop = true;

                this.heartBeatGain = ctx.createGain();
                this.heartBeatGain.gain.setValueAtTime(0, ctx.currentTime);

                this.heartBeatSource.connect(this.heartBeatGain);
                this.heartBeatGain.connect(ctx.destination);
                
                this.heartBeatSource.start(0);
                this.isHeartBeatPlaying = true;
            }

            if (this.heartBeatGain) {
                // Smooth transition for volume
                this.heartBeatGain.gain.setTargetAtTime(targetVol, ctx.currentTime, 0.5);
            }
            if (this.heartBeatSource) {
                // Smooth transition for playback rate (heart rate speed)
                // Clamp rate between 0.5 (slow) and 4.0 (extreme panic)
                const safeRate = Math.max(0.5, Math.min(4.0, rate));
                this.heartBeatSource.playbackRate.setTargetAtTime(safeRate, ctx.currentTime, 0.5);
            }
        } else {
            // Fade out if playing
            if (this.isHeartBeatPlaying && this.heartBeatGain) {
                 // 5 second fade out as requested "5 giây chậm nhỏ dần"
                 // However, updateHeartBeat is called every frame. 
                 // If the consumer sends volume 0, we should trigger a slow fade out.
                 // But simply setting target to 0 with time constant 1.0 roughly achieves this 
                 // (reaches near zero in ~5s).
                 this.heartBeatGain.gain.setTargetAtTime(0, ctx.currentTime, 1.5);
                 
                 // Stop if volume is effectively zero
                 if (this.heartBeatGain.gain.value < 0.001) {
                     this.stopHeartBeat();
                 }
            }
        }
    }

    public stopHeartBeat(immediate: boolean = false) {
        if (!this.isHeartBeatPlaying) return;
        
        const ctx = AudioContextHandler.getInstance().getCtx();
        
        if (immediate) {
            if (this.heartBeatSource) {
                try { this.heartBeatSource.stop(); } catch(e) {}
                this.heartBeatSource.disconnect();
                this.heartBeatSource = null;
            }
            if (this.heartBeatGain) {
                this.heartBeatGain.disconnect();
                this.heartBeatGain = null;
            }
            this.isHeartBeatPlaying = false;
            return;
        }

        // Graceful stop
        if (this.heartBeatGain) {
            this.heartBeatGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
            setTimeout(() => {
                if (this.heartBeatGain && this.heartBeatGain.gain.value < 0.01) {
                    this.stopHeartBeat(true);
                }
            }, 2000);
        }
    }

    // === BREATHING LOGIC ===
    public playBreathing() {
        const buffer = this.assetLoader.getBuffer(BREATHING_AUDIO_PATH);
        if (this.isBreathingPlaying || !buffer) return;
        
        const ctxHandler = AudioContextHandler.getInstance();
        const vol = ctxHandler.getSFXMultiplier();
        if (vol <= 0) return;

        const ctx = ctxHandler.getCtx();
        if (ctx.state === 'suspended') ctx.resume();

        this.breathingSource = ctx.createBufferSource();
        this.breathingSource.buffer = buffer;
        this.breathingSource.loop = true;

        this.breathingGain = ctx.createGain();
        const now = ctx.currentTime;
        const totalDuration = 10.0; 
        
        // Envelope: Panic -> Recover -> Constant Loop
        this.breathingGain.gain.setValueAtTime(0, now);
        this.breathingGain.gain.linearRampToValueAtTime(0.8 * vol, now + 0.5); 
        this.breathingSource.playbackRate.setValueAtTime(1.35, now); 

        this.breathingSource.playbackRate.linearRampToValueAtTime(1.0, now + 3.0);
        this.breathingGain.gain.linearRampToValueAtTime(0.5 * vol, now + 3.0);
        this.breathingGain.gain.setValueAtTime(0.5 * vol, now + 3.0);

        this.breathingSource.connect(this.breathingGain);
        this.breathingGain.connect(ctx.destination);
        
        this.breathingSource.start(0);
        this.isBreathingPlaying = true;
    }

    public stopBreathing(immediate: boolean = false) {
        if (!this.isBreathingPlaying || !this.breathingGain || !this.breathingSource) return;

        const ctx = AudioContextHandler.getInstance().getCtx();
        const now = ctx.currentTime;
        
        if (immediate) {
            try { this.breathingSource.stop(); } catch(e) {}
            this.breathingSource.disconnect();
            this.breathingGain.disconnect();
            this.breathingSource = null;
            this.breathingGain = null;
            this.isBreathingPlaying = false;
            return;
        }

        this.isBreathingPlaying = false; 
        this.breathingGain.gain.cancelScheduledValues(now);
        this.breathingGain.gain.setValueAtTime(this.breathingGain.gain.value, now);
        this.breathingGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

        const sourceToStop = this.breathingSource;
        const gainToDisconnect = this.breathingGain;
        sourceToStop.stop(now + 1.1);
        setTimeout(() => {
            try {
              sourceToStop.disconnect();
              gainToDisconnect.disconnect();
            } catch(e) {}
        }, 1200);
        this.breathingSource = null;
        this.breathingGain = null;
    }

    // === TRAP DIGGING (SPATIAL) ===
    public updateTrapDigging(volume: number, panning: number) {
        const buffer = this.assetLoader.getBuffer(TRAP_DIGGING_AUDIO_PATH);
        if (!buffer) return;

        const ctxHandler = AudioContextHandler.getInstance();
        const ctx = ctxHandler.getCtx();
        if (ctx.state === 'suspended') ctx.resume();

        const sfxVol = ctxHandler.getSFXMultiplier();
        if (sfxVol <= 0) {
            if (this.isTrapDiggingPlaying && this.trapDiggingGain) {
                 this.trapDiggingGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
            }
            return;
        }

        const targetVol = Math.max(0, Math.min(1, volume)) * sfxVol;

        if (targetVol > 0.01) {
            if (!this.isTrapDiggingPlaying) {
                this.trapDiggingSource = ctx.createBufferSource();
                this.trapDiggingSource.buffer = buffer;
                this.trapDiggingSource.loop = true;

                this.trapDiggingGain = ctx.createGain();
                this.trapDiggingGain.gain.setValueAtTime(0, ctx.currentTime);

                this.trapDiggingPanner = ctx.createStereoPanner();
                
                this.trapDiggingSource.connect(this.trapDiggingPanner);
                this.trapDiggingPanner.connect(this.trapDiggingGain);
                this.trapDiggingGain.connect(ctx.destination);
                
                this.trapDiggingSource.start(0);
                this.isTrapDiggingPlaying = true;
            }

            if (this.trapDiggingGain) {
                this.trapDiggingGain.gain.setTargetAtTime(targetVol, ctx.currentTime, 0.1);
            }
            if (this.trapDiggingPanner) {
                const safePan = Math.max(-1, Math.min(1, panning));
                this.trapDiggingPanner.pan.setTargetAtTime(safePan, ctx.currentTime, 0.1);
            }

        } else {
            if (this.isTrapDiggingPlaying && this.trapDiggingGain) {
                 this.trapDiggingGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
            }
        }
    }

    public stopTrapDigging() {
        if (this.trapDiggingSource) {
            try { this.trapDiggingSource.stop(); } catch(e) {}
            this.trapDiggingSource.disconnect();
            this.trapDiggingSource = null;
        }
        if (this.trapDiggingGain) {
            this.trapDiggingGain.disconnect();
            this.trapDiggingGain = null;
        }
        if (this.trapDiggingPanner) {
            this.trapDiggingPanner.disconnect();
            this.trapDiggingPanner = null;
        }
        this.isTrapDiggingPlaying = false;
    }

    // === TRAP SCREAM ===
    public playTrapScream() {
        const buffer = this.assetLoader.getBuffer(TRAP_SCREAM_AUDIO_PATH);
        if (this.isTrapScreamPlaying || !buffer) return;

        const ctxHandler = AudioContextHandler.getInstance();
        const vol = ctxHandler.getSFXMultiplier();
        if (vol <= 0) return;

        const ctx = ctxHandler.getCtx();
        if (ctx.state === 'suspended') ctx.resume();

        this.trapScreamSource = ctx.createBufferSource();
        this.trapScreamSource.buffer = buffer;
        this.trapScreamSource.loop = true;

        this.trapScreamGain = ctx.createGain();
        this.trapScreamGain.gain.setValueAtTime(0.5 * vol, ctx.currentTime);

        this.trapScreamSource.connect(this.trapScreamGain);
        this.trapScreamGain.connect(ctx.destination);
        
        this.trapScreamSource.start(0);
        this.isTrapScreamPlaying = true;
    }

    public stopTrapScream() {
        if (!this.isTrapScreamPlaying) return;
        if (this.trapScreamSource) {
            try { this.trapScreamSource.stop(); } catch(e) {}
            this.trapScreamSource.disconnect();
            this.trapScreamSource = null;
        }
        if (this.trapScreamGain) {
            this.trapScreamGain.disconnect();
            this.trapScreamGain = null;
        }
        this.isTrapScreamPlaying = false;
    }
    
    public stopAll() {
        this.isDeathSequence = false;
        if (this.deathCryInterval) clearInterval(this.deathCryInterval);
        this.stopAngelCry();
        this.stopAngelRigSound();
        this.stopHeartBeat(true);
        this.stopBreathing(true);
        this.stopTrapDigging();
        this.stopTrapScream();
    }

    public stopOnGameOver() {
        if (!this.isDeathSequence) this.stopAngelCry();
        this.stopAngelRigSound();
        this.stopHeartBeat(true);
        this.stopBreathing(true);
        this.stopTrapDigging();
        this.stopTrapScream();
    }
}
