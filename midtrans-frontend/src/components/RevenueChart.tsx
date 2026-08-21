import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Box, Text } from '@chakra-ui/react';

interface RevenueChartProps {
  data: Array<{
    period: string;
    revenue: number;
    orders: number;
  }>;
  title?: string;
}

const RevenueChart: React.FC<RevenueChartProps> = ({ data, title }) => {
  // Format currency for tooltip
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <Box
          bg="white"
          p={3}
          borderRadius="md"
          boxShadow="lg"
          border="1px"
          borderColor="gray.200"
        >
          <Text fontWeight="bold" mb={1}>{payload[0].payload.period}</Text>
          <Text color="green.600" fontSize="sm">
            Pendapatan: {formatCurrency(payload[0].value)}
          </Text>
          <Text color="blue.600" fontSize="sm">
            Pesanan: {payload[0].payload.orders}
          </Text>
        </Box>
      );
    }
    return null;
  };

  return (
    <Box>
      {title && (
        <Text fontSize="lg" fontWeight="bold" mb={4}>
          {title}
        </Text>
      )}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis 
            dataKey="period" 
            tick={{ fontSize: 12 }}
            stroke="#718096"
          />
          <YAxis 
            tickFormatter={(value) => {
              if (value >= 1000000) {
                return `${(value / 1000000).toFixed(1)}M`;
              } else if (value >= 1000) {
                return `${(value / 1000).toFixed(0)}K`;
              }
              return value;
            }}
            tick={{ fontSize: 12 }}
            stroke="#718096"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '10px' }}
            formatter={(value) => value === 'revenue' ? 'Pendapatan (Rp)' : value}
          />
          <Line 
            type="monotone" 
            dataKey="revenue" 
            stroke="#38A169" 
            strokeWidth={2}
            dot={{ fill: '#38A169', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default RevenueChart;
