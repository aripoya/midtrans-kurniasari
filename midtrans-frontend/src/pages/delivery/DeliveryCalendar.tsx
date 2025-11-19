import React, { useState, useEffect } from 'react';
import {
    Box,
    Container,
    Heading,
    HStack,
    VStack,
    Text,
    Button,
    Grid,
    GridItem,
    Badge,
    IconButton,
    Select,
    useToast,
    Spinner,
    Center,
} from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { adminApi } from '../../api/adminApi';
import { useNavigate } from 'react-router-dom';

interface DeliverySchedule {
    orderId: string;
    customerName: string;
    customerAddress: string;
    deliveryDate: string;
    deliveryTime: string;
    courierName: string;
    courierId: string;
    status: string;
}

const DeliveryCalendar: React.FC = () => {
    const [schedules, setSchedules] = useState<DeliverySchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedWeek, setSelectedWeek] = useState(new Date());
    const [selectedCourier, setSelectedCourier] = useState<string>('all');
    const [couriers, setCouriers] = useState<{ id: string; name: string }[]>([]);
    const toast = useToast();
    const navigate = useNavigate();

    // Time slots from 09:00 to 19:00
    const timeSlots = [
        '09:00', '10:00', '11:00', '12:00', '13:00',
        '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'
    ];

    // Get week days starting from Monday
    const getWeekDays = (date: Date) => {
        const week = [];
        const current = new Date(date);
        const day = current.getDay();
        const diff = current.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
        current.setDate(diff);

        for (let i = 0; i < 7; i++) {
            week.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        return week;
    };

    const weekDays = getWeekDays(selectedWeek);

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    const formatDayName = (date: Date) => {
        return date.toLocaleDateString('id-ID', { weekday: 'long' });
    };

    const fetchDeliverySchedules = async () => {
        try {
            setLoading(true);
            const response = await adminApi.getDeliveryOrders();

            if (response.success && response.data) {
                const orders = Array.isArray(response.data) ? response.data : response.data.orders || [];

                // Extract schedules from orders
                const deliverySchedules: DeliverySchedule[] = orders
                    .filter((order: any) => order.delivery_date && order.delivery_time)
                    .map((order: any) => ({
                        orderId: order.id,
                        customerName: order.customer_name,
                        customerAddress: order.customer_address || order.lokasi_pengiriman || '',
                        deliveryDate: order.delivery_date,
                        deliveryTime: order.delivery_time,
                        courierName: order.assigned_deliveryman_name || order.courier_service || 'Tidak Ditentukan',
                        courierId: order.assigned_deliveryman_id || '',
                        status: order.shipping_status || 'pending',
                    }));

                setSchedules(deliverySchedules);

                // Extract unique couriers
                const uniqueCouriers = Array.from(
                    new Set(deliverySchedules.map(s => JSON.stringify({ id: s.courierId, name: s.courierName })))
                ).map(s => JSON.parse(s));

                setCouriers(uniqueCouriers);
            }
        } catch (error) {
            console.error('Error fetching delivery schedules:', error);
            toast({
                title: 'Gagal memuat jadwal',
                description: 'Terjadi kesalahan saat mengambil data jadwal pengiriman',
                status: 'error',
                duration: 3000,
                isClosable: true,
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDeliverySchedules();
    }, []);

    const getSchedulesForDateTime = (date: Date, time: string) => {
        const dateStr = date.toISOString().split('T')[0];
        return schedules.filter(schedule => {
            const scheduleDate = new Date(schedule.deliveryDate).toISOString().split('T')[0];
            const scheduleTime = schedule.deliveryTime.substring(0, 5); // Get HH:MM

            const matchesDate = scheduleDate === dateStr;
            const matchesTime = scheduleTime === time;
            const matchesCourier = selectedCourier === 'all' || schedule.courierId === selectedCourier;

            return matchesDate && matchesTime && matchesCourier;
        });
    };

    const goToPreviousWeek = () => {
        const newDate = new Date(selectedWeek);
        newDate.setDate(newDate.getDate() - 7);
        setSelectedWeek(newDate);
    };

    const goToNextWeek = () => {
        const newDate = new Date(selectedWeek);
        newDate.setDate(newDate.getDate() + 7);
        setSelectedWeek(newDate);
    };

    const goToToday = () => {
        setSelectedWeek(new Date());
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'diterima':
            case 'delivered':
                return 'green';
            case 'dalam pengiriman':
            case 'sedang dikirim':
                return 'blue';
            case 'siap kirim':
                return 'orange';
            default:
                return 'gray';
        }
    };

    if (loading) {
        return (
            <Container maxW="container.xl" py={8}>
                <Center h="400px">
                    <Spinner size="xl" thickness="4px" speed="0.65s" color="teal.500" />
                </Center>
            </Container>
        );
    }

    return (
        <Container maxW="container.xl" py={8}>
            {/* Header */}
            <VStack spacing={4} align="stretch" mb={6}>
                <Heading size="lg">📅 Kalender Jadwal Pengiriman</Heading>

                {/* Controls */}
                <HStack justify="space-between">
                    <HStack spacing={2}>
                        <IconButton
                            aria-label="Previous week"
                            icon={<ChevronLeftIcon />}
                            onClick={goToPreviousWeek}
                            size="sm"
                        />
                        <Button onClick={goToToday} size="sm" colorScheme="teal">
                            Hari Ini
                        </Button>
                        <IconButton
                            aria-label="Next week"
                            icon={<ChevronRightIcon />}
                            onClick={goToNextWeek}
                            size="sm"
                        />
                        <Text fontWeight="bold" fontSize="lg" ml={4}>
                            {formatDate(weekDays[0])} - {formatDate(weekDays[6])}
                        </Text>
                    </HStack>

                    <HStack>
                        <Select
                            value={selectedCourier}
                            onChange={(e) => setSelectedCourier(e.target.value)}
                            size="sm"
                            w="200px"
                        >
                            <option value="all">Semua Kurir</option>
                            {couriers.map((courier) => (
                                <option key={courier.id} value={courier.id}>
                                    {courier.name}
                                </option>
                            ))}
                        </Select>
                        <Button
                            size="sm"
                            colorScheme="gray"
                            onClick={() => navigate('/delivery/dashboard')}
                        >
                            Kembali
                        </Button>
                    </HStack>
                </HStack>
            </VStack>

            {/* Calendar Grid */}
            <Box
                overflowX="auto"
                border="1px"
                borderColor="gray.200"
                borderRadius="md"
                bg="white"
            >
                <Grid
                    templateColumns={`80px repeat(7, 1fr)`}
                    minW="900px"
                    bg="gray.50"
                >
                    {/* Header Row - Days */}
                    <GridItem bg="white" borderRight="1px" borderColor="gray.200" p={2}>
                        <Text fontSize="xs" color="gray.500">Waktu</Text>
                    </GridItem>
                    {weekDays.map((day, idx) => (
                        <GridItem
                            key={idx}
                            borderRight={idx < 6 ? '1px' : 'none'}
                            borderColor="gray.200"
                            p={2}
                            bg={day.toDateString() === new Date().toDateString() ? 'teal.50' : 'white'}
                        >
                            <VStack spacing={0} align="center">
                                <Text fontSize="xs" color="gray.600" fontWeight="semibold">
                                    {formatDayName(day)}
                                </Text>
                                <Text
                                    fontSize="lg"
                                    fontWeight="bold"
                                    color={day.toDateString() === new Date().toDateString() ? 'teal.600' : 'gray.800'}
                                >
                                    {day.getDate()}
                                </Text>
                                <Text fontSize="xs" color="gray.500">
                                    {day.toLocaleDateString('id-ID', { month: 'short' })}
                                </Text>
                            </VStack>
                        </GridItem>
                    ))}

                    {/* Time Slots */}
                    {timeSlots.map((time) => (
                        <React.Fragment key={time}>
                            {/* Time Label */}
                            <GridItem
                                borderRight="1px"
                                borderTop="1px"
                                borderColor="gray.200"
                                p={2}
                                bg="gray.50"
                            >
                                <Text fontSize="sm" fontWeight="medium" color="gray.700">
                                    {time}
                                </Text>
                            </GridItem>

                            {/* Day Cells */}
                            {weekDays.map((day, dayIdx) => {
                                const daySchedules = getSchedulesForDateTime(day, time);
                                return (
                                    <GridItem
                                        key={`${time}-${dayIdx}`}
                                        borderRight={dayIdx < 6 ? '1px' : 'none'}
                                        borderTop="1px"
                                        borderColor="gray.200"
                                        p={1}
                                        minH="80px"
                                        bg={day.toDateString() === new Date().toDateString() ? 'teal.50' : 'white'}
                                        _hover={{ bg: 'gray.50' }}
                                    >
                                        <VStack spacing={1} align="stretch">
                                            {daySchedules.map((schedule) => (
                                                <Box
                                                    key={schedule.orderId}
                                                    p={2}
                                                    bg="blue.100"
                                                    borderLeft="3px"
                                                    borderColor={`${getStatusColor(schedule.status)}.500`}
                                                    borderRadius="md"
                                                    fontSize="xs"
                                                    cursor="pointer"
                                                    onClick={() => navigate(`/delivery/orders/${schedule.orderId}`)}
                                                    _hover={{ bg: 'blue.200', transform: 'scale(1.02)' }}
                                                    transition="all 0.2s"
                                                >
                                                    <Text fontWeight="bold" noOfLines={1}>
                                                        {schedule.customerName}
                                                    </Text>
                                                    <Text color="gray.700" noOfLines={1}>
                                                        📍 {schedule.customerAddress}
                                                    </Text>
                                                    <HStack justify="space-between" mt={1}>
                                                        <Badge colorScheme={getStatusColor(schedule.status)} fontSize="2xs">
                                                            {schedule.status}
                                                        </Badge>
                                                        <Text fontSize="2xs" color="gray.600">
                                                            {schedule.courierName}
                                                        </Text>
                                                    </HStack>
                                                </Box>
                                            ))}
                                        </VStack>
                                    </GridItem>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </Grid>
            </Box>

            {/* Summary */}
            <Box mt={4} p={4} bg="gray.50" borderRadius="md">
                <HStack spacing={4}>
                    <Text fontSize="sm" color="gray.600">
                        Total Pengiriman Minggu Ini: <strong>{schedules.filter(s => {
                            const scheduleDate = new Date(s.deliveryDate);
                            return scheduleDate >= weekDays[0] && scheduleDate <= weekDays[6];
                        }).length}</strong>
                    </Text>
                    {selectedCourier !== 'all' && (
                        <Text fontSize="sm" color="gray.600">
                            Kurir: <strong>{couriers.find(c => c.id === selectedCourier)?.name}</strong>
                        </Text>
                    )}
                </HStack>
            </Box>
        </Container>
    );
};

export default DeliveryCalendar;
