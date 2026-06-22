// Metro map drawn as an SVG from the network data.
// Each station has a fixed position in the COORDS table below.
// showLines = true shows the colored lines (Setup); false hides them (Planning).

const COORDS = {
  'Keruen':          { x: 130, y: 150, lx: 0,   ly: -22, anchor: 'middle' },
  'Talan Towers':    { x: 270, y: 150, lx: 0,   ly: -22, anchor: 'middle' },
  'Altyn Dala':      { x: 460, y: 220, lx: 0,   ly: -24, anchor: 'middle' },
  'Zhetysu':         { x: 670, y: 240, lx: 0,   ly: -22, anchor: 'middle' },
  'Dauir':           { x: 840, y: 340, lx: 26,  ly: 6,   anchor: 'start' },
  'Ortalyk':         { x: 720, y: 110, lx: 26,  ly: 6,   anchor: 'start' },
  'Jana Kala':       { x: 620, y: 180, lx: 26,  ly: 6,   anchor: 'start' },
  'Syganak':         { x: 330, y: 370, lx: -21,   ly: -20, anchor: 'middle' },
  'Zhibek Zholy':    { x: 210, y: 510, lx: 0,   ly: 34,  anchor: 'middle' },
  'Alpamys':         { x: 660, y: 610, lx: 0,   ly: 34,  anchor: 'middle' },
  'Mangilik Yel':    { x: 830, y: 490, lx: 26,  ly: 6,   anchor: 'start' },
  'Barys Arena':     { x: 910, y: 230, lx: 26,  ly: 6,   anchor: 'start' },
  'Nurly Olke':      { x: 970, y: 140, lx: 26,  ly: 6,   anchor: 'start' },
  'Turan':           { x: 120, y: 470, lx: 0,   ly: -22, anchor: 'middle' },
  'Esil Plaza':      { x: 220, y: 400, lx: -22, ly: 6,   anchor: 'end' },
  'Galamat Sayabak': { x: 570, y: 390, lx: 0,   ly: 32, anchor: 'middle' },
};

export default function MetroMap({ network, showLines = true, highlightStart = null, highlightEnd = null, compact = false }) {
  if (!network) return null;
  // set of interchange station ids (stations on more than one line)
  const interchange = new Set(network.interchanges || []);

  // find a station's name by its id
  function nameById(id) {
    const s = network.stations.find(st => st.id === id);
    return s ? s.name : '';
  }

  return (
    <div className="metro-wrap">
      <svg className={`metro-svg ${compact ? 'compact' : ''}`} viewBox="60 60 1035 610" role="img" aria-label="metro map">

        {/* draw the lines (only in Setup) */}
        {showLines && network.lines && network.lines.map(line => {
          // turn the line's stops into points, then into an SVG path
          const pts = line.stops.map(sid => COORDS[nameById(sid)]).filter(Boolean);
          if (pts.length < 2) return null;
          let d = '';
          for (let i = 0; i < pts.length; i++) {
            d += (i === 0 ? 'M' : 'L') + pts[i].x + ',' + pts[i].y + ' ';
          }
          return (
            <path key={line.id} d={d} fill="none" stroke={line.color}
              strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          );
        })}

        {/* draw the stations */}
        {network.stations.map(s => {
          const c = COORDS[s.name];
          if (!c) return null;

          const isInter = interchange.has(s.id);
          const isStart = highlightStart === s.id;
          const isEnd = highlightEnd === s.id;

          // pick the circle color: green for start, red for end, otherwise dark
          let ring = '#444444';
          if (isStart) ring = '#1f8a4c';
          else if (isEnd) ring = '#b3261e';

          const radius = (isStart || isEnd) ? 11 : (isInter ? 9 : 7);
          const labelX = c.x + c.lx;
          const labelY = c.y + c.ly;

          return (
            <g key={s.id}>
              {/* interchange stations are filled, normal stations are hollow (white inside) */}
              <circle cx={c.x} cy={c.y} r={radius}
                fill={isInter ? '#333333' : '#ffffff'}
                stroke={ring} strokeWidth="2.5" />
              {/* station name */}
              <text x={labelX} y={labelY} textAnchor={c.anchor}
                fontSize="15" fontWeight={isInter ? 700 : 500} fill="#1f2421">
                {s.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
