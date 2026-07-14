export type CatalogProductType = "book_package" | "course";

export type CatalogProduct = {
  productType: CatalogProductType;
  productRef: string;
  name: string;
  amount: number;
  currency: "TWD";
};

/**
 * 占位商品目录：命书套餐／课程尚无真实目录表（T4.1／EPIC-8 尚未建立）。
 * 价格刻意写死在这里、不接受前端/URL 传入，避免竄改风险；真正的目录上线后
 * 应改查资料表，只要维持 findCatalogProduct 的介面不变，呼叫端（checkout.ts）不需要改动。
 */
const CATALOG: CatalogProduct[] = [
  {
    productType: "book_package",
    productRef: "book_package_full",
    name: "完整命书套餐",
    amount: 990,
    currency: "TWD",
  },
];

export function findCatalogProduct(
  productType: string,
  productRef: string,
): CatalogProduct | undefined {
  return CATALOG.find((p) => p.productType === productType && p.productRef === productRef);
}
