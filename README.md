<p align="center">
  <img src="frontend/public/roarinca.png" alt="Roarin CA Logo" width="120" />
</p>

# Roarin CA Console

> A sleek, purple-tuned UI for managing Certificate Authorities, CSRs and digital certificates.

## Features

- **CA Management** — Initialize and configure your Certificate Authority with custom identity and key settings
- **CSR Generation** — Create Certificate Signing Requests with presets for Server TLS, Client TLS, and Code Signing
- **Certificate Lifecycle** — Sign CSRs, import existing certificates, and manage your certificate inventory
- **Export Options** — Download certificates as PEM, fullchain, or password-protected PKCS#12 bundles
- **Modern UI** — Glossy purple-themed interface with responsive design

## Quick Start

### Prerequisites

- Docker & Docker Compose
- OpenSSL (included in container)

### Environment Setup

Create a `.env` file in the project root:

```env
JWT_SECRET=your-secure-jwt-secret
CA_ADMIN_PASSWORD=your-admin-password
CA_EXPORT_PROTECTION=optional-export-password
```

### Run with Docker

```bash
docker-compose up --build
```

Access the console at **http://localhost:4042**

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│     Backend     │────▶│     OpenSSL     │
│   React + Vite  │     │   Express.js    │     │    Container    │
│   Port: 4042    │     │   Port: 4000    │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │     SQLite      │
                        │   /data/*.db    │
                        └─────────────────┘
```

## API Endpoints

### Authentication
- `POST /api/auth/login` — Authenticate with username/password
- `POST /api/auth/logout` — End session
- `GET /api/auth/me` — Get current user

### CA Settings
- `GET /api/ca/settings` — Get CA configuration
- `POST /api/ca/settings` — Save CA configuration
- `POST /api/ca/init` — Initialize CA (generate key + self-signed cert)
- `GET /api/ca/cert` — Download CA certificate

### CSR Management
- `POST /api/csr` — Create new CSR
- `GET /api/csr` — List all CSRs
- `GET /api/csr/:id` — Get CSR details
- `GET /api/csr/:id/download/csr` — Download CSR PEM
- `GET /api/csr/:id/download/key` — Download private key
- `DELETE /api/csr/:id` — Delete CSR

### Certificate Management
- `GET /api/certificates` — List all certificates
- `GET /api/certificates/:id` — Get certificate details
- `POST /api/certificates/import` — Import existing certificate
- `POST /api/certificates/sign/:csrId` — Sign CSR with CA
- `GET /api/certificates/:id/download/cert` — Download certificate PEM
- `GET /api/certificates/:id/download/key` — Download private key
- `GET /api/certificates/:id/download/fullchain` — Download cert + CA chain
- `POST /api/certificates/:id/export/pkcs12` — Export as PKCS#12
- `DELETE /api/certificates/:id` — Delete certificate

## Development

### Frontend (Vite + React)

```bash
cd frontend
npm install
npm run dev
```

### Backend (Express.js)

```bash
cd backend
npm install
npm run dev
```

## License

MIT © RoarinPenguin
