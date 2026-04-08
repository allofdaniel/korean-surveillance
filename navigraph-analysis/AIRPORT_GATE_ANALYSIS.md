# Airport/Gate Rendering Analysis - Navigraph Charts Viewer

## Executive Summary

This document analyzes the airport layout rendering system in the Navigraph Charts Viewer application. The application uses **Mapbox GL JS** as the rendering engine with **vector tiles (PBF format)** for airport mapping data retrieved from the **Navigraph AMDB (Aerodrome Mapping Database) API**.

---

## 1. Architecture Overview

### 1.1 Core Technologies
- **Map Engine**: Mapbox GL JS
- **Data Format**: Vector Tiles (PBF/MVT - Mapbox Vector Tiles)
- **Data Source**: Navigraph AMDB API (`https://amdb.api.navigraph.com`)
- **Vector Tile Parser**: `@mapbox/vector-tile` library (wrapped as `VectorTileFeature`, `VectorTileLayer`)

### 1.2 Data Flow
```
AMDB API Request → GeoJSON Features → Mapbox Layer Rendering → Screen Display
```

---

## 2. AMDB (Aerodrome Mapping Database) Integration

### 2.1 API Configuration
**File Location**: Line ~194515

```javascript
const Ww = {
  amdbAPIUrl: 'https://amdb.api.navigraph.com',
  enrouteChartsAPIUrl: 'https://enroute.charts.api-v2.navigraph.com',
  chartsAPIUrl: 'https://charts.api-v2.navigraph.com',
  // ... other API URLs
}
```

### 2.2 AMDB Data Request Pattern
**File Location**: Line ~269477-269502

```javascript
['amdb-layers', t, ...Object.values(n)],
() => t ? (async function ({
    icao: e,
    include: t,
    exclude: n,
    projection: r,
    precision: i,
  }) {
    return (
      await YB.get(`${Ww.amdbAPIUrl}/v1/${e}`, {
        params: {
          include: t?.join(','),
          exclude: n?.join(','),
          projection: r,
          precision: i,
        },
      })
    ).data || null;
  })(Object.assign({ icao: t }, n))
: null,
```

**Example Request**:
```
GET https://amdb.api.navigraph.com/v1/{ICAO}?include=asrnnode,parkingstandarea,verticalpolygonalstructure
```

**Requested Features**:
- `asrnnode` - Airport Surface Routing Network Nodes
- `parkingstandarea` - Gate/Stand areas
- `verticalpolygonalstructure` - Terminal buildings

---

## 3. Airport Feature Types (Geometry Types)

### 3.1 Complete Feature Enumeration
**File Location**: Line 269365-269403

