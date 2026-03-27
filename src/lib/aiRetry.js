function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withAiRetry(task, options = {}) {
  const {
    retries = 5,
    baseDelayMs = 350,
    factor = 2,
    maxDelayMs = 4000,
  } = options;

  let attempt = 0;
  let lastError = null;

  while (attempt < retries) {
    try {
      return await task({ attempt: attempt + 1, retries });
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt >= retries) break;
      const delay = Math.min(baseDelayMs * factor ** (attempt - 1), maxDelayMs);
      await wait(delay);
    }
  }

  throw lastError || new Error("AI task failed after retries.");
}
