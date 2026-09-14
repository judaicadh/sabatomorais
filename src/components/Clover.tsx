import React, { useMemo, useState } from "react";
import Viewer from "@samvera/clover-iiif/viewer";

interface CloverProps {
    manifest?: string;
    manifestUrls?: string[];
}

const Clover: React.FC<CloverProps> = ({ manifest, manifestUrls }) => {
    const urls =
        manifestUrls && manifestUrls.length > 0
            ? manifestUrls
            : manifest
                ? [manifest]
                : [];

    // ✅ always declare hooks at the top
    const [selectedManifest, setSelectedManifest] = useState(urls[0] || "");

    const customTheme = {
        colors: {
            /**
             * Black and dark grays in a light theme.
             * All must contrast to 4.5 or greater with secondary.
             */
            primary: "#37474F",
            primaryMuted: "#546E7A",
            primaryAlt: "#263238",

            /**
             * Key brand color(s).
             * accent must contrast to 4.5 or greater with secondary.
             */
            accent: "#37474F",
            accentMuted: "#546E7A",
            accentAlt: "#37474F",

            /**
             * White and light grays in a light theme.
             * All must must contrast to 4.5 or greater with primary and  accent.
             */
            secondary: "#FFFFFF",
            secondaryMuted: "#ECEFF1",
            secondaryAlt: "#CFD8DC",
        },

    };
    const viewerOptions = useMemo(
        () => ({
            showTitle: false,
            // Sizes the OpenSeadragon image region. Keeping it a bit shorter than
            // the panel leaves room for Clover's bottom pager (the page /
            // thumbnail strip with Previous/Next page controls) to stay visible.
            canvasHeight: "52vh",
            informationPanel: { open: false, renderToggle: false, renderContentSearch: false },
            openSeadragon: {
                gestureSettingsMouse: { scrollToZoom: true, clickToZoom: true },
                gestureSettingsTouch: { pinchRotate: true },
                showRotationControl: true,
            },
        }),
        []
    );

    // ✅ safe conditional return, after hooks
    if (urls.length === 0) return null;

    return (
        <div className="w-full">
            {urls.length > 1 && (
                <select
                    className="mb-2 rounded-sm border border-border bg-paper-light px-2 py-1 text-sm text-ink"
                    value={selectedManifest}
                    onChange={(e) => setSelectedManifest(e.target.value)}
                >
                    {urls.map((url, i) => (
                        <option key={i} value={url}>
                            Manifest {i + 1}
                        </option>
                    ))}
                </select>
            )}
            <Viewer
                iiifContent={selectedManifest}
                options={viewerOptions}
                customTheme={customTheme}
            />
        </div>
    );
};
export default Clover;
