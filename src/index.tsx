import { storage } from "@vendetta/plugin";
import { showToast } from "@vendetta/ui/toasts";
import { logger } from "@vendetta";
import { registerCommand } from "@vendetta/commands";
import { ApplicationCommandOptionType, ApplicationCommandInputType } from "@vendetta/commands/types";
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

function getPlatformOverride() {
    const browser = PLATFORM_BROWSERS[settings.platform ?? "desktop"];
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

let originalSend: typeof WebSocket.prototype.send | null = null;
let unregisterCommand: (() => void) | null = null;

export default {
    onLoad: () => {
        // --- WebSocket IDENTIFY patch ---
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

        // --- /platform slash command ---
        unregisterCommand = registerCommand({
            name: "platform",
            displayName: "platform",
            description: "Set which platform Discord reports you as (spoofed)",
            displayDescription: "Set which platform Discord reports you as (spoofed)",
            inputType: ApplicationCommandInputType.BUILT_IN,
            applicationId: "-1",
            type: 1,
            options: [
                {
                    name: "value",
                    displayName: "value",
                    description: "Platform to spoof",
                    displayDescription: "Platform to spoof",
                    type: ApplicationCommandOptionType.STRING,
                    required: true,
                    choices: Object.entries(PLATFORM_LABELS).map(([value, label]) => ({
                        name: label,
                        displayName: label,
                        value,
                    })),
                },
            ],
            execute: (args, ctx) => {
                const value = args.find(a => a.name === "value")?.value as string | undefined;
                if (!value || !PLATFORM_LABELS[value]) {
                    showToast("PlatformSpoofer: invalid platform");
                    return {
                        content: "Invalid platform value.",
                    };
                }
                settings.platform = value;
                showToast(`Platform set to ${PLATFORM_LABELS[value]} — restart to apply`);
                return {
                    content: `Platform spoof set to **${PLATFORM_LABELS[value]}**. Restart Discord for it to take effect.`,
                };
            },
        });

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
