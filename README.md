# PanelFlow — Web-Based 3D Electrical Panel Layout & CAD Engineering (.PFLOW)

Web software untuk merancang tata letak panel kontrol listrik industri berbasis 3D/2D dengan dukungan impor file CAD komponen (STEP/STP/DXF/GLB) dan konversi satuan fleksibel (`mm`, `cm`, `m`).

## Core Architecture
- **Frontend 3D Engine**: Next.js + React Three Fiber (Three.js)
- **CAD Processing**: OpenCASCADE / `trimesh` + Auto-LOD Mesh Decimation
- **Units Engine**: Canonical millimeter (`mm`) core with seamless real-time conversion (`mm` / `cm` / `m`)
- **Routing**: A* Cable Duct Auto-Routing & Wire Length Calculation
