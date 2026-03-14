import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import LocationFinder from './LocationFinder';

// THE FIX 1: Splitting lines that cross the dateline into Multi-Polylines
// This stops the lines from "bouncing" or creating a spiderweb across the whole map!
const processMultiPolyline = (coordsArray) => {
    if (!coordsArray || coordsArray.length === 0) return [];
    const lines = [];
    let currentLine = [[coordsArray[0][0], coordsArray[0][1]]];

    for (let i = 1; i < coordsArray.length; i++) {
        const prevPt = coordsArray[i - 1];
        const currPt = coordsArray[i];
        const diff = currPt[1] - prevPt[1];

        // If distance > 180, it crossed the Pacific dateline
        if (Math.abs(diff) > 180) {
            // Bridge the gap outwardly so the line doesn't have a gap
            let adjustedLon = currPt[1] + (diff < 0 ? 360 : -360);
            currentLine.push([currPt[0], adjustedLon]);
            lines.push(currentLine);

            // Start the new segment coming in from the other side
            let prevAdjustedLon = prevPt[1] + (diff < 0 ? -360 : 360);
            currentLine = [[prevPt[0], prevAdjustedLon], [currPt[0], currPt[1]]];
        } else {
            currentLine.push([currPt[0], currPt[1]]);
        }
    }
    lines.push(currentLine);
    return lines; // Returns an array of line segments
};

// Camera Panning Modules
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

const AirwayPanner = ({ selectedAirway, globalAirways }) => {
    const map = useMap();
    useEffect(() => {
        if (selectedAirway && globalAirways[selectedAirway] && globalAirways[selectedAirway].length > 0) {
            const bounds = globalAirways[selectedAirway].map(pt => pt.coords);
            map.flyToBounds(bounds, { paddingTopLeft: [50, 50], paddingBottomRight: [380, 50], duration: 1.5, maxZoom: 7 });
        }
    }, [selectedAirway, globalAirways, map]);
    return null;
};

