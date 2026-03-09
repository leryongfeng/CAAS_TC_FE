import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

const LocationFinder = ({ userTimeZone }) => {
    const map = useMap();

    useEffect(() => {
        // 1. Use the dropdown prop. If empty, secretly grab their system timezone.
        const activeZone = userTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;

        // 2. Map the IANA timezone strings directly to major airport coordinates
        const timeZoneCoordinates = {
            // --- ASIA ---
            "Asia/Singapore": [1.3688, 103.9803],     // WSSS (Singapore)
            "Asia/Kuala_Lumpur": [2.7456, 101.7099],  // WMKK (Kuala Lumpur)
            "Asia/Jakarta": [-6.1256, 106.6558],      // WIII (Jakarta)
            "Asia/Bangkok": [13.6900, 100.7501],      // VTBS (Bangkok)
            "Asia/Ho_Chi_Minh": [10.8116, 106.6627],  // VVTS (Ho Chi Minh City)
            "Asia/Manila": [14.5090, 121.0194],       // RPLL (Manila)
            "Asia/Tokyo": [35.5494, 139.7798],        // RJTT (Tokyo Haneda)
            "Asia/Seoul": [37.4602, 126.4407],        // RKSI (Seoul Incheon)
            "Asia/Shanghai": [31.1443, 121.8083],     // ZSPD (Shanghai Pudong)
            "Asia/Hong_Kong": [22.3080, 113.9185],    // VHHH (Hong Kong)
            "Asia/Taipei": [25.0797, 121.2342],       // RCTP (Taipei Taoyuan)
            "Asia/Kolkata": [22.6520, 88.4467],       // VECC (Kolkata)
            "Asia/Dubai": [25.2532, 55.3657],         // OMDB (Dubai)
            "Asia/Riyadh": [24.9576, 46.6988],        // OERK (Riyadh)
            "Asia/Tehran": [35.4161, 51.1522],        // OIIE (Tehran)

            // --- EUROPE ---
            "Europe/London": [51.4700, -0.4543],      // EGLL (London Heathrow)
            "Europe/Paris": [49.0097, 2.5479],        // LFPG (Paris CDG)
            "Europe/Berlin": [52.3667, 13.5033],      // EDDB (Berlin Brandenburg)
            "Europe/Amsterdam": [52.3105, 4.7683],    // EHAM (Amsterdam Schiphol)
            "Europe/Rome": [41.7999, 12.2462],        // LIRF (Rome Fiumicino)
            "Europe/Madrid": [40.4983, -3.5676],      // LEMD (Madrid Barajas)
            "Europe/Moscow": [55.9726, 37.4146],      // UUEE (Moscow Sheremetyevo)
            "Europe/Istanbul": [41.2583, 28.7456],    // LTFM (Istanbul)

            // --- NORTH AMERICA ---
            "America/New_York": [40.6413, -73.7781],  // KJFK (New York)
            "America/Chicago": [41.9742, -87.9073],   // KORD (Chicago O'Hare)
            "America/Denver": [39.8561, -104.6737],   // KDEN (Denver)
            "America/Los_Angeles": [33.9416, -118.4085], // KLAX (Los Angeles)
            "America/Toronto": [43.6777, -79.6248],   // CYYZ (Toronto Pearson)
            "America/Vancouver": [49.1967, -123.1815], // CYVR (Vancouver)
            "America/Mexico_City": [19.4361, -99.0719], // MMMX (Mexico City)

            // --- SOUTH AMERICA ---
            "America/Sao_Paulo": [-23.4356, -46.4731], // SBGR (Sao Paulo Guarulhos)
            "America/Buenos_Aires": [-34.8222, -58.5358], // SAEZ (Buenos Aires Ezeiza)
            "America/Bogota": [4.7016, -74.1469],     // SKBO (Bogota)

            // --- OCEANIA / PACIFIC ---
            "Australia/Sydney": [-33.9399, 151.1753], // YSSY (Sydney)
            "Australia/Melbourne": [-37.6690, 144.8410], // YMML (Melbourne)
            "Australia/Perth": [-31.9403, 115.9668],  // YPPH (Perth)
            "Pacific/Auckland": [-37.0082, 174.7850], // NZAA (Auckland)
            "Pacific/Honolulu": [21.3187, -157.9225], // PHNL (Honolulu)

            // --- AFRICA ---
            "Africa/Cairo": [30.1219, 31.4056],       // HECA (Cairo)
            "Africa/Johannesburg": [-26.1392, 28.2460], // FAOR (Johannesburg)
            "Africa/Nairobi": [-1.3192, 36.9275],     // HKJK (Nairobi)
            "Africa/Lagos": [6.5774, 3.3215]          // DNMM (Lagos)

        };

        const targetCoords = timeZoneCoordinates[activeZone];

        if (targetCoords) {
            // Smoothly fly to the new timezone coordinates
            map.flyTo(targetCoords, 5, { duration: 1.5 });
        } else {
            // Safe fallback to Singapore
            map.flyTo([1.3688, 103.9803], 6);
        }

    }, [map, userTimeZone]); // Re-runs instantly when the dropdown changes

    return null;
};

export default LocationFinder;