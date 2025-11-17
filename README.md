# Stream Buddy

Browser-based multi-platform streaming application built with Angular 17+.

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Docker Engine 20.10+
- Docker Compose V2+
- OpenSSL (for SSL certificate generation)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/stream-buddy.git
cd stream-buddy
```

2. Install dependencies:
```bash
npm install
```

3. Generate SSL certificates for MediaMTX:
```bash
./scripts/generate-certs.sh
```

4. Start MediaMTX server:
```bash
docker-compose up -d
```

5. Start the Angular development server:
```bash
npm start
```

6. Open your browser to `https://localhost:4200`

## Architecture

Stream Buddy uses a microservices architecture:

- **Angular Frontend**: WebRTC media capture and scene composition
- **MediaMTX Server**: WebRTC to RTMP gateway (Docker container)
- **Streaming Platforms**: Twitch, YouTube, Facebook (RTMP endpoints)

For detailed infrastructure documentation, see [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md).

## Documentation

- [Infrastructure Setup](docs/INFRASTRUCTURE.md) - MediaMTX deployment and configuration
- [Technical Specifications](docs/tech-specs/) - Detailed design documents

## Development

This project uses:
- Angular 17+ with standalone components
- TypeScript with strict type checking
- Signals for state management
- Vitest for testing
- Docker for infrastructure

## License

MIT