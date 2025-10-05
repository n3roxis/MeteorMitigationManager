import React from 'react';
import { PANEL_BG, CARD_BORDER, METRIC_ACCENTS, SUBPANEL_BG } from './../theme';
import { getMitigationEvents, subscribeMitigation, MitigationEvent } from '../../../solar_system/impact/mitigationHistory';

const ImpactSimulationPanel: React.FC = () => {
	// Mitigation history subscription (newest-first list)
	const [events, setEvents] = React.useState<MitigationEvent[]>(() => getMitigationEvents().slice());
	React.useEffect(() => {
		const unsub = subscribeMitigation(() => {
			setEvents(getMitigationEvents().slice());
		});
		return unsub;
	}, []);
	const renderEvent = (ev: MitigationEvent) => {
		const day = ev.simTimeSec !== undefined ? Math.floor(ev.simTimeSec/86400) : undefined;
		const isResearch = ev.kind==='RESEARCH_COMPLETED' || ev.kind==='RESEARCH_STARTED';
		const isActivation = ev.kind==='IMPACTOR_ACTIVATED' || ev.kind==='LASER_ONLINE' || ev.kind==='TELESCOPE_ONLINE';
		const isLaunch = ev.kind==='LAUNCH' || ev.kind==='DEORBIT';
		const isConstruction = ev.kind==='BUILD_STARTED' || ev.kind==='BUILD_COMPLETED';
		const isLocation = ev.kind==='LOCATION_CHANGE';
		let accent = '#2e6074'; let baseGrad = 'linear-gradient(90deg,#152b36,#1e3e4d)'; let textColorMain = '#d9ecf6'; let textAccent = '#a8c9dc';
		if (isResearch) { accent='#249152'; baseGrad='linear-gradient(90deg,#103724,#155031)'; textColorMain='#e2ffe9'; textAccent='#9ef7bd'; }
		else if (isActivation) { accent='#c33f3f'; baseGrad='linear-gradient(90deg,#3e1515,#5a1d1d)'; textColorMain='#ffe4e4'; textAccent='#ffb0b0'; }
		else if (isLaunch) { accent='#5e2a2a'; baseGrad='none'; textColorMain='#e9b8b8'; textAccent='#ff9c9c'; }
		else if (isConstruction) { accent='#3173b5'; baseGrad='linear-gradient(90deg,#0f2b45,#163f63)'; textColorMain='#e0f2ff'; textAccent='#99d2ff'; }
		// If a construction event is highlighted (tsunami dam) amplify the blue theme
		if (isConstruction && ev.highlight) {
			accent = '#3d9dff';
			baseGrad = 'linear-gradient(90deg,#093250,#0e4974)';
			textColorMain = '#e3f4ff';
			textAccent = '#9fd7ff';
		}
		else if (isLocation) { accent='#c5972f'; baseGrad='linear-gradient(90deg,#2a200e,#463313)'; textColorMain='#ffeebf'; textAccent='#f9c94d'; }
		// If a launch is highlighted (orbital habitat launch), we want the vivid activation red styling instead of subtle launch style
		if (isLaunch && ev.highlight) {
			accent = '#c33f3f';
			baseGrad = 'linear-gradient(90deg,#3e1515,#5a1d1d)';
			textColorMain = '#ffe4e4';
			textAccent = '#ffb0b0';
		}
		const highlighted = !!ev.highlight || isActivation; // activation and explicitly highlighted items
		const wrapperStyle: React.CSSProperties = highlighted ? {
			padding:'5px 6px 6px',
			borderBottom:'1px solid rgba(255,255,255,0.05)',
			background: baseGrad,
			boxShadow:`0 0 0 1px ${accent}66, 0 0 10px -2px ${accent}99`,
			borderLeft:`3px solid ${accent}`,
			display:'flex', flexDirection:'column'
		} : {
			padding:'4px 6px 5px',
			borderBottom:'1px solid #1e2a32',
			display:'flex', flexDirection:'column',
			background: isLaunch ? 'transparent' : undefined,
			borderLeft: `3px solid ${accent}`
		};
		return (
			<div key={ev.id} style={wrapperStyle}>
				<div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:6 }}>
					<span style={{ fontSize:10, fontWeight:600, letterSpacing:0.4, color:textColorMain, paddingRight:6, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flex:1 }}>{ev.label}</span>
					<span style={{ minWidth:48, textAlign:'right', fontSize:9, fontWeight:700, letterSpacing:0.6, color:textAccent }}>{day!==undefined ? `Day ${day}` : ''}</span>
				</div>
			</div>
		);
	};
	return (
		<div style={{ position:'relative', flex:'1 1 0', minWidth:0, display:'flex', flexDirection:'column', overflow:'hidden', margin:'8px', padding:0, boxSizing:'border-box', background:PANEL_BG }}>
			<div style={{ flex:'0 0 auto', padding:'4px 0 2px', position:'relative', margin:0 }}>
				<div style={{ textAlign:'center', fontSize:14, fontWeight:600, letterSpacing:0.5 }}>Impact Simulation</div>
				{/* Metrics row with gap; explicit width calc ensures consistent alignment with Mitigation History column */}
				<div style={{ marginTop:4, display:'flex', width:'100%', gap:8 }}>
					{[
						{ label:'Casualties', value:'—', accent:METRIC_ACCENTS.casualties },
						{ label:'Property Damage', value:'—', accent:METRIC_ACCENTS.property },
						{ label:'Environmental', value:'—', accent:METRIC_ACCENTS.environmental }
					].map((m) => (
						<div key={m.label}
							style={{
								width:'calc((100% - 16px) / 3)', // 2 gaps * 8px
								background:SUBPANEL_BG,
								border:'1px solid '+CARD_BORDER,
								borderRadius:6,
								padding:'6px 8px 7px',
								display:'flex',
								flexDirection:'column',
								alignItems:'center',
								position:'relative',
								boxShadow:'0 0 0 1px #182027 inset'
							}}>
							<div style={{ fontSize:10, fontWeight:600, letterSpacing:0.5, color:'#9fb2c1', textTransform:'uppercase' }}>{m.label}</div>
							<div style={{ marginTop:2, fontSize:18, fontWeight:600, fontFamily:'monospace', color:m.accent, textShadow:'0 0 6px #000' }}>{m.value}</div>
							<div style={{ position:'absolute', top:0, left:0, right:0, height:2, borderTopLeftRadius:6, borderTopRightRadius:6, background:m.accent, opacity:0.5 }} />
						</div>
					))}
				</div>
			</div>
			<div style={{ flex:1, minHeight:0, display:'flex', padding:'6px 0 0', gap:8 }}>
				<div style={{ flex:'0 0 calc((100% - 16px) / 3)', maxWidth:'calc((100% - 16px) / 3)', background:SUBPANEL_BG, border:'1px solid '+CARD_BORDER, borderRadius:6, position:'relative', display:'flex', flexDirection:'column', fontSize:12, color:'#8aa0af', overflow:'hidden' }}>
					<div style={{ padding:'6px 8px 4px', fontSize:11, fontWeight:600, letterSpacing:0.5, color:'#b9cad6', textAlign:'center', borderBottom:'1px solid #1f2b33' }}>Mitigation History</div>
					<div style={{ flex:1, overflowY:'auto', position:'relative' }}>
						{events.length===0 && <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, opacity:0.5 }}>No events yet</div>}
						<div style={{ display:'flex', flexDirection:'column' }}>
							{events.map(renderEvent)}
						</div>
					</div>
				</div>
				<div style={{ flex:1, background:SUBPANEL_BG, border:'1px solid '+CARD_BORDER, borderRadius:6, position:'relative', display:'flex', flexDirection:'column', fontSize:12, color:'#8aa0af' }}>
					<div style={{ padding:'6px 8px 4px', fontSize:11, fontWeight:600, letterSpacing:0.5, color:'#b9cad6', textAlign:'center', borderBottom:'1px solid #1f2b33' }}>Live Information</div>
					<div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', opacity:0.45 }}>Waiting for data</div>
				</div>
			</div>
		</div>
	);
};

export default ImpactSimulationPanel;
