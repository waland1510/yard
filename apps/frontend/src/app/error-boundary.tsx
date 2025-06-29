import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Box,
  Button,
  Heading,
  Text,
  VStack,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Code,
  Collapse,
  useDisclosure,
} from '@chakra-ui/react';
import { FiRefreshCw, FiChevronDown, FiChevronUp } from 'react-icons/fi';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console and external service
    console.error('Error Boundary caught an error:', error, errorInfo);
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to external error tracking service (e.g., Sentry)
    this.logErrorToService(error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // In a real application, you would send this to an error tracking service
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: localStorage.getItem('username') || 'anonymous',
    };

    // Example: Send to error tracking service
    // errorTrackingService.captureException(error, errorData);
    
    // For now, just log to console
    console.error('Error logged:', errorData);
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return <ErrorFallback 
        error={this.state.error}
        errorInfo={this.state.errorInfo}
        errorId={this.state.errorId}
        onRetry={this.handleRetry}
        onReload={this.handleReload}
      />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  onRetry: () => void;
  onReload: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorInfo,
  errorId,
  onRetry,
  onReload,
}) => {
  const { isOpen, onToggle } = useDisclosure();
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <Box
      minHeight="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="gray.50"
      p={4}
    >
      <Box maxWidth="600px" width="100%">
        <VStack spacing={6} align="stretch">
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>Something went wrong!</AlertTitle>
              <AlertDescription>
                We're sorry, but something unexpected happened. Please try refreshing the page or contact support if the problem persists.
              </AlertDescription>
            </Box>
          </Alert>

          <VStack spacing={4}>
            <Heading size="lg" color="gray.700">
              Oops! An error occurred
            </Heading>
            
            <Text color="gray.600" textAlign="center">
              Error ID: <Code colorScheme="red">{errorId}</Code>
            </Text>

            <VStack spacing={3}>
              <Button
                leftIcon={<FiRefreshCw />}
                colorScheme="blue"
                onClick={onRetry}
                size="lg"
              >
                Try Again
              </Button>
              
              <Button
                variant="outline"
                onClick={onReload}
                size="md"
              >
                Reload Page
              </Button>
            </VStack>
          </VStack>

          {isDevelopment && error && (
            <Box>
              <Button
                leftIcon={isOpen ? <FiChevronUp /> : <FiChevronDown />}
                variant="ghost"
                size="sm"
                onClick={onToggle}
                mb={2}
              >
                {isOpen ? 'Hide' : 'Show'} Error Details
              </Button>
              
              <Collapse in={isOpen}>
                <Alert status="info" borderRadius="md">
                  <Box width="100%">
                    <AlertTitle fontSize="sm">Error Details (Development Mode)</AlertTitle>
                    <AlertDescription>
                      <VStack align="stretch" spacing={3} mt={2}>
                        <Box>
                          <Text fontSize="sm" fontWeight="bold">Message:</Text>
                          <Code p={2} borderRadius="md" display="block" whiteSpace="pre-wrap">
                            {error.message}
                          </Code>
                        </Box>
                        
                        {error.stack && (
                          <Box>
                            <Text fontSize="sm" fontWeight="bold">Stack Trace:</Text>
                            <Code 
                              p={2} 
                              borderRadius="md" 
                              display="block" 
                              whiteSpace="pre-wrap"
                              fontSize="xs"
                              maxHeight="200px"
                              overflowY="auto"
                            >
                              {error.stack}
                            </Code>
                          </Box>
                        )}
                        
                        {errorInfo?.componentStack && (
                          <Box>
                            <Text fontSize="sm" fontWeight="bold">Component Stack:</Text>
                            <Code 
                              p={2} 
                              borderRadius="md" 
                              display="block" 
                              whiteSpace="pre-wrap"
                              fontSize="xs"
                              maxHeight="200px"
                              overflowY="auto"
                            >
                              {errorInfo.componentStack}
                            </Code>
                          </Box>
                        )}
                      </VStack>
                    </AlertDescription>
                  </Box>
                </Alert>
              </Collapse>
            </Box>
          )}
        </VStack>
      </Box>
    </Box>
  );
};

export default ErrorBoundary;

// Hook for handling async errors in functional components
export const useErrorHandler = () => {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const handleError = React.useCallback((error: Error) => {
    console.error('Async error caught:', error);
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error; // This will be caught by the Error Boundary
    }
  }, [error]);

  return { handleError, resetError };
};

// Higher-order component for wrapping components with error boundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};
