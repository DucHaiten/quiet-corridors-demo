
import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';

// --- CUSTOM SHADER FOR CRT EFFECT (BALANCED) ---
export const SonarScreenMaterial = shaderMaterial(
  {
    uColor: new THREE.Color(0.0, 1.0, 0.0), // Default Green
    uTime: 0,
  },
  // Vertex Shader
  `
    varying vec3 vPos;
    void main() {
      vPos = position; // Pass local position to fragment
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment Shader
  `
    uniform vec3 uColor;
    uniform float uTime;
    varying vec3 vPos;

    void main() {
      // Dimensions of the screen (Half-widths based on args [0.12, 0.1])
      float halfW = 0.06;
      float halfH = 0.05;

      // Normalize position to 0..1 relative to box dimensions
      float xNorm = abs(vPos.x) / halfW;
      float yNorm = abs(vPos.y) / halfH;

      // SQUIRCLE DISTANCE FIELD
      float dist = pow(pow(xNorm, 4.0) + pow(yNorm, 4.0), 0.25);

      // --- 1. BASE COLOR & HOTSPOT ---
      float hotspot = 1.0 - smoothstep(0.0, 0.7, dist);
      vec3 col = uColor;
      
      // Boost center brightness
      col += col * hotspot * 1.5; 
      
      // Add slight white core glare
      col = mix(col, vec3(1.0), hotspot * 0.2); 

      // --- 2. SOFT GRID (Balanced) ---
      
      // Horizontal Scanlines
      float scanline = step(0.5, fract(vPos.y * 300.0));
      // Darken by 50% on lines (0.9). Visible but not pitch black.
      float gridDarkness = 1.2 - (scanline * 0.5); 

      // Vertical RGB Sub-pixels
      float rgbPhase = fract(vPos.x * 400.0); 
      vec3 rgbTint = vec3(1.0);
      if (rgbPhase < 0.33) rgbTint = vec3(1.0, 0.8, 0.8); 
      else if (rgbPhase < 0.66) rgbTint = vec3(0.8, 1.0, 0.8); 
      else rgbTint = vec3(0.8, 0.8, 1.0);

      // --- 3. VIGNETTE (Power 2.0) ---
      // User preferred range 0.45 -> 1.0
      float rawVignette = 1.0 - smoothstep(0.45, 1.0, dist);
      // Square curve (Power 2.0): Gentler falloff than Cube (3.0)
      float deepVignette = pow(rawVignette, 1.0);

      // --- 4. COMBINE & GLOW ---
      // Apply high intensity (4.0)
      vec3 glowColor = col * 4.0;

      // Multiply modifiers
      vec3 finalRGB = glowColor * gridDarkness * rgbTint * deepVignette;

      gl_FragColor = vec4(finalRGB, 1.0);
    }
  `
);

// Register the shader with R3F
extend({ SonarScreenMaterial });
