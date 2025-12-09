
export class AudioContextHandler {
    private static instance: AudioContextHandler;
    private ctx: AudioContext | null = null;
    private masterVolume: number = 2.0;

    private constructor() {}

    public static getInstance(): AudioContextHandler {
        if (!AudioContextHandler.instance) {
            AudioContextHandler.instance = new AudioContextHandler();
        }
        return AudioContextHandler.instance;
    }

    public getCtx(): AudioContext {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return this.ctx;
    }

    public resume(): void {
        const ctx = this.getCtx();
        if (ctx.state === 'suspended') {
            ctx.resume().catch(err => console.warn(err));
        }
    }

    public suspend(): void {
        const ctx = this.getCtx();
        if (ctx.state === 'running') {
            ctx.suspend().catch(err => console.warn(err));
        }
    }

    public getMasterVolume(): number {
        return this.masterVolume;
    }

    public setMasterVolume(vol: number): void {
        this.masterVolume = vol;
    }

    public getSFXMultiplier(): number {
        // Logic: Master 0.0 (Min) -> Multiplier 0.0
        // Master 2.0 (Def) -> Multiplier 2.0
        return Math.max(0, this.masterVolume);
    }
}
