import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

const LocationFinder = ({ userTimeZone }) => {
    const map = useMap();

    useEffect(() => {
        const activeZone = userTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Lookup table format: [Latitude, Longitude, ZoomLevel]
        const timeZoneCoordinates = {
            // --- ASIA ---
            "Asia/Singapore": [1.3688, 103.9803, 7],
            "Asia/Kuala_Lumpur": [2.7456, 101.7099, 6],
            "Asia/Jakarta": [-6.1256, 106.6558, 5],
            "Asia/Bangkok": [13.6900, 100.7501, 5],
            "Asia/Ho_Chi_Minh": [10.8116, 106.6627, 5],
            "Asia/Manila": [14.5090, 121.0194, 5],
            "Asia/Tokyo": [35.5494, 139.7798, 5],
            "Asia/Seoul": [37.4602, 126.4407, 6],
            "Asia/Shanghai": [31.1443, 121.8083, 5],
            "Asia/Hong_Kong": [22.3080, 113.9185, 6],
            "Asia/Taipei": [25.0797, 121.2342, 6],
            "Asia/Kolkata": [22.6520, 88.4467, 5],
            "Asia/Dubai": [25.2532, 55.3657, 5],
            "Asia/Riyadh": [24.9576, 46.6988, 4],
            "Asia/Tehran": [35.4161, 51.1522, 5],

            // --- EUROPE ---
            "Europe/London": [51.4700, -0.4543, 5],
            "Europe/Paris": [49.0097, 2.5479, 5],
            "Europe/Berlin": [52.3667, 13.5033, 5],
            "Europe/Amsterdam": [52.3105, 4.7683, 6],
            "Europe/Rome": [41.7999, 12.2462, 5],
            "Europe/Madrid": [40.4983, -3.5676, 5],
            "Europe/Moscow": [55.9726, 37.4146, 4],
            "Europe/Istanbul": [41.2583, 28.7456, 5],

            // --- NORTH AMERICA ---
            "America/New_York": [40.6413, -73.7781, 5],
            "America/Chicago": [41.9742, -87.9073, 5],
            "America/Denver": [39.8561, -104.6737, 5],
            "America/Los_Angeles": [33.9416, -118.4085, 5],
            "America/Toronto": [43.6777, -79.6248, 5],
            "America/Vancouver": [49.1967, -123.1815, 5],
            "America/Mexico_City": [19.4361, -99.0719, 5],

            // --- SOUTH AMERICA ---
            "America/Sao_Paulo": [-23.4356, -46.4731, 5],
            "America/Buenos_Aires": [-34.8222, -58.5358, 5],
            "America/Bogota": [4.7016, -74.1469, 5],

            // --- OCEANIA / PACIFIC ---
            "Australia/Sydney": [-33.9399, 151.1753, 5],
            "Australia/Melbourne": [-37.6690, 144.8410, 5],
            "Australia/Perth": [-31.9403, 115.9668, 5],
            "Pacific/Auckland": [-37.0082, 174.7850, 5],
            "Pacific/Honolulu": [21.3187, -157.9225, 6],

            // --- AFRICA ---
            "Africa/Cairo": [30.1219, 31.4056, 5],
            "Africa/Johannesburg": [-26.1392, 28.2460, 5],
            "Africa/Nairobi": [-1.3192, 36.9275, 5],
            "Africa/Lagos": [6.5774, 3.3215, 5]
        };

        const targetData = timeZoneCoordinates[activeZone];

        if (targetData) {
            // FIX 3: Changed map.flyTo -> map.setView for instant data fetch!
            const [lat, lon, zoom] = targetData;
            map.setView([lat, lon], zoom);
        } else {
            try {
                const date = new Date();
                const options = { timeZone: activeZone, timeZoneName: 'shortOffset' };
                const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
                const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value;

                if (offsetPart) {
                    let offsetStr = offsetPart.replace('GMT', '');
                    if (offsetStr === '') {
                        map.setView([51.4700, 0], 4);
                    } else {
                        const sign = offsetStr.startsWith('-') ? -1 : 1;
                        const [hours, mins] = offsetStr.replace(/[+-]/, '').split(':').map(Number);
                        const totalHours = hours + (mins ? mins/60 : 0);
                        const longitude = sign * totalHours * 15;

                        map.setView([20, longitude], 4);
                    }
                } else {
                    map.setView([1.3688, 103.9803], 6);
                }
            } catch (e) {
                map.setView([1.3688, 103.9803], 6);
            }
        }

    }, [map, userTimeZone]);

    return null;
};

export default LocationFinder;