interface FeeStructure {
  tuitionFee: number;
  transportFee?: number;
  bookFee?: number;
  hostelFee?: number;
  otherFee?: number;
}

interface FeeResult {
  totalFee: number;
  netFee: number;
}

export function calculateNetFee(
  structure: FeeStructure,
  discount: number = 0,
): FeeResult {
  const total: number =
    structure.tuitionFee +
    (structure.transportFee || 0) +
    (structure.bookFee || 0) +
    (structure.hostelFee || 0) +
    (structure.otherFee || 0);

  return {
    totalFee: total,
    netFee: total - discount,
  };
}

function calculatePending(netFee: number, payments: number[]) {
  const totalPaid = payments.reduce((a, b) => a + b, 0);
  return netFee - totalPaid;
}