// The Culling Engine Bounds Tracker
const BoundsTracker = ({ setRenderBounds }) => {
    const map = useMap();
    const updateBounds = () => {
        const b = map.getBounds().pad(0.5); // 50% invisible buffer
        setRenderBounds({ south: b.getSouth(), north: b.getNorth(), west: b.getWest(), east: b.getEast() });
    };
    useEffect(() => {
        updateBounds();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useMapEvents({ moveend: updateBounds, zoomend: updateBounds });
    return null;
};

// The Chunk Fetching Engine
const ChunkManager = ({ onDataCached, displayOrphans, showAirports, showFixes, showNavaids }) => {
    const loadedChunks = useRef(new Set());
    const map = useMap();

    useEffect(() => {
        loadedChunks.current.clear();
        setTimeout(() => map.fire('moveend'), 50);
    }, [displayOrphans, showAirports, showFixes, showNavaids, map]);

    useMapEvents({
        moveend: (e) => {
            const map = e.target;
            const bounds = map.getBounds().pad(0.5);
            const zoom = map.getZoom();

            if (zoom < 4) return;

            const CHUNK_SIZE = zoom <= 4 ? 60 : zoom <= 6 ? 20 : 10;
            const minLat = Math.max(-90, Math.floor(bounds.getSouth() / CHUNK_SIZE) * CHUNK_SIZE);
            const maxLat = Math.min(90, Math.ceil(bounds.getNorth() / CHUNK_SIZE) * CHUNK_SIZE);
            const rawMinLon = Math.floor(bounds.getWest() / CHUNK_SIZE) * CHUNK_SIZE;
            const rawMaxLon = Math.ceil(bounds.getEast() / CHUNK_SIZE) * CHUNK_SIZE;

            const finalMinLon = rawMinLon;
            const finalMaxLon = Math.min(rawMaxLon, rawMinLon + 360 + CHUNK_SIZE);

            for (let lat = minLat; lat < maxLat; lat += CHUNK_SIZE) {
                for (let lon = finalMinLon; lon < finalMaxLon; lon += CHUNK_SIZE) {
                    let normLon = ((lon % 360) + 360) % 360;
                    if (normLon >= 180) normLon -= 360;

                    const chunkId = `${CHUNK_SIZE}_${lat}_${Math.round(normLon)}`;

                    if (!loadedChunks.current.has(chunkId)) {
                        loadedChunks.current.add(chunkId);

                        fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}/api/map/bounds`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                min_lat: lat, max_lat: lat + CHUNK_SIZE, min_lon: normLon, max_lon: normLon + CHUNK_SIZE,
                                hide_orphans: !displayOrphans, show_airports: showAirports, show_fixes: showFixes, show_navaids: showNavaids, show_airways: false
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

const GlobalMapEvents = ({ setSelectedAirway }) => {
    useMapEvents({
        click: () => setSelectedAirway(null),
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
const FlightMap = ({
                       flightData, globalAirways, selectedAirway, setSelectedAirway,
                       userTimeZone, displayOrphans, hideBackground, showAirports, showFixes, showNavaids, showAirways
                   }) => {
    const defaultCenter = [1.3688, 103.9803];

    const [hoveredAirway, setHoveredAirway] = useState(null);
    const [hoveredWaypoint, setHoveredWaypoint] = useState(null);
    const [mapCache, setMapCache] = useState({ fixes: {}, navaids: {}, airports: {} });
    const [renderBounds, setRenderBounds] = useState(null);

    useEffect(() => {
        setMapCache({ fixes: {}, navaids: {}, airports: {} });
    }, [displayOrphans, showAirports, showFixes, showNavaids]);

    const handleNewChunkData = (newData) => {
        setMapCache(prev => ({
            fixes: { ...prev.fixes, ...newData.fixes },
            navaids: { ...prev.navaids, ...newData.navaids },
            airports: { ...prev.airports, ...newData.airports }
        }));
    };

    // THE FIX 2: Dynamic Offset Generator
    // Instead of hardcoding 3 maps, this tracks your camera and generates phantom maps infinitely in the direction you are scrolling!
    const activeOffsets = useMemo(() => {
        if (!renderBounds) return [-360, 0, 360];
        const startWorld = Math.floor(renderBounds.west / 360);
        const endWorld = Math.floor(renderBounds.east / 360);
        const offsets = [];
        for (let w = startWorld - 1; w <= endWorld + 1; w++) {
            offsets.push(w * 360);
        }
        return offsets;
    }, [renderBounds]);

    const isVisible = (lat, lon) => {
        if (!renderBounds) return true;
        return lat >= renderBounds.south && lat <= renderBounds.north &&
            lon >= renderBounds.west && lon <= renderBounds.east;
    };

    const hasActiveFlight = flightData && flightData.path && flightData.path.length > 0;
    const showBackgroundMode = !(hasActiveFlight && hideBackground);

    // Pre-process active flight path into a Multi-Polyline
    const activeFlightMultiLine = hasActiveFlight ? processMultiPolyline(flightData.path.map(pt => pt.coords)) : [];

    let airwaysToRender = {};
    if (hasActiveFlight && hideBackground) airwaysToRender = { ...flightData.active_airways };
    else if (showAirways) airwaysToRender = { ...globalAirways };

    const renderBackgroundWaypoints = (waypointDict, typeStr, colorHex) => {
        return Object.entries(waypointDict).flatMap(([name, coords]) => {
            const isHovered = hoveredWaypoint?.name === name;
            return activeOffsets.map(offset => {
                const renderLon = coords[1] + offset;
                if (!isVisible(coords[0], renderLon)) return null;

                return (
                    <CircleMarker
                        key={`${typeStr}-${name}-${offset}`} center={[coords[0], renderLon]} radius={isHovered ? 6 : 3}
                        pathOptions={{ color: colorHex, weight: isHovered ? 2 : 1, fillColor: isHovered ? colorHex : "#1e293b", fillOpacity: 1 }} interactive={true}
                        eventHandlers={{ mouseover: (e) => { e.target.bringToFront(); setHoveredWaypoint({ name, type: typeStr, coords }); }, mouseout: () => setHoveredWaypoint(null) }}
                    />
                );
            });
        });
    };

    return (
        <div style={{ position: 'relative', height: '100%', width: '100%' }}>
            <style>{`path.leaflet-interactive:focus { outline: none !important; }`}</style>

            <MapContainer
                center={defaultCenter}
                zoom={6}
                minZoom={3}
                // Allow extreme infinite scrolling on X-axis, strictly block Y-axis scrolling
                maxBounds={[[-90, -10000], [90, 10000]]}
                maxBoundsViscosity={1.0}
                worldCopyJump={false}
                style={{ height: '100%', width: '100%', backgroundColor: '#1e1e1e' }}
            >
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; CartoDB' />
                <LocationFinder userTimeZone={userTimeZone} />
                <BoundsTracker setRenderBounds={setRenderBounds} />
                <MapUpdater flightData={flightData} />
                <AirwayPanner selectedAirway={selectedAirway} globalAirways={globalAirways} />
                <ChunkManager onDataCached={handleNewChunkData} displayOrphans={displayOrphans} showAirports={showAirports} showFixes={showFixes} showNavaids={showNavaids} />
                <GlobalMapEvents setSelectedAirway={setSelectedAirway} />

                {/* --- LAYER 1: BASE AIRWAYS (Lowest) --- */}
                {Object.entries(airwaysToRender).flatMap(([awName, airwaySequence]) => {
                    if (awName === selectedAirway || awName === hoveredAirway) return [];
                    const multiLine = processMultiPolyline(airwaySequence.map(point => point.coords));

                    return activeOffsets.map(offset => {
                        const isOnScreen = multiLine.flat(1).some(pt => isVisible(pt[0], pt[1] + offset));
                        if (!isOnScreen) return null;

                        const offsetMultiLine = multiLine.map(segment => segment.map(pt => [pt[0], pt[1] + offset]));

                        return (
                            <Polyline
                                key={`aw-base-${awName}-${offset}`} positions={offsetMultiLine} pathOptions={{ color: '#334155', weight: 3, opacity: 0.6 }} interactive={true}
                                eventHandlers={{ mouseover: () => setHoveredAirway(awName), mouseout: () => setHoveredAirway(null), click: (e) => { L.DomEvent.stopPropagation(e); setSelectedAirway(awName); } }}
                            />
                        );
                    });
                })}

                {/* --- LAYER 2: HIGHLIGHTED ROUTES (Middle) --- */}
                {hoveredAirway && hoveredAirway !== selectedAirway && airwaysToRender[hoveredAirway] && (() => {
                    const multiLine = processMultiPolyline(airwaysToRender[hoveredAirway].map(point => point.coords));
                    return activeOffsets.map(offset => {
                        if (!multiLine.flat(1).some(pt => isVisible(pt[0], pt[1] + offset))) return null;
                        const offsetMultiLine = multiLine.map(segment => segment.map(pt => [pt[0], pt[1] + offset]));
                        return (
                            <Polyline
                                key={`aw-hover-${hoveredAirway}-${offset}`} positions={offsetMultiLine} pathOptions={{ color: '#38bdf8', weight: 5, opacity: 1 }} interactive={true}
                                eventHandlers={{ mouseout: () => setHoveredAirway(null), click: (e) => { L.DomEvent.stopPropagation(e); setSelectedAirway(hoveredAirway); } }}
                            />
                        );
                    });
                })()}

                {selectedAirway && globalAirways[selectedAirway] && (() => {
                    const multiLine = processMultiPolyline(globalAirways[selectedAirway].map(point => point.coords));
                    return activeOffsets.map(offset => {
                        if (!multiLine.flat(1).some(pt => isVisible(pt[0], pt[1] + offset))) return null;
                        const offsetMultiLine = multiLine.map(segment => segment.map(pt => [pt[0], pt[1] + offset]));
                        return (
                            <Polyline
                                key={`aw-selected-${selectedAirway}-${offset}`} positions={offsetMultiLine} pathOptions={{ color: '#facc15', weight: 6, opacity: 1 }} interactive={true}
                                eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); setSelectedAirway(null); } }}
                            />
                        );
                    });
                })()}

                {/* 2C. The Active Flight Path */}
                {hasActiveFlight && activeOffsets.map(offset => {
                    if (!activeFlightMultiLine.flat(1).some(pt => isVisible(pt[0], pt[1] + offset))) return null;
                    const offsetMultiLine = activeFlightMultiLine.map(segment => segment.map(pt => [pt[0], pt[1] + offset]));

                    return (
                        <div key={`flight-path-group-${offset}`}>
                            <Polyline positions={offsetMultiLine} pathOptions={{ color: "#06b6d4", weight: 3, opacity: 1 }} interactive={false} />
                            {flightData.route_metadata?.alternate_coords && (
                                <Polyline
                                    positions={processMultiPolyline([ flightData.path[flightData.path.length - 1].coords, flightData.route_metadata.alternate_coords ]).map(segment => segment.map(pt => [pt[0], pt[1] + offset]))}
                                    pathOptions={{ color: "#f59e0b", weight: 2, dashArray: "6, 8", opacity: 0.8 }} interactive={false}
                                />
                            )}
                        </div>
                    );
                })}

                {/* --- LAYER 3: BACKGROUND WAYPOINTS (Top 1) --- */}
                {showBackgroundMode && (
                    <>
                        {renderBackgroundWaypoints(mapCache.fixes, "Fix", "#94a3b8")}
                        {renderBackgroundWaypoints(mapCache.navaids, "Navaid", "#60a5fa")}
                        {renderBackgroundWaypoints(mapCache.airports, "Airport", "#34d399")}
                    </>
                )}

                {/* --- LAYER 4: ACTIVE FLIGHT WAYPOINTS (Highest) --- */}
                {hasActiveFlight && activeOffsets.flatMap(offset => {
                    return flightData.path.map((pt, index) => {
                        const renderLon = pt.coords[1] + offset;
                        if (!isVisible(pt.coords[0], renderLon)) return null;

                        const isWPSelected = hoveredWaypoint?.name === pt.name;
                        let markerColor = "#38bdf8";
                        let markerRadius = isWPSelected ? 6 : 4;

                        if (index === 0) { markerColor = "#22c55e"; markerRadius = isWPSelected ? 9 : 7; }
                        else if (index === flightData.path.length - 1) { markerColor = "#ef4444"; markerRadius = isWPSelected ? 9 : 7; }

                        return (
                            <CircleMarker
                                key={`flight-wp-${index}-${offset}`} center={[pt.coords[0], renderLon]} radius={markerRadius} pathOptions={{ color: markerColor, weight: 2, fillColor: isWPSelected ? markerColor : "#ffffff", fillOpacity: 1 }} interactive={true}
                                eventHandlers={{ mouseover: (e) => { e.target.bringToFront(); setHoveredWaypoint({ name: pt.name, type: pt.type, coords: pt.coords }); }, mouseout: () => setHoveredWaypoint(null) }}
                            />
                        );
                    }).concat(
                        flightData.route_metadata?.alternate_coords ? [
                            (() => {
                                const renderAltLon = flightData.route_metadata.alternate_coords[1] + offset;
                                if (!isVisible(flightData.route_metadata.alternate_coords[0], renderAltLon)) return null;
                                return (
                                    <CircleMarker
                                        key={`flight-alt-${offset}`} center={[flightData.route_metadata.alternate_coords[0], renderAltLon]} radius={hoveredWaypoint?.type === "Alternate" ? 7 : 5} pathOptions={{ color: "#f59e0b", weight: 2, fillColor: "#000", fillOpacity: 1 }} interactive={true}
                                        eventHandlers={{ mouseover: (e) => { e.target.bringToFront(); setHoveredWaypoint({ name: flightData.route_metadata.alternate, type: "Alternate", coords: flightData.route_metadata.alternate_coords }); }, mouseout: () => setHoveredWaypoint(null) }}
                                    />
                                );
                            })()
                        ] : []
                    );
                })}
            </MapContainer>

            {/* --- BOTTOM LEFT HUD --- */}
            <div style={{ position: 'absolute', bottom: '24px', left: '24px', zIndex: 1000, backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)', border: '1px solid #334155', borderRadius: '8px', padding: '12px 16px', color: '#f8fafc', fontFamily: 'monospace', pointerEvents: 'none', minWidth: '250px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)' }}>
                {hoveredWaypoint && (
                    <div style={{ marginBottom: '8px', borderBottom: '1px solid #475569', paddingBottom: '8px' }}>
                        <strong style={{ color: '#fff', fontSize: '14px' }}>{hoveredWaypoint.name}</strong>
                        <span style={{ marginLeft: '8px', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>{hoveredWaypoint.type}</span>
                        <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
                            {hoveredWaypoint.coords[0].toFixed(4)}°, {hoveredWaypoint.coords[1].toFixed(4)}°
                        </div>
                    </div>
                )}
                {(selectedAirway || hoveredAirway) && (() => {
                    const activeAwName = selectedAirway || hoveredAirway;
                    const activeAwData = globalAirways[activeAwName];
                    if (!activeAwData) return null;
                    const isPinned = selectedAirway === activeAwName;

                    return (
                        <div style={{ marginBottom: '8px', borderBottom: '1px solid #475569', paddingBottom: '8px' }}>
                            <strong style={{ color: isPinned ? '#facc15' : '#38bdf8', fontSize: '14px' }}>Airway {activeAwName}</strong>
                            <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px', whiteSpace: 'normal', maxWidth: '300px' }}>
                                {activeAwData.map(pt => pt.name).join(' ➔ ')}
                            </div>
                        </div>
                    );
                })()}
                <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                    <span>LAT: <span id="mouse-lat">0.0000</span>°</span>
                    <span>LON: <span id="mouse-lng">0.0000</span>°</span>
                </div>
            </div>
        </div>
    );
};

export default FlightMap;