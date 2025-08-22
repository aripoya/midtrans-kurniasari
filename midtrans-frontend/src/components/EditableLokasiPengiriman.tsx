import React, { useState, useEffect } from 'react';
import {
  HStack,
  Text,
  Button,
  Input,
  Select,
  useToast
} from '@chakra-ui/react';
import { adminApi, Outlet } from '../api/adminApi';

interface EditableLokasiPengirimaranProps {
  order: any;
  onOrderUpdate: (updatedOrder: any) => void;
}

const EditableLokasiPengiriman: React.FC<EditableLokasiPengirimaranProps> = ({ order, onOrderUpdate }) => {
  const [editMode, setEditMode] = useState(false);
  const [editedValue, setEditedValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const toast = useToast();

  // Load outlets when component mounts
  useEffect(() => {
    const loadOutlets = async () => {
      try {
        const response = await adminApi.getOutlets();
        if (response.success) {
          setOutlets(response.outlets || response.data || []);
        }
      } catch (error) {
        console.error('Error loading outlets:', error);
      }
    };
    loadOutlets();
  }, []);

  const isDeliveryOrder = order.pickup_method === 'deliveryman' || 
                         order.pickup_method === 'alamat_customer' || 
                         order.pickup_method === 'ojek_online';

  const currentValue = isDeliveryOrder 
    ? (order.customer_address || 'Alamat customer tidak tersedia')
    : (order.outlet_id || 'Outlet tidak ditentukan');

  const handleEdit = () => {
    setEditMode(true);
    setEditedValue(isDeliveryOrder ? (order.customer_address || '') : (order.outlet_id || ''));
  };

  const handleSave = async () => {
    if (!editedValue.trim()) {
      toast({
        title: 'Error',
        description: 'Harap isi lokasi pengiriman yang valid',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsSaving(true);
    try {
      const updateData: any = {};
      
      if (isDeliveryOrder) {
        updateData.customer_address = editedValue;
      } else {
        updateData.outlet_id = editedValue;
      }

      const response = await adminApi.updateOrderDetails(order.id, updateData);
      
      if (response.success) {
        const updatedOrder = { ...order, ...updateData };
        onOrderUpdate(updatedOrder);
        setEditMode(false);
        toast({
          title: 'Berhasil',
          description: 'Lokasi pengiriman berhasil diperbarui',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        throw new Error(response.error || 'Gagal memperbarui lokasi pengiriman');
      }
    } catch (error: any) {
      console.error('Error updating lokasi pengiriman:', error);
      toast({
        title: 'Error',
        description: error.message || 'Gagal memperbarui lokasi pengiriman',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditMode(false);
    setEditedValue('');
  };

  if (editMode) {
    return (
      <HStack spacing={2}>
        {isDeliveryOrder ? (
          <Input
            value={editedValue}
            onChange={(e) => setEditedValue(e.target.value)}
            placeholder="Alamat customer"
            size="sm"
          />
        ) : (
          <Select
            value={editedValue}
            onChange={(e) => setEditedValue(e.target.value)}
            size="sm"
            placeholder="Pilih outlet"
          >
            {outlets.map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name}
              </option>
            ))}
          </Select>
        )}
        <Button
          size="sm"
          colorScheme="green"
          onClick={handleSave}
          isLoading={isSaving}
          loadingText="Saving..."
        >
          Save
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </HStack>
    );
  }

  return (
    <HStack>
      <Text>{currentValue}</Text>
      <Button
        size="xs"
        variant="outline"
        colorScheme="blue"
        onClick={handleEdit}
      >
        Edit
      </Button>
    </HStack>
  );
};

export default EditableLokasiPengiriman;
