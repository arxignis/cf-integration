# Arxignis Proxy

[![asciicast](https://asciinema.org/a/hbWaxtYD07lPKX9eL2lXmSlUZ.svg)](https://asciinema.org/a/hbWaxtYD07lPKX9eL2lXmSlUZ)

## 🎉 Join Our Discord Community! 🎉

Come hang out with us and be part of our awesome community on Discord! Whether you're here to chat, get support, or just have fun, everyone is welcome.

[![Join us on Discord](https://img.shields.io/badge/Join%20Us%20on-Discord-5865F2?logo=discord&logoColor=white)](https://discord.gg/jzsW5Q6s9q)

See you there! 💬✨

A Cloudflare Workers-based proxy that provides threat intelligence and protection for your web applications.

## Features

- **Threat Intelligence**: Real-time threat detection using Arxignis API
- **Traffic Monitoring**: Monitor and analyze incoming traffic
- **Blocking Mode**: Automatically block malicious traffic
- **Turnstile Integration**: Cloudflare Turnstile for bot protection
- **OpenTelemetry Integration**: Comprehensive observability with Prometheus/Axiom support
- **Durable Objects**: Efficient buffering for logs and metrics
- **KV Storage**: Caching for improved performance
- **Easy Deployment**: Simple installation script for Cloudflare Workers

## Requirements

### System Requirements

- **Node.js**: Version 22 or higher
- **pnpm**: For package management (recommended)
- **npx**: For Wrangler commands
- **jq**: For JSON parsing (automatically installed if missing)
- **Bash**: For running the installation script

### Cloudflare Requirements

- **Cloudflare Account**: Active Cloudflare account
- **API Token**: Cloudflare API token with the following permissions:
  - Account Settings (Read)
  - Challenge Widgets (Edit)
  - User Details (Read)
  - Workers KV Storage (Edit)
  - Workers Routes (Edit)
  - Workers Scripts (Edit)
  - Zone (Read)
  - DNS (Read)

### External Services

- **Arxignis API Key**: Get your API key from [arxignis.com](https://arxignis.com)
- **Domain**: A domain you control and can configure DNS for
- **Axiom** (Optional): For Prometheus metrics collection via OpenTelemetry

## Installation

### Quick Start

1. **Clone or download** the proxy files to your local machine
   ```bash
   git clone https://github.com/arxignis/cf-integration
   ```
2. **Navigate** to the proxy directory:
   ```bash
   cd cf-integration
   ```
3. **Run the installation script**:
   ```bash
   ./install.sh
   ```
4. **Follow the prompts** to configure your settings
5. **Deploy** to Cloudflare Workers:
   ```bash
   pnpm install
   npx wrangler deploy
   ```

### Manual Installation

If you prefer to configure manually:

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Configure `wrangler.jsonc`**:
   - Set your Cloudflare Account ID
   - Configure your domain routes
   - Add your API keys and settings
   - Configure KV namespaces and Durable Objects

3. **Deploy**:
   ```bash
   npx wrangler deploy
   ```

## Configuration

### Environment Variables

The following environment variables can be configured in `wrangler.jsonc`:

| Variable | Description | Required |
|----------|-------------|----------|
| `MODE` | Operation mode: `monitor` or `block` | Yes |
| `ARXIGNIS_API_KEY` | Your Arxignis API key | Yes |
| `TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key | Yes |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key | Yes |
| `PERFORMANCE_METRICS` | Enable metrics: `true` or `false` | No |
| `PROMETHEUS_URL` | Axiom traces endpoint for metrics | No |
| `PROMETHEUS_HEADERS` | Authorization headers for metrics | No |
| `BUFFER_FLUSH_INTERVAL` | Buffer flush interval in milliseconds | No |
| `BUFFER_MAX_RETRIES` | Maximum retry attempts for buffer operations | No |

### Modes

- **Monitor Mode**: Only monitors traffic without blocking
- **Block Mode**: Monitors and blocks malicious traffic

### Observability

The proxy includes comprehensive observability features:

- **OpenTelemetry Integration**: Automatic tracing and metrics collection
- **Durable Objects**: Efficient buffering for logs and metrics
- **KV Storage**: Caching for improved performance
- **Prometheus Export**: Metrics export to Axiom or other Prometheus-compatible systems

### Turnstile Setup

The installation script can automatically create Turnstile widgets, or you can use existing ones:

1. **Automatic**: Answer "no" when asked about existing Turnstile keys
2. **Manual**: Provide your existing site key and secret key

## Usage

### Development

For local development:

```bash
pnpm dev          # Development with live reload
pnpm start        # Basic development server
pnpm test         # Run tests
pnpm cf-typegen   # Generate Cloudflare types
```

### DNS Configuration

After deployment, configure your domain's DNS:

1. **Add a CNAME record** pointing to your Cloudflare Workers domain
2. **Or use Cloudflare's proxy** for additional benefits

### Monitoring

- **Logs**: View logs in Cloudflare Workers dashboard
- **Metrics**: If enabled, view metrics in your Axiom dashboard
- **Tracing**: OpenTelemetry traces for request flow analysis
- **Analytics**: Monitor traffic patterns and threats

## Architecture

### Core Components

- **Remediation Engine**: Threat assessment and decision making
- **Captcha Handler**: Turnstile integration for bot protection
- **Log Buffer**: Efficient logging with Durable Objects
- **Metrics Buffer**: Performance metrics collection
- **Cache System**: KV-based caching for improved performance

### Data Flow

1. **Request Reception**: Incoming requests are analyzed
2. **Threat Assessment**: Arxignis API evaluates the request
3. **Decision Making**: Choose between allow, block, or captcha
4. **Response Generation**: Generate appropriate response
5. **Metrics Collection**: Collect performance and security metrics

## Troubleshooting

### Common Issues

1. **Installation fails**:
   - Ensure Node.js version 16+ is installed
   - Check that you have proper Cloudflare API token permissions
   - Verify your Arxignis API key is valid

2. **Turnstile widget creation fails**:
   - Verify your Cloudflare API token has "Challenge Widgets (Edit)" permission
   - Check that your domain is properly configured in Cloudflare

3. **Deployment fails**:
   - Ensure you're logged in to Wrangler: `npx wrangler login`
   - Check your `wrangler.jsonc` configuration
   - Verify your Cloudflare Account ID is correct
   - Use `npx wrangler deploy -e production` for production deployment

4. **Metrics not working**:
   - Verify `PERFORMANCE_METRICS` is set to `true`
   - Check `PROMETHEUS_URL` and headers configuration
   - Ensure Axiom dataset is properly configured

### Getting Help

- **Documentation**: Visit [docs.arxignis.com](https://docs.arxignis.com)
- **Support**: Contact support through the Arxignis platform
- **Issues**: Report bugs or issues through the Arxignis support channels

## Security

- **API Keys**: Never commit API keys to version control
- **Environment Variables**: Use Cloudflare Workers secrets for sensitive data
- **Access Control**: Regularly review and rotate API tokens
- **Monitoring**: Enable logging and monitoring for security events
- **Buffer Security**: Durable Objects provide isolated execution context

## License

This project is licensed under the terms specified in the LICENSE file.

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting pull requests.

---

For more information, visit [arxignis.com](https://arxignis.com)
