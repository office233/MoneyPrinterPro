import fs from 'fs';
import path from 'path';

// Parse motion library from markdown
function parseMotionLibrary() {
  const motionLibPath = path.join(process.env.HOME, '.openclaw/workspace/video-motion-library.md');
  
  // For now, we'll use predefined motion sets
  // Future: parse actual markdown dynamically
  
  return {
    character_actions: {
      neutral: [
        "adjusts posture slightly",
        "shifts weight from one foot to the other",
        "slight head tilt",
        "natural blink",
        "micro smile",
        "relaxes shoulders"
      ],
      hands: [
        "natural hand gestures while speaking",
        "one hand in pocket",
        "adjusts sleeve",
        "touches hair lightly",
        "holds phone naturally"
      ],
      feminine: [
        "tucks hair behind ear",
        "plays with hair gently",
        "slight hip movement",
        "graceful head tilt",
        "soft smile then reserved"
      ],
      lifestyle: [
        "checks phone briefly",
        "scrolls quickly",
        "locks phone",
        "adjusts sunglasses",
        "natural seated position"
      ]
    },
    camera_movements: {
      static: [
        "camera is stationary",
        "locked-off camera",
        "static shot"
      ],
      minimal: [
        "subtle handheld movement",
        "natural camera shake",
        "slight perspective shift"
      ],
      dynamic: [
        "slow zoom in",
        "camera orbits around subject slowly",
        "slow tracking shot following subject",
        "gentle pan right"
      ]
    }
  };
}

export function selectMotion(shotArchetype, format) {
  const motionLib = parseMotionLibrary();
  
  // Different motion intensity based on format
  let cameraMotion, characterAction;
  
  if (format === 'video_ai') {
    // Full motion for video AI
    cameraMotion = motionLib.camera_movements.dynamic[
      Math.floor(Math.random() * motionLib.camera_movements.dynamic.length)
    ];
    characterAction = motionLib.character_actions.lifestyle[
      Math.floor(Math.random() * motionLib.character_actions.lifestyle.length)
    ];
  } else if (format === 'reel_static') {
    // Minimal motion (will be enhanced by zoom)
    cameraMotion = motionLib.camera_movements.static[
      Math.floor(Math.random() * motionLib.camera_movements.static.length)
    ];
    characterAction = motionLib.character_actions.neutral[
      Math.floor(Math.random() * motionLib.character_actions.neutral.length)
    ];
  } else {
    // Feed static - no motion
    cameraMotion = "camera is stationary";
    characterAction = "still pose";
  }
  
  return {
    camera_motion: cameraMotion,
    character_action: characterAction,
    motion_prompt: `Camera: ${cameraMotion}. Character: ${characterAction}.`,
    video_motion_bias: format === 'video_ai' ? 
      `smooth continuous motion, natural movement flow, cinematic camera work` : 
      `minimal natural movement, subtle alive presence`
  };
}
