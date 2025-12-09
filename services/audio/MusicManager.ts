
import { AudioContextHandler } from "./AudioContext";
import { AssetLoader } from "./AssetLoader";

export class MusicManager {
    private assetLoader: AssetLoader;
    
    // Layer 1
    private bgmSource: AudioBufferSourceNode | null = null;
    private bgmGain: GainNode | null = null;
    private currentBgmPath: string | null = null;
    private bgmBaseVolume: number = 0.5;
    private bgmBuffer: AudioBuffer | null = null;
    private bgmStartTime: number = 0;
    private bgmPauseOffset: number = 0;
    private isBgmPaused: boolean = false;
    
    // Layer 2
    private secondaryBgmSource: AudioBufferSourceNode | null = null;
    private secondaryBgmGain: GainNode | null = null;
    private currentSecondaryBgmPath: string | null = null;
    private secondaryBgmBaseVolume: number = 0.5;

    private bgmRequestId: number = 0;

    constructor(assetLoader: AssetLoader) {
        this.assetLoader = assetLoader;
    }

    public async playBGM(path: string, baseVolume: number = 0.5) {
        // RESUME CASE
        if (this.currentBgmPath === path && this.isBgmPaused) {
            this.bgmBaseVolume = baseVolume;
            this.resumeBGM();
            this.updateVolumes();
            return;
        }

        // ALREADY PLAYING CASE
        if (this.currentBgmPath === path && this.bgmSource) {
            if (this.bgmBaseVolume !== baseVolume) {
               this.bgmBaseVolume = baseVolume;
               this.updateVolumes();
            }
            return;
        }

        // NEW TRACK CASE
        this.stopLayer1(); // Resets paused state
        
        const requestId = ++this.bgmRequestId;
        this.currentBgmPath = path;
        this.bgmBaseVolume = baseVolume;

        try {
            const ctxHandler = AudioContextHandler.getInstance();
            const ctx = ctxHandler.getCtx();
            if (ctx.state === 'suspended') ctx.resume();

            // Use asset loader to fetch/get cached
            const buffer = await this.assetLoader.fetchAndDecode(path);
            
            if (requestId !== this.bgmRequestId) return;

            this.bgmBuffer = buffer;
            this.startSourceLayer1(ctx, buffer, 0);

        } catch (err) {
            if (requestId === this.bgmRequestId) {
                console.warn("Failed to play BGM:", err);
                this.currentBgmPath = null;
                this.bgmBuffer = null;
            }
        }
    }

    private startSourceLayer1(ctx: AudioContext, buffer: AudioBuffer, offset: number) {
        this.bgmSource = ctx.createBufferSource();
        this.bgmSource.buffer = buffer;
        this.bgmSource.loop = true;

        this.bgmGain = ctx.createGain();
        this.bgmGain.gain.setValueAtTime(AudioContextHandler.getInstance().getMasterVolume() * this.bgmBaseVolume, ctx.currentTime);

        this.bgmSource.connect(this.bgmGain);
        this.bgmGain.connect(ctx.destination);
        
        this.bgmSource.start(0, offset);
        this.bgmStartTime = ctx.currentTime - offset;
        this.isBgmPaused = false;
    }

    public pauseBGM() {
        if (!this.bgmSource || this.isBgmPaused || !this.bgmBuffer) return;

        const ctx = AudioContextHandler.getInstance().getCtx();
        const elapsed = ctx.currentTime - this.bgmStartTime;
        this.bgmPauseOffset = elapsed % this.bgmBuffer.duration;
        
        try { this.bgmSource.stop(); } catch(e) {}
        this.bgmSource.disconnect();
        this.bgmSource = null;
        this.isBgmPaused = true;
    }

    public resumeBGM() {
        if (!this.isBgmPaused || !this.currentBgmPath || !this.bgmBuffer) return;
        
        const ctx = AudioContextHandler.getInstance().getCtx();
        this.startSourceLayer1(ctx, this.bgmBuffer, this.bgmPauseOffset);
    }

    public async playSecondaryBGM(path: string, baseVolume: number = 0.5) {
        if (this.currentSecondaryBgmPath === path && this.secondaryBgmSource) {
            if (this.secondaryBgmBaseVolume !== baseVolume) {
               this.secondaryBgmBaseVolume = baseVolume;
               this.updateVolumes();
            }
            return;
        }

        this.stopLayer2();

        const requestId = this.bgmRequestId; 
        this.currentSecondaryBgmPath = path;
        this.secondaryBgmBaseVolume = baseVolume;

        try {
            const ctxHandler = AudioContextHandler.getInstance();
            const ctx = ctxHandler.getCtx();
            if (ctx.state === 'suspended') ctx.resume();

            const buffer = await this.assetLoader.fetchAndDecode(path);

            if (requestId !== this.bgmRequestId) return;

            this.secondaryBgmSource = ctx.createBufferSource();
            this.secondaryBgmSource.buffer = buffer;
            this.secondaryBgmSource.loop = true;

            this.secondaryBgmGain = ctx.createGain();
            this.secondaryBgmGain.gain.setValueAtTime(ctxHandler.getMasterVolume() * this.secondaryBgmBaseVolume, ctx.currentTime);

            this.secondaryBgmSource.connect(this.secondaryBgmGain);
            this.secondaryBgmGain.connect(ctx.destination);
            
            this.secondaryBgmSource.start(0);
        } catch (err) {
            console.warn("Failed to play Secondary BGM:", err);
            this.currentSecondaryBgmPath = null;
        }
    }

    public stopAll() {
        this.bgmRequestId++; // Invalidate loads
        this.stopLayer1();
        this.stopLayer2();
    }

    private stopLayer1() {
        if (this.bgmSource) {
            try { this.bgmSource.stop(); } catch(e) {}
            this.bgmSource.disconnect();
            this.bgmSource = null;
        }
        if (this.bgmGain) {
            this.bgmGain.disconnect();
            this.bgmGain = null;
        }
        this.currentBgmPath = null;
        this.bgmBuffer = null;
        this.isBgmPaused = false;
        this.bgmPauseOffset = 0;
    }

    private stopLayer2() {
        if (this.secondaryBgmSource) {
            try { this.secondaryBgmSource.stop(); } catch(e) {}
            this.secondaryBgmSource.disconnect();
            this.secondaryBgmSource = null;
        }
        if (this.secondaryBgmGain) {
            this.secondaryBgmGain.disconnect();
            this.secondaryBgmGain = null;
        }
        this.currentSecondaryBgmPath = null;
    }

    public updateVolumes() {
        const ctx = AudioContextHandler.getInstance().getCtx();
        const master = AudioContextHandler.getInstance().getMasterVolume();
        
        if (this.bgmGain) {
            const finalGain = master * this.bgmBaseVolume;
            this.bgmGain.gain.setTargetAtTime(finalGain, ctx.currentTime, 0.1);
        }
        if (this.secondaryBgmGain) {
            const finalGain = master * this.secondaryBgmBaseVolume;
            this.secondaryBgmGain.gain.setTargetAtTime(finalGain, ctx.currentTime, 0.1);
        }
    }
}
