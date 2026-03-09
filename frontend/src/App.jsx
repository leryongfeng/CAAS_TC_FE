import { useState, useEffect, useMemo } from 'react';
import Select from 'react-select';
import FlightMap from './FlightMap';

const formatTime = (utcString, targetTimeZone) => {
    if (!utcString) return '--:--';
    try {
        const isoString = utcString.replace(' UTC', ':00Z').replace(' ', 'T');
        const date = new Date(isoString);

        return new Intl.DateTimeFormat('en-US', {
            timeZone: targetTimeZone,
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZoneName: 'short'
        }).format(date);
    } catch (e) {
        return utcString;
    }
};

function App() {
    const [callsigns, setCallsigns] = useState([]);
    const [selectedCallsign, setSelectedCallsign] = useState('');
    const [flightData, setFlightData] = useState(null);
    const [loading, setLoading] = useState(false);

    const defaultTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const [userTimezone, setUserTimezone] = useState(defaultTZ);
    const [showSettings, setShowSettings] = useState(false);

    const tzOptions = useMemo(() => {
        const timeZones = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : [defaultTZ, 'UTC'];
        const now = new Date();

        return timeZones.map(tz => {
            try {
                const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(now);
                const tzPart = parts.find(p => p.type === 'timeZoneName');
                let offsetStr = tzPart ? tzPart.value : 'GMT';

                if (offsetStr === 'GMT') offsetStr = 'GMT+0';

                const match = offsetStr.match(/GMT([+-])(\d+)(?::(\d+))?/);
                let sortWeight = 0;
                if (match) {
                    const sign = match[1] === '+' ? 1 : -1;
                    const hours = parseInt(match[2], 10);
                    const mins = match[3] ? parseInt(match[3], 10) : 0;
                    sortWeight = sign * (hours * 60 + mins);
                }

                return {
                    value: tz,
                    label: `(${offsetStr}) ${tz.replace(/_/g, ' ')}`,
                    sortWeight
                };
            } catch (e) {
                return { value: tz, label: tz, sortWeight: 0 };
            }
        }).sort((a, b) => a.sortWeight - b.sortWeight);
    }, [defaultTZ]);

    useEffect(() => {
        fetch('http://127.0.0.1:8000/api/flights/callsigns')
            .then(res => res.json())
            .then(data => {
                if (data.callsigns) setCallsigns(data.callsigns);
            })
            .catch(err => console.error("Error fetching callsigns:", err));
    }, []);

    useEffect(() => {
        if (!selectedCallsign) {
            setFlightData(null);
            return;
        }

        setLoading(true);
        fetch(`http://127.0.0.1:8000/api/flights/${selectedCallsign}/route`)
            .then(res => {
                if (!res.ok) throw new Error('Flight not found');
                return res.json();
            })
            .then(data => {
                setFlightData(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setFlightData(null);
                setLoading(false);
            });
    }, [selectedCallsign]);

    const searchOptions = callsigns.map(cs => ({ value: cs, label: cs }));

    // Shared style for our perfectly centered close buttons!
    const closeButtonStyle = {
        background: '#f1f5f9',
        border: 'none',
        cursor: 'pointer',
        fontSize: '12px',
        color: '#64748b',
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        display: 'flex',        // <-- This flex container
        alignItems: 'center',   // <-- Vertically centers the X
        justifyContent: 'center'// <-- Horizontally centers the X
    };

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
                <FlightMap flightData={flightData} />
            </div>

            <div style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                bottom: '20px',
                width: '380px',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                pointerEvents: 'none'
            }}>

                {/* 1. Control Card */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    padding: '20px',
                    pointerEvents: 'auto',
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h1 style={{ margin: 0, fontSize: '20px', color: '#0f172a', fontWeight: '600' }}>
                            ✈️ CAAS Tracker
                        </h1>
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            style={{ background: showSettings ? '#f1f5f9' : 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '6px', borderRadius: '50%', transition: 'background 0.2s' }}
                            title="Settings"
                        >
                            ⚙️
                        </button>
                    </div>

                    <Select
                        options={searchOptions}
                        placeholder="Search callsign (e.g., SIA531)..."
                        isClearable={true}
                        isSearchable={true}
                        value={searchOptions.find(opt => opt.value === selectedCallsign) || null}
                        onChange={(option) => setSelectedCallsign(option ? option.value : '')}
                        styles={{
                            control: (baseStyles, state) => ({
                                ...baseStyles,
                                padding: '4px',
                                borderRadius: '8px',
                                borderColor: state.isFocused ? '#3b82f6' : '#cbd5e1',
                                boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
                                '&:hover': { borderColor: '#94a3b8' }
                            }),
                            option: (baseStyles, state) => ({
                                ...baseStyles,
                                backgroundColor: state.isFocused ? '#f1f5f9' : 'white',
                                color: '#0f172a',
                                cursor: 'pointer'
                            })
                        }}
                    />
                </div>

                {/* 2. Settings Modal */}
                {showSettings && (
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                        padding: '20px',
                        border: '1px solid #e2e8f0',
                        pointerEvents: 'auto',
                        flexShrink: 0
                    }}>
                        {/* Added Flex Header with perfectly centered close button */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <div>
                                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#0f172a' }}>Display Settings</h3>
                                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Select Timezone</p>
                            </div>
                            <button
                                onClick={() => setShowSettings(false)}
                                style={closeButtonStyle}
                                title="Close Settings"
                            >
                                ✕
                            </button>
                        </div>

                        <Select
                            options={tzOptions}
                            value={tzOptions.find(opt => opt.value === userTimezone)}
                            onChange={(option) => setUserTimezone(option.value)}
                            styles={{
                                control: (baseStyles, state) => ({
                                    ...baseStyles,
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    borderColor: state.isFocused ? '#3b82f6' : '#cbd5e1',
                                    boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
                                    '&:hover': { borderColor: '#94a3b8' }
                                }),
                                option: (baseStyles, state) => ({
                                    ...baseStyles,
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    backgroundColor: state.isFocused ? '#f1f5f9' : 'white',
                                    color: '#0f172a'
                                }),
                                singleValue: (baseStyles) => ({
                                    ...baseStyles,
                                    color: '#0f172a'
                                })
                            }}
                        />
                    </div>
                )}

                {/* 3. Details Drawer */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                    transform: (flightData || loading) ? 'translateX(0)' : 'translateX(120%)',
                    opacity: (flightData || loading) ? 1 : 0,
                    pointerEvents: (flightData || loading) ? 'auto' : 'none',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    overflow: 'hidden'
                }}>

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                            <p style={{ color: '#64748b', fontWeight: '500' }}>Acquiring telemetry...</p>
                        </div>
                    ) : flightData && flightData.summary ? (
                        <>
                            <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                    <h2 style={{ margin: 0, color: '#1e40af', fontSize: '28px', fontWeight: '700', lineHeight: 1 }}>
                                        {flightData.summary.callsign}
                                    </h2>
                                    {/* Applied the perfectly centered button style here too */}
                                    <button
                                        onClick={() => setSelectedCallsign('')}
                                        style={closeButtonStyle}
                                        title="Close Details"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ backgroundColor: '#e0e7ff', color: '#3730a3', padding: '4px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: '600' }}>
                    {flightData.summary.aircraft || 'Unknown Aircraft'}
                  </span>
                                    <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: '600' }}>
                    Reg: {flightData.summary.registration || 'N/A'}
                  </span>
                                </div>
                            </div>

                            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>

                                <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '16px', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>Origin</p>
                                            <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#0f172a' }}>{flightData.route_metadata.origin}</p>
                                        </div>
                                        <div style={{ flex: 1, padding: '0 16px', display: 'flex', alignItems: 'center' }}>
                                            <div style={{ height: '2px', backgroundColor: '#cbd5e1', width: '100%' }}></div>
                                            <span style={{ fontSize: '16px', paddingLeft: '8px' }}>✈️</span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ margin: 0, fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>Destination</p>
                                            <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#0f172a' }}>{flightData.route_metadata.destination}</p>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>DEPARTURE</p>
                                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                                                {formatTime(flightData.times.estimated_departure, userTimezone)}
                                            </p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>ARRIVAL</p>
                                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                                                {formatTime(flightData.times.estimated_arrival, userTimezone)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {flightData.route_metadata.alternate && (
                                    <div style={{ padding: '12px 16px', backgroundColor: '#fff7ed', borderRadius: '8px', border: '1px solid #fdba74', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontSize: '18px' }}>⚠️</span>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '11px', color: '#c2410c', textTransform: 'uppercase', fontWeight: '600' }}>Alternate Aerodrome</p>
                                            <p style={{ margin: 0, fontSize: '14px', color: '#9a3412', fontWeight: '700' }}>{flightData.route_metadata.alternate}</p>
                                        </div>
                                    </div>
                                )}

                                <div style={{ marginBottom: '32px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '13px', color: '#475569', fontWeight: '600' }}>Flight Progress</span>
                                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#2563eb' }}>{flightData.times.percent_complete}%</span>
                                    </div>
                                    <div style={{ width: '100%', backgroundColor: '#e2e8f0', borderRadius: '999px', height: '10px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${flightData.times.percent_complete}%`,
                                            backgroundColor: flightData.times.percent_complete >= 100 ? '#16a34a' : '#2563eb',
                                            height: '100%',
                                            transition: 'width 1s ease-in-out'
                                        }}></div>
                                    </div>
                                </div>

                                <h3 style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>Operational Data</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>CRUISING LEVEL</p>
                                        <p style={{ margin: '4px 0 0 0', fontWeight: '600', color: '#0f172a', fontSize: '15px' }}>{flightData.route_metadata.cruising_level || 'N/A'}</p>
                                    </div>
                                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>CRUISING SPEED</p>
                                        <p style={{ margin: '4px 0 0 0', fontWeight: '600', color: '#0f172a', fontSize: '15px' }}>{flightData.route_metadata.cruising_speed || 'N/A'}</p>
                                    </div>
                                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>NAVIGATION CAP.</p>
                                        <p style={{ margin: '4px 0 0 0', fontWeight: '600', color: '#0f172a', fontSize: '15px' }}>{flightData.capabilities.nav || 'N/A'}</p>
                                    </div>
                                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>SURVEILLANCE</p>
                                        <p style={{ margin: '4px 0 0 0', fontWeight: '600', color: '#0f172a', fontSize: '15px' }}>{flightData.capabilities.surv || 'N/A'}</p>
                                    </div>
                                </div>

                            </div>
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export default App;