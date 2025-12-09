
import { AudioContextHandler } from '../services/audio/AudioContext';
import { AssetLoader } from '../services/audio/AssetLoader';
import { MusicManager } from '../services/audio/MusicManager';
import { AmbientManager } from '../services/audio/AmbientManager';
import { OneShotManager } from '../services/audio/OneShotManager';

class SoundManager {
  private assetLoader: AssetLoader;
  private musicManager: MusicManager;
  private ambientManager: AmbientManager;
  private oneShotManager: OneShotManager;

  constructor() {
    this.assetLoader = new AssetLoader();
    this.musicManager = new MusicManager(this.assetLoader);
    this.ambientManager = new AmbientManager(this.assetLoader);
    this.oneShotManager = new OneShotManager(this.assetLoader);
  }

  public resumeContext() {
      AudioContextHandler.getInstance().resume();
  }

  public suspendContext() {
      AudioContextHandler.getInstance().suspend();
  }

  // --- BGM DELEGATION ---
  async playBGM(path: string, baseVolume: number = 0.5) {
      return this.musicManager.playBGM(path, baseVolume);
  }

  pauseBGM() {
      this.musicManager.pauseBGM();
  }

  resumeBGM() {
      this.musicManager.resumeBGM();
  }

  async playSecondaryBGM(path: string, baseVolume: number = 0.5) {
      return this.musicManager.playSecondaryBGM(path, baseVolume);
  }

  stopBGM() {
      this.musicManager.stopAll();
      // Also stop loops when stopping BGM (game over/reset)
      this.ambientManager.stopAll();
  }

  stopOnGameOver() {
      this.musicManager.stopAll();
      this.ambientManager.stopOnGameOver();
  }

  setBGMVolume(masterVolume: number) {
      AudioContextHandler.getInstance().setMasterVolume(masterVolume);
      this.musicManager.updateVolumes();
  }

  // --- AMBIENT DELEGATION ---
  playBreathing() { this.ambientManager.playBreathing(); }
  stopBreathing(immediate: boolean = false) { this.ambientManager.stopBreathing(immediate); }
  
  updateHeartBeat(volume: number, rate: number) { this.ambientManager.updateHeartBeat(volume, rate); }
  stopHeartBeat(immediate: boolean = false) { this.ambientManager.stopHeartBeat(immediate); }

  updateAngelRigSound(volume: number) { this.ambientManager.updateAngelRigSound(volume); }
  stopAngelRigSound() { this.ambientManager.stopAngelRigSound(); }

  updateAngelCry(volume: number) { this.ambientManager.updateAngelCry(volume); }
  playAngelDeathCry() { this.ambientManager.playAngelDeathCry(); }
  stopAngelCry() { this.ambientManager.stopAngelCry(); }
  
  updateTrapDigging(volume: number, panning: number) { this.ambientManager.updateTrapDigging(volume, panning); }
  stopTrapDigging() { this.ambientManager.stopTrapDigging(); }
  
  playTrapScream() { this.ambientManager.playTrapScream(); }
  stopTrapScream() { this.ambientManager.stopTrapScream(); }

  // Global pause/resume for all ambient sounds
  pauseAllAmbient() {
      this.ambientManager.stopAll();
  }

  // --- ONE SHOT DELEGATION ---
  playFootstep() { this.oneShotManager.playFootstep(); }
  playLanding() { this.oneShotManager.playLanding(); }
  playJumpGrunt() { this.oneShotManager.playJumpGrunt(); }
  playTrapAttack() { this.oneShotManager.playTrapAttack(); }
  playTurnPage() { this.oneShotManager.playTurnPage(); }
  playSwingWeapon() { this.oneShotManager.playSwingWeapon(); }
  playStickHit() { this.oneShotManager.playStickHit(); }
  playStickHitPerson() { this.oneShotManager.playStickHitPerson(); }
  playBrokenStick() { this.oneShotManager.playBrokenStick(); }
  playUIHover() { this.oneShotManager.playUIHover(); }
  playUIClick() { this.oneShotManager.playUIClick(); }
  playShoot() { this.oneShotManager.playShoot(); }
  playHit() { this.oneShotManager.playHit(); }
  playScan() { this.oneShotManager.playScan(); }
  playShardAwaken() { this.oneShotManager.playShardAwaken(); }
  playSnap() { this.oneShotManager.playSnap(); }
  playPillBottle() { this.oneShotManager.playPillBottle(); }
  startPillBottleHold(durationMs?: number) { this.oneShotManager.startPillBottleHold(durationMs); }
  stopPillBottleHold() { this.oneShotManager.stopPillBottleHold(); }
  startHealthSolutionHold(durationMs?: number) { this.oneShotManager.startHealthSolutionHold(durationMs); }
  stopHealthSolutionHold() { this.oneShotManager.stopHealthSolutionHold(); }
}

export const soundManager = new SoundManager();