```javascript
var dhe = ((e) => (
  (e[(e.RunwayElement = 0)] = 'RunwayElement'),
  (e[(e.RunwayIntersection = 1)] = 'RunwayIntersection'),
  (e[(e.RunwayThreshold = 2)] = 'RunwayThreshold'),
  (e[(e.RunwayMarking = 3)] = 'RunwayMarking'),
  (e[(e.PaintedCenterline = 4)] = 'PaintedCenterline'),
  (e[(e.LandAndHoldShortOperationLocation = 5)] = 'LandAndHoldShortOperationLocation'),
  (e[(e.ArrestingGearLocation = 6)] = 'ArrestingGearLocation'),
  (e[(e.RunwayShoulder = 7)] = 'RunwayShoulder'),
  (e[(e.Stopway = 8)] = 'Stopway'),
  (e[(e.RunwayDisplacedArea = 9)] = 'RunwayDisplacedArea'),
  (e[(e.FinalApproachAndTakeoffArea = 11)] = 'FinalApproachAndTakeoffArea'),
  (e[(e.TouchDownLiftOffArea = 12)] = 'TouchDownLiftOffArea'),
  (e[(e.HelipadThreshold = 13)] = 'HelipadThreshold'),
  (e[(e.TaxiwayElement = 14)] = 'TaxiwayElement'),
  (e[(e.TaxiwayShoulder = 15)] = 'TaxiwayShoulder'),
  (e[(e.TaxiwayGuidanceLine = 16)] = 'TaxiwayGuidanceLine'),
  (e[(e.TaxiwayIntersectionMarking = 17)] = 'TaxiwayIntersectionMarking'),
  (e[(e.TaxiwayHoldingPosition = 18)] = 'TaxiwayHoldingPosition'),
  (e[(e.RunwayExitLine = 19)] = 'RunwayExitLine'),
  (e[(e.FrequencyArea = 20)] = 'FrequencyArea'),
  (e[(e.ApronElement = 21)] = 'ApronElement'),
  (e[(e.StandGuidanceLine = 22)] = 'StandGuidanceLine'),
  (e[(e.ParkingStandLocation = 23)] = 'ParkingStandLocation'),
  (e[(e.ParkingStandArea = 24)] = 'ParkingStandArea'),
  (e[(e.DeicingArea = 25)] = 'DeicingArea'),
  (e[(e.AerodromeReferencePoint = 26)] = 'AerodromeReferencePoint'),
  (e[(e.VerticalPolygonalStructure = 27)] = 'VerticalPolygonalStructure'),
  (e[(e.VerticalPointStructure = 28)] = 'VerticalPointStructure'),
  (e[(e.VerticalLineStructure = 29)] = 'VerticalLineStructure'),
  (e[(e.ConstructionArea = 30)] = 'ConstructionArea'),
  (e[(e.BlastPad = 33)] = 'BlastPad'),
  (e[(e.ServiceRoad = 34)] = 'ServiceRoad'),
  (e[(e.Water = 35)] = 'Water'),
  (e[(e.Hotspot = 37)] = 'Hotspot'),
  (e[(e.AsrnEdge = 39)] = 'AsrnEdge'),
  (e[(e.AsrnNode = 40)] = 'AsrnNode'),
  e
))(dhe || {})
```

### 3.2 Node Types (ASRN - Airport Surface Routing Network)
**File Location**: Line 269404-269416

```javascript
hhe = ((e) => (
  (e[(e.Taxiway = 0)] = 'Taxiway'),
  (e[(e.HoldingPosition = 1)] = 'HoldingPosition'),
  (e[(e.RunwayBoundary = 2)] = 'RunwayBoundary'),
  (e[(e.RunwayExitLine = 3)] = 'RunwayExitLine'),
  (e[(e.RunwayIntersection = 4)] = 'RunwayIntersection'),
  (e[(e.ParkingBoundary = 5)] = 'ParkingBoundary'),
  (e[(e.ApronBoundary = 6)] = 'ApronBoundary'),
  (e[(e.TaxiwayLink = 7)] = 'TaxiwayLink'),
  (e[(e.Deicing = 8)] = 'Deicing'),
  (e[(e.Stand = 9)] = 'Stand'),
  e
))(hhe || {});
```

---

## 4. Gate/Parking Stand Rendering Logic

### 4.1 Stand Data Processing
**File Location**: Line ~269503-269541

```javascript
// Filter stands from ASRN nodes
t.asrnnode.features.filter((e) => e.properties.nodetype === hhe.Stand)

// Process parking stand areas
t.parkingstandarea.features

// Terminal building structures
t.verticalpolygonalstructure.features

// Organize stands by terminal
.reduce((e, t) => {
  const r = t.area.properties.termref;
  let i = e.find((e) => e.ident === r);
  if (!i) {
    const t = n
      ?.filter((e) => e.properties.ident === r)
      .map((e) => e.geometry.coordinates);
    ((i = {
      stands: [],
      ident: r,
      geometry: t && t.length > 0 ? aF(t).geometry : void 0,
    }),
      e.push(i));
  }
  return (i.stands.push(t), e);
}, []);
```

**Key Properties**:
- `idstd` - Stand identifier (e.g., "A1", "B12")
- `termref` - Terminal reference
- `nodetype` - Node type (Stand = 9)
- `idnetwrk` - Network node identifier

