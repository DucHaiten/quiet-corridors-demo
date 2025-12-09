import { MissionIntel } from "../types";

// Completely offline data pools
const TITLES = [
  "Operation: Iron Fist",
  "The Silent Escape",
  "Shadow Protocol",
  "Neon Nightmare",
  "Concrete Jungle",
  "Sector 7 Lockdown",
  "Crimson Dawn"
];

const BRIEFINGS = [
  "We are surrounded by thugs. No weapons, just hands. Fight your way out.",
  "The maze is shifting. Enemies are patrolling every corner. Find the exit before they find you.",
  "You've been dropped into the exclusion zone. Survive until extraction.",
  "Security systems are offline, but the guards are not. Punch your way through to the signal.",
  "Your team is gone. You are the last one standing. Make it count."
];

const TIPS = [
  "Keep moving and strike fast.",
  "Watch your stamina, don't get exhausted.",
  "Use the corners to ambush enemies.",
  "Focus on one enemy at a time.",
  "Use Shift + WASD to dodge quickly."
];

export const generateMissionIntel = async (): Promise<MissionIntel> => {
  // Return immediately to prevent pointer lock race conditions or UI limbo
  return {
    title: TITLES[Math.floor(Math.random() * TITLES.length)],
    briefing: BRIEFINGS[Math.floor(Math.random() * BRIEFINGS.length)],
    tacticalTip: TIPS[Math.floor(Math.random() * TIPS.length)]
  };
};