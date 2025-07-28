# AX Proxy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/arxignis/cf-integration)

## 🎉 Join Our Discord Community! 🎉

Come hang out with us and be part of our awesome community on Discord! Whether you're here to chat, get support, or just have fun, everyone is welcome.

[![Join us on Discord](https://img.shields.io/badge/Join%20Us%20on-Discord-5865F2?logo=discord&logoColor=white)](https://discord.gg/jzsW5Q6s9q)

See you there! 💬✨

A high-performance Cloudflare Worker that provides intelligent traffic filtering, threat detection, and remediation capabilities. Built with TypeScript and designed for seamless integration with Cloudflare's edge network.

## Features

### 🔒 Security & Remediation
- **Intelligent IP Filtering**: Real-time threat assessment and IP reputation checking
- **Multi-level Remediation**: Block, captcha challenge, or allow traffic based on threat scores
- **Cloudflare Turnstile Integration**: Seamless captcha challenges using Cloudflare's privacy-focused solution
- **Custom Error Pages**: Configurable HTML, JSON, or external error page responses

### ⚡ Performance
- **Two-tier Caching**: In-memory L1 cache + Cloudflare KV L2 cache for optimal performance
- **Smart Caching**: Configurable TTL with intelligent cache invalidation
- **Edge Computing**: Runs on Cloudflare's global edge network for minimal latency

### 📊 Observability & Telemetry
- **OpenTelemetry Integration**: Built-in tracing and metrics collection
- **Multiple Telemetry Providers**: Support for Axiom and Honeycomb
- **Structured Logging**: Comprehensive request logging with enriched data
- **Performance Metrics**: Detailed timing and performance insights

### 🌐 Network Intelligence
- **IP Geolocation**: Automatic geographic enrichment
- **Network Analysis**: ASN and organization detection
- **TLS Fingerprinting**: Advanced client fingerprinting capabilities
- **Bot Detection**: Integration with Cloudflare Bot Management

## Installation

### Prerequisites
- Node.js 22+ and pnpm
- Cloudflare account with Workers enabled
- Wrangler CLI installed globally: `npm install -g wrangler`

### Setup

1. **Clone and install dependencies**:
```bash
git clone git@github.com:arxignis/cf-integration.git
cd proxy
pnpm install
```

2. **Generate Cloudflare Turnstile Keys**:
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - Navigate to **Security** → **Turnstile**
   - Click **Add site**
   - Choose **Managed** challenge type
   - Add your domain(s) - maximum 15 hostnames per proxy instance (Free plan) or 200 hostnames (Enterprise plan)
   - Copy the **Site Key** and **Secret Key**

3. **Configure environment variables**:
Create a `.dev.vars` file for local development:
```env
ARXIGNIS_API_KEY=your_api_key_here
TURNSTILE_SITE_KEY=your_turnstile_site_key
TURNSTILE_SECRET_KEY=your_turnstile_secret_key
MODE=block
PERFORMANCE_METRICS=true
```

4. **Set up Cloudflare KV namespace**:
```bash
wrangler kv:namespace create "AX_CACHE"
```

5. **Update wrangler.jsonc**:
Replace the KV namespace ID with your created namespace:
```json
"kv_namespaces": [
  {
    "binding": "AX_CACHE",
    "id": "your_kv_namespace_id"
  }
]
```

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `ARXIGNIS_API_KEY` | API key for threat intelligence service | Yes | - |
| `TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key | Yes | - |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key | Yes | - |
| `MODE` | Operation mode: `block` or `monitor` | No | `block` |
| `PERFORMANCE_METRICS` | Enable performance metrics | No | `true` |
| `ERROR_PAGE_TYPE` | Error page format: `html`, `json`, `external` | No | `html` |

### Telemetry Configuration

#### Axiom Integration
```json
{
  "PROMETHEUS_URL": "https://api.axiom.co/v1/traces",
  "PROMETHEUS_HEADERS": {
    "Authorization": "Bearer your_axiom_token",
    "X-Axiom-Dataset": "your_dataset_name"
  }
}
```

#### Honeycomb Integration
```json
{
  "PROMETHEUS_URL": "https://api.honeycomb.io/v1/traces",
  "PROMETHEUS_HEADERS": {
    "x-honeycomb-team": "your_team_key",
    "x-honeycomb-dataset": "your_dataset_name"
  }
}
```

## Usage

### Development
```bash
# Start local development server
pnpm dev

# Run tests
pnpm test

# Generate Cloudflare types
pnpm cf-typegen
```

### Deployment
```bash
# Deploy to Cloudflare Workers
pnpm deploy
```

### Route Configuration
Configure routes in `wrangler.jsonc`. **Maximum 15 hostnames per proxy instance (Free plan) or 200 hostnames (Enterprise plan)**:

```json
{
  "routes": [
    {
      "pattern": "*.yourdomain1.com/*",
      "zone_name": "yourdomain1.com"
    },
    {
      "pattern": "*.yourdomain2.com/*",
      "zone_name": "yourdomain2.com"
    },
    {
      "pattern": "*.yourdomain3.com/*",
      "zone_name": "yourdomain3.com"
    },
    {
      "pattern": "*.yourdomain4.com/*",
      "zone_name": "yourdomain4.com"
    },
    {
      "pattern": "*.yourdomain5.com/*",
      "zone_name": "yourdomain5.com"
    },
    {
      "pattern": "*.yourdomain6.com/*",
      "zone_name": "yourdomain6.com"
    },
    {
      "pattern": "*.yourdomain7.com/*",
      "zone_name": "yourdomain7.com"
    },
    {
      "pattern": "*.yourdomain8.com/*",
      "zone_name": "yourdomain8.com"
    },
    {
      "pattern": "*.yourdomain9.com/*",
      "zone_name": "yourdomain9.com"
    },
    {
      "pattern": "*.yourdomain10.com/*",
      "zone_name": "yourdomain10.com"
    },
    {
      "pattern": "*.yourdomain11.com/*",
      "zone_name": "yourdomain11.com"
    },
    {
      "pattern": "*.yourdomain12.com/*",
      "zone_name": "yourdomain12.com"
    },
    {
      "pattern": "*.yourdomain13.com/*",
      "zone_name": "yourdomain13.com"
    },
    {
      "pattern": "*.yourdomain14.com/*",
      "zone_name": "yourdomain14.com"
    },
    {
      "pattern": "*.yourdomain15.com/*",
      "zone_name": "yourdomain15.com"
    }
  ]
}
```

**Note**: If you need to protect more than 15 hostnames (Free plan) or 200 hostnames (Enterprise plan), create additional proxy instances with separate configurations.

## Architecture

### System Overview
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client        │    │   Cloudflare     │    │   Origin        │
│   Request       │───▶│   Edge Network   │───▶│   Server        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   AX Proxy       │
                       │   Worker         │
                       └──────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Two-Tier       │
                       │   Cache          │
                       │   (L1 + L2 KV)   │
                       └──────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Threat Intel   │
                       │   API            │
                       └──────────────────┘
```

### Request Flow
1. **IP Extraction**: Extract client IP from Cloudflare headers
2. **Cache Check**: Check two-tier cache for existing remediation decisions
3. **Threat Assessment**: Query threat intelligence API if not cached
4. **Remediation**: Apply block, captcha, or allow based on threat score
5. **Telemetry**: Send observability data to configured providers
6. **Response**: Return appropriate response to client

### Caching Strategy
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Request       │───▶│   L1 Cache      │───▶│   L2 Cache      │
│   IP Check      │    │   (In-Memory)   │    │   (Cloudflare   │
└─────────────────┘    │   TTL: 30s      │    │    KV)          │
                       │   Size: 5000    │    │   TTL: 5min     │
                       └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Cache Hit     │    │   Cache Miss    │
                       │   Return        │    │   API Call      │
                       │   Decision      │    │   & Store       │
                       └─────────────────┘    └─────────────────┘
```

- **L1 Cache**: In-memory cache with 30-second max TTL
- **L2 Cache**: Cloudflare KV with configurable TTL (up to 5 minutes)
- **Cache Invalidation**: Automatic cleanup of expired or invalid entries

### Error Handling
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Error     │───▶│   Fallback      │───▶│   Allow Traffic │
│   or Timeout    │    │   Decision      │    │   (Graceful     │
└─────────────────┘    │   (30s timeout) │    │    Degradation) │
                       └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Error Logging │
                       │   & Telemetry   │
                       └─────────────────┘
```

- **Graceful Degradation**: Falls back to allow if API is unavailable
- **Timeout Protection**: 30-second timeout for external API calls
- **Error Logging**: Comprehensive error tracking and reporting

## Monitoring & Observability

### Metrics Collected
- Request latency and throughput
- Cache hit/miss ratios
- Remediation decision distribution
- Error rates and types
- Geographic and network data

### Tracing
- Request flow through the proxy
- External API call timing
- Cache operation performance
- Error propagation paths

## Security Considerations

- **API Key Protection**: Store sensitive keys as environment variables
- **Rate Limiting**: Implement appropriate rate limits for your use case
- **Error Information**: Configure error pages to avoid information disclosure
- **TLS Requirements**: Enforce HTTPS for all external communications

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at:

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

## Support

For issues and questions:
- Create an issue in the repository
- Check the documentation
- Review the configuration examples