### 4.2 Stand Sorting Logic
**File Location**: Line ~269432-269446

```javascript
const ghe = 'panel' === Ba.OS
  ? { compare: (e, t) => e.localeCompare(t) }
  : new Intl.Collator(void 0, { numeric: !0, sensitivity: 'base' });

function yhe(e) {
  let { stands: t } = e
  return Object.assign({
    stands: [...t].sort((e, t) =>
      ghe.compare(e.area.properties.idstd ?? '', t.area.properties.idstd ?? '')
    ),
  }, n);
}
```

Stands are sorted **alphanumerically** (e.g., A1, A2, A10, A11).

---

## 5. Vector Tiles Processing

### 5.1 Vector Tile Parser
**File Location**: Line ~100514-100716

```javascript
// PBF (Protocol Buffer Format) reader
(this._pbf = e)

// Vector Tile Layer class
class Im {
  constructor(e, t) {
    (this._pbf = e)
  }

  feature(e) {
    this._pbf.pos = this._features[e];
    var t = this._pbf.readVarint() + this._pbf.pos;
    return new Om(this._pbf, t, this.extent, this._keys, this._values);
  }
}

// Main VectorTile class
var jm = (wm.VectorTile = Dm),
    Fm = (wm.VectorTileFeature = Sm);
```

### 5.2 Vector Tile Loading
**File Location**: Line ~115103-115112

```javascript
const r = ti(e.request, (e, r, i, o) => {
  e
    ? t(e)
    : r &&
      t(null, {
        vectorTile: n ? void 0 : new jm(new Ky(r)), // Parse PBF data
        rawData: r,
        cacheControl: i,
        expires: o,
      });
});
```

**Process**:
1. Request tile data (PBF format)
2. Parse using `Ky` (Protocol Buffer reader)
3. Create `VectorTile` object (`jm`)
4. Extract features and geometries

---

## 6. Mapbox Layer Rendering

### 6.1 Layer Types
**File Location**: Line ~110457-114446

Mapbox GL supports these layer types for airport rendering:

#### Line Layers (Taxiways, Runway edges)
```javascript
'line-color': new nu(ou.paint_line['line-color']),
'line-trim-color': new tu(ou.paint_line['line-trim-color']),
'line-border-color': new nu(ou.paint_line['line-border-color']),
```

#### Fill Layers (Aprons, Runways)
```javascript
'fill-color': new nu(ou.paint_fill['fill-color']),
'fill-outline-color': new nu(ou.paint_fill['fill-outline-color']),
```

#### Symbol Layers (Gate labels)
```javascript
'text-color': new nu(ou.paint_symbol['text-color']),
'text-halo-color': new nu(ou.paint_symbol['text-halo-color']),
'icon-color': new nu(ou.paint_symbol['icon-color']),
```

#### Circle Layers (Stand positions)
```javascript
'circle-color': new nu(ou.paint_circle['circle-color']),
'circle-stroke-color': new nu(ou.paint_circle['circle-stroke-color']),
```

### 6.2 Layer Management
**File Location**: Line ~136217-136244

```javascript
addLayer(e, t, n, r) {
  // Add layer to map style
  // Apply paint properties
  // Set visibility
}
```

**Layer Addition Process**:
1. Validate layer definition
2. Check source exists
3. Add to style order
4. Apply paint/layout properties
5. Fire 'layer added' event

---

## 7. Paint Properties & Styling

### 7.1 Color System
Colors are defined using Mapbox's color specification:
- RGB arrays: `[255, 0, 0]`
- Hex strings: `"#FF0000"`
- Named colors: `"red"`
- RGBA: `[255, 0, 0, 1.0]`

### 7.2 Style Properties Found

**Line Styles**:
- `line-color` - Line color
- `line-width` - Line thickness
- `line-opacity` - Transparency
- `line-border-color` - Border color for dual-line rendering
- `line-trim-color` - Trim/edge color

