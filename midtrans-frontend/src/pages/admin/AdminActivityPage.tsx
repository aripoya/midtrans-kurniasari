import React, { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  VStack,
  HStack,
  Text,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Card,
  CardBody,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Select,
  Input,
  Button,
  useToast,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Divider,
  Icon,
  Tooltip,
  useColorModeValue
} from '@chakra-ui/react';
import { 
  FiUser, 
  FiLogIn, 
  FiLogOut, 
  FiShoppingCart, 
  FiEdit, 
  FiTrash2,
  FiActivity,
  FiClock,
  FiUsers
} from 'react-icons/fi';
import { adminApi } from '../../api/adminApi';
import { formatDate } from '../../utils/date';

interface AdminActivity {
  id: number;
  admin_id: string;
  admin_name: string;
  admin_email: string;
  activity_type: string;
  description: string;
  order_id?: string;
  ip_address: string;
  created_at: string;
}

interface AdminSession {
  session_id: string;
  admin_id: string;
  admin_name: string;
  admin_email: string;
  ip_address: string;
  login_at: string;
  last_activity: string;
}

interface AdminStats {
  today: {
    total_activities: number;
    logins: number;
    orders_created: number;
    orders_updated: number;
  };
  active_sessions: number;
  recent_orders: AdminActivity[];
}

