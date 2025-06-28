import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Text,
  VStack,
  HStack,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Code,
  Badge,
  Divider,
} from '@chakra-ui/react';

interface CORSTestResult {
  success: boolean;
  status?: number;
  data?: any;
  error?: string;
  url: string;
  timestamp: string;
}

export const CORSTest: React.FC = () => {
  const [results, setResults] = useState<CORSTestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const testEndpoints = [
    { name: 'Root', path: '/' },
    { name: 'CORS Test', path: '/cors-test' },
    { name: 'Health CORS', path: '/health-cors' },
    { name: 'Health', path: '/health' },
    { name: 'Games API', path: '/api/games/test-channel' },
  ];

  const testCORS = async (endpoint: { name: string; path: string }) => {
    const url = `${apiUrl}${endpoint.path}`;
    const timestamp = new Date().toISOString();

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      const data = await response.json();

      return {
        success: response.ok,
        status: response.status,
        data,
        url,
        timestamp,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        url,
        timestamp,
      };
    }
  };

  const runAllTests = async () => {
    setIsLoading(true);
    setResults([]);

    const testResults: CORSTestResult[] = [];

    for (const endpoint of testEndpoints) {
      const result = await testCORS(endpoint);
      testResults.push({ ...result, name: endpoint.name } as any);
      setResults([...testResults]);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsLoading(false);
  };

  const getStatusColor = (result: CORSTestResult) => {
    if (result.success) return 'green';
    if (result.status === 404) return 'yellow';
    return 'red';
  };

  const getStatusText = (result: CORSTestResult) => {
    if (result.success) return 'Success';
    if (result.status === 404) return 'Not Found (but CORS working)';
    if (result.error?.includes('CORS')) return 'CORS Error';
    if (result.error?.includes('fetch')) return 'Network Error';
    return 'Error';
  };

  useEffect(() => {
    // Auto-run tests on component mount
    runAllTests();
  }, []);

  return (
    <Box p={6} maxW="800px" mx="auto">
      <VStack spacing={6} align="stretch">
        <Box>
          <Text fontSize="2xl" fontWeight="bold" mb={2}>
            CORS Connectivity Test
          </Text>
          <Text color="gray.600">
            Testing connectivity to backend API: <Code>{apiUrl}</Code>
          </Text>
        </Box>

        <HStack>
          <Button
            onClick={runAllTests}
            isLoading={isLoading}
            loadingText="Testing..."
            colorScheme="blue"
          >
            Run Tests
          </Button>
          <Button
            onClick={() => setResults([])}
            variant="outline"
            disabled={isLoading}
          >
            Clear Results
          </Button>
        </HStack>

        <Divider />

        <VStack spacing={4} align="stretch">
          {results.map((result, index) => (
            <Alert
              key={index}
              status={result.success ? 'success' : 'error'}
              variant="left-accent"
            >
              <AlertIcon />
              <Box flex="1">
                <HStack justify="space-between" mb={2}>
                  <AlertTitle>
                    {(result as any).name || 'Test'}
                  </AlertTitle>
                  <Badge colorScheme={getStatusColor(result)}>
                    {getStatusText(result)}
                  </Badge>
                </HStack>
                
                <AlertDescription>
                  <VStack align="start" spacing={2}>
                    <Text fontSize="sm">
                      <strong>URL:</strong> {result.url}
                    </Text>
                    
                    {result.status && (
                      <Text fontSize="sm">
                        <strong>Status:</strong> {result.status}
                      </Text>
                    )}
                    
                    {result.error && (
                      <Text fontSize="sm" color="red.500">
                        <strong>Error:</strong> {result.error}
                      </Text>
                    )}
                    
                    {result.data && (
                      <Box>
                        <Text fontSize="sm" fontWeight="bold">Response:</Text>
                        <Code
                          p={2}
                          borderRadius="md"
                          display="block"
                          whiteSpace="pre-wrap"
                          fontSize="xs"
                          maxH="100px"
                          overflowY="auto"
                        >
                          {JSON.stringify(result.data, null, 2)}
                        </Code>
                      </Box>
                    )}
                    
                    <Text fontSize="xs" color="gray.500">
                      {result.timestamp}
                    </Text>
                  </VStack>
                </AlertDescription>
              </Box>
            </Alert>
          ))}
        </VStack>

        {results.length === 0 && !isLoading && (
          <Alert status="info">
            <AlertIcon />
            <AlertDescription>
              Click "Run Tests" to check CORS connectivity to the backend API.
            </AlertDescription>
          </Alert>
        )}

        <Divider />

        <Box>
          <Text fontSize="lg" fontWeight="bold" mb={2}>
            Troubleshooting Tips
          </Text>
          <VStack align="start" spacing={2}>
            <Text fontSize="sm">
              • If you see CORS errors, the backend needs to allow your domain
            </Text>
            <Text fontSize="sm">
              • Network errors might indicate the backend is not running
            </Text>
            <Text fontSize="sm">
              • 404 errors with successful requests mean CORS is working
            </Text>
            <Text fontSize="sm">
              • Check browser console for detailed error messages
            </Text>
          </VStack>
        </Box>

        <Box>
          <Text fontSize="lg" fontWeight="bold" mb={2}>
            Current Environment
          </Text>
          <VStack align="start" spacing={1}>
            <Text fontSize="sm">
              <strong>Frontend URL:</strong> {window.location.origin}
            </Text>
            <Text fontSize="sm">
              <strong>Backend URL:</strong> {apiUrl}
            </Text>
            <Text fontSize="sm">
              <strong>User Agent:</strong> {navigator.userAgent.substring(0, 100)}...
            </Text>
          </VStack>
        </Box>
      </VStack>
    </Box>
  );
};
