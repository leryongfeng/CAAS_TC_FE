import { useState, useEffect, useMemo } from 'react';
import Select from 'react-select';
import FlightMap from './FlightMap.jsx';

const formatTime = (utcString, targetTimeZone) => {
    if (!utcString) return '--:--';
    try {
        const isoString = utcString.replace(' UTC', ':00Z').replace(' ', 'T');
        const date = new Date(isoString);
        return new Intl.DateTimeFormat('en-US', { timeZone: targetTimeZone, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short' }).format(date);
    } catch (e) { return utcString; }
};

const defaultTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

const initialSettings = {
    userTimezone: defaultTZ,
    displayOrphans: false,
    hideBackground: false,
    showAirports: true,
    showFixes: false,
    showNavaids: false,
    showAirways: false // Controls global visibility, but not retrieval anymore!
};

const selectStyles = {
    control: (base, state) => ({ ...base, padding: '4px', borderRadius: '8px', backgroundColor: 'transparent', borderColor: state.isFocused ? '#38bdf8' : '#334155', boxShadow: state.isFocused ? '0 0 0 1px #38bdf8' : 'none', '&:hover': { borderColor: '#475569' }, fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px' }),
    menu: (base) => ({ ...base, backgroundColor: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(8px)', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', zIndex: 9999 }),
    option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#1e293b' : 'transparent', color: state.isFocused ? '#f8fafc' : '#cbd5e1', cursor: 'pointer', '&:active': { backgroundColor: '#334155' } }),
    singleValue: (base) => ({ ...base, color: '#f8fafc' }), input: (base) => ({ ...base, color: '#f8fafc' }), placeholder: (base) => ({ ...base, color: '#94a3b8' })
};

function App() {
    const [callsigns, setCallsigns] = useState([]);
    const [selectedCallsign, setSelectedCallsign] = useState('');
    const [flightData, setFlightData] = useState(null);
    const [loading, setLoading] = useState(false);

    // NEW: Stores the entire airway geometry dictionary on mount
    const [globalAirways, setGlobalAirways] = useState({});
    const [selectedAirway, setSelectedAirway] = useState(null);

    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState(initialSettings);
    const [draftSettings, setDraftSettings] = useState(initialSettings);

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
                return { value: tz, label: `(${offsetStr}) ${tz.replace(/_/g, ' ')}`, sortWeight };
            } catch (e) { return { value: tz, label: tz, sortWeight: 0 }; }
        }).sort((a, b) => a.sortWeight - b.sortWeight);
    }, []);

    useEffect(() => {
        fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}/api/flights/callsigns`)
            .then(res => res.json())
            .then(data => { if (data.callsigns) setCallsigns(data.callsigns); })
            .catch(err => console.error(err));

        // THE FIX: Fetching the entire geometry payload at startup
        fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}/api/airways/all`)
            .then(res => res.json())
            .then(data => setGlobalAirways(data))
            .catch(err => console.error(err));
    }, []);

    useEffect(() => {
        if (!selectedCallsign) { setFlightData(null); return; }
        setLoading(true);
        fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}/api/flights/${selectedCallsign}/route`)
            .then(res => { if (!res.ok) throw new Error('Flight not found'); return res.json(); })
            .then(data => { setFlightData(data); setLoading(false); })
            .catch(err => { console.error(err); setFlightData(null); setLoading(false); });
    }, [selectedCallsign]);

    const searchOptions = callsigns.map(cs => ({ value: cs, label: cs }));

    // Automatically populates the dropdown using the keys of the global geometry dictionary
    const airwaySearchOptions = Object.keys(globalAirways).map(aw => ({ value: aw, label: aw }));

    const openSettings = () => { setDraftSettings(settings); setShowSettings(true); };
    const handleConfirmSettings = () => { setSettings(draftSettings); setShowSettings(false); };
    const updateDraft = (key, value) => { setDraftSettings(prev => ({ ...prev, [key]: value })); };

    const CheckboxLabel = ({ label, checked, onChange }) => (
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', color: '#cbd5e1', cursor: 'pointer', marginBottom: '8px' }}>
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#38bdf8' }} />
            {label}
        </label>
    );

    const closeButtonStyle = { background: '#1e293b', border: '1px solid #334155', cursor: 'pointer', fontSize: '12px', color: '#94a3b8', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' };

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', fontFamily: 'monospace' }}>

            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
                <FlightMap
                    flightData={flightData}
                    globalAirways={globalAirways}            // Passed down
                    selectedAirway={selectedAirway}          // Passed down
                    setSelectedAirway={setSelectedAirway}    // Passed down
                    userTimeZone={settings.userTimezone}
                    displayOrphans={settings.displayOrphans}
                    hideBackground={settings.hideBackground}
                    showAirports={settings.showAirports}
                    showFixes={settings.showFixes}
                    showNavaids={settings.showNavaids}
                    showAirways={settings.showAirways}
                />
            </div>

            <div style={{ position: 'absolute', top: '20px', right: '20px', bottom: '20px', width: '380px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '16px', pointerEvents: 'none' }}>

                <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)', borderRadius: '12px', border: '1px solid #334155', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', padding: '20px', pointerEvents: 'auto', flexShrink: 0, zIndex: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h1 style={{ margin: 0, fontSize: '16px', color: '#f8fafc', fontWeight: '600', letterSpacing: '1px' }}>CAAS TRACKER</h1>
                        <button onClick={openSettings} style={{ background: showSettings ? '#1e293b' : 'transparent', border: '1px solid transparent', cursor: 'pointer', fontSize: '12px', padding: '6px 12px', borderRadius: '4px', transition: 'background 0.2s, border 0.2s', borderColor: showSettings ? '#334155' : '#334155', color: '#94a3b8' }} title="Settings">SETTINGS</button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', display: 'block', letterSpacing: '0.5px' }}>Search Flight</label>
                            <Select
                                options={searchOptions} placeholder="Callsign (e.g., SIA531)..." isClearable={true} isSearchable={true}
                                value={searchOptions.find(opt => opt.value === selectedCallsign) || null}
                                onChange={(option) => { setSelectedCallsign(option ? option.value : ''); setSelectedAirway(null); }}
                                styles={selectStyles}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', display: 'block', letterSpacing: '0.5px' }}>Search Airway</label>
                            <Select
                                options={airwaySearchOptions} placeholder="Airway Route (e.g., L642)..." isClearable={true} isSearchable={true}
                                value={airwaySearchOptions.find(opt => opt.value === selectedAirway) || null}
                                onChange={(option) => { setSelectedAirway(option ? option.value : null); setSelectedCallsign(''); }}
                                styles={selectStyles}
                            />
                        </div>
                    </div>
                </div>

                {/* --- SETTINGS MODAL --- */}
                {showSettings && (
                    <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', padding: '20px', border: '1px solid #334155', pointerEvents: 'auto', flexShrink: 0, overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <div>
                                <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '1px' }}>Settings</h3>
                                <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', letterSpacing: '0.5px' }}>Configure display & data retrieval</p>
                            </div>
                            <button onClick={() => setShowSettings(false)} style={closeButtonStyle} title="Cancel">✕</button>
                        </div>

                        <Select options={tzOptions} value={tzOptions.find(opt => opt.value === draftSettings.userTimezone)} onChange={(option) => updateDraft('userTimezone', option.value)} styles={selectStyles} />

                        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #334155' }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Data Fidelity</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                                <CheckboxLabel label="Airports" checked={draftSettings.showAirports} onChange={(v) => updateDraft('showAirports', v)} />
                                <CheckboxLabel label="Airways" checked={draftSettings.showAirways} onChange={(v) => updateDraft('showAirways', v)} />
                                <CheckboxLabel label="Fixes" checked={draftSettings.showFixes} onChange={(v) => updateDraft('showFixes', v)} />
                                <CheckboxLabel label="Navaids" checked={draftSettings.showNavaids} onChange={(v) => updateDraft('showNavaids', v)} />
                            </div>
                        </div>

                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #334155' }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Display Modes</h4>
                            <CheckboxLabel label="Show Orphaned Waypoints" checked={draftSettings.displayOrphans} onChange={(v) => updateDraft('displayOrphans', v)} />
                            <CheckboxLabel label="Focus Mode (Active Flight)" checked={draftSettings.hideBackground} onChange={(v) => updateDraft('hideBackground', v)} />
                        </div>

                        <button
                            onClick={handleConfirmSettings}
                            style={{ width: '100%', padding: '12px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginTop: '16px', transition: 'background-color 0.2s' }}
                            onMouseOver={(e) => e.target.style.backgroundColor = '#7dd3fc'}
                            onMouseOut={(e) => e.target.style.backgroundColor = '#38bdf8'}
                        >
                            Confirm & Reload Map
                        </button>
                    </div>
                )}

                {/* --- FLIGHT DETAILS DRAWER --- */}
                <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)', border: '1px solid #334155', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', transform: (flightData || loading) ? 'translateX(0)' : 'translateX(120%)', opacity: (flightData || loading) ? 1 : 0, pointerEvents: (flightData || loading) ? 'auto' : 'none', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', zIndex: 0 }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}><p style={{ color: '#94a3b8', fontWeight: '500' }}>Acquiring telemetry...</p></div>
                    ) : flightData && flightData.summary ? (
                        <>
                            <div style={{ padding: '24px', borderBottom: '1px solid #334155' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                    <h2 style={{ margin: 0, color: '#38bdf8', fontSize: '28px', fontWeight: '700', lineHeight: 1 }}>{flightData.summary.callsign}</h2>
                                    <button onClick={() => setSelectedCallsign('')} style={closeButtonStyle}>✕</button>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ backgroundColor: '#1e3a8a', color: '#bfdbfe', padding: '4px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: '600' }}>{flightData.summary.aircraft || 'Unknown'}</span>
                                    <span style={{ backgroundColor: '#1e293b', color: '#cbd5e1', padding: '4px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: '600' }}>Reg: {flightData.summary.registration || 'N/A'}</span>
                                </div>
                            </div>
                            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                                <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '16px', marginBottom: '24px', border: '1px solid #334155' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Origin</p>
                                            <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#f8fafc' }}>{flightData.route_metadata.origin}</p>
                                        </div>
                                        <div style={{ flex: 1, padding: '0 16px', display: 'flex', alignItems: 'center' }}>
                                            <div style={{ height: '1px', backgroundColor: '#475569', width: '100%' }}></div><span style={{ fontSize: '10px', paddingLeft: '8px', color: '#475569' }}>TO</span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Destination</p>
                                            <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#f8fafc' }}>{flightData.route_metadata.destination}</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>DEPARTURE</p>
                                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#cbd5e1' }}>{formatTime(flightData.times.estimated_departure, settings.userTimezone)}</p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>ARRIVAL</p>
                                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#cbd5e1' }}>{formatTime(flightData.times.estimated_arrival, settings.userTimezone)}</p>
                                        </div>
                                    </div>
                                </div>

                                {flightData.route_metadata.alternate && (
                                    <div style={{ padding: '16px', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Alternate Airport</p>
                                            <p style={{ margin: 0, fontSize: '22px', color: '#f8fafc', fontWeight: '700' }}>{flightData.route_metadata.alternate}</p>
                                        </div>
                                    </div>
                                )}

                                <div style={{ marginBottom: '32px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: '600' }}>Flight Progress</span>
                                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#38bdf8' }}>{flightData.times.percent_complete}%</span>
                                    </div>
                                    <div style={{ width: '100%', backgroundColor: '#1e293b', borderRadius: '999px', height: '10px', overflow: 'hidden', border: '1px solid #334155' }}>
                                        <div style={{ width: `${flightData.times.percent_complete}%`, backgroundColor: flightData.times.percent_complete >= 100 ? '#22c55e' : '#38bdf8', height: '100%', transition: 'width 1s ease-in-out' }}></div>
                                    </div>
                                </div>

                                <h3 style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>Operational Data</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div style={{ backgroundColor: '#1e293b', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>CRUISING LEVEL</p>
                                        <p style={{ margin: '4px 0 0 0', fontWeight: '600', color: '#f8fafc', fontSize: '15px' }}>{flightData.route_metadata.cruising_level || 'N/A'}</p>
                                    </div>
                                    <div style={{ backgroundColor: '#1e293b', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>CRUISING SPEED</p>
                                        <p style={{ margin: '4px 0 0 0', fontWeight: '600', color: '#f8fafc', fontSize: '15px' }}>{flightData.route_metadata.cruising_speed || 'N/A'}</p>
                                    </div>
                                    <div style={{ backgroundColor: '#1e293b', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>NAVIGATION CAP.</p>
                                        <p style={{ margin: '4px 0 0 0', fontWeight: '600', color: '#f8fafc', fontSize: '15px' }}>{flightData.capabilities.nav || 'N/A'}</p>
                                    </div>
                                    <div style={{ backgroundColor: '#1e293b', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>SURVEILLANCE</p>
                                        <p style={{ margin: '4px 0 0 0', fontWeight: '600', color: '#f8fafc', fontSize: '15px' }}>{flightData.capabilities.surv || 'N/A'}</p>
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