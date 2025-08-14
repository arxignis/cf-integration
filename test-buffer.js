// Simple test script to verify buffer functionality
// Run with: node test-buffer.js

async function testBuffer() {
  console.log('Testing buffer functionality...');

  // Simulate the environment structure
  const mockEnv = {
    LOG_BUFFER: {
      idFromName: (name) => ({ name }),
      get: (id) => ({
        fetch: async (url, options) => {
          console.log(`Mock LOG_BUFFER.fetch called with:`, { url, method: options.method, body: options.body });
          return { ok: true, json: async () => ({ queued: 1, bufferSize: 1, timestamp: Date.now() }) };
        }
      })
    },
    METRICS_BUFFER: {
      idFromName: (name) => ({ name }),
      get: (id) => ({
        fetch: async (url, options) => {
          console.log(`Mock METRICS_BUFFER.fetch called with:`, { url, method: options.method, body: options.body });
          return { ok: true, json: async () => ({ queued: 1, bufferSize: 1, timestamp: Date.now() }) };
        }
      })
    }
  };

  try {
    // Test log buffer
    const { addToLogBuffer } = await import('./src/lib/durable-buffer.ts');
    await addToLogBuffer(mockEnv, { test: 'log data', timestamp: new Date().toISOString() });
    console.log('✅ Log buffer test passed');

    // Test metrics buffer
    const { addToMetricsBuffer } = await import('./src/lib/durable-buffer.ts');
    await addToMetricsBuffer(mockEnv, { test: 'metrics data', timestamp: new Date().toISOString() });
    console.log('✅ Metrics buffer test passed');

  } catch (error) {
    console.error('❌ Buffer test failed:', error);
  }
}

testBuffer();