const AdminActivityPage: React.FC = () => {
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    admin_id: '',
    activity_type: '',
    date_from: '',
    date_to: '',
    limit: '50'
  });

  const toast = useToast();
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [activitiesRes, sessionsRes, statsRes] = await Promise.all([
        adminApi.getAdminActivity(filters),
        adminApi.getActiveSessions(),
        adminApi.getAdminStats()
      ]);

      if (activitiesRes.success) {
        setActivities(activitiesRes.data || []);
      }

      if (sessionsRes.success) {
        setSessions(sessionsRes.data || []);
      }

      if (statsRes.success) {
        setStats(statsRes.data);
      }
    } catch (err) {
      console.error('Error loading admin activity data:', err);
      setError('Gagal memuat data aktivitas admin');
      toast({
        title: 'Error',
        description: 'Gagal memuat data aktivitas admin',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case 'login': return FiLogIn;
      case 'logout': return FiLogOut;
      case 'order_created': return FiShoppingCart;
      case 'order_updated': return FiEdit;
      case 'order_deleted': return FiTrash2;
      default: return FiActivity;
    }
  };

  const getActivityColor = (activityType: string) => {
    switch (activityType) {
      case 'login': return 'green';
      case 'logout': return 'red';
      case 'order_created': return 'blue';
      case 'order_updated': return 'orange';
      case 'order_deleted': return 'red';
      default: return 'gray';
    }
  };

  const getActivityLabel = (activityType: string) => {
    switch (activityType) {
      case 'login': return 'Login';
      case 'logout': return 'Logout';
      case 'order_created': return 'Buat Pesanan';
      case 'order_updated': return 'Update Pesanan';
      case 'order_deleted': return 'Hapus Pesanan';
      default: return activityType;
    }
  };

  const applyFilters = () => {
    loadData();
  };

  const resetFilters = () => {
    setFilters({
      admin_id: '',
      activity_type: '',
      date_from: '',
      date_to: '',
      limit: '50'
    });
  };

  if (loading) {
    return (
      <Box p={6} display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text>Memuat data aktivitas admin...</Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box p={6} maxWidth="1400px" mx="auto">
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Box>
          <Heading size="lg" mb={2} color="blue.600">
            <Icon as={FiActivity} mr={2} />
            Aktivitas Admin
          </Heading>
          <Text color="gray.600">
            Pantau aktivitas login, logout, dan pembuatan pesanan oleh semua admin
          </Text>
        </Box>

        {error && (
          <Alert status="error">
            <AlertIcon />
            <AlertTitle>Error!</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Statistics Cards */}
        {stats && (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
            <Card bg={bgColor} borderColor={borderColor}>
              <CardBody>
                <Stat>
                  <StatLabel>Total Aktivitas Hari Ini</StatLabel>
                  <StatNumber color="blue.500">{stats.today.total_activities}</StatNumber>
                  <StatHelpText>
                    <Icon as={FiActivity} mr={1} />
                    Semua aktivitas
                  </StatHelpText>
                </Stat>
              </CardBody>
            </Card>

            <Card bg={bgColor} borderColor={borderColor}>
              <CardBody>
                <Stat>
                  <StatLabel>Login Hari Ini</StatLabel>
                  <StatNumber color="green.500">{stats.today.logins}</StatNumber>
                  <StatHelpText>
                    <Icon as={FiLogIn} mr={1} />
                    Admin yang login
                  </StatHelpText>
                </Stat>
              </CardBody>
            </Card>

            <Card bg={bgColor} borderColor={borderColor}>
              <CardBody>
                <Stat>
                  <StatLabel>Pesanan Dibuat</StatLabel>
                  <StatNumber color="blue.500">{stats.today.orders_created}</StatNumber>
                  <StatHelpText>
                    <Icon as={FiShoppingCart} mr={1} />
                    Hari ini
                  </StatHelpText>
                </Stat>
              </CardBody>
            </Card>

            <Card bg={bgColor} borderColor={borderColor}>
              <CardBody>
                <Stat>
                  <StatLabel>Sesi Aktif</StatLabel>
                  <StatNumber color="orange.500">{stats.active_sessions}</StatNumber>
                  <StatHelpText>
                    <Icon as={FiUsers} mr={1} />
                    Admin online
                  </StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </SimpleGrid>
        )}

        {/* Active Sessions */}
        <Card bg={bgColor} borderColor={borderColor}>
          <CardBody>
            <Heading size="md" mb={4}>
              <Icon as={FiUsers} mr={2} />
              Admin Yang Sedang Online
            </Heading>
            {sessions.length === 0 ? (
              <Text color="gray.500">Tidak ada admin yang sedang online</Text>
            ) : (
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>Nama Admin</Th>
                    <Th>Email</Th>
                    <Th>IP Address</Th>
                    <Th>Login</Th>
                    <Th>Aktivitas Terakhir</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {sessions.map((session) => (
                    <Tr key={session.session_id}>
                      <Td>
                        <HStack>
                          <Icon as={FiUser} color="green.500" />
                          <Text fontWeight="medium">{session.admin_name}</Text>
                        </HStack>
                      </Td>
                      <Td>{session.admin_email}</Td>
                      <Td>
                        <Badge variant="outline">{session.ip_address}</Badge>
                      </Td>
                      <Td>{formatDate(session.login_at)}</Td>
                      <Td>
                        <Tooltip label={formatDate(session.last_activity)}>
                          <Badge colorScheme="green">
                            <Icon as={FiClock} mr={1} />
                            Aktif
                          </Badge>
                        </Tooltip>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </CardBody>
        </Card>

        {/* Filters */}
        <Card bg={bgColor} borderColor={borderColor}>
          <CardBody>
            <Heading size="md" mb={4}>Filter Aktivitas</Heading>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 6 }} spacing={4}>
              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2}>Tipe Aktivitas</Text>
                <Select 
                  value={filters.activity_type}
                  onChange={(e) => setFilters({...filters, activity_type: e.target.value})}
                  placeholder="Semua aktivitas"
                >
                  <option value="login">Login</option>
                  <option value="logout">Logout</option>
                  <option value="order_created">Buat Pesanan</option>
                  <option value="order_updated">Update Pesanan</option>
                  <option value="order_deleted">Hapus Pesanan</option>
                </Select>
              </Box>
              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2}>Tanggal Dari</Text>
                <Input 
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilters({...filters, date_from: e.target.value})}
                />
              </Box>
              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2}>Tanggal Sampai</Text>
                <Input 
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters({...filters, date_to: e.target.value})}
                />
              </Box>
              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2}>Limit</Text>
                <Select 
                  value={filters.limit}
                  onChange={(e) => setFilters({...filters, limit: e.target.value})}
                >
                  <option value="25">25 records</option>
                  <option value="50">50 records</option>
                  <option value="100">100 records</option>
                  <option value="200">200 records</option>
                </Select>
              </Box>
              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2}>Aksi</Text>
                <HStack>
                  <Button onClick={applyFilters} colorScheme="blue" size="sm">
                    Filter
                  </Button>
                  <Button onClick={resetFilters} variant="outline" size="sm">
                    Reset
                  </Button>
                </HStack>
              </Box>
            </SimpleGrid>
          </CardBody>
        </Card>

        {/* Activity History */}
        <Card bg={bgColor} borderColor={borderColor}>
          <CardBody>
            <Heading size="md" mb={4}>
              <Icon as={FiActivity} mr={2} />
              Riwayat Aktivitas
            </Heading>
            {activities.length === 0 ? (
              <Text color="gray.500">Tidak ada aktivitas ditemukan</Text>
            ) : (
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>Waktu</Th>
                    <Th>Admin</Th>
                    <Th>Aktivitas</Th>
                    <Th>Deskripsi</Th>
                    <Th>Order ID</Th>
                    <Th>IP Address</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {activities.map((activity) => (
                    <Tr key={activity.id}>
                      <Td>
                        <VStack align="start" spacing={0}>
                          <Text fontSize="sm" fontWeight="medium">
                            {formatDate(activity.created_at)}
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            {new Date(activity.created_at).toLocaleTimeString('id-ID')}
                          </Text>
                        </VStack>
                      </Td>
                      <Td>
                        <VStack align="start" spacing={0}>
                          <Text fontWeight="medium">{activity.admin_name}</Text>
                          <Text fontSize="xs" color="gray.500">{activity.admin_email}</Text>
                        </VStack>
                      </Td>
                      <Td>
                        <Badge 
                          colorScheme={getActivityColor(activity.activity_type)}
                          variant="subtle"
                        >
                          <Icon as={getActivityIcon(activity.activity_type)} mr={1} />
                          {getActivityLabel(activity.activity_type)}
                        </Badge>
                      </Td>
                      <Td>
                        <Text fontSize="sm">{activity.description}</Text>
                      </Td>
                      <Td>
                        {activity.order_id ? (
                          <Badge variant="outline" colorScheme="blue">
                            {activity.order_id}
                          </Badge>
                        ) : (
                          <Text color="gray.400" fontSize="sm">-</Text>
                        )}
                      </Td>
                      <Td>
                        <Badge variant="outline" fontSize="xs">
                          {activity.ip_address}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </VStack>
    </Box>
  );
};

export default AdminActivityPage;
