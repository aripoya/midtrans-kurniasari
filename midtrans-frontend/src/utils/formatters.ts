// Utility functions for formatting data

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    return dateString;
  }
};

// Format date as dd/mm/yyyy
export const formatDateShort = (dateString: string | Date): string => {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    return typeof dateString === 'string' ? dateString : '';
  }
};

// Format date and time as dd/mm/yyyy HH:mm
export const formatDateTime = (dateString: string | Date): string => {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (error) {
    return typeof dateString === 'string' ? dateString : '';
  }
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('id-ID').format(num);
};
