import {
  Box,
  Flex,
  Text,
  Avatar,
  VStack,
  HStack,
  Badge,
  Divider,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  Button,
  IconButton,
  useDisclosure,
} from "@chakra-ui/react";
import { FiMenu, FiArrowRight, FiArrowLeft } from "react-icons/fi";

const GameUIWithDrawers = () => {
  const {
    isOpen: isLeftOpen,
    onOpen: onLeftOpen,
    onClose: onLeftClose,
  } = useDisclosure();
  const {
    isOpen: isRightOpen,
    onOpen: onRightOpen,
    onClose: onRightClose,
  } = useDisclosure();

  return (
    <Flex height="100vh" bg="#f7f9fc">
      {/* Left Sidebar Drawer */}
      <Drawer isOpen={isLeftOpen} placement="left" onClose={onLeftClose}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerHeader>Player Info</DrawerHeader>
          <DrawerBody>
            <VStack spacing={6} align="stretch">
              <Avatar size="xl" name="Detective 3" src="/path-to-avatar.png" />
              <VStack spacing={2}>
                <Text fontSize="lg" fontWeight="bold">
                  Detective 3
                </Text>
                <Badge colorScheme="yellow">Taxi: 10</Badge>
                <Badge colorScheme="green">Bus: 8</Badge>
                <Badge colorScheme="red">Metro: 4</Badge>
              </VStack>
              <Divider />
              <Text fontSize="sm" color="gray.500">
                Current Turn
              </Text>
              <Badge colorScheme="blue" p={2} rounded="lg">
                Your Turn
              </Badge>
            </VStack>
          </DrawerBody>
          <DrawerFooter>
            <Button onClick={onLeftClose} leftIcon={<FiArrowLeft />}>
              Close
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Left Sidebar Compact */}
      <Box
        w="50px"
        p={2}
        bg="white"
        boxShadow="xl"
        roundedRight="lg"
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="space-between"
      >
        <IconButton
          icon={<FiMenu />}
          onClick={onLeftOpen}
          aria-label="Open Player Info"
        />
        <Avatar size="sm" src="/path-to-avatar.png" />
        <Text fontSize="xs" fontWeight="bold">
          Turn
        </Text>
      </Box>

      {/* Main Content */}
      <Flex flex="1" direction="column">
        {/* Top Bar */}
        <HStack
          w="100%"
          p={4}
          bg="white"
          boxShadow="md"
          align="center"
          justify="space-between"
        >
          <HStack spacing={4}>
            <Avatar size="sm" src="/path-to-avatar-1.png" />
            <Text fontSize="lg" fontWeight="bold">
              Val
            </Text>
            <Badge colorScheme="orange">Moves: 1</Badge>
          </HStack>
          <HStack spacing={4}>
            <Text fontSize="sm" color="gray.600">
              Current Position: <strong>30</strong>
            </Text>
            <Text fontSize="sm" color="gray.600">
              Current Type: <strong>Taxi</strong>
            </Text>
          </HStack>
          <HStack spacing={2}>
            <Text fontSize="md" fontWeight="bold" color="gray.700">
              Game Status
            </Text>
          </HStack>
        </HStack>

        {/* Map Section */}
        <Box flex="1" bg="gray.200" p={4} rounded="lg" overflow="hidden">
          {/* Map Placeholder */}
          <Box
            w="100%"
            h="100%"
            bg="white"
            boxShadow="xl"
            rounded="lg"
            overflow="hidden"
          >
            {/* Replace this with your map rendering */}
            <Text align="center" mt={20} color="gray.400">
              Map will be displayed here
            </Text>
          </Box>
        </Box>
      </Flex>

      {/* Right Sidebar Drawer */}
      <Drawer isOpen={isRightOpen} placement="right" onClose={onRightClose}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerHeader>Moves History</DrawerHeader>
          <DrawerBody>
            <VStack spacing={4} overflowY="auto" align="stretch">
              <Box
                p={3}
                bg="gray.100"
                rounded="md"
                _hover={{ bg: "gray.200" }}
              >
                <Text>1. Taxi - ??</Text>
              </Box>
              <Box
                p={3}
                bg="gray.100"
                rounded="md"
                _hover={{ bg: "gray.200" }}
              >
                <Text>2. Bus - 45</Text>
              </Box>
              {/* Add more moves here */}
            </VStack>
          </DrawerBody>
          <DrawerFooter>
            <Button onClick={onRightClose} rightIcon={<FiArrowRight />}>
              Close
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Right Sidebar Compact */}
      <Box
        w="50px"
        p={2}
        bg="white"
        boxShadow="xl"
        roundedLeft="lg"
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="space-between"
      >
        <IconButton
          icon={<FiMenu />}
          onClick={onRightOpen}
          aria-label="Open Moves History"
        />
        <Text fontSize="xs" fontWeight="bold">
          Moves
        </Text>
      </Box>
    </Flex>
  );
};

export default GameUIWithDrawers;
