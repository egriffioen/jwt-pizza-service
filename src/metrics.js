const config = require('./config');

const os = require('os');

function getCpuUsagePercentage() {
  const cpus = os.cpus();

  let idle = 0;
  let total = 0;

  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  });

  const usage = 100 - (idle / total) * 100;
  return Number(usage.toFixed(2));
}


function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return Number(memoryUsage.toFixed(2));
}
// Metrics stored in memory
const requests = {};
let greetingChangedCount = 0;

// Function to track when the greeting is changed
function greetingChanged() {
  greetingChangedCount++;
}

// Middleware to track requests
function requestTracker(req, res, next) {
  const endpoint = `${req.method}:${req.path}`;
  requests[endpoint] = (requests[endpoint] || 0) + 1;
  next();
}

// This will periodically send metrics to Grafana
setInterval(() => {
  const metrics = [];
  const cpuValue = getCpuUsagePercentage();
  Object.keys(requests).forEach((endpoint) => {
    const [method, path] = endpoint.split(':');
    metrics.push(createMetric('requests', requests[endpoint], '1', 'sum', 'asInt', { method, path }));
  });

  metrics.push(createMetric('greetingChange', greetingChangedCount, '1', 'sum', 'asInt', {}));
  metrics.push(createMetric('cpu', cpuValue, '%', 'gauge', 'asDouble', {}));
  metrics.push(createMetric('memory', getMemoryUsagePercentage(), '%', 'gauge', 'asDouble', {}));


  sendMetricToGrafana(metrics);
}, 10000);

function createMetric(metricName, metricValue, metricUnit, metricType, valueType, attributes) {
  attributes = { ...attributes, source: config.metrics.source };

  const metric = {
    name: metricName,
    unit: metricUnit,
    [metricType]: {
      dataPoints: [
        {
          [valueType]: metricValue,
          timeUnixNano: Date.now() * 1000000,
          attributes: [],
        },
      ],
    },
  };

  Object.keys(attributes).forEach((key) => {
    metric[metricType].dataPoints[0].attributes.push({
      key: key,
      value: { stringValue: attributes[key] },
    });
  });

  if (metricType === 'sum') {
    metric[metricType].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric[metricType].isMonotonic = true;
  }

  return metric;
}

function sendMetricToGrafana(metrics) {
  const body = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics,
          },
        ],
      },
    ],
  };

  fetch(`${config.metrics.endpointUrl}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Authorization: `Bearer ${config.metrics.accountId}:${config.metrics.apiKey}`, 'Content-Type': 'application/json' },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}`);
      }
    })
    .catch((error) => {
      console.error('Error pushing metrics:', error);
    });
}

module.exports = { requestTracker, greetingChanged };