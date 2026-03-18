# CAAS Tech Challenge: Operations Terminal Client

This repository contains the frontend client for the CAAS flight tracking system. It prioritizes situational awareness, geospatial rendering, and interactive route visualization.

*(Note: For details on the overall system architecture, spatial culling pipeline, and routing logic, please refer to the Backend repository README).*

## Frontend Architecture

~~~mermaid
graph TD
    subgraph Frontend [React Client]
        UI[HUD & React Controls]
        Map[Leaflet Map Engine]
        Chunker[Viewport Chunk Manager]
        State[Global React State]
        
        UI <--> State
        Map <--> State
        Map <--> Chunker
    end

    subgraph External
        API[Backend FastAPI Service]
        Tiles[CartoDB Dark Tile Server]
    end

    Chunker <-->|Fetch Visible Data| API
    UI <-->|Fetch Flight Paths| API
    Map <--> Tiles
~~~

## System Design & Rationale

### Map Rendering Engine
* **Actual:** React-Leaflet - Open-source mapping library utilizing DOM and SVG rendering.
* **Alternative 1:** Mapbox GL JS / MapLibre - WebGL-based vector mapping libraries.
* **Rationale:** * WebGL engines handle large global datasets efficiently but require tile-server configuration and specific data formatting.
    * Leaflet provides sufficient performance for a prototype, operates without vendor lock-in, and allows direct manipulation of SVG polylines.
    * This direct access was necessary to implement custom rendering logic for routes crossing the Pacific Dateline.

### Dateline Crossover Handling
* **Actual:** Custom Interceptor Algorithm - Splits coordinate arrays into MultiPolylines if the longitude delta exceeds 180 degrees.
* **Alternative 1:** Turf.js - Geospatial analysis library with line splitting capabilities.
* **Rationale:** * Mapping libraries typically draw a straight line across the map when coordinates wrap from 180 to -180 longitude.
    * Integrating Turf.js would resolve this but adds unnecessary bundle size for a single operation.
    * Writing a utility function to split the array off the visible map edge was a more efficient solution to prevent visual artifacts.

### UI State & Rendering
* **Actual:** On-Demand Layering - Tactical routes are stored in React state and rendered as SVG layers only when selected by the user.
* **Alternative 1:** Global Render Toggle - Rendering all computed routes simultaneously upon flight selection.
* **Rationale:** * Displaying multiple intersecting global flight paths simultaneously creates visual clutter.
    * By defaulting to the active path and rendering alternatives exclusively on user interaction, the interface remains readable and functional for operational monitoring.

### Visual Interface
* **Actual:** CartoDB Dark Matter - High-contrast, dark-mode map tile layer.
* **Alternative 1:** OpenStreetMap Default - Standard light-mode street mapping tiles.
* **Rationale:** * Standard street maps contain high levels of terrestrial detail (e.g., roads, city labels) which compete visually with plotted flight paths.
    * A dark tile layer mutes the background and provides necessary contrast for the aviation geometry, aligning with standard radar and display systems.

## Future Architectural Enhancements

*(Note: Enhancements requiring cross-stack coordination, such as WebSocket integration and push-based rerouting, are in the Backend repository README).*

### WebGL Rendering Migration
* **Concept:** Migrate the map rendering engine from Leaflet (DOM/SVG based) to a WebGL-accelerated framework like deck.gl or Mapbox GL JS.
* **Rationale:** * While the current Viewport Chunking algorithm efficiently culls static waypoints to protect the DOM, rendering tens of thousands of live, continuously moving aircraft globally will eventually bottleneck the browser's main thread.
  * Moving to WebGL offloads spatial rendering directly to the user's GPU.
  * This enables smooth 60fps performance even under massive data loads and allows for advanced 3D spatial visualizations of altitude and terrain data.

## Local Development

1. Install dependencies: `npm install`
2. Configure environment: Create a `.env` file and add your backend URL: `VITE_API_BASE_URL=http://127.0.0.1:8000`
3. Run the development server: `npm run dev`

## Deployment Strategy

The frontend is built as a Single Page Application (SPA).
1. **Build:** Execute `npm run build` to compile the static assets into the `/dist` directory.
2. **Hosting:** Deploy via platforms such as Vercel, Netlify, or AWS S3 + CloudFront for edge-network content delivery.
3. **Routing Configuration:** Ensure the hosting provider is configured with a Catch-All redirect (sending 404 traffic to `index.html`) to support client-side routing.