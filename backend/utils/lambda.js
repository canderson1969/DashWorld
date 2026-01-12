/**
 * AWS Lambda Integration Module
 *
 * Provides utilities for invoking Lambda functions for video processing.
 *
 * @module lambda
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { logger } from './logger.js';

let lambdaClient = null;

/**
 * Get or create Lambda client
 *
 * @returns {LambdaClient} Lambda client instance
 */
function getLambdaClient() {
  if (lambdaClient) return lambdaClient;

  const region = process.env.AWS_REGION || 'us-east-1';

  lambdaClient = new LambdaClient({
    region,
    credentials: process.env.AWS_ACCESS_KEY_ID ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    } : undefined // Use default credential chain if not explicitly set
  });

  logger.info('Lambda client initialized', { region });
  return lambdaClient;
}

/**
 * Check if Lambda processing is enabled
 *
 * @returns {boolean} True if Lambda function name is configured
 */
export function isLambdaEnabled() {
  return !!process.env.LAMBDA_FUNCTION_NAME;
}

/**
 * Invoke Lambda function for video processing
 *
 * @param {Object} params - Invocation parameters
 * @param {number} params.footageId - Footage ID in database
 * @param {string} params.originalR2Key - R2 key of original video
 * @param {string} params.outputBasePath - Base path for output files (e.g., "2026/01/11/42")
 * @param {boolean} params.deleteOriginal - Whether to delete original after processing
 * @returns {Promise<Object>} Lambda response
 */
export async function invokeVideoProcessing({ footageId, originalR2Key, outputBasePath, deleteOriginal = false }) {
  if (!isLambdaEnabled()) {
    throw new Error('Lambda function not configured. Set LAMBDA_FUNCTION_NAME environment variable.');
  }

  const client = getLambdaClient();
  const functionName = process.env.LAMBDA_FUNCTION_NAME;

  const payload = {
    footageId,
    originalR2Key,
    outputBasePath,
    deleteOriginal
  };

  logger.info('Invoking Lambda for video processing', {
    functionName,
    footageId,
    originalR2Key,
    outputBasePath
  });

  try {
    const command = new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event', // Async invocation - don't wait for response
      Payload: JSON.stringify(payload)
    });

    const response = await client.send(command);

    logger.info('Lambda invoked successfully', {
      footageId,
      statusCode: response.StatusCode,
      requestId: response.$metadata?.requestId
    });

    return {
      success: true,
      statusCode: response.StatusCode,
      requestId: response.$metadata?.requestId
    };

  } catch (error) {
    logger.error('Failed to invoke Lambda', {
      footageId,
      functionName,
      error: error.message
    });
    throw error;
  }
}

/**
 * Invoke Lambda synchronously and wait for result (for testing)
 *
 * @param {Object} params - Same as invokeVideoProcessing
 * @returns {Promise<Object>} Lambda response with payload
 */
export async function invokeVideoProcessingSync({ footageId, originalR2Key, outputBasePath, deleteOriginal = false }) {
  if (!isLambdaEnabled()) {
    throw new Error('Lambda function not configured. Set LAMBDA_FUNCTION_NAME environment variable.');
  }

  const client = getLambdaClient();
  const functionName = process.env.LAMBDA_FUNCTION_NAME;

  const payload = {
    footageId,
    originalR2Key,
    outputBasePath,
    deleteOriginal
  };

  logger.info('Invoking Lambda synchronously', {
    functionName,
    footageId
  });

  const command = new InvokeCommand({
    FunctionName: functionName,
    InvocationType: 'RequestResponse', // Sync - wait for response
    Payload: JSON.stringify(payload)
  });

  const response = await client.send(command);

  const responsePayload = response.Payload
    ? JSON.parse(Buffer.from(response.Payload).toString())
    : null;

  logger.info('Lambda completed', {
    footageId,
    statusCode: response.StatusCode,
    functionError: response.FunctionError
  });

  if (response.FunctionError) {
    throw new Error(`Lambda error: ${responsePayload?.errorMessage || response.FunctionError}`);
  }

  return responsePayload;
}

export default {
  isLambdaEnabled,
  invokeVideoProcessing,
  invokeVideoProcessingSync
};
