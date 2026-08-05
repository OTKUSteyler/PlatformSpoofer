import { instead } from "@vendetta/patcher";
import { findByProps, findByStoreName } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { showToast } from "@vendetta/ui/toasts";

interface PlatformSpooferStorage {
    platform?: string;
}

const settings = storage as PlatformSpooferStorage;

const PLATFORM_BROWSERS: Record<string, string> = {
    desktop: "Discord Client",
    web: "Discord Web",
    ios: "Discord iOS",
    android: "Discord Android",
    xbox: "Discord Embedded",
    playstation: "Discord Embedded",
    vr: "Discord VR",
};

const patches: (() => void)[] = [];

function getPlatformOverride() {
    const platform = settings.platform ?? "desktop";
    const browser = PLATFORM_BROWSERS[platform];
    return browser ? { browser } : null;
}

export default {
    onLoad: () => {
        
        const GatewayConnectionProperties = findByProps("getStandardUserAgent", "browserVersion")
            ?? findByProps("browserVersion", "os");

        if (!GatewayConnectionProperties) {
            showToast("PlatformSpoofer: couldn't find the gateway properties module");
            return;
        }

        
        for (const key of Object.keys(GatewayConnectionProperties)) {
            const val = GatewayConnectionProperties[key];
            if (typeof val !== "function") continue;
            
            patches.push(
                instead(key, GatewayConnectionProperties, (args, orig) => {
                    const result = orig(...args);
                    if (result && typeof result === "object" && "browser" in result) {
                        return { ...result, ...getPlatformOverride() };
                    }
                    return result;
                })
            );
        }
    },
    onUnload: () => {
        for (const p of patches) p();
        patches.length = 0;
    },
};
