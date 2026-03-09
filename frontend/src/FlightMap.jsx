import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const MapUpdater = ({ flightData }) => {
    const map = useMap();

    useEffect(() => {
        if (flightData && flightData.path && flightData.path.length > 0) {
            const bounds = flightData.path.map(coord => [coord[0], coord[1]]);

            if (flightData.route_metadata.alternate_coords) {
                bounds.push([
                    flightData.route_metadata.alternate_coords[0],
                    flightData.route_metadata.alternate_coords[1]
                ]);
            }

            // Keep the padding so it dodges the details drawer!
            map.flyToBounds(bounds, {
                paddingTopLeft: [50, 50],
                paddingBottomRight: [380, 50],
                duration: 1.5
            });
        }
    }, [flightData, map]);

    return null;
};

const FlightMap = ({ flightData }) => {
    const defaultCenter = [1.3688, 103.9803];

    const hasData = flightData && flightData.path && flightData.path.length > 0;
    const origin = hasData ? flightData.path[0] : null;
    const destination = hasData ? flightData.path[flightData.path.length - 1] : null;

    return (
        <MapContainer
            center={defaultCenter}
            zoom={5}
            style={{ height: '100%', width: '100%', backgroundColor: '#1e1e1e' }} // Dark background fallback
        >
            {/* NEW BASEMAP: CartoDB Dark Matter.
        High contrast, dark, strips away distracting terrain and colors.
      */}
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
            />

            <MapUpdater flightData={flightData} />

            {hasData && (
                <>
                    {/* Main Flight Path - Changed to a vibrant, radar-like cyan/magenta */}
                    <Polyline positions={flightData.path} color="#06b6d4" weight={3} opacity={0.9} />

                    {/* Alternate Route - Colored in an urgent amber/orange */}
                    {flightData.route_metadata.alternate_coords && (
                        <Polyline
                            positions={[destination, flightData.route_metadata.alternate_coords]}
                            color="#f59e0b"
                            weight={2}
                            dashArray="6, 8"
                            opacity={0.8}
                        />
                    )}

                    {/* NEW FEATURE: Waypoint Plotting
            We loop through the path array and draw a tiny triangle/dot for every intermediate fix.
          */}
                    {flightData.path.map((coord, index) => {
                        // We don't want to draw a tiny dot over the Origin (0) or Destination (length - 1)
                        if (index === 0 || index === flightData.path.length - 1) return null;

                        return (
                            <CircleMarker
                                key={index}
                                center={coord}
                                radius={3}
                                color="#38bdf8"
                                weight={1}
                                fillColor="#0f172a"
                                fillOpacity={1}
                            />
                        );
                    })}

                    {/* Origin Marker (Green) */}
                    <CircleMarker center={origin} radius={7} color="#22c55e" weight={2} fillColor="#000" fillOpacity={1}>
                        <Popup>Origin: {flightData.route_metadata.origin}</Popup>
                    </CircleMarker>

                    {/* Destination Marker (Red) */}
                    <CircleMarker center={destination} radius={7} color="#ef4444" weight={2} fillColor="#000" fillOpacity={1}>
                        <Popup>Destination: {flightData.route_metadata.destination}</Popup>
                    </CircleMarker>

                    {/* Alternate Marker (Amber) */}
                    {flightData.route_metadata.alternate_coords && (
                        <CircleMarker center={flightData.route_metadata.alternate_coords} radius={5} color="#f59e0b" weight={2} fillColor="#000" fillOpacity={1}>
                            <Popup>Alternate: {flightData.route_metadata.alternate}</Popup>
                        </CircleMarker>
                    )}
                </>
            )}
        </MapContainer>
    );
};

export default FlightMap;
