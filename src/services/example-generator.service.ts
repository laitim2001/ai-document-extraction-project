/**
 * @fileoverview SDK Example Generator Service
 * @description
 *   Generates SDK code examples for multiple programming languages.
 *   Provides examples for all API endpoints in TypeScript, Python, and C#.
 *
 *   Features:
 *   - Multi-language code generation
 *   - Complete request/response examples
 *   - Error handling patterns
 *   - Webhook signature verification examples
 *
 * @module src/services/example-generator.service
 * @since Epic 11 - Story 11.6
 * @lastModified 2024-12-21
 */

import type {
  SDKExample,
  SDKExampleCategory,
  SDKExamplesCollection,
  SDKLanguage,
  QuickStartSection,
  SDKInstallation,
} from '@/types/sdk-examples';

// ============================================================
// SDK Examples Data
// ============================================================

/**
 * Installation instructions for each language
 */
const INSTALLATION_INSTRUCTIONS: SDKInstallation[] = [
  {
    language: 'typescript',
    packageManager: 'npm',
    installCommand: 'npm install axios',
    importStatement: "import axios from 'axios';",
    initializationCode: `const API_KEY = process.env.INVOICE_API_KEY || 'your-api-key';
const BASE_URL = 'https://api.example.com/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': \`Bearer \${API_KEY}\`,
    'Content-Type': 'application/json',
  },
});`,
  },
  {
    language: 'python',
    packageManager: 'pip',
    installCommand: 'pip install requests',
    importStatement: 'import requests\nimport os',
    initializationCode: `API_KEY = os.getenv("INVOICE_API_KEY", "your-api-key")
BASE_URL = "https://api.example.com/api/v1"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}`,
  },
  {
    language: 'csharp',
    packageManager: 'NuGet',
    installCommand: 'dotnet add package System.Net.Http.Json',
    importStatement: `using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Threading.Tasks;`,
    initializationCode: `public class InvoiceApiClient
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;

    public InvoiceApiClient(string apiKey)
    {
        _apiKey = apiKey;
        _httpClient = new HttpClient
        {
            BaseAddress = new Uri("https://api.example.com/api/v1/")
        };
        _httpClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", _apiKey);
    }
}`,
  },
];

/**
 * SDK Examples organized by category
 */