**Fill Styles**:
- `fill-color` - Polygon fill color
- `fill-outline-color` - Polygon outline
- `fill-opacity` - Fill transparency
- `fill-pattern` - Pattern fill (for textures)

**Text Styles**:
- `text-color` - Text color
- `text-halo-color` - Text outline/glow
- `text-halo-width` - Halo thickness
- `text-size` - Font size
- `text-font` - Font family

---

## 8. Runway Information System

### 8.1 Runway Data Structure
**File Location**: Line ~227630-227668

```javascript
fragment runwayFragment on Runway {
  id
  runwayIdentifier
  runwayLength
  runwayWidth
  runwayMagneticBearing
  runwayMagneticTrueIndicator
  elevation
  runwayGradient
  // ... surface types, lighting, etc.
}

// Airport query with runways
runways @skip(if: ${e}) {
  ...runwayFragment
}
```

### 8.2 Runway Length Unit Conversion
**File Location**: Line ~223902-223907

```javascript
let n = BJ(e.runwayLength),
    r = BJ(e.runwayWidth);

// Convert feet to meters if needed
if (conversionNeeded) {
  n = BJ(Math.round(0.3048 * e.runwayLength));
  r = BJ(Math.round(0.3048 * e.runwayWidth));
}
```

**Conversion Factor**: 1 foot = 0.3048 meters

---

## 9. Airport Marker Rendering

### 9.1 Airport Icon Rendering
**File Location**: Line ~229154-229195

```javascript
if (('object_type' in e && 'airport' === e.object_type) || 'runways' in e) {
  // Airport marker detected
}

// Airport marker HTML
html: `<div class="marker-icon-container" style="
  background-color: ${'runways' in i ? t.colors['Teal/500'] : Lk(a)};
  width: ${s}px;
  height: ${s}px">
    ${n ? `<img style="width: ${c}px" src="${n}" />` : ''}
</div>`
```

**Airport Marker Features**:
- **Color**: Teal/500 for airports with runways
- **Size**: Dynamic based on zoom level
- **Icon**: Optional airport icon image
- **Label**: ICAO code or name

### 9.2 Airport Label Styling
**File Location**: Line ~229073

```javascript
className: `marker-label ${
  'subtype' in i && o ? (i.subtype?.toLowerCase() ?? '') : ''
} ${
  'runways' in i ? 'airport' : ''
}`
```

---

## 10. Data Loading & Caching

### 10.1 Query Caching
**File Location**: Line ~269476-269502

```javascript
return ZM(
  ['amdb-layers', t, ...Object.values(n)], // Cache key
  () => fetchFunction(),
  { enabled: pB(t) } // Enabled if ICAO is valid
);
```

**Cache Strategy**:
- Cache key: `['amdb-layers', ICAO, ...params]`
- Query is enabled only when ICAO is valid
- Data persists across component remounts

### 10.2 Source Data Events
**File Location**: Line ~110854-110906

```javascript
// Metadata loaded
this.fire(new Di('data', {
  dataType: 'source',
  sourceDataType: 'metadata'
}));

// Content loaded
this.fire(new Di('data', {
  dataType: 'source',
  sourceDataType: 'content'
}));
```

**Event Types**:
- `metadata` - Source metadata loaded
- `content` - Actual tile/feature data loaded
- `error` - Loading error
- `visibility` - Visibility changed

---

## 11. Key Implementation Details

### 11.1 GeoJSON Feature Structure
Features from AMDB are returned as **GeoJSON FeatureCollections**:

```javascript
{
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Polygon", // or Point, LineString
        coordinates: [[lon, lat], ...]
      },
      properties: {
        idstd: "A12",      // Stand ID
        termref: "1",      // Terminal reference
        nodetype: 9,       // Stand node type
        idnetwrk: "...",   // Network ID
        // ... other properties
      }
    }
  ]
}
```

