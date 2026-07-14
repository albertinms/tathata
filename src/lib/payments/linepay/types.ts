export type LinePayCurrency = "TWD" | "USD" | "THB";

export type LinePayPackageProduct = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl?: string;
};

export type LinePayPackage = {
  id: string;
  amount: number;
  products: LinePayPackageProduct[];
  userFee?: number;
};

export type LinePayRequestPaymentInput = {
  amount: number;
  currency: LinePayCurrency;
  orderId: string;
  packages: LinePayPackage[];
  redirectUrls: { confirmUrl: string; cancelUrl: string };
  options?: {
    payment?: { payType?: "NORMAL" | "PREAPPROVED" };
  };
};

export type LinePayApiResponse<TInfo> = {
  returnCode: string;
  returnMessage: string;
  info: TInfo;
};

export type LinePayRequestPaymentInfo = {
  paymentUrl: { web: string; app: string };
  transactionId: number;
  paymentAccessToken: string;
};

export type LinePayPayInfo = {
  method: string;
  amount: number;
};

export type LinePayConfirmPaymentInfo = {
  orderId: string;
  transactionId: number;
  payInfo: LinePayPayInfo[];
  regKey?: string;
};

export type LinePayPreapprovedChargeInfo = {
  transactionId: number;
  transactionDate: string;
};