const SDK_EXAMPLES: SDKExampleCategory[] = [
  {
    id: 'invoices',
    name: 'Invoice Processing',
    description: 'Submit invoices for AI-powered extraction',
    examples: [
      {
        endpoint: '/invoices',
        method: 'POST',
        title: 'Submit Invoice',
        description: 'Upload an invoice document for processing',
        code: {
          typescript: `import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const API_KEY = process.env.INVOICE_API_KEY!;

async function submitInvoice(filePath: string, forwarderId: string) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('forwarderId', forwarderId);
  form.append('priority', 'NORMAL');
  form.append('metadata', JSON.stringify({
    orderId: 'ORD-12345',
    department: 'Finance'
  }));

  const response = await axios.post(
    'https://api.example.com/api/v1/invoices',
    form,
    {
      headers: {
        'Authorization': \`Bearer \${API_KEY}\`,
        ...form.getHeaders(),
      },
    }
  );

  console.log('Task ID:', response.data.data.taskId);
  console.log('Status:', response.data.data.status);

  return response.data;
}

// Usage
submitInvoice('./invoice.pdf', '123e4567-e89b-12d3-a456-426614174000')
  .then(result => console.log('Submitted:', result))
  .catch(err => console.error('Error:', err.response?.data || err.message));`,
          python: `import requests
import os

API_KEY = os.getenv("INVOICE_API_KEY")
BASE_URL = "https://api.example.com/api/v1"

def submit_invoice(file_path: str, forwarder_id: str):
    """Submit an invoice for processing."""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
    }

    with open(file_path, "rb") as f:
        files = {"file": f}
        data = {
            "forwarderId": forwarder_id,
            "priority": "NORMAL",
            "metadata": '{"orderId": "ORD-12345", "department": "Finance"}'
        }

        response = requests.post(
            f"{BASE_URL}/invoices",
            headers=headers,
            files=files,
            data=data
        )

    response.raise_for_status()
    result = response.json()

    print(f"Task ID: {result['data']['taskId']}")
    print(f"Status: {result['data']['status']}")

    return result

# Usage
if __name__ == "__main__":
    result = submit_invoice(
        "./invoice.pdf",
        "123e4567-e89b-12d3-a456-426614174000"
    )
    print(f"Submitted: {result}")`,
          csharp: `using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading.Tasks;

public class InvoiceApiClient
{
    private readonly HttpClient _httpClient;

    public InvoiceApiClient(string apiKey)
    {
        _httpClient = new HttpClient
        {
            BaseAddress = new Uri("https://api.example.com/api/v1/")
        };
        _httpClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", apiKey);
    }

    public async Task<InvoiceSubmissionResponse> SubmitInvoiceAsync(
        string filePath,
        string forwarderId)
    {
        using var content = new MultipartFormDataContent();

        // Add file
        var fileContent = new ByteArrayContent(await File.ReadAllBytesAsync(filePath));
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        content.Add(fileContent, "file", Path.GetFileName(filePath));

        // Add form fields
        content.Add(new StringContent(forwarderId), "forwarderId");
        content.Add(new StringContent("NORMAL"), "priority");
        content.Add(new StringContent(
            JsonSerializer.Serialize(new { orderId = "ORD-12345", department = "Finance" })
        ), "metadata");

        var response = await _httpClient.PostAsync("invoices", content);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<InvoiceSubmissionResponse>();

        Console.WriteLine($"Task ID: {result.Data.TaskId}");
        Console.WriteLine($"Status: {result.Data.Status}");

        return result;
    }
}

// Usage
var client = new InvoiceApiClient(Environment.GetEnvironmentVariable("INVOICE_API_KEY"));
var result = await client.SubmitInvoiceAsync(
    "./invoice.pdf",
    "123e4567-e89b-12d3-a456-426614174000"
);`,
        },
        dependencies: {
          typescript: ['axios', 'form-data'],
          python: ['requests'],
          csharp: ['System.Net.Http.Json'],
        },
      },
      {
        endpoint: '/invoices/{taskId}',
        method: 'GET',
        title: 'Get Extraction Result',
        description: 'Retrieve the extraction results for a processed invoice',
        code: {
          typescript: `import axios from 'axios';

const API_KEY = process.env.INVOICE_API_KEY!;

async function getInvoiceResult(taskId: string) {
  const response = await axios.get(
    \`https://api.example.com/api/v1/invoices/\${taskId}\`,
    {
      headers: {
        'Authorization': \`Bearer \${API_KEY}\`,
      },
    }
  );

  const { data } = response.data;

  console.log('Invoice Number:', data.result.invoiceNumber);
  console.log('Vendor:', data.result.vendorName);
  console.log('Total:', data.result.currency, data.result.totalAmount);
  console.log('Confidence:', data.result.confidence + '%');

  return data;
}

// Usage
getInvoiceResult('550e8400-e29b-41d4-a716-446655440000')
  .then(result => console.log('Result:', result))
  .catch(err => console.error('Error:', err.response?.data || err.message));`,
          python: `import requests
import os

API_KEY = os.getenv("INVOICE_API_KEY")
BASE_URL = "https://api.example.com/api/v1"

def get_invoice_result(task_id: str):
    """Retrieve extraction results for a processed invoice."""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
    }

    response = requests.get(
        f"{BASE_URL}/invoices/{task_id}",
        headers=headers
    )

    response.raise_for_status()
    data = response.json()["data"]

    result = data["result"]
    print(f"Invoice Number: {result['invoiceNumber']}")
    print(f"Vendor: {result['vendorName']}")
    print(f"Total: {result['currency']} {result['totalAmount']}")
    print(f"Confidence: {result['confidence']}%")

    return data

# Usage
if __name__ == "__main__":
    result = get_invoice_result("550e8400-e29b-41d4-a716-446655440000")
    print(f"Result: {result}")`,
          csharp: `public async Task<InvoiceResultResponse> GetInvoiceResultAsync(string taskId)
{
    var response = await _httpClient.GetAsync($"invoices/{taskId}");
    response.EnsureSuccessStatusCode();

    var result = await response.Content.ReadFromJsonAsync<InvoiceResultResponse>();
    var extraction = result.Data.Result;

    Console.WriteLine($"Invoice Number: {extraction.InvoiceNumber}");
    Console.WriteLine($"Vendor: {extraction.VendorName}");
    Console.WriteLine($"Total: {extraction.Currency} {extraction.TotalAmount}");
    Console.WriteLine($"Confidence: {extraction.Confidence}%");

    return result;
}

// Usage
var result = await client.GetInvoiceResultAsync("550e8400-e29b-41d4-a716-446655440000");`,
        },
      },
    ],
  },
  {
    id: 'tasks',
    name: 'Task Management',
    description: 'Check task status and progress',
    examples: [
      {
        endpoint: '/tasks/{taskId}/status',
        method: 'GET',
        title: 'Check Task Status',
        description: 'Poll for task processing status and progress',
        code: {
          typescript: `import axios from 'axios';

const API_KEY = process.env.INVOICE_API_KEY!;

async function checkTaskStatus(taskId: string) {
  const response = await axios.get(
    \`https://api.example.com/api/v1/tasks/\${taskId}/status\`,
    {
      headers: {
        'Authorization': \`Bearer \${API_KEY}\`,
      },
    }
  );

  const { data } = response.data;

  console.log('Status:', data.status);
  console.log('Progress:', data.progress + '%');
  console.log('Current Step:', data.currentStep);

  return data;
}

// Polling example
async function waitForCompletion(taskId: string, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await checkTaskStatus(taskId);

    if (status.status === 'COMPLETED') {
      console.log('Task completed!');
      return status;
    }

    if (status.status === 'FAILED') {
      throw new Error(\`Task failed: \${status.error?.message}\`);
    }

    // Wait 2 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Timeout waiting for task completion');
}`,
          python: `import requests
import os
import time

API_KEY = os.getenv("INVOICE_API_KEY")
BASE_URL = "https://api.example.com/api/v1"

def check_task_status(task_id: str):
    """Check the processing status of a task."""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
    }

    response = requests.get(
        f"{BASE_URL}/tasks/{task_id}/status",
        headers=headers
    )

    response.raise_for_status()
    data = response.json()["data"]

    print(f"Status: {data['status']}")
    print(f"Progress: {data.get('progress', 0)}%")
    print(f"Current Step: {data.get('currentStep', 'N/A')}")

    return data

def wait_for_completion(task_id: str, max_attempts: int = 30):
    """Poll until task completes or fails."""
    for _ in range(max_attempts):
        status = check_task_status(task_id)

        if status["status"] == "COMPLETED":
            print("Task completed!")
            return status

        if status["status"] == "FAILED":
            raise Exception(f"Task failed: {status.get('error', {}).get('message')}")

        time.sleep(2)

    raise Exception("Timeout waiting for task completion")`,
          csharp: `public async Task<TaskStatusResponse> CheckTaskStatusAsync(string taskId)
{
    var response = await _httpClient.GetAsync($"tasks/{taskId}/status");
    response.EnsureSuccessStatusCode();

    var result = await response.Content.ReadFromJsonAsync<TaskStatusResponse>();

    Console.WriteLine($"Status: {result.Data.Status}");
    Console.WriteLine($"Progress: {result.Data.Progress}%");
    Console.WriteLine($"Current Step: {result.Data.CurrentStep}");

    return result;
}

public async Task<TaskStatusResponse> WaitForCompletionAsync(
    string taskId,
    int maxAttempts = 30)
{
    for (int i = 0; i < maxAttempts; i++)
    {
        var status = await CheckTaskStatusAsync(taskId);

        if (status.Data.Status == "COMPLETED")
        {
            Console.WriteLine("Task completed!");
            return status;
        }

        if (status.Data.Status == "FAILED")
        {
            throw new Exception($"Task failed: {status.Data.Error?.Message}");
        }

        await Task.Delay(2000);
    }

    throw new TimeoutException("Timeout waiting for task completion");
}`,
        },
      },
    ],
  },
  {
    id: 'webhooks',
    name: 'Webhooks',
    description: 'Configure and manage webhook notifications',
    examples: [
      {
        endpoint: '/webhooks',
        method: 'POST',
        title: 'Register Webhook',
        description: 'Register a new webhook to receive task notifications',
        code: {
          typescript: `import axios from 'axios';

const API_KEY = process.env.INVOICE_API_KEY!;

async function registerWebhook(url: string, events: string[]) {
  const response = await axios.post(
    'https://api.example.com/api/v1/webhooks',
    {
      url,
      events,
      active: true,
    },
    {
      headers: {
        'Authorization': \`Bearer \${API_KEY}\`,
        'Content-Type': 'application/json',
      },
    }
  );

  const { data } = response.data;

  console.log('Webhook ID:', data.id);
  console.log('Secret:', data.secret); // Save this securely!

  return data;
}

// Usage
registerWebhook(
  'https://your-server.com/webhooks/invoice',
  ['task.completed', 'task.failed']
)
  .then(webhook => console.log('Registered:', webhook))
  .catch(err => console.error('Error:', err.response?.data || err.message));`,
          python: `import requests
import os

API_KEY = os.getenv("INVOICE_API_KEY")
BASE_URL = "https://api.example.com/api/v1"

def register_webhook(url: str, events: list[str]):
    """Register a new webhook endpoint."""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }

    response = requests.post(
        f"{BASE_URL}/webhooks",
        headers=headers,
        json={
            "url": url,
            "events": events,
            "active": True,
        }
    )

    response.raise_for_status()
    data = response.json()["data"]

    print(f"Webhook ID: {data['id']}")
    print(f"Secret: {data['secret']}")  # Save this securely!

    return data

# Usage
if __name__ == "__main__":
    webhook = register_webhook(
        "https://your-server.com/webhooks/invoice",
        ["task.completed", "task.failed"]
    )
    print(f"Registered: {webhook}")`,
          csharp: `public async Task<WebhookRegistrationResponse> RegisterWebhookAsync(
    string url,
    string[] events)
{
    var request = new
    {
        url = url,
        events = events,
        active = true
    };

    var response = await _httpClient.PostAsJsonAsync("webhooks", request);
    response.EnsureSuccessStatusCode();

    var result = await response.Content.ReadFromJsonAsync<WebhookRegistrationResponse>();

    Console.WriteLine($"Webhook ID: {result.Data.Id}");
    Console.WriteLine($"Secret: {result.Data.Secret}"); // Save this securely!

    return result;
}

// Usage
var webhook = await client.RegisterWebhookAsync(
    "https://your-server.com/webhooks/invoice",
    new[] { "task.completed", "task.failed" }
);`,
        },
      },
      {
        endpoint: 'webhook-verification',
        method: 'POST',
        title: 'Verify Webhook Signature',
        description: 'Verify incoming webhook payloads using HMAC-SHA256',
        code: {
          typescript: `import crypto from 'crypto';
import express from 'express';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!;

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(\`sha256=\${expectedSignature}\`)
  );
}

// Express middleware example
const app = express();

app.post('/webhooks/invoice', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-webhook-signature'] as string;
  const payload = req.body.toString();

  if (!verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(payload);

  console.log('Received event:', event.event);
  console.log('Task ID:', event.data.taskId);

  // Process the webhook event...

  res.status(200).json({ received: true });
});`,
          python: `import hmac
import hashlib
from flask import Flask, request, jsonify

WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET")

app = Flask(__name__)

def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify HMAC-SHA256 webhook signature."""
    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(f"sha256={expected}", signature)

@app.route("/webhooks/invoice", methods=["POST"])
def handle_webhook():
    signature = request.headers.get("X-Webhook-Signature", "")
    payload = request.get_data()

    if not verify_webhook_signature(payload, signature, WEBHOOK_SECRET):
        return jsonify({"error": "Invalid signature"}), 401

    event = request.get_json()

    print(f"Received event: {event['event']}")
    print(f"Task ID: {event['data']['taskId']}")

    # Process the webhook event...

    return jsonify({"received": True}), 200

if __name__ == "__main__":
    app.run(port=3000)`,
          csharp: `using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("webhooks")]
public class WebhookController : ControllerBase
{
    private readonly string _webhookSecret;

    public WebhookController(IConfiguration config)
    {
        _webhookSecret = config["WebhookSecret"];
    }

    [HttpPost("invoice")]
    public async Task<IActionResult> HandleWebhook()
    {
        using var reader = new StreamReader(Request.Body);
        var payload = await reader.ReadToEndAsync();

        var signature = Request.Headers["X-Webhook-Signature"].FirstOrDefault();

        if (!VerifySignature(payload, signature, _webhookSecret))
        {
            return Unauthorized(new { error = "Invalid signature" });
        }

        var webhookEvent = JsonSerializer.Deserialize<WebhookEvent>(payload);

        Console.WriteLine($"Received event: {webhookEvent.Event}");
        Console.WriteLine($"Task ID: {webhookEvent.Data.TaskId}");

        // Process the webhook event...

        return Ok(new { received = true });
    }

    private static bool VerifySignature(string payload, string signature, string secret)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
        var expected = $"sha256={Convert.ToHexString(hash).ToLower()}";

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expected),
            Encoding.UTF8.GetBytes(signature ?? "")
        );
    }
}`,
        },
        notes: 'Always verify webhook signatures before processing events to prevent spoofing attacks.',
      },
    ],
  },
  {
    id: 'error-handling',
    name: 'Error Handling',
    description: 'Handle API errors and implement retry logic',
    examples: [
      {
        endpoint: 'error-handling',
        method: 'GET',
        title: 'Error Handling Pattern',
        description: 'Properly handle API errors with retry logic',
        code: {
          typescript: `import axios, { AxiosError } from 'axios';

interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string;
  errors?: Record<string, string[]>;
}

async function apiRequest<T>(
  requestFn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error as Error;

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        const status = axiosError.response?.status;

        // Don't retry client errors (except rate limit)
        if (status && status >= 400 && status < 500 && status !== 429) {
          throw error;
        }

        // Handle rate limiting
        if (status === 429) {
          const retryAfter = axiosError.response?.headers['retry-after'];
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : baseDelay * (attempt + 1);
          console.log(\`Rate limited. Retrying after \${delay}ms...\`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      // Exponential backoff for server errors
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(\`Request failed. Retrying in \${delay}ms... (attempt \${attempt + 1})\`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Usage
try {
  const result = await apiRequest(() =>
    axios.get('https://api.example.com/api/v1/invoices/123')
  );
  console.log('Success:', result.data);
} catch (error) {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data as ApiError;
    console.error('API Error:', apiError.title, '-', apiError.detail);
  }
}`,
          python: `import requests
import time
from typing import TypeVar, Callable

T = TypeVar('T')

def api_request(
    request_fn: Callable[[], requests.Response],
    max_retries: int = 3,
    base_delay: float = 1.0
) -> requests.Response:
    """Execute API request with retry logic."""
    last_error = None

    for attempt in range(max_retries):
        try:
            response = request_fn()
            response.raise_for_status()
            return response
        except requests.exceptions.HTTPError as e:
            last_error = e
            status = e.response.status_code

            # Don't retry client errors (except rate limit)
            if 400 <= status < 500 and status != 429:
                raise

            # Handle rate limiting
            if status == 429:
                retry_after = e.response.headers.get('Retry-After', base_delay * (attempt + 1))
                delay = float(retry_after)
                print(f"Rate limited. Retrying after {delay}s...")
                time.sleep(delay)
                continue
        except requests.exceptions.RequestException as e:
            last_error = e

        # Exponential backoff for other errors
        delay = base_delay * (2 ** attempt)
        print(f"Request failed. Retrying in {delay}s... (attempt {attempt + 1})")
        time.sleep(delay)

    raise last_error

# Usage
try:
    response = api_request(
        lambda: requests.get(
            "https://api.example.com/api/v1/invoices/123",
            headers={"Authorization": f"Bearer {API_KEY}"}
        )
    )
    print("Success:", response.json())
except requests.exceptions.HTTPError as e:
    error = e.response.json()
    print(f"API Error: {error['title']} - {error['detail']}")`,
          csharp: `public class ApiClient
{
    private readonly HttpClient _httpClient;
    private readonly int _maxRetries;

    public ApiClient(HttpClient httpClient, int maxRetries = 3)
    {
        _httpClient = httpClient;
        _maxRetries = maxRetries;
    }

    public async Task<T> ExecuteWithRetryAsync<T>(
        Func<Task<HttpResponseMessage>> requestFn,
        int baseDelayMs = 1000)
    {
        Exception lastException = null;

        for (int attempt = 0; attempt < _maxRetries; attempt++)
        {
            try
            {
                var response = await requestFn();

                if (response.IsSuccessStatusCode)
                {
                    return await response.Content.ReadFromJsonAsync<T>();
                }

                var status = (int)response.StatusCode;

                // Don't retry client errors (except rate limit)
                if (status >= 400 && status < 500 && status != 429)
                {
                    var error = await response.Content.ReadFromJsonAsync<ApiError>();
                    throw new ApiException(error);
                }

                // Handle rate limiting
                if (status == 429)
                {
                    var retryAfter = response.Headers.RetryAfter?.Delta;
                    var delay = retryAfter ?? TimeSpan.FromMilliseconds(baseDelayMs * (attempt + 1));
                    Console.WriteLine($"Rate limited. Retrying after {delay}...");
                    await Task.Delay(delay);
                    continue;
                }
            }
            catch (HttpRequestException e)
            {
                lastException = e;
            }

            // Exponential backoff
            var backoffDelay = baseDelayMs * Math.Pow(2, attempt);
            Console.WriteLine($"Request failed. Retrying in {backoffDelay}ms... (attempt {attempt + 1})");
            await Task.Delay((int)backoffDelay);
        }

        throw lastException ?? new Exception("Max retries exceeded");
    }
}`,
        },
        notes: 'Implement proper error handling with exponential backoff for production applications.',
      },
    ],
  },
];

