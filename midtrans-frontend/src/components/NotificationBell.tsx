import React, { useState, useRef } from 'react';
import {
  Box,
  IconButton,
  Badge,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverFooter,
  VStack,
  Text,
  HStack,
  Button,
  Divider,
  useColorModeValue,
  Spinner,
  Center,
  Flex,
  useToast
} from '@chakra-ui/react';
import { BellIcon } from '@chakra-ui/icons';
import { useNotifications } from '../contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

// TypeScript interfaces
interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'order_status_update' | 'assignment' | string;
  is_read: number;
  created_at: string;
}

const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  const toast = useToast();
  
  const handleMarkAllAsRead = async (): Promise<void> => {
    try {
      await markAllAsRead();
      toast({
        title: 'Success',
        description: 'All notifications marked as read',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to mark notifications as read',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };
  
  const handleMarkAsRead = async (id: string): Promise<void> => {
    try {
      await markAsRead(id);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to mark notification as read',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };
  
  const getNotificationTypeColor = (type: string): string => {
    switch (type) {
      case 'order_status_update':
        return 'blue.500';
      case 'assignment':
        return 'green.500';
      default:
        return 'gray.500';
    }
  };
  
  const formatTime = (dateString: string): string => {
    try {
      return formatDistanceToNow(new Date(dateString), { 
        addSuffix: true,
        locale: id
      });
    } catch (error) {
      return 'Unknown time';
    }
  };

  const bgColor = useColorModeValue('white', 'gray.700');
  const hoverBgColor = useColorModeValue('gray.50', 'gray.600');
  
  return (
    <Box>
      <Popover
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        initialFocusRef={initialFocusRef}
        placement="bottom-end"
      >
        <PopoverTrigger>
          <IconButton
            aria-label="Notifications"
            icon={
              <Badge colorScheme="red" variant="solid" borderRadius="full" position="absolute" top="-2px" right="-2px" fontSize="xs">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            }
            variant="ghost"
            onClick={() => setIsOpen(!isOpen)}
            _hover={{ bg: 'transparent' }}
            _active={{ bg: 'transparent' }}
            isRound
          >
            <BellIcon boxSize="24px" />
          </IconButton>
        </PopoverTrigger>
        <PopoverContent width="350px" maxHeight="500px" overflowY="auto">
          <PopoverHeader fontWeight="bold" borderBottom="1px solid" borderColor="gray.200">
            <Flex justifyContent="space-between" alignItems="center">
              <Text>Notifications</Text>
              {notifications.length > 0 && (
                <Button size="xs" colorScheme="blue" variant="link" onClick={handleMarkAllAsRead}>
                  Mark all as read
                </Button>
              )}
            </Flex>
          </PopoverHeader>
          <PopoverBody p={0}>
            {loading ? (
              <Center p={4}>
                <Spinner size="md" />
              </Center>
            ) : notifications.length === 0 ? (
              <Box p={4} textAlign="center">
                <Text color="gray.500">No notifications yet</Text>
              </Box>
            ) : (
              <VStack spacing={0} align="stretch" maxH="400px" overflowY="auto">
                {notifications.map((notification: Notification) => (
                  <Box 
                    key={notification.id} 
                    p={3} 
                    bg={notification.is_read === 0 ? hoverBgColor : bgColor}
                    _hover={{ bg: hoverBgColor }}
                    borderBottom="1px solid"
                    borderColor="gray.100"
                    onClick={() => notification.is_read === 0 && handleMarkAsRead(notification.id)}
                    cursor="pointer"
                  >
                    <HStack align="start" spacing={3}>
                      <Box 
                        width="8px" 
                        height="8px" 
                        borderRadius="full" 
                        bg={notification.is_read === 0 ? getNotificationTypeColor(notification.type) : 'transparent'} 
                        mt={2}
                      />
                      <Box flex="1">
                        <Text fontWeight={notification.is_read === 0 ? "bold" : "normal"} fontSize="sm">
                          {notification.title}
                        </Text>
                        <Text fontSize="xs" color="gray.500" mt={1}>
                          {notification.message}
                        </Text>
                        <Text fontSize="xs" color="gray.400" mt={1}>
                          {formatTime(notification.created_at)}
                        </Text>
                      </Box>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            )}
          </PopoverBody>
          {notifications.length > 0 && (
            <PopoverFooter borderTop="1px solid" borderColor="gray.200" p={2}>
              <Center>
                <Button size="sm" variant="ghost">
                  View all notifications
                </Button>
              </Center>
            </PopoverFooter>
          )}
        </PopoverContent>
      </Popover>
    </Box>
  );
};

export default NotificationBell;
