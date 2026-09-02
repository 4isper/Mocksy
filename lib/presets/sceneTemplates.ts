import type { SceneTemplate } from "@/lib/types/editor";

/**
 * Pre-built scene layouts combining frame type, background, style, and optional
 * multi-device arrangement. Applied with one click; media is never stored in
 * the template so it acts as a visual starting point.
 */
export const sceneTemplates: SceneTemplate[] = [
  // ---- Single device: iPhone variants ----
  {
    id: "iphone-dark-studio",
    nameKey: "sceneTemplateName.iphoneDarkStudio",
    frame: "iphone",
    scenePatch: {
      stylePreset: "default",
      shadowOpacity: 0.55,
      backgroundMode: "solid",
      backgroundColor: "#09090b",
      borderRadius: 0,
      tiltX: 0,
      tiltY: 0,
      screenGlare: false,
      floorReflection: false,
    },
  },
  {
    id: "iphone-glass-blue",
    nameKey: "sceneTemplateName.iphoneGlassBlue",
    frame: "iphone",
    scenePatch: {
      stylePreset: "glassLight",
      shadowOpacity: 0.4,
      backgroundMode: "gradient",
      backgroundBlur: 0,
      gradientFrom: "#1d4ed8",
      gradientTo: "#7c3aed",
      gradientVia: null,
      gradientType: "linear",
      gradientAngle: 135,
      borderRadius: 0,
      tiltX: 0,
      tiltY: 0,
      screenGlare: true,
      floorReflection: false,
    },
  },
  {
    id: "iphone-warm-gradient",
    nameKey: "sceneTemplateName.iphoneWarmGradient",
    frame: "iphone15",
    scenePatch: {
      stylePreset: "glassDark",
      shadowOpacity: 0.5,
      backgroundMode: "gradient",
      gradientFrom: "#f97316",
      gradientTo: "#dc2626",
      gradientVia: null,
      gradientType: "linear",
      gradientAngle: 120,
      borderRadius: 0,
      tiltX: 0,
      tiltY: 3,
      screenGlare: false,
      floorReflection: false,
    },
  },
  {
    id: "iphone-story",
    nameKey: "sceneTemplateName.iphoneStory",
    frame: "iphone",
    scenePatch: {
      stylePreset: "default",
      shadowOpacity: 0.5,
      backgroundMode: "gradient",
      gradientFrom: "#0f172a",
      gradientTo: "#1e293b",
      gradientVia: null,
      gradientType: "linear",
      gradientAngle: 180,
      borderRadius: 0,
      tiltX: 0,
      tiltY: 0,
      aspectRatio: "9 / 16",
      screenGlare: false,
      floorReflection: false,
    },
  },

  // ---- MacBook / laptop ----
  {
    id: "macbook-minimal",
    nameKey: "sceneTemplateName.macbookMinimal",
    frame: "macbook",
    scenePatch: {
      stylePreset: "default",
      shadowOpacity: 0.35,
      backgroundMode: "solid",
      backgroundColor: "#faf9f6",
      borderRadius: 0,
      tiltX: 0,
      tiltY: 0,
      screenGlare: false,
      floorReflection: false,
    },
  },
  {
    id: "macbook-dark-browser",
    nameKey: "sceneTemplateName.macbookDarkBrowser",
    frame: "macbook",
    scenePatch: {
      stylePreset: "glassDark",
      shadowOpacity: 0.45,
      backgroundMode: "solid",
      backgroundColor: "#09090b",
      borderRadius: 0,
      tiltX: 0,
      tiltY: 0,
      screenGlare: false,
      floorReflection: false,
    },
  },
  {
    id: "browser-landing",
    nameKey: "sceneTemplateName.browserLanding",
    frame: "browser",
    scenePatch: {
      stylePreset: "default",
      shadowOpacity: 0.4,
      backgroundMode: "solid",
      backgroundColor: "#f8fafc",
      borderRadius: 12,
      tiltX: 0,
      tiltY: 0,
      screenGlare: false,
      floorReflection: false,
    },
  },

  // ---- Tablet ----
  {
    id: "ipad-landscape",
    nameKey: "sceneTemplateName.ipadLandscape",
    frame: "ipad",
    scenePatch: {
      stylePreset: "glassLight",
      shadowOpacity: 0.4,
      backgroundMode: "gradient",
      gradientFrom: "#059669",
      gradientTo: "#0ea5e9",
      gradientVia: null,
      gradientType: "linear",
      gradientAngle: 135,
      borderRadius: 0,
      tiltX: 0,
      tiltY: 0,
      screenGlare: false,
      floorReflection: false,
    },
  },

  // ---- Multi-device layouts ----
  {
    id: "iphone-ipad-pair",
    nameKey: "sceneTemplateName.iphoneIpadPair",
    frame: "iphone",
    scenePatch: {
      stylePreset: "default",
      shadowOpacity: 0.45,
      backgroundMode: "solid",
      backgroundColor: "#0f172a",
      borderRadius: 0,
      tiltX: 0,
      tiltY: 0,
      screenGlare: false,
      floorReflection: false,
    },
    frameInstances: [
      { frame: "iphone", x: 0.32, y: 0.5, scale: 0.8, layerId: null },
      { frame: "ipad", x: 0.7, y: 0.5, scale: 0.65, layerId: null },
    ],
  },
  {
    id: "wallpaper-pair",
    nameKey: "sceneTemplateName.wallpaperPair",
    frame: "iphone",
    scenePatch: {
      stylePreset: "default",
      shadowOpacity: 0.45,
      backgroundMode: "solid",
      backgroundColor: "#09090b",
      borderRadius: 0,
      tiltX: 0,
      tiltY: 0,
      aspectRatio: "4 / 5",
      screenGlare: false,
      floorReflection: true,
    },
    frameInstances: [
      {
        frame: "iphone15",
        x: 0.26,
        y: 0.5,
        scale: 0.48,
        layerId: null,
        screen: {
          enabled: true,
          style: "lock",
          theme: "dark",
          showStatusBar: true,
          showClock: true,
          showDate: true,
          showNotifications: false,
          showDock: false,
          showHomeIndicator: true,
          time: "9:41",
          date: "Tuesday, August 4"
        },
      },
      {
        frame: "iphone15",
        x: 0.74,
        y: 0.5,
        scale: 0.48,
        layerId: null,
        screen: {
          enabled: true,
          style: "home",
          theme: "dark",
          showStatusBar: true,
          showClock: false,
          showDate: false,
          showNotifications: false,
          showDock: true,
          showHomeIndicator: true,
          time: "9:41",
          date: "Tuesday, August 4"
        },
      },
    ],
  },
  {
    id: "multi-device-showcase",
    nameKey: "sceneTemplateName.multiDeviceShowcase",
    frame: "iphone",
    scenePatch: {
      stylePreset: "default",
      shadowOpacity: 0.4,
      backgroundMode: "solid",
      backgroundColor: "#18181b",
      borderRadius: 0,
      tiltX: 0,
      tiltY: 0,
      screenGlare: false,
      floorReflection: false,
    },
    frameInstances: [
      { frame: "iphone", x: 0.2, y: 0.5, scale: 0.7, layerId: null },
      { frame: "ipad", x: 0.5, y: 0.5, scale: 0.55, layerId: null },
      { frame: "macbook", x: 0.8, y: 0.55, scale: 0.5, layerId: null },
    ],
  },
  {
    id: "desktop-dual",
    nameKey: "sceneTemplateName.desktopDual",
    frame: "desktop",
    scenePatch: {
      stylePreset: "default",
      shadowOpacity: 0.35,
      backgroundMode: "solid",
      backgroundColor: "#0f172a",
      borderRadius: 0,
      tiltX: 0,
      tiltY: 0,
      screenGlare: false,
      floorReflection: false,
    },
    frameInstances: [
      { frame: "desktop", x: 0.35, y: 0.5, scale: 0.8, layerId: null },
      { frame: "desktop", x: 0.7, y: 0.5, scale: 0.8, layerId: null },
    ],
  },

  // ---- TV / presentation ----
  {
    id: "tv-presentation",
    nameKey: "sceneTemplateName.tvPresentation",
    frame: "tv",
    scenePatch: {
      stylePreset: "default",
      shadowOpacity: 0.5,
      backgroundMode: "solid",
      backgroundColor: "#09090b",
      borderRadius: 0,
      tiltX: 0,
      tiltY: 0,
      screenGlare: false,
      floorReflection: true,
    },
  },

  // ---- Watch ----
  {
    id: "watch-collection",
    nameKey: "sceneTemplateName.watchCollection",
    frame: "watch",
    scenePatch: {
      stylePreset: "default",
      shadowOpacity: 0.4,
      backgroundMode: "solid",
      backgroundColor: "#18181b",
      borderRadius: 0,
      tiltX: 0,
      tiltY: 0,
      screenGlare: false,
      floorReflection: false,
    },
    frameInstances: [
      { frame: "watchUltra", x: 0.35, y: 0.5, scale: 1, layerId: null },
      { frame: "watch", x: 0.65, y: 0.5, scale: 1, layerId: null },
    ],
  },

  // ---- Android ----
  {
    id: "galaxy-modern",
    nameKey: "sceneTemplateName.galaxyModern",
    frame: "galaxy24",
    scenePatch: {
      stylePreset: "glassDark",
      shadowOpacity: 0.45,
      backgroundMode: "gradient",
      gradientFrom: "#10b981",
      gradientTo: "#22d3ee",
      gradientVia: null,
      gradientType: "linear",
      gradientAngle: 135,
      borderRadius: 0,
      tiltX: 0,
      tiltY: 0,
      screenGlare: true,
      floorReflection: false,
    },
  },

  // ---- Minimal / no-frame ----
  {
    id: "minimal-no-frame",
    nameKey: "sceneTemplateName.minimalNoFrame",
    frame: "none",
    scenePatch: {
      stylePreset: "default",
      shadowOpacity: 0.15,
      backgroundMode: "solid",
      backgroundColor: "#faf9f6",
      borderRadius: 24,
      tiltX: 0,
      tiltY: 0,
      screenGlare: false,
      floorReflection: false,
    },
  },
];

/** Ordered list of scene template ids for UI display. */
export const SCENE_TEMPLATE_ORDER: string[] = sceneTemplates.map((t) => t.id);

/** Returns a scene template by its id. */
export function getSceneTemplate(id: string): SceneTemplate | undefined {
  return sceneTemplates.find((t) => t.id === id);
}