### 11.2 Geometry Types Used
- **Polygon**: Aprons, parking stands, terminal buildings, runways
- **LineString**: Taxiways, guidance lines, markings
- **Point**: Stand positions, reference points, nodes
- **MultiPolygon**: Complex terminal structures

### 11.3 Coordinate System
- **Format**: WGS84 (EPSG:4326) - Longitude, Latitude
- **Precision**: Configurable via API parameter
- **Projection**: Can be specified in request (defaults to WGS84)

---

## 12. Performance Optimizations

### 12.1 Visible Features Only
Layers are culled based on:
- Current zoom level
- Viewport bounds
- Layer visibility settings
- Feature density

### 12.2 Vector Tile Advantages
- **Efficient**: Binary format, smaller than GeoJSON
- **Scalable**: Features rendered at any zoom level
- **Styleable**: Client-side styling without re-downloading
- **Cached**: Tiles cached in browser

---

## 13. UI Integration Points

### 13.1 Stand Selection UI
**File Location**: Line ~269542-269569

```javascript
[a, s] = (0, u.useState)(null), // Selected stand state
{ data: l } = Mde(e),           // Airport data
{ fitBounds: c } = kW(),        // Map bounds control

d = (0, u.useCallback)(
  (e) => {
    if ((s(e?.ident ?? null), e?.geometry)) {
      const t = new IK(ule()(e.geometry));
      c(t); // Fit map to stand bounds
    }
  }
)
```

**Interaction Flow**:
1. User clicks on stand/terminal
2. State updates with selected stand ID
3. Map bounds adjusted to fit selected geometry
4. Visual highlight applied (not shown in code snippet)

### 13.2 Terminal Organization
**File Location**: Line ~269544-269556

```javascript
[
  {
    title: 'Terminals',
    data: vhe(r)
      .map(yhe)
      .filter((e) => e.stands.length >= 1),
  },
  {
    title: 'No Terminal',
    data: r.filter((e) => !e.ident).map(yhe)
  },
].filter((e) => e.data.length >= 1)
```

**Organization**:
- **Section 1**: Stands grouped by terminal
- **Section 2**: Stands without terminal assignment
- Empty sections filtered out

---

## 14. Runway Selection & Route Planning

### 14.1 Runway Selection State
**File Location**: Line ~208244-208275

```javascript
// Set departure runway
if (!e.origin) throw new Error('Unable to set departure runway without an origin airport');

return {
  origin: Object.assign({}, e.origin, { selected_runway: t }),
  sid: t && !e.sid?.runways?.includes(t) ? null : e.sid
}

// Set arrival runway
if (!e.destination) throw new Error('Unable to set arrival runway without a destination airport');

return {
  destination: Object.assign({}, e.destination, { selected_runway: t }),
  star: t && !e.star?.runways?.includes(t) ? null : e.star,
  approach: t && !e.approach?.runways?.includes(t) ? null : e.approach
}
```

**Validation**:
- SID must be compatible with selected runway
- STAR must be compatible with selected runway
- Approach must be compatible with selected runway
- Procedures cleared if incompatible

---

## 15. Search & Discovery

### 15.1 Airport Detection
**File Location**: Line ~227064 & 229154

```javascript
// Route waypoint detection
else if ('runways' in r)
  e.navigate('Airport', { icao: r.icao_code ?? '' });

// Map feature detection
if (('object_type' in e && 'airport' === e.object_type) || 'runways' in e) {
  // Handle as airport
}
```

**Detection Methods**:
- Check for `runways` property
- Check for `object_type === 'airport'`
- Check for `is_alternate` flag

---

## 16. Technical Specifications

### 16.1 Vector Tile Specifications
- **Format**: Mapbox Vector Tiles (MVT) / Protocol Buffers (PBF)
- **Encoding**: Binary
- **Compression**: gzip
- **Tile Size**: 512x512 logical pixels
- **Extent**: 4096 units (Mapbox standard)

### 16.2 Mapbox GL Version
Based on code analysis:
- Mapbox GL JS v2.x or v3.x
- Custom style extensions
- Support for 3D extrusions
- Custom shader support

