import React from 'react';
import {
  Box,
  Spinner,
  Text,
  VStack,
  HStack,
  Progress,
  Skeleton,
  SkeletonText,
  SkeletonCircle,
  Flex,
  useColorModeValue,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';

// Custom animations
const pulse = keyframes`
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
`;

const bounce = keyframes`
  0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-10px); }
  60% { transform: translateY(-5px); }
`;

const rotate = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  thickness?: string;
  speed?: string;
  label?: string;
  variant?: 'spinner' | 'dots' | 'pulse' | 'bounce';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'blue.500',
  thickness = '4px',
  speed = '0.65s',
  label,
  variant = 'spinner',
}) => {
  const renderSpinner = () => {
    switch (variant) {
      case 'dots':
        return <DotsLoader color={color} />;
      case 'pulse':
        return <PulseLoader color={color} />;
      case 'bounce':
        return <BounceLoader color={color} />;
      default:
        return (
          <Spinner
            size={size}
            color={color}
            thickness={thickness}
            speed={speed}
            emptyColor="gray.200"
          />
        );
    }
  };

  return (
    <VStack spacing={3}>
      {renderSpinner()}
      {label && (
        <Text fontSize="sm" color="gray.600" textAlign="center">
          {label}
        </Text>
      )}
    </VStack>
  );
};

const DotsLoader: React.FC<{ color: string }> = ({ color }) => (
  <HStack spacing={1}>
    {[0, 1, 2].map((i) => (
      <Box
        key={i}
        w={2}
        h={2}
        bg={color}
        borderRadius="full"
        animation={`${bounce} 1.4s ease-in-out ${i * 0.16}s infinite both`}
      />
    ))}
  </HStack>
);

const PulseLoader: React.FC<{ color: string }> = ({ color }) => (
  <Box
    w={8}
    h={8}
    bg={color}
    borderRadius="full"
    animation={`${pulse} 1.5s ease-in-out infinite`}
  />
);

const BounceLoader: React.FC<{ color: string }> = ({ color }) => (
  <Box
    w={6}
    h={6}
    bg={color}
    borderRadius="full"
    animation={`${bounce} 2s infinite`}
  />
);

interface FullPageLoadingProps {
  message?: string;
  progress?: number;
  showProgress?: boolean;
}

export const FullPageLoading: React.FC<FullPageLoadingProps> = ({
  message = 'Loading...',
  progress,
  showProgress = false,
}) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.600', 'gray.300');

  return (
    <Flex
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg={bgColor}
      zIndex={9999}
      align="center"
      justify="center"
      direction="column"
    >
      <VStack spacing={6}>
        <LoadingSpinner size="xl" label={message} />
        
        {showProgress && typeof progress === 'number' && (
          <Box w="300px">
            <Progress
              value={progress}
              colorScheme="blue"
              size="sm"
              borderRadius="md"
              hasStripe
              isAnimated
            />
            <Text fontSize="sm" color={textColor} textAlign="center" mt={2}>
              {Math.round(progress)}%
            </Text>
          </Box>
        )}
      </VStack>
    </Flex>
  );
};

interface LoadingOverlayProps {
  isLoading: boolean;
  children: React.ReactNode;
  message?: string;
  opacity?: number;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  children,
  message = 'Loading...',
  opacity = 0.8,
}) => {
  return (
    <Box position="relative">
      {children}
      {isLoading && (
        <Flex
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg={`rgba(255, 255, 255, ${opacity})`}
          zIndex={10}
          align="center"
          justify="center"
          borderRadius="inherit"
        >
          <LoadingSpinner label={message} />
        </Flex>
      )}
    </Box>
  );
};

interface SkeletonLoaderProps {
  lines?: number;
  height?: string | number;
  spacing?: number;
  isLoaded?: boolean;
  children?: React.ReactNode;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  lines = 3,
  height = '20px',
  spacing = 3,
  isLoaded = false,
  children,
}) => {
  if (isLoaded && children) {
    return <>{children}</>;
  }

  return (
    <VStack spacing={spacing} align="stretch">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} height={height} />
      ))}
    </VStack>
  );
};

interface GameBoardSkeletonProps {
  isLoaded?: boolean;
  children?: React.ReactNode;
}

export const GameBoardSkeleton: React.FC<GameBoardSkeletonProps> = ({
  isLoaded = false,
  children,
}) => {
  if (isLoaded && children) {
    return <>{children}</>;
  }

  return (
    <VStack spacing={4} p={4}>
      {/* Header skeleton */}
      <HStack spacing={4} w="100%">
        <SkeletonCircle size="12" />
        <VStack align="start" flex={1}>
          <Skeleton height="20px" w="200px" />
          <Skeleton height="16px" w="150px" />
        </VStack>
      </HStack>

      {/* Game board skeleton */}
      <Box w="100%" h="400px" position="relative">
        <Skeleton w="100%" h="100%" borderRadius="md" />
        {/* Simulate game nodes */}
        {Array.from({ length: 8 }).map((_, index) => (
          <SkeletonCircle
            key={index}
            size="8"
            position="absolute"
            top={`${Math.random() * 80 + 10}%`}
            left={`${Math.random() * 80 + 10}%`}
          />
        ))}
      </Box>

      {/* Control panel skeleton */}
      <HStack spacing={4} w="100%">
        <SkeletonCircle size="10" />
        <SkeletonCircle size="10" />
        <SkeletonCircle size="10" />
        <Skeleton height="40px" flex={1} />
      </HStack>
    </VStack>
  );
};

interface ButtonLoadingProps {
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: string;
  spinner?: React.ReactElement;
}

export const ButtonLoading: React.FC<ButtonLoadingProps> = ({
  isLoading,
  children,
  loadingText,
  spinner,
}) => {
  if (!isLoading) {
    return <>{children}</>;
  }

  return (
    <HStack spacing={2}>
      {spinner || <Spinner size="sm" />}
      {loadingText && <Text>{loadingText}</Text>}
    </HStack>
  );
};

// Hook for managing loading states
export const useLoading = (initialState = false) => {
  const [isLoading, setIsLoading] = React.useState(initialState);
  const [error, setError] = React.useState<Error | null>(null);

  const startLoading = React.useCallback(() => {
    setIsLoading(true);
    setError(null);
  }, []);

  const stopLoading = React.useCallback(() => {
    setIsLoading(false);
  }, []);

  const setLoadingError = React.useCallback((error: Error) => {
    setError(error);
    setIsLoading(false);
  }, []);

  const withLoading = React.useCallback(
    async <T>(asyncFn: () => Promise<T>): Promise<T> => {
      startLoading();
      try {
        const result = await asyncFn();
        stopLoading();
        return result;
      } catch (err) {
        setLoadingError(err as Error);
        throw err;
      }
    },
    [startLoading, stopLoading, setLoadingError]
  );

  return {
    isLoading,
    error,
    startLoading,
    stopLoading,
    setLoadingError,
    withLoading,
  };
};
