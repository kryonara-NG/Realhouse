import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.kryonara.reelhouse",
  appName: "Reelhouse",
  webDir: "dist",
  server: { androidScheme: "https" },
  plugins: {
    SplashScreen: { launchAutoHide: true, backgroundColor: "#faf6ef", showSpinner: false },
    StatusBar: { style: "LIGHT", backgroundColor: "#faf6ef" }
  }
};

export default config;