// ============================================================
// Quick Start Guide
// ============================================================

/**
 * Quick start guide sections
 */
const QUICK_START_GUIDE: QuickStartSection[] = [
  {
    id: 'authentication',
    title: 'Authentication',
    description: 'Set up API authentication',
    steps: [
      {
        stepNumber: 1,
        title: 'Get Your API Key',
        description: 'Obtain your API key from the developer portal.',
        note: 'Keep your API key secure and never expose it in client-side code.',
      },
      {
        stepNumber: 2,
        title: 'Set Up Headers',
        description: 'Include the API key in the Authorization header for all requests.',
        code: {
          typescript: `const headers = {
  'Authorization': \`Bearer \${API_KEY}\`,
  'Content-Type': 'application/json',
};`,
          python: `headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}`,
          csharp: `httpClient.DefaultRequestHeaders.Authorization =
    new AuthenticationHeaderValue("Bearer", apiKey);`,
        },
      },
    ],
  },
  {
    id: 'first-request',
    title: 'Make Your First Request',
    description: 'Submit your first invoice for processing',
    steps: [
      {
        stepNumber: 1,
        title: 'Prepare Your Invoice',
        description: 'Ensure your invoice is in PDF, JPEG, or PNG format (max 10MB).',
      },
      {
        stepNumber: 2,
        title: 'Submit the Invoice',
        description: 'Upload the invoice to the /invoices endpoint.',
        code: {
          typescript: `const form = new FormData();
form.append('file', fs.createReadStream('./invoice.pdf'));
form.append('forwarderId', 'your-forwarder-id');

const response = await axios.post('/invoices', form, { headers });
const taskId = response.data.data.taskId;`,
          python: `with open("invoice.pdf", "rb") as f:
    response = requests.post(
        f"{BASE_URL}/invoices",
        headers=headers,
        files={"file": f},
        data={"forwarderId": "your-forwarder-id"}
    )
task_id = response.json()["data"]["taskId"]`,
          csharp: `var content = new MultipartFormDataContent();
content.Add(new ByteArrayContent(File.ReadAllBytes("invoice.pdf")), "file", "invoice.pdf");
content.Add(new StringContent("your-forwarder-id"), "forwarderId");

var response = await httpClient.PostAsync("invoices", content);
var taskId = result.Data.TaskId;`,
        },
      },
      {
        stepNumber: 3,
        title: 'Poll for Results',
        description: 'Check the task status until processing is complete.',
        code: {
          typescript: `// Poll every 2 seconds until completed
let status = await axios.get(\`/tasks/\${taskId}/status\`);
while (status.data.data.status !== 'COMPLETED') {
  await new Promise(r => setTimeout(r, 2000));
  status = await axios.get(\`/tasks/\${taskId}/status\`);
}`,
          python: `# Poll every 2 seconds until completed
while True:
    status = requests.get(f"{BASE_URL}/tasks/{task_id}/status").json()
    if status["data"]["status"] == "COMPLETED":
        break
    time.sleep(2)`,
          csharp: `// Poll every 2 seconds until completed
while (true) {
    var status = await httpClient.GetFromJsonAsync<TaskStatusResponse>($"tasks/{taskId}/status");
    if (status.Data.Status == "COMPLETED") break;
    await Task.Delay(2000);
}`,
        },
      },
      {
        stepNumber: 4,
        title: 'Get the Results',
        description: 'Retrieve the extraction results.',
        code: {
          typescript: `const result = await axios.get(\`/invoices/\${taskId}\`);
console.log('Invoice Number:', result.data.data.result.invoiceNumber);
console.log('Total Amount:', result.data.data.result.totalAmount);`,
          python: `result = requests.get(f"{BASE_URL}/invoices/{task_id}").json()
print(f"Invoice Number: {result['data']['result']['invoiceNumber']}")
print(f"Total Amount: {result['data']['result']['totalAmount']}")`,
          csharp: `var result = await httpClient.GetFromJsonAsync<InvoiceResultResponse>($"invoices/{taskId}");
Console.WriteLine($"Invoice Number: {result.Data.Result.InvoiceNumber}");
Console.WriteLine($"Total Amount: {result.Data.Result.TotalAmount}");`,
        },
      },
    ],
  },
];

