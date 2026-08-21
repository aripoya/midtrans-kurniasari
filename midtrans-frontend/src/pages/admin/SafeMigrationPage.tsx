import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Flex,
  Heading,
  HStack,
  Stack,
  Text,
  Badge,
  Divider,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  useToast,
  Spacer,
  IconButton,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { RepeatIcon } from '@chakra-ui/icons';
import adminApi, { MigrateSafeDbOptions, SafeMigrationStartResult, SafeMigrationStatus } from '../../api/adminApi';
import PasswordProtected from '../../components/PasswordProtected';

const POLL_INTERVAL_MS = 60_000; // 60 seconds per business constraints

const SafeMigrationPageContent: React.FC = () => {
  const toast = useToast();
  const [status, setStatus] = useState<SafeMigrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState<boolean>(true);
  const [force, setForce] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const pollTimer = useRef<number | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await adminApi.getSafeMigrationStatus();
      if (res.success && res.data) {
        setStatus(res.data);
        setError(null);
        setLastUpdated(new Date().toLocaleTimeString());
      } else {
        setError(res.error || 'Gagal mengambil status.');
      }
    } catch (err: any) {
      console.error('[SAFE-MIGRATION] fetchStatus error:', err);
      setError(err?.message || 'Gagal mengambil status.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startMigration = useCallback(async () => {
    try {
      setIsStarting(true);
      const options: MigrateSafeDbOptions = { dryRun, force };
      const res = await adminApi.startSafeMigration(options);
      if (res.success && res.data) {
        const data = res.data as SafeMigrationStartResult;
        toast({
          title: data.message || 'Migration triggered',
          description: `dryRun=${!!options.dryRun}, force=${!!options.force}`,
          status: 'success',
          duration: 4000,
          isClosable: true,
        });
        // Refresh status right away after triggering
        fetchStatus();
      } else {
        toast({
          title: 'Gagal memulai migration',
          description: res.error || 'Unknown error',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (err: any) {
      console.error('[SAFE-MIGRATION] startMigration error:', err);
      toast({
        title: 'Gagal memulai migration',
        description: err?.message || 'Unknown error',
        status: 'error',
        duration: 6000,
        isClosable: true,
      });
    } finally {
      setIsStarting(false);
    }
  }, [dryRun, force, fetchStatus, toast]);

  // Setup polling
  useEffect(() => {
    fetchStatus();
    // Clear existing interval if any
    if (pollTimer.current) window.clearInterval(pollTimer.current);
    const id = window.setInterval(fetchStatus, POLL_INTERVAL_MS);
    pollTimer.current = id;
    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current);
    };
  }, [fetchStatus]);

  const unifiedBadge = useMemo(() => {
    const ok = !!status?.hasUnifiedStructure;
    return (
      <Badge colorScheme={ok ? 'green' : 'red'}>{ok ? 'Unified structure detected' : 'Not unified'}</Badge>
    );
  }, [status]);

  const stats = status?.statistics || {};

  return (
    <Box>
      <Flex align="center" mb={4}>
        <Heading size="md">Safe Relational DB Migration</Heading>
        <Spacer />
        <HStack>
          <IconButton aria-label="Refresh status" icon={<RepeatIcon />} size="sm" onClick={fetchStatus} isLoading={isLoading} />
        </HStack>
      </Flex>

      <Text color="gray.600" mb={4}>
        Jalankan migrasi aman untuk menyatukan struktur database menggunakan pendekatan drop/create agar bebas dari konflik foreign key.
        Fitur ini mendukung Dry Run (tanpa write) dan Force (paksa recreate) sesuai kebutuhan.
      </Text>

      {error && (
        <Box mb={4}>
          <Alert status="error">
            <AlertIcon />
            {error}
          </Alert>
        </Box>
      )}

      <Box p={4} borderWidth="1px" borderRadius="md" bg="white" mb={6}>
        <Stack spacing={4}>
          <HStack>
            <Checkbox isChecked={dryRun} onChange={(e) => setDryRun(e.target.checked)}>
              Dry Run (tidak menulis perubahan)
            </Checkbox>
            <Checkbox isChecked={force} onChange={(e) => setForce(e.target.checked)}>
              Force recreate structure
            </Checkbox>
          </HStack>
          <HStack>
            <Button colorScheme="teal" onClick={startMigration} isLoading={isStarting}>
              Start Migration
            </Button>
            <Button variant="outline" onClick={fetchStatus} isLoading={isLoading}>
              Refresh Status Now
            </Button>
            <Text color="gray.500">Last updated: {lastUpdated || '-'}</Text>
          </HStack>
        </Stack>
      </Box>

      <Box p={4} borderWidth="1px" borderRadius="md" bg="white">
        <HStack mb={3}>
          <Heading size="sm">Current Status</Heading>
          {unifiedBadge}
        </HStack>
        {status?.migrationMethod && (
          <Text fontSize="sm" color="gray.600" mb={3}>
            Method: {status.migrationMethod}
          </Text>
        )}
        <Divider mb={4} />
        <SimpleGrid columns={{ base: 1, md: 3, lg: 5 }} spacing={4}>
          <Stat>
            <StatLabel>Unified Outlets</StatLabel>
            <StatNumber>{stats.unifiedOutlets ?? '-'}</StatNumber>
            <StatHelpText>Total rows in outlets_unified</StatHelpText>
          </Stat>
          <Stat>
            <StatLabel>Orders Linked</StatLabel>
            <StatNumber>{stats.ordersLinked ?? '-'}</StatNumber>
            <StatHelpText>Orders with outlet linkage</StatHelpText>
          </Stat>
          <Stat>
            <StatLabel>Users Linked</StatLabel>
            <StatNumber>{stats.usersLinked ?? '-'}</StatNumber>
            <StatHelpText>Users with assigned outlets</StatHelpText>
          </Stat>
          <Stat>
            <StatLabel>Orders Updated</StatLabel>
            <StatNumber>{stats.ordersUpdated ?? '-'}</StatNumber>
          </Stat>
          <Stat>
            <StatLabel>Users Updated</StatLabel>
            <StatNumber>{stats.usersUpdated ?? '-'}</StatNumber>
          </Stat>
        </SimpleGrid>
      </Box>

      {Array.isArray(status?.sampleOutlets) && status!.sampleOutlets!.length > 0 && (
        <Box mt={6} p={4} borderWidth="1px" borderRadius="md" bg="white">
          <Heading size="sm" mb={3}>Sample Unified Outlets</Heading>
          <Stack spacing={2}>
            {status!.sampleOutlets!.slice(0, 10).map((o: any, idx: number) => (
              <Box key={idx} p={2} borderWidth="1px" borderRadius="md">
                <Text fontSize="sm">{JSON.stringify(o)}</Text>
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
};

const SafeMigrationPage: React.FC = () => {
  return (
    <PasswordProtected
      requiredUsername="Ari Web Pass"
      requiredPassword="KurniaJaya@2100"
      pageTitle="Safe Relational DB Migration"
      storageKey="safe_migration_auth"
    >
      <SafeMigrationPageContent />
    </PasswordProtected>
  );
};

export default SafeMigrationPage;
