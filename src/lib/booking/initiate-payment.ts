import { createMpgPaymentForm, getSiteUrl } from "@/lib/payments/newebpay";

import { createOneToOneBooking, createWorkshopBooking } from "./create-booking";

/**
 * 建立预约（status=pending）并组出导向藍新 MPG 付款页所需的表单栏位，见 spec 七节 API 端点设计。
 * 一次性付款走 T3.1 的 MPG，不使用定期定额（预约付款非订阅行为），见 spec 八节。
 */
export async function startOneToOneBookingCheckout(params: {
  serviceId: string;
  userId: string;
  startAt: Date;
  customerNote?: string;
}) {
  const { booking, service } = await createOneToOneBooking(params);
  const siteUrl = getSiteUrl();

  const { gatewayUrl, fields } = createMpgPaymentForm({
    merchantOrderNo: booking.newebpayMerchantOrderNo,
    amt: service.priceAmount,
    itemDesc: service.name,
    notifyUrl: `${siteUrl}/api/payments/newebpay/booking/confirm`,
    returnUrl: `${siteUrl}/booking/success`,
    clientBackUrl: `${siteUrl}/booking`,
  });

  return { bookingId: booking.id, gatewayUrl, fields };
}

export async function startWorkshopBookingCheckout(params: {
  sessionId: string;
  userId: string;
  customerNote?: string;
}) {
  const { booking, service } = await createWorkshopBooking(params);
  const siteUrl = getSiteUrl();

  const { gatewayUrl, fields } = createMpgPaymentForm({
    merchantOrderNo: booking.newebpayMerchantOrderNo,
    amt: service.priceAmount,
    itemDesc: service.name,
    notifyUrl: `${siteUrl}/api/payments/newebpay/booking/confirm`,
    returnUrl: `${siteUrl}/booking/success`,
    clientBackUrl: `${siteUrl}/booking`,
  });

  return { bookingId: booking.id, gatewayUrl, fields };
}
