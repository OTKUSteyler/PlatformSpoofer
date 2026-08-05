import { storage } from "@vendetta/plugin";
import { showToast } from "@vendetta/ui/toasts";
import { logger } from "@vendetta";
import { registerCommand } from "@vendetta/commands";
import { React } from "@vendetta/metro/common";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";

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

// Raw Discord application-command API constants (public/stable, not a
// Kettu-internal guess): input type BUILT_IN = 1, option type STRING = 3.
const INPUT_TYPE_BUILT_IN = 1;
const OPTION_TYPE_STRING = 3;

function getPlatformOverride() {
    const browser = PLATFORM_BROWSERS[settings.platform ?? "desktop"];
    return browser ? { browser } : null;
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    description: { color: "#dcddde", marginBottom: 16, fontSize: 14 },
    option: { padding: 12, marginBottom: 8, borderRadius: 8, backgroundColor: "#2b2d31" },
    optionActive: { backgroundColor: "#5865F2" },
    optionText: { color: "#fff", fontSize: 15 },
    optionTextActive: { fontWeight: "700" },
});

export function Settings() {
    const [current, setCurrent] = React.useState(settings.platform ?? "desktop");

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
            <Text style={styles.description}>
                Choose which platform Discord reports you as. Requires a restart to take effect.
                Use sparingly — frequent use may get your account flagged.
            </Text>
            {Object.entries(PLATFORM_LABELS).map(([value, label]) => {
                const active = current === value;
                return (
                    <TouchableOpacity
                        key={value}
                        activeOpacity={0.7}
                        style={[styles.option, active && styles.optionActive]}
                        onPress={() => {
                            settings.platform = value;
                            setCurrent(value);
                            showToast(`Platform set to ${label} — restart to apply`);
                        }}
                    >
                        <Text style={[styles.optionText, active && styles.optionTextActive]}>
                            {label}{active ? " (current)" : ""}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
}

let originalSend: typeof WebSocket.prototype.send | null = null;
let unregisterCommand: (() => void) | null = null;

export default {
    onLoad: () => {
        try {
            originalSend = WebSocket.prototype.send;
            WebSocket.prototype.send = function (data: any) {
                try {
                    if (typeof data === "string") {
                        const parsed = JSON.parse(data);
                        if (parsed?.op === 2 && parsed?.d?.properties) {
                            logger.log("PlatformSpoofer - intercepted IDENTIFY, original properties:", parsed.d.properties);
                            parsed.d.properties = { ...parsed.d.properties, ...getPlatformOverride() };
                            logger.log("PlatformSpoofer - patched properties:", parsed.d.properties);
                            data = JSON.stringify(parsed);
                        }
                    }
                } catch {}
                return originalSend!.call(this, data);
            };
        } catch (e) {
            logger.log("PlatformSpoofer - failed to patch WebSocket.send:", e);
        }

        try {
            unregisterCommand = registerCommand({
                name: "platform",
                displayName: "platform",
                description: "Set which platform Discord reports you as (spoofed)",
                displayDescription: "Set which platform Discord reports you as (spoofed)",
                inputType: INPUT_TYPE_BUILT_IN,
                applicationId: "-1",
                type: 1,
                options: [
                    {
                        name: "value",
                        displayName: "value",
                        description: "Platform to spoof",
                        displayDescription: "Platform to spoof",
                        type: OPTION_TYPE_STRING,
                        required: true,
                        choices: Object.entries(PLATFORM_LABELS).map(([value, label]) => ({
                            name: label,
                            displayName: label,
                            value,
                        })),
                    },
                ],
                execute: (args, ctx) => {
                    const value = args.find((a: any) => a.name === "value")?.value as string | undefined;
                    if (!value || !PLATFORM_LABELS[value]) {
                        showToast("PlatformSpoofer: invalid platform");
                        return { content: "Invalid platform value." };
                    }
                    settings.platform = value;
                    showToast(`Platform set to ${PLATFORM_LABELS[value]} — restart to apply`);
                    return {
                        content: `Platform spoof set to **${PLATFORM_LABELS[value]}**. Restart Discord for it to take effect.`,
                    };
                },
            });
        } catch (e) {
            logger.log("PlatformSpoofer - failed to register /platform command:", e);
        }

        showToast("PlatformSpoofer loaded — watching for IDENTIFY");
    },
    onUnload: () => {
        if (originalSend) {
            WebSocket.prototype.send = originalSend;
            originalSend = null;
        }
        if (unregisterCommand) {
            unregisterCommand();
            unregisterCommand = null;
        }
    },
    settings: Settings,
};
