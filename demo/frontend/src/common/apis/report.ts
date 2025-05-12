type LogButtonParams =
  | {button: 'error'; extra: string}
  | {button: string; extra?: never};

type ApiResponse = {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
};

const hostMap: Record<string, string> = {
  development: 'https://app.readonup.com',
  test: 'https://app.readonup.com',
  production: 'https://readon-api.readon.me',
};

/**
 * Logs button click events to the API
 * @param params Request parameters containing button identifier
 * @param timeout Request timeout in milliseconds (default: 5000ms)
 * @returns Promise resolving to ApiResponse object
 */
export async function logButtonClick(
  params: LogButtonParams,
  timeout = 5000,
): Promise<ApiResponse> {
  const controller = new AbortController();
  const apiUrl = `${hostMap[import.meta.env.MODE]}/v1/remover/log`;
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add Authorization header if authentication is required
        // 'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Handle HTTP error responses (4xx, 5xx)
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `HTTP error! status: ${response.status}`,
        ...errorData,
      };
    }

    return {
      success: true,
      data: await response.json(),
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof DOMException && error.name === 'AbortError') {
      return {success: false, error: 'Request timeout'};
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
