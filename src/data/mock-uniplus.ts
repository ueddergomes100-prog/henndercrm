import sample from "./generated/uniplus-sample.json";
import type {
  RepurchaseRule,
  UniplusClient,
  UniplusProduct,
  UniplusSale,
  UniplusSaleItem,
  UniplusSeller,
} from "@/domain/crm/types";

export const MOCK_REFERENCE_DATE = sample.metadata.referenceDate;
export const mockUniplusMetadata = sample.metadata;
export const mockUniplusClients = sample.clients as UniplusClient[];
export const mockUniplusSellers = sample.sellers as UniplusSeller[];
export const mockUniplusProducts = sample.products as UniplusProduct[];
export const mockUniplusSales = sample.sales as UniplusSale[];
export const mockUniplusSaleItems = sample.items as UniplusSaleItem[];
export const mockRepurchaseRules = sample.repurchaseRules as RepurchaseRule[];
