import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet'; // Needed to stop click events from bubbling to the map
import 'leaflet/dist/leaflet.css';
import LocationFinder from './LocationFinder';

// 1. Camera Panning for Active Flights
const MapUpdater = ({ flightData }) => {
    const map = useMap();

    useEffect(() => {
        if (flightData && flightData.path && flightData.path.length > 0) {
            const bounds = flightData.path.map(pt => pt.coords);
            if (flightData.route_metadata?.alternate_coords) {
                bounds.push(flightData.route_metadata.alternate_coords);
            }
            map.flyToBounds(bounds, { paddingTopLeft: [50, 50], paddingBottomRight: [380, 50], duration: 1.5 });
        }
    }, [flightData, map]);

    return null;
};

// 2. The Spatial Vector Chunk Engine
const ChunkManager = ({ onDataCached, displayOrphans }) => {
    const loadedChunks = useRef(new Set());
    const map = useMap();

    useEffect(() => {
        loadedChunks.current.clear();
        map.fire('moveend');
    }, [displayOrphans, map]);

    useMapEvents({
        moveend: (e) => {
            const map = e.target;
            const bounds = map.getBounds();
            const zoom = map.getZoom();

            if (zoom < 5) return;

            const CHUNK_SIZE = 5;
            const minLat = Math.floor(bounds.getSouth() / CHUNK_SIZE) * CHUNK_SIZE;
            const maxLat = Math.ceil(bounds.getNorth() / CHUNK_SIZE) * CHUNK_SIZE;
            const minLon = Math.floor(bounds.getWest() / CHUNK_SIZE) * CHUNK_SIZE;
            const maxLon = Math.ceil(bounds.getEast() / CHUNK_SIZE) * CHUNK_SIZE;

            for (let lat = minLat; lat < maxLat; lat += CHUNK_SIZE) {
                for (let lon = minLon; lon < maxLon; lon += CHUNK_SIZE) {
                    const chunkId = `${lat}_${lon}`;

                    if (!loadedChunks.current.has(chunkId)) {
                        loadedChunks.current.add(chunkId);

                        fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}/api/map/bounds`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                min_lat: lat,
                                max_lat: lat + CHUNK_SIZE,
                                min_lon: lon,
                                max_lon: lon + CHUNK_SIZE,
                                hide_orphans: !displayOrphans
                            })
                        })
                            .then(res => res.json())
                            .then(newData => onDataCached(newData))
                            .catch(err => {
                                console.error("Chunk fetch failed", err);
                                loadedChunks.current.delete(chunkId);
                            });
                    }
                }
            }
        }
    });

    return null;
};

// 3. Global Map Events (Handles "Clicking Away" and Ultra-Fast Mouse Tracking)
const GlobalMapEvents = ({ setSelectedAirway }) => {
    useMapEvents({
        click: () => {
            // This fires when the user clicks empty space on the map
            setSelectedAirway(null);
        },
        mousemove: (e) => {
            const latEl = document.getElementById('mouse-lat');
            const lngEl = document.getElementById('mouse-lng');
            if (latEl && lngEl) {
                latEl.innerText = e.latlng.lat.toFixed(4);
                lngEl.innerText = e.latlng.lng.toFixed(4);
            }
        }
    });
    return null;
};

// 4. The Main Map Component
const FlightMap = ({ flightData, userTimeZone, displayOrphans, hideBackground }) => {
    const defaultCenter = [1.3688, 103.9803];

    const [selectedAirway, setSelectedAirway] = useState(null);
    const [hoveredAirway, setHoveredAirway] = useState(null);
    const [hoveredWaypoint, setHoveredWaypoint] = useState(null);
    const [mapCache, setMapCache] = useState({ fixes: {}, navaids: {}, airports: {}, airways: {} });

    useEffect(() => {
        setMapCache({ fixes: {}, navaids: {}, airports: {}, airways: {} });
    }, [displayOrphans]);

    const handleNewChunkData = (newData) => {
        setMapCache(prev => ({
            fixes: { ...prev.fixes, ...newData.fixes },
            navaids: { ...prev.navaids, ...newData.navaids },
            airports: { ...prev.airports, ...newData.airports },
            airways: { ...prev.airways, ...newData.airways }
        }));
    };

    const hasActiveFlight = flightData && flightData.path && flightData.path.length > 0;

    const renderBackgroundWaypoints = (waypointDict, typeStr, colorHex) => {
        return Object.entries(waypointDict).map(([name, coords]) => {
            const isHovered = hoveredWaypoint?.name === name;
            return (
                <CircleMarker
                    key={`${typeStr}-${name}`}
                    center={coords}
                    radius={isHovered ? 6 : 3}
                    color={colorHex}
                    weight={isHovered ? 2 : 1}
                    fillColor={isHovered ? colorHex : "#1e293b"}
                    fillOpacity={1}
                    interactive={true}
                    eventHandlers={{
                        mouseover: (e) => {
                            e.target.bringToFront();
                            setHoveredWaypoint({ name, type: typeStr, coords });
                        },
                        mouseout: () => setHoveredWaypoint(null)
                    }}
                />
            );
        });
    };

    return (
        <div style={{ position: 'relative', height: '100%', width: '100%' }}>
            {/* CSS override to kill any lingering focus outlines on SVGs */}
            <style>{`
                path.leaflet-interactive:focus {
                    outline: none !important;
                }
            `}</style>

            <MapContainer center={defaultCenter} zoom={6} style={{ height: '100%', width: '100%', backgroundColor: '#1e1e1e' }}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; CartoDB' />
                <LocationFinder userTimeZone={userTimeZone} />
                <MapUpdater flightData={flightData} />
                <ChunkManager onDataCached={handleNewChunkData} displayOrphans={displayOrphans} />
                <GlobalMapEvents setSelectedAirway={setSelectedAirway} />

                {/* --- SMART AIRWAYS LAYER --- */}
                {Object.entries(mapCache.airways).map(([awName, airwaySequence]) => {

                    // FOCUS MODE: If a flight is active and Focus Mode is checked, ONLY render airways in the flight path!
                    if (hasActiveFlight && hideBackground) {
                        const usedAirways = flightData.route_metadata?.used_airways || [];
                        if (!usedAirways.includes(awName)) return null;
                    }

                    const positions = airwaySequence.map(point => point.coords);
                    const isSelected = selectedAirway === awName;
                    const isHovered = hoveredAirway === awName;

                    const weight = isSelected ? 6 : (isHovered ? 5 : 3);
                    const color = isSelected ? '#facc15' : (isHovered ? '#38bdf8' : '#334155');
                    const opacity = isSelected || isHovered ? 1 : 0.6;

                    return (
                        <Polyline
                            key={`aw-${awName}-${isSelected ? 'selected' : 'default'}`}
                            positions={positions}
                            color={color}
                            weight={weight}
                            opacity={opacity}
                            interactive={true}
                            eventHandlers={{
                                mouseover: (e) => {
                                    e.target.bringToFront();
                                    setHoveredAirway(awName);
                                },
                                mouseout: () => setHoveredAirway(null),
                                click: (e) => {
                                    L.DomEvent.stopPropagation(e);
                                    setSelectedAirway(isSelected ? null : awName);
                                    e.target.bringToFront();
                                }
                            }}
                            style={{ cursor: 'pointer' }}
                        />
                    );
                })}

                {/* --- CONDITIONAL DISCRETE WAYPOINTS (Hidden in Focus Mode) --- */}
                {!(hasActiveFlight && hideBackground) && (
                    <>
                        {renderBackgroundWaypoints(mapCache.fixes, "Fix", "#94a3b8")}
                        {renderBackgroundWaypoints(mapCache.navaids, "Navaid", "#60a5fa")}
                        {renderBackgroundWaypoints(mapCache.airports, "Airport", "#34d399")}
                    </>
                )}

                {/* --- FOREGROUND LAYER: ACTIVE FLIGHT --- */}
                {hasActiveFlight && (
                    <>
                        {/* Map the flight path coordinates for the Polyline */}
                        <Polyline
                            positions={flightData.path.map(pt => pt.coords)}
                            color="#06b6d4"
                            weight={3}
                            opacity={1}
                            interactive={false}
                        />

                        {flightData.route_metadata?.alternate_coords && (
                            <Polyline
                                positions={[
                                    flightData.path[flightData.path.length - 1].coords,
                                    flightData.route_metadata.alternate_coords
                                ]}
                                color="#f59e0b"
                                weight={2}
                                dashArray="6, 8"
                                opacity={0.8}
                                interactive={false}
                            />
                        )}

                        {/* Interactive Waypoints for the Active Flight (Uses the rich object data!) */}
                        {flightData.path.map((pt, index) => {
                            const isWPSelected = hoveredWaypoint?.name === pt.name;

                            // Color scheme: Origin (Green), Destination (Red), Intermediate (Cyan)
                            let markerColor = "#38bdf8";
                            let markerRadius = isWPSelected ? 6 : 4;

                            if (index === 0) {
                                markerColor = "#22c55e";
                                markerRadius = isWPSelected ? 9 : 7;
                            } else if (index === flightData.path.length - 1) {
                                markerColor = "#ef4444";
                                markerRadius = isWPSelected ? 9 : 7;
                            }

                            return (
                                <CircleMarker
                                    key={`flight-wp-${index}`}
                                    center={pt.coords}
                                    radius={markerRadius}
                                    color={markerColor}
                                    weight={2}
                                    fillColor={isWPSelected ? markerColor : "#ffffff"}
                                    fillOpacity={1}
                                    interactive={true}
                                    eventHandlers={{
                                        mouseover: (e) => {
                                            e.target.bringToFront();
                                            // Directly injects the real Name and Type from the Python backend
                                            setHoveredWaypoint({ name: pt.name, type: pt.type, coords: pt.coords });
                                        },
                                        mouseout: () => setHoveredWaypoint(null)
                                    }}
                                />
                            );
                        })}

                        {/* Alternate Marker */}
                        {flightData.route_metadata?.alternate_coords && (
                            <CircleMarker
                                center={flightData.route_metadata.alternate_coords}
                                radius={hoveredWaypoint?.type === "Alternate" ? 7 : 5}
                                color="#f59e0b"
                                weight={2}
                                fillColor="#000"
                                fillOpacity={1}
                                interactive={true}
                                eventHandlers={{
                                    mouseover: (e) => {
                                        e.target.bringToFront();
                                        setHoveredWaypoint({ name: flightData.route_metadata.alternate, type: "Alternate", coords: flightData.route_metadata.alternate_coords });
                                    },
                                    mouseout: () => setHoveredWaypoint(null)
                                }}
                            />
                        )}
                    </>
                )}
            </MapContainer>

            {/* --- BOTTOM LEFT HUD --- */}
            <div style={{
                position: 'absolute',
                bottom: '24px',
                left: '24px',
                zIndex: 1000,
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(4px)',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '12px 16px',
                color: '#f8fafc',
                fontFamily: 'monospace',
                pointerEvents: 'none',
                minWidth: '250px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)'
            }}>

                {/* Unified Waypoint HUD Component */}
                {hoveredWaypoint && (
                    <div style={{ marginBottom: '8px', borderBottom: '1px solid #475569', paddingBottom: '8px' }}>
                        <strong style={{ color: '#fff', fontSize: '14px' }}>{hoveredWaypoint.name}</strong>
                        <span style={{ marginLeft: '8px', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>{hoveredWaypoint.type}</span>
                    </div>
                )}

                {/* Airway HUD Component */}
                {(selectedAirway || hoveredAirway) && (() => {
                    const activeAwName = selectedAirway || hoveredAirway;
                    const activeAwData = mapCache.airways[activeAwName];

                    if (!activeAwData) return null;

                    const isPinned = selectedAirway === activeAwName;

                    return (
                        <div style={{ marginBottom: '8px', borderBottom: '1px solid #475569', paddingBottom: '8px' }}>
                            <strong style={{ color: isPinned ? '#facc15' : '#38bdf8', fontSize: '14px' }}>
                                Airway {activeAwName}
                            </strong>
                            <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px', whiteSpace: 'normal', maxWidth: '300px' }}>
                                {activeAwData.map(pt => pt.name).join(' ➔ ')}
                            </div>
                        </div>
                    );
                })()}

                {/* Ultra-Fast Mouse Coordinates */}
                <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                    <span>LAT: <span id="mouse-lat">0.0000</span>°</span>
                    <span>LON: <span id="mouse-lng">0.0000</span>°</span>
                </div>
            </div>
        </div>
    );
};

export default FlightMap;