// ============================================================
// Service Class
// ============================================================

/**
 * Example Generator Service
 * Provides SDK code examples for multiple languages
 */
class ExampleGeneratorService {
  /**
   * Get all SDK examples organized by category
   */
  getAllExamples(): SDKExamplesCollection {
    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString().split('T')[0],
      categories: SDK_EXAMPLES,
    };
  }

  /**
   * Get examples for a specific category
   */
  getExamplesByCategory(categoryId: string): SDKExampleCategory | null {
    return SDK_EXAMPLES.find(cat => cat.id === categoryId) ?? null;
  }

  /**
   * Get a specific example by endpoint and method
   */
  getExampleByEndpoint(endpoint: string, method: string): SDKExample | null {
    for (const category of SDK_EXAMPLES) {
      const example = category.examples.find(
        ex => ex.endpoint === endpoint && ex.method === method
      );
      if (example) return example;
    }
    return null;
  }

  /**
   * Get code for a specific language and example
   */
  getCodeForLanguage(example: SDKExample, language: SDKLanguage): string {
    return example.code[language] ?? '';
  }

  /**
   * Get installation instructions
   */
  getInstallationInstructions(): SDKInstallation[] {
    return INSTALLATION_INSTRUCTIONS;
  }

  /**
   * Get installation for specific language
   */
  getInstallationForLanguage(language: SDKLanguage): SDKInstallation | null {
    return INSTALLATION_INSTRUCTIONS.find(i => i.language === language) ?? null;
  }

  /**
   * Get quick start guide
   */
  getQuickStartGuide(): QuickStartSection[] {
    return QUICK_START_GUIDE;
  }

  /**
   * Get all available categories
   */
  getCategories(): Array<{ id: string; name: string; description: string }> {
    return SDK_EXAMPLES.map(cat => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
    }));
  }
}

// ============================================================
// Singleton Instance
// ============================================================

/**
 * Singleton instance of Example Generator Service
 */
export const exampleGeneratorService = new ExampleGeneratorService();

/**
 * Export class for testing
 */
export { ExampleGeneratorService };
