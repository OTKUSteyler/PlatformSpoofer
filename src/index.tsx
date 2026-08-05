import { instead } from "@vendetta/patcher";
import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { showToast } from "@vendetta/ui/toasts";
import { General } from "@vendetta/ui/components";
import { React } from "@vendetta/metro/common";

const { ScrollView, View, Text } = General;

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

const PLATFORM_LABELS: Record<string, string> = {
    desktop: "Desktop",
    web: "Web",
    ios: "iOS",
    android: "Android",
    xbox: "Xbox",
    playstation: "PlayStation",
    vr: "VR",
};

const patches: (() => void)[] = [];

function getPlatformOverride() {
    const platform = settings.platform ?? "desktop";
    const browser = PLATFORM_BROWSERS[platform];
    return browser ? { browser } : null;
}


export function Settings() {
    const [current, setCurrent] = React.useState(settings.platform ?? "desktop");

    return (
        <ScrollView style={{ flex: 1, padding: 16 }}>
            <Text style={{ marginBottom: 12 }}>
                Choose which platform Discord reports you as. Requires a restart to take effect.
                Use sparingly — frequent use may get your account flagged.
            </Text>
            {Object.entries(PLATFORM_LABELS).map(([value, label]) => {
                const active = current === value;
                return (
                    <View
                        key={value}
                        style={{
                            padding: 12,
                            marginBottom: 8,
                            borderRadius: 8,
                            backgroundColor: active ? "#5865F2" : "#2b2d31",
                        }}
                        onTouchEnd={() => {
                            settings.platform = value;
                            setCurrent(value);
                            showToast(`Platform set to ${label} — restart to apply`);
                        }}
                    >
                        <Text style={{ color: "#fff", fontWeight: active ? "700" : "400" }}>
                            {label}{active ? " (current)" : ""}
                        </Text>
                    </View>
                );
            })}
        </ScrollView>
    );
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
    settings: Settings,
};