### 16.3 Data Update Cycle
**AIRAC Cycle**: Aviation data updates every 28 days
- New cycle released every 4 weeks
- Historical cycles available
- Forward cycles pre-released

---

## 17. Error Handling

### 17.1 Missing Data Handling
```javascript
// Null checks throughout
e?.property ?? fallbackValue

// Empty array defaults
features.filter(...) || []

// Error boundaries
try { ... } catch { /* handle */ }
```

### 17.2 API Error Responses
```javascript
sourceDataType: 'error' // Fired on load failure
```

---

## 18. Related Features

### 18.1 ATIS Integration
**File Location**: Line ~196197

```javascript
pE = qC('settingsATISRunwayStatusPriorityState', EC('Real'));
```

ATIS runway status affects:
- Active runway display
- Runway priority in UI
- Weather overlay

### 18.2 Traffic Visualization
**File Location**: Line ~234852

```javascript
n || 'external-traffic-atc-airports' !== l.current?.layer?.id || f();
```

Integration with:
- Live traffic layer
- ATC positions
- Aircraft on ground

---

## 19. Summary of Key Functions

| Function | Purpose | Location |
|----------|---------|----------|
| `amdb-layers` query | Fetch airport layout data | Line ~269477 |
| `dhe` enum | Airport feature types | Line 269365 |
| `hhe` enum | ASRN node types | Line 269404 |
| `yhe()` | Sort stands alphanumerically | Line 269436 |
| `vhe()` | Organize terminals | Line 269448 |
| VectorTile parser | Parse PBF tiles | Line ~100514 |
| `addLayer()` | Add Mapbox layer | Line ~136217 |
| Paint properties | Style definitions | Line ~110457 |

---

## 20. Rendering Pipeline Summary

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User selects airport (ICAO code)                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Query AMDB API                                           │
│    GET /v1/{ICAO}?include=asrnnode,parkingstandarea,...    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Receive GeoJSON FeatureCollections                      │
│    - asrnnode features (nodes, stands)                     │
│    - parkingstandarea features (polygons)                  │
│    - verticalpolygonalstructure features (buildings)       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Process & organize data                                  │
│    - Filter stands (nodetype === 9)                        │
│    - Group by terminal                                      │
│    - Sort alphanumerically                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Add Mapbox layers                                        │
│    - Fill layers for aprons/stands                         │
│    - Line layers for taxiways                              │
│    - Symbol layers for labels                              │
│    - Circle layers for positions                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Apply paint properties                                   │
│    - Colors (fill-color, line-color, text-color)          │
│    - Widths (line-width)                                   │
│    - Opacities (fill-opacity)                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Render to canvas                                         │
│    - Mapbox GL rendering engine                            │
│    - WebGL acceleration                                     │
│    - Dynamic zoom/pan                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 21. Conclusion

The Navigraph Charts Viewer implements a sophisticated airport layout rendering system using:

1. **Mapbox GL JS** for high-performance vector tile rendering
2. **AMDB API** for authoritative aerodrome mapping data
3. **GeoJSON** as the primary data interchange format
4. **Protocol Buffers (PBF)** for efficient vector tile transmission
5. **Comprehensive feature types** covering all airport ground elements
6. **Dynamic styling** with Mapbox paint properties
7. **Intelligent data organization** grouping stands by terminals
8. **Real-time updates** with AIRAC cycle synchronization

The system supports:
- All major airport elements (runways, taxiways, aprons, gates)
- Surface markings and guidance lines
- Terminal buildings and structures
- Route planning with runway validation
- Interactive selection and navigation
- Live traffic integration

This architecture enables accurate, detailed airport charts suitable for professional aviation use while maintaining excellent performance across devices.

---

**Analysis Date**: 2026-02-24
**Source File**: `C:\Users\allof\Desktop\251212 GIS\rkpu-viewer\navigraph-analysis\main.bundle.js`
**Total Lines**: 291,294
**File Size**: 13.8 MB
